"use client";

// Barre supérieure + onglets de vue (style portefolio : papier, hairlines, mono uppercase).
import { useEffect, useState } from "react";
import { timeAgo, VIEWS, type ViewId } from "@/lib/types";

const EASE = "ease-[cubic-bezier(0.32,0.72,0,1)]";

/** ─── Barre supérieure : marque, status, scan ─── */
export function TopBar({
  status,
  lastScan,
  eventCount,
  scanning,
  onScan,
}: {
  status: "init" | "live" | "offline";
  lastScan: number | null;
  eventCount: number;
  scanning: boolean;
  onScan: () => Promise<number | null>;
}) {
  const [retry, setRetry] = useState<number | null>(null);

  useEffect(() => {
    if (retry == null) return;
    const t = setTimeout(() => setRetry(null), retry * 1000);
    return () => clearTimeout(t);
  }, [retry]);

  const click = async () => {
    if (scanning || retry != null) return;
    const r = await onScan();
    if (r) setRetry(r);
  };

  const statusText =
    status === "live"
      ? "en direct"
      : status === "init"
        ? "initialisation…"
        : "hors ligne";

  return (
    <header className="z-20 flex items-center justify-between gap-4 border-b border-hairline bg-bg px-5 py-3">
      <div className="flex items-baseline gap-3">
        <span
          className={`h-2 w-2 rounded-full ${status === "live" ? "dot-blink bg-fg" : "bg-fg-faint"}`}
        />
        <h1 className="font-mono text-lg font-bold tracking-[0.15em]">
          WORLD<span className="text-fg/40">PULSE</span>
        </h1>
        <span className="hidden font-mono text-[10px] tracking-[0.2em] text-fg-muted uppercase sm:inline">
          flux mondial géolocalisé
        </span>
      </div>
      <div className="flex items-center gap-5">
        <span className="flex items-center gap-2 font-mono text-[11px]">
          <span
            className={`relative h-2 w-2 rounded-full ${status === "live" ? "bg-fg pulse-ring" : "bg-fg-faint"}`}
          />
          <span className={status === "live" ? "" : "text-fg-muted"}>
            {statusText}
          </span>
        </span>
        <span className="hidden items-center gap-2 font-mono text-[11px] sm:flex">
          <span className="uppercase tracking-wider text-fg-muted">events</span>
          <span className="tabular-nums">{eventCount}</span>
        </span>
        <span className="hidden items-center gap-2 font-mono text-[11px] md:flex">
          <span className="uppercase tracking-wider text-fg-muted">
            dernier scan
          </span>
          <span>{lastScan ? timeAgo(lastScan) : "—"}</span>
        </span>
        <button
          className={`flex items-center gap-2 border px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.2em] transition-colors duration-500 ${EASE} ${
            scanning || retry != null
              ? "border-hairline text-fg-faint"
              : "border-fg/40 hover:bg-fg hover:text-bg"
          }`}
          disabled={scanning || retry != null}
          onClick={click}
          type="button"
        >
          <span className={scanning ? "animate-spin" : ""}>⟳</span>
          <span>
            {retry != null ? `${retry}s` : scanning ? "SCAN…" : "SCAN"}
          </span>
        </button>
      </div>
    </header>
  );
}

/** ─── Onglets NEWS / VOLS / SATS / CONFLITS / SÉISMES ─── */
export function ViewTabs({
  view,
  onChange,
}: {
  view: ViewId;
  onChange: (v: ViewId) => void;
}) {
  return (
    <nav className="absolute left-4 top-4 z-10 flex flex-wrap gap-1.5">
      {VIEWS.map((v) => (
        <button
          className={`border px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] transition-colors duration-300 ${EASE} ${
            view === v.id
              ? "border-fg bg-fg text-bg"
              : "border-hairline bg-bg/90 text-fg-muted hover:text-fg"
          }`}
          key={v.id}
          onClick={() => onChange(v.id)}
          type="button"
        >
          {v.label}
        </button>
      ))}
    </nav>
  );
}
