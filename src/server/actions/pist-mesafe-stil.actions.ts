"use server";

import { db } from "@/lib/db";
import { analizEtTekYaris, type PaceCheckpoint, type TekYarisStil } from "@/lib/methodology/pace-analizi";
import type { Surface, Breed } from "@prisma/client";

const MIN_ORNEK = 3;

export type PistMesafeStilSonuc = {
  n: number;
  breakdown: { style: TekYarisStil; count: number; percent: number }[];
  topStyle: TekYarisStil;
  topPercent: number;
} | null;

/**
 * Aynı hipodrom+pist+mesafe(±200m)+ırk+koşu tipinde (ör. "1400m Çim İngiliz Satış 3"),
 * Accurace geçmişindeki koşuların KAZANANLARININ (place=1) hangi yarış stiline sahip
 * olduğunu tarar — "bu tip koşularda genelde kaçak atlar mı, geriden gelenler mi
 * kazanıyor" sorusuna cevap. classType/breed bizim kendi Race tablomuzdan geliyor
 * (Accurace'in kendisinde koşu tipi/ırk bilgisi yok) — bu yüzden AccuraceRace,
 * kendi raceId'si üzerinden Race'e join edilerek filtreleniyor. n<3 ise (tek
 * yarıştan kalıcı kural çıkarılmaz ilkesiyle) null döner.
 */
export async function getPistMesafeStilIstatistigi(
  hippodromeName: string,
  surface: Surface,
  distance: number,
  breed: Breed,
  classType: string
): Promise<PistMesafeStilSonuc> {
  const races = await db.race.findMany({
    where: {
      raceDay: { hippodrome: { name: hippodromeName } },
      surface,
      breed,
      classType,
      distance: { gte: distance - 200, lte: distance + 200 },
      accuraceRace: { isNot: null },
    },
    select: {
      accuraceRace: {
        select: {
          length: true,
          splits: { where: { place: 1 }, select: { checkpoints: true }, take: 1 },
        },
      },
    },
  });

  const sayac = { KACAK: 0, ONCU: 0, PRESCI: 0, TAKIPCI: 0, BEKLEYEN: 0 } as Record<TekYarisStil, number>;
  let toplam = 0;
  for (const r of races) {
    const ar = r.accuraceRace;
    const kazanan = ar?.splits[0];
    if (!ar || !kazanan || !ar.length) continue;
    const sonuc = analizEtTekYaris(kazanan.checkpoints as unknown as PaceCheckpoint[], ar.length);
    if (!sonuc) continue;
    sayac[sonuc.stil]++;
    toplam++;
  }

  if (toplam < MIN_ORNEK) return null;

  const breakdown = (Object.entries(sayac) as [TekYarisStil, number][])
    .filter(([, count]) => count > 0)
    .map(([style, count]) => ({ style, count, percent: Math.round((count / toplam) * 100) }))
    .sort((a, b) => b.count - a.count);

  return { n: toplam, breakdown, topStyle: breakdown[0].style, topPercent: breakdown[0].percent };
}
