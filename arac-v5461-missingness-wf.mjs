// V5.46.1 challenger — ADIM A: missing ≠ 0 (yalnız eksik-veri davranışı değişir).
// Baseline (V5.46 özellikleri, eksik = 0 olarak standardize) ile challenger (eksik = katkı 0)
// AYNI walk-forward bölmelerinde yeniden fit edilir. Tek değişken: eksik değer davranışı.
// Üretim kodu, katsayı dosyası ve H1 forward kiti dokunulmaz.
//
// Varsayım (DOĞRULANMALI): eğitim verisinde eksik ayrı işaretlenmemiş; sürekli alanlarda tam 0
// eksik kabul edilir (hizDerecesi, zeminToleransi, agfPayi). h2hNetSkor/yarisGidisatiSkoru
// gerçek 0 olabildiği için bu adımda gözlemli sayılır.
import { readFileSync, writeFileSync } from "node:fs";

const SCRATCH = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows = JSON.parse(readFileSync(`${SCRATCH}/model-veri-yg4.json`, "utf8"));
const tarih = JSON.parse(readFileSync(`${SCRATCH}/race-tarih.json`, "utf8"));

const FEAT = ["agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru"];
// Sıfır = eksik kabul edilen alanlar (bu adımda).
const EKSIK_0 = new Set(["hizDerecesi", "zeminToleransi", "agfPayi", "agfPayi2"]);

function vec(r) {
  return [r.agfSirasi, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.agfPayi ?? 0, r.h2hNetSkor ?? 0,
    r.hizDerecesi ?? 0, (r.agfPayi ?? 0) * (r.agfPayi ?? 0), r.zeminToleransi ?? 0, r.yakinsama2Plus ?? 0,
    r.sonIdmanSprint ?? 0, (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0), r.yarisGidisatiSkoru ?? 0];
}
function gozlemli(r) {
  // Her özellik için observed bayrağı
  const v = vec(r);
  return FEAT.map((f, i) => (EKSIK_0.has(f) ? v[i] !== 0 : true));
}

// Eğitim/test gruplaması
function grupla(seg) {
  const map = new Map();
  for (const r of rows) {
    const k = r.kategori;
    const dusuk = k === "1a" || k === "1b";
    if (seg === "dusuk" && !dusuk) continue;
    if (seg === "diger" && dusuk) continue;
    if (!tarih[r.raceId]) continue;
    if (!map.has(r.raceId)) map.set(r.raceId, { raceId: r.raceId, tarih: tarih[r.raceId], rows: [] });
    map.get(r.raceId).rows.push(r);
  }
  const yarislar = [...map.values()].filter((y) => y.rows.some((x) => x.win === 1) && y.rows.length >= 4);
  yarislar.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
  return yarislar;
}

// Standardizasyon: mod = "baseline" (tüm değerler) | "challenger" (yalnız gözlemli değerler)
function standartlastir(egitim, mod) {
  const d = FEAT.length;
  const mu = new Array(d).fill(0), sd = new Array(d).fill(0), n = new Array(d).fill(0);
  for (const y of egitim) for (const r of y.rows) {
    const v = vec(r), g = gozlemli(r);
    for (let i = 0; i < d; i++) {
      if (mod === "challenger" && !g[i]) continue;
      mu[i] += v[i]; n[i]++;
    }
  }
  for (let i = 0; i < d; i++) mu[i] = n[i] ? mu[i] / n[i] : 0;
  for (const y of egitim) for (const r of y.rows) {
    const v = vec(r), g = gozlemli(r);
    for (let i = 0; i < d; i++) {
      if (mod === "challenger" && !g[i]) continue;
      sd[i] += (v[i] - mu[i]) ** 2;
    }
  }
  for (let i = 0; i < d; i++) sd[i] = n[i] ? Math.sqrt(sd[i] / n[i]) : 1;
  return { mu, sd };
}

function ozellik(r, norm, mod) {
  const v = vec(r), g = gozlemli(r);
  return v.map((x, i) => {
    if (mod === "challenger" && !g[i]) return 0; // eksik → katkı 0
    return norm.sd[i] > 1e-9 ? (x - norm.mu[i]) / norm.sd[i] : 0;
  });
}

function softmax(s) {
  const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const t = e.reduce((a, b) => a + b, 0);
  return e.map((x) => x / t);
}

// V5.46 ile aynı eğitim: momentumlu tam-toplu GD, 800 epoch, lr 0.08, l2 0.01, momentum 0.9
function egit(egitimYarislar, norm, mod) {
  const d = FEAT.length;
  const gruplar = egitimYarislar.map((y) => ({
    x: y.rows.map((r) => ozellik(r, norm, mod)),
    w: y.rows.findIndex((r) => r.win === 1),
  }));
  let w = new Array(d).fill(0), vel = new Array(d).fill(0);
  for (let ep = 0; ep < 800; ep++) {
    const grad = new Array(d).fill(0);
    for (const g of gruplar) {
      const sc = g.x.map((f) => f.reduce((s, xi, i) => s + xi * w[i], 0));
      const p = softmax(sc);
      for (let i = 0; i < g.x.length; i++) {
        const c = p[i] - (i === g.w ? 1 : 0);
        for (let k = 0; k < d; k++) grad[k] += c * g.x[i][k];
      }
    }
    for (let k = 0; k < d; k++) {
      const gk = grad[k] / gruplar.length + 2 * 0.01 * w[k];
      vel[k] = 0.9 * vel[k] - 0.08 * gk;
      w[k] += vel[k];
    }
  }
  return w;
}

// Yarış başına OOS metrikleri
function degerlendir(testYarislar, w, norm, mod) {
  const sonuc = [];
  for (const y of testYarislar) {
    const x = y.rows.map((r) => ozellik(r, norm, mod));
    const p = softmax(x.map((f) => f.reduce((s, xi, i) => s + xi * w[i], 0)));
    const wi = y.rows.findIndex((r) => r.win === 1);
    const ll = -Math.log(Math.max(p[wi], 1e-15));
    const rank = [...p.keys()].sort((a, b) => p[b] - p[a]);
    const top1 = rank[0] === wi ? 1 : 0;
    const top3 = rank.slice(0, 3).includes(wi) ? 1 : 0;
    const brier = p.reduce((s, pi, i) => s + (pi - (i === wi ? 1 : 0)) ** 2, 0) / p.length;
    sonuc.push({ raceId: y.raceId, ll, top1, top3, brier, n: p.length });
  }
  return sonuc;
}

function bootCI(farklar, B = 300) {
  let seed = 20261006;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const n = farklar.length; const out = [];
  for (let b = 0; b < B; b++) {
    let s = 0;
    for (let i = 0; i < n; i++) s += farklar[Math.floor(rnd() * n)];
    out.push(s / n);
  }
  out.sort((a, b) => a - b);
  return [out[Math.floor(0.025 * B)], out[Math.floor(0.975 * B)]];
}

function walkForward(seg) {
  const yarislar = grupla(seg);
  const chunk = Math.floor(yarislar.length / 5);
  const parca = [0, 1, 2, 3, 4].map((i) => yarislar.slice(i * chunk, i === 4 ? yarislar.length : (i + 1) * chunk));
  const base = [], chal = [];
  for (let k = 1; k <= 4; k++) {
    const egitim = parca.slice(0, k).flat();
    const test = parca[k];
    const nb = standartlastir(egitim, "baseline");
    const wb = egit(egitim, nb, "baseline");
    base.push(...degerlendir(test, wb, nb, "baseline"));
    const nc = standartlastir(egitim, "challenger");
    const wc = egit(egitim, nc, "challenger");
    chal.push(...degerlendir(test, wc, nc, "challenger"));
  }
  const ort = (a, f) => a.reduce((s, x) => s + f(x), 0) / a.length;
  const farklar = base.map((b, i) => chal[i].ll - b.ll);
  const ci = bootCI(farklar);
  const ozet = (a) => ({
    N: a.length,
    LogLoss: +ort(a, (x) => x.ll).toFixed(5),
    Brier: +ort(a, (x) => x.brier).toFixed(5),
    Top1: +ort(a, (x) => x.top1).toFixed(4),
    Top3: +ort(a, (x) => x.top3).toFixed(4),
  });
  return {
    segment: seg, yarisSayisi: yarislar.length,
    baseline: ozet(base), challenger: ozet(chal),
    deltaLL: +farklar.reduce((s, x) => s + x, 0) / farklar.length,
    deltaLL_CI95: ci.map((x) => +x.toFixed(5)),
  };
}

const sonuclar = ["dusuk", "diger"].map((s) => walkForward(s));
const cikti = `${SCRATCH}/v5461-adimA-sonuc.json`;
writeFileSync(cikti, JSON.stringify(sonuclar, null, 2));
console.log(JSON.stringify(sonuclar, null, 2));
