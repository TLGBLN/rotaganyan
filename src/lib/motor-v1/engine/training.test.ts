import { describe, expect, it } from "vitest";
import { computeFeatureStats, toModelVector, scoreRace, explainRunner, fitModel, SIGNAL_CODES } from "./training";
import type { RunnerFeatureVector } from "./feature-vector";

function fv(no: number, overrides: Partial<Record<string, number | null>> = {}): RunnerFeatureVector {
  return {
    raceId: "r1",
    no,
    name: `AT${no}`,
    tjkAtId: no,
    jockey: "X",
    signals: SIGNAL_CODES.map((code) => ({
      code,
      family: "TEST",
      rawValue: code in overrides ? overrides[code]! : 1,
      observed: code in overrides ? overrides[code] != null : true,
      coverageState: null,
      asOfSafe: true as const,
      missingReason: null,
    })),
  };
}

describe("computeFeatureStats", () => {
  it("gözlemli değerlerden μ/σ hesaplar, gözlemsizleri DIŞLAR", () => {
    const vectors = [fv(1, { FORM_01: 2 }), fv(2, { FORM_01: 4 }), fv(3, { FORM_01: null })];
    const stats = computeFeatureStats(vectors);
    const s = stats.get("FORM_01")!;
    expect(s.nObserved).toBe(2);
    expect(s.mu).toBeCloseTo(3, 10);
  });
  it("gözlem sayısı<2 ise sigma=1, mu=0 (uydurulmuş dağılım İDDİA EDİLMEZ)", () => {
    const vectors = [fv(1, { FORM_01: 5 }), fv(2, { FORM_01: null })];
    const s = computeFeatureStats(vectors).get("FORM_01")!;
    expect(s.mu).toBe(0);
    expect(s.sigma).toBe(1);
  });
});

describe("toModelVector — eksik-veri sözleşmesi (EĞİTİM/SKORLAMA'da AYNI)", () => {
  it("gözlemli bir sinyal doğru z-skor üretir, missing=0", () => {
    const vectors = [fv(1, { FORM_01: 2 }), fv(2, { FORM_01: 4 })];
    const stats = computeFeatureStats(vectors);
    const { vector, names } = toModelVector(vectors[0], stats);
    const zIdx = names.indexOf("FORM_01_z");
    const missIdx = names.indexOf("FORM_01_missing");
    expect(vector[missIdx]).toBe(0);
    expect(Number.isFinite(vector[zIdx])).toBe(true);
  });
  it("gözlemsiz bir sinyal z=0 (SAHTE DEĞER DEĞİL, nötr yer-tutucu) + missing=1 üretir", () => {
    const vectors = [fv(1, { FORM_01: 2 }), fv(2, { FORM_01: 4 })];
    const stats = computeFeatureStats(vectors);
    const missingFv = fv(3, { FORM_01: null });
    const { vector, names } = toModelVector(missingFv, stats);
    const zIdx = names.indexOf("FORM_01_z");
    const missIdx = names.indexOf("FORM_01_missing");
    expect(vector[zIdx]).toBe(0);
    expect(vector[missIdx]).toBe(1);
  });
  it("her sinyal için TAM İKİ sütun üretir (z + missing)", () => {
    const vectors = [fv(1)];
    const stats = computeFeatureStats(vectors);
    const { vector, names } = toModelVector(vectors[0], stats);
    expect(vector.length).toBe(SIGNAL_CODES.length * 2);
    expect(names.length).toBe(SIGNAL_CODES.length * 2);
  });
});

// kullanıcı talimatı §6/7: "gerçek veriyle bir sinyal değeri değiştirildiğinde, tahmin
// motorunun yeni değeri yeniden okuyup ilgili katkıyı güncellediğini doğrulayın." Bu test
// scoreRace/explainRunner'ın CANLI olarak fv.signals'tan okuduğunu, önbelleklenmiş/bayat bir
// değer KULLANMADIĞINI kanıtlar — DB'siz, saf bir senaryoyla (gerçek sayılarla kurulmuş).
describe("scoreRace/explainRunner — sinyal değişikliği gerçekten yeniden okunuyor mu?", () => {
  it("FORM_01 değiştirildiğinde skor ve açıklama GÜNCELLENİR, eski değer KULLANILMAZ", () => {
    const race = [fv(1, { FORM_01: 2 }), fv(2, { FORM_01: -2 }), fv(3, { FORM_01: 0 })];
    const stats = computeFeatureStats(race);
    const model = fitModel(
      [{ raceId: "r1", date: new Date(), vectors: race, winnerNo: 1 }],
      stats,
      { lambda: 0.1, learningRate: 0.1, iterations: 20 }
    );
    const before = scoreRace(race, model).find((s) => s.no === 1)!;
    const explainedBefore = explainRunner(race[0], model);

    // AYNI at (no=1) için FORM_01'i GERÇEKTEN değiştir (yeni FeatureVector nesnesi, eskisi DEĞİL).
    const mutated: RunnerFeatureVector = {
      ...race[0],
      signals: race[0].signals.map((s) => (s.code === "FORM_01" ? { ...s, rawValue: 9 } : s)),
    };
    const after = scoreRace([mutated, race[1], race[2]], model).find((s) => s.no === 1)!;
    const explainedAfter = explainRunner(mutated, model);

    expect(after.score).not.toBeCloseTo(before.score, 6);
    const formRowBefore = explainedBefore.rows.find((r) => r.code === "FORM_01")!;
    const formRowAfter = explainedAfter.rows.find((r) => r.code === "FORM_01")!;
    expect(formRowAfter.rawValue).toBe(9);
    expect(formRowAfter.standardizedValue).not.toBeCloseTo(formRowBefore.standardizedValue, 6);
    expect(formRowAfter.scoreContribution).not.toBeCloseTo(formRowBefore.scoreContribution, 6);
  });

  it("explainRunner'ın toplam skoru, scoreRace'in bağımsız hesapladığı skorla AYNI (çift-sayım YOK)", () => {
    const race = [fv(1, { FORM_01: 2, SINIF_01: -1 }), fv(2, { FORM_01: -2, SINIF_01: 1 })];
    const stats = computeFeatureStats(race);
    const model = fitModel([{ raceId: "r1", date: new Date(), vectors: race, winnerNo: 2 }], stats, {
      lambda: 0.1, learningRate: 0.1, iterations: 20,
    });
    const scored = scoreRace(race, model);
    for (const v of race) {
      const { totalScore } = explainRunner(v, model);
      const independent = scored.find((s) => s.no === v.no)!.score;
      expect(totalScore).toBeCloseTo(independent, 10);
    }
  });
});
