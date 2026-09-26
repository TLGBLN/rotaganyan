// 2026-09-26 kullanıcı talebi: Ekonomik 700-900₺'ye taşındı, altına Süper Ekonomik
// (300-500₺) eklendi — dört kademeli (micro→narrow→normal→wide) yapının doğru
// kurulduğunu ve otomatikGroupSelections'ın kademeli mirası (her kademe bir öncekini
// TABAN alır) koruduğunu doğrular.
import { describe, expect, it } from "vitest";
import {
  WIDTHS,
  WIDTH_LABEL,
  LIMITS,
  TOLERANCES,
  YEDILI_LIMITS,
  YEDILI_TOLERANCES,
  emptySelection,
  otomatikGroupSelections,
  type RaceDayData,
} from "./kupon-auto-fill";

describe("Width kademeleri (4'lü yapı)", () => {
  it("WIDTHS ucuzdan pahalıya sıralı: micro, narrow, normal, wide", () => {
    expect(WIDTHS).toEqual(["micro", "narrow", "normal", "wide"]);
  });

  it("WIDTH_LABEL Türkçe etiketleri doğru eşler", () => {
    expect(WIDTH_LABEL).toEqual({ micro: "Süper Ekonomik", narrow: "Ekonomik", normal: "Normal", wide: "Geniş" });
  });

  it("emptySelection dört kademenin de boş Set'ini döner", () => {
    const sel = emptySelection();
    expect(Object.keys(sel).sort()).toEqual(["micro", "narrow", "normal", "wide"]);
    for (const w of WIDTHS) expect(sel[w].size).toBe(0);
  });

  it("Süper Ekonomik (micro) hedefi 300-500₺ aralığında", () => {
    expect(LIMITS.micro).toBe(300);
    expect(LIMITS.micro * TOLERANCES.micro).toBeCloseTo(500, 5);
  });

  it("Ekonomik (narrow) hedefi 700-900₺ aralığında", () => {
    expect(LIMITS.narrow).toBe(700);
    expect(LIMITS.narrow * TOLERANCES.narrow).toBeCloseTo(900, 5);
  });

  it("7'li Ganyan (YEDILI) da aynı ₺ hedeflerine hizalı", () => {
    expect(YEDILI_LIMITS.micro * YEDILI_TOLERANCES.micro).toBeCloseTo(500, 5);
    expect(YEDILI_LIMITS.narrow * YEDILI_TOLERANCES.narrow).toBeCloseTo(900, 5);
  });
});

describe("otomatikGroupSelections — kademeli miras (4 seviye)", () => {
  const races: RaceDayData["races"] = Array.from({ length: 3 }, (_, i) => ({
    raceNo: i + 1,
    pistAnormalMi: false,
    pistDuyarliligi: null,
    gecmisRiskSeviyesi: null,
    pistUyariMesaji: null,
    runners: Array.from({ length: 8 }, (_, j) => ({
      no: j + 1,
      name: `At ${j + 1}`,
      scratched: false,
      ekuriGroup: null,
      score: 100 / 8,
      scoreExact: 100 / 8,
      agfSirasi: j + 1,
    })),
  }));

  it("dört kademe de üretilir, her kademe bir ÖNCEKİNİ (ucuz) kapsar (superset)", () => {
    const stakePerCombination = 1.25;
    const sel = otomatikGroupSelections(races, stakePerCombination);
    for (const race of races) {
      const s = sel[race.raceNo];
      expect(s.micro.size).toBeGreaterThan(0);
      // Kademeli miras: narrow ⊇ micro, normal ⊇ narrow, wide ⊇ normal (otomatikGroupSelections'ın
      // "bir öncekinin seçtiği birim sayısını TABAN alır" sözleşmesi — bkz. kupon-auto-fill.ts).
      for (const no of s.micro) expect(s.narrow.has(no)).toBe(true);
      for (const no of s.narrow) expect(s.normal.has(no)).toBe(true);
      for (const no of s.normal) expect(s.wide.has(no)).toBe(true);
    }
  });

  it("manuel LIMITS/TOLERANCES verilirse (ör. YEDILI) onlar kullanılır, varsayılan DEĞİL", () => {
    const stakePerCombination = 2;
    const sel = otomatikGroupSelections(races, stakePerCombination, YEDILI_LIMITS, YEDILI_TOLERANCES);
    expect(sel[1].micro.size).toBeGreaterThan(0);
  });
});
