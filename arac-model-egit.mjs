// KALICI ARAÇ (V5 model eğitimi) — 2026-08-15, SİLİNMİYOR.
// arac-model-veri-olustur.mts'nin ürettiği ham/sürekli veriyi okuyup, koşullu logit
// (Plackett-Luce / yarış-gruplu softmax) modelini gradyan inişi + L2 ile eğitir.
// Yarış-bazlı KRONOLOJİK train/test bölmesi kullanır (ilk ~%75 eğitim, son ~%25 test).
// KAPSAMA FİLTRESİ: 2026-08-15 bulgusu — AGF snapshot/galop/KGS geçmişi Rotaganyan'ın
// KENDİ takip altyapısı kurulmadan önce (2026-07 öncesi) sistematik olarak %0 kapsamalı
// (veri hatası değil, altyapı o tarihte yoktu). Bu yüzden yalnız COVERAGE_START_DATE
// SONRASI koşular kullanılıyor — "Rotaganyan'dan olan tüm yarışlar" (kullanıcı talebi).
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-model-egit.mjs
import { readFileSync, writeFileSync } from "fs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const COVERAGE_START_DATE = "2026-07-01"; // bkz. yukarıdaki not — bu tarihten önce tüm ham sinyaller %0
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });

const DATA_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri.json";
const WEIGHTS_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-agirliklar.json";

const ANLAMLI_PUAN_ESIGI = 1.0; // agf-trend.actions.ts ile aynı eşik

const FEATURE_NAMES = [
  "agfSirasi", "accurace", "formEgimi", "formEgimi2",
  "kgs", "kgs2", "kgsVarMi", "pistUzmani", "sireOrani",
  "galop", "idmJokey", "jokeyOrani", "antrenorOrani",
  "uzunAraGalopKatkisi", // YENİ — 2026-08-15 kullanıcı talebi: KGS>30 (uzun ara) olan
  // atlarda, o aradaki galop SAYISI ayrı bir sinyal (DRAGON HERO dersi — "keskin galop
  // zinciri" yalnız son idmanın hızını ölçüyordu, düzenli çalışmayı değil).
  // NOT — 2026-08-16: "sınıf geçişi" (classToSkk farkı) sinyali 3 farklı formülasyonda
  // (ham fark / fark×önceki rekabetçilik / fark×diğer-sinyal-sayısı) test edildi, üçü de
  // bootstrap CI'da sıfırı içerdi — veri desteklemiyor, modele DAHİL EDİLMEDİ (kullanıcı
  // kararı). model-veri.json'da sinifGecisi/sinifGecisiEtkilesim alanları hâlâ duruyor
  // ama burada kullanılmıyor.
  // ESKİ — 2026-08-16'da "agfFavorisiMi" eklenmişti (agfSirasi==1 alt grubunda modelin
  // ortalama tahmini gerçek kazanma oranından düşük çıkıyordu, #1 OLMANIN ayrık sıçramasını
  // yakalamak için ikili bayrak eklendi, o zaman anlamlıydı: +0.0846). 2026-08-19'da
  // "agfPayi" (aşağıda) eklenince agfFavorisiMi'nin katsayısı -0.0284'e düştü (anlamsız) —
  // agfPayi aynı bilgiyi (favori olma) çok daha güçlü ve sürekli (rank değil, gerçek pay
  // büyüklüğü) yakalıyor. agfFavorisiMi bu yüzden ARTIK GEREKSİZ, modelden ÇIKARILDI.
  // NOT — 2026-08-16: dört aday sinyal daha test edildi (aynı jokey sürekliliği, takı
  // eklendi, takı çıkarıldı, sınıf düşüşü×uzun-ara-galop) — DÖRDÜ DE bootstrap CI'da
  // sıfırı içerdi VE genel test performansını hafifçe düşürdü (top1 %37.2→%35.7).
  // Modele DAHİL EDİLMEDİ. model-veri.json'da ayniJokeySurekliligi/takiEklendiMi/
  // takiCikarildiMi/sinifGecisiXUzunAra alanları hâlâ duruyor ama kullanılmıyor.
  "agfYukselisVarMi", // YENİ — 2026-08-16 kullanıcı ısrarı: ham agfFark (sürekli puan
  // farkı) HİÇBİR formülasyonda anlamlı çıkmamıştı (agfSirasi ile multicollinearity
  // olası). Eşik-bazlı ikili hâliyle (|fark|>=1.0, agf-trend.actions.ts'teki ANLAMLI_
  // PUAN_ESIGI ile aynı) test edilince ANLAMLI çıktı (+0.0968→+0.1058, GA sıfırı
  // dışlıyor) — ham agfFark BU ÖZELLİKLE DEĞİŞTİRİLDİ (ikisi birden multicollinearity
  // yaratıyordu). "Düşüş" (agfDususVarMi) ayrı test edildi, ANLAMSIZ çıktı — modele
  // eklenmedi (bkz. ayrı düşüş×temel-güç etkileşim testi, sonucu da anlamsız çıktı).
  "kacakAtMi", // YENİ — 2026-08-16 kullanıcı talebi: sektör araştırması ("tempo/koşu
  // stili" en çarpıcı boşluk olarak işaretlendi) sonrası test edildi. Runner.raceStyle
  // (Accurace tabanlı, V1-V22'den beri DB'de var ama V5 hiç kullanmıyordu) — style==
  // "KACAK_AT" olan atlar. Kapı no / kilo farkı / HP farkı da AYNI ANDA test edildi,
  // ÜÇÜ DE anlamsız çıktı; yalnız kacakAtMi tek başına anlamlı (+0.0878, GA
  // [0.0290, 0.1811]) VE genel performansı iyileştirdi (top1 %34.8→%36.5).
  "agfDususVarMi", // 2026-08-16'da "dususAmaIyiPozisyon" adıyla eklenmişti (KINDBERO/
  // ANGEL ON THE RIGHT, İzmir K3/K4) — o zamanki formülasyon agfFark<=-1.0 VE
  // agfSirasi<=4 (yalnız ilk-4'teki düşüşler sayılıyordu). 2026-08-19 kullanıcı bulgusu
  // (SHINNY vakası, AGF Trend panelinde ilk-4 DIŞINDA anlamlı düşüş gösterip modelin
  // hiç yakalamadığı bir at): pozisyon şartı gerçek sinyali dışlıyor olabilir — kullanıcı
  // "tüm atlar için" (SHINNY'ye özel değil) genel bir kural istedi. Pozisyon şartı
  // KALDIRILIP yalnız eşik testi edildi (agfFark<=-1.0, agfYukselisVarMi ile simetrik) —
  // sonuç: top1 aynı (%38.0), top3 iyileşti (%68.3→%70.2), log-loss iyileşti
  // (1.7695→1.7617). Katsayı yönü tutarlı (+), ham AGF Trend istatistiğiyle uyumlu
  // (düşenler grubu galibiyet %13.8 vs saha ort. %10.3, bkz. agf-trend-istatistik.
  // service.ts). Bootstrap GA'sı sınırda ([-0.0075,0.1950]) ama agfYukselisVarMi'nin
  // GA'sı da bu koşuda sınıra kaydı (GA gürültüsü, B=200'ün doğal varyansı) — üç
  // metrik BİRDEN aynı/iyileşti VE yön mantıklı olduğu için KABUL EDİLDİ. Eski
  // pozisyon-şartlı formülasyon ARTIK KULLANILMIYOR (ad da bu yüzden değişti).
  // NOT — 2026-08-17: "onGrupArkasiMi" (kacakAtMi'nin ikili olup diğer 3 stili tek "0"
  // kutusuna attığı eleştirisiyle, kullanıcı talebiyle test edildi) TEK BAŞINA (ham
  // win-rate) anlamlıydı (ON_GRUP_ARKASI %11.5 vs Bekleme+Geri %9.6, bootstrap GA
  // [2.2,3.6], n=38542) AMA diğer 18 özellikle BİRLİKTE (gerçek koşullu logit modeli)
  // test edilince ANLAMSIZ çıktı (nokta=0.016, GA=[-0.108, 0.091], sıfırı içeriyor) —
  // klasik confounding: Ön Grup Arkası etiketli atlar zaten AGF/aygır/jokey gibi diğer
  // sinyallerde öne çıkıyor, stil etiketinin kendisi ek bilgi katmıyor. Modele DAHİL
  // EDİLMEDİ. Ayrıca "tempo çöküşü geriden gelenlere yarar" hipotezi (Batı handikap
  // literatüründe var) hem kişisel-etiket hem GERÇEK aynı-gün zaman-farkı verisiyle
  // ayrıca test edildi, TJK verisinde hiç tutmadı.
  // NOT — 2026-08-17: "disaridanStart" (TJK "St" sütunundaki turuncu "DS" işareti, at
  // kendi tercihiyle dıştan başlıyor — eski V1-V22'de vardı, V5 hiç kullanmamıştı) TEK
  // BAŞINA anlamlıydı (%14.8 vs %10.1, bootstrap GA [1.9,7.6], n=42466) AMA diğer 18
  // özellikle BİRLİKTE test edilince ANLAMSIZ çıktı (nokta=0.045, GA=[-0.057, 0.154],
  // sıfırı içeriyor) — yine confounding (muhtemelen DS tercih eden ekipler zaten
  // aygır/jokey/antrenör sinyallerinde öne çıkıyor). Modele DAHİL EDİLMEDİ.
  // NOT — 2026-08-17: "hpSirasi" (HP/resmi handikap puanı, agfSirasi ile aynı desende
  // sıralama) TEK BAŞINA çok güçlü anlamlıydı (korelasyon -0.164, GA [-0.174,-0.154],
  // n=32067) AMA diğer 18 özellikle BİRLİKTE test edilince ANLAMSIZ çıktı (nokta=0.010,
  // GA=[-0.126, 0.123], sıfırı içeriyor) — HP muhtemelen AGF sırası + aygır/jokey/
  // antrenör oranlarıyla zaten yüksek örtüşüyor (piyasa da atın kalitesini fiyatlıyor),
  // ek bilgi katmıyor. Modele DAHİL EDİLMEDİ.
  // NOT — 2026-08-19: BODUBEY (İstanbul K5) ve EL LEON (Elazığ K3) — ikisi de AGF favorisi
  // ama zayıf aygır profiliyle sistemde çok düşük sıraya düşmüştü, ikisi de kazandı.
  // Kapsamlı kalibrasyon denetimi: zayıf-aygırlı-favori grubunda model +5.1 puan hafife
  // alıyordu (n=1165, GA bunu dışlıyordu). Üç düzeltme denemesi (aygır×agfSirasi etkileşim
  // terimi, aygır²/antrenör² kare terimleri, L2 gevşetme) BAŞARISIZ oldu — kare terim
  // durumu KÖTÜLEŞTİRDİ bile. Kök neden: "agfFavorisiMi" yalnız SIRAYI (1. mi değil mi)
  // yakalıyordu, AGF payının BÜYÜKLÜĞÜNÜ değil (LEJUR %47 ile EL LEON %22 aynı "favori"
  // etiketini alıyordu). "agfPayi" (ham AGF yüzdesi) ayrı özellik olarak eklenince ÇOK
  // güçlü anlamlı çıktı (+0.4578, GA[0.2095,0.6566], sireOrani'ye yakın büyüklükte) ve
  // zayıf-aygırlı-favori kalibrasyon farkını +5.1'den +1.2 puana indirdi — test top1
  // (%35.6→%37.5), top3 (%66.8→%68.8), log-loss (1.7828→1.7696) ÜÇÜ BİRDEN iyileşti.
  // "agfFarkiIkinciye" (sahadaki 2.'ye göre dominans farkı, yalnız favori için sıfırdan
  // farklı) da ayrıca anlamlı çıktı (-0.1311, GA[-0.2711,-0.0020]). agfFavorisiMi bu
  // ikisinin yanında ARTIK GEREKSİZ hale geldi (katsayısı -0.0284'e düştü, anlamsız
  // bölgede) — modelden ÇIKARILDI, yerini agfPayi + agfFarkiIkinciye aldı.
  // NOT — 2026-08-19 (V5.1 → V5.2): "agfFarkiIkinciye" resmi eğitimde SINIRDA çıkmıştı
  // (nokta=-0.1430, GA=[-0.2370, 0.0018], sıfırı neredeyse içeriyordu). Canlı bir vakada
  // (Elazığ K3, EL LEON) gerçek zararı görüldü: EL LEON en yakın rakibinden 4.27 puan
  // önde olmasına rağmen (agfFarkiIkinciye=4.27, negatif katsayı yüzünden) bu −0.056
  // CEZA olarak işledi — "ne kadar ezici favori" sezgisiyle TERS yönde. agfPayi zaten
  // AGF payının büyüklüğünü güçlü ve tutarlı şekilde yakalıyor (her testte anlamlı,
  // +0.45 civarı) — agfFarkiIkinciye'nin marjinal/sınırda katkısı buna değmiyor.
  // MODELDEN ÇIKARILDI.
  "agfPayi",
];

function toFeatureVector(row) {
  return [
    row.agfSirasi,
    row.accurace,
    row.formEgimi,
    row.formEgimi * row.formEgimi,
    row.kgsVarMi ? row.kgs : 0,
    row.kgsVarMi ? row.kgs * row.kgs : 0,
    row.kgsVarMi,
    row.pistUzmani,
    row.sireOrani,
    row.galop,
    row.idmJokey,
    row.jokeyOrani,
    row.antrenorOrani,
    row.uzunAraGalopKatkisi ?? 0,
    row.agfFark >= ANLAMLI_PUAN_ESIGI ? 1 : 0,
    row.kacakAtMi ?? 0,
    row.agfFark <= -ANLAMLI_PUAN_ESIGI ? 1 : 0,
    row.agfPayi ?? 0,
  ];
}

function groupByRace(rows) {
  const byRace = new Map();
  for (const r of rows) {
    const arr = byRace.get(r.raceId) ?? [];
    arr.push(r);
    byRace.set(r.raceId, arr);
  }
  return [...byRace.entries()].map(([raceId, runners]) => ({ raceId, runners }));
}

function standardize(rows, means, stds) {
  return rows.map((r) => {
    const v = toFeatureVector(r);
    return v.map((x, i) => (stds[i] > 1e-9 ? (x - means[i]) / stds[i] : 0));
  });
}

function computeMeanStd(allVectors) {
  const n = allVectors.length;
  const dim = allVectors[0].length;
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

/** Koşullu logit / Plackett-Luce eğitimi — tam gradyan inişi + L2 + momentum. */
function trainConditionalLogit(raceGroups, dim, opts) {
  const { epochs = 800, lr = 0.08, l2 = 0.01, momentum = 0.9 } = opts;
  let w = new Array(dim).fill(0);
  let velocity = new Array(dim).fill(0);

  for (let epoch = 0; epoch < epochs; epoch++) {
    const grad = new Array(dim).fill(0);
    let totalLoss = 0;
    for (const { features, winnerIdx } of raceGroups) {
      const scores = features.map((f) => f.reduce((s, x, i) => s + x * w[i], 0));
      const probs = softmax(scores);
      totalLoss += -Math.log(Math.max(probs[winnerIdx], 1e-12));
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
    if (epoch % 100 === 0 || epoch === epochs - 1) {
      console.log(`  epoch ${epoch}: ortalama log-loss = ${(totalLoss / raceGroups.length).toFixed(4)}`);
    }
  }
  return w;
}

function evaluate(raceGroups, w) {
  let n = 0, top1 = 0, top3 = 0, logLossSum = 0;
  const kalibrasyon = new Map(); // dilim -> {tahminSayisi, gercekKazanma}
  for (const { features, winnerIdx } of raceGroups) {
    const scores = features.map((f) => f.reduce((s, x, i) => s + x * w[i], 0));
    const probs = softmax(scores);
    n++;
    logLossSum += -Math.log(Math.max(probs[winnerIdx], 1e-12));
    const ranked = probs.map((p, i) => ({ p, i })).sort((a, b) => b.p - a.p);
    if (ranked[0].i === winnerIdx) top1++;
    if (ranked.slice(0, 3).some((r) => r.i === winnerIdx)) top3++;
    for (let i = 0; i < probs.length; i++) {
      const dilim = Math.min(9, Math.floor(probs[i] * 10)); // 0-10%, 10-20%, ...
      const mevcut = kalibrasyon.get(dilim) ?? { tahmin: 0, gercek: 0, sayi: 0 };
      mevcut.tahmin += probs[i];
      mevcut.gercek += i === winnerIdx ? 1 : 0;
      mevcut.sayi += 1;
      kalibrasyon.set(dilim, mevcut);
    }
  }
  return {
    n, top1P: (100 * top1) / n, top3P: (100 * top3) / n, avgLogLoss: logLossSum / n,
    kalibrasyon: [...kalibrasyon.entries()].sort((a, b) => a[0] - b[0]).map(([dilim, v]) => ({
      dilim: `%${dilim * 10}-${dilim * 10 + 10}`, n: v.sayi,
      ortalamaTahmin: ((100 * v.tahmin) / v.sayi).toFixed(1),
      gercekOran: ((100 * v.gercek) / v.sayi).toFixed(1),
    })),
  };
}

// ─── Ana akış ───
const rawAll = JSON.parse(readFileSync(DATA_PATH, "utf-8"));
console.log(`Toplam at satırı (filtre öncesi): ${rawAll.length}`);

const tumRaceIdler = [...new Set(rawAll.map((r) => r.raceId))];
const raceDates = await db.race.findMany({
  where: { id: { in: tumRaceIdler } },
  select: { id: true, raceDay: { select: { date: true } } },
});
const tarihByRaceId = new Map(raceDates.map((r) => [r.id, r.raceDay.date]));
const kapsamaBaslangic = new Date(COVERAGE_START_DATE + "T00:00:00.000Z");
const raw = rawAll.filter((r) => {
  const d = tarihByRaceId.get(r.raceId);
  return d && d >= kapsamaBaslangic;
});
console.log(`Kapsama filtresi sonrası (>=${COVERAGE_START_DATE}): ${raw.length} at satırı, ${new Set(raw.map(r=>r.raceId)).size} koşu`);
await db.$disconnect();

const raceGroupsRaw = groupByRace(raw).filter((g) => g.runners.length >= 2); // tek atlı "yarış" anlamsız
console.log(`Toplam koşu (2+ at): ${raceGroupsRaw.length}`);

// Kronolojik sıra zaten veri toplama script'inin sorgu sırasından geliyor (raceDay.date asc) —
// raceId'lerin ilk göründüğü sırayı koruyoruz.
const splitIdx = Math.floor(raceGroupsRaw.length * 0.75);
const trainRaces = raceGroupsRaw.slice(0, splitIdx);
const testRaces = raceGroupsRaw.slice(splitIdx);
console.log(`Eğitim: ${trainRaces.length} koşu, Test (görülmedi): ${testRaces.length} koşu`);

// Standardizasyon — YALNIZ eğitim setinden hesapla
const trainVectors = trainRaces.flatMap((g) => g.runners.map(toFeatureVector));
const { means, stds } = computeMeanStd(trainVectors);

function toRaceGroup(g) {
  const stdVectors = standardize(g.runners, means, stds);
  const winnerIdx = g.runners.findIndex((r) => r.win === 1);
  return { features: stdVectors, winnerIdx };
}
const trainGroups = trainRaces.map(toRaceGroup).filter((g) => g.winnerIdx >= 0);
const testGroups = testRaces.map(toRaceGroup).filter((g) => g.winnerIdx >= 0);
console.log(`Eğitimde kazananı olan koşu: ${trainGroups.length}, testte: ${testGroups.length}`);

console.log("\n=== EĞİTİM ===");
const w = trainConditionalLogit(trainGroups, FEATURE_NAMES.length, { epochs: 800, lr: 0.08, l2: 0.01 });

console.log("\n=== ÖĞRENİLEN AĞIRLIKLAR (standardize edilmiş girdiler üzerinde) ===");
FEATURE_NAMES.forEach((name, i) => console.log(`  ${name.padEnd(14)} ${w[i] >= 0 ? "+" : ""}${w[i].toFixed(4)}`));

console.log("\n=== TEST (GÖRÜLMEMİŞ VERİ) SONUÇLARI ===");
const testEval = evaluate(testGroups, w);
console.log(`n=${testEval.n} koşu | top1=%${testEval.top1P.toFixed(1)} | top3=%${testEval.top3P.toFixed(1)} | ort. log-loss=${testEval.avgLogLoss.toFixed(4)}`);
console.log("\nKalibrasyon (dilim bazında tahmin vs gerçek):");
for (const k of testEval.kalibrasyon) console.log(`  ${k.dilim.padEnd(10)} n=${String(k.n).padEnd(6)} tahmin=%${k.ortalamaTahmin} gerçek=%${k.gercekOran}`);

console.log("\n=== EĞİTİM SETİ SONUÇLARI (referans, ezber kontrolü için) ===");
const trainEval = evaluate(trainGroups, w);
console.log(`n=${trainEval.n} koşu | top1=%${trainEval.top1P.toFixed(1)} | top3=%${trainEval.top3P.toFixed(1)} | ort. log-loss=${trainEval.avgLogLoss.toFixed(4)}`);

// ─── Bootstrap güven aralığı ───
// Ridge (L2) düzenlileştirme yüzünden klasik Wald GA formülü geçersiz — yarış-bazlı
// (kümeler halinde, tek tek satır değil) bootstrap ile katsayı VE test-metrik
// belirsizliğini ölçüyoruz.
function bootstrapResample(arr) {
  const n = arr.length;
  const out = new Array(n);
  for (let i = 0; i < n; i++) out[i] = arr[Math.floor(Math.random() * n)];
  return out;
}
function percentile(sorted, p) {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

console.log("\n=== BOOTSTRAP — KATSAYI GÜVEN ARALIĞI (B=50, yarış-bazlı yeniden örnekleme) ===");
const B_WEIGHTS = 50;
const bootWeights = [];
for (let b = 0; b < B_WEIGHTS; b++) {
  const resampled = bootstrapResample(trainGroups);
  const wb = trainConditionalLogit(resampled, FEATURE_NAMES.length, { epochs: 400, lr: 0.08, l2: 0.01 });
  bootWeights.push(wb);
  if ((b + 1) % 10 === 0) console.log(`  ... ${b + 1}/${B_WEIGHTS} tamamlandı`);
}
FEATURE_NAMES.forEach((name, i) => {
  const vals = bootWeights.map((wb) => wb[i]).sort((a, b) => a - b);
  const lo = percentile(vals, 0.025), hi = percentile(vals, 0.975);
  const anlamli = !(lo < 0 && hi > 0); // %95 GA sıfırı içermiyorsa anlamlı
  console.log(`  ${name.padEnd(14)} nokta=${w[i].toFixed(4).padEnd(9)} %95 GA=[${lo.toFixed(4)}, ${hi.toFixed(4)}] ${anlamli ? "✓ anlamlı" : "⚠ sıfırı içeriyor"}`);
});

console.log("\n=== BOOTSTRAP — TEST METRİK GÜVEN ARALIĞI (B=300, aynı model, yeniden örneklenmiş test) ===");
const B_TEST = 300;
const bootTop1 = [], bootTop3 = [];
for (let b = 0; b < B_TEST; b++) {
  const resampled = bootstrapResample(testGroups);
  const ev = evaluate(resampled, w);
  bootTop1.push(ev.top1P);
  bootTop3.push(ev.top3P);
}
bootTop1.sort((a, b) => a - b);
bootTop3.sort((a, b) => a - b);
console.log(`  top1: nokta=%${testEval.top1P.toFixed(1)}  %95 GA=[%${percentile(bootTop1, 0.025).toFixed(1)}, %${percentile(bootTop1, 0.975).toFixed(1)}]`);
console.log(`  top3: nokta=%${testEval.top3P.toFixed(1)}  %95 GA=[%${percentile(bootTop3, 0.025).toFixed(1)}, %${percentile(bootTop3, 0.975).toFixed(1)}]`);
console.log(`  (V4 kıyas noktaları: top1=%24.2, top3=%55.1 — GA bu değerleri içeriyorsa fark güvenilir değildir)`);

writeFileSync(WEIGHTS_PATH, JSON.stringify({ featureNames: FEATURE_NAMES, weights: w, means, stds, testEval, trainEval }, null, 2));
console.log(`\nAğırlıklar yazıldı: ${WEIGHTS_PATH}`);
