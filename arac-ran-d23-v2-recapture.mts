/**
 * D23 FORMULAS V2 recapture: historical mutable-DB research ONLY.
 * The 115 frozen rows are used exclusively for cohort race IDs + optional dates.
 * NEVER reuse their old signal vectors, winners, AGF, or old 46-coefficient artifact.
 *
 * RAN_D23_V2_COHORT = exact frozen journal .ndjson or JSON (115 races)
 * RAN_D23_V2_OUT = output filename, must not already exist.
 * RAN_D23_V2_CHECKPOINT = optional private progress state.
 * No DB writes. Immutable final output is SHA256-stamped. Fail closed.
 */
import fs from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {db} from "./src/lib/db";
import {captureD23LiveVectors} from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";
import rawArtifact from "./src/lib/rotaganyan-analiz-motoru/artifacts/ran-d23-staging-candidate.json";
import type {RunnerFeatureVector} from "./src/lib/motor-v1/engine/feature-vector";

type Cohort = {raceId:string; date:string|null};
type OutputRow = {raceId:string; tarih:string; winnerNo:number; vectors:RunnerFeatureVector[]; sourceStatus:"CURRENT_DB_PIT_NOT_PROVEN"};
const CODES=rawArtifact.modelArtifact.codes as readonly string[];
const VERSION="D23_FORMULAS_V2";
const OUT=process.env.RAN_D23_V2_OUT ?? "C:/tmp/ran-d23-v2-recapture-115.json";
const IN=process.env.RAN_D23_V2_COHORT;
const CK=process.env.RAN_D23_V2_CHECKPOINT ?? OUT+".checkpoint.json";
const sha=(s:string|Buffer)=>createHash("sha256").update(s).digest("hex");

function objectsFromSource(raw:string):unknown[] {
  let parsed:unknown;
  try {parsed=JSON.parse(raw);}
  catch {
    const lines=raw.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
    try {parsed=lines.map(x=>JSON.parse(x));}
    catch {throw Error("D23_V2_COHORT_FORMAT_INVALID_JSON_OR_NDJSON");}
  }
  if(Array.isArray(parsed))return parsed;
  if(parsed && typeof parsed==="object") {
    const v=parsed as Record<string,unknown>;
    for(const key of ["races","rows","journal","items","data","records","samples"]) {
      if(Array.isArray(v[key]))return v[key] as unknown[];
    }
    if(Object.values(v).length>=115 && Object.values(v).every(x=>x && typeof x==="object")) {
      return Object.entries(v).map(([key,value])=>({...(value as Record<string,unknown>),raceId:(value as Record<string,unknown>).raceId??key}));
    }
  }
  throw Error("D23_V2_COHORT_MISSING_RACE_ARRAY");
}
function stringOrNull(x:unknown):string|null{return typeof x==="string"&&x.trim()?x.trim():null;}
function cohortFromSource(raw:string):Cohort[] {
  const records=objectsFromSource(raw);
  const byId=new Map<string,string|null>();
  for(const obj of records) {
    if(!obj || typeof obj!=="object")throw Error("D23_V2_COHORT_NON_OBJECT");
    const r=obj as Record<string,unknown>;
    const race=r.race && typeof r.race==="object" ? r.race as Record<string,unknown> : {};
    const id=stringOrNull(r.raceId)??stringOrNull(r.race_id)??stringOrNull(r.id)??stringOrNull(race.id);
    if(!id)throw Error("D23_V2_COHORT_RACE_ID_MISSING");
    const date=stringOrNull(r.tarih)??stringOrNull(r.date)??stringOrNull(r.raceDate)??stringOrNull(race.date);
    const normalized=date?.slice(0,10)??null;
    if(normalized && !/^\d{4}-\d{2}-\d{2}$/.test(normalized))throw Error("D23_V2_COHORT_DATE_INVALID "+id);
    if(byId.has(id)) {
      const prior=byId.get(id)??null;
      if(prior!==normalized && prior!==null && normalized!==null)throw Error("D23_V2_COHORT_DATE_CONFLICT "+id);
      if(prior===null && normalized!==null)byId.set(id,normalized);
    } else byId.set(id,normalized);
  }
  if(byId.size!==115)throw Error("D23_V2_COHORT_MUST_BE_EXACT_115 unique="+byId.size+" records="+records.length);
  return [...byId].map(([raceId,date])=>({raceId,date})).sort((a,b)=>(a.date??"").localeCompare(b.date??"")||a.raceId.localeCompare(b.raceId));
}
function atomicWrite(file:string,contents:string) {
  fs.mkdirSync(path.dirname(file),{recursive:true});
  const temp=file+".partial";
  fs.writeFileSync(temp,contents,{flag:"w"});
  fs.renameSync(temp,file);
}
function verifyVectors(raceId:string,vectors:RunnerFeatureVector[],realNos:number[]):void {
  if(vectors.length!==realNos.length || vectors.length<2)throw Error("D23_V2_FIELD_MISMATCH "+raceId);
  const expected=new Set(realNos);
  for(const v of vectors) {
    if(!expected.delete(v.no) || v.raceId!==raceId ||
        v.d23FormulaVersion!=="D23_FORMULAS_V2" || v.signals.length!==23 ||
        new Set(v.signals.map(x=>x.code)).size!==23 ||
        CODES.some(code=>!v.signals.some(x=>x.code===code)))
      throw Error("D23_V2_VECTOR_PARITY_INVALID "+raceId+"/"+v.no);
    const eq=v.signals.find(x=>x.code==="EQUIPMENT_CHANGE")!;
    if(eq.observed &&
       (eq.equipmentState===undefined || eq.rawValue!==eq.equipmentState ||
        ![0,1,2,3].includes(eq.equipmentState)))
      throw Error("D23_V2_EQUIPMENT_INVALID "+raceId+"/"+v.no);
    if(!eq.observed && (eq.rawValue!==null || eq.equipmentState!==undefined))
      throw Error("D23_V2_EQUIPMENT_MISSING_NOT_NULL "+raceId+"/"+v.no);
  }
  if(expected.size)throw Error("D23_V2_MISSING_RUNNER "+raceId);
}
async function main(){
  if(!IN||!fs.existsSync(IN))throw Error("RAN_D23_V2_COHORT_REQUIRED: set RAN_D23_V2_COHORT to 115 frozen journal path");
  if(fs.existsSync(OUT))throw Error("D23_V2_OUTPUT_ALREADY_EXISTS: choose a new filename, never overwrite");
  if(CODES.length!==23 || new Set(CODES).size!==23)throw Error("D23_V2_CANONICAL_23_FAIL");
  const sourceBytes=fs.readFileSync(IN);
  const sourceSha=sha(sourceBytes);
  const cohort=cohortFromSource(sourceBytes.toString("utf8"));
  const stamp=sha(JSON.stringify({sourceSha,cohort,version:VERSION,model:"RESEARCH_ONLY"}));
  const statePath=CK+".source.json";
  if(fs.existsSync(CK)!==fs.existsSync(statePath))throw Error("D23_V2_UNSTAMPED_CHECKPOINT_REFUSED");
  if(fs.existsSync(statePath) && fs.readFileSync(statePath,"utf8")!==stamp)
    throw Error("D23_V2_CHECKPOINT_SOURCE_MISMATCH");
  if(!fs.existsSync(statePath)) {
    fs.mkdirSync(path.dirname(statePath),{recursive:true});
    fs.writeFileSync(statePath,stamp,{flag:"wx"});
  }
  const done:Record<string,OutputRow>=fs.existsSync(CK)?JSON.parse(fs.readFileSync(CK,"utf8")):{};
  const authorized=new Set(cohort.map(x=>x.raceId));
  for(const id of Object.keys(done)) {
    if(!authorized.has(id))throw Error("D23_V2_CHECKPOINT_UNKNOWN_RACE "+id);
    const row=done[id];
    verifyVectors(id,row.vectors,row.vectors.map(v=>v.no));
    if(row.sourceStatus!=="CURRENT_DB_PIT_NOT_PROVEN")throw Error("D23_V2_CHECKPOINT_BAD_PROVENANCE");
  }
  console.log("[COHORT] frozenUnique="+cohort.length+" sha256="+sourceSha+" resumed="+Object.keys(done).length+" readonly=true");
  const failures:Record<string,string>={};
  for(let i=0;i<cohort.length;i++) {
    const {raceId,date}=cohort[i];
    if(done[raceId]){console.log("[REUSE_CHECKPOINT] "+(i+1)+"/115 "+raceId);continue;}
    try {
      const dbRace=await db.race.findUnique({where:{id:raceId},select:{
        raceDay:{select:{date:true}},result:{select:{winnerNos:true}},
        runners:{where:{scratched:false},select:{no:true}}
      }});
      if(!dbRace)throw Error("RACE_NOT_FOUND");
      const targetDate=dbRace.raceDay.date.toISOString().slice(0,10);
      if(date && date!==targetDate)throw Error("FROZEN_DATE_DB_MISMATCH");
      const noSet=dbRace.runners.map(x=>x.no);
      const winner=dbRace.result?.winnerNos?.[0];
      if(typeof winner!=="number"||!noSet.includes(winner))throw Error("WINNER_NOT_IN_FIELD");
      const captured=await captureD23LiveVectors(raceId);
      if(captured.date!==targetDate)throw Error("CAPTURE_DATE_MISMATCH");
      verifyVectors(raceId,captured.vectors,noSet);
      done[raceId]={raceId,tarih:targetDate,winnerNo:winner,vectors:captured.vectors,sourceStatus:captured.sourceStatus};
      atomicWrite(CK,JSON.stringify(done));
      console.log("[CAPTURE] "+(i+1)+"/115 OK "+targetDate+" "+raceId+" horses="+noSet.length);
    }catch(e){
      failures[raceId]=e instanceof Error?e.message:String(e);
      console.error("[CAPTURE] "+(i+1)+"/115 FAIL "+raceId+" "+failures[raceId].slice(0,260));
    }
  }
  const rows=cohort.map(x=>done[x.raceId]).filter((r):r is OutputRow=>!!r);
  if(rows.length!==115) {
    console.error("[BLOCK] RECAPTURE_INCOMPLETE "+rows.length+"/115 failureSummary="+JSON.stringify(failures));
    throw Error("D23_V2_INCOMPLETE_115_CHECKPOINT_SAVED_FINAL_NOT_WRITTEN");
  }
  const dataset={meta:{formulaVersion:VERSION,featureEncoding:"D23_EQUIPMENT_ONEHOT_V2",
    sourceStatus:"CURRENT_DB_PIT_NOT_PROVEN",PIT:"NOT_VERIFIED",release:"BLOCKED",
    originalCohortSha256:sourceSha,cohortCount:115,codes:CODES},races:rows};
  const bytes=JSON.stringify(dataset);
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,bytes,{flag:"wx"});
  fs.writeFileSync(OUT+".sha256",sha(bytes)+"  "+path.basename(OUT)+"\n",{flag:"wx"});
  console.log("[DONE] RECAPTURE=115/115 SIGNALS=23 ENCODING=48 SHA256="+sha(bytes));
  console.log("[OUTPUT] "+OUT+" [RESEARCH_ONLY] [PIT_NOT_VERIFIED] [NO_DB_WRITE]");
}
main().catch(e=>{console.error("[RAN_D23_V2_FAIL]",e instanceof Error?e.message:String(e));process.exitCode=1;})
  .finally(async()=>{await db.$disconnect();});
