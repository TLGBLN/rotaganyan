import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Steamer } from "@/server/services/agf-trend.service";

function Sparkline({ points, rising }: { points: { agf: number }[]; rising: boolean }) {
  const values = points.map((p) => p.agf);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = 64;
  const h = 24;
  const coords = values.map((v, i) => {
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - min) / range) * h;
    return `${x},${y}`;
  });

  return (
    <svg width={w} height={h} className="shrink-0 overflow-visible">
      <polyline
        points={coords.join(" ")}
        fill="none"
        strokeWidth={1.5}
        className={rising ? "stroke-hit" : "stroke-miss"}
      />
    </svg>
  );
}

export default function SteamWidget({ steamers, dateStr }: { steamers: Steamer[]; dateStr: string }) {
  if (steamers.length === 0) return null;

  const lastCapturedAt = steamers
    .flatMap((s) => s.points.map((p) => new Date(p.capturedAt).getTime()))
    .reduce((max, t) => Math.max(max, t), 0);

  return (
    <section className="rounded-lg border p-4">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
        <h2 className="text-sm font-semibold">Para Hareketi (AGF Steam)</h2>
        <span className="text-xs text-muted-foreground">Bugünün en çok değişen favorileri</span>
      </div>

      <div className="space-y-2">
        {steamers.map((s) => {
          const rising = s.delta > 0;
          return (
            <Link
              key={s.runnerId}
              href={`/kosular/${dateStr}/${s.hippodromeSlug}/${s.raceNo}`}
              className="flex items-center gap-3 rounded-md border px-3 py-2 text-sm transition-colors hover:bg-muted/50"
            >
              <span className="w-24 shrink-0 truncate text-xs text-muted-foreground">
                {s.hippodromeName} {s.raceNo}.K
              </span>
              <span className="w-8 shrink-0 font-mono font-semibold">{s.no}</span>
              <span className="flex-1 truncate font-medium">{s.name}</span>
              <Sparkline points={s.points} rising={rising} />
              <span
                className={cn(
                  "flex w-20 shrink-0 items-center justify-end gap-1 text-right font-mono text-xs font-bold",
                  rising ? "text-hit" : "text-miss"
                )}
              >
                {rising ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                {rising ? "+" : ""}
                {s.delta.toFixed(1)}
              </span>
              <span className="hidden w-32 shrink-0 text-right text-[10px] text-muted-foreground sm:inline">
                %{s.first.toFixed(0)} → %{s.last.toFixed(0)}
              </span>
            </Link>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        AGF, güne ilk senkronizasyondan {format(new Date(lastCapturedAt), "HH:mm", { locale: tr })} itibarıyla geçen
        değişimi gösterir — yükseliş favoriye giren parayı, düşüş soğumayı işaret eder.
      </p>
    </section>
  );
}
