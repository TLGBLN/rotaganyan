/**
 * J_SEVIYE DOĞRULAMASI — atın SINIFI, HANDİKAP PUANI ve GEÇMİŞ PERFORMANSI kontrol edilince (ACC_HIZ + GALOP_KAPASITE + J_SEVIYE) J_SEVIYE katkısı sürüyor mu? KRONOLOJİK test. SALT-OKUMA.
 * Sinyal/ağırlık/katsayı SEÇİLMEZ; motora hiçbir şey eklenmez. Kontroller SİNYAL ADAYI DEĞİLDİR: yalnız "J_SEVIYE yanlışlıkla at kalitesini ikinci kez mi puanlıyor" sorusu için KONTROL DEĞİŞKENİdir.
 * İKİ örneklem: A = /admin/kosu-tipleri 1510 yarış (model kararlarında TEKRAR kullanıldı → BAĞIMSIZ NİHAİ DOĞRULAMA DEĞİL); B = 01.07–15.08.2026 (yeni-motor adaylarının seçiminde hiç kullanılmamış dönem; galop kaydı yalnız Temmuz'dan itibaren var).
 * Çıktı: JOKEY_SEVIYE_DOGRULAMA.md
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";
import { JokeyDeposu, jokeyBilesenleri, type BinisKaydi } from "./src/lib/methodology/yeni-motor/adaylar/jokey-aday";

const TOL = 1e-9; const GUN = 86400000; const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 4) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null); const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const SINIF_RANK: Record<string, number> = { Maiden: 1, "Şartlı": 2, "Satış": 2, Handikap: 3, KV: 3, Grup: 4 }; // BİLDİRİLEN kontrol ölçeği (sinyal değil)
const jn = (j: string | null) => (j ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");
const trTarih = (s: unknown): number | null => { const t = String(s ?? ""); let m = t.match(/^(\d{2})\.(\d{2})\.(\d{4})/); if (m) return Date.UTC(+m[3]!, +m[2]! - 1, +m[1]!); m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!) : null; };
let tohum = 1357; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? mean(a) : null; };
const L: string[] = []; const p = (s = "") => L.push(s);

// ───── yarış listeleri
const sec = { id: true, raceNo: true, surface: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" as const }, select: { no: true, tjkAtId: true, jockey: true, hp: true } } };
const ksA = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const ksB = await db.race.findMany({ where: { conditions: null, result: { isNot: null }, raceDay: { date: { gte: new Date("2026-07-01T00:00:00.000Z"), lt: new Date("2026-08-16T00:00:00.000Z") }, hippodrome: { name: { not: "Karma" } } } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: sec });
const atIds = [...new Set([...ksA, ...ksB].flatMap((k) => k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null)))];
console.log(`A ${ksA.length} yarış, B ${ksB.length} yarış, ${atIds.length} at`);

// ───── Accurace, geçmiş önbelleği (GG.AA.YYYY AYRIŞTIRILIR), galop
console.log("Accurace okunuyor…"); const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" }; const accHam: AccHam[] = [];
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) accHam.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
const accDep = new AccDeposu(accHam.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; }));
type Gec = { t: number; fp: number | null; sinif: number | null }; const gecmis = new Map<number, Gec[]>(); const gunSet = new Map<number, Set<number>>(); const gunSetSadeceKendi = new Map<number, Set<number>>();
const gEkle = (m: Map<number, Set<number>>, id: number, t: number) => { const s = m.get(id) ?? new Set<number>(); s.add(t); m.set(id, s); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { in: atIds } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) { const t = dayMs(r.race.raceDay.date); gEkle(gunSet, r.tjkAtId!, t); gEkle(gunSetSadeceKendi, r.tjkAtId!, t); }
for (let i = 0; i < atIds.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) { const liste: Gec[] = []; for (const x of (c.rowsJson as Record<string, unknown>[]) ?? []) { const t = trTarih(x.date); if (t == null) continue; gEkle(gunSet, c.tjkAtId, t); const fp = parseInt(String(x.finishPos ?? ""), 10); liste.push({ t, fp: Number.isFinite(fp) && fp > 0 ? fp : null, sinif: SINIF_RANK[kabaG(normalizeClassType(String(x.classType ?? "")))] ?? null }); } gecmis.set(c.tjkAtId, liste.sort((a, b) => a.t - b.t)); }
console.log("Galoplar okunuyor…");
const galopHam = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const galopTek = galopTekille(galopHam.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const galopDep = new GalopDeposu(galopTek, new Map([...gunSet].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])));
// denetim: önceki koşu tarihi, geçmiş önbelleği eklenince (GG.AA.YYYY düzeltmesi) kaç at-yarışta DEĞİŞİYOR?
let oncekiFark = 0, oncekiToplam = 0; for (const k of ksA) { const t = dayMs(k.raceDay.date); for (const r of k.runners) { if (r.tjkAtId == null) continue; oncekiToplam++; const mx = (s?: Set<number>) => { let b: number | null = null; for (const x of s ?? []) if (x < t && (b == null || x > b)) b = x; return b; }; if (mx(gunSet.get(r.tjkAtId)) !== mx(gunSetSadeceKendi.get(r.tjkAtId))) oncekiFark++; } }

// ───── özellikler
type At = { no: number; jokey: string; kazandi: boolean; acc: number | null; kap: number | null; hp: number | null; win: number | null; top3: number | null; sinif: number | null; S: number | null; S30: number | null };
type Kosu = { t: number; tip: string; atlar: At[] };
const jDeposu = (() => 0)(); void jDeposu;
const binRows = await db.runner.findMany({ where: { scratched: false, race: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } } }, select: { no: true, jockey: true, race: { select: { id: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } } });
const jDep = new JokeyDeposu(binRows.filter((r) => jn(r.jockey)).map((r): BinisKaydi => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), jokey: jn(r.jockey), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, pBaz: null })));
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" };
function hesapla(ks: typeof ksA): Kosu[] {
  const out: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
  for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t), gj = jDep.gorunum(t);
    for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue; const tip = kabaG(normalizeClassType(k.classType)); const bugunRank = SINIF_RANK[tip] ?? null;
      const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
      out.push({ t, tip, atlar: k.runners.map((r, i) => { const onceki = (r.tjkAtId == null ? [] : gecmis.get(r.tjkAtId) ?? []).filter((x) => x.t < t); const son10 = onceki.filter((x) => x.fp != null).slice(-10); const son3 = onceki.filter((x) => x.sinif != null).slice(-3);
        const jb = r.jockey ? jokeyBilesenleri(gj, jn(r.jockey)) : null;
        return { no: r.no, jokey: jn(r.jockey), kazandi: win.has(r.no), kap: om([pH[i]!, pK[i]!, pE[i]!]), acc: r.tjkAtId == null ? null : accBilesenleri(ga, r.tjkAtId, yzm).accHiz, hp: r.hp, win: son10.length ? (1 + son10.filter((x) => x.fp === 1).length) / (2 + son10.length) : null, top3: son10.length ? (1 + son10.filter((x) => x.fp! <= 3).length) / (2 + son10.length) : null, sinif: bugunRank != null && son3.length ? bugunRank - mean(son3.map((x) => x.sinif!)) : null, S: jb?.seviye.pRef ?? null, S30: jb && jb.seviye.nRef >= 30 ? jb.seviye.pRef : null }; }) }); } }
  return out;
}
console.log("Örneklem A hesaplanıyor…"); const A = hesapla(ksA); console.log("Örneklem B hesaplanıyor…"); const B = hesapla(ksB);

// ───── ölçü cihazı
type Kol = "acc" | "kap" | "hp" | "win" | "top3" | "sinif" | "S" | "S30";
const doldur = (v: (number | null)[]) => { const a = nn(v); if (a.length < 2) return v.map(() => 0); const mu = mean(a); return v.map((q) => (q == null ? mu : q)); };
const colX = (k: Kosu, c: Kol) => doldur(k.atlar.map((a) => { const v = c === "acc" ? (a.acc == null ? null : a.acc / 100) : c === "kap" ? a.kap : c === "hp" ? (a.hp == null ? null : a.hp / 20) : c === "win" ? a.win : c === "top3" ? a.top3 : c === "sinif" ? (a.sinif == null ? null : a.sinif / 2) : c === "S" ? (a.S == null ? null : a.S / 0.1) : a.S30 == null ? null : a.S30 / 0.1; return v; }));
function coz(H: number[][], g: number[]) { const K = g.length; const M = H.map((r, i) => [...r, g[i]!]); for (let c = 0; c < K; c++) { let m = c; for (let r = c + 1; r < K; r++) if (Math.abs(M[r]![c]!) > Math.abs(M[m]![c]!)) m = r; [M[c], M[m]] = [M[m]!, M[c]!]; const d = M[c]![c]!; for (let j = c; j <= K; j++) M[c]![j]! /= d; for (let r = 0; r < K; r++) if (r !== c) { const fct = M[r]![c]!; for (let j = c; j <= K; j++) M[r]![j]! -= fct * M[c]![j]!; } } return M.map((r) => r[K]!); }
const AD = { M0: "M0. ACC_HIZ + GALOP_KAPASITE (taban)", MC: "MC. M0 + kontroller (sınıf değişimi, handikap puanı, geçmiş performans)", MS: "MS. M0 + J_SEVIYE", MCS: "MCS. M0 + kontroller + J_SEVIYE", MCS30: "MCS30. M0 + kontroller + J_SEVIYE (yalnız N_ref ≥ 30 jokey)" } as const;
const KON: Kol[] = ["hp", "win", "top3", "sinif"];
const MODELLER: [string, Kol[]][] = [[AD.M0, ["acc", "kap"]], [AD.MC, ["acc", "kap", ...KON]], [AD.MS, ["acc", "kap", "S"]], [AD.MCS, ["acc", "kap", ...KON, "S"]], [AD.MCS30, ["acc", "kap", ...KON, "S30"]]];
type Sonuc = { yk: { k: Kosu; w: number }[]; test: number[]; ll: Record<string, number[]>; t1: Record<string, number[]>; t3: Record<string, number[]>; bt: Record<string, string[]>; taban: number[]; r1: number[]; r3: number[]; bas: (b: number) => number };
function degerlendir(pop: Kosu[]): Sonuc {
  const yk = pop.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) })).filter((y) => y.w >= 0); const BLOK = 6; const bas = (b: number) => Math.floor(yk.length * b / BLOK); const cache = new Map<string, number[]>(); const X = (i: number, c: Kol) => { const key = i + "|" + c; let v = cache.get(key); if (!v) { v = colX(yk[i]!.k, c); cache.set(key, v); } return v; };
  const fit = (idx: number[], cols: Kol[]) => { const K = cols.length; let b = new Array(K).fill(0);
    for (let it = 0; it < 30; it++) { const g = new Array(K).fill(0); const H = Array.from({ length: K }, () => new Array(K).fill(0));
      for (const i of idx) { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk: number, k: number) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); const pr = e.map((q) => q / z);
        const ex = Xi.map((col) => sum(col.map((v, r) => pr[r]! * v))); const exx = Array.from({ length: K }, (_, a) => Array.from({ length: K }, (_, c) => sum(Xi[a]!.map((v, r) => pr[r]! * v * Xi[c]![r]!)))); const w = yk[i]!.w;
        for (let a = 0; a < K; a++) g[a] += Xi[a]![w]! - ex[a]!; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) H[a]![c] += exx[a]![c]! - ex[a]! * ex[c]!; }
      for (let a = 0; a < K; a++) { g[a] -= 0.02 * b[a]; H[a]![a] += 0.02; } const d = coz(H, g); b = b.map((q: number, k: number) => q + Math.max(-3, Math.min(3, d[k]!))); if (Math.max(...d.map(Math.abs)) < 1e-7) break; } return b as number[]; };
  const olas = (i: number, cols: Kol[], b: number[]) => { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk, k) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); return e.map((q) => q / z); };
  const test: number[] = []; for (let i = bas(1); i < yk.length; i++) test.push(i); const ll: Record<string, number[]> = {}, t1: Record<string, number[]> = {}, t3: Record<string, number[]> = {}, bt: Record<string, string[]> = {};
  for (const [ad, cols] of MODELLER) { ll[ad] = []; t1[ad] = []; t3[ad] = []; bt[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, cols); bt[ad]!.push(b.map((q) => q.toFixed(2)).join("/"));
    for (let i = bas(bl); i < bas(bl + 1); i++) { const pr = olas(i, cols, b); const w = yk[i]!.w; ll[ad]!.push(-Math.log(Math.max(pr[w]!, 1e-12))); const better = pr.filter((q) => q > pr[w]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[w]!) <= 1e-12).length; t1[ad]!.push(Math.max(0, Math.min(1, (1 - better) / eq))); t3[ad]!.push(Math.max(0, Math.min(1, (3 - better) / eq))); } } }
  return { yk, test, ll, t1, t3, bt, taban: test.map((i) => Math.log(yk[i]!.k.atlar.length)), r1: test.map((i) => 1 / yk[i]!.k.atlar.length), r3: test.map((i) => Math.min(1, 3 / yk[i]!.k.atlar.length)), bas };
}
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };
const ekS = (R: Sonuc, a: string, b: string, idx?: number[]) => { const I = idx ?? R.test.map((_, j) => j); const s = (x: number[]) => I.map((j) => x[j]!); return { ll: farkCI(s(R.ll[b]!), s(R.ll[a]!)), t1: farkCI(s(R.t1[a]!), s(R.t1[b]!), 100, 2), t3: farkCI(s(R.t3[a]!), s(R.t3[b]!), 100, 2), n: I.length, nokta: mean(s(R.ll[b]!)) - mean(s(R.ll[a]!)) }; };
console.log("Örneklem A test…"); const RA = degerlendir(A); console.log("Örneklem B test…"); const RB = degerlendir(B);

// ───── RAPOR
p("# J_SEVIYE DOĞRULAMASI — sınıf, handikap puanı ve geçmiş performans kontrol edilince katkı sürüyor mu?");
p("**Yeni motora sinyal eklenmedi; katsayı/ağırlık belirlenmedi; `SINYAL_KAYDI` boş.** Kontrol değişkenleri (aşağıda) **sinyal adayı DEĞİLDİR**; yalnız J_SEVIYE'nin at kalitesini ikinci kez puanlayıp puanlamadığını sınamak için modele konur.");
p("");
p("## 0. Yöntem ve DÜRÜST ÇERÇEVE");
p("- **Soru:** (ACC_HIZ + GALOP_KAPASITE) tabanında J_SEVIYE'nin ek katkısı, atın **sınıf değişimi**, **handikap puanı** ve **geçmiş performansı** modele KONTROL olarak girince de sürüyor mu? Anahtar karşılaştırma **MCS − MC** (kontrollere rağmen J_SEVIYE'nin ek katkısı); kontrolsüz karşılaştırma **MS − M0**.");
p("- **Kontroller (yarış öncesi, tarih < yarış günü; bildirilen tanımlar, öğrenilmedi):** **handikap puanı** = programdaki `hp` (yarış-içi nötr doldurma; /20 ölçek); **geçmiş performans** = atın son ≤10 yarışında (TJK geçmiş önbelleği) **kazanma** ve **ilk-3** oranları, Laplace düzeltmeli (1+k)/(2+n); **sınıf değişimi** = bugünkü yarışın sınıf sırası − atın son 3 yarışının sınıf sırası ortalaması (Maiden 1 · Şartlı/Satış 2 · Handikap/KV 3 · Grup 4; /2 ölçek). Yarışın kendi sınıfı aynı yarıştaki tüm atlar için ortak olduğundan ana etki olarak yarış-içi modelde etkisizdir; bu yüzden **atın kendi sınıf geçmişine göre farkı** kullanıldı.");
p("- **ÖRNEKLEM A** = /admin/kosu-tipleri (1510 yarış, 1259 test): bu yarışlar yeni-motor adaylarının seçiminde (ACC_HIZ, GALOP, KOSU_STILI, TEMPO, JOKEY) **defalarca kullanıldı → aşağıdaki A sonuçları BAĞIMSIZ NİHAİ DOĞRULAMA DEĞİLDİR.** **ÖRNEKLEM B** = 01.07–15.08.2026 (Karma hariç tüm sonuçlu yarışlar): yeni-motor adaylarının seçiminde kullanılmamış dönem; ama (i) galop kaydı yalnız Temmuz'dan itibaren var (Şubat–Haziran yok), bu yüzden Nisan–Haziran alınamadı, (ii) jokey referansı kısa (Ocak başlangıçlı), (iii) küçük. B, \"daha az kullanılmış\" bir kontrol örneğidir, gerçek ileriye dönük (gelecek yarışlarda dondurulmuş tanımla) bir doğrulamanın yerine geçmez.");
p(`- **Veri düzeltmesi (açık beyan):** TJK geçmiş önbelleğinde tarihler **GG.AA.YYYY** biçimindedir. Önceki galop/Accurace araçlarımda önbellek ISO (YYYY-AA-GG) ile ayrıştırıldığı için **eşleşme hiç olmadı** ve \"önceki koşu tarihi kendi kayıtlarımız + TJK geçmişi\" dediğim yerde yalnız kendi kayıtlarımız kullanıldı. Bu araçta ayrıştırma düzeltildi: popülasyon A'da **${oncekiToplam}** at-yarıştan **${oncekiFark} (${pct(oncekiFark / oncekiToplam)}%)** önceki-koşu tarihi geçmiş önbelleği eklenince DEĞİŞTİ. Etki yalnız atın son koşusundan sonraki galop penceresinde (özellikle uzun aradan dönenlerde); önceki raporlar bu hatayla üretildi, ama sonuç yönleri bu fark oranının küçüklüğü nedeniyle değişmesi beklenmez (yeniden üretilmedi).`);
p("- Ölçü cihazı: ileri-genişleyen 6 blok; β'lar YALNIZ geçmiş bloklardan (ridge 0.02); eksik puan yarış ortalamasına (nötr); yön varsayımı yok. ΔLL: pozitif = iyileşme; Top1/Top3 farkı puan; köşeli parantez eşleştirilmiş bootstrap %95 (1000).");
p("");
const kapsam = (pop: Kosu[]) => { const h = pop.flatMap((k) => k.atlar); const r = (fn: (a: At) => boolean) => pct(h.filter(fn).length / h.length) + "%"; return `| ACC_HIZ ${r((a) => a.acc != null)} | GALOP ${r((a) => a.kap != null)} | handikap puanı ${r((a) => a.hp != null)} | geçmiş performans ${r((a) => a.win != null)} | sınıf değişimi ${r((a) => a.sinif != null)} | J_SEVIYE ${r((a) => a.S != null)} |`; };
const raporla = (ad: string, pop: Kosu[], R: Sonuc, uyari: string) => {
  p(`## ${ad}`); p(uyari); p(`Yarış ${pop.length}, test yarışı ${R.test.length}. Kapsam (at payı): ${kapsam(pop).replace(/^\| /, "").replace(/ \|$/, "")}.`); p("");
  p("| Ölçüm | Log-loss | ΔLL (taban 1/N − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |\n|---|---|---|---|---|---|");
  for (const [m] of MODELLER) { const d = R.taban.map((q, i) => q - R.ll[m]![i]!); const [lo, hi] = boot(d); p(`| ${m} | ${f(mean(R.ll[m]!))} | ${f(mean(d))} [${f(lo)}; ${f(hi)}] | ${pct(mean(R.t1[m]!))}% (${pct(mean(R.r1))}%) | ${pct(mean(R.t3[m]!))}% (${pct(mean(R.r3))}%) | ${R.bt[m]!.join(" ; ")} |`); }
  p(""); p("**J_SEVIYE ek katkısı** (ΔLL pozitif = iyileşme; Top1/Top3 puan):"); p("| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |\n|---|---|---|---|---|");
  const satirlar: [string, string, string][] = [[AD.MS, AD.M0, "J_SEVIYE → taban (kontrolsüz)"], [AD.MCS, AD.MC, "**J_SEVIYE → taban + kontroller (KONTROLLÜ; anahtar satır)**"], [AD.MCS30, AD.MC, "J_SEVIYE (yalnız N_ref≥30 jokey) → taban + kontroller"], [AD.MC, AD.M0, "Kontroller → taban (J_SEVIYE'siz)"], [AD.MCS, AD.MS, "Kontroller → taban + J_SEVIYE"]];
  for (const [a, b, e] of satirlar) { const x = ekS(R, a, b); p(`| ${e} | ${x.n} | ${x.ll} | ${x.t1} | ${x.t3} |`); }
  const k1 = ekS(R, AD.MS, AD.M0), k2 = ekS(R, AD.MCS, AD.MC); p(""); p(`**Sönümlenme:** J_SEVIYE'nin ΔLL katkısı kontrolsüz ${f(k1.nokta)} → kontrollü ${f(k2.nokta)} (oran %${pct(k2.nokta / k1.nokta, 0)}). Oran %100'e yakınsa katkı at kalitesi kontrolleriyle açıklanmıyor; sıfıra yakınsa büyük ölçüde at kalitesini yansıtıyor.`); p("");
  p("**Koşu tipine göre (kontrollü katkı MCS − MC):**"); p("| Koşu tipi | Test yarışı | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |\n|---|---|---|---|---|");
  for (const g of ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"]) { const ix = R.test.map((i, j) => (R.yk[i]!.k.tip === g ? j : -1)).filter((j) => j >= 0); if (ix.length < 5) continue; const x = ekS(R, AD.MCS, AD.MC, ix); p(`| ${g} | ${ix.length}${ix.length < 30 ? " (AZ ÖRNEK)" : ""} | ${x.ll} | ${x.t1} | ${x.t3} |`); }
  const hpR = R.test.map((i, j) => (R.yk[i]!.k.atlar.filter((a) => a.hp != null).length / R.yk[i]!.k.atlar.length >= 0.7 ? j : -1)).filter((j) => j >= 0); if (hpR.length >= 20) { const x = ekS(R, AD.MCS, AD.MC, hpR); p(`| Handikap puanı atların ≥%70'inde olan yarışlar | ${hpR.length} | ${x.ll} | ${x.t1} | ${x.t3} |`); }
  p("");
  const cift = (kol: "hp" | "win" | "top3" | "sinif" | "acc" | "kap") => { const x: number[] = [], y: number[] = []; for (const k of pop) { const idx = k.atlar.map((t, j) => (t.S != null && t[kol] != null ? j : -1)).filter((j) => j >= 0); if (idx.length < 4) continue; const ma = mean(idx.map((j) => k.atlar[j]!.S!)), mb = mean(idx.map((j) => k.atlar[j]![kol]!)); for (const j of idx) { x.push(k.atlar[j]!.S! - ma); y.push(k.atlar[j]![kol]! - mb); } } return `${f(corr(x, y), 2)} (n ${x.length})`; };
  p(`**J_SEVIYE ile kontrollerin yarış-içi korelasyonu:** handikap puanı ${cift("hp")} · geçmiş kazanma oranı ${cift("win")} · geçmiş ilk-3 oranı ${cift("top3")} · sınıf değişimi ${cift("sinif")} · ACC_HIZ ${cift("acc")} · GALOP_KAPASITE ${cift("kap")}.`); p("");
};
raporla("1. Örneklem A — /admin/kosu-tipleri (TEKRAR KULLANILMIŞ; bağımsız nihai doğrulama DEĞİL)", A, RA, "> **Uyarı:** bu 1259 test yarışı model kararlarında defalarca kullanıldı; sonuç, kararları destekleyen tekrarlı bir kontroldür, bağımsız doğrulama değildir.");
raporla("2. Örneklem B — 01.07–15.08.2026 (yeni-motor adayları için daha az kullanılmış dönem)", B, RB, "> **Not:** galop yalnız Temmuz'dan itibaren var; dönem kısa; jokey referansı Ocak'tan; yine geriye dönük (retrospektif) bir örneklemdir.");
p("## Sınırlar");
p("- Hiçbir örneklem GERÇEK ileriye dönük doğrulama değildir. Bağımsız doğrulama için tanımları (ACC_HIZ, GALOP_KAPASITE, J_SEVIYE) **dondurup**, bundan sonraki yarışlarda biriken sonuçlarla ölçmek gerekir.");
p("- Kontroller kusurludur: handikap puanı yalnız handikap ağırlıklı yarışlarda yaygındır (Maiden'de %59); geçmiş performans TJK geçmiş önbelleğine bağlıdır (sonradan güncellenmiş olabilir, yalnız yarış gününden önceki satırlar kullanıldı); sınıf sırası kaba bir 4 basamaklı ölçektir. Kontrol edilemeyen faktörler (kilo, kulvar, antrenör, saha, pist durumu) hâlâ jokey seviyesiyle karışık olabilir. Bu yüzden \"sönümlenme yok\" bile jokey becerisinin KANITI olmaz, yalnız bu kontrollerle açıklanmadığını gösterir.");
p("- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. Çoklu karşılaştırma düzeltilmedi. Bu test seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.");
fs.writeFileSync("JOKEY_SEVIYE_DOGRULAMA.md", L.join("\n"));
console.log(`YAZILDI JOKEY_SEVIYE_DOGRULAMA.md | ${L.length} satır | A ${A.length} B ${B.length} | önceki-koşu değişen ${oncekiFark}/${oncekiToplam}`);
await db.$disconnect(); process.exit(0);
