// TR Accurace Sectional Intelligence V1 — GERÇEK INCREMENTAL VALUE TESTİ (2026-10-02)
//
// Önceki "Screening-0" (arac-sectional-forward-agf-residual.mts) yalnız tekil
// korelasyon ölçtü — kullanıcının haklı itirazı: asıl soru "AGF baseline'a bu özellik
// eklenince AYNI YARIŞ İÇİNDEKİ sıralama/olasılık iyileşiyor mu" (race-level conditional
// logit), pooled Pearson r DEĞİL (heterojen etkiler birbirini iptal edebilir, yarış
// birimi kaybolur).
//
// Model: her runner için skor S_i = log(P_AGF_i) + γ·X_i, yarış içinde softmax ile
// P_i = exp(S_i) / Σ_j exp(S_j). γ, TRAIN setinde kazananın log-olabilirliğini
// maksimize edecek şekilde (McFadden koşullu-logit, 1 boyutlu, içbükey) fit edilir.
// Metrik: ΔLogLoss = LL(AGF+X) - LL(AGF) (yarış-başına -log P(kazanan), negatif=iyi).
//
// AGF LINEAGE DOĞRULANDI (agf-sync.ts:90): "koşu bitip Sonuç girildiyse AGF kilitlenir"
// — Runner.agf yarıştan SONRA asla güncellenmez, kayıtlı değer gerçek yarış-öncesi
// son fiyattır. Kirlenme riski yok.
//
// Feature: hedef yarıştan ÖNCEKİ, o atın EN SON Accurace koşusunun point-in-time
// sectional özelliği (kullanıcı talimatı — n>=3 agregasyon DEĞİL, tek en-son koşu).
// Kronolojik TRAIN(60%)/DEV(20%)/TEST(20%, kilitli) — TEST yalnız DEV'i geçen
// feature'lar için AÇILIR. Bootstrap RACE-LEVEL (runner değil).
import { db } from "./src/lib/db";
import {
  segmentlereAyir,
  sahaSegmentIstatistikleri,
  relativeSplitSD,
  hesaplaErkenBolumKaybi,
  hesaplaGercekTempoProfili,
  type SectionalCheckpoint,
} from "./src/lib/methodology/sectional-intelligence";

const MIN_SAHA = 4;
const MIN_CHECKPOINTS = 8;
const MIN_GECMIS_ORNEK = 3;
const B_BOOTSTRAP = 1000;

function normalizeName(s: string): string {
  return s
    .replace(/\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i, "")
    .toLocaleUpperCase("tr-TR")
    .replace(/I/g, "I")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

type KaynakOzellik = {
  date: number;
  deficit100mSn: number | null;
  deficit200mSn: number | null;
  initialPositionDeficit: number | null;
  selfNormalizedDeficit100mSn: number | null;
  erkenGoreliTempoSD: number | null;
  ortaGoreliTempoSD: number | null;
  gecGoreliTempoSD: number | null;
  pozisyonKazanciKaybi: number | null;
};

type HedefYarisRunner = { no: number; agfRaw: number; ozellik: KaynakOzellik | null };
type HedefYaris = { raceId: string; date: number; winnerNos: Set<number>; runners: HedefYarisRunner[] };

const FEATURE_ADLARI = [
  "deficit100mSn", "deficit200mSn", "initialPositionDeficit", "selfNormalizedDeficit100mSn",
  "erkenGoreliTempoSD", "ortaGoreliTempoSD", "gecGoreliTempoSD", "pozisyonKazanciKaybi",
] as const;
type FeatureAdi = (typeof FEATURE_ADLARI)[number];

async function main() {
  console.log("1/5 — Her Accurace yarışı için point-in-time özellikler hesaplanıyor (kaynak havuzu)...");
  const accRaces = await db.accuraceRace.findMany({
    select: { date: true, length: true, splits: { select: { horseName: true, checkpoints: true } } },
  });
  const gecmis100mByHorse = new Map<string, { date: number; ms: number }[]>();
  // Önce tüm 0-100m sürelerini topla (self-normalized için gerekli geçmiş).
  for (const ar of accRaces) {
    for (const s of ar.splits) {
      const seg100 = segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]).find((x) => x.from === 0 && x.to === 100);
      if (!seg100) continue;
      const norm = normalizeName(s.horseName);
      const liste = gecmis100mByHorse.get(norm) ?? [];
      liste.push({ date: ar.date.getTime(), ms: seg100.durationMs });
      gecmis100mByHorse.set(norm, liste);
    }
  }
  for (const liste of gecmis100mByHorse.values()) liste.sort((a, b) => a.date - b.date);

  const kaynakByHorse = new Map<string, KaynakOzellik[]>();
  for (const ar of accRaces) {
    if (!ar.length || ar.splits.length < MIN_SAHA) continue;
    const sahaSegmentleri = ar.splits.map((s) => segmentlereAyir(s.checkpoints as unknown as SectionalCheckpoint[]));
    const sahaStatleri = sahaSegmentIstatistikleri(sahaSegmentleri);
    const sourceDateMs = ar.date.getTime();

    for (let i = 0; i < ar.splits.length; i++) {
      const split = ar.splits[i];
      const checkpoints = split.checkpoints as unknown as SectionalCheckpoint[];
      if (checkpoints.length < MIN_CHECKPOINTS) continue;
      const norm = normalizeName(split.horseName);

      const gecmis = (gecmis100mByHorse.get(norm) ?? []).filter((g) => g.date < sourceDateMs);
      const kendiGecmis100mOrtalamasiMs =
        gecmis.length >= MIN_GECMIS_ORNEK ? gecmis.reduce((a, b) => a + b.ms, 0) / gecmis.length : null;

      const segmentler = sahaSegmentleri[i];
      const relativeSplits = segmentler.map((s) => ({
        from: s.from, to: s.to,
        sd: relativeSplitSD(s, sahaStatleri.find((st) => st.from === s.from && st.to === s.to)),
      }));
      const erkenBolumKaybi = hesaplaErkenBolumKaybi(segmentler, sahaStatleri, ar.splits.length, checkpoints, kendiGecmis100mOrtalamasiMs);
      const tempoProfili = hesaplaGercekTempoProfili(relativeSplits, checkpoints, ar.length);

      const liste = kaynakByHorse.get(norm) ?? [];
      liste.push({
        date: sourceDateMs,
        deficit100mSn: erkenBolumKaybi.deficit100mSn,
        deficit200mSn: erkenBolumKaybi.deficit200mSn,
        initialPositionDeficit: erkenBolumKaybi.initialPositionDeficit,
        selfNormalizedDeficit100mSn: erkenBolumKaybi.selfNormalizedDeficit100mSn,
        erkenGoreliTempoSD: tempoProfili.erkenGoreliTempoSD,
        ortaGoreliTempoSD: tempoProfili.ortaGoreliTempoSD,
        gecGoreliTempoSD: tempoProfili.gecGoreliTempoSD,
        pozisyonKazanciKaybi: tempoProfili.pozisyonKazanciKaybi,
      });
      kaynakByHorse.set(norm, liste);
    }
  }
  for (const liste of kaynakByHorse.values()) liste.sort((a, b) => a.date - b.date);
  console.log(`   ${kaynakByHorse.size} farklı at için point-in-time özellik geçmişi hazır.`);

  console.log("2/5 — Hedef yarışlar (AGF + Result olan TR koşuları) kuruluyor...");
  const runners = await db.runner.findMany({
    where: {
      scratched: false,
      ekuriGroup: null,
      agf: { not: null },
      race: { raceDay: { hippodrome: { isForeign: false } } },
    },
    select: {
      name: true, no: true, agf: true, raceId: true,
      race: { select: { raceDay: { select: { date: true } } } },
    },
  });
  const raceIds = [...new Set(runners.map((r) => r.raceId))];
  const results = await db.result.findMany({ where: { raceId: { in: raceIds } }, select: { raceId: true, winnerNos: true } });
  const winnerByRace = new Map(results.map((r) => [r.raceId, new Set(r.winnerNos)]));
  const runnersByRace = new Map<string, typeof runners>();
  for (const r of runners) {
    const liste = runnersByRace.get(r.raceId) ?? [];
    liste.push(r);
    runnersByRace.set(r.raceId, liste);
  }

  const hedefYarislar: HedefYaris[] = [];
  for (const [raceId, rs] of runnersByRace) {
    const kazananlar = winnerByRace.get(raceId);
    if (!kazananlar || kazananlar.size === 0) continue;
    if (rs.length < 4) continue; // çok küçük saha, softmax anlamsız
    const date = rs[0].race.raceDay.date.getTime();
    const hedefRunners: HedefYarisRunner[] = rs.map((r) => {
      const norm = normalizeName(r.name);
      const gecmis = kaynakByHorse.get(norm) ?? [];
      // Kullanıcı talimatı: EN SON (en yakın geçmiş) Accurace koşusu — n>=3 agregasyon değil.
      let enSon: KaynakOzellik | null = null;
      for (const k of gecmis) {
        if (k.date < date) enSon = k; else break; // gecmis tarihe göre ARTAN sıralı
      }
      return { no: r.no, agfRaw: r.agf!, ozellik: enSon };
    });
    hedefYarislar.push({ raceId, date, winnerNos: kazananlar, runners: hedefRunners });
  }
  hedefYarislar.sort((a, b) => a.date - b.date);
  console.log(`   ${hedefYarislar.length} hedef yarış (kronolojik sıralandı).`);

  const nTrain = Math.floor(hedefYarislar.length * 0.6);
  const nDev = Math.floor(hedefYarislar.length * 0.2);
  const train = hedefYarislar.slice(0, nTrain);
  const dev = hedefYarislar.slice(nTrain, nTrain + nDev);
  const test = hedefYarislar.slice(nTrain + nDev);
  console.log(`   TRAIN=${train.length} (${tarihAralik(train)})  DEV=${dev.length} (${tarihAralik(dev)})  TEST=${test.length} (${tarihAralik(test)})\n`);

  console.log("3/5 — AGF-only baseline log-likelihood (TRAIN/DEV/TEST)...");
  const baselineLLTrain = ortRaceLogLoss(train, (_r) => 0, 0);
  const baselineLLDev = ortRaceLogLoss(dev, (_r) => 0, 0);
  const baselineLLTest = ortRaceLogLoss(test, (_r) => 0, 0);
  console.log(`   AGF-only mean race LogLoss — TRAIN=${fmt(baselineLLTrain)}  DEV=${fmt(baselineLLDev)}  TEST=${fmt(baselineLLTest)}\n`);

  console.log("4/5 — Her feature TEK TEK: TRAIN'de γ fit → DEV'de ΔLogLoss testi (race-level bootstrap)...\n");
  const devGecenler: FeatureAdi[] = [];
  for (const fa of FEATURE_ADLARI) {
    const getir = (r: HedefYarisRunner) => r.ozellik?.[fa] ?? null;
    const kapsamTrain = kapsamOrani(train, getir);
    if (kapsamTrain < 0.05) {
      console.log(`${fa.padEnd(32)} ATLANDI — TRAIN kapsamı çok düşük (%${(kapsamTrain * 100).toFixed(1)})`);
      continue;
    }
    const gamma = fitGamma(train, getir);
    const devSonuc = deltaLogLossBootstrap(dev, getir, gamma);
    const anlamli = devSonuc.lo != null && devSonuc.hi != null && devSonuc.hi < 0;
    console.log(
      `${fa.padEnd(32)} γ=${fmt(gamma)}  DEV ΔLL=${fmt(devSonuc.nokta)}  95% GA=[${fmt(devSonuc.lo)}, ${fmt(devSonuc.hi)}]  kapsam=%${(kapsamOrani(dev, getir) * 100).toFixed(0)}  ${anlamli ? "★ DEV'de anlamlı iyileşme" : ""}`
    );
    if (anlamli) devGecenler.push(fa);
  }

  console.log("\n5/5 — TEST (kilitli) — yalnız DEV'i geçen feature'lar için...\n");
  if (devGecenler.length === 0) {
    console.log("   Hiçbir feature DEV taramasını geçmedi — TEST açılmadı (kullanıcı talimatı: TEST yalnız adaylar için).");
  } else {
    for (const fa of devGecenler) {
      const getir = (r: HedefYarisRunner) => r.ozellik?.[fa] ?? null;
      const gammaTrainDev = fitGamma([...train, ...dev], getir); // nihai γ: TRAIN+DEV ile yeniden fit (TEST hiç görülmedi)
      const testSonuc = deltaLogLossBootstrap(test, getir, gammaTrainDev);
      const top1 = top1Karsilastir(test, getir, gammaTrainDev);
      const anlamli = testSonuc.lo != null && testSonuc.hi != null && testSonuc.hi < 0;
      console.log(
        `${fa.padEnd(32)} γ(TRAIN+DEV)=${fmt(gammaTrainDev)}  TEST ΔLL=${fmt(testSonuc.nokta)}  95% GA=[${fmt(testSonuc.lo)}, ${fmt(testSonuc.hi)}]  ${anlamli ? "★★ TEST'te de anlamlı" : "(TEST'te doğrulanmadı)"}`
      );
      console.log(`${"".padEnd(32)} Top1 isabet: AGF-only=%${(top1.baseline * 100).toFixed(1)}  AGF+feature=%${(top1.feature * 100).toFixed(1)}  (n=${test.length} yarış)`);
    }
  }
}

function tarihAralik(yarislar: HedefYaris[]): string {
  if (yarislar.length === 0) return "-";
  const f = new Date(yarislar[0].date).toISOString().slice(0, 10);
  const l = new Date(yarislar[yarislar.length - 1].date).toISOString().slice(0, 10);
  return `${f} → ${l}`;
}

function kapsamOrani(yarislar: HedefYaris[], getir: (r: HedefYarisRunner) => number | null): number {
  let toplam = 0, dolu = 0;
  for (const y of yarislar) for (const r of y.runners) { toplam++; if (getir(r) != null) dolu++; }
  return toplam > 0 ? dolu / toplam : 0;
}

/** Yarış-içi softmax skorları: S_i = log(agfPayi_i) + γ·X_i (X bilinmiyorsa 0 — baseline'dan
 *  sapma yok). log-sum-exp ile sayısal kararlılık sağlanır. agfPayi, o yarıştaki GERÇEK
 *  başlayanlara göre yeniden normalize edilir (ham AGF yüzdeleri tam 100 etmeyebilir). */
function yarisSkorlari(yaris: HedefYaris, getir: (r: HedefYarisRunner) => number | null, gamma: number): number[] {
  const agfToplam = yaris.runners.reduce((s, r) => s + r.agfRaw, 0) || 1;
  return yaris.runners.map((r) => {
    const pAgf = Math.max(r.agfRaw / agfToplam, 1e-6);
    const x = getir(r) ?? 0;
    return Math.log(pAgf) + gamma * x;
  });
}

function logSoftmaxKazanan(yaris: HedefYaris, skorlar: number[]): number | null {
  const kazananIdx = yaris.runners.findIndex((r) => yaris.winnerNos.has(r.no));
  if (kazananIdx < 0) return null;
  const maxSkor = Math.max(...skorlar);
  const logSumExp = maxSkor + Math.log(skorlar.reduce((s, x) => s + Math.exp(x - maxSkor), 0));
  return skorlar[kazananIdx] - logSumExp; // log P(kazanan)
}

function raceLogLikToplam(yarislar: HedefYaris[], getir: (r: HedefYarisRunner) => number | null, gamma: number): number {
  let toplam = 0;
  for (const y of yarislar) {
    const skorlar = yarisSkorlari(y, getir, gamma);
    const logP = logSoftmaxKazanan(y, skorlar);
    if (logP != null) toplam += logP;
  }
  return toplam;
}

function ortRaceLogLoss(yarislar: HedefYaris[], getir: (r: HedefYarisRunner) => number | null, gamma: number): number {
  const n = yarislar.filter((y) => y.runners.some((r) => y.winnerNos.has(r.no))).length;
  return n > 0 ? -raceLogLikToplam(yarislar, getir, gamma) / n : NaN;
}

/** 1 boyutlu koşullu-logit MLE — log-likelihood içbükey (McFadden), kaba-ince 3 kademeli
 *  grid search ile global optimuma pratik olarak ulaşır (tek parametre, türev gerekmez). */
function fitGamma(train: HedefYaris[], getir: (r: HedefYarisRunner) => number | null): number {
  let merkez = 0, aralik = 5, adim = 0.25;
  for (let tur = 0; tur < 4; tur++) {
    let enIyiGamma = merkez, enIyiLL = -Infinity;
    for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
      const ll = raceLogLikToplam(train, getir, g);
      if (ll > enIyiLL) { enIyiLL = ll; enIyiGamma = g; }
    }
    merkez = enIyiGamma;
    aralik = adim * 2;
    adim = adim / 10;
  }
  return Math.round(merkez * 10000) / 10000;
}

function deltaLogLossBootstrap(
  yarislar: HedefYaris[], getir: (r: HedefYarisRunner) => number | null, gamma: number, B = B_BOOTSTRAP
): { nokta: number | null; lo: number | null; hi: number | null } {
  // Her yarış için d_r = logloss_feature(r) - logloss_baseline(r); race-level bootstrap mean(d_r).
  const farklar: number[] = [];
  for (const y of yarislar) {
    const kazananIdx = y.runners.findIndex((r) => y.winnerNos.has(r.no));
    if (kazananIdx < 0) continue;
    const skorBase = yarisSkorlari(y, getir, 0);
    const skorFeat = yarisSkorlari(y, getir, gamma);
    const logPBase = logSoftmaxKazanan(y, skorBase);
    const logPFeat = logSoftmaxKazanan(y, skorFeat);
    if (logPBase == null || logPFeat == null) continue;
    farklar.push(-logPFeat - -logPBase); // logloss_feature - logloss_baseline
  }
  if (farklar.length < 5) return { nokta: null, lo: null, hi: null };
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let b = 0; b < B; b++) {
    let toplam = 0;
    for (let i = 0; i < farklar.length; i++) toplam += farklar[Math.floor(Math.random() * farklar.length)];
    dagilim.push(toplam / farklar.length);
  }
  dagilim.sort((a, b) => a - b);
  const lo = dagilim[Math.floor(dagilim.length * 0.025)];
  const hi = dagilim[Math.floor(dagilim.length * 0.975)];
  return { nokta, lo, hi };
}

function top1Karsilastir(yarislar: HedefYaris[], getir: (r: HedefYarisRunner) => number | null, gamma: number): { baseline: number; feature: number } {
  let isabetBase = 0, isabetFeat = 0, n = 0;
  for (const y of yarislar) {
    const kazananIdx = y.runners.findIndex((r) => y.winnerNos.has(r.no));
    if (kazananIdx < 0) continue;
    n++;
    const skorBase = yarisSkorlari(y, getir, 0);
    const skorFeat = yarisSkorlari(y, getir, gamma);
    const argmax = (arr: number[]) => arr.reduce((best, v, i) => (v > arr[best] ? i : best), 0);
    if (argmax(skorBase) === kazananIdx) isabetBase++;
    if (argmax(skorFeat) === kazananIdx) isabetFeat++;
  }
  return { baseline: n > 0 ? isabetBase / n : 0, feature: n > 0 ? isabetFeat / n : 0 };
}

function fmt(v: number | null): string {
  if (v == null || Number.isNaN(v)) return "?";
  return v.toFixed(5);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
