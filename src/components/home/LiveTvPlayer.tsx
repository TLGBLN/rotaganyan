"use client";

import { useState } from "react";
import { X, Tv } from "lucide-react";

export default function LiveTvPlayer() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-base font-medium transition-colors hover:border-foreground/30 hover:bg-muted"
      >
        <Tv className="h-4 w-4" />
        Canlı TV
      </button>

      {open && (
        <div className="fixed bottom-4 right-4 z-50 flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
          style={{ width: 380, height: 240 }}
        >
          <div className="flex items-center justify-between bg-muted/60 px-3 py-1.5 shrink-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-xs font-semibold">TJK Canlı</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <iframe
            src="https://www.tjk.org/TR/YarisSever/Static/Canli"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
            allowFullScreen
            className="flex-1 w-full border-0"
          />
        </div>
      )}
    </>
  );
}
