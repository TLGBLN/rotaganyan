"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";
import type { Steamer } from "@/server/services/agf-trend.service";

type Props = { steamers: Steamer[]; dateStr: string };

function TickerItem({ s }: { s: Steamer }) {
  const rising = s.delta > 0;
  return (
    <span className="inline-flex items-center gap-2 px-5 py-2">
      <span className="text-[10px] font-semibold uppercase tracking-wide text-white/35">
        {s.hippodromeName.slice(0, 3).toLocaleUpperCase("tr-TR")} {s.raceNo}.K
      </span>
      <span className="font-mono text-xs font-bold text-white">#{s.no}</span>
      <span className="text-xs font-medium text-white/85">{s.name}</span>
      <span className={cn("font-mono text-xs font-bold", rising ? "text-hit" : "text-miss")}>
        {rising ? "▲" : "▼"} {rising ? "+" : ""}
        {s.delta.toFixed(1)}
      </span>
    </span>
  );
}

/** Anasayfada "borsa ekranı" hissi veren, sürekli akan AGF değişim şeridi. */
export default function SteamTicker({ steamers, dateStr }: Props) {
  if (steamers.length === 0) return null;

  const durationSec = Math.max(18, steamers.length * 3.5);

  return (
    <section className="border-t">
      <div className="flex items-center overflow-hidden border-y border-y-white/5 bg-[#0a0a0f]">
        <span className="flex shrink-0 items-center gap-1.5 self-stretch border-r border-r-brand/40 bg-brand/10 px-3 text-[10px] font-bold uppercase tracking-widest text-brand">
          <span className="h-1.5 w-1.5 rounded-full bg-brand animate-pulse" />
          AGF Steam
        </span>
        <div className="relative flex-1 overflow-hidden">
          <div
            className="inline-flex whitespace-nowrap"
            style={{ animation: `steam-ticker ${durationSec}s linear infinite` }}
          >
            {steamers.map((s) => (
              <TickerItem key={`${s.runnerId}-a`} s={s} />
            ))}
            {steamers.map((s) => (
              <TickerItem key={`${s.runnerId}-b`} s={s} />
            ))}
          </div>
        </div>
        <Link
          href={`/kosular?tarih=${dateStr}`}
          className="shrink-0 self-stretch border-l border-l-white/5 px-3 py-2 text-[10px] font-semibold text-muted-foreground transition-colors hover:text-brand flex items-center"
        >
          Tümü →
        </Link>
      </div>
      <style>{`
        @keyframes steam-ticker {
          0%   { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
      `}</style>
    </section>
  );
}
