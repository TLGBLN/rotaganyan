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
  /** EXACT same 6-leg counts/price, adjacent normal-only horse swapped for weakest unprotected pick. */
  fixedBudgetSwaps: BoundaryRiskProposal[];
  warning: string;
};
// Betting unit identity; replacing one group representative with another keeps
// the combination count unchanged, even when several horses share an ekuri.
function unitKey(r:LegProbability["runners"][number]):string {
  return r.ekuriGroup != null && r.ekuriGroup >= 1 ? "G"+r.ekuriGroup : "N"+r.no;
}
function unitWeight(leg:LegProbability,no:number):number {
  const representative=leg.runners.find(r=>r.no===no);
  if(!representative)throw new Error("RAN_BOUNDARY_UNKNOWN_RUNNER");
  const key=unitKey(representative);
  return leg.runners.filter(r=>unitKey(r)===key).reduce((sum,r)=>sum+r.olasilik,0);
}
function groupKeyOf(leg:LegProbability,no:number):string {
  const runner=leg.runners.find(r=>r.no===no);
  if(!runner) throw new Error("RAN_BOUNDARY_UNKNOWN_RUNNER");
  return unitKey(runner);
}
function buildEqualPriceSwap(
  legs:readonly LegProbability[],base:OptimizeResult,
  candidates:readonly Addition[],maxCombinations:number,
):BoundaryRiskProposal|null {
  const after:Record<number,number[]>={};
  const changes:Change[]=[];
  for(const leg of legs){
    const previous=base.secimler[leg.raceNo]??[];
    const chosen=[...previous];
    const newOnes=candidates.filter(c=>c.raceNo===leg.raceNo);
    if(newOnes.length>1)return null; // only one marginal replacement per leg
    if(newOnes.length===1){
      const candidate=newOnes[0].no;
      const selectedGroups=new Set(chosen.map(no=>groupKeyOf(leg,no)));
      if(selectedGroups.has(groupKeyOf(leg,candidate)))return null;
      const immutable=new Set((leg.forced?.include??[]).map(no=>groupKeyOf(leg,no)));
      const removables=chosen
        .filter(no=>!immutable.has(groupKeyOf(leg,no)))
        .sort((a,b)=>unitWeight(leg,a)-unitWeight(leg,b) || b-a);
      if(removables.length===0)return null;
      const removed=removables[0];
      const index=chosen.indexOf(removed);
      chosen.splice(index,1,candidate);
      changes.push({raceNo:leg.raceNo,added:[candidate],removed:[removed]});
    }
    after[leg.raceNo]=chosen;
  }
  const combo=legs.reduce((p,leg)=>p*(base.birimSayilari[leg.raceNo]??0),1);
  if(combo!==base.toplamKombinasyon || combo>maxCombinations)
    throw new Error("RAN_BOUNDARY_SAME_PRICE_ASSERTION");
  let coverage=1;
  for(const leg of legs){
    const selected=after[leg.raceNo];
    if(selected.length!==(base.secimler[leg.raceNo]??[]).length)
      throw new Error("RAN_BOUNDARY_LEG_COUNT_CHANGED");
    if(new Set(selected.map(no=>groupKeyOf(leg,no))).size!==selected.length)
      throw new Error("RAN_BOUNDARY_DUPLICATE_BETTING_UNIT");
    coverage*=selected.reduce((sum,no)=>sum+unitWeight(leg,no),0);
  }
  const result:OptimizeResult={
    secimler:after,toplamKombinasyon:combo,kapsamaOlasiligi:coverage,
    birimSayilari:{...base.birimSayilari},
  };
  return {
    forcedBoundary:[...candidates], result,changes,
    modeledCoverageDelta:coverage-base.kapsamaOlasiligi,
    modeledCoverageRatio:base.kapsamaOlasiligi>0?coverage/base.kapsamaOlasiligi:0,
    budgetCombinations:maxCombinations,
    actuallyAddsAll:candidates.every(c=>after[c.raceNo]?.includes(c.no)),
  };
}

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

  // These swaps keep 3x5x2x3x3x2 exactly unchanged; no legs need to be
  // sacrificed. They are still diagnostics: a lower model-ranked horse cannot
  // be justified over the retained pick without INDEPENDENT pre-race evidence.
  const fixedBudgetSwaps=scenarios
    .map(c=>buildEqualPriceSwap(legs,baseline,c,economicMaxCombinations))
    .filter((p):p is BoundaryRiskProposal=>p!==null);
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
    normalOnly,proposals,fixedBudgetSwaps,
    warning:"This uses no winners. Equal-price swaps are diagnostic, NOT a claim that the lower-ranked normal-only horse was better. A live selection needs separately verified pre-race evidence and forward tests; retrospectively picking winning swaps is hindsight bias.",
  };
}
