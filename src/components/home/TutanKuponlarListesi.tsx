"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { tr, enUS } from "date-fns/locale";
import type { KazananKupon } from "@/server/services/race.service";
import { KazananKuponCard, KuponDetailDialog } from "./KazananKuponlarCarousel";
import { useLocaleSwitch } from "@/components/providers/LocaleProvider";
import { toWallClockInTz, TZ } from "@/lib/tz";

// 2026-09-15 kullanıcı talebi: üye olmayan bir ziyaretçi merak ederse diye, TÜM
// zamanların tutan kuponlarını (yukarıdan aşağı, tarihe göre en yeniden en eskiye —
// getGecmisKazananKuponlar zaten bu sırada döner) sabit bir ızgara olarak gösteren
// sayfa. KazananKuponlarCarousel'in otomatik kayan/tekrar eden şerit mantığını
// KOPYALAMAZ — kart/dialog çiftini oradan yeniden kullanır.
//
// 2026-09-21 kullanıcı talebi: liste uzadıkça taranması zorlaştığı için haftalık
// (Pazartesi–Pazar) periyot başlıkları altında gruplandı — formatDate ailesinin AYNI
// "TR=Türkiye duvar saati, EN=UTC" kuralı (bkz. utils.ts notu) hafta sınırı hesabına da
// uygulanıyor, TR/EN aynı öğeyi farklı haftaya düşürmesin diye.
function weekStartKey(date: Date, tzOrUtc: string): string {
  const wall = toWallClockInTz(date, tzOrUtc);
  const gun = (wall.getUTCDay() + 6) % 7; // Pazartesi=0 ... Pazar=6
  const pazartesi = new Date(wall);
  pazartesi.setUTCDate(wall.getUTCDate() - gun);
  return pazartesi.toISOString().slice(0, 10);
}

export default function TutanKuponlarListesi({ items }: { items: KazananKupon[] }) {
  const [selected, setSelected] = useState<KazananKupon | null>(null);
  const { locale } = useLocaleSwitch();
  const dfLocale = locale === "tr" ? tr : enUS;
  const tzOrUtc = locale === "tr" ? TZ : "UTC";

  const haftalar = useMemo(() => {
    const gruplar = new Map<string, { pazartesi: Date; items: KazananKupon[] }>();
    for (const k of items) {
      const key = weekStartKey(k.date, tzOrUtc);
      if (!gruplar.has(key)) gruplar.set(key, { pazartesi: new Date(`${key}T00:00:00Z`), items: [] });
      gruplar.get(key)!.items.push(k);
    }
    // items zaten tarihe göre en yeniden en eskiye geldiği için Map ekleme sırası korunur.
    return [...gruplar.values()];
  }, [items, tzOrUtc]);

  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
        Henüz isabet sağlayan kupon yok.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {haftalar.map(({ pazartesi, items: haftaKuponlari }) => {
        const pazar = new Date(pazartesi);
        pazar.setUTCDate(pazartesi.getUTCDate() + 6);
        const aynıAy = pazartesi.getUTCMonth() === pazar.getUTCMonth() && pazartesi.getUTCFullYear() === pazar.getUTCFullYear();
        const baslangic = format(pazartesi, aynıAy ? "d" : "d MMM", { locale: dfLocale });
        const bitis = format(pazar, "d MMM yyyy", { locale: dfLocale });
        const label = `${baslangic}–${bitis}`;

        return (
          <div key={pazartesi.toISOString()}>
            <h2 className="mb-2 text-sm font-semibold text-muted-foreground">{label}</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {haftaKuponlari.map((k) => (
                <KazananKuponCard key={k.id} k={k} onOpen={() => setSelected(k)} className="w-full shrink" />
              ))}
            </div>
          </div>
        );
      })}
      <KuponDetailDialog k={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
