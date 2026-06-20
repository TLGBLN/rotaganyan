"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { date: string; time: string }; // date: "yyyy-MM-dd", time: "HH:mm"

function format(target: number): string {
  const diff = target - Date.now();
  if (diff <= 0) return "Başladı";

  const totalMinutes = Math.floor(diff / 60000);
  const days = Math.floor(totalMinutes / (24 * 60));
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}g ${hours}s kaldı`;
  if (hours > 0) return `${hours}s ${minutes}dk kaldı`;
  return `${minutes}dk kaldı`;
}

export default function RaceCountdown({ date, time }: Props) {
  const target = new Date(`${date}T${time}:00`).getTime();
  const [label, setLabel] = useState(() => format(target));

  useEffect(() => {
    setLabel(format(target));
    const id = setInterval(() => setLabel(format(target)), 30_000);
    return () => clearInterval(id);
  }, [target]);

  const started = target - Date.now() <= 0;
  const soon = !started && target - Date.now() <= 30 * 60_000;

  return (
    <span
      className={cn(
        "block text-[10px]",
        started ? "text-muted-foreground" : soon ? "text-miss font-medium" : "text-brand"
      )}
    >
      {label}
    </span>
  );
}
