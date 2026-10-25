import { describe, expect, it } from "vitest";
import { parseSurface, surfaceFamilyToEnum } from "./surface-classifier";

// 2026-10-17 — bu 37 değer gerçek production verisinden (300 at, 14.128 satır) örneklendi
// (bkz. diag-motor-v1-surface-values.mts); listedeki HER değer bu test dosyasında temsil
// edilir, UYDURMA değer YOKTUR.
const REAL_SAMPLED_VALUES = [
  "K:Normal",
  "Ç:Normal 3.3",
  "S:Normal",
  "K:Nemli",
  "K:Islak",
  "K:Sulu",
  "Ç:Biraz Yumuşak 3.4",
  "S:",
  "Ç:Yumuşak 3.5",
  "Ç:Çok Yumuşak 4",
  "Ç:Yumuşak 3.7",
  "Ç:Çok Yumuşak 3.8",
  "S:Nemli",
  "Ç:Çok Yumuşak 3.9",
  "Ç:Yumuşak 3.6",
  "Ç:Çok Yumuşak 4.2",
  "S:Islak",
  "Ç:Çok Yumuşak 4.1",
  "Ç:Ağır 4.5",
  "Ç:Çok Yumuşak 4.3",
  "Ç:Biraz Ağır 4.4",
  "Ç:Ağır 4.6",
  "K:",
  "Ç:Ağır 4.7",
  "Ç:Normal 3.2",
  "Ç:Ağır 4.8",
  "Ç:Çok Ağır 6",
  "Ç:Ağır 4.9",
  "Ç:Çok Ağır 5.5",
  "S:Sulu",
  "Ç:Çok Ağır 5.3",
  "Ç:Çok Ağır 5.2",
  "Ç:Çok Ağır 5.8",
  "Ç:Çok Ağır 6.2",
  "Ç:Çok Ağır 5.6",
  "Ç:Çok Ağır 5.1",
  "Ç:Ağır 4.4",
  "Ç:Çok Ağır 5.9",
];

describe("parseSurface — gerçek veri kapsama (37/37 değer PARSED olmalı)", () => {
  it("örneklenen HER değer PARSED döner, UNKNOWN yok", () => {
    for (const raw of REAL_SAMPLED_VALUES) {
      const r = parseSurface(raw);
      expect(r.parseStatus, `beklenmeyen UNKNOWN: "${raw}"`).toBe("PARSED");
      expect(r.surfaceFamily).not.toBeNull();
    }
  });
});

describe("parseSurface — aile/durum/going ayrıştırması", () => {
  it("K:Normal → KUM, condition=Normal, goingValue=null", () => {
    const r = parseSurface("K:Normal");
    expect(r.surfaceFamily).toBe("KUM");
    expect(r.condition).toBe("Normal");
    expect(r.goingValue).toBeNull();
  });
  it("Ç:Normal 3.3 → CIM, condition=Normal, goingValue=3.3", () => {
    const r = parseSurface("Ç:Normal 3.3");
    expect(r.surfaceFamily).toBe("CIM");
    expect(r.condition).toBe("Normal");
    expect(r.goingValue).toBeCloseTo(3.3, 10);
  });
  it("Ç:Biraz Ağır 4.4 → çok kelimeli durum ADI KIRPILMADAN yakalanır", () => {
    const r = parseSurface("Ç:Biraz Ağır 4.4");
    expect(r.condition).toBe("Biraz Ağır");
    expect(r.goingValue).toBeCloseTo(4.4, 10);
  });
  it("S: (boş durum) → SENTETIK, condition=null, UNKNOWN DEĞİL", () => {
    const r = parseSurface("S:");
    expect(r.surfaceFamily).toBe("SENTETIK");
    expect(r.condition).toBeNull();
    expect(r.parseStatus).toBe("PARSED");
  });
  it("PMZ düzeltme #5 (kullanıcı talimatı 2026-10-17): boş zemin durumu 'Normal' DEĞİLDİR — null ile 'Normal' KARIŞTIRILMAMALI", () => {
    expect(parseSurface("K:").condition).not.toBe("Normal");
    expect(parseSurface("S:").condition).not.toBe("Normal");
    expect(parseSurface("K:Normal").condition).toBe("Normal"); // GERÇEKTEN "Normal" yazan satır farklı, DOĞRU ayrıştırılır
    expect(parseSurface("K:").condition).not.toBe(parseSurface("K:Normal").condition);
  });
  it("Çim, Kum ve Sentetik OTOMATİK EŞDEĞER sayılmaz — farklı aileler üretir", () => {
    expect(parseSurface("Ç:Normal 3.3").surfaceFamily).not.toBe(parseSurface("K:Normal").surfaceFamily);
    expect(parseSurface("K:Normal").surfaceFamily).not.toBe(parseSurface("S:Normal").surfaceFamily);
  });
});

describe("parseSurface — gerçekten tanınmayan girdi", () => {
  it("boş string → UNKNOWN", () => {
    expect(parseSurface("").parseStatus).toBe("UNKNOWN");
  });
  it("tire/eksik işareti → UNKNOWN", () => {
    expect(parseSurface("—").parseStatus).toBe("UNKNOWN");
  });
  it("bilinmeyen harf öneki → UNKNOWN", () => {
    expect(parseSurface("X:Normal").parseStatus).toBe("UNKNOWN");
  });
});

describe("surfaceFamilyToEnum", () => {
  it("Prisma Surface enum değerleriyle birebir eşleşir", () => {
    expect(surfaceFamilyToEnum("CIM")).toBe("CIM");
    expect(surfaceFamilyToEnum("KUM")).toBe("KUM");
    expect(surfaceFamilyToEnum("SENTETIK")).toBe("SENTETIK");
  });
});
