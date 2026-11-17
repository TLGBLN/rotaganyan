/**
 * YENİ LIDERLIK_BASKISI (v2) TESTİ — B_h = P_h·Σ_{j≠h} P_j·exp(−|V_h−V_j|/τ); P_öncü: 400 m VE 600 m'de KALICI ön grup. SALT-OKUMA. Sinyal/ağırlık/katsayı SEÇİLMEZ; motora hiçbir şey eklenmez.
 * Karar kuralı (kullanıcı): ACC_HIZ ve KOSU_STILI üzerine ek katkısı yoksa baskı sinyali oluşturulmaz. ERKEN_HIZ yalnız yardımcı veridir (V olarak baskıya girer; sinyal değildir).
 * Popülasyon: /admin/kosu-tipleri yarışları; AYNI 6 blok / 1259 test yarışı; as-of; N = TJK gerçek koşan at sayısı. Ölçü cihazı = ileri-bloklu çok-parametreli yarış-içi softmax (β yalnız GEÇMİŞ bloklardan; işaret veriden).
 * Çıktı: TEMPO_YENI_BASKI_TEST.md (gün/tarih kırılımı yok)
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { toAccuraceCitySlug } from "./src/server/services/ingest/accurace.adapter";
import { TempoDeposu, liderlikBaskisi, tempoBilesenleri, tempoNormalize, type TempoHam, type TempoYuzey } from "./src/lib/methodology/yeni-motor/adaylar/tempo-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 4) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null); const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
let tohum = 4242; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const sirala = (a: number[]) => { const idx = a.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length).fill(0); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++; const o = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]![1]] = o; i = j + 1; } return r; };
const L: string[] = []; const p = (s = "") => L.push(s);

console.log("Accurace okunuyor…");
const gercekN = new Map<string, number>(); for (const r of await db.race.findMany({ where: { accuraceRace: { isNot: null } }, select: { accuraceRace: { select: { id: true } }, runners: { where: { scratched: false }, select: { id: true } } } })) if (r.accuraceRace) gercekN.set(r.accuraceRace.id, r.runners.length);
const YZ: Record<string, TempoYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" };
type H0 = { yarisId: string; atId: number | null; tarih: number; hip: string; irk: string | null; yuzey: TempoYuzey | null; mesafe: number; kontrol: { m: number; ms: number; place: number }[]; sureMs: number };
const ham0: H0[] = []; const yarisBoy = new Map<string, H0[]>();
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) {
  const h: H0 = { yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number; place: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal, place: c.place })) };
  ham0.push(h); (yarisBoy.get(h.yarisId) ?? yarisBoy.set(h.yarisId, []).get(h.yarisId)!).push(h);
}
const siraGecerli = new Map<string, boolean>(); for (const [id, hs] of yarisBoy) { const N = hs.length; let ok = N >= 2; for (const d of [200, 400, 600]) { const pl = hs.map((h) => h.kontrol.find((c) => c.m === d)?.place ?? null); if (pl.some((x) => x == null)) { ok = false; break; } const s = new Set(pl as number[]); if (s.size !== N || Math.min(...(pl as number[])) !== 1 || Math.max(...(pl as number[])) !== N) { ok = false; break; } } siraGecerli.set(id, ok); }
const tempoDep = new TempoDeposu(ham0.flatMap((h) => { const t: TempoHam = { yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey, mesafe: h.mesafe, sahaN: gercekN.get(h.yarisId) ?? yarisBoy.get(h.yarisId)!.length, siraGecerli: siraGecerli.get(h.yarisId) ?? false, kontrol: h.kontrol }; const { kayit } = tempoNormalize(t); return kayit ? [kayit] : []; }));
const accDep = new AccDeposu(ham0.flatMap((h) => { const a: AccHam = { yarisId: h.yarisId, atId: h.atId, tarih: h.tarih, hip: h.hip, irk: h.irk, yuzey: h.yuzey as AccYuzey | null, mesafe: h.mesafe, sureMs: h.sureMs, kontrol: h.kontrol.map((c) => ({ m: c.m, ms: c.ms })) }; const { kayit } = accNormalize(a); return kayit ? [kayit] : []; }));

// ───── puanlar (FAZ A; sonuç yüklenmeden)
const ks = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { raceNo: true, distance: true, breed: true, surface: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, tjkAtId: true } } } });
type At = { no: number; kazandi: boolean; acc: number | null; erken: number | null; stil: number | null; baski: number | null; p: number; veriYok: boolean };
type Kosu = { tip: string; atlar: At[]; tauVar: boolean };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" }; const pop: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
for (const t of gunler) { const gt = tempoDep.gorunum(t), ga = accDep.gorunum(t);
  for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yz = YUZ[String(k.surface)]; if (win.size === 0 || !yz) continue;
    const B = k.runners.map((r) => (r.tjkAtId == null ? null : tempoBilesenleri(gt, r.tjkAtId))); const tau = gt.tau({ irk: String(k.breed), yuzey: yz, hip: toAccuraceCitySlug(k.raceDay.hippodrome.name), mesafe: k.distance });
    const bs = tau ? liderlikBaskisi(B.map((b) => ({ v: b?.erkenHiz ?? null, p: b?.pOncu.p ?? 0.5 })), tau.tau) : null;
    pop.push({ tip: kabaG(normalizeClassType(k.classType)), tauVar: tau != null, atlar: k.runners.map((r, i) => ({ no: r.no, kazandi: win.has(r.no), acc: r.tjkAtId == null ? null : accBilesenleri(ga, r.tjkAtId, yz).accHiz, erken: B[i]?.erkenHiz ?? null, stil: B[i]?.stil ?? null, p: B[i]?.pOncu.p ?? 0.5, baski: bs && bs[i]!.baski != null && bs[i]!.bilinenRakip > 0 ? bs[i]!.baski! / bs[i]!.bilinenRakip : null, veriYok: B[i]?.pOncu.veriYok ?? true })) }); } }
console.log(`${pop.length} yarış`);
const secilen = gunler.filter((_, i) => i % Math.ceil(gunler.length / 8) === 0).slice(0, 8); let denenen = 0, farkli = 0;
for (const t of secilen) { const g0 = tempoDep.gorunum(t), g1 = tempoDep.gelecegiBoz(t, 55 + (t / 86400000) % 991).gorunum(t);
  for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const yz = YUZ[String(k.surface)]; if (!yz) continue; const hk = { irk: String(k.breed), yuzey: yz, hip: toAccuraceCitySlug(k.raceDay.hippodrome.name), mesafe: k.distance }; denenen++; if (JSON.stringify(g0.tau(hk)) !== JSON.stringify(g1.tau(hk))) farkli++;
    for (const r of k.runners) { if (r.tjkAtId == null) continue; denenen++; if (JSON.stringify(tempoBilesenleri(g0, r.tjkAtId)) !== JSON.stringify(tempoBilesenleri(g1, r.tjkAtId))) farkli++; } } }

// ───── ölçü cihazı
const FEAT = { acc: (a: At) => (a.acc == null ? null : a.acc / 100), erken: (a: At) => (a.erken == null ? null : a.erken / 100), stil: (a: At) => a.stil, baski: (a: At) => a.baski, p: (a: At) => a.p } as const; type FK = keyof typeof FEAT;
const doldur = (v: (number | null)[]) => { const a = nn(v); if (a.length < 2) return v.map(() => 0); const mu = mean(a); return v.map((q) => (q == null ? mu : q)); };
const yk = pop.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi), X: Object.fromEntries((Object.keys(FEAT) as FK[]).map((c) => [c, doldur(k.atlar.map((a) => FEAT[c](a)))])) as Record<FK, number[]> })).filter((y) => y.w >= 0);
function coz(H: number[][], g: number[]) { const K = g.length; const A = H.map((r, i) => [...r, g[i]!]); for (let c = 0; c < K; c++) { let m = c; for (let r = c + 1; r < K; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[m]![c]!)) m = r; [A[c], A[m]] = [A[m]!, A[c]!]; const d = A[c]![c]!; for (let j = c; j <= K; j++) A[c]![j]! /= d; for (let r = 0; r < K; r++) if (r !== c) { const fct = A[r]![c]!; for (let j = c; j <= K; j++) A[r]![j]! -= fct * A[c]![j]!; } } return A.map((r) => r[K]!); }
function fit(idx: number[], cols: FK[]) { const K = cols.length; let b = new Array(K).fill(0);
  for (let it = 0; it < 30; it++) { const g = new Array(K).fill(0); const H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const i of idx) { const X = cols.map((c) => yk[i]!.X[c]); const N = X[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk: number, k: number) => bk * X[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); const pr = e.map((q) => q / z);
      const ex = X.map((col) => sum(col.map((v, r) => pr[r]! * v))); const exx = Array.from({ length: K }, (_, a) => Array.from({ length: K }, (_, c) => sum(X[a]!.map((v, r) => pr[r]! * v * X[c]![r]!)))); const w = yk[i]!.w;
      for (let a = 0; a < K; a++) g[a] += X[a]![w]! - ex[a]!; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) H[a]![c] += exx[a]![c]! - ex[a]! * ex[c]!; }
    for (let a = 0; a < K; a++) { g[a] -= 0.02 * b[a]; H[a]![a] += 0.02; } const d = coz(H, g); b = b.map((q: number, k: number) => q + Math.max(-3, Math.min(3, d[k]!))); if (Math.max(...d.map(Math.abs)) < 1e-7) break; } return b as number[]; }
const olasilik = (i: number, cols: FK[], b: number[]) => { const X = cols.map((c) => yk[i]!.X[c]); const N = X[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk, k) => bk * X[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); return e.map((q) => q / z); };
const BLOK = 6; const bas = (b: number) => Math.floor(yk.length * b / BLOK); const test: number[] = []; for (let i = bas(1); i < yk.length; i++) test.push(i);
const AD = { A: "A. Yalnız ACC_HIZ", D1: "D1. ACC_HIZ + KOSU_STILI (korunan iki sinyal)", B: "B. Yalnız YENİ LIDERLIK_BASKISI", E1: "E1. ACC_HIZ + YENİ BASKI", E2: "E2. ACC_HIZ + KOSU_STILI + YENİ BASKI", D2: "D2. ACC_HIZ + KOSU_STILI + ERKEN_HIZ (yardımcı)", E3: "E3. ACC_HIZ + KOSU_STILI + ERKEN_HIZ + YENİ BASKI" } as const;
const MODELLER: [string, FK[]][] = [[AD.A, ["acc"]], [AD.D1, ["acc", "stil"]], [AD.B, ["baski"]], [AD.E1, ["acc", "baski"]], [AD.E2, ["acc", "stil", "baski"]], [AD.D2, ["acc", "stil", "erken"]], [AD.E3, ["acc", "stil", "erken", "baski"]]];
const ll: Record<string, number[]> = {}, t1: Record<string, number[]> = {}, t3: Record<string, number[]> = {}, bt: Record<string, string[]> = {};
for (const [ad, cols] of MODELLER) { ll[ad] = []; t1[ad] = []; t3[ad] = []; bt[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, cols); bt[ad]!.push(b.map((q) => q.toFixed(2)).join("/"));
  for (let i = bas(bl); i < bas(bl + 1); i++) { const pr = olasilik(i, cols, b); const w = yk[i]!.w; ll[ad]!.push(-Math.log(Math.max(pr[w]!, 1e-12))); const better = pr.filter((q) => q > pr[w]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[w]!) <= 1e-12).length; t1[ad]!.push(Math.max(0, Math.min(1, (1 - better) / eq))); t3[ad]!.push(Math.max(0, Math.min(1, (3 - better) / eq))); } } }
const taban = test.map((i) => Math.log(yk[i]!.X.acc.length)); const r1 = test.map((i) => 1 / yk[i]!.X.acc.length), r3 = test.map((i) => Math.min(1, 3 / yk[i]!.X.acc.length));
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };

// ───── RAPOR
const hep = pop.flatMap((k) => k.atlar); const toplamAt = hep.length;
p("# YENİ LİDERLİK BASKISI (v2) — ACC_HIZ ve KOSU_STILI üzerine ek katkı testi");
p("**Yeni motora sinyal eklenmedi; ağırlık/katsayı SEÇİLMEDİ; `SINYAL_KAYDI` boş.** Eski σ-formülü iptal. **Yeni tanım (sizin):** B_h = P_h · Σ_{j≠h} P_j · exp(−|V_h − V_j| / τ); P_öncü = (1+k)/(2+n) ve k = atın son n=3 uygun yarışında **400 m VE 600 m'de kalıcı ön grupta** olduğu yarış sayısı (ön grup = sıra ≤ max(2, ⌈0,20·N⌉), N = TJK'daki gerçek koşan at sayısı); V = ERKEN_HIZ yüzdeliği; τ = benzer geçmiş yarışlarda atlar arası ERKEN_HIZ farklarının (|ΔV|) medyanı (önceki aşamadaki gibi, sonuçlardan bağımsız, as-of).");
p(`Popülasyon: /admin/kosu-tipleri — **${pop.length} yarış, ${toplamAt} at**; **aynı 6 blok / ${test.length} test yarışı**. Her puan yarış gününden ÖNCEKİ kayıtlarla. **Gelecek-bozma testi** (${secilen.length} gün, ${denenen} ölçüm: tüm atların bileşenleri + τ): **${farkli === 0 && denenen > 0 ? "GEÇTİ — birebir aynı, sızıntı yok" : "SIZINTI VAR (" + farkli + ")"}**. Puanlar sonuç yüklenmeden önce hesaplandı.`);
p("");
p("## Okuma kılavuzu");
p("- Ölçü cihazı: β'lar YALNIZ geçmiş bloklardan; eksik puan yarış ortalamasına (nötr); **yön varsayımı yok**. ΔLL = taban(1/N) − ölçüm (pozitif = iyi). Girdi ölçekleri: ACC_HIZ/100, ERKEN_HIZ/100, KOSU_STILI (0–1), BASKI/(B'de bilinen rakip sayısı). Köşeli parantez = eşleştirilmiş bootstrap %95 (1000).");
p("- **Karar kuralınız:** ACC_HIZ ve KOSU_STILI üzerine ek katkı yoksa baskı sinyali oluşturulmaz → bu yüzden asıl karşılaştırma **E2 − D1**. ERKEN_HIZ yardımcı veridir; D2/E3 yalnız baskının ERKEN_HIZ'ın ötesinde bilgi taşıyıp taşımadığını görmek içindir.");
p("");
p("## 1. Kapsam");
p("| Ölçü | At | Oran |\n|---|---|---|"); for (const [ad, fn] of [["ACC_HIZ var", (a: At) => a.acc != null], ["KOSU_STILI var", (a: At) => a.stil != null], ["YENİ BASKI var (τ ve atın V'si bilinen)", (a: At) => a.baski != null], ["P_öncü'de veri YOK (önsel 0,5)", (a: At) => a.veriYok], ["P_öncü ≥ 0,6 (son 3 yarışın ≥2'sinde kalıcı ön grup)", (a: At) => !a.veriYok && a.p >= 0.6]] as [string, (a: At) => boolean][]) p(`| ${ad} | ${hep.filter(fn).length} | ${pct(hep.filter(fn).length / hep.length)}% |`);
p(`\nτ hesaplanabilen yarış: ${pop.filter((k) => k.tauVar).length}/${pop.length} (${pct(pop.filter((k) => k.tauVar).length / pop.length)}%).`);
p("");
p("## 2. Ek katkı (ölçü cihazı, tam saha)");
p("| Ölçüm | Log-loss | ΔLL (taban−ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |\n|---|---|---|---|---|---|");
for (const [ad] of MODELLER) { const d = taban.map((q, i) => q - ll[ad]![i]!); const [lo, hi] = boot(d); p(`| ${ad} | ${f(mean(ll[ad]!))} | ${f(mean(d))} [${f(lo)}; ${f(hi)}] | ${pct(mean(t1[ad]!))}% (${pct(mean(r1))}%) | ${pct(mean(t3[ad]!))}% (${pct(mean(r3))}%) | ${bt[ad]!.join(" ; ")} |`); }
p("");
p("**Ek katkılar (ΔLL farkı; pozitif = baskı eklenince iyileşme) ve Top1/Top3 farkları (puan):**");
const katki = (a: string, b: string, etiket: string) => p(`- **${etiket}** (${a.split(".")[0]} − ${b.split(".")[0]}): ΔLL ${farkCI(ll[b]!, ll[a]!)} · Top1 ${farkCI(t1[a]!, t1[b]!, 100, 2)} · Top3 ${farkCI(t3[a]!, t3[b]!, 100, 2)}`);
katki(AD.E1, AD.A, "Baskı → yalnız ACC_HIZ'a"); katki(AD.E2, AD.D1, "Baskı → ACC_HIZ + KOSU_STILI'na (KARAR KURALI)"); katki(AD.E3, AD.D2, "Baskı → ACC_HIZ + KOSU_STILI + ERKEN_HIZ'a"); katki(AD.D1, AD.A, "Referans: KOSU_STILI → yalnız ACC_HIZ'a");
p("");
p("## 3. Bilgi tekrarı (eski formülle karşılaştırma için de)");
const cift = (a: FK, b: FK) => { const x: number[] = [], y: number[] = [], xd: number[] = [], yd: number[] = []; for (const k of pop) { const idx = k.atlar.map((t, j) => (FEAT[a](t) != null && FEAT[b](t) != null ? j : -1)).filter((j) => j >= 0); if (idx.length < 4) continue; const ma = mean(idx.map((j) => FEAT[a](k.atlar[j]!)!)), mb = mean(idx.map((j) => FEAT[b](k.atlar[j]!)!)); for (const j of idx) { const va = FEAT[a](k.atlar[j]!)!, vb = FEAT[b](k.atlar[j]!)!; x.push(va); y.push(vb); xd.push(va - ma); yd.push(vb - mb); } } return `${f(corr(x, y), 2)} / ${f(corr(sirala(x), sirala(y)), 2)} / **${f(corr(xd, yd), 2)}** (n ${x.length})`; };
p("Pearson / Spearman / **yarış-içi Pearson**; iki değeri de olan atlar. (Eski σ-formülünde BASKI ↔ ERKEN_HIZ yarış-içi korelasyonu **−0,96** idi.)");
p("| Çift | Pearson / Spearman / yarış-içi |\n|---|---|"); for (const [a, b, ad] of [["baski", "erken", "YENİ BASKI ↔ ERKEN_HIZ"], ["baski", "acc", "YENİ BASKI ↔ ACC_HIZ"], ["baski", "stil", "YENİ BASKI ↔ KOSU_STILI"], ["baski", "p", "YENİ BASKI ↔ P_öncü (atın kendi öne gitme eğilimi)"], ["stil", "p", "KOSU_STILI ↔ P_öncü"]] as [FK, FK, string][]) p(`| ${ad} | ${cift(a, b)} |`);
p("");
p("## 4. Koşu tipine göre: YENİ BASKI ek katkısı (E2 − D1), Top1/Top3 farkı (puan)");
p("| Koşu tipi | Test yarışı | Top1 farkı [%95] | Top3 farkı [%95] |\n|---|---|---|---|");
for (const g of ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"]) { const ix = test.map((i, j) => (yk[i]!.k.tip === g ? j : -1)).filter((j) => j >= 0); if (ix.length < 5) continue; const d1 = ix.map((j) => t1[AD.E2]![j]! - t1[AD.D1]![j]!), d3 = ix.map((j) => t3[AD.E2]![j]! - t3[AD.D1]![j]!); const [a1, b1] = boot(d1), [a3, b3] = boot(d3); p(`| ${g} | ${ix.length}${ix.length < 30 ? " (AZ ÖRNEK)" : ""} | ${pct(mean(d1))} [${pct(a1)}; ${pct(b1)}] | ${pct(mean(d3))} [${pct(a3)}; ${pct(b3)}] |`); }
p("");
p("## Sınırlar");
p("- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. β'lar yalnız ölçü cihazıdır. Çoklu karşılaştırma düzeltilmedi; koşu tipi tabloları küçük örneklidir.");
p("- P_öncü n=3'e dayanan kaba bir eğilimdir; veri yoksa önsel 0,5 kullanılır (bölüm 1'de sayıldı). Bu, B'yi bilgisiz atlarda bulanıklaştırır. τ önceki aşamadaki medyan |ΔV| tanımıdır (\"önceden belirlenen ölçek\" ifadesini böyle yorumladım; farklı bir sabit isteniyorsa belirtilmeli).");
p("- Accurace kayıtlarının veritabanına giriş zamanı saklanmıyor; tarihler gerçek yarış tarihidir. Bu test seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.");
fs.writeFileSync("TEMPO_YENI_BASKI_TEST.md", L.join("\n"));
console.log(`YAZILDI TEMPO_YENI_BASKI_TEST.md | ${L.length} satır | yarış ${pop.length} | sızıntı ${farkli === 0 ? "YOK" : "VAR"}`);
await db.$disconnect(); process.exit(0);
