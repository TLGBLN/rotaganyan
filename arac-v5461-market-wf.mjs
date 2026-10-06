// V5.46.1 challenger — ADIM B: normalize piyasa bloğu (A üzerine).
// Karşılaştırma: A (eksik=katkı 0, V5.46 piyasa üçlüsü) vs B (A + yeni piyasa: bireysel AGF log-pay
// yarış-merkezli + AGF sıra yüzdesi; agfSirasi ve agfPayi² kaldırıldı). Aynı zaman-sıralı bölmeler.
// Eksik AGF (agfPayi = 0) iki piyasa özelliğini de gözlemsiz yapar. Üretim/katsayı/H1 dokunulmaz.
import { readFileSync, writeFileSync } from "node:fs";

const SCRATCH = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows = JSON.parse(readFileSync(`${SCRATCH}/model-veri-yg4.json`, "utf8"));
const tarih = JSON.parse(readFileSync(`${SCRATCH}/race-tarih.json`, "utf8"));

const EKSIK_0 = new Set(["hizDerecesi", "zeminToleransi", "agfPayi"]);

// A: 13 özellik (V5.46). B: piyasa bloğu değişti, 12 özellik.
const FEAT_A = ["agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru"];
const FEAT_B = ["marketCentered", "agfRankPct", "idmJokey", "jokeyOrani", "antrenorOrani", "h2hNetSkor",
  "hizDerecesi", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru"];

function grupla(seg) {
  const map = new Map();
  for (const r of rows) {
    const k = r.kategori; const dusuk = k === "1a" || k === "1b";
    if (seg === "dusuk" && !dusuk) continue;
    if (seg === "diger" && dusuk) continue;
    if (!tarih[r.raceId]) continue;
    if (!map.has(r.raceId)) map.set(r.raceId, { raceId: r.raceId, tarih: tarih[r.raceId], rows: [] });
    map.get(r.raceId).rows.push(r);
  }
  // Yarış-içi piyasa türevleri (bireysel AGF; eksik = agfPayi 0)
  for (const y of map.values()) {
    const n = y.rows.length;
    const gecerli = y.rows.filter((r) => (r.agfPayi ?? 0) > 0);
    const logs = gecerli.map((r) => Math.log(Math.max(r.agfPayi / 100, 1e-3)));
    const ortLog = logs.length ? logs.reduce((s, x) => s + x, 0) / logs.length : 0;
    for (const r of y.rows) {
      if ((r.agfPayi ?? 0) > 0) {
        r._mktCentered = Math.log(Math.max(r.agfPayi / 100, 1e-3)) - ortLog;
        // Bireysel AGF'ye göre sıra (büyük pay = 1). Eşitlikte ortalama sıra.
        const ustte = gecerli.filter((x) => x.agfPayi > r.agfPayi).length;
        const esit = gecerli.filter((x) => x.agfPayi === r.agfPayi).length;
        const sira = ustte + (esit + 1) / 2;
        r._agfRankPct = n > 1 ? 1 - (sira - 1) / (n - 1) : 0.5;
      } else {
        r._mktCentered = null; r._agfRankPct = null;
      }
    }
  }
  // Yakınsama (eğitim betiğiyle birebir: yakinsama2PlusEkle). Veri dosyasında alan yok; burada üretilir.
  for (const y of map.values()) {
    const sireSirali = [...y.rows].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
    const sireRank = new Map(sireSirali.map((r, i) => [r, i + 1]));
    for (const r of y.rows) {
      const sayi = [(r.pistUzmani ?? 0) === 1, sireRank.get(r) <= 2, (r.ajiGalibiyetVarMi ?? 0) === 1,
        (r.agfFark ?? 0) >= 1.0, (r.sinifDususu ?? 0) === 1].filter(Boolean).length;
      r.yakinsama2Plus = sayi >= 2 ? 1 : 0;
    }
  }
  const yarislar = [...map.values()].filter((y) => y.rows.some((x) => x.win === 1) && y.rows.length >= 4);
  yarislar.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
  return yarislar;
}

function vecA(r) {
  return [r.agfSirasi, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.agfPayi ?? 0, r.h2hNetSkor ?? 0,
    r.hizDerecesi ?? 0, (r.agfPayi ?? 0) ** 2, r.zeminToleransi ?? 0, r.yakinsama2Plus ?? 0,
    r.sonIdmanSprint ?? 0, (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0), r.yarisGidisatiSkoru ?? 0];
}
function vecB(r) {
  return [r._mktCentered ?? 0, r._agfRankPct ?? 0.5, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.h2hNetSkor ?? 0,
    r.hizDerecesi ?? 0, r.zeminToleransi ?? 0, r.yakinsama2Plus ?? 0, r.sonIdmanSprint ?? 0,
    (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0), r.yarisGidisatiSkoru ?? 0];
}
// Gözlemlilik: A ve B için sırasıyla
function gozlemliA(r) {
  return FEAT_A.map((f) => (EKSIK_0.has(f) ? (f === "agfPayi2" ? (r.agfPayi ?? 0) > 0 : vecA(r)[FEAT_A.indexOf(f)] !== 0) : true));
}
function gozlemliB(r) {
  const piyasaVar = (r.agfPayi ?? 0) > 0;
  return FEAT_B.map((f, i) => {
    if (f === "marketCentered" || f === "agfRankPct") return piyasaVar;
    if (EKSIK_0.has(f)) return vecB(r)[i] !== 0;
    return true;
  });
}

function sec(mod) {
  return mod === "A" ? { FEAT: FEAT_A, vec: vecA, gozlemli: gozlemliA } : { FEAT: FEAT_B, vec: vecB, gozlemli: gozlemliB };
}

function standartlastir(egitim, s) {
  const d = s.FEAT.length;
  const mu = new Array(d).fill(0), sd = new Array(d).fill(0), n = new Array(d).fill(0);
  for (const y of egitim) for (const r of y.rows) {
    const v = s.vec(r), g = s.gozlemli(r);
    for (let i = 0; i < d; i++) { if (!g[i]) continue; mu[i] += v[i]; n[i]++; }
  }
  for (let i = 0; i < d; i++) mu[i] = n[i] ? mu[i] / n[i] : 0;
  for (const y of egitim) for (const r of y.rows) {
    const v = s.vec(r), g = s.gozlemli(r);
    for (let i = 0; i < d; i++) { if (!g[i]) continue; sd[i] += (v[i] - mu[i]) ** 2; }
  }
  for (let i = 0; i < d; i++) sd[i] = n[i] ? Math.sqrt(sd[i] / n[i]) : 1;
  return { mu, sd };
}
function ozellik(r, s, norm) {
  const v = s.vec(r), g = s.gozlemli(r);
  return v.map((x, i) => (!g[i] ? 0 : norm.sd[i] > 1e-9 ? (x - norm.mu[i]) / norm.sd[i] : 0));
}
function softmax(v) { const m = Math.max(...v); const e = v.map((x) => Math.exp(x - m)); const t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); }
function egit(egitim, s, norm) {
  const d = s.FEAT.length;
  const gruplar = egitim.map((y) => ({ x: y.rows.map((r) => ozellik(r, s, norm)), w: y.rows.findIndex((r) => r.win === 1) }));
  const w = new Array(d).fill(0), vel = new Array(d).fill(0);
  for (let ep = 0; ep < 800; ep++) {
    const grad = new Array(d).fill(0);
    for (const g of gruplar) {
      const p = softmax(g.x.map((f) => f.reduce((a, xi, i) => a + xi * w[i], 0)));
      for (let i = 0; i < g.x.length; i++) { const c = p[i] - (i === g.w ? 1 : 0); for (let k = 0; k < d; k++) grad[k] += c * g.x[i][k]; }
    }
    for (let k = 0; k < d; k++) { const gk = grad[k] / gruplar.length + 0.02 * w[k]; vel[k] = 0.9 * vel[k] - 0.08 * gk; w[k] += vel[k]; }
  }
  return w;
}
function degerlendir(test, s, w, norm) {
  return test.map((y) => {
    const p = softmax(y.rows.map((r) => ozellik(r, s, norm)).map((f) => f.reduce((a, xi, i) => a + xi * w[i], 0)));
    const wi = y.rows.findIndex((r) => r.win === 1);
    const rank = [...p.keys()].sort((a, b) => p[b] - p[a]);
    return { ll: -Math.log(Math.max(p[wi], 1e-15)), top1: rank[0] === wi ? 1 : 0, top3: rank.slice(0, 3).includes(wi) ? 1 : 0 };
  });
}
function bootCI(farklar, B = 300) {
  let seed = 20261006; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const n = farklar.length; const out = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += farklar[Math.floor(rnd() * n)]; out.push(s / n); }
  out.sort((a, b) => a - b); return [out[Math.floor(0.025 * B)], out[Math.floor(0.975 * B)]];
}
function calistir(seg) {
  const yarislar = grupla(seg);
  const chunk = Math.floor(yarislar.length / 5);
  const parca = [0, 1, 2, 3, 4].map((i) => yarislar.slice(i * chunk, i === 4 ? yarislar.length : (i + 1) * chunk));
  const sA = sec("A"), sB = sec("B");
  const a = [], b = [];
  for (let k = 1; k <= 4; k++) {
    const egitim = parca.slice(0, k).flat(), test = parca[k];
    const nA = standartlastir(egitim, sA); a.push(...degerlendir(test, sA, egit(egitim, sA, nA), nA));
    const nB = standartlastir(egitim, sB); b.push(...degerlendir(test, sB, egit(egitim, sB, nB), nB));
  }
  const ort = (x, f) => x.reduce((s, e) => s + f(e), 0) / x.length;
  const fark = b.map((e, i) => e.ll - a[i].ll);
  return {
    segment: seg, yarisSayisi: yarislar.length,
    A: { N: a.length, LogLoss: +ort(a, (e) => e.ll).toFixed(5), Top1: +ort(a, (e) => e.top1).toFixed(4), Top3: +ort(a, (e) => e.top3).toFixed(4) },
    B: { N: b.length, LogLoss: +ort(b, (e) => e.ll).toFixed(5), Top1: +ort(b, (e) => e.top1).toFixed(4), Top3: +ort(b, (e) => e.top3).toFixed(4) },
    deltaLL_BminusA: +(fark.reduce((s, x) => s + x, 0) / fark.length).toFixed(5),
    deltaLL_CI95: bootCI(fark).map((x) => +x.toFixed(5)),
  };
}
const sonuc = ["dusuk", "diger"].map(calistir);
writeFileSync(`${SCRATCH}/v5461-adimB-sonuc.json`, JSON.stringify(sonuc, null, 2));
console.log(JSON.stringify(sonuc, null, 2));
