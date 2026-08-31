"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import HorseDetailContent from "./HorseDetailContent";

export default function HorseDetailModal({ name, onClose }: { name: string; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

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
        aria-label={name}
        className="flex max-h-[80vh] w-full max-w-4xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">{name}</h2>
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
          <HorseDetailContent name={name} />
        </div>
      </div>
    </div>
  );
}
