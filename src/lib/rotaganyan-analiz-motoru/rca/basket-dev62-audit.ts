/**
 * Frozen RAN basket vs all-36 comparison on already-inspected Aug26-28 DEV-62.
 *
 * No selection, no refit of winning basket, no weight updates, no market data.
 * The 36-feature benchmark is refit on 238 TRAIN only. The research basket
 * artifact must be the frozen 238-fit from prior inner-fold basket selection.
 * The pairwise race case list documents both rescues and newly missed winners.
 *
 * Previously inspected DEV = diagnostic only; never claim untouched test.
 */
import {computeFeatureStats,fitModel,scoreRace,type FittedModel,type FitOptions}
  from "@/lib/motor-v1/engine/training";
import {UNIFIED_MODEL_CODES} from "../unified-model-codes";
import {selectionKey,type FeatureRace}
  from "./combinatorial-signal-selection";
import {PEDIGREE_V3_VERSION,assertWeightedPedigreeVectors}
  from "../pedigree-v3/lineage-weighted";
export type FrozenBasketArtifact={
  artifactType:string;modelVersion:string;publicationGate:"BLOCKED";
  engineInputVersion:string;sourceSHA256:string;
  codes:string[];
  model:{
    beta:number[];names:string[];
    stats:[string,{mu:number;sigma:number;nObserved:number}][];
    opts:FitOptions;nRacesUsed:number;nRacesSkipped:number;
  };
};
export type BasketDevRace={
  raceId:string;date:string;winnerNo:number;runnerCount:number;
  baselineWinnerRank:number;candidateWinnerRank:number;
  baselineWinnerProbability:number;candidateWinnerProbability:number;
  baselineFavoriteProbability:number;candidateFavoriteProbability:number;
  baselineFavoriteNo:number;candidateFavoriteNo:number;
  classification:"RESCUED_TOP1"|"NEW_MISS_TOP1"|"RESCUED_TOP3"|
    "NEW_MISS_TOP3"|"WINNER_RANK_CHANGED"|"UNCHANGED";
};
export type BasketDevMetrics={
  n:number;top1Hits:number;top3Hits:number;top6Hits:number;
  logLoss:number;brier:number;
  favoriteMeanProbability:number;favoriteHitRate:number;
  favoriteEce5:number;maxFavoriteProbability:number;
  wrong80:number;wrong90:number;
};
type Ranked={
  runnerNo:number;winnerRank:number;winnerProbability:number;
  favoriteNo:number;favoriteProbability:number;
  brier:number;
};
function rank(r:FeatureRace,model:FittedModel<string>):Ranked{
  const all=scoreRace(r.vectors,model);
  if(all.length<3||all.some(x=>!Number.isFinite(x.probability)||
    !Number.isFinite(x.score)||x.probability<0||x.probability>1)||
    Math.abs(all.reduce((a,b)=>a+b.probability,0)-1)>1e-8)
    throw new Error("RAN_BASKET_DEV_INVALID_RACE_PROBABILITIES");
  all.sort((a,b)=>b.probability-a.probability||a.no-b.no);
  const winnerIndex=all.findIndex(x=>x.no===r.winnerNo);
  if(winnerIndex<0)throw new Error("RAN_BASKET_DEV_WINNER_NOT_IN_RACE");
  return {runnerNo:all.length,winnerRank:winnerIndex+1,
    winnerProbability:all[winnerIndex].probability,
    favoriteNo:all[0].no,favoriteProbability:all[0].probability,
    brier:all.reduce((s,x)=>s+(x.probability-Number(x.no===r.winnerNo))**2,0)};
}
function metrics(rows:{r:FeatureRace;s:Ranked}[]):BasketDevMetrics {
  if(!rows.length)throw new Error("RAN_BASKET_DEV_NO_ROWS");
  let t1=0,t3=0,t6=0,ll=0,brier=0,faveMean=0,maxFav=0,n80=0,n90=0;
  const bins=Array.from({length:5},()=>({n:0,pred:0,hit:0}));
  for(const {r,s} of rows){
    t1+=Number(s.winnerRank===1);
    t3+=Number(s.winnerRank<=3);
    t6+=Number(s.winnerRank<=6);
    ll-=Math.log(s.winnerProbability);
    brier+=s.brier;
    faveMean+=s.favoriteProbability;
    maxFav=Math.max(maxFav,s.favoriteProbability);
    const correct=Number(s.favoriteNo===r.winnerNo);
    const bin=bins[Math.min(4,Math.floor(s.favoriteProbability*5))];
    bin.n++;bin.pred+=s.favoriteProbability;bin.hit+=correct;
    if(s.favoriteProbability>=0.8&&!correct)n80++;
    if(s.favoriteProbability>=0.9&&!correct)n90++;
  }
  return {n:rows.length,top1Hits:t1,top3Hits:t3,top6Hits:t6,
    logLoss:ll/rows.length,brier:brier/rows.length,
    favoriteMeanProbability:faveMean/rows.length,
    favoriteHitRate:t1/rows.length,
    favoriteEce5:bins.reduce((a,b)=>a+
      (b.n?Math.abs(b.pred/b.n-b.hit/b.n)*b.n/rows.length:0),0),
    maxFavoriteProbability:maxFav,wrong80:n80,wrong90:n90};
}
export function auditFrozenBasketDev62(
  train:readonly FeatureRace[],development:readonly FeatureRace[],
  artifact:FrozenBasketArtifact,sourceHash:string,
):{
  status:"DIAGNOSTIC_ONLY_ALREADY_INSPECTED_DEV62";publicationGate:"BLOCKED";
  candidateCodes:string[];trainRaces:238;developmentRaces:62;
  baseline:BasketDevMetrics;candidate:BasketDevMetrics;
  paired:{rescuedTop1:number;newlyMissedTop1:number;
    rescuedTop3:number;newlyMissedTop3:number;
    changedRanks:number;netTop1:number;netTop3:number};
  races:BasketDevRace[];
}{
  if(train.length!==238||development.length!==62||
    train.some(r=>r.tarih<"2026-08-16"||r.tarih>"2026-08-25")||
    development.some(r=>r.tarih<"2026-08-26"||r.tarih>"2026-08-28")||
    new Set([...train,...development].map(r=>r.raceId)).size!==300)
    throw new Error("RAN_BASKET_DEV_EXPECTS_ORIGINAL_238_62");
  if(artifact.artifactType!=="RAN_BASKET_SHADOW_UNPUBLISHED" ||
    artifact.modelVersion!=="RAN_SIGNAL_BASKET_DISCOVERY_V1" ||
    artifact.publicationGate!=="BLOCKED" ||
    artifact.engineInputVersion!==PEDIGREE_V3_VERSION ||
    artifact.sourceSHA256!==sourceHash ||
    artifact.codes.length<1||
    artifact.model.nRacesUsed!==238||artifact.model.nRacesSkipped!==0 ||
    artifact.model.opts.lambda!==90||
    artifact.model.opts.learningRate!==0.25 ||
    artifact.model.opts.iterations!==2500||
    artifact.model.beta.length!==artifact.codes.length*2 ||
    artifact.model.names.length!==artifact.codes.length*2 ||
    artifact.model.beta.some(x=>!Number.isFinite(x)) ||
    artifact.model.stats.length!==artifact.codes.length)
    throw new Error("RAN_BASKET_DEV_INVALID_FROZEN_CANDIDATE");
  const key=selectionKey(artifact.codes);
  if(artifact.codes.length!==new Set(artifact.codes).size||
    selectionKey(artifact.model.stats.map(x=>x[0]))!==key||
    artifact.model.stats.some((entry,i)=>
      entry[0]!==artifact.codes[i]||
      !Number.isFinite(entry[1].mu)||!Number.isFinite(entry[1].sigma)||
      !(entry[1].sigma>0)||
      entry[1].nObserved<0 ||
      artifact.model.names[i*2]!==entry[0]+"_z"||
      artifact.model.names[i*2+1]!==entry[0]+"_missing"))
    throw new Error("RAN_BASKET_DEV_FEATURE_STATS_OR_ORDER_MISMATCH");
  // All original V3 PIT vectors must be version-consistent before scoring.
  for(const r of [...train,...development]){
    if(r.vectors.length<3||!r.vectors.some(v=>v.no===r.winnerNo))
      throw new Error("RAN_BASKET_DEV_INVALID_RACE_OR_WINNER");
    assertWeightedPedigreeVectors(r.vectors);
  }
  const model:FittedModel<string>={
    beta:artifact.model.beta,names:artifact.model.names as FittedModel<string>["names"],
    stats:new Map(artifact.model.stats),opts:artifact.model.opts,
    nRacesUsed:artifact.model.nRacesUsed,
    nRacesSkipped:artifact.model.nRacesSkipped,
  };
  const fitOpts={lambda:90,learningRate:0.25,iterations:2500};
  const fullStats=computeFeatureStats(train.flatMap(r=>r.vectors),UNIFIED_MODEL_CODES);
  const benchmark=fitModel(train.map(r=>({
    raceId:r.raceId,date:new Date(r.tarih+"T00:00:00Z"),
    winnerNo:r.winnerNo,vectors:r.vectors,
  })),fullStats,fitOpts);
  if(benchmark.nRacesUsed!==238||benchmark.nRacesSkipped!==0)
    throw new Error("RAN_BASKET_DEV_FULL36_TRAIN_FAILURE");

  let rescuedTop1=0,newlyMissedTop1=0,rescuedTop3=0,
    newlyMissedTop3=0,changedRanks=0;
  const sorted=[...development].sort((a,b)=>
    a.tarih.localeCompare(b.tarih)||a.raceId.localeCompare(b.raceId));
  const before:{r:FeatureRace;s:Ranked}[]=[],after:{r:FeatureRace;s:Ranked}[]=[];
  const races:BasketDevRace[]=[];
  for(const r of sorted){
    const b=rank(r,benchmark),c=rank(r,model);
    before.push({r,s:b});after.push({r,s:c});
    const b1=b.winnerRank===1,c1=c.winnerRank===1,
      b3=b.winnerRank<=3,c3=c.winnerRank<=3;
    rescuedTop1+=Number(!b1&&c1);newlyMissedTop1+=Number(b1&&!c1);
    rescuedTop3+=Number(!b3&&c3);newlyMissedTop3+=Number(b3&&!c3);
    changedRanks+=Number(b.winnerRank!==c.winnerRank);
    const classification:BasketDevRace["classification"]=
      !b1&&c1?"RESCUED_TOP1":b1&&!c1?"NEW_MISS_TOP1":
      !b3&&c3?"RESCUED_TOP3":b3&&!c3?"NEW_MISS_TOP3":
      b.winnerRank!==c.winnerRank?"WINNER_RANK_CHANGED":"UNCHANGED";
    races.push({raceId:r.raceId,date:r.tarih,winnerNo:r.winnerNo,
      runnerCount:r.vectors.length,
      baselineWinnerRank:b.winnerRank,candidateWinnerRank:c.winnerRank,
      baselineWinnerProbability:b.winnerProbability,
      candidateWinnerProbability:c.winnerProbability,
      baselineFavoriteProbability:b.favoriteProbability,
      candidateFavoriteProbability:c.favoriteProbability,
      baselineFavoriteNo:b.favoriteNo,candidateFavoriteNo:c.favoriteNo,
      classification});
  }
  const baseline=metrics(before),candidate=metrics(after);
  if(candidate.top1Hits-baseline.top1Hits!==rescuedTop1-newlyMissedTop1||
    candidate.top3Hits-baseline.top3Hits!==rescuedTop3-newlyMissedTop3)
    throw new Error("RAN_BASKET_DEV_RCA_ACCOUNTING_MISMATCH");
  return {
    status:"DIAGNOSTIC_ONLY_ALREADY_INSPECTED_DEV62",publicationGate:"BLOCKED",
    candidateCodes:[...artifact.codes],trainRaces:238,developmentRaces:62,
    baseline,candidate,
    paired:{rescuedTop1,newlyMissedTop1,rescuedTop3,newlyMissedTop3,
      changedRanks,netTop1:candidate.top1Hits-baseline.top1Hits,
      netTop3:candidate.top3Hits-baseline.top3Hits},
    races,
  };
}
