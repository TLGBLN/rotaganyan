"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const INTERVAL_MS = 3 * 60 * 1000; // 3 dakika

export default function AutoRefresh() {
  const router = useRouter();
  const [secondsLeft, setSecondsLeft] = useState(INTERVAL_MS / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    let remaining = INTERVAL_MS / 1000;

    // Countdown
    const countdown = setInterval(() => {
      remaining -= 1;
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        remaining = INTERVAL_MS / 1000;
        setSecondsLeft(remaining);
        router.refresh();
      }
    }, 1000);

    timerRef.current = countdown;
    return () => clearInterval(countdown);
  }, [router]);

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;

  return (
    <span className="text-[10px] text-muted-foreground/50 tabular-nums select-none">
      {mins}:{String(secs).padStart(2, "0")}
    </span>
  );
}
