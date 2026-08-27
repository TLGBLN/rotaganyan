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
  "agfSirasi", "accurace", "formEgimi", "formEgimi2", "kgs", "kgs2", "kgsVarMi", "pistUzmani", "sireOrani",
  "galop", "idmJokey", "jokeyOrani", "antrenorOrani", "uzunAraGalopKatkisi",
  // 2026-08-26 — kacakAtMi (tek parça "kaçak at mı") YERİNE kacakYalniz kondu: derinlemesine
  // backtest (saha büyüklüğü sabit tutulmuş kontrol + deneyimsiz atlarda split-half tutarlı
  // +12-14 puan fark) sahada RAKİPSİZ kaçak olmanın gerçek avantaj taşıdığını, RAKİPLİ kaçak
  // olmanın taşımadığını gösterdi (düşük-şart nokta=+0.145, GA=[0.031,0.266] anlamlı).
  "agfYukselisVarMi", "kacakYalniz", "agfDususVarMi", "agfPayi",
  // 2026-08-21 — H2H net skoru: sınırda bootstrap (GA=[-0.0105,0.1603]) ama top1/top3
  // İKİSİ BİRDEN iyileşti (logloss ihmal edilebilir), kullanıcı kararıyla eklendi.
  "h2hNetSkor",
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
  // 2026-08-24 — Kilo-ayarlı H2H + Galop trendi: kullanıcı hipotezi (SANCAR EFESİ vakası
  // + paylaşılan "Galop Değişimi" ekranı). İKİSİ DE tek başına sınırda/anlamsız (GA
  // sıfırı kapsıyor: h2hKilo düşük-şart nokta=+0.089 GA=[-0.162,0.279], diğer nokta=
  // +0.061 GA=[-0.022,0.164]; galopTrend düşük-şart nokta=+0.280 GA=[-0.007,0.637]
  // NEREDEYSE anlamlı, diğer nokta=+0.003 pratikte sıfır) AMA HER İKİ sinyal HER İKİ
  // segmentte de POZİTİF yön gösterdi (4/4) — kullanıcı bu yön-tutarlılığını yeterli
  // kanıt sayıp EKLENMESİNİ istedi (2026-08-24). h2hKiloDegisimi: HorseRaceHistoryCache
  // (H2H'nin zaten kullandığı kaynak, ekstra TJK isteği yok) — bugünkü rakiplere göre
  // kilo avantajının geçmiş karşılaşmaya göre değişimi. galopTrendFarki: Gallop.splits
  // (zaten idman senkronundan geliyor) — son 400m idman ile bir önceki AYNI mesafedeki
  // idman arasındaki süre farkı (pozitif=hızlandı).
  // 2026-08-24 — galopTrendFarki BURADAN ÇIKARILDI: hesaplama script'inde (arac-galop-
  // trend-ekle.mjs, artık silindi) tarih filtresi eksikti, yarış tarihinden SONRAKİ
  // idman kayıtları "son idman" sayılmıştı (ölçüldü: sıfırdan farklı satırların %74.7'si
  // sızıntılı). Temiz veriyle yeniden test edilince katsayı tamamen çöktü (düşük-şart
  // +0.280→+0.008, diğer +0.003→-0.005) — "yön tutarlılığı" kabul gerekçesi geçersizdi.
  "h2hKiloDegisimi",
  // 2026-08-27 — kullanıcı talebi ("piyasayı araştır"): AGF payı kalibrasyon kontrolü
  // %40+ payılı güçlü favorilerin gerçek kazanma oranından -4.1 puan geride, AGF sırası
  // 4-5 olan orta sıradaki atların +2.1/+2.5 puan önde olduğunu gösterdi — doğrusal
  // olmayan bir kalıp. agfPayi'nin karesi (formEgimi2/kgs2 ile AYNI desen) "diğer"
  // segmentte ANLAMLI (nokta=-0.207, GA=[-0.366,-0.053]) VE top3'ü gerçekten iyileştirdi
  // (%64.8→%65.3, logloss 1.8409→1.8392) — B=500, izole test. Kategorik alternatifler
  // (AGF sırası 4-5 göstergesi, %40+ göstergesi) anlamlı ama top1/top3'ü kötüleştirdi,
  // DAHİL EDİLMEDİ.
  "agfPayi2",
];

function toFeatureVector(row) {
  return [
    row.agfSirasi, row.accurace, row.formEgimi, row.formEgimi * row.formEgimi,
    row.kgsVarMi ? row.kgs : 0, row.kgsVarMi ? row.kgs * row.kgs : 0, row.kgsVarMi, row.pistUzmani,
    row.sireOrani, row.galop, row.idmJokey, row.jokeyOrani, row.antrenorOrani, row.uzunAraGalopKatkisi ?? 0,
    row.agfFark >= ANLAMLI_PUAN_ESIGI ? 1 : 0,
    row.kacakYalniz ?? 0,
    row.agfFark <= -ANLAMLI_PUAN_ESIGI ? 1 : 0,
    row.agfPayi ?? 0,
    row.h2hNetSkor ?? 0,
    row.hizDerecesi ?? 0,
    row.h2hKiloDegisimi ?? 0,
    (row.agfPayi ?? 0) * (row.agfPayi ?? 0),
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

  // 2026-08-27 kullanıcı talebi: B=50 sınırda sinyallerde (kacakYalniz, idmJokey — nokta
  // ~0.14-0.17) yanlış "anlamsız" sonucu üretebiliyordu (aynı veriyle B=150'de sıfırı
  // içeriyordu, B=500'de %98+ güvenle anlamlı çıktı — saf bootstrap örnekleme gürültüsü).
  // Varsayılan artık B=500 — güçlü sinyallerde (agfSirasi gibi) zaten fark etmiyordu,
  // sınırda sinyallerde artık güvenilir bir GA veriyor.
  const B_WEIGHTS = 500;
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
