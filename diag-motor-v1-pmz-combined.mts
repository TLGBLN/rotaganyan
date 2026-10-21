// Birleşik çıktı (kullanıcı talimatı §6): At / Form / Hız / Sınıf / Zemin uyumu /
// Mesafe uyumu / Hipodrom uyumu — gerçek bir yarış için, gerçek verilerle.

import { db } from "@/lib/db";
import { computeFormLevel, computeFormTrend, computeLayoff } from "@/lib/motor-v1/features/form";
import { computeSinifLevel } from "@/lib/motor-v1/features/sinif";
import { computeSpeedRatingForRace } from "@/lib/motor-v1/features/hiz";
import { createFieldSizeResolver } from "@/lib/motor-v1/features/history-source";
import { PLACEHOLDER_HALF_LIFE_DAYS } from "@/lib/motor-v1/features/common";
import {
  computePmzZeminUyumu,
  computePmzMesafeUyumu,
  computePmzHipodromUyumu,
  computePmzZeminMesafeDeneyim,
  createRaceContextCache,
} from "@/lib/motor-v1/features/pmz";
import { parseSurface } from "@/lib/motor-v1/features/surface-classifier";

const RACE_ID = "cmv92m7yh003x06jnunvw8ydp"; // İstanbul 2026-10-16 Koşu 1
const CUTOFF = new Date("2026-10-16T00:00:00.000Z");

async function main() {
  const race = await db.race.findUnique({
    where: { id: RACE_ID },
    select: { surface: true, distance: true, raceDay: { select: { hippodrome: { select: { name: true } } } } },
  });
  if (!race) throw new Error("yarış bulunamadı");
  const targetSurface = race.surface; // CIM | KUM | SENTETIK (Prisma enum)
  const targetDistance = race.distance;
  const targetCity = race.raceDay.hippodrome.name;
  console.log(`Bugünkü yarış: ${targetCity}, ${targetDistance}m, zemin=${targetSurface}`);

  const hizMap = await computeSpeedRatingForRace(RACE_ID);
  const raceContextCache = createRaceContextCache();
  const classStrengthCache = new Map<string, Promise<any>>();

  const horses = [
    { tjkAtId: 113531, no: 1, name: "SHIMMER" },
    { tjkAtId: 114202, no: 5, name: "SECRET OF DRAGON" },
  ];

  for (const h of horses) {
    const cache = await db.horseRaceHistoryCache.findUnique({ where: { tjkAtId: h.tjkAtId } });
    const rowsJson = cache?.rowsJson ?? [];
    const resolver = createFieldSizeResolver();

    const [form01, form02, form03, sinif01, pmz01, pmz02, pmz03, pmz04] = await Promise.all([
      computeFormLevel(h.tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
      computeFormTrend(h.tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
      computeLayoff(h.tjkAtId, rowsJson, CUTOFF),
      computeSinifLevel(h.tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, classStrengthCache),
      computePmzZeminUyumu(h.tjkAtId, targetSurface, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, raceContextCache, classStrengthCache),
      computePmzMesafeUyumu(h.tjkAtId, targetDistance, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, raceContextCache),
      computePmzHipodromUyumu(h.tjkAtId, targetCity, targetSurface, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, raceContextCache),
      computePmzZeminMesafeDeneyim(h.tjkAtId, targetSurface, targetDistance, rowsJson, CUTOFF),
    ]);

    console.log("\n==============================");
    console.log(`${h.name} (no=${h.no})`);
    console.log("------------------------------");
    console.log("HIZ_01 (bugün):", hizMap.get(h.no));
    console.log("FORM_01:", { value: form01.value, n: form01.observationCount, coverage: form01.coverageState });
    console.log("FORM_02 (trend):", { value: form02.value, coverage: form02.coverageState });
    console.log("FORM_03 (dinlenme gün~):", { value: form03.value, days: form03.value != null ? Math.round(Math.exp(form03.value) - 1) : null });
    console.log("SINIF_01:", { rawValue: sinif01.rawValue, value: sinif01.value, n: sinif01.observationCount, coverage: sinif01.coverageState });
    console.log("PMZ_01 zeminUyumu:", {
      rawValue: pmz01.rawValue,
      value: pmz01.value,
      sameN: pmz01.observationCount,
      otherN: pmz01.comparisonCount,
      coverage: pmz01.coverageState,
      sameSurfaceRivalQuality: pmz01.targetGroupCompetitorQuality,
      otherSurfaceRivalQuality: pmz01.comparisonGroupCompetitorQuality,
    });
    console.log("PMZ_02 mesafeUyumu:", {
      rawValue: pmz02.rawValue,
      value: pmz02.value,
      n_eff: pmz02.effectiveObservationCount,
      coverage: pmz02.coverageState,
    });
    console.log("PMZ_03 hipodromUyumu (zemin sabit):", {
      rawValue: pmz03.rawValue,
      value: pmz03.value,
      sameN: pmz03.observationCount,
      otherN: pmz03.comparisonCount,
      coverage: pmz03.coverageState,
    });
    console.log("PMZ_04 zeminMesafeDeneyim (başarı İÇERMEZ):", {
      rawEffectiveCount: pmz04.rawEffectiveCount,
      value: pmz04.value,
      coverage: pmz04.coverageState,
    });

    // Zemin dağılımını da göster — gerekçeli yorum için
    const rows = Array.isArray(rowsJson) ? (rowsJson as any[]) : [];
    const surfaceDist = new Map<string, number>();
    for (const r of rows) {
      const fam = parseSurface(r.surface).surfaceFamily ?? "UNKNOWN";
      surfaceDist.set(fam, (surfaceDist.get(fam) ?? 0) + 1);
    }
    console.log("Geçmiş zemin dağılımı:", Object.fromEntries(surfaceDist));
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
