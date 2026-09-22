// ROTAGANYAN Research Harness R2 — çekirdek (KALICI ARAÇ, 2026-09-22).
// arac-yeni-sinyal-challenger-test.mts'teki KANITLANMIŞ matematiği (hesaplaSV546,
// trainBeta, softmax, bootstrap) BİREBİR taşır — yeniden icat EDİLMEDİ, yalnız
// reusable modüle çıkarıldı ki her yeni aday için yeni arac-xxx.mts yazmayalım.
// Bu dosya SAF hesaplama katmanı — orkestrasyon (QC/DEV/CONFIRM aşamaları)
// research-harness-pipeline.mts'te.
import {
  agirlikSetleriIcinKategori,
  harmanliSkorla,
  bKatmaniUygula,
  toFeatureVector,
  type Faz1RunnerV5,
} from "./src/lib/methodology/v5-engine";

export type Row = {
  raceId: string; runnerId: string; no: number; win: 0 | 1; kategori: string;
  [k: string]: unknown;
};

export type RaceGroup = { raceId: string; kategori: string; raceDayId: string; runners: Row[] };

/** hesaplaSV546'nın (toFeatureVector üzerinden) OKUDUĞU r.yakinsama2Plus alanını doldurur
 *  — arac-yeni-sinyal-challenger-test.mts'teki BİREBİR aynı fonksiyon. KRİTİK: bu ÇAĞRILMAZSA
 *  yakinsama2Plus undefined kalır → toFeatureVector NaN üretir → TÜM skorlama NaN'a poisoning
 *  olur (bkz. J1'in generator'ındaki aynı sınıf bug, arac-jokey-form-generator.mts). Her
 *  RaceGroup'un runners dizisi hesaplaSV546'dan ÖNCE bu fonksiyondan geçmeli. */
export function yakinsama2PlusEkle(runners: Row[]) {
  const sireSirali = [...runners].sort((a, b) => ((b.sireOrani as number) ?? 0) - ((a.sireOrani as number) ?? 0));
  const sireRankOf = new Map(sireSirali.map((r, i) => [r, i + 1]));
  for (const r of runners) {
    const pistUzmaniPoz = (r.pistUzmani ?? 0) === 1;
    const sirePoz = (sireRankOf.get(r) ?? 999) <= 2;
    const ajiPoz = (r.ajiGalibiyetVarMi ?? 0) === 1;
    const agfTrendPoz = ((r.agfFark as number) ?? 0) >= 1.0;
    const sinifDususuPoz = (r.sinifDususu ?? 0) === 1;
    const sayi = [pistUzmaniPoz, sirePoz, ajiPoz, agfTrendPoz, sinifDususuPoz].filter(Boolean).length;
    r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
  }
}

export type Aday = {
  id: string; // CLI'dan --candidate ile seçilir, benzersiz
  ad: string;
  hesapla: (runners: Row[]) => number[];
  /** dahilMi=false olan satırlar standardizasyon istatistiğini KİRLETMEZ, KESİN 0 alır
   *  (bkz. arac-yeni-sinyal-challenger-test.mts'teki AYNI kritik not — 2026-09-17 düzeltmesi). */
  dahilMi?: (runners: Row[]) => boolean[];
};

const ZEMIN_TOLERANSI_IDX = 8;
const HIZ_DERECESI_IDX = 6;

export function hesaplaSV546(runners: Row[], kategori: string, sireHaric = false, zeminHaric = false, hizHaric = false): number[] {
  const setler = agirlikSetleriIcinKategori(kategori);
  const harmanlar = runners.map((r) => harmanliSkorla(toFeatureVector(r as unknown as Faz1RunnerV5), setler));
  const skorlarHam = harmanlar.map((h) => h.skor - (zeminHaric ? h.katkilar[ZEMIN_TOLERANSI_IDX] : 0) - (hizHaric ? h.katkilar[HIZ_DERECESI_IDX] : 0));
  const runnersDoldurulmus = runners.map((r) => ({ ...r, zeminMesafeDeneyimSeviyesi: (r.zeminMesafeDeneyim as number) !== 0 ? "tam" : "yok" }));
  const sahteClassType = kategori === "1a" || kategori === "1b" ? "MAIDEN" : kategori === "2" ? "Handikap 1" : "ŞARTLI 3";
  const { skorlar, sireKatkilar } = bKatmaniUygula(skorlarHam, runnersDoldurulmus as unknown as Faz1RunnerV5[], sahteClassType);
  return sireHaric ? skorlar.map((s, i) => s - sireKatkilar[i]) : skorlar;
}

export function softmax(scores: number[]): number[] {
  const max = Math.max(...scores);
  const exps = scores.map((s) => Math.exp(s - max));
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}

export function groupByRace(rows: Row[]): { raceId: string; kategori: string; runners: Row[] }[] {
  const byRace = new Map<string, Row[]>();
  for (const r of rows) {
    const arr = byRace.get(r.raceId) ?? [];
    arr.push(r);
    byRace.set(r.raceId, arr);
  }
  return [...byRace.entries()].map(([raceId, runners]) => ({ raceId, kategori: runners[0].kategori as string, runners }));
}

export function mulberry32(a: number) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export function bootstrapResample<T>(arr: T[], rng: () => number): T[] {
  const n = arr.length;
  const out = new Array<T>(n);
  for (let i = 0; i < n; i++) out[i] = arr[Math.floor(rng() * n)];
  return out;
}
export function percentile(sorted: number[], p: number): number {
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}

export type PreparedGroup = { s0: number[]; z: number[]; winnerIdx: number; raceDayId: string };

export function trainBeta(
  gruplar: { s0: number[]; z: number[]; winnerIdx: number }[],
  opts: { epochs: number; lr: number; l2: number; momentum: number }
): number {
  let beta = 0;
  let velocity = 0;
  const { epochs, lr, l2, momentum } = opts;
  for (let epoch = 0; epoch < epochs; epoch++) {
    let grad = 0;
    for (const g of gruplar) {
      const scores = g.s0.map((s, i) => s + beta * g.z[i]);
      const probs = softmax(scores);
      for (let i = 0; i < g.z.length; i++) grad += (probs[i] - (i === g.winnerIdx ? 1 : 0)) * g.z[i];
    }
    grad = grad / gruplar.length + 2 * l2 * beta;
    velocity = momentum * velocity - lr * grad;
    beta += velocity;
  }
  return beta;
}

export function logLossOf(gruplar: { s0: number[]; z: number[]; winnerIdx: number }[], beta: number): number {
  let sum = 0;
  for (const g of gruplar) {
    const scores = g.s0.map((s, i) => s + beta * g.z[i]);
    const probs = softmax(scores);
    sum += -Math.log(Math.max(probs[g.winnerIdx], 1e-12));
  }
  return sum / gruplar.length;
}
export function logLossOfBaseline(gruplar: { s0: number[]; winnerIdx: number }[]): number {
  let sum = 0;
  for (const g of gruplar) {
    const probs = softmax(g.s0);
    sum += -Math.log(Math.max(probs[g.winnerIdx], 1e-12));
  }
  return sum / gruplar.length;
}

/** Bir aday için hazır (s0, standardize edilmiş z, winnerIdx) grupları üretir. mean/std
 *  YALNIZ standardizeKaynagi'ndeki (genelde TRAIN) dahil=true satırlarından hesaplanır —
 *  KRİTİK kural, arac-yeni-sinyal-challenger-test.mts'teki 2026-09-17 düzeltmesiyle AYNI. */
export function hazirlaVeStandardize(
  aday: Aday,
  standardizeKaynagi: RaceGroup[],
  hedefGruplar: RaceGroup[],
  sireHaric = false, zeminHaric = false, hizHaric = false
): PreparedGroup[] {
  function ham(gruplar: RaceGroup[]) {
    return gruplar
      .map((g) => {
        const s0 = hesaplaSV546(g.runners, g.kategori, sireHaric, zeminHaric, hizHaric);
        const zHam = aday.hesapla(g.runners);
        const dahil = aday.dahilMi ? aday.dahilMi(g.runners) : g.runners.map(() => true);
        const winnerIdx = g.runners.findIndex((r) => r.win === 1);
        return { s0, zHam, dahil, winnerIdx, raceDayId: g.raceDayId };
      })
      .filter((g) => g.winnerIdx >= 0);
  }
  const kaynakHam = ham(standardizeKaynagi);
  const dahilZ = kaynakHam.flatMap((g) => g.zHam.filter((_, i) => g.dahil[i]));
  const zMean = dahilZ.length > 0 ? dahilZ.reduce((a, b) => a + b, 0) / dahilZ.length : 0;
  const zStd = dahilZ.length > 0 ? Math.sqrt(dahilZ.reduce((a, b) => a + (b - zMean) ** 2, 0) / dahilZ.length) : 0;
  function standardize(zHam: number[], dahil: boolean[]): number[] {
    return zHam.map((z, i) => (dahil[i] && zStd > 1e-9 ? (z - zMean) / zStd : 0));
  }
  const hedefHam = standardizeKaynagi === hedefGruplar ? kaynakHam : ham(hedefGruplar);
  return hedefHam.map((g) => ({ s0: g.s0, z: standardize(g.zHam, g.dahil), winnerIdx: g.winnerIdx, raceDayId: g.raceDayId }));
}
