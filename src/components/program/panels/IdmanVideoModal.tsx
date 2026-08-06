"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { X } from "lucide-react";

export type IdmanVideoModalGallop = {
  date: Date;
  track: string | null;
  form: string | null;
  jockey: string | null;
  splits: Record<string, string | null>;
};

export default function IdmanVideoModal({
  runnerName,
  runnerNo,
  videoUrl,
  latestGallop,
  galopDateLabel,
  splitsLabel,
  raceJockey,
  onClose,
}: {
  runnerName: string;
  runnerNo: number;
  videoUrl: string;
  latestGallop: IdmanVideoModalGallop | null;
  galopDateLabel: string | null;
  splitsLabel: string | null;
  raceJockey: string | null;
  onClose: () => void;
}) {
  const t = useTranslations("programToolbar");
  const icDis = (latestGallop?.splits["ic_dis"] ?? "").toUpperCase();
  const isInner = icDis.includes("İÇ") || icDis.includes("IC");
  const isOuter = !isInner && (icDis.includes("DIŞ") || icDis.includes("DIS"));
  const sameJockeyAsRace =
    !!latestGallop?.jockey && !!raceJockey &&
    latestGallop.jockey.trim().split(/\s+/).pop()?.toUpperCase() === raceJockey.trim().split(/\s+/).pop()?.toUpperCase();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

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
        aria-label={`${runnerName} — ${t("idmTitle")}`}
        className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">
            <span className="font-mono mr-1">{runnerNo}</span>
            {runnerName} — {t("idmTitle")}
          </h2>
          <button
            ref={closeBtnRef}
            type="button"
            onClick={onClose}
            title={t("kapat")}
            aria-label={t("kapat")}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-3">
          <video controls autoPlay preload="auto" className="w-full rounded border bg-black" src={videoUrl} />

          <div className="rounded-md border p-2.5 text-xs">
            <div className="mb-1 font-semibold uppercase tracking-wide text-[10px] text-muted-foreground">
              {t("videoAitCalisma")}
            </div>
            {latestGallop ? (
              <div className="space-y-0.5">
                <div className="font-mono">
                  {galopDateLabel}
                  {latestGallop.track && <span className="ml-1 opacity-70">{latestGallop.track}</span>}
                  {latestGallop.form && <span className="ml-1 opacity-70">· {latestGallop.form}</span>}
                </div>
                {splitsLabel && <div className="font-mono">{splitsLabel}</div>}
                {latestGallop.jockey && (
                  <div>
                    {t("antrenmanJokeyi")} <span className="font-medium">{latestGallop.jockey}</span>
                    {sameJockeyAsRace && (
                      <span className="ml-1 text-hit font-semibold">{t("kosudaDaBinecek")}</span>
                    )}
                  </div>
                )}
                {(isInner || isOuter) && (
                  <div>
                    {t("videodaKonum")} <span className="font-medium">{isInner ? t("icKulvar") : t("disKulvar")}</span>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground">{t("galopDetayiYok")}</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
