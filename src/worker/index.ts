// Entrée Cloudflare Workers : assets statiques (export Next.js, voir
// wrangler.jsonc) + API Hono. Les isolates Workers ne partagent pas de mémoire :
// l'état vit en KV (binding CACHE) et le refresh est piloté par le Cron.
import { Hono } from "hono";
import { cors } from "hono/cors";
import type {
  EventsResponse,
  FetchStats,
  OsirisItem,
  PulseEvent,
} from "@/lib/types";
import { getRecentItems, getStats, hydrate, refreshAll } from "./aggregator";
import { type FeedResult, refreshOsiris } from "./osiris";

interface Env {
  CACHE: {
    get(key: string, type: "json"): Promise<unknown>;
    put(key: string, value: string): Promise<void>;
  };
}

const app = new Hono<{ Bindings: Env }>();

// CORS : utile uniquement en dev (next dev :3000 → wrangler dev :8787) ;
// inoffensif en prod, les données sont publiques.
app.use("*", cors());

const RSS_INTERVAL_MS = 90_000; // les sources ne sont pas martelées plus vite que 90s
const MANUAL_THROTTLE_MS = 30_000;
// ponytail: les positions vols/sats >15 min sont fausses → purge ; borne à garder
// supérieure à la période du cron (10 min), monter les deux ensemble si besoin.
const OSIRIS_RETENTION_MS = 15 * 60_000;
const SNAPSHOT_KEY = "snapshot";

interface Snapshot {
  events: PulseEvent[];
  stats: FetchStats | null;
  osirisState: Record<string, { items: OsirisItem[]; fetchedAt: number }>;
  lastRssAt: number;
  lastManualAt: number;
}

const emptySnapshot = (): Snapshot => ({
  events: [],
  stats: null,
  osirisState: {},
  lastRssAt: 0,
  lastManualAt: 0,
});

async function readSnapshot(env: Env): Promise<Snapshot> {
  const raw = await env.CACHE.get(SNAPSHOT_KEY, "json");
  if (!raw || typeof raw !== "object") return emptySnapshot();
  const snap = raw as Partial<Snapshot>;
  return {
    events: Array.isArray(snap.events) ? snap.events : [],
    stats: snap.stats ?? null,
    osirisState: snap.osirisState ?? {},
    lastRssAt: snap.lastRssAt ?? 0,
    lastManualAt: snap.lastManualAt ?? 0,
  };
}

const writeSnapshot = (env: Env, snap: Snapshot): Promise<void> =>
  env.CACHE.put(SNAPSHOT_KEY, JSON.stringify(snap));

interface RefreshWorldResult {
  snap: Snapshot;
  rssStats: FetchStats | null;
  throttled?: false;
}

// Cycle complet : hydrate la mémoire de CET isolate depuis KV, scanne, re-persiste.
async function refreshWorld(
  env: Env,
  {
    forceRss = false,
    manual = false,
  }: { forceRss?: boolean; manual?: boolean } = {},
): Promise<RefreshWorldResult | { throttled: true; retryIn: number }> {
  const snap = await readSnapshot(env);

  if (manual) {
    const elapsed = Date.now() - snap.lastManualAt;
    if (elapsed < MANUAL_THROTTLE_MS) {
      return {
        throttled: true,
        retryIn: Math.ceil((MANUAL_THROTTLE_MS - elapsed) / 1000),
      };
    }
    // ponytail: throttle en KV = cohérence à terme → quasi-fiable, ça protège les sources.
    snap.lastManualAt = Date.now();
  }

  // RSS : seed mémoire avec l'historique KV, sinon le scan écraserait la fenêtre 6h.
  hydrate(snap.events);
  let rssStats: FetchStats | null = null;
  if (forceRss || Date.now() - snap.lastRssAt >= RSS_INTERVAL_MS) {
    await refreshAll();
    snap.lastRssAt = Date.now();
    snap.events = getRecentItems(300);
    rssStats = getStats();
  }
  snap.stats = rssStats ?? snap.stats ?? getStats();

  const osirisResult = await refreshOsiris({ feedState: snap.osirisState });
  const cutoff = Date.now() - OSIRIS_RETENTION_MS;
  snap.osirisState = {};
  for (const f of osirisResult.feeds as FeedResult[]) {
    snap.osirisState[f.id] = {
      items: f.items.filter((it) => it.ts >= cutoff),
      fetchedAt: f.fetchedAt,
    };
  }
  return { snap, rssStats };
}

// --- API REST ---------------------------------------------------------------
// GET cachés 30s (edge + navigateur) : absorbe le polling sans marteler KV.

app.get("/api/health", async (c) => {
  const snap = await readSnapshot(c.env);
  return c.json({
    ok: true,
    items: snap.events.length,
    lastFetchAt: snap.stats?.lastFetchAt ?? null,
  });
});

app.get("/api/events", async (c) => {
  const snap = await readSnapshot(c.env);
  const stats: FetchStats = snap.stats ?? { items: 0, lastFetchAt: null };
  const body: EventsResponse = { events: snap.events, ...stats };
  return c.json(body, 200, { "Cache-Control": "public, max-age=30" });
});

app.get("/api/osiris", async (c) => {
  const snap = await readSnapshot(c.env);
  const items: OsirisItem[] = [];
  const feeds: Record<string, { items: number; fetchedAt: string | null }> = {};
  for (const [id, st] of Object.entries(snap.osirisState)) {
    items.push(...st.items);
    feeds[id] = {
      items: st.items.length,
      fetchedAt: st.fetchedAt ? new Date(st.fetchedAt).toISOString() : null,
    };
  }
  return c.json({ items, feeds }, 200, {
    "Cache-Control": "public, max-age=30",
  });
});

app.post("/api/osiris/refresh", async (c) => {
  try {
    const r = await refreshWorld(c.env, { forceRss: false });
    if ("throttled" in r) return c.json(r, 429);
    await writeSnapshot(c.env, r.snap);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

app.post("/api/refresh", async (c) => {
  try {
    const r = await refreshWorld(c.env, { forceRss: true, manual: true });
    if ("throttled" in r) return c.json(r, 429);
    await writeSnapshot(c.env, r.snap);
    return c.json({ ...r.rssStats, throttled: false });
  } catch (e) {
    return c.json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});

export default {
  fetch: app.fetch,
  async scheduled(
    _event: unknown,
    env: Env,
    ctx: { waitUntil(p: Promise<unknown>): void },
  ) {
    ctx.waitUntil(
      refreshWorld(env)
        .then((r) => {
          if ("snap" in r) return writeSnapshot(env, r.snap);
        })
        .catch(() => {}),
    );
  },
};
