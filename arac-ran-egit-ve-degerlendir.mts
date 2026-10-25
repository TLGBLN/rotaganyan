// ROTAGANYAN ANALİZ MOTORU — TEK MODEL eğitimi + bağımsız holdout değerlendirmesi.
//
// Girdi: arac-ran-egitim-veri-topla.mts'in ürettiği JSON (her satır: raceId, tarih, winnerNo,
// vectors — buildUnifiedFeatureVectorsForRace'in GERÇEK çıktısı, D+V1 birleşik 36 kanonik kod).
//
// Eğitim makinesi: motor-v1/engine/training.ts'in GENERIC (C extends string) paylaşılan
// fonksiyonları — computeFeatureStats / fitModel / scoreRace / explainRunner. Bu dosya o
// fonksiyonların İKİNCİ bir kopyasını YAZMAZ, yalnız `codes` argümanını UNIFIED_MODEL_CODES
// (36, signal-integration.ts registry'sinden türetilmiş) ile çağırır — V1.0'ın kendi 20
// kod'luk SIGNAL_CODES'u BURADA KULLANILMAZ, V5.46.1/Saf Model katsayıları da KOPYALANMAZ
// (kullanıcı kuralı: "sıfırdan öğren").
//
// Gün-sınırlı (day-boundary) kronolojik TRAIN/HOLDOUT ayrımı: aynı günün yarışları AYNI
// tarafta kalır (sızıntı önleme). μ/σ SADECE train bölümünden hesaplanır.
import fs from "node:fs";
import { computeFeatureStats, fitModel, scoreRace, explainRunner, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { UNIFIED_MODEL_CODES } from "./src/lib/rotaganyan-analiz-motoru/unified-model-codes";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";

type RanEgitimSatiri = { raceId: string; tarih: string; winnerNo: number | null; vectors: RunnerFeatureVector[] };

const IN_PATH = process.env.RAN_IN ?? "C:/tmp/ran-egitim-verisi.json";
const HOLDOUT_FRACTION = Number(process.env.RAN_HOLDOUT_FRACTION ?? "0.2");
const OPTS = {
  lambda: Number(process.env.RAN_LAMBDA ?? "0.6"),
  learningRate: Number(process.env.RAN_LR ?? "0.25"),
  iterations: Number(process.env.RAN_ITER ?? "2500"),
};

type Row = RanEgitimSatiri & { date: Date };

function loadRows(): Row[] {
  const raw: RanEgitimSatiri[] = JSON.parse(fs.readFileSync(IN_PATH, "utf8"));
  // checkpoint formatı (obje, raceId->satır) ile final-liste formatını (dizi) ikisini de kabul et
  const list = Array.isArray(raw) ? raw : Object.values(raw as unknown as Record<string, RanEgitimSatiri>);
  return list
    .filter((r) => r.winnerNo != null && r.vectors.length >= 3)
    .map((r) => ({ ...r, date: new Date(r.tarih) }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

function dayBoundarySplit(rows: Row[], holdoutFraction: number): { train: Row[]; holdout: Row[]; splitDate: string } {
  const dates = [...new Set(rows.map((r) => r.tarih))].sort();
  const splitIdx = Math.max(1, Math.floor(dates.length * (1 - holdoutFraction)));
  // Pinned original chronology for PIT rebuild: training 16–25 August and
  // development 26–28 August. No tuning on the old October acceptance races.
  const splitDate = process.env.RAN_SPLIT_DATE ?? (dates[splitIdx] ?? dates[dates.length - 1]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(splitDate) ||
      splitDate<=dates[0] || splitDate>dates[dates.length-1]) {
    throw new Error("RAN_SPLIT_DATE invalid/outside actual dataset");
  }
  const train = rows.filter((r) => r.tarih < splitDate);
  const holdout = rows.filter((r) => r.tarih >= splitDate);
  return { train, holdout, splitDate };
}

type RaceEval = {
  raceId: string;
  tarih: string;
  winnerNo: number;
  ranked: { no: number; name: string; probability: number }[];
  winnerRank: number;
  winnerProb: number;
};

function evaluateRace(vectors: RunnerFeatureVector[], winnerNo: number, model: FittedModel<string>): RaceEval {
  const scored = scoreRace(vectors, model);
  const ranked = [...scored].sort((a, b) => b.probability - a.probability);
  const winnerIdx = ranked.findIndex((r) => r.no === winnerNo);
  return {
    raceId: vectors[0]?.raceId ?? "",
    tarih: "",
    winnerNo,
    ranked: ranked.map((r) => ({ no: r.no, name: r.name, probability: r.probability })),
    winnerRank: winnerIdx + 1,
    winnerProb: ranked[winnerIdx]?.probability ?? 0,
  };
}

function calibrationReport(evals: RaceEval[], nBuckets = 5): { bucket: string; n: number; meanPredicted: number; actualFreq: number }[] {
  const points: { p: number; win: 0 | 1 }[] = [];
  for (const e of evals) for (const r of e.ranked) points.push({ p: r.probability, win: r.no === e.winnerNo ? 1 : 0 });
  points.sort((a, b) => a.p - b.p);
  const n = points.length;
  const out: { bucket: string; n: number; meanPredicted: number; actualFreq: number }[] = [];
  for (let b = 0; b < nBuckets; b++) {
    const lo = Math.floor((b * n) / nBuckets);
    const hi = Math.floor(((b + 1) * n) / nBuckets);
    const slice = points.slice(lo, hi);
    if (slice.length === 0) continue;
    const meanPredicted = slice.reduce((a, s) => a + s.p, 0) / slice.length;
    const actualFreq = slice.reduce((a, s) => a + s.win, 0) / slice.length;
    out.push({ bucket: `Q${b + 1} [${slice[0].p.toFixed(3)}-${slice[slice.length - 1].p.toFixed(3)}]`, n: slice.length, meanPredicted, actualFreq });
  }
  return out;
}

function topKHitRate(evals: RaceEval[], k: number): number {
  return evals.filter((e) => e.winnerRank <= k).length / evals.length;
}

// GÖRÜLMEDİ/YANLIŞ OKUNDU/EZİLDİ/GÖLGELENDİ/AYIRT EDİLEMEDİ — hafif, tek-seferlik kategorilendirme.
function kokNedenKategorisi(e: RaceEval, vectors: RunnerFeatureVector[]): string {
  const winnerVec = vectors.find((v) => v.no === e.winnerNo)!;
  const observedCount = winnerVec.signals.filter((s) => s.observed).length;
  const observedRatio = observedCount / winnerVec.signals.length;
  const top = e.ranked[0];
  const probs = e.ranked.map((r) => r.probability);
  const maxP = Math.max(...probs), minP = Math.min(...probs);
  if (observedRatio < 0.5) return "GÖRÜLMEDİ (veri eksikliği — gözlemli sinyal oranı <%50)";
  if (maxP - minP < 0.08) return "AYIRT EDİLEMEDİ (saha neredeyse düz, olasılıklar birbirine çok yakın)";
  if (top.probability - e.winnerProb > 0.25) return "EZİLDİ (başka bir at modelde çok daha güçlü çıktı)";
  if (e.winnerRank <= 3) return "GÖLGELENDİ (doğru aday olarak görüldü ama 1. sıraya çıkaramadı)";
  return "YANLIŞ OKUNDU (gözlemli sinyaller var ama model düşük sıraya koydu)";
}

async function main() {
  console.log(`Veri okunuyor: ${IN_PATH}`);
  const rows = loadRows();
  console.log(`Toplam ${rows.length} kullanılabilir yarış (winnerNo biliniyor, saha>=3).`);
  if (rows.length < 20) {
    console.log("UYARI: örneklem çok küçük, sonuçlar yalnız boru hattı KANITI olarak okunmalı.");
  }

  const { train, holdout, splitDate } = dayBoundarySplit(rows, HOLDOUT_FRACTION);
  if (train.length<30 || holdout.length<10) {
    throw new Error("RAN_PIT_SPLIT_INCOMPLETE: expected >=30 train and >=10 development races");
  }
  console.log(`Gün-sınırlı ayrım: splitDate=${splitDate} → train=${train.length} yarış (${train[0]?.tarih}..${train[train.length - 1]?.tarih}), holdout=${holdout.length} yarış (${holdout[0]?.tarih}..${holdout[holdout.length - 1]?.tarih})`);

  const trainVectors = train.flatMap((r) => r.vectors);
  const stats = computeFeatureStats(trainVectors, UNIFIED_MODEL_CODES);
  console.log(`\nμ/σ (SADECE train'den, n=${trainVectors.length} koşucu-satırı):`);
  for (const [code, s] of stats) console.log(`  ${code.padEnd(28)} μ=${s.mu.toFixed(3).padStart(8)} σ=${s.sigma.toFixed(3).padStart(8)} nObserved=${s.nObserved}`);

  const trainingSet = train.map((r) => ({ raceId: r.raceId, date: r.date, vectors: r.vectors, winnerNo: r.winnerNo! }));
  console.log(`\nEğitim başlıyor: lambda=${OPTS.lambda} lr=${OPTS.learningRate} iterations=${OPTS.iterations} (paylaşılan fitConditionalLogit — plain ridge batch-GD, @/lib/v5461/conditional-logit.ts, momentum YOK — bkz. teslim raporu notu)`);
  const t0 = Date.now();
  const model = fitModel(trainingSet, stats, OPTS);
  console.log(`Eğitim tamam: ${((Date.now() - t0) / 1000).toFixed(1)}s, nRacesUsed=${model.nRacesUsed}, nRacesSkipped=${model.nRacesSkipped}`);
  if (model.nRacesUsed === 0) {
    console.error("HATA: train bölümünde kullanılabilir (kazananı bilinen, saha>=2) yarış yok — gün-sınırlı ayrım dejenere (muhtemelen çok az farklı tarih). RAN_HOLDOUT_FRACTION'ı düşürün veya daha fazla yarış toplayın.");
    process.exit(1);
  }

  console.log(`\nÖğrenilmiş katsayılar (z sütunu / missing sütunu):`);
  for (let i = 0; i < model.names.length; i++) console.log(`  ${model.names[i].padEnd(34)} β=${model.beta[i].toFixed(4)}`);

  // --- HOLDOUT DEĞERLENDİRME ---
  const evals: RaceEval[] = [];
  const evalsByRaceId = new Map<string, { vectors: RunnerFeatureVector[]; winnerNo: number }>();
  for (const r of holdout) {
    const e = evaluateRace(r.vectors, r.winnerNo!, model);
    e.tarih = r.tarih;
    evals.push(e);
    evalsByRaceId.set(r.raceId, { vectors: r.vectors, winnerNo: r.winnerNo! });
  }

  console.log(`\n=== HOLDOUT SONUÇLARI (n=${evals.length} yarış, ${holdout[0]?.tarih}..${holdout[holdout.length - 1]?.tarih}) ===`);
  console.log(`Top-1: ${(topKHitRate(evals, 1) * 100).toFixed(1)}%`);
  console.log(`Top-3: ${(topKHitRate(evals, 3) * 100).toFixed(1)}%`);
  console.log(`Top-6: ${(topKHitRate(evals, 6) * 100).toFixed(1)}%`);
  const avgFieldSize = evals.reduce((a, e) => a + e.ranked.length, 0) / evals.length;
  console.log(`Ortalama saha büyüklüğü: ${avgFieldSize.toFixed(1)} (eşit-olasılık referansı Top-1 ≈ ${(100 / avgFieldSize).toFixed(1)}%)`);
  const logLoss = evals.reduce((a, e) => a - Math.log(Math.max(e.winnerProb, 1e-9)), 0) / evals.length;
  console.log(`LogLoss (ortalama -log P(kazanan)): ${logLoss.toFixed(4)}`);

  console.log(`\n--- Kalibrasyon (5 bucket, tahmin-ort vs gerçek-ort) ---`);
  for (const b of calibrationReport(evals)) {
    console.log(`  ${b.bucket.padEnd(28)} n=${String(b.n).padStart(4)} tahminOrt=${(b.meanPredicted * 100).toFixed(1)}% gerçekOrt=${(b.actualFreq * 100).toFixed(1)}%`);
  }

  console.log(`\n--- Kaçırılan kazananlar kök-neden kategorisi (winnerRank>1) ---`);
  const kategoriSayim = new Map<string, number>();
  for (const e of evals) {
    if (e.winnerRank <= 1) continue;
    const vecs = evalsByRaceId.get(e.raceId)!.vectors;
    const kat = kokNedenKategorisi(e, vecs);
    kategoriSayim.set(kat, (kategoriSayim.get(kat) ?? 0) + 1);
  }
  const missed = evals.filter((e) => e.winnerRank > 1).length;
  console.log(`Kaçırılan (rank>1): ${missed}/${evals.length}`);
  for (const [k, v] of [...kategoriSayim.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${v} (${((v / Math.max(1, missed)) * 100).toFixed(1)}%)`);
  }

  // --- explainRunner izlenebilirlik örneği: ilk 2 holdout yarışının kazananı ---
  console.log(`\n--- explainRunner izlenebilirlik örneği (ilk 2 holdout kazananı) ---`);
  for (const r of holdout.slice(0, 2)) {
    const winnerVec = r.vectors.find((v) => v.no === r.winnerNo);
    if (!winnerVec) continue;
    const { rows: explainRows, totalScore } = explainRunner(winnerVec, model);
    console.log(`\n  Yarış ${r.raceId} (${r.tarih}) — kazanan No ${r.winnerNo} ${winnerVec.name} — totalScore=${totalScore.toFixed(4)}`);
    const sorted = [...explainRows].sort((a, b) => Math.abs(b.scoreContribution) - Math.abs(a.scoreContribution)).slice(0, 8);
    for (const row of sorted) {
      console.log(`    ${row.code.padEnd(28)} raw=${row.rawValue === null ? "null" : row.rawValue.toFixed(3)} z=${row.standardizedValue.toFixed(3)} β=${row.learnedCoefficient.toFixed(4)} katkı=${row.scoreContribution.toFixed(4)} observed=${row.observed}`);
    }
  }

  // --- model+metrikleri diske yaz (denetim/rapor için) ---
  const outPath = process.env.RAN_MODEL_OUT ?? "C:/tmp/ran-trained-model.json";
  fs.writeFileSync(
    outPath,
    JSON.stringify(
      {
        trainedAt: new Date().toISOString(),
        opts: OPTS,
        splitDate,
        nTrainRaces: train.length,
        nHoldoutRaces: holdout.length,
        model: { beta: model.beta, names: model.names, stats: [...model.stats.entries()], nRacesUsed: model.nRacesUsed, nRacesSkipped: model.nRacesSkipped },
        holdoutMetrics: { top1: topKHitRate(evals, 1), top3: topKHitRate(evals, 3), top6: topKHitRate(evals, 6), logLoss, avgFieldSize },
      },
      null,
      2
    )
  );
  console.log(`\nModel+metrikler yazıldı: ${outPath}`);
}
main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("HATA:", e);
    process.exit(1);
  });
