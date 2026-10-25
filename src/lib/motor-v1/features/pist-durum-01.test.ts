import { describe, expect, it } from "vitest";
import {
  parsePistRejimi,
  hedefPistRejimi,
} from "./pist-durum-01";

describe("PIST_DURUM_01 parser", () => {
  it.each([
    ["Normal 3,3", "NORMAL"],
    ["Biraz Yumuşak", "BIRAZ_YUMUSAK"],
    ["Yumuşak", "YUMUSAK"],
    ["Çok Yumuşak", "COK_YUMUSAK"],
    ["Biraz Ağır", "BIRAZ_AGIR"],
    ["Ağır", "AGIR"],
    ["Çok Ağır 5,4", "COK_AGIR"],
    ["Nemli", "NEMLI"],
    ["Sulu", "SULU"],
    ["Islak", "ISLAK"],
  ] as const)("recognizes %s", (input, expected) => {
    expect(parsePistRejimi(input)).toBe(expected);
  });

  it("does not convert missing data to normal", () => {
    expect(parsePistRejimi(null)).toBeNull();
    expect(parsePistRejimi("")).toBeNull();
    expect(parsePistRejimi("Bilinmeyen")).toBeNull();
  });

  it("selects the correct race surface", () => {
    const conditions = [
      { label: "Çim", detail: "Çok Ağır 5,4" },
      { label: "Kum", detail: "Nemli" },
    ];

    expect(hedefPistRejimi("CIM", conditions))
      .toBe("COK_AGIR");

    expect(hedefPistRejimi("KUM", conditions))
      .toBe("NEMLI");

    expect(hedefPistRejimi("SENTETIK", conditions))
      .toBeNull();
  });

  it("rejects ambiguous surface records", () => {
    expect(hedefPistRejimi("CIM", [
      { label: "Çim", detail: "Normal" },
      { label: "Çim", detail: "Ağır" },
    ])).toBeNull();
  });
});