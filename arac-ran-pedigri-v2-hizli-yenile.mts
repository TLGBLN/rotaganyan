/**
 * Only refresh 3 lineage signals and their PIT evidence in frozen 300-race JSON.
 * DO NOT re-fetch any other 33 inputs. No results or betting data used to
 * calculate ancestry. Database read-only, checkpoint/resume and fail closed.
 */
import fs from "node:fs";
import {createHash} from "node:crypto";
import {dirname} from "node:path";
import {getThreeLineagePedigreeForRace} from "./src/lib/rotaganyan-analiz-motoru/pedigree-v2/lineage-source";
import {
  PEDIGREE_V2_VERSION,PEDIGREE_V2_CONFIG,LINEAGES,replaceThreeLineages,
  assertPedigreeVersionAndProvenance,type AdjustedLineage,
} from "./src/lib/rotaganyan-analiz-motoru/pedigree-v2/lineage-score";
import {UNIFIED_MODEL_CODES} from "./src/lib/rotaganyan-analiz-motoru/unified-model-codes";
import type {RunnerFeatureVector} from "./src/lib/motor-v1/engine/feature-vector";
type OriginalRace={
  raceId:string;tarih:string;winnerNo:number;vectors:RunnerFeatureVector[];
};
type RefreshedRace=OriginalRace & {
  pedigreeV2:{
    version:typeof PEDIGREE_V2_VERSION;
    lines:Record<number,AdjustedLineage[]>;
  };
};
function replacePedigreeForOneHorse(v:RunnerFeatureVector,lines:AdjustedLineage[]){
  return {vector:replaceThreeLineages(v,lines),lines};
}
const source=process.env.RAN_PED_V2_IN??"C:/tmp/ran-pit-20261025-train-dev.json";
const out=process.env.RAN_PED_V2_OUT??"C:/tmp/ran-pit-20261025-pedigri-v2-300.json";
const cp=out+".checkpoint.json",stamp=out+".source.json";
function atomic(path:string,data:unknown){
  fs.mkdirSync(dirname(path),{recursive:true});
  const tmp=path+".tmp-"+process.pid;
  fs.writeFileSync(tmp,JSON.stringify(data,null,2));
  fs.renameSync(tmp,path);
}
async function main(){
  if(fs.existsSync(out))throw new Error("RAN_PED_V2_OUTPUT_EXISTS: do not overwrite candidate");
  const srcBytes=fs.readFileSync(source);
  const original:unknown=JSON.parse(srcBytes.toString("utf8"));
  if(!Array.isArray(original)||original.length!==300)
    throw new Error("RAN_PED_V2_ORIGINAL_300_REQUIRED");
  const all=original as OriginalRace[];
  if(new Set(all.map(r=>r.raceId)).size!==300 ||
     all.filter(x=>x.tarih>="2026-08-16"&&x.tarih<="2026-08-25").length!==238 ||
     all.filter(x=>x.tarih>="2026-08-26"&&x.tarih<="2026-08-28").length!==62)
    throw new Error("RAN_PED_V2_ORIGINAL_COHORT_LOCK_FAIL");
  const sourceSha=createHash("sha256").update(srcBytes).digest("hex");
  const manifest={version:PEDIGREE_V2_VERSION,sourceSha,
    config:PEDIGREE_V2_CONFIG,races:300};
  let saved:Record<string,RefreshedRace>={};
  if(fs.existsSync(cp)){
    if(!fs.existsSync(stamp) || JSON.stringify(JSON.parse(fs.readFileSync(stamp,"utf8")))!==JSON.stringify(manifest))
      throw new Error("RAN_PED_V2_CHECKPOINT_LOCK_MISMATCH");
    saved=JSON.parse(fs.readFileSync(cp,"utf8")) as Record<string,RefreshedRace>;
    if(Object.keys(saved).some(id=>!all.some(r=>r.raceId===id)))
      throw new Error("RAN_PED_V2_STALE_CHECKPOINT_ID");
  }else atomic(stamp,manifest);
  console.log("[RAN_PED_V2] PIT-only 3-lineage recalc; 33 other features reused; no write to DB; checkpoint="+Object.keys(saved).length+"/300.");
  const pending=all.filter(x=>!saved[x.raceId]);
  for(let i=0;i<pending.length;i++){
    const row=pending[i];
    const data=await getThreeLineagePedigreeForRace(row.raceId);
    if(data.cutoff.toISOString().slice(0,10)!==row.tarih.slice(0,10))
      throw new Error("RAN_PED_V2_RACE_DATE_CHANGED:"+row.raceId);
    const realNos=[...data.horses.map(h=>h.no)].sort((a,b)=>a-b);
    const frozenNos=[...row.vectors.map(v=>v.no)].sort((a,b)=>a-b);
    if(realNos.join(",")!==frozenNos.join(","))
      throw new Error("RAN_PED_V2_RUNNER_SET_CHANGED:"+row.raceId);
    if(row.vectors.some(v=>v.raceId!==row.raceId ||
       v.signals.length!==UNIFIED_MODEL_CODES.length ||
       v.signals.some((s,i)=>s.code!==UNIFIED_MODEL_CODES[i])))
      throw new Error("RAN_PED_V2_NONCANONICAL_FROZEN_VECTORS:"+row.raceId);
    const pedigreeLines:Record<number,AdjustedLineage[]>={};
    const vectors=row.vectors.map(v=>{
      const l=data.lineages.get(v.no);
      if(!l || l.length!==LINEAGES.length)
        throw new Error("RAN_PED_V2_MISSING_HORSE_LINEAGES");
      const {vector,lines}=replacePedigreeForOneHorse(v,l);
      pedigreeLines[v.no]=lines;
      return vector;
    });
    assertPedigreeVersionAndProvenance(PEDIGREE_V2_VERSION,vectors);
    const diff=new Set(LINEAGES.map(x=>x.code));
    if(vectors.some((v,j)=>v.signals.some((s,k)=>!diff.has(s.code) &&
       JSON.stringify(s)!==JSON.stringify(row.vectors[j].signals[k]))))
      throw new Error("RAN_PED_V2_NONPEDIGREE_INPUT_CHANGED");
    saved[row.raceId]={...row,vectors,pedigreeV2:{version:PEDIGREE_V2_VERSION,lines:pedigreeLines}};
    // One race at a time; no completed race is recollected if interrupted.
    atomic(cp,saved);
    console.log("[RAN_PED_V2] "+Object.keys(saved).length+"/300 "+row.raceId+
      " three separate PIT ancestry lines VERIFIED");
  }
  if(Object.keys(saved).length!==300)throw new Error("RAN_PED_V2_INCOMPLETE_COHORT");
  const updated=all.map(r=>saved[r.raceId]);
  if(updated.some(r=>!r||r.vectors.length<3))throw new Error("RAN_PED_V2_MISSING_SAVED_RACE");
  atomic(out,updated);
  const diagnostics={
    ...manifest,outputSha:createHash("sha256").update(fs.readFileSync(out)).digest("hex"),
    trainingRaces:238,developmentRaces:62,
    everyHorseHasThreeLineages:updated.every(r=>r.vectors.every(v=>
      LINEAGES.every(l=>v.signals.some(s=>s.code===l.code)))),
    lineageObservations:Object.fromEntries(LINEAGES.map(l=>[l.code,{
      observed:updated.reduce((n,r)=>n+r.vectors.filter(v=>
        v.signals.find(s=>s.code===l.code)?.observed).length,0),
      missing:updated.reduce((n,r)=>n+r.vectors.filter(v=>
        !v.signals.find(s=>s.code===l.code)?.observed).length,0),
    }])),
    originalCanonicalModelUnmodified:true,publicationGate:"BLOCKED",
    warning:"V2 transforms inputs. Old 36-feature betas CANNOT be applied; MUST retrain a separate V2 model.",
  };
  atomic(out+".manifest.json",diagnostics);
  console.log("[RAN_PED_V2] PASS 300/300, 3 ancestry lines EACH horse, 33 other features untouched.");
  console.log("[RAN_PED_V2] "+out+" + .manifest.json; prod/original PIT source not modified.");
}
main().catch(e=>{console.error("[RAN_PED_V2] FAIL "+(e instanceof Error?e.message:String(e)));process.exitCode=1;});
