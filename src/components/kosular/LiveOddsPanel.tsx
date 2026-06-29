"use client";

import { useEffect, useRef, useState } from "react";
import { TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Odds = { no: string; ganyan: string | null; running: boolean };
type RaceMuhtemeller = { durum: string | null; saat: string | null; timestamp: number | null; odds: Odds[] } | null;

type Props = {
  hippodromeSlug: string;
  dateStr: string;
  raceNo: number;
  runners: { no: number; name: string }[];
};

const POLL_MS = 30_000;

export default function LiveOddsPanel({ hippodromeSlug, dateStr, raceNo, runners }: Props) {
  const [current, setCurrent] = useState<RaceMuhtemeller>(null);
  const [previous, setPrevious] = useState<RaceMuhtemeller>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const prevRef = useRef<RaceMuhtemeller>(null);

  useEffect(() => {
    let stopped = false;

    async function poll() {
      try {
        const res = await fetch(`/api/muhtemeller/${hippodromeSlug}/${raceNo}?tarih=${dateStr}`, { cache: "no-store" });
        const json = await res.json();
        if (stopped) return;
        if (json.data) {
          setPrevious(prevRef.current);
          prevRef.current = json.data;
          setCurrent(json.data);
          setError(false);
        } else {
          setError(true);
        }
      } catch {
        if (!stopped) setError(true);
      } finally {
        if (!stopped) setLoading(false);
      }
    }

    poll();
    const interval = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(interval);
    };
  }, [hippodromeSlug, raceNo, dateStr]);

  if (loading) {
    return (
      <div className="rounded-lg border p-4 text-sm text-muted-foreground">
        Canlı oranlar yükleniyor…
      </div>
    );
  }

  if (error || !current) {
    return null;
  }

  const prevByNo = new Map((previous?.odds ?? []).map((o) => [o.no, o.ganyan]));

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
          <h3 className="text-sm font-semibold">Canlı Ganyan Oranları</h3>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <RefreshCw className="h-3 w-3" />
          {current.durum ?? "—"}
        </div>
      </div>

      <div className="space-y-1.5">
        {current.odds.map((o) => {
          const runner = runners.find((r) => String(r.no) === o.no);
          const prevVal = prevByNo.get(o.no);
          const changed = prevVal != null && o.ganyan != null && prevVal !== o.ganyan;
          const dropped = changed && parseFloat(o.ganyan!) < parseFloat(prevVal!);

          return (
            <div
              key={o.no}
              className={cn(
                "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm transition-colors",
                changed && (dropped ? "bg-hit/10" : "bg-miss/10")
              )}
            >
              <span className="w-6 shrink-0 font-mono font-semibold">{o.no}</span>
              <span className="flex-1 truncate">{runner?.name ?? "—"}</span>
              {!o.running ? (
                <span className="text-xs font-medium text-muted-foreground">Koşmaz</span>
              ) : (
                <span className="flex items-center gap-1 font-mono text-sm font-bold">
                  {changed && (dropped ? <TrendingDown className="h-3 w-3 text-hit" /> : <TrendingUp className="h-3 w-3 text-miss" />)}
                  {o.ganyan ?? "—"}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-muted-foreground">
        TJK&apos;nın canlı muhtemel ganyan oranları, 30 saniyede bir güncellenir. Oranın düşmesi favoriye para
        girdiğini, yükselmesi soğuduğunu gösterir.
      </p>
    </div>
  );
}
