import { describe, it, expect } from "vitest";
import { formOrtalamasi, kgsLog, cinsE } from "./ham-alan-sinyalleri";

describe("formOrtalamasi", () => {
  it("son 6 derecenin ortalaması, 0 hanesi 10 sayılır", () => {
    expect(formOrtalamasi("229810")).toBeCloseTo((2 + 2 + 9 + 8 + 1 + 10) / 6, 10);
    expect(formOrtalamasi("111111")).toBe(1);
  });
  it("yalnız ilk 6 hane okunur", () => {
    expect(formOrtalamasi("1111119999")).toBe(1);
  });
  it("rakam olmayan karakterler atlanır; hiç derece yoksa null", () => {
    expect(formOrtalamasi("1-3D")).toBeCloseTo(2, 10);
    expect(formOrtalamasi("")).toBeNull();
    expect(formOrtalamasi(null)).toBeNull();
    expect(formOrtalamasi("---")).toBeNull();
  });
  it("6'dan kısa formda eldeki hanelerin ortalaması", () => {
    expect(formOrtalamasi("42")).toBe(3);
  });
});

describe("kgsLog", () => {
  it("log1p, geçersiz/negatif/eksik null", () => {
    expect(kgsLog(0)).toBe(0);
    expect(kgsLog(17)).toBeCloseTo(Math.log(18), 10);
    expect(kgsLog(null)).toBeNull();
    expect(kgsLog(undefined)).toBeNull();
    expect(kgsLog(-1)).toBeNull();
    expect(kgsLog(Number.NaN)).toBeNull();
  });
});

describe("cinsE", () => {
  it("3. kelime e ise 1, başka değerse 0, yoksa null", () => {
    expect(cinsE("3y d e")).toBe(1);
    expect(cinsE("4y d a")).toBe(0);
    expect(cinsE("4y d")).toBeNull();
    expect(cinsE("")).toBeNull();
    expect(cinsE(null)).toBeNull();
    expect(cinsE("  4y   d   e  ")).toBe(1);
  });
});
