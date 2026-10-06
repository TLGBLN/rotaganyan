// V5.46_Acc challenger — walk-forward karşılaştırması (M0..M4), aynı fold'larda.
// M0 = V5.46 özellikleri REFIT (eksik = 0, V5.46 standardizasyonu; tempoTasimaGucu dahil — eski blok)
// M1 = M0 + ClosingConsistency     (eksik → katkı 0; katkı = reliability · z)
// M2 = M1 + LateSegmentSpeed
// M3 = M2 + SpeedResidual
// M4 = M3 − tempoTasimaGucu − yarisGidisatiSkoru + PaceFit (H_a × F_b, 36 interaction, yalnız TRAIN'de öğrenilir)
// Fold'lar (expanding, Accurace dönemi = 2026-07-01+):
//   F1: TRAIN = Temmuz, TEST = Ağustos
//   F2: TRAIN = Temmuz–Ağustos, TEST = Eylül (10 gün)
// Standardizasyon ve W yalnız her fold'un TRAIN bölümünden. Hiperparametre test'e bakılarak seçilmez.
// Referans (ayrı satır): M0_full = aynı fold'lar, eğitim tüm geçmiş (Ocak+).
import { readFileSync, writeFileSync } from "node:fs";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows = JSON.parse(readFileSync(`${S}/model-veri-yg4.json`, "utf8"));
const tarih = JSON.parse(readFileSync(`${S}/race-tarih.json`, "utf8"));
const acc = JSON.parse(readFileSync(`${S}/accurace-tum-ozellik.json`, "utf8"));
const ACC_BASLANGIC = "2026-07-01";

// ── Yarış kümeleri ──────────────────────────────────────────────
const byRace = new Map();
for (const r of rows) {
  if (!tarih[r.raceId]) continue;
  if (!byRace.has(r.raceId)) byRace.set(r.raceId, { raceId: r.raceId, tarih: tarih[r.raceId], rows: [] });
  byRace.get(r.raceId).rows.push(r);
}
// Yakınsama (eğitim betiğiyle birebir): ≥2 of {pistUzmani, sireTop2, ajiGalibiyet, agfFark≥1, sinifDususu}
for (const y of byRace.values()) {
  const sirali = [...y.rows].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
  const sireRank = new Map(sirali.map((r, i) => [r, i + 1]));
  for (const r of y.rows) {
    const sayi = [(r.pistUzmani ?? 0) === 1, sireRank.get(r) <= 2, (r.ajiGalibiyetVarMi ?? 0) === 1,
      (r.agfFark ?? 0) >= 1.0, (r.sinifDususu ?? 0) === 1].filter(Boolean).length;
    r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
  }
}
const tumYarislar = [...byRace.values()]
  .filter((y) => y.rows.some((x) => x.win === 1) && y.rows.length >= 4)
  .sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
for (const y of tumYarislar) {
  const k = y.rows[0].kategori;
  y.segment = (k === "1a" || k === "1b") ? "dusuk" : k === "2" ? "handikap" : "diger";
}

const ay = (t) => t.slice(0, 7);
const acc_ = (r, f) => acc[`${r.raceId}|${r.runnerId}`]?.[f] ?? null;

// ── Özellik tanımları ───────────────────────────────────────────
const BASE = ["agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru", "tempoTasimaGucu"];
const EKSIK0 = new Set(["hizDerecesi", "zeminToleransi", "agfPayi", "agfPayi2"]); // V5.46 standardizasyonu: eksik = 0
function baseRaw(r) {
  const p = r.agfPayi ?? 0;
  return [r.agfSirasi, r.idmJokey, r.jokeyOrani, r.antrenorOrani, p, r.h2hNetSkor ?? 0, r.hizDerecesi ?? 0,
    p * p, r.zeminToleransi ?? 0, r.yakinsama2Plus ?? 0, r.sonIdmanSprint ?? 0,
    (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0), r.yarisGidisatiSkoru ?? 0, r.tempoTasimaGucu ?? 0];
}
const BASE_IDX_M4 = BASE.map((_, i) => i).filter((i) => BASE[i] !== "tempoTasimaGucu" && BASE[i] !== "yarisGidisatiSkoru");

// Model spec: base sütun indeksleri + hangi Accurace blokları + PaceFit
const SPEC = {
  M0: { base: BASE.map((_, i) => i), acc: [], pace: false },
  M1: { base: BASE.map((_, i) => i), acc: ["c"], pace: false },
  M2: { base: BASE.map((_, i) => i), acc: ["c", "l"], pace: false },
  M3: { base: BASE.map((_, i) => i), acc: ["c", "l", "s"], pace: false },
  M4a: { base: BASE_IDX_M4, acc: ["c", "l", "s"], pace: false }, // ayrıştırma: eski blokların çıkarılması, PaceFit yok
  M4: { base: BASE_IDX_M4, acc: ["c", "l", "s"], pace: true },
};
const ACC_KEY = { c: ["c", "cR"], l: ["l", "lR"], s: ["s", "sR"] };

// Blok ham değerleri: {x, r} — x null ise eksik
function accVals(r) {
  const out = {};
  for (const k of ["c", "l", "s"]) out[k] = { x: acc_(r, k), r: acc_(r, ACC_KEY[k][1]) ?? 0 };
  return out;
}
function paceRaw(r) {
  const H = acc_(r, "h"), F = acc_(r, "f");
  const rh = acc_(r, "hR") ?? 0;
  if (!H || !F) return null;
  const out = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) out.push(H[a] * F[b]);
  return { v: out, rh };
}

// Standardizasyon: yalnız TRAIN satırlarından
function fitNorm(train, spec) {
  const d = spec.base.length;
  const mu = new Array(d).fill(0), sd = new Array(d).fill(1);
  let nAll = 0;
  for (const y of train) for (const r of y.rows) {
    const v = baseRaw(r); nAll++;
    spec.base.forEach((bi, j) => { mu[j] += v[bi]; });
  }
  spec.base.forEach((bi, j) => { mu[j] /= nAll; });
  for (const y of train) for (const r of y.rows) {
    const v = baseRaw(r);
    spec.base.forEach((bi, j) => { sd[j] += (v[bi] - mu[j]) ** 2; });
  }
  spec.base.forEach((bi, j) => { sd[j] = Math.sqrt(sd[j] / nAll) || 1; });

  const accN = {};
  for (const k of spec.acc) {
    let s = 0, s2 = 0, n = 0;
    for (const y of train) for (const r of y.rows) { const x = acc_(r, k); if (x != null) { s += x; n++; } }
    const m = n ? s / n : 0;
    for (const y of train) for (const r of y.rows) { const x = acc_(r, k); if (x != null) s2 += (x - m) ** 2; }
    accN[k] = { m, sd: n ? Math.sqrt(s2 / n) || 1 : 1 };
  }
  let paceN = null;
  if (spec.pace) {
    const sumv = new Array(36).fill(0), sq = new Array(36).fill(0);
    let n = 0;
    for (const y of train) for (const r of y.rows) { const p = paceRaw(r); if (!p) continue; n++; p.v.forEach((x, i) => { sumv[i] += x; }); }
    const m = sumv.map((x) => (n ? x / n : 0));
    for (const y of train) for (const r of y.rows) { const p = paceRaw(r); if (!p) continue; p.v.forEach((x, i) => { sq[i] += (x - m[i]) ** 2; }); }
    paceN = { m, sd: sq.map((x) => (n ? Math.sqrt(x / n) || 1 : 1)) };
  }
  return { mu, sd, accN, paceN };
}

// Tasarım vektörü
function design(r, spec, nm) {
  const v = baseRaw(r);
  const x = spec.base.map((bi, j) => (v[bi] - nm.mu[j]) / (nm.sd[j] || 1));
  for (const k of spec.acc) {
    const { x: raw, r: rel } = accVals(r)[k];
    x.push(raw == null ? 0 : rel * (raw - nm.accN[k].m) / nm.accN[k].sd);
  }
  if (spec.pace) {
    const p = paceRaw(r);
    if (!p) for (let i = 0; i < 36; i++) x.push(0);
    else p.v.forEach((val, i) => x.push(p.rh * (val - nm.paceN.m[i]) / nm.paceN.sd[i]));
  }
  return x;
}

function softmax(s) { const m = Math.max(...s); const e = s.map((t) => Math.exp(t - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((t) => t / z); }

// V5.46 ile aynı optimizasyon: momentum GD, 800 epoch, lr 0.08, momentum 0.9, l2 0.01 (race-ortalamalı gradyan)
function egit(train, spec, nm) {
  const gr = train.map((y) => ({ x: y.rows.map((r) => design(r, spec, nm)), w: y.rows.findIndex((r) => r.win === 1) }));
  const d = gr[0].x[0].length;
  const w = new Array(d).fill(0), vel = new Array(d).fill(0);
  for (let ep = 0; ep < 800; ep++) {
    const g = new Array(d).fill(0);
    for (const q of gr) {
      const p = softmax(q.x.map((f) => f.reduce((s, xi, i) => s + xi * w[i], 0)));
      for (let i = 0; i < q.x.length; i++) {
        const c = p[i] - (i === q.w ? 1 : 0);
        for (let k = 0; k < d; k++) g[k] += c * q.x[i][k];
      }
    }
    for (let k = 0; k < d; k++) {
      const gk = g[k] / gr.length + 2 * 0.01 * w[k];
      vel[k] = 0.9 * vel[k] - 0.08 * gk;
      w[k] += vel[k];
    }
  }
  return w;
}

function degerlendir(test, spec, nm, w) {
  return test.map((y) => {
    const x = y.rows.map((r) => design(r, spec, nm));
    const p = softmax(x.map((f) => f.reduce((s, xi, i) => s + xi * w[i], 0)));
    const wi = y.rows.findIndex((r) => r.win === 1);
    const order = [...p.keys()].sort((a, b) => p[b] - p[a]);
    const rank = order.indexOf(wi) + 1;
    return {
      raceId: y.raceId, tarih: y.tarih, segment: y.segment,
      nll: -Math.log(Math.max(p[wi], 1e-15)),
      brier: p.reduce((s, pi, i) => s + (pi - (i === wi ? 1 : 0)) ** 2, 0) / p.length,
      top1: rank <= 1 ? 1 : 0, top3: rank <= 3 ? 1 : 0, top6: rank <= 6 ? 1 : 0,
      rr: 1 / rank, rank, n: p.length,
    };
  });
}

// Fold çalıştırıcı: spec, eğitim seti, test seti
function run(specAd, spec, train, test) {
  const nm = fitNorm(train, spec);
  const w = egit(train, spec, nm);
  return degerlendir(test, spec, nm, w);
}

const T_AUG = tumYarislar.filter((y) => ay(y.tarih) === "2026-08");
const T_SEP = tumYarislar.filter((y) => ay(y.tarih) === "2026-09");
const TR_JUL = tumYarislar.filter((y) => ay(y.tarih) === "2026-07");
const TR_JUL_AUG = tumYarislar.filter((y) => y.tarih >= ACC_BASLANGIC && y.tarih < "2026-09-01");
const TR_ALL_AUG = tumYarislar.filter((y) => y.tarih < "2026-08-01");
const TR_ALL_SEP = tumYarislar.filter((y) => y.tarih < "2026-09-01");

const sonuc = {};
for (const ad of Object.keys(SPEC)) {
  const a = run(ad, SPEC[ad], TR_JUL, T_AUG);
  const b = run(ad, SPEC[ad], TR_JUL_AUG, T_SEP);
  sonuc[ad] = [...a, ...b];
  console.error(`done ${ad}`);
}
// Referans: M0 tüm geçmişle eğitilmiş (Ocak+), aynı test yarışları
{
  const a = run("M0_full", SPEC.M0, TR_ALL_AUG, T_AUG);
  const b = run("M0_full", SPEC.M0, TR_ALL_SEP, T_SEP);
  sonuc.M0_full = [...a, ...b];
}

// ── Metrikler ──────────────────────────────────────────────────
let seed = 20261006;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const B = 5000;
function ci(values) { const s = [...values].sort((x, y) => x - y); return [s[Math.floor(0.025 * B)], s[Math.floor(0.975 * B)]]; }

const testRaceIds = [...new Set(sonuc.M0.map((x) => x.raceId))];
const testDates = {};
for (const x of sonuc.M0) testDates[x.raceId] = x.tarih;
const gunler = [...new Set(testRaceIds.map((id) => testDates[id]))];
const byRaceRes = (ad) => new Map(sonuc[ad].map((x) => [x.raceId, x]));

function bootRace(farklar) {
  const n = farklar.length; const out = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += farklar[Math.floor(rnd() * n)]; out.push(s / n); }
  return ci(out);
}
function bootDay(idsByDay, farkMap) {
  const out = [];
  for (let b = 0; b < B; b++) {
    let s = 0, n = 0;
    for (let i = 0; i < gunler.length; i++) {
      const g = gunler[Math.floor(rnd() * gunler.length)];
      for (const id of idsByDay[g]) { s += farkMap.get(id); n++; }
    }
    out.push(n ? s / n : 0);
  }
  return ci(out);
}

function ozetle(ad, ids, base) {
  const m = byRaceRes(ad);
  const xs = ids.map((id) => m.get(id)).filter(Boolean);
  const mean = (f) => xs.reduce((s, x) => s + f(x), 0) / xs.length;
  const out = {
    N: xs.length,
    LogLoss: +mean((x) => x.nll).toFixed(5),
    Brier: +mean((x) => x.brier).toFixed(5),
    Top1: +mean((x) => x.top1).toFixed(4),
    Top3: +mean((x) => x.top3).toFixed(4),
    Top6: +mean((x) => x.top6).toFixed(4),
    MRR: +mean((x) => x.rr).toFixed(4),
    MeanRank: +mean((x) => x.rank).toFixed(3),
  };
  if (base && ad !== base) {
    const mb = byRaceRes(base);
    const fark = new Map(xs.map((x) => [x.raceId, x.nll - mb.get(x.raceId).nll]));
    const ids2 = [...fark.keys()];
    out.dLL = +mean((x) => fark.get(x.raceId)).toFixed(5);
    out.CI_race = bootRace(ids2.map((id) => fark.get(id))).map((v) => +v.toFixed(5));
    const idsByDay = {};
    for (const id of ids2) { const g = testDates[id]; (idsByDay[g] ??= []).push(id); }
    const farkMap = new Map(ids2.map((id) => [id, fark.get(id)]));
    out.CI_day = bootDay(idsByDay, farkMap).map((v) => +v.toFixed(5));
  }
  return out;
}

const segmentler = ["hepsi", "dusuk", "handikap", "diger"];
const rapor = {};
for (const seg of segmentler) {
  const ids = testRaceIds.filter((id) => seg === "hepsi" || byRaceRes("M0").get(id).segment === seg);
  rapor[seg] = {};
  for (const ad of ["M0", "M1", "M2", "M3", "M4a", "M4", "M0_full"]) rapor[seg][ad] = ozetle(ad, ids, "M0");
}
const testSatirlari = [...T_AUG, ...T_SEP].flatMap((y) => y.rows);
const yuzde = (f) => +(100 * testSatirlari.filter(f).length / testSatirlari.length).toFixed(1);
const kapsam = {
  testYarisToplam: testRaceIds.length,
  egitimYarisF1: TR_JUL.length, egitimYarisF2: TR_JUL_AUG.length,
  testSatirKapsami: {
    closing: yuzde((r) => acc_(r, "c") != null),
    lateSeg: yuzde((r) => acc_(r, "l") != null),
    speed: yuzde((r) => acc_(r, "s") != null),
    styleVec: yuzde((r) => acc_(r, "h") != null),
    paceFitOrtak: yuzde((r) => acc_(r, "h") != null && acc_(r, "f") != null),
  },
};
writeFileSync(`${S}/v546acc-wf-sonuc.json`, JSON.stringify({ rapor, kapsam }, null, 1));
console.log(JSON.stringify({ kapsam, rapor }, null, 1));
