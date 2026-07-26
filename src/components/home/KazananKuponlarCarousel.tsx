"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { KazananKupon } from "@/server/services/race.service";

function Card({ k }: { k: KazananKupon }) {
  const dateStr = format(new Date(k.date), "d MMM yyyy", { locale: tr });

  return (
    <Link
      href="/program"
      className="shrink-0 w-64 rounded-lg border border-hit/30 bg-hit/5 p-4 transition hover:border-hit/60 hover:bg-hit/10"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{dateStr}</span>
        <span className="text-xs font-semibold text-hit bg-hit/10 border border-hit/30 rounded-full px-2 py-0.5 shrink-0">
          ✓ Tuttu
        </span>
      </div>
      <p className="font-bold text-foreground truncate">{k.hippodromeName}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-xs border border-brand/40 text-brand bg-brand/10 rounded-full px-2 py-0.5">
          {k.variantLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {k.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
        </span>
      </div>
      {k.ikramiye && (
        <p className="mt-2 text-xs font-medium text-hit leading-snug">{k.ikramiye}</p>
      )}
    </Link>
  );
}

export default function KazananKuponlarCarousel({ items }: { items: KazananKupon[] }) {
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
        {[...repeated, ...repeated].map((k, i) => (
          <Card key={`${k.id}-${i}`} k={k} />
        ))}
      </div>
    </div>
  );
}
