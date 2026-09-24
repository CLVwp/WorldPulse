"use client";

// Panneau détail : event sélectionné + navigation ‹ › dans un groupe.
import {
  INTENSITY_COLORS,
  KIND_META,
  type OsirisItem,
  type PulseEvent,
  timeAgo,
} from "@/lib/types";

export type Selection =
  | { type: "news"; list: PulseEvent[]; idx: number }
  | { type: "osiris"; list: OsirisItem[]; idx: number };

export function DetailPanel({
  sel,
  onNav,
  onClose,
}: {
  sel: Selection;
  onNav: (dir: 1 | -1) => void;
  onClose: () => void;
}) {
  const cur = sel.list[sel.idx];
  if (!cur) return null;

  const isNews = sel.type === "news";
  const ev = cur as PulseEvent;
  const os = cur as OsirisItem;
  const color = isNews
    ? INTENSITY_COLORS[ev.intensity]
    : KIND_META[os.kind].color;
  const meta = isNews ? ev.countryName : KIND_META[os.kind].label;
  const source = isNews ? ev.source : "OSIRIS";
  const time = isNews ? ev.timestamp : os.ts;
  const desc = isNews ? ev.description : os.sub;
  const url = isNews ? ev.url : os.url;

  // Groupe trié du + récent (idx 0) au + ancien : ‹ = plus ancien, › = plus récent.
  const nav = sel.list.length > 1;

  return (
    <div className="absolute bottom-4 left-4 z-20 w-[min(420px,calc(100vw-2rem))] border border-fg/25 bg-bg p-5">
      <button
        aria-label="Fermer"
        className="absolute top-2 right-3 cursor-pointer font-mono text-xl text-fg-muted transition-colors hover:text-fg"
        onClick={onClose}
        type="button"
      >
        ×
      </button>
      <div className="mb-2 flex items-center gap-3 font-mono text-[11px]">
        <span className="uppercase tracking-wider" style={{ color }}>
          {meta}
        </span>
        <span className="text-fg-muted">
          {source} · {timeAgo(time)}
        </span>
      </div>
      <h3 className="text-base leading-snug font-medium">{cur.title}</h3>
      {desc && (
        <p className="mt-2 text-xs leading-relaxed text-fg-muted">{desc}</p>
      )}
      {url && (
        <a
          className="mt-3 inline-block font-mono text-xs text-fg transition-colors hover:text-fg-muted"
          href={url}
          rel="noopener noreferrer"
          target="_blank"
        >
          Lire l'article →
        </a>
      )}
      {nav && (
        <div className="mt-3 flex items-center gap-3 border-t border-hairline pt-3">
          <button
            aria-label="Article plus ancien"
            className="h-7 w-7 cursor-pointer border border-fg/30 font-mono transition-colors hover:bg-fg hover:text-bg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg"
            disabled={sel.idx >= sel.list.length - 1}
            onClick={() => onNav(1)}
            type="button"
          >
            ‹
          </button>
          <span className="font-mono text-[11px] text-fg-muted tabular-nums">
            {sel.idx + 1} / {sel.list.length}
          </span>
          <button
            aria-label="Article plus récent"
            className="h-7 w-7 cursor-pointer border border-fg/30 font-mono transition-colors hover:bg-fg hover:text-bg disabled:cursor-default disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-fg"
            disabled={sel.idx <= 0}
            onClick={() => onNav(-1)}
            type="button"
          >
            ›
          </button>
        </div>
      )}
    </div>
  );
}
