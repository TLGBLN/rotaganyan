/**
 * RAN pedigree research: separately test SIRE / DAM / DAMSIRE as autonomous
 * lineage evidence AND in multiple non-pedigree feature contexts.
 * Only the original PIT 238 TRAIN race IDs, with strictly chronological inner
 * folds. None of the resulting winner-selected feature subsets are publishable.
 * Does not change the old/new pedigree value formula or production artifacts.
 */
import { UNIFIED_MODEL_CODES } from "../unified-model-codes";
import { buildWalkFolds, evaluateCombination, rankCombination, type FeatureRace,
  type CombinationResult } from "./combinatorial-signal-selection";

export const PEDIGREE_CODES = ["SIRE_HISTORY","DAM_HISTORY","DAMSIRE_HISTORY"] as const;
export type PedigreeCode = (typeof PEDIGREE_CODES)[number];

export type PedigreeEvidence = {
  code:PedigreeCode; runnerCount:number; observed:number; missing:number;
  observedFraction:number; rawZeroCount:number; rawHundredCount:number;
  rawMean:number|null; rawMin:number|null; rawMax:number|null;
  countOfHistoricalStartsAvailableInVector:boolean;
  documentedStartSamples:number;observedWithAtMost2Starts:number;
  minHistoricalStarts:number|null;maxHistoricalStarts:number|null;
  caveat:string;
};
export const PEDIGREE_CONTEXTS: Record<string,readonly string[]> = {
  /** Entire real additive model except genealogy. */
  FULL_WITHOUT_PEDIGREE:UNIFIED_MODEL_CODES.filter(c=>!PEDIGREE_CODES.includes(c as PedigreeCode)),
  /** Are lineage features useful beyond existing speed and form evidence? */
  SPEED_FORM:["SPEED","FORM_LEVEL","SURFACE_FORM"],
  /** A sire may confer surface/distance suitability and be redundant with own history. */
  SURFACE_DISTANCE:["GROUND_DISTANCE_EXPERIENCE","SURFACE_SPEED_DELTA","DISTANCE_SPEED_DELTA"],
  /** Genetic evidence can be most useful for unproven horses, but avoid invented pedigrees. */
  JOCKEY_FORM:["JOCKEY_OE30","JOCKEY_LONG_TERM","FORM_TREND"],
};
export const PEDIGREE_SUBSETS: readonly PedigreeCode[][]=[
  [],["SIRE_HISTORY"],["DAM_HISTORY"],["DAMSIRE_HISTORY"],
  ["SIRE_HISTORY","DAM_HISTORY"],["SIRE_HISTORY","DAMSIRE_HISTORY"],
  ["DAM_HISTORY","DAMSIRE_HISTORY"],
  ["SIRE_HISTORY","DAM_HISTORY","DAMSIRE_HISTORY"],
];
export function pedigreeCoverage(rows:readonly FeatureRace[]):PedigreeEvidence[] {
  const all=rows.flatMap(x=>x.vectors);
  return PEDIGREE_CODES.map(code=>{
    let observed=0,missing=0,rawZeroCount=0,rawHundredCount=0;
    let sum=0,min=Infinity,max=-Infinity;
    let documentedStartSamples=0,observedWithAtMost2Starts=0;
    let minHistoricalStarts=Infinity,maxHistoricalStarts=0;
    for(const v of all){
      const s=v.signals.find(x=>x.code===code);
      if(!s || !s.observed || s.rawValue==null || !Number.isFinite(s.rawValue)){missing++;continue;}
      observed++;sum+=s.rawValue;
      min=Math.min(min,s.rawValue);max=Math.max(max,s.rawValue);
      if(s.sampleCount!=null && Number.isSafeInteger(s.sampleCount) && s.sampleCount>0){
        documentedStartSamples++;
        minHistoricalStarts=Math.min(minHistoricalStarts,s.sampleCount);
        maxHistoricalStarts=Math.max(maxHistoricalStarts,s.sampleCount);
        if(s.sampleCount<=2)observedWithAtMost2Starts++;
      }
      if(s.rawValue===0)rawZeroCount++;
      if(s.rawValue===100)rawHundredCount++;
    }
    return {code,runnerCount:all.length,observed,missing,
      observedFraction:all.length?observed/all.length:0,
      rawZeroCount,rawHundredCount,
      rawMean:observed?sum/observed:null,rawMin:observed?min:null,rawMax:observed?max:null,
      countOfHistoricalStartsAvailableInVector:observed>0&&documentedStartSamples===observed,
      documentedStartSamples,observedWithAtMost2Starts,
      minHistoricalStarts:documentedStartSamples?minHistoricalStarts:null,
      maxHistoricalStarts:documentedStartSamples?maxHistoricalStarts:null,
      caveat:code==="SIRE_HISTORY"?
        "RAN PIT sire is prior-shrunk (20 starts / 14%). Evidence n is available only on regenerated vectors.":
        "DAM/DAMSIRE is a raw historical win percentage; one start can produce 0% or 100%. Source n must be checked. For old PIT vectors with no n, reliability is UNKNOWN.",
    };
  });
}
export type PedigreeExperiment = {
  context:string;includedPedigree:PedigreeCode[];result:CombinationResult;
  relativeToNoPedigree:{top1Hits:number;top3Hits:number;logLoss:number};
};
export type PedigreeDiagnosticReport = {
  publicationGate:"BLOCKED";source:"ORIGINAL_PIT_238_TRAIN_ONLY";
  pedigreeCodes:readonly PedigreeCode[];confidenceHasSampleCounts:boolean;
  lineCoverage:PedigreeEvidence[];
  experiments:PedigreeExperiment[];
  grouped: {context:string;noPedigree:CombinationResult;
    bestResearchCandidate:CombinationResult;allThree:CombinationResult}[];
  warnings:string[];
};
export function auditPedigreeLineages(
  rows:readonly FeatureRace[],iterations=2500,
):PedigreeDiagnosticReport {
  if(rows.length!==238 || !Number.isSafeInteger(iterations) ||
     iterations<5 || iterations>2500)throw new Error("RAN_PEDIGREE_REQUIRES_238_PIT_TRAIN");
  const folds=buildWalkFolds(rows);
  const opts={lambda:90,learningRate:0.25,iterations};
  const experiments:PedigreeExperiment[]=[];
  const grouped:PedigreeDiagnosticReport["grouped"]=[];
  for(const [context,base] of Object.entries(PEDIGREE_CONTEXTS)){
    const fits=PEDIGREE_SUBSETS.map(subset=>{
      const chosen=new Set([...base,...subset]);
      const codes=UNIFIED_MODEL_CODES.filter(c=>chosen.has(c));
      return {subset,fit:evaluateCombination(folds,codes,opts)};
    });
    const no=fits[0].fit;
    for(const {subset,fit} of fits){
      experiments.push({context,includedPedigree:[...subset],result:fit,
        relativeToNoPedigree:{
          top1Hits:fit.top1Hits-no.top1Hits,top3Hits:fit.top3Hits-no.top3Hits,
          logLoss:fit.logLoss-no.logLoss,
        }});
    }
    grouped.push({context,noPedigree:no,
      bestResearchCandidate:[...fits].sort((a,b)=>rankCombination(a.fit,b.fit))[0].fit,
      allThree:fits[7].fit});
  }
  const lineCoverage=pedigreeCoverage(rows);
  return {publicationGate:"BLOCKED",source:"ORIGINAL_PIT_238_TRAIN_ONLY",
    pedigreeCodes:PEDIGREE_CODES,
    confidenceHasSampleCounts:lineCoverage.every(l=>l.countOfHistoricalStartsAvailableInVector),
    lineCoverage,experiments,grouped,
    warnings:[
      "SIRE/DAM/DAMSIRE must remain distinct lineage candidates. Ranking alone never authorizes dropping a lineage.",
      "PIT sire uses shrinkage; PIT dam/damsire still expose unshrunk historical percentages. Do not compare raw coefficients as if they had identical reliability.",
      "Historical sample size per lineage is not present in existing feature vectors: 0%/100% DAM/DAMSIRE observations may come from just one start.",
      "This is a 238-race INTERNAL chronological selection audit. August 62 and October 60 were not used; a new independent prospective period is required.",
      "The same 3 chronological folds are reused across 32 pedigree combinations. Best folds are research candidates, not unbiased confirmation.",
    ]};
}
