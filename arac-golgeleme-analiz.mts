// KALICI ARAÇ — SİNYAL GÖLGELEME ANALİZİ (şartname v1.2, bölüm 3-4). SALT-OKUMA, DB'siz: yalnız .sinyal-veri/golgeleme-matris.json'u okur
// (arac-golgeleme-veri-dok.mts üretir: canlı varsayılan modelin 24 sinyali, tüm eğitim yarışları, yarış öncesi değerler).
// Protokol: motorla AYNI eğitim (çok-terimli lojistik/softmax, ridge 0.02, 800 adım momentum), 5 kat genişleyen pencere kronolojik CV,
// DEV = kat 0-2, SINAMA = kat 3-4, paired bootstrap %95 GA. ΔLL işaretleri: POZİTİF = iyileşme (şartname gösterimi: Δ = L(eski) − L(yeni)).
//  Δtek(X)  = L(M0) − L(M0+X)            (M0 = sinyalsiz, eşit olasılık)
//  Δek(X)   = L(M−X) − L(Mtam)            (X'i çıkarınca kayıp)
//  G(X)     = Δtek − Δek                  (gölgelenme)
//  I(A,B)   = L(M0+A)+L(M0+B)−L(M0)−L(M0+A+B)   (model etkileşim ölçüsü; nedensellik DEĞİL)
//  ÇARPIM   = L(Mtam) − L(Mtam + A×B)     (gerçek çarpımsal etkileşim terimi eklenirse kazanç)
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-golgeleme-analiz.mts   → .sinyal-veri/golgeleme-rapor-<gün>.md
import fs from "node:fs";

type Cell = [number, number, number?] | null; // [ham, güven, gerçekGözlem: 1 var / 0 yok (değer varsayılan/0) / -1 bilinmiyor]
type Race = { raceId: string; tarih: string; sinif: string | null; grup: number; runners: { no: number; k: number; f: Cell[] }[] };
const GIRDI = process.env.GOLGELEME_MATRIS ?? ".sinyal-veri/golgeleme-matris.json";
const M = JSON.parse(fs.readFileSync(GIRDI, "utf8")) as { uretim: string; ozellik: string[]; kesim: string[]; yarislar: Race[] };
const NAMES = M.ozellik, D = NAMES.length;
const races = [...M.yarislar].sort((a, b) => a.tarih.localeCompare(b.tarih)).filter((r) => r.runners.some((x) => x.k === 1));
const kesim = M.kesim, ALL5 = [0, 1, 2, 3, 4];
const idx = (n: string) => NAMES.indexOf(n);
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(1, a.length);

// ── Kat verisi: eğitim ortalama/σ yalnız eğitim dönemi; standardizasyon motorla aynı (güven × z; eksik = 0) ──
type Row = { id: string; x: Float64Array[]; w: number; n: number };
type Fold = { train: Row[]; test: Row[] };
// MOD=zaman (varsayılan): 5 kat genişleyen pencere, yalnız GELECEK test edilir (827 test yarışı) — tahmin gücü kararı için.
// MOD=blok: TÜM yarışlar test edilir; 5 ardışık zaman bloğu, her blok diğer 4'ünden öğrenilen modelle tahmin edilir — YAPI (gölgelenme) analizi için, daha fazla veri/güç. Kronolojik DEĞİL (gelecekten öğrenir); tahmin başarısı iddiası için kullanılmaz.
const MOD = process.env.GOLGELEME_MOD ?? "zaman";
const gunlerS = [...new Set(races.map((r) => r.tarih))].sort();
const blokSinir = [0, 0.2, 0.4, 0.6, 0.8, 1].map((q) => (q >= 1 ? "9999" : gunlerS[Math.floor(gunlerS.length * q)]!));
const folds: Fold[] = ALL5.map((k) => {
  const bas = MOD === "blok" ? blokSinir[k]! : kesim[k]!, bit = MOD === "blok" ? blokSinir[k + 1]! : (k === 4 ? "9999" : kesim[k + 1]!);
  const tr = MOD === "blok" ? races.filter((r) => r.tarih < bas || r.tarih >= bit) : races.filter((r) => r.tarih < bas), te = races.filter((r) => r.tarih >= bas && r.tarih < bit);
  const mu = new Float64Array(D), sg = new Float64Array(D);
  for (let i = 0; i < D; i++) { let s = 0, n = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) { s += c[0]; n++; } } const m = n ? s / n : 0; let s2 = 0; for (const r of tr) for (const x of r.runners) { const c = x.f[i]; if (c) s2 += (c[0] - m) ** 2; } mu[i] = m; sg[i] = n ? Math.sqrt(s2 / n) || 1 : 1; }
  const mk = (r: Race): Row => ({ id: r.raceId, n: r.runners.length, w: r.runners.findIndex((x) => x.k === 1), x: r.runners.map((x) => { const v = new Float64Array(D); for (let i = 0; i < D; i++) { const c = x.f[i]; v[i] = c ? c[1] * (c[0] - mu[i]!) / sg[i]! : 0; } return v; }) });
  return { train: tr.map(mk), test: te.map(mk) };
});

type Spec = { cols: number[]; prods?: [number, number][] };
const colsOf = (v: Float64Array, s: Spec) => { const o = new Float64Array(s.cols.length + (s.prods?.length ?? 0)); s.cols.forEach((c, j) => (o[j] = v[c]!)); s.prods?.forEach(([a, b], j) => (o[s.cols.length + j] = v[a]! * v[b]!)); return o; };
function egit(rows: { x: Float64Array[]; w: number }[], d: number): Float64Array {
  const w = new Float64Array(d), vel = new Float64Array(d); if (!d) return w;
  for (let ep = 0; ep < 800; ep++) {
    const g = new Float64Array(d);
    for (const q of rows) { const sc = q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i]! * w[i]!; return s; }); const p = softmax(sc); for (let i = 0; i < q.x.length; i++) { const c = p[i]! - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k]! += c * q.x[i]![k]!; } }
    for (let k = 0; k < d; k++) { const gk = g[k]! / rows.length + 0.02 * w[k]!; vel[k] = 0.9 * vel[k]! + -0.08 * gk; w[k]! += vel[k]!; }
  }
  return w;
}
type RS = { ll: number; t1: number; t3: number; fold: number };
const cache = new Map<string, Map<string, RS>>();
function kosu(s: Spec): Map<string, RS> {
  const key = JSON.stringify(s); const c = cache.get(key); if (c) return c;
  const out = new Map<string, RS>(); const d = s.cols.length + (s.prods?.length ?? 0);
  folds.forEach((f, k) => {
    const w = egit(f.train.map((r) => ({ w: r.w, x: r.x.map((v) => colsOf(v, s)) })), d);
    for (const r of f.test) {
      const sc = r.x.map((v) => { const u = colsOf(v, s); let t = 0; for (let i = 0; i < d; i++) t += u[i]! * w[i]!; return t; }); const p = softmax(sc);
      const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
      out.set(r.id, { ll: -Math.log(Math.max(p[r.w]!, 1e-15)), t1: sr[0]!.i === r.w ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === r.w) ? 1 : 0, fold: k });
    }
  });
  cache.set(key, out); return out;
}
// M0: sinyalsiz, eşit olasılık (analitik)
const M0: Map<string, RS> = new Map(); folds.forEach((f, k) => { for (const r of f.test) M0.set(r.id, { ll: Math.log(r.n), t1: 1 / r.n, t3: Math.min(3, r.n) / r.n, fold: k }); });
const ids = [...M0.keys()]; const devI = ids.filter((i) => M0.get(i)!.fold <= 2), sinI = ids.filter((i) => M0.get(i)!.fold >= 3);

let seed = 101; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
const ciOf = (dif: number[]) => { const n = dif.length; const bs: number[] = []; for (let b = 0; b < 2000; b++) { let q = 0; for (let i = 0; i < n; i++) q += dif[Math.floor(rnd() * n)]!; bs.push(q / n); } bs.sort((p, q) => p - q); return { m: avg(dif), lo: bs[49]!, hi: bs[1949]! }; };
// KAZANÇ = L(eski) − L(yeni): POZİTİF = yeni model daha iyi
const kazanc = (eski: Map<string, RS>, yeni: Map<string, RS>, sub: string[]) => ciOf(sub.map((i) => eski.get(i)!.ll - yeni.get(i)!.ll));
const fmt = (c: { m: number; lo: number; hi: number }) => (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + "," + c.hi.toFixed(4) + "]" + (c.lo > 0 ? " ✔" : c.hi < 0 ? " ✘" : "");
const dm = (eski: Map<string, RS>, yeni: Map<string, RS>, sub: string[]) => avg(sub.map((i) => eski.get(i)!.ll - yeni.get(i)!.ll));

const log: string[] = []; const P = (s = "") => { console.log(s); log.push(s); };
const tam: Spec = { cols: [...Array(D).keys()] };
P("# SİNYAL GÖLGELEME RAPORU — " + new Date().toISOString().slice(0, 10));
P("Veri: " + M.uretim + " | yarış " + races.length + " | test yarışı " + ids.length + " (DEV " + devI.length + " / SINAMA " + sinI.length + ") | sinyal " + D);
P("Gösterim: kazanç = L(eski) − L(yeni); **pozitif = iyileşme**. ✔ = GA tamamen > 0, ✘ = GA tamamen < 0. M0 = sinyalsiz eşit olasılık.");
P("Sınırlama: yalnız VARSAYILAN modelin popülasyonu (24 sinyal); Handikap ve ŞARTLI 1/27 segment modelleri ayrı ağırlık kullanır, burada ayrıca incelenmedi.");
const mT = kosu(tam);
P("\nTam model (24): LL " + avg(ids.map((i) => mT.get(i)!.ll)).toFixed(4) + " | Top1 %" + (avg(ids.map((i) => mT.get(i)!.t1)) * 100).toFixed(1) + " | Top3 %" + (avg(ids.map((i) => mT.get(i)!.t3)) * 100).toFixed(1) + " | M0 LL " + avg(ids.map((i) => M0.get(i)!.ll)).toFixed(4));

// ── 1) Doluluk + Spearman ──
const rank = (a: number[]) => { const o = a.map((v, i) => ({ v, i })).sort((p, q) => p.v - q.v); const r = new Array<number>(a.length); for (let i = 0; i < o.length;) { let j = i; while (j + 1 < o.length && o[j + 1]!.v === o[i]!.v) j++; const t = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k]!.i] = t; i = j + 1; } return r; };
const pear = (a: number[], b: number[]) => { const ma = avg(a), mb = avg(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i]! - ma) * (b[i]! - mb); saa += (a[i]! - ma) ** 2; sbb += (b[i]! - mb) ** 2; } return saa > 0 && sbb > 0 ? sab / Math.sqrt(saa * sbb) : 0; };
const flat = races.flatMap((r) => { const mean = new Float64Array(D), cnt = new Float64Array(D); for (const x of r.runners) for (let i = 0; i < D; i++) if (x.f[i]) { mean[i]! += x.f[i]![0]; cnt[i]!++; } return r.runners.map((x) => ({ v: x.f.map((c) => (c ? c[0] : null)), c: x.f.map((c, i) => (c && cnt[i]! >= 2 ? c[0] - mean[i]! / cnt[i]! : null)) })); });
const nAt = flat.length;
P("\n## 1. Doluluk (gözlemli at oranı)"); P(NAMES.map((n, i) => n + " %" + (flat.filter((q) => q.v[i] != null).length / nAt * 100).toFixed(0)).join(" | "));
P("\n**Gerçek gözlem oranı** (modelde 'gözlemli' sayılan değerlerin kaçı gerçekten ölçülmüş; kalanı varsayılan/0 değer taşıyor = şartnamenin 'eksik ≠ sıfır' kuralı ihlali adayı):");
P(NAMES.map((n, i) => { const v = flat.filter((q) => q.v[i] != null).length; const e = races.flatMap((r) => r.runners).filter((x) => x.f[i] && x.f[i]![2] === 1).length, bil = races.flatMap((r) => r.runners).filter((x) => x.f[i] && x.f[i]![2] !== -1 && x.f[i]![2] !== undefined).length; return bil ? n + " %" + (e / bil * 100).toFixed(0) + " gerçek" + (e / bil < 0.9 ? " ⚠" : "") : n + " (bayrak yok)"; }).join(" | "));
const sp = (kaynak: "v" | "c", i: number, j: number) => { const a: number[] = [], b: number[] = []; for (const q of flat) { const x = q[kaynak][i], y = q[kaynak][j]; if (x != null && y != null) { a.push(x); b.push(y); } } return { rho: a.length > 50 ? pear(rank(a), rank(b)) : NaN, n: a.length }; };
const cifts: { a: string; b: string; havuz: number; icinde: number; n: number }[] = [];
for (let i = 0; i < D; i++) for (let j = i + 1; j < D; j++) { const h = sp("v", i, j), c = sp("c", i, j); cifts.push({ a: NAMES[i]!, b: NAMES[j]!, havuz: h.rho, icinde: c.rho, n: h.n }); }
P("\n## 2. Spearman (|ρ| ≥ 0,40 olan çiftler; 'yarış-içi' = her yarışın ortalamasından sapma, asıl önemli olan budur çünkü model yalnız yarış İÇİ farkı kullanır)");
P("| Sinyal A | Sinyal B | ρ havuz | ρ yarış-içi | n | bant |"); P("|---|---|---|---|---|---|");
const bant = (r: number) => { const a = Math.abs(r); return a >= 0.9 ? "çok yüksek tekrar ihtimali" : a >= 0.75 ? "yüksek örtüşme incelemesi" : a >= 0.5 ? "ortak kaynak kontrolü" : "izleme"; };
for (const c of cifts.filter((c) => Math.abs(c.icinde) >= 0.4 || Math.abs(c.havuz) >= 0.4).sort((p, q) => Math.abs(q.icinde) - Math.abs(p.icinde))) P("| " + c.a + " | " + c.b + " | " + c.havuz.toFixed(2) + " | " + c.icinde.toFixed(2) + " | " + c.n + " | " + bant(c.icinde) + " |");

// ── 2) Tek / ek / gölgelenme ──
P("\n## 3. Tek başına katkı Δtek, ek katkı Δek ve gölgelenme G = Δtek − Δek (5 kat; DEV/SINAMA ayrıca)");
P("MOD = " + MOD + (MOD === "blok" ? " (tüm " + ids.length + " yarış test edildi; DEV/SINAMA sütunları = ilk 3 / son 2 zaman bloğu, kronolojik doğrulama DEĞİL)" : " (yalnız gelecek yarışlar)"));
P("**Kapsam alt kümesi** = sinyalin yarıştaki atların ≥%50'sinde GERÇEKTEN dolu olduğu yarışlar. Alt kümede dolu olan bir sinyal (ör. galop yalnız düşük sınıfta) tüm yarışlara karışınca seyreliyor; gerçek değerini burada görürsünüz.");
P("| Sinyal | Δtek (tüm test) | Δek (tüm test) | G | Δtek DEV/SINAMA | Δek DEV/SINAMA | Top1 ek | **Kapsam alt kümesi: n yarış, Δtek, Δek** | karar adayı |"); P("|---|---|---|---|---|---|---|---|---|");
const raceFrac = new Map<string, number[]>(); for (const r of races) { const f = new Array<number>(D).fill(0); for (const x of r.runners) for (let i = 0; i < D; i++) if (x.f[i] && x.f[i]![2] !== 0) f[i]!++; raceFrac.set(r.raceId, f.map((v) => v / r.runners.length)); }
type Satir = { ad: string; tek: number; ek: number; ekLo: number; ekHi: number; tekLo: number; g: number };
const sat: Satir[] = [];
for (let i = 0; i < D; i++) {
  const solo = kosu({ cols: [i] }), eksik = kosu({ cols: tam.cols.filter((c) => c !== i) });
  const tek = kazanc(M0, solo, ids), ek = kazanc(eksik, mT, ids);
  const tekD = dm(M0, solo, devI), tekS = dm(M0, solo, sinI), ekD = dm(eksik, mT, devI), ekS = dm(eksik, mT, sinI);
  const t1 = (avg(ids.map((x) => mT.get(x)!.t1)) - avg(ids.map((x) => eksik.get(x)!.t1))) * 100;
  const g = tek.m - ek.m;
  const tG = tek.lo > 0 && tek.m >= 0.003, eG = ek.m >= 0.003 && ek.lo > 0;
  const karar = tG && eG ? "Koru" : tG && !eG ? (ek.m <= 0 ? "Gölgelenmeyi incele (ek ≤ 0)" : "Gölgelenmeyi incele") : !tG && eG ? "Birlikte koru (ek güçlü)" : ek.hi < 0 ? "ELEME ADAYI (çıkarınca iyileşiyor)" : ek.m <= 0.0005 ? "Eleme adayı / etkileşime bak" : "Zayıf, izle";
  sat.push({ ad: NAMES[i]!, tek: tek.m, ek: ek.m, ekLo: ek.lo, ekHi: ek.hi, tekLo: tek.lo, g });
  const sub = ids.filter((id) => (raceFrac.get(id)?.[i] ?? 0) >= 0.5);
  const altK = sub.length >= 60 ? sub.length + " yarış: " + fmt(kazanc(M0, solo, sub)) + " | " + fmt(kazanc(eksik, mT, sub)) : sub.length + " yarış (az)";
  P("| " + NAMES[i] + " | " + fmt(tek) + " | " + fmt(ek) + " | " + g.toFixed(4) + " | " + tekD.toFixed(4) + " / " + tekS.toFixed(4) + " | " + ekD.toFixed(4) + " / " + ekS.toFixed(4) + " | " + (t1 >= 0 ? "+" : "") + t1.toFixed(1) + " | " + altK + " | " + karar + " |");
}
P("\nKarar eşikleri (BENİM seçimim, şartnamede yok): 'güçlü' = ortalama kazanç ≥ 0,003 ve GA alt sınırı > 0. Eleme için ek katkının GA'sı tamamen < 0 olması (çıkarınca model iyileşiyor) gerekir; tek başına küçük katsayı eleme gerekçesi değildir.");

// ── 3) Etkileşimler ──
P("\n## 4. Birlikte güçlenme I(A,B) ve çarpım terimi");
P("Şartnamedeki I = L(M0+A)+L(M0+B)−L(M0)−L(M0+A+B), kazanç gösterimiyle I = kazanç(A+B) − kazanç(A) − kazanç(B) ile AYNIDIR: pozitif = birlikte ek fayda, negatif = örtüşme (ikisi aynı bilgiyi taşıyor).");
P("ÇARPIM = Mtam'a A×B terimi eklenince kazanç (pozitif = çarpımsal etkileşim var).");
P("| A | B | kazanç(A) | kazanç(B) | kazanç(A+B) | I_kazanç | ÇARPIM kazancı (5 kat) | ÇARPIM DEV/SINAMA |"); P("|---|---|---|---|---|---|---|---|");
const CIFT: [string, string][] = [
  ["ACC_CLOSE_RES", "jokeyPIT"], ["ACC_LATE", "jokeyPIT"], ["accHizFormu", "jokeyPIT"], ["accHizFormu", "tempoOnOran"], ["ACC_CLOSE_RES", "tempoOnOran"], ["ACC_LATE", "tempoOnOran"],
  ["galopKaliteV1", "kgsLog"], ["zeminToleransi", "accHizFormu"], ["zeminMesafeDeneyim", "accHizFormu"], ["jokeyPIT", "tempoOnOran"], ["jokeyPIT", "tempoOnBaski"],
  ["hizDerecesi", "accHizFormu"], ["jokeyPIT", "jokeyFormuGenel"], ["hpRel", "kiloRel"], ["fMean", "lastWon"], ["tempoOnOran", "tempoErkenHiz"],
];
const etk: { a: string; b: string; I: number; carp: number; carpLo: number; carpD: number; carpS: number }[] = [];
for (const [an, bn] of CIFT) {
  const a = idx(an), b = idx(bn); if (a < 0 || b < 0) { P("| " + an + " | " + bn + " | (sinyal canlı sette yok) | | | | | |"); continue; }
  const kA = kosu({ cols: [a] }), kB = kosu({ cols: [b] }), kAB = kosu({ cols: [a, b] });
  const gA = kazanc(M0, kA, ids).m, gB = kazanc(M0, kB, ids).m, gAB = kazanc(M0, kAB, ids).m;
  const mp = kosu({ cols: tam.cols, prods: [[a, b]] }); const cp = kazanc(mT, mp, ids);
  etk.push({ a: an, b: bn, I: gAB - gA - gB, carp: cp.m, carpLo: cp.lo, carpD: dm(mT, mp, devI), carpS: dm(mT, mp, sinI) });
  P("| " + an + " | " + bn + " | " + gA.toFixed(4) + " | " + gB.toFixed(4) + " | " + gAB.toFixed(4) + " | " + (gAB - gA - gB).toFixed(4) + " | " + fmt(cp) + " | " + dm(mT, mp, devI).toFixed(4) + " / " + dm(mT, mp, sinI).toFixed(4) + " |");
}
P("\n**Çoklu test uyarısı:** " + (D * 2 + CIFT.length * 2) + "+ model karşılaştırması yapıldı; tek tek 'önemli' görünen bir satır tesadüf olabilir. Karar için SINAMA (kat 3-4) yönünün DEV ile tutarlı olması aranmalı. Bu analiz KARAR değil, aday listesi üretir; sinyal eleme önerisi bağımsız son testten geçmeden uygulanmaz.");
P("**Henüz yapılmayanlar:** (a) özgün bilgi/artık testi (şartname bölüm 4), (b) kulvar sinyali (canlı sette yok), (c) ağaç tabanlı karşılaştırma, (d) L1/grup düzenlileştirme ile sade küme seçimi, (e) segment modelleri.");
const CIKTI = process.env.GOLGELEME_RAPOR ?? ".sinyal-veri/golgeleme-rapor-" + new Date().toISOString().slice(0, 10) + (MOD === "blok" ? "-blok" : "") + ".md";
fs.writeFileSync(CIKTI, log.join("\n"));
console.log("\nRapor yazıldı: " + CIKTI);
