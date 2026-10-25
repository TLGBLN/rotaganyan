import { describe, expect, it } from "vitest";
import type { FittedModel } from "@/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";
import { UNIFIED_MODEL_CODES } from "../feature-calculators/unified-feature-vector";
import {
  acceptanceDay, computeFinalAcceptanceReport,
  type AcceptanceRaceRow, type AcceptanceModelMeta,
} from "./final-acceptance-report";

const TOP_CODE = UNIFIED_MODEL_CODES[0];
const META: AcceptanceModelMeta = {
  engineVersion: "1.0",
  trainedAt: "2026-10-24T22:04:51.458Z",
  weightsFingerprint: "test-only",
  trainDateRange: ["2026-08-16", "2026-08-25"],
  holdoutDateRange: ["2026-08-26", "2026-08-28"],
  nRacesTrain: 238,
  nRacesHoldout: 62,
};

function mockModel(): FittedModel<string> {
  return {
    beta: UNIFIED_MODEL_CODES.flatMap((code) => [code === TOP_CODE ? 1 : 0, 0]),
    names: UNIFIED_MODEL_CODES.flatMap((code) => [code + "_z", code + "_missing"]) as FittedModel<string>["names"],
    stats: new Map(UNIFIED_MODEL_CODES.map((code) => [code, { mu: 0, sigma: 1, nObserved: 20 }] as const)),
    nRacesUsed: 238, nRacesSkipped: 0,
    opts: { lambda: 90, learningRate: 0.25, iterations: 2500 },
  };
}

function row(i: number, winnerNo: number, tarih = "2026-10-24"): AcceptanceRaceRow {
  const raceId = "race-independent-" + i;
  const vectors: RunnerFeatureVector[] = [1, 2, 3].map((no) => ({
    raceId, no, name: "Horse " + no, tjkAtId: no, jockey: null,
    signals: UNIFIED_MODEL_CODES.map((code) => ({
      code, family: "TEST", rawValue: code === TOP_CODE ? 4 - no : null,
      observed: code === TOP_CODE, asOfSafe: true, coverageState: null,
      missingReason: code === TOP_CODE ? null : "not observed",
    })),
  }));
  return { raceId, winnerNo, tarih, vectors };
}

describe("RAN final acceptance — fail closed / no live DB", () => {
  it("normalizes real Turkish and ISO dates and rejects impossible days", () => {
    expect(acceptanceDay("24.10.2026")).toBe("2026-10-24");
    expect(acceptanceDay("2026-10-24")).toBe("2026-10-24");
    expect(acceptanceDay("2026-10-24T00:00:00.000Z")).toBe("2026-10-24");
    expect(acceptanceDay("31.02.2026")).toBeNull();
  });

  it("one-race checkpoint is explicitly BLOCKED even though it is scoreable", () => {
    const report = computeFinalAcceptanceReport([row(1, 2)], mockModel(), META);
    expect(report.dataGate).toBe("BLOCKED");
    expect(report.input.evaluated).toBe(1);
    expect(report.input.required).toBe(60);
    expect(report.metrics?.top3).toBe(1);
    expect(report.publicationGate).toBe("NOT_VERIFIED");
    expect(report.verification.preRaceSnapshotProvenance).toBe("NOT_VERIFIED");
  });

  it("full 60-race acceptance scores canonical Top1, Top3 and calibration consistently", () => {
    const races = Array.from({ length: 60 }, (_, i) => row(i, i % 2 === 0 ? 1 : 2));
    const report = computeFinalAcceptanceReport(races, mockModel(), META);
    expect(report.dataGate).toBe("PASS_DATA_ONLY");
    expect(report.publicationGate).toBe("NOT_VERIFIED");
    expect(report.input.rejected).toBe(0);
    expect(report.metrics?.top1Hits).toBe(30);
    expect(report.metrics?.top3Hits).toBe(60);
    expect(report.metrics?.top1).toBe(0.5);
    expect(report.metrics?.top3).toBe(1);
    expect(report.metrics?.calibration.reduce((acc, b) => acc + b.n, 0)).toBe(180);
    expect(report.metrics?.multiclassBrier).toBeGreaterThan(0);
    expect(report.races.every((r) => r.preRaceProvenance === "UNVERIFIED")).toBe(true);
  });

  it("duplicate race IDs, dev holdout overlap and missing winners all block full dataset", () => {
    const rows = Array.from({ length: 60 }, (_, i) => row(i, 1));
    rows[2] = row(1, 2);
    rows[3] = row(3, 1, "2026-08-28");
    rows[4] = row(4, 1);
    rows[4].winnerNo = null;
    const report = computeFinalAcceptanceReport(rows, mockModel(), META);
    expect(report.dataGate).toBe("BLOCKED");
    expect(report.input.rejected).toBe(3);
    expect(report.rejected.map((r) => r.reason)).toContain("DUPLICATE_RACE_ID");
    expect(report.rejected.map((r) => r.reason)).toContain("NOT_AFTER_DEV_HOLDOUT");
    expect(report.rejected.map((r) => r.reason)).toContain("WINNER_NOT_VERIFIED");
    expect(report.verification.modelVsAcceptanceChronology).toBe("FAILED");
  });
});
