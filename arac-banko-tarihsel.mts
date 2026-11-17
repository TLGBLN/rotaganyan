// KALICI ARAÇ — BANKO POZİTİFLİK TARİHSEL TESTİ. SALT-OKUMA, DB'siz. Girdi: .sinyal-veri/golgeleme-matris.json + weights/banko-sinyal-yonleri.json (yalnız KARARLI yönlü sinyaller etkin) + v546-1-saf-weights.json (z için μ/σ).
// Soru: sıralama modelinin 1. tercihinin (favori) pozitif sinyal sayısı/gücü, AYNI kazanma olasılığında kazanmayı ayırt ediyor mu? (şartname bölüm 11 A/B)
// Ana olasılık = KRONOLOJİK DIŞARIDAN (out-of-fold; genişleyen pencere, 5 kat → 827 test yarışı) tam 24 sinyalli modelden. Pozitiflik ham değerlerden (yarış öncesi) türetilir; sıralama katsayısı KULLANILMAZ.
// Ölçüler (favori başına): RAW (ham pozitif sayısı), STRONG (güç ≥ 0,5), FAM (pozitif aile sayısı), DESTEK (aile başına en güçlü pozitifin ortalaması). Güç S = clip(z_yön/2,0,1) GEÇİCİ (t=0,u=2).
// A) olasılık dilimi içinde ölçü yüksek/düşük → kazanma farkı (lift) + bootstrap GA   B) lojistik: y ~ logit(p) + ölçü; katsayı GA ve blok-CV ΔLL   C) AYNI SAYIDA banko seçimi: p'ye göre top-N vs p + ölçü birleşik top-N isabeti
import fs from "node:fs";
type Cell = [number, number, number?] | null;
type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
const M = JSON.parse(fs.readFileSync(process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris.json", "utf8")) as { ozellik: string[]; kesim: string[]; yarislar: Race[] };
const CANLI = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v546-1-saf-weights.json", "utf8")) as { featureNames: string[]; means: number[]; stds: number[] };
const YON = (JSON.parse(fs.readFileSync("src/lib/methodology/weights/banko-sinyal-yonleri.json", "utf8")) as { yonler: Record<string, { yon: 1 | -1 | null }> }).yonler;
const AILE: Record<string, string> = { ACC_CLOSE_RES: "ACC", ACC_LATE: "ACC", accHizFormu: "ACC", hizDerecesi: "ACC", tempoOnOran: "TEMPO", tempoErkenHiz: "TEMPO", tempoOnBaski: "TEMPO", tempoGeriBaski: "TEMPO", jokeyPIT: "JOKEY", jokeyFormuGenel: "JOKEY", antrenorPIT: "ANTRENOR", galopKaliteV1: "GALOP", galopPedigri: "GALOP", fMean: "FORM", lastWon: "FORM", kgsLog: "FORM", hpRel: "HCAP", kiloRel: "HCAP", dususDelta: "HCAP", h2hNetSkor: "HCAP", zeminToleransi: "PIST", zeminMesafeDeneyim: "PIST", sireOrani: "PEDIGRI", sexE: "DIGER" };
const NAMES = M.ozellik, D = NAMES.length;
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1)); const kesim = M.kesim;
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
// ── OOF ana olasılık (tam 24) ──
function oof(): { id: string; p: number[]; w: number; r: Race }[] {
  const out: { id: string; p: number[]; w: number; r: Race }[] = [];
  for (let k = 0; k < 5; k++) { const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!; const tr = races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit);
    const mu = new Float64Array(D), sg = new Float64Array(D); for (let i = 0; i < D; i++) { let s = 0, n = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) { s += c[0]; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) s2 += (c[0] - m) ** 2; } mu[i] = m; sg[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
    const mk = (r: Race) => ({ w: r.runners.findIndex((x) => x.k === 1), x: r.runners.map((x) => Float64Array.from({ length: D }, (_, i) => { const c = x.f[i]; return c ? c[1] * (c[0] - mu[i]!) / sg[i]! : 0; })) });
    const X = tr.map(mk); const w = new Float64Array(D), vel = new Float64Array(D);
    for (let ep = 0; ep < 800; ep++) { const g = new Float64Array(D); for (const q of X) { const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < D; i++) s += v[i]! * w[i]!; return s; })); for (let i = 0; i < q.x.length; i++) { const c = p[i]! - (i === q.w ? 1 : 0); for (let kk = 0; kk < D; kk++) g[kk]! += c * q.x[i]![kk]!; } } for (let kk = 0; kk < D; kk++) { const gk = g[kk]! / X.length + 0.02 * w[kk]!; vel[kk] = 0.9 * vel[kk]! - 0.08 * gk; w[kk]! += vel[kk]!; } }
    for (const r of te) { const q = mk(r); out.push({ id: r.raceId, r, w: q.w, p: softmax(q.x.map((v) => { let t = 0; for (let i = 0; i < D; i++) t += v[i]! * w[i]!; return t; })) }); } }
  return out;
}
const O = oof();
// ── favori başına pozitiflik ölçüleri ──
type Fav = { p: number; y: number; raw: number; strong: number; fam: number; destek: number; tarih: string };
const favs: Fav[] = O.map((o) => { const fi = o.p.indexOf(Math.max(...o.p)); const x = o.r.runners[fi]!; let raw = 0, strong = 0; const aile: Record<string, number> = {};
  for (const n of NAMES) { const yon = YON[n]?.yon ?? null; if (yon == null) continue; const i = NAMES.indexOf(n), c = x.f[i]; if (!c) continue; const j = CANLI.featureNames.indexOf(n); const z = (c[0] - CANLI.means[j]!) / CANLI.stds[j]!; const zy = yon * z; if (zy <= 0) continue; const S = Math.min(1, zy / 2) * c[1]; raw++; if (S >= 0.5) strong++; const f = AILE[n] ?? "DIGER"; aile[f] = Math.max(aile[f] ?? 0, S); }
  return { p: o.p[fi]!, y: fi === o.w ? 1 : 0, raw, strong, fam: Object.keys(aile).length, destek: Object.keys(aile).length ? avg(Object.values(aile)) : 0, tarih: o.r.tarih }; });
const L: string[] = []; const P = (s = "") => { console.log(s); L.push(s); };
P("# BANKO POZİTİFLİK — TARİHSEL TEST — " + new Date().toISOString().slice(0, 10));
P("Favori sayısı (kronolojik dışarıdan, 5 dış kat): " + favs.length + " | favori kazanma oranı %" + (avg(favs.map((f) => f.y)) * 100).toFixed(1) + " | ort. favori p %" + (avg(favs.map((f) => f.p)) * 100).toFixed(1) + " | yönü kararlı sinyal sayısı: " + NAMES.filter((n) => YON[n]?.yon != null).length + "/" + D);
P("Ölçü ortalamaları: RAW " + avg(favs.map((f) => f.raw)).toFixed(1) + " | STRONG " + avg(favs.map((f) => f.strong)).toFixed(1) + " | FAM " + avg(favs.map((f) => f.fam)).toFixed(1) + " | DESTEK " + avg(favs.map((f) => f.destek)).toFixed(2));
let sd0 = 7; const rn = () => (sd0 = (sd0 * 1664525 + 1013904223) % 4294967296) / 4294967296;
const bootCI = (n: number, f: (idx: number[]) => number) => { const bs: number[] = []; for (let t = 0; t < 1000; t++) bs.push(f(Array.from({ length: n }, () => Math.floor(rn() * n)))); bs.sort((a, b) => a - b); return [bs[24]!, bs[974]!]; };
const OLC: { ad: string; f: (x: Fav) => number }[] = [{ ad: "RAW", f: (x) => x.raw }, { ad: "STRONG", f: (x) => x.strong }, { ad: "FAM", f: (x) => x.fam }, { ad: "DESTEK", f: (x) => x.destek }];
// A) olasılık dilimi içinde lift
P("\n## A) AYNI olasılık diliminde: ölçü yüksek yarı vs düşük yarı (dilim içi medyan bölme) — kazanma oranı farkı (yüksek − düşük), bootstrap %95 GA");
P("| Ölçü | dilim (p) | n | düşük grup kazanma | yüksek grup kazanma | fark [GA] |"); P("|---|---|---|---|---|---|");
const ps = favs.map((f) => f.p).sort((a, b) => a - b); const kes = [ps[Math.floor(ps.length / 3)]!, ps[Math.floor(2 * ps.length / 3)]!];
for (const o of OLC) { let top = 0, topW = 0; const dil = [[0, kes[0]!], [kes[0]!, kes[1]!], [kes[1]!, 2]] as [number, number][]; const farklar: { lo: number; hi: number }[] = [];
  dil.forEach(([a, b], di) => { const S = favs.filter((f) => f.p >= a && f.p < b); const med = [...S.map(o.f)].sort((x, y) => x - y)[Math.floor(S.length / 2)]!; const lo = S.filter((f) => o.f(f) <= med), hi = S.filter((f) => o.f(f) > med); if (!lo.length || !hi.length) return; const d = avg(hi.map((f) => f.y)) - avg(lo.map((f) => f.y)); const ci = bootCI(S.length, (idx) => { const sS = idx.map((i) => S[i]!); const m2 = [...sS.map(o.f)].sort((x, y) => x - y)[Math.floor(sS.length / 2)]!; const l2 = sS.filter((f) => o.f(f) <= m2), h2 = sS.filter((f) => o.f(f) > m2); return l2.length && h2.length ? avg(h2.map((f) => f.y)) - avg(l2.map((f) => f.y)) : 0; });
    P("| " + o.ad + " | " + ["düşük", "orta", "yüksek"][di] + " (" + (a * 100).toFixed(0) + "–" + (Math.min(b, 1) * 100).toFixed(0) + "%) | " + S.length + " | %" + (avg(lo.map((f) => f.y)) * 100).toFixed(1) + " (n=" + lo.length + ") | %" + (avg(hi.map((f) => f.y)) * 100).toFixed(1) + " (n=" + hi.length + ") | " + (d >= 0 ? "+" : "") + (d * 100).toFixed(1) + " puan [" + (ci[0]! * 100).toFixed(1) + ", " + (ci[1]! * 100).toFixed(1) + "] |"); farklar.push({ lo: 0, hi: d }); void top; void topW; }); }
// B) lojistik katsayı + blok-CV ΔLL
const sig = (x: number) => 1 / (1 + Math.exp(-x)); const logit = (p: number) => Math.log(Math.max(p, 1e-6) / Math.max(1 - p, 1e-6));
function lojistik(S: Fav[], f: ((x: Fav) => number) | null): number[] { const d = f ? 3 : 2; const w = new Array(d).fill(0); const sd = f ? Math.sqrt(avg(S.map((x) => (f(x) - avg(S.map(f))) ** 2))) || 1 : 1; const mu = f ? avg(S.map(f)) : 0; const X = S.map((x) => (f ? [1, logit(x.p), (f(x) - mu) / sd] : [1, logit(x.p)])); w[1] = 1;
  for (let it = 0; it < 4000; it++) { const g = new Array(d).fill(0); for (let i = 0; i < S.length; i++) { const e = sig(X[i]!.reduce((s, v, j) => s + v * w[j]!, 0)) - S[i]!.y; for (let j = 0; j < d; j++) g[j]! += e * X[i]![j]!; } for (let j = 0; j < d; j++) w[j]! -= 0.3 * (g[j]! / S.length + 0.001 * w[j]!); } return [...w, mu, sd]; }
const nll = (S: Fav[], w: number[], f: ((x: Fav) => number) | null) => avg(S.map((x) => { const z = w[0]! + w[1]! * logit(x.p) + (f ? w[2]! * (f(x) - w[3]!) / w[4]! : 0); const p = sig(z); return -(x.y ? Math.log(Math.max(p, 1e-9)) : Math.log(Math.max(1 - p, 1e-9))); }));
P("\n## B) Lojistik: kazandı ~ logit(p) + ölçü (standartlaştırılmış). Katsayı = ölçünün +1 σ'sının log-odds etkisi (bootstrap %95 GA). ΔLL = blok-CV (5 ardışık blok) ikili log-loss, p-yalnız modele göre (negatif = ölçü yardım ediyor)");
P("| Ölçü | katsayı [GA] | blok-CV ΔLL (ölçülü − p yalnız) |"); P("|---|---|---|");
const blok = (S: Fav[], k: number) => { const n = Math.floor(S.length / 5); return S.slice(k * n, k === 4 ? S.length : (k + 1) * n); };
const sirali = [...favs].sort((a, b) => a.tarih.localeCompare(b.tarih));
for (const o of OLC) { const w = lojistik(sirali, o.f); const ci = bootCI(sirali.length, (idx) => lojistik(idx.map((i) => sirali[i]!), o.f)[2]!); const d: number[] = []; for (let k = 0; k < 5; k++) { const te = blok(sirali, k), tr = sirali.filter((x) => !te.includes(x)); const w0 = lojistik(tr, null), w1 = lojistik(tr, o.f); const a = nll(te, [w0[0]!, w0[1]!, 0, 0, 1], null), b = nll(te, w1, o.f); d.push(b - a); }
  P("| " + o.ad + " | " + w[2]!.toFixed(3) + " [" + ci[0]!.toFixed(3) + ", " + ci[1]!.toFixed(3) + "]" + (ci[0]! > 0 ? " ✔ pozitif" : ci[1]! < 0 ? " ✘ ters" : " ≈ sıfır") + " | " + avg(d).toFixed(4) + " (blok ΔLL: " + d.map((v) => v.toFixed(3)).join(", ") + ") |"); }
// C) AYNI SAYIDA banko seçimi
P("\n## C) AYNI SAYIDA seçim: favoriler arasından N tanesini seç → isabet (kazanan oranı). Yöntemler: p'ye göre | p ve ölçü sırası ortalaması (eşit ağırlık, ağırlık ÖĞRENİLMEDİ)");
P("| N | p'ye göre | p+RAW | p+STRONG | p+FAM | p+DESTEK |"); P("|---|---|---|---|---|---|");
const rk = (vals: number[]) => { const o = vals.map((v, i) => ({ v, i })).sort((a, b) => b.v - a.v); const r = new Array<number>(vals.length); o.forEach((q, i) => (r[q.i] = i)); return r; }; const rp = rk(favs.map((f) => f.p));
for (const N of [50, 100, 150, 200, 300]) { const cell = (r2: number[] | null) => { const s = favs.map((f, i) => ({ i, k: r2 ? rp[i]! + r2[i]! : rp[i]! })).sort((a, b) => a.k - b.k).slice(0, N); const h = avg(s.map((q) => favs[q.i]!.y)); const se = Math.sqrt(h * (1 - h) / N); return "%" + (h * 100).toFixed(1) + " ±" + (se * 100).toFixed(1); };
  P("| " + N + " | " + cell(null) + " | " + cell(rk(favs.map((f) => f.raw))) + " | " + cell(rk(favs.map((f) => f.strong))) + " | " + cell(rk(favs.map((f) => f.fam))) + " | " + cell(rk(favs.map((f) => f.destek))) + " |"); }
P("\nOkuma notu: tek bir tabloda bir ölçü 'iyi' görünüyorsa ve diğerlerinde/blok-CV'de görünmüyorsa tesadüf olabilir (çoklu karşılaştırma). Karar kuralı: ölçü A'da dilimlerin çoğunda pozitif fark, B'de GA'sı pozitif katsayı VE blok-CV ΔLL<0, C'de p'ye göre belirgin üstün olmalı. Üçü birden sağlanmazsa banko kararına GİRMEZ.");
fs.writeFileSync(".sinyal-veri/banko-tarihsel-" + new Date().toISOString().slice(0, 10) + ".md", L.join("\n"));
