"use client";

import { useState } from "react";
import type { KazananKupon } from "@/server/services/race.service";
import { KazananKuponCard, KuponDetailDialog } from "./KazananKuponlarCarousel";

// 2026-09-15 kullanıcı talebi: üye olmayan bir ziyaretçi merak ederse diye, TÜM
// zamanların tutan kuponlarını (yukarıdan aşağı, tarihe göre en yeniden en eskiye —
// getGecmisKazananKuponlar zaten bu sırada döner) sabit bir ızgara olarak gösteren
// sayfa. KazananKuponlarCarousel'in otomatik kayan/tekrar eden şerit mantığını
// KOPYALAMAZ — kart/dialog çiftini oradan yeniden kullanır.
export default function TutanKuponlarListesi({ items }: { items: KazananKupon[] }) {
  const [selected, setSelected] = useState<KazananKupon | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Henüz isabet sağlayan kupon yok.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((k) => (
        <KazananKuponCard key={k.id} k={k} onOpen={() => setSelected(k)} className="w-full shrink" />
      ))}
      <KuponDetailDialog k={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
