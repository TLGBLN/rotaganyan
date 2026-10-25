// ROTAGANYAN frozen signal basket vs full-36: already-known DEV-62 diagnosis.
// NO basket switching / RETUNING / DB calls / production changes.
import fs from "node:fs";
import path from "node:path";
import {createHash} from "node:crypto";
import {UNIFIED_MODEL_CODES} from "./src/lib/rotaganyan-analiz-motoru/unified-model-codes";
import {selectionKey,type FeatureRace} from "./src/lib/rotaganyan-analiz-motoru/rca/combinatorial-signal-selection";
import {auditFrozenBasketDev62,type FrozenBasketArtifact}
  from "./src/lib/rotaganyan-analiz-motoru/rca/basket-dev62-audit";
import {PEDIGREE_V3_VERSION}
  from "./src/lib/rotaganyan-analiz-motoru/pedigree-v3/lineage-weighted";

const SRC=process.env.RAN_DEV_AUDIT_IN??"C:/tmp/ran-pit-20261025-pedigri-v3-300.json";
const PREFIX=process.env.RAN_DEV_AUDIT_BASKET_PREFIX??"C:/tmp/ran-pit-20261025-optimum-sinyal-sepeti";
const OUT=process.env.RAN_DEV_AUDIT_OUT??"C:/tmp/ran-pit-20261025-sepet-dev62-denetim";
function main(){
  if(fs.existsSync(OUT+".json")||fs.existsSync(OUT+".md"))
    throw new Error("RAN_BASKET_DEV_AUDIT_OUTPUT_ALREADY_EXISTS: choose new OUT");
  const bytes=fs.readFileSync(SRC);
  const sha=createHash("sha256").update(bytes).digest("hex");
  const manifest=JSON.parse(fs.readFileSync(SRC+".manifest.json","utf8")) as {
    version:string;outputSha:string;trainingRaces:number;
    developmentRaces:number;everyHorseHasThreeLineages:boolean;
  };
  if(manifest.version!==PEDIGREE_V3_VERSION||manifest.outputSha!==sha||
     manifest.trainingRaces!==238||manifest.developmentRaces!==62||
     !manifest.everyHorseHasThreeLineages)
    throw new Error("RAN_BASKET_DEV_V3_DATA_OR_SHA_MISMATCH");
  const artifact=JSON.parse(fs.readFileSync(PREFIX+".candidate-model.json","utf8")) as FrozenBasketArtifact;
  const search=JSON.parse(fs.readFileSync(PREFIX+".report.json","utf8")) as {
    publicationGate:string;sourceSHA256:string;devUsedForSelection:number;
    confirmedBaskets:{codes:string[]}[];chosen:{codes:string[]};
    trainingRaces:number;engineInputVersion:string;
  };
  if(search.publicationGate!=="BLOCKED"||search.sourceSHA256!==sha ||
    search.engineInputVersion!==PEDIGREE_V3_VERSION||
    search.devUsedForSelection!==0||search.trainingRaces!==238 ||
    selectionKey(search.chosen.codes)!==selectionKey(artifact.codes) ||
    !search.confirmedBaskets.some(c=>selectionKey(c.codes)===selectionKey(artifact.codes)))
    throw new Error("RAN_BASKET_DEV_CANDIDATE_NOT_FROZEN_FROM_SEARCH");
  const all=JSON.parse(bytes.toString("utf8")) as FeatureRace[];
  if(all.length!==300||new Set(all.map(r=>r.raceId)).size!==300)
    throw new Error("RAN_BASKET_DEV_BAD_300_SOURCE");
  const train=all.filter(r=>r.tarih>="2026-08-16"&&r.tarih<="2026-08-25");
  const dev=all.filter(r=>r.tarih>="2026-08-26"&&r.tarih<="2026-08-28");
  if(train.some(r=>r.vectors.some(v=>v.signals.length!==UNIFIED_MODEL_CODES.length))||
    dev.some(r=>r.vectors.some(v=>v.signals.length!==UNIFIED_MODEL_CODES.length)))
    throw new Error("RAN_BASKET_DEV_INVALID_CANONICAL_VECTOR");
  console.log("[RAN_BASKET_DEV] Exactly frozen 238-fit candidate against fair 238-fit full36; 62 previously inspected DEV race IDs.");
  const audit=auditFrozenBasketDev62(train,dev,artifact,sha);
  const result={...audit,sourceSHA256:sha,
    candidateSource:"FROZEN_6000_BASKET_SEARCH",
    verificationLimits:[
      "This DEV62 has been inspected historically. Not untouched acceptance.",
      "Never use this outcome to choose a different basket, tune lambda, or adjust features.",
      "A basket found from 6000 searched subsets on 145 internal race IDs has significant winner-selection optimism.",
      "No verified PIT odds, ticket budget or payout; racing ROI is NOT_VERIFIED.",
      "Independent future chronological prospective validation required before any production.",
    ]};
  fs.mkdirSync(path.dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT+".json",JSON.stringify(result,null,2));
  const pct=(n:number,d:number)=>(100*n/d).toFixed(2)+"%";
  const row=(s:typeof audit.baseline,which:string)=>
    "| "+which+" | "+s.top1Hits+"/"+s.n+" ("+pct(s.top1Hits,s.n)+")"+
    " | "+s.top3Hits+"/"+s.n+" ("+pct(s.top3Hits,s.n)+")"+
    " | "+s.top6Hits+"/"+s.n+" | "+s.logLoss.toFixed(5)+
    " | "+s.brier.toFixed(5)+" | "+(100*s.favoriteEce5).toFixed(2)+" pp"+
    " | "+s.wrong80+" | "+s.wrong90+" |";
  const md=[
    "# ROTAGANYAN — 6000 sepet arasından seçilen modelin DEV62 tanısal karşılaştırması",
    "**Yayın: BLOCKED. DEV62 önceden incelenmiştir; bakir test değildir.**",
    "Seçilen "+artifact.codes.length+" sinyal: "+artifact.codes.join(", "),
    "Kaynak SHA256: "+sha,
    "",
    "## Aynı 62 yarış — ayrı katsayılarla ama AYNI 238 eğitim verisi",
    "| Motor | TOP-1 | TOP-3 | TOP-6 | LogLoss | Multi-class Brier | Favori ECE | Yanlış >=80% | Yanlış >=90% |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    row(audit.baseline,"36 sinyal"),
    row(audit.candidate,"Seçilmiş sepet"),
    "",
    "## Aynı yarışlarda kazanan kurtarma / yeni kaçırma",
    "- TOP-1 kurtarılan: "+audit.paired.rescuedTop1+"; yeni kaçan: "+audit.paired.newlyMissedTop1+
    "; net: "+audit.paired.netTop1,
    "- TOP-3 kurtarılan: "+audit.paired.rescuedTop3+"; yeni kaçan: "+audit.paired.newlyMissedTop3+
    "; net: "+audit.paired.netTop3,
    "- Kazanan sırası değişen yarış: "+audit.paired.changedRanks,
    "",
    "| Tarih | Yarış ID | Kazanan at no | 36'lı sıra | Sepet sıra | 36'lı P(kazanan) | Sepet P(kazanan) | Etki |",
    "|---|---|---:|---:|---:|---:|---:|---|",
    ...audit.races.map(r=>"| "+r.date+" | "+r.raceId+" | "+r.winnerNo+
      " | "+r.baselineWinnerRank+" | "+r.candidateWinnerRank+
      " | "+pct(r.baselineWinnerProbability*100,100)+
      " | "+pct(r.candidateWinnerProbability*100,100)+
      " | "+r.classification+" |"),
    "",
    "## Sınırlar",
    ...result.verificationLimits.map(x=>"- "+x),
  ];
  fs.writeFileSync(OUT+".md",md.join("\n")+"\n");
  console.log("[RAN_BASKET_DEV] BASE 36 TOP1="+audit.baseline.top1Hits+"/62 TOP3="+audit.baseline.top3Hits+"/62 LL="+audit.baseline.logLoss.toFixed(5));
  console.log("[RAN_BASKET_DEV] CANDIDATE "+audit.candidateCodes.length+
    " TOP1="+audit.candidate.top1Hits+"/62 TOP3="+audit.candidate.top3Hits+
    "/62 LL="+audit.candidate.logLoss.toFixed(5));
  console.log("[RAN_BASKET_DEV] PAIRED TOP1 rescued="+audit.paired.rescuedTop1+" lost="+audit.paired.newlyMissedTop1+
    " TOP3 rescued="+audit.paired.rescuedTop3+" lost="+audit.paired.newlyMissedTop3);
  console.log("[RAN_BASKET_DEV] ECE baseline="+audit.baseline.favoriteEce5.toFixed(4)+" candidate="+audit.candidate.favoriteEce5.toFixed(4));
  console.log("[RAN_BASKET_DEV] PASS: diagnostics only. Publication=BLOCKED. Reports="+OUT+".md and .json");
}
try{main()}catch(e){console.error("[RAN_BASKET_DEV] FAIL: "+(e instanceof Error?e.message:String(e)));process.exitCode=1;}
