/**
 * RAN D23 — source-drift correction by consistent recapture + refit.
 *
 * ALWAYS research-only. Original model was fitted to mutable historical source
 * fields. We CANNOT prove their August contents from today's DB. Never fake
 * that proof, never change production, never use DEV62 / Oct60.
 *
 * CAPTURE: load original 178 TRAIN labels only, compute all 23 codes using the
 * SAME captureD23LiveVectors used by staging inference, write frozen raw inputs,
 * source drift audit, 109 chronological walk-fold metrics, NEW refit artifact.
 * VERIFY: separately re-read ALL 178 races in a fresh process, strict compare
 * against captured raw features and write report. No training on held-out data.
 */
import "dotenv/config";
import fs from "node:fs";
import crypto from "node:crypto";
import { captureD23LiveVectors, smoothD23Pedigree } from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "./src/lib/motor-v1/engine/training";
import { buildWalkFolds, type FeatureRace } from "./src/lib/rotaganyan-analiz-motoru/rca/combinatorial-signal-selection";
import raw from "./src/lib/rotaganyan-analiz-motoru/artifacts/ran-d23-staging-candidate.json";

const mode=process.env.RAN_D23_MODE ?? "capture";
const original=process.env.RAN_D23_ORIGINAL ?? "";
const prefix=process.env.RAN_D23_PREFIX ?? "";
const originalSha="496f83de35ea0bdc499038de4783175201f2be5be1a90c8da24811594839e99d";
const codes=raw.modelArtifact.codes as readonly string[];
const opts:FitOptions={lambda:90,learningRate:0.25,iterations:2500};
const sha=(b:string|Buffer)=>crypto.createHash("sha256").update(b).digest("hex");
function fail(s:string):never {throw Error("D23_FIX_BLOCKED "+s)}
function ok(x:unknown,s:string):asserts x {if(!x)fail(s)}
function writeNew(file:string,content:string) {
  ok(!fs.existsSync(file) && !fs.existsSync(file+".part"),"OUTPUT_EXISTS "+file);
  fs.writeFileSync(file+".part",content,"utf8");fs.renameSync(file+".part",file);
}
function validateSet(a:FeatureRace[]) {
  ok(a.length===178,"REQUIRES_EXACT_178_TRAIN_RACES");
  let n=0;const ids=new Set<string>();
  for(const r of a){
    ok(r.raceId && !ids.has(r.raceId) && r.tarih>="2026-08-16" &&
       r.tarih<="2026-08-25","BAD_TRAIN_RACE "+r.raceId);
    ids.add(r.raceId);
    ok(r.vectors.length>=3 && Number.isInteger(r.winnerNo) &&
       r.vectors.some(v=>v.no===r.winnerNo),"BAD_TRAIN_WINNER "+r.raceId);
    const nos=new Set<number>();
    for(const v of r.vectors){
      ok(!nos.has(v.no) && v.raceId===r.raceId,"DUP_OR_FOREIGN_RUNNER "+r.raceId);
      nos.add(v.no);
      // Original SHA-pinned D23 physical dataset contains the exact 23 signals,
      // but did not promise model-column order. The first parity tool correctly
      // compared signals by their code. Validate BY CODE before reordering
      // IN MEMORY only; NEVER change frozen input bytes or impute values.
      // The SHA-pinned original dataset contains EXTRA research signals
      // beyond these 23 model columns. An exact 23-count guard was WRONG.
      // Check ONLY chosen codes, once each, and discard other features
      // from the in-memory training view; original file is never rewritten.
      ok(Array.isArray(v.signals) && v.signals.length>=codes.length,
        "INVALID_MODEL_SIGNAL_INPUT "+r.raceId+"/"+v.no);
      const selected=v.signals.filter(s=>codes.includes(s.code));
      ok(selected.length===codes.length,
        "MISSING_OR_DUPLICATE_CHOSEN_SIGNAL "+r.raceId+"/"+v.no+
        " selected="+selected.length+" all="+v.signals.length);
      const byCode=new Map(selected.map(s=>[s.code,s]));
      ok(byCode.size===codes.length &&
        codes.every(code=>byCode.has(code)),
        "INVALID_SELECTED_CODES "+r.raceId+"/"+v.no);
      for(const code of codes) {
        const s=byCode.get(code)!;
        ok(typeof s.observed==="boolean" &&
           (s.rawValue===null ||
             (typeof s.rawValue==="number" && Number.isFinite(s.rawValue))) &&
           (!s.observed || s.rawValue!==null),
          "INVALID_23_SIGNAL_VALUE "+r.raceId+"/"+v.no+"/"+code);
      }
      // Training/scoring use the exact same model feature order. Code-based
      // reordering is not a change to any score input or feature value.
      v.signals=codes.map(code=>byCode.get(code)!);
    }
    n+=r.vectors.length;
  }
  ok(n===1755,"START_COUNT_DRIFT "+n);
}
function normalize(a:FeatureRace[]) {
  return [...a].sort((x,y)=>x.tarih.localeCompare(y.tarih)||x.raceId.localeCompare(y.raceId));
}
function rawDiff(before:FeatureRace[],now:FeatureRace[]) {
  let same=0;const rows:{raceId:string;date:string;no:number;code:string;
    reason:string;oldValue:number|null;newValue:number|null}[]=[];
  const nowByRace=new Map(now.map(r=>[r.raceId,r]));
  for(const r of before) {
    const current=nowByRace.get(r.raceId);
    ok(!!current,"RACE_NOT_FOUND "+r.raceId);
    const byNo=new Map(current.vectors.map(v=>[v.no,v]));
    for(const v of r.vectors) {
      const vv=byNo.get(v.no);ok(!!vv,"RUNNER_NOT_FOUND "+r.raceId+"/"+v.no);
      const a=new Map(v.signals.map(s=>[s.code,s]));
      const b=new Map(vv.signals.map(s=>[s.code,s]));
      for(const code of codes){
        const x=a.get(code),y=b.get(code);
        ok(x && y,"MISSING_SIGNAL "+code);
        let reason="";
        if(x.observed!==y.observed)reason="OBSERVED";
        else if(x.rawValue!==y.rawValue && !(typeof x.rawValue==="number" &&
             typeof y.rawValue==="number" &&
             Math.abs(x.rawValue-y.rawValue)<=1e-8+1e-8*Math.max(Math.abs(x.rawValue),Math.abs(y.rawValue))))
          reason="RAW";
        else if(x.sampleCount!==y.sampleCount)reason="SAMPLE_COUNT";
        else if(x.coverageState && y.coverageState && x.coverageState!==y.coverageState)reason="COVERAGE";
        else same++;
        if(reason)rows.push({raceId:r.raceId,date:r.tarih,no:v.no,code,
          reason,oldValue:x.rawValue,newValue:y.rawValue});
      }
    }
  }
  return {same,rows,byCode:Object.fromEntries(codes.map(c=>[c,rows.filter(r=>r.code===c).length]))};
}
function csv(rows:ReturnType<typeof rawDiff>["rows"]) {
  const esc=(s:unknown)=>'"'+String(s??"").replaceAll('"','""')+'"';
  const cols=["raceId","date","no","code","reason","oldValue","newValue"] as const;
  return "\ufeff"+cols.join(";")+"\n"+rows.map(r=>cols.map(k=>esc(r[k])).join(";")).join("\n")+"\n";
}
function fittedPayload(a:{codes:readonly string[];names:readonly string[];beta:readonly number[];
    muSigma:Record<string,{mu:number;sigma:number;nObserved:number}>}) {
  const num=(x:number)=>Number(x.toFixed(10));
  return JSON.stringify({codes:a.codes,names:a.names,beta:a.beta.map(num),
    muSigma:Object.fromEntries(Object.entries(a.muSigma).sort(([a],[b])=>a<b?-1:a>b?1:0)
      .map(([k,v])=>[k,{mu:num(v.mu),sigma:num(v.sigma),nObserved:v.nObserved}]))});
}
function fitAndEvaluate(a:FeatureRace[]) {
  const processed=a.map(r=>({...r,vectors:r.vectors.map(smoothD23Pedigree)}));
  const metrics={n:0,top1:0,top3:0,top6:0,loss:0};
  for(const f of buildWalkFolds(processed)){
    const stats=computeFeatureStats(f.train.flatMap(r=>r.vectors),codes);
    const model=fitModel(f.train.map(r=>({raceId:r.raceId,
      date:new Date(r.tarih+"T00:00:00.000Z"),winnerNo:r.winnerNo,
      vectors:r.vectors})),stats,opts);
    ok(model.nRacesUsed===f.train.length,"FOLD_TRAIN_INCOMPLETE");
    for(const r of f.validation){
      const ranked=scoreRace(r.vectors,model).sort((x,y)=>y.probability-x.probability||x.no-y.no);
      const idx=ranked.findIndex(x=>x.no===r.winnerNo);
      ok(idx>=0&&ranked[idx].probability>0,"BAD_FOLD_WINNER");
      metrics.n++; metrics.top1+=Number(idx===0);metrics.top3+=Number(idx<3);
      metrics.top6+=Number(idx<6);metrics.loss-=Math.log(ranked[idx].probability);
    }
  }
  ok(metrics.n===109,"INVALID_WALK_FOLD_N "+metrics.n);
  const stats=computeFeatureStats(processed.flatMap(r=>r.vectors),codes);
  const fitted=fitModel(processed.map(r=>({raceId:r.raceId,
    date:new Date(r.tarih+"T00:00:00.000Z"),winnerNo:r.winnerNo,
    vectors:r.vectors})),stats,opts);
  ok(fitted.nRacesUsed===178 && fitted.beta.length===46 &&
     fitted.beta.every(Number.isFinite),"FINAL_REFIT_INVALID");
  const muSigma=Object.fromEntries(stats.entries());
  const model={engineVersion:"RAN-D23-REFIT-RESEARCH-PIT-UNVERIFIED",
    motorAdi:"Rotaganyan Analiz Motoru",
    deploymentReady:false,independentHoldoutValidated:false,
    trainedAt:new Date().toISOString(),nRacesTrain:178,nRacesHoldout:0,
    lambda:opts.lambda,learningRate:opts.learningRate,iterations:opts.iterations,
    codes:[...codes],names:fitted.names,beta:fitted.beta,muSigma,
    weightsFingerprint:sha(fittedPayload({codes,names:fitted.names,beta:fitted.beta,muSigma}))
  };
  return {model,fold109:{n:metrics.n,top1:metrics.top1,top3:metrics.top3,
    top6:metrics.top6,logLoss:metrics.loss/metrics.n}};
}
async function collect(old:FeatureRace[]) {
  const result:FeatureRace[]=[];
  // Recoverable diagnostics: preserve every completed race, NEVER silently skip a
  // missing feature or a failed calculation. Newly created journal is research only.
  const journal=prefix+".journal-"+mode+".ndjson";
  const fd=fs.openSync(journal,"wx");
  fs.closeSync(fd);
  for(let i=0;i<old.length;i++){
    const r=old[i];
    console.log("[D23-FIX] BEGIN="+(i+1)+"/"+old.length+" RACE="+r.raceId);
    try {
      const calc=await captureD23LiveVectors(r.raceId);
      ok(calc.date===r.tarih,"DATE_CHANGED "+r.raceId);
      const phys=new Set(r.vectors.map(v=>v.no));
      ok(calc.vectors.length===r.vectors.length &&
        calc.vectors.every(v=>phys.has(v.no)),"PHYSICAL_FIELD_CHANGED "+r.raceId);
      const captured={...r,vectors:calc.vectors};
      result.push(captured);
      fs.appendFileSync(journal,JSON.stringify(captured)+"\n","utf8");
      console.log("[D23-FIX] OK="+(i+1)+"/"+old.length+" RACE="+r.raceId);
    } catch(e) {
      const err=e instanceof Error?e.stack??e.message:String(e);
      const failure={
        status:"CAPTURE_STOPPED_NO_MODEL_FIT",mode,
        failedIndex:i+1,total:old.length,raceId:r.raceId,date:r.tarih,
        completed:result.length,source:"CURRENT_DB_HISTORICAL_PIT_NOT_PROVEN",
        failure:err,partialJournal:journal,releaseAllowed:false,
      };
      writeNew(prefix+".failure.json",JSON.stringify(failure,null,2));
      console.error("[D23-FIX] FAILED_RACE="+r.raceId+" INDEX="+(i+1));
      console.error("[D23-FIX] ROOT_ERROR="+err);
      console.error("[D23-FIX] FAILURE_REPORT="+prefix+".failure.json");
      throw Error("D23_CAPTURE_FAILURE_AT_"+(i+1)+"_RACE_"+r.raceId);
    }
  }
  return result;
}
async function run(){
  ok(codes.length===23&&raw.modelArtifact.deploymentReady===false,
      "MODEL_RESEARCH_CONTRACT");
  ok(prefix.startsWith("C:\\tmp\\") && !prefix.includes(".."),
      "OUTPUT_PREFIX_MUST_BE_UNDER_C_TMP");
  const originalBytes=fs.readFileSync(original);
  ok(sha(originalBytes)===originalSha,"FROZEN_LABEL_FILE_SHA_CHANGED");
  const old=normalize(JSON.parse(originalBytes.toString("utf8")) as FeatureRace[]);
  validateSet(old);
  const {db}=await import("./src/lib/db");
  try {
    if(mode==="probe"){
      const first=await collect(old.slice(0,3));
      writeNew(prefix+".probe.json",JSON.stringify({
        status:"PROBE_OK_NO_MODEL_FIT",races:first.length,
        sourceStatus:"CURRENT_DB_HISTORICAL_PIT_NOT_PROVEN",releaseAllowed:false
      },null,2));
      console.log("[D23-FIX] PROBE_OK="+first.length);
    }else if(mode==="capture"){
      const recaptured=normalize(await collect(old));validateSet(recaptured);
      const sourceText=JSON.stringify(recaptured);
      const differences=rawDiff(old,recaptured);
      const trained=fitAndEvaluate(recaptured);
      const sourceHash=sha(sourceText);
      writeNew(prefix+".source.json",sourceText);
      writeNew(prefix+".drift.csv",csv(differences.rows));
      writeNew(prefix+".candidate.json",JSON.stringify({
        status:"NEW_CANDIDATE_RESEARCH_ONLY_PIT_NOT_PROVEN",
        frozenSourceSha256:sourceHash,
        modelArtifact:trained.model,
        performance:trained.fold109,
        originalReference109:raw.reference109,
        releaseAllowed:false
      },null,2));
      writeNew(prefix+".capture-report.json",JSON.stringify({
        status:"RETRAINED_CURRENT_SOURCE_PIT_NOT_PROVEN",
        sourceSha256:sourceHash,sourceStatus:"CURRENT_DB_NOT_HISTORICAL_IMMUTABLE",
        races:178,starts:1755,diffsAgainstOriginal:differences.rows.length,
        diffByCode:differences.byCode,fold109:trained.fold109,
        previousFold109:raw.reference109,releaseAllowed:false,
        nextStep:"RUN_FRESH_PROCESS_VERIFY_THEN_SEPARATE_INDEPENDENT_HOLDOUT"
      },null,2));
      console.log("[D23-FIX] ORIGINAL_DIFFS="+differences.rows.length);
      console.log("[D23-FIX] NEW_FOLD109="+JSON.stringify(trained.fold109));
      console.log("[D23-FIX] SOURCE_SHA="+sourceHash);
      console.log("[D23-FIX] RELEASE_ALLOWED=FALSE PIT_NOT_PROVEN");
    }else if(mode==="verify"){
      const capturedFile=prefix+".source.json";
      ok(fs.existsSync(capturedFile),"CAPTURE_NOT_FOUND");
      const saved=fs.readFileSync(capturedFile);
      const savedRaces=normalize(JSON.parse(saved.toString("utf8")) as FeatureRace[]);
      validateSet(savedRaces);
      const fresh=normalize(await collect(old));validateSet(fresh);
      const differences=rawDiff(savedRaces,fresh);
      writeNew(prefix+".verify-report.json",JSON.stringify({
        status:differences.rows.length===0?"CURRENT_SOURCE_REPLAY_STABLE_PIT_NOT_PROVEN":
          "CURRENT_SOURCE_CHANGED_AGAIN_STOP",
        capturedSha256:sha(saved),verificationSourceSha256:sha(JSON.stringify(fresh)),
        races:178,starts:1755,replayDifferences:differences.rows.length,
        differencesByCode:differences.byCode,releaseAllowed:false
      },null,2));
      console.log("[D23-FIX] REPLAY_DIFFS="+differences.rows.length);
      console.log("[D23-FIX] REPLAY_STATUS="+(differences.rows.length?"DRIFTED":"STABLE"));
      console.log("[D23-FIX] RELEASE_ALLOWED=FALSE PIT_NOT_PROVEN");
      if(differences.rows.length)process.exitCode=3;
    }else fail("UNKNOWN_MODE "+mode);
  }finally{await db.$disconnect()}
}
run().catch(e=>{console.error(e instanceof Error?e.stack:String(e));process.exitCode=1});
