// Gerçekleştirilen tur talimatı: FORM + HIZ + SINIF ailelerinin BİRLİKTE ürettiği
// gerekçeli değerlendirme — SHIMMER vs SECRET OF DRAGON, İstanbul 2026-10-16 Koşu 1.
// Yalnız gerçek DB verisi kullanılır, hiçbir sayı uydurulmaz.

import { db } from "@/lib/db";
import { computeFormLevel, computeFormTrend, computeLayoff } from "@/lib/motor-v1/features/form";
import { computeSinifLevel, computeRaceClassStrength } from "@/lib/motor-v1/features/sinif";
import { computeSpeedRatingForRace } from "@/lib/motor-v1/features/hiz";
import { createFieldSizeResolver } from "@/lib/motor-v1/features/history-source";
import { PLACEHOLDER_HALF_LIFE_DAYS } from "@/lib/motor-v1/features/common";

const RACE_ID = "cmv92m7yh003x06jnunvw8ydp"; // İstanbul 2026-10-16 Koşu 1
const CUTOFF = new Date("2026-10-16T00:00:00.000Z");

async function reportHorse(tjkAtId: number, no: number, name: string, classStrengthCache: Map<string, Promise<any>>) {
  const cache = await db.horseRaceHistoryCache.findUnique({ where: { tjkAtId } });
  const rowsJson = cache?.rowsJson ?? [];
  const resolver = createFieldSizeResolver();

  const [form01, form02, form03, sinif] = await Promise.all([
    computeFormLevel(tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
    computeFormTrend(tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
    computeLayoff(tjkAtId, rowsJson, CUTOFF),
    computeSinifLevel(tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, classStrengthCache),
  ]);

  const todayStrength = await computeRaceClassStrength(RACE_ID, tjkAtId);

  return { no, name, tjkAtId, form01, form02, form03, sinif, todayStrength };
}

async function main() {
  const hizMap = await computeSpeedRatingForRace(RACE_ID);
  const classStrengthCache = new Map<string, Promise<any>>();

  const shimmer = await reportHorse(113531, 1, "SHIMMER", classStrengthCache);
  const secret = await reportHorse(114202, 5, "SECRET OF DRAGON", classStrengthCache);

  for (const h of [shimmer, secret]) {
    console.log("\n==============================");
    console.log(`${h.name} (no=${h.no}, tjkAtId=${h.tjkAtId})`);
    console.log("------------------------------");
    console.log("HIZ_01 (bugünkü yarış, point-in-time):", hizMap.get(h.no));
    console.log("FORM_01 (son 5 R, zaman-ağırlıklı):", {
      value: h.form01.value,
      observationCount: h.form01.observationCount,
      highConfidenceCount: h.form01.highConfidenceCount,
      skippedUnknownFieldSize: h.form01.skippedUnknownFieldSize,
      totalHistoryRows: h.form01.totalHistoryRows,
      coverageState: h.form01.coverageState,
    });
    console.log("FORM_02 (trend, son2-önceki3):", {
      value: h.form02.value,
      observationCount: h.form02.observationCount,
      coverageState: h.form02.coverageState,
    });
    console.log("FORM_03 (dinlenme, log(1+gün)):", {
      value: h.form03.value,
      coverageState: h.form03.coverageState,
    });
    console.log("SINIF_01 (leave-one-out rakip kalitesi geçmişi):", {
      rawValue: h.sinif.rawValue,
      value: h.sinif.value,
      observationCount: h.sinif.observationCount,
      totalHistoryRows: h.sinif.totalHistoryRows,
      coverageState: h.sinif.coverageState,
    });
    console.log("SINIF_02 girdisi — bugünkü yarışın C_{r,-i} (bu at HARİÇ):", h.todayStrength);
  }

  console.log("\n==============================");
  console.log("BİRLEŞİK GEREKÇE");
  console.log("------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
