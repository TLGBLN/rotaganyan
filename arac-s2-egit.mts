// KALICI ARAÇ — S2 SADE MODEL (17 sinyal) EĞİTİMİ + BANKO SİNYAL YÖNLERİ. SALT-OKUMA girdi (.sinyal-veri/golgeleme-matris.json), DB'siz.
// Canlı ağırlık dosyalarına DOKUNMAZ: yeni dosya yazar → src/lib/methodology/weights/v546-1-saf-weights-s2-golge.json (GÖLGE; canlı motor yüklemez)
//   ve src/lib/methodology/weights/banko-sinyal-yonleri.json (banko pozitiflik yönleri).
// S2 = tam 24'ten: ACC_CLOSE_RES+ACC_LATE → accBitis (tek sinyal); atılan: tempoOnBaski, tempoGeriBaski, zeminToleransi, zeminMesafeDeneyim, jokeyFormuGenel, hizDerecesi.
// accBitis ham değeri = (rel_C·z_C + rel_L·z_L)/2 ; z'ler CANLI ağırlık dosyasındaki μ/σ ile; yalnız biri varsa o; güvenirlik = 1. Motor tarafında aynı formül (s2-golge.ts).
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-s2-egit.mts [--yaz]
import fs from "node:fs";
type Cell = [number, number, number?] | null;
type Race = { raceId: string; tarih: string; runners: { no: number; k: number; f: Cell[] }[] };
const M = JSON.parse(fs.readFileSync(".sinyal-veri/golgeleme-matris.json", "utf8")) as { ozellik: string[]; kesim: string[]; yarislar: Race[] };
const CANLI = JSON.parse(fs.readFileSync("src/lib/methodology/weights/v546-1-saf-weights.json", "utf8")) as { featureNames: string[]; means: number[]; stds: number[]; weights: number[]; note: string };
const NAMES = M.ozellik, idx = (n: string) => NAMES.indexOf(n);
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const kesim = M.kesim;
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);

export const S2_ADLAR = ["h2hNetSkor", "sireOrani", "accHizFormu", "jokeyPIT", "antrenorPIT", "galopKaliteV1", "lastWon", "hpRel", "kiloRel", "fMean", "kgsLog", "sexE", "dususDelta", "galopPedigri", "tempoOnOran", "tempoErkenHiz", "accBitis"];
const cm = (n: string) => ({ mu: CANLI.means[CANLI.featureNames.indexOf(n)]!, sd: CANLI.stds[CANLI.featureNames.indexOf(n)]! });
const mC = cm("ACC_CLOSE_RES"), mL = cm("ACC_LATE");
type Hucre = { raw: number; rel: number } | null;
// at için sinyal haritası (ham ad → hücre); accBitis türetilir
function hucreler(f: Cell[], adlar: string[]): Hucre[] {
  const g = (n: string): Hucre => { const c = f[idx(n)]; return c ? { raw: c[0], rel: c[1] } : null; };
  return adlar.map((n) => {
    if (n !== "accBitis") return g(n);
    const c = g("ACC_CLOSE_RES"), l = g("ACC_LATE");
    const a = c ? c.rel * (c.raw - mC.mu) / mC.sd : null, b = l ? l.rel * (l.raw - mL.mu) / mL.sd : null;
    const v = a != null && b != null ? (a + b) / 2 : (a ?? b); return v == null ? null : { raw: v, rel: 1 };
  });
}
type Row = { id: string; w: number; x: Float64Array[] };
function kur(trainR: Race[], testR: Race[], adlar: string[]) {
  const d = adlar.length, mu = new Float64Array(d), sd = new Float64Array(d);
  const tr = trainR.map((r) => r.runners.map((x) => hucreler(x.f, adlar)));
  for (let i = 0; i < d; i++) { let s = 0, n = 0; for (const rr of tr) for (const h of rr) { const c = h[i]; if (c) { s += c.raw; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const rr of tr) for (const h of rr) { const c = h[i]; if (c) s2 += (c.raw - m) ** 2; } mu[i] = m; sd[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (r: Race): Row => ({ id: r.raceId, w: r.runners.findIndex((x) => x.k === 1), x: r.runners.map((x) => { const h = hucreler(x.f, adlar); return Float64Array.from(h, (c, i) => (c ? c.rel * (c.raw - mu[i]!) / sd[i]! : 0)); }) });
  return { train: trainR.map(mk), test: testR.map(mk), mu, sd };
}
function egit(rows: Row[], d: number): Float64Array {
  const w = new Float64Array(d), vel = new Float64Array(d);
  for (let ep = 0; ep < 800; ep++) { const g = new Float64Array(d);
    for (const q of rows) { const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i]! * w[i]!; return s; })); for (let i = 0; i < q.x.length; i++) { const c = p[i]! - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k]! += c * q.x[i]![k]!; } }
    for (let k = 0; k < d; k++) { const gk = g[k]! / rows.length + 0.02 * w[k]!; vel[k] = 0.9 * vel[k]! - 0.08 * gk; w[k]! += vel[k]!; } }
  return w;
}
type RS = { ll: number; t1: number; t3: number; fold: number };
function cv(adlar: string[]): RS[] { const out: RS[] = [];
  for (let k = 0; k < 5; k++) { const bas = kesim[k]!, bit = k === 4 ? "9999" : kesim[k + 1]!; const F = kur(races.filter((r) => r.tarih < bas), races.filter((r) => r.tarih >= bas && r.tarih < bit), adlar); const w = egit(F.train, adlar.length);
    for (const r of F.test) { const p = softmax(r.x.map((v) => { let t = 0; for (let i = 0; i < adlar.length; i++) t += v[i]! * w[i]!; return t; })); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v); out.push({ ll: -Math.log(Math.max(p[r.w]!, 1e-15)), t1: sr[0]!.i === r.w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === r.w) ? 1 : 0, fold: k }); } }
  return out; }
const ozet = (a: RS[]) => { const d = a.filter((x) => x.fold <= 2), s = a.filter((x) => x.fold >= 3); return "DEV " + avg(d.map((x) => x.ll)).toFixed(4) + " | SINAMA " + avg(s.map((x) => x.ll)).toFixed(4) + " | 5 kat " + avg(a.map((x) => x.ll)).toFixed(4) + " | Top1 %" + (avg(a.map((x) => x.t1)) * 100).toFixed(1) + " | Top3 %" + (avg(a.map((x) => x.t3)) * 100).toFixed(1); };

const tam24 = NAMES; const cvT = cv(tam24), cvS = cv(S2_ADLAR);
console.log("TAM 24 (üretim standardizasyonu): " + ozet(cvT));
console.log("S2 17  (accBitis üretim tanımı):  " + ozet(cvS));
const dif = (a: RS[], b: RS[], f: (x: RS) => boolean) => { const x = a.filter(f).map((q, i) => q.ll - b.filter(f)[i]!.ll); let sd = 7; const rn = () => (sd = (sd * 1664525 + 1013904223) % 4294967296) / 4294967296; const bs: number[] = []; for (let t = 0; t < 2000; t++) { let q = 0; for (let i = 0; i < x.length; i++) q += x[Math.floor(rn() * x.length)]!; bs.push(q / x.length); } bs.sort((p, q) => p - q); return avg(x).toFixed(4) + " [" + bs[49]!.toFixed(4) + "," + bs[1949]!.toFixed(4) + "]"; };
console.log("ΔLL (S2 − tam): DEV " + dif(cvS, cvT, (x) => x.fold <= 2) + " | SINAMA " + dif(cvS, cvT, (x) => x.fold >= 3) + " | 5 kat " + dif(cvS, cvT, () => true));

// ── NİHAİ EĞİTİM: tüm yarışlar ──
const F = kur(races, [], S2_ADLAR); const w = egit(F.train, S2_ADLAR.length);
console.log("\nS2 nihai katsayılar (tüm " + races.length + " yarış):"); S2_ADLAR.forEach((n, i) => console.log("  " + n.padEnd(18) + " β=" + w[i]!.toFixed(4) + "  mu=" + F.mu[i]!.toFixed(4) + " sd=" + F.sd[i]!.toFixed(4) + (CANLI.featureNames.includes(n) ? "  (canlı β " + CANLI.weights[CANLI.featureNames.indexOf(n)]!.toFixed(4) + ")" : "")));

// Banko sinyal yönleri artık arac-banko-yon-uret.mts (kararlılık testli) tarafından üretilir.
if (process.argv.includes("--yaz")) {
  const dir = "src/lib/methodology/weights/";
  const o = { status: "SHADOW", version: "RotaGanyan Analiz Motoru — S2 gölge", generatedAt: new Date().toISOString().replace("Z", "+00:00"),
    note: "2026-11-17 S2 SADE MODEL (GÖLGE — canlı motor yüklemez): 24 → 17 sinyal. accBitis = (rel_C·z_C + rel_L·z_L)/2 (z'ler canlı v546-1-saf-weights.json μ/σ ile). Atılan: tempoOnBaski, tempoGeriBaski (ρ=−1 ayna), zeminToleransi, zeminMesafeDeneyim, jokeyFormuGenel, hizDerecesi. CV (zaman, 827 test): tam→S2 " + dif(cvS, cvT, () => true) + " (5 kat), SINAMA " + dif(cvS, cvT, (x) => x.fold >= 3) + ". S2'yi yapı bilgisiyle seçtim ama ek-katkı tabloları SINAMA katlarını da içerdiği için SINAMA tam bağımsız değil → gerçek doğrulama yeni yarışlarda gölge kıyas. Handikap ve ŞARTLI 1/27 segmentleri bu dosyada YOK/DEĞİŞMEDİ.",
    baseModel: "v546-1-saf-weights.json", featureNames: S2_ADLAR, weights: Array.from(w), means: Array.from(F.mu), stds: Array.from(F.sd),
    bilesik: { accBitis: { kaynak: ["ACC_CLOSE_RES", "ACC_LATE"], mu: [mC.mu, mL.mu], sd: [mC.sd, mL.sd], formul: "(rel_C*z_C + rel_L*z_L)/2; yalnız biri varsa o; güvenirlik=1" } },
    trainingWindow: { yarisSayisi: races.length }, holdoutDegerlendirme: "S2 − tam (5 kat): " + dif(cvS, cvT, () => true) };
  fs.writeFileSync(dir + "v546-1-saf-weights-s2-golge.json", JSON.stringify(o, null, 2));
  console.log("YAZILDI: " + dir + "v546-1-saf-weights-s2-golge.json");
}
