// KALICI ARAÇ — V7 SIFIRDAN MOTOR: İLERİ SEÇİM (özellik kabul protokolüyle). SALT-OKUMA, DB'siz. Eski katsayı/seçim TAŞINMAZ: sinyalsiz modelden (her ata 1/N) başlar, her adımda adayların her biri kabul protokolüne (src/lib/methodology/v7/ozellik-kabul.ts) sokulur.
// DÖNEMLER: SEÇİM = 5 dış katın İLK ÜÇÜNÜN test dönemleri (kat 0-2); NİHAİ DEĞERLENDİRME = son iki kat (3-4) — seçimde HİÇ kullanılmaz. Her kat için model, o katın başlangıcından ÖNCEKİ tüm yarışlarla eğitilir (yalnız geçmiş→gelecek).
// Girdi: as-of matris (AS_OF=1, yalnız yarış-öncesi yeniden üretilebilen 17 sinyal; hepsi as-of kanıtlı = true). Çözücü: Newton, ridge 0.02 (motorla aynı hedef; yalnız çözücü, katsayı DEĞİL).
import fs from "node:fs";
import { kabulKarari, bootstrapGA } from "./src/lib/methodology/v7/ozellik-kabul";
type Cell = [number, number, number?] | null; type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
const M = JSON.parse(fs.readFileSync(process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris-tum-asof.json", "utf8")) as { ozellik: string[]; kesim: string[]; yarislar: Race[] };
{ const nAt = M.yarislar.reduce((p, r) => p + r.runners.length, 0); const keep = M.ozellik.map((_, i) => i).filter((i) => M.yarislar.reduce((p, r) => p + r.runners.filter((x) => x.f[i]).length, 0) / nAt >= 0.05); M.yarislar.forEach((r) => r.runners.forEach((x) => { x.f = keep.map((i) => x.f[i]!); })); M.ozellik = keep.map((i) => M.ozellik[i]!); }
const NAMES = M.ozellik, D = NAMES.length; let kesim = M.kesim;
let races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
// YARIŞ POPÜLASYONU: YARIS_LISTESI verilirse (örn. .sinyal-veri/kosu-tipleri-yarislar.json = /admin/kosu-tipleri sayfasındaki yarışlar) YALNIZ onlar test/eğitim popülasyonudur; kat sınırları bu kümenin tarihlerinden yeniden hesaplanır.
if (process.env.YARIS_LISTESI) { const set = new Set((JSON.parse(fs.readFileSync(process.env.YARIS_LISTESI, "utf8")) as { yarislar: { raceId: string }[] }).yarislar.map((r) => r.raceId)); races = races.filter((r) => set.has(r.raceId)); const gun = [...new Set(races.map((r) => r.tarih))].sort(); kesim = [0.4, 0.52, 0.64, 0.76, 0.88].map((q) => gun[Math.floor(gun.length * q)]!); console.log("POPÜLASYON: " + process.env.YARIS_LISTESI + " → " + races.length + " yarış | kat sınırları " + kesim.join(", ")); }
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); }; const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
function coz(A: number[][], d: number) { for (let i = 0; i < d; i++) { let pv = i; for (let k = i + 1; k < d; k++) if (Math.abs(A[k]![i]!) > Math.abs(A[pv]![i]!)) pv = k; [A[i], A[pv]] = [A[pv]!, A[i]!]; const dv = A[i]![i]! || 1e-12; for (let j = i; j <= d; j++) A[i]![j]! /= dv; for (let k = 0; k < d; k++) if (k !== i) { const mm = A[k]![i]!; for (let j = i; j <= d; j++) A[k]![j]! -= mm * A[i]![j]!; } } return A.map((r) => r[d]!); }
type Row = { w: number; z: Float64Array[]; n: number };
function egit(rows: Row[], cols: number[]): Float64Array { const d = cols.length, w = new Float64Array(d); if (!d) return w;
  for (let it = 0; it < 25; it++) { const g = new Float64Array(d), H = new Float64Array(d * d);
    for (const q of rows) { const x = q.z.map((v) => Float64Array.from(cols, (c) => v[c]!)); const p = softmax(x.map((v) => { let t = 0; for (let i = 0; i < d; i++) t += v[i]! * w[i]!; return t; })); const m1 = new Float64Array(d); for (let i = 0; i < x.length; i++) for (let k = 0; k < d; k++) m1[k]! += p[i]! * x[i]![k]!; for (let k = 0; k < d; k++) g[k]! += m1[k]! - x[q.w]![k]!; for (let i = 0; i < x.length; i++) { const v = x[i]!, pi = p[i]!; for (let a = 0; a < d; a++) { const va = v[a]! * pi; for (let b = 0; b <= a; b++) H[a * d + b]! += va * v[b]!; } } for (let a = 0; a < d; a++) for (let b = 0; b <= a; b++) H[a * d + b]! -= m1[a]! * m1[b]!; }
    const N = rows.length; for (let a = 0; a < d; a++) { g[a] = g[a]! / N + 0.02 * w[a]!; for (let b = 0; b <= a; b++) { const v = H[a * d + b]! / N + (a === b ? 0.02 : 0); H[a * d + b] = v; H[b * d + a] = v; } }
    const st = coz(Array.from({ length: d }, (_, i) => [...Array.from({ length: d }, (_, j) => H[i * d + j]!), g[i]!]), d); let adim = 0; for (let i = 0; i < d; i++) { w[i]! -= st[i]!; adim = Math.max(adim, Math.abs(st[i]!)); } if (adim < 1e-7) break; }
  return w; }
// kat verileri (z eğitim penceresinden)
const F = [0, 1, 2, 3, 4].map((k) => { const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!; const tr = races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit);
  const mu = new Float64Array(D), sg = new Float64Array(D); for (let i = 0; i < D; i++) { let s = 0, n = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) { s += c[0]; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) s2 += (c[0] - m) ** 2; } mu[i] = m; sg[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (r: Race): Row => ({ w: r.runners.findIndex((x) => x.k === 1), n: r.runners.length, z: r.runners.map((x) => Float64Array.from({ length: D }, (_, i) => { const c = x.f[i]; return c ? c[1] * (c[0] - mu[i]!) / sg[i]! : 0; })) }); return { tr: tr.map(mk), te: te.map(mk), nTr: tr.length }; });
type Cikti = { ll: number; t1: number; t3: number; p: number[]; w: number };
const cache = new Map<string, Cikti[]>();
function degerlendir(k: number, cols: number[]): Cikti[] { const key = k + "|" + [...cols].sort((a, b) => a - b).join(","); const c = cache.get(key); if (c) return c; const w = egit(F[k]!.tr, cols);
  const out = F[k]!.te.map((r) => { const p = cols.length ? softmax(r.z.map((v) => { let t = 0; cols.forEach((c2, i) => (t += v[c2]! * w[i]!)); return t; })) : r.z.map(() => 1 / r.n); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v); return { ll: -Math.log(Math.max(p[r.w]!, 1e-15)), t1: sr[0]!.i === r.w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === r.w) ? 1 : 0, p, w: r.w }; }); cache.set(key, out); return out; }
const L: string[] = []; const P = (s = "") => { console.log(s); L.push(s); };
const DEV = [0, 1, 2], NIHAI = [3, 4];
P("# V7 SIFIRDAN MOTOR — İLERİ SEÇİM (özellik kabul protokolü) — " + new Date().toISOString().slice(0, 10));
P("Yarış " + races.length + " | aday özellik " + D + " (hepsi as-of kanıtlı) | SEÇİM dönemi: kat 0-2 test yarışları " + DEV.reduce((p, k) => p + F[k]!.te.length, 0) + " | NİHAİ dönem (seçimde kullanılmaz): kat 3-4 " + NIHAI.reduce((p, k) => p + F[k]!.te.length, 0) + " | sinyalsiz taban = her ata 1/N | kural: ort. kazanç>0, bootstrap %95 GA alt>0, DEV katlarının ≥2/3'ü pozitif.");
let S: number[] = []; const adimlar: string[] = [];
for (let adim = 1; adim <= D; adim++) {
  const aday = [...Array(D).keys()].filter((i) => !S.includes(i)); const sonuc: { i: number; ort: number; alt: number; kabul: boolean; neden: string; pozitifKat: number }[] = [];
  for (const i of aday) { const kazanc: number[] = [], fold: number[] = []; for (const k of DEV) { const a = degerlendir(k, S), b = degerlendir(k, [...S, i]); a.forEach((x, q) => { kazanc.push(x.ll - b[q]!.ll); fold.push(k); }); } const kr = kabulKarari({ kazanc, fold, asOfKaniti: true, minKat: 2 }); sonuc.push({ i, ort: kr.ortalama, alt: kr.altGA, kabul: kr.kabul, neden: kr.neden, pozitifKat: kr.pozitifKat }); }
  sonuc.sort((a, b) => b.ort - a.ort); const gecen = sonuc.filter((x) => x.kabul);
  P("\nAdım " + adim + " (mevcut: " + (S.map((i) => NAMES[i]).join(", ") || "∅ sinyalsiz") + "): en iyi 4 aday → " + sonuc.slice(0, 4).map((x) => NAMES[x.i] + " " + (x.ort >= 0 ? "+" : "") + x.ort.toFixed(4) + " [alt " + x.alt.toFixed(4) + ", " + x.pozitifKat + "/3 kat] " + (x.kabul ? "✔KABUL" : "✘")).join(" | "));
  if (!gecen.length) { P("→ Hiçbir aday kabul koşulunu sağlamadı: SEÇİM BİTTİ."); break; }
  const sec = gecen[0]!; S = [...S, sec.i]; adimlar.push(NAMES[sec.i] + " (+" + sec.ort.toFixed(4) + ")"); P("→ KABUL: " + NAMES[sec.i]);
}
P("\n## KABUL EDİLEN ÖZELLİKLER (sırayla): " + (S.map((i) => NAMES[i]).join(" → ") || "YOK"));
// NİHAİ: yalnız kat 3-4
const topla = (cols: number[]) => NIHAI.flatMap((k) => degerlendir(k, cols)); const sonS = topla(S), sifir = topla([]), tam = topla([...Array(D).keys()]);
const ece = (C: Cikti[]) => { const ps: number[] = [], ys: number[] = []; for (const c of C) c.p.forEach((p, i) => { ps.push(p); ys.push(i === c.w ? 1 : 0); }); let e = 0; for (let b = 0; b < 10; b++) { const idx = ps.map((_, i) => i).filter((i) => ps[i]! >= b / 10 && (b === 9 ? ps[i]! <= 1 : ps[i]! < (b + 1) / 10)); if (idx.length) e += idx.length / ps.length * Math.abs(avg(idx.map((i) => ps[i]!)) - avg(idx.map((i) => ys[i]!))); } return e; };
P("\n## NİHAİ DEĞERLENDİRME (kat 3-4, " + sonS.length + " yarış; seçimde hiç kullanılmadı)"); P("| Model | özellik | log-loss | Top1 | Top3 | ECE |"); P("|---|---|---|---|---|---|");
for (const [ad, C, n] of [["Sinyalsiz (1/N)", sifir, 0], ["V7 kabul edilen küme", sonS, S.length], ["Referans: 17 sinyalin tamamı", tam, D]] as [string, Cikti[], number][]) P("| " + ad + " | " + n + " | " + avg(C.map((x) => x.ll)).toFixed(4) + " | %" + (avg(C.map((x) => x.t1)) * 100).toFixed(1) + " | %" + (avg(C.map((x) => x.t3)) * 100).toFixed(1) + " | " + ece(C).toFixed(4) + " |");
const fk = (a: Cikti[], b: Cikti[]) => { const c = bootstrapGA(a.map((x, i) => x.ll - b[i]!.ll), 1000, 9); return (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + ", " + c.hi.toFixed(4) + "]" + (c.hi < 0 ? " ✔" : c.lo > 0 ? " ✘" : " ≈"); };
P("\nΔLL (V7 − sinyalsiz): " + fk(sonS, sifir) + " | ΔLL (V7 − 17 sinyalin tamamı): " + fk(sonS, tam) + " (negatif = V7 daha iyi)");
P("Kurtarılan/yeni kaçırılan (V7 vs 17 sinyalin tamamı), Top3: " + sonS.filter((x, i) => x.t3 === 1 && tam[i]!.t3 === 0).length + " / " + sonS.filter((x, i) => x.t3 === 0 && tam[i]!.t3 === 1).length + " | Top1: " + sonS.filter((x, i) => x.t1 === 1 && tam[i]!.t1 === 0).length + " / " + sonS.filter((x, i) => x.t1 === 0 && tam[i]!.t1 === 1).length);
P("\nKanıt düzeyi: ÖLÇÜLDÜ (as-of, ileri). Nihai dönem seçimde kullanılmadı; ancak AYNI 5 kat daha önceki analizlerde (gölgeleme, simülasyon) görüldü → tam bağımsız değildir. Gerçek bağımsız doğrulama yeni gelen yarışlardır.");
fs.writeFileSync(".sinyal-veri/v7-ileri-secim.md", L.join("\n"));
