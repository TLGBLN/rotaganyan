import { db } from "@/lib/db";
import { computeFormLevel, computeFormTrend, computeLayoff } from "@/lib/motor-v1/features/form";
import { computeSinifLevel } from "@/lib/motor-v1/features/sinif";
import { computeSpeedRatingForRace } from "@/lib/motor-v1/features/hiz";
import { createFieldSizeResolver } from "@/lib/motor-v1/features/history-source";
import { PLACEHOLDER_HALF_LIFE_DAYS } from "@/lib/motor-v1/features/common";
import { computePmzZeminUyumu, computePmzMesafeUyumu, createRaceContextCache, computeFormZeminEtkilesimi } from "@/lib/motor-v1/features/pmz";
import {
  loadTempoContext,
  computeTempoLiderlikEgilimi,
  computeTempoRakipBaskisi,
  computeTempoTekLiderGostergesi,
  computeTempoUyum,
} from "@/lib/motor-v1/features/tempo";
import type { TargetRace } from "@/lib/accurace/types";

const RACE_ID = "cmv92m7yh003x06jnunvw8ydp"; // İstanbul 2026-10-16 Koşu 1
const CUTOFF = new Date("2026-10-16T00:00:00.000Z");

async function main() {
  const race = await db.race.findUnique({
    where: { id: RACE_ID },
    select: { surface: true, distance: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) throw new Error("yarış bulunamadı");
  const target: TargetRace = { date: race.raceDay.date, length: race.distance, surface: race.surface };

  const allRunners = await db.runner.findMany({ where: { raceId: RACE_ID, scratched: false }, select: { no: true, tjkAtId: true, name: true } });
  console.log(`Saha (${allRunners.length} at):`, allRunners.map((r) => `${r.no}:${r.name}`).join(", "));

  const hizMap = await computeSpeedRatingForRace(RACE_ID);
  const raceContextCache = createRaceContextCache();
  const classStrengthCache = new Map<string, Promise<any>>();
  const tempoCtx = await loadTempoContext();

  const horses = [
    { tjkAtId: 113531, no: 1, name: "SHIMMER" },
    { tjkAtId: 114202, no: 5, name: "SECRET OF DRAGON" },
  ];

  for (const h of horses) {
    const cache = await db.horseRaceHistoryCache.findUnique({ where: { tjkAtId: h.tjkAtId } });
    const rowsJson = cache?.rowsJson ?? [];
    const resolver = createFieldSizeResolver();
    const rivals = allRunners.filter((r) => r.no !== h.no).map((r) => r.tjkAtId);

    const [form01, form02, sinif01, pmz01, pmz02, formZemin] = await Promise.all([
      computeFormLevel(h.tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
      computeFormTrend(h.tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
      computeSinifLevel(h.tjkAtId, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, classStrengthCache),
      computePmzZeminUyumu(h.tjkAtId, race.surface, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, raceContextCache, classStrengthCache),
      computePmzMesafeUyumu(h.tjkAtId, race.distance, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver, raceContextCache),
      computeFormZeminEtkilesimi(h.tjkAtId, race.surface, rowsJson, CUTOFF, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
    ]);

    const tempo01 = computeTempoLiderlikEgilimi(h.tjkAtId, target, tempoCtx);
    const tempo02 = computeTempoRakipBaskisi(rivals, target, tempoCtx);
    const tempo03 = computeTempoTekLiderGostergesi(h.tjkAtId, rivals, target, tempoCtx);
    const tempo04 = computeTempoUyum(h.tjkAtId, rivals, target, tempoCtx);

    console.log("\n==============================");
    console.log(`${h.name} (no=${h.no})`);
    console.log("------------------------------");
    console.log("HIZ_01:", hizMap.get(h.no));
    console.log("FORM_01:", { value: form01.value, n: form01.observationCount, coverage: form01.coverageState });
    console.log("FORM_02 trend:", { value: form02.value, coverage: form02.coverageState });
    console.log("SINIF_01:", { raw: sinif01.rawValue, value: sinif01.value, coverage: sinif01.coverageState });
    console.log("PMZ_01 zeminUyumu (HIZ-tabanlı):", { raw: pmz01.rawValue, value: pmz01.value, sameN: pmz01.observationCount, coverage: pmz01.coverageState });
    console.log("FORM×ZEMİN (R-tabanlı, PMZ_01'den BAĞIMSIZ metrik):", { value: formZemin.value, n: formZemin.observationCount, coverage: formZemin.coverageState });
    console.log("PMZ_02 mesafeUyumu:", { raw: pmz02.rawValue, value: pmz02.value, n_eff: pmz02.effectiveObservationCount, coverage: pmz02.coverageState });
    console.log("TEMPO_01 liderlikEgilimi:", {
      vec: tempo01.vec?.map((v) => Number(v.toFixed(3))),
      leadProb: tempo01.leadTendency,
      frontGroupProb: tempo01.frontGroupTendency,
      pastRuns: tempo01.pastRunCount,
      effectiveN: tempo01.effectiveN,
      reliability: tempo01.reliability,
      coverage: tempo01.coverageState,
    });
    console.log("TEMPO_02 rakipBaskisi (bu ata göre, kendisi HARİÇ):", tempo02);
    console.log("TEMPO_03 tekLiderOlasiligi:", tempo03);
    console.log("TEMPO_04 tempoUyum:", {
      closerPressureFit: tempo04.closerPressureFit,
      lateSegSpeed: tempo04.lateSegmentSpeed,
      coverage: tempo04.coverageState,
    });
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
