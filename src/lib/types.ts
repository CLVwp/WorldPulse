// Contrat de données partagé front (React) ↔ API (worker Hono).

export type Intensity = 1 | 2 | 3;
export type OsirisKind = "flight" | "satellite" | "conflict" | "earthquake";
export type ViewId = "news" | OsirisKind;

/** News RSS géolocalisée (format stocké en KV, servi par /api/events). */
export interface PulseEvent {
  id: string;
  title: string;
  url: string | null;
  source: string;
  sourceId: string;
  publishedAt: string | null;
  description: string | null;
  countryCode: string;
  countryName: string;
  /** Centroïde pays : position dézoomé. */
  lat: number;
  lng: number;
  /** Position ville mentionnée : affichée à partir du zoom 3. */
  cityLat: number | null;
  cityLng: number | null;
  intensity: Intensity;
  timestamp: number;
}

/** Event OSIRIS normalisé (vols, satellites, conflits, séismes). */
export interface OsirisItem {
  id: string;
  kind: OsirisKind;
  lat: number;
  lng: number;
  title: string;
  sub: string | null;
  url: string | null;
  ts: number;
  intensity: Intensity;
  meta?: Record<string, unknown>;
}

export interface FetchStats {
  items: number;
  lastFetchAt: string | null;
}

export interface EventsResponse extends FetchStats {
  events: PulseEvent[];
}

export interface OsirisResponse {
  items: OsirisItem[];
  feeds: Record<string, { items: number; fetchedAt: string | null }>;
}

// --- Couleurs (thème papier du portefolio) ----------------------------------

export const INTENSITY_COLORS: Record<Intensity, string> = {
  1: "#0d9488", // teal : faible
  2: "#d97706", // ambre : moyen
  3: "#dc2626", // rouge : fort
};

export const KIND_META: Record<OsirisKind, { label: string; color: string }> = {
  flight: { label: "Vols", color: "#0369a1" },
  satellite: { label: "Satellites", color: "#b45309" },
  conflict: { label: "Conflits", color: "#dc2626" },
  earthquake: { label: "Séismes", color: "#ea580c" },
};

export const VIEWS: { id: ViewId; label: string }[] = [
  { id: "news", label: "News" },
  { id: "flight", label: "Vols" },
  { id: "satellite", label: "Sats" },
  { id: "conflict", label: "Conflits" },
  { id: "earthquake", label: "Séismes" },
];

/** "42s" / "7min" / "3h" / "2j" — labels courts du flux. */
export function timeAgo(ts: number): string {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}
