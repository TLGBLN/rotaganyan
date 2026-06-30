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

export default function LiveMoversWidget({ dateStr }: { dateStr: string }) {
  const [risers, setRisers] = useState<Mover[]>([]);
  const [fallers, setFallers] = useState<Mover[]>([]);
  const [waiting, setWaiting] = useState(true); // bekleniyor: ilk poll'dan sonra 30sn bekle
  const [loading, setLoading] = useState(true);
  const baselineRef = useRef<Runner[] | null>(null);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/muhtemeller/movers?tarih=${dateStr}`, { cache: "no-store" });
        const json = await res.json();
        if (stopped) return;

        const current: Runner[] = json.data ?? [];

        if (!baselineRef.current) {
          baselineRef.current = current;
          setLoading(false);
          return; // ilk poll — baseline kuruldu, moverlar bir sonraki pollda hesaplanır
        }

        const baseMap = new Map(baselineRef.current.map((r) => [`${r.hippodromeSlug}-${r.raceNo}-${r.no}`, r.ganyan]));

        const movers: Mover[] = [];
        for (const r of current) {
          const key = `${r.hippodromeSlug}-${r.raceNo}-${r.no}`;
          const prev = baseMap.get(key);
          if (!prev || !r.ganyan) continue;
          const delta = parseFloat(r.ganyan) - parseFloat(prev);
          if (Math.abs(delta) < 0.05) continue;
          movers.push({ ...r, delta: Math.round(delta * 100) / 100, prev });
        }

        movers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta));
        setRisers(movers.filter((m) => m.delta > 0).slice(0, TOP));
        setFallers(movers.filter((m) => m.delta < 0).slice(0, TOP));
        setWaiting(false);
        setLoading(false);

        // baseline'ı mevcut snapshotla güncelle
        baselineRef.current = current;
      } catch {
        if (!stopped) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [dateStr]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Canlı oranlar yükleniyor…
      </div>
    );
  }

  if (waiting) {
    return (
      <div className="flex items-center gap-2 rounded-lg border p-4 text-sm text-muted-foreground">
        <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
        Oran değişimleri takip ediliyor — 30 saniye içinde aktif olacak
      </div>
    );
  }

  if (risers.length === 0 && fallers.length === 0) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Şu an kayda değer oran değişimi yok
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <MoverCard title="Oran Düşen" items={fallers} rising={false} />
      <MoverCard title="Oran Yükselen" items={risers} rising />
    </div>
  );
}

function MoverCard({ title, items, rising }: { title: string; items: Mover[]; rising: boolean }) {
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            rising ? "bg-miss/15 text-miss" : "bg-hit/15 text-hit"
          )}
        >
          {rising ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
        </span>
        <h3 className="flex-1 text-sm font-bold">
          {title} — Top {items.length}
        </h3>
        <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {items.length}
        </span>
      </div>

      <div className="divide-y border-t">
        {items.map((m, i) => (
          <div key={`${m.hippodromeSlug}-${m.raceNo}-${m.no}`} className="flex items-center gap-3 px-4 py-2.5 text-sm">
            <span
              className={cn(
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
                rising ? "border-miss/40 text-miss" : "border-hit/40 text-hit"
              )}
            >
              {i + 1}
            </span>

            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">
                {m.hippodromeName} — {m.raceNo}. Koşu
              </div>
              <div className="truncate font-semibold">{m.name}</div>
            </div>

            <div className="shrink-0 text-right">
              <div className="font-mono text-xs text-muted-foreground line-through">{m.prev}</div>
              <div className="font-mono text-sm font-bold">{m.ganyan}</div>
            </div>

            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                rising ? "bg-miss/15 text-miss" : "bg-hit/15 text-hit"
              )}
            >
              {rising ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(m.delta).toFixed(2)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
