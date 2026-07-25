"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { HIPODROM_OZELLIKLERI } from "@/lib/hipodrom-ozellikleri";
import { HIPODROM_MESAFE_KOORDINATLARI } from "@/lib/hipodrom-mesafe-koordinat";

const YUZEY_LABEL: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };
const YUZEY_RENK: Record<string, string> = { CIM: "#009900", KUM: "#996633", SENTETIK: "#D39B1E" };

export default function HipodromOzellikleriModal({
  hippodromeSlug, hippodromeName, distance, surface, onClose,
}: {
  hippodromeSlug: string;
  hippodromeName: string;
  /** Bugünkü koşunun mesafesi/pisti — verilirse diyagram üzerinde işaretlenir. */
  distance?: number;
  surface?: string;
  onClose: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);
  const ozellik = HIPODROM_OZELLIKLERI[hippodromeSlug];
  const koordinat = surface && distance != null
    ? HIPODROM_MESAFE_KOORDINATLARI[hippodromeSlug]?.[surface as "CIM" | "KUM" | "SENTETIK"]?.[distance]
    : undefined;

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
                <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold text-muted-foreground">
                  <span>Mesafe / Start Noktası Diyagramı (TJK resmi)</span>
                  {distance != null && surface && (
                    <span
                      className="rounded-full border px-2 py-0.5 text-[10px] font-bold"
                      style={{ color: YUZEY_RENK[surface] ?? undefined, borderColor: YUZEY_RENK[surface] ?? undefined }}
                    >
                      Bugünkü koşu: {distance}m {YUZEY_LABEL[surface] ?? surface}
                    </span>
                  )}
                </div>
                <div className="relative rounded-md border bg-white p-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={ozellik.diyagramUrl}
                    alt={`${ozellik.ad} pist ve mesafe diyagramı`}
                    className="w-full h-auto"
                    loading="lazy"
                  />
                  {koordinat && surface && (
                    <div
                      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                      style={{ left: `${koordinat.x}%`, top: `${koordinat.y}%` }}
                    >
                      <span
                        className="absolute inset-0 -m-2 block animate-ping rounded-full opacity-60"
                        style={{ backgroundColor: YUZEY_RENK[surface] ?? "#e11d48" }}
                      />
                      <span
                        className="relative block h-3.5 w-3.5 rounded-full border-2 border-white shadow-[0_0_0_1.5px_rgba(0,0,0,0.5)]"
                        style={{ backgroundColor: YUZEY_RENK[surface] ?? "#e11d48" }}
                      />
                    </div>
                  )}
                </div>
                {distance != null && surface && !koordinat && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground">
                    Bugünkü koşunun ({distance}m {YUZEY_LABEL[surface] ?? surface}) tam start noktası bu diyagramda ayrıca işaretli değil.
                  </p>
                )}
                <p className="mt-1.5 text-[10px] text-muted-foreground">
                  Her mesafenin start kapısının pistin neresinden (viraj veya düz yol) başladığını
                  gösterir — kulvar avantajı ve erken tempo yorumunda destekleyici bir unsurdur,
                  tek başına belirleyici değildir.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
