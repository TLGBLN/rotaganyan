// ROTAGANYAN ANALIZ MOTORU v1.0 — SON KABUL RAPORU (SALt OKUMA, DB YOK).
// Calistirma: node node_modules/tsx/dist/cli.mjs arac-ran-final-kabul-raporu.mts
// RAN_ACCEPT_DATA: TAM bagimsiz kabul JSON'u; default SON.json, yoksa checkpoint.
// RAN_FINAL_MIN_RACES: 60 (son kabul icin dusurulmemeli).
// RAN_FINAL_OUT: C:/tmp/ran-final-kabul (iki dosya: .json ve .md).
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";
import { loadTrainedModel, trainedModelMeta } from "./src/lib/rotaganyan-analiz-motoru/load-trained-model";
import {
  computeFinalAcceptanceReport,
  type AcceptanceRaceRow,
  type FinalAcceptanceReport,
} from "./src/lib/rotaganyan-analiz-motoru/rca/final-acceptance-report";

const FULL_FILE = "C:/tmp/ran-egitim-verisi-SON.json";
const CHECKPOINT = "C:/tmp/ran-egitim-verisi-SON-checkpoint.json";
const SOURCE = process.env.RAN_ACCEPT_DATA ??
  (fs.existsSync(FULL_FILE) ? FULL_FILE : CHECKPOINT);
const PREFIX = process.env.RAN_FINAL_OUT ?? "C:/tmp/ran-final-kabul";
const MIN_RACES = Number(process.env.RAN_FINAL_MIN_RACES ?? "60");
const percent = (v: number | undefined) => v == null ? "N/A" : (v * 100).toFixed(2) + "%";
const number = (v: number | undefined) => v == null ? "N/A" : v.toFixed(4);

function reportMd(r: FinalAcceptanceReport, inputSha256: string): string {
  const m = r.metrics;
  const lines = [
    "# ROTAGANYAN Analiz Motoru v1.0 — Bağımsız Kabul Raporu",
    "",
    "**Veri kapısı:** " + r.dataGate + "  ",
    "**Yayın kararı:** " + r.publicationGate + "  ",
    "**Kaynak:** " + SOURCE + "  ",
    "**Kaynak SHA-256:** \`" + inputSha256 + "\`  ",
    "**Motor sürümü:** " + r.identity.engineVersion + "  ",
    "**Model parmak izi:** \`" + r.identity.weightsFingerprint + "\`  ",
    "",
    "## Kapsam",
    "",
    "| Kontrol | Sonuç |",
    "|---|---:|",
    "| Girdi toplamı | " + r.input.total + " |",
    "| Geçerli yarış | " + r.input.evaluated + " |",
    "| Reddedilen yarış | " + r.input.rejected + " |",
    "| Gerekli en az yarış | " + r.input.required + " |",
    "| Gerçekleşen tarih aralığı | " + (r.input.firstDate ?? "YOK") + " – " + (r.input.lastDate ?? "YOK") + " |",
    "| Model geliştirme holdout bitişi | " + r.input.developmentHoldoutEnd + " |",
    "",
    "## Başarı ölçütleri",
    "",
    "| Ölçüm | Sonuç |",
    "|---|---:|",
    "| TOP-1 | " + (m ? percent(m.top1) + " (" + m.top1Hits + "/" + r.input.evaluated + ")" : "YOK") + " |",
    "| TOP-3 | " + (m ? percent(m.top3) + " (" + m.top3Hits + "/" + r.input.evaluated + ")" : "YOK") + " |",
    "| TOP-6 (yalnız tanı) | " + (m ? percent(m.top6Diagnostic) : "YOK") + " |",
    "| Ortalama kazanan sırası | " + number(m?.meanWinnerRank) + " |",
    "| Ortalama saha büyüklüğü | " + number(m?.meanFieldSize) + " |",
    "| LogLoss | " + number(m?.meanLogLoss) + " |",
    "| Eşit olasılık LogLoss referansı | " + number(m?.equalProbabilityLogLoss) + " |",
    "| Multiclass Brier (düşük iyi) | " + number(m?.multiclassBrier) + " |",
    "| ECE (5 grup, örneklem bağımlı) | " + percent(m?.calibrationEce) + " |",
    "| Eşit olasılık TOP-1 referansı | " + percent(m?.top1EqualProbabilityReference) + " |",
    "| Eşit olasılık TOP-3 referansı | " + percent(m?.top3EqualProbabilityReference) + " |",
    "",
    "## Olasılık kalibrasyonu (eşit gözlemli 5 grup)",
    "",
    "| Grup | At sayısı | Min–maks P | Ortalama tahmin | Gerçek kazanma |",
    "|---|---:|---|---:|---:|",
  ];
  for (const b of m?.calibration ?? []) {
    lines.push("| Q" + b.bucket + " | " + b.n + " | " + percent(b.minP) + "–" + percent(b.maxP) +
      " | " + percent(b.meanPredicted) + " | " + percent(b.actualFrequency) + " |");
  }
  lines.push("", "## RCA kategorileri", "");
  lines.push("TOP-1 kaçırmaları: " + JSON.stringify(r.top1MissCategories));
  lines.push("TOP-3 kaçırmaları: " + JSON.stringify(r.top3MissCategories));
  lines.push("", "## Yarış bazında kazanan ve kaçırma gerekçeleri", "");
  lines.push("| Tarih | Race ID | Kazanan | No | Sıra | P(kazanır) | TOP-1 nedeni | İlk 3 skor farkı |");
  lines.push("|---|---|---|---:|---:|---:|---|---|");
  for (const x of r.races) {
    const drivers = x.top1Drivers.slice(0, 3).map((d) => d.code + ":" + d.delta.toFixed(3)).join(", ");
    lines.push("| " + x.date + " | " + x.raceId + " | " + x.winnerName.replace(/\|/g, "/") +
      " | " + x.winnerNo + " | " + x.rank + "/" + x.fieldSize + " | " +
      percent(x.probability) + " | " + (x.categoryTop1 ?? "TOP-1") + " | " + drivers + " |");
  }
  lines.push("", "## Doğrulama sınırları", "");
  for (const [key, value] of Object.entries(r.verification)) lines.push("- " + key + ": **" + value + "**");
  lines.push("");
  for (const note of r.notes) lines.push("- " + note);
  if (r.rejected.length) {
    lines.push("", "## Reddedilen kayıtlar", "");
    for (const bad of r.rejected) lines.push("- " + bad.raceId + ": " + bad.reason);
  }
  lines.push("");
  return lines.join("\n");
}

function main(): void {
  if (!fs.existsSync(SOURCE)) throw new Error("RAN_FINAL_ACCEPTANCE_FILE_MISSING: " + SOURCE);
  const bytes = fs.readFileSync(SOURCE);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const raw: unknown = JSON.parse(bytes.toString("utf8"));
  if (raw == null || typeof raw !== "object") throw new Error("RAN_FINAL_ACCEPTANCE_INVALID_ROOT");
  const rows = (Array.isArray(raw) ? raw : Object.values(raw)) as AcceptanceRaceRow[];
  const model = loadTrainedModel(); // Canonical model; alternative trained file YASAK.
  const meta = trainedModelMeta();
  const report = computeFinalAcceptanceReport(rows, model, meta, MIN_RACES);

  const jsonPath = path.resolve(PREFIX + ".json");
  const mdPath = path.resolve(PREFIX + ".md");
  fs.mkdirSync(path.dirname(jsonPath), {recursive:true});
  fs.mkdirSync(path.dirname(mdPath), {recursive:true});
  const detail = { ...report, dataFile: SOURCE, dataSha256: sha256 };
  // Dogrulama raporu once tmp'ye sonra hedefe yazilir (yarim dosya birakmama).
  const tmpJson = jsonPath + ".tmp-" + process.pid;
  const tmpMd = mdPath + ".tmp-" + process.pid;
  try {
    fs.writeFileSync(tmpJson, JSON.stringify(detail, null, 2));
    fs.writeFileSync(tmpMd, reportMd(report, sha256));
    fs.renameSync(tmpJson, jsonPath);
    fs.renameSync(tmpMd, mdPath);
  } finally {
    for (const file of [tmpJson, tmpMd]) if (fs.existsSync(file)) fs.rmSync(file);
  }
  console.log("[RAN_FINAL] dataGate=" + report.dataGate + " publicationGate=" + report.publicationGate);
  console.log("[RAN_FINAL] input=" + report.input.total + " valid=" + report.input.evaluated +
    " rejected=" + report.input.rejected + " minimum=" + report.input.required);
  if (report.metrics) {
    console.log("[RAN_FINAL] TOP1=" + percent(report.metrics.top1) +
      " TOP3=" + percent(report.metrics.top3) +
      " LogLoss=" + number(report.metrics.meanLogLoss) +
      " Brier=" + number(report.metrics.multiclassBrier));
  }
  console.log("[RAN_FINAL] reportJson=" + jsonPath);
  console.log("[RAN_FINAL] reportMd=" + mdPath);
  console.log("[RAN_FINAL] immutable pre-race source and production readiness NOT_VERIFIED");
  if (report.dataGate !== "PASS_DATA_ONLY") {
    console.error("[RAN_FINAL_BLOCKED] En az " + MIN_RACES +
      " gecerli, benzersiz, dev-holdout-sonrasi yaris ve SIFIR red gerekir. Eksikler raporda.");
    process.exitCode = 2;
  }
}
try { main(); }
catch (e) { console.error("[RAN_FINAL_ERROR]", e); process.exitCode = 1; }
