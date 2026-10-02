// FAZ A3 — V5.46 Refit-Aware Unique Information Haritası (2026-10-02, kullanıcı tasarımı)
//
// A1 (fixed-weight magnitude/ablation) + A2 (105 çift Pair Excess Loss + blok) sonrasında,
// GERÇEKTEN bağımsız bilgi taşıyan sinyalleri bulmak için TRAIN'de yeniden fit edilmiş
// (refit-aware) ablation. Production'a HİÇ DOKUNULMADI — β'lar yalnız bu script'in kendi
// TRAIN/DEV ayrımında, teşhis amaçlı yeniden fit edildi.
//
// Kapsam (kullanıcı dondurdu — 105 çiftin TAMAMI DEĞİL):
//   A3.1: 15 sinyalin tamamı için tek-tek refit-aware ablation (GLOBAL, TRAIN/DEV)
//   A3.2: 9 ÖNCEDEN DONDURULMUŞ çift için refit-aware ablation
//   A3.3: 6 sabit blok için refit-aware ablation
//   + Market fonksiyonel ayrıştırma (Rank-only / Share-poly-only / Rank+Share) —
//     bu, A3.1'in agfSırası tekil sonucu + A3.2'nin agfPayı×agfPayı² çift sonucu +
//     FULL baseline'ın YENİDEN OKUNMASIYLA elde edilir, EK hesap GEREKMEZ.
//
// 4 sınıf (kullanıcının kendi tanımı, nedensel iddia DEĞİL — yalnız test sonucuna göre
// etiketleme): CORE (refit-aware anlamlı zarar) / SUBSTITUTABLE (fixed büyük, refit≈0) /
// MIS-CALIBRATED-UNSTABLE (fixed zararlı, refit nötr/faydalı) / UNPROVEN (ikisi de yok).
// BEŞİNCİ sınıf olarak "REMOVE" YOK — production kararı ayrı bir challenger testi gerektirir.
//
// Antrenör/Hız: A1.5'te zaten yapılmıştı (Antrenör GLOBAL havuzlanmış 13-dim, Hız yalnız
// "Diğer" 13-dim) — BURADA tutarlılık için TÜM 15 sinyal AYNI (GLOBAL, 15-dim) protokolle
// YENİDEN hesaplanıyor (evren A1.5'ten A2'ye genişledi: B-katmanı da dahil) — A1.5'in
// sayıları ayrıca KORUNUYOR (farklı bir alt-popülasyon/evren, karıştırılmaz).
import { db } from "./src/lib/db";
import { softmax, hibritMaidenSatisMi } from "./src/lib/methodology/v5-engine";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";

const B_BOOTSTRAP = 1000;
const TUM_KODLAR = [
  "agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru",
  "sireOrani", "zeminMesafeDeneyim",
] as const;
type Kod = (typeof TUM_KODLAR)[number];

const BLOKLAR: Record<string, Kod[]> = {
  Market: ["agfSirasi", "agfPayi", "agfPayi2"],
  Human: ["idmJokey", "jokeyOrani", "antrenorOrani"],
  Performance: ["h2hNetSkor", "hizDerecesi", "zeminMesafeDeneyim"],
  Context: ["zeminToleransi", "yakinsama2Plus", "yarisGidisatiSkoru"],
  Micro: ["sonIdmanSprint", "takiDegisikligi"],
  Pedigree: ["sireOrani"],
};

const DONDURULMUS_CIFTLER: [Kod, Kod, string][] = [
  ["agfSirasi", "agfPayi", "A2'nin en güçlü pozitif E'si"],
  ["agfSirasi", "agfPayi2", "Market ailesinin üçüncü bağlantısı"],
  ["agfPayi", "agfPayi2", "Çok güçlü negatif E / polynomial coupling"],
  ["agfSirasi", "antrenorOrani", "A1.5 + anlamlı pozitif E"],
  ["agfPayi", "antrenorOrani", "aynı neden"],
  ["agfSirasi", "hizDerecesi", "Hız coefficient-instability + pozitif E"],
  ["agfPayi", "hizDerecesi", "aynı neden"],
  ["jokeyOrani", "antrenorOrani", "Human içi örtüşme kontrolü"],
  ["hizDerecesi", "yarisGidisatiSkoru", "Performance/Context sınırında mekanistik ilişki"],
];

type RunnerRec = { no: number; isWinner: boolean; standart: Record<Kod, number>; katki: Record<Kod, number> };
type RaceRec = { raceId: string; date: number; segment: string; liderEsigi: number; runners: RunnerRec[] };

function segmentBelirle(classType: string): string {
  if (hibritMaidenSatisMi(classType)) return "Hibrit";
  const kat = kategoriTespit(classType);
  if (kat === "1a" || kat === "1b") return "Düşük Şart";
  if (kat === "2") return "Handikap";
  return "Diğer";
}
function liderEsigiHesaplaYerel(classType: string): number { return kategoriTespit(classType) === "2" ? 0.35 : 0.7; }

async function main() {
  console.log("1/5 — Veri yükleniyor (A1/A1.5/A2 ile AYNI kaynak)...");
  const rows: any[] = await db.$queryRawUnsafe(`
    SELECT p."featureSnapshot" as "featureSnapshot", p."runnerId" as "runnerId",
           pr."raceId" as "prediction_raceId", r."classType" as "classType", rd.date as "date",
           res."winnerNos" as "winnerNos"
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
  for (const row of rows) {
    if (!row.runnerId) continue;
    const runner = runnerById.get(row.runnerId);
    if (!runner || runner.scratched || runner.ekuriGroup != null) continue;
    const fs = row.featureSnapshot;
    const tumSinyaller: { kod: string; katki: number; standartDeger: number }[] = fs?.tumSinyaller ?? [];
    const bKatmani = fs?.bKatmani ?? {};
    const standart: Partial<Record<Kod, number>> = {}, katki: Partial<Record<Kod, number>> = {};
    for (const s of tumSinyaller) if ((TUM_KODLAR as readonly string[]).includes(s.kod)) { standart[s.kod as Kod] = s.standartDeger; katki[s.kod as Kod] = s.katki; }
    // B-katmanında ayrı standartDeğer SAKLANMIYOR (yalnız nihai katki) — bu yüzden
    // "standart" girdi olarak ÜRETİMİN KENDİ katkı değeri kullanılıyor. Refit β'sı bu
    // durumda "mevcut production katkısını kaç KATINA ölçeklemeli" sorusuna cevap verir
    // (β≈1 → mevcut haliyle doğrulanmış, β≈0 → değersiz, β<0 → yön YANLIŞ) — 0/1 bayrak
    // kullanmaktan daha ilkeli, çünkü production'ın KENDİ iç ölçeğini korur.
    katki.sireOrani = bKatmani.sireKatkisi ?? 0;
    katki.zeminMesafeDeneyim = bKatmani.zeminMesafeKatkisi ?? 0;
    standart.sireOrani = katki.sireOrani;
    standart.zeminMesafeDeneyim = katki.zeminMesafeDeneyim;
    if (TUM_KODLAR.some((k) => katki[k] == null)) continue;

    const raceId = row.prediction_raceId;
    const race = byRace.get(raceId) ?? { raceId, date: new Date(row.date).getTime(), segment: segmentBelirle(row.classType), liderEsigi: liderEsigiHesaplaYerel(row.classType), runners: [] };
    race.runners.push({ no: runner.no, isWinner: (row.winnerNos as number[]).includes(runner.no), standart: standart as Record<Kod, number>, katki: katki as Record<Kod, number> });
    byRace.set(raceId, race);
  }
  const tumYarislar = [...byRace.values()].filter((y) => y.runners.length >= 4 && y.runners.some((r) => r.isWinner)).sort((a, b) => a.date - b.date);
  const nTrain = Math.floor(tumYarislar.length * 0.7);
  const train = tumYarislar.slice(0, nTrain), dev = tumYarislar.slice(nTrain);
  console.log(`   n=${tumYarislar.length}  TRAIN=${train.length}  DEV=${dev.length}\n`);
  console.log("   NOT: B-katmanı (sireOrani/zeminMesafeDeneyim) için featureSnapshot ayrı");
  console.log("   standartDeğer SAKLAMIYOR (yalnız nihai katki) — bu ikisi için refit girdisi");
  console.log("   olarak ÜRETİMİN KENDİ katkı değeri kullanıldı (β≈1→mevcut haliyle doğrulanmış,");
  console.log("   β≈0→değersiz, β<0→yön yanlış). A-katmanının 13'ü TAM standartDeğer ile refit");
  console.log("   edildi — yalnız B-katmanı için ölçek farkı bir sınırlama olarak not edilmeli.\n");

  console.log("2/5 — FULL (15-dim) refit TRAIN'de (bir kez)...");
  const betaFull = fitWeights(train, TUM_KODLAR);
  console.log(`   FULL β: ${TUM_KODLAR.map((k) => `${k}=${betaFull[k].toFixed(3)}`).join(", ")}\n`);
  const devFullLL = dev.map((y) => loglossBeta(y, betaFull, TUM_KODLAR));

  console.log("3/5 — A3.1: 15 sinyalin tek-tek refit-aware ablation'ı...\n");
  const fixedD = hesaplaFixedD(tumYarislar); // A1/A2 ile aynı fixed-weight D_j, karşılaştırma için
  const tekilSonuclar: Record<Kod, { refitBeta: number; dRefit: { nokta: number; lo: number; hi: number }; sinif: string }> = {} as any;
  console.log("Sinyal".padEnd(20) + "FixedD_j".padStart(10) + "RefitBeta".padStart(11) + "RefitD_j".padStart(11) + "95%GA".padStart(22) + "  Sınıf");
  for (const kod of TUM_KODLAR) {
    const kodlarMinus = TUM_KODLAR.filter((k) => k !== kod);
    const betaMinus = fitWeights(train, kodlarMinus);
    const farklar = dev.map((y, i) => loglossBeta(y, betaMinus, kodlarMinus) - devFullLL[i]);
    const ci = bootstrapCI(farklar);
    const sinif = siniflandir(fixedD[kod], ci);
    tekilSonuclar[kod] = { refitBeta: betaFull[kod], dRefit: ci, sinif };
    console.log(kod.padEnd(20) + fixedD[kod].toFixed(4).padStart(10) + betaFull[kod].toFixed(3).padStart(11) + ci.nokta.toFixed(5).padStart(11) + `[${ci.lo.toFixed(5)},${ci.hi.toFixed(5)}]`.padStart(22) + "  " + sinif);
  }

  console.log("\n4/5 — A3.2: 9 dondurulmuş çift için refit-aware ablation...\n");
  for (const [j, k, neden] of DONDURULMUS_CIFTLER) {
    const kodlarMinus = TUM_KODLAR.filter((x) => x !== j && x !== k);
    const betaMinus = fitWeights(train, kodlarMinus);
    const farklar = dev.map((y, i) => loglossBeta(y, betaMinus, kodlarMinus) - devFullLL[i]);
    const ci = bootstrapCI(farklar);
    console.log(`${j} × ${k}  (${neden})`);
    console.log(`   RefitD_jk=${ci.nokta.toFixed(5)}  95%GA=[${ci.lo.toFixed(5)},${ci.hi.toFixed(5)}]  ${anlamliMi(ci) ? (ci.nokta > 0 ? "★ refit sonrası da anlamlı zarar" : "★ refit sonrası anlamlı İYİLEŞME") : "(anlamsız)"}\n`);
  }

  console.log("5/5 — A3.3: 6 sabit blok için refit-aware ablation...\n");
  for (const [blokAd, kodlar] of Object.entries(BLOKLAR)) {
    const kodlarMinus = TUM_KODLAR.filter((k) => !kodlar.includes(k));
    const betaMinus = fitWeights(train, kodlarMinus);
    const farklar = dev.map((y, i) => loglossBeta(y, betaMinus, kodlarMinus) - devFullLL[i]);
    const ci = bootstrapCI(farklar);
    console.log(`${blokAd.padEnd(14)} RefitD_block=${ci.nokta.toFixed(5)}  95%GA=[${ci.lo.toFixed(5)},${ci.hi.toFixed(5)}]  ${anlamliMi(ci) ? (ci.nokta > 0 ? "★ refit sonrası da anlamlı zarar" : "★ refit sonrası anlamlı İYİLEŞME") : "(anlamsız)"}`);
  }

  console.log("\n--- Market fonksiyonel ayrıştırma (EK hesap YOK — yukarıdakilerin yeniden okunması) ---");
  console.log(`Rank+Share (FULL, baseline)           : referans (DEV logloss=${(devFullLL.reduce((a,b)=>a+b,0)/devFullLL.length).toFixed(5)})`);
  console.log(`Share-poly-only (agfSırası çıkarılmış) : = yukarıdaki A3.1 "agfSirasi" tekil satırının RefitD_j'si`);
  console.log(`Rank-only (agfPayı+agfPayı² ikisi birden çıkarılmış) — YENİ hesap:`);
  {
    const kodlarMinus = TUM_KODLAR.filter((k) => k !== "agfPayi" && k !== "agfPayi2");
    const betaMinus = fitWeights(train, kodlarMinus);
    const farklar = dev.map((y, i) => loglossBeta(y, betaMinus, kodlarMinus) - devFullLL[i]);
    const ci = bootstrapCI(farklar);
    console.log(`   Rank-only (agfPayı+agfPayı² ikisi birden çıkarılmış): RefitD=${ci.nokta.toFixed(5)} GA=[${ci.lo.toFixed(5)},${ci.hi.toFixed(5)}]`);
  }
}

function fitWeights(train: RaceRec[], kodlar: readonly Kod[]): Record<Kod, number> {
  const beta: Record<Kod, number> = Object.fromEntries(TUM_KODLAR.map((k) => [k, 0])) as Record<Kod, number>;
  for (let tur = 0; tur < 6; tur++) {
    for (const kod of kodlar) {
      let merkez = beta[kod], aralik = 2, adim = 0.2;
      for (let k = 0; k < 3; k++) {
        let enIyi = merkez, enIyiLL = -Infinity;
        for (let g = merkez - aralik; g <= merkez + aralik + 1e-9; g += adim) {
          const deneme = { ...beta, [kod]: g };
          let ll = 0;
          for (const y of train) {
            const sk = y.runners.map((r) => kodlar.reduce((s, kk) => s + deneme[kk] * r.standart[kk], 0));
            const idx = y.runners.findIndex((r) => r.isWinner);
            ll += Math.log(Math.max(softmaxHam(sk)[idx], 1e-9));
          }
          if (ll > enIyiLL) { enIyiLL = ll; enIyi = g; }
        }
        merkez = enIyi; aralik = adim * 2; adim = adim / 10;
      }
      beta[kod] = Math.round(merkez * 10000) / 10000;
    }
  }
  return beta;
}
function softmaxHam(scores: number[]): number[] {
  const mx = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - mx));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
function loglossBeta(y: RaceRec, beta: Record<Kod, number>, kodlar: readonly Kod[]): number {
  const sk = y.runners.map((r) => kodlar.reduce((s, k) => s + beta[k] * r.standart[k], 0));
  const idx = y.runners.findIndex((r) => r.isWinner);
  return -Math.log(Math.max(softmaxHam(sk)[idx], 1e-9));
}
function bootstrapCI(farklar: number[], B = B_BOOTSTRAP): { nokta: number; lo: number; hi: number } {
  const nokta = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  const dagilim: number[] = [];
  for (let i = 0; i < B; i++) { let t = 0; for (let j = 0; j < farklar.length; j++) t += farklar[Math.floor(Math.random() * farklar.length)]; dagilim.push(t / farklar.length); }
  dagilim.sort((a, b) => a - b);
  return { nokta, lo: dagilim[Math.floor(dagilim.length * 0.025)], hi: dagilim[Math.floor(dagilim.length * 0.975)] };
}
function anlamliMi(ci: { lo: number; hi: number }): boolean { return (ci.lo > 0 && ci.hi > 0) || (ci.lo < 0 && ci.hi < 0); }

function hesaplaFixedD(yarislar: RaceRec[]): Record<Kod, number> {
  const sonuc: Partial<Record<Kod, number>> = {};
  const bos = new Set<Kod>();
  for (const kod of TUM_KODLAR) {
    const farklar = yarislar.map((y) => {
      const skFull = y.runners.map((r) => TUM_KODLAR.reduce((s, k) => s + r.katki[k], 0));
      const skMinus = y.runners.map((r) => TUM_KODLAR.reduce((s, k) => (k === kod ? s : s + r.katki[k]), 0));
      const idx = y.runners.findIndex((r) => r.isWinner);
      const pFull = softmax(skFull, y.liderEsigi)[idx], pMinus = softmax(skMinus, y.liderEsigi)[idx];
      return -Math.log(Math.max(pMinus, 1e-9)) - -Math.log(Math.max(pFull, 1e-9));
    });
    sonuc[kod] = farklar.reduce((a, b) => a + b, 0) / farklar.length;
  }
  return sonuc as Record<Kod, number>;
}

// Kullanıcının 4 sınıfı — yalnız test sonucuna göre, nedensel iddia DEĞİL.
function siniflandir(fixedD: number, refitCI: { nokta: number; lo: number; hi: number }): string {
  const fixedAnlamliPozitif = fixedD > 0.02; // kaba pratik eşik, yalnız sınıflandırma için
  const fixedAnlamliNegatif = fixedD < -0.005;
  const refitAnlamli = anlamliMi(refitCI);
  const refitPozitif = refitCI.nokta > 0;
  if (refitAnlamli && refitPozitif) return "CORE";
  if (fixedAnlamliPozitif && !refitAnlamli) return "SUBSTITUTABLE";
  if (fixedAnlamliNegatif && (!refitAnlamli || !refitPozitif)) return "MIS-CALIBRATED/UNSTABLE";
  return "UNPROVEN";
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
