// KALICI ARAÇ — S2 YAPISI İLERİ (yalnız geçmiş→gelecek) KRONOLOJİK TEST, AS-OF matris üzerinde. SALT-OKUMA, DB'siz.
// Girdi: GOLGELEME_MATRIS (varsayılan .sinyal-veri/golgeleme-matris-tum-asof.json: AS_OF=1 ile üretilmiş, aylık kesimli referanslar, tarih-öncesi PIT önseli). Yalnız İLERİ yön: her dış katta eğitim = kat başlangıcından ÖNCEKİ tüm yarışlar.
// Kümeler (ortak, as-of yeniden üretilebilen sinyaller U): tam U, ACC birleşimi, tempo aynası atılması, S2 yapısı, accHizFormu varyantları. Rapor: log-loss, Top1, Top3, paired bootstrap ΔLL [GA] (U'ya göre), kat bazlı tutarlılık.
import fs from "node:fs";
type Cell = [number, number, number?] | null;
type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
type Mat = { ozellik: string[]; kesim: string[]; yarislar: Race[] };
const M = JSON.parse(fs.readFileSync(process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris-tum-asof.json", "utf8")) as Mat;
const CANLI = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v546-1-saf-weights.json", "utf8")) as { featureNames: string[]; means: number[]; stds: number[] };
const cm = (n: string) => ({ mu: CANLI.means[CANLI.featureNames.indexOf(n)]!, sd: CANLI.stds[CANLI.featureNames.indexOf(n)]! });
const mC = cm("ACC_CLOSE_RES"), mL = cm("ACC_LATE");
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
const U = ["ACC_CLOSE_RES", "ACC_LATE", "accHizFormu", "tempoOnOran", "tempoErkenHiz", "tempoOnBaski", "tempoGeriBaski", "jokeyPIT", "antrenorPIT", "lastWon", "hpRel", "kiloRel", "fMean", "sexE", "dususDelta"];
const AYNA = ["tempoOnBaski", "tempoGeriBaski"], ACC = ["ACC_CLOSE_RES", "ACC_LATE"];
const SETLER: { ad: string; adlar: string[] }[] = [
  // (kümeler aşağıda)
  { ad: "U15 (tam, ortak sinyaller)", adlar: U },
  { ad: "+ ACC birleşik (CLOSE+LATE→accBitis)", adlar: [...U.filter((n) => !ACC.includes(n)), "accBitis"] },
  { ad: "+ tempo aynası atıldı", adlar: U.filter((n) => !AYNA.includes(n)) },
  { ad: "S2 yapısı (ACC birleşik + ayna atıldı)", adlar: [...U.filter((n) => !ACC.includes(n) && !AYNA.includes(n)), "accBitis"] },
  { ad: "U15 − accHizFormu", adlar: U.filter((n) => n !== "accHizFormu") },
  { ad: "S2 yapısı − accHizFormu", adlar: [...U.filter((n) => !ACC.includes(n) && !AYNA.includes(n) && n !== "accHizFormu"), "accBitis"] },
  { ad: "U15 − ayna − tempoErkenHiz (accHizFormu KALIR)", adlar: U.filter((n) => !AYNA.includes(n) && n !== "tempoErkenHiz") },
  { ad: "ACC birleşik − ayna − tempoErkenHiz (accHizFormu KALIR)", adlar: [...U.filter((n) => !ACC.includes(n) && !AYNA.includes(n) && n !== "tempoErkenHiz"), "accBitis"] },
  { ad: "S2 yapısı − accHizFormu − tempoErkenHiz", adlar: [...U.filter((n) => !ACC.includes(n) && !AYNA.includes(n) && n !== "accHizFormu" && n !== "tempoErkenHiz"), "accBitis"] },
];
type H = { raw: number; rel: number } | null;
const hucre = (f: Cell[], n: string): H => {
  if (n === "accBitis") { const c = f[M.ozellik.indexOf("ACC_CLOSE_RES")], l = f[M.ozellik.indexOf("ACC_LATE")]; const a = c ? c[1] * (c[0] - mC.mu) / mC.sd : null, b = l ? l[1] * (l[0] - mL.mu) / mL.sd : null; const v = a != null && b != null ? (a + b) / 2 : (a ?? b); return v == null ? null : { raw: v, rel: 1 }; }
  const c = f[M.ozellik.indexOf(n)]; return c ? { raw: c[0], rel: c[1] } : null;
};
type Row = { w: number; x: Float64Array[]; id: string };
function kur(tr: Race[], te: Race[], adlar: string[]) {
  const d = adlar.length, mu = new Float64Array(d), sd = new Float64Array(d); const Htr = tr.map((r) => r.runners.map((x) => adlar.map((n) => hucre(x.f, n))));
  for (let i = 0; i < d; i++) { let s = 0, n = 0; for (const rr of Htr) for (const h of rr) { const c = h[i]; if (c) { s += c.raw; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const rr of Htr) for (const h of rr) { const c = h[i]; if (c) s2 += (c.raw - m) ** 2; } mu[i] = m; sd[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (r: Race): Row => ({ id: r.raceId, w: r.runners.findIndex((x) => x.k === 1), x: r.runners.map((x) => Float64Array.from(adlar, (n, i) => { const c = hucre(x.f, n); return c ? c.rel * (c.raw - mu[i]!) / sd[i]! : 0; })) });
  return { train: tr.map(mk), test: te.map(mk) };
}
function egit(rows: Row[], d: number): Float64Array {
  // Newton-Raphson (dışbükey): ortalama negatif log-olabilirlik + 0.01·||w||² (motorun ridge'i 0.02 ile aynı hedef), ≤25 adım.
  const w = new Float64Array(d);
  for (let it = 0; it < 25; it++) {
    const g = new Float64Array(d), H = new Float64Array(d * d);
    for (const q of rows) { const p = softmax(q.x.map((v) => { let t = 0; for (let i = 0; i < d; i++) t += v[i]! * w[i]!; return t; })); const m1 = new Float64Array(d);
      for (let i = 0; i < q.x.length; i++) for (let k = 0; k < d; k++) m1[k]! += p[i]! * q.x[i]![k]!;
      for (let k = 0; k < d; k++) g[k]! += m1[k]! - q.x[q.w]![k]!;
      for (let i = 0; i < q.x.length; i++) { const v = q.x[i]!, pi = p[i]!; for (let a2 = 0; a2 < d; a2++) { const va = v[a2]! * pi; for (let b2 = 0; b2 <= a2; b2++) H[a2 * d + b2]! += va * v[b2]!; } }
      for (let a2 = 0; a2 < d; a2++) for (let b2 = 0; b2 <= a2; b2++) H[a2 * d + b2]! -= m1[a2]! * m1[b2]!; }
    const N = rows.length; for (let a2 = 0; a2 < d; a2++) { g[a2] = g[a2]! / N + 0.02 * w[a2]!; for (let b2 = 0; b2 <= a2; b2++) { const v = H[a2 * d + b2]! / N + (a2 === b2 ? 0.02 : 0); H[a2 * d + b2] = v; H[b2 * d + a2] = v; } }
    const A = Array.from({ length: d }, (_, i) => [...Array.from({ length: d }, (_, j) => H[i * d + j]!), g[i]!]);
    for (let i = 0; i < d; i++) { let pv = i; for (let k = i + 1; k < d; k++) if (Math.abs(A[k]![i]!) > Math.abs(A[pv]![i]!)) pv = k; [A[i], A[pv]] = [A[pv]!, A[i]!]; const dv = A[i]![i]! || 1e-12; for (let j = i; j <= d; j++) A[i]![j]! /= dv; for (let k = 0; k < d; k++) if (k !== i) { const mm = A[k]![i]!; for (let j = i; j <= d; j++) A[k]![j]! -= mm * A[i]![j]!; } }
    let adim = 0; for (let i = 0; i < d; i++) { const st = A[i]![d]!; w[i]! -= st; adim = Math.max(adim, Math.abs(st)); } if (adim < 1e-7) break;
  }
  return w;
}
type RS = { ll: number; t1: number; t3: number; fold: number };
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const kesim = M.kesim;
const out: string[] = []; const P = (s = "") => { console.log(s); out.push(s); };
P("# S2 YAPISI — İLERİ KRONOLOJİK TEST (AS-OF matris) — " + new Date().toISOString().slice(0, 10));
P("Yarış " + races.length + " | 5 dış kat (genişleyen pencere; eğitim = kat öncesi TÜM yarışlar) | kesimler " + kesim.join(", ") + " | ortak sinyal sayısı " + U.length + ". ΔLL = küme − U15 (negatif = küme daha iyi).");
const sonuc = new Map<string, RS[]>(); for (const s of SETLER) sonuc.set(s.ad, []);
for (let k = 0; k < 5; k++) {
  const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!; const tr = races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit); console.log("dış kat " + k + ": eğitim " + tr.length + " test " + te.length);
  for (const s of SETLER) { const F = kur(tr, te, s.adlar); const w = egit(F.train, s.adlar.length); for (const r of F.test) { const p = softmax(r.x.map((v) => { let t = 0; for (let i = 0; i < s.adlar.length; i++) t += v[i]! * w[i]!; return t; })); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v); sonuc.get(s.ad)!.push({ ll: -Math.log(Math.max(p[r.w]!, 1e-15)), t1: sr[0]!.i === r.w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === r.w) ? 1 : 0, fold: k }); } }
}
let sd0 = 7; const rn = () => (sd0 = (sd0 * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (d: number[]) => { const bs: number[] = []; for (let t = 0; t < 2000; t++) { let q = 0; for (let i = 0; i < d.length; i++) q += d[Math.floor(rn() * d.length)]!; bs.push(q / d.length); } bs.sort((p, q) => p - q); return { m: avg(d), lo: bs[49]!, hi: bs[1949]! }; };
const taban = sonuc.get(SETLER[0]!.ad)!;
P("\n| Küme | sinyal | test LL | Top1 | Top3 | ΔLL vs U15 [%95 GA] | kat bazında ΔLL |"); P("|---|---|---|---|---|---|---|");
for (const s of SETLER) {
  const r = sonuc.get(s.ad)!; const c = ci(r.map((x, i) => x.ll - taban[i]!.ll));
  const kat = [0, 1, 2, 3, 4].map((k) => avg(r.filter((x) => x.fold === k).map((x) => x.ll)) - avg(taban.filter((x) => x.fold === k).map((x) => x.ll)));
  P("| " + s.ad + " | " + s.adlar.length + " | " + avg(r.map((x) => x.ll)).toFixed(4) + " | %" + (avg(r.map((x) => x.t1)) * 100).toFixed(1) + " | %" + (avg(r.map((x) => x.t3)) * 100).toFixed(1) + " | " + (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + ", " + c.hi.toFixed(4) + "]" + (s === SETLER[0] ? "" : c.hi < 0 ? " ✔ daha iyi" : c.lo > 0 ? " ✘ daha kötü" : " ≈ fark yok") + " | " + kat.map((v) => (v >= 0 ? "+" : "") + v.toFixed(4)).join(" ") + " |");
}
fs.writeFileSync(".sinyal-veri/s2-ileri-test.md", out.join("\n"));
