// RAN v1.0 — TAM bagimsiz kabul veri kumesi icin DB'siz, fail-closed rapor.
// Gelistirme holdout'unu bagimsiz kabul gibi sunmaz. Gecersiz yarislar sessizce atilmaz.
// Skor, sinyal katkisi, RCA ve kalibrasyon AYNI canonical modelin kayitli vektorlerindendir.
import type { FittedModel } from "@/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";
import { analyzeStoredAcceptanceRace } from "./acceptance-vector-rca";

export type AcceptanceRaceRow = {
  raceId: string;
  tarih: string;
  winnerNo: number | null;
  vectors: RunnerFeatureVector[];
};

export type AcceptanceModelMeta = {
  engineVersion: string;
  trainedAt: string;
  weightsFingerprint: string;
  trainDateRange: readonly string[];
  holdoutDateRange: readonly string[];
  nRacesTrain: number;
  nRacesHoldout: number;
};

export type RaceFinding = {
  raceId: string;
  date: string;
  winnerNo: number;
  winnerName: string;
  fieldSize: number;
  rank: number;
  probability: number;
  top1Rival: string | null;
  top3Rival: string | null;
  categoryTop1: string | null;
  categoryTop3: string | null;
  top1Drivers: { code: string; delta: number }[];
  top3Drivers: { code: string; delta: number }[];
  positiveSignals: { code: string; contribution: number }[];
  source: "ACCEPTANCE_VECTORS";
  preRaceProvenance: "UNVERIFIED";
  alternativeSignals: "NOT_VERIFIED";
};

export type FinalAcceptanceReport = {
  dataGate: "PASS_DATA_ONLY" | "BLOCKED";
  publicationGate: "NOT_VERIFIED";
  input: {
    total: number;
    evaluated: number;
    rejected: number;
    required: number;
    firstDate: string | null;
    lastDate: string | null;
    developmentHoldoutEnd: string;
  };
  identity: {
    engineVersion: string;
    trainedAt: string;
    weightsFingerprint: string;
    trainingRaces: number;
    developmentHoldoutRaces: number;
  };
  verification: {
    modelVsAcceptanceChronology: "PASS" | "FAILED";
    preRaceSnapshotProvenance: "NOT_VERIFIED";
    dataCollectionIndependence: "NOT_VERIFIED";
    liveRecomputeParity: "NOT_VERIFIED";
    alternativeDvsV1: "NOT_VERIFIED";
    agfComparison: "NOT_VERIFIED";
    couponRoi: "NOT_VERIFIED";
  };
  metrics: null | {
    top1: number;
    top3: number;
    top6Diagnostic: number;
    top1Hits: number;
    top3Hits: number;
    meanWinnerRank: number;
    meanFieldSize: number;
    meanLogLoss: number;
    equalProbabilityLogLoss: number;
    multiclassBrier: number;
    top1EqualProbabilityReference: number;
    top3EqualProbabilityReference: number;
    calibrationEce: number;
    calibration: {
      bucket: number; n: number; minP: number; maxP: number;
      meanPredicted: number; actualFrequency: number;
    }[];
  };
  top1MissCategories: Record<string, number>;
  top3MissCategories: Record<string, number>;
  rejected: { raceId: string; reason: string }[];
  races: RaceFinding[];
  notes: string[];
};

// Tarih kontrolu olmadan "kronolojik bagimsiz" denemez. ISO ve DD.MM.YYYY kabul edilir.
export function acceptanceDay(value: string): string | null {
  const raw = String(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T.*)?$/.exec(raw);
  const tr = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(raw);
  const y = iso ? iso[1] : tr?.[3];
  const m = iso ? iso[2] : tr?.[2];
  const d = iso ? iso[3] : tr?.[1];
  if (!y || !m || !d) return null;
  const date = new Date(Date.UTC(Number(y), Number(m) - 1, Number(d)));
  const canonical = [y, m, d].join("-");
  return date.toISOString().slice(0, 10) === canonical ? canonical : null;
}

export function computeFinalAcceptanceReport(
  rows: readonly AcceptanceRaceRow[],
  model: FittedModel<string>,
  meta: AcceptanceModelMeta,
  minRaces = 60
): FinalAcceptanceReport {
  if (!Number.isSafeInteger(minRaces) || minRaces < 60) throw new Error("RAN_FINAL_MIN_RACES_MUST_BE_AT_LEAST_60");
  const cutoff = acceptanceDay(meta.holdoutDateRange[1] ?? "");
  if (!cutoff) throw new Error("RAN_FINAL_MODEL_HOLDOUT_END_INVALID");
  const rejected: FinalAcceptanceReport["rejected"] = [];
  const races: RaceFinding[] = [];
  const seen = new Set<string>();
  const dates: string[] = [];
  const calibrationPoints: { p: number; win: 0 | 1 }[] = [];
  const categories1: Record<string, number> = {};
  const categories3: Record<string, number> = {};
  let top1Hits = 0;
  let top3Hits = 0;
  let top6Hits = 0;
  let rankSum = 0;
  let fieldSum = 0;
  let logLossSum = 0;
  let equalLogLossSum = 0;
  let brierSum = 0;

  for (const row of rows) {
    const raceId = typeof row?.raceId === "string" ? row.raceId : "(missing-raceId)";
    const date = acceptanceDay(row?.tarih ?? "");
    let reason: string | null = null;
    if (!raceId || raceId === "(missing-raceId)") reason = "INVALID_RACE_ID";
    else if (!date) reason = "INVALID_DATE";
    else if (date <= cutoff) reason = "NOT_AFTER_DEV_HOLDOUT";
    else if (seen.has(raceId)) reason = "DUPLICATE_RACE_ID";
    else if (!Number.isSafeInteger(row?.winnerNo) || (row.winnerNo ?? 0) < 1) reason = "WINNER_NOT_VERIFIED";
    else if (!Array.isArray(row?.vectors) || row.vectors.length < 3) reason = "FIELD_TOO_SMALL";
    else if (!row.vectors.every((v) => v != null && typeof v === "object" &&
        typeof v.raceId === "string" && typeof v.name === "string" &&
        Array.isArray(v.signals) && v.signals.every((sig) =>
          sig != null && typeof sig === "object" && typeof sig.code === "string"))) {
      reason = "MALFORMED_RUNNER_RECORD";
    }
    seen.add(raceId);
    if (reason) { rejected.push({ raceId, reason }); continue; }
    const result = analyzeStoredAcceptanceRace(raceId, row.winnerNo!, row.vectors, model);
    if (result.status !== "OK") {
      rejected.push({
        raceId,
        reason: result.status === "INVALID_RECORD"
          ? result.reasons.join(" | ")
          : result.status,
      });
      continue;
    }
    const probability = result.ranked.find((r) => r.no === row.winnerNo)?.probability;
    const pSum = result.ranked.reduce((acc, x) => acc + x.probability, 0);
    if (probability == null || !Number.isFinite(probability) || probability <= 0 ||
        result.ranked.some((x) => !Number.isFinite(x.probability) || x.probability < 0) ||
        Math.abs(pSum - 1) > 1e-9) {
      rejected.push({ raceId, reason: "PROBABILITY_INTEGRITY_FAILED" });
      continue;
    }
    dates.push(date!);
    const n = result.fieldSize;
    fieldSum += n;
    rankSum += result.winnerRank;
    top1Hits += Number(result.winnerRank === 1);
    top3Hits += Number(result.winnerRank <= 3);
    top6Hits += Number(result.winnerRank <= 6);
    logLossSum -= Math.log(probability);
    equalLogLossSum += Math.log(n);
    brierSum += result.ranked.reduce(
      (acc, r) => acc + (r.probability - Number(r.no === row.winnerNo)) ** 2, 0
    );
    for (const r of result.ranked) calibrationPoints.push({
      p: r.probability, win: r.no === row.winnerNo ? 1 : 0,
    });
    if (result.top1Miss) {
      categories1[result.top1Miss.category] = (categories1[result.top1Miss.category] ?? 0) + 1;
    }
    if (result.top3Miss) {
      categories3[result.top3Miss.category] = (categories3[result.top3Miss.category] ?? 0) + 1;
    }
    races.push({
      raceId, date: date!, winnerNo: row.winnerNo!, winnerName: result.winnerName,
      fieldSize: n, rank: result.winnerRank, probability,
      top1Rival: result.top1Miss?.rivalName ?? null,
      top3Rival: result.top3Miss?.rivalName ?? null,
      categoryTop1: result.top1Miss?.category ?? null,
      categoryTop3: result.top3Miss?.category ?? null,
      top1Drivers: result.top1Miss?.demotionDrivers.map((d) => ({code: d.code, delta: d.delta})) ?? [],
      top3Drivers: result.top3Miss?.demotionDrivers.map((d) => ({code: d.code, delta: d.delta})) ?? [],
      positiveSignals: result.winnerPositiveSignals?.map((s) => ({ code: s.code, contribution: s.totalContribution })) ?? [],
      source: "ACCEPTANCE_VECTORS", preRaceProvenance: "UNVERIFIED",
      alternativeSignals: "NOT_VERIFIED",
    });
  }

  const n = races.length;
  calibrationPoints.sort((a, b) => a.p - b.p);
  const calibration: NonNullable<FinalAcceptanceReport["metrics"]>["calibration"] = [];
  for (let bucket = 0; bucket < 5; bucket++) {
    const part = calibrationPoints.slice(
      Math.floor(bucket * calibrationPoints.length / 5),
      Math.floor((bucket + 1) * calibrationPoints.length / 5)
    );
    if (!part.length) continue;
    calibration.push({
      bucket: bucket + 1, n: part.length, minP: part[0].p, maxP: part[part.length - 1].p,
      meanPredicted: part.reduce((sum, r) => sum + r.p, 0) / part.length,
      actualFrequency: part.reduce((sum, r) => sum + r.win, 0) / part.length,
    });
  }
  const metrics: FinalAcceptanceReport["metrics"] = n === 0 ? null : {
    top1: top1Hits / n,
    top3: top3Hits / n,
    top6Diagnostic: top6Hits / n,
    top1Hits, top3Hits,
    meanWinnerRank: rankSum / n,
    meanFieldSize: fieldSum / n,
    meanLogLoss: logLossSum / n,
    equalProbabilityLogLoss: equalLogLossSum / n,
    multiclassBrier: brierSum / n,
    top1EqualProbabilityReference: races.reduce((sum, r) => sum + 1 / r.fieldSize, 0) / n,
    top3EqualProbabilityReference: races.reduce((sum, r) => sum + Math.min(3, r.fieldSize) / r.fieldSize, 0) / n,
    calibrationEce: calibration.reduce(
      (sum, b) => sum + b.n / calibrationPoints.length * Math.abs(b.meanPredicted - b.actualFrequency), 0
    ),
    calibration,
  };
  const dataGate = n >= minRaces && rejected.length === 0 ? "PASS_DATA_ONLY" : "BLOCKED";
  races.sort((a, b) => a.date.localeCompare(b.date) || a.raceId.localeCompare(b.raceId));
  return {
    dataGate, publicationGate: "NOT_VERIFIED",
    input: {
      total: rows.length, evaluated: n, rejected: rejected.length, required: minRaces,
      firstDate: dates.length ? [...dates].sort()[0] : null,
      lastDate: dates.length ? [...dates].sort().at(-1)! : null,
      developmentHoldoutEnd: cutoff,
    },
    identity: {
      engineVersion: meta.engineVersion, trainedAt: meta.trainedAt,
      weightsFingerprint: meta.weightsFingerprint,
      trainingRaces: meta.nRacesTrain, developmentHoldoutRaces: meta.nRacesHoldout,
    },
    verification: {
      modelVsAcceptanceChronology: rejected.some((r) =>
        r.reason === "NOT_AFTER_DEV_HOLDOUT" || r.reason === "INVALID_DATE") ? "FAILED" : "PASS",
      preRaceSnapshotProvenance: "NOT_VERIFIED",
      dataCollectionIndependence: "NOT_VERIFIED",
      liveRecomputeParity: "NOT_VERIFIED",
      alternativeDvsV1: "NOT_VERIFIED",
      agfComparison: "NOT_VERIFIED",
      couponRoi: "NOT_VERIFIED",
    },
    metrics, top1MissCategories: categories1, top3MissCategories: categories3,
    rejected, races,
    notes: [
      "Bu rapor kayitli kabul-test vektorlerini canonical modelle yeniden skorlar; canli veri cekmez ve yeniden egitim yapmaz.",
      "Gelistirme holdout'u bagimsiz kabul olarak SAYILMAZ; tarih sadece gelistirme holdout'u sonrasi olmalidir.",
      "Yaris oncesi generatedAt/model-fingerprint kaydi olmadan gercek zamanda yayinlanmis snapshot oldugu KANITLANAMAZ.",
      "Kayitli sinyallerin hangi model gelistirme kararlarini etkiledigi ve sonraki backfill'ler bagimsiz olarak kanitlanmadi.",
      "RCA kategorileri hipotezdir, istatistiksel dogrulanmis kok neden degildir.",
      "TOP6 yalniz tani amaclidir; asil hedefler TOP1 ve TOP3'tur. Kupon ROI bu raporda hesaplanmaz.",
      "PASS_DATA_ONLY production yayini icin izin DEGILDIR. Yayina hazirlik kontrolu ayri yapilmalidir.",
    ],
  };
}
