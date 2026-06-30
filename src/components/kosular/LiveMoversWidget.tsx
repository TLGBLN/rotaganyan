"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Runner = {
  hippodromeName: string;
  hippodromeSlug: string;
  raceNo: number;
  no: number;
  name: string;
  ganyan: string | null;
  running: boolean;
};

type Row = Runner & { delta: number | null; prev: string | null };

const POLL_MS = 30_000;
const TOP = 20;
const LS_TTL_MS = 5 * 60 * 1000; // 5 dakika

function runnerKey(r: { hippodromeSlug: string; raceNo: number; no: number }) {
  return `${r.hippodromeSlug}-${r.raceNo}-${r.no}`;
}

function lsKey(dateStr: string) {
  return `lmw-baseline-${dateStr}`;
}

function loadBaseline(dateStr: string): Map<string, string> | null {
  try {
    const raw = localStorage.getItem(lsKey(dateStr));
    if (!raw) return null;
    const { ts, entries } = JSON.parse(raw) as { ts: number; entries: [string, string][] };
    if (Date.now() - ts > LS_TTL_MS) return null;
    return new Map(entries);
  } catch {
    return null;
  }
}

function saveBaseline(dateStr: string, map: Map<string, string>) {
  try {
    localStorage.setItem(lsKey(dateStr), JSON.stringify({ ts: Date.now(), entries: [...map.entries()] }));
  } catch {}
}

export default function LiveMoversWidget({ dateStr }: { dateStr: string }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const baselineRef = useRef<Map<string, string> | null>(null);

  // Mobilde sayfa geçişlerinde baseline kaybolmasın — localStorage'dan geri yükle
  useEffect(() => {
    baselineRef.current = loadBaseline(dateStr);
  }, [dateStr]);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/muhtemeller/movers?tarih=${dateStr}`, { cache: "no-store" });
        const json = await res.json();
        if (stopped) return;

        const current: Runner[] = json.data ?? [];

        if (!baselineRef.current) {
          baselineRef.current = new Map(current.map((r) => [runnerKey(r), r.ganyan ?? ""]));
          saveBaseline(dateStr, baselineRef.current);
          const initial: Row[] = current
            .filter((r) => r.ganyan !== null)
            .sort((a, b) => parseFloat(a.ganyan!) - parseFloat(b.ganyan!))
            .slice(0, TOP)
            .map((r) => ({ ...r, delta: null, prev: null }));
          setRows(initial);
          setLoading(false);
          return;
        }

        const base = baselineRef.current;
        const next: Row[] = current
          .filter((r) => r.ganyan !== null)
          .map((r) => {
            const prevVal = base.get(runnerKey(r));
            const rawDelta = prevVal ? Math.round((parseFloat(r.ganyan!) - parseFloat(prevVal)) * 100) / 100 : null;
            const delta = rawDelta !== null && Math.abs(rawDelta) >= 0.05 ? rawDelta : null;
            return { ...r, delta, prev: delta !== null ? (prevVal ?? null) : null };
          });

        next.sort((a, b) => {
          const da = a.delta !== null ? Math.abs(a.delta) : 0;
          const db = b.delta !== null ? Math.abs(b.delta) : 0;
          if (da !== db) return db - da;
          return parseFloat(a.ganyan!) - parseFloat(b.ganyan!);
        });

        const top = next.slice(0, TOP);

        // Her poll'da mevcut oranları yeni baseline olarak kaydet (mobil için)
        const newBaseline = new Map(current.map((r) => [runnerKey(r), r.ganyan ?? ""]));
        baselineRef.current = newBaseline;
        saveBaseline(dateStr, newBaseline);

        setRows((prev) => {
          const topMap = new Map(top.map((r) => [runnerKey(r), r]));
          const kept = prev.map((r) => topMap.get(runnerKey(r)) ?? null).filter((r): r is Row => r !== null);
          const keptKeys = new Set(kept.map(runnerKey));
          for (const r of top) if (!keptKeys.has(runnerKey(r))) kept.push(r);
          return kept
            .sort((a, b) => {
              const da = a.delta !== null ? Math.abs(a.delta) : 0;
              const db = b.delta !== null ? Math.abs(b.delta) : 0;
              if (da !== db) return db - da;
              return parseFloat(a.ganyan!) - parseFloat(b.ganyan!);
            })
            .slice(0, TOP);
        });
        setLoading(false);
      } catch {
        if (!stopped) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(interval); };
  }, [dateStr]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Canlı oranlar yükleniyor…
      </div>
    );
  }

  if (rows.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
        </span>
        <h3 className="flex-1 text-sm font-bold">Güncel Oranlar</h3>
        <span className="text-xs text-muted-foreground">30sn&apos;de bir güncellenir</span>
      </div>

      <div className="divide-y border-t">
        {rows.map((r, i) => {
          const hasDelta = r.delta !== null;
          const fell = hasDelta && r.delta! < 0;

          return (
            <div
              key={runnerKey(r)}
              className={cn(
                "flex items-center gap-3 px-4 py-2 text-sm transition-colors duration-300",
                hasDelta && (fell ? "bg-hit/5" : "bg-miss/5")
              )}
            >
              <span className="w-5 shrink-0 text-center text-xs font-semibold text-muted-foreground">
                {i + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="text-[10px] text-muted-foreground">
                  {r.hippodromeName} — {r.raceNo}. Koşu
                </div>
                <div className="truncate font-semibold">{r.name}</div>
              </div>

              <div className="shrink-0 text-right transition-all duration-300">
                {hasDelta && (
                  <div className="font-mono text-xs text-muted-foreground line-through">{r.prev}</div>
                )}
                <div className="font-mono text-sm font-bold">{r.ganyan}</div>
              </div>

              {hasDelta && (
                <span
                  className={cn(
                    "flex shrink-0 items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-bold",
                    fell ? "bg-hit/15 text-hit" : "bg-miss/15 text-miss"
                  )}
                >
                  {fell ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                  {Math.abs(r.delta!).toFixed(2)}
                  <span className="opacity-70">
                    %{Math.abs(Math.round((r.delta! / parseFloat(r.prev!)) * 1000) / 10).toFixed(1)}
                  </span>
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
