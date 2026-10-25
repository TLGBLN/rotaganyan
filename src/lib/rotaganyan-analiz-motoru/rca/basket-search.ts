/**
 * ROTAGANYAN — BASKET FIRST, source-agnostic, seeded combinatorial search.
 *
 * The evaluation unit is ALWAYS a jointly re-fitted subset (basket), NEVER a
 * standalone feature ranking. Single/pair results are diagnostics, not deletion
 * gates. Search is heuristic: 2^36−1 sets cannot be searched exhaustively.
 * No D/V1 mixing quota or artificial positive contribution. Every candidate
 * MUST cover ancestry (SIRE/DAM/DAMSIRE), race pace and surface/distance,
 * alongside the other major racing domains. Weak singleton metrics do not veto
 * features and missing raw lineage observations do not get fictitious points.
 *
 * 238 original PIT train races only. Results from repeatedly searched 3 folds
 * are discovery evidence, NOT unbiased performance. Publication BLOCKED.
 */
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {basketDomainCheck} from "./basket-domain-coverage";
import {candidateObjective,rankCombination,selectionKey,
  type CombinationResult} from "./combinatorial-signal-selection";

export type BasketCandidate = readonly string[];
export type BasketSearchOptions = {
  seed:number;restartCount:number;beamWidth:number;rounds:number;
  maxNeighbours:number;minSize:number;maxSize:number;
};
export const DEFAULT_BASKET_SEARCH:Readonly<BasketSearchOptions>=Object.freeze({
  seed:20261025,restartCount:36,beamWidth:6,rounds:6,
  maxNeighbours:160,minSize:1,maxSize:36,
});

function rng(seed:number):()=>number {
  let x=seed>>>0;
  return ()=>{
    x=(x+0x6D2B79F5)>>>0;
    let z=x;z=Math.imul(z^(z>>>15),z|1);
    z^=z+Math.imul(z^(z>>>7),z|61);
    return ((z^(z>>>14))>>>0)/4294967296;
  };
}
function shuffle<T>(arr:readonly T[],r:()=>number):T[] {
  const out=[...arr];
  for(let i=out.length-1;i>0;i--){const j=Math.floor(r()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
  return out;
}
export function canonicalBasket(codes:readonly string[]):string[] {
  selectionKey(codes);
  return UNIFIED_MODEL_CODES.filter(x=>codes.includes(x));
}
export function validateBasketOptions(opts:BasketSearchOptions):void {
  if(!Number.isSafeInteger(opts.seed) || opts.seed<0 ||
     !Number.isSafeInteger(opts.restartCount)||opts.restartCount<1||opts.restartCount>150 ||
     !Number.isSafeInteger(opts.beamWidth)||opts.beamWidth<1||opts.beamWidth>40 ||
     !Number.isSafeInteger(opts.rounds)||opts.rounds<1||opts.rounds>30 ||
     !Number.isSafeInteger(opts.maxNeighbours)||opts.maxNeighbours<10||opts.maxNeighbours>2000 ||
     !Number.isSafeInteger(opts.minSize)||opts.minSize<1||
     !Number.isSafeInteger(opts.maxSize)||opts.maxSize>UNIFIED_MODEL_CODES.length||
     opts.minSize>opts.maxSize)
    throw new Error("RAN_BASKET_INVALID_SEARCH_OPTIONS");
}
export function createDiverseBasketSeeds(
  codes:readonly string[],
  opts:BasketSearchOptions=DEFAULT_BASKET_SEARCH,
):string[][] {
  validateBasketOptions(opts);
  if(selectionKey(codes)!==selectionKey(UNIFIED_MODEL_CODES))
    throw new Error("RAN_BASKET_REQUIRES_36_KNOWN_SIGNALS");
  const r=rng(opts.seed),sets=new Map<string,string[]>();
  const add=(subset:readonly string[])=>{
    if(subset.length<opts.minSize||subset.length>opts.maxSize)return;
    const c=canonicalBasket(subset);sets.set(selectionKey(c),c);
  };
  const all=canonicalBasket(codes);
  add(all);
  // Leave-one-out from full: signals are judged IN COMBINATION with all others.
  for(const drop of all)add(all.filter(c=>c!==drop));
  // Diverse fixed-size and interleaved seeds, including a long-basket scenario.
  const sizes=[2,3,4,6,9,12,15,18,24,27,30,33,35,36];
  for(const size of sizes){
    add(all.slice(0,size));
    add(all.slice(-size));
    add(all.filter((_,i)=>i%2===0).slice(0,size));
  }
  // Random restarts do not consult winning outcomes or the single-signal scores.
  for(let i=0;i<opts.restartCount;i++){
    const size=Math.min(opts.maxSize,Math.max(opts.minSize,
      2+Math.floor(r()*Math.max(1,all.length-1))));
    add(shuffle(all,r).slice(0,size));
  }
  return [...sets.values()];
}
/**
 * Basket neighborhood: additive/remove-one, swaps, and *block* mutations.
 * A weak standalone feature may win paired with another; pair moves allow
 * crossing valleys that one-feature greedy selection cannot traverse.
 */
export function basketNeighbours(
  basket:readonly string[],
  opts:BasketSearchOptions,
  seed=opts.seed
):string[][] {
  validateBasketOptions(opts);
  const chosen=canonicalBasket(basket),have=new Set(chosen);
  const outside=UNIFIED_MODEL_CODES.filter(x=>!have.has(x));
  const results=new Map<string,string[]>(),r=rng(seed>>>0);
  const add=(arr:readonly string[])=>{
    const c=canonicalBasket(arr);
    if(c.length>=opts.minSize&&c.length<=opts.maxSize)
      results.set(selectionKey(c),c);
  };
  for(const x of chosen) if(chosen.length>opts.minSize)add(chosen.filter(c=>c!==x));
  for(const x of outside)if(chosen.length<opts.maxSize)add([...chosen,x]);
  // Crucial single exchange: more informative signal replaces weaker evidence.
  const swaps:[string,string][]=[];
  for(const drop of chosen)for(const incoming of outside)swaps.push([drop,incoming]);
  for(const [drop,incoming] of shuffle(swaps,r).slice(0,opts.maxNeighbours))
    add([...chosen.filter(c=>c!==drop),incoming]);
  // True 2-feature bundle changes: single-signal local improvements are
  // NOT required (non-additive synergy can exist at basket level).
  if(outside.length>=2 && chosen.length+2<=opts.maxSize){
    const pairs:[string,string][]=[];
    for(let i=0;i<outside.length;i++)for(let j=i+1;j<outside.length;j++)
      pairs.push([outside[i],outside[j]]);
    for(const [a,b] of shuffle(pairs,r).slice(0,Math.max(4,Math.floor(opts.maxNeighbours/4))))
      add([...chosen,a,b]);
  }
  if(chosen.length>=2 && chosen.length-2>=opts.minSize){
    const pairs:[string,string][]=[];
    for(let i=0;i<chosen.length;i++)for(let j=i+1;j<chosen.length;j++)
      pairs.push([chosen[i],chosen[j]]);
    for(const [a,b] of shuffle(pairs,r).slice(0,Math.max(4,Math.floor(opts.maxNeighbours/4))))
      add(chosen.filter(c=>c!==a&&c!==b));
  }
  if(chosen.length>=2&&outside.length>=2){
    const drops:[string,string][]=[],adds:[string,string][]=[];
    for(let i=0;i<chosen.length;i++)for(let j=i+1;j<chosen.length;j++)drops.push([chosen[i],chosen[j]]);
    for(let i=0;i<outside.length;i++)for(let j=i+1;j<outside.length;j++)adds.push([outside[i],outside[j]]);
    const ds=shuffle(drops,r),as=shuffle(adds,r);
    const limit=Math.min(opts.maxNeighbours,ds.length,as.length);
    for(let i=0;i<limit;i++){
      const [a,b]=ds[i],[c,d]=as[i];
      add([...chosen.filter(x=>x!==a&&x!==b),c,d]);
    }
  }
  return [...results.values()].slice(0,opts.maxNeighbours*3);
}
export function basketParetoFront(
  results:readonly CombinationResult[],
):CombinationResult[] {
  const unique=[...new Map(results.map(r=>[selectionKey(r.codes),r])).values()];
  return unique.filter(a=>!unique.some(b=>b!==a&&
    b.n===a.n &&
    b.top1Hits>=a.top1Hits && b.top3Hits>=a.top3Hits &&
    b.logLoss<=a.logLoss &&
    (b.top1Hits>a.top1Hits || b.top3Hits>a.top3Hits || b.logLoss<a.logLoss)))
    .sort(rankCombination);
}
export function basketEfficiency(result:CombinationResult):number{
  // Require all basket models scored on identical chronological races.
  // Existing candidateObjective is the EXPLICIT research utility, not a
  // claim of realized profit. Monetary ROI requires PIT market/payout data.
  return candidateObjective(result,result.codes.length);
}
export function chooseBasketFromConfirmation(
  confirmed:readonly CombinationResult[],
  fullBasket:CombinationResult
):{selected:CombinationResult;front:CombinationResult[];
  status:"RESEARCH_BASKET_BEATS_FULL"|"RESEARCH_FULL36_RETAINED"|
    "RESEARCH_BASKET_TRADEOFF";reason:string} {
  if(!confirmed.length||!confirmed.every(r=>r.n===fullBasket.n))
    throw new Error("RAN_BASKET_DIFFERENT_VALIDATION_COHORT");
  if(!basketDomainCheck(fullBasket.codes).complete)
    throw new Error("RAN_BASKET_FULL_REFERENCE_MISSING_DOMAINS");
  // A domain-incomplete high-TOP1 subset may dominate numerically in the
  // exploratory metrics, but it is not an eligible unified racing engine.
  // Remove invalid selections BEFORE Pareto so they cannot mask real baskets.
  const front=basketParetoFront(
    confirmed.filter(x=>basketDomainCheck(x.codes).complete));
  // Never force lineage/source representation. A shortlist winner must remain
  // on Pareto frontier. Both TOP1 and TOP3 are independent non-tradeoff guards
  // to avoid optimizing one at the expense of the other.
  const eligible=front.filter(x=>basketDomainCheck(x.codes).complete &&
      x.top1Hits>=fullBasket.top1Hits &&
      x.top3Hits>=fullBasket.top3Hits &&
      x.logLoss<=fullBasket.logLoss+0.02);
  const strongest=eligible.sort(rankCombination)[0];
  if(strongest && selectionKey(strongest.codes)!==selectionKey(fullBasket.codes))
    return {selected:strongest,front,
      status:"RESEARCH_BASKET_BEATS_FULL",
      reason:"Includes all required racing evidence domains; equal/greater TOP1 and TOP3 within 0.02 LogLoss of full-36. Still inner-fold selection only."};
  if(strongest)return {selected:fullBasket,front,status:"RESEARCH_FULL36_RETAINED",
    reason:"Full-36 is not strictly beaten by a basket in both guarded winner metrics."};
  return {selected:fullBasket,front,status:"RESEARCH_BASKET_TRADEOFF",
    reason:"No racing-domain-complete subset passes TOP1/TOP3 and LogLoss guards; do not promote a speed/form-only basket."};
}
export function sourceBlindWinnerSelection(
  results:readonly CombinationResult[],
):CombinationResult {
  if(!results.length)throw new Error("RAN_BASKET_NO_RESULTS");
  return [...results].sort(rankCombination)[0];
}
