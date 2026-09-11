"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import { useRef } from "react";

type Props = { currentDate: string; basePath?: string }; // "yyyy-MM-dd"

function shift(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function toDisplay(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

export default function DateNavigator({ currentDate, basePath = "/kosular" }: Props) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const go = (date: string) => router.push(`${basePath}?tarih=${date}`);

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => go(shift(currentDate, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        onClick={() => inputRef.current?.showPicker()}
        className="relative flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-medium text-foreground transition-colors hover:border-foreground/30"
      >
        <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
        {toDisplay(currentDate)}
        <input
          ref={inputRef}
          type="date"
          value={currentDate}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          tabIndex={-1}
        />
      </button>

      <button
        onClick={() => go(shift(currentDate, 1))}
        className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground transition-colors hover:border-foreground/30 hover:text-foreground"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
