"use server";

import { db } from "@/lib/db";
import { analizEtTekYaris, type PaceCheckpoint, type TekYarisStil } from "@/lib/methodology/pace-analizi";
import type { Surface } from "@prisma/client";

const MIN_ORNEK = 3;

export type PistMesafeStilSonuc = {
  n: number;
  breakdown: { style: TekYarisStil; count: number; percent: number }[];
  topStyle: TekYarisStil;
  topPercent: number;
} | null;

/**
 * Aynı hipodrom+pist+mesafe(±200m)'de (ırk/koşu tipi şartı YOK — kullanıcı talebiyle
 * kaldırıldı, örneklem çok dar kalıp "yeterli veri yok" mesajını neredeyse her koşuda
 * gösteriyordu), Accurace geçmişindeki koşuların KAZANANLARININ (place=1) hangi yarış
 * stiline sahip olduğunu tarar — "bu pist+mesafede genelde kaçak atlar mı, geriden
 * gelenler mi kazanıyor" sorusuna cevap. n<3 ise (tek yarıştan kalıcı kural çıkarılmaz
 * ilkesiyle) null döner.
 */
export async function getPistMesafeStilIstatistigi(
  hippodromeName: string,
  surface: Surface,
  distance: number
): Promise<PistMesafeStilSonuc> {
  const races = await db.race.findMany({
    where: {
      raceDay: { hippodrome: { name: hippodromeName } },
      surface,
      distance: { gte: distance - 200, lte: distance + 200 },
      accuraceRace: { isNot: null },
    },
    select: {
      accuraceRace: {
        select: {
          length: true,
          splits: { where: { place: 1 }, select: { checkpoints: true }, take: 1 },
          _count: { select: { splits: true } },
        },
      },
    },
  });

  const sayac = { KACAK_AT: 0, ON_GRUP_ARKASI: 0, BEKLEME_GRUBU: 0, EN_GERI_TAKIP: 0 } as Record<TekYarisStil, number>;
  let toplam = 0;
  for (const r of races) {
    const ar = r.accuraceRace;
    const kazanan = ar?.splits[0];
    if (!ar || !kazanan || !ar.length) continue;
    const sonuc = analizEtTekYaris(kazanan.checkpoints as unknown as PaceCheckpoint[], ar.length, ar._count.splits);
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
