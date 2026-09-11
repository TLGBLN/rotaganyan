import { describe, expect, it } from "vitest";
import { optimizeKuponAllocation, type LegProbability } from "./kupon-optimizer";

describe("optimizeKuponAllocation", () => {
  it("bütçeyi asla aşmaz", () => {
    const legs: LegProbability[] = [
      { raceNo: 1, runners: [{ no: 1, olasilik: 0.3 }, { no: 2, olasilik: 0.25 }, { no: 3, olasilik: 0.2 }, { no: 4, olasilik: 0.15 }, { no: 5, olasilik: 0.1 }] },
      { raceNo: 2, runners: [{ no: 1, olasilik: 0.2 }, { no: 2, olasilik: 0.2 }, { no: 3, olasilik: 0.2 }, { no: 4, olasilik: 0.2 }, { no: 5, olasilik: 0.2 }] },
      { raceNo: 3, runners: [{ no: 1, olasilik: 0.5 }, { no: 2, olasilik: 0.3 }, { no: 3, olasilik: 0.2 }] },
    ];
    for (const maxCombinations of [1, 5, 12, 50, 500]) {
      const r = optimizeKuponAllocation(legs, maxCombinations);
      expect(r.toplamKombinasyon).toBeLessThanOrEqual(maxCombinations);
      expect(r.toplamKombinasyon).toBeGreaterThan(0);
    }
  });

  it("bütçe=1 iken her ayakta yalnız en olası atı seçer", () => {
    const legs: LegProbability[] = [
      { raceNo: 1, runners: [{ no: 7, olasilik: 0.4 }, { no: 2, olasilik: 0.3 }, { no: 3, olasilik: 0.3 }] },
      { raceNo: 2, runners: [{ no: 5, olasilik: 0.6 }, { no: 1, olasilik: 0.4 }] },
    ];
    const r = optimizeKuponAllocation(legs, 1);
    expect(r.toplamKombinasyon).toBe(1);
    expect(r.secimler[1]).toEqual([7]);
    expect(r.secimler[2]).toEqual([5]);
    expect(r.kapsamaOlasiligi).toBeCloseTo(0.4 * 0.6, 6);
  });

  it("net favorili (güvenli) bir ayağa fazla kombinasyon harcamaz, belirsiz ayağa harcar", () => {
    // K1 çok net (%80 tek at), K2 tamamen eşit dağılmış (5 at, %20'şer) — bütçe kısıtlıyken
    // optimizer K1'i 1'de bırakıp bütçenin çoğunu K2'ye ayırmalı.
    const legs: LegProbability[] = [
      { raceNo: 1, runners: [{ no: 1, olasilik: 0.8 }, { no: 2, olasilik: 0.1 }, { no: 3, olasilik: 0.1 }] },
      { raceNo: 2, runners: [{ no: 1, olasilik: 0.2 }, { no: 2, olasilik: 0.2 }, { no: 3, olasilik: 0.2 }, { no: 4, olasilik: 0.2 }, { no: 5, olasilik: 0.2 }] },
    ];
    const r = optimizeKuponAllocation(legs, 5);
    expect(r.secimler[1]).toEqual([1]); // K1'de yalnız favori
    expect(r.secimler[2].length).toBe(5); // bütçenin tamamı K2'ye
  });

  it("boş girdi veya geçersiz bütçede boş sonuç döner", () => {
    expect(optimizeKuponAllocation([], 100).toplamKombinasyon).toBe(0);
    expect(optimizeKuponAllocation([{ raceNo: 1, runners: [{ no: 1, olasilik: 1 }] }], 0).toplamKombinasyon).toBe(0);
  });
});
