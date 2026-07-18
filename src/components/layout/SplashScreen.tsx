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
      <div className="relative h-[128px] w-[128px]" style={{ animation: "splash-logo-in 900ms cubic-bezier(.2,.8,.2,1) both" }}>
        <Image src="/logo.png" alt="ROTAGANYAN" width={128} height={128} className="h-full w-full rounded-full" priority />
        <div
          className="pointer-events-none absolute -inset-2.5 rounded-full mix-blend-screen"
          style={{
            background:
              "linear-gradient(100deg, transparent 30%, rgba(255,255,255,.9) 48%, rgba(240,217,166,.9) 52%, transparent 68%)",
            animation: "splash-flash-sweep 1100ms cubic-bezier(.3,.7,.2,1) both",
          }}
        />
      </div>

      <Wordmark className="text-3xl opacity-0" style={{ animation: "splash-fade-up 500ms ease-out 520ms both" }} />

      <div
        className="flex items-end gap-2.5 h-[22px] opacity-0"
        style={{ animation: "splash-fade-up 400ms ease-out 900ms both" }}
        aria-hidden="true"
      >
        {[0, 120, 240, 360, 480].map((delay) => (
          <span
            key={delay}
            className="w-[5px] h-3 rounded-[3px]"
            style={{ animation: `splash-gate-bar 1.8s ease-in-out ${delay}ms infinite` }}
          />
        ))}
      </div>

      <div
        className="absolute bottom-6 left-4 right-4 flex items-center justify-center gap-2 opacity-0"
        style={{ animation: "splash-fade-up 500ms ease-out 1000ms both" }}
      >
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-[#c0392b] text-[9px] font-black text-[#c0392b] sm:h-7 sm:w-7 sm:text-xs">
          18+
        </span>
        <p className="max-w-md text-center text-[10px] leading-tight text-white/40 sm:text-sm">
          ROTAGANYAN 18 yaşından büyükler içindir. Bahis oynatmaz, yorum, analiz ve kupon önerilerinde bulunur.
        </p>
      </div>
    </div>
  );
}
