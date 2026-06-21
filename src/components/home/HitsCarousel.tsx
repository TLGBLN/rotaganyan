"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";

type Item = {
  id: string;
  isBanko: boolean;
  confidence: string;
  race: {
    raceNo: number;
    classType: string;
    raceDay: { date: Date | string; hippodrome: { name: string; slug: string } };
    result: { hitTop1: boolean; winnerNo: number | null; ganyan: number | null } | null;
  };
  picks: { runner: { name: string; no: number } | null }[];
};

function Card({ p }: { p: Item }) {
  const pick1 = p.picks[0];
  const rd = p.race.raceDay;
  const dateStr = format(new Date(rd.date), "d MMM yyyy", { locale: tr });
  const href = "/analizler";

  return (
    <Link
      href={href}
      className="shrink-0 w-64 rounded-lg border border-hit/30 bg-hit/5 p-4 transition hover:border-hit/60 hover:bg-hit/10"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground">
          {dateStr} · {rd.hippodrome.name}
        </span>
        <span className="text-xs font-semibold text-hit bg-hit/10 border border-hit/30 rounded-full px-2 py-0.5 shrink-0">
          ✓ İsabet
        </span>
      </div>
      <div className="flex items-end justify-between gap-2">
        <p className="font-bold text-foreground truncate">{pick1?.runner?.name ?? "—"}</p>
        {p.race.result?.ganyan != null && (
          <span className="shrink-0 text-right leading-none">
            <span className="block text-lg font-extrabold text-brand">
              {p.race.result.ganyan.toFixed(2)}
            </span>
            <span className="block text-[9px] font-medium uppercase tracking-wide text-muted-foreground">
              Ganyan
            </span>
          </span>
        )}
      </div>
      <div className="mt-1 text-xs text-muted-foreground">
        {p.race.raceNo}. Koşu · {p.race.classType}
      </div>
      <div className="mt-2">
        <span className="text-xs border border-brand/40 text-brand bg-brand/10 rounded-full px-2 py-0.5">
          ★ Banko
        </span>
      </div>
    </Link>
  );
}

export default function HitsCarousel({ items }: { items: Item[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;

    let pos = 0;
    let frame: number;

    const step = () => {
      if (!pausedRef.current) {
        const half = track.scrollWidth / 2;
        if (half > 0) {
          pos = (pos + 1.2) % half;
          track.style.transform = `translateX(-${pos}px)`;
        }
      }
      frame = requestAnimationFrame(step);
    };

    const pause = () => { pausedRef.current = true; };
    const resume = () => { pausedRef.current = false; };

    track.addEventListener("mouseenter", pause);
    track.addEventListener("mouseleave", resume);

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("mouseenter", pause);
      track.removeEventListener("mouseleave", resume);
    };
  }, [items.length]);

  if (items.length === 0) return null;

  const COPIES = Math.max(6, Math.ceil(3200 / (items.length * 288)));
  const repeated = Array.from({ length: COPIES }, () => items).flat();

  return (
    <div className="overflow-hidden">
      <div ref={trackRef} className="flex gap-4 will-change-transform">
        {[...repeated, ...repeated].map((p, i) => (
          <Card key={`${p.id}-${i}`} p={p} />
        ))}
      </div>
    </div>
  );
}
