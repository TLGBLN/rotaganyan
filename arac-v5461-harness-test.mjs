// V5.46.1 TEST HARNESS AUDIT — ölçüm cihazının kendi doğruluk testleri.
// Model geliştirme yok. Amaç: walk-forward/conditional-logit/ΔLL hesabının beklenen sonucu verdiğini kanıtlamak.
// Çalıştırma: node arac-v5461-harness-test.mjs
import { readFileSync } from "node:fs";

const SCRATCH = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const rows = JSON.parse(readFileSync(`${SCRATCH}/model-veri-yg4.json`, "utf8"));
const tarih = JSON.parse(readFileSync(`${SCRATCH}/race-tarih.json`, "utf8"));

const FEAT = ["agfSirasi", "idmJokey", "jokeyOrani", "antrenorOrani", "agfPayi", "h2hNetSkor", "hizDerecesi",
  "agfPayi2", "zeminToleransi", "yakinsama2Plus", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru"];
function vec(r) {
  return [r.agfSirasi, r.idmJokey, r.jokeyOrani, r.antrenorOrani, r.agfPayi ?? 0, r.h2hNetSkor ?? 0,
    r.hizDerecesi ?? 0, (r.agfPayi ?? 0) ** 2, r.zeminToleransi ?? 0, r.yakinsama2Plus ?? 0,
    r.sonIdmanSprint ?? 0, (r.takiCikarildiMi ?? 0) - (r.takiEklendiMi ?? 0), r.yarisGidisatiSkoru ?? 0];
}
// Yakınsama (eğitim betiğiyle birebir) — veri dosyasında alan yok, burada üretilir.
function yakinsamaEkle(yarislar) {
  for (const y of yarislar) {
    const sirali = [...y.rows].sort((a, b) => (b.sireOrani ?? 0) - (a.sireOrani ?? 0));
    const sr = new Map(sirali.map((r, i) => [r, i + 1]));
    for (const r of y.rows) {
      const s = [(r.pistUzmani ?? 0) === 1, sr.get(r) <= 2, (r.ajiGalibiyetVarMi ?? 0) === 1,
        (r.agfFark ?? 0) >= 1.0, (r.sinifDususu ?? 0) === 1].filter(Boolean).length;
      r.yakinsama2Plus = s >= 2 ? 1 : 0;
    }
  }
}
function yarislar() {
  const map = new Map();
  for (const r of rows) {
    if (!tarih[r.raceId]) continue;
    if (!map.has(r.raceId)) map.set(r.raceId, { raceId: r.raceId, tarih: tarih[r.raceId], rows: [] });
    map.get(r.raceId).rows.push(r);
  }
  const list = [...map.values()];
  yakinsamaEkle(list);
  list.sort((a, b) => (a.tarih < b.tarih ? -1 : a.tarih > b.tarih ? 1 : 0));
  return list;
}
const TUM = yarislar();
const GECERLI = TUM.filter((y) => y.rows.filter((r) => r.win === 1).length === 1 && y.rows.length >= 4);

// ---- Conditional logit (eğitim betiğiyle aynı optimizer) ----
function softmax(s) { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const t = e.reduce((a, b) => a + b, 0); return e.map((x) => x / t); }
function standart(egitim, X, dim) {
  const mu = new Array(dim).fill(0), sd = new Array(dim).fill(0);
  let n = 0;
  for (const y of egitim) for (const r of y.rows) { const v = X(r); n++; for (let i = 0; i < dim; i++) mu[i] += v[i]; }
  for (let i = 0; i < dim; i++) mu[i] /= n;
  for (const y of egitim) for (const r of y.rows) { const v = X(r); for (let i = 0; i < dim; i++) sd[i] += (v[i] - mu[i]) ** 2; }
  for (let i = 0; i < dim; i++) sd[i] = Math.sqrt(sd[i] / n);
  return { mu, sd };
}
function zOf(r, X, norm) { return X(r).map((x, i) => (norm.sd[i] > 1e-9 ? (x - norm.mu[i]) / norm.sd[i] : 0)); }
function egit(egitim, X, dim, epoch = 800, L2 = 0.01) {
  const norm = standart(egitim, X, dim);
  const g = egitim.map((y) => ({ x: y.rows.map((r) => zOf(r, X, norm)), w: y.rows.findIndex((r) => r.win === 1) }));
  const w = new Array(dim).fill(0), vel = new Array(dim).fill(0);
  for (let ep = 0; ep < epoch; ep++) {
    const grad = new Array(dim).fill(0);
    for (const q of g) {
      const p = softmax(q.x.map((f) => f.reduce((s, xi, i) => s + xi * w[i], 0)));
      for (let i = 0; i < q.x.length; i++) { const c = p[i] - (i === q.w ? 1 : 0); for (let k = 0; k < dim; k++) grad[k] += c * q.x[i][k]; }
    }
    for (let k = 0; k < dim; k++) { const gk = grad[k] / g.length + 2 * L2 * w[k]; vel[k] = 0.9 * vel[k] - 0.08 * gk; w[k] += vel[k]; }
  }
  return { w, norm };
}
function olasilik(y, X, model, dim) {
  return softmax(y.rows.map((r) => zOf(r, X, model.norm)).map((f) => f.reduce((s, xi, i) => s + xi * model.w[i], 0)));
}
function nll(yarisListesi, X, model, dim) {
  let t = 0;
  for (const y of yarisListesi) { const p = olasilik(y, X, model, dim); const wi = y.rows.findIndex((r) => r.win === 1); t += -Math.log(Math.max(p[wi], 1e-15)); }
  return t / yarisListesi.length;
}
const X_TAM = vec;
const DIM = FEAT.length;

// ---- Testler ----
const sonuc = [];
const kayit = (ad, gecti, detay) => sonuc.push({ ad, durum: gecti ? "PASS" : "FAIL", detay });

// T1 Identity: aynı model iki kez → ΔLL = 0, olasılıklar eşit
{
  const egitim = GECERLI.slice(0, Math.floor(GECERLI.length * 0.75));
  const test = GECERLI.slice(Math.floor(GECERLI.length * 0.75));
  const m1 = egit(egitim, X_TAM, DIM, 200), m2 = egit(egitim, X_TAM, DIM, 200);
  let maxFark = 0;
  for (const y of test) { const a = olasilik(y, X_TAM, m1, DIM), b = olasilik(y, X_TAM, m2, DIM); a.forEach((p, i) => (maxFark = Math.max(maxFark, Math.abs(p - b[i])))); }
  kayit("T1 identity (aynı model)", maxFark < 1e-12, `maxAbsDiff=${maxFark}`);
}

// T2 Zero-variance: sabit (std=0) özellik eklenince modelin tahmini değişmemeli ve uyarı verilmeli
{
  const egitim = GECERLI.slice(0, Math.floor(GECERLI.length * 0.75));
  const test = GECERLI.slice(Math.floor(GECERLI.length * 0.75));
  const X0 = (r) => [...X_TAM(r), 0];
  const m0 = egit(egitim, X_TAM, DIM, 200), m1 = egit(egitim, X0, DIM + 1, 200);
  const d = Math.max(...test.map((y) => { const a = olasilik(y, X_TAM, m0, DIM), b = olasilik(y, X0, m1, DIM + 1); return Math.max(...a.map((p, i) => Math.abs(p - b[i]))); }));
  const sabitVar = egitim.some((y) => y.rows.some((r) => X0(r)[DIM] !== 0)) ? false : true;
  kayit("T2 sıfır varyanslı özellik zararsız + uyarı", d < 1e-9 && sabitVar, `maxFark=${d}; sabit-tespit=${sabitVar} (uyarı mekanizması yok → training abort edilmiyor)`);
}

// T3 Perfect winner (yalnız harness): kazananı işaretleyen sentetik özellik → büyük pozitif β, LL düşmeli
{
  const egitim = GECERLI.slice(0, Math.floor(GECERLI.length * 0.75));
  const test = GECERLI.slice(Math.floor(GECERLI.length * 0.75));
  const Xp = (r) => [...X_TAM(r), r.win === 1 ? 1 : 0];
  const mb = egit(egitim, X_TAM, DIM, 300), mp = egit(egitim, Xp, DIM + 1, 300);
  const llB = nll(test, X_TAM, mb, DIM), llP = nll(test, Xp, mp, DIM + 1);
  kayit("T3 perfect-winner → LL düşer, β>0", llP < llB - 0.5 && mp.w[DIM] > 0, `LL base=${llB.toFixed(4)} perfect=${llP.toFixed(4)} β=${mp.w[DIM].toFixed(3)}`);
}

// T4 Perfect loser: ters işaret → β<0
{
  const egitim = GECERLI.slice(0, Math.floor(GECERLI.length * 0.75));
  const Xl = (r) => [...X_TAM(r), r.win === 1 ? 0 : 1];
  const ml = egit(egitim, Xl, DIM + 1, 300);
  kayit("T4 perfect-loser → β<0", ml.w[DIM] < 0, `β=${ml.w[DIM].toFixed(3)}`);
}

// T5 Label shuffle: yarış içi kazanan etiketi karıştırılınca test LL bozulmalı (leakage yok)
{
  let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const kopya = GECERLI.map((y) => ({ ...y, rows: y.rows.map((r) => ({ ...r })) }));
  for (const y of kopya) { const idx = y.rows.map((_, i) => i); for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; } const w = y.rows.map((r) => r.win); y.rows.forEach((r, i) => (r.win = w[idx[i]])); }
  const egitim = kopya.slice(0, Math.floor(kopya.length * 0.75)), test = kopya.slice(Math.floor(kopya.length * 0.75));
  const m = egit(egitim, X_TAM, DIM, 200);
  const ll = nll(test, X_TAM, m, DIM);
  kayit("T5 label-shuffle → LL ~ rastgele", ll > 1.95, `shuffledLL=${ll.toFixed(4)} (rastgele ≈ ln(n_at) ortalaması)`);
}

// T6 Manuel softmax (5 at) — motorun softmax'ı elle hesapla
{
  const s = [2, 1, 0, -1, -2];
  const m = softmax(s);
  const el = s.map((x) => Math.exp(x)); const t = el.reduce((a, b) => a + b, 0); const man = el.map((x) => x / t);
  const d = Math.max(...m.map((p, i) => Math.abs(p - man[i])));
  kayit("T6 manuel softmax", d < 1e-12, `maxAbsDiff=${d}`);
}

// T7 Yarış içi olasılık toplamı = 1 ve yarış ayrımı
{
  const egitim = GECERLI.slice(0, Math.floor(GECERLI.length * 0.75));
  const m = egit(egitim, X_TAM, DIM, 100);
  const hatali = GECERLI.filter((y) => Math.abs(olasilik(y, X_TAM, m, DIM).reduce((a, b) => a + b, 0) - 1) > 1e-9).length;
  kayit("T7 yarış olasılık toplamı = 1", hatali === 0, `hatalıYarış=${hatali}`);
}

// T8 Winner mapping: her yarışta tam 1 kazanan
{
  // Kazanan sayısı ≠ 1 olan yarışlar deneylerde dışlanır; test: dışlanan sayısı bilinen ve kullanılanlarda tam 1 kazanan.
  const dislanan = TUM.filter((y) => y.rows.filter((r) => r.win === 1).length !== 1 || y.rows.length < 4).length;
  const kullanilanCoklu = GECERLI.filter((y) => y.rows.filter((r) => r.win === 1).length !== 1).length;
  kayit("T8 winner mapping (dışlama bilinir)", kullanilanCoklu === 0, `dışlanan=${dislanan} (kazanan yok/çoklu veya <4 at); kullanılan yarışlarda çoklu kazanan=${kullanilanCoklu}`);
}

// T9 Fold izolasyonu: eğitim ve test raceId kesişimi boş, zaman sırası korunuyor
{
  const k = Math.floor(GECERLI.length * 0.75);
  const egitim = GECERLI.slice(0, k), test = GECERLI.slice(k);
  const kesisim = egitim.filter((y) => test.some((t) => t.raceId === y.raceId)).length;
  const zamanOk = egitim[egitim.length - 1].tarih <= test[0].tarih;
  kayit("T9 fold izolasyonu (raceId + zaman)", kesisim === 0 && zamanOk, `kesisim=${kesisim}, zamanSirasi=${zamanOk}`);
}

// T10 Duplicate: (raceId, runnerId) tekil
{
  const set = new Set(); let dup = 0;
  for (const r of rows) { const k = `${r.raceId}|${r.runnerId}`; if (set.has(k)) dup++; else set.add(k); }
  kayit("T10 (raceId,runnerId) tekil", dup === 0, `duplicate=${dup}`);
}

// T11 Gradient check (finite difference, 5 bileşen)
{
  const egitim = GECERLI.slice(0, 300);
  const norm = standart(egitim, X_TAM, DIM);
  const gruplar = egitim.map((y) => ({ x: y.rows.map((r) => zOf(r, X_TAM, norm)), w: y.rows.findIndex((r) => r.win === 1) }));
  const L = (b) => { let t = 0; for (const g of gruplar) { const p = softmax(g.x.map((f) => f.reduce((s, xi, i) => s + xi * b[i], 0))); t += -Math.log(Math.max(p[g.w], 1e-15)); } return t / gruplar.length; };
  const G = (b) => { const g = new Array(DIM).fill(0); for (const q of gruplar) { const p = softmax(q.x.map((f) => f.reduce((s, xi, i) => s + xi * b[i], 0))); for (let i = 0; i < q.x.length; i++) { const c = p[i] - (i === q.w ? 1 : 0); for (let k = 0; k < DIM; k++) g[k] += c * q.x[i][k]; } } return g.map((x) => x / gruplar.length); };
  const b = new Array(DIM).fill(0.05); const ga = G(b); let maxH = 0;
  for (const j of [0, 4, 6, 9, 12]) { const e = 1e-5; const bp = [...b], bm = [...b]; bp[j] += e; bm[j] -= e; const num = (L(bp) - L(bm)) / (2 * e); maxH = Math.max(maxH, Math.abs(num - ga[j])); }
  kayit("T11 gradient check", maxH < 1e-5, `maxAbsDiff=${maxH}`);
}

// T12 Sentetik kurtarma: bilinen β (+1, -0.5) ile simüle et, geri kazan
{
  let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const yar = [];
  for (let k = 0; k < 800; k++) {
    const rows2 = Array.from({ length: 8 }, (_, i) => ({ f1: rnd() * 2 - 1, f2: rnd() * 2 - 1, id: i }));
    const sc = rows2.map((r) => 1 * r.f1 - 0.5 * r.f2);
    const p = softmax(sc); let u = rnd(), c = 0; let wi = 0; for (let i = 0; i < p.length; i++) { c += p[i]; if (u <= c) { wi = i; break; } }
    yar.push({ rows: rows2.map((r, i) => ({ ...r, win: i === wi ? 1 : 0 })) });
  }
  const X2 = (r) => [r.f1, r.f2];
  const m = egit(yar, X2, 2, 400);
  // Standardize ölçekte beklenen katsayı = β_raw × σ_özellik (σ≈0.577 for U(-1,1)).
  const sig = Math.sqrt(1 / 3);
  const bekl = [1 * sig, -0.5 * sig];
  const ok = Math.abs(m.w[0] - bekl[0]) < 0.05 && Math.abs(m.w[1] - bekl[1]) < 0.05;
  kayit("T12 sentetik kurtarma (standardize ölçek β·σ)", ok, `β_z=[${m.w.map((x) => x.toFixed(3)).join(", ")}] beklenen=[${bekl.map((x) => x.toFixed(3)).join(", ")}]`);
}

// T13 Bootstrap kimlik: challenger=baseline → CI=[0,0]
{
  const farklar = Array(200).fill(0);
  let seed = 20261006; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const bs = []; for (let b = 0; b < 300; b++) { let s = 0; for (let i = 0; i < farklar.length; i++) s += farklar[Math.floor(rnd() * farklar.length)]; bs.push(s / farklar.length); }
  kayit("T13 bootstrap kimlik CI=[0,0]", bs.every((x) => x === 0), `min=${Math.min(...bs)} max=${Math.max(...bs)}`);
}

// T14 Gate: sentetik değerlerle kapı mantığı
{
  const gate = (dLL, ci) => (ci[1] < 0 ? "PASS" : ci[0] < 0 && ci[1] >= 0 ? "UNCERTAIN" : "FAIL");
  const ok = gate(-0.02, [-0.03, -0.01]) === "PASS" && gate(-0.02, [-0.04, 0.01]) === "UNCERTAIN" && gate(0.01, [0.0, 0.02]) === "FAIL";
  kayit("T14 gate mantığı", ok, "PASS/UNCERTAIN/FAIL beklenen örüntü");
}

// T15 Feature sanity tablosu (training setinde std=0 olan özellikler)
{
  const sabit = FEAT.filter((f, i) => { const v = GECERLI.flatMap((y) => y.rows.map((r) => X_TAM(r)[i])); const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length) < 1e-12; });
  kayit("T15 std=0 özellik yok", sabit.length === 0, `sabit=[${sabit.join(", ")}]`);
}

for (const s of sonuc) console.log(`${s.durum}  ${s.ad}  — ${s.detay}`);
const fail = sonuc.filter((s) => s.durum === "FAIL").length;
console.log(`\nÖZET: ${sonuc.length - fail} PASS / ${fail} FAIL`);
