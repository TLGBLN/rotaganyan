// ROTAGANYAN ANALIZ MOTORU — BAGIMSIZ KABUL TESTI: arac-ran-egit-ve-degerlendir.mts'in
// egittigi ve DEV-HOLDOUT'ta (Agu 20-21) lambda sectigi modeli, o modelin egitiminde/ayarinda
// HIC KULLANILMAMIS, kronolojik olarak cok daha SONRAKI bir veri kumesinde (en-son-topla
// script'inin urettigi, bugune en yakin tarihli yarislar) skorlar. Egitim YOK — sadece
// training.ts::scoreRace/explainRunner (AYNI paylasilan fonksiyonlar) ile puanlama.
import fs from "node:fs";
import { scoreRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { loadTrainedModel } from "./src/lib/rotaganyan-analiz-motoru/load-trained-model";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";

type RanEgitimSatiri = { raceId: string; tarih: string; winnerNo: number | null; vectors: RunnerFeatureVector[] };

// DÜZELTME (2026-10-25): bu script'in ESKİ varsayılanı C:/tmp/ran-trained-model-FINAL.json'a
// (93 yarış/λ=60, yanıltıcı "FINAL" adlı KÜÇÜK ÖRNEKLEM) SESSİZCE düşüyordu — kullanıcı
// talimatı madde 2/4: bu artık YASAK. RAN_MODEL verilmezse, repodaki TEK canonical artifact
// (artifacts/ran-trained-model.json, loadTrainedModel() — engineVersion/codes/fingerprint
// doğrulamalı, kendi içinde THROW eder) kullanılır. RAN_MODEL AÇIKÇA verilirse (ad-hoc
// diagnostic/lambda-sweep dosyaları için) o ham dosya okunur — bu YALNIZ diagnostic amaçlı,
// loadTrainedModel()'in disiplinine tabi DEĞİLDİR.
const MODEL_PATH = process.env.RAN_MODEL ?? null;
const DATA_PATH = process.env.RAN_ACCEPT_DATA ?? "C:/tmp/ran-egitim-verisi-SON-checkpoint.json";

function loadModel(): FittedModel<string> {
  if (MODEL_PATH == null) {
    console.log("RAN_MODEL verilmedi → repodaki TEK canonical artifact kullanılıyor: src/lib/rotaganyan-analiz-motoru/artifacts/ran-trained-model.json (loadTrainedModel()).");
    return loadTrainedModel();
  }
  const saved = JSON.parse(fs.readFileSync(MODEL_PATH, "utf8"));
  const stats = new Map<string, { mu: number; sigma: number; nObserved: number }>(saved.model.stats);
  return { beta: saved.model.beta, names: saved.model.names, stats, nRacesUsed: saved.model.nRacesUsed, nRacesSkipped: saved.model.nRacesSkipped, opts: saved.opts };
}

function loadRows(): RanEgitimSatiri[] {
  const raw = JSON.parse(fs.readFileSync(DATA_PATH, "utf8"));
  const list: RanEgitimSatiri[] = Array.isArray(raw) ? raw : Object.values(raw);
  return list.filter((r) => r.winnerNo != null && r.vectors.length >= 3);
}

function main() {
  const model = loadModel();
  const rows = loadRows();
  rows.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
  console.log(`Model: ${MODEL_PATH ?? "repo canonical artifact (artifacts/ran-trained-model.json)"} (eğitimde ${model.nRacesUsed} yarış kullanıldı)`);
  console.log(`Bağımsız kabul seti: ${DATA_PATH} — ${rows.length} yarış, tarih aralığı ${rows[0]?.tarih}..${rows[rows.length - 1]?.tarih}`);
  console.log(`(Bu yarışların HİÇBİRİ modelin eğitiminde veya lambda/dev-holdout seçiminde kullanılmadı.)\n`);

  let top1 = 0, top3 = 0, top6 = 0, logLossSum = 0;
  const points: { p: number; win: 0 | 1 }[] = [];
  const kokNeden = new Map<string, number>();

  for (const r of rows) {
    const scored = scoreRace(r.vectors, model);
    const ranked = [...scored].sort((a, b) => b.probability - a.probability);
    const winnerIdx = ranked.findIndex((x) => x.no === r.winnerNo);
    const rank = winnerIdx + 1;
    const winnerProb = ranked[winnerIdx]?.probability ?? 0;
    if (rank <= 1) top1++;
    if (rank <= 3) top3++;
    if (rank <= 6) top6++;
    logLossSum -= Math.log(Math.max(winnerProb, 1e-9));
    for (const x of ranked) points.push({ p: x.probability, win: x.no === r.winnerNo ? 1 : 0 });

    if (rank > 1) {
      const winnerVec = r.vectors.find((v) => v.no === r.winnerNo)!;
      const observedRatio = winnerVec.signals.filter((s) => s.observed).length / winnerVec.signals.length;
      const top = ranked[0];
      const maxP = Math.max(...ranked.map((x) => x.probability)), minP = Math.min(...ranked.map((x) => x.probability));
      let kat: string;
      if (observedRatio < 0.5) kat = "GÖRÜLMEDİ";
      else if (maxP - minP < 0.08) kat = "AYIRT EDİLEMEDİ";
      else if (top.probability - winnerProb > 0.25) kat = "EZİLDİ";
      else if (rank <= 3) kat = "GÖLGELENDİ";
      else kat = "YANLIŞ OKUNDU";
      kokNeden.set(kat, (kokNeden.get(kat) ?? 0) + 1);
    }
  }

  const n = rows.length;
  console.log(`Top-1: ${((top1 / n) * 100).toFixed(1)}%`);
  console.log(`Top-3: ${((top3 / n) * 100).toFixed(1)}%`);
  console.log(`Top-6: ${((top6 / n) * 100).toFixed(1)}%`);
  const avgFieldSize = points.length / n;
  console.log(`Ortalama saha büyüklüğü: ${avgFieldSize.toFixed(1)} (eşit-olasılık referansı Top-1≈${(100 / avgFieldSize).toFixed(1)}%, LogLoss≈${Math.log(avgFieldSize).toFixed(4)})`);
  console.log(`LogLoss: ${(logLossSum / n).toFixed(4)}`);

  points.sort((a, b) => a.p - b.p);
  console.log(`\n--- Kalibrasyon (5 bucket) ---`);
  for (let b = 0; b < 5; b++) {
    const lo = Math.floor((b * points.length) / 5), hi = Math.floor(((b + 1) * points.length) / 5);
    const slice = points.slice(lo, hi);
    if (slice.length === 0) continue;
    const mp = slice.reduce((a, s) => a + s.p, 0) / slice.length;
    const af = slice.reduce((a, s) => a + s.win, 0) / slice.length;
    console.log(`  Q${b + 1} [${slice[0].p.toFixed(3)}-${slice[slice.length - 1].p.toFixed(3)}] n=${slice.length} tahminOrt=${(mp * 100).toFixed(1)}% gerçekOrt=${(af * 100).toFixed(1)}%`);
  }

  console.log(`\n--- Kaçırılan kazananlar kök-neden (rank>1): ${n - top1}/${n} ---`);
  for (const [k, v] of [...kokNeden.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${k}: ${v}`);
}
main();
