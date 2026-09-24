"use client";

// Hook de données : chargement initial + polling 45s (le SSE n'existe pas sur
// Workers ; polling idempotent, dédup par id).
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  EventsResponse,
  OsirisItem,
  OsirisResponse,
  PulseEvent,
} from "@/lib/types";

const API = process.env.NEXT_PUBLIC_API_BASE ?? "";
const POLL_MS = 45_000;

export type PulseStatus = "init" | "live" | "offline";

export function usePulse() {
  const [events, setEvents] = useState<PulseEvent[]>([]);
  const [osiris, setOsiris] = useState<OsirisItem[]>([]);
  const [lastScan, setLastScan] = useState<number | null>(null);
  const [status, setStatus] = useState<PulseStatus>("init");
  const [recent, setRecent] = useState<ReadonlySet<string>>(new Set());
  const [scanning, setScanning] = useState(false);

  const eventsRef = useRef(new Map<string, PulseEvent>());
  const osirisRef = useRef(new Map<string, OsirisItem>());
  const okRef = useRef(false);
  const recentTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const poll = useCallback(async () => {
    try {
      const [rEv, rOs] = await Promise.all([
        fetch(`${API}/api/events`),
        fetch(`${API}/api/osiris`),
      ]);
      if (!rEv.ok && !rOs.ok) return;
      okRef.current = true;
      setStatus("live");

      if (rEv.ok) {
        const d = (await rEv.json()) as EventsResponse;
        const m = eventsRef.current;
        const fresh: string[] = [];
        for (const ev of d.events ?? []) {
          if (!m.has(ev.id)) fresh.push(ev.id);
          m.set(ev.id, ev);
        }
        setEvents([...m.values()].sort((a, b) => b.timestamp - a.timestamp));
        if (fresh.length) {
          setRecent(new Set(fresh));
          clearTimeout(recentTimerRef.current);
          recentTimerRef.current = setTimeout(
            () => setRecent(new Set()),
            20_000,
          );
        }
        if (d.lastFetchAt) setLastScan(Date.parse(d.lastFetchAt));
      }
      if (rOs.ok) {
        const d = (await rOs.json()) as OsirisResponse;
        const m = osirisRef.current;
        for (const it of d.items ?? []) m.set(it.id, it);
        setOsiris([...m.values()]);
      }
    } catch {
      if (okRef.current) setStatus("offline");
    }
  }, []);

  // Chargement initial avec retry 5s (le premier cron n'a peut-être pas encore
  // tourné), puis polling 45s.
  useEffect(() => {
    let stop = false;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let timer: ReturnType<typeof setInterval> | undefined;
    const boot = async () => {
      await poll();
      if (stop) return;
      if (okRef.current) {
        timer = setInterval(poll, POLL_MS);
      } else {
        retry = setTimeout(boot, 5_000);
      }
    };
    void boot();
    return () => {
      stop = true;
      clearTimeout(retry);
      clearInterval(timer);
    };
  }, [poll]);

  // Re-render périodique pour rafraîchir les labels "il y a X min".
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 30_000);
    return () => clearInterval(t);
  }, []);

  // Scan manuel : renvoie les secondes de throttle (429) ou null.
  const scan = useCallback(async (): Promise<number | null> => {
    setScanning(true);
    try {
      const res = await fetch(`${API}/api/refresh`, { method: "POST" });
      const data = (await res.json()) as {
        throttled?: boolean;
        retryIn?: number;
      };
      if (data.throttled && data.retryIn) return data.retryIn;
      await poll();
      return null;
    } finally {
      setScanning(false);
    }
  }, [poll]);

  return { events, osiris, lastScan, status, recent, scanning, scan };
}
