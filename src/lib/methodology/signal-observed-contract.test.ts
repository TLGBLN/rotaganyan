import { describe, expect, it } from "vitest";
import {
  classifySignalStatus,
} from "./signal-status";
import {
  isIntegrityEligibleSignal,
} from "./signal-registry";
import type { V461FeatureDetay } from "./v546-1-engine";

function f(
  ad: string,
  evidenceObserved?: boolean
): V461FeatureDetay {
  const base = {
    ad,
    raw: 0,
    observed: true,
    reliability: 1,
    z: 0,
    beta: 0,
    contribution: 0,
  };

  return Object.assign(
    base,
    evidenceObserved == null
      ? {}
      : { evidenceObserved }
  ) as unknown as V461FeatureDetay;
}

describe("true observed evidence contract", () => {
  for (const code of [
    "zeminToleransi",
    "takiDegisikligi",
    "sireOrani",
  ]) {
    it(`${code}: false metadata => INSUFFICIENT_DATA`, () => {
      expect(
        classifySignalStatus(f(code, false))
      ).toBe("INSUFFICIENT_DATA");
    });

    it(`${code}: true metadata => USED`, () => {
      expect(
        classifySignalStatus(f(code, true))
      ).toBe("USED");
    });
  }

  it("yarisGidisatiSkoru uses its fresh feature metadata", () => {
    expect(
      classifySignalStatus(
        f("yarisGidisatiSkoru", false),
        { yarisGidisatiGozlemli: true }
      )
    ).toBe("INSUFFICIENT_DATA");

    expect(
      classifySignalStatus(
        f("yarisGidisatiSkoru", true),
        { yarisGidisatiGozlemli: false }
      )
    ).toBe("USED");
  });

  it("weak/provisional signals do not vote in placement integrity", () => {
    for (const code of [
      "zeminToleransi",
      "sonIdmanSprint",
      "takiDegisikligi",
      "sireOrani",
      "PS_front",
      "PS_lone",
      "PS_closerFit",
    ]) {
      expect(
        isIntegrityEligibleSignal(code)
      ).toBe(false);
    }
  });
});