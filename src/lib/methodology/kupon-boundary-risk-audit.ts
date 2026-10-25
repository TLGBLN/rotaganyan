/**
 * ROTAGANYAN: pre-race coupon frontier counterfactuals, SHADOW / read-only.
 *
 * User case (Adana): selected 3/5 units in two legs, winning horses happened to
 * be the NEXT additions in normal. Hindsight winners are NEVER used here.
 * All proposals are based on same immutable pre-race probability arrays and
 * re-optimize the WHOLE multi-leg ticket at the SAME economic budget.
 *
 * This is deliberately NOT a production auto-selection policy. The ordinary
 * optimizer already maximizes modeled P(ticket hit) over prefixes; a forced
 * normal-only candidate can only be better when the model probabilities or
 * objective are imperfect. To claim that insurance helps, replay on untouched,
 * pre-race snapshots with actual observed future results.
 */
import { optimizeKuponAllocation, type LegProbability, type OptimizeResult } from "./kupon-optimizer";

type Addition = { raceNo: number; no: number };
type Change = { raceNo: number; added: number[]; removed: number[] };
export type BoundaryRiskProposal = {
  forcedBoundary: Addition[];
  result: OptimizeResult;
  changes: Change[];
  modeledCoverageDelta: number;
  modeledCoverageRatio: number;
  budgetCombinations: number;
  actuallyAddsAll: boolean;
};
export type BoundaryRiskAudit = {
  diagnosticOnly: true;
  selectionGate: "NOT_VERIFIED";
  baseline: OptimizeResult;
  expanded: OptimizeResult;
  normalOnly: Addition[];
  proposals: BoundaryRiskProposal[];
  warning: string;
};
export function auditKuponBoundary(
  legs: readonly LegProbability[],
  economicMaxCombinations: number,
  normalMaxCombinations: number,
  maxNormalOnlyPerLeg = 2
): BoundaryRiskAudit {
  if (!Number.isSafeInteger(economicMaxCombinations) || economicMaxCombinations < 1 ||
      !Number.isSafeInteger(normalMaxCombinations) || normalMaxCombinations < economicMaxCombinations ||
      !Number.isSafeInteger(maxNormalOnlyPerLeg) || maxNormalOnlyPerLeg < 1 || maxNormalOnlyPerLeg > 10 ||
      legs.length < 2 || legs.length > 7 ||
      new Set(legs.map(l=>l.raceNo)).size !== legs.length) {
    throw new Error("RAN_BOUNDARY_INVALID_INPUT: 2..7 distinct legs and ordered budgets required");
  }
  for(const l of legs) {
    if(l.runners.length < 1 || new Set(l.runners.map(r=>r.no)).size !== l.runners.length ||
       l.runners.some(r=>!Number.isFinite(r.olasilik) || r.olasilik < 0 || r.olasilik > 1) ||
       (l.forced?.include??[]).some(no=>(l.forced?.exclude??[]).includes(no))) {
      throw new Error("RAN_BOUNDARY_INVALID_LEG: invalid probability, duplicate runner or conflicting override");
    }
  }
  const baseline=optimizeKuponAllocation([...legs],economicMaxCombinations);
  if (!baseline.toplamKombinasyon) throw new Error("RAN_BOUNDARY_NO_ECONOMIC_SOLUTION");
  const expanded=optimizeKuponAllocation([...legs],normalMaxCombinations,baseline.birimSayilari);
  if (!expanded.toplamKombinasyon) throw new Error("RAN_BOUNDARY_NO_NORMAL_SOLUTION");

  const normalOnly: Addition[]=[];
  const groups: Addition[][]=[];
  for(const leg of legs){
    const economy=new Set(baseline.secimler[leg.raceNo]??[]);
    const normal=(expanded.secimler[leg.raceNo]??[]).filter(no=>!economy.has(no));
    const group=normal.slice(0,maxNormalOnlyPerLeg).map(no=>({raceNo:leg.raceNo,no}));
    groups.push(group);
    normalOnly.push(...group);
  }
  const scenarios: Addition[][] = normalOnly.map(x=>[x]);
  // Include both adjacent misses in DIFFERENT legs, not just one at a time.
  for(let i=0;i<groups.length;i++)for(let j=i+1;j<groups.length;j++)
    for(const a of groups[i])for(const b of groups[j])scenarios.push([a,b]);

  const proposals:BoundaryRiskProposal[]=[];
  for(const boundary of scenarios){
    const adjusted=legs.map(l=>({
      ...l,
      forced:{
        include:[...(l.forced?.include??[]),...boundary.filter(x=>x.raceNo===l.raceNo).map(x=>x.no)],
        exclude:[...(l.forced?.exclude??[])],
      },
    }));
    const result=optimizeKuponAllocation(adjusted,economicMaxCombinations);
    if(!result.toplamKombinasyon)continue; // infeasible overrides => never fake inclusion
    const actuallyAddsAll=boundary.every(x=>(result.secimler[x.raceNo]??[]).includes(x.no));
    if(!actuallyAddsAll)continue;
    const changes:Change[]=legs.map(l=>{
      const before=new Set(baseline.secimler[l.raceNo]??[]);
      const after=new Set(result.secimler[l.raceNo]??[]);
      return {raceNo:l.raceNo,added:[...after].filter(x=>!before.has(x)).sort((a,b)=>a-b),
        removed:[...before].filter(x=>!after.has(x)).sort((a,b)=>a-b)};
    }).filter(x=>x.added.length>0||x.removed.length>0);
    if(result.toplamKombinasyon>economicMaxCombinations)
      throw new Error("RAN_BOUNDARY_BUDGET_BREACH");
    proposals.push({
      forcedBoundary:boundary,result,changes,
      modeledCoverageDelta:result.kapsamaOlasiligi-baseline.kapsamaOlasiligi,
      modeledCoverageRatio:baseline.kapsamaOlasiligi>0
        ? result.kapsamaOlasiligi/baseline.kapsamaOlasiligi : 0,
      budgetCombinations:economicMaxCombinations,
      actuallyAddsAll:true,
    });
  }
  proposals.sort((a,b)=>{
    const p=a.modeledCoverageDelta-b.modeledCoverageDelta;
    if(Math.abs(p)>1e-12) return p>0?-1:1;
    return a.forcedBoundary.length-b.forcedBoundary.length;
  });
  return {
    diagnosticOnly:true,selectionGate:"NOT_VERIFIED",baseline,expanded,
    normalOnly,proposals,
    warning:"This uses no winners. It is a pre-race counterfactual for inspection only; selecting proposals by historic winning tickets is hindsight bias. Validate on new, frozen pre-race snapshots.",
  };
}
