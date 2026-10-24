import { describe, expect, it } from "vitest";
import { MODEL_B_CODES, MODEL_B_RELATIONAL_CODES, CODE_RENAME_MAP, remapLegacyCacheCodes, cacheToTrainingRaces, fitModelBFromCache, type CachedRaceShape } from "./model-b-relational";
import { SIGNAL_CODES } from "./training";
import { EXCLUDED_FROM_SCORING } from "./predict-v1";
import type { SignalEntry } from "./feature-vector";

function sig(code: string, rawValue: number | null = 1): SignalEntry {
  return { code, family: "TEST", rawValue, observed: rawValue != null, coverageState: null, asOfSafe: true, missingReason: null };
}

describe("MODEL_B_CODES", () => {
  it("saf 20 + yalnız önbellekte gerçekten bulunan 4 ilişkiden oluşur", () => {
    expect(MODEL_B_CODES.length).toBe(SIGNAL_CODES.length + 4);
    for (const c of SIGNAL_CODES) expect(MODEL_B_CODES).toContain(c);
    for (const c of MODEL_B_RELATIONAL_CODES) expect(MODEL_B_CODES).toContain(c);
  });

  it("KRİTİK: hiçbir PIT-güvensiz/seçilim-yanlılığı kodu içermez (EXCLUDED_FROM_SCORING ile kesişmez)", () => {
    for (const forbidden of EXCLUDED_FROM_SCORING.keys()) {
      expect(MODEL_B_CODES as readonly string[]).not.toContain(forbidden);
    }
  });

  it("güncel unified-family-engine kod adlarını kullanır (eski INT_* adlarını DEĞİL)", () => {
    expect(MODEL_B_CODES).toContain("FRM_IDMAN_DINLENME_01");
    expect(MODEL_B_CODES).toContain("JOK_FRM_TMP_01");
    expect(MODEL_B_CODES).toContain("TMP_KULVAR_01");
    expect(MODEL_B_CODES as readonly string[]).not.toContain("INT_FORM_GALOP_DINLENME_01");
  });
});

describe("remapLegacyCacheCodes", () => {
  it("eski 3 ilişki kodunu güncel adlara çevirir, GEN_SIRE_PMZ_01'i DEĞİŞTİRMEZ", () => {
    const remapped = remapLegacyCacheCodes([
      sig("INT_FORM_GALOP_DINLENME_01"), sig("INT_JOKEY_FORM_TEMPO_01"), sig("INT_TEMPO_STIL_KULVAR_01"),
      sig("GEN_SIRE_PMZ_01"), sig("HIZ_01"),
    ]);
    expect(remapped.map((s) => s.code)).toEqual(["FRM_IDMAN_DINLENME_01", "JOK_FRM_TMP_01", "TMP_KULVAR_01", "GEN_SIRE_PMZ_01", "HIZ_01"]);
  });

  it("rawValue/observed gibi değerleri DEĞİŞTİRMEZ, yalnız code alanını", () => {
    const remapped = remapLegacyCacheCodes([sig("INT_FORM_GALOP_DINLENME_01", 0.42)]);
    expect(remapped[0].rawValue).toBe(0.42);
    expect(remapped[0].observed).toBe(true);
  });
});

describe("fitModelBFromCache — gerçek önbellekten, YALNIZ train split'ten fit", () => {
  function fakeCache(): Record<string, CachedRaceShape> {
    const race = (id: string, winnerNo: number): CachedRaceShape => ({
      raceId: id, date: "2026-01-01", winnerNo,
      runners: [
        { no: 1, name: "A", vectors: [sig("HIZ_01", 2), sig("GEN_SIRE_PMZ_01", 1.5)] },
        { no: 2, name: "B", vectors: [sig("HIZ_01", -2), sig("GEN_SIRE_PMZ_01", -1.5)] },
      ],
    });
    return { r1: race("r1", 1), r2: race("r2", 1), holdout1: race("holdout1", 2) };
  }

  it("yalnız verilen trainRaceIds'i kullanır, holdout'u görmez", () => {
    const cache = fakeCache();
    const model = fitModelBFromCache(cache, ["r1", "r2"]);
    expect(model.nRacesUsed).toBe(2);
    expect([...model.stats.keys()].sort()).toEqual([...MODEL_B_CODES].sort());
  });

  it("cacheToTrainingRaces önbellekte olmayan raceId'leri sessizce atlar", () => {
    const cache = fakeCache();
    const races = cacheToTrainingRaces(cache, ["r1", "yok-boyle-bir-yaris"]);
    expect(races.map((r) => r.raceId)).toEqual(["r1"]);
  });
});
