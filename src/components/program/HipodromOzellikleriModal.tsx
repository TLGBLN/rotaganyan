"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { HIPODROM_OZELLIKLERI } from "@/lib/hipodrom-ozellikleri";

export default function HipodromOzellikleriModal({
  hippodromeSlug, hippodromeName, onClose,
}: {
  hippodromeSlug: string;
  hippodromeName: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const ozellik = HIPODROM_OZELLIKLERI[hippodromeSlug];

  // Odağı diyalog içine al ve önceki elemana geri döndür — ekran okuyucu/klavye kullanıcıları arkadaki sayfaya kaçmasın
  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeBtnRef.current?.focus();
    return () => previouslyFocused?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") { onClose(); return; }
      if (e.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const focusable = dialog.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={hippodromeName}
        className="flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">{ozellik?.ad ?? hippodromeName} — Hipodrom Özellikleri</h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            title="Kapat"
            aria-label="Kapat"
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {!ozellik ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">
              Bu hipodrom için henüz veri eklenmedi.
            </div>
          ) : (
            <div className="p-4 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="rounded-md border p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#009900]">Çim Pist</div>
                  <div className="mt-1 font-mono tabular-nums">{ozellik.cimPist ?? "—"}</div>
                </div>
                <div className="rounded-md border p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#996633]">Kum Pist</div>
                  <div className="mt-1 font-mono tabular-nums">{ozellik.kumPist ?? "—"}</div>
                </div>
                <div className="rounded-md border p-2.5">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Antrenman Pisti</div>
                  <div className="mt-1 font-mono tabular-nums">{ozellik.antrenmanPisti ?? "—"}</div>
                </div>
              </div>

              {ozellik.not && (
                <p className="text-[11px] text-muted-foreground">{ozellik.not}</p>
              )}

              <div>
                <div className="mb-1.5 text-xs font-semibold text-muted-foreground">
                  Mesafe / Start Noktası Diyagramı (TJK resmi)
                </div>
                <div className="rounded-md border bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ozellik.diyagramUrl}
                    alt={`${ozellik.ad} pist ve mesafe diyagramı`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Her mesafenin start kapısının pistin neresinden (viraj veya düz yol) başladığını
                  gösterir — kulvar avantajı ve erken tempo yorumunda destekleyici bir unsurdur,
                  tek başına belirleyici değildir.
                </p>
              </div>

              <p className="text-[10px] text-muted-foreground border-t pt-2">
                Kaynak: TJK resmi &quot;Hipodromlar&quot; sayfası. Bu veri statiktir, nadiren değişir
                (pist yeniden inşa edilmedikçe) — otomatik senkronize edilmez.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
