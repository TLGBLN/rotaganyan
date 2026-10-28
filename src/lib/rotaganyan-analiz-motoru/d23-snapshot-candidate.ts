/**
 * D23 release preparation: immutable, content-addressed calculation result.
 * This file never writes to the DB or publishes any coupon.
 * Publication MUST use a database transaction and compare snapshotHash
 * with the one displayed in admin, without recomputing on save.
 */
import { createHash } from "node:crypto";

type Scored = { no: number; name: string; score: number; probability: number };
export type D23SnapshotCandidate = Readonly<{
  schemaVersion: "ran-d23-snapshot-candidate-v1";
  engineVersion: "RAN-D23-SAVED-RESEARCH-ONLY";
  raceId: string;
  weightsFingerprint: string;
  sourceStatus: "CURRENT_DB_PIT_NOT_PROVEN";
  picks: ReadonlyArray<Readonly<Scored & {rank: number}>>;
  coupon: Readonly<{ narrow: string; normal: string; wide: string }>;
  contentSha256: string;
}>;

export function buildD23SnapshotCandidate(
  raceId: string,
  source: readonly Scored[],
  weightsFingerprint: string,
): D23SnapshotCandidate {
  if (!raceId || !/^[a-zA-Z0-9_-]+$/.test(raceId) ||
      !/^[a-f0-9]{64}$/.test(weightsFingerprint) ||
      source.length < 2 || source.length > 40 ||
      new Set(source.map(s => s.no)).size !== source.length)
    throw Error("D23_INVALID_SNAPSHOT_ID_OR_FIELD");
  if (source.some(s => !Number.isSafeInteger(s.no) || s.no <= 0 ||
      !s.name || !Number.isFinite(s.score) ||
      !Number.isFinite(s.probability) || s.probability <= 0 || s.probability >= 1))
    throw Error("D23_INVALID_SNAPSHOT_RUNNER");
  const sum=source.reduce((a,b)=>a+b.probability,0);
  if (Math.abs(sum-1)>1e-8)throw Error("D23_PROBABILITY_SUM_NOT_ONE");
  const picks=source.slice().sort((a,b)=>
    b.probability-a.probability || a.no-b.no).map((s,i)=>
      Object.freeze({no:s.no,name:s.name,score:s.score,
        probability:s.probability,rank:i+1}));
  const nolar=picks.map(x=>x.no);
  // One race's three DISJOINT rank bands (same semantics as existing panel).
  // This is NOT a six-race altılı ticket, payout model, or profitability claim.
  const coupon=Object.freeze({
    narrow:nolar.slice(0,3).join("-"),
    normal:nolar.slice(3,6).join("-"),
    wide:nolar.slice(6).join("-"),
  });
  const payload={
    schemaVersion:"ran-d23-snapshot-candidate-v1" as const,
    engineVersion:"RAN-D23-SAVED-RESEARCH-ONLY" as const,
    raceId,weightsFingerprint,
    sourceStatus:"CURRENT_DB_PIT_NOT_PROVEN" as const,
    picks:Object.freeze(picks),
    coupon,
  };
  const contentSha256=createHash("sha256").update(JSON.stringify(payload)).digest("hex");
  return Object.freeze({...payload,contentSha256});
}

export function verifyD23SnapshotCandidate(value:D23SnapshotCandidate):boolean {
  if(!value || !Array.isArray(value.picks) ||
    value.schemaVersion!=="ran-d23-snapshot-candidate-v1" ||
    value.engineVersion!=="RAN-D23-SAVED-RESEARCH-ONLY")return false;
  try {
    const rebuilt=buildD23SnapshotCandidate(
      value.raceId,value.picks.map(x=>({
        no:x.no,name:x.name,score:x.score,probability:x.probability
      })),value.weightsFingerprint);
    return rebuilt.contentSha256===value.contentSha256 &&
      JSON.stringify(rebuilt.picks)===JSON.stringify(value.picks) &&
      JSON.stringify(rebuilt.coupon)===JSON.stringify(value.coupon);
  }catch{return false;}
}
