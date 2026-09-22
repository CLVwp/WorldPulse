// Entrée Cloudflare Workers : assets statiques (voir wrangler.jsonc) + API Hono.
// Contrairement au dev Bun (server.js), les isolates Workers ne partagent pas de
// mémoire et setInterval n'existe pas : l'état vit en KV (binding CACHE) et le
// refresh est piloté par le Cron minute. Le SSE reste réservé au dev Bun.
import { Hono } from "hono";
import { refreshAll, getRecentItems, getStats, hydrate } from "./aggregator.js";
import { refreshOsiris, getOsirisItems } from "./osiris.js";

const RSS_INTERVAL_MS = 90_000;          // le cron tourne chaque minute, les sources pas plus vite que 90s
const MANUAL_THROTTLE_MS = 30_000;
// ponytail: les positions vols/sats >10 min sont fausses → purge, au lieu de
// répliquer la fenêtre 6h des news ; monter la borne si les feeds Osiris ralentissent.
const OSIRIS_RETENTION_MS = 10 * 60_000;
const SNAPSHOT_KEY = "snapshot";

const app = new Hono();

const emptySnapshot = () => ({
  events: [],
  stats: null,
  osirisState: {},   // feedId -> { items, fetchedAt (ms) }
  lastRssAt: 0,
  lastManualAt: 0,
});

async function readSnapshot(env) {
  return (await env.CACHE.get(SNAPSHOT_KEY, "json")) ?? emptySnapshot();
}

const writeSnapshot = (env, snap) => env.CACHE.put(SNAPSHOT_KEY, JSON.stringify(snap));

// Cycle complet : hydrate la mémoire de CET isolate depuis KV, scanne, re-persiste.
async function refreshWorld(env, { forceRss = false, manual = false } = {}) {
  const snap = await readSnapshot(env);

  if (manual) {
    const elapsed = Date.now() - (snap.lastManualAt ?? 0);
    if (elapsed < MANUAL_THROTTLE_MS) {
      return { throttled: true, retryIn: Math.ceil((MANUAL_THROTTLE_MS - elapsed) / 1000) };
    }
    // ponytail: throttle en KV = cohérence à terme → quasi-fiable, ça protège les sources.
    snap.lastManualAt = Date.now();
  }

  // RSS : seed mémoire avec l'historique KV, sinon le scan écraserait la fenêtre 6h.
  hydrate(snap.events);
  let rssStats = null;
  if (forceRss || Date.now() - snap.lastRssAt >= RSS_INTERVAL_MS) {
    rssStats = await refreshAll();
    snap.lastRssAt = Date.now();
    snap.events = getRecentItems({ limit: 300 });
    snap.stats = getStats();
  }

  const osirisResult = await refreshOsiris({ feedState: snap.osirisState });
  const byFeed = {};
  const cutoff = Date.now() - OSIRIS_RETENTION_MS;
  for (const it of getOsirisItems()) {
    if (it.ts < cutoff) continue;
    (byFeed[it.kind + "s"] ??= []).push(it); // kind "flight" → feed "flights", etc.
  }
  snap.osirisState = {};
  for (const f of osirisResult.feeds) {
    snap.osirisState[f.id] = { items: byFeed[f.id] ?? [], fetchedAt: f.fetchedAt ?? 0 };
  }
  return { snap, rssStats };
}

// --- API REST ---------------------------------------------------------------
// GET API cachées 30s (edge + navigateur) : absorbe le polling sans marteler KV.

app.get("/api/health", async (c) => {
  const snap = await readSnapshot(c.env);
  return c.json({ ok: true, items: snap.events.length, lastFetchAt: snap.stats?.lastFetchAt ?? null });
});

app.get("/api/events", async (c) => {
  const snap = await readSnapshot(c.env);
  return c.json(
    { events: snap.events, ...(snap.stats ?? { items: 0, lastFetchAt: null }) },
    200,
    { "Cache-Control": "public, max-age=30" }
  );
});

app.get("/api/osiris", async (c) => {
  const snap = await readSnapshot(c.env);
  const items = [];
  const feeds = {};
  for (const [id, st] of Object.entries(snap.osirisState)) {
    items.push(...st.items);
    feeds[id] = { items: st.items.length, fetchedAt: st.fetchedAt ? new Date(st.fetchedAt).toISOString() : null };
  }
  return c.json({ items, feeds }, 200, { "Cache-Control": "public, max-age=30" });
});

// Le SSE n'existe pas sur Workers (état par isolate) : 204 coupe l'EventSource
// sans retry infini, le front bascule sur son polling 45s.
app.get("/api/stream", (c) => c.body(null, 204));

app.post("/api/osiris/refresh", async (c) => {
  try {
    const { snap } = await refreshWorld(c.env, { forceRss: false });
    await writeSnapshot(c.env, snap);
    return c.json({ ok: true });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

app.post("/api/refresh", async (c) => {
  try {
    const r = await refreshWorld(c.env, { forceRss: true, manual: true });
    if (r.throttled) return c.json(r, 429);
    await writeSnapshot(c.env, r.snap);
    return c.json({ ...r.rssStats, throttled: false });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

export default {
  fetch: app.fetch,
  async scheduled(event, env, ctx) {
    ctx.waitUntil(refreshWorld(env).then((r) => writeSnapshot(env, r.snap)).catch(() => {}));
  },
};
