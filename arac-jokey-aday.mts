/**
 * JOKEY MODELİ v1.0 — J_SEVIYE, J_FORM30, J_BEKLENTI: ham değerler, 9 jokey örneği, kronolojik test. SALT-OKUMA. Sinyal/ağırlık/katsayı SEÇİLMEZ; motora hiçbir şey eklenmez.
 * Jokeyden BAĞIMSIZ yarış-öncesi olasılık P_i: yalnız ACC_HIZ + GALOP_KAPASITE'li yarış-içi softmax; her blokta β YALNIZ önceki bloklardan (ölçü cihazı; blok 0 için P_i YOK).
 * Binişler: kendi Runner+Result kayıtlarımız (Karma/koşullu kopyalar hariç; JockeyStatSync KULLANILMAZ); tarih < yarış günü (aynı gün dahil değil).
 * Çıktı: JOKEY_V1_RAPORU.md (gün/tarih kırılımı yok; hedef yarış 16.11.2026 Bursa K1 örneği hariç)
 */
import fs from "node:fs";
import { db } from "./src/lib/db";
import { GUNCEL_MOTOR_BASLANGIC, normalizeClassType } from "./src/server/services/admin.service";
import { GalopDeposu, galopBilesenleri, galopNormalize, galopTekille, type GalopHam } from "./src/lib/methodology/yeni-motor/adaylar/galop-aday";
import { AccDeposu, accBilesenleri, accNormalize, type AccHam, type AccYuzey } from "./src/lib/methodology/yeni-motor/adaylar/accurace-aday";
import { JOKEY_GUN_MS, JOKEY_SABITLERI, JokeyDeposu, jokeyBilesenleri, type BinisKaydi, type JokeyBilesenleri } from "./src/lib/methodology/yeni-motor/adaylar/jokey-aday";

const TOL = 1e-9; const dayMs = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
const f = (x: number | null | undefined, d = 4) => (x == null || !isFinite(x) ? "—" : x.toFixed(d));
const pct = (x: number, d = 1) => (isFinite(x) ? (x * 100).toFixed(d) : "—");
const nn = (v: (number | null)[]) => v.filter((q): q is number => q != null); const sum = (a: number[]) => a.reduce((s, x) => s + x, 0); const mean = (a: number[]) => (a.length ? sum(a) / a.length : NaN);
const medyan = (a: number[]) => { const s = [...a].sort((x, y) => x - y); return s.length ? (s.length % 2 ? s[(s.length - 1) / 2]! : (s[s.length / 2 - 1]! + s[s.length / 2]!) / 2) : NaN; };
const yasG = (age: string | null) => { const m = (age ?? "").match(/^(\d+)/); if (!m) return null; const n = parseInt(m[1]!, 10); return n >= 4 ? "4+" : String(n); };
const kabaG = (t: string) => { const u = t.toUpperCase(); return u.includes("MAIDEN") ? "Maiden" : u.includes("ŞARTLI") ? "Şartlı" : u.includes("HANDIKAP") ? "Handikap" : u.startsWith("KV") ? "KV" : /^G \d/.test(u) ? "Grup" : u.includes("SATIŞ") ? "Satış" : "Diğer"; };
const jn = (j: string | null) => (j ?? "").replace(/\s+/g, " ").trim().toLocaleUpperCase("tr");
let tohum = 6060; const rnd = () => (tohum = (tohum * 1664525 + 1013904223) % 4294967296) / 4294967296;
const boot = (d: number[], B = 1000) => { const o: number[] = []; for (let b = 0; b < B; b++) { let s = 0; for (let i = 0; i < d.length; i++) s += d[(rnd() * d.length) | 0]!; o.push(s / d.length); } o.sort((a, c) => a - c); return [o[Math.floor(B * 0.025)]!, o[Math.floor(B * 0.975)]!] as [number, number]; };
const corr = (x: number[], y: number[]) => { const mx = mean(x), my = mean(y); let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < x.length; i++) { sxy += (x[i]! - mx) * (y[i]! - my); sxx += (x[i]! - mx) ** 2; syy += (y[i]! - my) ** 2; } return sxy / Math.sqrt(sxx * syy); };
const sirala = (a: number[]) => { const idx = a.map((v, i) => [v, i] as [number, number]).sort((x, y) => x[0] - y[0]); const r = new Array(a.length).fill(0); let i = 0; while (i < idx.length) { let j = i; while (j + 1 < idx.length && idx[j + 1]![0] === idx[i]![0]) j++; const o = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[idx[k]![1]] = o; i = j + 1; } return r; };
const yz = (v: (number | null)[]) => { const av = nn(v); return av.length < 2 ? v.map(() => null) : v.map((x) => (x == null ? null : (av.filter((y) => y < x - TOL).length + 0.5 * av.filter((y) => Math.abs(y - x) <= TOL).length) / av.length)); };
const om = (v: (number | null)[]) => { const a = nn(v); return a.length ? mean(a) : null; };
const dm = (ms: number) => { const s = new Date(ms).toISOString().slice(0, 10).split("-"); return `${s[2]}.${s[1]}.${s[0]}`; };
const L: string[] = []; const p = (s = "") => L.push(s);

// ───── ACC + GALOP deposu (jokeyden bağımsız beklenen olasılık için)
console.log("Accurace okunuyor…"); const YZ: Record<string, AccYuzey> = { K: "KUM", "Ç": "CIM", S: "SENTETIK" }; const accHam: AccHam[] = [];
for (const r of await db.accuraceHorseSplit.findMany({ select: { accuraceRaceId: true, finishTimeReal: true, checkpoints: true, runner: { select: { tjkAtId: true } }, accuraceRace: { select: { date: true, citySlug: true, length: true, ground: true, race: { select: { breed: true } } } } } })) accHam.push({ yarisId: r.accuraceRaceId, atId: r.runner?.tjkAtId ?? null, tarih: dayMs(r.accuraceRace.date), hip: r.accuraceRace.citySlug, irk: r.accuraceRace.race?.breed ?? null, yuzey: YZ[r.accuraceRace.ground ?? ""] ?? null, mesafe: r.accuraceRace.length ?? 0, sureMs: r.finishTimeReal, kontrol: ((r.checkpoints as { checkpoint: number; timeReal: number }[]) ?? []).map((c) => ({ m: c.checkpoint, ms: c.timeReal })) });
const accDep = new AccDeposu(accHam.flatMap((h) => { const { kayit } = accNormalize(h); return kayit ? [kayit] : []; }));
const ks = await db.race.findMany({ where: { prediction: { published: true, createdAt: { gte: GUNCEL_MOTOR_BASLANGIC } }, conditions: null, result: { isNot: null } }, orderBy: [{ raceDay: { date: "asc" } }, { raceNo: "asc" }], select: { id: true, raceNo: true, surface: true, classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } }, runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, tjkAtId: true, jockey: true } } } });
const atIds = [...new Set(ks.flatMap((k) => k.runners.map((r) => r.tjkAtId).filter((x): x is number => x != null)))];
console.log("Galoplar okunuyor…");
const galopHam = await db.gallop.findMany({ select: { date: true, track: true, form: true, jockey: true, splits: true, runner: { select: { tjkAtId: true, age: true, race: { select: { breed: true } } } } } });
const galopTek = galopTekille(galopHam.flatMap((h) => { const id = h.runner.tjkAtId; if (id == null) return []; const { kayit } = galopNormalize({ atId: id, tarih: dayMs(h.date), track: h.track, form: h.form, jokey: h.jockey, splits: h.splits as Record<string, string | null> | null, irk: h.runner.race.breed ?? null, yasGrubu: yasG(h.runner.age) } as GalopHam); return kayit ? [kayit] : []; }));
const gunSet = new Map<number, Set<number>>(); const gEkle = (id: number, t: number) => { const s = gunSet.get(id) ?? new Set<number>(); s.add(t); gunSet.set(id, s); };
for (const r of await db.runner.findMany({ where: { scratched: false, tjkAtId: { in: atIds } }, select: { tjkAtId: true, race: { select: { raceDay: { select: { date: true } } } } } })) gEkle(r.tjkAtId!, dayMs(r.race.raceDay.date));
for (let i = 0; i < atIds.length; i += 500) for (const c of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: atIds.slice(i, i + 500) } }, select: { tjkAtId: true, rowsJson: true } })) for (const x of (c.rowsJson as { date?: string }[]) ?? []) { const m = String(x.date ?? "").match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) gEkle(c.tjkAtId, Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!)); }
const galopDep = new GalopDeposu(galopTek, new Map([...gunSet].map(([k, v]) => [k, [...v].sort((a, b) => a - b)])));

// ───── popülasyon puanları (ACC_HIZ, GALOP_KAPASITE; sonuç yüklenmeden)
type At = { raceId: string; no: number; jokey: string; kazandi: boolean; acc: number | null; kap: number | null; pBaz: number | null; S: number | null; F: number | null; B: number | null; jb: JokeyBilesenleri | null };
type Kosu = { raceId: string; t: number; tip: string; atlar: At[] };
const YUZ: Record<string, AccYuzey> = { KUM: "KUM", CIM: "CIM", SENTETIK: "SENTETIK" }; const pop: Kosu[] = []; const gunler = [...new Set(ks.map((k) => dayMs(k.raceDay.date)))].sort((a, b) => a - b);
for (const t of gunler) { const gg = galopDep.gorunum(t), ga = accDep.gorunum(t);
  for (const k of ks.filter((x) => dayMs(x.raceDay.date) === t)) { const win = new Set(k.result?.winnerNos ?? []); const yzm = YUZ[String(k.surface)]; if (win.size === 0 || !yzm) continue;
    const G = k.runners.map((r) => (r.tjkAtId == null ? null : galopBilesenleri(gg, r.tjkAtId))); const pH = yz(G.map((b) => b?.hiz ?? null)), pK = yz(G.map((b) => b?.kapanis ?? null)), pE = yz(G.map((b) => b?.efor ?? null));
    pop.push({ raceId: k.id, t, tip: kabaG(normalizeClassType(k.classType)), atlar: k.runners.map((r, i) => ({ raceId: k.id, no: r.no, jokey: jn(r.jockey), kazandi: win.has(r.no), kap: om([pH[i]!, pK[i]!, pE[i]!]), acc: r.tjkAtId == null ? null : accBilesenleri(ga, r.tjkAtId, yzm).accHiz, pBaz: null, S: null, F: null, B: null, jb: null })) }); } }
console.log(`${pop.length} yarış`);

// ───── jokeyden BAĞIMSIZ beklenen olasılık: ileri-bloklu yarış-içi softmax (ACC_HIZ + GALOP_KAPASITE); blok 0 → P YOK
const doldur = (v: (number | null)[]) => { const a = nn(v); if (a.length < 2) return v.map(() => 0); const mu = mean(a); return v.map((q) => (q == null ? mu : q)); };
type Kol = "acc" | "kap" | "S" | "F" | "B";
const ykAll = pop.map((k) => ({ k, w: k.atlar.findIndex((a) => a.kazandi) })).filter((y) => y.w >= 0);
const colX = (k: Kosu, c: Kol) => doldur(k.atlar.map((a) => (c === "acc" ? (a.acc == null ? null : a.acc / 100) : c === "kap" ? a.kap : c === "S" ? (a.S == null ? null : a.S / 0.1) : c === "F" ? (a.F == null ? null : a.F / 0.06) : a.B == null ? null : a.B / 0.03)));
function coz(H: number[][], g: number[]) { const K = g.length; const A = H.map((r, i) => [...r, g[i]!]); for (let c = 0; c < K; c++) { let m = c; for (let r = c + 1; r < K; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[m]![c]!)) m = r; [A[c], A[m]] = [A[m]!, A[c]!]; const d = A[c]![c]!; for (let j = c; j <= K; j++) A[c]![j]! /= d; for (let r = 0; r < K; r++) if (r !== c) { const fct = A[r]![c]!; for (let j = c; j <= K; j++) A[r]![j]! -= fct * A[c]![j]!; } } return A.map((r) => r[K]!); }
function fit(idx: number[], cols: Kol[], X: (i: number, c: Kol) => number[]) { const K = cols.length; let b = new Array(K).fill(0);
  for (let it = 0; it < 30; it++) { const g = new Array(K).fill(0); const H = Array.from({ length: K }, () => new Array(K).fill(0));
    for (const i of idx) { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk: number, k: number) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); const pr = e.map((q) => q / z);
      const ex = Xi.map((col) => sum(col.map((v, r) => pr[r]! * v))); const exx = Array.from({ length: K }, (_, a) => Array.from({ length: K }, (_, c) => sum(Xi[a]!.map((v, r) => pr[r]! * v * Xi[c]![r]!)))); const w = ykAll[i]!.w;
      for (let a = 0; a < K; a++) g[a] += Xi[a]![w]! - ex[a]!; for (let a = 0; a < K; a++) for (let c = 0; c < K; c++) H[a]![c] += exx[a]![c]! - ex[a]! * ex[c]!; }
    for (let a = 0; a < K; a++) { g[a] -= 0.02 * b[a]; H[a]![a] += 0.02; } const d = coz(H, g); b = b.map((q: number, k: number) => q + Math.max(-3, Math.min(3, d[k]!))); if (Math.max(...d.map(Math.abs)) < 1e-7) break; } return b as number[]; }
const olas = (i: number, cols: Kol[], b: number[], X: (i: number, c: Kol) => number[]) => { const Xi = cols.map((c) => X(i, c)); const N = Xi[0]!.length; const s = Array.from({ length: N }, (_, r) => sum(b.map((bk, k) => bk * Xi[k]![r]!))); const mx = Math.max(...s); const e = s.map((q) => Math.exp(q - mx)); const z = sum(e); return e.map((q) => q / z); };
const BLOK = 6; const bas = (b: number) => Math.floor(ykAll.length * b / BLOK);
const XBaz = (i: number, c: Kol) => colX(ykAll[i]!.k, c); const pBazMap = new Map<string, number>();
for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, ["acc", "kap"], XBaz); for (let i = bas(bl); i < bas(bl + 1); i++) { const pr = olas(i, ["acc", "kap"], b, XBaz); ykAll[i]!.k.atlar.forEach((a, j) => { a.pBaz = pr[j]!; pBazMap.set(a.raceId + "#" + a.no, pr[j]!); }); } }

// ───── binişler (kendi kayıtlarımız; Karma/koşullu kopyalar HARİÇ)
console.log("Binişler okunuyor…");
const binRows = await db.runner.findMany({ where: { scratched: false, race: { conditions: null, result: { isNot: null }, raceDay: { hippodrome: { name: { not: "Karma" } } } } }, select: { no: true, jockey: true, race: { select: { id: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } } });
const binisler: BinisKaydi[] = binRows.filter((r) => jn(r.jockey)).map((r) => ({ raceId: r.race.id, tarih: dayMs(r.race.raceDay.date), jokey: jn(r.jockey), kazandi: ((r.race.result?.winnerNos ?? []) as number[]).includes(r.no) ? 1 : 0, pBaz: pBazMap.get(r.race.id + "#" + r.no) ?? null }));
const jDep = new JokeyDeposu(binisler);
for (const t of gunler) { const g = jDep.gorunum(t); for (const k of pop.filter((x) => x.t === t)) for (const a of k.atlar) { if (!a.jokey) continue; const jb = jokeyBilesenleri(g, a.jokey); a.jb = jb; a.S = jb.seviye.pRef; a.F = jb.form30.deger; a.B = jb.beklenti.deger; } }

// ───── sızıntı denetimi (8 gün: tüm jokeylerin bileşenleri) ve bağımsız yeniden hesap
const secilen = gunler.filter((_, i) => i % Math.ceil(gunler.length / 8) === 0).slice(0, 8); let denenen = 0, farkli = 0;
for (const t of secilen) { const g0 = jDep.gorunum(t), g1 = jDep.gelecegiBoz(t, 17 + (t / JOKEY_GUN_MS) % 991).gorunum(t); for (const j of new Set(pop.filter((x) => x.t === t).flatMap((k) => k.atlar.map((a) => a.jokey)))) { if (!j) continue; denenen++; if (JSON.stringify(jokeyBilesenleri(g0, j)) !== JSON.stringify(jokeyBilesenleri(g1, j))) farkli++; } }
const orn: At[] = []; { const tum = pop.flatMap((k) => k.atlar.filter((a) => a.jb && a.jokey)); for (let i = 0; i < 150 && tum.length; i++) orn.push(tum[Math.floor(rnd() * tum.length)]!); }
let bagUyumsuz = 0; for (const a of orn) { const k = pop.find((x) => x.raceId === a.raceId)!; const t = k.t; const my = binisler.filter((b) => b.jokey === a.jokey && b.tarih < t); const ref = my.filter((b) => b.tarih >= t - 365 * 86400000 && b.tarih < t - 30 * 86400000), son = my.filter((b) => b.tarih >= t - 30 * 86400000);
  const pRef = ref.length ? ref.filter((b) => b.kazandi).length / ref.length : null; const fd = son.length && pRef != null ? (son.length / (son.length + 8)) * (son.filter((b) => b.kazandi).length / son.length - pRef) : null; const bl = son.filter((b) => b.pBaz != null); const bd = bl.length ? (bl.reduce((s, b) => s + b.kazandi - b.pBaz!, 0)) / (bl.length + 8) : null;
  const ok = (x: number | null, y: number | null) => (x == null || y == null ? x === y : Math.abs(x - y) < 1e-9); if (!(ok(pRef, a.S) && ok(fd, a.F) && ok(bd, a.B))) bagUyumsuz++; }

// ───── 9 jokey örneği (16.11.2026 Bursa K1, as-of < 16.11)
const T9 = Date.UTC(2026, 10, 16); const k9 = await db.race.findFirst({ where: { raceNo: 1, distance: 1300, raceDay: { date: new Date(T9), hippodrome: { name: "Bursa" } } }, select: { runners: { where: { scratched: false }, orderBy: { no: "asc" }, select: { no: true, name: true, jockey: true } } } });
const SITE: Record<string, [string, string]> = { "HIŞMAN ÇİZİK": ["19/107", "12.1"], "ALİ YILDIZ": ["14/130", "9.6"], "MUHAMMED MİR BİLGİN": ["21/99", "20.9"], "MEHMET KAYA": ["9/111", "13.3"], "RECEP KETME": ["8/87", "8.1"], "ALİCAN İNCİ": ["7/60", "9.5"], "ONUR ATMACA": ["1/54", "5.9"], "İSMAİL GÜN": ["0/11", "0.0"], "MAHMUT TURAN": ["4/62", "9.3"] };
const g9 = jDep.gorunum(T9);

// ───── ölçü cihazı: M0 + adaylar
const yk = ykAll; const test: number[] = []; for (let i = bas(1); i < yk.length; i++) test.push(i);
const AD = { M0: "M0. ACC_HIZ + GALOP_KAPASITE (taban)", S: "+ J_SEVIYE", F: "+ J_FORM30", B: "+ J_BEKLENTI", SF: "+ J_SEVIYE + J_FORM30", SB: "+ J_SEVIYE + J_BEKLENTI", FB: "+ J_FORM30 + J_BEKLENTI", SFB: "+ J_SEVIYE + J_FORM30 + J_BEKLENTI", Fa: "Yalnız J_FORM30", Ba: "Yalnız J_BEKLENTI", Sa: "Yalnız J_SEVIYE" } as const;
const MODELLER: [string, Kol[]][] = [[AD.M0, ["acc", "kap"]], [AD.S, ["acc", "kap", "S"]], [AD.F, ["acc", "kap", "F"]], [AD.B, ["acc", "kap", "B"]], [AD.SF, ["acc", "kap", "S", "F"]], [AD.SB, ["acc", "kap", "S", "B"]], [AD.FB, ["acc", "kap", "F", "B"]], [AD.SFB, ["acc", "kap", "S", "F", "B"]], [AD.Sa, ["S"]], [AD.Fa, ["F"]], [AD.Ba, ["B"]]];
const Xc = (i: number, c: Kol) => colX(yk[i]!.k, c);
const ll: Record<string, number[]> = {}, t1: Record<string, number[]> = {}, t3: Record<string, number[]> = {}, bt: Record<string, string[]> = {};
for (const [ad, cols] of MODELLER) { ll[ad] = []; t1[ad] = []; t3[ad] = []; bt[ad] = []; for (let bl = 1; bl < BLOK; bl++) { const egit: number[] = []; for (let i = 0; i < bas(bl); i++) egit.push(i); const b = fit(egit, cols, Xc); bt[ad]!.push(b.map((q) => q.toFixed(2)).join("/"));
  for (let i = bas(bl); i < bas(bl + 1); i++) { const pr = olas(i, cols, b, Xc); const w = yk[i]!.w; ll[ad]!.push(-Math.log(Math.max(pr[w]!, 1e-12))); const better = pr.filter((q) => q > pr[w]! + 1e-12).length, eq = pr.filter((q) => Math.abs(q - pr[w]!) <= 1e-12).length; t1[ad]!.push(Math.max(0, Math.min(1, (1 - better) / eq))); t3[ad]!.push(Math.max(0, Math.min(1, (3 - better) / eq))); } } }
const taban = test.map((i) => Math.log(yk[i]!.k.atlar.length)); const r1 = test.map((i) => 1 / yk[i]!.k.atlar.length), r3 = test.map((i) => Math.min(1, 3 / yk[i]!.k.atlar.length));
const sub = (idx: number[], a: number[]) => idx.map((j) => a[j]!);
const farkCI = (a: number[], b: number[], carp = 1, dec = 4) => { const d = a.map((q, i) => q - b[i]!); const [lo, hi] = boot(d); return `${(mean(d) * carp).toFixed(dec)} [${(lo * carp).toFixed(dec)}; ${(hi * carp).toFixed(dec)}]`; };
const ek = (a: string, b: string, idx?: number[]) => { const I = idx ?? test.map((_, j) => j); return { ll: farkCI(sub(I, ll[b]!), sub(I, ll[a]!)), t1: farkCI(sub(I, t1[a]!), sub(I, t1[b]!), 100, 2), t3: farkCI(sub(I, t3[a]!), sub(I, t3[b]!), 100, 2), n: I.length }; };

// ───── RAPOR
const hep = pop.flatMap((k) => k.atlar); const toplamAt = hep.length;
p("# JOKEY MODELİ v1.0 — J_SEVIYE, J_FORM30, J_BEKLENTI (ham değerler + kronolojik test)");
p("**Motorun aktif sinyal listesine hiçbir şey eklenmedi; katsayı/birleşim ağırlığı belirlenmedi; `SINYAL_KAYDI` boş.** Üç hesap AYRI tutuldu (genel seviye, güncel form, beklenti farkı karıştırılmadı).");
p("");
p("## 0. Tanımlar, veri ve açık uyarılar");
p("- **Binişler:** kendi `Runner`+`Result` kayıtlarımız (Karma/koşullu kopyalar hariç; `JockeyStatSync` KULLANILMADI). Galibiyet = `Result.winnerNos`'ta olma. **Tarih < yarış günü**: hedef yarışın günü ve aynı gün önceki koşular dahil değil (muhafazakâr; sitedeki 17 Kasım kesitiyle KARŞILAŞTIRILMAMALI).");
p(`- **J_SEVIYE** = W_ref/N_ref; referans = [t−${JOKEY_SABITLERI.refGun} gün, t−${JOKEY_SABITLERI.sonGun} gün) (son 30 gün HARİÇ). **J_FORM30** = N30/(N30+${JOKEY_SABITLERI.formKatsayi})·(W30/N30 − P_ref); son 30 gün = [t−30 gün, t). **J_BEKLENTI** = Σ(Y_i − P_i)/(N + k), son 30 gün, yalnız P_i'si bilinen binişler.`);
p(`- **k = ${JOKEY_SABITLERI.beklentiK} GEÇİCİ SABİTTİR; öğrenilmedi** (talimatınız katsayı belirlememi yasakladığı için J_FORM30'daki 8 ile aynı ölçekte bıraktım; \"eğitim verisiyle belirlenecek\" ifadesi bu aşamada uygulanmadı — karar sizin).`);
p("- **P_i (jokeyden bağımsız beklenti):** yalnız ACC_HIZ + GALOP_KAPASITE'li yarış-içi softmax; her blokta β YALNIZ önceki bloklardan öğrenilir (ölçü cihazı; model önerisi değil), P_i o yarışın öncesinde bilinen bilgilerle üretilir. **Blok 0 (en eski ~%17 yarış) için P_i YOK**; P_i'si olmayan biniş J_BEKLENTI'ye girmez, kapsam her satırda gösterilir. Popülasyon dışı (16 Ağustos öncesi) binişler de P_i'siz kalır.");
p("- **Veri sınırı:** veritabanımız **2026-01-01**'den başlar; \"365 günlük referans\" Ağustos–Kasım hedeflerinde 7–10 ay uzunluğundadır (J_SEVIYE ve J_FORM30'ın P_ref'i buna göre ölçülür). Tabela (ilk 5) oranı KULLANILMADI.");
p("- Geçmişi olmayan jokey: değer **null (veri yok)**, negatif sayılmaz. J_FORM30 için P_ref (referansta biniş) ve N30 gerekir; J_BEKLENTI için P_i'si bilinen son-30-gün binişi gerekir.");
p(`- Gelecek-bozma testi (${secilen.length} gün, ${denenen} jokey: t ve sonrası bozuldu, aynı güne sahte biniş eklendi): **${farkli === 0 && denenen > 0 ? "GEÇTİ — birebir aynı, sızıntı yok" : "SIZINTI VAR (" + farkli + ")"}**. Bağımsız yeniden hesap (modüle bakmadan düz döngü, ${orn.length} rastgele jokey-yarış): **uyuşmayan ${bagUyumsuz}**. Puanlar sonuç yüklenmeden önce hesaplandı.`);
p("");
// 9 jokey
p("## 1. Örnek: 16.11.2026 Bursa K1 — 9 jokeyin ham değerleri (as-of < 16.11.2026)");
p("| No | At | Jokey | N_ref | W_ref | **J_SEVIYE (P_ref)** | N30 | W30 | oran30 | ağırlık N/(N+8) | **J_FORM30** | P_i'si bilinen biniş / N30 | W (bilinen) | E (beklenen) | **J_BEKLENTI** | Sitedeki 17.11 kesiti (Son 30G · Ref K%) |");
p("|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of k9?.runners ?? []) { const j = jn(r.jockey); const jb = jokeyBilesenleri(g9, j); const st = SITE[j]; p(`| ${r.no} | ${r.name} | ${j} | ${jb.seviye.nRef} | ${jb.seviye.wRef} | ${jb.seviye.pRef == null ? "veri yok" : f(jb.seviye.pRef * 100, 1) + "%"} | ${jb.form30.n30} | ${jb.form30.w30} | ${jb.form30.oran30 == null ? "—" : f(jb.form30.oran30 * 100, 1) + "%"} | ${f(jb.form30.agirlik, 2)} | ${jb.form30.deger == null ? "veri yok" : (jb.form30.deger >= 0 ? "+" : "") + f(jb.form30.deger * 100, 2) + " puan"} | ${jb.beklenti.nBilinen}/${jb.beklenti.nToplam} | ${jb.beklenti.w} | ${f(jb.beklenti.e, 2)} | ${jb.beklenti.deger == null ? "üretilmedi (P_i yok)" : (jb.beklenti.deger >= 0 ? "+" : "") + f(jb.beklenti.deger, 4)} | ${st ? st[0] + " · " + st[1] + "%" : "—"} |`); }
p("");
p("Sitedeki sütun **yalnız karşılaştırma içindir** (17 Kasım kesiti: 16 Kasım yarışı sonuçları dahil olabilir, Karma/çift sayım ve farklı pencere farkları olabilir); hesaba girmedi. Bizim değerler 16.11 öncesi, kendi kayıtlarımızla.");
p("");
// kapsam
p(`## 2. Test popülasyonu ve kapsam`);
p(`/admin/kosu-tipleri: **${pop.length} yarış, ${toplamAt} at**; ileri-genişleyen 6 blok, **${test.length} test yarışı** (blok 1–5). Jokey binişi: ${binisler.length} (Karma/koşullu hariç).`);
p("| Ölçü | At | Oran |\n|---|---|---|"); for (const [ad, fn] of [["Jokey adı var", (a: At) => !!a.jokey], ["J_SEVIYE var (referansta ≥1 biniş)", (a: At) => a.S != null], ["J_FORM30 var (N30≥1 ve P_ref var)", (a: At) => a.F != null], ["J_BEKLENTI var (P_i'si bilinen ≥1 biniş)", (a: At) => a.B != null], ["Üçü de var", (a: At) => a.S != null && a.F != null && a.B != null], ["N_ref ≥ 30", (a: At) => (a.jb?.seviye.nRef ?? 0) >= 30], ["N30 ≥ 10", (a: At) => (a.jb?.form30.n30 ?? 0) >= 10], ["J_BEKLENTI'de P_i'si bilinen biniş ≥ 10", (a: At) => (a.jb?.beklenti.nBilinen ?? 0) >= 10]] as [string, (a: At) => boolean][]) p(`| ${ad} | ${hep.filter(fn).length} | ${pct(hep.filter(fn).length / hep.length)}% |`);
{ const bj = hep.filter((a) => a.jb && a.jb.beklenti.nToplam > 0); p(`\nJ_BEKLENTI'de son-30-gün binişlerinin P_i'si bilinen payı (medyan): **%${pct(medyan(bj.map((a) => a.jb!.beklenti.nBilinen / a.jb!.beklenti.nToplam)), 0)}**; medyan N_ref ${medyan(hep.filter((a) => a.jb).map((a) => a.jb!.seviye.nRef))}, medyan N30 ${medyan(hep.filter((a) => a.jb).map((a) => a.jb!.form30.n30))}.`); }
p("");
p("## 3. Kronolojik test: ACC_HIZ + GALOP_KAPASITE üzerine ek katkı");
p("Ölçü cihazı: β'lar YALNIZ geçmiş bloklardan (ridge 0.02); eksik puan yarış ortalamasına (nötr); yön varsayımı yok. **ek katkı** = taban modelin log-loss'u − eklenmiş modelin log-loss'u (pozitif = iyileşme); Top1/Top3 farkı puan; köşeli parantez eşleştirilmiş bootstrap %95 (1000). Girdi ölçekleri sabit (P_ref/0,10; J_FORM30/0,06; J_BEKLENTI/0,03), formüller değişmedi.");
p("| Ölçüm | Log-loss | ΔLL (taban 1/N − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |\n|---|---|---|---|---|---|");
for (const [ad] of MODELLER) { const d = taban.map((q, i) => q - ll[ad]![i]!); const [lo, hi] = boot(d); p(`| ${ad} | ${f(mean(ll[ad]!))} | ${f(mean(d))} [${f(lo)}; ${f(hi)}] | ${pct(mean(t1[ad]!))}% (${pct(mean(r1))}%) | ${pct(mean(t3[ad]!))}% (${pct(mean(r3))}%) | ${bt[ad]!.join(" ; ")} |`); }
p("");
p("**Ek katkılar** (Top1/Top3: puan; ΔLL: pozitif = iyileşme):");
p("| Karşılaştırma | Yarış | ΔLL ek katkı [%95] | Top1 farkı [%95] | Top3 farkı [%95] |\n|---|---|---|---|---|");
for (const [a, b, e] of [[AD.S, AD.M0, "J_SEVIYE → taban"], [AD.F, AD.M0, "J_FORM30 → taban"], [AD.B, AD.M0, "J_BEKLENTI → taban"], [AD.SF, AD.M0, "J_SEVIYE + J_FORM30 → taban"], [AD.FB, AD.M0, "J_FORM30 + J_BEKLENTI → taban"], [AD.SFB, AD.M0, "üçü birlikte → taban"], [AD.FB, AD.F, "**J_BEKLENTI → taban + J_FORM30** (aynı bilgi mi?)"], [AD.FB, AD.B, "**J_FORM30 → taban + J_BEKLENTI** (aynı bilgi mi?)"], [AD.SB, AD.M0, "J_SEVIYE + J_BEKLENTI → taban"], [AD.SF, AD.S, "**J_FORM30 → taban + J_SEVIYE** (seviye dışında form bilgisi var mı?)"], [AD.SB, AD.S, "**J_BEKLENTI → taban + J_SEVIYE** (seviye dışında beklenti bilgisi var mı?)"], [AD.SFB, AD.SF, "**J_BEKLENTI → taban + J_SEVIYE + J_FORM30**"], [AD.SFB, AD.SB, "**J_FORM30 → taban + J_SEVIYE + J_BEKLENTI**"], [AD.SFB, AD.S, "**J_FORM30 + J_BEKLENTI → taban + J_SEVIYE** (güncel bilgi, seviyenin ötesinde)"]] as [string, string, string][]) { const x = ek(a, b); p(`| ${e} | ${x.n} | ${x.ll} | ${x.t1} | ${x.t3} |`); }
p("");
// sağlamlık
const zengin = test.map((i, j) => { const at = yk[i]!.k.atlar; return at.filter((a) => a.F != null && a.B != null).length / at.length >= 0.7 ? j : -1; }).filter((j) => j >= 0);
p("## 4. Sağlamlık ve bilgi tekrarı");
{ const a1 = ek(AD.F, AD.M0, zengin), a2 = ek(AD.B, AD.M0, zengin), a3 = ek(AD.FB, AD.F, zengin), a4 = ek(AD.FB, AD.B, zengin); p(`- J_FORM30 ve J_BEKLENTI'nin ikisi de atların ≥%70'inde bulunan **${zengin.length}** test yarışında: J_FORM30 → taban ΔLL ${a1.ll}, Top1 ${a1.t1}, Top3 ${a1.t3}; J_BEKLENTI → taban ΔLL ${a2.ll}, Top1 ${a2.t1}, Top3 ${a2.t3}; BEKLENTİ → +FORM30 ΔLL ${a3.ll}; FORM30 → +BEKLENTİ ΔLL ${a4.ll}.`); }
const cift = (a: "S" | "F" | "B", b: "S" | "F" | "B") => { const x: number[] = [], y: number[] = [], xd: number[] = [], yd: number[] = []; for (const k of pop) { const idx = k.atlar.map((t, j) => (t[a] != null && t[b] != null ? j : -1)).filter((j) => j >= 0); if (idx.length < 4) continue; const ma = mean(idx.map((j) => k.atlar[j]![a]!)), mb = mean(idx.map((j) => k.atlar[j]![b]!)); for (const j of idx) { x.push(k.atlar[j]![a]!); y.push(k.atlar[j]![b]!); xd.push(k.atlar[j]![a]! - ma); yd.push(k.atlar[j]![b]! - mb); } } return `${f(corr(x, y), 2)} / ${f(corr(sirala(x), sirala(y)), 2)} / **${f(corr(xd, yd), 2)}** (n ${x.length})`; };
p("- Korelasyon (Pearson / Spearman / **yarış-içi**; ikisi de olan atlar):"); p("| Çift | Korelasyon |\n|---|---|"); for (const [a, b, ad] of [["F", "B", "J_FORM30 ↔ J_BEKLENTI"], ["S", "F", "J_SEVIYE ↔ J_FORM30"], ["S", "B", "J_SEVIYE ↔ J_BEKLENTI"]] as ["S" | "F" | "B", "S" | "F" | "B", string][]) p(`| ${ad} | ${cift(a, b)} |`);
p("");
p("## 5. Tarihsel kalibrasyon (0–100 ölçeğine ÇEVRİLMEDİ)");
p("Ham değer beşte birliklerine (outcome'dan bağımsız eşikler; tüm değeri olan atlar) göre: gerçekleşen kazanma oranı ve jokeyden bağımsız beklenen (P_i; yalnız P_i'si olan atlar). **Gözlenen − beklenen** pozitifse o kovadaki atlar jokey dışı bilgiye göre beklenenden fazla kazanmıştır. Bu tablo 0–100 dönüşümü için kalibrasyon girdisidir, dönüşüm yapılmadı.");
for (const [kod, ad] of [["S", "J_SEVIYE (P_ref)"], ["F", "J_FORM30"], ["B", "J_BEKLENTI"]] as ["S" | "F" | "B", string][]) {
  const v = hep.filter((a) => a[kod] != null).map((a) => a[kod]!).sort((x, y) => x - y); if (v.length < 50) continue; const esik = [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.floor(q * (v.length - 1))]!);
  const kov = (x: number) => esik.filter((e) => x > e).length;
  p(`**${ad}**`); p("| Kova (düşük → yüksek) | At | Ort. ham değer | Kazanma oranı | Beklenen (P_i) | Gözlenen − beklenen (P_i'li atlarda) |\n|---|---|---|---|---|---|");
  for (let q = 0; q < 5; q++) { const a = hep.filter((t) => t[kod] != null && kov(t[kod]!) === q); const pb = a.filter((t) => t.pBaz != null); p(`| ${q + 1} | ${a.length} | ${f(mean(a.map((t) => t[kod]!)), 4)} | ${pct(mean(a.map((t) => (t.kazandi ? 1 : 0))))}% | ${pb.length ? pct(mean(pb.map((t) => t.pBaz!))) + "%" : "—"} | ${pb.length ? ((mean(pb.map((t) => (t.kazandi ? 1 : 0))) - mean(pb.map((t) => t.pBaz!))) * 100).toFixed(2) + " puan (n " + pb.length + ")" : "—"} |`); }
  p("");
}
p("## 6. Koşu tipine göre: J_FORM30 + J_BEKLENTI → taban (Top1/Top3 farkı, puan)");
p("| Koşu tipi | Test yarışı | ΔLL ek katkı [%95] | Top1 farkı [%95] | Top3 farkı [%95] |\n|---|---|---|---|---|");
for (const g of ["Maiden", "Şartlı", "Handikap", "KV", "Grup", "Satış"]) { const ix = test.map((i, j) => (yk[i]!.k.tip === g ? j : -1)).filter((j) => j >= 0); if (ix.length < 5) continue; const e = ek(AD.FB, AD.M0, ix); p(`| ${g} | ${ix.length}${ix.length < 30 ? " (AZ ÖRNEK)" : ""} | ${e.ll} | ${e.t1} | ${e.t3} |`); }
p("");
p("## Sınırlar");
p("- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. β'lar yalnız ölçü cihazıdır. Çoklu karşılaştırma düzeltilmedi; koşu tipi tabloları küçük örneklidir.");
p("- **Jokey ↔ at ayrımı:** J_BEKLENTI'nin P_i'si yalnız ACC_HIZ + GALOP_KAPASITE'den gelir; bu iki puan atı tam açıklamaz (örneğin sınıf, kilo, form, kulvar yok). Beklenen eksik kaldığı ölçüde, jokey bu eksik bilgiye bağlı \"beklenti üstü\" görünebilir. Bu yüzden J_BEKLENTI de \"jokeyin bağımsız katkısı\" kanıtı DEĞİLDİR.");
p("- Veritabanı 2026-01-01'den başlar (referans penceresi kısa); P_i blok 0 ve 16 Ağustos öncesi binişlerde yok; k geçici sabit. Aynı gün önceki koşular bilerek dışarıda. Tarihsel kalibrasyon yapıldı, 0–100 dönüşümü yapılmadı.");
fs.writeFileSync("JOKEY_V1_RAPORU.md", L.join("\n"));
console.log(`YAZILDI JOKEY_V1_RAPORU.md | ${L.length} satır | yarış ${pop.length} | sızıntı ${farkli === 0 ? "YOK" : "VAR"} | bağımsız uyuşmayan ${bagUyumsuz}`);
await db.$disconnect(); process.exit(0);
