// WorldPulse — front : carte MapLibre dark, SSE, marqueurs animés.
// maplibre-gl est chargé comme script classique dans index.html (build UMD → global `maplibregl`).

// --- Carte -----------------------------------------------------------------
const map = new maplibregl.Map({
  container: "map",
  style: "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json",
  center: [10, 25],
  zoom: 1.6,
  attributionControl: false,
});
map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-left");
map.dragPan.enable();

const markers = new Map(); // eventId -> maplibregl.Marker

// --- Éléments ---------------------------------------------------------------
const $statusConn = document.getElementById("status-conn");
const $pulseRing = document.querySelector(".pulse-ring");
const $eventCount = document.getElementById("event-count");
const $lastScan = document.getElementById("last-scan");
const $feedList = document.getElementById("feed-list");
const $detail = document.getElementById("detail");
const $legend = document.getElementById("legend");

let totalCount = 0;
let eventsStore = new Map(); // id -> event (pour re-render au zoom)
let currentZoom = 1.6;

// --- Couleurs par INTENSITÉ (calculée côté serveur) ----------------------------
const INTENSITY_COLORS = {
  1: "#37f0c2",  // vert/cyan : faible
  2: "#ffb347",  // orange : moyen
  3: "#ff5470",  // rouge : fort
};
function colorFor(ev) {
  return INTENSITY_COLORS[ev.intensity] ?? INTENSITY_COLORS[1];
}

// --- Marqueurs ----------------------------------------------------------------
// Position dépendante du zoom : centroid pays dézoomé, ville précise zoomé.
function positionFor(ev) {
  const precise = ev.cityLat != null && ev.cityLng != null;
  if (!precise) return [ev.lng, ev.lat];
  return currentZoom >= 3 ? [ev.cityLng, ev.cityLat] : [ev.lng, ev.lat];
}

function addEventToMap(ev) {
  if (markers.has(ev.id)) {
    updateMarkerPosition(ev);
    return;
  }
  const color = colorFor(ev);
  const el = document.createElement("div");
  el.className = "event-marker";
  el.style.color = color;
  // Taille/animation selon intensité
  const isHot = ev.intensity >= 3;
  if (isHot) el.classList.add("hot");
  el.innerHTML = `<div class="ring"></div><div class="core"></div>`;

  const marker = new maplibregl.Marker({ element: el })
    .setLngLat(positionFor(ev))
    .addTo(map);

  el.addEventListener("click", () => showDetail(ev));
  markers.set(ev.id, marker);
}

function updateMarkerPosition(ev) {
  const marker = markers.get(ev.id);
  if (marker) marker.setLngLat(positionFor(ev));
}

function showDetail(ev) {
  document.getElementById("detail-country").textContent = ev.countryName;
  document.getElementById("detail-source").textContent = `${ev.source} · ${timeAgo(ev.timestamp)}`;
  document.getElementById("detail-title").textContent = ev.title;
  document.getElementById("detail-desc").textContent = ev.description ?? "";
  const link = document.getElementById("detail-link");
  if (ev.url) { link.href = ev.url; link.style.display = "inline"; }
  else link.style.display = "none";
  $detail.classList.remove("hidden");
  $legend.classList.add("shifted");
}

document.getElementById("detail-close").addEventListener("click", () => {
  $detail.classList.add("hidden");
  $legend.classList.remove("shifted");
});

// --- Flux -----------------------------------------------------------------------
// Le flux est TOUJOURS trié globalement par timestamp (le + récent en haut),
// quelle que soit la source ou l'ordre d'arrivée des lots SSE.
const recentIds = new Set(); // items récemment arrivés → surlignage temporaire
let recentTimer = null;

function renderFeed() {
  const sorted = [...eventsStore.values()]
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 60);

  $feedList.innerHTML = "";
  for (const ev of sorted) {
    const li = document.createElement("li");
    li.className = "feed-item" + (recentIds.has(ev.id) ? " newest" : "");
    li.innerHTML = `
      <div class="feed-item-meta">
        <span class="feed-country">${escapeHtml(ev.countryName)}</span>
        <span class="feed-source">${escapeHtml(ev.source)}</span>
        <span class="feed-time">${timeAgo(ev.timestamp)}</span>
      </div>
      <div class="feed-item-title">${escapeHtml(ev.title)}</div>
    `;
    li.addEventListener("click", () => {
      map.flyTo({ center: positionFor(ev), zoom: Math.max(map.getZoom(), 4), duration: 1200 });
      showDetail(ev);
    });
    $feedList.appendChild(li);
  }
}

function markRecent(ids) {
  for (const id of ids) recentIds.add(id);
  clearTimeout(recentTimer);
  recentTimer = setTimeout(() => {
    recentIds.clear();
    $feedList.querySelectorAll(".newest").forEach((el) => el.classList.remove("newest"));
  }, 20_000);
}

function handleEvents(events, { animate = true } = {}) {
  const newIds = [];
  for (const ev of events) {
    if (!eventsStore.has(ev.id)) {
      eventsStore.set(ev.id, ev);
      if (animate) newIds.push(ev.id);
    } else {
      eventsStore.set(ev.id, ev);
    }
    addEventToMap(ev);
  }
  if (newIds.length) markRecent(newIds);
  renderFeed();
  $eventCount.textContent = eventsStore.size;
}

function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}min`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}j`;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

// --- Zoom : repositionner les marqueurs précis ------------------------------------
map.on("zoom", () => {
  const z = map.getZoom();
  const crossed = (currentZoom < 3 && z >= 3) || (currentZoom >= 3 && z < 3);
  if (crossed) {
    currentZoom = z;
    for (const ev of eventsStore.values()) updateMarkerPosition(ev);
  } else {
    currentZoom = z;
  }
});

// --- Bouton rescan (throttle 30s côté serveur) ---------------------------------------
const $rescanBtn = document.getElementById("rescan-btn");
$rescanBtn.addEventListener("click", async () => {
  if ($rescanBtn.disabled) return;
  $rescanBtn.disabled = true;
  $rescanBtn.classList.add("spin");
  document.getElementById("rescan-label").textContent = "SCAN…";
  try {
    const res = await fetch("/api/refresh", { method: "POST" });
    const data = await res.json();
    if (data.throttled) {
      document.getElementById("rescan-label").textContent = `${data.retryIn}s`;
      setTimeout(() => {
        document.getElementById("rescan-label").textContent = "SCAN";
        $rescanBtn.disabled = false;
      }, data.retryIn * 1000);
      return;
    }
    // Les nouveaux events arrivent via SSE ; on rafraîchit juste le compteur.
    if (data.lastFetchAt) {
      $lastScan.dataset.ts = String(Date.parse(data.lastFetchAt));
      $lastScan.textContent = timeAgo(Date.parse(data.lastFetchAt));
    }
  } catch {
    // erreur réseau : on réactive quand même
  } finally {
    $rescanBtn.classList.remove("spin");
    document.getElementById("rescan-label").textContent = "SCAN";
    setTimeout(() => ($rescanBtn.disabled = false), 2000);
  }
});

// --- SSE ---------------------------------------------------------------------------
function connectStream() {
  const es = new EventSource("/api/stream");
  es.addEventListener("hello", () => {
    $statusConn.textContent = "en direct";
    $pulseRing.classList.add("on");
  });
  es.addEventListener("events", (e) => {
    try {
      const { events } = JSON.parse(e.data);
      if (events.length) {
        handleEvents(events, { animate: true });
        if (events[0]?.lastFetchAt) {
          $lastScan.dataset.ts = String(Date.parse(events[0].lastFetchAt));
        }
        // petit flash du compteur
        $eventCount.style.color = "var(--accent)";
        setTimeout(() => ($eventCount.style.color = ""), 800);
      }
    } catch { /* payload corrompu */ }
  });
  es.onerror = () => {
    $statusConn.textContent = "reconnexion…";
    $pulseRing.classList.remove("on");
  };
}

// --- Chargement initial ------------------------------------------------------------
async function loadInitial() {
  try {
    const res = await fetch("/api/events?limit=300");
    const data = await res.json();
    handleEvents(data.events, { animate: false });
    if (data.lastFetchAt) {
      $lastScan.dataset.ts = String(Date.parse(data.lastFetchAt));
      $lastScan.textContent = timeAgo(Date.parse(data.lastFetchAt));
    }
  } catch {
    $statusConn.textContent = "erreur réseau";
  }
}

setInterval(() => {
  if ($lastScan.dataset.ts) $lastScan.textContent = timeAgo(Number($lastScan.dataset.ts));
}, 30_000);

map.on("load", async () => {
  await loadInitial();
  connectStream();
});
