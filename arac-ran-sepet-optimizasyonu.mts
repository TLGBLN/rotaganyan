/**
 * ROTAGANYAN single unified engine from jointly learned SIGNAL BASKETS.
 * Exhaustive 36 singleton diagnostics + ALL 630 unordered pairs; global seeded
 * variable-size baskets, forward/backward/single/double swaps, full leave-one-out.
 * Every evaluated basket is FIT FROM SCRATCH on the identical 3 chronological
 * TRAIN-only folds. Full 2500-iteration confirmation + explicit Pareto gate.
 *
 * 2^36−1 subsets are not exhaustively evaluated. This is RESEARCH discovery:
 * no finalized unbiased winner rates or coupon ROI until future untouched
 * prospective data with time-stamped odds/payouts are independently replayed.
 * Neither past DEV-62 nor past October-60 is used in basket selection.
 */
import fs from "node:fs";
import {createHash} from "node:crypto";
import path from "node:path";
import {UNIFIED_MODEL_CODES} from "./src/lib/rotaganyan-analiz-motoru/unified-model-codes";
import {buildWalkFolds,validateTrainingOnly,evaluateCombination,allPairs,
  selectionKey,rankCombination,type CombinationResult,type FeatureRace}
  from "./src/lib/rotaganyan-analiz-motoru/rca/combinatorial-signal-selection";
import {auditScoreInflation} from "./src/lib/rotaganyan-analiz-motoru/rca/score-inflation-audit";
import {computeFeatureStats,fitModel}
  from "./src/lib/motor-v1/engine/training";
import {
  createDiverseBasketSeeds,basketNeighbours,basketParetoFront,
  chooseBasketFromConfirmation,validateBasketOptions,
  type BasketSearchOptions,DEFAULT_BASKET_SEARCH,
} from "./src/lib/rotaganyan-analiz-motoru/rca/basket-search";
import {PEDIGREE_V3_VERSION} from "./src/lib/rotaganyan-analiz-motoru/pedigree-v3/lineage-weighted";
type OriginalRace=FeatureRace&{pedigreeV2?:{version:string};pedigreeV3?:{version:string}};
function setting(name:string,def:number,min:number,max:number):number{
  const x=Number(process.env[name]??def);
  if(!Number.isSafeInteger(x)||x<min||x>max)
    throw new Error("RAN_BASKET_INVALID_OPTION_"+name);
  return x;
}
const DATA=process.env.RAN_BASKET_IN??"C:/tmp/ran-pit-20261025-pedigri-v3-300.json";
const OUT=process.env.RAN_BASKET_OUT??"C:/tmp/ran-pit-20261025-optimum-sinyal-sepeti";
const SEARCH:BasketSearchOptions={
  ...DEFAULT_BASKET_SEARCH,
  seed:setting("RAN_BASKET_SEED",20261025,0,2147483647),
  restartCount:setting("RAN_BASKET_RESTARTS",36,1,150),
  beamWidth:setting("RAN_BASKET_BEAM",6,1,40),
  rounds:setting("RAN_BASKET_ROUNDS",6,1,30),
  maxNeighbours:setting("RAN_BASKET_NEIGHBORS",160,10,2000),
  minSize:setting("RAN_BASKET_MIN_SIZE",1,1,36),
  maxSize:setting("RAN_BASKET_MAX_SIZE",36,1,36),
};
const ITER=setting("RAN_BASKET_SCREEN_ITER",500,5,2500);
const BUDGET=setting("RAN_BASKET_MAX_FITS",6000,750,50000);
const FINALISTS=setting("RAN_BASKET_FINALISTS",20,3,100);
const SOURCE_VERSION=process.env.RAN_BASKET_PEDIGREE_VERSION??PEDIGREE_V3_VERSION;
validateBasketOptions(SEARCH);
if(SOURCE_VERSION!==PEDIGREE_V3_VERSION)
  throw new Error("RAN_BASKET_ONLY_VALIDATED_FINAL_PEDIGREE_V3_SUPPORTED");
if(path.resolve(OUT).startsWith(path.resolve(process.cwd())+path.sep))
  throw new Error("RAN_BASKET_OUTPUT_MUST_STAY_OUTSIDE_REPOSITORY");
const read=():{train:OriginalRace[];fingerprint:string}=>{
  const bytes=fs.readFileSync(DATA);
  const sourceHash=createHash("sha256").update(bytes).digest("hex");
  const manifestPath=DATA+".manifest.json";
  if(!fs.existsSync(manifestPath))
    throw new Error("RAN_BASKET_V3_VERIFIED_SOURCE_MANIFEST_REQUIRED");
  const manifest=JSON.parse(fs.readFileSync(manifestPath,"utf8")) as {
    version?:string;sourceSha?:string;outputSha?:string;races?:number;
    trainingRaces?:number;developmentRaces?:number;
    everyHorseHasThreeLineages?:boolean;
  };
  if(manifest.version!==SOURCE_VERSION || manifest.outputSha!==sourceHash ||
     !/^[0-9a-f]{64}$/.test(manifest.sourceSha??"")||
     manifest.races!==300||manifest.trainingRaces!==238||
     manifest.developmentRaces!==62||
     manifest.everyHorseHasThreeLineages!==true)
    throw new Error("RAN_BASKET_V3_SOURCE_MANIFEST_SHA_OR_COUNT_MISMATCH");
  const rows:unknown=JSON.parse(bytes.toString("utf8"));
  if(!Array.isArray(rows)||rows.length!==300)
    throw new Error("RAN_BASKET_REQUIRES_COMPLETED_V3_300");
  const all=rows as OriginalRace[];
  const train=all.filter(x=>x.tarih>="2026-08-16"&&x.tarih<="2026-08-25")
    .sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.raceId.localeCompare(b.raceId));
  const dev=all.filter(x=>x.tarih>="2026-08-26"&&x.tarih<="2026-08-28");
  if(train.length!==238||dev.length!==62||new Set(all.map(x=>x.raceId)).size!==300)
    throw new Error("RAN_BASKET_COHORT_SPLIT_OR_DUPLICATE");
  validateTrainingOnly(train);
  for(const r of all){
    if(r.pedigreeV3?.version!==SOURCE_VERSION)
      throw new Error("RAN_BASKET_LINEAGE_SOURCE_VERSION_MISMATCH");
    for(const v of r.vectors){
      if(v.pedigreeScoringVersion!==SOURCE_VERSION)
        throw new Error("RAN_BASKET_RUNNER_LINEAGE_VERSION_MISMATCH");
    }
  }
  return {train,fingerprint:createHash("sha256").update(bytes).digest("hex")};
};
type Checkpoint={schema:2;sha:string;optionsFingerprint:string;
  results:Record<string,CombinationResult>};
function write(p:string,obj:unknown){
  fs.mkdirSync(path.dirname(p),{recursive:true});
  const temp=p+".tmp-"+process.pid;
  fs.writeFileSync(temp,JSON.stringify(obj,null,2));
  fs.renameSync(temp,p);
}
function print(r:CombinationResult){
  return r.codes.length+" sinyal | TOP1 "+r.top1Hits+"/"+r.n+
    " | TOP3 "+r.top3Hits+"/"+r.n+" | LogLoss "+r.logLoss.toFixed(5);
}
function shortlistForFullFit(results:CombinationResult[],
  full:CombinationResult,limit:number):CombinationResult[]{
  const sorted=[...results].sort(rankCombination);
  const pick=new Map<string,CombinationResult>();
  const add=(r:CombinationResult)=>pick.set(selectionKey(r.codes),r);
  add(full);
  // Represent the Pareto landscape instead of selecting ONLY the highest
  // scoring single pair or one greedy path.
  for(const r of basketParetoFront(sorted).slice(0,limit))add(r);
  for(const r of sorted.slice(0,limit))add(r);
  const bySize=new Map<number,CombinationResult>();
  for(const r of sorted){
    const size=r.codes.length;
    if(!bySize.has(size))bySize.set(size,r);
  }
  for(const r of [...bySize.values()].sort(rankCombination).slice(0,Math.min(12,limit)))add(r);
  return [...pick.values()];
}
async function main(){
  const {train,fingerprint}=read();
  const optionsFingerprint=createHash("sha256").update(JSON.stringify({
    search:SEARCH,iterations:ITER,budget:BUDGET,finalists:FINALISTS,
    version:SOURCE_VERSION,registry:UNIFIED_MODEL_CODES,lambda:90,lr:.25,
  })).digest("hex");
  const cpPath=OUT+".checkpoint.json";
  if(fs.existsSync(OUT+".candidate-model.json")||fs.existsSync(OUT+".report.json"))
    throw new Error("RAN_BASKET_RESULTS_ALREADY_EXIST: choose a new RAN_BASKET_OUT");
  let cp:Checkpoint;
  if(fs.existsSync(cpPath)){
    cp=JSON.parse(fs.readFileSync(cpPath,"utf8"));
    if(cp.schema!==2||cp.sha!==fingerprint||cp.optionsFingerprint!==optionsFingerprint)
      throw new Error("RAN_BASKET_CHECKPOINT_DATA_OR_OPTIONS_MISMATCH");
  }else cp={schema:2,sha:fingerprint,optionsFingerprint,results:{}};
  const folds=buildWalkFolds(train);
  const completed=()=>Object.keys(cp.results).length;
  let newFits=0,limitReached=false;
  const evalBasket=(codes:readonly string[]):CombinationResult|null=>{
    const key=selectionKey(codes);
    if(cp.results[key])return cp.results[key];
    if(completed()>=BUDGET){limitReached=true;return null;}
    const result=evaluateCombination(folds,codes,{
      lambda:90,learningRate:0.25,iterations:ITER,
    });
    cp.results[key]=result;newFits++;
    if(newFits%20===0){
      write(cpPath,cp);
      console.log("[RAN_BASKET] "+completed()+"/"+BUDGET+" tested baskets; newest size="+codes.length);
    }
    return result;
  };
  const requireBasket=(codes:readonly string[])=>{
    const r=evalBasket(codes);
    if(!r)throw new Error("RAN_BASKET_INSUFFICIENT_BUDGET_FOR_MANDATORY_CONTROLS");
    return r;
  };
  const all=UNIFIED_MODEL_CODES,full=requireBasket(all);
  console.log("[RAN_BASKET] Original 238 PIT TRAIN, 3 chronological inner folds. 62 DEV not used.");
  console.log("[RAN_BASKET] 36 independent singles and 630 pairs for DIAGNOSIS ONLY: they NEVER veto a feature.");
  console.log("[RAN_BASKET] All-source full36, leave-one-out, random global baskets, block-add/remove/swap.");
  console.log("[RAN_BASKET] Using version="+SOURCE_VERSION+" | resume="+completed()+
    " | max fits="+BUDGET+" | simulation ROI NOT VERIFIED; publication=BLOCKED");
  for(const code of all)requireBasket([code]);
  for(const pair of allPairs(all))requireBasket(pair);
  console.log("[RAN_BASKET] 36 singles and 630 pairs completed. No single-feature elimination decisions.");
  const seeds=createDiverseBasketSeeds(all,SEARCH);
  for(const s of seeds){if(limitReached)break;evalBasket(s);}
  write(cpPath,cp);
  // Search variable basket sizes; frontier is diversified by size. A basket
  // can be revisited/replaced via 2-feature block moves even when a singleton
  // appears worthless by itself.
  const visited=new Set<string>();
  let beam=seeds.map(s=>cp.results[selectionKey(s)]).filter(Boolean)
    .sort(rankCombination).slice(0,SEARCH.beamWidth);
  for(let round=0;round<SEARCH.rounds&&!limitReached;round++){
    const frontier:CombinationResult[]=[...beam];
    // Separate independent restarts diversify the basin of attraction.
    const start=(round*SEARCH.beamWidth)%Math.max(1,seeds.length);
    for(const s of seeds.slice(start,start+SEARCH.beamWidth)){
      const r=cp.results[selectionKey(s)];
      if(r&&!frontier.includes(r))frontier.push(r);
    }
    const newCandidates:CombinationResult[]=[];
    for(const parent of frontier){
      const parentKey=selectionKey(parent.codes);
      if(visited.has(parentKey))continue;
      visited.add(parentKey);
      const moves=basketNeighbours(parent.codes,SEARCH,
        (SEARCH.seed+round*7919+parent.codes.length*997)>>>0);
      for(const move of moves){
        const r=evalBasket(move);
        if(r)newCandidates.push(r);
        if(limitReached)break;
      }
      if(limitReached)break;
    }
    if(newCandidates.length===0)break;
    const allRanked=[...new Map([...beam,...newCandidates].map(r=>[r.id,r])).values()]
      .sort(rankCombination);
    beam=allRanked.slice(0,SEARCH.beamWidth);
    const best=allRanked[0];
    console.log("[RAN_BASKET] round="+(round+1)+"/"+SEARCH.rounds+
      " tested="+completed()+" best="+print(best)+" selectedForSearchOnly=true");
    write(cpPath,cp);
  }
  // Multiple basket sizes, high-scoring seeds, broad Pareto frontier and
  // the original full model all undergo IDENTICAL 2500-iteration confirmation.
  const screened=Object.values(cp.results);
  const confirmedList=shortlistForFullFit(screened,full,FINALISTS);
  const confirmed=confirmedList.map(r=>evaluateCombination(
    folds,r.codes,{lambda:90,learningRate:0.25,iterations:2500},
  ));
  const fullConfirmed=confirmed.find(r=>r.codes.length===36)!;
  const chosen=chooseBasketFromConfirmation(confirmed,fullConfirmed);
  const candidate=chosen.selected;
  const selectedScoreAudit=auditScoreInflation(
    folds,candidate.codes,{lambda:90,learningRate:0.25,iterations:2500});
  const fullScoreAudit=auditScoreInflation(
    folds,all,{lambda:90,learningRate:0.25,iterations:2500});
  const report={
    version:"RAN_SIGNAL_BASKET_DISCOVERY_V1",engineInputVersion:SOURCE_VERSION,
    sourceFile:DATA,sourceSHA256:fingerprint,optionsFingerprint,config:SEARCH,
    screeningIterations:ITER,fullConfirmationIterations:2500,
    trainingRaces:238,validationRaces:folds.reduce((n,f)=>n+f.validation.length,0),
    devUsedForSelection:0,previousOctoberUsedForSelection:0,
    totalPossibleNonemptyBaskets:(2n**36n-1n).toString(),
    evaluatedUniqueBaskets:completed(),exhaustivePairs:630,exhaustiveSingles:36,
    searchBudget:BUDGET,budgetReached:limitReached,globalSeedCount:seeds.length,
    searchIsExhaustive:false,
    folds:folds.map(f=>({id:f.id,train:f.train.length,validation:f.validation.length,
      trainEnd:f.train[f.train.length-1]?.tarih,validationStart:f.validation[0]?.tarih})),
    chosenStatus:chosen.status,reason:chosen.reason,
    full36:fullConfirmed,
    confirmedBaskets:confirmed.sort(rankCombination),
    pareto:chosen.front,
    chosen: candidate,
    selectedScoreInflation:selectedScoreAudit,fullScoreInflation:fullScoreAudit,
    scoringRule:"Joint refit per basket; 2*Top1+Top3 - 0.12*LogLoss - 0.003*size; joint no-regression TOP1/TOP3 plus LogLoss<=full+0.02",
    roiStatus:"NOT_VERIFIED_NO_IMMUTABLE_PRE_RACE_MARKET_AND_PAYOUT_EVIDENCE",
    modelSelectionBias:"HIGH: same 3 inner folds used for many baskets; re-fit 2500 on SAME folds. Needs an entirely unseen prospective chronological cohort.",
    publicationGate:"BLOCKED",
    limitations:[
      "Only 36 PIT-audited canonical features exist in this source. Alternative/blocked signal variants are NOT tested.",
      "2^36−1 baskets are impossible to enumerate here; search is exhaustive for singles/pairs only, diverse/heuristic for higher orders.",
      "All winners used for selection are the original 238 TRAIN race period only; published TOP1/TOP3 require a future unseen holdout.",
      "Payout/ROI model-selection is not possible without trustworthy timestamped pre-race odds, coupon costs and payout/settlement records.",
      "A positive historical combination search score does not prove independent out-of-sample efficiency.",
    ],
  };
  const stats=computeFeatureStats(train.flatMap(r=>r.vectors),candidate.codes);
  const model=fitModel(train.map(r=>({
    raceId:r.raceId,date:new Date(r.tarih+"T00:00:00Z"),
    winnerNo:r.winnerNo,vectors:r.vectors,
  })),stats,{lambda:90,learningRate:0.25,iterations:2500});
  if(model.nRacesUsed!==238||model.nRacesSkipped!==0||
    model.beta.length!==2*candidate.codes.length||model.beta.some(x=>!Number.isFinite(x)))
    throw new Error("RAN_BASKET_FINAL_FIT_INVALID");
  const artifact={
    artifactType:"RAN_BASKET_SHADOW_UNPUBLISHED",modelVersion:"RAN_SIGNAL_BASKET_DISCOVERY_V1",
    publicationGate:"BLOCKED",engineInputVersion:SOURCE_VERSION,
    sourceSHA256:fingerprint,configSHA256:optionsFingerprint,
    selectedBy:"MULTI_START_MULTI_SIZE_JOINT_BASKET_RETRAIN_238_INNER_WALK_FORWARD",
    codes:candidate.codes,model:{beta:model.beta,names:model.names,
      stats:[...model.stats.entries()],opts:model.opts,
      nRacesUsed:model.nRacesUsed,nRacesSkipped:model.nRacesSkipped},
    releaseNote:"No independent unseen validation, no verified ROI. Do not replace canonical artifacts.",
  };
  write(cpPath,cp);
  write(OUT+".report.json",report);
  write(OUT+".candidate-model.json",artifact);
  fs.writeFileSync(OUT+".md",[
    "# ROTAGANYAN — EN VERİMLİ SİNYAL SEPETİ ARAŞTIRMASI",
    "","**Yayın: BLOCKED.** Sinyal tekli sıralaması motor seçimi değildir.",
    "Kaynak: "+DATA,
    "Veri SHA256: "+fingerprint,
    "Veri: 238 PIT eğitim yarışı, 3 ileri kronolojik iç doğrulama; 62 DEV ve eski Ekim sonuçları seçime katılmadı.",
    "İncelenen 36 sinyalin "+(2n**36n-1n).toString()+" olası dolu alt kümesinin "+completed()+
      " adedi tarandı. Bu **tüm kombinasyonların eksiksiz taranması değildir.**",
    "36 tekli + 630 çift, bütünlenmiş model + 35'li çıkarmalar + çoklu random/boyut/ikili blok mutasyonları.",
    "Hızlı tarama: "+ITER+" iterasyon; son "+confirmed.length+" sepet: 2500 iterasyon.",
    "","## Tam sepet kıyası",
    "- 36 sinyal birden: "+print(fullConfirmed),
    "- Araştırma adayı: "+print(candidate),
    "- Durum: "+chosen.status,
    "- Sebep: "+chosen.reason,
    "- Son sepet: "+candidate.codes.join(", "),
    "","## Çapraz doğrulama / aşırı iyimser olasılık",
    "- Seçilen sepet ECE: "+(100*selectedScoreAudit.ece).toFixed(2)+" yüzde puanı",
    "- Tam model ECE: "+(100*fullScoreAudit.ece).toFixed(2)+" yüzde puanı",
    "- Seçilen sepette >=80% güvenle yanlış favori: "+selectedScoreAudit.highConfidence80.incorrect,
    "","## Son doğrulanan adaylar",
    "| Sinyal sayısı | TOP1 | TOP3 | LogLoss | Sepet |",
    "|---:|---:|---:|---:|---|",
    ...confirmed.sort(rankCombination).map(r=>"| "+r.codes.length+" | "+
      r.top1Hits+"/"+r.n+" | "+r.top3Hits+"/"+r.n+" | "+r.logLoss.toFixed(4)+
      " | "+r.codes.join(", ")+" |"),
    "","## Güvenlik ve yayın kararı",
    ...report.limitations.map(x=>"- "+x),
    "Kârlılık/ROI: NOT_VERIFIED. Hiçbir üretim dosyası değiştirilmedi.",
  ].join("\n")+"\n");
  console.log("[RAN_BASKET] FINISHED screened="+completed()+" confirmed="+confirmed.length+
    " selected="+print(candidate)+" gate="+chosen.status+" Publication=BLOCKED.");
  console.log("[RAN_BASKET] result="+OUT+".md; shadow="+OUT+".candidate-model.json");
}
main().catch(e=>{
  console.error("[RAN_BASKET] FAIL "+(e instanceof Error?e.message:String(e)));
  process.exitCode=1;
});
