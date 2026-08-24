"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

type Props = { date: string; time: string }; // date: "yyyy-MM-dd", time: "HH:mm"

type State = { label: string; started: boolean; soon: boolean };

const pad = (n: number) => String(n).padStart(2, "0");

// 2026-08-24 kullanıcı talebi: "countdownlar bu şekilde işlesin Saat:dakika:saniye
// sitenin neresinde kullanılıyorsa" — eskiden "2g 3s"/"3s 15dk"/"15dk" gibi kaba dilime
// bölünüyordu, artık her yerde tek biçim: saniye hassasiyetiyle HH:MM:SS.
function compute(target: number): State {
  const diffSec = Math.floor((target - Date.now()) / 1000);
  if (diffSec <= 0) return { label: "Başladı", started: true, soon: false };

  const hrs = Math.floor(diffSec / 3600);
  const mins = Math.floor((diffSec % 3600) / 60);
  const secs = diffSec % 60;

  return { label: `${pad(hrs)}:${pad(mins)}:${pad(secs)}`, started: false, soon: diffSec <= 30 * 60 };
}

export default function RaceCountdown({ date, time }: Props) {
  // Hedefi Türkiye saatinden (UTC+3, DST yok) UTC'ye çevirerek hesapla — ziyaretçinin
  // TARAYICI saat dilimine bakılmaksızın doğru geri sayım (eskiden `new Date(...)`
  // tarayıcı yerel saatiyle yorumluyordu, Türkiye dışından bakan biri için yanlış
  // sonuç veriyordu — bkz. ProgramView.tsx'teki aynı UTC-3 deseni).
  const [h, m] = time.replace(".", ":").split(":").map(Number);
  const target =
    !isNaN(h) && !isNaN(m)
      ? new Date(`${date}T${pad(h)}:${pad(m)}:00Z`).getTime() - 3 * 60 * 60 * 1000
      : NaN;
  // Start as null on both server and first client render to avoid a
  // Date.now()-based hydration mismatch; real value is filled in on mount.
  const [state, setState] = useState<State | null>(null);

  useEffect(() => {
    if (isNaN(target)) return;
    setState(compute(target));
    const id = setInterval(() => setState(compute(target)), 1000);
    return () => clearInterval(id);
  }, [target]);

  if (!state) return null;

  return (
    <span
      className={cn(
        "block font-mono text-[10px] tabular-nums",
        state.started ? "text-muted-foreground" : state.soon ? "text-miss font-medium" : "text-brand"
      )}
    >
      {state.label}
    </span>
  );
}
