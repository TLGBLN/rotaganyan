import { describe, expect, it } from "vitest";
import { marketBlindOlasiliklariHesapla, plackettLuceTopKMarginals } from "./v5-engine";
import v5WeightsDiger from "./weights/v5-weights-diger.json";

// 2026-08-29 — V6 Aşama 2 (bkz. plan): bu testler gerçek yarış verisine dokunmaz, yalnız
// P(TOP2)/P(TOP3)/market-blind matematiğinin kendi iç tutarlılığını doğrular (toplamlar,
// monotonluk, k=1'in mevcut olasilik ile bit-bit eşleşmesi). Gerçek raceId'lerle gözle
// doğrulama ayrıca test-v5-engine route'u üzerinden yapılır (plan, doğrulama sırası 2).

function softmaxHam(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

describe("plackettLuceTopKMarginals", () => {
  it("k=1 için softmax (P(WIN)) ile bit-bit eşleşir", () => {
    const scores = [2.1, 0.4, -1.3, 0.0, 1.05];
    const top1 = plackettLuceTopKMarginals(scores, 1);
    const beklenen = softmaxHam(scores);
    top1.forEach((p, i) => expect(p).toBeCloseTo(beklenen[i], 10));
  });

  it("Σ P(top-k) = min(k, n)", () => {
    const scores = [3.2, 1.1, 0.5, -0.2, -1.0, 0.8, 2.0];
    for (const k of [1, 2, 3]) {
      const marj = plackettLuceTopKMarginals(scores, k);
      const toplam = marj.reduce((a, b) => a + b, 0);
      expect(toplam).toBeCloseTo(Math.min(k, scores.length), 8);
    }
  });

  it("her at için P(top1) <= P(top2) <= P(top3)", () => {
    const scores = [4.0, 2.5, 1.0, 0.3, -0.5, -2.1];
    const top1 = plackettLuceTopKMarginals(scores, 1);
    const top2 = plackettLuceTopKMarginals(scores, 2);
    const top3 = plackettLuceTopKMarginals(scores, 3);
    for (let i = 0; i < scores.length; i++) {
      expect(top1[i]).toBeLessThanOrEqual(top2[i] + 1e-9);
      expect(top2[i]).toBeLessThanOrEqual(top3[i] + 1e-9);
    }
  });

  it("k, saha büyüklüğünü aşarsa Σ P(top-k) = n'de (herkes 1) sabitlenir", () => {
    const scores = [1.0, 0.5, -0.3];
    const top5 = plackettLuceTopKMarginals(scores, 5);
    top5.forEach((p) => expect(p).toBeCloseTo(1, 8));
  });

  it("n=0 veya k<=0 için boş/sıfır sonuç, hata fırlatmaz", () => {
    expect(plackettLuceTopKMarginals([], 3)).toEqual([]);
    expect(plackettLuceTopKMarginals([1, 2, 3], 0)).toEqual([0, 0, 0]);
  });
});

describe("marketBlindOlasiliklariHesapla", () => {
  const featureNames: string[] = (v5WeightsDiger as { featureNames: string[] }).featureNames;
  const agfIdx = {
    agfSirasi: featureNames.indexOf("agfSirasi"),
    agfPayi: featureNames.indexOf("agfPayi"),
    agfPayi2: featureNames.indexOf("agfPayi2"),
  };

  function katkiVektoru(agfToplamKatki: number): number[] {
    const v = new Array(featureNames.length).fill(0);
    // AGF katkısını üç indekse rastgele ama toplamı sabit kalacak şekilde dağıt
    v[agfIdx.agfSirasi] = agfToplamKatki * 0.5;
    v[agfIdx.agfPayi] = agfToplamKatki * 0.3;
    v[agfIdx.agfPayi2] = agfToplamKatki * 0.2;
    return v;
  }

  it("Σ marketBlindProb1 = 1", () => {
    const skorlar = [3.0, 1.5, 0.2, -1.0];
    const katkilar = [katkiVektoru(1.8), katkiVektoru(0.4), katkiVektoru(-0.2), katkiVektoru(0.1)];
    const sonuc = marketBlindOlasiliklariHesapla(skorlar, katkilar, 0.7);
    expect(sonuc.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 8);
  });

  it("AGF katkısı çıkarılınca favori değişebilir (basit ölçekleme DEĞİL)", () => {
    // Ham skorda 1. at önde, ama bu farkın tamamı AGF katkısından geliyor —
    // AGF çıkarılınca 2. at öne geçmeli.
    const skorlar = [3.0, 2.8];
    const katkilar = [katkiVektoru(1.0), katkiVektoru(0.0)];
    const sonuc = marketBlindOlasiliklariHesapla(skorlar, katkilar, 0.7);
    expect(sonuc[1]).toBeGreaterThan(sonuc[0]);
  });
});
