// ROTAGANYAN v1.0 — REAL signal complementarity audit, strictly offline.
// Train-only refit + independent holdout (never fit on acceptance races).
// Correlation describes overlap; refit ablation quantifies incremental performance.
// Nothing in this file mutates the trained artifact, deployment or production DB.
import { computeFeatureStats, fitModel, scoreRace, type FittedModel, type TrainingRace } from "@/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";
import { UNIFIED_MODEL_CODES, D_INCLUDED_CODES, V1_INCLUDED_CODES } from "../unified-model-codes";
import { SIGNAL_SPECS } from "../signal-integration";
import { validateAcceptanceVectors } from "./acceptance-vector-rca";
import { acceptanceDay, type AcceptanceRaceRow } from "./final-acceptance-report";

export const KNOWN_SOURCE_BLOCKERS = [
  { code: "SIRE_HISTORY", issue: "getSireStatOzetleriForRace: SireStatOwn without target-date cutoff; historical leakage possible", severity: "BLOCKED" },
  { code: "SPEED", issue: "getHizDerecesiGozlemliForRace: observed flag is not cutoff-filtered; post-race history can affect missingness", severity: "BLOCKED" },
] as const;

export const STRUCTURAL_OVERLAPS = [
  ["RIVAL_GAP", "RIVAL_CLASS", "RIVAL_GAP is derived from V1 HIZ_01 + SINIF_01; RIVAL_CLASS is V1 SINIF_01"],
  ["SPEED", "RIVAL_GAP", "Both depend on speed/history; formulas differ, numerical overlap must be measured"],
  ["FIELD_WEIGHT_DELTA", "WEIGHT_DISTANCE", "Interaction based on FIELD_WEIGHT_DELTA"],
  ["FIELD_WEIGHT_DELTA", "WEIGHT_HANDICAP", "Interaction based on FIELD_WEIGHT_DELTA"],
  ["JOCKEY_OE30", "JOCKEY_TREND30", "Recent 30-day jockey record overlaps"],
  ["GROUND_TOLERANCE", "SURFACE_SPEED_DELTA", "Ground/surface performance may overlap"],
  ["FORM_LEVEL", "FORM_TREND", "Both use recent form histories"],
  ["RIVAL_FRONT_PRESSURE", "SINGLE_LEADER", "Both derive from rival style vectors"],
  ["RIVAL_FRONT_PRESSURE", "CLOSER_PRESSURE_FIT", "Both derive from rival front pressure"],
] as const;

export const AUDIT_FAMILIES: Record<string, readonly string[]> = {
  GEN: ["SIRE_HISTORY", "DAM_HISTORY", "DAMSIRE_HISTORY"],
  SPEED_RIVAL: ["SPEED", "ACC_SPEED", "H2H", "RIVAL_GAP", "RIVAL_CLASS"],
  FORM: ["FORM_LEVEL", "FORM_TREND", "LAYOFF_DAYS"],
  PMZ: ["GROUND_TOLERANCE", "GROUND_DISTANCE_EXPERIENCE", "SURFACE_SPEED_DELTA", "DISTANCE_SPEED_DELTA", "SURFACE_FORM"],
  JOCKEY: ["JOCKEY_OE30", "JOCKEY_LONG_TERM", "JOCKEY_STYLE", "JOCKEY_TREND30", "IDMAN_JOCKEY"],
  TEMPO: ["RACE_PACE_FIT", "RIVAL_FRONT_PRESSURE", "SINGLE_LEADER", "CLOSER_PRESSURE_FIT", "OWN_LEAD_TENDENCY", "DRAW"],
  ACC: ["ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED"],
  WEIGHT: ["FIELD_WEIGHT_DELTA", "HIST_WEIGHT_DELTA", "WEIGHT_DISTANCE", "WEIGHT_HANDICAP"],
  WORKOUT: ["WORKOUT_SPRINT", "IDMAN_JOCKEY"],
  TRAINER: ["TRAINER_TREND30"],
  EQUIPMENT: ["EQUIPMENT_CHANGE"],
};

export type RaceEval = { raceId: string; winnerNo: number; rank: number; pWinner: number };
export type ScoreMetrics = { n: number; top1Hits: number; top3Hits: number; top1: number; top3: number; logLoss: number };
export type ComparedRun = {
  name: string; codes: string[]; metrics: ScoreMetrics;
  delta: { top1Hits: number; top3Hits: number; logLoss: number };
  rescue: { top1: number; top3: number };
  harm: { top1: number; top3: number };
  changed: { raceId: string; winnerNo: number; baselineRank: number; candidateRank: number; rescuedTop1: boolean; rescuedTop3: boolean; lostTop1: boolean; lostTop3: boolean }[];
};
export type CorrelationPair = {
  codeA: string; codeB: string; nBothObserved: number; pearson: number | null;
  highOverlap: boolean; structuralNote: string | null;
};
export type SignalAuditReport = {
  publicationGate: "BLOCKED";
  provenanceGate: "NOT_VERIFIED";
  trainReplay: "MATCH" | "MISMATCH";
  model: { trainRaces: number; testRaces: number; totalSignals: number; lambda: number };
  warnings: string[];
  blockers: readonly typeof KNOWN_SOURCE_BLOCKERS[number][];
  baseline: ScoreMetrics;
  correlations: CorrelationPair[];
  experiments: ComparedRun[];
  conclusions: string[];
};
function assert(condition: unknown, msg: string): asserts condition {
  if (!condition) throw new Error("RAN_COMPLEMENTARITY_BLOCKED: " + msg);
}
export function validateAuditRows(
  rows: readonly AcceptanceRaceRow[], label: string, range: readonly string[], minimum: number,
): void {
  assert(rows.length >= minimum, label + " count " + rows.length + " below " + minimum);
  const seen = new Set<string>();
  for(const row of rows) {
    assert(typeof row.raceId === "string" && row.raceId.length>0 && !seen.has(row.raceId), label + " duplicate/empty raceId");
    seen.add(row.raceId);
    const date=acceptanceDay(row.tarih);
    assert(date !== null && date>=range[0] && date<=range[1], label+" date outside required range: "+row.tarih);
    assert(Number.isSafeInteger(row.winnerNo) && (row.winnerNo ?? 0)>0, label+" winner missing");
    assert(Array.isArray(row.vectors) && row.vectors.length>=3, label+" field too small");
    assert(row.vectors.some(v=>v.no===row.winnerNo), label+" winner absent from field");
    assert(validateAcceptanceVectors(row.raceId,row.vectors).length===0, label+" vector shape/codes invalid");
  }
}
function fit(rows:readonly AcceptanceRaceRow[], codes: readonly string[], opts: FittedModel<string>["opts"]) {
  const vectors=rows.flatMap(r=>r.vectors);
  const stats=computeFeatureStats(vectors,codes);
  const races:TrainingRace[]=rows.map(r=>({raceId:r.raceId,date:new Date(r.tarih+"T00:00:00.000Z"),winnerNo:r.winnerNo,vectors:r.vectors}));
  const model=fitModel(races,stats,opts);
  assert(model.nRacesUsed===rows.length, "training races were skipped");
  assert(model.beta.every(Number.isFinite), "non-finite fit coefficient");
  return model;
}
export function evaluateAuditRows(rows: readonly AcceptanceRaceRow[], model: FittedModel<string>): {metrics:ScoreMetrics; races:RaceEval[]} {
  let top1=0,top3=0,loss=0;const raceEvals:RaceEval[]=[];
  for(const r of rows){
    const ranked=scoreRace(r.vectors,model).sort((a,b)=>b.probability-a.probability || a.no-b.no);
    const rank=ranked.findIndex(x=>x.no===r.winnerNo)+1;
    assert(rank>0,"winner not scored");
    const p=ranked[rank-1].probability;
    const sum=ranked.reduce((a,x)=>a+x.probability,0);
    assert(Number.isFinite(p) && p>0 && Math.abs(sum-1)<1e-8,"invalid softmax");
    top1+=Number(rank===1);top3+=Number(rank<=3);loss-=Math.log(p);
    raceEvals.push({raceId:r.raceId,winnerNo:r.winnerNo!,rank,pWinner:p});
  }
  const n=rows.length;
  assert(n>0,"no evaluation races");
  return {metrics:{n,top1Hits:top1,top3Hits:top3,top1:top1/n,top3:top3/n,logLoss:loss/n},races:raceEvals};
}
export function compareAuditRaces(name:string,codes:readonly string[], baseline:{metrics:ScoreMetrics;races:RaceEval[]},candidate:{metrics:ScoreMetrics;races:RaceEval[]}):ComparedRun {
  const map=new Map(candidate.races.map(r=>[r.raceId,r]));
  let rescue1=0,rescue3=0,harm1=0,harm3=0;
  const changed:ComparedRun["changed"]=[];
  for(const b of baseline.races){
    const c=map.get(b.raceId);assert(c && c.winnerNo===b.winnerNo,"paired race mismatch");
    const rescuedTop1=b.rank>1&&c.rank===1;
    const rescuedTop3=b.rank>3&&c.rank<=3;
    const lostTop1=b.rank===1&&c.rank>1;
    const lostTop3=b.rank<=3&&c.rank>3;
    rescue1+=Number(rescuedTop1);rescue3+=Number(rescuedTop3);
    harm1+=Number(lostTop1);harm3+=Number(lostTop3);
    if(b.rank!==c.rank) changed.push({raceId:b.raceId,winnerNo:b.winnerNo,baselineRank:b.rank,candidateRank:c.rank,rescuedTop1,rescuedTop3,lostTop1,lostTop3});
  }
  return {
    name,codes:[...codes],metrics:candidate.metrics,
    delta:{top1Hits:candidate.metrics.top1Hits-baseline.metrics.top1Hits,top3Hits:candidate.metrics.top3Hits-baseline.metrics.top3Hits,logLoss:candidate.metrics.logLoss-baseline.metrics.logLoss},
    rescue:{top1:rescue1,top3:rescue3},harm:{top1:harm1,top3:harm3},changed,
  };
}
function pearsonPairs(x:number[],y:number[]): number|null {
  if(x.length<30)return null;
  const n=x.length,mx=x.reduce((a,b)=>a+b,0)/n,my=y.reduce((a,b)=>a+b,0)/n;
  let xx=0,yy=0,xy=0;
  for(let i=0;i<n;i++){const a=x[i]-mx,b=y[i]-my;xx+=a*a;yy+=b*b;xy+=a*b;}
  if(xx<=1e-14||yy<=1e-14)return null;
  return xy/Math.sqrt(xx*yy);
}
export function auditCorrelations(training:readonly AcceptanceRaceRow[],codes:readonly string[]=UNIFIED_MODEL_CODES):CorrelationPair[]{
  const all=training.flatMap(r=>r.vectors);
  const pairs:CorrelationPair[]=[];
  for(let i=0;i<codes.length;i++)for(let j=i+1;j<codes.length;j++){
    const a=codes[i],b=codes[j],xs:number[]=[],ys:number[]=[];
    for(const v of all){
      const x=v.signals.find(s=>s.code===a),y=v.signals.find(s=>s.code===b);
      if(x?.observed&&y?.observed&&x.rawValue!=null&&y.rawValue!=null){xs.push(x.rawValue);ys.push(y.rawValue);}
    }
    const r=pearsonPairs(xs,ys);
    const known=STRUCTURAL_OVERLAPS.find(p=>(p[0]===a&&p[1]===b)||(p[1]===a&&p[0]===b));
    pairs.push({codeA:a,codeB:b,nBothObserved:xs.length,pearson:r,highOverlap:r!==null&&Math.abs(r)>=0.8,structuralNote:known?.[2]??null});
  }
  return pairs.sort((a,b)=>(Number(b.highOverlap)-Number(a.highOverlap)) ||
    (Math.abs(b.pearson??0)-Math.abs(a.pearson??0)) ||
    Number(!!b.structuralNote)-Number(!!a.structuralNote));
}
export function auditSignalComplementarity(
  training:readonly AcceptanceRaceRow[],
  acceptance:readonly AcceptanceRaceRow[],
  canonical:FittedModel<string>,
  trainRange:readonly string[],
  holdoutEnd:string,
  expectedTrainCount:number,
  minAcceptance=60,
):SignalAuditReport {
  assert(minAcceptance>=60,"acceptance minimum cannot be lowered");
  validateAuditRows(training,"TRAIN",trainRange,expectedTrainCount);
  assert(training.length===expectedTrainCount,"training race count differs from artifact");
  validateAuditRows(acceptance,"ACCEPTANCE",[nextDay(holdoutEnd),"9999-12-31"],minAcceptance);
  const trainIds=new Set(training.map(r=>r.raceId));
  assert(acceptance.every(r=>!trainIds.has(r.raceId)),"train/acceptance race ID overlap");
  assert([...canonical.stats.keys()].join("|")===UNIFIED_MODEL_CODES.join("|"),"canonical signal list changed");

  const replay=fit(training,UNIFIED_MODEL_CODES,canonical.opts);
  const maxBetaDelta=Math.max(...replay.beta.map((v,i)=>Math.abs(v-canonical.beta[i])));
  const maxStatsDelta=Math.max(...UNIFIED_MODEL_CODES.flatMap(c=>{
    const a=replay.stats.get(c)!,b=canonical.stats.get(c)!;
    return [Math.abs(a.mu-b.mu),Math.abs(a.sigma-b.sigma),Math.abs(a.nObserved-b.nObserved)];
  }));
  const exactReplay=maxBetaDelta<1e-6&&maxStatsDelta<1e-6;
  assert(exactReplay, "source training rows do not reproduce locked canonical artifact (maxBetaDelta="+maxBetaDelta+",maxStatsDelta="+maxStatsDelta+"); do not compare against unmatched training");
  const base=evaluateAuditRows(acceptance,canonical);
  const specs=SIGNAL_SPECS.filter(s=>s.decision==="PRIMARY"||s.decision==="INCLUDE");
  const d=new Set(specs.filter(s=>s.source==="D").map(s=>s.canonical));
  const v1=new Set(specs.filter(s=>s.source==="V1").map(s=>s.canonical));
  assert(d.size===D_INCLUDED_CODES.length&&v1.size===V1_INCLUDED_CODES.length,"model source family count mismatch");
  const experiments:ComparedRun[]=[];
  const tryFit=(name:string,codes:readonly string[])=>{
    const refit=fit(training,codes,canonical.opts);
    experiments.push(compareAuditRaces(name,codes,base,evaluateAuditRows(acceptance,refit)));
  };
  tryFit("D_ONLY",UNIFIED_MODEL_CODES.filter(c=>d.has(c)));
  tryFit("V1_ONLY",UNIFIED_MODEL_CODES.filter(c=>v1.has(c)));
  for(const code of UNIFIED_MODEL_CODES)tryFit("DROP_ONE:"+code,UNIFIED_MODEL_CODES.filter(c=>c!==code));
  for(const [family,items] of Object.entries(AUDIT_FAMILIES)){
    const kept=UNIFIED_MODEL_CODES.filter(c=>!items.includes(c));
    if(kept.length>0)tryFit("DROP_FAMILY:"+family,kept);
  }
  // Retained data may have been recomputed after racing. Numerical tests are DIAGNOSTIC
  // ONLY until immutable, separately verified pre-race source provenance is available.
  return {
    publicationGate:"BLOCKED",provenanceGate:"NOT_VERIFIED",trainReplay:"MATCH",
    model:{trainRaces:training.length,testRaces:acceptance.length,totalSignals:UNIFIED_MODEL_CODES.length,lambda:canonical.opts.lambda},
    warnings:["PRE_RACE_SOURCE_UNVERIFIED: acceptance and training vector metadata do not prove captured-before-start.",
      "DO_NOT_SELECT_SIGNALS_FROM_ACCEPTANCE: ablation scores are exploratory; selecting winners on this 60-race set would invalidate its untouched holdout status.",
      "NO_SIGNIFICANCE_CLAIM: 60 races insufficient for reliable causal per-signal selection; paired changes are descriptive.",
    ],
    blockers:KNOWN_SOURCE_BLOCKERS,
    baseline:base.metrics,correlations:auditCorrelations(training),
    experiments,
    conclusions:["Rank and probability deltas use the same locked acceptance race IDs and winners; all candidate models are refitted on TRAIN ONLY.",
      "No signal is removed, weights artifact is unchanged, and publication is BLOCKED until source PIT fixes plus independent new holdout verification."],
  };
}
function nextDay(day:string):string {
  const d=acceptanceDay(day);assert(d,"invalid development holdout end");
  const n=new Date(d+"T00:00:00.000Z");n.setUTCDate(n.getUTCDate()+1);return n.toISOString().slice(0,10);
}
