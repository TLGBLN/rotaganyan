/**
 * RAN D23: single read-only source for both train-data recapture and staging inference.
 * This does NOT certify the mutable historical DB as an immutable pre-race snapshot.
 * The caller MUST persist the returned feature bytes and verify a content hash before
 * training or publishing any future model.
 */
import { db } from "@/lib/db";
import { createHash } from "node:crypto";
import { breedToIrk } from "@/lib/sire-stat-match";
import { hizPaceIndexKur, hizDerecesiHesaplaOrtak, type HizGecmisSatir, type PaceIndex } from "@/lib/methodology/hiz-derecesi-hesapla";
import { speedObservedAsOf } from "./feature-calculators/pit-sire-speed";
import { computeRakGapForRace } from "@/lib/motor-v1/features/rak-rakip-gucu";

import { buildUnifiedFeatureVectorsForRace } from "./feature-calculators/unified-feature-vector";
import { calculatePaceScenario } from "./pace-scenario";
import { loadTempoContext } from "@/lib/motor-v1/features/tempo";
import { styleVector } from "@/lib/accurace/features";
import type { TargetRace } from "@/lib/accurace/types";
import type { RunnerFeatureVector, SignalEntry } from "@/lib/motor-v1/engine/feature-vector";
import raw from "./artifacts/ran-d23-staging-candidate.json";

const CODES: readonly string[] = raw.modelArtifact.codes;

/** Deterministic D23-only population, never touches V5 production source.
 * Old source uses distinct tjkAtId without ordering; 42 identity IDs in the
 * real database have conflicting breed. Arbitrary selection can alter almost
 * every horse's reference speed and therefore RIVAL_GAP.
 * Exclude mixed-breed identity IDs from benchmark, rather than guess a breed.
 */
type StableSpeed = {history:Map<number,HizGecmisSatir[]>;index:PaceIndex;ambiguous:number;ambiguousIds:Set<number>};
let speedContext:Promise<StableSpeed>|null=null;
export function loadD23StableSpeed():Promise<StableSpeed> {
  if(speedContext)return speedContext;
  const p=(async()=>{
    const [historyRows,breedRows]=await Promise.all([
      db.horseRaceHistoryCache.findMany({
        select:{tjkAtId:true,rowsJson:true},orderBy:{tjkAtId:"asc"}
      }),
      db.runner.findMany({
        where:{scratched:false,tjkAtId:{not:null}},
        select:{tjkAtId:true,race:{select:{breed:true}}},orderBy:{id:"asc"}
      })
    ]);
    const history=new Map<number,HizGecmisSatir[]>(
      historyRows.map(r=>[r.tjkAtId,r.rowsJson as unknown as HizGecmisSatir[]]));
    const breedById=new Map<number,string>();
    const conflicts=new Set<number>();
    for(const row of breedRows) {
      const id=row.tjkAtId;
      if(id==null || conflicts.has(id))continue;
      const breed=breedToIrk(row.race.breed);
      const prior=breedById.get(id);
      if(prior!==undefined && prior!==breed){
        breedById.delete(id);
        conflicts.add(id);
      }else breedById.set(id,breed);
    }
    const sourceHasher=createHash("sha256");
    for(const row of historyRows) {
      sourceHasher.update(JSON.stringify([row.tjkAtId,row.rowsJson]));
      sourceHasher.update("\n");
    }
    for(const [id,breed] of [...breedById].sort((a,b)=>a[0]-b[0])) {
      sourceHasher.update(JSON.stringify([id,breed]));
      sourceHasher.update("\n");
    }
    const sourceSha256=sourceHasher.digest("hex");
    const index=hizPaceIndexKur(history,breedById);
    console.log("[D23_SPEED_SOURCE] version=2 excludedAmbiguous="+conflicts.size+
      " uniqueBreedIds="+breedById.size+" buckets="+index.size+
      " SOURCE_SHA256="+sourceSha256);
    return {history,index,ambiguous:conflicts.size,ambiguousIds:conflicts};
  })();
  speedContext=p;
  p.catch(()=>{if(speedContext===p)speedContext=null;});
  return p;
}


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
  const [base,race,ctx,stableSpeed]=await Promise.all([
    buildUnifiedFeatureVectorsForRace(raceId,undefined,undefined,undefined,true),
    db.race.findUnique({where:{id:raceId},select:{
      distance:true,surface:true,breed:true,raceDay:{select:{date:true}},
      runners:{where:{scratched:false},select:{
        no:true,name:true,startNo:true,tjkAtId:true
      }}
    }}),
    loadTempoContext(),loadD23StableSpeed()
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

  const stableByNo=new Map(race.runners.map(r=>{
    const hist=r.tjkAtId==null?[]:stableSpeed.history.get(r.tjkAtId)??[];
    const breed=breedToIrk(race.breed);
    const ambiguous=r.tjkAtId!==null&&stableSpeed.ambiguousIds.has(r.tjkAtId);
    const value=r.tjkAtId===null||ambiguous?0:hizDerecesiHesaplaOrtak(
      hist,breed,race.raceDay.date,stableSpeed.index);
    return [r.no,{
      value,
      // P0 FIX (2026-10-28): RIVAL_GAP (RAK_GAP_01) MUST use the EXACT same observation
      // gate as SPEED. hizDerecesiHesaplaOrtak() silently returns 0 (sentinel, not a real
      // pace) when there is no usable population comparison (sayi===0) -- a bare
      // "hist.length>0" gate (the old v1Observed) let that fabricated 0 pass through as an
      // "observed" average-pace horse whenever history existed but was stale/out-of-window/
      // below the 20-sample population bucket floor. Proven in rak-rakip-gucu.test.ts.
      observed:r.tjkAtId!==null && !ambiguous &&
        speedObservedAsOf(hist,breed,race.raceDay.date,stableSpeed.index)
    }] as const;
  }));
  const v1ByNo=new Map((base.rawSources?.v1Results??[]).map(v=>[v.no,v]));
  if(v1ByNo.size!==race.runners.length)
    throw Error("D23_V1_RIVAL_SOURCE_MISSING");
  const gaps=computeRakGapForRace(race.runners.map(r=>{
    const speed=stableByNo.get(r.no);
    const cls=v1ByNo.get(r.no)?.unifiedVector.find(s=>s.code==="SINIF_01");
    if(!speed||!cls)throw Error("D23_SINIF_SOURCE_MISSING");
    return {no:r.no,hiz01:speed.value,hiz01Observed:speed.observed,
      sinif01:cls.rawValue,sinif01Observed:cls.observed};
  }));

  if(physicalNos.size!==race.runners.length)throw Error("D23_DUPLICATE_RUNNER_NUMBER");
  const vectors:RunnerFeatureVector[]=base.vectors.map(v=>{
    const p=paceByNo.get(v.no);
    if(!p || !physicalNos.has(v.no))throw Error("D23_PACE_FIELD_MISMATCH");
    const pool=[...v.signals,...p.signals];
    const signals:SignalEntry[]=CODES.map(code=>{
      const matches=pool.filter(s=>s.code===code);
      if(matches.length!==1)throw Error("D23_REQUIRED_FEATURE_MISSING_OR_DUPLICATE "+code);
      const s=matches[0];
      if(code==="SPEED") {
        const speed=stableByNo.get(v.no);
        if(!speed)throw Error("D23_SPEED_NO_RUNNER");
        return {...s,rawValue:speed.observed?speed.value:null,observed:speed.observed,
          missingReason:speed.observed?null:"NO_AS_OF_PACE_COMPARISON"};
      }
      if(code==="EQUIPMENT_CHANGE") {
        // D23 V2: four nominal states. The training encoder MUST use three
        // one-hot columns; old signed-difference coefficients are incompatible.
        if(!s.observed) {
          if(s.rawValue!==null)throw Error("D23_EQUIPMENT_MISSING_RAW_NOT_NULL");
          return {...s};
        }
        const state="equipmentState" in s ? s.equipmentState : undefined;
        if(state!==0 && state!==1 && state!==2 && state!==3)
          throw Error("D23_EQUIPMENT_FOUR_STATE_EVIDENCE_REQUIRED");
        return {...s,rawValue:state,equipmentState:state};
      }
      if(code==="PACE_DUEL_SELF" || code==="PACE_STALK_DUEL" || code==="PACE_DRAW_LEAD_PRESS") {
        // Partial rivals are observed subsets, NOT complete field evidence.
        // Do not scale the physical pace formula by an arbitrary constant.
        return {...s,paceRivalCoverage:{observed:p.rivalsObserved,total:physicalNos.size-1}};
      }
      if(code==="RIVAL_GAP") {
        const gap=gaps.get(v.no);
        if(!gap)throw Error("D23_GAP_NO_RUNNER");
        return {...s,rawValue:gap.rawValue,observed:gap.observed,
          missingReason:gap.missingReason,coverageState:gap.coverageState};
      }
      if(s.observed && (s.rawValue==null || !Number.isFinite(s.rawValue)) ||
        !s.observed && s.rawValue!=null)throw Error("D23_INVALID_OBSERVATION "+code);
      return {...s};
    });
    return {...v,signals,d23FormulaVersion:"D23_FORMULAS_V2" as const};
  }).sort((a,b)=>a.no-b.no);
  if(vectors.length!==physicalNos.size ||
     vectors.some(v=>!physicalNos.has(v.no))) throw Error("D23_FIELD_INTEGRITY_FAILED");
  return {
    raceId,date:race.raceDay.date.toISOString().slice(0,10),
    vectors,sourceStatus:"CURRENT_DB_PIT_NOT_PROVEN",diagnostics:base.diagnostics,paceMap:pace
  };
}
