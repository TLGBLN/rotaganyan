"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { target: string; size?: "sm" | "md" }; // target: ISO datetime string

function getParts(target: number) {
  const diff = Math.max(0, target - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  return {
    days: Math.floor(totalSeconds / 86400),
    hours: Math.floor((totalSeconds % 86400) / 3600),
    minutes: Math.floor((totalSeconds % 3600) / 60),
    seconds: totalSeconds % 60,
    done: diff <= 0,
  };
}

function Box({ value, label, size }: { value: number; label: string; size: "sm" | "md" }) {
  return (
    <div className="flex flex-col items-center">
      <div
        className={cn(
          "flex items-center justify-center rounded-lg border border-brand/40 bg-gradient-to-b from-[#2a1f0f] to-black font-serif font-bold text-brand shadow-[0_0_10px_rgba(200,151,30,0.25)]",
          size === "sm"
            ? "h-5 w-5 text-[10px] sm:h-8 sm:w-8 sm:rounded-xl sm:text-sm"
            : "h-8 w-8 text-base sm:h-12 sm:w-12 sm:rounded-xl sm:text-xl"
        )}
      >
        {String(value).padStart(2, "0")}
      </div>
      <span
        className={cn(
          "mt-0.5 font-medium uppercase tracking-[0.1em] text-white/50",
          size === "sm" ? "text-[5px] sm:text-[7px]" : "text-[6px] sm:text-[10px]"
        )}
      >
        {label}
      </span>
    </div>
  );
}

export default function BannerCountdown({ target, size = "md" }: Props) {
  const targetMs = new Date(target).getTime();
  // Start as null on both server and first client render to avoid a
  // Date.now()-based hydration mismatch; real value is filled in on mount.
  const [parts, setParts] = useState<ReturnType<typeof getParts> | null>(null);

  useEffect(() => {
    setParts(getParts(targetMs));
    const id = setInterval(() => setParts(getParts(targetMs)), 1000);
    return () => clearInterval(id);
  }, [targetMs]);

  if (!parts || parts.done) return null;

  return (
    <div
      className={cn(
        "inline-flex items-center rounded-lg border border-brand/25 bg-gradient-to-b from-black/75 to-[#1a1206]/85 backdrop-blur-md",
        size === "sm" ? "gap-1 px-1.5 py-1 sm:gap-1.5 sm:rounded-xl sm:px-2.5 sm:py-2" : "gap-1.5 px-2 py-1.5 sm:gap-2.5 sm:rounded-xl sm:px-4 sm:py-3"
      )}
    >
      <Box value={parts.days} label="Gün" size={size} />
      <Box value={parts.hours} label="Saat" size={size} />
      <Box value={parts.minutes} label="Dk" size={size} />
      <Box value={parts.seconds} label="Sn" size={size} />
    </div>
  );
}
