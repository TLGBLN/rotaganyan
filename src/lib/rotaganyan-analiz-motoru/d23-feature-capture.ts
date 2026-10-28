/**
 * RAN D23: single read-only source for both train-data recapture and staging inference.
 * This does NOT certify the mutable historical DB as an immutable pre-race snapshot.
 * The caller MUST persist the returned feature bytes and verify a content hash before
 * training or publishing any future model.
 */
import { db } from "@/lib/db";
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
type StableSpeed = {history:Map<number,HizGecmisSatir[]>;index:PaceIndex;ambiguous:number};
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
    const index=hizPaceIndexKur(history,breedById);
    console.log("[D23_SPEED_SOURCE] version=2 excludedAmbiguous="+conflicts.size+
      " uniqueBreedIds="+breedById.size+" buckets="+index.size);
    return {history,index,ambiguous:conflicts.size};
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
