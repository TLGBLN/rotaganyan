import { describe, expect, it } from "vitest";
import { familyBlock, interactionStatus, upgradeStatusWithModelScore, modelVersionCodes, DEFAULT_RESEARCH_MODEL_CODES, type SignalStatus } from "./family-contract";
import { computeFeatureStats, fitModel, SIGNAL_CODES, type TrainingRace } from "./training";
import type { RunnerFeatureVector } from "./feature-vector";

function fv(no: number, overrides: Partial<Record<string, number | null>> = {}): RunnerFeatureVector {
  return {
    raceId: "r1", no, name: `AT${no}`, tjkAtId: no, jockey: "X",
    signals: SIGNAL_CODES.map((code) => ({
      code, family: "TEST",
      rawValue: code in overrides ? overrides[code]! : 1,
      observed: code in overrides ? overrides[code] != null : true,
      coverageState: null, asOfSafe: true as const, missingReason: null,
    })),
  };
}

describe("familyBlock — durum türetme (HESAPLANDI/EGITIM_SETINDE_GOZLEMLI/BEKLEMEDE)", () => {
  it("gözlemsiz özellik BEKLEMEDE olur", () => {
    const b = familyBlock("YET", [{ code: "HIZ_01", rawValue: null, observed: false, missingReason: "test" }], "VERIFIED", "test");
    expect(b.features[0].status).toBe("BEKLEMEDE");
  });
  it("gözlemli ve SIGNAL_CODES'ta olan (varsayılan codesSet) EGITIM_SETINDE_GOZLEMLI olur", () => {
    const b = familyBlock("YET", [{ code: "HIZ_01", rawValue: 1, observed: true, missingReason: null }], "VERIFIED", "test");
    expect(b.features[0].status).toBe("EGITIM_SETINDE_GOZLEMLI");
  });
  it("gözlemli ve SIGNAL_CODES'ta OLMAYAN (ör. yeni GEN sinyali) HESAPLANDI olur", () => {
    const b = familyBlock("GEN", [{ code: "GEN_SIRE_01", rawValue: 5, observed: true, missingReason: null }], "VERIFIED", "test");
    expect(b.features[0].status).toBe("HESAPLANDI");
  });
});

describe("interactionStatus", () => {
  it("gözlemli bir etkileşim ILISKILENDIRILDI olur (SIGNAL_CODES'ta değilse)", () => {
    expect(interactionStatus(true, "GEN_PMZ_YET_01")).toBe("ILISKILENDIRILDI");
  });
  it("gözlemsiz etkileşim BEKLEMEDE olur", () => {
    expect(interactionStatus(false, "GEN_PMZ_YET_01")).toBe("BEKLEMEDE");
  });
});

describe("upgradeStatusWithModelScore — MODELIN_SKORUNDA YALNIZ gerçek FittedModel ile", () => {
  it("FittedModel verilmezse hiçbir kod MODELIN_SKORUNDA olmaz (dürüst varsayılan)", () => {
    const b = familyBlock("YET", [{ code: "HIZ_01", rawValue: 1, observed: true, missingReason: null }], "VERIFIED", "test");
    expect(b.features[0].status).toBe("EGITIM_SETINDE_GOZLEMLI");
    expect(b.features[0].status).not.toBe("MODELIN_SKORUNDA");
  });

  it("GERÇEK fit edilmiş bir modelle, modelin GERÇEKTEN kullandığı kod MODELIN_SKORUNDA'ya yükseltilir", () => {
    const race = [fv(1, { FORM_01: 2 }), fv(2, { FORM_01: -2 }), fv(3, { FORM_01: 0 })];
    const stats = computeFeatureStats(race);
    const trainingSet: TrainingRace[] = [{ raceId: "r1", date: new Date(), vectors: race, winnerNo: 1 }];
    const model = fitModel(trainingSet, stats, { lambda: 0.1, learningRate: 0.1, iterations: 20 });

    expect(modelVersionCodes(model)).toEqual(DEFAULT_RESEARCH_MODEL_CODES);

    const featureStatus: Record<string, SignalStatus> = { HIZ_01: "EGITIM_SETINDE_GOZLEMLI", GEN_SIRE_01: "HESAPLANDI" };
    const upgraded = upgradeStatusWithModelScore(featureStatus, race[0], model);
    expect(upgraded.HIZ_01).toBe("MODELIN_SKORUNDA"); // model GERCEKTEN bu atin HIZ_01'ini kullandi
    expect(upgraded.GEN_SIRE_01).toBe("HESAPLANDI"); // GEN_SIRE_01 bu modelin codes'unda YOK, yukseltilmez
  });

  it("modelde gözlemsiz olan bir kod (runner'da o kod yoksa) yükseltilmez", () => {
    const race = [fv(1), fv(2)];
    const stats = computeFeatureStats(race);
    const model = fitModel([{ raceId: "r1", date: new Date(), vectors: race, winnerNo: 1 }], stats, { lambda: 0.1, learningRate: 0.1, iterations: 10 });
    const fvEksik: RunnerFeatureVector = { raceId: "r1", no: 1, name: "AT1", tjkAtId: 1, jockey: "X", signals: [] }; // hic sinyali yok
    const featureStatus: Record<string, SignalStatus> = { HIZ_01: "EGITIM_SETINDE_GOZLEMLI" };
    const upgraded = upgradeStatusWithModelScore(featureStatus, fvEksik, model);
    expect(upgraded.HIZ_01).toBe("EGITIM_SETINDE_GOZLEMLI"); // yukseltilmedi, cunku BU atin vektorunde gozlemli degildi
  });
});
