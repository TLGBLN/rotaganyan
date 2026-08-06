"use client";

import { useState } from "react";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { markFollowPopupShown } from "@/server/actions/horse-follow";
import type { TodaysFollowedRace } from "@/server/actions/horse-follow";

export default function FollowedHorsesPopup({ races }: { races: TodaysFollowedRace[] }) {
  const [open, setOpen] = useState(true);

  function handleClose() {
    setOpen(false);
    markFollowPopupShown().catch(() => {});
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-brand/15">
            <Sparkles className="h-5 w-5 text-brand" />
          </div>
          <DialogTitle className="text-center">
            {races.length === 1 ? "Takip Ettiğiniz At Bugün Koşuyor!" : "Takip Ettiğiniz Atlar Bugün Koşuyor!"}
          </DialogTitle>
          <DialogDescription className="text-center">
            {races.length === 1
              ? "Aşağıdaki at bugünkü programda yer alıyor."
              : `Aşağıdaki ${races.length} at bugünkü programda yer alıyor.`}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          {races.map((r, i) => (
            <div key={i} className="rounded-lg border px-3 py-2.5 text-sm">
              <div className="font-semibold">{r.horseName}</div>
              <div className="text-xs text-muted-foreground">
                {r.hippodromeName} — {r.raceNo}. Koşu{r.time ? ` · saat ${r.time}` : ""}
              </div>
            </div>
          ))}
        </div>

        <Button asChild className="w-full" onClick={handleClose}>
          <Link href="/program">Yarış Programını Gör</Link>
        </Button>
      </DialogContent>
    </Dialog>
  );
}
