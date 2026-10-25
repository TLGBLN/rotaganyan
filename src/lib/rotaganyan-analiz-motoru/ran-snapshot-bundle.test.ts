import { describe, expect, it } from "vitest";
import { computePreRaceDataSnapshotId, type RanSignalSnapshotEntry } from "./snapshot-integrity";
import { UNIFIED_MODEL_CODES } from "./unified-model-codes";
import {
  buildRanSnapshotBundle, verifyRanSnapshotBundle, readRanSnapshotBundle,
  type RanBundleLeg, type RanSnapshotBundle,
} from "./ran-snapshot-bundle";

const ts = "2026-10-25T12:30:00.000Z";
function leg(raceNo: number, weights: [number, number] = [0.65, 0.35]): RanBundleLeg {
  const raceId = "race-" + raceNo;
  return {
    raceId, raceNo,
    runners: weights.map((p, i) => {
      const no = i + 1;
      const signals: RanSignalSnapshotEntry[] = UNIFIED_MODEL_CODES.map((code) => ({
        code, family: "TEST", raw: no, observed: true, reliability: 1,
        coverageState: null, modelVersion: "v1", standardizedValue: 1,
        learnedCoefficient: 0, scoreContribution: 0,
        missingIndicatorCoefficient: 0, missingIndicatorContribution: 0,
      }));
      return {
        raceId, no, name: "Horse " + no, runnerId: "runner-" + raceNo + "-" + no,
        engineVersion: "1.0", weightsFingerprint: "same-model",
        generatedAt: ts, originalRank: no, publishedRank: no, winProbability: p,
        finalScore: 0, featureCodeOrder: UNIFIED_MODEL_CODES,
        preRaceDataSnapshotId: computePreRaceDataSnapshotId(raceId, signals),
        signals, ekuriGroup: null,
      };
    }),
  };
}
const six = () => Array.from({length: 6}, (_,i)=>leg(i+1));

describe("RAN immutable analysis/ranking/coupon bundle", () => {
  it("all six analyses and six coupon legs use one identical snapshot identity", () => {
    const input = six();
    const b=buildRanSnapshotBundle(input, 20, ts);
    const view=readRanSnapshotBundle(b);
    expect(view.bundleKey).toBe(b.bundleKey);
    expect(view.analyses).toHaveLength(6);
    expect(Object.keys(view.coupon.secimler)).toHaveLength(6);
    expect(view.coupon.toplamKombinasyon).toBeLessThanOrEqual(20);
    for(const a of view.analyses) {
      const selected=view.coupon.secimler[a.raceNo];
      expect(selected.length).toBeGreaterThan(0);
      expect(selected.every(no=>a.ranked.some(r=>r.no===no))).toBe(true);
    }
    expect(buildRanSnapshotBundle(six(),20,ts).bundleKey).toBe(b.bundleKey);
  });
  it("mutating original inputs cannot change the frozen stored content", () => {
    const input=six();
    const b=buildRanSnapshotBundle(input,20,ts);
    input[0].runners[0].winProbability=0.01;
    expect(b.legs[0].runners[0].winProbability).toBe(0.65);
    verifyRanSnapshotBundle(b);
  });
  it("tampered coupon or score fails closed, never silently recalculated", () => {
    const b=buildRanSnapshotBundle(six(),20,ts);
    const tampered=JSON.parse(JSON.stringify(b)) as RanSnapshotBundle;
    tampered.coupon.secimler[1]=[99];
    expect(()=>readRanSnapshotBundle(tampered)).toThrow(/RAN_BUNDLE_INTEGRITY/);
    const tampered2=JSON.parse(JSON.stringify(b)) as RanSnapshotBundle;
    tampered2.legs[1].runners[0].winProbability=0.60;
    expect(()=>verifyRanSnapshotBundle(tampered2)).toThrow(/RAN_BUNDLE_INTEGRITY/);
  });
  it("mixing a different model fingerprint or mismatched race time is rejected", () => {
    const inputs=six();
    inputs[1].runners[0].weightsFingerprint="another-model";
    expect(()=>buildRanSnapshotBundle(inputs,20,ts)).toThrow(/mixed model/);
    const another=six();
    another[0].runners[1].generatedAt="2026-10-25T12:30:01.000Z";
    expect(()=>buildRanSnapshotBundle(another,20,ts)).toThrow(/mixed race timestamps/);
  });
  it("RAN preRaceDataSnapshotId must match actual raw features", () => {
    const input=six();
    input[0].runners[0].signals[0].raw=666;
    expect(()=>buildRanSnapshotBundle(input,20,ts)).toThrow(/raw source hash/);
  });
  it("manual publishedRank override stays separate from originalRank", () => {
    const inputs=six();
    inputs[0].runners[0].publishedRank=2;
    inputs[0].runners[1].publishedRank=1;
    const b=buildRanSnapshotBundle(inputs,20,ts);
    const a=readRanSnapshotBundle(b).analyses[0];
    expect(a.ranked[0].no).toBe(2);
    expect(a.ranked[0].originalRank).toBe(2);
    expect(a.ranked[1].originalRank).toBe(1);
  });
});
