"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const HOLD_MS = 2600;
const FADE_MS = 500;

export default function SplashScreen() {
  const [stage, setStage] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    const t1 = setTimeout(() => setStage("fading"), HOLD_MS);
    const t2 = setTimeout(() => setStage("hidden"), HOLD_MS + FADE_MS);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  if (stage === "hidden") return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-3 bg-[#0B1423] transition-opacity ease-out"
      style={{ opacity: stage === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      <Image src="/logo.png" alt="ROTAGANYAN" width={80} height={80} className="rounded-full" priority />
      <span className="text-xl font-bold tracking-tight">
        <span className="text-white">ROTA</span>
        <span className="text-brand">GANYAN</span>
      </span>
    </div>
  );
}
