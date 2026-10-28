/**
 * D23 x AGF trend point-in-time research ablation. READ ONLY.
 * Usage (Windows):
 *   node node_modules/tsx/dist/cli.mjs ./arac-ran-d23-agf-trend-pit-deneyi.mts <frozen115.ndjson> [output-prefix]
 *
 * First call collects only timestamped AgfSnapshot history for 115 exact frozen
 * races; subsequent calls reuse the SHA-checked sidecar. The same 86 train /
 * 29 chronological dev races are used across four models. NO model deployment,
 * no prediction/coupon writes, and NO claimed six-leg ROI.
 */
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {db} from "./src/lib/db";
import {computeFeatureStats,fitModel,scoreRace,type TrainingRace,
  type FittedModel} from "./src/lib/motor-v1/engine/training";
import type {RunnerFeatureVector} from "./src/lib/motor-v1/engine/feature-vector";
import {smoothD23Pedigree} from "./src/lib/rotaganyan-analiz-motoru/d23-feature-capture";
import {AGF_TREND_CODE,AGF_ACTIVITY_CODE,agfPITSignals,
  observeAgfTrendAsOf,raceCutoffUtc,type PitAgfObservation,type TimestampedAgf
} from "./src/lib/rotaganyan-analiz-motoru/agf-trend-pit";
import modelArtifact from "./src/lib/rotaganyan-analiz-motoru/artifacts/ran-d23-staging-candidate.json";

const SOURCE_SHA="311d2bdea8fded3ae08b0c4edb02dab5e5f3469d1b1ad5befaaa78c25437d50f";
const WEIGHTS_SHA="fafebc0daf6734b193b05389a07b5192e775a7afd799373684e12e4e859e816c";
const CUTOFF_MIN=15;
type FrozenRow={raceId:string;tarih:string;winnerNo:number;vectors:RunnerFeatureVector[]};
type AsOfRace={date:string;raceTime:string|null;cutoffUtc:string|null;
  runners:Record<string,PitAgfObservation>};
type Sidecar={schema:"D23_AGF_TREND_PIT_1";journalSha256:string;weightsSha256:string;
  cutoffMinutes:number;createdAt:string;races:Record<string,AsOfRace>};
type Metric={races:number;top1:number;top3:number;top6:number;logLoss:number;
  raceBrier:number;ece:number;meanWinningRank:number};
type Outcome={raceId:string;winnerNo:number;winnerRank:number;probWinner:number;
  picks:number[];scores:ReturnType<typeof scoreRace>};
const hash=(b:Buffer|string)=>createHash("sha256").update(b).digest("hex");
function fail(message:string):never{throw Error("[D23-AGF-PIT] "+message);}
const src=process.argv[2];
if(!src || !fs.existsSync(src))fail("FROZEN_NDJSON_PATH_REQUIRED");
const output=process.argv[3]??path.join(path.dirname(src),"ran-d23-agf-trend-pit");
const source=fs.readFileSync(src);
if(hash(source)!==SOURCE_SHA)fail("FROZEN_115_SOURCE_SHA_MISMATCH");
if(modelArtifact.modelArtifact.weightsFingerprint!==WEIGHTS_SHA ||
  modelArtifact.modelArtifact.nRacesTrain!==115)
  fail("D23_115_WEIGHTS_MISMATCH");
const rows:FrozenRow[]=source.toString("utf8").split(/\r?\n/).filter(Boolean).map(l=>JSON.parse(l) as FrozenRow);
const totalRunners=rows.reduce((s,r)=>s+r.vectors.length,0);
if(rows.length!==115 || totalRunners!==1126 ||
  new Set(rows.map(r=>r.raceId)).size!==115)fail("FROZEN_FIELD_COUNT_MISMATCH");
for(const r of rows){
  if (!/^2026-08-\d{2}$/.test(r.tarih) || !Number.isSafeInteger(r.winnerNo) ||
      !r.vectors.some(v=>v.no===r.winnerNo) ||
      new Set(r.vectors.map(v=>v.no)).size!==r.vectors.length)
    fail("BAD_FROZEN_RACE "+r.raceId);
}
const rawCodes=[...modelArtifact.modelArtifact.codes];
if(rawCodes.length!==23 || new Set(rawCodes).size!==23)fail("BAD_MODEL_FEATURES");
const trainRows=rows.filter(r=>r.tarih<"2026-08-21");
const devRows=rows.filter(r=>r.tarih>="2026-08-21");
if(trainRows.length!==86 || devRows.length!==29 ||
   Math.max(...trainRows.map(r=>Date.parse(r.tarih))) >=
   Math.min(...devRows.map(r=>Date.parse(r.tarih))))
  fail("EXPECTED_CHRONO_SPLIT_86_29");
const sidecarPath=output+".pit-agf.json";
const reportPath=output+".comparison.json";
console.log("[D23-AGF-PIT] SOURCE_SHA="+SOURCE_SHA+" FROZEN=115/1126 TRAIN=86 DEV=29");

async function collect():Promise<Sidecar>{
  // 2 read-only query groups; no mutable Runner.agf is selected or loaded.
  const raceIds=rows.map(r=>r.raceId);
  const raceMeta=await db.race.findMany({
    where:{id:{in:raceIds}},
    select:{id:true,time:true,raceDay:{select:{date:true}},
      runners:{where:{scratched:false},select:{id:true,no:true}}}
  });
  if(raceMeta.length!==115)fail("MISSING_RACE_METADATA "+raceMeta.length);
  const mapped=new Map(raceMeta.map(r=>[r.id,r]));
  const runnerIds=raceMeta.flatMap(r=>r.runners.map(x=>x.id));
  const agfRows=await db.agfSnapshot.findMany({
    where:{runnerId:{in:runnerIds}},
    select:{id:true,runnerId:true,capturedAt:true,agf:true},
    orderBy:[{capturedAt:"asc"},{id:"asc"}]
  });
  const agfById=new Map<string,TimestampedAgf[]>();
  for(const s of agfRows){
    const a=agfById.get(s.runnerId)??[];
    a.push({id:s.id,agf:s.agf,capturedAt:s.capturedAt});
    agfById.set(s.runnerId,a);
  }
  const races:Record<string,AsOfRace>={};
  for(const frozen of rows){
    const r=mapped.get(frozen.raceId)!;
    if(r.raceDay.date.toISOString().slice(0,10)!==frozen.tarih)
      fail("RACE_DATE_CHANGED "+r.id);
    const actualNos=r.runners.map(x=>x.no).sort((a,b)=>a-b).join(",");
    const frozenNos=frozen.vectors.map(x=>x.no).sort((a,b)=>a-b).join(",");
    if(actualNos!==frozenNos)fail("RACE_RUNNERS_CHANGED "+r.id);
    let cutoff:Date|null=null;
    try{cutoff=raceCutoffUtc(r.raceDay.date,r.time,CUTOFF_MIN);}catch{}
    const runnerOut:Record<string,PitAgfObservation>={};
    for(const runner of r.runners){
      runnerOut[String(runner.no)]=cutoff?observeAgfTrendAsOf(
        r.raceDay.date,cutoff,agfById.get(runner.id)??[]):{
          first:null,last:null,deltaPp:null,active:null,eligibleSnapshots:0,
          excludedPostCutoff:(agfById.get(runner.id)??[]).length,
          status:"NOT_ENOUGH_DISTINCT_PRE_RACE_SNAPSHOTS"
        };
    }
    races[r.id]={date:frozen.tarih,raceTime:r.time,
      cutoffUtc:cutoff?.toISOString()??null,runners:runnerOut};
  }
  const sc:Sidecar={schema:"D23_AGF_TREND_PIT_1",journalSha256:SOURCE_SHA,
    weightsSha256:WEIGHTS_SHA,cutoffMinutes:CUTOFF_MIN,
    createdAt:new Date().toISOString(),races};
  fs.mkdirSync(path.dirname(sidecarPath),{recursive:true});
  fs.writeFileSync(sidecarPath,JSON.stringify(sc,null,2)+"\n",{flag:"wx"});
  console.log("[D23-AGF-PIT] SNAPSHOT_CAPTURED="+sidecarPath+" SNAPSHOTS="+agfRows.length);
  return sc;
}
async function getSidecar():Promise<Sidecar>{
  const o:Sidecar=fs.existsSync(sidecarPath)?
    JSON.parse(fs.readFileSync(sidecarPath,"utf8")) as Sidecar:await collect();
  if(o.schema!=="D23_AGF_TREND_PIT_1" || o.journalSha256!==SOURCE_SHA ||
     o.weightsSha256!==WEIGHTS_SHA || o.cutoffMinutes!==CUTOFF_MIN ||
     Object.keys(o.races).length!==115)
    fail("SIDECAR_PROVENANCE_MISMATCH");
  for(const frozen of rows){
    const a=o.races[frozen.raceId];
    if(!a || a.date!==frozen.tarih ||
       Object.keys(a.runners).length!==frozen.vectors.length ||
       frozen.vectors.some(v=>!(String(v.no) in a.runners)))
      fail("SIDECAR_RUNNER_INTEGRITY "+frozen.raceId);
  }
  return o;
}
function decorate(r:FrozenRow,sc:Sidecar,codeList:readonly string[]):TrainingRace{
  return {raceId:r.raceId,date:new Date(r.tarih+"T00:00:00.000Z"),winnerNo:r.winnerNo,
    vectors:r.vectors.map(v=>{
      const normalized=smoothD23Pedigree(v);
      const extra=agfPITSignals(sc.races[r.raceId].runners[String(v.no)]);
      return {...normalized,
        signals:[...normalized.signals,...extra.filter(s=>codeList.includes(s.code))]};
    })};
}
function evaluate(ds:TrainingRace[],model:FittedModel<string>):
  {metric:Metric;outcomes:Outcome[]} {
  const outs:Outcome[]=[];
  const bins=Array.from({length:5},()=>({p:0,y:0,n:0}));
  let top1=0,top3=0,top6=0,loss=0,brier=0,rankSum=0;
  for(const r of ds){
    const s=scoreRace(r.vectors,model).sort((a,b)=>b.probability-a.probability||a.no-b.no);
    const index=s.findIndex(x=>x.no===r.winnerNo);
    if(index<0)fail("WINNER_MISSING_EVALUATION "+r.raceId);
    const p=s[index].probability;
    const winnerRank=index+1;
    top1+=+(winnerRank===1);top3+=+(winnerRank<=3);top6+=+(winnerRank<=6);
    loss-=Math.log(Math.max(p,1e-15));rankSum+=winnerRank;
    brier+=s.reduce((acc,x)=>acc+(x.probability-+(x.no===r.winnerNo))**2,0);
    for(const x of s){const z=bins[Math.min(4,Math.floor(x.probability*5))];
      z.p+=x.probability;z.y+=+(x.no===r.winnerNo);z.n++;}
    outs.push({raceId:r.raceId,winnerNo:r.winnerNo,winnerRank,
      probWinner:p,picks:s.slice(0,3).map(x=>x.no),scores:s});
  }
  const n=ds.length;
  const ece=bins.reduce((sum,b)=>sum+(b.n===0?0:b.n/ds.reduce((a,r)=>a+r.vectors.length,0)*
    Math.abs(b.p/b.n-b.y/b.n)),0);
  return {metric:{races:n,top1,top3,top6,logLoss:loss/n,
    raceBrier:brier/n,ece,meanWinningRank:rankSum/n},outcomes:outs};
}
function coefficientShifts(ref:FittedModel<string>,test:FittedModel<string>){
  const changes=rawCodes.map((code,i)=>({
    code,baselineZ:ref.beta[2*i],candidateZ:test.beta[2*i],
    absDelta:Math.abs(ref.beta[2*i]-test.beta[2*i]),
    missingDelta:Math.abs(ref.beta[2*i+1]-test.beta[2*i+1])
  })).sort((a,b)=>b.absDelta-a.absDelta);
  return {sumAbsZDelta:changes.reduce((sum,x)=>sum+x.absDelta,0),
    topChanges:changes.slice(0,8)};
}
function coverage(sc:Sidecar,races:FrozenRow[]){
  let observed=0,winnerObserved=0,up=0,down=0,flat=0;
  const reasons:Record<string,number>={};
  for(const r of races){
    for(const v of r.vectors){
      const x=sc.races[r.raceId].runners[String(v.no)];
      if(x.status==="OBSERVED"){
        observed++;
        if(v.no===r.winnerNo)winnerObserved++;
        if(x.deltaPp!>=1)up++;
        else if(x.deltaPp!<=-1)down++;
        else flat++;
      }else reasons[x.status]=(reasons[x.status]??0)+1;
    }
  }
  const count=races.reduce((n,r)=>n+r.vectors.length,0);
  return {races:races.length,starters:count,observed,
    observedShare:observed/count,winnersCovered:winnerObserved,
    winnerCoverage:winnerObserved/races.length,up,down,flat,reasons};
}
async function main(){
  const sc=await getSidecar();
  const cov={train:coverage(sc,trainRows),dev:coverage(sc,devRows),
    all:coverage(sc,rows)};
  console.log("[D23-AGF-PIT] COVERAGE="+JSON.stringify(cov));
  // Low coverage is transparently flagged, not silently treated as all runners.
  const threshold={minObservedShare:0.6,minWinnerCoverage:0.6};
  const sufficient=([cov.train,cov.dev].every(x=>
    x.observedShare>=threshold.minObservedShare &&
    x.winnerCoverage>=threshold.minWinnerCoverage));
  const options={lambda:90,learningRate:0.25,iterations:2500};
  const variants=[
    {name:"D23_23",extra:[]},
    {name:"D23_24_TREND",extra:[AGF_TREND_CODE]},
    {name:"D23_24_ACTIVITY",extra:[AGF_ACTIVITY_CODE]},
    {name:"D23_25_TREND_ACTIVITY",extra:[AGF_TREND_CODE,AGF_ACTIVITY_CODE]},
  ];
  const evaluated=[] as Array<{
    name:string;codes:string[];fitRaces:number;metrics:Metric;
    rawModelCoefficients:number[];outcomes:Outcome[];
  }>;
  for(const variant of variants){
    const codes=[...rawCodes,...variant.extra];
    const train=trainRows.map(r=>decorate(r,sc,codes));
    const dev=devRows.map(r=>decorate(r,sc,codes));
    const stats=computeFeatureStats(train.flatMap(r=>r.vectors),codes);
    const fitted=fitModel(train,stats,options);
    if(fitted.nRacesUsed!==86 || fitted.beta.length!==2*codes.length)
      fail("MODEL_TRAIN_SIZE_MISMATCH "+variant.name);
    const x=evaluate(dev,fitted);
    evaluated.push({name:variant.name,codes,fitRaces:fitted.nRacesUsed,
      metrics:x.metric,rawModelCoefficients:fitted.beta,outcomes:x.outcomes});
    console.log("[D23-AGF-PIT] "+variant.name+" "+JSON.stringify(x.metric));
  }
  const reference=evaluated[0];
  const comparison=evaluated.map((x,i)=>{
    const refOut=new Map(reference.outcomes.map(y=>[y.raceId,y]));
    const rescued=x.outcomes.filter(y=>y.winnerRank<=3 &&
       refOut.get(y.raceId)!.winnerRank>3).map(y=>({raceId:y.raceId,winnerNo:y.winnerNo}));
    const lost=x.outcomes.filter(y=>y.winnerRank>3 &&
       refOut.get(y.raceId)!.winnerRank<=3).map(y=>({raceId:y.raceId,winnerNo:y.winnerNo}));
    const meanAbsProbabilityShift=x.outcomes.reduce((total,y)=>
      total+y.scores.reduce((sum,h)=>
        sum+Math.abs(h.probability-(refOut.get(y.raceId)!.scores.find(t=>t.no===h.no)?.probability??0)),0),
      0)/devRows.reduce((sum,r)=>sum+r.vectors.length,0);
    const deltas={top1:x.metrics.top1-reference.metrics.top1,
      top3:x.metrics.top3-reference.metrics.top3,
      logLoss:x.metrics.logLoss-reference.metrics.logLoss,
      ece:x.metrics.ece-reference.metrics.ece};
    const shifts=rawCodes.map((code,j)=>({
      code,base:reference.rawModelCoefficients[2*j],
      newValue:x.rawModelCoefficients[2*j],
      absDelta:Math.abs(reference.rawModelCoefficients[2*j]-x.rawModelCoefficients[2*j])
    })).sort((a,b)=>b.absDelta-a.absDelta);
    return {name:x.name,featureCount:x.codes.length,metrics:x.metrics,deltas,
      marketCoefficients:x.rawModelCoefficients.slice(46),meanAbsProbabilityShift,
      shifts:{sumAbs:shifts.reduce((s,v)=>s+v.absDelta,0),
        topChangedSignals:shifts.slice(0,8)},rescued,lost,
      top1Changed:x.outcomes.filter(o=>o.scores[0].no!==refOut.get(o.raceId)!.scores[0].no).length};
  });
  const report={status:sufficient?"EXPLORATORY_DEV_ONLY":"INSUFFICIENT_PRE_RACE_AGF_COVERAGE",
    releaseAllowed:false,independentHoldoutValidated:false,
    pointInTimeLimitations:[
      "CapturedAt cutoffs filter timestamps but cannot independently certify that records were not backfilled",
      "Original D23 23-signal journal itself is not independently PIT-proven",
      "86 train / 29 dev belong to the same frozen 115-race cohort; NOT an external holdout",
      "No pre-race payout odds or six-leg payout data in the frozen journal; ROI NOT MEASURED",
      "86 race train vs 29 race dev; small and vulnerable to chance. This is NOT deployment approval"
    ],journalSha256:SOURCE_SHA,weightsSha256:WEIGHTS_SHA,sidecarPath,
    cutoffMinutes:CUTOFF_MIN,trainRaces:86,devRaces:29,
    thresholds:threshold,coverage:cov,comparison,
    rca:reference.outcomes.map(o=>({
      raceId:o.raceId,winnerNo:o.winnerNo,
      ranks:Object.fromEntries(evaluated.map(m=>
        [m.name,m.outcomes.find(x=>x.raceId===o.raceId)!.winnerRank]))
    })),roiStatus:"NOT_MEASURED_NO_PRE_RACE_ODDS"};
  fs.mkdirSync(path.dirname(reportPath),{recursive:true});
  fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+"\n");
  console.log("[D23-AGF-PIT] REPORT="+reportPath+" STATUS="+report.status);
  console.log("[D23-AGF-PIT] NO_DATABASE_WRITES_NO_DEPLOY_NO_PRODUCTION");
}
main().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>db.$disconnect());
