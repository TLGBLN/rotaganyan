// KALICI ARAÇ (V5.3 segment-bazlı eğitim) — 2026-08-21.
// Kullanıcı kararı: sireOrani şartlı1/19/27+maiden (kategori 1a/1b) koşularında, AGF
// trend diğer koşularda ağırlıklı olmalı. İstatistiksel test (etkileşim terimi VE ayrı
// segment modelleri, ikisi de bootstrap B=200) yönü doğruladı ama anlamlılığı kesin
// kanıtlayamadı (küçük örneklem, n=240 düşük-şart koşusu) — kullanıcı buna rağmen
// segment-bazlı iki-model mimarisinin CANLIYA alınmasını istedi. Bu araç, arac-model-
// egit.mjs ile AYNI koşullu logit eğitimini kategori 1a/1b (dusukSart) ve geri kalan
// (diger) koşular için AYRI AYRI çalıştırıp iki ayrı ağırlık dosyası üretir.
import { readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const COVERAGE_START_DATE = "2026-07-01";
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DATA_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri.json";
const OUT_DUSUKSART = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\v5-weights-dusuksart.json";
const OUT_DIGER = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\v5-weights-diger.json";

const ANLAMLI_PUAN_ESIGI = 1.0;

const FEATURE_NAMES = [
  "agfSirasi", "accurace", "formEgimi", "formEgimi2", "kgsVarMi", "sireOrani",
  "galop", "idmJokey", "jokeyOrani",
  // 2026-08-23 — antrenorOrani KOMPLE ÇIKARILDI (bkz. v5-engine.ts dosya başındaki
  // 2026-08-23 V5.9 notu) — kullanıcı kararı, backtest maliyeti (düşük-şart top1/top3
  // -5 puan) açıkça gösterilip kabul edildi.
  "agfYukselisVarMi", "kacakAtMi", "agfDususVarMi", "agfPayi",
  // 2026-08-23 — H2H net skoru KOMPLE ÇIKARILDI (bkz. v5-engine.ts dosya başındaki
  // 2026-08-23 notu) — düşük-şart segmentinde katsayı yanlış yöne (negatif) sabitlenmişti,
  // hiçbir zaman sağlam anlamlı olmamıştı (GA hep sıfırı içeriyordu). Kullanıcı kararıyla
  // her iki segmentten de kaldırıldı.
  // 2026-08-23 — SADELEŞTİRME: kgs (ham gün+karesi), pistUzmani, uzunAraGalopKatkisi
  // leave-one-out ablasyon + bootstrap ile HER İKİ segmentte anlamsız/etkisiz bulunup
  // çıkarıldı (kgsVarMi kaldı — diğer segmentte gerçekten anlamlıydı). 19→15 özellik.
  // 2026-08-21 — hizDerecesi: TJK "süre" alanından (at-bazlı gerçek bitiriş süresi),
  // popülasyon (irk|pist|mesafe) ortalama tempo'suna göre göreli hız — yalnız son 365
  // gün (uzun aradan dönen atların eski "en iyi dönemi" güncelmiş gibi kullanılmasın).
  // B=200 bootstrap: nokta=+0.3479, GA=[0.1856,0.5291] GÜÇLÜ ANLAMLI — agfSirasi'nden
  // sonra en büyük katsayı. VIF=1.02 (accurace/formEgimi ile ÇAKIŞMIYOR, bağımsız bilgi).
  "hizDerecesi",
  // 2026-08-22 — kullanıcının paylaştığı "bugünkü şartlarda geçmiş kazananlar" tablosu
  // HP bandına göre kazanma oranı gösteriyordu. hpSirasi (HP'ye göre SIRA, yukarıda
  // arac-model-veri-olustur.mts'de belgeli) zaten reddedilmişti. Bu kez HAM HP DEĞERİ
  // (hpPuani) denendi — saha-büyüklüğünden arındırılmış ham analizde 0-15 HP bandı
  // beklenenin %24'ü, 48+ bandı %114'ü kadar kazanıyordu (n=32905, agfSirasi ile
  // korelasyon r=-0.314). AMA diğer 20 özellikle BİRLİKTE test edilince (B=50 bootstrap)
  // İKİ SEGMENTTE DE anlamsız çıktı: düşük-şart nokta=0.1062 GA=[-0.0826,0.3912],
  // diğer nokta=0.1022 GA=[-0.0280,0.2673] — hpSirasi ile AYNI confounding (agfSirasi/
  // agfPayi/antrenorOrani/jokeyOrani zaten yakalıyor). MODELE DAHİL EDİLMEDİ — hpPuani
  // alanı yine de arac-model-veri-olustur.mts'de toplanıyor (ekstra TJK isteği
  // gerektirmiyor), ileride farklı formülasyonla (örn. saha ortalamasına göre relatif)
  // yeniden test edilmek istenirse hazır olsun diye.
];

function toFeatureVector(row) {
  return [
    row.agfSirasi, row.accurace, row.formEgimi, row.formEgimi * row.formEgimi,
    row.kgsVarMi,
    row.sireOrani, row.galop, row.idmJokey, row.jokeyOrani,
    row.agfFark >= ANLAMLI_PUAN_ESIGI ? 1 : 0,
    row.kacakAtMi ?? 0,
    row.agfFark <= -ANLAMLI_PUAN_ESIGI ? 1 : 0,
    row.agfPayi ?? 0,
    row.hizDerecesi ?? 0,
  ];
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
  const kalibrasyon = new Map();
  for (const { features, winnerIdx } of raceGroups) {
    const scores = features.map((f) => f.reduce((s, x, i) => s + x * w[i], 0));
    const probs = softmax(scores);
    n++;
    logLossSum += -Math.log(Math.max(probs[winnerIdx], 1e-12));
    const ranked = probs.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
    if (ranked[0].i === winnerIdx) top1++;
    if (ranked.slice(0, 3).some((r) => r.i === winnerIdx)) top3++;
    for (let i = 0; i < probs.length; i++) {
      const dilim = Math.min(9, Math.floor(probs[i] * 10));
      const mevcut = kalibrasyon.get(dilim) ?? { tahmin: 0, gercek: 0, sayi: 0 };
      mevcut.tahmin += probs[i]; mevcut.gercek += i === winnerIdx ? 1 : 0; mevcut.sayi += 1;
      kalibrasyon.set(dilim, mevcut);
    }
  }
  return {
    n, top1P: (100 * top1) / n, top3P: (100 * top3) / n, avgLogLoss: logLossSum / n,
    kalibrasyon: [...kalibrasyon.entries()].sort((a, b) => a[0] - b[0]).map(([dilim, v]) => ({
      dilim: `%${dilim * 10}-${dilim * 10 + 10}`, n: v.sayi,
      ortalamaTahmin: ((100 * v.tahmin) / v.sayi).toFixed(1), gercekOran: ((100 * v.gercek) / v.sayi).toFixed(1),
    })),
  };
}
function bootstrapResample(arr) { const n = arr.length, out = new Array(n); for (let i = 0; i < n; i++) out[i] = arr[Math.floor(Math.random() * n)]; return out; }
function percentile(sorted, p) { const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length))); return sorted[idx]; }

function egit(etiket, raceGroupsRaw, outPath) {
  console.log(`\n\n########## ${etiket} (${raceGroupsRaw.length} koşu) ##########`);
  const splitIdx = Math.floor(raceGroupsRaw.length * 0.75);
  const trainRaces = raceGroupsRaw.slice(0, splitIdx);
  const testRaces = raceGroupsRaw.slice(splitIdx);
  console.log(`Eğitim: ${trainRaces.length} koşu, Test: ${testRaces.length} koşu`);

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
  FEATURE_NAMES.forEach((name, i) => console.log(`  ${name.padEnd(20)} ${w[i] >= 0 ? "+" : ""}${w[i].toFixed(4)}`));

  const testEval = evaluate(testGroups, w);
  console.log(`TEST: n=${testEval.n} top1=%${testEval.top1P.toFixed(1)} top3=%${testEval.top3P.toFixed(1)} logloss=${testEval.avgLogLoss.toFixed(4)}`);
  const trainEval = evaluate(trainGroups, w);
  console.log(`EĞİTİM: n=${trainEval.n} top1=%${trainEval.top1P.toFixed(1)} top3=%${trainEval.top3P.toFixed(1)} logloss=${trainEval.avgLogLoss.toFixed(4)}`);

  const B_WEIGHTS = 50;
  const bootWeights = [];
  for (let b = 0; b < B_WEIGHTS; b++) bootWeights.push(trainConditionalLogit(bootstrapResample(trainGroups), FEATURE_NAMES.length, { epochs: 400, lr: 0.08, l2: 0.01 }));
  console.log(`Bootstrap B=${B_WEIGHTS} tamamlandı.`);
  FEATURE_NAMES.forEach((name, i) => {
    const vals = bootWeights.map((wb) => wb[i]).sort((a, b) => a - b);
    const lo = percentile(vals, 0.025), hi = percentile(vals, 0.975);
    console.log(`  ${name.padEnd(20)} nokta=${w[i].toFixed(4).padEnd(9)} %95 GA=[${lo.toFixed(4)}, ${hi.toFixed(4)}] ${!(lo < 0 && hi > 0) ? "✓ anlamlı" : "⚠ sıfırı içeriyor"}`);
  });

  writeFileSync(outPath, JSON.stringify({ featureNames: FEATURE_NAMES, weights: w, means, stds, testEval, trainEval }, null, 2));
  console.log(`Yazıldı: ${outPath}`);
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
console.log(`Toplam: ${raceGroupsRaw.length} koşu — Düşük-şart/maiden: ${dusukSartGruplar.length}, Diğer: ${digerGruplar.length}`);

egit("ŞARTLI 1/19/27 + MAIDEN", dusukSartGruplar, OUT_DUSUKSART);
egit("DİĞER KOŞULAR", digerGruplar, OUT_DIGER);
