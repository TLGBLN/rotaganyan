/**
 * PIT-safe MARKET experiment only. Never uses mutable Runner.agf,
 * never calls getAgfTrendForRace on historical races.
 * The original production trend function intentionally has a different
 * (live display) contract. No production scores/predictions are changed.
 */
import type { SignalEntry } from "@/lib/motor-v1/engine/feature-vector";

export const AGF_TREND_CODE = "MARKET_AGF_TREND" as const;
export const AGF_ACTIVITY_CODE = "MARKET_AGF_ACTIVITY" as const;
export const AGF_MOVEMENT_THRESHOLD_PP = 1.0;
const ISTANBUL_OFFSET = "+03:00"; // Turkey: UTC+3 throughout the 2026 sample.

export type TimestampedAgf = { id: string; agf: number; capturedAt: Date };
export type PitAgfObservation = {
  first: number | null;
  last: number | null;
  deltaPp: number | null;
  active: number | null;
  eligibleSnapshots: number;
  excludedPostCutoff: number;
  status: "OBSERVED" | "NOT_ENOUGH_DISTINCT_PRE_RACE_SNAPSHOTS";
};

/** Reject missing/invalid start times rather than guessing the cut-off. */
export function raceCutoffUtc(raceDay: Date, hhmm: string | null, leadMinutes = 15): Date {
  if (!(raceDay instanceof Date) || !Number.isFinite(raceDay.getTime()) ||
      !/^([01]\d|2[0-3]):[0-5]\d$/.test(hhmm ?? "") ||
      !Number.isSafeInteger(leadMinutes) || leadMinutes < 1 || leadMinutes > 180)
    throw Error("AGF_PIT_RACE_TIME_REQUIRED");
  const day = raceDay.toISOString().slice(0, 10);
  const localStart = new Date(day+"T"+hhmm+":00"+ISTANBUL_OFFSET);
  if (!Number.isFinite(localStart.getTime())) throw Error("AGF_PIT_INVALID_START");
  return new Date(localStart.getTime() - leadMinutes * 60_000);
}

export function observeAgfTrendAsOf(
  raceDay: Date, cutoff: Date, snapshots: readonly TimestampedAgf[]
): PitAgfObservation {
  if (!Number.isFinite(raceDay.getTime()) || !Number.isFinite(cutoff.getTime()) ||
      cutoff.getTime() > new Date(raceDay.toISOString().slice(0,10)+"T23:59:59"+ISTANBUL_OFFSET).getTime())
    throw Error("AGF_PIT_INVALID_CUTOFF");
  const dayStart = new Date(raceDay.toISOString().slice(0,10)+"T00:00:00"+ISTANBUL_OFFSET);
  const ordered = snapshots.map(s => {
    const stamp=s.capturedAt instanceof Date ? s.capturedAt : new Date(NaN);
    if (!s.id || !Number.isFinite(stamp.getTime()) ||
        !Number.isFinite(s.agf) || s.agf < 0 || s.agf > 100)
      throw Error("AGF_PIT_INVALID_SNAPSHOT");
    return {...s,capturedAt:stamp};
  }).sort((a,b) => a.capturedAt.getTime()-b.capturedAt.getTime() ||
    a.id.localeCompare(b.id));
  const eligible = ordered.filter(s => s.capturedAt>=dayStart && s.capturedAt<cutoff);
  const excludedPostCutoff=ordered.filter(s => s.capturedAt>=cutoff).length;
  const first=eligible[0] ?? null;
  const last=eligible[eligible.length-1] ?? null;
  if (!first || !last || first.capturedAt.getTime()===last.capturedAt.getTime())
    return {first:null,last:null,deltaPp:null,active:null,
      eligibleSnapshots:eligible.length,excludedPostCutoff,
      status:"NOT_ENOUGH_DISTINCT_PRE_RACE_SNAPSHOTS"};
  const deltaPp=Math.round((last.agf-first.agf)*100)/100;
  return {first:first.agf,last:last.agf,deltaPp,
    active:Math.abs(deltaPp)>=AGF_MOVEMENT_THRESHOLD_PP?1:0,
    eligibleSnapshots:eligible.length,excludedPostCutoff,
    status:"OBSERVED"};
}

export function agfPITSignals(obs:PitAgfObservation): SignalEntry[] {
  const observed=obs.status==="OBSERVED";
  const make=(code:string,rawValue:number|null):SignalEntry => ({
    code,family:"MARKET",rawValue:observed?rawValue:null,
    observed,coverageState:null,asOfSafe:true,
    missingReason:observed?null:"NO_TWO_DISTINCT_PRE_RACE_AGF_SNAPSHOTS",
    sampleCount:obs.eligibleSnapshots,
  });
  return [make(AGF_TREND_CODE,obs.deltaPp),make(AGF_ACTIVITY_CODE,obs.active)];
}
