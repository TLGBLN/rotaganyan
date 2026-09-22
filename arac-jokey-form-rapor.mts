// KALICI ARAÇ (2026-09-22) — J1 devamı: arac-jokey-form-generator.mts'in ürettiği
// jokey-form-dataset.json'u okuyup HER biniş için D-1 as-of pencereli (90/275 gün)
// residual/Z hesaplar ve YALNIZ veri kalitesi raporunu verir — HENÜZ regresyon fit ETMEZ.
//
// QC (dondurulmuş, kullanıcı spesifikasyonu): N90>=30, N275>=60, E90>=2, E275>=4.
// As-of D-1: pencere sınırları gün-bazlı epoch farkıyla hesaplanır, ride'ın KENDİ günü
// (ve sonrası) hiçbir pencereye girmez (window90 üst sınırı D-1, window275 alt sınırı D-365).
//
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-jokey-form-rapor.mts
import { readFileSync, writeFileSync } from "fs";

const IN_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\jokey-form-dataset.json";
const OUT_PATH =
  "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\jokey-form-rapor.json";

const N90_MIN = 30, N275_MIN = 60, E90_MIN = 2, E275_MIN = 4;
const GUN_MS = 24 * 60 * 60 * 1000;

type Sonuc = {
  raceId: string; runnerId: string; tjkJokeyId: number | null; date: string; kategori: string;
  win: 0 | 1; winnerCount: number; y: number;
  pA: number; pB: number; rA: number; rB: number;
};
type Rapor = { generatedAt: string; rows: Sonuc[] };

function gunSayisi(iso: string): number {
  return Math.floor(new Date(iso + "T00:00:00.000Z").getTime() / GUN_MS);
}

type PencereSonuc = {
  N90: number; N275: number; E90: number; E275: number;
  ZA: number | null; xA: number | null; ZB: number | null; xB: number | null;
  qcPass: boolean; qcFailReasons: string[];
};

function pencereHesapla(
  jokeyRides: (Sonuc & { gun: number })[], idx: number
): PencereSonuc {
  const D = jokeyRides[idx].gun;
  const w90: (Sonuc & { gun: number })[] = [];
  const w275: (Sonuc & { gun: number })[] = [];
  for (let j = 0; j < jokeyRides.length; j++) {
    if (j === idx) continue;
    const g = jokeyRides[j].gun;
    if (g <= D - 1 && g >= D - 90) w90.push(jokeyRides[j]);
    else if (g <= D - 91 && g >= D - 365) w275.push(jokeyRides[j]);
  }
  const N90 = w90.length, N275 = w275.length;
  const E90A = w90.reduce((s, r) => s + r.pA, 0), E275A = w275.reduce((s, r) => s + r.pA, 0);
  const E90B = w90.reduce((s, r) => s + r.pB, 0), E275B = w275.reduce((s, r) => s + r.pB, 0);

  const qcFailReasons: string[] = [];
  if (N90 < N90_MIN) qcFailReasons.push("N90<30");
  if (N275 < N275_MIN) qcFailReasons.push("N275<60");
  if (E90A < E90_MIN) qcFailReasons.push("E90<2");
  if (E275A < E275_MIN) qcFailReasons.push("E275<4");
  const qcPass = qcFailReasons.length === 0;

  function hesaplaZ(rField: "rA" | "rB", pField: "pA" | "pB"): number | null {
    if (N90 === 0 || N275 === 0) return null;
    const R90 = w90.reduce((s, r) => s + r[rField], 0) / N90;
    const R275 = w275.reduce((s, r) => s + r[rField], 0) / N275;
    const SE90 = Math.sqrt(w90.reduce((s, r) => s + r[pField] * (1 - r[pField]), 0)) / N90;
    const SE275 = Math.sqrt(w275.reduce((s, r) => s + r[pField] * (1 - r[pField]), 0)) / N275;
    const denom = Math.sqrt(SE90 ** 2 + SE275 ** 2);
    if (denom < 1e-9) return null;
    return (R90 - R275) / denom;
  }
  const ZA = hesaplaZ("rA", "pA");
  const ZB = hesaplaZ("rB", "pB");
  const clip = (z: number | null) => (z == null ? null : Math.max(-3, Math.min(3, z)));

  return { N90, N275, E90: E90A, E275: E275A, ZA, xA: clip(ZA), ZB, xB: clip(ZB), qcPass, qcFailReasons };
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor(p * sorted.length)));
  return sorted[idx];
}
function istatistik(vals: number[]) {
  if (vals.length === 0) return null;
  const sorted = [...vals].sort((a, b) => a - b);
  const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
  const std = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / vals.length);
  return {
    n: vals.length, mean: +mean.toFixed(4), std: +std.toFixed(4),
    min: +sorted[0].toFixed(4), max: +sorted[sorted.length - 1].toFixed(4),
    p1: +percentile(sorted, 0.01).toFixed(4), p5: +percentile(sorted, 0.05).toFixed(4),
    p25: +percentile(sorted, 0.25).toFixed(4), p50: +percentile(sorted, 0.5).toFixed(4),
    p75: +percentile(sorted, 0.75).toFixed(4), p95: +percentile(sorted, 0.95).toFixed(4),
    p99: +percentile(sorted, 0.99).toFixed(4),
  };
}

async function main() {
  console.log("Veri okunuyor...");
  const veri: Rapor = JSON.parse(readFileSync(IN_PATH, "utf-8"));
  console.log(`  ${veri.rows.length} satır (üretim tarihi: ${veri.generatedAt})`);

  const kimlikli = veri.rows.filter((r) => r.tjkJokeyId != null);
  const byJockey = new Map<number, (Sonuc & { gun: number })[]>();
  for (const r of kimlikli) {
    const arr = byJockey.get(r.tjkJokeyId!) ?? [];
    arr.push({ ...r, gun: gunSayisi(r.date) });
    byJockey.set(r.tjkJokeyId!, arr);
  }
  for (const arr of byJockey.values()) arr.sort((a, b) => a.gun - b.gun);

  console.log(`Benzersiz jokey: ${byJockey.size}, kimlikli ride: ${kimlikli.length}`);
  console.log("Pencere hesaplamaları başlıyor...");

  type Zenginlestirilmis = Sonuc & PencereSonuc;
  const sonuclar: Zenginlestirilmis[] = [];
  let sayac = 0;
  for (const [jokeyId, rides] of byJockey) {
    for (let i = 0; i < rides.length; i++) {
      const pencere = pencereHesapla(rides, i);
      sonuclar.push({ ...rides[i], ...pencere });
      sayac++;
    }
  }
  console.log(`Toplam işlenen ride: ${sayac}`);

  // ── RAPOR ────────────────────────────────────────────────────────────────
  const qcGecen = sonuclar.filter((s) => s.qcPass);
  const qcBasarisiz = sonuclar.filter((s) => !s.qcPass);

  const failReasonCounts = new Map<string, number>();
  for (const s of qcBasarisiz) for (const r of s.qcFailReasons) failReasonCounts.set(r, (failReasonCounts.get(r) ?? 0) + 1);

  const byYear = new Map<string, { toplam: number; qcGecen: number }>();
  const bySegment = new Map<string, { toplam: number; qcGecen: number }>();
  for (const s of sonuclar) {
    const yil = s.date.slice(0, 4);
    const y = byYear.get(yil) ?? { toplam: 0, qcGecen: 0 };
    y.toplam++; if (s.qcPass) y.qcGecen++;
    byYear.set(yil, y);
    const seg = s.kategori;
    const sg = bySegment.get(seg) ?? { toplam: 0, qcGecen: 0 };
    sg.toplam++; if (s.qcPass) sg.qcGecen++;
    bySegment.set(seg, sg);
  }

  const xAVals = qcGecen.map((s) => s.xA!).filter((v) => v != null);
  const xBVals = qcGecen.map((s) => s.xB!).filter((v) => v != null);
  const clipRateA = xAVals.length > 0 ? xAVals.filter((v) => v === -3 || v === 3).length / xAVals.length : 0;
  const clipRateB = xBVals.length > 0 ? xBVals.filter((v) => v === -3 || v === 3).length / xBVals.length : 0;

  // A vs B korelasyon (Pearson)
  function pearson(a: number[], b: number[]): number {
    const n = a.length;
    const ma = a.reduce((s, v) => s + v, 0) / n, mb = b.reduce((s, v) => s + v, 0) / n;
    let cov = 0, va = 0, vb = 0;
    for (let i = 0; i < n; i++) { cov += (a[i] - ma) * (b[i] - mb); va += (a[i] - ma) ** 2; vb += (b[i] - mb) ** 2; }
    return cov / Math.sqrt(va * vb);
  }
  const abKorelasyon = xAVals.length > 1 ? pearson(xAVals, xBVals) : null;

  const siraliPozitif = [...qcGecen].sort((a, b) => (b.xA ?? -99) - (a.xA ?? -99)).slice(0, 20);
  const siraliNegatif = [...qcGecen].sort((a, b) => (a.xA ?? 99) - (b.xA ?? 99)).slice(0, 20);

  // 10 rastgele audit trace (seeded, tekrar üretilebilir)
  function mulberry32(a: number) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const rng = mulberry32(5462026);
  const auditOrnekleri: typeof qcGecen = [];
  const kullanilan = new Set<number>();
  while (auditOrnekleri.length < 10 && auditOrnekleri.length < qcGecen.length) {
    const idx = Math.floor(rng() * qcGecen.length);
    if (kullanilan.has(idx)) continue;
    kullanilan.add(idx);
    auditOrnekleri.push(qcGecen[idx]);
  }

  const rapor = {
    generatedAt: new Date().toISOString(),
    eligibleRaces: new Set(veri.rows.map((r) => r.raceId)).size,
    eligibleJockeyRides: kimlikli.length,
    uniqueJockeys: byJockey.size,
    coverageOverall: { toplam: sonuclar.length, qcGecen: qcGecen.length, oran: +((qcGecen.length / sonuclar.length) * 100).toFixed(2) },
    coverageByYear: Object.fromEntries([...byYear.entries()].map(([y, v]) => [y, { toplam: v.toplam, qcGecen: v.qcGecen, oran: +((v.qcGecen / v.toplam) * 100).toFixed(2) }])),
    coverageBySegment: Object.fromEntries([...bySegment.entries()].map(([s, v]) => [s, { toplam: v.toplam, qcGecen: v.qcGecen, oran: +((v.qcGecen / v.toplam) * 100).toFixed(2) }])),
    N90Distribution: istatistik(sonuclar.map((s) => s.N90)),
    N275Distribution: istatistik(sonuclar.map((s) => s.N275)),
    E90Distribution: istatistik(sonuclar.map((s) => s.E90)),
    E275Distribution: istatistik(sonuclar.map((s) => s.E275)),
    qcPassRate: +((qcGecen.length / sonuclar.length) * 100).toFixed(2),
    qcFailReasons: Object.fromEntries(failReasonCounts),
    jokeyFormDegisimiZ_A: istatistik(xAVals),
    jokeyFormDegisimiZ_B: istatistik(xBVals),
    clipRateA_at3: +(clipRateA * 100).toFixed(2),
    clipRateB_at3: +(clipRateB * 100).toFixed(2),
    agfIncluded_vs_marketBlind_correlation: abKorelasyon != null ? +abKorelasyon.toFixed(4) : null,
    topPositive20: siraliPozitif.map((s) => ({ tjkJokeyId: s.tjkJokeyId, date: s.date, raceId: s.raceId, xA: s.xA, N90: s.N90, N275: s.N275 })),
    topNegative20: siraliNegatif.map((s) => ({ tjkJokeyId: s.tjkJokeyId, date: s.date, raceId: s.raceId, xA: s.xA, N90: s.N90, N275: s.N275 })),
    auditTraces: auditOrnekleri.map((s) => ({
      tjkJokeyId: s.tjkJokeyId, asOfDate: s.date, N90: s.N90, N275: s.N275, E90: +s.E90.toFixed(3), E275: +s.E275.toFixed(3),
      actualWin: s.win, y: +s.y.toFixed(3), rawZ_A: s.ZA != null ? +s.ZA.toFixed(4) : null, clippedZ_A: s.xA,
    })),
  };

  writeFileSync(OUT_PATH, JSON.stringify(rapor, null, 2));
  console.log(`\nRapor kaydedildi: ${OUT_PATH}`);
  console.log(JSON.stringify(rapor, null, 2));
}
main().catch((e) => { console.error(e); process.exit(1); });
