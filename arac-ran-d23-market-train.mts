/**
 * Offline D23+AGF research fit — no DB/network/production writes.
 *
 * RAN_D23_V2_IN: output of arac-ran-d23-v2-recapture.mts
 * RAN_D23_MARKET_IN: JSON array [{raceId,market:{pool,raceStartAt,cutoffAt,observations:[{no,agfPercent,capturedAt}]}}]
 * RAN_D23_MARKET_DEV_FROM: first chronologically later date reserved for evaluation (YYYY-MM-DD)
 * RAN_D23_MARKET_OUT: new model+metrics JSON, refuses overwrite
 *
 * Require one atomic historical AGF snapshot PRE-RACE per horse. Never look up
 * today's mutable AGF. Date split must be frozen before evaluating results.
 */
import fs from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {
  fitD23Market,scoreD23Market,evaluateD23Market,d23ModelFingerprint,
  type D23MarketRace,type D23MarketSnapshot
} from "./src/lib/rotaganyan-analiz-motoru/d23-market-model";
import type {RunnerFeatureVector} from "./src/lib/motor-v1/engine/feature-vector";

type ReCaptured={raceId:string;tarih:string;winnerNo:number;vectors:RunnerFeatureVector[];
  sourceStatus:string};
type MarketInput={raceId:string;market:D23MarketSnapshot};
const IN=process.env.RAN_D23_V2_IN;
const MARKET=process.env.RAN_D23_MARKET_IN;
const OUT=process.env.RAN_D23_MARKET_OUT??"C:/tmp/ran-d23-market-research-model.json";
const DEV_FROM=process.env.RAN_D23_MARKET_DEV_FROM;
const sha=(s:string|Buffer)=>createHash("sha256").update(s).digest("hex");

function readJson(file:string,label:string):{data:any;sha256:string}{
  if(!file || !fs.existsSync(file))throw Error("D23_MARKET_MISSING_FILE "+label);
  const bytes=fs.readFileSync(file);
  return {data:JSON.parse(bytes.toString("utf8")),sha256:sha(bytes)};
}
function positiveEnv(name:string,fallback:number):number{
  const s=process.env[name];
  const value=s===undefined?fallback:Number(s);
  if(!Number.isFinite(value) || value<=0)throw Error("D23_MARKET_BAD_FIT_OPTION "+name);
  return value;
}
function main(){
  if(!DEV_FROM || !/^\d{4}-\d{2}-\d{2}$/.test(DEV_FROM))
    throw Error("D23_MARKET_EXPLICIT_DEV_SPLIT_REQUIRED");
  if(fs.existsSync(OUT))throw Error("D23_MARKET_OUTPUT_EXISTS_NEW_NAME_REQUIRED");
  const source=readJson(IN??"","RAN_D23_V2_IN");
  const markets=readJson(MARKET??"","RAN_D23_MARKET_IN");
  const sourceRows:ReCaptured[]=source.data?.races;
  const marketRows:MarketInput[]=Array.isArray(markets.data)?markets.data:markets.data?.races;
  if(source.data?.meta?.formulaVersion!=="D23_FORMULAS_V2" ||
     source.data?.meta?.featureEncoding!=="D23_EQUIPMENT_ONEHOT_V2" ||
     source.data?.meta?.sourceStatus!=="CURRENT_DB_PIT_NOT_PROVEN" ||
     !Array.isArray(sourceRows) || !Array.isArray(marketRows))
    throw Error("D23_MARKET_SOURCE_FORMAT_OR_FORMULA_WRONG");
  const marketById=new Map<string,D23MarketSnapshot>();
  for(const row of marketRows){
    if(!row || typeof row.raceId!=="string" || marketById.has(row.raceId))
      throw Error("D23_MARKET_DUPLICATE_MARKET_RACE");
    marketById.set(row.raceId,row.market);
  }
  if(marketById.size!==sourceRows.length)
    throw Error("D23_MARKET_ALL_RACES_MUST_HAVE_FROZEN_AGF: no implicit cherry-picking");
  const seen=new Set<string>();
  const data:D23MarketRace[]=sourceRows.map(r=>{
    if(!r || typeof r.raceId!=="string" || seen.has(r.raceId) ||
       r.sourceStatus!=="CURRENT_DB_PIT_NOT_PROVEN")
      throw Error("D23_MARKET_DUPLICATE_OR_INVALID_RECAPTURE_ROW");
    seen.add(r.raceId);
    const market=marketById.get(r.raceId);
    if(!market)throw Error("D23_MARKET_AGF_NOT_FOUND "+r.raceId);
    return {raceId:r.raceId,tarih:r.tarih,winnerNo:r.winnerNo,vectors:r.vectors,market};
  });
  data.sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.raceId.localeCompare(b.raceId));
  const train=data.filter(x=>x.tarih<DEV_FROM);
  const dev=data.filter(x=>x.tarih>=DEV_FROM);
  if(train.length<2 || dev.length<1)throw Error("D23_MARKET_TRAIN_DEV_DAY_SPLIT_INVALID");
  if(train.at(-1)!.tarih>=dev[0].tarih)
    throw Error("D23_MARKET_DAY_LEAK");
  const opts={
    lambda:positiveEnv("RAN_D23_MARKET_LAMBDA",0.5),
    learningRate:positiveEnv("RAN_D23_MARKET_LR",0.04),
    iterations:positiveEnv("RAN_D23_MARKET_ITER",1200),
  };
  if(!Number.isSafeInteger(opts.iterations))throw Error("D23_MARKET_ITER_NOT_INTEGER");
  console.log("[D23_MARKET] 23 signals + AGF / one learned probability model");
  console.log("[FROZEN] recaptureSha="+source.sha256+" marketSha="+markets.sha256+
    " split="+DEV_FROM+" train="+train.length+" dev="+dev.length);
  const model=fitD23Market(train,opts);
  const trainMetrics=evaluateD23Market(train,model);
  const devMetrics=evaluateD23Market(dev,model);
  const baseline=devMetrics.market,combined=devMetrics.combined;
  const output={
    releaseStatus:"RESEARCH_ONLY_PIT_AND_INDEPENDENT_HOLDOUT_NOT_VERIFIED",
    source:{recaptureSha256:source.sha256,marketSha256:markets.sha256,
      evidence:"timestamps validated; original historical PIT provenance remains unverified",
      raceCount:sourceRows.length,trainCount:train.length,devCount:dev.length,
      trainLastDate:train.at(-1)!.tarih,devFirstDate:dev[0].tarih,
      devFrom:DEV_FROM},
    model,modelFingerprint:d23ModelFingerprint(model),
    metrics:{train:trainMetrics,dev:devMetrics,
      devVsMarket:{top1:combined.top1-baseline.top1,
        top3:combined.top3-baseline.top3,
        logLoss:combined.logLoss-baseline.logLoss}},
    warnings:[
      "Development races are not a final untouched acceptance holdout",
      "Historical market timestamps do not independently prove immutable pre-race availability",
      "No actual coupon ROI, drawdown or atomic publication verified",
      "No fixed favorite, surprise or banko selection rule",
    ],
  };
  const serialized=JSON.stringify(output,null,2);
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT,serialized,{flag:"wx"});
  fs.writeFileSync(OUT+".sha256",sha(serialized)+"  "+path.basename(OUT)+"\n",{flag:"wx"});
  console.log("[D23_MARKET_METRICS] "+JSON.stringify(output.metrics.dev));
  console.log("[D23_MARKET_RESULT] "+OUT+" SHA256="+sha(serialized));
  console.log("[RELEASE_BLOCKED] Needs untouched chronological PIT holdout, ROI and atomic snapshot wiring");
}
try{main();}catch(e){console.error("[D23_MARKET_FAILED]",e instanceof Error?e.message:String(e));process.exitCode=1;}
