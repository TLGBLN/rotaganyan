import { describe, expect, it } from "vitest";
import { scoreRace, type FittedModel } from "@/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";
import { UNIFIED_MODEL_CODES } from "../feature-calculators/unified-feature-vector";
import { analyzeStoredAcceptanceRace } from "./acceptance-vector-rca";

const CODE = UNIFIED_MODEL_CODES[0];
function model(): FittedModel<string> {
  const stats = new Map(UNIFIED_MODEL_CODES.map((code) => [code, { mu: 0, sigma: 1, nObserved: 10 }] as const));
  const names = UNIFIED_MODEL_CODES.flatMap((code) => [`${code}_z`, `${code}_missing`]) as FittedModel<string>["names"];
  const beta = UNIFIED_MODEL_CODES.flatMap((code) => [code === CODE ? 2 : 0, 0]);
  return { stats, names, beta, nRacesUsed: 120, nRacesSkipped: 0, opts: {lambda: 1, learningRate: 0.05, iterations: 100} };
}
function runner(no: number, raw: number): RunnerFeatureVector {
  return {
    raceId: "race-holdout-1", no, name: `At ${no}`, tjkAtId: no, jockey: null,
    signals: UNIFIED_MODEL_CODES.map((code) => ({
      code, family: "TEST", rawValue: code === CODE ? raw : null,
      observed: code === CODE, coverageState: null,
      asOfSafe: true, missingReason: code === CODE ? null : "test verisi yok",
    })),
  };
}
describe("RAN acceptance-vector RCA: DB-less holdout explanation", () => {
  it("scores saved vectors exactly with the canonical scoreRace, never imputes AGF or alt evidence", () => {
    const vectors = [runner(1, 3), runner(2, 1), runner(3, 0)];
    const trained = model();
    const r = analyzeStoredAcceptanceRace("race-holdout-1", 3, vectors, trained);
    expect(r.status).toBe("OK");
    if (r.status !== "OK") return;
    const expected = scoreRace(vectors, trained).sort((a, b) => b.probability - a.probability);
    expect(r.ranked.map((x) => x.probability)).toEqual(expected.map((x) => x.probability));
    expect(r.ranked.reduce((sum, x) => sum + x.probability, 0)).toBeCloseTo(1, 12);
    expect(r.winnerRank).toBe(3);
    expect(r.top1Miss?.demotionDrivers[0].delta).toBeGreaterThan(0);
    expect(r.top3Miss).toBeNull();
    expect(r.winnerPedigree).toHaveLength(3);
    expect(r.agfComparison).toBeNull();
    expect(r.altCrosscheck).toBe("NOT_VERIFIED");
    expect(r.provenance).toBe("UNVERIFIED");
    expect(r.top1Miss?.evidence.at(-1)).toContain("NOT_VERIFIED");
  });

  it("missing canonical signals or reused runner numbers are rejected, not scored", () => {
    const vectors = [runner(1, 1), runner(2, 0)];
    vectors[0].signals.pop();
    expect(analyzeStoredAcceptanceRace("race-holdout-1", 2, vectors, model()).status).toBe("INVALID_RECORD");
    const repeated = [runner(1, 1), runner(1, 0)];
    expect(analyzeStoredAcceptanceRace("race-holdout-1", 1, repeated, model()).status).toBe("INVALID_RECORD");
  });

  it("missing winner is explicit, not mistaken for rank zero", () => {
    const r = analyzeStoredAcceptanceRace("race-holdout-1", 8, [runner(1, 2), runner(2, 1)], model());
    expect(r.status).toBe("NO_WINNER_MATCH");
  });
});
