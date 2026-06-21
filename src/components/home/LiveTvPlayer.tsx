"use client";

import { Tv } from "lucide-react";

function openLiveTv() {
  const width = 420;
  const height = 280;
  const left = window.screen.availWidth - width - 16;
  const top = window.screen.availHeight - height - 16;
  window.open(
    "https://www.youtube.com/watch?v=g89RQMJtK6E",
    "tjkCanliTv",
    `width=${width},height=${height},left=${left},top=${top},noopener,noreferrer`
  );
}

export default function LiveTvPlayer() {
  return (
    <button
      onClick={openLiveTv}
      className="inline-flex items-center gap-2 rounded-lg border border-border bg-background px-5 py-2.5 text-base font-medium transition-colors hover:border-foreground/30 hover:bg-muted"
    >
      <Tv className="h-4 w-4" />
      Canlı TV
    </button>
  );
}
