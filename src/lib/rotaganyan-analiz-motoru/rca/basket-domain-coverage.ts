/**
 * RAN v1.0 — non-negotiable RACING EVIDENCE COVERAGE for unified baskets.
 * This is NOT a positive-weight mandate. Each included signal gets a jointly
 * learned coefficient that may be negative or near zero.
 *
 * A compressed speed/form-only basket cannot be promoted as a full racing
 * engine. Selection must retain 3 individually measured lineage branches,
 * pace components, track/distance, and major race-condition sources.
 *
 * Group members are alternative ways to preserve evidence, not equivalent
 * calculations. Longitudinal/surface/contextual adequacy remains separately
 * testable. Race-day missingness remains explicit.
 */
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {selectionKey} from "./combinatorial-signal-selection";

export const BASKET_DOMAIN_RULES = [
  {id:"SIRE",codes:["SIRE_HISTORY"]},
  {id:"DAM",codes:["DAM_HISTORY"]},
  {id:"DAMSIRE",codes:["DAMSIRE_HISTORY"]},
  {id:"SPEED",codes:["SPEED","ACC_SPEED","RIVAL_GAP","ACC_LATE"]},
  {id:"FORM",codes:["FORM_LEVEL","FORM_TREND","LAYOFF_DAYS","SURFACE_FORM"]},
  {id:"OWN_PACE",codes:["OWN_LEAD_TENDENCY","SINGLE_LEADER"]},
  {id:"FIELD_PACE",codes:["RIVAL_FRONT_PRESSURE","CLOSER_PRESSURE_FIT","RACE_PACE_FIT"]},
  {id:"TRACK_DISTANCE",codes:["GROUND_TOLERANCE","GROUND_DISTANCE_EXPERIENCE",
    "SURFACE_SPEED_DELTA","DISTANCE_SPEED_DELTA","SURFACE_FORM"]},
  {id:"JOCKEY",codes:["JOCKEY_OE30","JOCKEY_LONG_TERM",
    "JOCKEY_STYLE","JOCKEY_TREND30","IDMAN_JOCKEY"]},
  {id:"WEIGHT",codes:["FIELD_WEIGHT_DELTA","HIST_WEIGHT_DELTA",
    "WEIGHT_DISTANCE","WEIGHT_HANDICAP"]},
  {id:"CLASS_RIVALS",codes:["RIVAL_CLASS","H2H","RIVAL_GAP"]},
  {id:"WORKOUT",codes:["IDMAN_JOCKEY","WORKOUT_SPRINT"]},
  {id:"EQUIPMENT",codes:["EQUIPMENT_CHANGE"]},
  {id:"DRAW",codes:["DRAW"]},
] as const;
export type DomainCheck = {
  complete:boolean;
  satisfied:string[];
  missing:string[];
  byGroup:{id:string;present:string[];accepted:string[]}[];
};
export function basketDomainCheck(codes:readonly string[]):DomainCheck {
  selectionKey(codes);
  const set=new Set(codes);
  const byGroup=BASKET_DOMAIN_RULES.map(rule=>({
    id:rule.id,present:rule.codes.filter(c=>set.has(c)),accepted:[...rule.codes],
  }));
  return {
    complete:byGroup.every(r=>r.present.length>0),
    satisfied:byGroup.filter(r=>r.present.length>0).map(r=>r.id),
    missing:byGroup.filter(r=>r.present.length===0).map(r=>r.id),
    byGroup,
  };
}
export function assertBasketDomainCoverage(codes:readonly string[]):void {
  const r=basketDomainCheck(codes);
  if(!r.complete)
    throw new Error("RAN_BASKET_MISSING_RACING_DOMAINS:"+r.missing.join(","));
}
/**
 * Search must explore only racing-valid baskets, but the source provenance
 * and all other original 36 feature signals remain available for screening.
 * Deterministic choice of an alternative within each missing group; the
 * seed changes the choice to prevent hard-coding a single family member.
 */
export function completeBasketDomains(codes:readonly string[],seed=0):string[] {
  if(!Number.isSafeInteger(seed)||seed<0)
    throw new Error("RAN_BASKET_BAD_COMPLETION_SEED");
  const initial=new Set(codes);
  selectionKey(codes);
  for(let g=0;g<BASKET_DOMAIN_RULES.length;g++){
    const group=BASKET_DOMAIN_RULES[g];
    if(group.codes.some(code=>initial.has(code)))continue;
    const idx=(seed+g*17)%group.codes.length;
    initial.add(group.codes[idx]);
  }
  const result=UNIFIED_MODEL_CODES.filter(code=>initial.has(code));
  assertBasketDomainCoverage(result);
  return result;
}
