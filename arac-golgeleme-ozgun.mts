// KALICI ARAÇ — ÖZGÜN BİLGİ (artık) TESTİ (şartname v1.2 bölüm 4). SALT-OKUMA, DB'siz. Girdi: GOLGELEME_MATRIS (varsayılan as-of matris). Yalnız İLERİ kronolojik katlar (eğitim = kat öncesi tüm yarışlar); ridge ve normalizasyon YALNIZ eğitim penceresinde öğrenilir.
// Her sinyal X için:  X̂ = f(diğer sinyaller) (ridge, eğitim penceresi, X'in gözlemli olduğu atlar)  →  r_X = X − X̂ (özgün bölüm).
//   R²        : X'in diğer sinyallerle açıklanan varyans payı (TEST dönemi)
//   solo(X)   : M0+X kazancı     solo(r_X): M0+r_X kazancı   → özgün pay = solo(r_X)/solo(X)
//   Δek(X)    : tam model − (tam model − X)      Δdeğiştir: tam model − (X yerine r_X konmuş tam model)
// UYARI (şartnamenin kendi sınırı): DOĞRUSAL modelde X'i r_X ile değiştirmek, X̂ diğer sinyallerin doğrusal kombinasyonu olduğundan, ridge dışında modeli DEĞİŞTİRMEZ → Δdeğiştir ≈ 0 beklenir; özgün bilginin asıl ölçüsü R² ve solo(r_X)'dir. Etkileşimli/ağaç modelinde farklı olabilir.
import fs from "node:fs";
type Cell = [number, number, number?] | null; type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
const M = JSON.parse(fs.readFileSync(process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris-tum-asof.json", "utf8")) as { ozellik: string[]; kesim: string[]; yarislar: Race[] };
{ const nAt = M.yarislar.reduce((p, r) => p + r.runners.length, 0); const keep = M.ozellik.map((_, i) => i).filter((i) => M.yarislar.reduce((p, r) => p + r.runners.filter((x) => x.f[i]).length, 0) / nAt >= Number(process.env.MIN_DOLULUK ?? 0.05)); M.yarislar.forEach((r) => r.runners.forEach((x) => { x.f = keep.map((i) => x.f[i]!); })); M.ozellik = keep.map((i) => M.ozellik[i]!); }
const NAMES = M.ozellik, D = NAMES.length, kesim = M.kesim;
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
function coz(A: number[][], d: number) { for (let i = 0; i < d; i++) { let pv = i; for (let k = i + 1; k < d; k++) if (Math.abs(A[k]![i]!) > Math.abs(A[pv]![i]!)) pv = k; [A[i], A[pv]] = [A[pv]!, A[i]!]; const dv = A[i]![i]! || 1e-12; for (let j = i; j <= d; j++) A[i]![j]! /= dv; for (let k = 0; k < d; k++) if (k !== i) { const mm = A[k]![i]!; for (let j = i; j <= d; j++) A[k]![j]! -= mm * A[i]![j]!; } } return A.map((r) => r[d]!); }
function egit(rows: { x: Float64Array[]; w: number }[], d: number): Float64Array { // Newton, ridge 0.02 (motorla aynı hedef)
  const w = new Float64Array(d); if (!d) return w;
  for (let it = 0; it < 25; it++) { const g = new Float64Array(d), H = new Float64Array(d * d);
    for (const q of rows) { const p = softmax(q.x.map((v) => { let t = 0; for (let i = 0; i < d; i++) t += v[i]! * w[i]!; return t; })); const m1 = new Float64Array(d); for (let i = 0; i < q.x.length; i++) for (let k = 0; k < d; k++) m1[k]! += p[i]! * q.x[i]![k]!; for (let k = 0; k < d; k++) g[k]! += m1[k]! - q.x[q.w]![k]!; for (let i = 0; i < q.x.length; i++) { const v = q.x[i]!, pi = p[i]!; for (let a = 0; a < d; a++) { const va = v[a]! * pi; for (let b = 0; b <= a; b++) H[a * d + b]! += va * v[b]!; } } for (let a = 0; a < d; a++) for (let b = 0; b <= a; b++) H[a * d + b]! -= m1[a]! * m1[b]!; }
    const N = rows.length; for (let a = 0; a < d; a++) { g[a] = g[a]! / N + 0.02 * w[a]!; for (let b = 0; b <= a; b++) { const v = H[a * d + b]! / N + (a === b ? 0.02 : 0); H[a * d + b] = v; H[b * d + a] = v; } }
    const st = coz(Array.from({ length: d }, (_, i) => [...Array.from({ length: d }, (_, j) => H[i * d + j]!), g[i]!]), d); let adim = 0; for (let i = 0; i < d; i++) { w[i]! -= st[i]!; adim = Math.max(adim, Math.abs(st[i]!)); } if (adim < 1e-7) break; }
  return w;
}
type Z = { id: string; w: number; n: number; z: Float64Array[]; ok: Uint8Array[] };
function kurZ(tr: Race[], te: Race[]) { const mu = new Float64Array(D), sg = new Float64Array(D);
  for (let i = 0; i < D; i++) { let s = 0, n = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) { s += c[0]; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) s2 += (c[0] - m) ** 2; } mu[i] = m; sg[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (r: Race): Z => ({ id: r.raceId, w: r.runners.findIndex((x) => x.k === 1), n: r.runners.length, z: r.runners.map((x) => Float64Array.from({ length: D }, (_, i) => { const c = x.f[i]; return c ? c[1] * (c[0] - mu[i]!) / sg[i]! : 0; })), ok: r.runners.map((x) => Uint8Array.from({ length: D }, (_, i) => (x.f[i] ? 1 : 0))) });
  return { train: tr.map(mk), test: te.map(mk) }; }
const rowsOf = (Z: Z[], f: (z: Float64Array, ok: Uint8Array) => Float64Array) => Z.map((r) => ({ w: r.w, x: r.z.map((z, j) => f(z, r.ok[j]!)) }));
const llOf = (rows: { x: Float64Array[]; w: number }[], w: Float64Array) => rows.map((q) => { const p = softmax(q.x.map((v) => { let t = 0; for (let i = 0; i < w.length; i++) t += v[i]! * w[i]!; return t; })); return -Math.log(Math.max(p[q.w]!, 1e-15)); });
let sd0 = 7; const rn = () => (sd0 = (sd0 * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (d: number[]) => { const bs: number[] = []; for (let t = 0; t < 1000; t++) { let q = 0; for (let i = 0; i < d.length; i++) q += d[Math.floor(rn() * d.length)]!; bs.push(q / d.length); } bs.sort((p, q) => p - q); return { m: avg(d), lo: bs[24]!, hi: bs[974]! }; };
const fmt = (c: { m: number; lo: number; hi: number }) => (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + ", " + c.hi.toFixed(4) + "]" + (c.lo > 0 ? " ✔" : c.hi < 0 ? " ✘" : "");
// birikim: sinyal başına (kat sırasıyla birleştirilmiş test yarışı kazançları)
const acc = NAMES.map(() => ({ sx: [] as number[], sr: [] as number[], ek: [] as number[], rep: [] as number[], sse: 0, sst: 0 })); const m0: number[] = [];
for (let k = 0; k < 5; k++) {
  const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!; const tr = races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit); const Zs = kurZ(tr, te);
  const tam = (z: Float64Array) => z; const wTam = egit(rowsOf(Zs.train, tam), D); const teTam = rowsOf(Zs.test, tam); const llTam = llOf(teTam, wTam); const ll0 = Zs.test.map((r) => Math.log(r.n)); m0.push(...ll0);
  for (let i = 0; i < D; i++) {
    // ridge X ~ diğerleri (eğitim koşucuları, X gözlemli)
    const O = [...Array(D).keys()].filter((j) => j !== i), dO = O.length + 1; const A = Array.from({ length: dO }, () => new Array(dO + 1).fill(0));
    for (const r of Zs.train) for (let j = 0; j < r.z.length; j++) { if (!r.ok[j]![i]) continue; const x = [1, ...O.map((o) => r.z[j]![o]!)], y = r.z[j]![i]!; for (let a = 0; a < dO; a++) { for (let b = 0; b < dO; b++) A[a]![b]! += x[a]! * x[b]!; A[a]![dO]! += x[a]! * y; } }
    for (let a = 1; a < dO; a++) A[a]![a]! += 1; const beta = coz(A, dO);
    const tahmin = (z: Float64Array) => { let t = beta[0]!; O.forEach((o, q) => (t += beta[q + 1]! * z[o]!)); return t; };
    for (const r of Zs.test) for (let j = 0; j < r.z.length; j++) if (r.ok[j]![i]) { const y = r.z[j]![i]!, e = y - tahmin(r.z[j]!); acc[i]!.sse += e * e; acc[i]!.sst += y * y; }
    const solo = (f: (z: Float64Array, ok: Uint8Array) => Float64Array) => { const w = egit(rowsOf(Zs.train, f), 1); return llOf(rowsOf(Zs.test, f), w); };
    const lSx = solo((z) => Float64Array.of(z[i]!)); const lSr = solo((z, ok) => Float64Array.of(ok[i] ? z[i]! - tahmin(z) : 0));
    const minus = (z: Float64Array) => Float64Array.from(O, (o) => z[o]!); const lMinus = llOf(rowsOf(Zs.test, minus), egit(rowsOf(Zs.train, minus), D - 1));
    const repl = (z: Float64Array, ok: Uint8Array) => { const v = Float64Array.from(z); v[i] = ok[i] ? z[i]! - tahmin(z) : 0; return v; }; const lRepl = llOf(rowsOf(Zs.test, repl), egit(rowsOf(Zs.train, repl), D));
    acc[i]!.sx.push(...ll0.map((v, q) => v - lSx[q]!)); acc[i]!.sr.push(...ll0.map((v, q) => v - lSr[q]!)); acc[i]!.ek.push(...lMinus.map((v, q) => v - llTam[q]!)); acc[i]!.rep.push(...lRepl.map((v, q) => v - llTam[q]!)); // rep = L(repl) − L(tam): ≈0 beklenir
  }
  console.log("dış kat " + k + " tamam (eğitim " + tr.length + ", test " + te.length + ")");
}
const out: string[] = []; const P = (s = "") => { console.log(s); out.push(s); };
P("# ÖZGÜN BİLGİ (artık) TESTİ — as-of matris, ileri kronolojik — " + new Date().toISOString().slice(0, 10));
P("Kazançlar = L(eski) − L(yeni) (pozitif = iyileşme); Δdeğiştir = L(X yerine r_X) − L(tam): ≈0 = doğrusal modelde beklenen eşdeğerlik. R² test dönemi, X'in gözlemli olduğu atlar.");
P("\n| Sinyal | R² (diğerleri→X) | solo(X) | solo(r_X: özgün) | özgün pay | Δek(X) | Δdeğiştir (X→r_X) |"); P("|---|---|---|---|---|---|---|");
for (let i = 0; i < D; i++) { const a = acc[i]!; const r2 = a.sst > 0 ? 1 - a.sse / a.sst : NaN; const sx = ci(a.sx), sr = ci(a.sr); const pay = sx.m > 1e-4 ? (sr.m / sx.m * 100).toFixed(0) + "%" : "—";
  P("| " + NAMES[i] + " | " + (isNaN(r2) ? "—" : r2.toFixed(2)) + " | " + fmt(sx) + " | " + fmt(sr) + " | " + pay + " | " + fmt(ci(a.ek)) + " | " + fmt(ci(a.rep)) + " |"); }
P("\nOkuma: **R² yüksek ve özgün pay düşük** = sinyal başka sinyallerle büyük ölçüde açıklanıyor (tekrar). **R² düşük, özgün pay yüksek** = ayrı bilgi. Δdeğiştir ≠ 0 ise ridge/eksik-veri etkisidir. Kalıntı, etkileşimleri korumaz (şartname sınırı).");
fs.writeFileSync(".sinyal-veri/golgeleme-ozgun-asof.md", out.join("\n"));
