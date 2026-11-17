/**
 * ACC_HIZ + GALOP_KAPASITE — AYNI YARIŞLARDA: (1) yalnız GALOP_KAPASITE, (2) yalnız ACC_HIZ, (3) ikisi birlikte. SALT-OKUMA. Sinyal/ağırlık/katsayı SEÇİLMEZ; motora hiçbir şey eklenmez.
 * Popülasyon: /admin/kosu-tipleri yarışları (güncel motor dönemi, yayınlanmış tahminli, sonuçlu, koşullu/Karma kopyaları hariç). Her puan YALNIZ yarışın gününden ÖNCEKİ kayıtlarla (as-of).
 * "Birlikte" için (a) eşit ağırlıklı yarış-içi yüzdelik ortalaması — yalnız bir ÖRNEK, seçilmiş ağırlık DEĞİL; (b) ileri-bloklu 2-parametreli ölçü cihazı (β yalnız GEÇMİŞ bloklardan; model önerisi değil).
 * Çıktı: GALOP_ACCURACE_BIRLIKTE_TEST.md (gün/tarih kırılımı yok)
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";

const TOL = 1e-9; const MINN = 30;
const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 2) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null);
const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
let tohum = 8080; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const ci = (d: number[], carp = 100, dec = 1) => (d.length < 5 ? "[—]" : (() => { const [lo, hi] = boot(d); return `[${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; })());
const L: string[] = []; const p = (s = "") => L.push(s);
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const sirala = (a: number[]) => { const idx = a.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length).fill(0); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++; const o = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]![1]] = o; i = j + 1; } return r; };
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? mean(a) : null; };

// ───── Accurace deposu
console.log("Accurace okunuyor…");
const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" }; const accHam: AccHam[] = [];
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) accHam.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
const accDep = new AccDeposu(accHam.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; }));

// ───── popülasyon
const ks = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { raceNo: true, distance: true, breed: true, surface: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, tjkAtId: true } } } });
const atIds = [...new Set(ks.flatMap((k) => k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null)))];
// ───── galop deposu
console.log("Galoplar okunuyor…");
const galopHam = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const galopTek = galopTekille(galopHam.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const gunSet = new Map<number, Set<number>>(); const gEkle = (id: number, t: number) => { const s = gunSet.get(id) ?? new Set<number>(); s.add(t); gunSet.set(id, s); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { in: atIds } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) gEkle(r.tjkAtId!, dayMs(r.race.raceDay.date));
for (let i = 0; i < atIds.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) for (const x of (c.rowsJson as { date?: string }[]) ?? []) { const m = String(x.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) gEkle(c.tjkAtId, Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)); }
const galopDep = new GalopDeposu(galopTek, new Map([...gunSet].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])));

// ───── puanlar (FAZ A; sonuç yüklenmeden)
type At = { no: number; kap: number | null; acc: number | null; kazandi: boolean };
type Kosu = { tip: string; irk: string; atlar: At[] };
const pop: Kosu[] = []; const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t);
  for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue;
    const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
    pop.push({ tip: kabaG(normalizeClassType(k.classType)), irk: k.breed === "INGILIZ" ? "İngiliz" : "Arap", atlar: k.runners.map((r, i) => ({ no: r.no, kap: om([pH[i]!, pK[i]!, pE[i]!]), acc: r.tjkAtId == null ? null : accBilesenleri(ga, r.tjkAtId, yzm).accHiz, kazandi: win.has(r.no) })) }); } }
console.log(`${pop.length} yarış`);

// ───── yardımcılar
const wOf = (k: Kosu) => k.atlar.findIndex((a) => a.kazandi);
const kredi = (x: (number | null)[], wj: number, m: number, tam: boolean) => { const a = nn(x); const mu = a.length >= 2 ? mean(a) : 0; const v = tam ? x.map((q) => (a.length >= 2 ? (q ?? mu) : 0)) : a; const xw = tam ? v[wj]! : x[wj]!; const better = v.filter((q) => q > xw + TOL).length, eq = v.filter((q) => Math.abs(q - xw) <= TOL).length; return Math.max(0, Math.min(1, (m - better) / eq)); };
// ortak küme: yalnız İKİ puanı da olan atlar sıralanır (aynı atlar, aynı yarışlar); yüzdelik bu kümede
type Olc = { ad: string; x: (k: Kosu) => (number | null)[] };
const ortakX = (k: Kosu) => { const var2 = k.atlar.map((a) => a.kap != null && a.acc != null); const K = k.atlar.map((a, i) => (var2[i] ? a.kap : null)), A = k.atlar.map((a, i) => (var2[i] ? a.acc : null)); const pK = yz(K), pA = yz(A); return { var2, K, A, pK, pA, bir: pK.map((v, i) => (v == null || pA[i] == null ? null : (v + pA[i]!) / 2)) }; };
const OLCUM: Olc[] = [{ ad: "Yalnız GALOP_KAPASITE", x: (k) => ortakX(k).K }, { ad: "Yalnız ACC_HIZ", x: (k) => ortakX(k).A }, { ad: "İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil)", x: (k) => ortakX(k).bir }];
function ortakTablo(uygun: (k: Kosu) => boolean) {
  const satir: string[] = []; const diz: Record<string, { c1: number[]; c3: number[]; r1: number[]; r3: number[] }> = {}; let n = 0;
  for (const o of OLCUM) diz[o.ad] = { c1: [], c3: [], r1: [], r3: [] };
  for (const k of pop) { if (!uygun(k)) continue; const wj = wOf(k); if (wj < 0) continue; const xs = OLCUM.map((o) => o.x(k)); const v = nn(xs[0]!); if (xs[0]![wj] == null || v.length < 4) continue; n++;
    OLCUM.forEach((o, i) => { diz[o.ad]!.c1.push(kredi(xs[i]!, wj, 1, false)); diz[o.ad]!.c3.push(kredi(xs[i]!, wj, 3, false)); diz[o.ad]!.r1.push(1 / v.length); diz[o.ad]!.r3.push(Math.min(1, 3 / v.length)); }); }
  for (const o of OLCUM) { const d = diz[o.ad]!; const d1 = d.c1.map((c, i) => c - d.r1[i]!), d3 = d.c3.map((c, i) => c - d.r3[i]!); satir.push(`| ${o.ad} | ${n} | ${pct(mean(d.c1))}% (rast. ${pct(mean(d.r1))}%) · fark ${pct(mean(d1))} puan ${ci(d1)} | ${pct(mean(d.c3))}% (rast. ${pct(mean(d.r3))}%) · fark ${pct(mean(d3))} puan ${ci(d3)} |`); }
  const k0 = diz[OLCUM[0]!.ad]!, k1 = diz[OLCUM[1]!.ad]!, k2 = diz[OLCUM[2]!.ad]!; const kar = (a: number[], b: number[]) => a.map((x, i) => x - b[i]!);
  return { n, satir, ek: n ? { accMinusGalop1: kar(k1.c1, k0.c1), accMinusGalop3: kar(k1.c3, k0.c3), birlikMinusEnIyi1: kar(k2.c1, k1.c1.map((x, i) => Math.max(x, k0.c1[i]!))), birMinusAcc1: kar(k2.c1, k1.c1), birMinusAcc3: kar(k2.c3, k1.c3), birMinusGalop1: kar(k2.c1, k0.c1), birMinusGalop3: kar(k2.c3, k0.c3) } : null };
}
const BAS = "| Ölçüm | Yarış | Top1 | Top3 |\n|---|---|---|---|";

// ───── RAPOR
const toplamAt = pop.reduce((s, k) => s + k.atlar.length, 0);
p("# ACC_HIZ + GALOP_KAPASITE — aynı yarışlarda karşılaştırma (yalnız GALOP · yalnız ACC_HIZ · birlikte)");
p(`**Yeni motora sinyal eklenmedi; ağırlık/katsayı SEÇİLMEDİ; \`SINYAL_KAYDI\` boş.** ACC_BITIRIS bu testin dışında (karar: mevcut tanımıyla gereksiz görünüyor). Popülasyon: /admin/kosu-tipleri yarışları — **${pop.length} yarış, ${toplamAt} at** (güncel motor dönemi, yayınlanmış tahminli, sonuçlu; Karma/koşullu kopyalar hariç). Gün/tarih kırılımı verilmedi.`);
p(`Her puan yalnız yarış gününden ÖNCEKİ kayıtlarla (as-of): GALOP_KAPASITE atın son koşusundan sonraki galoplarından, ACC_HIZ atın geçmiş (aynı zemin) Accurace yarışlarından; ikisinin referansları da yarış gününden öncesiyle kurulu. Her iki modül ayrı ayrı gelecek-bozma testinden geçmiştir (galop: ${gunler.length > 0 ? "önceki raporlar" : ""}; accurace: önceki raporlar). Puanlar sonuç yüklenmeden önce hesaplandı.`);
p("");
p("## Okuma kılavuzu");
p("- **Ortak küme:** karşılaştırma adil olsun diye yalnız **iki puanı da olan atlar** sıralanır ve yalnız kazananın da iki puanı olduğu, ≥4 ortak atlı yarışlar sayılır; üç ölçüm de BİREBİR aynı yarış ve aynı atlar üzerinde. Rastgele = 1/n, 3/n. Eşit puanda isabet payı bölünür. **fark** = ölçüm − rastgele (puan); köşeli parantez = eşleştirilmiş bootstrap %95 (1000).");
p("- **\"Birlikte\" (a):** iki puanın ortak kümedeki yarış-içi yüzdeliklerinin eşit ağırlıklı ortalaması. **Bu bir ağırlık seçimi değildir**; yalnız \"ikisini aynı terazide tartarsak\" örneğidir.");
p("");
// 1. kapsam
const hepsi = pop.flatMap((k) => k.atlar);
p("## 1. Kapsam");
p("| Ölçü | At | Oran |\n|---|---|---|");
for (const [ad, fn] of [["GALOP_KAPASITE var", (a: At) => a.kap != null], ["ACC_HIZ var", (a: At) => a.acc != null], ["İkisi de var (ortak küme)", (a: At) => a.kap != null && a.acc != null], ["Yalnız GALOP var", (a: At) => a.kap != null && a.acc == null], ["Yalnız ACC_HIZ var", (a: At) => a.kap == null && a.acc != null], ["İkisi de yok", (a: At) => a.kap == null && a.acc == null]] as [string, (a: At) => boolean][]) p(`| ${ad} | ${hepsi.filter(fn).length} | ${pct(hepsi.filter(fn).length / hepsi.length)}% |`);
p("");
// 2. ortak küme
p("## 2. Aynı yarışlar, aynı atlar (ortak küme): Top1 / Top3");
const gen = ortakTablo(() => true); p(BAS); for (const s of gen.satir) p(s);
p("");
if (gen.ek) { const e = gen.ek; p("**Eşleştirilmiş farklar** (aynı yarışlarda; puan; köşeli parantez bootstrap %95):");
  p(`- ACC_HIZ − GALOP_KAPASITE: Top1 ${pct(mean(e.accMinusGalop1))} ${ci(e.accMinusGalop1)} · Top3 ${pct(mean(e.accMinusGalop3))} ${ci(e.accMinusGalop3)}`);
  p(`- Birlikte − yalnız ACC_HIZ: Top1 ${pct(mean(e.birMinusAcc1))} ${ci(e.birMinusAcc1)} · Top3 ${pct(mean(e.birMinusAcc3))} ${ci(e.birMinusAcc3)}`);
  p(`- Birlikte − yalnız GALOP_KAPASITE: Top1 ${pct(mean(e.birMinusGalop1))} ${ci(e.birMinusGalop1)} · Top3 ${pct(mean(e.birMinusGalop3))} ${ci(e.birMinusGalop3)}`); }
p("");
// 3. koşu tipi
p("## 3. Koşu tipine göre (ortak küme)");
for (const g of ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"]) { const t = ortakTablo((k) => k.tip === g); if (t.n < 1) continue; p(`**${g}** (${t.n} yarış${t.n < MINN ? " — AZ ÖRNEK" : ""})`); p(BAS); for (const s of t.satir) p(s); p(""); }
p("## 4. Irka göre (ortak küme)");
for (const g of ["İngiliz", "Arap"]) { const t = ortakTablo((k) => k.irk === g); p(`**${g}** (${t.n} yarış)`); p(BAS); for (const s of t.satir) p(s); p(""); }

// 5. uyuşmazlık analizi
p("## 5. İki puan aynı atı mı gösteriyor? (ortak küme, en yüksek puanın tek at olduğu yarışlar)");
let ayni = 0, ayniKaz = 0, farkli = 0, gKaz = 0, aKaz = 0, hic = 0;
for (const k of pop) { const o = ortakX(k); const wj = wOf(k); if (wj < 0 || o.var2.filter(Boolean).length < 4 || !o.var2[wj]) continue; const tepe = (x: (number | null)[]) => { const v = nn(x); const mx = Math.max(...v); const idx = x.map((q, i) => (q != null && Math.abs(q - mx) <= TOL ? i : -1)).filter((i) => i >= 0); return idx.length === 1 ? idx[0]! : -1; }; const g = tepe(o.K), a = tepe(o.A); if (g < 0 || a < 0) continue;
  if (g === a) { ayni++; if (g === wj) ayniKaz++; } else { farkli++; if (g === wj) gKaz++; else if (a === wj) aKaz++; else hic++; } }
p(`- İkisi **aynı atı** 1. sıraya koyduğunda (${ayni} yarış): bu atın kazanma oranı **%${pct(ayniKaz / Math.max(1, ayni))}**.`);
p(`- **Farklı atları** koyduğunda (${farkli} yarış): GALOP'un seçtiği kazandı **%${pct(gKaz / Math.max(1, farkli))}**, ACC_HIZ'ın seçtiği kazandı **%${pct(aKaz / Math.max(1, farkli))}**, ikisi de kazanamadı %${pct(hic / Math.max(1, farkli))}.`);
p(`- Uyuşma oranı (tepe at aynı): %${pct(ayni / Math.max(1, ayni + farkli))}.`);
p("");

// 6. artımlı ölçü cihazı (tam saha, ileri-bloklu)
p("## 6. Artımlı bilgi: ileri-bloklu 2-parametreli ölçü cihazı (tam saha)");
p("Yarışlar tarihe göre 6 bloğa bölünür; blok k için β'lar YALNIZ blok 0..k−1'den öğrenilir (ridge 0.02); eksik puan yarışın puanlı atlarının ortalamasına (nötr) eşitlenir; yarışta <2 puanlı at varsa o puan o yarışta bilgisizdir. Bu bir model değil, **iki puanın birbirine yeni bilgi ekleyip eklemediğini** ölçen cihazdır. Taban 1/N.");
type YK = { w: number[]; X: number[][] }; const yk: YK[] = pop.map((k) => ({ w: [wOf(k)], X: [k.atlar.map((a) => a.kap), k.atlar.map((a) => (a.acc == null ? null : a.acc / 100))].map((col) => { const a = nn(col); if (a.length < 2) return col.map(() => 0); const mu = mean(a); return col.map((q) => (q == null ? mu : q)); }) })).filter((k) => k.w[0]! >= 0);
const BLOK = 6; const bas = (b: number) => Math.floor(yk.length * b / BLOK); const test: number[] = []; for (let i = bas(1); i < yk.length; i++) test.push(i);
function fit(idx: number[], kolon: number[]) { const K = kolon.length; let b = new Array(K).fill(0);
  for (let it = 0; it < 25; it++) { const g = new Array(K).fill(0); const H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const i of idx) { const X = kolon.map((c) => yk[i]!.X[c]!); const N = X[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk: number, k: number) => bk * X[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); const pr = e.map((q) => q / z);
      const ex = X.map((col) => sum(col.map((v, r) => pr[r]! * v))); const exx = Array.from({ length: K }, (_, a) => Array.from({ length: K }, (_, c) => sum(X[a]!.map((v, r) => pr[r]! * v * X[c]![r]!)))); const w = yk[i]!.w[0]!;
      for (let a = 0; a < K; a++) g[a] += X[a]![w]! - ex[a]!; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) H[a]![c] += exx[a]![c]! - ex[a]! * ex[c]!; }
    for (let a = 0; a < K; a++) { g[a] -= 0.02 * b[a]; H[a]![a] += 0.02; } let d: number[]; if (K === 1) d = [g[0]! / H[0]![0]!]; else { const det = H[0]![0]! * H[1]![1]! - H[0]![1]! * H[1]![0]!; d = [(H[1]![1]! * g[0]! - H[0]![1]! * g[1]!) / det, (-H[1]![0]! * g[0]! + H[0]![0]! * g[1]!) / det]; }
    b = b.map((q: number, k: number) => q + Math.max(-3, Math.min(3, d[k]!))); if (Math.max(...d.map(Math.abs)) < 1e-7) break; } return b as number[]; }
const llRace = (i: number, kolon: number[], b: number[]) => { const X = kolon.map((c) => yk[i]!.X[c]!); const N = X[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk, k) => bk * X[k]![r]!))); const mx = Math.max(...s); const z = Math.log(sum(s.map((q) => Math.exp(q - mx)))) + mx; return -(s[yk[i]!.w[0]!]! - z); };
const MOD: [string, number[]][] = [["Yalnız GALOP_KAPASITE", [0]], ["Yalnız ACC_HIZ", [1]], ["İkisi birlikte (2 parametre)", [0, 1]]]; const ll: Record<string, number[]> = {}, bt: Record<string, string[]> = {}; const taban = test.map((i) => Math.log(yk[i]!.X[0]!.length));
for (const [ad, kol] of MOD) { const arr: number[] = []; bt[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, kol); bt[ad]!.push(b.map((q) => f(q, 2)).join(" / ")); for (let i = bas(bl); i < bas(bl + 1); i++) arr.push(llRace(i, kol, b)); } ll[ad] = arr; }
p(`${test.length} test yarışı.`); p("| Ölçüm | Log-loss | Δ (taban − ölçüm) [%95] | β (blok 1…5) [GALOP / ACC] |\n|---|---|---|---|");
for (const [ad] of MOD) { const d = taban.map((q, i) => q - ll[ad]![i]!); const [lo, hi] = boot(d); p(`| ${ad} | ${f(mean(ll[ad]!), 4)} | ${f(mean(d), 4)} [${f(lo, 4)}; ${f(hi, 4)}] | ${bt[ad]!.join(" ; ")} |`); }
const dG = ll["Yalnız GALOP_KAPASITE"]!.map((q, i) => q - ll["İkisi birlikte (2 parametre)"]![i]!), dA = ll["Yalnız ACC_HIZ"]!.map((q, i) => q - ll["İkisi birlikte (2 parametre)"]![i]!); const [gLo, gHi] = boot(dG), [aLo, aHi] = boot(dA);
p("");
p(`- **ACC_HIZ'ın GALOP_KAPASITE'ye eklediği bilgi:** ΔLL (yalnız GALOP − birlikte) = **${f(mean(dG), 4)}** [${f(gLo, 4)}; ${f(gHi, 4)}] (pozitif = ACC_HIZ eklenince iyileşme).`);
p(`- **GALOP_KAPASITE'nin ACC_HIZ'a eklediği bilgi:** ΔLL (yalnız ACC_HIZ − birlikte) = **${f(mean(dA), 4)}** [${f(aLo, 4)}; ${f(aHi, 4)}].`);
// korelasyon
const xs: number[] = [], ys: number[] = [], xd: number[] = [], yd: number[] = [];
for (const k of pop) { const idx = k.atlar.map((a, j) => (a.kap != null && a.acc != null ? j : -1)).filter((j) => j >= 0); if (idx.length < 4) continue; const mk = mean(idx.map((j) => k.atlar[j]!.kap!)), ma = mean(idx.map((j) => k.atlar[j]!.acc!)); for (const j of idx) { xs.push(k.atlar[j]!.kap!); ys.push(k.atlar[j]!.acc!); xd.push(k.atlar[j]!.kap! - mk); yd.push(k.atlar[j]!.acc! - ma); } }
p(`- **Korelasyon** (iki puanı da olan atlar, ${xs.length} at-yarış): Pearson ${f(corr(xs, ys))}, Spearman ${f(corr(sirala(xs), sirala(ys)))}; **yarış-içi** (aynı yarışta ortalamadan sapma) Pearson **${f(corr(xd, yd))}**.`);
p("");
p("## Sınırlar");
p("- Taban 1/N (sinyalsiz) ve zayıf; sonuçlar piyasa/AGF veya mevcut motorun diğer sinyalleriyle karşılaştırma değildir. \"Birlikte\" eşit ağırlıklı örnek ve ileri-bloklu cihazdır; ağırlık kararı sizindir.");
p("- Galop verisi yalnız son koşudan sonrası; Accurace atın geçmiş aynı-zemin yarışlarının son 3'ü. İkisinin kapsamları farklıdır (bölüm 1); ortak küme her iki puanı olan atlarla sınırlıdır, bu yüzden genel popülasyona genellenmesi sınırlıdır.");
p("- Accurace ve galop kaydının veritabanına ne zaman girdiği saklanmıyor; tarihler gerçek (yarış-öncesi) tarihlerdir, görünürlük kanıtlanamaz. Gruplar bağımsız değil; çoklu karşılaştırma düzeltilmedi.");
p("- Bu test seçim yapmaz; hiçbir formül, ağırlık veya sinyal değiştirilmedi.");
fs.writeFileSync("GALOP_ACCURACE_BIRLIKTE_TEST.md", L.join("\n"));
console.log(`YAZILDI GALOP_ACCURACE_BIRLIKTE_TEST.md | ${L.length} satır | yarış ${pop.length}`);
await db.$disconnect(); process.exit(0);
