// Serveur Hono (runtime Bun) : API + SSE + fichiers statiques du front.
import { Hono } from "hono";
import { serveStatic } from "hono/bun";
import { refreshAll, subscribe, getRecentItems, getStats } from "./aggregator.js";

const app = new Hono();
const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = 90_000; // 90s
const MANUAL_THROTTLE_MS = 30_000;  // scan manuel : max 1 toutes les 30s
let lastManualRefresh = 0;

app.use("/*", serveStatic({ root: "./public" }));

// --- API REST -------------------------------------------------------------
app.get("/api/health", (c) => c.json({ ok: true, ...getStats() }));

app.get("/api/events", (c) =>
  c.json({ events: getRecentItems({ limit: 300 }), ...getStats() })
);

// Force un refresh manuel (throttle 30s pour protéger les sources).
app.post("/api/refresh", async (c) => {
  const elapsed = Date.now() - lastManualRefresh;
  if (elapsed < MANUAL_THROTTLE_MS) {
    return c.json(
      { throttled: true, retryIn: Math.ceil((MANUAL_THROTTLE_MS - elapsed) / 1000) },
      429
    );
  }
  lastManualRefresh = Date.now();
  try {
    const stats = await refreshAll();
    return c.json({ ...stats, throttled: false });
  } catch (e) {
    return c.json({ error: e.message }, 500);
  }
});

// --- SSE ------------------------------------------------------------------
app.get("/api/stream", (c) => {
  let unsubscribe, heartbeat;
  const stream = new ReadableStream({
    start(controller) {
      const enc = new TextEncoder();
      const send = (s) => controller.enqueue(enc.encode(s));
      send(`retry: 5000\n\n`);
      send(`event: hello\ndata: ${JSON.stringify({ connected: true })}\n\n`);
      unsubscribe = subscribe((payload) =>
        send(`event: events\ndata: ${payload}\n\n`)
      );
      // ponytail: Bun coupe les streams inactifs (~8s) → ping serré ; passer à un
      // vrai keep-alive serveur si ça devient un problème de trafic.
      heartbeat = setInterval(() => send(`: ping\n\n`), 5_000);
    },
    cancel() {
      clearInterval(heartbeat);
      unsubscribe?.();
    },
  });
  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
});

// --- Bootstrap ------------------------------------------------------------
console.log("→ Premier fetch des sources…");
try {
  const s = await refreshAll();
  console.log(`✓ ${s.ok} sources OK, ${s.failed} en échec`);
} catch (e) {
  console.warn("⚠ Premier fetch échoué :", e.message);
}
setInterval(() => {
  refreshAll().catch(() => {});
}, REFRESH_INTERVAL_MS);

export default {
  port: PORT,
  fetch: app.fetch,
};
