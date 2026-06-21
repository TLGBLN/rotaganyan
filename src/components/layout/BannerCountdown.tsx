"use client";

import { useEffect, useState } from "react";

type Props = { target: string }; // target: ISO datetime string

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

function Box({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-brand/40 bg-gradient-to-b from-[#2a1f0f] to-black font-serif text-base font-bold text-brand shadow-[0_0_10px_rgba(200,151,30,0.25)] sm:h-12 sm:w-12 sm:rounded-xl sm:text-xl">
        {String(value).padStart(2, "0")}
      </div>
      <span className="mt-0.5 text-[6px] font-medium uppercase tracking-[0.1em] text-white/50 sm:text-[10px]">
        {label}
      </span>
    </div>
  );
}

export default function BannerCountdown({ target }: Props) {
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
    <div className="inline-flex items-center gap-1.5 rounded-lg border border-brand/25 bg-gradient-to-b from-black/75 to-[#1a1206]/85 px-2 py-1.5 backdrop-blur-md sm:gap-2.5 sm:rounded-xl sm:px-4 sm:py-3">
      <Box value={parts.days} label="Gün" />
      <Box value={parts.hours} label="Saat" />
      <Box value={parts.minutes} label="Dk" />
      <Box value={parts.seconds} label="Sn" />
    </div>
  );
}
