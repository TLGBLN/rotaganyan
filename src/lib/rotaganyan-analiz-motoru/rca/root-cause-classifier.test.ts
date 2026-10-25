import { describe, it, expect } from "vitest";
import { computeDemotionDrivers, classifyDemotion, type SignalEffectRowLike } from "./root-cause-classifier";

function row(code: string, overrides: Partial<SignalEffectRowLike> = {}): SignalEffectRowLike {
  return {
    code,
    rawValue: 1,
    standardizedValue: 0.5,
    learnedCoefficient: 0.3,
    scoreContribution: 0.15,
    missingIndicatorCoefficient: 0,
    missingIndicatorContribution: 0,
    observed: true,
    ...overrides,
  };
}

describe("computeDemotionDrivers", () => {
  it("rakip-kazanan farkını koda göre doğru hesaplar ve büyükten küçüğe sıralar", () => {
    const winner = [row("A", { scoreContribution: 0.1 }), row("B", { scoreContribution: 0.4 })];
    const rival = [row("A", { scoreContribution: 0.5 }), row("B", { scoreContribution: 0.35 })];
    const drivers = computeDemotionDrivers(winner, rival);
    expect(drivers[0].code).toBe("A"); // 0.5-0.1=0.4, en büyük fark
    expect(drivers[0].delta).toBeCloseTo(0.4, 5);
    expect(drivers[1].code).toBe("B");
    expect(drivers[1].delta).toBeCloseTo(-0.05, 5); // kazanan bu kodda zaten önde
  });

  it("ortak olmayan kodları (bir tarafta yok) atlar", () => {
    const winner = [row("A"), row("ONLY_WINNER")];
    const rival = [row("A"), row("ONLY_RIVAL")];
    const drivers = computeDemotionDrivers(winner, rival);
    expect(drivers.map((d) => d.code)).toEqual(["A"]);
  });
});

describe("classifyDemotion", () => {
  const betaPool = [0.5, 0.45, 0.4, 0.35, 0.3, 0.25, 0.2, 0.15, 0.1, 0.05, 0.02, 0.01];

  it("saha düzse (olasılık yayılımı < 0.08) AYIRT_EDILEMEDI döner", () => {
    const drivers = [{ code: "A", winnerTotal: 0.1, rivalTotal: 0.2, delta: 0.1 }];
    const result = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map([["A", row("A", { observed: true, learnedCoefficient: 0.3 })]]),
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.05,
    });
    expect(result.category).toBe("AYIRT_EDILEMEDI");
  });

  it("sürücü yoksa AYIRT_EDILEMEDI döner", () => {
    const result = classifyDemotion({
      drivers: [],
      winnerRowsByCode: new Map(),
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.5,
    });
    expect(result.category).toBe("AYIRT_EDILEMEDI");
  });

  it("en büyük sürücü winner için observed=false ise GORULMEDI döner", () => {
    const drivers = [{ code: "MISSING_CODE", winnerTotal: 0, rivalTotal: 0.5, delta: 0.5 }];
    const result = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map([["MISSING_CODE", row("MISSING_CODE", { observed: false, scoreContribution: 0, rawValue: null })]]),
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.5,
    });
    expect(result.category).toBe("GORULMEDI");
    expect(result.topDriverCode).toBe("MISSING_CODE");
  });

  it("alt-formül çapraz doğrulaması çelişki buluyorsa YANLIS_OKUNDU döner (observed=true olsa bile)", () => {
    const drivers = [{ code: "PS_lone", winnerTotal: -0.2, rivalTotal: 0.3, delta: 0.5 }];
    const result = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map([["PS_lone", row("PS_lone", { observed: true, learnedCoefficient: 0.3 })]]),
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.5,
      topDriverHasAltDisagreement: true,
    });
    expect(result.category).toBe("YANLIS_OKUNDU");
  });

  it("gözlendi ama |β| alt-çeyrekteyse (model zaten az ağırlık veriyor) EZILDI döner", () => {
    const drivers = [{ code: "WEAK_CODE", winnerTotal: 0, rivalTotal: 0.3, delta: 0.3 }];
    const result = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map([["WEAK_CODE", row("WEAK_CODE", { observed: true, learnedCoefficient: 0.01 })]]), // betaPool alt-%25'inde
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.5,
    });
    expect(result.category).toBe("EZILDI");
  });

  it("tek sürücü farkın küçük bir payını açıklıyorsa (birçok küçük sinyal) GOLGELENDI döner", () => {
    const drivers = [
      { code: "A", winnerTotal: 0, rivalTotal: 0.05, delta: 0.05 },
      { code: "B", winnerTotal: 0, rivalTotal: 0.05, delta: 0.05 },
      { code: "C", winnerTotal: 0, rivalTotal: 0.05, delta: 0.05 },
      { code: "D", winnerTotal: 0, rivalTotal: 0.05, delta: 0.05 },
      { code: "E", winnerTotal: 0, rivalTotal: 0.05, delta: 0.05 },
    ]; // her biri toplamın %20'si — hiçbiri %30 eşiğini geçmiyor
    const result = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map([["A", row("A", { observed: true, learnedCoefficient: 0.3 })]]),
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.5,
    });
    expect(result.category).toBe("GOLGELENDI");
  });

  it("tek sürücü baskın + gözlendi + ağırlık normal + alt-çelişki yoksa GOLGELENDI döner (gerçek yarış-günü farkı, kusur bulunamadı)", () => {
    const drivers = [{ code: "DOMINANT", winnerTotal: 0, rivalTotal: 0.5, delta: 0.5 }];
    const result = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map([["DOMINANT", row("DOMINANT", { observed: true, learnedCoefficient: 0.4 })]]), // üst-çeyrekte
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.5,
      topDriverHasAltDisagreement: false,
    });
    expect(result.category).toBe("GOLGELENDI");
    expect(result.evidence.some((e) => e.includes("kusur"))).toBe(true);
  });

  it("evidence HER ZAMAN Fact/Interpretation/Action etiketli üç satır döner (Kanıt Seviyesi Etiketleme kuralı)", () => {
    const drivers = [{ code: "A", winnerTotal: 0, rivalTotal: 0.5, delta: 0.5 }];
    const result = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map([["A", row("A", { observed: true, learnedCoefficient: 0.4 })]]),
      allAbsBetaForComparison: betaPool,
      fieldProbabilitySpread: 0.5,
    });
    expect(result.evidence.some((e) => e.startsWith("Fact:"))).toBe(true);
    expect(result.evidence.some((e) => e.startsWith("Interpretation:"))).toBe(true);
    expect(result.evidence.some((e) => e.startsWith("Action:"))).toBe(true);
  });
});
