// KALICI ARAÇ — TARİHSEL YARIŞ SİMÜLASYON MOTORU (iç içe kronolojik doğrulama). SALT-OKUMA, DB'siz. Girdi: .sinyal-veri/golgeleme-matris.json (veya GOLGELEME_MATRIS).
// Amaç: "yeni yarış biriksin" beklemeden, kayıtlı yarışlarda bir SİNYAL SEÇİM KURALINI dürüstçe sınamak. Her DIŞ katta (genişleyen pencere):
//   1) SEÇİM yalnız EĞİTİM penceresinin içinde yapılır (iç kronolojik 3 kat; dış test dönemine HİÇ bakılmaz),
//   2) seçilen küme ile TAM 24 küme eğitim penceresinde eğitilir, DIŞ test döneminde karşılaştırılır.
// Seçim kuralı (ÖNCEDEN SABİT; her dış katta AYNEN uygulanır):
//   a) yarış-içi Spearman ρ ≥ 0,80 olan pozitif çiftler tek sinyale BİRLEŞTİRİLİR (z ortalaması);  b) |ρ| ≥ 0,98 ayna → ikincisi atılır;
//   c) iç CV'de çıkarılınca kayıp Δek ≤ 0,0005 olan sinyal, (tek başına katkısı Δtek ≤ 0,002) VEYA (kalan başka bir sinyalle |ρ| ≥ 0,5) ise ATILIR (tek geçiş).
// Rapor: Top1, Top3, log-loss (paired bootstrap GA), kalibrasyon (Brier + ECE), kurtarılan / yeni kaçırılan kazananlar, seçilen sinyal sayısı. Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-tarihsel-simulasyon.mts
import fs from "node:fs";
type Cell = [number, number, number?] | null;
type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
const M = JSON.parse(fs.readFileSync(process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris.json", "utf8")) as { ozellik: string[]; kesim: string[]; yarislar: Race[] };
const NAMES = M.ozellik, D = NAMES.length;
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const kesim = M.kesim; const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);

// ── z-uzayı: eğitim penceresinde μ/σ; eksik = 0 (+ eksik bayrağı) ──
type Row = { id: string; w: number; z: Float64Array[]; ok: Uint8Array[] };
function kurZ(train: Race[], test: Race[]) {
  const mu = new Float64Array(D), sg = new Float64Array(D);
  for (let i = 0; i < D; i++) { let s = 0, n = 0; for (const r of train) for (const x of r.runners) { const c = x.f[i]; if (c) { s += c[0]; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const r of train) for (const x of r.runners) { const c = x.f[i]; if (c) s2 += (c[0] - m) ** 2; } mu[i] = m; sg[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (r: Race): Row => ({ id: r.raceId, w: r.runners.findIndex((x) => x.k === 1), z: r.runners.map((x) => Float64Array.from({ length: D }, (_, i) => { const c = x.f[i]; return c ? c[1] * (c[0] - mu[i]!) / sg[i]! : 0; })), ok: r.runners.map((x) => Uint8Array.from({ length: D }, (_, i) => (x.f[i] ? 1 : 0))) });
  return { train: train.map(mk), test: test.map(mk) };
}
// ── kolon tanımı: tek sinyal veya birleşik (z ortalaması) ──
type Kolon = { ad: string; kaynak: number[] };
const kolonDeger = (r: Row, j: number, k: Kolon) => { if (k.kaynak.length === 1) return r.z[j]![k.kaynak[0]!]!; let s = 0, n = 0; for (const i of k.kaynak) if (r.ok[j]![i]) { s += r.z[j]![i]!; n++; } return n ? s / n : 0; };
function egit(rows: Row[], kol: Kolon[]): Float64Array {
  const d = kol.length, w = new Float64Array(d), vel = new Float64Array(d); if (!d) return w;
  const X = rows.map((r) => ({ w: r.w, x: r.z.map((_, j) => Float64Array.from(kol, (k) => kolonDeger(r, j, k))) }));
  for (let ep = 0; ep < 800; ep++) { const g = new Float64Array(d); for (const q of X) { const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i]! * w[i]!; return s; })); for (let i = 0; i < q.x.length; i++) { const c = p[i]! - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k]! += c * q.x[i]![k]!; } } for (let k = 0; k < d; k++) { const gk = g[k]! / X.length + 0.02 * w[k]!; vel[k] = 0.9 * vel[k]! - 0.08 * gk; w[k]! += vel[k]!; } }
  return w;
}
type Cikti = { id: string; ll: number; t1: number; t3: number; sira: number; p: number[]; w: number };
function tahmin(rows: Row[], kol: Kolon[], w: Float64Array): Cikti[] { return rows.map((r) => { const p = softmax(r.z.map((_, j) => { let t = 0; kol.forEach((k, i) => (t += kolonDeger(r, j, k) * w[i]!)); return t; })); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v); return { id: r.id, w: r.w, p, ll: -Math.log(Math.max(p[r.w]!, 1e-15)), t1: sr[0]!.i === r.w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === r.w) ? 1 : 0, sira: 1 + sr.findIndex((q) => q.i === r.w) }; }); }
const fitEval = (tr: Row[], te: Row[], kol: Kolon[]) => tahmin(te, kol, egit(tr, kol));

// ── Spearman (yarış-içi sapma üzerinden) ──
const rankOf = (a: number[]) => { const o = a.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v); const r = new Array<number>(a.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1]!.v === o[i]!.v) j++; const t = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k]!.i] = t; i = j + 1; } return r; };
const pear = (a: number[], b: number[]) => { const ma = avg(a), mb = avg(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i]! - ma) * (b[i]! - mb); saa += (a[i]! - ma) ** 2; sbb += (b[i]! - mb) ** 2; } return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0; };
function icRho(train: Race[]): number[][] {
  const R = Array.from({ length: D }, () => new Array<number>(D).fill(0)); const flat = train.flatMap((r) => { const mean = new Float64Array(D), cnt = new Float64Array(D); for (const x of r.runners) for (let i = 0; i < D; i++) if (x.f[i]) { mean[i]! += x.f[i]![0]; cnt[i]!++; } return r.runners.map((x) => x.f.map((c, i) => (c && cnt[i]! >= 2 ? c[0] - mean[i]! / cnt[i]! : null))); });
  for (let i = 0; i < D; i++) for (let j = i + 1; j < D; j++) { const a: number[] = [], b: number[] = []; for (const q of flat) { const x = q[i], y = q[j]; if (x != null && y != null) { a.push(x); b.push(y); } } const r = a.length > 100 ? pear(rankOf(a), rankOf(b)) : 0; R[i]![j] = r; R[j]![i] = r; }
  return R;
}
// ── SEÇİM (yalnız eğitim penceresi; iç 3 kat kronolojik) ──
function sec(train: Race[]): { kol: Kolon[]; log: string } {
  const R = icRho(train); const gun = [...new Set(train.map((r) => r.tarih))].sort(); const ic = [0.5, 0.67, 0.84].map((q) => gun[Math.floor(gun.length * q)]!);
  const durum = new Set([...Array(D).keys()]); const log: string[] = [];
  let kol: Kolon[] = [...Array(D).keys()].map((i) => ({ ad: NAMES[i]!, kaynak: [i] }));
  // a) ayna (|ρ|≥0.98) önce, sonra birleştir (ρ≥0.80)
  for (let i = 0; i < D; i++) for (let j = i + 1; j < D; j++) if (durum.has(i) && durum.has(j) && Math.abs(R[i]![j]!) >= 0.98) { durum.delete(j); log.push("ayna:" + NAMES[j]); }
  const cift: [number, number][] = []; for (let i = 0; i < D; i++) for (let j = i + 1; j < D; j++) if (durum.has(i) && durum.has(j) && R[i]![j]! >= 0.8) cift.push([i, j]);
  kol = kol.filter((k) => durum.has(k.kaynak[0]!)); const used = new Set<number>();
  for (const [i, j] of cift.sort((a, b) => R[b[0]]![b[1]]! - R[a[0]]![a[1]]!)) { if (used.has(i) || used.has(j)) continue; used.add(i); used.add(j); kol = kol.filter((k) => !(k.kaynak.length === 1 && (k.kaynak[0] === i || k.kaynak[0] === j))); kol.push({ ad: NAMES[i] + "+" + NAMES[j], kaynak: [i, j] }); log.push("birleştir:" + NAMES[i] + "+" + NAMES[j]); }
  // iç CV: Δek ve Δtek (3 iç kat; iç eğitim = iç test öncesi)
  const parca = [0, 1, 2].map((f) => { const bas = ic[f]!, bit = f === 2 ? "9999" : ic[f + 1]!; const tr = train.filter((r) => r.tarih < bas), te = train.filter((r) => r.tarih >= bas && r.tarih < bit); return kurZ(tr, te); });
  const llOf = (k: Kolon[]) => avg(parca.flatMap((P) => fitEval(P.train, P.test, k).map((x) => x.ll)));
  const llTam = llOf(kol); const llSifir = avg(parca.flatMap((P) => P.test.map((r) => Math.log(r.z.length))));
  const dEk: number[] = [], dTek: number[] = [];
  for (const k of kol) { dEk.push(llOf(kol.filter((x) => x !== k)) - llTam); dTek.push(llSifir - llOf([k])); }
  const at = new Set<number>();
  kol.forEach((k, a) => { if (dEk[a]! > 0.0005) return; const digerleri = kol.filter((x, b) => b !== a && !at.has(b)); const rmax = Math.max(0, ...k.kaynak.flatMap((i) => digerleri.flatMap((o) => o.kaynak.map((j) => Math.abs(R[i]![j]!))))); if (dTek[a]! <= 0.002 || rmax >= 0.5) { at.add(a); log.push("at:" + k.ad + "(Δek " + dEk[a]!.toFixed(4) + ", Δtek " + dTek[a]!.toFixed(4) + ", ρmax " + rmax.toFixed(2) + ")"); } });
  return { kol: kol.filter((_, a) => !at.has(a)), log: log.join("; ") };
}
const cikti: string[] = []; const P = (s = "") => { console.log(s); cikti.push(s); };
P("# TARİHSEL SİMÜLASYON — İÇ İÇE KRONOLOJİK DOĞRULAMA — " + new Date().toISOString().slice(0, 10));
P("Yarış " + races.length + " | 5 dış kat (genişleyen pencere) | seçim her dış katın YALNIZ eğitim penceresinde (iç 3 kat). Tam model = canlı 24 sinyal (aynı pencerede eğitilmiş).");
const tum24: Kolon[] = [...Array(D).keys()].map((i) => ({ ad: NAMES[i]!, kaynak: [i] }));
const A: Cikti[] = [], B: Cikti[] = []; const fold: number[] = []; const boyut: number[] = [];
for (let k = 0; k < 5; k++) {
  const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!; const tr = races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit);
  const S = sec(tr); const Z = kurZ(tr, te); const a = fitEval(Z.train, Z.test, tum24), b = fitEval(Z.train, Z.test, S.kol);
  a.forEach((x) => { A.push(x); fold.push(k); }); b.forEach((x) => B.push(x)); boyut.push(S.kol.length);
  P("\nDış kat " + k + ": eğitim " + tr.length + " | test " + te.length + " | SEÇİLEN " + S.kol.length + " kolon: " + S.kol.map((x) => x.ad).join(", ")); P("   kurallar: " + S.log);
}
const sd0 = { v: 7 }; const rn = () => (sd0.v = (sd0.v * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (dif: number[]) => { const bs: number[] = []; for (let t = 0; t < 2000; t++) { let q = 0; for (let i = 0; i < dif.length; i++) q += dif[Math.floor(rn() * dif.length)]!; bs.push(q / dif.length); } bs.sort((p, q) => p - q); return { m: avg(dif), lo: bs[49]!, hi: bs[1949]! }; };
const kal = (C: Cikti[]) => { const ps: number[] = [], ys: number[] = []; for (const c of C) c.p.forEach((p, i) => { ps.push(p); ys.push(i === c.w ? 1 : 0); }); const brier = avg(ps.map((p, i) => (p - ys[i]!) ** 2)); let ece = 0; for (let b = 0; b < 10; b++) { const idx = ps.map((p, i) => i).filter((i) => ps[i]! >= b / 10 && (b === 9 ? ps[i]! <= 1 : ps[i]! < (b + 1) / 10)); if (idx.length) ece += idx.length / ps.length * Math.abs(avg(idx.map((i) => ps[i]!)) - avg(idx.map((i) => ys[i]!))); } return { brier, ece }; };
const tabloSatir = (ad: string, C: Cikti[]) => { const k = kal(C); return "| " + ad + " | " + avg(C.map((x) => x.ll)).toFixed(4) + " | %" + (avg(C.map((x) => x.t1)) * 100).toFixed(1) + " | %" + (avg(C.map((x) => x.t3)) * 100).toFixed(1) + " | " + k.brier.toFixed(5) + " | " + k.ece.toFixed(4) + " |"; };
P("\n## Sonuç (5 dış kat birleşik, " + A.length + " test yarışı)"); P("| Model | log-loss | Top1 | Top3 | Brier | ECE |"); P("|---|---|---|---|---|---|");
P(tabloSatir("TAM (24)", A)); P(tabloSatir("SEÇİLEN (iç içe, ort. " + avg(boyut).toFixed(1) + " kolon)", B));
const fk = (f: (i: number) => boolean) => { const idx = A.map((_, i) => i).filter(f); const c = ci(idx.map((i) => B[i]!.ll - A[i]!.ll)); return (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + ", " + c.hi.toFixed(4) + "]" + (c.hi < 0 ? " ✔ seçilen daha iyi" : c.lo > 0 ? " ✘ seçilen daha kötü" : " ≈ fark yok"); };
P("\nΔLL (seçilen − tam; negatif = seçilen daha iyi): 5 kat birleşik " + fk(() => true) + " | son iki dış kat " + fk((i) => fold[i]! >= 3) + " | ilk üç dış kat " + fk((i) => fold[i]! <= 2));
P("Kurtarılan kazanan (seçilen Top3, tam değil): " + A.filter((_, i) => B[i]!.t3 === 1 && A[i]!.t3 === 0).length + " | Yeni kaçırılan (tam Top3, seçilen değil): " + A.filter((_, i) => B[i]!.t3 === 0 && A[i]!.t3 === 1).length + " | Top1 kurtarılan " + A.filter((_, i) => B[i]!.t1 === 1 && A[i]!.t1 === 0).length + " / yeni kaçırılan " + A.filter((_, i) => B[i]!.t1 === 0 && A[i]!.t1 === 1).length);
fs.writeFileSync(".sinyal-veri/tarihsel-simulasyon-" + new Date().toISOString().slice(0, 10) + ".md", cikti.join("\n"));
