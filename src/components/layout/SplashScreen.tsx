"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Wordmark from "./Wordmark";

// Sabit süre yerine sayfa gerçekten yüklenene (window "load") kadar bekler —
// MIN taban, sayfa çok hızlı yüklense bile splash'ın bir anlık çakıp
// kaybolmamasını sağlar; MAX ise "load" olayı hiç/geç tetiklenirse (yavaş
// ağ, önbelleksiz font/görsel yükleri) splash'ın sonsuza dek takılı
// kalmasını engelleyen bir güvenlik sınırı.
const MIN_HOLD_MS = 1500;
const MAX_HOLD_MS = 6000;
const FADE_MS = 500;

export default function SplashScreen() {
  const [stage, setStage] = useState<"visible" | "fading" | "hidden">("visible");

  useEffect(() => {
    const start = Date.now();
    let finished = false;

    function finish() {
      if (finished) return;
      finished = true;
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, MIN_HOLD_MS - elapsed);
      setTimeout(() => setStage("fading"), remaining);
    }

    if (document.readyState === "complete") {
      finish();
    } else {
      window.addEventListener("load", finish);
    }
    const maxTimer = setTimeout(finish, MAX_HOLD_MS);

    return () => {
      window.removeEventListener("load", finish);
      clearTimeout(maxTimer);
    };
  }, []);

  useEffect(() => {
    if (stage !== "fading") return;
    const t = setTimeout(() => setStage("hidden"), FADE_MS);
    return () => clearTimeout(t);
  }, [stage]);

  if (stage === "hidden") return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex flex-col items-center justify-center gap-5 bg-[#0B1423] transition-opacity ease-out"
      style={{ opacity: stage === "fading" ? 0 : 1, transitionDuration: `${FADE_MS}ms` }}
      aria-hidden="true"
    >
      <div className="relative flex items-center justify-center h-[152px] w-[152px]">
        <div className="absolute inset-0 rounded-full bg-brand/10 blur-xl" />
        <div className="absolute inset-0 rounded-full border-2 border-brand/15" />
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "2.2s" }}>
          <span className="absolute -top-[3px] left-1/2 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#f0d9a6] shadow-[0_0_14px_4px_rgba(240,217,166,0.85)]" />
        </div>
        <Image src="/logo.png" alt="ROTAGANYAN" width={128} height={128} className="relative rounded-full" priority />
      </div>
      <Wordmark className="text-3xl" />
    </div>
  );
}
