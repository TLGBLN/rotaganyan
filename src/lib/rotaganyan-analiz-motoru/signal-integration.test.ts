import { describe, expect, it } from "vitest";
import { SIGNAL_SPECS, buildUnifiedSignalVector, type SignalObservation } from "./signal-integration";

const input = (source: SignalObservation["source"], code: string, raw: number | null, observed = true): SignalObservation => ({
  source, code, raw, observed, asOfSafe: true, reliability: observed ? 0.8 : 0,
});

describe("ROTAGANYAN stage-1 unified signal integration", () => {
  it("documents all Saf D and V1 codes with no repeated source key", () => {
    expect(SIGNAL_SPECS.filter(s => s.source === "D")).toHaveLength(15);
    expect(SIGNAL_SPECS.filter(s => s.source === "V1")).toHaveLength(47);
    expect(new Set(SIGNAL_SPECS.map(s => s.source + ":" + s.code)).size).toBe(62);
  });

  it("never double-counts Saf speed and V1 speed", () => {
    const result = buildUnifiedSignalVector([input("D", "hizDerecesi", 2), input("V1", "HIZ_01", 3)]);
    expect(result.features).toHaveLength(1);
    expect(result.features[0].canonical).toBe("SPEED");
    expect(result.features[0].sourceCode).toBe("hizDerecesi");
    expect(result.diagnostics).toHaveLength(1);
  });

  it("retains independent jockey and weight information", () => {
    const result = buildUnifiedSignalVector([
      input("D", "idmJokey", 1),
      input("V1", "JOKEY_01", 0.12),
      input("V1", "KILO_01", -1.5),
    ]);
    expect(result.features.map(f => f.canonical)).toEqual(["IDMAN_JOCKEY", "JOCKEY_OE30", "FIELD_WEIGHT_DELTA"]);
  });

  it("rejects fabricated raw for missing observations", () => {
    expect(() => buildUnifiedSignalVector([input("V1", "GEN_DAM_01", 0, false)])).toThrow(/Unobserved signal must be null/);
    const valid = buildUnifiedSignalVector([input("V1", "GEN_DAM_01", null, false)]);
    expect(valid.features[0]).toMatchObject({ raw: null, observed: false, reliability: 0 });
  });

  it("rejects future or post-race data", () => {
    expect(() => buildUnifiedSignalVector([{ ...input("V1", "JOKEY_01", 0.12), asOfSafe: false }])).toThrow(/Point-in-time unsafe/);
  });

  it("prevents suspicious pedigree interactions and DAV bug from entering a score", () => {
    const result = buildUnifiedSignalVector([
      input("V1", "GEN_SIRE_PMZ_01", 1.2),
      input("V1", "GEN_PMZ_YET_01", 2.1),
      input("V1", "DAV_TAKI_CIKARILDI", 0),
      input("V1", "JOKEY_03", null, false),
    ]);
    expect(result.features).toHaveLength(0);
    expect(result.diagnostics).toHaveLength(4);
  });
});