/**
 * Rotaganyan D23 shadow scoring. One capture entrypoint shared with retrain.
 * Never publishes a prediction or coupon. Production access hard-blocked above.
 */
import { createHash } from "node:crypto";
import { scoreRace, type FittedModel, type FeatureStats } from "@/lib/motor-v1/engine/training";
import { captureD23LiveVectors, smoothD23Pedigree } from "./d23-feature-capture";
import raw from "./artifacts/ran-d23-staging-candidate.json";

type Stats = {mu:number; sigma:number; nObserved:number};
const data = raw.modelArtifact;
const CODES = data.codes;
const PACE = ["PACE_DUEL_SELF","PACE_STALK_DUEL","PACE_DRAW_LEAD_PRESS"] as const;
const BLOCKED_REASONS = raw.blockers;

export function loadD23StagingModel(): FittedModel<string> {
  if ((process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production"))) throw Error("D23_STAGING_DISABLED_IN_PRODUCTION");
  if (raw.releaseStatus !== "BLOCKED_PENDING_PIT_HOLDOUT_ROI_SNAPSHOT" ||
      data.deploymentReady !== false || raw.independentHoldoutValidated !== false ||
      CODES.length !== 23 || new Set(CODES).size !== 23 ||
      data.beta.length !== 46 || data.names.length !== 46 || data.nRacesTrain !== 115 ||
      CODES.includes("AGF") || !PACE.every(c => CODES.includes(c))) {
    throw Error("D23_INVALID_RESEARCH_ARTIFACT_CONTRACT");
  }
  if (!CODES.every((code,i) =>
    data.names[2*i] === code+"_z" && data.names[2*i+1] === code+"_missing" &&
    Number.isFinite(data.muSigma[code as keyof typeof data.muSigma]?.mu) &&
    Number.isFinite(data.muSigma[code as keyof typeof data.muSigma]?.sigma) &&
    data.muSigma[code as keyof typeof data.muSigma].sigma > 0 &&
    Number.isSafeInteger(data.muSigma[code as keyof typeof data.muSigma]?.nObserved)
  )) throw Error("D23_INVALID_NAMES_OR_TRAIN_STATS");
  const payload = JSON.stringify({
    codes:CODES, names:data.names,
    beta:data.beta.map(b=>Number(b.toFixed(10))),
    muSigma:Object.fromEntries(Object.entries(data.muSigma).sort(([a],[b])=>a.localeCompare(b))
      .map(([code,v])=>[code,{mu:Number(v.mu.toFixed(10)),
        sigma:Number(v.sigma.toFixed(10)),nObserved:v.nObserved}]))
  });
  const recomputed = createHash("sha256").update(payload).digest("hex");
  if (recomputed !== data.weightsFingerprint ||
      data.weightsFingerprint !== "fafebc0daf6734b193b05389a07b5192e775a7afd799373684e12e4e859e816c" ||
      raw.source.frozenJournalSha256 !== "311d2bdea8fded3ae08b0c4edb02dab5e5f3469d1b1ad5befaaa78c25437d50f")
    throw Error("D23_115_FINGERPRINT_OR_SOURCE_MISMATCH");
  const stats:FeatureStats<string> = new Map(CODES.map(code =>
    [code,data.muSigma[code as keyof typeof data.muSigma] as Stats]));
  return {beta:data.beta,names:data.names as FittedModel<string>["names"],
    stats,nRacesUsed:115,nRacesSkipped:0,
    opts:{lambda:data.lambda,learningRate:data.learningRate,iterations:data.iterations}};
}

/** READ ONLY. No saved prediction, published pick, coupon, AGF, or fallback. */
export async function runD23StagingRace(raceId:string) {
  const model = loadD23StagingModel();
  const capture = await captureD23LiveVectors(raceId);
  const scored=scoreRace(capture.vectors.map(smoothD23Pedigree),model);
  const ranked=scored.sort((a,b)=>
    b.probability-a.probability || a.no-b.no).map((x,i)=>({...x,rank:i+1}));
  if(!ranked.every(r=>Number.isFinite(r.probability)) ||
      Math.abs(ranked.reduce((sum,r)=>sum+r.probability,0)-1)>1e-8)
    throw Error("D23_SCORE_NOT_NORMALIZED");
  return {engineName:data.motorAdi,engineVersion:data.engineVersion,
    status:"STAGING_ONLY_NOT_PUBLISHED",sourceStatus:capture.sourceStatus,
    sourceBlockers:BLOCKED_REASONS,weightsFingerprint:data.weightsFingerprint,
    raceId,generatedAt:new Date().toISOString(),scores:ranked,paceMap:capture.paceMap};
}
