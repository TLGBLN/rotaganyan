// KALICI ARAÇ — Sinyal Laboratuvarı (2026-08-23).
// Amaç: yeni aday sinyalleri, canlı modelin 20 özelliğine EKLEYEREK, aynı segment-bazlı
// (dusuksart/diger) egitim + B=50 bootstrap disipliniyle test etmek — arac-model-egit-
// segment.mjs'in "adayları hızlı deneme" moduna sadeleştirilmiş hali. HİÇBİR ZAMAN canlı
// ağırlık dosyalarına (src/lib/methodology/weights/*.json) YAZMAZ — yalnız konsola raporlar.
// Kullanım: ADAY_OZELLIKLER listesini değiştirip `node --env-file=.env arac-sinyal-lab.mjs`.
// Her aday, model-veri.json satırlarında ZATEN mevcut bir alan (veya birkaç alanın basit bir
// fonksiyonu) olmalı — yeni ham veri toplamak gerekiyorsa önce arac-model-veri-olustur.mts'e
// eklenip veri yeniden üretilmeli.
import { readFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
const COVERAGE_START_DATE = "2026-07-01";
const DATA_PATH = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/model-veri.json";

// Canlı modeldeki 20 özellik (src/lib/methodology/v5-engine.ts FEATURE_NAMES ile birebir
// aynı sırada tutulmalı — burada değiştirilmez, yalnız ADAY_OZELLIKLER'e ekleme yapılır).
const BASE_FEATURES = [
  "agfSirasi", "accurace", "formEgimi", "formEgimi2", "kgs", "kgs2", "kgsVarMi", "pistUzmani", "sireOrani",
  "galop", "idmJokey", "jokeyOrani", "antrenorOrani", "uzunAraGalopKatkisi",
  "agfYukselisVarMi", "kacakAtMi", "agfDususVarMi", "agfPayi", "h2hNetSkor", "hizDerecesi",
];
function baseVector(row) {
  return [
    row.agfSirasi, row.accurace, row.formEgimi, row.formEgimi * row.formEgimi,
    row.kgsVarMi ? row.kgs : 0, row.kgsVarMi ? row.kgs * row.kgs : 0, row.kgsVarMi, row.pistUzmani,
    row.sireOrani, row.galop, row.idmJokey, row.jokeyOrani, row.antrenorOrani, row.uzunAraGalopKatkisi ?? 0,
    row.agfFark >= 1.0 ? 1 : 0, row.kacakAtMi ?? 0, row.agfFark <= -1.0 ? 1 : 0, row.agfPayi ?? 0,
    row.h2hNetSkor ?? 0, row.hizDerecesi ?? 0,
  ];
}

// ─── BURAYI DEĞİŞTİR: test edilecek aday sinyaller ───────────────────────────────────
// 2026-08-23 SONUÇ (izole test, B=50 bootstrap): kariyerStartSayisi "DİĞER KOŞULAR"
// segmentinde ANLAMLI çıktı — nokta=-0.2106, GA=[-0.3445,-0.1025] (sıfırı içermiyor),
// backtest top1 %31.0→%32.8, top3 %67.2→%68.4, logloss 1.8257→1.8193 (üçü de iyileşti).
// Düşük-şart segmentinde anlamsız (beklenen — o segmentte start sayısı zaten düşük/az
// değişken). HENÜZ CANLIYA ALINMADI — kullanıcı onayı bekleniyor.
const ADAY_OZELLIKLER = [
  { ad: "kariyerStartSayisi", hesapla: (row) => row.kariyerStartSayisi ?? 0 },
];
// ──────────────────────────────────────────────────────────────────────────────────────

const FEATURE_NAMES = [...BASE_FEATURES, ...ADAY_OZELLIKLER.map((a) => a.ad)];
function toFeatureVector(row) {
  return [...baseVector(row), ...ADAY_OZELLIKLER.map((a) => a.hesapla(row))];
}

function groupByRace(rows) {
  const byRace = new Map();
  for (const r of rows) { const arr = byRace.get(r.raceId) ?? []; arr.push(r); byRace.set(r.raceId, arr); }
  return [...byRace.entries()].map(([raceId, runners]) => ({ raceId, runners }));
}
function standardize(rows, means, stds) {
  return rows.map((r) => { const v = toFeatureVector(r); return v.map((x, i) => (stds[i] > 1e-9 ? (x - means[i]) / stds[i] : 0)); });
}
function computeMeanStd(allVectors) {
  const n = allVectors.length, dim = allVectors[0].length;
  const means = new Array(dim).fill(0);
  for (const v of allVectors) for (let i = 0; i < dim; i++) means[i] += v[i] / n;
  const stds = new Array(dim).fill(0);
  for (const v of allVectors) for (let i = 0; i < dim; i++) stds[i] += (v[i] - means[i]) ** 2 / n;
  for (let i = 0; i < dim; i++) stds[i] = Math.sqrt(stds[i]);
  return { means, stds };
}
function softmax(scores) {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
function trainConditionalLogit(raceGroups, dim, opts) {
  const { epochs = 800, lr = 0.08, l2 = 0.01, momentum = 0.9 } = opts;
  let w = new Array(dim).fill(0), velocity = new Array(dim).fill(0);
  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = new Array(dim).fill(0);
    for (const { features, winnerIdx } of raceGroups) {
      const scores = features.map((f) => f.reduce((s, x, i) => s + x * w[i], 0));
      const probs = softmax(scores);
      for (let i = 0; i < features.length; i++) {
        const coef = probs[i] - (i === winnerIdx ? 1 : 0);
        for (let d = 0; d < dim; d++) grad[d] += coef * features[i][d];
      }
    }
    for (let d = 0; d < dim; d++) {
      grad[d] = grad[d] / raceGroups.length + 2 * l2 * w[d];
      velocity[d] = momentum * velocity[d] - lr * grad[d];
      w[d] += velocity[d];
    }
  }
  return w;
}
function evaluate(raceGroups, w) {
  let n = 0, top1 = 0, top3 = 0, logLossSum = 0;
  for (const { features, winnerIdx } of raceGroups) {
    const scores = features.map((f) => f.reduce((s, x, i) => s + x * w[i], 0));
    const probs = softmax(scores);
    n++;
    logLossSum += -Math.log(Math.max(probs[winnerIdx], 1e-12));
    const ranked = probs.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
    if (ranked[0].i === winnerIdx) top1++;
    if (ranked.slice(0, 3).some((r) => r.i === winnerIdx)) top3++;
  }
  return { n, top1P: (100 * top1) / n, top3P: (100 * top3) / n, avgLogLoss: logLossSum / n };
}
function bootstrapResample(arr) { const n = arr.length, out = new Array(n); for (let i = 0; i < n; i++) out[i] = arr[Math.floor(Math.random() * n)]; return out; }
function percentile(sorted, p) { const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length))); return sorted[idx]; }

function egit(etiket, raceGroupsRaw) {
  console.log("\n########## " + etiket + " (" + raceGroupsRaw.length + " kosu) ##########");
  const splitIdx = Math.floor(raceGroupsRaw.length * 0.75);
  const trainRaces = raceGroupsRaw.slice(0, splitIdx);
  const testRaces = raceGroupsRaw.slice(splitIdx);

  const trainVectors = trainRaces.flatMap((g) => g.runners.map(toFeatureVector));
  const { means, stds } = computeMeanStd(trainVectors);
  function toRaceGroup(g) {
    const stdVectors = standardize(g.runners, means, stds);
    const winnerIdx = g.runners.findIndex((r) => r.win === 1);
    return { features: stdVectors, winnerIdx };
  }
  const trainGroups = trainRaces.map(toRaceGroup).filter((g) => g.winnerIdx >= 0);
  const testGroups = testRaces.map(toRaceGroup).filter((g) => g.winnerIdx >= 0);

  const w = trainConditionalLogit(trainGroups, FEATURE_NAMES.length, { epochs: 800, lr: 0.08, l2: 0.01 });
  const testEval = evaluate(testGroups, w);
  console.log("TEST: n=" + testEval.n + " top1=%" + testEval.top1P.toFixed(1) + " top3=%" + testEval.top3P.toFixed(1) + " logloss=" + testEval.avgLogLoss.toFixed(4));

  const B_WEIGHTS = 50;
  const bootWeights = [];
  for (let b = 0; b < B_WEIGHTS; b++) bootWeights.push(trainConditionalLogit(bootstrapResample(trainGroups), FEATURE_NAMES.length, { epochs: 400, lr: 0.08, l2: 0.01 }));

  const adayBaslangic = BASE_FEATURES.length;
  for (let i = adayBaslangic; i < FEATURE_NAMES.length; i++) {
    const vals = bootWeights.map((wb) => wb[i]).sort((a, b) => a - b);
    const lo = percentile(vals, 0.025), hi = percentile(vals, 0.975);
    const anlamli = !(lo < 0 && hi > 0) ? "ANLAMLI" : "sifiri iceriyor";
    console.log("  " + FEATURE_NAMES[i] + " nokta=" + w[i].toFixed(4) + " %95 GA=[" + lo.toFixed(4) + ", " + hi.toFixed(4) + "] " + anlamli);
  }
  return testEval;
}

const rawAll = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
const tumRaceIdler = [...new Set(rawAll.map((r) => r.raceId))];
const raceDates = await db.race.findMany({ where: { id: { in: tumRaceIdler } }, select: { id: true, raceDay: { select: { date: true } } } });
const tarihByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDay.date]));
const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
const raw = rawAll.filter((r) => { const d = tarihByRaceId.get(r.raceId); return d && d >= kapsamaBaslangic; });
await db.$disconnect();

const raceGroupsRaw = groupByRace(raw).filter((g) => g.runners.length >= 2);
const dusukSartGruplar = raceGroupsRaw.filter((g) => g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b");
const digerGruplar = raceGroupsRaw.filter((g) => !(g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b"));

console.log("Test edilen adaylar: " + ADAY_OZELLIKLER.map((a) => a.ad).join(", "));
egit("SARTLI 1/19/27+MAIDEN", dusukSartGruplar);
egit("DIGER KOSULAR", digerGruplar);
process.exit(0);
