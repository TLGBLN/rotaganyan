import { db } from "./src/lib/db";
import { gatherFaz1V5 } from "./src/lib/methodology/v5-engine";

// V6 sinyal araştırması (2026-08-29) — kullanıcı talebi: "bence her sinyali ayrı ayrı test et
// sana verdiğim her şey". Bugün 23→12 özelliğe budanırken çıkarılan sinyaller (accurace,
// formEgimi/2, kgs/kgs2, pistUzmani, galop, uzunAraGalopKatkisi, agfYukselisVarMi/
// agfDususVarMi) TEK TEK, V5'in canlıya alındığı 2026-08-16'dan bugüne kadarki 249 gerçek
// (Karma hariç) koşuyla, AYNI B=500 tek-değişkenli yöntemle (bkz. sireOrani/damOrani/takı
// değişikliği testleri) yeniden test ediliyor — pedigri dersinin (tek başına anlamlı olabilir
// ama zaten dolaylı yakalanıyor olabilir) her aday için ayrı ayrı doğrulanması için.
const V5_BASLANGIC = new Date("2026-08-16T00:00:00+03:00");
const ANLAMLI_PUAN_ESIGI = 1.0;

function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

function trainConditionalLogit(raceGroups: { features: number[][]; winnerIdx: number }[], dim: number): number[] {
  const epochs = 800, lr = 0.08, l2 = 0.01, momentum = 0.9;
  let w = new Array(dim).fill(0);
  let velocity = new Array(dim).fill(0);
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

function bootstrapResample<T>(arr: T[]): T[] {
  const n = arr.length;
  const out: T[] = new Array(n);
  for (let i = 0; i < n; i++) out[i] = arr[Math.floor(Math.random() * n)];
  return out;
}

function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

// Standartlaştırma OLMADAN ham değer kullanılırsa büyük ölçekli alanlar (kgs: 0-100+ gün,
// formEgimi: küçük ondalık) bootstrap'ta karşılaştırılamaz katsayılar üretir — B=500'ün
// KENDİ İÇİNDE (aynı özellik, farklı resample'lar arası) tutarlı olması yeterli olduğu için
// bu tek-değişkenli testte standartlaştırma ZORUNLU DEĞİL (yalnız katsayı büyüklüğünü değil,
// GA'nın sıfırı içerip içermediğini önemsiyoruz) — ama gün farkı gibi büyük skalalı alanlarda
// gradyan patlamasını önlemek için yine de standartlaştırıyoruz.
function standardizeSingle(values: number[]): number[] {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
  const std = Math.sqrt(variance);
  if (std < 1e-9) return values.map(() => 0);
  return values.map((v) => (v - mean) / std);
}

async function main() {
  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: { date: { gte: V5_BASLANGIC }, hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } },
      runners: { some: {} },
    },
    select: { id: true, result: { select: { actualOrder: true } } },
  });
  console.log(`Toplam aday koşu: ${races.length}`);

  type Ham = {
    accurace: number; formEgimi: number; kgsVarMi: number; kgs: number; pistUzmani: number;
    sireOrani: number; galop: number; uzunAraGalopKatkisi: number; agfFark: number;
  };
  const raceRows: { winnerIdx: number; hams: Ham[] }[] = [];
  let islenen = 0, hatali = 0;

  for (const race of races) {
    const actualOrder = race.result?.actualOrder as number[] | null;
    if (!Array.isArray(actualOrder) || actualOrder.length === 0) continue;
    try {
      const faz1 = await gatherFaz1V5(race.id);
      if (!faz1 || faz1.runners.length < 2) continue;
      const winner = actualOrder[0];
      const winnerIdx = faz1.runners.findIndex((r) => r.no === winner);
      if (winnerIdx === -1) continue;

      const hams: Ham[] = faz1.runners.map((r) => ({
        accurace: r.accurace,
        formEgimi: r.formEgimi,
        kgsVarMi: r.kgsVarMi,
        kgs: r.kgsVarMi ? r.kgs : 0,
        pistUzmani: r.pistUzmani,
        sireOrani: r.sireOrani,
        galop: r.galop,
        uzunAraGalopKatkisi: r.uzunAraGalopKatkisi,
        agfFark: r.agfFark,
      }));
      raceRows.push({ winnerIdx, hams });
      islenen++;
    } catch (e) {
      hatali++;
      console.error(`hata raceId=${race.id}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`İşlenen koşu: ${islenen} (hata: ${hatali})`);

  const adaylar: { ad: string; cikar: (h: Ham) => number }[] = [
    { ad: "accurace", cikar: (h) => h.accurace },
    { ad: "formEgimi", cikar: (h) => h.formEgimi },
    { ad: "formEgimi2 (kare)", cikar: (h) => h.formEgimi * h.formEgimi },
    { ad: "kgs (ham gün farkı)", cikar: (h) => h.kgs },
    { ad: "kgs2 (kare)", cikar: (h) => h.kgs * h.kgs },
    { ad: "pistUzmani", cikar: (h) => h.pistUzmani },
    { ad: "sireOrani", cikar: (h) => h.sireOrani },
    { ad: "galop", cikar: (h) => h.galop },
    { ad: "uzunAraGalopKatkisi", cikar: (h) => h.uzunAraGalopKatkisi },
    { ad: "agfYukselisVarMi (agfFark>=1.0)", cikar: (h) => (h.agfFark >= ANLAMLI_PUAN_ESIGI ? 1 : 0) },
    { ad: "agfDususVarMi (agfFark<=-1.0)", cikar: (h) => (h.agfFark <= -ANLAMLI_PUAN_ESIGI ? 1 : 0) },
  ];

  console.log(`\n=== V5 penceresi (n=${raceRows.length} koşu) — her aday TEK TEK B=500 ===\n`);

  for (const aday of adaylar) {
    const tumDegerler = raceRows.flatMap((r) => r.hams.map(aday.cikar));
    const standart = standardizeSingle(tumDegerler);
    let idx = 0;
    const raceGroups = raceRows.map((r) => {
      const features = r.hams.map(() => [standart[idx++]]);
      return { features, winnerIdx: r.winnerIdx };
    });

    const B = 500;
    const katsayilar: number[] = [];
    for (let b = 0; b < B; b++) {
      const ornek = bootstrapResample(raceGroups);
      const w = trainConditionalLogit(ornek, 1);
      katsayilar.push(w[0]);
    }
    katsayilar.sort((a, b) => a - b);
    const nokta = katsayilar.reduce((a, b) => a + b, 0) / katsayilar.length;
    const alt = percentile(katsayilar, 0.025);
    const ust = percentile(katsayilar, 0.975);
    const anlamliMi = alt > 0 || ust < 0;

    console.log(
      `${aday.ad.padEnd(32)} nokta=${nokta.toFixed(4).padStart(8)} GA=[${alt.toFixed(4)},${ust.toFixed(4)}] ${anlamliMi ? "✓ ANLAMLI" : "⚠ sıfırı içeriyor"}`
    );
  }

  process.exit(0);
}

main();
