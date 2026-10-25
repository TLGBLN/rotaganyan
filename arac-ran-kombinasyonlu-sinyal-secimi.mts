// RAN v1.0 — full 36 singles + 630 pairs + bounded multi-feature combination search.
// Uses ONLY 238 PIT-recomputed TRAIN races, with 3 strictly chronological inner folds.
// NEVER reads development=62, previous acceptance=60, DB, AGF or production artifacts.
// Result is a DIAGNOSTIC/SHADOW model, NOT a deployable winner-tuned artifact.
import fs from "node:fs";
import { createHash } from "node:crypto";
import { dirname } from "node:path";
import { computeFeatureStats, fitModel } from "./src/lib/motor-v1/engine/training";
import { UNIFIED_MODEL_CODES } from "./src/lib/rotaganyan-analiz-motoru/unified-model-codes";
import { SIGNAL_SPECS } from "./src/lib/rotaganyan-analiz-motoru/signal-integration";
import {
  allPairs, buildWalkFolds, classifyPair, evaluateCombination, rankCombination,
  selectionKey, sourceAlternativeLimitations, validateTrainingOnly,
  type CombinationResult, type PairResult, type FeatureRace,
} from "./src/lib/rotaganyan-analiz-motoru/rca/combinatorial-signal-selection";

const SOURCE=process.env.RAN_COMBO_DATA ?? "C:/tmp/ran-pit-20261025-train-dev.json";
const PREFIX=process.env.RAN_COMBO_OUT ?? "C:/tmp/ran-pit-20261025-kombinasyon";
const ITER=positiveInt("RAN_COMBO_ITERATIONS",500,5,2500);
const WIDTH=positiveInt("RAN_COMBO_BEAM_WIDTH",4,1,12);
const MAX_SIZE=positiveInt("RAN_COMBO_MAX_SIGNALS",10,3,36);
const opts={lambda:90,learningRate:0.25,iterations:ITER};
const key=(codes:readonly string[])=>selectionKey(codes);
type Checkpoint = {
  schema:1;sourceHash:string;configHash:string;
  results:Record<string,CombinationResult>;
};
function positiveInt(name:string,fallback:number,min:number,max:number) {
  const n=Number(process.env[name]??fallback);
  if(!Number.isSafeInteger(n)||n<min||n>max)throw new Error("RAN_COMBO_INVALID_OPTION "+name);
  return n;
}
function saveAtomic(p:string,obj:unknown) {
  fs.mkdirSync(dirname(p),{recursive:true});
  const temp=p+".tmp-"+process.pid;
  fs.writeFileSync(temp,JSON.stringify(obj,null,2));
  fs.renameSync(temp,p);
}
function readData(): {rows:FeatureRace[];sha:string} {
  const bytes=fs.readFileSync(SOURCE,"utf8");
  const all:unknown=JSON.parse(bytes);
  if(!Array.isArray(all) || all.length!==300)throw new Error("RAN_COMBO_ORIGINAL_300_REQUIRED");
  const full=all as FeatureRace[];
  const train=full.filter(r=>r.tarih>="2026-08-16"&&r.tarih<="2026-08-25")
    .sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.raceId.localeCompare(b.raceId));
  const dev=full.filter(r=>r.tarih>="2026-08-26"&&r.tarih<="2026-08-28");
  if(train.length!==238||dev.length!==62||new Set(all.map(x=>(x as FeatureRace)?.raceId)).size!==300)
    throw new Error("RAN_COMBO_SPLIT_OR_DUPLICATE: only original 238/62 300-race set");
  validateTrainingOnly(train);
  return {rows:train,sha:createHash("sha256").update(bytes).digest("hex")};
}
function correlations(rows:readonly FeatureRace[],codes:readonly string[]) {
  const r=rows.flatMap(x=>x.vectors),map=new Map<string,{rho:number,n:number}>();
  for(const [a,b] of allPairs(codes)){
    const xs:number[]=[],ys:number[]=[];
    for(const v of r){
      const aa=v.signals.find(s=>s.code===a),bb=v.signals.find(s=>s.code===b);
      if(aa?.observed&&bb?.observed&&aa.rawValue!==null&&bb.rawValue!==null){
        xs.push(aa.rawValue);ys.push(bb.rawValue);
      }
    }
    if(xs.length<30)continue;
    let sx=0,sy=0,sxx=0,syy=0,sxy=0;
    for(let i=0;i<xs.length;i++){sx+=xs[i];sy+=ys[i];sxx+=xs[i]*xs[i];syy+=ys[i]*ys[i];sxy+=xs[i]*ys[i];}
    const d=Math.sqrt(Math.max(0,xs.length*sxx-sx*sx)*Math.max(0,xs.length*syy-sy*sy));
    if(d>1e-12){
      const rho=(xs.length*sxy-sx*sy)/d;
      map.set(key([a,b]),{rho,n:xs.length});
    }
  }
  return map;
}
function compact(r:CombinationResult) {
  return {codes:r.codes,top1:r.top1,top3:r.top3,top1Hits:r.top1Hits,top3Hits:r.top3Hits,
    n:r.n,logLoss:r.logLoss,score:r.score,folds:r.foldResults.map(f=>({id:f.fold,top1Hits:f.top1Hits,top3Hits:f.top3Hits,n:f.n}))};
}
async function main(){
  const {rows,sha}=readData();
  const folds=buildWalkFolds(rows);
  const optsString=JSON.stringify({schema:1,sha,opts,width:WIDTH,maxSize:MAX_SIZE,codes:UNIFIED_MODEL_CODES});
  const cfg=createHash("sha256").update(optsString).digest("hex");
  const cpPath=PREFIX+".checkpoint.json";
  let state:Checkpoint;
  if(fs.existsSync(cpPath)){
    state=JSON.parse(fs.readFileSync(cpPath,"utf8")) as Checkpoint;
    if(state.schema!==1||state.sourceHash!==sha||state.configHash!==cfg)
      throw new Error("RAN_COMBO_CHECKPOINT_MISMATCH: choose a NEW RAN_COMBO_OUT; never combine results from different datasets/options");
  }else state={schema:1,sourceHash:sha,configHash:cfg,results:{}};
  console.log("[RAN_COMBO] PIT TRAIN=238, chronology=3 folds; 62 DEV and 60 acceptance NEVER read for selection.");
  console.log("[RAN_COMBO] 36 singles + 630 exhaustive pairs + beam multi-feature forward/backward swaps.");
  console.log("[RAN_COMBO] iter="+ITER+" width="+WIDTH+" maxSize="+MAX_SIZE+" resume="+Object.keys(state.results).length+" saved. Publication=BLOCKED.");
  const corr=correlations(rows,UNIFIED_MODEL_CODES);
  let newly=0;
  const evalCached=(codes:readonly string[])=>{
    const id=key(codes),ex=state.results[id];
    if(ex)return ex;
    const result=evaluateCombination(folds,codes,opts);
    state.results[id]=result;
    newly++;
    if(newly%20===0){
      saveAtomic(cpPath,state);
      console.log("[RAN_COMBO] complete="+Object.keys(state.results).length+" last="+id);
    }
    return result;
  };
  const all=UNIFIED_MODEL_CODES;
  const singles=new Map(all.map(x=>[x,evalCached([x])]));
  saveAtomic(cpPath,state);
  console.log("[RAN_COMBO] singles=36 complete. Starting ALL 630 pair refits.");
  const pairResults:PairResult[]=[];
  for(const [a,b] of allPairs(all)){
    const both=evalCached([a,b]);
    const c=corr.get(key([a,b]));
    const structural=([
      "FIELD_WEIGHT_DELTA+WEIGHT_DISTANCE",
      "FIELD_WEIGHT_DELTA+WEIGHT_HANDICAP",
      "FORM_LEVEL+SURFACE_FORM",
      "SPEED+RIVAL_GAP",
      "SPEED+ACC_SPEED",
      "JOCKEY_OE30+JOCKEY_TREND30",
    ] as string[]).includes(key([a,b]))?"shared source / interaction (review)":null;
    pairResults.push(classifyPair(both,singles.get(a)!,singles.get(b)!,
      c!=null&&Math.abs(c.rho)>=0.80,structural));
  }
  saveAtomic(cpPath,state);
  console.log("[RAN_COMBO] all 630 pairs complete. Starting selected triple+ expansions.");
  const allPairsRanked=pairResults.map(p=>p.pair).sort(rankCombination);
  const v1=new Set(SIGNAL_SPECS.filter(s=>s.source==="V1" &&
      (s.decision==="INCLUDE"||s.decision==="PRIMARY")).map(s=>s.canonical));
  const d=new Set(SIGNAL_SPECS.filter(s=>s.source==="D" &&
      (s.decision==="INCLUDE"||s.decision==="PRIMARY")).map(s=>s.canonical));
  // Search over both D and V1 source groups; if no complement proves value,
  // report no approved merged model rather than silently promoting a D-only win.
  let beam=allPairsRanked.slice(0,WIDTH);
  let best=beam[0];
  let stagnant=0;
  for(let size=3;size<=MAX_SIZE;size++){
    const proposals=new Map<string,string[]>();
    for(const parent of beam){
      for(const code of all){
        if(parent.codes.includes(code))continue;
        const codes=all.filter(x=>parent.codes.includes(x)||x===code);
        proposals.set(key(codes),codes);
      }
    }
    const candidates=[...proposals.values()].map(evalCached).sort(rankCombination);
    const next=candidates.slice(0,WIDTH);
    if(next.length===0)break;
    beam=next;
    if(rankCombination(next[0],best)<0){best=next[0];stagnant=0;}
    else stagnant++;
    console.log("[RAN_COMBO] beam size="+size+" winner="+best.id+
      " Top1="+best.top1Hits+"/"+best.n+" Top3="+best.top3Hits+"/"+best.n+
      " patience="+stagnant);
    saveAtomic(cpPath,state);
    if(stagnant>=2)break;
  }
  // Search local replacements: weaker overlapping features can be SWAPPED OUT.
  let current=best;
  for(let iter=0;iter<2;iter++){
    const alternatives=new Map<string,string[]>();
    for(const drop of current.codes){
      for(const incoming of all){
        if(current.codes.includes(incoming))continue;
        const codes=all.filter(x=>x!==drop&&(current.codes.includes(x)||x===incoming));
        alternatives.set(key(codes),codes);
      }
    }
    if(alternatives.size===0)break;
    const next=[...alternatives.values()].map(evalCached).sort(rankCombination)[0];
    if(!next || rankCombination(next,current)>=0)break;
    current=next;
    console.log("[RAN_COMBO] localSWAP winner="+current.id+" Top1="+current.top1Hits+" Top3="+current.top3Hits);
    saveAtomic(cpPath,state);
  }
  const familyModel=(codes:string[])=>evalCached(codes);
  const dOnly=familyModel(all.filter(x=>d.has(x)));
  const v1Only=familyModel(all.filter(x=>v1.has(x)));
  const full=familyModel(all);
  const joint= current.codes.some(x=>d.has(x))&&current.codes.some(x=>v1.has(x));
  // Inner-fold selection is only a candidate, never a released motor.
  const improvesD=joint && current.top1Hits>=dOnly.top1Hits &&
    current.top3Hits>=dOnly.top3Hits && current.logLoss<=dOnly.logLoss+0.02 &&
    (current.top1Hits>dOnly.top1Hits || current.top3Hits>dOnly.top3Hits ||
     current.logLoss<dOnly.logLoss-0.01);
  const status=improvesD?"COMBINED_RESEARCH_CANDIDATE":"NO_VERIFIED_D_V1_COMPLEMENT";
  const pairTable=pairResults.map(p=>({
    a:p.a,b:p.b,correlation:corr.get(key([p.a,p.b]))??null,
    stronger:p.stronger,weaker:p.weaker,status:p.status,
    bothVersusBest:p.bothVersusBest,metrics:compact(p.pair),
  })).sort((a,b)=>rankCombination(state.results[key([a.a,a.b])],state.results[key([b.a,b.b])]));
  const fullReport={
    reportVersion:1,source:SOURCE,sourceHash:sha,trainingRaces:238,developmentUsedForSelection:0,
    acceptanceUsedForSelection:0,trainRange:["2026-08-16","2026-08-25"],
    fitOptions:opts,innerFolds:folds.map(f=>({id:f.id,train:f.train.length,validation:f.validation.length,
      trainEnd:f.train[f.train.length-1]?.tarih,validationStart:f.validation[0]?.tarih})),
    objective:"2*Top1 + Top3 - 0.12*LogLoss - 0.003*featureCount; includes 3 chronological folds; research-only",
    singleCount:singles.size,pairCount:pairTable.length,totalRefits:Object.keys(state.results).length,
    singles:[...singles.values()].sort(rankCombination).map(compact),
    pairs:pairTable, highCorrelation:pairTable.filter(p=>p.correlation&&Math.abs(p.correlation.rho)>=0.8),
    full36:compact(full),dOnly:compact(dOnly),v1Only:compact(v1Only),
    selected:compact(current),sourceMix:{d:current.codes.filter(x=>d.has(x)),v1:current.codes.filter(x=>v1.has(x))},
    combinedGate:status,publicationGate:"BLOCKED",evidence:"INTERNAL_WALK_FORWARD_DIAGNOSTIC_ONLY",
    unavailableSignals:sourceAlternativeLimitations(),blockedReasons:[
      "Source roster contains alternatives/blocked formulas not present in the 36-signal JSON; do not claim evaluated.",
      "All selections are made on chronological inner TRAIN folds, but reusing these folds for beam search risks overfitting.",
      "August DEV-62 and previous October acceptance-60 have been inspected; neither is a fresh untouched publication test.",
      "No source feature archive has independently verifiable as-of capture timestamps; live prospective parity unverified.",
    ],
  };
  saveAtomic(cpPath,state);
  saveAtomic(PREFIX+".json",fullReport);
  const money= (r:CombinationResult)=>"Top1 "+r.top1Hits+"/"+r.n+" ("+(100*r.top1).toFixed(2)+"%); Top3 "+r.top3Hits+"/"+r.n+" ("+(100*r.top3).toFixed(2)+"%); LL "+r.logLoss.toFixed(5);
  fs.writeFileSync(PREFIX+".md",[
    "# RAN v1.0 — Her sinyal + tüm ikili + çoklu kombinasyon denetimi",
    "",
    "**Yayın: BLOCKED.** Bu yalnız iç kronolojik seçim taramasıdır.",
    "",
    "Kaynak: "+SOURCE,
    "SHA256: "+sha,
    "Eğitim: 238 yarış. Seçimde kullanılan DEV: 0; eski kabul: 0.",
    "Üç kronolojik katlama, eğitim geçmişi daima doğrulama tarihinden önce.",
    "",
    "## Çapraz kaynak karşılaştırması",
    "- D sinyalleri: "+money(dOnly),
    "- V1 sinyalleri: "+money(v1Only),
    "- 36'lı birleşik: "+money(full),
    "- Kombinasyon araması: "+money(current),
    "- Karar: "+status,
    "- Seçilen (yalnız aday) "+current.codes.length+" sinyal: "+current.codes.join(", "),
    "",
    "## Yüksek örtüşmeli çiftler (silme kararı DEĞİL)",
    "| A | B | Pearson | Daha güçlü tekli | İkilinin ek TOP1 | İkilinin ek TOP3 | Karar |",
    "|---|---|---:|---|---:|---:|---|",
    ...pairTable.filter(x=>x.correlation&&Math.abs(x.correlation.rho)>=0.8).map(p=>
      "| "+p.a+" | "+p.b+" | "+p.correlation!.rho.toFixed(3)+
      " | "+p.stronger+" | "+p.bothVersusBest.top1Hits+" | "+p.bothVersusBest.top3Hits+" | "+p.status+" |"),
    "",
    "## Tüm tekli deneyler (iç kronolojik doğrulama)",
    "| Sinyal | TOP1 | TOP3 | LogLoss |",
    "|---|---:|---:|---:|",
    ...[...singles.values()].sort(rankCombination).map(r=>
      "| "+r.codes[0]+" | "+r.top1Hits+"/"+r.n+" | "+r.top3Hits+"/"+r.n+" | "+r.logLoss.toFixed(4)+" |"),
    "",
    "## Eksik alternatifler / kısıtlar",
    ...fullReport.blockedReasons.map(x=>"- "+x),
    "",
    "Tüm 630 çiftin detayları JSON raporunda. 2^36 kombinasyonun tamamını denemek pratik değildir;",
    "tüm ikililerden sonra üst kombinasyonlar beam + çıkarma/yerine koyma ile araştırıldı.",
    "Bu tarama yeni motoru otomatik yayına almaz veya kanonik model dosyasını değiştirmez.",
  ].join("\n")+"\n");
  console.log("[RAN_COMBO] COMPLETE singles="+singles.size+" pairs="+pairTable.length+
    " refits="+Object.keys(state.results).length+" gate="+status+" publication=BLOCKED");
  console.log("[RAN_COMBO] D_ONLY "+money(dOnly));
  console.log("[RAN_COMBO] FULL_36 "+money(full));
  console.log("[RAN_COMBO] SELECTED "+current.codes.join(",")+" => "+money(current));
  console.log("[RAN_COMBO] report="+PREFIX+".md + .json; original weights untouched");
}
main().catch(e=>{
  console.error("[RAN_COMBO] FAIL: "+(e instanceof Error?e.message:String(e)));
  process.exitCode=1;
});
