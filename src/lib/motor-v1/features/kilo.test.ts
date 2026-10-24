import { describe, expect, it } from "vitest";
import { computeKiloSahaGoreli, computeKiloGecmiseGore, computeKiloMesafeEtkilesimHam, computeKiloHandikapEtkilesimHam } from "./kilo";

describe("computeKiloSahaGoreli (KILO_01)", () => {
  it("medyandan ağır at pozitif, hafif at negatif değer alır", () => {
    const field = [54, 56, 58, 60, 62];
    expect(computeKiloSahaGoreli(62, field).value).toBeCloseTo(4, 10); // medyan=58
    expect(computeKiloSahaGoreli(54, field).value).toBeCloseTo(-4, 10);
  });
  it("kilo bilgisi olmayan atlar medyana DAHİL EDİLMEZ", () => {
    const field = [54, null, 58, null, 62];
    const r = computeKiloSahaGoreli(58, field);
    expect(r.fieldSize).toBe(3); // yalnız 54/58/62
    expect(r.value).toBeCloseTo(0, 10);
  });
  it("kendi kilosu yoksa null, 0 İLE KARIŞTIRILMAZ", () => {
    expect(computeKiloSahaGoreli(null, [54, 56, 58]).value).toBeNull();
  });
});

describe("computeKiloGecmiseGore (KILO_02)", () => {
  const CUTOFF = new Date("2026-10-16T00:00:00.000Z");
  function row(date: string, weight: string) {
    return { date, year: "2026", city: "İstanbul", distance: 1400, surface: "Ç:Normal 3.3", finishPos: "3", time: "1.24.00", weight, equipment: "", jockey: "X", raceNo: "1", classType: "Şartlı 1", trainer: "Y", owner: "Z", hp: "50", ganyan: "2", group: "" };
  }
  it("virgüllü kilo string'i (TJK formatı) doğru sayıya çevrilir", () => {
    const rows = [row("01.09.2026", "57,5"), row("01.08.2026", "57,5")];
    const r = computeKiloGecmiseGore(60, 1, rows, CUTOFF, 120);
    expect(r.rawValue).toBeCloseTo(60 - 57.5, 5);
  });
  it("tjkAtId=null → IDENTITY_UNRESOLVED", () => {
    expect(computeKiloGecmiseGore(60, null, [row("01.09.2026", "57")], CUTOFF, 120).coverageState).toBe("IDENTITY_UNRESOLVED");
  });
  it("geçmiş yoksa TRUE_DEBUTANT", () => {
    expect(computeKiloGecmiseGore(60, 1, [], CUTOFF, 120).coverageState).toBe("TRUE_DEBUTANT");
  });
});

describe("KILO_03/04 — ham etkileşim terimleri (standardizasyon eğitim aşamasında)", () => {
  it("KILO_03: kiloRelative × mesafe", () => {
    expect(computeKiloMesafeEtkilesimHam(2, 1400)).toBeCloseTo(2800, 5);
    expect(computeKiloMesafeEtkilesimHam(null, 1400)).toBeNull();
  });
  it("KILO_04: Handikap DEĞİLSE terim sıfırlanır (farklı sınıflarda AYRI öğrenilebilir)", () => {
    expect(computeKiloHandikapEtkilesimHam(3, true)).toBeCloseTo(3, 10);
    expect(computeKiloHandikapEtkilesimHam(3, false)).toBe(0);
    expect(computeKiloHandikapEtkilesimHam(null, true)).toBeNull();
  });
});
