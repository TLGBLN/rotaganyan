"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp, TrendingDown, Flag, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AgfMovers, Steamer } from "@/server/services/agf-trend.service";

function MoverRow({ s, rank, dateStr, rising }: { s: Steamer; rank: number; dateStr: string; rising: boolean }) {
  return (
    <Link
      href={`/kosular/${dateStr}/${s.hippodromeSlug}/${s.raceNo}`}
      className="flex items-center gap-3 px-4 py-2.5 text-sm transition-colors hover:bg-muted/40"
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs font-bold",
          rising ? "border-hit/40 text-hit" : "border-miss/40 text-miss"
        )}
      >
        {rank}
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
          <Flag className="h-2.5 w-2.5" />
          {s.hippodromeName} {s.raceNo}. Koşu #{s.no}
        </div>
        <div className="truncate font-semibold">{s.name}</div>
      </div>
      <div className="shrink-0 text-right font-mono text-xs">
        <span className="text-muted-foreground line-through">%{s.first.toFixed(1)}</span>
        <span className="mx-1 text-muted-foreground">→</span>
        <span className="font-bold">%{s.last.toFixed(1)}</span>
      </div>
      <span
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
          rising ? "bg-hit/15 text-hit" : "bg-miss/15 text-miss"
        )}
      >
        {rising ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
        {Math.abs(s.delta).toFixed(1)} puan
      </span>
      <span className="hidden w-16 shrink-0 text-right text-[10px] italic text-muted-foreground sm:inline">
        {s.resulted ? "Koşuldu" : "Bekliyor"}
      </span>
    </Link>
  );
}

function MoverCard({ title, items, dateStr, rising }: { title: string; items: Steamer[]; dateStr: string; rising: boolean }) {
  const [open, setOpen] = useState(true);
  if (items.length === 0) return null;

  return (
    <div className="overflow-hidden rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
            rising ? "bg-hit/15 text-hit" : "bg-miss/15 text-miss"
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
        {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="divide-y border-t">
          {items.map((s, i) => (
            <MoverRow key={s.runnerId} s={s} rank={i + 1} dateStr={dateStr} rising={rising} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function SteamWidget({ movers, dateStr }: { movers: AgfMovers; dateStr: string }) {
  if (movers.risers.length === 0 && movers.fallers.length === 0) return null;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <MoverCard title="AGF Yükselen" items={movers.risers} dateStr={dateStr} rising />
        <MoverCard title="AGF Düşen" items={movers.fallers} dateStr={dateStr} rising={false} />
      </div>
      <p className="px-1 text-[11px] text-muted-foreground">
        Günün ilk ve son AGF senkronizasyonu arasındaki değişim — yükseliş favoriye giren parayı, düşüş soğumayı
        işaret eder.
      </p>
    </div>
  );
}
