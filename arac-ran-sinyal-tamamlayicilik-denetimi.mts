// RAN v1.0 — independent, DB-free 36-feature complementarity audit.
// This is NOT a model selection routine; acceptance-set tuning is prohibited.
// Requires ORIGINAL locked training vectors and SEPARATE later acceptance vectors.
// PowerShell: node node_modules/tsx/dist/cli.mjs ./arac-ran-sinyal-tamamlayicilik-denetimi.mts
import fs from "node:fs";
import { dirname } from "node:path";
import { createHash } from "node:crypto";
import { loadTrainedModel, trainedModelMeta } from "./src/lib/rotaganyan-analiz-motoru/load-trained-model";
import { acceptanceDay, type AcceptanceRaceRow } from "./src/lib/rotaganyan-analiz-motoru/rca/final-acceptance-report";
import {
  auditSignalComplementarity, KNOWN_SOURCE_BLOCKERS, type SignalAuditReport,
} from "./src/lib/rotaganyan-analiz-motoru/rca/signal-complementarity-audit";

const TRAIN_PATH=process.env.RAN_AUDIT_TRAIN ?? "C:/tmp/ran-egitim-verisi.json";
const ACCEPT_PATH=process.env.RAN_AUDIT_ACCEPT ?? "C:/tmp/ran-egitim-verisi-SON.json";
const OUT=process.env.RAN_AUDIT_OUT ?? "C:/tmp/ran-sinyal-tamamlayicilik";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
function readRows(path:string): {all:AcceptanceRaceRow[];sha256:string} {
  if(!fs.existsSync(path))throw new Error("RAN_AUDIT_SOURCE_MISSING: "+path);
  const bytes=fs.readFileSync(path,"utf8");
  const parsed: unknown=JSON.parse(bytes);
  if(!parsed || typeof parsed!=="object")throw new Error("RAN_AUDIT_INVALID_SOURCE: "+path);
  const rows=Array.isArray(parsed)?parsed:Object.values(parsed);
  if(!Array.isArray(rows)||rows.some(r=>!r || typeof r!=="object"||!Array.isArray(r.vectors)))
    throw new Error("RAN_AUDIT_INVALID_VECTOR_SHAPE: "+path);
  return {all:rows as AcceptanceRaceRow[],sha256:sha(bytes)};
}
function format(n:number):string{return Number(n.toFixed(5)).toString();}
function markdown(report:SignalAuditReport, files:{train:string;accept:string;trainHash:string;acceptHash:string}):string {
  const e=report.experiments;
  const heads=[
    "# ROTAGANYAN v1.0 — Sinyal Tamamlayıcılık ve Gölgeleme Denetimi",
    "",
    "**Yayın kapısı: BLOCKED.** Bu rapor yalnız tanısaldır; herhangi bir sinyali otomatik kaldırmaz.",
    "**Yarış öncesi veri kökeni: NOT_VERIFIED.** Eğitim ve kabul vektörleri gerçek tarihsel yayın snapshot'ı değildir.",
    "",
    "## Veri kimliği",
    "",
    "- Eğitim: "+files.train+" (SHA256: "+files.trainHash+")",
    "- Kabul: "+files.accept+" (SHA256: "+files.acceptHash+")",
    "- Orijinal model tekrar üretimi: "+report.trainReplay,
    "- Eğitim yarışı: "+report.model.trainRaces+"; kabul yarışı: "+report.model.testRaces+"; kanonik sinyal: "+report.model.totalSignals,
    "- Referans (mevcut kilitli model) TOP-1: "+format(report.baseline.top1*100)+"% ("+report.baseline.top1Hits+"/"+report.baseline.n+")",
    "- Referans TOP-3: "+format(report.baseline.top3*100)+"% ("+report.baseline.top3Hits+"/"+report.baseline.n+")",
    "- Referans LogLoss: "+format(report.baseline.logLoss),
    "",
    "## Yarış öncesi veri / kaynak engelleri",
    "",
    ...report.blockers.map(b=>"- **"+b.code+"**: "+b.issue),
    ...report.warnings.map(w=>"- "+w),
    "",
    "## D-only / V1-only / tekli ve aile çıkarmaları",
    "",
    "Her aday model, **yalnız orijinal eğitim yarışlarından yeniden öğrenildi.** Kabul yarışları sabit tutuldu.",
    "Pozitif ΔTop = aday daha fazla kazanan yakaladı; negatif ΔLL = aday LogLoss iyileştirdi. Bu tek başına seçim/onay değildir.",
    "",
    "| Deneme | TOP1 | TOP3 | ΔTop1 at | ΔTop3 at | ΔLogLoss | Kurtarma 1/3 | Yeni kayıp 1/3 |",
    "|---|---:|---:|---:|---:|---:|---|---|",
    ...e.map(x=>"| "+x.name+" | "+format(x.metrics.top1*100)+"% | "+format(x.metrics.top3*100)+"% | "+
      x.delta.top1Hits+" | "+x.delta.top3Hits+" | "+format(x.delta.logLoss)+" | "+
      x.rescue.top1+"/"+x.rescue.top3+" | "+x.harm.top1+"/"+x.harm.top3+" |"),
    "",
    "## Korelasyon ve ortak köken",
    "",
    "Yalnız her iki özellik de gözlemliyken Pearson hesaplandı. |r| ≥ 0.80 yüksek örtüşme UYARISIDIR; tek başına eleme değildir.",
    "",
    "| Sinyal A | Sinyal B | Ortak gözlem | r | Yapısal ilişki |",
    "|---|---|---:|---:|---|",
    ...report.correlations.filter(c=>c.highOverlap||c.structuralNote!==null)
      .map(c=>"| "+c.codeA+" | "+c.codeB+" | "+c.nBothObserved+" | "+(c.pearson==null?"N/A":format(c.pearson))+" | "+(c.structuralNote??"Sayısal örtüşme")+" |"),
    "",
    "## Yarış düzeyinde D/V1 kurtarma-kayıp örnekleri",
    "",
    ...e.filter(x=>x.name==="D_ONLY"||x.name==="V1_ONLY").flatMap(x=>[
      "### "+x.name,
      ...x.changed.map(r=>"- "+r.raceId+" kazanan #"+r.winnerNo+" birleşik sıra "+r.baselineRank+
        " → "+x.name+" sıra "+r.candidateRank+
        (r.rescuedTop3?" [TOP3 KURTARMA]":r.lostTop3?" [TOP3 YENİ KAYIP]":"")),
    ]),
    "",
    "## Sonuç",
    "",
    ...report.conclusions.map(x=>"- "+x),
    "",
    "**Önemli:** Sonuçların doğru ölçülebilmesi için SIRE_HISTORY ve SPEED PIT sorunları düzeltilmeli, yeni verilerle eğitim ve daha sonra dokunulmamış kronolojik test tekrarlanmalıdır.",
  ];
  return heads.join("\n")+"\n";
}
function main(){
  fs.mkdirSync(dirname(OUT),{recursive:true});
  const files={train:TRAIN_PATH,accept:ACCEPT_PATH,trainHash:"",acceptHash:""};
  const fail=(reason:string)=>{
    const report={publicationGate:"BLOCKED",provenanceGate:"NOT_VERIFIED",status:"INCOMPLETE",reason,
      blockers:KNOWN_SOURCE_BLOCKERS,originalModelUnchanged:true};
    fs.writeFileSync(OUT+".json",JSON.stringify(report,null,2));
    fs.writeFileSync(OUT+".md","# RAN denetimi — BLOCKED\n\n"+reason+"\n");
    console.error("[RAN_SIGNAL_AUDIT] BLOCKED "+reason);
    process.exitCode=2;
  };
  try {
    const metadata=trainedModelMeta();
    const trainFile=readRows(TRAIN_PATH),acceptFile=readRows(ACCEPT_PATH);
    files.trainHash=trainFile.sha256;files.acceptHash=acceptFile.sha256;
    const train=trainFile.all.filter(r=>{
      const d=acceptanceDay(r.tarih);return d!==null&&d>=metadata.trainDateRange[0]&&d<=metadata.trainDateRange[1];
    });
    const dev=trainFile.all.filter(r=>{
      const d=acceptanceDay(r.tarih);return d!==null&&d>=metadata.holdoutDateRange[0]&&d<=metadata.holdoutDateRange[1];
    });
    if(dev.length!==metadata.nRacesHoldout)throw new Error("Original model dev holdout must contain exactly "+metadata.nRacesHoldout+" races; found "+dev.length);
    if(acceptFile.all.some(r=>dev.some(d=>d.raceId===r.raceId)))
      throw new Error("Acceptance file contains original development holdout IDs");
    const canonical=loadTrainedModel();
    console.log("[RAN_SIGNAL_AUDIT] replaying frozen 36-feature training from "+train.length+" races");
    console.log("[RAN_SIGNAL_AUDIT] 36 drop-one + 11 family + D/V1 = 49 refits, TRAIN only; no production writes");
    const report=auditSignalComplementarity(train,acceptFile.all,canonical,metadata.trainDateRange,
      metadata.holdoutDateRange[1],metadata.nRacesTrain,60);
    fs.writeFileSync(OUT+".json",JSON.stringify({...report,files},null,2));
    fs.writeFileSync(OUT+".md",markdown(report,files));
    console.log("[RAN_SIGNAL_AUDIT] COMPLETED_DIAGNOSTIC publicationGate="+report.publicationGate+
      " provenance="+report.provenanceGate+" trainReplay="+report.trainReplay);
    console.log("[RAN_SIGNAL_AUDIT] baseline Top1="+format(report.baseline.top1*100)+
      "% Top3="+format(report.baseline.top3*100)+"% highCorrPairs="+report.correlations.filter(x=>x.highOverlap).length);
    console.log("[RAN_SIGNAL_AUDIT] report="+OUT+".md and "+OUT+".json");
    console.log("[RAN_SIGNAL_AUDIT] NO SIGNAL SELECTION / NO PRODUCTION CHANGES / PIT BLOCKERS REMAIN");
  }catch(e){
    fail(e instanceof Error?e.message:String(e));
  }
}
main();
