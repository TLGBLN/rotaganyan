// KALICI ARAÇ — SADE SİNYAL KÜMESİ (şartname bölüm 5): birbirini gölgeleyenleri BİRLEŞTİR/ELE, aynı başarıyı daha az sinyalle koru.
// SALT-OKUMA, DB'siz: .sinyal-veri/golgeleme-matris.json (arac-golgeleme-veri-dok.mts). Model dosyası/ağırlık YAZMAZ.
// Yöntem: 1) Aynı veriyi okuyan çiftler BİRLEŞTİRİLİR (ortalama z): ACC_CLOSE_RES+ACC_LATE → ACC_BITIS (ρ=0,83).
//         2) Geriye doğru eleme: her adımda çıkarılınca DEV katlarında (0-2) kaybı EN AZ artıran sinyal atılır. Seçim YALNIZ DEV'de; SINAMA (3-4) hiç seçime girmez, sadece rapor.
//         3) Durma: DEV log-loss, tam modele göre +TOL'u aşınca (TOL=0,002; bu 'aynı başarı' ölçüsüdür, tamamen benim seçimim).
// Çıktı: .sinyal-veri/golgeleme-sade-<gün>.md — boyut başına DEV/SINAMA/5-kat LL, Top1, Top3 ve her adımda atılan sinyal.
import fs from "node:fs";
type Cell = [number, number, number?] | null;
type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
const M = JSON.parse(fs.readFileSync(process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris.json", "utf8")) as { ozellik: string[]; kesim: string[]; yarislar: Race[] };
const NAMES = M.ozellik, D = NAMES.length, TOL = Number(process.env.SADE_TOL ?? 0.002);
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const kesim = M.kesim;
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
const idx = (n: string) => NAMES.indexOf(n);

// Sütunlar: 0..D-1 ham sinyal z'leri; D.. birleşik sütunlar (iki z'nin ortalaması; biri eksikse diğeri)
const BIRLES: { ad: string; a: string; b: string }[] = [{ ad: "ACC_BITIS(CLOSE+LATE)", a: "ACC_CLOSE_RES", b: "ACC_LATE" }];
const COLN = [...NAMES, ...BIRLES.map((b) => b.ad)];
type Row = { id: string; n: number; w: number; x: Float64Array[] };
type Fold = { train: Row[]; test: Row[] };
const folds: Fold[] = [0, 1, 2, 3, 4].map((k) => {
  const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!;
  const tr = races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit);
  const mu = new Float64Array(D), sg = new Float64Array(D);
  for (let i = 0; i < D; i++) { let s = 0, n = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) { s += c[0]; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) s2 += (c[0] - m) ** 2; } mu[i] = m; sg[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (r: Race): Row => ({ id: r.raceId, n: r.runners.length, w: r.runners.findIndex((x) => x.k === 1), x: r.runners.map((x) => {
    const v = new Float64Array(COLN.length); const z: (number | null)[] = [];
    for (let i = 0; i < D; i++) { const c = x.f[i]; z.push(c ? c[1] * (c[0] - mu[i]!) / sg[i]! : null); v[i] = z[i] ?? 0; }
    BIRLES.forEach((b, j) => { const za = z[idx(b.a)], zb = z[idx(b.b)]; v[D + j] = za != null && zb != null ? (za + zb) / 2 : (za ?? zb ?? 0); });
    return v; }) });
  return { train: tr.map(mk), test: te.map(mk) };
});
function egit(rows: Row[], cols: number[]): Float64Array {
  const d = cols.length, w = new Float64Array(d), vel = new Float64Array(d);
  const X = rows.map((r) => ({ w: r.w, x: r.x.map((v) => Float64Array.from(cols, (c) => v[c]!)) }));
  for (let ep = 0; ep < 800; ep++) {
    const g = new Float64Array(d);
    for (const q of X) { const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i]! * w[i]!; return s; })); for (let i = 0; i < q.x.length; i++) { const c = p[i]! - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k]! += c * q.x[i]![k]!; } }
    for (let k = 0; k < d; k++) { const gk = g[k]! / X.length + 0.02 * w[k]!; vel[k] = 0.9 * vel[k]! - 0.08 * gk; w[k]! += vel[k]!; }
  }
  return w;
}
type RS = { ll: number; t1: number; t3: number; fold: number };
const cache = new Map<string, RS[]>();
function kosu(cols: number[], katlar: number[]): RS[] {
  const key = cols.join(",") + "|" + katlar.join(","); const c = cache.get(key); if (c) return c;
  const out: RS[] = [];
  for (const k of katlar) { const f = folds[k]!; const w = egit(f.train, cols);
    for (const r of f.test) { const p = softmax(r.x.map((v) => { let t = 0; for (let i = 0; i < cols.length; i++) t += v[cols[i]!]! * w[i]!; return t; })); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
      out.push({ ll: -Math.log(Math.max(p[r.w]!, 1e-15)), t1: sr[0]!.i === r.w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === r.w) ? 1 : 0, fold: k }); } }
  cache.set(key, out); return out;
}
const L = (rs: RS[]) => avg(rs.map((x) => x.ll));
const log: string[] = []; const P = (s = "") => { console.log(s); log.push(s); };
const DEV = [0, 1, 2], SIN = [3, 4];
const ozet = (cols: number[]) => { const a = kosu(cols, [0, 1, 2, 3, 4]); const d = a.filter((x) => x.fold <= 2), s = a.filter((x) => x.fold >= 3); return { dev: L(d), sin: L(s), all: L(a), t1: avg(a.map((x) => x.t1)) * 100, t3: avg(a.map((x) => x.t3)) * 100 }; };

// SADE_SETLER="ad=at1+at2+..;ad2=..": ÖNCEDEN belirlenmiş (yapıya dayalı) kümeleri değerlendir, eleme döngüsünü ATLA. 'ACC_BITIS' = CLOSE+LATE birleştir.
if (process.env.SADE_SETLER) {
  const f24 = [...Array(D).keys()]; const s: { ad: string; cols: number[] }[] = [{ ad: "TAM canlı (24)", cols: f24 }];
  for (const t of process.env.SADE_SETLER.split(";")) { const [ad, l] = t.split("="); const at = new Set((l ?? "").split("+").filter(Boolean)); const birles = at.delete("ACC_BITIS"); let c = f24.filter((i) => !at.has(NAMES[i]!)); if (birles) c = [...c.filter((i) => i !== idx("ACC_CLOSE_RES") && i !== idx("ACC_LATE")), D]; s.push({ ad: ad!, cols: c }); }
  console.log("| Küme | sinyal | DEV LL | SINAMA LL | 5 kat LL | Top1 | Top3 | SINAMA ΔLL vs tam [GA] | DEV ΔLL vs tam [GA] |"); console.log("|---|---|---|---|---|---|---|---|---|");
  const tamS = kosu(f24, SIN), tamD = kosu(f24, DEV);
  const ci = (dif: number[]) => { let sd = 7; const r = () => (sd = (sd * 1664525 + 1013904223) % 4294967296) / 4294967296; const bs: number[] = []; for (let t = 0; t < 2000; t++) { let q = 0; for (let i = 0; i < dif.length; i++) q += dif[Math.floor(r() * dif.length)]!; bs.push(q / dif.length); } bs.sort((p, q) => p - q); return avg(dif).toFixed(4) + " [" + bs[49]!.toFixed(4) + "," + bs[1949]!.toFixed(4) + "]"; };
  for (const x of s) { const o = ozet(x.cols); const aS = kosu(x.cols, SIN), aD = kosu(x.cols, DEV); console.log("| " + x.ad + " | " + x.cols.length + " | " + o.dev.toFixed(4) + " | " + o.sin.toFixed(4) + " | " + o.all.toFixed(4) + " | %" + o.t1.toFixed(1) + " | %" + o.t3.toFixed(1) + " | " + ci(aS.map((q, i) => q.ll - tamS[i]!.ll)) + " | " + ci(aD.map((q, i) => q.ll - tamD[i]!.ll)) + " |"); console.log("   sinyaller: " + x.cols.map((c) => COLN[c]).join(", ")); }
  process.exit(0);
}
// Başlangıç: ham 24 sinyalden ACC_CLOSE_RES+ACC_LATE çıkarılıp birleşik ACC_BITIS konur (23 sütun) — aynı veri, ρ=0,83.
const full24 = [...Array(D).keys()];
const basla = [...full24.filter((i) => i !== idx("ACC_CLOSE_RES") && i !== idx("ACC_LATE")), D];
P("# SADE SİNYAL KÜMESİ — " + new Date().toISOString().slice(0, 10));
P("Yarış " + races.length + " | DEV test " + kosu(full24, DEV).length + " | SINAMA test " + kosu(full24, SIN).length + " | durma toleransı DEV LL +" + TOL);
const oF = ozet(full24), oB = ozet(basla);
P("\n| Küme | sinyal | DEV LL | SINAMA LL | 5 kat LL | Top1 | Top3 |"); P("|---|---|---|---|---|---|---|");
P("| TAM canlı | 24 | " + oF.dev.toFixed(4) + " | " + oF.sin.toFixed(4) + " | " + oF.all.toFixed(4) + " | %" + oF.t1.toFixed(1) + " | %" + oF.t3.toFixed(1) + " |");
P("| ACC çifti birleşik | 23 | " + oB.dev.toFixed(4) + " | " + oB.sin.toFixed(4) + " | " + oB.all.toFixed(4) + " | %" + oB.t1.toFixed(1) + " | %" + oB.t3.toFixed(1) + " |");
// Geriye doğru eleme — YALNIZ DEV katlarında karar
let cur = [...basla]; const ref = oF.dev; const yol: { adim: number; at: string; n: number; dev: number; sin: number; all: number; t1: number; t3: number }[] = [];
let adim = 0;
while (cur.length > 4) {
  let en: { c: number; dev: number } | null = null;
  for (const c of cur) { const dev = L(kosu(cur.filter((x) => x !== c), DEV)); if (!en || dev < en.dev) en = { c, dev }; }
  if (!en || en.dev > ref + TOL) break;
  cur = cur.filter((x) => x !== en!.c); adim++; const o = ozet(cur);
  yol.push({ adim, at: COLN[en.c]!, n: cur.length, dev: o.dev, sin: o.sin, all: o.all, t1: o.t1, t3: o.t3 });
  P("| adım " + adim + ": − " + COLN[en.c] + " | " + cur.length + " | " + o.dev.toFixed(4) + " | " + o.sin.toFixed(4) + " | " + o.all.toFixed(4) + " | %" + o.t1.toFixed(1) + " | %" + o.t3.toFixed(1) + " |");
}
P("\n## SEÇİLEN SADE KÜME (" + cur.length + " sinyal): " + cur.map((c) => COLN[c]).join(", "));
P("Atılanlar sırayla: " + yol.map((y) => y.at).join(" → "));
const oS = ozet(cur);
P("\nTAM(24) → SADE(" + cur.length + "): DEV " + oF.dev.toFixed(4) + " → " + oS.dev.toFixed(4) + " | SINAMA (seçime HİÇ girmedi) " + oF.sin.toFixed(4) + " → " + oS.sin.toFixed(4) + " | Top1 %" + oF.t1.toFixed(1) + " → %" + oS.t1.toFixed(1) + " | Top3 %" + oF.t3.toFixed(1) + " → %" + oS.t3.toFixed(1));
// paired fark GA (SINAMA) — sade − tam
const a = kosu(full24, SIN), b = kosu(cur, SIN); const dif = a.map((x, i) => b[i]!.ll - x.ll);
let seed = 7; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296; const bs: number[] = []; for (let t = 0; t < 2000; t++) { let q = 0; for (let i = 0; i < dif.length; i++) q += dif[Math.floor(rnd() * dif.length)]!; bs.push(q / dif.length); } bs.sort((p, q) => p - q);
P("SINAMA ΔLL (sade − tam; negatif = sade daha iyi): " + avg(dif).toFixed(4) + " [" + bs[49]!.toFixed(4) + "," + bs[1949]!.toFixed(4) + "]");
fs.writeFileSync(".sinyal-veri/golgeleme-sade-" + new Date().toISOString().slice(0, 10) + ".md", log.join("\n"));
