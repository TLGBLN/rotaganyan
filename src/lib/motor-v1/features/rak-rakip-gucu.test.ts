import { describe, expect, it } from "vitest";
import { computeRakGapForRace, computeRakH2HForRace, type RakGapInput, type RakRunnerInput } from "./rak-rakip-gucu";
import { hizDerecesiHesaplaOrtak } from "@/lib/methodology/hiz-derecesi-hesapla";
import { speedObservedAsOf } from "@/lib/rotaganyan-analiz-motoru/feature-calculators/pit-sire-speed";
import type { PaceIndex, HizGecmisSatir } from "@/lib/methodology/hiz-derecesi-hesapla";

describe("RAK_GAP_01 basic contract", () => {
  it("is unobserved when either side's HIZ_01/SINIF_01 is unobserved", () => {
    const runners: RakGapInput[] = [
      { no: 1, hiz01: null, hiz01Observed: false, sinif01: 50, sinif01Observed: true },
      { no: 2, hiz01: 10, hiz01Observed: true, sinif01: 40, sinif01Observed: true },
    ];
    const out = computeRakGapForRace(runners);
    expect(out.get(1)!.observed).toBe(false);
    expect(out.get(1)!.missingReason).toMatch(/HIZ_01/);
  });

  it("computes in-field gap as Q_i - max rival Q when both sides observed", () => {
    const runners: RakGapInput[] = [
      { no: 1, hiz01: 10, hiz01Observed: true, sinif01: 50, sinif01Observed: true },
      { no: 2, hiz01: 5, hiz01Observed: true, sinif01: 40, sinif01Observed: true },
    ];
    const out = computeRakGapForRace(runners);
    expect(out.get(1)!.rawValue).toBeCloseTo(60 - 45, 12);
    expect(out.get(1)!.observed).toBe(true);
  });
});

describe("P0 RIVAL_GAP data-integrity regression: SPEED and RIVAL_GAP must share the SAME observation gate", () => {
  // Reproduces the exact wiring used by captureD23LiveVectors() in d23-feature-capture.ts:
  // RIVAL_GAP's hiz01 comes from hizDerecesiHesaplaOrtak(), whose SPEED sibling signal is
  // only allowed to be "observed" when speedObservedAsOf() finds a real population match.
  // hizDerecesiHesaplaOrtak() silently returns 0 (NOT null) when there is no usable
  // population comparison at all (sayi===0) -- that 0 is a sentinel, not a real pace score.
  const cutoff = new Date("2026-08-20T00:00:00.000Z");
  const breed = "ARAP";
  // History exists (hist.length>0) but the only matching population bucket has <20 samples,
  // so hizPopulasyonOrtPace() returns null for it -- there is NO valid population baseline.
  const thinBucketIndex: PaceIndex = new Map([
    ["ARAP|Kum|800-1400", Array.from({ length: 19 }, () => ({ tarih: new Date("2026-08-01T00:00:00Z"), pace: 12.5 }))],
  ]);
  const historyWithNoUsableBaseline: HizGecmisSatir[] = [
    { date: "15.08.2026", time: "1.20.00", distance: 1000, surface: "Kum" },
  ];

  it("sanity: history is non-empty but SPEED itself is correctly unobserved", () => {
    expect(historyWithNoUsableBaseline.length).toBeGreaterThan(0);
    expect(speedObservedAsOf(historyWithNoUsableBaseline, breed, cutoff, thinBucketIndex)).toBe(false);
    // The raw pace helper falls back to 0 when there is nothing to compare against --
    // this 0 is NOT a measured "exactly average" speed, it is "no data".
    expect(hizDerecesiHesaplaOrtak(historyWithNoUsableBaseline, breed, cutoff, thinBucketIndex)).toBe(0);
  });

  it("BUG (pre-fix): gating RIVAL_GAP's hiz01Observed on hist.length>0 instead of speedObservedAsOf() " +
    "lets a fabricated 0 pace masquerade as an observed, average-pace horse", () => {
    const value = hizDerecesiHesaplaOrtak(historyWithNoUsableBaseline, breed, cutoff, thinBucketIndex);
    const legacyLenientObserved = historyWithNoUsableBaseline.length > 0; // the old d23-feature-capture.ts v1Observed gate
    const runners: RakGapInput[] = [
      { no: 1, hiz01: value, hiz01Observed: legacyLenientObserved, sinif01: 55, sinif01Observed: true },
      { no: 2, hiz01: 20, hiz01Observed: true, sinif01: 40, sinif01Observed: true },
    ];
    const out = computeRakGapForRace(runners);
    // This is the bug: runner 1 has NO real speed evidence, yet RAK_GAP_01 reports a
    // confident observed gap built on a fabricated average-pace value.
    expect(out.get(1)!.observed).toBe(true);
    expect(out.get(1)!.rawValue).toBe((0 + 55) - (20 + 40));
  });

  it("FIX: gating RIVAL_GAP's hiz01Observed on the SAME speedObservedAsOf() criterion as SPEED " +
    "correctly marks the gap unobserved instead of using the fabricated 0", () => {
    const value = hizDerecesiHesaplaOrtak(historyWithNoUsableBaseline, breed, cutoff, thinBucketIndex);
    const correctObserved = speedObservedAsOf(historyWithNoUsableBaseline, breed, cutoff, thinBucketIndex);
    const runners: RakGapInput[] = [
      { no: 1, hiz01: value, hiz01Observed: correctObserved, sinif01: 55, sinif01Observed: true },
      { no: 2, hiz01: 20, hiz01Observed: true, sinif01: 40, sinif01Observed: true },
    ];
    const out = computeRakGapForRace(runners);
    expect(out.get(1)!.observed).toBe(false);
    expect(out.get(1)!.rawValue).toBeNull();
    expect(out.get(1)!.missingReason).toMatch(/HIZ_01/);
  });

  it("when SPEED genuinely has a usable population match, the two criteria agree and RIVAL_GAP stays observed", () => {
    // Population average pace (12.0) differs from this horse's own pace (1000m/79s=12.66),
    // so a non-zero, genuinely-measured difference is expected -- not the hizDerecesiHesaplaOrtak
    // sentinel 0 that stands for "no usable comparison at all".
    const richIndex: PaceIndex = new Map([
      ["ARAP|Kum|800-1400", Array.from({ length: 25 }, () => ({ tarih: new Date("2026-08-01T00:00:00Z"), pace: 12.0 }))],
    ]);
    const history: HizGecmisSatir[] = [{ date: "15.08.2026", time: "1.19.00", distance: 1000, surface: "Kum" }];
    const value = hizDerecesiHesaplaOrtak(history, breed, cutoff, richIndex);
    const legacy = history.length > 0;
    const fixed = speedObservedAsOf(history, breed, cutoff, richIndex);
    expect(legacy).toBe(fixed); // no divergence once the population baseline is real
    expect(fixed).toBe(true);
    expect(value).not.toBe(0);
  });
});

describe("RAK_H2H_01 basic contract (unrelated to the RIVAL_GAP wiring bug, included for family context)", () => {
  it("is unobserved for a debutant with no history at all", () => {
    const runners: RakRunnerInput[] = [
      { no: 1, name: "A", tjkAtId: 1, rowsJson: [] },
      { no: 2, name: "B", tjkAtId: 2, rowsJson: [] },
    ];
    const out = computeRakH2HForRace(runners, new Date("2026-08-20"));
    expect(out.get(1)!.observed).toBe(false);
    expect(out.get(1)!.coverageState).toBe("TRUE_DEBUTANT");
  });
});
