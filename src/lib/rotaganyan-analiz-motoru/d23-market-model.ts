/**
 * D23 MARKET INTERSECTION — research only, never changes production prediction or coupon.
 * One final conditional-logit model learns AGF weight together with 23 strength signals.
 * The strength-only and market-only fits are diagnostic baselines, NOT sequential meta-models.
 * Four explanatory regimes do not affect scoring, ranking, banko or coupon decisions.
 *
 * All inputs must be explicitly frozen, timestamped PRE-RACE. Mutable Runner.agf is forbidden.
 */
import {createHash} from "node:crypto";
import {dot,fitConditionalLogit,type TrainingRunner} from "@/lib/v5461/conditional-logit";
import {softmax} from "@/lib/v5461/math";
import {
  computeFeatureStats,fitModel,toModelVector,
  type FitOptions,type FeatureStats,
} from "@/lib/motor-v1/engine/training";
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import researchArtifact from "./artifacts/ran-d23-staging-candidate.json";

export const D23_MARKET_VERSION="D23_AGF_INTERSECTION_V1" as const;
export const D23_CODES: readonly string[]=researchArtifact.modelArtifact.codes;
const ENCODING="D23_EQUIPMENT_ONEHOT_V2" as const;
const FORMULA="D23_FORMULAS_V2" as const;
const EPS_MARKET_PCT=1e-6; // numerical log(0) guard, NOT a bet / classification threshold

export type D23MarketObservation={
  no:number;
  agfPercent:number;
  capturedAt:string; // timestamp with explicit timezone
};
export type D23MarketSnapshot={
  pool:"AGF1"|"AGF2";
  raceStartAt:string;
  cutoffAt:string;
  observations:D23MarketObservation[];
};
export type D23MarketRace={
  raceId:string;
  tarih:string; // YYYY-MM-DD in Turkey race calendar
  winnerNo:number|null;
  vectors:RunnerFeatureVector[];
  market:D23MarketSnapshot;
};
export type D23Regime=
  "BANKO_POTANSIYELI"|"SURPRIZ_ADAYI"|"PIYASA_FAZLA_DESTEKLIYOR"|"NORMAL";
export type D23MarketModel={
  version:typeof D23_MARKET_VERSION;
  formulaVersion:typeof FORMULA;
  encoding:typeof ENCODING;
  codes:string[];
  names:string[];
  stats:Record<string,{mu:number;sigma:number;nObserved:number}>;
  strengthBeta:number[];
  marketAlpha:number;
  combinedBeta:number[]; // [market_log_share, ...48 exact D23 encoder coordinates]
  fitOptions:FitOptions;
  trainRaceCount:number;
  sourceStatus:"RESEARCH_ONLY_PIT_UNVERIFIED";
};
export type D23MarketPrediction={
  no:number;name:string;rank:number;
  agfPercent:number;marketProbability:number;
  strengthProbability:number;winProbability:number;
  deltaVsMarket:number;strengthRank:number;marketRank:number;
  regime:D23Regime;
  /** True only for the top-ranked probability; AGF alignment NOT required. */
  leadingCandidate:boolean;
};
type Prepared={race:D23MarketRace; logMarket:number[]; agfPercent:number[]};

function timestamp(s:string,label:string):number {
  if(typeof s!=="string" || !/^\d{4}-\d{2}-\d{2}T.*(?:Z|[+-]\d{2}:\d{2})$/.test(s))
    throw Error("D23_MARKET_TIMESTAMP_WITH_TIMEZONE_REQUIRED "+label);
  const t=Date.parse(s);
  if(!Number.isFinite(t))throw Error("D23_MARKET_TIMESTAMP_INVALID "+label);
  return t;
}
function assertCodes(codes:readonly string[]){
  if(codes.length!==23 || new Set(codes).size!==23 ||
    codes.some((c,i)=>c!==D23_CODES[i]) || codes.includes("AGF"))
    throw Error("D23_MARKET_23_CANONICAL_CODES_REQUIRED");
}
function modelVector(v:RunnerFeatureVector,stats:FeatureStats<string>):number[]{
  const {vector}=toModelVector(v,stats,ENCODING);
  if(vector.length!==48 || vector.some(x=>!Number.isFinite(x)))
    throw Error("D23_MARKET_ENCODER_MUST_HAVE_48_FINITE_COLUMNS");
  return vector;
}
/** Validate the exact same atomic timestamp for ALL runners, and no post-cutoff leakage. */
export function prepareD23MarketRace(race:D23MarketRace):Prepared {
  if(!race || typeof race.raceId!=="string" || !race.raceId ||
     !/^\d{4}-\d{2}-\d{2}$/.test(race.tarih) ||
     !Array.isArray(race.vectors) || race.vectors.length<2 ||
     !race.market || !["AGF1","AGF2"].includes(race.market.pool) ||
     !Array.isArray(race.market.observations))
    throw Error("D23_MARKET_RACE_INVALID");
  const start=timestamp(race.market.raceStartAt,"start");
  const cutoff=timestamp(race.market.cutoffAt,"cutoff");
  if(!(cutoff<start) ||
     new Date(start+3*60*60*1000).toISOString().slice(0,10)!==race.tarih)
    throw Error("D23_MARKET_CUTOFF_OR_RACE_DAY_INVALID");
  const obs=new Map<number,D23MarketObservation>();
  let snapshotTime:number|null=null;
  for(const o of race.market.observations) {
    if(!o || !Number.isSafeInteger(o.no) || o.no<=0 ||
       !Number.isFinite(o.agfPercent) || o.agfPercent<0 || o.agfPercent>100 ||
       obs.has(o.no))throw Error("D23_MARKET_OBSERVATION_INVALID_OR_DUPLICATE");
    const t=timestamp(o.capturedAt,"snapshot");
    if(t>cutoff || t>=start)throw Error("D23_MARKET_POST_CUTOFF_LEAKAGE");
    if(snapshotTime!==null && t!==snapshotTime)
      throw Error("D23_MARKET_NONATOMIC_SNAPSHOT");
    snapshotTime=t;
    obs.set(o.no,o);
  }
  if(obs.size!==race.vectors.length || snapshotTime===null)
    throw Error("D23_MARKET_MISSING_SNAPSHOT_RUNNER");
  const ids=new Set<number>();
  const agfPercent=race.vectors.map(v=>{
    if(v.raceId!==race.raceId || !Number.isSafeInteger(v.no) || v.no<=0 ||
      ids.has(v.no) || v.d23FormulaVersion!==FORMULA ||
      v.signals.length!==23 || new Set(v.signals.map(s=>s.code)).size!==23 ||
      D23_CODES.some(code=>!v.signals.some(s=>s.code===code)))
      throw Error("D23_MARKET_VECTOR_SOURCE_MISMATCH");
    ids.add(v.no);
    const percent=obs.get(v.no)?.agfPercent;
    if(percent===undefined)throw Error("D23_MARKET_UNMATCHED_RUNNER");
    return percent;
  });
  const agfSum=agfPercent.reduce((a,b)=>a+b,0);
  if(agfSum<=0)throw Error("D23_MARKET_AGF_EMPTY");
  // For a race, constant normalization cancels under softmax. Center for numerical stability.
  const logs=agfPercent.map(x=>Math.log(Math.max(x,EPS_MARKET_PCT)));
  const avg=logs.reduce((a,b)=>a+b,0)/logs.length;
  return {race,agfPercent,logMarket:logs.map(x=>x-avg)};
}
function statsFrom(m:D23MarketModel):FeatureStats<string>{
  return new Map(m.codes.map(c=>[c,m.stats[c]]));
}
export function assertD23MarketModel(m:D23MarketModel):void {
  if(!m || m.version!==D23_MARKET_VERSION ||
     m.formulaVersion!==FORMULA || m.encoding!==ENCODING ||
     m.sourceStatus!=="RESEARCH_ONLY_PIT_UNVERIFIED" ||
     !Array.isArray(m.codes) || !Array.isArray(m.names))throw Error("D23_MARKET_MODEL_VERSION_INVALID");
  assertCodes(m.codes);
  if(m.names.length!==48 || m.strengthBeta.length!==48 ||
     m.combinedBeta.length!==49 || !Number.isFinite(m.marketAlpha) ||
     [...m.strengthBeta,...m.combinedBeta].some(x=>!Number.isFinite(x)) ||
     !Number.isSafeInteger(m.trainRaceCount) || m.trainRaceCount<1)
    throw Error("D23_MARKET_MODEL_DIMENSION_OR_VALUE_INVALID");
  const stats=statsFrom(m);
  if(stats.size!==23 || [...stats.values()].some(x=>!x ||
    !Number.isFinite(x.mu) || !Number.isFinite(x.sigma) || x.sigma<=0 ||
    !Number.isSafeInteger(x.nObserved) || x.nObserved<0))
    throw Error("D23_MARKET_MODEL_STATS_INVALID");
  const names=m.codes.flatMap(c=>c==="EQUIPMENT_CHANGE" ?
    [c+"_added",c+"_removed",c+"_both",c+"_missing"] :
    [c+"_z",c+"_missing"]);
  if(names.some((x,i)=>x!==m.names[i]))throw Error("D23_MARKET_MODEL_NAMES_INVALID");
  if(!m.fitOptions || [m.fitOptions.lambda,m.fitOptions.learningRate,m.fitOptions.iterations]
    .some(x=>!Number.isFinite(x)) || m.fitOptions.lambda<0 ||
    m.fitOptions.learningRate<=0 || !Number.isSafeInteger(m.fitOptions.iterations) ||
    m.fitOptions.iterations<1)throw Error("D23_MARKET_MODEL_FIT_OPTIONS_INVALID");
}
export function fitD23Market(
  races:readonly D23MarketRace[],
  opts:FitOptions={lambda:0.5,learningRate:0.04,iterations:1200}
):D23MarketModel {
  assertCodes(D23_CODES);
  if(races.length<2)throw Error("D23_MARKET_TRAIN_NEEDS_AT_LEAST_TWO_RACES");
  const prepared=races.map(prepareD23MarketRace);
  const ids=new Set<string>();
  const training=prepared.map(p=>{
    if(ids.has(p.race.raceId))throw Error("D23_MARKET_DUPLICATE_RACE");
    ids.add(p.race.raceId);
    if(!Number.isSafeInteger(p.race.winnerNo) ||
       !p.race.vectors.some(v=>v.no===p.race.winnerNo))
      throw Error("D23_MARKET_TRAIN_WINNER_INVALID "+p.race.raceId);
    return {raceId:p.race.raceId,date:new Date(p.race.tarih+"T00:00:00Z"),
      vectors:p.race.vectors,winnerNo:p.race.winnerNo};
  });
  const stats=computeFeatureStats(training.flatMap(x=>x.vectors),D23_CODES);
  const strength=fitModel(training,stats,opts,ENCODING);
  if(strength.nRacesUsed!==races.length || strength.beta.length!==48)
    throw Error("D23_MARKET_STRENGTH_TRAIN_INCOMPLETE");
  const paired:TrainingRunner[][]=prepared.map(p=>p.race.vectors.map((v,i)=>({
    raceId:p.race.raceId,runnerId:String(v.no),winner:v.no===p.race.winnerNo,
    features:[p.logMarket[i],...modelVector(v,stats)],
  })));
  const marketOnly=paired.map(r=>r.map(x=>({...x,features:x.features.slice(0,1)})));
  const marketAlpha=fitConditionalLogit(marketOnly,1,opts)[0];
  const combinedBeta=fitConditionalLogit(paired,49,opts);
  const model:D23MarketModel={
    version:D23_MARKET_VERSION,formulaVersion:FORMULA,encoding:ENCODING,
    codes:[...D23_CODES],names:[...strength.names],
    stats:Object.fromEntries([...stats]),strengthBeta:strength.beta,
    marketAlpha,combinedBeta,fitOptions:opts,trainRaceCount:races.length,
    sourceStatus:"RESEARCH_ONLY_PIT_UNVERIFIED",
  };
  assertD23MarketModel(model);
  return model;
}
function ranks(values:number[]):number[]{
  return values.map((_,i)=>i).sort((a,b)=>values[b]-values[a] || a-b)
    .reduce((out,i,rank)=>(out[i]=rank+1,out),Array<number>(values.length).fill(0));
}
export function scoreD23Market(race:D23MarketRace,m:D23MarketModel):D23MarketPrediction[]{
  assertD23MarketModel(m);
  const p=prepareD23MarketRace(race);
  const stats=statsFrom(m);
  const encoded=race.vectors.map(v=>modelVector(v,stats));
  const strength=softmax(encoded.map(v=>dot(v,m.strengthBeta)));
  const market=softmax(p.logMarket.map(x=>x*m.marketAlpha));
  const final=softmax(encoded.map((v,i)=>dot([p.logMarket[i],...v],m.combinedBeta)));
  if([...strength,...market,...final].some(x=>!Number.isFinite(x)) ||
     Math.abs(final.reduce((a,b)=>a+b,0)-1)>1e-9)
    throw Error("D23_MARKET_NONFINITE_OR_NOT_NORMALIZED");
  const sr=ranks(strength),mr=ranks(market),fr=ranks(final);
  const neutral=1/final.length; // field-uniform baseline; NOT learned threshold or pick rule
  return race.vectors.map((v,i)=>{
    const highStrength=strength[i]>=neutral;
    const highMarket=market[i]>=neutral;
    const regime:D23Regime=highStrength ?
      (highMarket?"BANKO_POTANSIYELI":"SURPRIZ_ADAYI") :
      (highMarket?"PIYASA_FAZLA_DESTEKLIYOR":"NORMAL");
    return {no:v.no,name:v.name,rank:fr[i],agfPercent:p.agfPercent[i],
      marketProbability:market[i],strengthProbability:strength[i],
      winProbability:final[i],deltaVsMarket:final[i]-market[i],
      strengthRank:sr[i],marketRank:mr[i],regime,
      leadingCandidate:fr[i]===1};
  }).sort((a,b)=>a.rank-b.rank);
}
export function evaluateD23Market(
  races:readonly D23MarketRace[],m:D23MarketModel
):{n:number;combined:{top1:number;top3:number;logLoss:number};
  strength:{top1:number;top3:number;logLoss:number};
  market:{top1:number;top3:number;logLoss:number}}{
  const groups:{top1:number;top3:number;logLoss:number}[]=[
    {top1:0,top3:0,logLoss:0},{top1:0,top3:0,logLoss:0},{top1:0,top3:0,logLoss:0},
  ];
  if(!races.length)throw Error("D23_MARKET_EVALUATION_EMPTY");
  for(const race of races){
    const ranked=scoreD23Market(race,m);
    const win=ranked.find(x=>x.no===race.winnerNo);
    if(!win)throw Error("D23_MARKET_EVALUATION_WINNER_MISSING");
    const defs=[
      {prob:win.winProbability,rank:win.rank},
      {prob:win.strengthProbability,rank:win.strengthRank},
      {prob:win.marketProbability,rank:win.marketRank},
    ];
    defs.forEach((x,i)=>{groups[i].top1+=Number(x.rank===1);groups[i].top3+=Number(x.rank<=3);
      groups[i].logLoss+=-Math.log(Math.max(x.prob,1e-15));});
  }
  const scaled=groups.map(g=>({top1:g.top1/races.length,top3:g.top3/races.length,
    logLoss:g.logLoss/races.length}));
  return {n:races.length,combined:scaled[0],strength:scaled[1],market:scaled[2]};
}
export function d23ModelFingerprint(m:D23MarketModel):string{
  assertD23MarketModel(m);
  return createHash("sha256").update(JSON.stringify(m)).digest("hex");
}

/** Fail-closed artifact reader; cannot silently load a stale/edited 46-column model. */
export function validateD23MarketArtifact(bundle:unknown):D23MarketModel {
  if(!bundle || typeof bundle!=="object")throw Error("D23_MARKET_ARTIFACT_INVALID");
  const r=bundle as {releaseStatus?:string;model?:D23MarketModel;modelFingerprint?:string};
  if(r.releaseStatus!=="RESEARCH_ONLY_PIT_AND_INDEPENDENT_HOLDOUT_NOT_VERIFIED" ||
     !r.model || typeof r.modelFingerprint!=="string")
    throw Error("D23_MARKET_ARTIFACT_NOT_RESEARCH_BUNDLE");
  assertD23MarketModel(r.model);
  if(d23ModelFingerprint(r.model)!==r.modelFingerprint)
    throw Error("D23_MARKET_ARTIFACT_FINGERPRINT_MISMATCH");
  return r.model;
}
/** Direct conditional-logit feature contributions; labels cannot alter model scoring. */
export function explainD23MarketRunner(
  race:D23MarketRace,m:D23MarketModel,no:number
):{marketContribution:number;signalContributions:{code:string;contribution:number}[];
   totalScore:number}{
  assertD23MarketModel(m);
  const p=prepareD23MarketRace(race);
  const i=race.vectors.findIndex(x=>x.no===no);
  if(i<0)throw Error("D23_MARKET_EXPLAIN_HORSE_MISSING");
  const vec=modelVector(race.vectors[i],statsFrom(m));
  let offset=0;
  const signalContributions=m.codes.map(code=>{
    const size=code==="EQUIPMENT_CHANGE"?4:2;
    let sum=0;
    for(let j=0;j<size;j++)sum+=vec[offset+j]*m.combinedBeta[1+offset+j];
    offset+=size;
    return {code,contribution:sum};
  });
  if(offset!==48)throw Error("D23_MARKET_EXPLAIN_DIMENSION_MISMATCH");
  const marketContribution=p.logMarket[i]*m.combinedBeta[0];
  const totalScore=marketContribution+signalContributions.reduce((a,b)=>a+b.contribution,0);
  return {marketContribution,signalContributions,totalScore};
}
