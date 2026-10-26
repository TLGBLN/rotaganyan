/**
 * D23 staging-only model runner. It cannot publish predictions or coupons.
 * Hard disabled on NODE_ENV=production until pre-race provenance, live parity,
 * independent holdout, and snapshot publication contract pass.
 */
import { createHash } from "node:crypto";
import { db } from "@/lib/db";
import { buildUnifiedFeatureVectorsForRace } from "./feature-calculators/unified-feature-vector";
import { calculatePaceScenario } from "./pace-scenario";
import { loadTempoContext } from "@/lib/motor-v1/features/tempo";
import { styleVector } from "@/lib/accurace/features";
import { scoreRace, type FittedModel, type FeatureStats } from "@/lib/motor-v1/engine/training";
import type { TargetRace } from "@/lib/accurace/types";
import raw from "./artifacts/ran-d23-staging-candidate.json";

type Stats = {mu:number; sigma:number; nObserved:number};
const data = raw.modelArtifact;
const CODES = data.codes;
const PACE = ["PACE_DUEL_SELF","PACE_STALK_DUEL","PACE_DRAW_LEAD_PRESS"] as const;
const BLOCKED_REASONS = raw.blockers;

export function loadD23StagingModel(): FittedModel<string> {
  if ((process.env.VERCEL_ENV === "production" || (!process.env.VERCEL_ENV && process.env.NODE_ENV === "production"))) throw Error("D23_STAGING_DISABLED_IN_PRODUCTION");
  if (raw.releaseStatus !== "BLOCKED_PENDING_LIVE_PARITY_AND_PIT_PROVENANCE" ||
      data.deploymentReady !== false || raw.independentHoldoutValidated !== false ||
      CODES.length !== 23 || new Set(CODES).size !== 23 ||
      data.beta.length !== 46 || data.names.length !== 46 || data.nRacesTrain !== 178 ||
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
    muSigma:Object.fromEntries(Object.entries(data.muSigma).sort(([a],[b])=>a<b?-1:a>b?1:0)
      .map(([code,v])=>[code,{mu:Number(v.mu.toFixed(10)),
        sigma:Number(v.sigma.toFixed(10)),nObserved:v.nObserved}]))
  });
  const recomputed = createHash("sha256").update(payload).digest("hex");
  if (recomputed !== data.weightsFingerprint) throw Error("D23_FINGERPRINT_MISMATCH");
  const stats:FeatureStats<string> = new Map(CODES.map(code =>
    [code,data.muSigma[code as keyof typeof data.muSigma] as Stats]));
  return {beta:data.beta,names:data.names as FittedModel<string>["names"],
    stats,nRacesUsed:178,nRacesSkipped:0,
    opts:{lambda:data.lambda,learningRate:data.learningRate,iterations:data.iterations}};
}

/** READ ONLY. No saved prediction, published pick, coupon, AGF, or silent fallback. */
export async function runD23StagingRace(raceId:string) {
  const model = loadD23StagingModel();
  if (!raceId || typeof raceId !== "string") throw Error("D23_RACE_ID_REQUIRED");
  const [base, race, tempoCtx] = await Promise.all([
    buildUnifiedFeatureVectorsForRace(raceId),
    db.race.findUnique({where:{id:raceId},select:{
      distance:true,surface:true,raceDay:{select:{date:true}},
      runners:{where:{scratched:false},select:{
        no:true,name:true,startNo:true,tjkAtId:true
      }}
    }}),
    loadTempoContext()
  ]);
  if (!race || !base.vectors.length || base.vectors.length!==race.runners.length)
    throw Error("D23_RACE_OR_RUNNER_SET_UNAVAILABLE");
  const target:TargetRace = {date:race.raceDay.date,length:race.distance,surface:race.surface};
  const pace=calculatePaceScenario(race.runners.map(r=>({
    no:r.no,name:r.name,startNo:r.startNo,
    style:r.tjkAtId==null ? null :
      styleVector(tempoCtx.byTjk.get(r.tjkAtId)??[],target).vec
  })));
  const byNo=new Map(pace.horses.map(h=>[h.no,h]));
  const vectors=base.vectors.map(v=>{
    const row=byNo.get(v.no);
    if(!row)throw Error("D23_PACE_RUNNER_MISMATCH");
    const set=new Map([...v.signals,...row.signals].map(s=>[s.code,s]));
    if(CODES.some(code=>!set.has(code)))throw Error("D23_REQUIRED_FEATURE_MISSING");
    const signals=CODES.map(code=>{
      const s=set.get(code)!;
      if((code==="DAM_HISTORY" || code==="DAMSIRE_HISTORY") && s.observed) {
        const n=s.sampleCount, value=s.rawValue;
        if(typeof value!=="number" || !Number.isFinite(value) || value<0 || value>100 ||
           typeof n!=="number" || !Number.isSafeInteger(n) || n<=0)
          throw Error("D23_PEDIGREE_PIT_SAMPLE_REQUIRED");
        return {...s,rawValue:(Math.round(value*n/100)+20*0.14)/(n+20)*100};
      }
      return s;
    });
    if(signals.some(s=>s.observed && (s.rawValue===null || !Number.isFinite(s.rawValue))))
      throw Error("D23_BAD_OBSERVED_VALUE");
    return {...v,signals};
  });
  const ranked=scoreRace(vectors,model).sort((a,b)=>
    b.probability-a.probability || a.no-b.no).map((x,i)=>({...x,rank:i+1}));
  if(!ranked.every(r=>Number.isFinite(r.probability)) ||
      Math.abs(ranked.reduce((sum,r)=>sum+r.probability,0)-1)>1e-8)
    throw Error("D23_SCORE_NOT_NORMALIZED");
  return {engineName:data.motorAdi,engineVersion:data.engineVersion,
    status:"STAGING_ONLY_NOT_PUBLISHED",sourceBlockers:BLOCKED_REASONS,
    weightsFingerprint:data.weightsFingerprint,raceId,generatedAt:new Date().toISOString(),
    scores:ranked,paceMap:pace};
}
