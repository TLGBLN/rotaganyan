// V5.46.1 DEĞERLENDİRME v2 — birincil küme: yarış tarihi >= 2026-07-01 (eğitim betiğinin penceresi).
// Modeller (aynı yarış kümesi, aynı walk-forward fold'ları):
//   PROD_V546 : canlı V5.46 katsayıları (JSON means/stds/β), B katmanı, override'lar, sıcaklık. FİT YOK.
//   REFIT     : V5.46 özellik tanımı, eksik=0, fold içinde yeniden fit (yalnız mimari kıyas).
//   A         : REFIT + eksik-değer maskesi (hiz/zemin/agfPayi eksik ise katkı 0).
//   B         : A + yeni piyasa bloğu (log-pay yarış-merkezli + AGF sıra yüzdesi). Yalnız PRE_RACE_VERIFIED.
// ΔLL_vs_REFIT ve ΔLL_vs_PROD aynı test yarışlarında; CI: yarış-bazlı ve gün-kümeli, B=5000.
import { readFileSync, writeFileSync } from "node:fs";

const S = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows = JSON.parse(readFileSync(`${S}/model-veri-yg4.json`, "utf8"));
const tarih = JSON.parse(readFileSync(`${S}/race-tarih.json`, "utf8"));
const prov = JSON.parse(readFileSync(`${S}/yaris-provenance.json`, "utf8"));
const wD = JSON.parse(readFileSync("src/lib/methodology/weights/v5-weights-diger.json", "utf8"));
const wS = JSON.parse(readFileSync("src/lib/methodology/weights/v5-weights-dusuksart.json", "utf8"));

const PRIMER = "2026-07-01";
const FEAT13 = wD.featureNames; // canlı sıra
const EKSIK0 = new Set(["hizDerecesi", "zeminToleransi", "agfPayi"]);

// ---- yarış grupları ----
function yarislar(filtre) {
  const map = new Map();
  for (const r of rows) {
    if (!tarih[r.raceId] || tarih[r.raceId] < PRIMER) continue;
    if (!map.has(r.raceId)) map.set(r.raceId, { raceId: r.raceId, tarih: tarih[r.raceId], prov: prov[r.raceId], kat: r.kategori, rows: [] });
    map.get(r.raceId).rows.push(r);
  }
  // Yakınsama (eğitim betiğiyle birebir)
  for (const y of map.values()) {
    const sirali = [...y.rows].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
    const sr = new Map(sirali.map((r, i) => [r, i + 1]));
    for (const r of y.rows) {
      const s = [(r.pistUzmani ?? 0) === 1, sr.get(r) <= 2, (r.ajiGalibiyetVarMi ?? 0) === 1, (r.agfFark ?? 0) >= 1.0, (r.sinifDususu ?? 0) === 1].filter(Boolean).length;
      r.yakinsama2Plus = s >= 2 ? 1 : 0;
    }
    // piyasa türevleri (bireysel AGF)
    const gecerli = y.rows.filter((r) => (r.agfPayi ?? 0) > 0);
    const ortLog = gecerli.length ? gecerli.reduce((s, r) => s + Math.log(Math.max(r.agfPayi / 100, 1e-3)), 0) / gecerli.length : 0;
    for (const r of y.rows) {
      if ((r.agfPayi ?? 0) > 0) {
        r._mkt = Math.log(Math.max(r.agfPayi / 100, 1e-3)) - ortLog;
        const ust = gecerli.filter((x) => x.agfPayi > r.agfPayi).length, esit = gecerli.filter((x) => x.agfPayi === r.agfPayi).length;
        r._rankPct = y.rows.length > 1 ? 1 - ((ust + (esit + 1) / 2) - 1) / (y.rows.length - 1) : 0.5;
      } else { r._mkt = null; r._rankPct = null; }
    }
  }
  let liste = [...map.values()].filter((y) => y.rows.some((x) => x.win === 1) && y.rows.length >= 4);
  if (filtre) liste = liste.filter(filtre);
  liste.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
  return liste;
}

// ---- özellik vektörleri ----
const vRaw = (r) => [r.agfSirasi, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.agfPayi ?? 0, r.h2hNetSkor ?? 0, r.hizDerecesi ?? 0,
  (r.agfPayi ?? 0) ** 2, r.zeminToleransi ?? 0, r.yakinsama2Plus ?? 0, r.sonIdmanSprint ?? 0, (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0), r.yarisGidisatiSkoru ?? 0];
const gozA = (r) => FEAT13.map((f) => (EKSIK0.has(f) ? (f === "agfPayi2" ? 1 : 1) : 1)); // placeholder, aşağıda
function gozlemliA(r) {
  const v = vRaw(r);
  return FEAT13.map((f, i) => (EKSIK0.has(f) ? v[i] !== 0 : true));
}
const vB = (r) => [r._mkt ?? 0, r._rankPct ?? 0.5, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.h2hNetSkor ?? 0, r.hizDerecesi ?? 0,
  r.zeminToleransi ?? 0, r.yakinsama2Plus ?? 0, r.sonIdmanSprint ?? 0, (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0), r.yarisGidisatiSkoru ?? 0];
const gozB = (r) => { const v = vB(r); const pv = (r.agfPayi ?? 0) > 0; return [pv, pv, true, true, true, v[5] !== 0 || true, v[6] !== 0, v[7] !== 0, true, true, true, true].map((x, i) => (i === 5 ? true : x)); };
const FEATB = ["mktCentered", "agfRankPct", "idmJokey", "jokeyOrani", "antrenorOrani", "h2hNetSkor", "hizDerecesi", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru"];

function softmax(s) { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); }

// ---- PROD_V546 (fit yok) ----
function prodOlasilik(y) {
  const dusuk = y.kat === "1a" || y.kat === "1b";
  const hk = y.kat === "2";
  const ws = dusuk ? wS : wD;
  const w = ws.weights.map((b, i) => {
    if (hk && (i === FEAT13.indexOf("hizDerecesi") || i === FEAT13.indexOf("idmJokey") || i === FEAT13.indexOf("yarisGidisatiSkoru"))) return 0;
    if (dusuk && i === FEAT13.indexOf("h2hNetSkor")) return 0;
    return b;
  });
  const sBase = y.rows.map((r) => {
    const v = vRaw(r);
    let s = 0;
    for (let i = 0; i < 13; i++) { const sd = ws.stds[i] > 1e-9 ? (v[i] - ws.means[i]) / ws.stds[i] : 0; s += w[i] * sd; }
    // B katmanı (düşük-şart için sire; zemin-mesafe tüm yarışlarda; seviye "yok" ≈ zeminMesafeDeneyim=0 — YAKLAŞIK)
    const sire = dusuk ? 1 * 0.0477 * ((r.sireOrani ?? 0) - 11.6305) / 3.6563 : 0;
    const zemin = (r.zeminMesafeDeneyim ?? 0) !== 0 ? 0.02 * ((r.zeminMesafeDeneyim) - (-0.515)) : 0;
    return s + sire + zemin;
  });
  const ham = softmax(sBase);
  const lider = Math.max(...ham);
  const esik = hk ? 0.35 : 0.70;
  const T = lider >= esik ? 1.5 : 1;
  return softmax(sBase.map((x) => x / T));
}

// ---- eğitilen modeller ----
function standart(egitim, vec, mask, dim) {
  const mu = new Array(dim).fill(0), sd = new Array(dim).fill(0), n = new Array(dim).fill(0);
  for (const y of egitim) for (const r of y.rows) { const v = vec(r), g = mask ? mask(r) : null; for (let i = 0; i < dim; i++) { if (g && !g[i]) continue; mu[i] += v[i]; n[i]++; } }
  for (let i = 0; i < dim; i++) mu[i] = n[i] ? mu[i] / n[i] : 0;
  for (const y of egitim) for (const r of y.rows) { const v = vec(r), g = mask ? mask(r) : null; for (let i = 0; i < dim; i++) { if (g && !g[i]) continue; sd[i] += (v[i] - mu[i]) ** 2; } }
  for (let i = 0; i < dim; i++) sd[i] = n[i] ? Math.sqrt(sd[i] / n[i]) : 1;
  return { mu, sd };
}
const z = (r, vec, mask, norm) => { const v = vec(r), g = mask ? mask(r) : null; return v.map((x, i) => (g && !g[i] ? 0 : norm.sd[i] > 1e-9 ? (x - norm.mu[i]) / norm.sd[i] : 0)); };
function egit(egitim, vec, mask, dim) {
  const norm = standart(egitim, vec, mask, dim);
  const g = egitim.map((y) => ({ x: y.rows.map((r) => z(r, vec, mask, norm)), w: y.rows.findIndex((r) => r.win === 1) }));
  const w = new Array(dim).fill(0), vel = new Array(dim).fill(0);
  for (let ep = 0; ep < 800; ep++) {
    const grad = new Array(dim).fill(0);
    for (const q of g) { const p = softmax(q.x.map((f) => f.reduce((s, xi, i) => s + xi * w[i], 0))); for (let i = 0; i < q.x.length; i++) { const c = p[i] - (i === q.w ? 1 : 0); for (let k = 0; k < dim; k++) grad[k] += c * q.x[i][k]; } }
    for (let k = 0; k < dim; k++) { const gk = grad[k] / g.length + 0.02 * w[k]; vel[k] = 0.9 * vel[k] - 0.08 * gk; w[k] += vel[k]; }
  }
  return { w, norm };
}
const olas = (y, vec, mask, m) => softmax(y.rows.map((r) => z(r, vec, mask, m.norm)).map((f) => f.reduce((s, xi, i) => s + xi * m.w[i], 0)));

// ---- metrik (bağımsız, tek yerde) ----
function metrik(y, p) {
  const wi = y.rows.findIndex((r) => r.win === 1);
  const ll = -Math.log(Math.max(p[wi], 1e-15));
  const sira = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]).indexOf(wi) + 1;
  const brier = p.reduce((s, v, i) => s + (v - (i === wi ? 1 : 0)) ** 2, 0) / p.length;
  return { raceId: y.raceId, tarih: y.tarih, ll, brier, top1: sira <= 1 ? 1 : 0, top3: sira <= 3 ? 1 : 0, top6: sira <= 6 ? 1 : 0, mrr: 1 / sira, sira };
}

function lcg(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function ci(fark, gunler, B = 5000) {
  const r = lcg(20261006); const n = fark.length; const a = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += fark[Math.floor(r() * n)]; a.push(s / n); }
  a.sort((x, y) => x - y);
  const grup = new Map(); fark.forEach((f, i) => { const g = gunler[i]; if (!grup.has(g)) grup.set(g, []); grup.get(g).push(f); });
  const k = [...grup.keys()]; const r2 = lcg(20261007); const c = [];
  for (let b = 0; b < B; b++) { let s = 0, m = 0; for (let j = 0; j < k.length; j++) for (const f of grup.get(k[Math.floor(r2() * k.length)])) { s += f; m++; } c.push(s / m); }
  c.sort((x, y) => x - y);
  return { race: [a[Math.floor(0.025 * B)], a[Math.floor(0.975 * B)]], gun: [c[Math.floor(0.025 * B)], c[Math.floor(0.975 * B)]] };
}
const ort = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// ---- walk-forward ----
function calistir(seg, altKume) {
  const hepsi = yarislar((y) => (seg === "dusuk" ? (y.kat === "1a" || y.kat === "1b") : !(y.kat === "1a" || y.kat === "1b")) && (!altKume || y.prov === "PRE_RACE_VERIFIED"));
  const n = hepsi.length, c = Math.floor(n / 5);
  const parca = [0, 1, 2, 3, 4].map((i) => hepsi.slice(i * c, i === 4 ? n : (i + 1) * c));
  const sonuc = { PROD: [], REFIT: [], A: [], B: [] };
  for (let k = 1; k <= 4; k++) {
    const egitim = parca.slice(0, k).flat(), test = parca[k];
    for (const y of test) sonuc.PROD.push(metrik(y, prodOlasilik(y)));
    const mR = egit(egitim, vRaw, null, 13);
    for (const y of test) sonuc.REFIT.push(metrik(y, olas(y, vRaw, null, mR)));
    const mA = egit(egitim, vRaw, gozlemliA, 13);
    for (const y of test) sonuc.A.push(metrik(y, olas(y, vRaw, gozlemliA, mA)));
    if (altKume) {
      // Temiz küme: B ve diğerleri AYNI (PRE_RACE_VERIFIED) eğitim ve test yarışlarını kullanır.
      const mB = egit(egitim, vB, gozB, 12);
      for (const y of test) sonuc.B.push(metrik(y, olas(y, vB, gozB, mB)));
    }
  }
  // Ortak yarış seti: altKume ise tüm test yarışları (hepsi PRE); değilse yalnız PROD/REFIT/A.
  const ortakId = new Set((altKume ? sonuc.B : sonuc.A).map((m) => m.raceId));
  const sec = (arr) => arr.filter((m) => ortakId.has(m.raceId)).sort((a, b) => (a.raceId < b.raceId ? -1 : 1));
  const P = sec(sonuc.PROD), R = sec(sonuc.REFIT), A = sec(sonuc.A), B = sec(sonuc.B);
  const ozet = (m) => ({ N: m.length, LL: +ort(m.map((x) => x.ll)).toFixed(5), Brier: +ort(m.map((x) => x.brier)).toFixed(5), Top1: +ort(m.map((x) => x.top1)).toFixed(4), Top3: +ort(m.map((x) => x.top3)).toFixed(4), Top6: +ort(m.map((x) => x.top6)).toFixed(4), MRR: +ort(m.map((x) => x.mrr)).toFixed(4), MeanRank: +ort(m.map((x) => x.sira)).toFixed(3) });
  const fark = (X, Y) => X.map((x, i) => x.ll - Y[i].ll);
  const gunler = B.map((m) => m.tarih);
  const sonuc2 = { seg, altKume, yaris: B.length,
    PROD: ozet(P), REFIT: ozet(R), A: ozet(A), B: ozet(B),
    B_vs_REFIT: { d: +ort(fark(B, R)).toFixed(5), ci: ci(fark(B, R), gunler) },
    B_vs_PROD: { d: +ort(fark(B, P)).toFixed(5), ci: ci(fark(B, P), gunler) },
    A_vs_REFIT: { d: +ort(fark(A, R)).toFixed(5), ci: ci(fark(A, R), A.map((m) => m.tarih)) },
    A_vs_PROD: { d: +ort(fark(A, P)).toFixed(5), ci: ci(fark(A, P), A.map((m) => m.tarih)) },
    REFIT_vs_PROD: { d: +ort(fark(R, P)).toFixed(5), ci: ci(fark(R, P), R.map((m) => m.tarih)) },
  };
  return sonuc2;
}

const cikti = [];
for (const seg of ["dusuk", "diger"]) {
  cikti.push(calistir(seg, false)); // A ve PROD/REFIT tüm primer kümede (B yalnız PRE_RACE alt kümesi)
  cikti.push(calistir(seg, true));  // tam temiz alt küme (B karşılaştırması için birincil)
}
writeFileSync(`${S}/v5461-eval2.json`, JSON.stringify(cikti, null, 2));
console.log(JSON.stringify(cikti, null, 2));
