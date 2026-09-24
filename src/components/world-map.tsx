"use client";

// Carte MapLibre (tuiles Carto Positron, sans clé API) + marqueurs impératifs.
// Les marqueurs sont gérés hors React (créés une fois, mutés ensuite) : la carte
// bouge à 60 fps, on ne veut ni re-render ni reconciliation à chaque frame.
import maplibregl from "maplibre-gl";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  INTENSITY_COLORS,
  KIND_META,
  type OsirisItem,
  type PulseEvent,
  type ViewId,
} from "@/lib/types";

export interface MapFocus {
  ev?: PulseEvent;
  item?: OsirisItem;
  /** Nonce : re-targer le vol même si l'event est identique. */
  ts: number;
}

interface WorldMapProps {
  /** News déjà filtrées par source. */
  events: PulseEvent[];
  osiris: OsirisItem[];
  view: ViewId;
  focus: MapFocus | null;
  onSelectNews: (group: PulseEvent[]) => void;
  onSelectOsiris: (items: OsirisItem[]) => void;
}

interface MarkerGroup<E> {
  marker: maplibregl.Marker;
  el: HTMLDivElement;
  items: E[];
}

const posKey = (lat: number, lng: number) =>
  `${lat.toFixed(2)},${lng.toFixed(2)}`;

export function WorldMap({
  events,
  osiris,
  view,
  focus,
  onSelectNews,
  onSelectOsiris,
}: WorldMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [ready, setReady] = useState(false);
  const zoomTierRef = useRef(0); // 0 = dézoomé (centroïdes), 1 = zoom ≥ 3 (villes)
  const newsGroupsRef = useRef(new Map<string, MarkerGroup<PulseEvent>>());
  const osirisGroupsRef = useRef(new Map<string, MarkerGroup<OsirisItem>>());

  // Derniers props accessibles depuis les callbacks impératifs (zoom, clics).
  const latestRef = useRef({
    events,
    osiris,
    view,
    onSelectNews,
    onSelectOsiris,
  });
  latestRef.current = { events, osiris, view, onSelectNews, onSelectOsiris };

  /** Position dépendante du zoom : centroïde pays dézoomé, ville précise zoomé. */
  const positionFor = useCallback((ev: PulseEvent): [number, number] => {
    if (ev.cityLat != null && ev.cityLng != null && zoomTierRef.current === 1) {
      return [ev.cityLng, ev.cityLat];
    }
    return [ev.lng, ev.lat];
  }, []);

  const rebuild = useCallback(() => {
    const map = mapRef.current;
    if (!map) return;
    const { events: evs, osiris: os, view: v } = latestRef.current;

    // ── Vue OSIRIS : marqueurs news purgés, marqueurs dédiés par kind ──
    if (v !== "news") {
      for (const g of newsGroupsRef.current.values()) g.marker.remove();
      newsGroupsRef.current.clear();

      const byKey = new Map<string, OsirisItem[]>();
      for (const item of os) {
        if (item.kind !== v) continue;
        const key = posKey(item.lat, item.lng);
        const list = byKey.get(key);
        if (list) list.push(item);
        else byKey.set(key, [item]);
      }
      const groups = osirisGroupsRef.current;
      for (const [key, g] of groups) {
        if (!byKey.has(key)) {
          g.marker.remove();
          groups.delete(key);
        }
      }
      for (const [key, items] of byKey) {
        const top = items[0];
        if (!top) continue;
        let g = groups.get(key);
        if (!g) {
          const el = document.createElement("div");
          el.className = `osiris-marker kind-${top.kind}`;
          el.innerHTML = '<div class="core"></div>';
          el.addEventListener("click", () => {
            const cur = groups.get(key);
            if (cur) latestRef.current.onSelectOsiris(cur.items);
          });
          g = {
            marker: new maplibregl.Marker({ element: el })
              .setLngLat([top.lng, top.lat])
              .addTo(map),
            el,
            items,
          };
          groups.set(key, g);
        }
        g.items = items;
        g.marker.setLngLat([top.lng, top.lat]);
        // setLngLat ne rattache pas un marqueur retiré via remove() — addTo est
        // idempotent, on le rappelle systématiquement (retour de vue NEWS → OSIRIS).
        g.marker.addTo(map);
        g.el.style.color = KIND_META[top.kind].color;
      }
      return;
    }

    // ── Vue NEWS : groupage par position, badge compteur ──
    for (const g of osirisGroupsRef.current.values()) g.marker.remove();
    osirisGroupsRef.current.clear();

    const byKey = new Map<string, PulseEvent[]>();
    for (const ev of evs) {
      const [lng, lat] = positionFor(ev);
      const key = posKey(lat, lng);
      const list = byKey.get(key);
      if (list) list.push(ev);
      else byKey.set(key, [ev]);
    }
    const groups = newsGroupsRef.current;
    for (const [key, g] of groups) {
      if (!byKey.has(key)) {
        g.marker.remove();
        groups.delete(key);
      }
    }
    for (const [key, evList] of byKey) {
      // Tri interne : + récent d'abord
      evList.sort((a, b) => b.timestamp - a.timestamp);
      const top = evList[0];
      if (!top) continue;
      let g = groups.get(key);
      if (!g) {
        const el = document.createElement("div");
        el.className = "event-marker";
        el.innerHTML = '<div class="ring"></div><div class="core"></div>';
        el.addEventListener("click", () => {
          const cur = groups.get(key);
          if (cur) latestRef.current.onSelectNews(cur.items);
        });
        g = {
          marker: new maplibregl.Marker({ element: el })
            .setLngLat(positionFor(top))
            .addTo(map),
          el,
          items: evList,
        };
        groups.set(key, g);
      }
      g.items = evList;
      g.marker.setLngLat(positionFor(top));
      g.el.style.color = INTENSITY_COLORS[top.intensity];
      g.el.classList.toggle("hot", top.intensity >= 3);
      let badge = g.el.querySelector(".badge");
      if (evList.length > 1) {
        if (!badge) {
          badge = document.createElement("span");
          badge.className = "badge";
          g.el.appendChild(badge);
        }
        badge.textContent = String(evList.length);
      } else if (badge) {
        badge.remove();
      }
    }
  }, [positionFor]);

  // Init carte : une seule fois.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const map = new maplibregl.Map({
      container,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [10, 25],
      zoom: 1.6,
    });
    mapRef.current = map;
    map.on("load", () => setReady(true));
    // Le conteneur peut être mesuré avant que la grille flex ne soit posée
    // (dynamic import) : on suit sa taille réelle.
    const ro = new ResizeObserver(() => map.resize());
    ro.observe(container);
    map.on("zoom", () => {
      const tier = map.getZoom() >= 3 ? 1 : 0;
      if (tier !== zoomTierRef.current) {
        zoomTierRef.current = tier;
        rebuildRef.current();
      }
    });
    return () => {
      ro.disconnect();
      map.remove();
      mapRef.current = null;
      newsGroupsRef.current.clear();
      osirisGroupsRef.current.clear();
    };
  }, []);

  // Le handler zoom doit toujours appeler la dernière version de rebuild.
  const rebuildRef = useRef(rebuild);
  rebuildRef.current = rebuild;

  // Reconstruit les marqueurs quand les données ou la vue changent.
  // biome-ignore lint/correctness/useExhaustiveDependencies: rebuild lit latestRef, on se réveille volontairement sur données/vue
  useEffect(() => {
    if (ready) rebuild();
  }, [ready, events, osiris, view, rebuild]);

  // Vol vers un event demandé par le flux.
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map || !focus) return;
    const center: [number, number] = focus.ev
      ? positionFor(focus.ev)
      : [focus.item?.lng ?? 0, focus.item?.lat ?? 0];
    map.flyTo({
      center,
      zoom: Math.max(map.getZoom(), 4),
      duration: 1200,
      essential: true,
    });
  }, [ready, focus, positionFor]);

  return (
    <div className="absolute inset-0">
      {/* NB : le wrapper porte le positionnement — maplibre ajoute sa classe
          .maplibregl-map (position:relative) AU conteneur passé en option, ce qui
          écraserait .absolute à spécificité égale. h-full w-full reste compatible. */}
      <div
        ref={containerRef}
        role="application"
        aria-label="Carte du monde des événements"
        className="h-full w-full"
      />
    </div>
  );
}
