import { describe, expect, it } from "vitest";
import {
  finishRatio,
  timeDecayWeight,
  weightedAverage,
  zScore,
  medianAbsoluteDeviation,
  median,
  gaussianKernel,
  shrinkageFactor,
  effectiveSampleSize,
  logit,
  classifyCoverage,
  type RaceOutcome,
} from "./common";

describe("finishRatio — §1.1 açık veri sözleşmesi", () => {
  it("birinci at için 1 döner", () => {
    expect(finishRatio({ kind: "finished", position: 1, fieldSize: 10, confidence: "high" })).toBe(1);
  });
  it("sonuncu at için 0 döner", () => {
    expect(finishRatio({ kind: "finished", position: 10, fieldSize: 10, confidence: "high" })).toBe(0);
  });
  it("ortadaki at için 0-1 arası değer döner", () => {
    const r = finishRatio({ kind: "finished", position: 5, fieldSize: 10, confidence: "high" });
    expect(r).toBeCloseTo((10 - 5) / (10 - 1), 10);
  });
  it("N=1 (tek at) → null, 1 (sahte kazanç) DEĞİL", () => {
    expect(finishRatio({ kind: "finished", position: 1, fieldSize: 1, confidence: "high" })).toBeNull();
  });
  it("dnf → null, son sıra DEĞİL", () => {
    expect(finishRatio({ kind: "dnf" } as RaceOutcome)).toBeNull();
  });
  it("dq → null", () => {
    expect(finishRatio({ kind: "dq" } as RaceOutcome)).toBeNull();
  });
  it("derecesiz → null", () => {
    expect(finishRatio({ kind: "no-time" } as RaceOutcome)).toBeNull();
  });
  it("eksik kayıt → null", () => {
    expect(finishRatio({ kind: "missing" } as RaceOutcome)).toBeNull();
  });
  it("geçersiz pozisyon (fieldSize'dan büyük) → null, sessizce yanlış sayı DEĞİL", () => {
    expect(finishRatio({ kind: "finished", position: 15, fieldSize: 10, confidence: "high" })).toBeNull();
  });
});

describe("timeDecayWeight — §1.2", () => {
  it("Δt=0 iken ağırlık 1", () => {
    expect(timeDecayWeight(0, 120)).toBeCloseTo(1, 10);
  });
  it("Δt=h (yarı ömür) iken ağırlık 0.5", () => {
    expect(timeDecayWeight(120, 120)).toBeCloseTo(0.5, 6);
  });
  it("negatif Δt → null (gelecek bir yarış olamaz)", () => {
    expect(timeDecayWeight(-5, 120)).toBeNull();
  });
  it("h<=0 → null", () => {
    expect(timeDecayWeight(10, 0)).toBeNull();
  });
});

describe("weightedAverage", () => {
  it("basit ağırlıklı ortalama doğru hesaplanır", () => {
    const r = weightedAverage([
      { value: 1, weight: 1 },
      { value: 0, weight: 1 },
    ]);
    expect(r).toBeCloseTo(0.5, 10);
  });
  it("null değerler ATLANIR, hesaba 0 olarak girmez", () => {
    const r = weightedAverage([
      { value: 1, weight: 1 },
      { value: null, weight: 1 },
    ]);
    expect(r).toBe(1); // null olan nokta tamamen dışlandı, 0 gibi davranıp ortalamayı düşürmedi
  });
  it("hiç geçerli nokta yoksa null", () => {
    expect(weightedAverage([{ value: null, weight: 1 }])).toBeNull();
  });
  it("boş dizi → null", () => {
    expect(weightedAverage([])).toBeNull();
  });
});

describe("zScore", () => {
  it("x=μ iken z=0", () => {
    expect(zScore(5, 5, 2)).toBe(0);
  });
  it("x=null → null (0 ile KARIŞTIRILMAZ)", () => {
    expect(zScore(null, 5, 2)).toBeNull();
  });
  it("σ=0 → null (bölme hatası değil, açık null)", () => {
    expect(zScore(5, 5, 0)).toBeNull();
  });
});

describe("medianAbsoluteDeviation / median", () => {
  it("tek sayı dizisinde medyan doğru", () => {
    expect(median([1, 2, 3])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
  });
  it("MAD sabit dizide 0", () => {
    expect(medianAbsoluteDeviation([5, 5, 5])).toBe(0);
  });
  it("boş dizide null", () => {
    expect(medianAbsoluteDeviation([])).toBeNull();
  });
});

describe("gaussianKernel", () => {
  it("x=center iken çekirdek değeri 1", () => {
    expect(gaussianKernel(1600, 1600, 0.2)).toBeCloseTo(1, 10);
  });
  it("bandwidth<=0 → null", () => {
    expect(gaussianKernel(1600, 1600, 0)).toBeNull();
  });
});

describe("shrinkageFactor", () => {
  it("n=0 iken 0 (hiç kanıt yok → tam küçültme)", () => {
    expect(shrinkageFactor(0, 10)).toBe(0);
  });
  it("n büyüdükçe 1'e yaklaşır", () => {
    expect(shrinkageFactor(1000, 10)).toBeGreaterThan(0.98);
  });
});

describe("effectiveSampleSize", () => {
  it("eşit ağırlıklarda n_eff = gerçek gözlem sayısı", () => {
    expect(effectiveSampleSize([1, 1, 1, 1])).toBeCloseTo(4, 10);
  });
  it("tek baskın ağırlık n_eff'i 1'e yaklaştırır (diğerleri ihmal edilebilir)", () => {
    const n = effectiveSampleSize([1, 0.0001, 0.0001, 0.0001]);
    expect(n).toBeGreaterThan(0.9);
    expect(n).toBeLessThan(1.1);
  });
  it("boş dizi → 0", () => {
    expect(effectiveSampleSize([])).toBe(0);
  });
});

describe("classifyCoverage — PMZ/SINIF ortak eşik davranışı (kullanıcı uyarısı: 3 gözlem yüksek-güvenli SAYILMAMALI)", () => {
  it("n=3 (varsayılan eşik 5 altında) → HISTORICAL_COVERAGE_GAP, OBSERVED_HISTORY DEĞİL", () => {
    expect(classifyCoverage(true, 10, 3)).toBe("HISTORICAL_COVERAGE_GAP");
  });
  it("n=5 (varsayılan eşik) → OBSERVED_HISTORY", () => {
    expect(classifyCoverage(true, 10, 5)).toBe("OBSERVED_HISTORY");
  });
  it("identityKnown=false → IDENTITY_UNRESOLVED, gözlem sayısından BAĞIMSIZ", () => {
    expect(classifyCoverage(false, 10, 99)).toBe("IDENTITY_UNRESOLVED");
  });
});

describe("logit", () => {
  it("p=0.5 iken logit=0", () => {
    expect(logit(0.5)).toBeCloseTo(0, 10);
  });
  it("p=0 veya p=1 sayısal güvenlikle kırpılır, Infinity DÖNMEZ", () => {
    expect(Number.isFinite(logit(0))).toBe(true);
    expect(Number.isFinite(logit(1))).toBe(true);
  });
});
