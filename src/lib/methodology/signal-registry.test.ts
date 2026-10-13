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
  it("has exactly 23 atomic signals", () => {
    expect(SIGNAL_REGISTRY).toHaveLength(23);
    expect(new Set(SIGNAL_REGISTRY.map((s) => s.code)).size).toBe(23);
  });

  it("keeps production at 19 technical features", () => {
    expect(PRODUCTION_FEATURE_CODES).toHaveLength(19);
  });

  it("has 20 current analysis sources and 3 future candidates", () => {
    expect(CURRENT_ANALYSIS_SOURCE_CODES).toHaveLength(20);
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