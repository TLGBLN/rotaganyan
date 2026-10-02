// FAZ A1.5 — Antrenör Oranı + Hız Derecesi ADLİ İNCELEME (2026-10-02, kullanıcı tasarımı)
//
// A1'in iki potansiyel yapısal sorununu (Antrenör: büyük skor hareketi + ~sıfır ΔLL;
// Hız: "Diğer"de NEGATİF ΔLL) A2'nin 105'lik çift matrisine geçmeden ÖNCE teşhis eder.
// Production'a HİÇBİR DOKUNUŞ YOK — yalnız teşhis (ayrı refit TRAIN/DEV'de, production
// β'ları DEĞİŞMEDİ).
//
// 4 bölüm:
//   0. Hibrit n=0 doğrulaması (segment eşleme bug'ı mı, gerçekten yok mu)
//   1. Kalibrasyon/sinyal ayrımı: ΔLL_PRODUCTION (T yeniden hesaplanır, A1'in yaptığı)
//      vs ΔLL_SCORE_ONLY (FULL'ün T'si SABİT tutulur) + TEMP_SWITCH_N
//   2. Refit-aware tek-sinyal ablation: TRAIN'de K-boyutlu koşullu-logit yeniden fit
//      (FULL vs FULL-minus-X), DEV'de ΔLogLoss + bootstrap, + diğer β'ların telafi miktarı
//   3. Hız için "Diğer" segmentinde drift/PSI/coverage/zaman-bloğu işaret kararlılığı
//
// Veri kaynağı A1 ile AYNI: Pick.featureSnapshot (tumSinyaller + standartDeger), gerçek/
// nokta-zamanlı, hiçbir şey yeniden hesaplanmadı.
import { db } from "./src/lib/db";
import { softmax, hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";

const B_BOOTSTRAP = 1000;
const ASIRI_GUVEN_LIDER_ESIGI = 0.7;
const ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP = 0.35;
const ASIRI_GUVEN_SICAKLIGI = 1.5;
const A_KODLARI = [
  "agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru",
] as const;
type Kod = (typeof A_KODLARI)[number];

type RunnerRec = { no: number; isWinner: boolean; standart: Record<Kod, number>; katki: Record<Kod, number>; ham: Record<Kod, number>; aktif: Record<Kod, boolean> };
type RaceRec = { raceId: string; date: number; classType: string; segment: string; liderEsigi: number; distance: number; surface: string; runners: RunnerRec[] };

function segmentBelirle(classType: string): string {
  if (hibritMaidenSatisMi(classType)) return "Hibrit";
  const kat = kategoriTespit(classType);
  if (kat === "1a" || kat === "1b") return "Düşük Şart";
  if (kat === "2") return "Handikap";
  return "Diğer";
}
function liderEsigiHesaplaYerel(classType: string): number {
  return kategoriTespit(classType) === "2" ? ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP : ASIRI_GUVEN_LIDER_ESIGI;
}
function mesafeDilimi(d: number): string { return d <= 1300 ? "SPRINT" : d <= 1900 ? "ORTA" : "UZUN"; }

async function main() {
  console.log("0/4 — Veri yükleniyor + Hibrit n=0 doğrulaması...\n");
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT p."featureSnapshot" as "featureSnapshot", p."runnerId" as "runnerId",
           pr."raceId" as "prediction_raceId", r."classType" as "classType", r.distance as "distance",
           r.surface as "surface", rd.date as "date", res."winnerNos" as "winnerNos"
    FROM "Pick" p
    JOIN "Prediction" pr ON pr.id = p."predictionId"
    JOIN "Race" r ON r.id = pr."raceId"
    JOIN "RaceDay" rd ON rd.id = r."raceDayId"
    JOIN "Hippodrome" h ON h.id = rd."hippodromeId"
    JOIN "Result" res ON res."raceId" = r.id
    WHERE p."featureSnapshot"->>'motorEtiketi' LIKE 'V5.46%'
      AND pr.published = true AND h."isForeign" = false AND h.name != 'Karma'
  `);
  const runnerIds = [...new Set(rows.map((r) => r.runnerId).filter((x): x is string => !!x))];
  const runners = await db.runner.findMany({ where: { id: { in: runnerIds } }, select: { id: true, no: true, scratched: true, ekuriGroup: true } });
  const runnerById = new Map(runners.map((r) => [r.id, r]));

  const byRace = new Map<string, RaceRec>();
  const hibritRaceIdleri = new Set<string>();
  for (const row of rows) {
    if (hibritMaidenSatisMi(row.classType)) hibritRaceIdleri.add(row.prediction_raceId);
    if (!row.runnerId) continue;
    const runner = runnerById.get(row.runnerId);
    if (!runner || runner.scratched || runner.ekuriGroup != null) continue;
    const fs = row.featureSnapshot;
    const tumSinyaller: { kod: string; katki: number; standartDeger: number; hamDeger: number }[] = fs?.tumSinyaller ?? [];
    const standart: Partial<Record<Kod, number>> = {}, katki: Partial<Record<Kod, number>> = {}, ham: Partial<Record<Kod, number>> = {}, aktif: Partial<Record<Kod, boolean>> = {};
    for (const s of tumSinyaller) {
      if ((A_KODLARI as readonly string[]).includes(s.kod)) {
        standart[s.kod as Kod] = s.standartDeger; katki[s.kod as Kod] = s.katki; ham[s.kod as Kod] = s.hamDeger;
        aktif[s.kod as Kod] = Math.abs(s.katki) > 1e-6;
      }
    }
    if (A_KODLARI.some((k) => standart[k] == null)) continue;
    const raceId = row.prediction_raceId;
    const race = byRace.get(raceId) ?? {
      raceId, date: new Date(row.date).getTime(), classType: row.classType, segment: segmentBelirle(row.classType),
      liderEsigi: liderEsigiHesaplaYerel(row.classType), distance: row.distance, surface: row.surface, runners: [],
    };
    race.runners.push({ no: runner.no, isWinner: (row.winnerNos as number[]).includes(runner.no), standart: standart as Record<Kod, number>, katki: katki as Record<Kod, number>, ham: ham as Record<Kod, number>, aktif: aktif as Record<Kod, boolean> });
    byRace.set(raceId, race);
  }
  const tumYarislar = [...byRace.values()].filter((y) => y.runners.length >= 4 && y.runners.some((r) => r.isWinner)).sort((a, b) => a.date - b.date);
  console.log(`   ${tumYarislar.length} yarış kullanılabilir (toplam Hibrit raceId tespit edilen: ${hibritRaceIdleri.size}).`);
  console.log(`   Bunlardan analiz-uygun (≥4 runner, kazanan var) olanlar arasında Hibrit: ${tumYarislar.filter((y) => y.segment === "Hibrit").length}`);
  if (hibritRaceIdleri.size === 0) {
    console.log("   → SONUÇ: Bu V5.46-dönemi örnekleminde GERÇEKTEN hiç Hibrit (Maiden+Satış) yarışı YOK — segment eşleme bug'ı DEĞİL, veri bu kadar (n=0 gerçek).\n");
  } else {
    console.log(`   → DİKKAT: ${hibritRaceIdleri.size} Hibrit raceId bulundu ama filtrelerden (≥4 runner/kazanan/standart eksiksiz) geçemedi — ayrıca incelenmeli.\n`);
  }

  const digerYarislari = tumYarislar.filter((y) => y.segment === "Diğer");
  console.log(`\n(Devam: TÜM yarış n=${tumYarislar.length}, "Diğer" segment n=${digerYarislari.length})\n`);

  console.log("1/4 — Kalibrasyon/sinyal ayrımı: ΔLL_PRODUCTION vs ΔLL_SCORE_ONLY + TEMP_SWITCH_N...\n");
  for (const [ad, kod, yarislar] of [["Antrenör Oranı (GLOBAL)", "antrenorOrani", tumYarislar], ["Hız Derecesi (GLOBAL)", "hizDerecesi", tumYarislar], ["Hız Derecesi (yalnız Diğer)", "hizDerecesi", digerYarislari]] as [string, Kod, RaceRec[]][]) {
    kalibrasyonAyrimiRaporla(ad, kod, yarislar);
  }

  console.log("\n2/4 — Refit-aware tek-sinyal ablation (TRAIN/DEV, K-boyutlu koşullu-logit)...\n");
  const nTrain = Math.floor(tumYarislar.length * 0.7);
  const trainGlobal = tumYarislar.slice(0, nTrain), devGlobal = tumYarislar.slice(nTrain);
  console.log(`GLOBAL split: TRAIN=${trainGlobal.length} DEV=${devGlobal.length}`);
  refitAblationRaporla("Antrenör Oranı (GLOBAL havuzlanmış refit)", "antrenorOrani", trainGlobal, devGlobal);

  const nTrainDiger = Math.floor(digerYarislari.length * 0.7);
  const trainDiger = digerYarislari.slice(0, nTrainDiger), devDiger = digerYarislari.slice(nTrainDiger);
  console.log(`\n"Diğer" split: TRAIN=${trainDiger.length} DEV=${devDiger.length}`);
  refitAblationRaporla("Hız Derecesi (yalnız Diğer, segment-içi refit)", "hizDerecesi", trainDiger, devDiger);

  console.log("\n3/4 — Hız Derecesi drift/coverage/PSI teşhisi (yalnız 'Diğer' segmenti)...\n");
  hizDriftRaporu(digerYarislari);

  console.log("\n4/4 — Özet karar ağacı girdileri aşağıda metinle verildi (yorum kullanıcı tarafından yapılacak).\n");
}

// ─── 1. Kalibrasyon ayrımı ──────────────────────────────────────────────────

function softmaxHam(scores: number[]): number[] {
  const mx = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - mx));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
function sFull(r: RunnerRec): number { return A_KODLARI.reduce((s, k) => s + r.katki[k], 0); }
function sMinus(r: RunnerRec, haric: Kod): number { return A_KODLARI.reduce((s, k) => (k === haric ? s : s + r.katki[k]), 0); }

function tHesapla(scores: number[], liderEsigi: number): number {
  return Math.max(...softmaxHam(scores)) >= liderEsigi ? ASIRI_GUVEN_SICAKLIGI : 1;
}

function kalibrasyonAyrimiRaporla(ad: string, kod: Kod, yarislar: RaceRec[]) {
  const farklarProd: number[] = [], farklarScoreOnly: number[] = [];
  let tempSwitchN = 0;
  for (const y of yarislar) {
    const sF = y.runners.map(sFull), sM = y.runners.map((r) => sMinus(r, kod));
    const winnerIdx = y.runners.findIndex((r) => r.isWinner);

    const probsFullProd = softmax(sF, y.liderEsigi);
    const probsMinusProd = softmax(sM, y.liderEsigi);
    farklarProd.push(-Math.log(Math.max(probsMinusProd[winnerIdx], 1e-9)) - -Math.log(Math.max(probsFullProd[winnerIdx], 1e-9)));

    const tFull = tHesapla(sF, y.liderEsigi);
    const tMinusGercek = tHesapla(sM, y.liderEsigi);
    if (tFull !== tMinusGercek) tempSwitchN++;
    const probsMinusScoreOnly = softmaxHam(sM.map((s) => s / tFull));
    const probsFullScoreOnly = softmaxHam(sF.map((s) => s / tFull));
    farklarScoreOnly.push(-Math.log(Math.max(probsMinusScoreOnly[winnerIdx], 1e-9)) - -Math.log(Math.max(probsFullScoreOnly[winnerIdx], 1e-9)));
  }
  const bootstrapCI = (farklar: number[]) => {
    const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
    const dagilim: number[] = [];
    for (let i = 0; i < B_BOOTSTRAP; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
    dagilim.sort((a, b) => a - b);
    return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
  };
  const prod = bootstrapCI(farklarProd), scoreOnly = bootstrapCI(farklarScoreOnly);
  console.log(`${ad}:`);
  console.log(`   ΔLL_PRODUCTION  = ${prod.nokta.toFixed(5)}  95%GA=[${prod.lo.toFixed(5)},${prod.hi.toFixed(5)}]`);
  console.log(`   ΔLL_SCORE_ONLY  = ${scoreOnly.nokta.toFixed(5)}  95%GA=[${scoreOnly.lo.toFixed(5)},${scoreOnly.hi.toFixed(5)}]`);
  console.log(`   TEMP_SWITCH_N   = ${tempSwitchN} / ${yarislar.length} yarış\n`);
}

// ─── 2. Refit-aware ablation ────────────────────────────────────────────────

function raceLogLikToplamBeta(yarislar: RaceRec[], beta: Record<Kod, number>, kodlar: readonly Kod[]): number {
  let toplam = 0;
  for (const y of yarislar) {
    const sk = y.runners.map((r) => kodlar.reduce((s, k) => s + beta[k] * r.standart[k], 0));
    const idx = y.runners.findIndex((r) => r.isWinner);
    const p = softmaxHam(sk);
    toplam += Math.log(Math.max(p[idx], 1e-9));
  }
  return toplam;
}
function fitWeights(train: RaceRec[], kodlar: readonly Kod[]): Record<Kod, number> {
  const beta: Record<Kod, number> = Object.fromEntries(A_KODLARI.map((k) => [k, 0])) as Record<Kod, number>;
  for (let tur = 0; tur < 6; tur++) {
    for (const kod of kodlar) {
      let merkez = beta[kod], aralik = 2, adim = 0.2;
      for (let k = 0; k < 3; k++) {
        let enIyi = merkez, enIyiLL = -Infinity;
        for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
          const deneme = { ...beta, [kod]: g };
          const ll = raceLogLikToplamBeta(train, deneme, kodlar);
          if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
        }
        merkez = enIyi; aralik = adim * 2; adim = adim / 10;
      }
      beta[kod] = Math.round(merkez * 10000) / 10000;
    }
  }
  return beta;
}
function devLogLossBootstrap(dev: RaceRec[], beta: Record<Kod, number>, kodlar: readonly Kod[]): { nokta: number; lo: number; hi: number } {
  const lls: number[] = [];
  for (const y of dev) {
    const sk = y.runners.map((r) => kodlar.reduce((s, k) => s + beta[k] * r.standart[k], 0));
    const idx = y.runners.findIndex((r) => r.isWinner);
    const p = softmaxHam(sk);
    lls.push(-Math.log(Math.max(p[idx], 1e-9)));
  }
  const nokta = lls.reduce((a, b) => a + b, 0) / lls.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B_BOOTSTRAP; i++) { let t = 0; for (let j = 0; j < lls.length; j++) t += lls[Math.floor(Math.random() * lls.length)]; dagilim.push(t / lls.length); }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}

function refitAblationRaporla(ad: string, hedefKod: Kod, train: RaceRec[], dev: RaceRec[]) {
  console.log(`\n--- ${ad} ---`);
  const kodlarFull = A_KODLARI;
  const kodlarMinus = A_KODLARI.filter((k) => k !== hedefKod);

  const betaFull = fitWeights(train, kodlarFull);
  const betaMinus = fitWeights(train, kodlarMinus);

  console.log(`FULL refit β[${hedefKod}] (TRAIN) = ${betaFull[hedefKod].toFixed(4)}`);
  console.log(`\nDiğer β'ların FULL→FULL-minus-${hedefKod} arasındaki DEĞİŞİMİ (telafi):`);
  for (const k of kodlarMinus) {
    const fark = betaMinus[k] - betaFull[k];
    if (Math.abs(fark) >= 0.01) console.log(`   ${k.padEnd(20)} ${betaFull[k].toFixed(4)} → ${betaMinus[k].toFixed(4)}  (Δ=${fark >= 0 ? "+" : ""}${fark.toFixed(4)})`);
  }

  const devFull = devLogLossBootstrap(dev, betaFull, kodlarFull);
  const devMinus = devLogLossBootstrap(dev, betaMinus, kodlarMinus);
  const farklar: number[] = [];
  for (const y of dev) {
    const skF = y.runners.map((r) => kodlarFull.reduce((s, k) => s + betaFull[k] * r.standart[k], 0));
    const skM = y.runners.map((r) => kodlarMinus.reduce((s, k) => s + betaMinus[k] * r.standart[k], 0));
    const idx = y.runners.findIndex((r) => r.isWinner);
    const pF = softmaxHam(skF), pM = softmaxHam(skM);
    farklar.push(-Math.log(Math.max(pM[idx], 1e-9)) - -Math.log(Math.max(pF[idx], 1e-9)));
  }
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B_BOOTSTRAP; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
  dagilim.sort((a, b) => a - b);
  const lo = dagilim[Math.floor(dagilim.length * 0.025)], hi = dagilim[Math.floor(dagilim.length * 0.975)];

  console.log(`\nDEV logloss — FULL(refit)=${devFull.nokta.toFixed(5)}  FULL-minus-${hedefKod}(refit)=${devMinus.nokta.toFixed(5)}`);
  console.log(`REFIT-AWARE ΔLL(DEV, paired) = ${nokta.toFixed(5)}  95%GA=[${lo.toFixed(5)},${hi.toFixed(5)}]  ${lo > 0 && hi > 0 ? "★ refit sonrası da anlamlı değerli" : lo < 0 && hi < 0 ? "★ refit sonrası ANLAMLI ZARARLI" : "(anlamsız — GA sıfırı içeriyor)"}`);
}

// ─── 3. Hız drift/PSI/coverage ──────────────────────────────────────────────

function psi(ref: number[], cur: number[], binSayisi = 5): number {
  const tumDeger = [...ref, ...cur].sort((a, b) => a - b);
  const binSinirlari: number[] = [];
  for (let i = 1; i < binSayisi; i++) binSinirlari.push(tumDeger[Math.floor((i / binSayisi) * tumDeger.length)]);
  const binIndex = (v: number) => { let i = 0; while (i < binSinirlari.length && v > binSinirlari[i]) i++; return i; };
  const refSayim = new Array(binSayisi).fill(0), curSayim = new Array(binSayisi).fill(0);
  for (const v of ref) refSayim[binIndex(v)]++;
  for (const v of cur) curSayim[binIndex(v)]++;
  let toplamPsi = 0;
  for (let i = 0; i < binSayisi; i++) {
    const refOran = Math.max(refSayim[i] / ref.length, 1e-4), curOran = Math.max(curSayim[i] / cur.length, 1e-4);
    toplamPsi += (curOran - refOran) * Math.log(curOran / refOran);
  }
  return toplamPsi;
}

function hizDriftRaporu(digerYarislari: RaceRec[]) {
  const tumRunner = digerYarislari.flatMap((y) => y.runners.map((r) => ({ ...r, date: y.date, distance: y.distance, surface: y.surface })));
  const kodTuru = "hizDerecesi" as Kod;

  // Missing/zero oranı
  const aktifOlmayan = tumRunner.filter((r) => !r.aktif[kodTuru]).length;
  console.log(`Missing/sıfır-katkı oranı ("Diğer"de): ${aktifOlmayan}/${tumRunner.length} (%${((aktifOlmayan / tumRunner.length) * 100).toFixed(1)})`);

  // Surface x distance bucket coverage
  console.log("\nYüzey × Mesafe-dilimi kapsama tablosu:");
  const gruplar = new Map<string, { n: number; aktif: number }>();
  for (const r of tumRunner) {
    const key = `${r.surface} / ${mesafeDilimi(r.distance)}`;
    const g = gruplar.get(key) ?? { n: 0, aktif: 0 };
    g.n++; if (r.aktif[kodTuru]) g.aktif++;
    gruplar.set(key, g);
  }
  for (const [key, g] of [...gruplar.entries()].sort((a, b) => b[1].n - a[1].n)) {
    console.log(`   ${key.padEnd(20)} n=${g.n}  aktif=%${((g.aktif / g.n) * 100).toFixed(0)}`);
  }

  // Zaman bloklarına göre raw/z + işaret kararlılığı (1-D β_hiz refit, diğer skor SABİT)
  console.log("\nZaman bloklarına göre (kronolojik 4'e bölünmüş) raw/z + 1-D β_hiz:");
  const siraliTarihler = [...new Set(digerYarislari.map((y) => y.date))].sort((a, b) => a - b);
  const blokSayisi = 4;
  const blokSinirlari = Array.from({ length: blokSayisi - 1 }, (_, i) => siraliTarihler[Math.floor(((i + 1) / blokSayisi) * siraliTarihler.length)]);
  const blokIndex = (t: number) => { let i = 0; while (i < blokSinirlari.length && t >= blokSinirlari[i]) i++; return i; };

  const bloklar: RaceRec[][] = Array.from({ length: blokSayisi }, () => []);
  for (const y of digerYarislari) bloklar[blokIndex(y.date)].push(y);

  for (let b = 0; b < blokSayisi; b++) {
    const yarislar = bloklar[b];
    if (yarislar.length < 10) { console.log(`   Blok ${b + 1}: n=${yarislar.length} (çok küçük, atlandı)`); continue; }
    const runnerlar = yarislar.flatMap((y) => y.runners);
    const hamDegerler = runnerlar.map((r) => r.ham[kodTuru]);
    const zDegerler = runnerlar.map((r) => r.standart[kodTuru]);
    const ort = (xs: number[]) => xs.reduce((a, c) => a + c, 0) / xs.length;

    // 1-D β_hiz: diğer 12 sinyalin katkısı SABİT (production katkı), yalnız hiz'in
    // standardize değerine β fit edilir — "bu blokta Hız'ın işareti ne yöne gidiyor"
    const digerKodlar = A_KODLARI.filter((k) => k !== kodTuru);
    let merkez = 0, aralik = 2, adim = 0.2, enIyiLL = -Infinity, enIyi = 0;
    for (let tur = 0; tur < 3; tur++) {
      enIyiLL = -Infinity;
      for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
        let ll = 0;
        for (const y of yarislar) {
          const sk = y.runners.map((r) => digerKodlar.reduce((s, k) => s + r.katki[k], 0) + g * r.standart[kodTuru]);
          const idx = y.runners.findIndex((r) => r.isWinner);
          ll += Math.log(Math.max(softmaxHam(sk)[idx], 1e-9));
        }
        if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
      }
      merkez = enIyi; aralik = adim * 2; adim = adim / 10;
    }
    console.log(`   Blok ${b + 1} (n yarış=${yarislar.length}, ${new Date(yarislar[0].date).toISOString().slice(0, 10)}→${new Date(yarislar[yarislar.length - 1].date).toISOString().slice(0, 10)}): ham ort=${ort(hamDegerler).toFixed(2)}  z ort=${ort(zDegerler).toFixed(2)}  1-D β_hiz(bu blok)=${merkez.toFixed(4)}`);
  }

  // PSI: ilk yarı vs ikinci yarı
  const yari = Math.floor(tumRunner.length / 2);
  const siraliZaman = [...tumRunner].sort((a, b) => a.date - b.date);
  const ilkYari = siraliZaman.slice(0, yari).map((r) => r.standart[kodTuru]);
  const ikinciYari = siraliZaman.slice(yari).map((r) => r.standart[kodTuru]);
  console.log(`\nPSI (ilk yarı vs ikinci yarı, standardize Hız Derecesi dağılımı): ${psi(ilkYari, ikinciYari).toFixed(4)}  (>0.25 ciddi kayma, 0.1-0.25 orta, <0.1 ihmal edilebilir — yaygın kullanılan kaba kılavuz)`);
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
