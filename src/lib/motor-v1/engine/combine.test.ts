import { describe, expect, it } from "vitest";
import { buildCombinerVector, mergeAgfIntoVectors, COMBINER_CODES } from "./combine";
import { computeFeatureStats, toModelVector, fitModel, scoreRace, SIGNAL_CODES, type TrainingRace } from "./training";
import type { RunnerFeatureVector } from "./feature-vector";
import type { AgfSignalEntry } from "../features/agf";

function agfEntry(code: "AGF_01" | "AGF_02", rawValue: number | null): AgfSignalEntry {
  return { code, family: "AGF", rawValue, observed: rawValue != null, coverageState: null, asOfSafe: true, missingReason: rawValue == null ? "test" : null };
}

function pureVector(no: number, overrides: Record<string, number | null> = {}): RunnerFeatureVector {
  return {
    raceId: "r1",
    no,
    name: `AT${no}`,
    tjkAtId: no,
    jockey: "X",
    signals: SIGNAL_CODES.map((code) => ({
      code,
      family: "TEST",
      rawValue: code in overrides ? overrides[code] : 1,
      observed: code in overrides ? overrides[code] != null : true,
      coverageState: null,
      asOfSafe: true as const,
      missingReason: null,
    })),
  };
}

describe("buildCombinerVector — Yaklaşım 1 (dondurulmuş saf skor + AGF)", () => {
  it("PURE_SCORE + AGF_01 + AGF_02 sinyallerini doğru sırayla taşır", () => {
    const v = buildCombinerVector("r1", 1, "AT1", 0.42, [agfEntry("AGF_01", 15), agfEntry("AGF_02", -3)]);
    expect(v.signals.map((s) => s.code)).toEqual(["PURE_SCORE", "AGF_01", "AGF_02"]);
    expect(v.signals[0].rawValue).toBe(0.42);
  });

  it("saf model skor ÜRETEMEDİĞİNDE (null) PURE_SCORE gözlemsiz işaretlenir, SAHTE 0 KULLANILMAZ", () => {
    const v = buildCombinerVector("r1", 1, "AT1", null, []);
    expect(v.signals[0].observed).toBe(false);
    expect(v.signals[0].rawValue).toBeNull();
  });

  it("training.ts'in generic makinesiyle (COMBINER_CODES) UÇTAN UCA eğitilip skorlanabilir", () => {
    const race: RunnerFeatureVector[] = [
      buildCombinerVector("r1", 1, "AT1", 1.2, [agfEntry("AGF_01", 30), agfEntry("AGF_02", 5)]),
      buildCombinerVector("r1", 2, "AT2", 0.3, [agfEntry("AGF_01", 10), agfEntry("AGF_02", -2)]),
      buildCombinerVector("r1", 3, "AT3", -0.5, [agfEntry("AGF_01", 5), agfEntry("AGF_02", 0)]),
    ];
    const stats = computeFeatureStats(race, COMBINER_CODES);
    expect([...stats.keys()]).toEqual(["PURE_SCORE", "AGF_01", "AGF_02"]);

    const trainingSet: TrainingRace[] = [{ raceId: "r1", date: new Date(), vectors: race, winnerNo: 1 }];
    const model = fitModel(trainingSet, stats, { lambda: 0.1, learningRate: 0.1, iterations: 15 });
    expect(model.names.length).toBe(COMBINER_CODES.length * 2);

    const scored = scoreRace(race, model);
    const totalProb = scored.reduce((s, r) => s + r.probability, 0);
    expect(totalProb).toBeCloseTo(1, 8);
  });
});

describe("mergeAgfIntoVectors — Yaklaşım 2 (ortak eğitim için birleşim)", () => {
  it("ORİJİNAL saf vektörleri MUTATE ETMEZ (saf motorun çıktısı başka yerde değişmiş gibi görünmez)", () => {
    const pure = [pureVector(1), pureVector(2)];
    const beforeSignalCount = pure[0].signals.length;
    mergeAgfIntoVectors(pure, new Map([[1, [agfEntry("AGF_01", 20)]]]));
    expect(pure[0].signals.length).toBe(beforeSignalCount); // orijinal DEĞİŞMEDİ
  });

  it("AGF sinyallerini doğru runner'a (no ile eşleşerek) ekler", () => {
    const pure = [pureVector(1), pureVector(2)];
    const merged = mergeAgfIntoVectors(pure, new Map([[1, [agfEntry("AGF_01", 20), agfEntry("AGF_02", 1)]]]));
    const r1 = merged.find((v) => v.no === 1)!;
    const r2 = merged.find((v) => v.no === 2)!;
    expect(r1.signals.length).toBe(SIGNAL_CODES.length + 2);
    expect(r2.signals.length).toBe(SIGNAL_CODES.length); // AGF verisi olmayan at EKLEME almaz
    expect(r1.signals.some((s) => s.code === "AGF_01")).toBe(true);
  });

  it("SAF MOTOR PARİTE KONTROLÜ: AGF birleştirildikten SONRA bile, saf-kodlarla (SIGNAL_CODES, codes argümanı VERİLMEDEN) hesaplanan istatistikler AGF'siz hâliyle BİREBİR AYNI", () => {
    const pure = [pureVector(1, { FORM_01: 2 }), pureVector(2, { FORM_01: 4 })];
    const merged = mergeAgfIntoVectors(pure, new Map([[1, [agfEntry("AGF_01", 99)]]]));

    const statsBefore = computeFeatureStats(pure); // AGF'siz, eski çağrı imzası
    const statsAfterMerge = computeFeatureStats(merged); // AGF eklenmiş vektörlerle AMA codes verilmeden (varsayılan SIGNAL_CODES)

    expect(statsAfterMerge.get("FORM_01")).toEqual(statsBefore.get("FORM_01"));
    expect(statsAfterMerge.has("AGF_01" as never)).toBe(false); // codes verilmeyince AGF'ye HİÇ bakılmaz
    expect([...statsAfterMerge.keys()].length).toBe(SIGNAL_CODES.length);
  });
});
