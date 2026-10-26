"use client";

import { useState } from "react";
import type { KazananKupon } from "@/server/services/race.service";
import { KazananKuponCard, KuponDetailDialog } from "./KazananKuponlarCarousel";

// 2026-09-15 kullanıcı talebi: üye olmayan bir ziyaretçi merak ederse diye, TÜM
// zamanların tutan kuponlarını (yukarıdan aşağı, tarihe göre en yeniden en eskiye —
// getGecmisKazananKuponlar zaten bu sırada döner) sabit bir ızgara olarak gösteren
// sayfa. KazananKuponlarCarousel'in otomatik kayan/tekrar eden şerit mantığını
// KOPYALAMAZ — kart/dialog çiftini oradan yeniden kullanır.
//
// 2026-10-22 kullanıcı talebi: "tutan kuponlarda hafta hafta ayrılsın" — ISO hafta
// (Pazartesi başlangıçlı) başlıklarıyla gruplanır. items zaten tarihe göre en yeniden
// en eskiye sıralı geldiği için (bkz. getGecmisKazananKuponlar) grup sırası da doğal
// olarak korunur, AYRICA bir sıralama yapılmaz.
function haftaBaslangici(d: Date): Date {
  const date = new Date(d);
  const gun = date.getDay(); // 0=Pazar..6=Cumartesi
  const farkPazartesiye = gun === 0 ? -6 : 1 - gun;
  date.setDate(date.getDate() + farkPazartesiye);
  date.setHours(0, 0, 0, 0);
  return date;
}
function haftaEtiketi(haftaBasi: Date): string {
  const haftaSonu = new Date(haftaBasi);
  haftaSonu.setDate(haftaSonu.getDate() + 6);
  const gunAy = (d: Date) => d.toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
  const ayniYil = haftaBasi.getFullYear() === haftaSonu.getFullYear();
  const baslangic = haftaBasi.getMonth() === haftaSonu.getMonth()
    ? String(haftaBasi.getDate())
    : gunAy(haftaBasi);
  return `${baslangic} – ${gunAy(haftaSonu)}${ayniYil ? "" : " " + haftaBasi.getFullYear()} ${haftaSonu.getFullYear()}`;
}

function haftalaraGrupla(items: KazananKupon[]): { anahtar: string; etiket: string; items: KazananKupon[] }[] {
  const gruplar = new Map<string, { etiket: string; items: KazananKupon[] }>();
  for (const k of items) {
    const haftaBasi = haftaBaslangici(k.date);
    const anahtar = haftaBasi.toISOString().slice(0, 10);
    const mevcut = gruplar.get(anahtar);
    if (mevcut) mevcut.items.push(k);
    else gruplar.set(anahtar, { etiket: haftaEtiketi(haftaBasi), items: [k] });
  }
  return [...gruplar.entries()].map(([anahtar, v]) => ({ anahtar, ...v }));
}

export default function TutanKuponlarListesi({ items }: { items: KazananKupon[] }) {
  const [selected, setSelected] = useState<KazananKupon | null>(null);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Henüz isabet sağlayan kupon yok.
      </div>
    );
  }

  const haftalar = haftalaraGrupla(items);

  return (
    <div className="space-y-6">
      {haftalar.map((hafta) => (
        <section key={hafta.anahtar}>
          <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{hafta.etiket}</h2>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {hafta.items.map((k) => (
              <KazananKuponCard key={k.id} k={k} onOpen={() => setSelected(k)} className="w-full shrink" />
            ))}
          </div>
        </section>
      ))}
      <KuponDetailDialog k={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
