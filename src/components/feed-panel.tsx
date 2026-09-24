"use client";

// Flux latéral : derniers events de la vue active, filtre par source.
import { useMemo, useState } from "react";
import {
  INTENSITY_COLORS,
  KIND_META,
  type OsirisItem,
  type PulseEvent,
  timeAgo,
  type ViewId,
} from "@/lib/types";

export function FeedPanel({
  view,
  events,
  osiris,
  recent,
  onPick,
  onSourceChange,
}: {
  view: ViewId;
  events: PulseEvent[];
  osiris: OsirisItem[];
  recent: ReadonlySet<string>;
  onPick: (target: { ev?: PulseEvent; item?: OsirisItem }) => void;
  onSourceChange: (sourceId: string) => void;
}) {
  const [source, setSource] = useState("all");
  const sources = useMemo(() => {
    const seen = new Map<string, string>();
    for (const ev of events) {
      if (!seen.has(ev.sourceId)) seen.set(ev.sourceId, ev.source);
    }
    return [...seen.entries()];
  }, [events]);
  const items = useMemo(() => {
    const list =
      view === "news" ? events : osiris.filter((it) => it.kind === view);
    return [...list]
      .sort(
        (a, b) =>
          ("countryCode" in b ? b.timestamp : b.ts) -
          ("countryCode" in a ? a.timestamp : a.ts),
      )
      .slice(0, 60);
  }, [view, events, osiris]);

  const rows = items.map((it) => {
    const isNews = "countryCode" in it;
    const ev = it as PulseEvent;
    const os = it as OsirisItem;
    return {
      id: it.id,
      title: it.title,
      color: isNews ? INTENSITY_COLORS[ev.intensity] : KIND_META[os.kind].color,
      label: isNews ? ev.countryName : KIND_META[os.kind].label,
      sub: isNews ? ev.source : os.sub,
      time: isNews ? ev.timestamp : os.ts,
      isNew: recent.has(it.id),
      pick: () => onPick(isNews ? { ev } : { item: os }),
    };
  });

  return (
    <aside className="absolute bottom-4 right-4 top-4 z-10 hidden w-[330px] flex-col border border-hairline bg-bg/95 backdrop-blur-sm md:flex">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="font-mono text-xs tracking-[0.25em] uppercase">Flux</h2>
        {view === "news" && (
          <select
            className="mt-2 w-full cursor-pointer border border-hairline bg-bg px-2 py-1 font-mono text-[10px] uppercase tracking-wider outline-none transition-colors hover:border-fg/40"
            onChange={(e) => {
              setSource(e.target.value);
              onSourceChange(e.target.value);
            }}
            value={source}
          >
            <option value="all">Toutes les sources</option>
            {sources.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
        )}
      </div>
      <ul className="feed-scroll flex-1 overflow-y-auto">
        {rows.map((r) => (
          <li
            className={`border-b border-hairline/60 ${r.isNew ? "feed-item-new" : ""}`}
            key={r.id}
          >
            <button
              className="block w-full cursor-pointer px-4 py-3 text-left transition-colors hover:bg-hover"
              onClick={r.pick}
              type="button"
            >
              <div className="mb-1 flex items-center gap-2 font-mono text-[10px]">
                <span
                  className="truncate uppercase tracking-wider"
                  style={{ color: r.color }}
                >
                  {r.label}
                </span>
                <span className="ml-auto shrink-0 text-fg-faint">
                  {timeAgo(r.time)}
                </span>
              </div>
              <div className="line-clamp-2 text-[13px] leading-snug">
                {r.title}
              </div>
              <div className="mt-1 truncate font-mono text-[10px] text-fg-muted">
                {r.sub}
              </div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
