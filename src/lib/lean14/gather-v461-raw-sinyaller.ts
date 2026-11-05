/**
 * RotaGanyan LEAN14: 3 read-only raw signals; not part of V5.46.1 scoring.
 * No Prediction/Pick writes, no live AGF sync, no post-race result of target race.
 * Historical DB rows are mutable: PIT provenance is NOT proven by this adapter.
 */
import { db } from "@/lib/db";
import { computeJockeyOE30 } from "./formulas/jockey-oe30";
import { computeFormZeminEtkilesimi } from "./formulas/pmz";
import { computeSinifLevel } from "./formulas/sinif";
import { loadLean14StableSpeed, stableSpeedForRunner } from "./formulas/stable-speed";
import { computeRakGapForRace } from "./formulas/rak-rakip-gucu";
import { createFieldSizeResolver } from "./formulas/history-source";
import { PLACEHOLDER_HALF_LIFE_DAYS } from "./formulas/common";

export const LEAN14_CAPTURE_KEYS = ["JOCKEY_OE30", "SURFACE_FORM", "RIVAL_GAP"] as const;
export type Lean14ThreeKey = typeof LEAN14_CAPTURE_KEYS[number];
export type Lean14RawSignal = { rawValue: number | null; observed: boolean; sampleCount: number; missingReason: string | null };
export type Lean14ThreeHorse = { no: number; runnerId: string; signals: Record<Lean14ThreeKey, Lean14RawSignal> };
export type Lean14ThreeRace = {
  raceId: string;
  cutoff: string;
  sourceStatus: "CURRENT_DB_PIT_NOT_PROVEN";
  referenceFormulaParity: "SOURCE_FORMULA_ALIGNED_PIT_UNPROVEN";
  horses: Lean14ThreeHorse[];
};

const missing = (reason: string): Lean14RawSignal => ({ rawValue: null, observed: false, sampleCount: 0, missingReason: reason });
const asSignal = (value: number | null, n: number, reason: string): Lean14RawSignal =>
  value !== null && Number.isFinite(value)
    ? { rawValue: value, observed: true, sampleCount: n, missingReason: null }
    : missing(reason);

/**
 * Data only, research-only. Same-day past jockey mounts excluded conservatively.
 * This never calls scoreV461 or gathers AGF and never mutates published outputs.
 */
export async function gatherV461RawSinyaller(raceId: string): Promise<Lean14ThreeRace> {
  if (!raceId) throw new Error("LEAN14_RACE_ID_REQUIRED");
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      surface: true, breed: true,
      raceDay: { select: { date: true } },
      runners: {
        where: { scratched: false }, orderBy: { no: "asc" },
        select: { id: true, no: true, tjkAtId: true, jockey: true },
      },
    },
  });
  if (!race || race.runners.length < 2) throw new Error("LEAN14_RACE_FIELD_NOT_FOUND");
  const cutoff = race.raceDay.date;
  if (!Number.isFinite(cutoff.getTime())) throw new Error("LEAN14_RACE_DATE_INVALID");
  if (new Set(race.runners.map(r => r.no)).size !== race.runners.length) throw new Error("LEAN14_DUPLICATE_NO");

  const ids = [...new Set(race.runners.map(r => r.tjkAtId).filter((id): id is number => id !== null))];
  const histories = ids.length ? await db.horseRaceHistoryCache.findMany({
    where: { tjkAtId: { in: ids } }, select: { tjkAtId: true, rowsJson: true },
  }) : [];
  const historyMap = new Map(histories.map(h => [h.tjkAtId, h.rowsJson]));
  const resolver = createFieldSizeResolver();
  const classStrengthCache = new Map();
  const stableSpeed = await loadLean14StableSpeed();

  // Compute per horse, reusing as-of class-reference cache and field-size resolver.
  const firstPass = await Promise.all(race.runners.map(async runner => {
    const rows = runner.tjkAtId === null ? [] : (historyMap.get(runner.tjkAtId) ?? []);
    const [j, surface, cls] = await Promise.all([
      computeJockeyOE30(runner.jockey, cutoff),
      computeFormZeminEtkilesimi(runner.tjkAtId, race.surface, rows, cutoff, PLACEHOLDER_HALF_LIFE_DAYS, resolver),
      computeSinifLevel(runner.tjkAtId, rows, cutoff, PLACEHOLDER_HALF_LIFE_DAYS, resolver, classStrengthCache),
    ]);
    const speed = stableSpeedForRunner(stableSpeed, runner.tjkAtId, race.breed, cutoff);
    return { runner, j, surface, cls, speed };
  }));

  // RIVAL_GAP = (observed HIZ_01 + observed SINIF_01) - strongest OTHER observed rival.
  const gaps = computeRakGapForRace(firstPass.map(x => ({
    no: x.runner.no,
    hiz01: x.speed?.observed ? (x.speed.value ?? null) : null,
    hiz01Observed: x.speed?.observed === true,
    sinif01: x.cls.value,
    sinif01Observed: x.cls.value !== null,
  })));

  const horses: Lean14ThreeHorse[] = firstPass.map(x => {
    const gap = gaps.get(x.runner.no);
    if (!gap) throw new Error("LEAN14_RIVAL_GAP_MISSING_RUNNER");
    return {
      runnerId: x.runner.id,
      no: x.runner.no,
      signals: {
        JOCKEY_OE30: asSignal(x.j.rawValue, x.j.sampleCount, x.j.missingReason ?? "NO_JOCKEY_DATA"),
        SURFACE_FORM: asSignal(x.surface.value, x.surface.observationCount, x.surface.coverageState),
        RIVAL_GAP: asSignal(gap.observed ? gap.rawValue : null, x.cls.observationCount, gap.missingReason ?? "NO_RIVAL_COMPARISON"),
      },
    };
  });

  return {
    raceId, cutoff: cutoff.toISOString(),
    sourceStatus: "CURRENT_DB_PIT_NOT_PROVEN",
    referenceFormulaParity: "SOURCE_FORMULA_ALIGNED_PIT_UNPROVEN",
    horses,
  };
}
