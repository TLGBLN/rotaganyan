"use server";

import { db } from "@/lib/db";

// Aynı örneklem eşiği (bkz. sire-stat-match.ts OWN_MIN_ORNEK) — az start'lı bir antrenör
// için "%100" veya "%0" gibi uç değerler yanıltıcı olur.
const MIN_ORNEK = 3;

export type TrainerEquipmentOzetSonuc = { ozet: string | null };

/**
 * Antrenörün ekipman-değişikliği geçmişindeki kazanma oranı (bkz. TrainerEquipmentStatOwn,
 * trainer-equipment-own-stat.service.ts) — trainerNames ile AYNI SIRADA. İsim eşleştirmesi
 * BİREBİR: hem bu tablo hem bugünkü Runner.trainer aynı ingest pipeline'ından geliyor
 * (TJK sync'in fuzzy eşleştirmesine ihtiyaç yok, bkz. race.service.ts getTrainerStats).
 */
export async function getTrainerEquipmentOwnStatForRace(trainerNames: (string | null)[]): Promise<TrainerEquipmentOzetSonuc[]> {
  const names = [...new Set(trainerNames.filter((n): n is string => !!n))];
  if (names.length === 0) return trainerNames.map(() => ({ ozet: null }));

  const pool = await db.trainerEquipmentStatOwn.findMany({ where: { trainer: { in: names } } });
  const map = new Map(pool.map((r) => [r.trainer, r]));

  return trainerNames.map((name) => {
    const s = name ? map.get(name) : undefined;
    if (!s || s.degisimStart < MIN_ORNEK) return { ozet: null };
    return {
      ozet: `${s.trainer} — ekipman/takı değişikliği yaptığı start'larda kendi verimiz: ${s.degisimStart} start, K% ${s.degisimKYuzde} (${s.degisimBirinci}/${s.degisimStart})`,
    };
  });
}
