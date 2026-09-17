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

let activeSource = "all";   // filtre du flux ET de la carte
let activeView = "news";    // vue courante : news | flights | satellites | conflicts | earthquakes

// --- Données OSIRIS (vols, sats, conflits, séismes) ---------------------------
const osirisStore = new Map(); // id -> item normalisé
const osirisGroups = new Map(); // posKey -> { marker, el, items: [] } (marqueurs dédiés, hors groupes news)

// --- Éléments ---------------------------------------------------------------
const $statusConn = document.getElementById("status-conn");
const $pulseRing = document.querySelector(".pulse-ring");
const $eventCount = document.getElementById("event-count");
const $lastScan = document.getElementById("last-scan");
const $feedList = document.getElementById("feed-list");
const $detail = document.getElementById("detail");
const $sourceFilter = document.getElementById("source-filter");

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

function isEventVisible(ev) {
  return activeSource === "all" || ev.sourceId === activeSource;
}

// --- Vues OSIRIS --------------------------------------------------------------
const OSIRIS_FEEDS = {
  flight: { label: "Vols", color: "#4fc3f7" },
  satellite: { label: "Satellites", color: "#ffd54f" },
  conflict: { label: "Conflits", color: "#ff5470" },
  earthquake: { label: "Séismes", color: "#ff8a65" },
};

function osirisVisible(item) {
  return item.kind === activeView;
}

function rebuildOsirisMarkers() {
  const byKey = new Map();
  for (const item of osirisStore.values()) {
    if (!osirisVisible(item)) continue;
    const key = `${item.lat.toFixed(2)},${item.lng.toFixed(2)}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(item);
  }

  for (const [key, g] of osirisGroups) {
    if (!byKey.has(key)) {
      g.marker.remove();
      osirisGroups.delete(key);
    }
  }

  for (const [key, items] of byKey) {
    const top = items[0];
    let g = osirisGroups.get(key);
    if (!g) {
      const el = document.createElement("div");
      el.className = `osiris-marker kind-${top.kind}`;
      el.innerHTML = `<div class="core"></div>`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat([top.lng, top.lat])
        .addTo(map);
      g = { marker, el, items, idx: 0 };
      el.addEventListener("click", () => showOsirisDetail(items[0]));
      osirisGroups.set(key, g);
    }
    g.items = items;
    g.marker.setLngLat([top.lng, top.lat]);
    // setLngLat ne rattache pas un marqueur retiré via remove() — addTo est
    // idempotent, on le rappelle systématiquement (retour de vue NEWS → OSIRIS).
    g.marker.addTo(map);
  }
}

function showOsirisDetail(item) {
  const feed = OSIRIS_FEEDS[item.kind];
  document.getElementById("detail-country").textContent = feed?.label ?? item.kind;
  document.getElementById("detail-source").textContent = `OSIRIS · ${timeAgo(item.ts)}`;
  document.getElementById("detail-title").textContent = item.title;
  document.getElementById("detail-desc").textContent = item.sub ?? "";
  const link = document.getElementById("detail-link");
  if (item.url) { link.href = item.url; link.style.display = "inline"; }
  else link.style.display = "none";
  document.getElementById("detail-nav").classList.add("hidden");
  $detail.classList.remove("hidden");
}

// --- Switch de vue ------------------------------------------------------------
function setView(view) {
  if (view === activeView) return;
  activeView = view;
  document.querySelectorAll(".view-tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.view === view)
  );
  // Masque/affiche les marqueurs news et osiris selon la vue
  if (view === "news") {
    for (const g of groups.values()) g.marker.addTo(map);
    for (const g of osirisGroups.values()) g.marker.remove();
    rebuildGroups();
  } else {
    for (const g of groups.values()) g.marker.remove();
    for (const g of osirisGroups.values()) g.marker.remove();
    rebuildOsirisMarkers();
  }
  renderFeed();
}

document.querySelectorAll(".view-tab").forEach((btn) =>
  btn.addEventListener("click", () => setView(btn.dataset.view))
);

// --- Marqueurs (groupés par position) ---------------------------------------------
// Tous les events partageant la même clé de position forment un groupe :
// un seul marqueur, avec navigation ‹ › du + récent au + ancien.
const groups = new Map(); // posKey -> { marker, el, events: [], idx }

// Position dépendante du zoom : centroid pays dézoomé, ville précise zoomé.
function positionFor(ev) {
  const precise = ev.cityLat != null && ev.cityLng != null;
  if (!precise) return [ev.lng, ev.lat];
  return currentZoom >= 3 ? [ev.cityLng, ev.cityLat] : [ev.lng, ev.lat];
}

function posKeyFor(ev) {
  const [lng, lat] = positionFor(ev);
  return `${lat.toFixed(2)},${lng.toFixed(2)}`;
}

function rebuildGroups() {
  // Garde-fou vue : le zoom et les SSE news rappellent cette fn même quand une
  // vue OSIRIS est active — sans ce test, les marqueurs news (et leurs badges
  // compteurs) réapparaîtraient par-dessus les marqueurs vols/sats/conflits/séismes.
  if (activeView !== "news") {
    for (const g of groups.values()) g.marker.remove();
    return;
  }
  const byKey = new Map();
  for (const ev of eventsStore.values()) {
    if (!isEventVisible(ev)) continue;
    const key = posKeyFor(ev);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(ev);
  }
  // Tri interne : + récent d'abord
  for (const list of byKey.values()) list.sort((a, b) => b.timestamp - a.timestamp);

  // Supprime les groupes obsolètes (position vidée ou plus aucun event visible)
  for (const [key, g] of groups) {
    if (!byKey.has(key)) {
      g.marker.remove();
      groups.delete(key);
    }
  }
  // Crée / met à jour les groupes
  for (const [key, evs] of byKey) {
    const top = evs[0]; // couleur/intensité de l'article le + récent
    let g = groups.get(key);
    if (!g) {
      const el = document.createElement("div");
      el.className = "event-marker";
      el.innerHTML = `<div class="ring"></div><div class="core"></div>`;
      const marker = new maplibregl.Marker({ element: el })
        .setLngLat(positionFor(top))
        .addTo(map);
      g = { marker, el, events: [], idx: 0 };
      el.addEventListener("click", () => {
        g.idx = 0;
        showDetail(g.events[g.idx], g);
      });
      groups.set(key, g);
    }
    g.events = evs;
    g.idx = Math.min(g.idx, evs.length - 1);
    g.marker.setLngLat(positionFor(top));
    applyMarkerStyle(g);
  }
}

function applyMarkerStyle(g) {
  const top = g.events[0];
  const color = colorFor(top);
  g.el.style.color = color;
  g.el.classList.toggle("hot", top.intensity >= 3);
  // Badge compteur si plusieurs articles au même endroit
  let badge = g.el.querySelector(".badge");
  if (g.events.length > 1) {
    if (!badge) {
      badge = document.createElement("span");
      badge.className = "badge";
      g.el.appendChild(badge);
    }
    badge.textContent = g.events.length;
  } else if (badge) badge.remove();
}

// --- Bloc détail avec navigation multi-articles ------------------------------------
let currentGroup = null;

function showDetail(ev, group = null) {
  // Groupe implicite : tous les events visibles à la même position
  if (!group) {
    const key = posKeyFor(ev);
    group = groups.get(key) ?? null;
  }
  currentGroup = group;

  document.getElementById("detail-country").textContent = ev.countryName;
  document.getElementById("detail-source").textContent = `${ev.source} · ${timeAgo(ev.timestamp)}`;
  document.getElementById("detail-title").textContent = ev.title;
  document.getElementById("detail-desc").textContent = ev.description ?? "";
  const link = document.getElementById("detail-link");
  if (ev.url) { link.href = ev.url; link.style.display = "inline"; }
  else link.style.display = "none";

  // Navigation ‹ › si plusieurs articles au même endroit
  const nav = document.getElementById("detail-nav");
  if (group && group.events.length > 1) {
    nav.classList.remove("hidden");
    document.getElementById("detail-pos").textContent = `${group.idx + 1} / ${group.events.length}`;
    document.getElementById("detail-prev").disabled = group.idx >= group.events.length - 1;
    document.getElementById("detail-next").disabled = group.idx <= 0;
  } else {
    nav.classList.add("hidden");
  }

  $detail.classList.remove("hidden");
}

// Le groupe est trié du + récent (idx 0) au + ancien (idx n-1) :
// "plus ancien" (‹) avance dans le tableau, "plus récent" (›) recule.
function navigateDetail(dir) {
  if (!currentGroup || currentGroup.events.length < 2) return;
  const next = currentGroup.idx + dir;
  if (next < 0 || next >= currentGroup.events.length) return;
  currentGroup.idx = next;
  showDetail(currentGroup.events[next], currentGroup);
}

document.getElementById("detail-prev").addEventListener("click", () => navigateDetail(1));
document.getElementById("detail-next").addEventListener("click", () => navigateDetail(-1));

document.getElementById("detail-close").addEventListener("click", () => {
  $detail.classList.add("hidden");
});

// --- Flux -----------------------------------------------------------------------
// Le flux est TOUJOURS trié globalement par timestamp (le + récent en haut),
// quelle que soit la source ou l'ordre d'arrivée des lots SSE.
const recentIds = new Set(); // items récemment arrivés → surlignage temporaire
let recentTimer = null;
let lastFeedSignature = null; // évite de recréer le DOM (et relancer les animations CSS) sans changement

function renderFeed() {
  let sorted, signature;
  if (activeView === "news") {
    sorted = [...eventsStore.values()]
      .filter(isEventVisible)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 60);
    signature = "news:" + sorted.map((e) => e.id).join(",");
  } else {
    sorted = [...osirisStore.values()]
      .filter(osirisVisible)
      .sort((a, b) => b.ts - a.ts)
      .slice(0, 60);
    signature = activeView + ":" + sorted.map((e) => e.id).join(",");
  }
  if (signature === lastFeedSignature) return;
  lastFeedSignature = signature;

  $feedList.innerHTML = "";
  for (const ev of sorted) {
    const li = document.createElement("li");
    const isOsiris = activeView !== "news";
    li.className = "feed-item" + (isOsiris ? " osiris" : "") + (!isOsiris && recentIds.has(ev.id) ? " newest" : "");
    li.innerHTML = isOsiris
      ? `
      <div class="feed-item-meta">
        <span class="feed-country" style="color:${OSIRIS_FEEDS[ev.kind]?.color}">${OSIRIS_FEEDS[ev.kind]?.label ?? ev.kind}</span>
        <span class="feed-source">OSIRIS</span>
        <span class="feed-time">${timeAgo(ev.ts)}</span>
      </div>
      <div class="feed-item-title">${escapeHtml(ev.title)}</div>
      <div class="feed-item-sub">${escapeHtml(ev.sub ?? "")}</div>
    `
      : `
      <div class="feed-item-meta">
        <span class="feed-country">${escapeHtml(ev.countryName)}</span>
        <span class="feed-source">${escapeHtml(ev.source)}</span>
        <span class="feed-time">${timeAgo(ev.timestamp)}</span>
      </div>
      <div class="feed-item-title">${escapeHtml(ev.title)}</div>
    `;
    li.addEventListener("click", () => {
      if (isOsiris) {
        map.flyTo({ center: [ev.lng, ev.lat], zoom: Math.max(map.getZoom(), 4), duration: 1200 });
        showOsirisDetail(ev);
      } else {
        map.flyTo({ center: positionFor(ev), zoom: Math.max(map.getZoom(), 4), duration: 1200 });
        showDetail(ev);
      }
    });
    $feedList.appendChild(li);
  }
  $eventCount.textContent = sorted.length;
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
  }
  if (newIds.length) markRecent(newIds);
  rebuildGroups();
  renderFeed();
  refreshSourceFilter();
}

// --- Filtre de sources ---------------------------------------------------------------
let sourcesPopulated = new Set();

function refreshSourceFilter() {
  for (const ev of eventsStore.values()) {
    if (sourcesPopulated.has(ev.sourceId)) continue;
    sourcesPopulated.add(ev.sourceId);
    const opt = document.createElement("option");
    opt.value = ev.sourceId;
    opt.textContent = ev.source;
    $sourceFilter.appendChild(opt);
  }
}

$sourceFilter.addEventListener("change", () => {
  activeSource = $sourceFilter.value;
  rebuildGroups();
  renderFeed();
});

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
    rebuildGroups();
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
  es.addEventListener("osiris", (e) => {
    try {
      const { feed, items } = JSON.parse(e.data);
      for (const item of items) osirisStore.set(item.id, item);
      if (activeView === feed) {
        rebuildOsirisMarkers();
        renderFeed();
      }
    } catch { /* payload corrompu */ }
  });
  es.onerror = () => {
    $statusConn.textContent = "reconnexion…";
    $pulseRing.classList.remove("on");
  };
}

// --- Chargement initial + retry (le serveur peut être en cours de démarrage) --------

async function loadInitial() {
  try {
    const res = await fetch("/api/events?limit=300");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    handleEvents(data.events, { animate: false });
    if (data.lastFetchAt) {
      $lastScan.dataset.ts = String(Date.parse(data.lastFetchAt));
      $lastScan.textContent = timeAgo(Date.parse(data.lastFetchAt));
    }
  } catch (err) {
    console.error("[WorldPulse] loadInitial:", err);
    $statusConn.textContent = "initialisation…";
    setTimeout(loadInitial, 5000); // retry : le serveur scanne peut-être encore
  }

  // Chargement initial OSIRIS (snapshot REST, ensuite tout arrive via SSE)
  try {
    const res = await fetch("/api/osiris");
    if (res.ok) {
      const data = await res.json();
      for (const item of data.items ?? []) osirisStore.set(item.id, item);
      if (activeView !== "news") {
        rebuildOsirisMarkers();
        renderFeed();
      }
    }
  } catch { /* osiris indisponible : la vue news reste fonctionnelle */ }
}

setInterval(() => {
  if ($lastScan.dataset.ts) $lastScan.textContent = timeAgo(Number($lastScan.dataset.ts));
}, 30_000);

map.on("load", () => {
  loadInitial();
  connectStream();
});
// Si la carte est déjà chargée (module évalué après l'event), on boote direct.
if (map.loaded()) {
  loadInitial();
  connectStream();
}
