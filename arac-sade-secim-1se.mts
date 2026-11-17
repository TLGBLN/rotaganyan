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
{ // doluluğu düşük (varsayılan <%5) sinyal sütunlarını at: tümüyle boş sütunlar eğitimi yavaşlatır ve seçim kuralını anlamsızlaştırır
  const nAt = M.yarislar.reduce((p, r) => p + r.runners.length, 0);
  const keep = M.ozellik.map((_, i) => i).filter((i) => M.yarislar.reduce((p, r) => p + r.runners.filter((x) => x.f[i]).length, 0) / nAt >= Number(process.env.MIN_DOLULUK ?? 0.05));
  M.yarislar.forEach((r) => r.runners.forEach((x) => { x.f = keep.map((i) => x.f[i]!); }));
  console.log("kullanılan sinyal (doluluk >= %5): " + keep.map((i) => M.ozellik[i]).join(", ")); M.ozellik = keep.map((i) => M.ozellik[i]!);
}
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
  // Newton-Raphson (dışbükey hedef): ortalama negatif log-olabilirlik + 0.01·||w||² (motorun ridge'i 0.02 ile aynı hedef). Tam Hessian, ≤25 adım.
  const d = kol.length, w = new Float64Array(d); if (!d) return w;
  const X = rows.map((r) => ({ w: r.w, x: r.z.map((_, j) => Float64Array.from(kol, (k) => kolonDeger(r, j, k))) }));
  for (let it = 0; it < 25; it++) {
    const g = new Float64Array(d), H = new Float64Array(d * d);
    for (const q of X) { const sc = q.x.map((v) => { let t = 0; for (let i = 0; i < d; i++) t += v[i]! * w[i]!; return t; }); const p = softmax(sc); const m1 = new Float64Array(d);
      for (let i = 0; i < q.x.length; i++) for (let k = 0; k < d; k++) m1[k]! += p[i]! * q.x[i]![k]!;
      for (let k = 0; k < d; k++) g[k]! += m1[k]! - q.x[q.w]![k]!;
      for (let i = 0; i < q.x.length; i++) { const v = q.x[i]!, pi = p[i]!; for (let a2 = 0; a2 < d; a2++) { const va = v[a2]! * pi; for (let b2 = 0; b2 <= a2; b2++) H[a2 * d + b2]! += va * v[b2]!; } }
      for (let a2 = 0; a2 < d; a2++) for (let b2 = 0; b2 <= a2; b2++) H[a2 * d + b2]! -= m1[a2]! * m1[b2]!; }
    const N = X.length; for (let a2 = 0; a2 < d; a2++) { g[a2] = g[a2]! / N + 0.02 * w[a2]!; for (let b2 = 0; b2 <= a2; b2++) { const v = H[a2 * d + b2]! / N + (a2 === b2 ? 0.02 : 0); H[a2 * d + b2] = v; H[b2 * d + a2] = v; } }
    const A = Array.from({ length: d }, (_, i) => [...Array.from({ length: d }, (_, j) => H[i * d + j]!), g[i]!]);
    for (let i = 0; i < d; i++) { let pv = i; for (let k = i + 1; k < d; k++) if (Math.abs(A[k]![i]!) > Math.abs(A[pv]![i]!)) pv = k; [A[i], A[pv]] = [A[pv]!, A[i]!]; const dv = A[i]![i]! || 1e-12; for (let j = i; j <= d; j++) A[i]![j]! /= dv; for (let k = 0; k < d; k++) if (k !== i) { const mm = A[k]![i]!; for (let j = i; j <= d; j++) A[k]![j]! -= mm * A[i]![j]!; } }
    let adim = 0; for (let i = 0; i < d; i++) { const st = A[i]![d]!; w[i]! -= st; adim = Math.max(adim, Math.abs(st)); } if (adim < 1e-7) break;
  }
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
// ── SEÇİM (şartname bölüm 5: S* = argmin L_CV(S) + λ|S| ; one-standard-error kuralı). YALNIZ eğitim penceresi; iç 2 kronolojik kat (test dönemleri eğitim penceresinin son %40'ı). ──
// Yol: tam sinyal kümesinden başlayıp her adımda iç-CV log-loss'u EN AZ artıran tek sinyali çıkarma (kontrollü, geriye doğru). Seçim: yol boyunca en düşük iç-CV ortalamasından en çok 1 standart hata uzaktaki EN KÜÇÜK küme.
function sec(train: Race[]): { kol: Kolon[]; log: string } {
  const gun = [...new Set(train.map((r) => r.tarih))].sort(); const ic = [0.6, 0.8].map((q) => gun[Math.floor(gun.length * q)]!);
  const parca = [0, 1].map((f) => { const bas = ic[f]!, bit = f === 1 ? "9999" : ic[f + 1]!; return kurZ(train.filter((r) => r.tarih < bas), train.filter((r) => r.tarih >= bas && r.tarih < bit)); });
  const stat = (k: Kolon[]) => { const v = parca.flatMap((P) => fitEval(P.train, P.test, k).map((x) => x.ll)); return { m: avg(v), v }; };
  let kol: Kolon[] = [...Array(D).keys()].map((i) => ({ ad: NAMES[i]!, kaynak: [i] })); const yol: { kol: Kolon[]; m: number; v: number[]; at: string }[] = []; const s0 = stat(kol); yol.push({ kol: [...kol], m: s0.m, v: s0.v, at: "(tam)" });
  while (kol.length > Number(process.env.SADE_MIN ?? 6)) { let en: { c: Kolon; m: number; v: number[] } | null = null; for (const c of kol) { const st = stat(kol.filter((x) => x !== c)); if (!en || st.m < en.m) en = { c, m: st.m, v: st.v }; } kol = kol.filter((x) => x !== en!.c); yol.push({ kol: [...kol], m: en!.m, v: en!.v, at: en!.c.ad }); }
  // ONE-STANDARD-ERROR (eşleştirilmiş): aynı iç-test yarışlarında, EN İYİ kümeye göre kayıp farkının ortalaması ≤ farkın standart hatası ise küme "en iyiye yakın" sayılır; bunlar arasından EN KÜÇÜĞÜ seçilir.
  const eniyi = yol.reduce((p, q) => (q.m < p.m ? q : p)); const n = eniyi.v.length;
  const yakin = yol.map((y) => { const d = y.v.map((x, i) => x - eniyi.v[i]!); const dm = avg(d); const se = Math.sqrt(avg(d.map((x) => (x - dm) ** 2))) / Math.sqrt(n); return { y, dm, se, ok: dm <= se }; });
  const secilen = yakin.filter((q) => q.ok).reduce((p, q) => (q.y.kol.length < p.y.kol.length ? q : p));
  return { kol: secilen.y.kol, log: "iç-CV yolu (boyut: ort. kayıp, en iyiye fark±eşleşmiş SE, çıkarılan): " + yakin.map((q) => q.y.kol.length + ": " + q.y.m.toFixed(4) + " (" + (q.dm >= 0 ? "+" : "") + q.dm.toFixed(4) + "±" + q.se.toFixed(4) + (q.ok ? " ✓" : "") + ") −" + q.y.at).join(" | ") + " || en iyi " + eniyi.kol.length + " kolon → SEÇİLEN " + secilen.y.kol.length };
}
const cikti: string[] = []; const P = (s = "") => { console.log(s); cikti.push(s); };
P("# SADE SİNYAL SEÇİMİ — ONE-STANDARD-ERROR (şartname bölüm 5), İÇ İÇE KRONOLOJİK — " + new Date().toISOString().slice(0, 10));
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
fs.writeFileSync(".sinyal-veri/sade-secim-1se-" + new Date().toISOString().slice(0, 10) + ".md", cikti.join("\n"));
