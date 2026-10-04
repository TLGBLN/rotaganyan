import { describe, expect, it } from "vitest";
import { assertBeforeRace, parseTjkDate, tjkTarihMs, tjkTarihOncesiKatiMi, tjkTarihOncesiMi, toTjkDateString } from "./tjk-date";

describe("parseTjkDate", () => {
  it("gg.aa.yyyy → UTC gece yarısı", () => {
    expect(parseTjkDate("04.10.2026")?.toISOString()).toBe("2026-10-04T00:00:00.000Z");
  });
  it("yıl dönüşü", () => {
    expect(parseTjkDate("31.12.2026")?.toISOString()).toBe("2026-12-31T00:00:00.000Z");
    expect(parseTjkDate("01.01.2027")?.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
  it("boşluklu girdiyi kırpar", () => {
    expect(parseTjkDate(" 15.08.2026 ")?.toISOString()).toBe("2026-08-15T00:00:00.000Z");
  });
  it("bozuk biçim → null", () => {
    expect(parseTjkDate("2026-10-04")).toBeNull();
    expect(parseTjkDate("")).toBeNull();
    expect(parseTjkDate("xx.yy.zzzz")).toBeNull();
  });
  it("takvimde olmayan gün/ay → null (sessiz kaymaz)", () => {
    expect(parseTjkDate("32.01.2026")).toBeNull();
    expect(parseTjkDate("31.02.2026")).toBeNull();
  });
  it("tjkTarihMs geçersizde NaN", () => {
    expect(tjkTarihMs("04.10.2026")).toBe(Date.UTC(2026, 9, 4));
    expect(tjkTarihMs("bozuk")).toBeNaN();
  });
  it("toTjkDateString gidiş-dönüş", () => {
    expect(toTjkDateString(new Date("2026-10-04T00:00:00Z"))).toBe("04.10.2026");
  });
});

describe("önceki tarih karşılaştırmaları", () => {
  const hedef = new Date("2026-10-04T00:00:00Z");
  it("aynı gün üretim (fail-open) tarafında geçmiş sayılmaz", () => {
    expect(tjkTarihOncesiMi("04.10.2026", hedef)).toBe(false);
  });
  it("aynı gün araştırma (fail-closed) tarafında geçmiş sayılmaz", () => {
    expect(tjkTarihOncesiKatiMi("04.10.2026", hedef)).toBe(false);
  });
  it("bir gün önce geçmiştir", () => {
    expect(tjkTarihOncesiKatiMi("03.10.2026", hedef)).toBe(true);
  });
  it("yıl dönüşünde doğru sıralar", () => {
    expect(tjkTarihOncesiKatiMi("31.12.2026", new Date("2027-01-01T00:00:00Z"))).toBe(true);
    expect(tjkTarihOncesiKatiMi("01.01.2027", new Date("2026-12-31T00:00:00Z"))).toBe(false);
  });
  it("bozuk tarih: üretim fail-open (kalır), araştırma fail-closed (dışlanır)", () => {
    expect(tjkTarihOncesiMi("bozuk", hedef)).toBe(true);
    expect(tjkTarihOncesiKatiMi("bozuk", hedef)).toBe(false);
  });
});

describe("assertBeforeRace (araştırma kapısı)", () => {
  const hedef = new Date("2026-10-04T00:00:00Z");
  it("önceki gün geçer", () => {
    expect(() => assertBeforeRace("03.10.2026", hedef)).not.toThrow();
  });
  it("aynı gün hata verir", () => {
    expect(() => assertBeforeRace("04.10.2026", hedef)).toThrow(/LEAKAGE_GUARD/);
  });
  it("sonraki gün hata verir", () => {
    expect(() => assertBeforeRace("05.10.2026", hedef)).toThrow(/LEAKAGE_GUARD/);
  });
  it("bozuk tarih hata verir", () => {
    expect(() => assertBeforeRace("bozuk", hedef)).toThrow(/LEAKAGE_GUARD/);
  });
});
