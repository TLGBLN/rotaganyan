import {
  parsePistRejimi,
  type PistYuzeyi,
  type PistRejimi,
} from "./pist-durum-01";

export type HistoricalGoingPerformance = {
  raceDate: string;
  surface: PistYuzeyi;
  going: string | null;
  finishPosition: number;
  fieldSize: number;
};

export type GoingTarget = {
  raceStart: string;
  surface: PistYuzeyi;
  going: string | null;
  goingCapturedAt: string | null;
  immutablePreRaceSnapshot: boolean;
};

export type GoingScoreResult = {
  value: number | null;
  reason: string;
  regime: PistRejimi | null;
  sameCount: number;
  otherCount: number;
  rawDelta: number | null;
};

export function computePistDurum01(
  target: GoingTarget,
  history: HistoricalGoingPerformance[],
  halfLifeDays = 180
): GoingScoreResult {
  const regime = parsePistRejimi(target.going);

  const result = (
    reason: string,
    sameCount = 0,
    otherCount = 0,
    rawDelta: number | null = null,
    value: number | null = null
  ): GoingScoreResult => ({
    value,
    reason,
    regime,
    sameCount,
    otherCount,
    rawDelta,
  });

  const start = Date.parse(target.raceStart);
  const captured = target.goingCapturedAt == null
    ? NaN
    : Date.parse(target.goingCapturedAt);

  if (
    !Number.isFinite(start) ||
    !Number.isFinite(captured) ||
    !target.immutablePreRaceSnapshot ||
    captured >= start
  ) {
    return result("TARGET_NOT_PIT_VERIFIED");
  }

  if (regime == null) {
    return result("TARGET_GOING_UNKNOWN");
  }

  if (!Number.isFinite(halfLifeDays) || halfLifeDays <= 0) {
    return result("INVALID_HALF_LIFE");
  }

  const cutoffDay = new Date(start).toISOString().slice(0, 10);

  const same: { value: number; weight: number }[] = [];
  const other: { value: number; weight: number }[] = [];

  for (const row of history) {
    if (row.surface !== target.surface) continue;

    const rowRegime = parsePistRejimi(row.going);
    if (rowRegime == null) continue;

    const timestamp = Date.parse(row.raceDate);
    if (!Number.isFinite(timestamp)) continue;

    // Aynı gün ve sonraki tüm yarışları dışla.
    const rowDay = new Date(timestamp).toISOString().slice(0, 10);
    if (rowDay >= cutoffDay) continue;

    if (
      !Number.isInteger(row.fieldSize) ||
      row.fieldSize < 2 ||
      !Number.isInteger(row.finishPosition) ||
      row.finishPosition < 1 ||
      row.finishPosition > row.fieldSize
    ) continue;

    // Birincilik 1, sonunculuk 0.
    const performance =
      (row.fieldSize - row.finishPosition) /
      (row.fieldSize - 1);

    const days = (start - timestamp) / 86400000;
    const weight = Math.exp(
      -Math.LN2 * days / halfLifeDays
    );

    const point = { value: performance, weight };

    if (rowRegime === regime) {
      same.push(point);
    } else {
      other.push(point);
    }
  }

  if (same.length < 2 || other.length < 2) {
    return result(
      "INSUFFICIENT_COMPARISON",
      same.length,
      other.length
    );
  }

  const average = (
    points: { value: number; weight: number }[]
  ): number => {
    const total = points.reduce((s, p) => s + p.weight, 0);
    return points.reduce(
      (s, p) => s + p.value * p.weight, 0
    ) / total;
  };

  const delta = average(same) - average(other);

  // Az sayıda karşılaştırmada etkiyi sıfıra yaklaştır.
  // K=5 araştırma parametresi; nihai seçim eğitimde yapılmalı.
  const effectiveN =
    (same.length * other.length) /
    (same.length + other.length);

  const shrinkage = effectiveN / (effectiveN + 5);

  return result(
    "OBSERVED",
    same.length,
    other.length,
    delta,
    delta * shrinkage
  );
}