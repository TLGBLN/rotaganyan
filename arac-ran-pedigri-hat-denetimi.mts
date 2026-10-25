// ROTAGANYAN pedigree: 3 separate PIT lineages × all 8 subsets × 4 contexts.
// Diagnostic only. Does not start Prisma, mutate production or published weights.
// Does not open/load acceptance or use Aug26-28 DEV rows for fitting/selection.
import fs from "node:fs";
import {createHash} from "node:crypto";
import {dirname} from "node:path";
import {auditPedigreeLineages} from "./src/lib/rotaganyan-analiz-motoru/rca/pedigree-lineage-audit";
import {validateTrainingOnly,type FeatureRace} from "./src/lib/rotaganyan-analiz-motoru/rca/combinatorial-signal-selection";

const dataPath=process.env.RAN_PEDIGREE_DATA??"C:/tmp/ran-pit-20261025-train-dev.json";
const prefix=process.env.RAN_PEDIGREE_OUT??"C:/tmp/ran-pit-20261025-pedigri-hat-denetimi";
const iterations=Number(process.env.RAN_PEDIGREE_ITERATIONS??"2500");
function main(){
  const input=fs.readFileSync(dataPath);
  const all:unknown=JSON.parse(input.toString("utf8"));
  if(!Array.isArray(all)||all.length!==300)throw new Error("RAN_PEDIGREE_REQUIRES_300_ORIGINAL_ROWS");
  const train=(all as FeatureRace[]).filter(r=>r.tarih>="2026-08-16"&&r.tarih<="2026-08-25")
    .sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.raceId.localeCompare(b.raceId));
  if((all as FeatureRace[]).filter(r=>r.tarih>="2026-08-26"&&r.tarih<="2026-08-28").length!==62)
    throw new Error("RAN_PEDIGREE_MISSING_DEV_GUARD");
  validateTrainingOnly(train);
  if(!Number.isSafeInteger(iterations)||iterations<5||iterations>2500)
    throw new Error("RAN_PEDIGREE_BAD_ITERATIONS");
  if(fs.existsSync(prefix+".json")||fs.existsSync(prefix+".md"))
    throw new Error("RAN_PEDIGREE_REPORT_EXISTS: use a new RAN_PEDIGREE_OUT, no overwrite");
  console.log("[RAN_PEDIGREE] Three SEPARATE PIT lineages SIRE/DAM/DAMSIRE; 4 contexts x 8 subsets = 32 refits × 3 chrono folds.");
  console.log("[RAN_PEDIGREE] 238 training only; DEV-62/October-60 not used for selection. Iterations="+iterations+" Publication=BLOCKED.");
  const result=auditPedigreeLineages(train,iterations,(done,total,context,codes,model)=>{
    console.log("[RAN_PEDIGREE] "+done+"/"+total+" "+context+
      " lines="+(codes.join("+")||"NONE")+
      " Top1="+model.top1Hits+"/"+model.n+" Top3="+model.top3Hits+"/"+model.n+
      " LogLoss="+model.logLoss.toFixed(4));
  });
  const sha=createHash("sha256").update(input).digest("hex");
  fs.mkdirSync(dirname(prefix),{recursive:true});
  fs.writeFileSync(prefix+".json",JSON.stringify({...result,sourceHash:sha,
    trainingCount:238,devUsedForSelection:0,acceptanceUsedForSelection:0,
    iterationCount:iterations},null,2));
  const summary=(e:{top1Hits:number;top3Hits:number;n:number;logLoss:number})=>
    "TOP1="+e.top1Hits+"/"+e.n+" TOP3="+e.top3Hits+"/"+e.n+" LogLoss="+e.logLoss.toFixed(4);
  const lines=[
    "# ROTAGANYAN — SIRE / DAM / DAMSIRE ayrı ve kombinasyonlu denetim",
    "","**Yayın: BLOCKED.** 238 PIT yarışının 3 kronolojik iç katlaması. 62 DEV ve 60 kabul yarışının kazananları kullanılmadı.",
    "Kaynak SHA256: "+sha,"","## Mevcut pedigree sinyallerinin gerçekte gözlenen kapsamı",
    "| Soy | Gözlem | Kapsam | n-start bilinen | <=2 start | Kimliği eksik/hesaplanmış | 0% ham | 100% ham | Açıklama |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---|",
    ...result.lineCoverage.map(x=>"| "+x.code+" | "+x.observed+"/"+x.runnerCount+
      " | "+(100*x.observedFraction).toFixed(1)+"% | "+x.documentedStartSamples+
      " | "+x.observedWithAtMost2Starts+" | "+x.observedWithoutHorseId+" | "+x.rawZeroCount+
      " | "+x.rawHundredCount+" | "+x.caveat+" |"),
    "","## Tam 3 hat ve ikili/tekli alt kümelerin 4 bağlamda karşılaştırması",
  ];
  for(const group of result.grouped){
    const context=group.context;
    lines.push("### "+context,"",
      "Soy hatları YOK: "+summary(group.noPedigree),
      "Üç soy hattı BİRLİKTE: "+summary(group.allThree),
      "İç eğitimde en yüksek araştırma skoru: "+group.bestResearchCandidate.codes.join(", ")+
        " ⇒ "+summary(group.bestResearchCandidate),"",
      "| Pedigri hatları | TOP1 | TOP3 | LogLoss | ΔTOP1 | ΔTOP3 |",
      "|---|---:|---:|---:|---:|---:|",
      ...result.experiments.filter(x=>x.context===context).map(x=>
        "| "+(x.includedPedigree.join("+")||"YOK")+
        " | "+x.result.top1Hits+"/"+x.result.n+
        " | "+x.result.top3Hits+"/"+x.result.n+
        " | "+x.result.logLoss.toFixed(4)+
        " | "+x.relativeToNoPedigree.top1Hits+
        " | "+x.relativeToNoPedigree.top3Hits+" |"),"");
  }
  lines.push("## Güvenlik notları",...result.warnings.map(x=>"- "+x),"",
    "**Önemli:** 25 Ekim'de toplanan mevcut PIT JSON, DAM/DAMSIRE başarı yüzdesinin dayandığı start sayısını saklamıyor. Sonraki yeni PIT vektörlerinde metadata korunacak; eski dosyada mevcut DEĞİL.",
    "Bu nedenle soy hattı yüzdesi güvenilirlik katsayısı değil; gerçek n-start yeniden üretilmeden güvenli soy düzeltmesi tamamlanamaz.",
    "DI/CD, genetik test, linebreeding verisi üretildiği iddia edilmemiştir.");
  fs.writeFileSync(prefix+".md",lines.join("\n")+"\n");
  console.log("[RAN_PEDIGREE] PASS: 32 contextual tests. Report="+prefix+".md and .json. No weights changed.");
}
try{main()}catch(e){console.error("[RAN_PEDIGREE] FAIL: "+(e instanceof Error?e.message:String(e)));process.exitCode=1}
