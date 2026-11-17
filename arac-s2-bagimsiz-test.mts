// KALICI ARAÇ — S2 BAĞIMSIZ (görülmemiş veri) TESTİ. SALT-OKUMA, DB'siz. Girdi: .sinyal-veri/golgeleme-matris.json (canlı eğitim popülasyonu, yeni) + golgeleme-matris-eski.json (eğitimde HİÇ kullanılmayan yarışlar).
// Soru: S2'nin yaptığı yapısal sadeleştirme (ACC_CLOSE+ACC_LATE birleşimi, tempoOnBaski/GeriBaski aynasının atılması) HİÇ görmediği yarışlarda aynı başarıyı koruyor mu?
// Eski yarışlarda yeniden üretilebilen ORTAK sinyaller (U): Accurace/Tempo v2, jokeyPIT, antrenorPIT, lastWon, hpRel, kiloRel, fMean, kgsLog, sexE, dususDelta. Diğerleri (h2h, hizDerecesi, zemin*, sireOrani, galop*, jokeyFormuGenel) eski yarışlarda yok → İKİ TARAFTA DA kullanılmaz.
// İki yön: (1) yeni→eski eğit/test  (2) eski→yeni eğit/test. Kural önceden: |ΔLL| için paired bootstrap %95 GA; "aynı başarı" = GA, −0,003..+0,003'ü kapsıyor/içeriyor ve Top1/Top3 farkı küçük. Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-s2-bagimsiz-test.mts
import fs from "node:fs";
type Cell = [number, number, number?] | null;
type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
type Mat = { ozellik: string[]; yarislar: Race[] };
const rd = (p: string) => JSON.parse(fs.readFileSync(p, "utf8")) as Mat;
const YENI = rd(".sinyal-veri/golgeleme-matris.json"), ESKI = rd(".sinyal-veri/golgeleme-matris-eski.json");
const CANLI = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v546-1-saf-weights.json", "utf8")) as { featureNames: string[]; means: number[]; stds: number[] };
const cm = (n: string) => ({ mu: CANLI.means[CANLI.featureNames.indexOf(n)]!, sd: CANLI.stds[CANLI.featureNames.indexOf(n)]! }); const mC = cm("ACC_CLOSE_RES"), mL = cm("ACC_LATE");
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);
const U = ["ACC_CLOSE_RES", "ACC_LATE", "accHizFormu", "tempoOnOran", "tempoErkenHiz", "tempoOnBaski", "tempoGeriBaski", "jokeyPIT", "antrenorPIT", "lastWon", "hpRel", "kiloRel", "fMean", "sexE", "dususDelta"];
const SETLER: { ad: string; adlar: string[] }[] = [
  { ad: "U16 (tam, ortak sinyaller)", adlar: U },
  { ad: "+ ACC birleşik (CLOSE+LATE→accBitis)", adlar: [...U.filter((n) => n !== "ACC_CLOSE_RES" && n !== "ACC_LATE"), "accBitis"] },
  { ad: "+ tempo aynası atıldı", adlar: U.filter((n) => n !== "tempoOnBaski" && n !== "tempoGeriBaski") },
  { ad: "S2 yapısı (ikisi birden) U13", adlar: [...U.filter((n) => !["ACC_CLOSE_RES", "ACC_LATE", "tempoOnBaski", "tempoGeriBaski"].includes(n)), "accBitis"] },
  { ad: "U16 − accHizFormu", adlar: U.filter((n) => n !== "accHizFormu") },
  { ad: "S2 yapısı − accHizFormu", adlar: [...U.filter((n) => !["ACC_CLOSE_RES", "ACC_LATE", "tempoOnBaski", "tempoGeriBaski", "accHizFormu"].includes(n)), "accBitis"] },
];
type Hucre = { raw: number; rel: number } | null;
const hucre = (M: Mat, f: Cell[], n: string): Hucre => { if (n === "accBitis") { const c = f[M.ozellik.indexOf("ACC_CLOSE_RES")], l = f[M.ozellik.indexOf("ACC_LATE")]; const a = c ? c[1] * (c[0] - mC.mu) / mC.sd : null, b = l ? l[1] * (l[0] - mL.mu) / mL.sd : null; const v = a != null && b != null ? (a + b) / 2 : (a ?? b); return v == null ? null : { raw: v, rel: 1 }; } const c = f[M.ozellik.indexOf(n)]; return c ? { raw: c[0], rel: c[1] } : null; };
type Row = { w: number; x: Float64Array[]; id: string; tarih: string };
function kur(Mtr: Mat, tr: Race[], Mte: Mat, te: Race[], adlar: string[]) {
  const d = adlar.length, mu = new Float64Array(d), sd = new Float64Array(d); const H = tr.map((r) => r.runners.map((x) => adlar.map((n) => hucre(Mtr, x.f, n))));
  for (let i = 0; i < d; i++) { let s = 0, n = 0; for (const rr of H) for (const h of rr) { const c = h[i]; if (c) { s += c.raw; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const rr of H) for (const h of rr) { const c = h[i]; if (c) s2 += (c.raw - m) ** 2; } mu[i] = m; sd[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (Mx: Mat) => (r: Race): Row => ({ id: r.raceId, tarih: r.tarih, w: r.runners.findIndex((x) => x.k === 1), x: r.runners.map((x) => Float64Array.from(adlar, (n, i) => { const c = hucre(Mx, x.f, n); return c ? c.rel * (c.raw - mu[i]!) / sd[i]! : 0; })) });
  return { train: tr.map(mk(Mtr)), test: te.map(mk(Mte)) };
}
function egit(rows: Row[], d: number): Float64Array {
  const w = new Float64Array(d), vel = new Float64Array(d);
  for (let ep = 0; ep < 800; ep++) { const g = new Float64Array(d); for (const q of rows) { const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i]! * w[i]!; return s; })); for (let i = 0; i < q.x.length; i++) { const c = p[i]! - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k]! += c * q.x[i]![k]!; } } for (let k = 0; k < d; k++) { const gk = g[k]! / rows.length + 0.02 * w[k]!; vel[k] = 0.9 * vel[k]! - 0.08 * gk; w[k]! += vel[k]!; } }
  return w;
}
type RS = { ll: number; t1: number; t3: number; id: string; tarih: string };
function degerlendir(Mtr: Mat, tr: Race[], Mte: Mat, te: Race[], adlar: string[]): RS[] {
  const F = kur(Mtr, tr, Mte, te, adlar); const w = egit(F.train, adlar.length);
  return F.test.map((r) => { const p = softmax(r.x.map((v) => { let t = 0; for (let i = 0; i < adlar.length; i++) t += v[i]! * w[i]!; return t; })); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v); return { id: r.id, tarih: r.tarih, ll: -Math.log(Math.max(p[r.w]!, 1e-15)), t1: sr[0]!.i === r.w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === r.w) ? 1 : 0 }; });
}
const ok = (R: Race[]) => R.filter((r) => r.runners.some((x) => x.k === 1));
let sd0 = 7; const rn = () => (sd0 = (sd0 * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ci = (dif: number[]) => { const bs: number[] = []; for (let t = 0; t < 2000; t++) { let q = 0; for (let i = 0; i < dif.length; i++) q += dif[Math.floor(rn() * dif.length)]!; bs.push(q / dif.length); } bs.sort((p, q) => p - q); return { m: avg(dif), lo: bs[49]!, hi: bs[1949]! }; };
const log: string[] = []; const P = (s = "") => { console.log(s); log.push(s); };
P("# S2 BAĞIMSIZ (görülmemiş veri) TESTİ — " + new Date().toISOString().slice(0, 10));
P("Yeni (canlı eğitim popülasyonu): " + ok(YENI.yarislar).length + " yarış | Eski/ek (eğitimde yok): " + ok(ESKI.yarislar).length + " yarış. Ortak sinyal sayısı U=" + U.length + ". ΔLL = küme − U16 (negatif = küme daha iyi).");
for (const [ad, Mtr, Mte] of [["(1) YENİ → ESKİ (yeni 1392'de eğit, eski yarışlarda test)", YENI, ESKI], ["(2) ESKİ → YENİ (eski yarışlarda eğit, yeni yarışlarda test)", ESKI, YENI]] as [string, Mat, Mat][]) {
  const tr = ok(Mtr.yarislar), te = ok(Mte.yarislar); P("\n## " + ad + " — eğitim " + tr.length + ", test " + te.length);
  P("| Küme | sinyal | test LL | Top1 | Top3 | ΔLL vs U16 [%95 GA] |"); P("|---|---|---|---|---|---|");
  let taban: RS[] | null = null;
  for (const s of SETLER) { const r = degerlendir(Mtr, tr, Mte, te, s.adlar); if (!taban) taban = r; const c = ci(r.map((x, i) => x.ll - taban![i]!.ll)); P("| " + s.ad + " | " + s.adlar.length + " | " + avg(r.map((x) => x.ll)).toFixed(4) + " | %" + (avg(r.map((x) => x.t1)) * 100).toFixed(1) + " | %" + (avg(r.map((x) => x.t3)) * 100).toFixed(1) + " | " + (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + ", " + c.hi.toFixed(4) + "]" + (s === SETLER[0] ? "" : c.hi < 0 ? " ✔ daha iyi" : c.lo > 0 ? " ✘ daha kötü" : " ≈ fark yok") + " |"); }
}
fs.writeFileSync(".sinyal-veri/s2-bagimsiz-test.md", log.join("\n"));
