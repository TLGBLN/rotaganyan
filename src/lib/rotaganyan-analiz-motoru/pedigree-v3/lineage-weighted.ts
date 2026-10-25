/**
 * RAN pedigree V3 — isolates foal-level evidence from start-level sampling.
 * V2 diagnostic model remains immutable. NEVER score V3 vectors with V2 betas.
 *
 * V2 bug: cap(n,3) was used in reliability only, while mean rate was weighted
 * by all starts. A prolific foal could still dominate raw percentage.
 * V3: each offspring contributes at most 3 effective historical starts both
 * to the rate numerator AND to its reliability denominator.
 */
import type {RunnerFeatureVector} from "@/lib/motor-v1/engine/feature-vector";
import {
  PEDIGREE_V2_CONFIG,LINEAGES,replaceThreeLineages,
  type AdjustedLineage,type LineageInput,type PedigreeConfig,
} from "../pedigree-v2/lineage-score";

export const PEDIGREE_V3_VERSION="RAN_PEDIGREE_3LINE_FOAL_WEIGHTED_V3_20261025" as const;
export type WeightedLineage=AdjustedLineage&{
  balancedWinPct:number|null;
  evidenceMethod:"EQUAL_FOAL_CAPPED_STARTS_V3";
};
export function adjustWeightedLineage(
  input:LineageInput,cfg:PedigreeConfig=PEDIGREE_V2_CONFIG,
):WeightedLineage {
  if(!Number.isFinite(cfg.priorPct)||cfg.priorPct<0||cfg.priorPct>100 ||
     !(cfg.priorStarts>0) || !Number.isSafeInteger(cfg.maxStartsPerFoal) ||
     cfg.maxStartsPerFoal<1)
    throw new Error("RAN_PED_V3_INVALID_PRIOR");
  const missing=(reason:string):WeightedLineage=>({
    code:input.code,ancestorName:input.ancestorName,rawWinPct:null,
    adjustedPct:null,starts:0,wins:0,distinctFoals:0,effectiveStarts:0,
    confidence:null,observed:false,missingReason:reason,balancedWinPct:null,
    evidenceMethod:"EQUAL_FOAL_CAPPED_STARTS_V3",
  });
  if(!input.ancestorName?.trim())return missing("ANCESTOR_UNKNOWN");
  if(input.targetId==null||!Number.isSafeInteger(input.targetId)||input.targetId<1)
    return missing("TARGET_HORSE_ID_UNKNOWN_CANNOT_EXCLUDE_OWN_RUNS");
  let starts=0,wins=0,foals=0,nEff=0,wEff=0;
  const seen=new Set<number>();
  for(const p of input.progeny){
    if(!Number.isSafeInteger(p.tjkAtId)||p.tjkAtId<1 ||
       !Number.isSafeInteger(p.starts)||p.starts<1 ||
       !Number.isSafeInteger(p.wins)||p.wins<0||p.wins>p.starts ||
       seen.has(p.tjkAtId))throw new Error("RAN_PED_V3_INVALID_PROGENY");
    seen.add(p.tjkAtId);
    if(p.tjkAtId===input.targetId)continue;
    foals++;starts+=p.starts;wins+=p.wins;
    const w=Math.min(p.starts,cfg.maxStartsPerFoal);
    nEff+=w;
    wEff+=w*(p.wins/p.starts); // THIS term also uses capped foal weight.
  }
  if(!starts)return missing("NO_OTHER_PROGENY_IN_PIT_SURFACE_DISTANCE_BUCKET");
  const balancedWinPct=100*wEff/nEff;
  const confidence=nEff/(nEff+cfg.priorStarts);
  return {
    code:input.code,ancestorName:input.ancestorName,
    rawWinPct:100*wins/starts,
    balancedWinPct,
    adjustedPct:cfg.priorPct+confidence*(balancedWinPct-cfg.priorPct),
    starts,wins,distinctFoals:foals,effectiveStarts:nEff,confidence,
    observed:true,missingReason:null,evidenceMethod:"EQUAL_FOAL_CAPPED_STARTS_V3",
  };
}
/** Changes only canonical SIRE/DAM/DAMSIRE, stamps explicit V3 lineage source. */
export function replaceWeightedThreeLineages(
  vector:RunnerFeatureVector,lines:readonly WeightedLineage[],
):RunnerFeatureVector {
  const adjusted=replaceThreeLineages(vector,lines);
  return {...adjusted,pedigreeScoringVersion:PEDIGREE_V3_VERSION};
}
export function assertWeightedPedigreeVectors(
  vectors:readonly RunnerFeatureVector[],
):void {
  if(vectors.length<1)throw new Error("RAN_PED_V3_EMPTY_VECTORS");
  for(const v of vectors){
    if(v.pedigreeScoringVersion!==PEDIGREE_V3_VERSION ||
       LINEAGES.some(l=>v.signals.filter(s=>s.code===l.code).length!==1) ||
       LINEAGES.some(l=>{
         const s=v.signals.find(x=>x.code===l.code)!;
         return s.observed
           ? !(s.rawValue!=null && Number.isFinite(s.rawValue) &&
               s.sampleCount!=null&&Number.isSafeInteger(s.sampleCount)&&s.sampleCount>0)
           : s.rawValue!=null;
       }))throw new Error("RAN_PED_V3_INVALID_LINEAGES_OR_VERSION");
  }
}
