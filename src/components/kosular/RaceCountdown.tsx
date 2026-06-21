"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { date: string; time: string }; // date: "yyyy-MM-dd", time: "HH:mm"

type State = { label: string; started: boolean; soon: boolean };

function compute(target: number): State {
  const diff = target - Date.now();
  if (diff <= 0) return { label: "Başladı", started: true, soon: false };

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  const label =
    days > 0 ? `${days}g ${hours}s kaldı` : hours > 0 ? `${hours}s ${minutes}dk kaldı` : `${minutes}dk kaldı`;

  return { label, started: false, soon: diff <= 30 * 60_000 };
}

export default function RaceCountdown({ date, time }: Props) {
  const target = new Date(`${date}T${time}:00`).getTime();
  // Start as null on both server and first client render to avoid a
  // Date.now()-based hydration mismatch; real value is filled in on mount.
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    setState(compute(target));
    const id = setInterval(() => setState(compute(target)), 30_000);
    return () => clearInterval(id);
  }, [target]);

  if (!state) return null;

  return (
    <span
      className={cn(
        "block text-[10px]",
        state.started ? "text-muted-foreground" : state.soon ? "text-miss font-medium" : "text-brand"
      )}
    >
      {state.label}
    </span>
  );
}
