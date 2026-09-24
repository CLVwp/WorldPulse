// Connecteur OSIRIS (osirisai.live, API publique sans clé) : vols, satellites,
// conflits, séismes → normalisés dans le format "event" de WorldPulse.
// Chaque feed est pollé à son propre rythme (TTL) ; sur Workers, l'état vient
// du snapshot KV passé en argument (feedState), pas d'une mémoire partagée.
import type { Intensity, OsirisItem, OsirisKind } from "@/lib/types";

const BASE = "https://osirisai.live/api";

// TTL par feed : Osiris met ses propres caches (45-60s), poller plus vite ne sert à rien.
const FEEDS: { id: OsirisKind; url: string; ttl: number }[] = [
  { id: "flight", url: `${BASE}/flights`, ttl: 60_000 },
  { id: "satellite", url: `${BASE}/satellites`, ttl: 120_000 },
  { id: "conflict", url: `${BASE}/conflicts`, ttl: 90_000 },
  { id: "earthquake", url: `${BASE}/earthquakes`, ttl: 120_000 },
];

// Limites d'affichage : on ne pousse pas 9000 avions dans le DOM.
const MAX_FLIGHTS = 250; // échantillon réparti par buckets géo
const MAX_SATS = 60; // catégories intéressantes seulement
const MAX_QUAKES = 60; // M4.5+ sur ~24h
const MAX_CONFLICT_EVENTS = 120;

// Formes brutes de l'API Osiris (champs optionnels : l'API est non contractuelle).
interface RawFlight {
  icao24?: string;
  callsign?: string;
  lat?: number;
  lng?: number;
  alt?: number;
  speed_knots?: number;
  category?: string;
  model?: string;
  heading?: number;
  grounded?: boolean;
}
interface RawSat {
  noradId?: string | number;
  name?: string;
  lat?: number;
  lng?: number;
  alt?: number;
  mission?: string;
  category?: string;
}
interface RawQuake {
  id?: string | number;
  magnitude?: number;
  place?: string;
  depth?: number;
  tsunami?: boolean;
  lat?: number;
  lng?: number;
  time?: number;
  url?: string;
}
interface RawConflictEvent {
  id?: string | number;
  title?: string;
  lat?: number;
  lng?: number;
  url?: string;
  timestamp?: string;
}
interface RawZone {
  id?: string | number;
  label?: string;
  lat?: number;
  lng?: number;
  severity?: string;
  sourceUrl?: string;
  lastUpdated?: string;
  events?: RawConflictEvent[];
}
type RawPayload = Record<string, unknown>;

const num = (v: unknown): number => (typeof v === "number" ? v : 0);
const str = (v: unknown): string | null =>
  typeof v === "string" && v ? v : null;

// --- Normalisation ----------------------------------------------------------
// Format unifié : { id, kind, lat, lng, title, sub, url, ts, intensity, meta }

function normFlight(f: RawFlight): OsirisItem {
  return {
    id: `osiris:fl:${f.icao24 ?? Math.random().toString(36).slice(2, 8)}`,
    kind: "flight",
    lat: num(f.lat),
    lng: num(f.lng),
    title:
      f.callsign && f.callsign !== "N/A"
        ? f.callsign
        : `Vol ${f.icao24 ?? "?"}`,
    sub: `${f.category ?? "flight"} · ${Math.round(num(f.alt))} m · ${Math.round(num(f.speed_knots))} kt`,
    url: null,
    ts: Date.now(),
    intensity: f.category === "military" ? 3 : 1,
    meta: { model: f.model, heading: f.heading, grounded: f.grounded },
  };
}

function normSat(s: RawSat): OsirisItem {
  return {
    id: `osiris:sat:${s.noradId ?? s.name ?? Math.random().toString(36).slice(2, 8)}`,
    kind: "satellite",
    lat: num(s.lat),
    lng: num(s.lng),
    title: s.name ?? "Satellite",
    sub: `${s.mission ?? s.category ?? "orbital"} · alt ${Math.round(num(s.alt))} km`,
    url: null,
    ts: Date.now(),
    intensity: s.category === "military" ? 3 : 1,
    meta: { category: s.category },
  };
}

function normQuake(q: RawQuake): OsirisItem {
  const m = num(q.magnitude);
  return {
    id: `osiris:eq:${q.id ?? Math.random().toString(36).slice(2, 8)}`,
    kind: "earthquake",
    lat: num(q.lat),
    lng: num(q.lng),
    title: `M${m.toFixed(1)} — ${q.place ?? "lieu inconnu"}`,
    sub: `profondeur ${q.depth ?? "?"} km${q.tsunami ? " · ⚠ tsunami" : ""}`,
    url: q.url ?? null,
    ts: q.time ?? Date.now(),
    intensity: m >= 6 ? 3 : m >= 5 ? 2 : 1,
    meta: { magnitude: m, depth: q.depth },
  };
}

function normConflictEvent(e: RawConflictEvent, zone: RawZone): OsirisItem {
  const severity = zone.severity;
  const intensity: Intensity = severity === "war" ? 3 : 2;
  return {
    id: `osiris:cf:${e.id ?? Math.random().toString(36).slice(2, 8)}`,
    kind: "conflict",
    lat: e.lat ?? num(zone.lat),
    lng: e.lng ?? num(zone.lng),
    title: e.title ?? zone.label ?? "Zone de conflit",
    sub: `${zone.label ?? "conflit"} · ${severity ?? "conflict"}`,
    url: e.url ?? zone.sourceUrl ?? null,
    ts: e.timestamp ? Date.parse(e.timestamp) || Date.now() : Date.now(),
    intensity,
    meta: { zone: zone.id, severity },
  };
}

// Échantillonnage géo : garde au plus N points en gardant une couverture mondiale
// (bucket 10°x10°, on garde les plus récents/intenses par bucket).
function sampleGeo(items: OsirisItem[], max: number): OsirisItem[] {
  if (items.length <= max) return items;
  const buckets = new Map<string, OsirisItem[]>();
  for (const it of items) {
    const key = `${Math.floor(it.lat / 10)}:${Math.floor(it.lng / 10)}`;
    const list = buckets.get(key) ?? [];
    list.push(it);
    buckets.set(key, list);
  }
  const perBucket = Math.max(1, Math.ceil(max / buckets.size));
  const out: OsirisItem[] = [];
  for (const list of buckets.values()) {
    list.sort((a, b) => b.intensity - a.intensity || b.ts - a.ts);
    out.push(...list.slice(0, perBucket));
  }
  return out.slice(0, max);
}

const NORMALIZERS: Record<OsirisKind, (d: RawPayload) => OsirisItem[]> = {
  flight: (d) =>
    sampleGeo(
      [
        ...((d.commercial_flights as RawFlight[] | undefined) ?? []),
        ...((d.military_flights as RawFlight[] | undefined) ?? []),
      ].map(normFlight),
      MAX_FLIGHTS,
    ),
  satellite: (d) => {
    const keep = new Set([
      "science",
      "military",
      "earth_obs",
      "comms",
      "navigation",
    ]);
    const sats = ((d.satellites as RawSat[] | undefined) ?? []).filter((s) =>
      keep.has(s.category ?? ""),
    );
    return sampleGeo(sats.map(normSat), MAX_SATS);
  },
  earthquake: (d) =>
    ((d.earthquakes as RawQuake[] | undefined) ?? [])
      .filter((q) => num(q.magnitude) >= 4.5)
      .sort((a, b) => num(b.magnitude) - num(a.magnitude))
      .slice(0, MAX_QUAKES)
      .map(normQuake),
  conflict: (d) => {
    const zones = (d.zones as RawZone[] | undefined) ?? [];
    const events = zones.flatMap((z) =>
      (z.events ?? []).map((e) => normConflictEvent(e, z)),
    );
    // Zones sans events : la zone elle-même devient un point (ex. frontlines)
    const withEvents = new Set(events.map((e) => str(e.meta?.zone)));
    const zonePoints = zones
      .filter((z) => !withEvents.has(str(z.id)))
      .map((z) =>
        normConflictEvent(
          {
            id: `zone-${z.id}`,
            title: z.label,
            url: z.sourceUrl,
            timestamp: z.lastUpdated,
          },
          z,
        ),
      );
    return [...events, ...zonePoints].slice(0, MAX_CONFLICT_EVENTS);
  },
};

export interface FeedResult {
  id: OsirisKind;
  items: OsirisItem[];
  fresh: boolean;
  fetchedAt: number;
  error: string | null;
}

export interface RefreshOsirisResult {
  ok: number;
  failed: number;
  feeds: FeedResult[];
}

// feedState : état persisté (déploiement Workers) { feedId: { items, fetchedAt } }
// pour respecter les TTL et conserver les items des feeds non re-pollés.
export async function refreshOsiris({
  force = false,
  feedState = {},
}: {
  force?: boolean;
  feedState?: Record<string, { items: OsirisItem[]; fetchedAt: number }>;
} = {}): Promise<RefreshOsirisResult> {
  const now = Date.now();
  const results = await Promise.all(
    FEEDS.map(async (feed): Promise<FeedResult> => {
      const saved = feedState[feed.id];
      let items = saved?.items ?? [];
      let fetchedAt = saved?.fetchedAt ?? 0;
      if (!force && now - fetchedAt < feed.ttl) {
        return { id: feed.id, items, fresh: false, fetchedAt, error: null };
      }
      try {
        const res = await fetch(feed.url, {
          signal: AbortSignal.timeout(12_000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as RawPayload;
        items = NORMALIZERS[feed.id](data);
        fetchedAt = now;
        return { id: feed.id, items, fresh: true, fetchedAt, error: null };
      } catch (err) {
        return {
          id: feed.id,
          items,
          fresh: false,
          fetchedAt,
          error: err instanceof Error ? err.message : String(err),
        };
      }
    }),
  );

  return {
    ok: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    feeds: results,
  };
}
