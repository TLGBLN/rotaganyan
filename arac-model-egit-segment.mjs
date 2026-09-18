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

// 2026-09-12 (V5.46) — model-veri.json'DAN model-veri-yg4.json'a taşındı: bu dosya
// yarisGidisatiSkoru'nun BİRLEŞTİRİLMİŞ (tempo taşıma gücü dahil, V5.45) değerlerini VE
// zeminMesafeDeneyim'in gerçek (daha önce hep 0 olan) değerlerini içeriyor — model-veri.json
// artık STALE, kullanılmamalı.
const DATA_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri-yg4.json";
const OUT_DUSUKSART = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\v5-weights-dusuksart.json";
const OUT_DIGER = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\v5-weights-diger.json";

const ANLAMLI_PUAN_ESIGI = 1.0;

// 2026-08-28 kullanıcı kararı ("faydası yoksa sil"): B=500'de İKİ segmentte de %95 GA'sı
// sıfırı içeren 11 özellik (accurace, formEgimi, formEgimi2, kgs, kgs2, pistUzmani,
// sireOrani, galop, uzunAraGalopKatkisi, agfYukselisVarMi, agfDususVarMi) ÇIKARILDI — 23'ten
// 12'ye indi. Bootstrap FARK testi (B=500, aynı resample'la iki model de eğitilip
// kıyaslandı): logloss farkı düşük-şart'ta ANLAMLI iyileşme (-0.0598, GA=[-0.1389,-0.0067]),
// diğer'de yön aynı ama kanıtlanamadı (-0.0235, GA=[-0.0853,0.0057]). top1/top3 farkı
// ikisinde de GA sıfırı içeriyor ama ortalama pozitif (zarar yok). zeminToleransi
// kullanıcının bilinçli istisnası olduğu için korundu.
// 2026-09-01 kullanıcı kararı — "Yakınsama": pistUzmani + sahada ilk-2 pedigri
// (sireOrani) + at-jokey ikilisinde geçmiş galibiyet + AGF eşik-üstü yükseliş + sınıf
// düşüşünün EN AZ 2'sinin AYNI ATTA hizalanması (MEGAFAUNA vakası). B=500 bootstrap'ta
// İKİ segmentte de anlamsız çıktı (bkz. sinyal-kutugu.service.ts ADAY_SİNYALLER) —
// zeminToleransi/sireOrani ile AYNI türden BİLİNÇLİ istisna, kullanıcı kararıyla eklendi.
// 2026-09-01 kullanıcı kararı — "Son İdman Sprint": son idmanın TÜRÜ (TJK Gallop.track)
// Sprint/Sürat mi (ESENYIL vakası). Backtest (n=9148, leak-free) yönü DOĞRULAMADI (nokta
// tahmini hafif negatif, GA sıfırı kapsıyor) — yakınsama/zeminToleransi ile AYNI türden
// BİLİNÇLİ istisna, GERÇEK fit edilen katsayı kullanılıyor, elle pozitif yapılmadı.
// 2026-09-01 kullanıcı kararı (KIZIM BİNDAL vakası) — "Takı Eklendi"/"Takı Çıkarıldı":
// son yarışına göre takı değişikliği. arac-model-veri-olustur.mts'te ZATEN
// hesaplanıyordu (takiEklendiMi/takiCikarildiMi), model-veri.json'da hazır — yeniden
// üretim GEREKMEDİ. GERÇEK fit edilen katsayı kullanılıyor, elle yön verilmedi.
// 2026-09-01 kullanıcı kararı — "Yarış Gidişatı": saha-geneli tempo senaryosu (Rahat
// Liderlik...Dağılma Riski, kullanıcı tasarımı, bkz. pace-analizi.ts hesaplaYarisGidisati)
// × atın kendi stil dağılımının uyum-matrisiyle ağırlıklı beklenen değeri × mesafe katsayısı.
// B=500 bootstrap testi (arac-model-veri-olustur.mts'e backfill edilen 38264 satırla,
// 2026-07-01+ kapsam, 1122 koşu) İKİ segmentte de sıfırı içeren GA verdi (düşük-şart
// nokta=+0.139 GA=[-0.030,0.320], diğer nokta=+0.098 GA=[-0.002,0.191] — alt sınır sıfıra
// 0.002 kala) — teknik olarak KANITLANMADI ama iki segmentte de AYNI YÖNDE (pozitif) ve
// diğer segmentte neredeyse anlamlı. zeminToleransi/yakınsama/sonIdmanSprint/takı ile AYNI
// türden BİLİNÇLİ istisna, kullanıcı kararıyla eklendi. GERÇEK fit edilen katsayı
// kullanılıyor, elle pozitif yapılmadı.
// 2026-09-11 — "Tempo Taşıma Gücü" (bkz. tempo-tasima-gucu.actions.ts) TEST EDİLDİ,
// EKLENMEDİ. Basit univariate/tercile bootstrap testinde çok güçlü göründü (n=33096,
// her segmentte+AGF diliminde anlamlı, 8-14pp fark) — ama GERÇEK koşullu-logit
// retrain'de (bu script, TÜM diğer 17 özellik kontrol edilerek) katsayısı HER İKİ
// segmentte de anlamsız VE TERS yönlü çıktı (düşük-şart -0.1205 GA=[-0.308,0.140],
// diğer -0.1011 GA=[-0.214,0.057]). Yani univariate etkinin tamamı zaten modeldeki
// BAŞKA sinyallerce (AGF, hızDerecesi, form vb.) açıklanıyormuş — sireOrani/kilo
// sinyallerinde daha önce yakalanan AYNI türden confound deseni. MODELE EKLENMEDİ.
// Kullanıcı kararıyla YERİNE: yarisGidisatiSkoru'nun KENDİ formülüne (pace-analizi.ts
// hesaplaYarisGidisati, zorluk-ağırlıklı) girdi olarak eklendi (V5.45) — ayrı katsayı
// yarışmadığı için "diğer" segmentte artık anlamlı çıktı.
// 2026-09-12 (V5.46) — kgsVarMi/kacakYalniz/h2hKiloDegisimi TAMAMEN ÇIKARILDI (üçü de
// pratikte ölü/sıfır — bkz. v5-engine.ts'teki AYNI tarihli not), takiEklendiMi+
// takiCikarildiMi TEK sinyale (takiDegisikligi = cikarildi-eklendi) birleştirildi.
// Bootstrap FARK testi (B=500, 17 vs 13 özellik, aynı chronological split): "diğer"de
// top1/top3 farkı BİREBİR 0.00pp (GA=[-1.26,1.26]/[-1.68,1.68]), düşük-şart'ta yön
// pozitif (anlamsız, logloss neredeyse anlamlı iyileşme sınırında) — hiçbir kayıp yok.
// 2026-09-18 (V5.47) — "kgsGun" eklendi: son yarıştan bugüne HAM gün sayısı (kgs, -1=veri
// yok sentinel). Challenger testinde (arac-yeni-sinyal-challenger-test.mts, KgsGun adayı)
// "diğer" segmentte KESİN doğrulandı (B=500 gün-kümeli: TRAIN GA=[-0.258,-0.021]
// signStability %99.2, TEST paired bootstrap GA=[-0.0134,-0.0072] P(ΔLL<0)=%100.0),
// düşük-şart'ta reddedildi (n=340 küçük, GA sıfırı kapsıyor) — HIZ_DERECESI_IDX/IDM_JOKEY_IDX
// ile AYNI cerrahi desen: v5-engine.ts'te yalnız düşük-şart'ta bu TEK katsayı sıfırlanacak.
// KRİTİK kalibrasyon notu: kgs bu segmentte ~%70 missing (-1) — jokeyOrani/antrenorOrani'nin
// "population-mean fallback" deseniyle AYNI şekilde impute ediliyor (kgsGunImpute), AMA
// computeMeanStd'nin TÜM satırlar (imputed dahil) üzerinden hesapladığı std, yalnız GEÇERLİ
// satırlardan hesaplanan std'nin ~%55'i çıkıyor (doğrulandı: 58.97 vs 32.58) — bu yüzden
// egit() içinde means/stds[KGS_GUN_IDX] AYRICA, yalnız geçerli TRAIN satırlarından override
// ediliyor (aksi halde production'daki z-score, challenger testinde validate edilenin
// ~1.8 katı büyüklükte çıkardı, gerçek olmayan bir güçlendirme).
const FEATURE_NAMES = [
  "agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani",
  "agfPayi", "h2hNetSkor", "hizDerecesi", "agfPayi2", "zeminToleransi",
  "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru",
  "kgsGun",
];
const KGS_GUN_IDX = FEATURE_NAMES.indexOf("kgsGun");

function toFeatureVector(row, kgsGunImpute = 0) {
  return [
    row.agfSirasi,
    row.idmJokey,
    row.jokeyOrani,
    row.antrenorOrani,
    row.agfPayi ?? 0,
    row.h2hNetSkor ?? 0,
    row.hizDerecesi ?? 0,
    (row.agfPayi ?? 0) * (row.agfPayi ?? 0),
    row.zeminToleransi ?? 0,
    row.yakinsama2Plus ?? 0,
    row.sonIdmanSprint ?? 0,
    (row.takiCikarildiMi ?? 0) - (row.takiEklendiMi ?? 0),
    row.yarisGidisatiSkoru ?? 0,
    row.kgs != null && row.kgs !== -1 ? row.kgs : kgsGunImpute,
  ];
}

/** Bir koşu grubu kümesinde kgs'nin GEÇERLİ (>-1) satırlarından ortalama+std — yalnız
 *  imputation değeri VE means/stds override'ı için, TRAIN split'e (segment'e özel) göre. */
function kgsGunGecerliIstatistik(raceGroups) {
  const gecerli = raceGroups.flatMap((g) => g.runners).map((r) => r.kgs).filter((k) => k != null && k !== -1);
  if (gecerli.length === 0) return { ort: 0, std: 1, n: 0 };
  const ort = gecerli.reduce((a, b) => a + b, 0) / gecerli.length;
  const std = Math.sqrt(gecerli.reduce((a, b) => a + (b - ort) ** 2, 0) / gecerli.length);
  return { ort, std, n: gecerli.length };
}

// Yakınsama'nın pedigri bileşeni saha-İÇİ göreli (sireOrani'ne göre ilk-2) — v5-engine.ts'in
// gatherFaz1V5'teki AYNI mantığı, burada koşu GRUBU seviyesinde (tüm runner'lar hazır).
function yakinsama2PlusEkle(raceGroupsRaw) {
  for (const g of raceGroupsRaw) {
    const sireSirali = [...g.runners].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
    const sireRankOf = new Map(sireSirali.map((r, i) => [r, i + 1]));
    for (const r of g.runners) {
      const pistUzmaniPoz = (r.pistUzmani ?? 0) === 1;
      const sirePoz = sireRankOf.get(r) <= 2;
      const ajiPoz = (r.ajiGalibiyetVarMi ?? 0) === 1;
      const agfTrendPoz = (r.agfFark ?? 0) >= 1.0;
      const sinifDususuPoz = (r.sinifDususu ?? 0) === 1;
      const sayi = [pistUzmaniPoz, sirePoz, ajiPoz, agfTrendPoz, sinifDususuPoz].filter(Boolean).length;
      r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
    }
  }
}

function groupByRace(rows) {
  const byRace = new Map();
  for (const r of rows) { const arr = byRace.get(r.raceId) ?? []; arr.push(r); byRace.set(r.raceId, arr); }
  return [...byRace.entries()].map(([raceId, runners]) => ({ raceId, runners }));
}
function standardize(rows, means, stds, kgsGunImpute = 0) {
  return rows.map((r) => { const v = toFeatureVector(r, kgsGunImpute); return v.map((x, i) => (stds[i] > 1e-9 ? (x - means[i]) / stds[i] : 0)); });
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
// 2026-09-12 kullanıcı talebi (dış AI incelemesi) — mekanizma DEĞİŞMEDİ (hâlâ aynı
// yarış-seviyeli, train-set resample + yeniden-fit katsayı-stabilite testi), yalnız
// raporlama katmanı zenginleştirildi: sabit SEED (birebir tekrar üretilebilirlik) +
// signStability (B turunun kaçında katsayı nokta-tahminle AYNI işaretli çıktı).
const SEED = 5462026;
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function bootstrapResample(arr, rng) { const n = arr.length, out = new Array(n); for (let i = 0; i < n; i++) out[i] = arr[Math.floor(rng() * n)]; return out; }
function percentile(sorted, p) { const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length))); return sorted[idx]; }

function egit(etiket, raceGroupsRaw, outPath) {
  console.log(`\n\n########## ${etiket} (${raceGroupsRaw.length} koşu) ##########`);
  const splitIdx = Math.floor(raceGroupsRaw.length * 0.75);
  const trainRaces = raceGroupsRaw.slice(0, splitIdx);
  const testRaces = raceGroupsRaw.slice(splitIdx);
  console.log(`Eğitim: ${trainRaces.length} koşu, Test: ${testRaces.length} koşu`);

  // KgsGun impute + means/stds override — bkz. FEATURE_NAMES üstündeki 2026-09-18 notu.
  const kgsStat = kgsGunGecerliIstatistik(trainRaces);
  console.log(`  kgsGun: TRAIN'de ${kgsStat.n} geçerli satır, ortalama=${kgsStat.ort.toFixed(2)} std=${kgsStat.std.toFixed(2)} (impute+override değeri)`);
  const trainVectors = trainRaces.flatMap((g) => g.runners.map((r) => toFeatureVector(r, kgsStat.ort)));
  const { means, stds } = computeMeanStd(trainVectors);
  means[KGS_GUN_IDX] = kgsStat.ort;
  stds[KGS_GUN_IDX] = kgsStat.std > 1e-9 ? kgsStat.std : 1;
  function toRaceGroup(g) {
    const stdVectors = standardize(g.runners, means, stds, kgsStat.ort);
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

  // 2026-08-27 kullanıcı talebi: B=50 sınırda sinyallerde (kacakYalniz, idmJokey — nokta
  // ~0.14-0.17) yanlış "anlamsız" sonucu üretebiliyordu (aynı veriyle B=150'de sıfırı
  // içeriyordu, B=500'de %98+ güvenle anlamlı çıktı — saf bootstrap örnekleme gürültüsü).
  // Varsayılan artık B=500 — güçlü sinyallerde (agfSirasi gibi) zaten fark etmiyordu,
  // sınırda sinyallerde artık güvenilir bir GA veriyor.
  const B_WEIGHTS = 500;
  const rng = mulberry32(SEED);
  const bootWeights = [];
  for (let b = 0; b < B_WEIGHTS; b++) bootWeights.push(trainConditionalLogit(bootstrapResample(trainGroups, rng), FEATURE_NAMES.length, { epochs: 400, lr: 0.08, l2: 0.01 }));
  console.log(`Bootstrap B=${B_WEIGHTS} seed=${SEED} nRaces(train)=${trainGroups.length} tamamlandı.`);
  FEATURE_NAMES.forEach((name, i) => {
    const vals = bootWeights.map((wb) => wb[i]).sort((a, b) => a - b);
    const lo = percentile(vals, 0.025), hi = percentile(vals, 0.975);
    const isaretiUyanSayisi = w[i] >= 0 ? vals.filter((v) => v >= 0).length : vals.filter((v) => v < 0).length;
    const signStability = isaretiUyanSayisi / vals.length;
    console.log(`  ${name.padEnd(20)} nokta=${w[i].toFixed(4).padEnd(9)} %95 GA=[${lo.toFixed(4)}, ${hi.toFixed(4)}] signStability=${(signStability * 100).toFixed(1)}% ${!(lo < 0 && hi > 0) ? "✓ anlamlı" : "⚠ sıfırı içeriyor"}`);
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
yakinsama2PlusEkle(raceGroupsRaw);
const dusukSartGruplar = raceGroupsRaw.filter((g) => g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b");
const digerGruplar = raceGroupsRaw.filter((g) => !(g.runners[0].kategori === "1a" || g.runners[0].kategori === "1b"));
console.log(`Toplam: ${raceGroupsRaw.length} koşu — Düşük-şart/maiden: ${dusukSartGruplar.length}, Diğer: ${digerGruplar.length}`);

egit("ŞARTLI 1/19/27 + MAIDEN", dusukSartGruplar, OUT_DUSUKSART);
egit("DİĞER KOŞULAR", digerGruplar, OUT_DIGER);
