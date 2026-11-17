// KALICI ARAÇ — KONTROLLÜ AĞAÇ TABANLI MODEL KARŞILAŞTIRMASI (şartname v1.2 bölüm 5). SALT-OKUMA, DB'siz. Aynı as-of matris, AYNI ileri kronolojik 5 dış kat, AYNI sinyaller (eksik = 0 + eksik bayrağı), AYNI yarış-içi softmax kaybı.
// Model: gradyan artırmalı ağaçlar (XGBoost tarzı ikinci derece, histogram 32 kutu), derinlik 3, 120 tur, öğrenme oranı 0.08, L2 λ=10, min yaprak 100 koşucu. HİPERPARAMETRELER ÖNCEDEN SABİT (ayarlanmadı → ağaç lehine seçim yanlılığı yok).
// Kayıp: yarış başına softmax çok-sınıf log-kaybı; gradyan g_i = p_i − y_i, hessian h_i = p_i(1−p_i). Çıktı skoru F_i; olasılık softmax(F).
import fs from "node:fs";
type Cell = [number, number, number?] | null; type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
const M = JSON.parse(fs.readFileSync(process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris-tum-asof.json", "utf8")) as { ozellik: string[]; kesim: string[]; yarislar: Race[] };
{ const nAt = M.yarislar.reduce((p, r) => p + r.runners.length, 0); const keep = M.ozellik.map((_, i) => i).filter((i) => M.yarislar.reduce((p, r) => p + r.runners.filter((x) => x.f[i]).length, 0) / nAt >= 0.05); M.yarislar.forEach((r) => r.runners.forEach((x) => { x.f = keep.map((i) => x.f[i]!); })); M.ozellik = keep.map((i) => M.ozellik[i]!); }
const NAMES = M.ozellik, D = NAMES.length, kesim = M.kesim;
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); }; const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
function coz(A: number[][], d: number) { for (let i = 0; i < d; i++) { let pv = i; for (let k = i + 1; k < d; k++) if (Math.abs(A[k]![i]!) > Math.abs(A[pv]![i]!)) pv = k; [A[i], A[pv]] = [A[pv]!, A[i]!]; const dv = A[i]![i]! || 1e-12; for (let j = i; j <= d; j++) A[i]![j]! /= dv; for (let k = 0; k < d; k++) if (k !== i) { const mm = A[k]![i]!; for (let j = i; j <= d; j++) A[k]![j]! -= mm * A[i]![j]!; } } return A.map((r) => r[d]!); }
function egitDoğrusal(rows: { x: Float64Array[]; w: number }[], d: number): Float64Array { const w = new Float64Array(d); for (let it = 0; it < 25; it++) { const g = new Float64Array(d), H = new Float64Array(d * d);
  for (const q of rows) { const p = softmax(q.x.map((v) => { let t = 0; for (let i = 0; i < d; i++) t += v[i]! * w[i]!; return t; })); const m1 = new Float64Array(d); for (let i = 0; i < q.x.length; i++) for (let k = 0; k < d; k++) m1[k]! += p[i]! * q.x[i]![k]!; for (let k = 0; k < d; k++) g[k]! += m1[k]! - q.x[q.w]![k]!; for (let i = 0; i < q.x.length; i++) { const v = q.x[i]!, pi = p[i]!; for (let a = 0; a < d; a++) { const va = v[a]! * pi; for (let b = 0; b <= a; b++) H[a * d + b]! += va * v[b]!; } } for (let a = 0; a < d; a++) for (let b = 0; b <= a; b++) H[a * d + b]! -= m1[a]! * m1[b]!; }
  const N = rows.length; for (let a = 0; a < d; a++) { g[a] = g[a]! / N + 0.02 * w[a]!; for (let b = 0; b <= a; b++) { const v = H[a * d + b]! / N + (a === b ? 0.02 : 0); H[a * d + b] = v; H[b * d + a] = v; } }
  const st = coz(Array.from({ length: d }, (_, i) => [...Array.from({ length: d }, (_, j) => H[i * d + j]!), g[i]!]), d); let adim = 0; for (let i = 0; i < d; i++) { w[i]! -= st[i]!; adim = Math.max(adim, Math.abs(st[i]!)); } if (adim < 1e-7) break; } return w; }
// ── GBM ──
const NB = 32, DEPTH = 3, TUR = 120, LR = 0.08, LAMBDA = 10, MINLEAF = 100, MINH = 5;
type Node = { f: number; b: number; l: Node | number; r: Node | number };
function gbmEgit(X: Float64Array[], race: Int32Array, y: Uint8Array, nF: number) {
  const n = X.length; // bin eşikleri: eğitim niceller
  const esik: number[][] = []; for (let f = 0; f < nF; f++) { const v = Float64Array.from(X, (r) => r[f]!).sort(); const e: number[] = []; for (let b = 1; b < NB; b++) e.push(v[Math.floor(n * b / NB)]!); esik.push([...new Set(e)]); }
  const bin = (f: number, x: number) => { const e = esik[f]!; let lo = 0, hi = e.length; while (lo < hi) { const m = (lo + hi) >> 1; if (x <= e[m]!) hi = m; else lo = m + 1; } return lo; };
  const B = X.map((r) => Uint8Array.from({ length: nF }, (_, f) => bin(f, r[f]!)));
  // yarış indeksleri
  const rb: number[][] = []; for (let i = 0; i < n; i++) (rb[race[i]!] ??= []).push(i);
  const F = new Float64Array(n); const agaclar: Node[] = [];
  for (let t = 0; t < TUR; t++) {
    const g = new Float64Array(n), h = new Float64Array(n);
    for (const idx of rb) { if (!idx) continue; const p = softmax(idx.map((i) => F[i]!)); idx.forEach((i, j) => { g[i] = p[j]! - y[i]!; h[i] = Math.max(p[j]! * (1 - p[j]!), 1e-6); }); }
    const kur = (ids: number[], derinlik: number): Node | number => {
      let G = 0, H = 0; for (const i of ids) { G += g[i]!; H += h[i]!; } const yaprak = -G / (H + LAMBDA);
      if (derinlik >= DEPTH || ids.length < 2 * MINLEAF) return yaprak * LR;
      let eniyi = { kazanc: 0, f: -1, b: -1 }; const base = G * G / (H + LAMBDA);
      for (let f = 0; f < nF; f++) { const nb = esik[f]!.length + 1; const gs = new Float64Array(nb), hs = new Float64Array(nb), cs = new Int32Array(nb); for (const i of ids) { const b = B[i]![f]!; gs[b]! += g[i]!; hs[b]! += h[i]!; cs[b]!++; }
        let GL = 0, HL = 0, CL = 0; for (let b = 0; b < nb - 1; b++) { GL += gs[b]!; HL += hs[b]!; CL += cs[b]!; const CR = ids.length - CL; if (CL < MINLEAF || CR < MINLEAF || HL < MINH || H - HL < MINH) continue; const GR = G - GL, HR = H - HL; const kz = GL * GL / (HL + LAMBDA) + GR * GR / (HR + LAMBDA) - base; if (kz > eniyi.kazanc) eniyi = { kazanc: kz, f, b }; } }
      if (eniyi.f < 0) return yaprak * LR;
      const sol: number[] = [], sag: number[] = []; for (const i of ids) (B[i]![eniyi.f]! <= eniyi.b ? sol : sag).push(i);
      return { f: eniyi.f, b: eniyi.b, l: kur(sol, derinlik + 1), r: kur(sag, derinlik + 1) };
    };
    const kok = kur(Array.from({ length: n }, (_, i) => i), 0); agaclar.push(typeof kok === "number" ? { f: -1, b: 0, l: kok, r: kok } : kok);
    const tahmin = (nd: Node | number, i: number): number => (typeof nd === "number" ? nd : nd.f < 0 ? (nd.l as number) : tahmin(B[i]![nd.f]! <= nd.b ? nd.l : nd.r, i)); for (let i = 0; i < n; i++) F[i]! += tahmin(agaclar[t]!, i);
  }
  const tahminX = (x: Float64Array) => { const b = Uint8Array.from({ length: nF }, (_, f) => bin(f, x[f]!)); let s = 0; for (const a of agaclar) { let nd: Node | number = a; while (typeof nd !== "number") { if (nd.f < 0) { nd = nd.l; break; } nd = b[nd.f]! <= nd.b ? nd.l : nd.r; } s += nd as number; } return s; };
  return tahminX;
}
type RS = { ll: number; t1: number; t3: number };
const dogrusal: RS[] = [], agac: RS[] = [];
for (let k = 0; k < 5; k++) { const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!; const tr = races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit);
  const mu = new Float64Array(D), sg = new Float64Array(D); for (let i = 0; i < D; i++) { let s = 0, n = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) { s += c[0]; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) s2 += (c[0] - m) ** 2; } mu[i] = m; sg[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const zv = (x: { f: Cell[] }) => Float64Array.from({ length: D }, (_, i) => { const c = x.f[i]; return c ? c[1] * (c[0] - mu[i]!) / sg[i]! : 0; }); const gv = (x: { f: Cell[] }) => Float64Array.from({ length: 2 * D }, (_, q) => (q < D ? zv(x)[q]! : x.f[q - D] ? 1 : 0));
  // doğrusal
  const lin = egitDoğrusal(tr.map((r) => ({ w: r.runners.findIndex((x) => x.k === 1), x: r.runners.map(zv) })), D);
  // ağaç
  const X: Float64Array[] = [], race: number[] = [], y: number[] = []; tr.forEach((r, ri) => r.runners.forEach((x) => { X.push(gv(x)); race.push(ri); y.push(x.k === 1 ? 1 : 0); }));
  const pred = gbmEgit(X, Int32Array.from(race), Uint8Array.from(y), 2 * D);
  for (const r of te) { const w = r.runners.findIndex((x) => x.k === 1); const ev = (sc: number[]) => { const p = softmax(sc); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v); return { ll: -Math.log(Math.max(p[w]!, 1e-15)), t1: sr[0]!.i === w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === w) ? 1 : 0 }; };
    dogrusal.push(ev(r.runners.map((x) => { const z = zv(x); let t = 0; for (let i = 0; i < D; i++) t += z[i]! * lin[i]!; return t; }))); agac.push(ev(r.runners.map((x) => pred(gv(x))))); }
  console.log("dış kat " + k + " tamam (eğitim " + tr.length + ", test " + te.length + ")"); }
let sd0 = 7; const rn = () => (sd0 = (sd0 * 1664525 + 1013904223) % 4294967296) / 4294967296; const bs = (d: number[]) => { const o: number[] = []; for (let t = 0; t < 1000; t++) { let q = 0; for (let i = 0; i < d.length; i++) q += d[Math.floor(rn() * d.length)]!; o.push(q / d.length); } o.sort((a, b) => a - b); return [o[24]!, o[974]!]; };
const out: string[] = []; const P = (s = "") => { console.log(s); out.push(s); };
P("# AĞAÇ TABANLI MODEL KARŞILAŞTIRMASI (as-of, ileri; " + dogrusal.length + " test yarışı) — " + new Date().toISOString().slice(0, 10)); P("Hiperparametreler önceden sabit: derinlik " + DEPTH + ", " + TUR + " tur, öğrenme oranı " + LR + ", L2 " + LAMBDA + ", min yaprak " + MINLEAF + "; özellikler " + D + " sinyal z + " + D + " eksik bayrağı.");
P("| Model | log-loss | Top1 | Top3 |"); P("|---|---|---|---|"); for (const [ad, r] of [["Doğrusal (canlı yapı, ridge)", dogrusal], ["Gradyan artırmalı ağaç", agac]] as [string, RS[]][]) P("| " + ad + " | " + avg(r.map((x) => x.ll)).toFixed(4) + " | %" + (avg(r.map((x) => x.t1)) * 100).toFixed(1) + " | %" + (avg(r.map((x) => x.t3)) * 100).toFixed(1) + " |");
const d = agac.map((x, i) => x.ll - dogrusal[i]!.ll); const c = bs(d); P("\nΔLL (ağaç − doğrusal; negatif = ağaç daha iyi): " + (avg(d) >= 0 ? "+" : "") + avg(d).toFixed(4) + " [" + c[0]!.toFixed(4) + ", " + c[1]!.toFixed(4) + "]" + (c[1]! < 0 ? " ✔ ağaç daha iyi" : c[0]! > 0 ? " ✘ ağaç daha kötü" : " ≈ fark yok"));
P("Top3'te ağaç kurtarılan " + agac.filter((x, i) => x.t3 === 1 && dogrusal[i]!.t3 === 0).length + " / yeni kaçırılan " + agac.filter((x, i) => x.t3 === 0 && dogrusal[i]!.t3 === 1).length);
P("Okuma: şartname 'daha karmaşık modelin nihai seçimi de bağımsız test başarısına bağlı'. Ağaç yalnız bu ileri test ile karşılaştırıldı; üretime alınmaz, yalnız doğrusal yapının yeterli olup olmadığı sorusunu cevaplar.");
fs.writeFileSync(".sinyal-veri/agac-karsilastirma-asof.md", out.join("\n"));
