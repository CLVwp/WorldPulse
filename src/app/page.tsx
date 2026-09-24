"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import { DetailPanel, type Selection } from "@/components/detail-panel";
import { FeedPanel } from "@/components/feed-panel";
import { TopBar, ViewTabs } from "@/components/panels";
import type { MapFocus } from "@/components/world-map";
import type { ViewId } from "@/lib/types";
import { usePulse } from "@/lib/use-pulse";

// La carte n'a rien à faire au rendu serveur (WebGL) : chargée client-only.
const WorldMap = dynamic(
  () => import("@/components/world-map").then((m) => m.WorldMap),
  {
    ssr: false,
  },
);

export default function Home() {
  const { events, osiris, lastScan, status, recent, scanning, scan } =
    usePulse();
  const [view, setView] = useState<ViewId>("news");
  const [source, setSource] = useState("all");
  const [sel, setSel] = useState<Selection | null>(null);
  const [focus, setFocus] = useState<MapFocus | null>(null);

  const visibleEvents = useMemo(
    () =>
      source === "all" ? events : events.filter((e) => e.sourceId === source),
    [events, source],
  );
  const visibleOsiris = useMemo(() => osiris, [osiris]);

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-bg text-fg">
      <TopBar
        eventCount={visibleEvents.length}
        lastScan={lastScan}
        onScan={scan}
        scanning={scanning}
        status={status}
      />
      <main className="relative flex-1">
        <WorldMap
          events={visibleEvents}
          focus={focus}
          onSelectNews={(list) => setSel({ type: "news", list, idx: 0 })}
          onSelectOsiris={(list) => setSel({ type: "osiris", list, idx: 0 })}
          osiris={visibleOsiris}
          view={view}
        />
        <ViewTabs onChange={setView} view={view} />
        <FeedPanel
          events={visibleEvents}
          onPick={(t) => {
            setFocus({ ...t, ts: Date.now() });
            if (t.ev) setSel({ type: "news", list: [t.ev], idx: 0 });
            else if (t.item) setSel({ type: "osiris", list: [t.item], idx: 0 });
          }}
          onSourceChange={setSource}
          osiris={visibleOsiris}
          recent={recent}
          view={view}
        />
        {sel && (
          <DetailPanel
            onClose={() => setSel(null)}
            onNav={(dir) =>
              setSel((s) => {
                if (!s) return s;
                const idx = s.idx + dir;
                if (idx < 0 || idx >= s.list.length) return s;
                return { ...s, idx };
              })
            }
            sel={sel}
          />
        )}
      </main>
    </div>
  );
}
