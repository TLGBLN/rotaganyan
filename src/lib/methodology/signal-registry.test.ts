import { describe, expect, it } from "vitest";
import {
  SIGNAL_REGISTRY,
  LEGACY_COMPOSITES,
  PRODUCTION_FEATURE_CODES,
  CURRENT_ANALYSIS_SOURCE_CODES,
  FUTURE_CANDIDATE_CODES,
  CURRENT_INTEGRITY_ELIGIBLE_CODES,
} from "./signal-registry";

describe("canonical signal registry", () => {
  it("has exactly 35 atomic signals (23 donmuş + 12 canlı Saf Model sinyali, 2026-11-13)", () => {
    expect(SIGNAL_REGISTRY).toHaveLength(35);
    expect(new Set(SIGNAL_REGISTRY.map((s) => s.code)).size).toBe(35);
  });

  it("keeps production at 19 technical features", () => {
    expect(PRODUCTION_FEATURE_CODES).toHaveLength(19);
  });

  it("has 32 current analysis sources and 3 future candidates", () => {
    expect(CURRENT_ANALYSIS_SOURCE_CODES).toHaveLength(32);
    expect(FUTURE_CANDIDATE_CODES).toHaveLength(3);
  });

  it("keeps yakinsama2Plus only as one legacy composite", () => {
    expect(LEGACY_COMPOSITES).toEqual(["yakinsama2Plus"]);
    expect(SIGNAL_REGISTRY.some((s) => s.code === "yakinsama2Plus")).toBe(false);
  });

  it("does not use unresolved/formula-pending signals for integrity decisions", () => {
    for (const code of [
      "zeminToleransi",
      "takiDegisikligi",
      "sireOrani",
      "PS_front",
      "PS_lone",
      "PS_closerFit",
    ]) {
      expect(CURRENT_INTEGRITY_ELIGIBLE_CODES).not.toContain(code);
    }
  });
});

import safW from "@/lib/methodology/weights/v546-1-saf-weights.json";
import segA from "@/lib/methodology/weights/v546-1-saf-segment-dusuk-deneyim.json";
import segB from "@/lib/methodology/weights/v546-1-saf-segment-dusuk-deneyim-acc.json";
import { familyOfSignal } from "./evidence-families";

describe("KORUMA: canlı modellerin her sinyali kayıt defterinde ve bir kanıt ailesinde olmalı", () => {
  // 2026-11-13 Bursa K1 vakası: hpRel/kgsLog/fMean/jokeyPIT… modele eklenmişti ama aile haritasında yoktu → panelin "güçlü pozitif/negatif"
  // açıklaması modelin gerçek sürücülerini göstermiyordu. Yeni bir model sinyali eklenip aile/kayıt defteri güncellenmezse bu test kırılır.
  for (const [ad, w] of [["varsayılan model", safW], ["segment: düşük deneyim", segA], ["segment: düşük deneyim ACC", segB]] as const) {
    it(`${ad}: tüm featureNames kayıt defterinde ve bir aileye bağlı`, () => {
      const kodlar = new Set(SIGNAL_REGISTRY.map((s) => s.code));
      const eksikKayit = (w as { featureNames: string[] }).featureNames.filter((f) => !kodlar.has(f));
      const eksikAile = (w as { featureNames: string[] }).featureNames.filter((f) => familyOfSignal(f) == null);
      expect(eksikKayit, "kayıt defterinde olmayan sinyaller").toEqual([]);
      expect(eksikAile, "kanıt ailesi olmayan sinyaller").toEqual([]);
    });
  }
});
