"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

// 2026-09-02 kullanıcı talebi ("açılır kapanır scroll olsun") — RaceAdviceCard'lar eski
// tablo satırlarından çok daha uzun, bir günde birden çok hipodrom varsa sayfa aşırı
// uzuyordu. Her hipodrom bölümü kapanabilir — kapatınca yalnız başlık kalır; açıkken kart
// listesi kendi içinde (max-h + overflow-y-auto) kayıyor, sayfanın tamamı değil.
// 2026-09-07 kullanıcı talebi ("hepsi açılır menü olmalı ama ilk başta açık değil kapalı
// gelmeli"): varsayılan artık KAPALI — sayfa yüklenince yalnız başlıklar görünüyor, admin
// ilgilendiği hipodromu kendi açıyor.
export default function CollapsibleHipodrom({
  title,
  raceCount,
  deleteSlot,
  children,
}: {
  title: string;
  raceCount: number;
  deleteSlot: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between border-b bg-muted/30 px-3 py-1.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold">
          {open ? <ChevronUp className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />}
          {title}
        </span>
        <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
          <Badge variant="secondary" className="text-xs">
            {raceCount} koşu
          </Badge>
          {deleteSlot}
        </div>
      </button>
      <div className={cn("space-y-2 overflow-y-auto p-2", !open && "hidden")} style={open ? { maxHeight: "70vh" } : undefined}>
        {children}
      </div>
    </div>
  );
}
