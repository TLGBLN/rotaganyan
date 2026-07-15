"use client";

import { useEffect, useState, useCallback } from "react";
import { markIntroSeen } from "@/server/actions/intro.actions";

type Step = { selector: string; title: string; text: string };

const STEPS: Step[] = [
  { selector: '[data-tour="program"]', title: "Yarış Programı", text: "Günün yarış programı, analizler ve tahminler burada." },
  { selector: '[data-tour="puantablosu"]', title: "Rotaganyan Puan Tablosu", text: "Analiz puanlarına göre sıralanmış Ekonomik / Normal / Geniş kupon tablosu burada." },
  { selector: '[data-tour="altili"]', title: "Altılı Ne Verir?", text: "Ayak ayak at seçip kendi altılı kombinasyonunuzu burada oluşturabilirsiniz." },
  { selector: '[data-tour="banko"]', title: "Banko Önerileri", text: "Güncel banko önerilerini burada takip edebilirsiniz." },
  { selector: '[data-tour="bildirim"]', title: "Bildirimler", text: "Takip ettiğiniz atlarla ilgili bildirimler buradan gelir." },
  { selector: '[data-tour="hesap"]', title: "Hesabım", text: "Panelinize, takip ettiğiniz atlara ve ayarlara buradan ulaşırsınız." },
];

function isVisible(el: Element | null): el is HTMLElement {
  return !!el && el instanceof HTMLElement && el.offsetParent !== null;
}

export default function IntroTour() {
  const [visibleSteps, setVisibleSteps] = useState<Step[] | null>(null);
  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    const found = STEPS.filter((s) => isVisible(document.querySelector(s.selector)));
    setVisibleSteps(found.length > 0 ? found : []);
  }, []);

  const updateRect = useCallback(() => {
    if (!visibleSteps || !visibleSteps[index]) return;
    const el = document.querySelector(visibleSteps[index].selector);
    setRect(isVisible(el) ? el.getBoundingClientRect() : null);
  }, [visibleSteps, index]);

  useEffect(() => {
    updateRect();
    window.addEventListener("resize", updateRect);
    window.addEventListener("scroll", updateRect, true);
    return () => {
      window.removeEventListener("resize", updateRect);
      window.removeEventListener("scroll", updateRect, true);
    };
  }, [updateRect]);

  async function finish() {
    setVisibleSteps(null);
    try { await markIntroSeen(); } catch { /* sessizce hata yut */ }
  }

  if (!visibleSteps || visibleSteps.length === 0 || !rect) return null;

  const step = visibleSteps[index];
  const isLast = index === visibleSteps.length - 1;
  const pad = 6;
  const spot = {
    top: rect.top - pad,
    left: rect.left - pad,
    width: rect.width + pad * 2,
    height: rect.height + pad * 2,
  };

  const spaceBelow = window.innerHeight - (spot.top + spot.height);
  const showBelow = spaceBelow > 160;
  const tooltipTop = showBelow ? spot.top + spot.height + 12 : Math.max(12, spot.top - 12);
  const tooltipLeft = Math.min(Math.max(12, spot.left), window.innerWidth - 300);

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Karartma + spotlight (dev box-shadow ile kesilmiş görünüm) */}
      <div
        className="absolute rounded-md transition-all duration-200"
        style={{
          top: spot.top,
          left: spot.left,
          width: spot.width,
          height: spot.height,
          boxShadow: "0 0 0 9999px rgba(0,0,0,0.65)",
          pointerEvents: "none",
        }}
      />
      {/* Tıklamayı engelleyen tam ekran katman (spotlight alanı hariç) */}
      <div className="absolute inset-0" onClick={finish} />

      {/* Tooltip kartı */}
      <div
        className="absolute w-[280px] rounded-lg border bg-background p-3.5 shadow-xl"
        style={{ top: tooltipTop, left: tooltipLeft, transform: showBelow ? undefined : "translateY(-100%)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-1 text-[10px] font-medium text-muted-foreground">{index + 1} / {visibleSteps.length}</div>
        <div className="mb-1 text-sm font-bold">{step.title}</div>
        <p className="mb-3 text-xs leading-snug text-muted-foreground">{step.text}</p>
        <div className="flex items-center justify-between">
          <button onClick={finish} className="text-[11px] text-muted-foreground hover:underline">
            Geç
          </button>
          <div className="flex gap-1.5">
            {index > 0 && (
              <button
                onClick={() => setIndex((i) => i - 1)}
                className="rounded-md border px-2.5 py-1 text-[11px] font-medium hover:bg-muted"
              >
                Geri
              </button>
            )}
            <button
              onClick={() => (isLast ? finish() : setIndex((i) => i + 1))}
              className="rounded-md bg-brand px-2.5 py-1 text-[11px] font-semibold text-brand-foreground hover:bg-brand/90"
            >
              {isLast ? "Bitir" : "İleri"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}