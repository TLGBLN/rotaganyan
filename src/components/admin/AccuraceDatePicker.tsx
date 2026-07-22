"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, Calendar } from "lucide-react";
import { cn } from "@/lib/utils";

function addDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export default function AccuraceDatePicker({ date }: { date: string }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function goTo(newDate: string) {
    router.push(`/admin/accurace?tarih=${newDate}`);
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => goTo(addDays(date, -1))}
        className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Önceki gün"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <div
        className="relative flex items-center cursor-pointer"
        onClick={() => inputRef.current?.showPicker?.()}
      >
        <Calendar className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          ref={inputRef}
          type="date"
          value={date}
          onChange={(e) => e.target.value && goTo(e.target.value)}
          className={cn(
            "rounded-md border bg-background py-1.5 pl-7 pr-2 text-xs focus:outline-none focus:ring-1 focus:ring-brand",
            "[color-scheme:dark] [&::-webkit-calendar-picker-indicator]:opacity-0"
          )}
        />
      </div>

      <button
        type="button"
        onClick={() => goTo(addDays(date, 1))}
        className="flex h-8 w-8 items-center justify-center rounded-md border text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        aria-label="Sonraki gün"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}
