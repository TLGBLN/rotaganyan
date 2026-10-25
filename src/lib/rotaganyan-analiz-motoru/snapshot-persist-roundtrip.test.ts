// ROTAGANYAN ANALİZ MOTORU — Faz 4 madde 2 ("Snapshot kaydetme ve tekrar okuma — gerçek DB
// yazması YAPMADAN, in-memory/test-DB ile simüle et"). Bu dosya GERÇEK bir Postgres'e hiç
// bağlanmaz — RAN-TASLAK_prediction-pick-motor-alanlari.sql'in önerdiği kolonların (ran*)
// JSON/JSONB round-trip DAVRANIŞINI (serialize→deserialize) in-memory bir "sahte satır"
// üzerinde simüle eder. Bunun kanıtladığı şey: route.ts'in ürettiği RanPredictionSnapshot,
// bir JSONB kolonuna yazılıp GERİ okunduğunda (JSON.stringify/parse — Postgres JSONB'nin
// GERÇEK davranışı, ör. Prisma Json alanları) bütünlüğünü (Σkatkı=finalScore, originalRank/
// publishedRank ayrımı) KORUR — gerçek bir DB bağlantısı GEREKMEDEN.
import { describe, it, expect } from "vitest";
import {
  computeWeightsFingerprint,
  computePreRaceDataSnapshotId,
  toRanSignalSnapshotEntry,
  sumSnapshotSignalContributions,
  applyManualOverride,
  type RanPredictionSnapshot,
} from "./snapshot-integrity";
import type { SignalEffectRow } from "../motor-v1/engine/training";

// Sahte "satır deposu" — gerçek Prisma/Postgres YOK, yalnız JSON round-trip'in kendisini
// (tipik bir ORM'in Json alanını nasıl sakladığını/geri döndürdüğünü) taklit eder.
type FakePickRow = {
  ranOriginalRank: number;
  ranPublishedRank: number;
  ranWinProbability: number;
  ranFinalScore: number;
  ranPreRaceDataSnapshotId: string;
  ranSignalSnapshot: string; // JSONB sütunu -> JS tarafında string/parsed obje
};

function persist(snapshot: RanPredictionSnapshot): FakePickRow {
  return {
    ranOriginalRank: snapshot.originalRank,
    ranPublishedRank: snapshot.publishedRank,
    ranWinProbability: snapshot.winProbability,
    ranFinalScore: snapshot.finalScore,
    ranPreRaceDataSnapshotId: snapshot.preRaceDataSnapshotId ?? "",
    ranSignalSnapshot: JSON.stringify(snapshot.signals), // JSONB yazma SİMÜLASYONU
  };
}

function reload(row: FakePickRow, base: Omit<RanPredictionSnapshot, "originalRank" | "publishedRank" | "winProbability" | "finalScore" | "preRaceDataSnapshotId" | "signals">): RanPredictionSnapshot {
  return {
    ...base,
    originalRank: row.ranOriginalRank,
    publishedRank: row.ranPublishedRank,
    winProbability: row.ranWinProbability,
    finalScore: row.ranFinalScore,
    preRaceDataSnapshotId: row.ranPreRaceDataSnapshotId,
    signals: JSON.parse(row.ranSignalSnapshot), // JSONB okuma SİMÜLASYONU
  };
}

const FAKE_MODEL = { beta: [0.3, -0.1, 0.2, 0.05], names: ["A_z", "A_missing", "B_z", "B_missing"] };

function buildFakeSnapshot(): RanPredictionSnapshot {
  const rows: SignalEffectRow<string>[] = [
    { code: "A", family: "F1", rawValue: 2, standardizedValue: 1.1, learnedCoefficient: 0.3, scoreContribution: 0.33, missingIndicatorCoefficient: -0.1, missingIndicatorContribution: 0, observed: true, coverageState: "FULL", modelVersion: "ran-v1" },
    { code: "B", family: "F2", rawValue: null, standardizedValue: 0, learnedCoefficient: 0.2, scoreContribution: 0, missingIndicatorCoefficient: 0.05, missingIndicatorContribution: 0.05, observed: false, coverageState: null, modelVersion: "ran-v1" },
  ];
  const signals = rows.map(toRanSignalSnapshotEntry);
  const finalScore = sumSnapshotSignalContributions(signals);
  return {
    raceId: "race-persist-test",
    no: 3,
    runnerId: "runner-cuid-persist-3",
    engineVersion: "1.0",
    weightsFingerprint: computeWeightsFingerprint(FAKE_MODEL),
    generatedAt: "2026-10-25T09:00:00.000Z",
    originalRank: 4,
    publishedRank: 4,
    winProbability: 0.18,
    finalScore,
    featureCodeOrder: ["A", "B"],
    preRaceDataSnapshotId: computePreRaceDataSnapshotId("race-persist-test", signals),
    signals,
  };
}

describe("Snapshot kaydetme + tekrar okuma simülasyonu (gerçek DB YAZMASI YOK)", () => {
  it("JSON round-trip (JSONB yazma/okuma simülasyonu) sonrası TÜM alanlar bütünlüğünü korur", () => {
    const original = buildFakeSnapshot();
    const row = persist(original);
    const reloaded = reload(row, original);

    expect(reloaded).toEqual(original);
    // Σkatkı=finalScore, GERİ OKUNAN veriden YENİDEN doğrulanır (explainRunner'ı tekrar
    // ÇAĞIRMADAN — bu snapshot'ın KENDİSİNİN kanıt olduğu nokta, bkz. teslim raporu).
    expect(sumSnapshotSignalContributions(reloaded.signals)).toBeCloseTo(reloaded.finalScore, 10);
  });

  it("kaydedilmiş satır üzerinde applyManualOverride UYGULANIP yeniden kaydedilse (ikinci round-trip) originalRank + sinyal katkıları KORUNUR", () => {
    const original = buildFakeSnapshot();
    const row1 = persist(original);
    const reloaded1 = reload(row1, original);

    const overridden = applyManualOverride(reloaded1, 1); // admin 4.sıradaki atı 1.sıraya ÇIKARDI
    const row2 = persist(overridden); // "yeniden kaydet" simülasyonu
    const reloaded2 = reload(row2, overridden);

    expect(reloaded2.publishedRank).toBe(1); // override YANSIDI
    expect(reloaded2.originalRank).toBe(4); // motorun kendi sırası HÂLÂ okunabilir (P0 bug tekrarlanmadı)
    expect(reloaded2.signals).toEqual(original.signals); // sinyal katkıları İKİ round-trip SONRASI da kayıpsız
    expect(sumSnapshotSignalContributions(reloaded2.signals)).toBeCloseTo(reloaded2.finalScore, 10);
  });
});
