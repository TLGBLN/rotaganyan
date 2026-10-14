import { describe, expect, it } from "vitest";
import { classifyAllSignals, classifySignalStatus } from "./signal-status";
import type { V461FeatureDetay } from "./v546-1-engine";

const f = (ad: string, observed = true, contribution = 0.1) =>
  ({ ad, observed, raw: 1, z: 1, beta: 0.1, reliability: 1, contribution } as unknown as V461FeatureDetay);

describe("signal-status", () => {
  it("yakinsama2Plus is LEGACY", () => {
    expect(classifySignalStatus(f("yakinsama2Plus"))).toBe("LEGACY");
  });

  it("live gidisat observed => USED", () => {
    expect(
      classifySignalStatus(f("yarisGidisatiSkoru"), {
        yarisGidisatiGozlemli: true,
      })
    ).toBe("USED");
  });

  it("live gidisat missing => INSUFFICIENT_DATA", () => {
    expect(
      classifySignalStatus(f("yarisGidisatiSkoru"), {
        yarisGidisatiGozlemli: false,
      })
    ).toBe("INSUFFICIENT_DATA");
  });

  it("normal observed semantics are preserved", () => {
    expect(classifyAllSignals([f("hizDerecesi", true)])[0].status).toBe("USED");
    expect(classifyAllSignals([f("hizDerecesi", false)])[0].status).toBe("INSUFFICIENT_DATA");
  });
});