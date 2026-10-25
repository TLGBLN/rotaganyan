// RAN v1.0: Analiz, siralama ve kupon icin TEK immutable snapshot paketi.
// DB bagimliligi yoktur; canli AGF degisimi veya re-analysis bu paketi degistirmez.
import { createHash } from "node:crypto";
import { optimizeKuponAllocation, type OptimizeResult, type LegProbability } from "@/lib/methodology/kupon-optimizer";
import { computePreRaceDataSnapshotId, sumSnapshotSignalContributions, type RanPredictionSnapshot } from "./snapshot-integrity";
import { UNIFIED_MODEL_CODES } from "./unified-model-codes";

export type RanBundleLeg = {
  raceId: string;
  raceNo: number;
  runners: (RanPredictionSnapshot & { name: string; ekuriGroup?: number | null; scratched?: boolean })[];
};
export type RanFrozenLeg = {
  raceId: string;
  raceNo: number;
  runners: RanBundleLeg["runners"];
};
export type RanSnapshotBundle = {
  schemaVersion: 1;
  sourceProvenance: "NOT_VERIFIED"; // generatedAt or hash alone is not proof of pre-race collection
  bundleKey: string;
  bundleGeneratedAt: string;
  engineVersion: string;
  weightsFingerprint: string;
  couponMaxCombinations: number;
  legs: RanFrozenLeg[];
  coupon: OptimizeResult;
};
function ensure(ok: unknown, message: string): asserts ok {
  if (!ok) throw new Error("RAN_BUNDLE_INTEGRITY: " + message);
}
// PostgreSQL JSONB anahtar siralarini degistirebilir. JSON.stringify(object)
// hash'i bu nedenle sabit degildir; her seviyede anahtar sirasi normalize edilir.
function stableJson(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map((v) => stableJson(v ?? null)).join(",") + "]";
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).filter((k) => record[k] !== undefined).sort()
      .map((k) => JSON.stringify(k) + ":" + stableJson(record[k])).join(",") + "}";
  }
  return JSON.stringify(value);
}
function hash(value: unknown): string {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}
function isExactPermutation(values: number[], n: number): boolean {
  return values.length === n && [...values].sort((a,b) => a-b).every((v,i) => v === i+1);
}
function frozenLegs(input: readonly RanBundleLeg[]): RanFrozenLeg[] {
  ensure(input.length > 0 && input.length <= 7, "leg count must be 1..7");
  const byRaceNo = new Set<number>();
  const byRaceId = new Set<string>();
  const baseline = input[0].runners?.[0];
  ensure(baseline?.engineVersion && baseline.weightsFingerprint, "model identity missing");
  const legs = [...input].sort((a,b) => a.raceNo-b.raceNo);
  for (const leg of legs) {
    ensure(Number.isSafeInteger(leg.raceNo) && leg.raceNo > 0, "raceNo invalid");
    ensure(leg.raceId && !byRaceId.has(leg.raceId) && !byRaceNo.has(leg.raceNo), "duplicate race/raceNo");
    byRaceNo.add(leg.raceNo);
    byRaceId.add(leg.raceId);
    ensure(leg.runners.length >= 2, "race requires >=2 runners");
    const a = leg.runners[0];
    const nos = new Set<number>();
    let pSum = 0;
    for (const r of leg.runners) {
      ensure(r.raceId === leg.raceId && Number.isSafeInteger(r.no) && r.no > 0 && !nos.has(r.no), "runner identity mismatch");
      nos.add(r.no);
      ensure(r.engineVersion === baseline.engineVersion && r.weightsFingerprint === baseline.weightsFingerprint, "mixed model/version");
      ensure(r.generatedAt === a.generatedAt && Number.isFinite(Date.parse(r.generatedAt)), "mixed race timestamps");
      ensure(r.featureCodeOrder.length === UNIFIED_MODEL_CODES.length &&
        r.featureCodeOrder.every((c,i)=>c===UNIFIED_MODEL_CODES[i]), "feature code order mismatch");
      ensure(r.signals.length === UNIFIED_MODEL_CODES.length &&
        r.signals.every((s,i)=>s.code === UNIFIED_MODEL_CODES[i]), "signal list/order mismatch");
      ensure(r.preRaceDataSnapshotId === computePreRaceDataSnapshotId(r.raceId, r.signals), "raw source hash mismatch");
      ensure(Number.isFinite(r.finalScore) &&
        Math.abs(sumSnapshotSignalContributions(r.signals)-r.finalScore) <= 1e-8, "score/contribution mismatch");
      ensure(Number.isFinite(r.winProbability) && r.winProbability >= 0 && r.winProbability <= 1, "probability invalid");
      ensure(r.scratched !== true, "scratched runner included");
      pSum += r.winProbability;
    }
    ensure(Math.abs(pSum-1) < 1e-9, "probability sum !=1");
    // Model softmax'i ile kayitli olasilik ayni olmalı; yalnız toplamin 1 olmasi yetmez.
    const maxScore=Math.max(...leg.runners.map(r=>r.finalScore));
    const expScores=leg.runners.map(r=>Math.exp(r.finalScore-maxScore));
    const expSum=expScores.reduce((a,b)=>a+b,0);
    ensure(Number.isFinite(expSum) && expSum>0, "invalid score distribution");
    ensure(leg.runners.every((r,i)=>Math.abs(r.winProbability-expScores[i]/expSum)<=1e-9),
      "softmax score/probability mismatch");
    ensure(isExactPermutation(leg.runners.map(r=>r.originalRank), leg.runners.length), "originalRank not permutation");
    ensure(isExactPermutation(leg.runners.map(r=>r.publishedRank), leg.runners.length), "publishedRank not permutation");
  }
  // Structured clone severs mutable caller-owned references before freezing the entire result.
  return JSON.parse(JSON.stringify(legs)) as RanFrozenLeg[];
}
export function buildRanSnapshotBundle(
  input: readonly RanBundleLeg[],
  maxCombinations: number,
  bundleGeneratedAt: string
): RanSnapshotBundle {
  ensure(Number.isSafeInteger(maxCombinations) && maxCombinations >= 1, "coupon budget invalid");
  ensure(Number.isFinite(Date.parse(bundleGeneratedAt)), "bundle timestamp invalid");
  const legs = frozenLegs(input);
  const probabilities: LegProbability[] = legs.map(leg=>({
    raceNo: leg.raceNo,
    runners: leg.runners.map(r=>({no:r.no, olasilik:r.winProbability, ekuriGroup:r.ekuriGroup ?? null})),
  }));
  const coupon = optimizeKuponAllocation(probabilities, maxCombinations);
  ensure(coupon.toplamKombinasyon > 0 && coupon.toplamKombinasyon <= maxCombinations, "coupon could not be generated");
  for(const leg of legs) {
    const allowed = new Set(leg.runners.map(r=>r.no));
    ensure((coupon.secimler[leg.raceNo]??[]).length>0 &&
      coupon.secimler[leg.raceNo].every(no=>allowed.has(no)), "coupon runner is absent from snapshot");
  }
  const unsigned = {
    schemaVersion: 1 as const,
    sourceProvenance: "NOT_VERIFIED" as const,
    bundleGeneratedAt, engineVersion: legs[0].runners[0].engineVersion,
    weightsFingerprint: legs[0].runners[0].weightsFingerprint,
    couponMaxCombinations: maxCombinations, legs, coupon,
  };
  return {...unsigned, bundleKey: hash(unsigned)};
}
export function verifyRanSnapshotBundle(bundle: RanSnapshotBundle): void {
  ensure(bundle.schemaVersion === 1, "schemaVersion mismatch");
  ensure(bundle.sourceProvenance === "NOT_VERIFIED", "unknown provenance claim");
  const {bundleKey, ...rest}=bundle;
  ensure(hash(rest) === bundleKey, "bundle mutated after generation");
  const rebuilt=buildRanSnapshotBundle(bundle.legs, bundle.couponMaxCombinations, bundle.bundleGeneratedAt);
  ensure(rebuilt.bundleKey === bundleKey, "score/order/coupon mismatch");
}
/** Analiz ve kupon ayni bundle objesinden okunur; canli DB/AGF yeniden hesaplanmaz. */
export function readRanSnapshotBundle(bundle: RanSnapshotBundle) {
  verifyRanSnapshotBundle(bundle);
  return {
    bundleKey: bundle.bundleKey,
    engineVersion: bundle.engineVersion,
    generatedAt: bundle.bundleGeneratedAt,
    sourceProvenance: bundle.sourceProvenance,
    analyses: bundle.legs.map(leg=>({
      raceId: leg.raceId, raceNo: leg.raceNo,
      ranked: [...leg.runners].sort((a,b)=>a.publishedRank-b.publishedRank),
    })),
    coupon: bundle.coupon,
  };
}
