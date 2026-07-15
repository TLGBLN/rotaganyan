"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

const HOLD_MS = 1100;
const FADE_MS = 450;

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
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-[#0a1420] transition-opacity ease-out"
      style={{ opacity: stage === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      <div className="relative h-28 w-28">
        <div className="absolute inset-0 rounded-full border border-white/15" />
        <div className="absolute inset-0" style={{ animation: "rg-orbit 2.6s linear infinite" }}>
          <span className="absolute -top-[3px] left-1/2 h-1.5 w-1.5 -translate-x-1/2 rounded-full bg-[#d4b45a] shadow-[0_0_10px_3px_rgba(212,180,90,0.65)]" />
        </div>
        <div className="absolute inset-0 flex items-center justify-center">
          <Image src="/logo.png" alt="ROTAGANYAN" width={72} height={72} className="rounded-xl" priority />
        </div>
      </div>

      <span className="text-sm font-bold tracking-[0.25em]">
        <span className="text-white">ROTA</span>
        <span
          style={{
            background:
              "linear-gradient(90deg,#5b9bd5 0%,#a8c8e8 30%,#e4ddc8 50%,#d4b45a 65%,#c8971e 85%,#b8820a 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          GANYAN
        </span>
      </span>
    </div>
  );
}
