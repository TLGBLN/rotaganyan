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

type Mover = Runner & { delta: number; prev: string };

const POLL_MS = 30_000;
const TOP = 10;

function runnerKey(r: { hippodromeSlug: string; raceNo: number; no: number }) {
  return `${r.hippodromeSlug}-${r.raceNo}-${r.no}`;
}

function mergeMovers(prev: Mover[], incoming: Mover[], top: number): Mover[] {
  const inMap = new Map(incoming.map((m) => [runnerKey(m), m]));
  const kept = prev.map((m) => inMap.get(runnerKey(m)) ?? null).filter((m): m is Mover => m !== null);
  const keptKeys = new Set(kept.map(runnerKey));
  for (const m of incoming) if (!keptKeys.has(runnerKey(m))) kept.push(m);
  return kept.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, top);
}

export default function LiveMoversWidget({ dateStr }: { dateStr: string }) {
  const [snapshot, setSnapshot] = useState<Runner[]>([]);
  const [risers, setRisers] = useState<Mover[]>([]);
  const [fallers, setFallers] = useState<Mover[]>([]);
  const [loading, setLoading] = useState(true);
  const baselineRef = useRef<Map<string, string> | null>(null);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/muhtemeller/movers?tarih=${dateStr}`, { cache: "no-store" });
        const json = await res.json();
        if (stopped) return;

        const current: Runner[] = json.data ?? [];

        // Her poll'da anlık snapshot'u güncelle (son halleri her zaman görünsün)
        setSnapshot(current);
        setLoading(false);

        if (!baselineRef.current) {
          baselineRef.current = new Map(current.map((r) => [runnerKey(r), r.ganyan ?? ""]));
          return;
        }

        const base = baselineRef.current;
        const allMovers: Mover[] = [];
        for (const r of current) {
          const prevVal = base.get(runnerKey(r));
          if (!prevVal || !r.ganyan) continue;
          const delta = Math.round((parseFloat(r.ganyan) - parseFloat(prevVal)) * 100) / 100;
          if (Math.abs(delta) < 0.05) continue;
          allMovers.push({ ...r, delta, prev: prevVal });
        }

        const newRisers = allMovers.filter((m) => m.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, TOP);
        const newFallers = allMovers.filter((m) => m.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, TOP);
        setRisers((prev) => mergeMovers(prev, newRisers, TOP));
        setFallers((prev) => mergeMovers(prev, newFallers, TOP));
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

  // Delta yokken: güncel en düşük oranlılar (en favori atlar) tek kart halinde
  const hasMovers = risers.length > 0 || fallers.length > 0;

  if (!hasMovers) {
    const topFavorites = [...snapshot]
      .filter((r) => r.ganyan !== null)
      .sort((a, b) => parseFloat(a.ganyan!) - parseFloat(b.ganyan!))
      .slice(0, TOP);

    return (
      <SnapshotCard title="Güncel Oranlar" items={topFavorites} />
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MoverCard title="Oran Düşen" items={fallers} rising={false} />
      <MoverCard title="Oran Yükselen" items={risers} rising />
    </div>
  );
}

function SnapshotCard({ title, items }: { title: string; items: Runner[] }) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
        </span>
        <h3 className="flex-1 text-sm font-bold">{title}</h3>
      </div>
      <div className="divide-y border-t">
        {items.map((r, i) => (
          <div key={runnerKey(r)} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold text-muted-foreground">
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">
                {r.hippodromeName} — {r.raceNo}. Koşu
              </div>
              <div className="truncate font-semibold">{r.name}</div>
            </div>
            <span className="font-mono text-sm font-bold">{r.ganyan}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MoverCard({ title, items, rising }: { title: string; items: Mover[]; rising: boolean }) {
  if (items.length === 0) return null;
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 px-4 py-3">
        <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-md", rising ? "bg-miss/15 text-miss" : "bg-hit/15 text-hit")}>
          {rising ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </span>
        <h3 className="flex-1 text-sm font-bold">{title}</h3>
      </div>
      <div className="divide-y border-t">
        {items.map((m, i) => (
          <div key={runnerKey(m)} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold", rising ? "border-miss/40 text-miss" : "border-hit/40 text-hit")}>
              {i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">{m.hippodromeName} — {m.raceNo}. Koşu</div>
              <div className="truncate font-semibold">{m.name}</div>
            </div>
            <div className="shrink-0 text-right transition-all duration-300">
              <div className="font-mono text-xs text-muted-foreground line-through">{m.prev}</div>
              <div className="font-mono text-sm font-bold">{m.ganyan}</div>
            </div>
            <span className={cn("flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold transition-all duration-300", rising ? "bg-miss/15 text-miss" : "bg-hit/15 text-hit")}>
              {rising ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(m.delta).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
