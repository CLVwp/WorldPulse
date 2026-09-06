// Serveur Express : API + SSE + fichiers statiques du front.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { refreshAll, subscribe, getRecentItems, getStats, dedupeSimilar } from "./aggregator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 3000;
const REFRESH_INTERVAL_MS = 90_000; // 90s
const MANUAL_THROTTLE_MS = 30_000;  // scan manuel : max 1 toutes les 30s
let lastManualRefresh = 0;

app.use(express.static(path.join(__dirname, "..", "public")));

// --- API REST -------------------------------------------------------------
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ...getStats() });
});

app.get("/api/events", (req, res) => {
  const since = req.query.since ? Number(req.query.since) : null;
  const items = getRecentItems({ since, limit: 300 });
  res.json({ events: items, ...getStats() });
});

// Force un refresh manuel (throttle 30s pour protéger les sources).
app.post("/api/refresh", async (_req, res) => {
  const now = Date.now();
  const elapsed = now - lastManualRefresh;
  if (elapsed < MANUAL_THROTTLE_MS) {
    return res.status(429).json({
      throttled: true,
      retryIn: Math.ceil((MANUAL_THROTTLE_MS - elapsed) / 1000),
    });
  }
  lastManualRefresh = now;
  try {
    const stats = await refreshAll();
    dedupeSimilar();
    res.json({ ...stats, throttled: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// --- SSE ------------------------------------------------------------------
app.get("/api/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "X-Accel-Buffering": "no",
  });
  res.write(`retry: 5000\n\n`);
  res.write(`event: hello\ndata: ${JSON.stringify({ connected: true })}\n\n`);

  const unsubscribe = subscribe((payload) => {
    res.write(`event: events\ndata: ${payload}\n\n`);
  });

  const heartbeat = setInterval(() => res.write(`: ping\n\n`), 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    unsubscribe();
  });
});

// --- Bootstrap ------------------------------------------------------------
(async () => {
  console.log("→ Premier fetch des sources…");
  try {
    const s = await refreshAll();
    dedupeSimilar();
    console.log(`✓ ${s.ok} sources OK, ${s.failed} en échec`);
  } catch (e) {
    console.warn("⚠ Premier fetch échoué :", e.message);
  }
  setInterval(() => {
    refreshAll().then(dedupeSimilar).catch(() => {});
  }, REFRESH_INTERVAL_MS);
})();

app.listen(PORT, () => {
  console.log(`✓ WorldPulse démarré → http://localhost:${PORT}`);
});
