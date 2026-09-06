// Agrégateur : collecte toutes les sources, déduit le pays, déduplique,
// et diffuse les nouveaux events aux abonnés SSE.
import { RSS_SOURCES } from "./sources.js";
import { fetchWithTimeout } from "./fetchClient.js";
import { parseRss } from "./rssParser.js";
import { detectCountry, detectCity, getCountry } from "./geo.js";

const MAX_ITEMS = 400;
const RETENTION_MS = 6 * 60 * 60 * 1000; // 6h

// Mots de gravité → niveau d'intensité (1 faible, 2 moyen, 3 fort).
const HOT = /(war|attack|killed|dead|death|earthquake|explosion|strike|missile|invasion|famine|massacre|bomb|shooting|crash|tsunami|hurricane|flood)/i;
const WARM = /(crisis|protest|collapse|sanction|emergency|outbreak|conflict|clash|tension|court|verdict|election|resign|scandal)/i;

function intensityFor(text) {
  const t = String(text);
  if (HOT.test(t)) return 3;
  if (WARM.test(t)) return 2;
  return 1;
}

const itemsById = new Map(); // id -> item enrichi
const subscribers = new Set(); // callbacks SSE

let lastFetchAt = null;
let lastFetchStats = { ok: 0, failed: 0, sources: [] };

export function subscribe(listener) {
  subscribers.add(listener);
  return () => subscribers.delete(listener);
}

export function getStats() {
  return {
    items: itemsById.size,
    lastFetchAt,
    lastFetchStats,
    subscribers: subscribers.size,
  };
}

export function getRecentItems({ limit = 200 } = {}) {
  return [...itemsById.values()].sort((a, b) => b.timestamp - a.timestamp).slice(0, limit);
}

function pushItem(item) {
  if (itemsById.has(item.id)) return false;

  const text = `${item.title} ${item.description ?? ""}`;
  const code = detectCountry(text);
  if (!code) return false; // MVP : on ne garde que ce qu'on sait géolocaliser

  const country = getCountry(code);
  const city = detectCity(text);

  const enriched = {
    ...item,
    countryCode: code,
    countryName: country.name,
    // Position "pays" (centroid) : affichée dézoomé
    lat: country.lat,
    lng: country.lng,
    // Position "précise" (ville mentionnée) : affichée zoomé si disponible
    cityLat: city && city.countryCode === code ? city.lat : null,
    cityLng: city && city.countryCode === code ? city.lng : null,
    intensity: intensityFor(text),
    timestamp: item.publishedAt ? Date.parse(item.publishedAt) : Date.now(),
  };

  itemsById.set(enriched.id, enriched);
  return true;
}

function prune() {
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, item] of itemsById) {
    if (item.timestamp < cutoff) itemsById.delete(id);
  }
  // Garde-fou taille
  if (itemsById.size > MAX_ITEMS) {
    const sorted = [...itemsById.values()].sort((a, b) => a.timestamp - b.timestamp);
    for (const item of sorted.slice(0, itemsById.size - MAX_ITEMS)) itemsById.delete(item.id);
  }
}

function broadcast(events) {
  if (!events.length || subscribers.size === 0) return;
  const payload = JSON.stringify({ type: "events", events });
  for (const listener of subscribers) {
    try { listener(payload); } catch { /* client parti */ }
  }
}

async function fetchOne(source) {
  try {
    const text = await fetchWithTimeout(source.url);
    return { source, items: parseRss(text, source), error: null };
  } catch (err) {
    return { source, items: [], error: err.message };
  }
}

export async function refreshAll() {
  const results = await Promise.all(RSS_SOURCES.map(fetchOne));

  const fresh = [];
  for (const { items } of results) {
    for (const item of items) {
      if (pushItem(item)) fresh.push(itemsById.get(item.id));
    }
  }
  prune();

  fresh.sort((a, b) => b.timestamp - a.timestamp);
  broadcast(fresh.slice(0, 40));

  lastFetchAt = new Date().toISOString();
  lastFetchStats = {
    ok: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    sources: results.map((r) => ({ id: r.source.id, ok: !r.error, items: r.items.length, error: r.error })),
  };

  return lastFetchStats;
}

// Dédup : l'ID (source:hash) suffit — pas de fuzzy matching.
