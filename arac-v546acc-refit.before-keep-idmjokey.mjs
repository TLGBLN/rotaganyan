// V5.46_Acc FULL refit + katsayı denetimi (tek conditional-logit, tüm sinyaller birlikte).
// Kurallar (ÖNCEDEN BEYAN EDİLDİ, sonuca göre değiştirilmez):
//  - Tüm μ, σ, β TRAIN'den öğrenilir; eski β sabitlenmez. Ridge: l2 = 0.01 (V5.46 ile aynı).
//  - Eksik: V5.46 sürekli alanlarında 0 (V5.46 standardizasyonu); Accurace bloklarında katkı = reliability·z, eksik → 0.
//  - Walk-forward: expanding aylık fold'lar. TEST fold hiçbir norm/β/hiperparametre öğrenimine girmez.
//  - Drop-one: her sinyal grubu çıkarılıp AYNI fold'larda YENİDEN FİT edilir.
//  - Durum kuralları: UNSUPPORTED = ΔLL_drop ≤ 0 ve β işareti fold'lar arası tutarsız;
//    REDUNDANT = |ΔLL_drop| < 0.0005 ve |r| ≥ 0.5 olan başka bir grup var;
//    SHRINK = |β_yeni| < 0.5·|β_eski| (eski ağırlıklar V5.46 diger JSON'undan, standardize ölçekte);
//    KEEP = diğer durumlar (ΔLL_drop > 0).
//  - Final spec seçimi: FULL, FULL−eski tempo/gidişat, FULL−Accurace arasında OOS ortalama LogLoss en düşük olan
//    (ön-kayıtlı kural; test-fold tuning yok). Final β: seçilen spec TÜM veriyle (2026-01-01 .. son yarış) yeniden fit.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const DATA = `${S}/model-veri-v5461-FINAL.json`; // V5.46.1 frozen dataset
// Gozlem maskesi: bu sinyaller eksik olabilir. Eksik -> raw=null, z=0 (gercek 0 ile karistirilmaz).
const OBS = ["h2hNetSkor", "hizDerecesi", "sonIdmanSprint", "takiDegisikligi"];
const obsOf = (r, c) => (OBS.includes(c) ? (r.sinyalDurum?.[c]?.observed === true) : true);
const rows = JSON.parse(readFileSync(DATA, "utf8"));
const tarih = JSON.parse(readFileSync(`${S}/race-tarih-v2.json`, "utf8"));
const ACCF = `${S}/accurace-tum-ozellik.json`;
const acc = JSON.parse(readFileSync(ACCF, "utf8"));
const eskiW = JSON.parse(readFileSync("src/lib/methodology/weights/v5-weights-diger.json", "utf8"));

// ── Yarış kümeleri ──────────────────────────────────────────────
const byRace = new Map();
for (const r of rows) {
  if (!tarih[r.raceId]) continue;
  if (!byRace.has(r.raceId)) byRace.set(r.raceId, { raceId: r.raceId, tarih: tarih[r.raceId], rows: [] });
  byRace.get(r.raceId).rows.push(r);
}
for (const y of byRace.values()) {
  const sirali = [...y.rows].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
  const sireRank = new Map(sirali.map((r, i) => [r, i + 1]));
  for (const r of y.rows) {
    const sayi = [(r.pistUzmani ?? 0) === 1, sireRank.get(r) <= 2, (r.ajiGalibiyetVarMi ?? 0) === 1,
      (r.agfFark ?? 0) >= 1.0, (r.sinifDususu ?? 0) === 1].filter(Boolean).length;
    r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
  }
}
const yarislar = [...byRace.values()]
  .filter((y) => y.rows.some((x) => x.win === 1) && y.rows.length >= 4)
  .sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
for (const y of yarislar) {
  const k = y.rows[0].kategori;
  y.segment = (k === "1a" || k === "1b") ? "dusuk" : k === "2" ? "handikap" : "diger";
}
const ay = (t) => t.slice(0, 7);

// ── Sinyal grupları (V5.46 + Accurace) ──────────────────────────
const TEMEL = {
  AGF_SIRA: ["agfSirasi"],
  AGF_PAY: ["agfPayi", "agfPayi2"],
  JOKEY: ["idmJokey", "jokeyOrani"],
  ANTRENOR: ["antrenorOrani"],
  H2H: ["h2hNetSkor"],
  HIZ: ["hizDerecesi"],
  ZEMIN: ["zeminToleransi", "zeminMesafeDeneyim"],
  YAKINSAMA: ["yakinsama2Plus"],
  SPRINT: ["sonIdmanSprint"],
  TAKI: ["takiDegisikligi"],
  GIDISAT: ["yarisGidisatiSkoru"],
  TEMPO_ESKI: ["tempoTasimaGucu"],
  SIRE: ["sireOrani"],
};
const ACC_GRUPLAR = { ACC_CLOSE: "c", ACC_LATE: "l", ACC_SPEED: "s", ACC_CLOSE_RES: "cr" };
const ACC_REL = { c: "cR", l: "lR", s: "sR", cr: "crR" };
function paceSimple(r) {
  const H = acc_(r, "h"), F = acc_(r, "f");
  if (!H || !F) return null;
  const front = F[0] + F[1];
  const lone = H[0] * Math.max(0, 1 - front);
  const closerFit = (H[4] + H[5]) * front;
  return { v: [front, lone, closerFit], rh: acc_(r, "hR") ?? 0 };
}
// NOT: ACC_GRUPLAR artık ACC_CLOSE_RES'i de içeriyor (kolonlar()/vektor() onu çözebilsin diye),
// ama GRUP_SIRA (temel grup listesi) yalnız ORİJİNAL dört Accurace grubunu içermeli —
// ACC_CLOSE_RES yalnız TUM_FINAL'in .map() takasıyla ulaşılan TÜRETİLMİŞ bir gruptur.
const GRUP_SIRA = [...Object.keys(TEMEL), "ACC_CLOSE", "ACC_LATE", "ACC_SPEED", "ACC_PACE"];
const EKSIK0 = new Set(["hizDerecesi", "zeminToleransi", "agfPayi", "agfPayi2"]);
const TEMEL_KOLON = Object.values(TEMEL).flat();

function temelRaw(r) {
  const p = r.agfPayi ?? 0;
  const v = {
    agfSirasi: r.agfSirasi, idmJokey: r.idmJokey, jokeyOrani: r.jokeyOrani, antrenorOrani: r.antrenorOrani,
    agfPayi: p, agfPayi2: p * p, h2hNetSkor: r.h2hNetSkor ?? 0, hizDerecesi: r.hizDerecesi ?? 0,
    zeminToleransi: r.zeminToleransi ?? 0, zeminMesafeDeneyim: r.zeminMesafeDeneyim ?? 0,
    yakinsama2Plus: r.yakinsama2Plus ?? 0, sonIdmanSprint: r.sonIdmanSprint ?? 0,
    takiDegisikligi: (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0),
    yarisGidisatiSkoru: r.yarisGidisatiSkoru ?? 0, tempoTasimaGucu: r.tempoTasimaGucu ?? 0,
    sireOrani: r.sireOrani ?? 0,
  };
  return v;
}
const acc_ = (r, f) => acc[`${r.raceId}|${r.runnerId}`]?.[f] ?? null;
function paceRaw(r) {
  const H = acc_(r, "h"), F = acc_(r, "f");
  if (!H || !F) return null;
  const o = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) o.push(H[a] * F[b]);
  return { v: o, rh: acc_(r, "hR") ?? 0 };
}

// ── Spec: hangi gruplar açık ────────────────────────────────────
const TUM = GRUP_SIRA;
const TUM_FINAL = TUM.map((g) => (g === "ACC_CLOSE" ? "ACC_CLOSE_RES" : g === "ACC_PACE" ? "PACE_SIMPLE" : g)).filter((g) => g !== "TEMPO_ESKI" && g !== "JOKEY" && g !== "ANTRENOR");
const SPECLER = {
  FULL: TUM,
  FINAL: TUM_FINAL,
};

// Her grup için sütun listesi (standardize edilecek temel sütunlar, Accurace/pace ayrı)
function kolonlar(grup) {
  if (TEMEL[grup]) return { tip: "temel", ad: TEMEL[grup] };
  if (ACC_GRUPLAR[grup]) return { tip: "acc", k: ACC_GRUPLAR[grup] };
  if (grup === "PACE_SIMPLE") return { tip: "pace3" };
  return { tip: "pace" };
}

// Norm: yalnız TRAIN
function normHesapla(train, grupSet) {
  const N = {};
  const tr = train.flatMap((y) => y.rows);
  for (const g of grupSet) {
    const k = kolonlar(g);
    if (k.tip === "temel") {
      for (const c of k.ad) {
        // Ortalama ve std yalniz TRAIN'deki gozlemli degerlerden
        const gz = tr.filter((r) => obsOf(r, c));
        let s = 0, s2 = 0;
        for (const r of gz) s += temelRaw(r)[c];
        const m = gz.length ? s / gz.length : 0;
        for (const r of gz) s2 += (temelRaw(r)[c] - m) ** 2;
        N[c] = { m, sd: gz.length ? Math.sqrt(s2 / gz.length) || 1 : 1, n: gz.length, toplam: tr.length };
      }
    } else if (k.tip === "acc") {
      let s = 0, n = 0;
      for (const r of tr) { const x = acc_(r, k.k); if (x != null) { s += x; n++; } }
      const m = n ? s / n : 0;
      let s2 = 0;
      for (const r of tr) { const x = acc_(r, k.k); if (x != null) s2 += (x - m) ** 2; }
      N[g] = { m, sd: n ? Math.sqrt(s2 / n) || 1 : 1 };
    } else if (k.tip === "pace") {
      const sum = new Float64Array(36), sq = new Float64Array(36);
      let n = 0;
      for (const r of tr) { const p = paceRaw(r); if (!p) continue; n++; for (let i = 0; i < 36; i++) sum[i] += p.v[i]; }
      const m = Array.from(sum, (x) => (n ? x / n : 0));
      for (const r of tr) { const p = paceRaw(r); if (!p) continue; for (let i = 0; i < 36; i++) sq[i] += (p.v[i] - m[i]) ** 2; }
      N[g] = { m, sd: Array.from(sq, (x) => (n ? Math.sqrt(x / n) || 1 : 1)) };
    } else if (k.tip === "pace3") {
      const sum = new Float64Array(3), sq = new Float64Array(3);
      let n = 0;
      for (const r of tr) { const pr = paceSimple(r); if (!pr) continue; n++; for (let i = 0; i < 3; i++) sum[i] += pr.v[i]; }
      const m = Array.from(sum, (x) => (n ? x / n : 0));
      for (const r of tr) { const pr = paceSimple(r); if (!pr) continue; for (let i = 0; i < 3; i++) sq[i] += (pr.v[i] - m[i]) ** 2; }
      N[g] = { m, sd: Array.from(sq, (x) => (n ? Math.sqrt(x / n) || 1 : 1)) };
    }
  }
  return N;
}

// Tasarım matrisi: sütun adları ve değerler
function tasarimKolon(grupSet) {
  const ad = [];
  for (const g of grupSet) {
    const k = kolonlar(g);
    if (k.tip === "temel") for (const c of k.ad) ad.push({ g, c });
    else if (k.tip === "acc") ad.push({ g, c: g });
    else if (k.tip === "pace3") for (let i = 0; i < 3; i++) ad.push({ g, c: `PS_${i}` });
    else for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) ad.push({ g, c: `PACE_${a}${b}` });
  }
  return ad;
}
function vektor(r, grupSet, N, kols) {
  const tv = temelRaw(r);
  const out = new Float64Array(kols.length);
  let j = 0;
  const cache = { pace: undefined, accVals: {} };
  for (const g of grupSet) {
    const k = kolonlar(g);
    if (k.tip === "temel") {
      for (const c of k.ad) { out[j++] = obsOf(r, c) ? (tv[c] - N[c].m) / (N[c].sd || 1) : 0; }
    } else if (k.tip === "acc") {
      const x = acc_(r, k.k);
      const rel = acc_(r, ACC_REL[k.k]) ?? 0;
      out[j++] = x == null ? 0 : rel * (x - N[g].m) / N[g].sd;
    } else if (k.tip === "pace3") {
      if (cache.pace3 === undefined) cache.pace3 = paceSimple(r);
      const p = cache.pace3;
      for (let i = 0; i < 3; i++) out[j++] = p ? p.rh * (p.v[i] - N[g].m[i]) / N[g].sd[i] : 0;
    } else {
      if (cache.pace === undefined) cache.pace = paceRaw(r);
      const p = cache.pace;
      for (let i = 0; i < 36; i++) out[j++] = p ? p.rh * (p.v[i] - N[g].m[i]) / N[g].sd[i] : 0;
    }
  }
  return out;
}

function softmax(s) { const m = Math.max(...s); const e = s.map((t) => Math.exp(t - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((t) => t / z); }

// Eğit: momentum GD, 800 epoch, lr 0.08, mom 0.9, l2 0.01 (race-ortalamalı gradyan)
function egit(train, grupSet, N, kols) {
  const d = kols.length;
  const X = train.map((y) => ({ x: y.rows.map((r) => vektor(r, grupSet, N, kols)), w: y.rows.findIndex((r) => r.win === 1) }));
  const w = new Float64Array(d), vel = new Float64Array(d);
  for (let ep = 0; ep < 800; ep++) {
    const g = new Float64Array(d);
    for (const q of X) {
      const sc = q.x.map((f) => { let s = 0; for (let i = 0; i < d; i++) s += f[i] * w[i]; return s; });
      const p = softmax(sc);
      for (let i = 0; i < q.x.length; i++) {
        const c = p[i] - (i === q.w ? 1 : 0);
        const f = q.x[i];
        for (let k = 0; k < d; k++) g[k] += c * f[k];
      }
    }
    for (let k = 0; k < d; k++) {
      const gk = g[k] / X.length + 2 * 0.01 * w[k];
      vel[k] = 0.9 * vel[k] - 0.08 * gk;
      w[k] += vel[k];
    }
  }
  return Array.from(w);
}

function degerlendir(test, grupSet, N, kols, w) {
  return test.map((y) => {
    const x = y.rows.map((r) => vektor(r, grupSet, N, kols));
    const p = softmax(x.map((f) => f.reduce((s, xi, i) => s + xi * w[i], 0)));
    const wi = y.rows.findIndex((r) => r.win === 1);
    const order = [...p.keys()].sort((a, b) => p[b] - p[a]);
    const rank = order.indexOf(wi) + 1;
    return {
      raceId: y.raceId, tarih: y.tarih, segment: y.segment,
      nll: -Math.log(Math.max(p[wi], 1e-15)),
      brier: p.reduce((s, pi, i) => s + (pi - (i === wi ? 1 : 0)) ** 2, 0) / p.length,
      top1: rank <= 1 ? 1 : 0, top3: rank <= 3 ? 1 : 0, top6: rank <= 6 ? 1 : 0,
      rr: 1 / rank, rank,
    };
  });
}

// ── Fold'lar: expanding aylık, test = Nisan..Eylül ─────────────
const FOLDLAR = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((test) => ({
  test,
  train: yarislar.filter((y) => ay(y.tarih) < test),
  testY: yarislar.filter((y) => ay(y.tarih) === test),
}));

function specKos(ad, grupSet) {
  const sonuc = [];
  const betaFold = [];
  const kolAd = tasarimKolon(grupSet);
  for (const f of FOLDLAR) {
    if (f.train.length < 50 || f.testY.length === 0) continue;
    const N = normHesapla(f.train, grupSet);
    const kols = kolAd;
    const w = egit(f.train, grupSet, N, kols);
    betaFold.push({ fold: f.test, w });
    sonuc.push(...degerlendir(f.testY, grupSet, N, kols, w));
  }
  console.error(`done ${ad} (${sonuc.length} yarış)`);
  return { sonuc, betaFold, kolAd };
}

// ── Metrikler ──────────────────────────────────────────────────
let seed = 20261006;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const B = 5000;
const ci = (v) => { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(0.025 * B)], s[Math.floor(0.975 * B)]]; };
function bootRace(f) { const n = f.length; const o = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += f[Math.floor(rnd() * n)]; o.push(s / n); } return ci(o); }
function bootDay(idsByDay, fm, gunler) {
  const o = [];
  for (let b = 0; b < B; b++) {
    let s = 0, n = 0;
    for (let i = 0; i < gunler.length; i++) { const g = gunler[Math.floor(rnd() * gunler.length)]; for (const id of idsByDay[g]) { s += fm.get(id); n++; } }
    o.push(n ? s / n : 0);
  }
  return ci(o);
}
const ort = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;

// ── Sonuçları topla ─────────────────────────────────────────────
const sonuclar = {};
const betalar = {};
const HIZLI = process.env.HIZLI === "1";
for (const [ad, grupSet] of Object.entries(SPECLER)) {
  if (HIZLI && ad !== "FULL") continue;
  const r = specKos(ad, grupSet);
  sonuclar[ad] = r.sonuc;
  betalar[ad] = { betaFold: r.betaFold, kolAd: r.kolAd };
}
// Drop-one: her grup çıkarılır ve yeniden fit edilir (FULL bazlı)
const dropOne = {};
for (const g of (HIZLI ? [] : TUM_FINAL)) {
  const grupSet = TUM_FINAL.filter((x) => x !== g);
  const r = specKos(`DROP_${g}`, grupSet);
  dropOne[g] = r.sonuc;
  betalar[`DROP_${g}`] = { betaFold: r.betaFold, kolAd: r.kolAd };
}

const idMap = (arr) => new Map(arr.map((x) => [x.raceId, x]));
const tumTestId = [...new Set(sonuclar.FULL.map((x) => x.raceId))];
const testGunleri = {};
for (const x of sonuclar.FULL) testGunleri[x.raceId] = x.tarih;
const gunler = [...new Set(tumTestId.map((id) => testGunleri[id]))];
const idsByDay = {};
for (const id of tumTestId) (idsByDay[testGunleri[id]] ??= []).push(id);

const sonucOf = (ad) => (ad.startsWith("DROP_") ? dropOne[ad.slice(5)] : sonuclar[ad]);
function ozetle(sonAd, base, segFiltre) {
  const m = idMap(sonucOf(sonAd));
  const mb = idMap(sonucOf(base));
  const ids = tumTestId.filter((id) => !segFiltre || mb.get(id).segment === segFiltre);
  const xs = ids.map((id) => m.get(id)).filter(Boolean);
  const o = {
    N: xs.length,
    LogLoss: +ort(xs, (x) => x.nll).toFixed(5),
    Brier: +ort(xs, (x) => x.brier).toFixed(5),
    Top1: +ort(xs, (x) => x.top1).toFixed(4), Top3: +ort(xs, (x) => x.top3).toFixed(4), Top6: +ort(xs, (x) => x.top6).toFixed(4),
    MRR: +ort(xs, (x) => x.rr).toFixed(4), MeanRank: +ort(xs, (x) => x.rank).toFixed(3),
  };
  return o;
}
function farkCI(ad, base, segFiltre) {
  const m = idMap(sonucOf(ad));
  const mb = idMap(sonucOf(base));
  const ids = tumTestId.filter((id) => !segFiltre || mb.get(id).segment === segFiltre);
  const fm = new Map(ids.map((id) => [id, m.get(id).nll - mb.get(id).nll]));
  const fv = ids.map((id) => fm.get(id));
  const mean = fv.reduce((a, b) => a + b, 0) / fv.length;
  const ibd = {};
  for (const id of ids) (ibd[testGunleri[id]] ??= []).push(id);
  return { dLL: +mean.toFixed(5), CI_race: bootRace(fv).map((v) => +v.toFixed(5)), CI_day: bootDay(ibd, fm, Object.keys(ibd)).map((v) => +v.toFixed(5)) };
}

// Drop-one ΔLL (OOS, fold ortalaması); FULL bazlı
const dropTablo = {};
if (!HIZLI) for (const g of TUM_FINAL) dropTablo[g] = farkCI(`DROP_${g}`, "FINAL", null);

// Spec karşılaştırması
const specOzet = {};
for (const ad of Object.keys(SPECLER)) { if (HIZLI && ad !== "FINAL") continue; specOzet[ad] = { ...ozetle(ad, "FULL"), ...(ad === "FULL" ? {} : farkCI(ad, "FULL", null)) }; }

// Final spec: ön-kayıtlı kural — en düşük OOS LogLoss
const secilen = "FINAL"; // kullanici onayi: TEMPO_ESKI cikti, ACC_CLOSE_RES + PACE_SIMPLE icerde

// Segment raporu
const segRapor = {};
for (const seg of ["dusuk", "handikap", "diger"]) {
  segRapor[seg] = {};
  for (const ad of Object.keys(SPECLER)) { if (HIZLI && ad !== "FINAL") continue; segRapor[seg][ad] = { ...ozetle(ad, "FULL", seg), ...(ad === "FULL" ? {} : farkCI(ad, "FULL", seg)) }; }
}

// ── Katsayı denetimi (FULL, tüm test fold'larındaki β aralığı) ──
function ortBeta(betaFold, kolAd, grup) {
  const idx = kolAd.map((k, i) => (k.g === grup ? i : -1)).filter((i) => i >= 0);
  const out = [];
  for (const f of betaFold) {
    const s = idx.reduce((a, i) => a + f.w[i] ** 2, 0);
    out.push(Math.sqrt(s / Math.max(1, idx.length)) * Math.sign(idx.reduce((a, i) => a + f.w[i], 0)));
  }
  return out;
}
const finalKolAd = betalar.FINAL.kolAd;
const denetim = [];
for (const g of TUM_FINAL) {
  const bf0 = betalar.FINAL.betaFold;
  const bf = ortBeta(bf0, finalKolAd, g);
  const min = Math.min(...bf), max = Math.max(...bf);
  const eski = (TEMEL[g] ?? []).map((c) => eskiW.featureNames.indexOf(c)).filter((i) => i >= 0);
  const eskiBeta = eski.length ? eski.reduce((a, i) => a + eskiW.weights[i], 0) / eski.length : null;
  denetim.push({
    sinyal: g, eskiBeta: eskiBeta == null ? null : +eskiBeta.toFixed(4),
    fold: bf.map((x) => +x.toFixed(4)), foldMin: +min.toFixed(4), foldMax: +max.toFixed(4),
    dropOne: dropTablo[g] ?? { dLL: null, CI_race: null, CI_day: null },
  });
}
// Korelasyon diagnostiği (tüm yarış satırları, Pearson) — yalnız bilgi, silme kararı değil
function pearson(xs, ys) {
  const n = xs.length; const mx = xs.reduce((a, b) => a + b, 0) / n, my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; syy += (ys[i] - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
const satirlar = yarislar.flatMap((y) => y.rows).filter((r) => acc_(r, "c") != null);
const korelasyon = HIZLI ? {} : {
  "ACC_CLOSE_RES~GIDISAT": pearson(satirlar.map((r) => acc_(r, "cr") ?? 0), satirlar.map((r) => r.yarisGidisatiSkoru ?? 0)),
  "ACC_CLOSE_RES~agfSirasi": pearson(satirlar.map((r) => acc_(r, "cr") ?? 0), satirlar.map((r) => r.agfSirasi)),
  "ACC_CLOSE~GIDISAT": pearson(satirlar.map((r) => acc_(r, "c")), satirlar.map((r) => r.yarisGidisatiSkoru ?? 0)),
  "ACC_LATE~TEMPO_ESKI": pearson(satirlar.filter((r) => acc_(r, "l") != null).map((r) => acc_(r, "l")), satirlar.filter((r) => acc_(r, "l") != null).map((r) => r.tempoTasimaGucu ?? 0)),
  "ACC_SPEED~HIZ": pearson(satirlar.filter((r) => acc_(r, "s") != null).map((r) => acc_(r, "s")), satirlar.filter((r) => acc_(r, "s") != null).map((r) => r.hizDerecesi ?? 0)),
  "ACC_CLOSE~HIZ": pearson(satirlar.map((r) => acc_(r, "c")), satirlar.map((r) => r.hizDerecesi ?? 0)),
};

const rapor = { secilenSpec: secilen, specOzet, segRapor, denetim, korelasyon, kapsam: { yarisSayisi: yarislar.length, foldlar: FOLDLAR.map((f) => ({ test: f.test, train: f.train.length, test_n: f.testY.length })) } };

// ── Final weights: seçilen spec TÜM veriyle ─────────────────────
const finalN = normHesapla(yarislar, SPECLER[secilen]);
const finalW = egit(yarislar, SPECLER[secilen], finalN, tasarimKolon(SPECLER[secilen]));
const hash = (p) => createHash("sha256").update(readFileSync(p)).digest("hex");
const manifest = {
  generatedAt: new Date().toISOString(),
  secilenSpec: secilen,
  gruplar: SPECLER[secilen],
  trainingWindow: { baslangic: yarislar[0].tarih, bitis: yarislar[yarislar.length - 1].tarih, yarisSayisi: yarislar.length },
  dataHash: { modelVeri: hash(DATA), raceTarih: hash(`${S}/race-tarih-v2.json`), accurace: hash(ACCF) },
  finalKolonlar: tasarimKolon(SPECLER[secilen]).map((k) => k.c),
  finalWeights: Array.from(finalW),
  finalNorm: finalN,
  ayar: { l2: 0.01, epoch: 800, lr: 0.08, momentum: 0.9, reliabilityK: 2.0, yuzeyModu: "SERT" },
};
writeFileSync(`${S}/v546acc-refit-sonuc.json`, JSON.stringify(rapor, null, 1));
writeFileSync(`${S}/v546acc-final-manifest.json`, JSON.stringify(manifest, null, 1));
console.log(JSON.stringify({ secilen, specOzet, denetim: denetim.map((d) => ({ s: d.sinyal, eski: d.eskiBeta, foldMin: d.foldMin, foldMax: d.foldMax, drop: d.dropOne.dLL, ci: d.dropOne.CI_race })), korelasyon }, null, 1));
process.exit(0);
