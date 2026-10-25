import { beforeEach, describe, expect, it, vi } from "vitest";

const { safMock, v1Mock } = vi.hoisted(() => ({ safMock: vi.fn(), v1Mock: vi.fn() }));
vi.mock("../feature-calculators/saf-model-signals", () => ({
  computeSafModelSignalsForRace: safMock,
}));
vi.mock("@/lib/motor-v1/engine/unified-family-engine", () => ({
  computeUnifiedFamiliesForRace: v1Mock,
}));

import { crosscheckAlternativeSignals } from "./alt-signal-crosscheck";
import type { UnifiedRawSources } from "../feature-calculators/unified-feature-vector";

const saf = {
  raceId: "r", race: {},
  runners: [
    { no: 1, signals: [{ code: "PS_front", raw: 0.2, observed: true }, { code: "PS_lone", raw: 0.5, observed: true }] },
    { no: 2, signals: [{ code: "PS_front", raw: 0.8, observed: true }, { code: "PS_lone", raw: 0.4, observed: true }] },
    { no: 3, signals: [{ code: "PS_front", raw: 0.4, observed: true }, { code: "PS_lone", raw: 0.1, observed: true }] },
  ],
};
const v1 = [
  { no: 1, unifiedVector: [{ code: "TEMPO_02", rawValue: 0.8, observed: true }, { code: "TEMPO_03", rawValue: 0.1, observed: true }] },
  { no: 2, unifiedVector: [{ code: "TEMPO_02", rawValue: 0.2, observed: true }, { code: "TEMPO_03", rawValue: 0.4, observed: true }] },
  { no: 3, unifiedVector: [{ code: "TEMPO_02", rawValue: 0.4, observed: true }, { code: "TEMPO_03", rawValue: 0.8, observed: true }] },
];

describe("RAN RCA alternative crosscheck reuses existing sources", () => {
  beforeEach(() => {
    safMock.mockReset().mockResolvedValue(saf);
    v1Mock.mockReset().mockResolvedValue(v1);
  });

  it("precomputed ile D/V1 hesaplayıcılarını tekrar ÇAĞIRMAZ", async () => {
    const out = await crosscheckAlternativeSignals("r", undefined, undefined, {
      safResult: saf, v1Results: v1,
    } as unknown as UnifiedRawSources);
    expect(out.get(1)?.length).toBeGreaterThan(0);
    expect(safMock).not.toHaveBeenCalled();
    expect(v1Mock).not.toHaveBeenCalled();
  });

  it("önceden hesaplanan sinyallerle çapraz analiz sonucu eski yolla TAM AYNI", async () => {
    const original = await crosscheckAlternativeSignals("r");
    const fast = await crosscheckAlternativeSignals("r", undefined, undefined, {
      safResult: saf, v1Results: v1,
    } as unknown as UnifiedRawSources);
    expect(fast).toEqual(original);
    expect(safMock).toHaveBeenCalledTimes(1);
    expect(v1Mock).toHaveBeenCalledTimes(1);
  });

  it("kaynak hiç yoksa mevcut boş sonuç korunur", async () => {
    const out = await crosscheckAlternativeSignals("r", undefined, undefined, {
      safResult: null, v1Results: v1,
    } as unknown as UnifiedRawSources);
    expect(out.size).toBe(0);
    expect(safMock).not.toHaveBeenCalled();
  });
});
