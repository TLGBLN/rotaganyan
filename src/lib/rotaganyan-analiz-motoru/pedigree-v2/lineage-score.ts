/**
 * ROTAGANYAN pedigree scoring v2 — RESEARCH CANDIDATE ONLY.
 *
 * Every horse has separate PIT SIRE, DAM and DAMSIRE evidence. We model distinct
 * offspring, not just repeated starts from one successful foal. Beta are NEVER
 * inherited from RAN 36 legacy artifact: new inputs REQUIRE a separately
 * trained versioned model.
 */
import type {RunnerFeatureVector,SignalEntry} from "@/lib/motor-v1/engine/feature-vector";
export const PEDIGREE_V2_VERSION="RAN_PEDIGREE_3LINE_FOAL_ADJUST_V2_20261025" as const;
export const LINEAGES=[
  {code:"SIRE_HISTORY",field:"sire",label:"BABA"},
  {code:"DAM_HISTORY",field:"dam",label:"ANNE"},
  {code:"DAMSIRE_HISTORY",field:"damSire",label:"ANNE_BABASI"},
] as const;
export type LineageCode=(typeof LINEAGES)[number]["code"];
export type PedigreeConfig={priorPct:number;priorStarts:number;maxStartsPerFoal:number};
export const PEDIGREE_V2_CONFIG:Readonly<PedigreeConfig>=Object.freeze({
  priorPct:14, // inherits existing D sire starting reference; NOT a proven population prior
  priorStarts:20,
  maxStartsPerFoal:3, // prevent one heavily raced child dominating lineage evidence
});
export type LineageInput={
  code:LineageCode; ancestorName:string|null;
  // ONLY as-of race history, target horse excluded; entries must have a known foal ID
  progeny:ReadonlyArray<{tjkAtId:number;starts:number;wins:number}>;
  targetId:number|null;
};
export type AdjustedLineage={
  code:LineageCode;ancestorName:string|null;
  rawWinPct:number|null;adjustedPct:number|null;
  starts:number;wins:number;distinctFoals:number;effectiveStarts:number;
  confidence:number|null;observed:boolean;
  missingReason:string|null;
};
export type PedigreeV2Horse={raceId:string;no:number;horseName:string;lines:AdjustedLineage[]};
export function adjustLineage(input:LineageInput,cfg:PedigreeConfig=PEDIGREE_V2_CONFIG):AdjustedLineage {
  if(cfg.priorPct<0 || cfg.priorPct>100 || !(cfg.priorStarts>0) ||
      !Number.isSafeInteger(cfg.maxStartsPerFoal)||cfg.maxStartsPerFoal<1)
    throw new Error("RAN_PED_V2_BAD_CONFIG");
  const missing=(reason:string):AdjustedLineage=>({
    code:input.code,ancestorName:input.ancestorName,
    rawWinPct:null,adjustedPct:null,starts:0,wins:0,distinctFoals:0,
    effectiveStarts:0,confidence:null,observed:false,missingReason:reason,
  });
  if(!input.ancestorName?.trim())return missing("ANCESTOR_UNKNOWN");
  // No ID => leave-one-out cannot be proven. Missing is safer than an inflated
  // apparent pedigree fit from the horse's own historic results.
  if(input.targetId==null || !Number.isSafeInteger(input.targetId))
    return missing("TARGET_HORSE_ID_UNKNOWN_CANNOT_EXCLUDE_OWN_RUNS");
  let starts=0,wins=0,effectiveStarts=0,distinctFoals=0;
  const seen=new Set<number>();
  for(const p of input.progeny){
    if(!Number.isSafeInteger(p.tjkAtId) || !Number.isSafeInteger(p.starts) ||
        !Number.isSafeInteger(p.wins) || p.tjkAtId<1 || p.starts<1 ||
        p.wins<0||p.wins>p.starts||seen.has(p.tjkAtId))
      throw new Error("RAN_PED_V2_MALFORMED_HISTORICAL_PROGENY");
    seen.add(p.tjkAtId);
    if(p.tjkAtId===input.targetId)continue;
    starts+=p.starts;wins+=p.wins;distinctFoals++;
    effectiveStarts+=Math.min(p.starts,cfg.maxStartsPerFoal);
  }
  if(!starts)return missing("NO_OTHER_PROGENY_IN_PIT_SURFACE_DISTANCE_BUCKET");
  // Win rate of other progeny stays the source observation. Reliability depends
  // on up to THREE independent starts per DISTINCT progeny, preventing one foal
  // (50 historical starts) from looking like 50 independent hereditary samples.
  const rawWinPct=100*wins/starts;
  const confidence=effectiveStarts/(effectiveStarts+cfg.priorStarts);
  const adjustedPct=cfg.priorPct+confidence*(rawWinPct-cfg.priorPct);
  return {code:input.code,ancestorName:input.ancestorName,rawWinPct,
    adjustedPct,starts,wins,distinctFoals,effectiveStarts,confidence,
    observed:true,missingReason:null};
}
export function replaceThreeLineages(
  vector:RunnerFeatureVector,lines:readonly AdjustedLineage[]
):RunnerFeatureVector {
  if(lines.length!==LINEAGES.length ||
     new Set(lines.map(x=>x.code)).size!==LINEAGES.length ||
     LINEAGES.some(x=>!lines.some(l=>l.code===x.code)) ||
     LINEAGES.some(x=>vector.signals.filter(s=>s.code===x.code).length!==1))
    throw new Error("RAN_PED_V2_MUST_EXAMINE_EVERY_HORSE_THREE_DISTINCT_LINES");
  const byCode=new Map(lines.map(l=>[l.code,l]));
  const signals:SignalEntry[]=vector.signals.map(s=>{
    if(!byCode.has(s.code as LineageCode))return s;
    const x=byCode.get(s.code as LineageCode)!;
    return {...s,rawValue:x.adjustedPct,observed:x.observed,
      sampleCount:x.observed?x.starts:null,
      missingReason:x.missingReason,
      // source evidence confidence is NOT an additional score point; learned
      // beta of this *new version* decides whether a lineage helps or hurts.
    };
  });
  if(!signals.every((s,i)=> s.code===vector.signals[i].code))
    throw new Error("RAN_PED_V2_SIGNAL_ORDER_MUTATION");
  return {...vector,signals,pedigreeScoringVersion:PEDIGREE_V2_VERSION};
}
export function assertPedigreeVersionAndProvenance(
  version:string,
  candidateVectors:readonly RunnerFeatureVector[]
):void {
  if(version!==PEDIGREE_V2_VERSION)throw new Error("RAN_PED_V2_MODEL_FINGERPRINT_MISMATCH");
  for(const v of candidateVectors){
    if(v.pedigreeScoringVersion!==PEDIGREE_V2_VERSION)
      throw new Error("RAN_PED_V2_INPUT_VERSION_MISMATCH");
    if(LINEAGES.some(l=>v.signals.filter(s=>s.code===l.code).length!==1))
      throw new Error("RAN_PED_V2_MISSING_LINEAGE");
    if(LINEAGES.some(l=>{
      const s=v.signals.find(x=>x.code===l.code)!;
      return s.observed ? !(s.sampleCount!=null && s.sampleCount>0 &&
        s.rawValue!=null && Number.isFinite(s.rawValue)):s.rawValue!=null;
    }))throw new Error("RAN_PED_V2_UNTRUSTED_LINEAGE");
  }
}
