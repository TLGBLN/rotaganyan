/**
 * RAN v1.0 — deterministic, DB-free combinatorial feature-search primitives.
 * Only the ORIGINAL 238 TRAIN races can enter folds/selection.
 * 62 development races and the previously inspected October 60 are excluded.
 * No production writes, no winner lookahead, no result-dependent tuning of test data.
 *
 * Exhaustive singles = 36; exhaustive pairs = 630. 2^36 - 1 combinations
 * are NOT exhaustive-feasible; larger subsets use a bounded beam search.
 */
import { computeFeatureStats, fitModel, scoreRace, type FitOptions } from "@/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "@/lib/motor-v1/engine/feature-vector";
import { UNIFIED_MODEL_CODES } from "../unified-model-codes";
import { SIGNAL_SPECS } from "../signal-integration";

export type FeatureRace = {
  raceId: string; tarih: string; winnerNo: number; vectors: RunnerFeatureVector[];
};
export type WalkFold = { id: string; train: FeatureRace[]; validation: FeatureRace[] };
export type FoldMetrics = { fold: string; n: number; top1Hits: number; top3Hits: number; logLossSum: number };
export type CombinationResult = {
  id: string; codes: string[]; foldResults: FoldMetrics[];
  n: number; top1Hits: number; top3Hits: number;
  top1: number; top3: number; logLoss: number;
  score: number;
};
export type PairResult = {
  a:string; b:string; pair:CombinationResult; stronger:string;
  weaker:string; bothVersusBest: {top1Hits:number;top3Hits:number;logLoss:number};
  status:"COMPLEMENTARY_CANDIDATE"|"REDUNDANT_CANDIDATE"|"TRADEOFF_REVIEW";
  sourceAlternativeNote: string|null;
};
export const FULL_SIGNAL_ROSTER = SIGNAL_SPECS.map(s=>({
  source:s.source,sourceCode:s.code,canonical:s.canonical,
  decision:s.decision,availableInPITDataset:UNIFIED_MODEL_CODES.includes(s.canonical) &&
    (s.decision==="INCLUDE" || s.decision==="PRIMARY"),
  reason:s.note,
}));
export function allPairs(codes:readonly string[]):[string,string][] {
  const out:[string,string][]=[];
  for(let i=0;i<codes.length;i++)for(let j=i+1;j<codes.length;j++)out.push([codes[i],codes[j]]);
  return out;
}
export function selectionKey(codes:readonly string[]):string {
  if(codes.length===0 || new Set(codes).size!==codes.length ||
      codes.some(x=>!UNIFIED_MODEL_CODES.includes(x)))
    throw new Error("RAN_COMBO_INVALID_CODES");
  return [...codes].sort((a,b)=>UNIFIED_MODEL_CODES.indexOf(a)-UNIFIED_MODEL_CODES.indexOf(b)).join("+");
}
/**
 * 3 expanding (not shuffled) time windows. A fold trains on earlier days only;
 * no future racing result or later train day enters it. All combinations
 * evaluate on exactly the same validation race IDs and dates.
 */
export function buildWalkFolds(races: readonly FeatureRace[], count=3):WalkFold[] {
  if(count!==3)throw new Error("RAN_COMBO_UNSUPPORTED_FOLDS: fixed 3 windows");
  if(races.length<100)throw new Error("RAN_COMBO_TOO_FEW_TRAIN_RACES");
  const days=[...new Set(races.map(r=>r.tarih))].sort();
  if(days.length<8 || days.some(d=>! /^\d{4}-\d{2}-\d{2}$/.test(d)))
    throw new Error("RAN_COMBO_NEEDS_8_TRAIN_DAYS");
  const boundaries=[Math.floor(days.length*0.4),Math.floor(days.length*0.6),Math.floor(days.length*0.8),days.length];
  const out:WalkFold[]=[];
  for(let i=0;i<3;i++){
    const train=races.filter(r=>r.tarih<days[boundaries[i]]);
    const validation=races.filter(r=>r.tarih>=days[boundaries[i]] &&
      (i===2 || r.tarih<days[boundaries[i+1]]));
    if(train.length<35 || validation.length<8 || train[train.length-1]?.tarih>=validation[0]?.tarih)
      throw new Error("RAN_COMBO_BAD_WALK_FOLD_"+i);
    out.push({id:"F"+(i+1)+"_"+days[boundaries[i]]+"_"+days[boundaries[i+1]-1],train,validation});
  }
  return out;
}
export function validateTrainingOnly(races:readonly FeatureRace[]):void {
  if(races.length!==238)throw new Error("RAN_COMBO_REQUIRES_ORIGINAL_238_TRAIN_RACES");
  const seen=new Set<string>();
  for(const r of races){
    if(!r.raceId || seen.has(r.raceId) ||
      r.tarih<"2026-08-16" || r.tarih>"2026-08-25" ||
      !Number.isSafeInteger(r.winnerNo) || r.winnerNo<=0 ||
      r.vectors.length<3 || !r.vectors.some(v=>v.no===r.winnerNo))
      throw new Error("RAN_COMBO_INVALID_TRAIN_RACE_OR_DATE");
    seen.add(r.raceId);
    for(const v of r.vectors){
      if(v.raceId!==r.raceId || v.signals.length!==UNIFIED_MODEL_CODES.length ||
        v.signals.some((s,i)=>s.code!==UNIFIED_MODEL_CODES[i] ||
        (s.observed && (s.rawValue===null || !Number.isFinite(s.rawValue)))))
        throw new Error("RAN_COMBO_INVALID_PIT_VECTOR");
    }
  }
}
export function candidateObjective(c:{n:number;top1Hits:number;top3Hits:number;logLoss:number},size:number):number {
  // Top1 and Top3 remain co-primary; logloss controls probability quality.
  // Size cost discourages large groups that win just by correlated noise.
  if(!(c.n>0) || !Number.isFinite(c.logLoss))throw new Error("RAN_COMBO_INVALID_METRICS");
  return (2*c.top1Hits+c.top3Hits)/c.n - 0.12*c.logLoss - 0.003*size;
}
export function rankCombination(a:CombinationResult,b:CombinationResult):number {
  return b.score-a.score || b.top3Hits-a.top3Hits || b.top1Hits-a.top1Hits ||
    a.logLoss-b.logLoss || a.codes.length-b.codes.length || a.id.localeCompare(b.id);
}
export function evaluateCombination(
  folds: readonly WalkFold[], codes:readonly string[], opts:FitOptions,
):CombinationResult {
  const key=selectionKey(codes);
  const foldResults:FoldMetrics[]=[];
  for(const fold of folds){
    const stats=computeFeatureStats(fold.train.flatMap(r=>r.vectors),codes);
    const model=fitModel(fold.train.map(r=>({raceId:r.raceId,date:new Date(r.tarih+"T00:00:00.000Z"),winnerNo:r.winnerNo,vectors:r.vectors})),stats,opts);
    if(model.nRacesUsed!==fold.train.length || model.beta.some(v=>!Number.isFinite(v)))
      throw new Error("RAN_COMBO_TRAIN_FIT_INCOMPLETE: "+key);
    let top1=0,top3=0,logLossSum=0;
    for(const race of fold.validation){
      const scores=scoreRace(race.vectors,model)
        .sort((a,b)=>b.probability-a.probability || a.no-b.no);
      const rank=scores.findIndex(x=>x.no===race.winnerNo);
      if(rank<0)throw new Error("RAN_COMBO_WINNER_MISSING");
      const p=scores[rank].probability;
      if(!(p>0) || !Number.isFinite(p))throw new Error("RAN_COMBO_NON_FINITE_PROB");
      top1+=Number(rank===0);
      top3+=Number(rank<3);
      logLossSum-=Math.log(p);
    }
    foldResults.push({fold:fold.id,n:fold.validation.length,top1Hits:top1,top3Hits:top3,logLossSum});
  }
  const n=foldResults.reduce((s,f)=>s+f.n,0);
  const top1Hits=foldResults.reduce((s,f)=>s+f.top1Hits,0);
  const top3Hits=foldResults.reduce((s,f)=>s+f.top3Hits,0);
  const logLoss=foldResults.reduce((s,f)=>s+f.logLossSum,0)/n;
  return {id:key,codes:[...codes],foldResults,n,top1Hits,top3Hits,
    top1:top1Hits/n,top3:top3Hits/n,logLoss,
    score:candidateObjective({n,top1Hits,top3Hits,logLoss},codes.length)};
}
/**
 * GENUINE multiplicative pair interaction, not merely putting two additive
 * predictors side by side. Each z-score is computed using only the historical
 * TRAIN side of that walk-forward fold. Interaction observed only when BOTH
 * source features are known; missingness is modeled as a separate indicator.
 * Research only until the same derivation exists in the live feature pipeline.
 */
export function evaluatePairInteraction(
  folds:readonly WalkFold[],a:string,b:string,opts:FitOptions,
):CombinationResult {
  if(a===b || !UNIFIED_MODEL_CODES.includes(a) || !UNIFIED_MODEL_CODES.includes(b))
    throw new Error("RAN_COMBO_INVALID_INTERACTION_PAIR");
  const pair=[a,b];
  const derived="INTERACTION__"+a+"__"+b;
  // PIT-only interaction guard: even a valid extreme speed/pace reading can
  // yield enormous zA*zB and artificial pseudo-certainty on small samples.
  // Clamp each TRAIN-standardized input only for the research interaction.
  const clipZ=(z:number)=>Math.max(-4,Math.min(4,z));
  const codes=[a,b,derived];
  const results:FoldMetrics[]=[];
  for(const fold of folds){
    const baseStats=computeFeatureStats(fold.train.flatMap(x=>x.vectors),pair);
    const ax=baseStats.get(a)!,bx=baseStats.get(b)!;
    const append=(r:FeatureRace):FeatureRace=>({
      ...r,vectors:r.vectors.map(v=>{
        const x=v.signals.find(s=>s.code===a),y=v.signals.find(s=>s.code===b);
        const observed=!!x?.observed&&!!y?.observed&&x.rawValue!==null&&
          y.rawValue!==null&&Number.isFinite(x.rawValue)&&Number.isFinite(y.rawValue);
        const rawValue=observed?
          clipZ((x!.rawValue!-ax.mu)/ax.sigma)*clipZ((y!.rawValue!-bx.mu)/bx.sigma):null;
        return {...v,signals:[...v.signals,{
          code:derived,family:"COMBINATORIAL_INTERACTION",
          rawValue,observed,asOfSafe:true as const,coverageState:null,
          missingReason:observed?null:"one-or-both-source-signals-unobserved",
        }]};
      }),
    });
    const training=fold.train.map(append),testing=fold.validation.map(append);
    const stats=computeFeatureStats(training.flatMap(r=>r.vectors),codes);
    const model=fitModel(training.map(r=>({
      raceId:r.raceId,date:new Date(r.tarih+"T00:00:00.000Z"),
      winnerNo:r.winnerNo,vectors:r.vectors,
    })),stats,opts);
    if(model.nRacesUsed!==training.length || model.beta.some(x=>!Number.isFinite(x)))
      throw new Error("RAN_COMBO_INTERACTION_FIT_INCOMPLETE");
    let top1Hits=0,top3Hits=0,logLossSum=0;
    for(const race of testing){
      const rank=scoreRace(race.vectors,model).sort((x,y)=>
        y.probability-x.probability||x.no-y.no);
      const idx=rank.findIndex(x=>x.no===race.winnerNo);
      if(idx<0)throw new Error("RAN_COMBO_INTERACTION_WINNER_MISSING");
      const prob=rank[idx].probability;
      if(!(prob>0)||!Number.isFinite(prob))throw new Error("RAN_COMBO_INTERACTION_BAD_PROB");
      top1Hits+=Number(idx===0);top3Hits+=Number(idx<3);logLossSum-=Math.log(prob);
    }
    results.push({fold:fold.id,n:testing.length,top1Hits,top3Hits,logLossSum});
  }
  const n=results.reduce((s,r)=>s+r.n,0);
  const top1Hits=results.reduce((s,r)=>s+r.top1Hits,0);
  const top3Hits=results.reduce((s,r)=>s+r.top3Hits,0);
  const logLoss=results.reduce((s,r)=>s+r.logLossSum,0)/n;
  return {id:"INT:"+selectionKey(pair),codes,foldResults:results,
    n,top1Hits,top3Hits,top1:top1Hits/n,top3:top3Hits/n,logLoss,
    score:candidateObjective({n,top1Hits,top3Hits,logLoss},codes.length)};
}

/** Pair can be synergistic despite low singleton value, and highly correlated
 * sources can still complement. Never delete on Pearson alone. */
export function classifyPair(
  pair:CombinationResult,one:CombinationResult,two:CombinationResult,
  highCorrelation=false,structuralNote:string|null=null
):PairResult {
  if(pair.codes.length!==2 ||
      !pair.codes.includes(one.codes[0]) || !pair.codes.includes(two.codes[0]) ||
      one.codes.length!==1||two.codes.length!==1 ||
      one.n!==two.n||one.n!==pair.n)
    throw new Error("RAN_COMBO_PAIR_MISMATCH");
  const stronger=rankCombination(one,two)<=0?one:two;
  const weaker=stronger===one?two:one;
  const top1Hits=pair.top1Hits-stronger.top1Hits;
  const top3Hits=pair.top3Hits-stronger.top3Hits;
  const logLoss=pair.logLoss-stronger.logLoss;
  // Stable evidence on three sequential walk-forward folds, not just aggregate.
  const worseFolds=pair.foldResults.filter((f,i)=>
    f.top1Hits < stronger.foldResults[i].top1Hits-1 ||
    f.top3Hits < stronger.foldResults[i].top3Hits-1).length;
  const helps= (top1Hits>=2 || top3Hits>=2) &&
    top1Hits>=-1 && top3Hits>=-1 && logLoss<=0.035 && worseFolds===0;
  const redundant= (highCorrelation || !!structuralNote) &&
    top1Hits<=0 && top3Hits<=0 && logLoss>=-0.01;
  return {a:pair.codes[0],b:pair.codes[1],pair,
    stronger:stronger.codes[0],weaker:weaker.codes[0],
    bothVersusBest:{top1Hits,top3Hits,logLoss},
    status:helps?"COMPLEMENTARY_CANDIDATE":redundant?"REDUNDANT_CANDIDATE":"TRADEOFF_REVIEW",
    sourceAlternativeNote:structuralNote};
}
export function sourceAlternativeLimitations() {
  const unavailable=FULL_SIGNAL_ROSTER.filter(x=>!x.availableInPITDataset);
  return {
    inputSignals:FULL_SIGNAL_ROSTER.length,
    testedCanonicalCount:UNIFIED_MODEL_CODES.length,
    unavailable,
    warning:"Raw D/V1 alternative formulations and BLOCKED signals are not in this 36-feature PIT JSON. Testing them requires an independently PIT-audited recomputation; do not fabricate them or claim every registry signal was evaluated.",
  };
}
