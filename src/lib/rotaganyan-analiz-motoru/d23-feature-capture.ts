/**
 * RAN D23: single read-only source for both train-data recapture and staging inference.
 * This does NOT certify the mutable historical DB as an immutable pre-race snapshot.
 * The caller MUST persist the returned feature bytes and verify a content hash before
 * training or publishing any future model.
 */
import { db } from "@/lib/db";
import { buildUnifiedFeatureVectorsForRace } from "./feature-calculators/unified-feature-vector";
import { calculatePaceScenario } from "./pace-scenario";
import { loadTempoContext } from "@/lib/motor-v1/features/tempo";
import { styleVector } from "@/lib/accurace/features";
import type { TargetRace } from "@/lib/accurace/types";
import type { RunnerFeatureVector, SignalEntry } from "@/lib/motor-v1/engine/feature-vector";
import raw from "./artifacts/ran-d23-staging-candidate.json";

const CODES: readonly string[] = raw.modelArtifact.codes;

export function smoothD23Pedigree(v:RunnerFeatureVector):RunnerFeatureVector {
  return {...v, signals:v.signals.map(s=>{
    if((s.code!=="DAM_HISTORY" && s.code!=="DAMSIRE_HISTORY") || !s.observed) return s;
    const n=s.sampleCount, x=s.rawValue;
    if(typeof x!=="number" || !Number.isFinite(x) || x<0 || x>100 ||
       typeof n!=="number" || !Number.isSafeInteger(n) || n<=0)
      throw Error("D23_PEDIGREE_PIT_SAMPLE_REQUIRED "+v.raceId+"/"+v.no+"/"+s.code);
    return {...s,rawValue:(Math.round(x*n/100)+20*0.14)/(n+20)*100};
  })};
}

export async function captureD23LiveVectors(raceId:string):Promise<{
  raceId:string;
  date:string;
  vectors:RunnerFeatureVector[];
  sourceStatus:"CURRENT_DB_PIT_NOT_PROVEN";
  diagnostics:{no:number;source:"D"|"V1";code:string;reason:string}[];
  paceMap:ReturnType<typeof calculatePaceScenario>;
}> {
  if(!raceId || typeof raceId!=="string")throw Error("D23_RACE_ID_REQUIRED");
  const [base,race,ctx]=await Promise.all([
    buildUnifiedFeatureVectorsForRace(raceId),
    db.race.findUnique({where:{id:raceId},select:{
      distance:true,surface:true,raceDay:{select:{date:true}},
      runners:{where:{scratched:false},select:{
        no:true,name:true,startNo:true,tjkAtId:true
      }}
    }}),
    loadTempoContext()
  ]);
  if(!race || !base.vectors.length || base.vectors.length!==race.runners.length)
    throw Error("D23_SOURCE_RACE_OR_RUNNER_COUNT_MISMATCH");
  const target:TargetRace={date:race.raceDay.date,length:race.distance,surface:race.surface};
  const pace=calculatePaceScenario(race.runners.map(r=>{
    const sf=r.tjkAtId==null?null:styleVector(ctx.byTjk.get(r.tjkAtId)??[],target);
    return {no:r.no,name:r.name,startNo:r.startNo,
      style:sf?.observed?sf.vec:null,styleEffectiveN:sf?.effectiveN??null};
  }));
  const paceByNo=new Map(pace.horses.map(h=>[h.no,h]));
  const physicalNos=new Set(race.runners.map(r=>r.no));
  if(physicalNos.size!==race.runners.length)throw Error("D23_DUPLICATE_RUNNER_NUMBER");
  const vectors:RunnerFeatureVector[]=base.vectors.map(v=>{
    const p=paceByNo.get(v.no);
    if(!p || !physicalNos.has(v.no))throw Error("D23_PACE_FIELD_MISMATCH");
    const pool=[...v.signals,...p.signals];
    const signals:SignalEntry[]=CODES.map(code=>{
      const matches=pool.filter(s=>s.code===code);
      if(matches.length!==1)throw Error("D23_REQUIRED_FEATURE_MISSING_OR_DUPLICATE "+code);
      const s=matches[0];
      if(s.observed && (s.rawValue==null || !Number.isFinite(s.rawValue)) ||
        !s.observed && s.rawValue!=null)throw Error("D23_INVALID_OBSERVATION "+code);
      return {...s};
    });
    return {...v,signals};
  }).sort((a,b)=>a.no-b.no);
  if(vectors.length!==physicalNos.size ||
     vectors.some(v=>!physicalNos.has(v.no))) throw Error("D23_FIELD_INTEGRITY_FAILED");
  return {
    raceId,date:race.raceDay.date.toISOString().slice(0,10),
    vectors,sourceStatus:"CURRENT_DB_PIT_NOT_PROVEN",diagnostics:base.diagnostics,paceMap:pace
  };
}
