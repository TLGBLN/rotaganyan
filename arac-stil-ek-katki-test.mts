/**
 * KOSU_STILI EK KATKI TESTİ — (ACC_HIZ + GALOP_KAPASITE) modeline KOSU_STILI eklenince ek katkı, KRONOLOJİK (ileri-genişleyen bloklar). SALT-OKUMA. Sinyal/ağırlık/katsayı SEÇİLMEZ; motora hiçbir şey eklenmez.
 * Karar kuralı (kullanıcı): Kazananı Top1/Top3'e taşımıyor ve log-loss katkısı doğrulanmıyorsa KOSU_STILI ayrı sinyal olarak alınmaz.
 * Popülasyon: /admin/kosu-tipleri yarışları; her puan YALNIZ yarışın gününden ÖNCEKİ kayıtlarla (as-of); N = TJK gerçek koşan at sayısı. Ölçü cihazı = ileri-bloklu çok-parametreli yarış-içi softmax (β yalnız GEÇMİŞ bloklardan; işaret veriden); model önerisi değildir.
 * Çıktı: STIL_EK_KATKI_TESTI.md (gün/tarih kırılımı yok)
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";
import { TempoDeposu, tempoBilesenleri, tempoNormalize, type TempoHam, type TempoYuzey } from "./src/lib/methodology/yeni-motor/adaylar/tempo-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const TOL = 1e-9; const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 4) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null); const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
let tohum = 9191; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const sirala = (a: number[]) => { const idx = a.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length).fill(0); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++; const o = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]![1]] = o; i = j + 1; } return r; };
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? mean(a) : null; };
const L: string[] = []; const p = (s = "") => L.push(s);

// ───── Accurace → Acc + Tempo deposu
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

// ───── popülasyon
const ks = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { raceNo: true, distance: true, breed: true, surface: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, tjkAtId: true } } } });
const atIds = [...new Set(ks.flatMap((k) => k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null)))];
console.log("Galoplar okunuyor…");
const galopHam = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const galopTek = galopTekille(galopHam.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const gunSet = new Map<number, Set<number>>(); const gEkle = (id: number, t: number) => { const s = gunSet.get(id) ?? new Set<number>(); s.add(t); gunSet.set(id, s); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { in: atIds } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) gEkle(r.tjkAtId!, dayMs(r.race.raceDay.date));
for (let i = 0; i < atIds.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) for (const x of (c.rowsJson as { date?: string }[]) ?? []) { const m = String(x.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) gEkle(c.tjkAtId, Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)); }
const galopDep = new GalopDeposu(galopTek, new Map([...gunSet].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])));

// ───── puanlar (FAZ A; sonuç yüklenmeden)
type At = { no: number; kazandi: boolean; acc: number | null; kap: number | null; stil: number | null };
type Kosu = { tip: string; atlar: At[] };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" }; const pop: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t), gt = tempoDep.gorunum(t);
  for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue;
    const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
    pop.push({ tip: kabaG(normalizeClassType(k.classType)), atlar: k.runners.map((r, i) => ({ no: r.no, kazandi: win.has(r.no), kap: om([pH[i]!, pK[i]!, pE[i]!]), acc: r.tjkAtId == null ? null : accBilesenleri(ga, r.tjkAtId, yzm).accHiz, stil: r.tjkAtId == null ? null : tempoBilesenleri(gt, r.tjkAtId).stil })) }); } }
console.log(`${pop.length} yarış`);
// sızıntı denetimi (Tempo bileşenleri; 8 gün) — galop ve accurace modülleri önceki raporlarda ayrı ayrı denetlendi
const secilen = gunler.filter((_, i) => i % Math.ceil(gunler.length / 8) === 0).slice(0, 8); let denenen = 0, farkli = 0;
for (const t of secilen) { const g0 = tempoDep.gorunum(t), g1 = tempoDep.gelecegiBoz(t, 31 + (t / 86400000) % 991).gorunum(t); for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) for (const r of k.runners) { if (r.tjkAtId == null) continue; denenen++; if (JSON.stringify(tempoBilesenleri(g0, r.tjkAtId)) !== JSON.stringify(tempoBilesenleri(g1, r.tjkAtId))) farkli++; } }

// ───── ölçü cihazı
const FEAT = { acc: (a: At) => (a.acc == null ? null : a.acc / 100), kap: (a: At) => a.kap, stil: (a: At) => a.stil } as const; type FK = keyof typeof FEAT;
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
const AD = { A: "A. Yalnız ACC_HIZ", G: "B. Yalnız GALOP_KAPASITE", S: "C. Yalnız KOSU_STILI", AG: "D1. ACC_HIZ + GALOP_KAPASITE (taban model)", AGS: "D2. ACC_HIZ + GALOP_KAPASITE + KOSU_STILI", AS: "E. ACC_HIZ + KOSU_STILI (referans)" } as const;
const MODELLER: [string, FK[]][] = [[AD.A, ["acc"]], [AD.G, ["kap"]], [AD.S, ["stil"]], [AD.AG, ["acc", "kap"]], [AD.AGS, ["acc", "kap", "stil"]], [AD.AS, ["acc", "stil"]]];
const ll: Record<string, number[]> = {}, t1: Record<string, number[]> = {}, t3: Record<string, number[]> = {}, bt: Record<string, string[]> = {};
for (const [ad, cols] of MODELLER) { ll[ad] = []; t1[ad] = []; t3[ad] = []; bt[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, cols); bt[ad]!.push(b.map((q) => q.toFixed(2)).join("/"));
  for (let i = bas(bl); i < bas(bl + 1); i++) { const pr = olasilik(i, cols, b); const w = yk[i]!.w; ll[ad]!.push(-Math.log(Math.max(pr[w]!, 1e-12))); const better = pr.filter((q) => q > pr[w]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[w]!) <= 1e-12).length; t1[ad]!.push(Math.max(0, Math.min(1, (1 - better) / eq))); t3[ad]!.push(Math.max(0, Math.min(1, (3 - better) / eq))); } } }
const taban = test.map((i) => Math.log(yk[i]!.X.acc.length)); const r1 = test.map((i) => 1 / yk[i]!.X.acc.length), r3 = test.map((i) => Math.min(1, 3 / yk[i]!.X.acc.length));
const sub = (idx: number[], a: number[]) => idx.map((j) => a[j]!);
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };
const ek = (a: string, b: string, idx?: number[]) => { const I = idx ?? test.map((_, j) => j); return { ll: farkCI(sub(I, ll[b]!), sub(I, ll[a]!)), t1: farkCI(sub(I, t1[a]!), sub(I, t1[b]!), 100, 2), t3: farkCI(sub(I, t3[a]!), sub(I, t3[b]!), 100, 2), n: I.length }; };

// ───── RAPOR
const hep = pop.flatMap((k) => k.atlar); const toplamAt = hep.length;
p("# KOSU_STILI — (ACC_HIZ + GALOP_KAPASITE) modeline ek katkı (kronolojik)");
p("**Yeni motora sinyal eklenmedi; ağırlık/katsayı SEÇİLMEDİ; `SINYAL_KAYDI` boş.** Üç aday: ACC_HIZ (genel hız), GALOP_KAPASITE (idman), KOSU_STILI (yarış içi konumlanma; S, N = TJK gerçek saha, 200/400/600 m).");
p(`Popülasyon: /admin/kosu-tipleri — **${pop.length} yarış, ${toplamAt} at**; ileri-genişleyen 6 blok, **${test.length} test yarışı**. Her puan yarış gününden ÖNCEKİ kayıtlarla (as-of). KOSU_STILI bileşenleri için **gelecek-bozma testi** (${secilen.length} gün, ${denenen} at): **${farkli === 0 && denenen > 0 ? "GEÇTİ — birebir aynı, sızıntı yok" : "SIZINTI VAR (" + farkli + ")"}** (ACC_HIZ ve GALOP_KAPASITE modülleri önceki raporlarda ayrı ayrı denetlendi). Puanlar sonuç yüklenmeden önce hesaplandı.`);
p("");
p("## Okuma kılavuzu");
p("- **Karar kuralınız:** KOSU_STILI, **Top1/Top3'e taşımıyor VE log-loss katkısı doğrulanmıyorsa** ayrı sinyal olarak alınmaz. Asıl satır: **D2 − D1** (ACC_HIZ + GALOP_KAPASITE modeline KOSU_STILI eklenince).");
p("- Ölçü cihazı: β'lar YALNIZ blok 0..k−1'den; eksik puan yarış ortalamasına (nötr); yön varsayımı yok. ΔLL = taban(1/N) − ölçüm; **ek katkı** = (taban modelin log-loss'u − eklenmiş modelin log-loss'u), pozitif = KOSU_STILI eklenince iyileşme; Top1/Top3 farkları puan. Köşeli parantez = eşleştirilmiş bootstrap %95 (1000). Girdi ölçekleri: ACC_HIZ/100, GALOP_KAPASITE (0–1), KOSU_STILI (0–1).");
p("");
p("## 1. Kapsam");
p("| Ölçü | At | Oran |\n|---|---|---|"); for (const [ad, fn] of [["ACC_HIZ var", (a: At) => a.acc != null], ["GALOP_KAPASITE var", (a: At) => a.kap != null], ["KOSU_STILI var", (a: At) => a.stil != null], ["Üçü de var", (a: At) => a.acc != null && a.kap != null && a.stil != null], ["Hiçbiri yok", (a: At) => a.acc == null && a.kap == null && a.stil == null]] as [string, (a: At) => boolean][]) p(`| ${ad} | ${hep.filter(fn).length} | ${pct(hep.filter(fn).length / hep.length)}% |`);
p("");
p("## 2. Ayrı ayrı ve birlikte (ölçü cihazı, tam saha)");
p("| Ölçüm | Log-loss | ΔLL (taban−ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |\n|---|---|---|---|---|---|");
for (const [ad] of MODELLER) { const d = taban.map((q, i) => q - ll[ad]![i]!); const [lo, hi] = boot(d); p(`| ${ad} | ${f(mean(ll[ad]!))} | ${f(mean(d))} [${f(lo)}; ${f(hi)}] | ${pct(mean(t1[ad]!))}% (${pct(mean(r1))}%) | ${pct(mean(t3[ad]!))}% (${pct(mean(r3))}%) | ${bt[ad]!.join(" ; ")} |`); }
p("");
const e1 = ek(AD.AGS, AD.AG), e2 = ek(AD.AS, AD.A), e3 = ek(AD.AGS, AD.AS);
p("## 3. KOSU_STILI'nın ek katkısı");
p("| Karşılaştırma | Yarış | ΔLL ek katkı [%95] | Top1 farkı (puan) [%95] | Top3 farkı (puan) [%95] |\n|---|---|---|---|---|");
p(`| **KOSU_STILI → ACC_HIZ + GALOP_KAPASITE (D2 − D1) — KARAR SATIRI** | ${e1.n} | **${e1.ll}** | **${e1.t1}** | **${e1.t3}** |`);
p(`| KOSU_STILI → yalnız ACC_HIZ (E − A; önceki test) | ${e2.n} | ${e2.ll} | ${e2.t1} | ${e2.t3} |`);
p(`| GALOP_KAPASITE → ACC_HIZ + KOSU_STILI (D2 − E) | ${e3.n} | ${e3.ll} | ${e3.t1} | ${e3.t3} |`);
p("");
// sağlamlık: veri-zengin yarışlar
const zengin = test.map((i, j) => { const at = yk[i]!.k.atlar; const tam = at.filter((a) => a.acc != null && a.kap != null && a.stil != null).length / at.length; return tam >= 0.7 ? j : -1; }).filter((j) => j >= 0);
const zz = ek(AD.AGS, AD.AG, zengin);
p("## 4. Sağlamlık: saha atlarının ≥%70'inde üç puan da olan yarışlar");
p(`Eksik veri nötr doldurulduğu için, üç puanı da yaygın olan yarışlara ayrıca bakıldı (${zengin.length} test yarışı). **D2 − D1:** ΔLL ${zz.ll} · Top1 ${zz.t1} · Top3 ${zz.t3}.`);
p("");
p("## 5. Koşu tipine göre (D2 − D1)");
p("| Koşu tipi | Test yarışı | ΔLL ek katkı [%95] | Top1 farkı (puan) [%95] | Top3 farkı (puan) [%95] |\n|---|---|---|---|---|");
for (const g of ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"]) { const ix = test.map((i, j) => (yk[i]!.k.tip === g ? j : -1)).filter((j) => j >= 0); if (ix.length < 5) continue; const e = ek(AD.AGS, AD.AG, ix); p(`| ${g} | ${ix.length}${ix.length < 30 ? " (AZ ÖRNEK)" : ""} | ${e.ll} | ${e.t1} | ${e.t3} |`); }
p("");
p("## 6. Bilgi tekrarı (aynı yarışta ortalamadan sapma ile; iki puanı da olan atlar)");
const cift = (a: FK, b: FK) => { const x: number[] = [], y: number[] = [], xd: number[] = [], yd: number[] = []; for (const k of pop) { const idx = k.atlar.map((t, j) => (FEAT[a](t) != null && FEAT[b](t) != null ? j : -1)).filter((j) => j >= 0); if (idx.length < 4) continue; const ma = mean(idx.map((j) => FEAT[a](k.atlar[j]!)!)), mb = mean(idx.map((j) => FEAT[b](k.atlar[j]!)!)); for (const j of idx) { const va = FEAT[a](k.atlar[j]!)!, vb = FEAT[b](k.atlar[j]!)!; x.push(va); y.push(vb); xd.push(va - ma); yd.push(vb - mb); } } return `${f(corr(x, y), 2)} / ${f(corr(sirala(x), sirala(y)), 2)} / **${f(corr(xd, yd), 2)}** (n ${x.length})`; };
p("| Çift | Pearson / Spearman / yarış-içi |\n|---|---|"); for (const [a, b, ad] of [["stil", "acc", "KOSU_STILI ↔ ACC_HIZ"], ["stil", "kap", "KOSU_STILI ↔ GALOP_KAPASITE"], ["acc", "kap", "ACC_HIZ ↔ GALOP_KAPASITE"]] as [FK, FK, string][]) p(`| ${ad} | ${cift(a, b)} |`);
p("");
p("## Sınırlar");
p("- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya mevcut motorun diğer sinyalleriyle kıyas değildir. β'lar yalnız ölçü cihazıdır. Çoklu karşılaştırma düzeltilmedi; koşu tipi tabloları küçük örneklidir. Eksik puan yarış ortalamasıyla nötrdür.");
p("- KOSU_STILI atın SON 3 yarışındaki S ortalamasıdır (veri yoksa bilinmiyor). Accurace/galop kaydının veritabanına giriş zamanı saklanmıyor; tarihler gerçek (yarış öncesi) tarihlerdir. Bu test seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.");
fs.writeFileSync("STIL_EK_KATKI_TESTI.md", L.join("\n"));
console.log(`YAZILDI STIL_EK_KATKI_TESTI.md | ${L.length} satır | yarış ${pop.length} | sızıntı ${farkli === 0 ? "YOK" : "VAR"}`);
await db.$disconnect(); process.exit(0);
