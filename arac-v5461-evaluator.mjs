// V5.46.1 BAĞIMSIZ DEĞERLENDİRİCİ — model kodunu içermez; yalnız dökülmüş olasılıklar (dump) okunur.
// Çıktı: LL, Brier, Top1/3/6, MRR, ortalama kazanan sırası, ΔLL; ilk değerlendiricinin sayılarıyla karşılaştırma.
// Bootstrap: (a) yarış-bazlı B=5000, (b) gün-kümeli (cluster) B=5000; sabit tohum; model yeniden eğitilmez.
import { readFileSync } from "node:fs";

const SCRATCH = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad";
const dosya = process.argv[2] ?? `${SCRATCH}/dump-tam.json`;
const dump = JSON.parse(readFileSync(dosya, "utf8"));

// Bağımsız metrik hesapları (ilk değerlendiricinin kodunu KULLANMAZ)
function yarisMetrik(y) {
  const p = y.p, wi = y.wi;
  const ll = -Math.log(Math.max(p[wi], 1e-15));
  const sirali = p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).map((x) => x[1]);
  const kazananSira = sirali.indexOf(wi) + 1; // 1-tabanlı
  const brier = p.reduce((s, v, i) => s + (v - (i === wi ? 1 : 0)) ** 2, 0) / p.length;
  return { ll, brier, top1: kazananSira <= 1 ? 1 : 0, top3: kazananSira <= 3 ? 1 : 0, top6: kazananSira <= 6 ? 1 : 0, mrr: 1 / kazananSira, sira: kazananSira, tarih: y.tarih };
}
const ort = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// Bootstrap (tohum sabit, bağımsız LCG)
function lcg(seed) { let s = seed; return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; }; }
function ciRace(fark, B = 5000) {
  const r = lcg(20261006); const n = fark.length; const out = [];
  for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < n; i++) s += fark[Math.floor(r() * n)]; out.push(s / n); }
  out.sort((a, b) => a - b); return [out[Math.floor(0.025 * B)], out[Math.floor(0.975 * B)]];
}
function ciGun(fark, gunler, B = 5000) {
  // gunler: her yarış için gün anahtarı; gün-kümeleri
  const grup = new Map();
  fark.forEach((f, i) => { const g = gunler[i]; if (!grup.has(g)) grup.set(g, []); grup.get(g).push(f); });
  const anahtar = [...grup.keys()]; const r = lcg(20261007); const out = [];
  for (let b = 0; b < B; b++) {
    let s = 0, n = 0;
    for (let k = 0; k < anahtar.length; k++) { const arr = grup.get(anahtar[Math.floor(r() * anahtar.length)]); for (const f of arr) { s += f; n++; } }
    out.push(s / n);
  }
  out.sort((a, b) => a - b); return [out[Math.floor(0.025 * B)], out[Math.floor(0.975 * B)]];
}

const rapor = [];
for (const seg of dump) {
  const A = seg.A.map((y) => ({ ...y, ...(y.p ? {} : {}) }));
  const B = seg.B;
  if (A.length !== B.length || A.some((y, i) => y.raceId !== B[i].raceId)) throw new Error("A/B yarış hizası bozuk");
  const mA = A.map((y, i) => yarisMetrik({ p: y.p, wi: y.wi, tarih: y.tarih }));
  const mB = B.map((y) => yarisMetrik({ p: y.p, wi: y.wi, tarih: y.tarih }));
  // İlk değerlendiricinin sayısıyla karşılaştırma (dump'taki ll)
  const uyumsuzLL = A.filter((y, i) => Math.abs(y.ll - mA[i].ll) > 1e-9).length + B.filter((y, i) => Math.abs(y.ll - mB[i].ll) > 1e-9).length;
  const fark = mB.map((m, i) => m.ll - mA[i].ll);
  const gunler = mB.map((m) => m.tarih);
  const ozet = (m) => ({ N: m.length, LL: +ort(m.map((x) => x.ll)).toFixed(5), Brier: +ort(m.map((x) => x.brier)).toFixed(5), Top1: +ort(m.map((x) => x.top1)).toFixed(4), Top3: +ort(m.map((x) => x.top3)).toFixed(4), Top6: +ort(m.map((x) => x.top6)).toFixed(4), MRR: +ort(m.map((x) => x.mrr)).toFixed(4), OrtKazananSirasi: +ort(m.map((x) => x.sira)).toFixed(3) });
  rapor.push({
    segment: seg.segment,
    A: ozet(mA), B: ozet(mB),
    deltaLL_BminusA: +ort(fark).toFixed(5),
    ci_yarisBazli_5000: ciRace(fark).map((x) => +x.toFixed(5)),
    ci_gunKumeli_5000: ciGun(fark, gunler).map((x) => +x.toFixed(5)),
    capraz_kontrol_uyumsuz_LL: uyumsuzLL,
  });
}
console.log(JSON.stringify(rapor, null, 2));
