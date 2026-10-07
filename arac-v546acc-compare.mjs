// V5.46_Acc — hedefli karşılaştırma turu (root-cause). FULL referans; aşağıdaki sorular test edilir:
//  1) ACC_CLOSE (ham) vs ACC_CLOSE_RES (erken-pozisyon düzeltmeli residual)
//  2) ACC_LATE × TEMPO_ESKI 2x2 (redundancy)
//  3) ACC_SPEED × HIZ 2x2 (redundancy)
//  4) ACC_PACE (36 interaction) vs PACE_SIMPLE (3 elle-tanımlı, öğrenilen β'lı skaler)
//  5) FULL_BEST: CR + PACE_SIMPLE birlikte (deneme adayı)
// Aynı fold/optimizasyon/ridge kuralları (arac-v546acc-refit.mjs ile birebir). B=2000 (hızlı tur, yalnız race-level CI).
import { readFileSync, writeFileSync } from "node:fs";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows = JSON.parse(readFileSync(`${S}/model-veri.json`, "utf8"));
const tarih = JSON.parse(readFileSync(`${S}/race-tarih-v2.json`, "utf8"));
const acc = JSON.parse(readFileSync(`${S}/accurace-tum-ozellik.json`, "utf8"));

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
const ay = (t) => t.slice(0, 7);

const OBS = ["h2hNetSkor", "hizDerecesi", "sonIdmanSprint", "takiDegisikligi"];
const obsOf = (r, c) => (OBS.includes(c) ? (r.sinyalDurum?.[c]?.observed === true) : true);

const TEMEL = {
  AGF_SIRA: ["agfSirasi"], AGF_PAY: ["agfPayi", "agfPayi2"], JOKEY: ["idmJokey", "jokeyOrani"],
  ANTRENOR: ["antrenorOrani"], H2H: ["h2hNetSkor"], HIZ: ["hizDerecesi"],
  ZEMIN: ["zeminToleransi", "zeminMesafeDeneyim"], YAKINSAMA: ["yakinsama2Plus"], SPRINT: ["sonIdmanSprint"],
  TAKI: ["takiDegisikligi"], GIDISAT: ["yarisGidisatiSkoru"], TEMPO_ESKI: ["tempoTasimaGucu"], SIRE: ["sireOrani"],
};
function temelRaw(r) {
  const p = r.agfPayi ?? 0;
  return {
    agfSirasi: r.agfSirasi, idmJokey: r.idmJokey, jokeyOrani: r.jokeyOrani, antrenorOrani: r.antrenorOrani,
    agfPayi: p, agfPayi2: p * p, h2hNetSkor: r.h2hNetSkor ?? 0, hizDerecesi: r.hizDerecesi ?? 0,
    zeminToleransi: r.zeminToleransi ?? 0, zeminMesafeDeneyim: r.zeminMesafeDeneyim ?? 0,
    yakinsama2Plus: r.yakinsama2Plus ?? 0, sonIdmanSprint: r.sonIdmanSprint ?? 0,
    takiDegisikligi: (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0),
    yarisGidisatiSkoru: r.yarisGidisatiSkoru ?? 0, tempoTasimaGucu: r.tempoTasimaGucu ?? 0, sireOrani: r.sireOrani ?? 0,
  };
}
const acc_ = (r, f) => acc[`${r.raceId}|${r.runnerId}`]?.[f] ?? null;
const ACC_GRUPLAR = { ACC_CLOSE: "c", ACC_LATE: "l", ACC_SPEED: "s", ACC_CLOSE_RES: "cr" };
const ACC_REL = { c: "cR", l: "lR", s: "sR", cr: "crR" };
function paceRaw36(r) {
  const H = acc_(r, "h"), F = acc_(r, "f");
  if (!H || !F) return null;
  const o = [];
  for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) o.push(H[a] * F[b]);
  return { v: o, rh: acc_(r, "hR") ?? 0 };
}
// PACE_SIMPLE: elle-tanımlı 3 bileşen (36 yerine), W conditional-logit içinde öğrenilir (elle sabit değil)
function paceSimple(r) {
  const H = acc_(r, "h"), F = acc_(r, "f");
  if (!H || !F) return null;
  const front = F[0] + F[1]; // rakip kaçak+ön kütlesi: önde baskı
  const lone = H[0] * Math.max(0, 1 - front); // tek lider avantajı: kendi kaçak olasılığı × önde rakip azlığı
  const closerFit = (H[4] + H[5]) * front; // derin/bekleyen stilin önde-baskılı yarışta uyumu
  return { v: [front, lone, closerFit], rh: acc_(r, "hR") ?? 0 };
}

const TUM = [...Object.keys(TEMEL), "ACC_CLOSE", "ACC_LATE", "ACC_SPEED", "ACC_PACE"];
function kolonlar(g) {
  if (TEMEL[g]) return { tip: "temel", ad: TEMEL[g] };
  if (ACC_GRUPLAR[g]) return { tip: "acc", k: ACC_GRUPLAR[g] };
  if (g === "ACC_PACE") return { tip: "pace36" };
  if (g === "PACE_SIMPLE") return { tip: "pace3" };
  throw new Error("bilinmeyen grup " + g);
}
function tasarimKolon(grupSet) {
  const ad = [];
  for (const g of grupSet) {
    const k = kolonlar(g);
    if (k.tip === "temel") for (const c of k.ad) ad.push({ g, c });
    else if (k.tip === "acc") ad.push({ g, c: g });
    else if (k.tip === "pace36") for (let a = 0; a < 6; a++) for (let b = 0; b < 6; b++) ad.push({ g, c: `P36_${a}${b}` });
    else for (let i = 0; i < 3; i++) ad.push({ g, c: `PS_${i}` });
  }
  return ad;
}
function normHesapla(train, grupSet) {
  const N = {};
  const tr = train.flatMap((y) => y.rows);
  for (const g of grupSet) {
    const k = kolonlar(g);
    if (k.tip === "temel") {
      for (const c of k.ad) {
        const gz = tr.filter((r) => obsOf(r, c));
        let s = 0, s2 = 0;
        for (const r of gz) s += temelRaw(r)[c];
        const m = gz.length ? s / gz.length : 0;
        for (const r of gz) s2 += (temelRaw(r)[c] - m) ** 2;
        N[c] = { m, sd: gz.length ? Math.sqrt(s2 / gz.length) || 1 : 1 };
      }
    } else if (k.tip === "acc") {
      let s = 0, n = 0;
      for (const r of tr) { const x = acc_(r, ACC_GRUPLAR[g]); if (x != null) { s += x; n++; } }
      const m = n ? s / n : 0;
      let s2 = 0;
      for (const r of tr) { const x = acc_(r, ACC_GRUPLAR[g]); if (x != null) s2 += (x - m) ** 2; }
      N[g] = { m, sd: n ? Math.sqrt(s2 / n) || 1 : 1 };
    } else if (k.tip === "pace36") {
      const sum = new Float64Array(36), sq = new Float64Array(36);
      let n = 0;
      for (const r of tr) { const p = paceRaw36(r); if (!p) continue; n++; for (let i = 0; i < 36; i++) sum[i] += p.v[i]; }
      const m = Array.from(sum, (x) => (n ? x / n : 0));
      for (const r of tr) { const p = paceRaw36(r); if (!p) continue; for (let i = 0; i < 36; i++) sq[i] += (p.v[i] - m[i]) ** 2; }
      N[g] = { m, sd: Array.from(sq, (x) => (n ? Math.sqrt(x / n) || 1 : 1)) };
    } else {
      const sum = new Float64Array(3), sq = new Float64Array(3);
      let n = 0;
      for (const r of tr) { const p = paceSimple(r); if (!p) continue; n++; for (let i = 0; i < 3; i++) sum[i] += p.v[i]; }
      const m = Array.from(sum, (x) => (n ? x / n : 0));
      for (const r of tr) { const p = paceSimple(r); if (!p) continue; for (let i = 0; i < 3; i++) sq[i] += (p.v[i] - m[i]) ** 2; }
      N[g] = { m, sd: Array.from(sq, (x) => (n ? Math.sqrt(x / n) || 1 : 1)) };
    }
  }
  return N;
}
function vektor(r, grupSet, N, kols) {
  const tv = temelRaw(r);
  const out = new Float64Array(kols.length);
  let j = 0;
  let paceCache, pace3Cache;
  for (const g of grupSet) {
    const k = kolonlar(g);
    if (k.tip === "temel") { for (const c of k.ad) out[j++] = obsOf(r, c) ? (tv[c] - N[c].m) / (N[c].sd || 1) : 0; }
    else if (k.tip === "acc") {
      const x = acc_(r, ACC_GRUPLAR[g]);
      const rel = acc_(r, ACC_REL[ACC_GRUPLAR[g]]) ?? 0;
      out[j++] = x == null ? 0 : rel * (x - N[g].m) / N[g].sd;
    } else if (k.tip === "pace36") {
      if (paceCache === undefined) paceCache = paceRaw36(r);
      const p = paceCache;
      for (let i = 0; i < 36; i++) out[j++] = p ? p.rh * (p.v[i] - N[g].m[i]) / N[g].sd[i] : 0;
    } else {
      if (pace3Cache === undefined) pace3Cache = paceSimple(r);
      const p = pace3Cache;
      for (let i = 0; i < 3; i++) out[j++] = p ? p.rh * (p.v[i] - N[g].m[i]) / N[g].sd[i] : 0;
    }
  }
  return out;
}
function softmax(s) { const m = Math.max(...s); const e = s.map((t) => Math.exp(t - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((t) => t / z); }
function egit(train, grupSet, N, kols) {
  const d = kols.length;
  const X = train.map((y) => ({ x: y.rows.map((r) => vektor(r, grupSet, N, kols)), w: y.rows.findIndex((r) => r.win === 1) }));
  const w = new Float64Array(d), vel = new Float64Array(d);
  for (let ep = 0; ep < 800; ep++) {
    const g = new Float64Array(d);
    for (const q of X) {
      const sc = q.x.map((f) => { let s = 0; for (let i = 0; i < d; i++) s += f[i] * w[i]; return s; });
      const p = softmax(sc);
      for (let i = 0; i < q.x.length; i++) { const c = p[i] - (i === q.w ? 1 : 0); const f = q.x[i]; for (let k = 0; k < d; k++) g[k] += c * f[k]; }
    }
    for (let k = 0; k < d; k++) { const gk = g[k] / X.length + 2 * 0.01 * w[k]; vel[k] = 0.9 * vel[k] - 0.08 * gk; w[k] += vel[k]; }
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
    return { raceId: y.raceId, tarih: y.tarih, nll: -Math.log(Math.max(p[wi], 1e-15)), top1: rank <= 1 ? 1 : 0, top3: rank <= 3 ? 1 : 0, top6: rank <= 6 ? 1 : 0, rr: 1 / rank, rank };
  });
}
const FOLDLAR = ["2026-04", "2026-05", "2026-06", "2026-07", "2026-08", "2026-09"].map((test) => ({
  test, train: yarislar.filter((y) => ay(y.tarih) < test), testY: yarislar.filter((y) => ay(y.tarih) === test),
}));
function kosSpec(grupSet) {
  const kols = tasarimKolon(grupSet);
  const sonuc = [];
  for (const f of FOLDLAR) {
    if (f.train.length < 50 || f.testY.length === 0) continue;
    const N = normHesapla(f.train, grupSet);
    const w = egit(f.train, grupSet, N, kols);
    sonuc.push(...degerlendir(f.testY, grupSet, N, kols, w));
  }
  return sonuc;
}

// ── Spec tanımları ───────────────────────────────────────────────
const remove = (...outs) => TUM.filter((g) => !outs.includes(g));
const swap = (o, i) => TUM.map((g) => (g === o ? i : g));
const SPECLER = {
  FULL: TUM,
  FULL_CR: swap("ACC_CLOSE", "ACC_CLOSE_RES"),
  FULL_CR_MINUS: remove("ACC_CLOSE"),
  LT_eksi_LATE: remove("ACC_LATE"),
  LT_eksi_TEMPO: remove("TEMPO_ESKI"),
  LT_eksi_ikisi: remove("ACC_LATE", "TEMPO_ESKI"),
  SH_eksi_SPEED: remove("ACC_SPEED"),
  SH_eksi_HIZ: remove("HIZ"),
  SH_eksi_ikisi: remove("ACC_SPEED", "HIZ"),
  PACE_SIMPLE: swap("ACC_PACE", "PACE_SIMPLE"),
  PACE_YOK: remove("ACC_PACE"),
  FULL_BEST: TUM.map((g) => (g === "ACC_CLOSE" ? "ACC_CLOSE_RES" : g === "ACC_PACE" ? "PACE_SIMPLE" : g)),
};

console.error("Fold yarış sayıları:", JSON.stringify(FOLDLAR.map((f) => ({ test: f.test, train: f.train.length, test_n: f.testY.length }))));
const sonuclar = {};
for (const [ad, grupSet] of Object.entries(SPECLER)) { sonuclar[ad] = kosSpec(grupSet); console.error(`done ${ad}`); }

// ── Metrikler (race-level bootstrap, B=2000 — hızlı tur) ─────────
let seed = 20261007;
const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const B = 2000;
function ci(v) { const s = [...v].sort((a, b) => a - b); return [s[Math.floor(0.025 * B)], s[Math.floor(0.975 * B)]]; }
function bootRace(farklar) { const n = farklar.length; const o = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += farklar[Math.floor(rnd() * n)]; o.push(s / n); } return ci(o); }
const ort = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
const idMap = (a) => new Map(a.map((x) => [x.raceId, x]));
const rapor = {};
const baseMap = idMap(sonuclar.FULL);
for (const [ad, arr] of Object.entries(sonuclar)) {
  const m = idMap(arr);
  const o = { N: arr.length, LogLoss: +ort(arr, (x) => x.nll).toFixed(5), Top1: +ort(arr, (x) => x.top1).toFixed(4), Top3: +ort(arr, (x) => x.top3).toFixed(4), Top6: +ort(arr, (x) => x.top6).toFixed(4), MRR: +ort(arr, (x) => x.rr).toFixed(4), MeanRank: +ort(arr, (x) => x.rank).toFixed(3) };
  if (ad !== "FULL") {
    const ids = arr.map((x) => x.raceId).filter((id) => baseMap.has(id));
    const fark = ids.map((id) => m.get(id).nll - baseMap.get(id).nll);
    o.dLL = +(fark.reduce((a, b) => a + b, 0) / fark.length).toFixed(5);
    o.CI_race = bootRace(fark).map((v) => +v.toFixed(5));
  }
  rapor[ad] = o;
}
writeFileSync(`${S}/v546acc-compare-sonuc.json`, JSON.stringify(rapor, null, 1));
console.log(JSON.stringify(rapor, null, 1));
