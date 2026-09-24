// Agrégateur : collecte toutes les sources RSS, déduit le pays, déduplique.
// Sur Workers il n'y a ni mémoire partagée ni SSE : le résultat est persisté
// dans le snapshot KV par worker/index.ts (hydrate → scan → persist).

import type { FetchStats, Intensity, PulseEvent } from "@/lib/types";
import { fetchWithTimeout } from "./fetch-client";
import { detectCity, detectCountry, getCountry } from "./geo";
import { parseRss, type RssItem } from "./rss-parser";
import { RSS_SOURCES } from "./sources";

const MAX_ITEMS = 400;
const RETENTION_MS = 6 * 60 * 60 * 1000; // 6h

// Mots de gravité → niveau d'intensité (1 faible, 2 moyen, 3 fort).
const HOT =
  /(war|attack|killed|dead|death|earthquake|explosion|strike|missile|invasion|famine|massacre|bomb|shooting|crash|tsunami|hurricane|flood)/i;
const WARM =
  /(crisis|protest|collapse|sanction|emergency|outbreak|conflict|clash|tension|court|verdict|election|resign|scandal)/i;

function intensityFor(text: string): Intensity {
  if (HOT.test(text)) return 3;
  if (WARM.test(text)) return 2;
  return 1;
}

const itemsById = new Map<string, PulseEvent>();
let lastFetchAt: string | null = null;

export function getRecentItems(limit = 200): PulseEvent[] {
  return [...itemsById.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, limit);
}

export function getStats(): FetchStats {
  return { items: itemsById.size, lastFetchAt };
}

// Entrée géolocalisable : couvre RssItem (scan) et PulseEvent (hydrate KV).
interface GeoInput {
  id: string;
  title: string;
  url: string | null;
  source: string;
  sourceId: string;
  publishedAt: string | null;
  description: string | null;
}

function pushItem(item: GeoInput): boolean {
  if (itemsById.has(item.id)) return false;

  const text = `${item.title} ${item.description ?? ""}`;
  const code = detectCountry(text);
  if (!code) return false; // MVP : on ne garde que ce qu'on sait géolocaliser

  const country = getCountry(code);
  if (!country) return false;
  const city = detectCity(text);

  const enriched: PulseEvent = {
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

function prune(): void {
  const cutoff = Date.now() - RETENTION_MS;
  for (const [id, item] of itemsById) {
    if (item.timestamp < cutoff) itemsById.delete(id);
  }
  // Garde-fou taille
  if (itemsById.size > MAX_ITEMS) {
    const sorted = [...itemsById.values()].sort(
      (a, b) => a.timestamp - b.timestamp,
    );
    for (const item of sorted.slice(0, itemsById.size - MAX_ITEMS))
      itemsById.delete(item.id);
  }
}

async function fetchOne(source: (typeof RSS_SOURCES)[number]) {
  try {
    const text = await fetchWithTimeout(source.url);
    return { items: parseRss(text, source), error: null };
  } catch (err) {
    return {
      items: [] as RssItem[],
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function refreshAll(): Promise<void> {
  const results = await Promise.all(RSS_SOURCES.map(fetchOne));
  for (const { items } of results) {
    for (const item of items) pushItem(item);
  }
  prune();
  lastFetchAt = new Date().toISOString();
}

// Hydrate le store mémoire depuis un snapshot persisté (déploiement Workers).
// Idempotent : pushItem dédoublonne par id et ré-enrichit à l'identique.
export function hydrate(items: PulseEvent[]): void {
  for (const it of items) pushItem(it);
}
