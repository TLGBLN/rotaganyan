import { describe, expect, it } from "vitest";
import { buildScorableVector, buildModelContract, EXCLUDED_FROM_SCORING } from "./predict-v1";
import { computeFeatureStats, fitModel, type TrainingRace } from "./training";
import type { UnifiedRunnerResult } from "./unified-family-engine";
import type { SignalEntry } from "./feature-vector";
import type { RunnerFeatureVector } from "./feature-vector";

function sig(code: string, family: string, rawValue: number | null = 1, observed = true): SignalEntry {
  return { code, family, rawValue, observed, coverageState: null, asOfSafe: true, missingReason: observed ? null : "test" };
}

// Küçük, elle kurulmuş bir UnifiedRunnerResult — gerçek computeUnifiedFamiliesForRace'in DB
// gerektirmeden, yalnız aile/ilişki KOD ŞEMASINI (yapısal olarak her runner için SABİT)
// test etmek için. Yalnız 3 aile + 2 ilişki yeterli (10/13'ün tamamı gerekmez — şema aynı).
function sample(): UnifiedRunnerResult {
  const hiz = sig("HIZ_01", "YET");
  const pist = sig("PIST_DURUM_01", "PMZ");
  const startRisk = sig("DAV_START_RISK", "DAV", 0.1);
  const kulvarInteraction = sig("TMP_DAV_KULVAR_01", "INTERACTION");
  const otherInteraction = sig("SOME_OTHER_01", "INTERACTION");
  return {
    no: 1,
    name: "AT1",
    families: [
      { family: "YET", features: [{ ...hiz, status: "EGITIM_SETINDE_GOZLEMLI" }], observedCount: 1, totalCount: 1, coverage: 1, missingReason: null, pitStatus: "VERIFIED", source: "test", interactions: [] },
      { family: "PMZ", features: [{ ...pist, status: "HESAPLANDI" }], observedCount: 1, totalCount: 1, coverage: 1, missingReason: null, pitStatus: "PIT_UNVERIFIED", source: "test", interactions: [] },
      { family: "DAV", features: [{ ...startRisk, status: "HESAPLANDI" }], observedCount: 1, totalCount: 1, coverage: 1, missingReason: null, pitStatus: "VERIFIED", source: "test", interactions: [] },
    ] as UnifiedRunnerResult["families"],
    interactions: [kulvarInteraction, otherInteraction],
    unifiedVector: [hiz, pist, startRisk, kulvarInteraction, otherInteraction],
    featureStatus: {},
  };
}

describe("buildScorableVector — PIT-güvensiz/seçilim-yanlılığı kodları fiziksel olarak çıkarır", () => {
  it("PIST_DURUM_01, DAV_START_RISK, TMP_DAV_KULVAR_01 vektörden çıkar; diğerleri kalır", () => {
    const v = buildScorableVector("r1", sample());
    const codes = v.signals.map((s) => s.code);
    expect(codes).toEqual(["HIZ_01", "SOME_OTHER_01"]);
    expect(codes).not.toContain("PIST_DURUM_01");
    expect(codes).not.toContain("DAV_START_RISK");
    expect(codes).not.toContain("TMP_DAV_KULVAR_01");
  });
});

describe("buildModelContract — hangi aile skora GERÇEKTEN katkı veriyor, hangisi bekliyor", () => {
  it("modelde sadece HIZ_01 varken: YET temsil edilir, PMZ/DAV tamamen bekler (dışarıda-bırakılmış olarak)", () => {
    const race = [
      { no: 1, name: "A", raceId: "r1", tjkAtId: 1, jockey: "X", signals: [sig("HIZ_01", "YET", 2)] },
      { no: 2, name: "B", raceId: "r1", tjkAtId: 2, jockey: "Y", signals: [sig("HIZ_01", "YET", -2)] },
    ] satisfies RunnerFeatureVector[];
    const stats = computeFeatureStats(race, ["HIZ_01"] as const);
    const trainingSet: TrainingRace[] = [{ raceId: "r1", date: new Date(), vectors: race, winnerNo: 1 }];
    const model = fitModel(trainingSet, stats, { lambda: 0.1, learningRate: 0.1, iterations: 20 });

    const contract = buildModelContract(sample(), model);

    const yet = contract.families.find((f) => f.family === "YET")!;
    expect(yet.scoredCodes).toEqual(["HIZ_01"]);
    expect(yet.representedInModel).toBe(true);

    const pmz = contract.families.find((f) => f.family === "PMZ")!;
    expect(pmz.scoredCodes).toEqual([]);
    expect(pmz.excludedCodes).toEqual(["PIST_DURUM_01"]);
    expect(pmz.representedInModel).toBe(false);

    const dav = contract.families.find((f) => f.family === "DAV")!;
    expect(dav.scoredCodes).toEqual([]);
    expect(dav.excludedCodes).toEqual(["DAV_START_RISK"]);
    expect(dav.representedInModel).toBe(false);

    const kulvar = contract.interactions.find((i) => i.code === "TMP_DAV_KULVAR_01")!;
    expect(kulvar.excluded).toBe(true);
    expect(kulvar.scored).toBe(false);

    expect(contract.fullyPendingFamilies.sort()).toEqual(["DAV", "PMZ"]);
  });

  it("KRİTİK: DAV_START_RISK bir modelin stats'ında bulunsa BİLE scoredCodes'a asla girmez (dışarıda-bırakma model-üyeliğini EZER)", () => {
    const race = [
      { no: 1, name: "A", raceId: "r1", tjkAtId: 1, jockey: "X", signals: [sig("DAV_START_RISK", "DAV", 0.2)] },
      { no: 2, name: "B", raceId: "r1", tjkAtId: 2, jockey: "Y", signals: [sig("DAV_START_RISK", "DAV", 0.1)] },
    ] satisfies RunnerFeatureVector[];
    const stats = computeFeatureStats(race, ["DAV_START_RISK"] as const);
    const trainingSet: TrainingRace[] = [{ raceId: "r1", date: new Date(), vectors: race, winnerNo: 1 }];
    const contaminatedModel = fitModel(trainingSet, stats, { lambda: 0.1, learningRate: 0.1, iterations: 10 });

    expect(contaminatedModel.stats.has("DAV_START_RISK")).toBe(true); // model GERÇEKTEN bu kodu biliyor

    const contract = buildModelContract(sample(), contaminatedModel);
    const dav = contract.families.find((f) => f.family === "DAV")!;
    expect(dav.scoredCodes).toEqual([]); // AMA sözleşme hâlâ onu scored SAYMAZ
    expect(dav.excludedCodes).toEqual(["DAV_START_RISK"]);
    expect(dav.representedInModel).toBe(false);

    // ve fiziksel vektör filtresi de aynı şekilde ASLA bu kodu skorlama girdisine sokmaz
    const v = buildScorableVector("r1", sample());
    expect(v.signals.map((s) => s.code)).not.toContain("DAV_START_RISK");
  });

  it("EXCLUDED_FROM_SCORING tam olarak 3 kod içerir (yanlışlıkla genişletilmemiş)", () => {
    expect([...EXCLUDED_FROM_SCORING.keys()].sort()).toEqual(["DAV_START_RISK", "PIST_DURUM_01", "TMP_DAV_KULVAR_01"]);
  });
});
