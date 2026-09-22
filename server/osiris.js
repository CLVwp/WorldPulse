// Connecteur OSIRIS (osirisai.live, API publique sans clé) : vols, satellites,
// conflits, séismes → normalisés dans le format "event" de WorldPulse.
// Chaque feed est pollé à son propre rythme (TTL) et diffusé via SSE comme les news.
import { fetchWithTimeout } from "./fetchClient.js";

const BASE = "https://osirisai.live/api";

// TTL par feed : Osiris met ses propres caches (45-60s), poller plus vite ne sert à rien.
const FEEDS = [
  { id: "flights",     url: `${BASE}/flights`,     ttl: 60_000 },
  { id: "satellites",  url: `${BASE}/satellites`,  ttl: 120_000 },
  { id: "conflicts",   url: `${BASE}/conflicts`,   ttl: 90_000 },
  { id: "earthquakes", url: `${BASE}/earthquakes`, ttl: 120_000 },
];

// Limites d'affichage : on ne pousse pas 9000 avions dans le DOM.
const MAX_FLIGHTS = 250;      // échantillon réparti par buckets géo
const MAX_SATS = 60;          // catégories intéressantes seulement
const MAX_QUAKES = 60;        // M4.5+ sur ~24h
const MAX_CONFLICT_EVENTS = 120;

const state = new Map();      // feedId -> { items: [], fetchedAt: 0 }
const listeners = new Set();

export function onOsirisUpdate(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function emit(feedId, items) {
  if (!items.length) return;
  const payload = JSON.stringify({ type: "osiris", feed: feedId, items });
  for (const fn of listeners) {
    try { fn(payload); } catch { /* client parti */ }
  }
}

async function getJson(url) {
  const text = await fetchWithTimeout(url);
  return JSON.parse(text);
}

// --- Normalisation ----------------------------------------------------------
// Format unifié : { id, kind, lat, lng, title, sub, url, ts, intensity, meta }

function normFlight(f) {
  return {
    id: `osiris:fl:${f.icao24}`,
    kind: "flight",
    lat: f.lat, lng: f.lng,
    title: f.callsign && f.callsign !== "N/A" ? f.callsign : `Vol ${f.icao24}`,
    sub: `${f.category ?? "flight"} · ${Math.round(f.alt)} m · ${Math.round(f.speed_knots)} kt`,
    url: null,
    ts: Date.now(),
    intensity: f.category === "military" ? 3 : 1,
    meta: { model: f.model, heading: f.heading, grounded: f.grounded },
  };
}

function normSat(s) {
  return {
    id: `osiris:sat:${s.noradId ?? s.name}`,
    kind: "satellite",
    lat: s.lat, lng: s.lng,
    title: s.name,
    sub: `${s.mission ?? s.category ?? "orbital"} · alt ${Math.round(s.alt)} km`,
    url: null,
    ts: Date.now(),
    intensity: s.category === "military" ? 3 : 1,
    meta: { category: s.category, color: s.color },
  };
}

function normQuake(q) {
  const m = q.magnitude ?? 0;
  return {
    id: `osiris:eq:${q.id}`,
    kind: "earthquake",
    lat: q.lat, lng: q.lng,
    title: `M${m.toFixed(1)} — ${q.place ?? "lieu inconnu"}`,
    sub: `profondeur ${q.depth ?? "?"} km${q.tsunami ? " · ⚠ tsunami" : ""}`,
    url: q.url ?? null,
    ts: q.time ?? Date.now(),
    intensity: m >= 6 ? 3 : m >= 5 ? 2 : 1,
    meta: { magnitude: m, depth: q.depth },
  };
}

function normConflictEvent(e, zone) {
  return {
    id: `osiris:cf:${e.id}`,
    kind: "conflict",
    lat: e.lat ?? zone.lat, lng: e.lng ?? zone.lng,
    title: e.title ?? zone.label,
    sub: `${zone.label} · ${zone.severity ?? "conflict"}`,
    url: e.url ?? zone.sourceUrl ?? null,
    ts: e.timestamp ? Date.parse(e.timestamp) : Date.now(),
    intensity: zone.severity === "war" ? 3 : 2,
    meta: { zone: zone.id, severity: zone.severity },
  };
}

// Échantillonnage géo : garde au plus N points en gardant une couverture mondiale
// (bucket 10°x10°, on garde les plus récents/intenses par bucket).
function sampleGeo(items, max) {
  if (items.length <= max) return items;
  const buckets = new Map();
  for (const it of items) {
    const key = `${Math.floor(it.lat / 10)}:${Math.floor(it.lng / 10)}`;
    const list = buckets.get(key) ?? [];
    list.push(it);
    buckets.set(key, list);
  }
  const perBucket = Math.max(1, Math.ceil(max / buckets.size));
  const out = [];
  for (const list of buckets.values()) {
    list.sort((a, b) => b.intensity - a.intensity || b.ts - a.ts);
    out.push(...list.slice(0, perBucket));
  }
  return out.slice(0, max);
}

// --- Fetch par feed ----------------------------------------------------------
const NORMALIZERS = {
  flights: (d) => sampleGeo([...(d.commercial_flights ?? []), ...(d.military_flights ?? [])], MAX_FLIGHTS).map(normFlight),
  satellites: (d) => {
    const keep = new Set(["science", "military", "earth_obs", "comms", "navigation"]);
    const sats = (d.satellites ?? []).filter((s) => keep.has(s.category));
    return sampleGeo(sats.map(normSat), MAX_SATS);
  },
  earthquakes: (d) => (d.earthquakes ?? [])
    .filter((q) => (q.magnitude ?? 0) >= 4.5)
    .sort((a, b) => (b.magnitude ?? 0) - (a.magnitude ?? 0))
    .slice(0, MAX_QUAKES)
    .map(normQuake),
  conflicts: (d) => {
    const zones = d.zones ?? [];
    const events = zones.flatMap((z) => (z.events ?? []).map((e) => normConflictEvent(e, z)));
    // Zones sans events : la zone elle-même devient un point (ex. frontlines)
    const withEvents = new Set(events.map((e) => e.meta.zone));
    const zonePoints = zones
      .filter((z) => !withEvents.has(z.id))
      .map((z) => normConflictEvent({ id: `zone-${z.id}`, title: z.label, url: z.sourceUrl, timestamp: z.lastUpdated }, z));
    return [...events, ...zonePoints].slice(0, MAX_CONFLICT_EVENTS);
  },
};

// feedState : état persisté (déploiement Workers) { feedId: { items, fetchedAt } }
// pour respecter les TTL et conserver les items des feeds non re-pollés.
export async function refreshOsiris({ force = false, feedState = {} } = {}) {
  const now = Date.now();
  const results = await Promise.all(FEEDS.map(async (feed) => {
    const saved = feedState[feed.id];
    const st = state.get(feed.id) ?? { items: saved?.items ?? [], fetchedAt: saved?.fetchedAt ?? 0 };
    if (!force && now - st.fetchedAt < feed.ttl) return { feed, items: st.items, fresh: false, error: null };
    try {
      const data = await getJson(feed.url);
      const items = NORMALIZERS[feed.id](data);
      st.items = items;
      st.fetchedAt = now;
      state.set(feed.id, st);
      return { feed, items, fresh: true, error: null, fetchedAt: st.fetchedAt };
    } catch (err) {
      return { feed, items: st.items, fresh: false, error: err.message, fetchedAt: st.fetchedAt };
    }
  }));

  // Diffuse uniquement les feeds rafraîchis
  for (const r of results) {
    if (r.fresh) emit(r.feed.id, r.items);
  }
  return {
    ok: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    feeds: results.map((r) => ({ id: r.feed.id, ok: !r.error, items: r.items.length, fresh: r.fresh, error: r.error, fetchedAt: r.fetchedAt })),
  };
}

export function getOsirisItems() {
  const out = [];
  for (const st of state.values()) out.push(...st.items);
  return out;
}

export function getOsirisStats() {
  const feeds = {};
  for (const feed of FEEDS) {
    const st = state.get(feed.id);
    feeds[feed.id] = { items: st?.items.length ?? 0, fetchedAt: st ? new Date(st.fetchedAt).toISOString() : null };
  }
  return feeds;
}
