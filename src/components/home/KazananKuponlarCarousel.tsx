"use client";

import { useEffect, useRef, useState } from "react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { useTranslations } from "next-intl";
import type { KazananKupon } from "@/server/services/race.service";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

function Card({ k, onOpen }: { k: KazananKupon; onOpen: () => void }) {
  const t = useTranslations("home.kupon");
  const dateStr = format(new Date(k.date), "d MMM yyyy", { locale: tr });

  return (
    <button
      type="button"
      onClick={onOpen}
      className="shrink-0 w-64 text-left rounded-lg border border-hit/30 bg-hit/5 p-4 transition hover:border-hit/60 hover:bg-hit/10"
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground">{dateStr}</span>
        <span className="text-xs font-semibold text-hit bg-hit/10 border border-hit/30 rounded-full px-2 py-0.5 shrink-0">
          {t("tuttu")}
        </span>
      </div>
      <p className="font-bold text-foreground truncate">{k.hippodromeName}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span className="text-xs border border-brand/40 text-brand bg-brand/10 rounded-full px-2 py-0.5">
          {k.variantLabel}
        </span>
        <span className="text-xs text-muted-foreground">
          {k.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
        </span>
      </div>
      {k.ikramiye && (
        <p className="mt-2 text-xs font-medium text-hit leading-snug">{k.ikramiye}</p>
      )}
    </button>
  );
}

function KuponDetailDialog({ k, onClose }: { k: KazananKupon | null; onClose: () => void }) {
  const t = useTranslations("home.kupon");
  return (
    <Dialog open={k != null} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl">
        {k && (
          <>
            <DialogHeader>
              <div className="flex items-center justify-between gap-2 pr-6">
                <DialogTitle>{k.hippodromeName}</DialogTitle>
                <span className="shrink-0 rounded-full bg-hit/15 px-2 py-0.5 text-[10px] font-semibold text-hit">
                  {t("tuttuPlain")}
                </span>
              </div>
            </DialogHeader>

            <div className="flex items-center gap-2">
              <span className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground">
                {k.variantLabel}
              </span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(k.date), "d MMMM yyyy", { locale: tr })}
              </span>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <div
                className="grid divide-x"
                style={{ gridTemplateColumns: `repeat(${k.legs.length}, minmax(56px, 1fr))` }}
              >
                {k.legs.map((leg) => (
                  <div key={leg.raceNo} className="px-1.5 py-3 text-center">
                    <div className="mb-2 text-[10px] font-medium text-muted-foreground">
                      {leg.raceNo}. {t("kosuSuffix")}
                    </div>
                    <div className="space-y-1.5 text-sm font-semibold">
                      {leg.nos.map((no) => {
                        const ekuriWinnerNo = leg.ekuriWinnerByNo[no];
                        return (
                          <div key={no}>
                            {leg.winnerNos.includes(no) ? (
                              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-hit text-white text-xs font-bold">
                                {no}
                              </span>
                            ) : ekuriWinnerNo != null ? (
                              <span className="inline-flex items-center gap-1">
                                <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-hit text-white text-xs font-bold">
                                  {no}
                                </span>
                                <span className="text-[9px] text-hit">({ekuriWinnerNo} eküri)</span>
                              </span>
                            ) : (
                              <span>{no}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t pt-3">
              <div className="text-xs text-muted-foreground">{t("kuponTutari")}</div>
              <div className="text-lg font-bold">
                {k.amount.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺
              </div>
              {k.ikramiye && <div className="mt-1.5 text-xs font-medium text-hit">{k.ikramiye}</div>}
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function KazananKuponlarCarousel({ items }: { items: KazananKupon[] }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const pausedRef = useRef(false);
  const [selected, setSelected] = useState<KazananKupon | null>(null);

  useEffect(() => {
    const track = trackRef.current;
    if (!track || items.length === 0) return;

    let pos = 0;
    let frame: number;

    const step = () => {
      if (!pausedRef.current) {
        const half = track.scrollWidth / 2;
        if (half > 0) {
          pos = (pos + 1.2) % half;
          track.style.transform = `translateX(-${pos}px)`;
        }
      }
      frame = requestAnimationFrame(step);
    };

    const pause = () => { pausedRef.current = true; };
    const resume = () => { pausedRef.current = false; };

    track.addEventListener("mouseenter", pause);
    track.addEventListener("mouseleave", resume);

    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      track.removeEventListener("mouseenter", pause);
      track.removeEventListener("mouseleave", resume);
    };
  }, [items.length]);

  if (items.length === 0) return null;

  const COPIES = Math.max(6, Math.ceil(3200 / (items.length * 288)));
  const repeated = Array.from({ length: COPIES }, () => items).flat();

  return (
    <div className={cn("overflow-hidden")}>
      <div ref={trackRef} className="flex gap-4 will-change-transform">
        {[...repeated, ...repeated].map((k, i) => (
          <Card key={`${k.id}-${i}`} k={k} onOpen={() => setSelected(k)} />
        ))}
      </div>
      <KuponDetailDialog k={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
