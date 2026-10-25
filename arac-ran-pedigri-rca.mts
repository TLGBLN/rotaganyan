// Read-only paired chronology RCA from previously completed PIT vectors.
// Does not recollect races, access DB, modify published model or accept winner-driven selection.
import fs from "node:fs";
import {createHash} from "node:crypto";
import {dirname} from "node:path";
import {buildWalkFolds,validateTrainingOnly,type FeatureRace} from "./src/lib/rotaganyan-analiz-motoru/rca/combinatorial-signal-selection";
import {pairedPedigreeRca} from "./src/lib/rotaganyan-analiz-motoru/rca/pedigree-paired-rca";
const SOURCE=process.env.RAN_PEDIGREE_RCA_DATA??"C:/tmp/ran-pit-20261025-train-dev.json";
const OUT=process.env.RAN_PEDIGREE_RCA_OUT??"C:/tmp/ran-pit-20261025-pedigri-rca";
const iterations=Number(process.env.RAN_PEDIGREE_RCA_ITERATIONS??"2500");
async function main(){
  if(!Number.isSafeInteger(iterations)||iterations<5||iterations>2500)
    throw new Error("RAN_PEDIGREE_RCA_BAD_ITERATIONS");
  if(fs.existsSync(OUT+".json")||fs.existsSync(OUT+".md"))
    throw new Error("RAN_PEDIGREE_RCA_OUTPUT_EXISTS: no overwrite; choose new OUT");
  const sourceBytes=fs.readFileSync(SOURCE);
  const raw:unknown=JSON.parse(sourceBytes.toString("utf8"));
  if(!Array.isArray(raw)||raw.length!==300)
    throw new Error("RAN_PEDIGREE_RCA_REQUIRES_ORIGINAL_300");
  const all=raw as FeatureRace[];
  const train=all.filter(r=>r.tarih>="2026-08-16"&&r.tarih<="2026-08-25")
    .sort((a,b)=>a.tarih.localeCompare(b.tarih)||a.raceId.localeCompare(b.raceId));
  if(all.filter(r=>r.tarih>="2026-08-26"&&r.tarih<="2026-08-28").length!==62)
    throw new Error("RAN_PEDIGREE_RCA_MISSING_DEV_GUARD");
  validateTrainingOnly(train);
  const folds=buildWalkFolds(train);
  console.log("[RAN_PEDIGREE_RCA] 238 PIT TRAIN, 3 chronological folds, expected 145 validation race IDs, 9 models × 3 folds.");
  console.log("[RAN_PEDIGREE_RCA] no DB, no DEV/acceptance labels for selection, publication BLOCKED");
  const report=pairedPedigreeRca(folds,{lambda:90,learningRate:0.25,iterations},(id,done,total)=>{
    console.log("[RAN_PEDIGREE_RCA] "+done+"/"+total+" "+id);
  });
  if(report.validationRaces!==145)throw new Error("RAN_PEDIGREE_RCA_VALIDATION_MISMATCH");
  const sha=createHash("sha256").update(sourceBytes).digest("hex");
  fs.mkdirSync(dirname(OUT),{recursive:true});
  fs.writeFileSync(OUT+".json",JSON.stringify({...report,sourceHash:sha,
    trainRaces:238,devRacesUsed:0,acceptanceRacesUsed:0,opts:{lambda:90,learningRate:0.25,iterations}},null,2));
  const md=[
    "# ROTAGANYAN pedigri — yarış bazında kurtarılanlar / yeni kaçırılanlar (RCA)",
    "**YAYIN BLOCKED — geçmiş 145 iç doğrulama yarışıdır.**",
    "Kaynak SHA256: "+sha,
    "",
    "| Kıyas | Önce TOP1 | Sonra TOP1 | TOP1 kurtarılan | TOP1 yeni kaçan | Önce TOP3 | Sonra TOP3 | TOP3 kurtarılan | TOP3 yeni kaçan |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...report.comparisons.map(c=>"| "+c.label+" | "+c.beforeTop1+"/"+c.n+
      " | "+c.afterTop1+"/"+c.n+" | +"+c.rescuedTop1+" | -"+c.newlyMissedTop1+
      " | "+c.beforeTop3+"/"+c.n+" | "+c.afterTop3+"/"+c.n+
      " | +"+c.rescuedTop3+" | -"+c.newlyMissedTop3+" |"),
  ];
  for(const c of report.comparisons){
    md.push("", "## "+c.label+" — sonucu değişen yarışlar","",
      "| Tarih | Race ID | Kazanan No | Önce sıra | Sonra sıra | Önce kazanan P | Sonra kazanan P | Soy gözlem (S/D/DS) |",
      "|---|---|---:|---:|---:|---:|---:|---|",
      ...c.cases.filter(x=>x.beforeRank!==x.afterRank)
        .map(x=>"| "+x.date+" | "+x.raceId+" | "+x.winnerNo+
          " | "+x.beforeRank+" | "+x.afterRank+
          " | "+(100*x.beforeProbability).toFixed(2)+"%"+
          " | "+(100*x.afterProbability).toFixed(2)+"%"+
          " | "+[x.winnerSireObserved,x.winnerDamObserved,x.winnerDamsireObserved].map(v=>v?"Y":"N").join("/")+" |"));
  }
  md.push("","## Sınırlar",
    report.confidenceWarning,
    "Kurtarılan sayısı yalnız NET artış değildir: daha önce doğru olan kaç yarışın yeni kaçırıldığı da ayrı raporlanır.",
    "Pedigri kaynak gözlemlerinin geçmiş-start sayısı mevcut eski JSON'da bulunmayabilir; o durumda RCa dosyasında null görülür.",
    "Bu rapora bakıp sinyal ağırlığı/kupon seçimi otomatik güncellenmez.",
    "");
  fs.writeFileSync(OUT+".md",md.join("\n"));
  console.log("[RAN_PEDIGREE_RCA] PASS "+report.comparisons.length+" paired comparisons, "+report.validationRaces+" identical validation races.");
  for(const c of report.comparisons){
    console.log("[RAN_PEDIGREE_RCA] "+c.label+
      " TOP1 rescue="+c.rescuedTop1+" newlyLost="+c.newlyMissedTop1+
      " TOP3 rescue="+c.rescuedTop3+" newlyLost="+c.newlyMissedTop3);
  }
  console.log("[RAN_PEDIGREE_RCA] report="+OUT+".md and .json; published artifacts unchanged.");
}
main().catch(e=>{console.error("[RAN_PEDIGREE_RCA] FAIL: "+(e instanceof Error?e.message:String(e)));process.exitCode=1;});
