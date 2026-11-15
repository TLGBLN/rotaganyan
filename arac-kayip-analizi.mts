// SALT-OKUMA ADAY SİNYAL SINAMASI (arac-ham-alan-final.mts'ten türetildi; HİÇBİR dosya/ağırlık YAZMAZ, canlı modele dokunmaz).
// Adaylar bugünkü canlı 21 sinyalli tabana TEK TEK eklenip motorun eğitim yöntemiyle (zaman-CV, DEV/SINAMA katları) ölçülür.
// !!! Runner tablosunu TAMAMEN tarar (PIT geçmişi için) — yarış saatinde ÇALIŞTIRMA, gece/yarışlar bitince çalıştır. Girdi: C:/tmp/saf-model-egitim-verisi-16ozellik.json + saf18-model-egitim-verisi.json
// ROTAGANYAN — (özgün başlık) YENİ varsayılan model: 16 özellik + jokeyPIT + antrenorPIT + galopKalite + lastWon,
// ACC özellikleri YUMUŞAK yüzey kuralıyla. 2026-11-12 kullanıcı kararı ("tüm eksiklerimizi
// belirle ve ortadan kaldır", "kayıtlı accurace varsa değerlendirilecek").
// Yarış başına DB çağrısı YOK: ACC özellikleri yalnız Accurace arşivi + yarış tarihi/mesafe/pistinden
// hesaplandığı için canlı motorun AYNI fonksiyonlarıyla (closingResidual/lateSegmentSpeed/
// speedResidual) bellekte yeniden üretilir; PIT sinyalleri pit-seviye.actions.ts ile AYNI mantık.
// Girdi: C:/tmp/saf-model-egitim-verisi-16ozellik.json (canlı model popülasyonu, 1392 yarış),
// C:/tmp/saf18-model-egitim-verisi.json (galopKalite, segment verisi).
// Çıktı: genişleyen pencereli 5 kat CV raporu + v546-1-saf-weights.json (yedek alınarak) +
// Maiden/ŞARTLI19 segmentinin ACC kaymasını gidermek için yeniden eğitimi (yedek alınarak).
import fs from "node:fs";
import { db } from "./src/lib/db";
import { accuraceKosulari } from "./src/lib/accurace/loader";
import { closingResidual, lateSegmentSpeed, speedResidual, makeBaselineCache, makeClosingBaselineCache } from "./src/lib/accurace/features";
import type { Surface } from "./src/lib/accurace/types";

type Sig = { ad: string; raw: number | null; observed: boolean; reliability: number; evidenceObserved?: boolean };
type Satir = { raceId: string; tarih: string; winnerRunnerId: string | null; classType?: string; runners: { runnerId: string; no: number; kazandi: boolean; sinyaller: Sig[] }[] };
type MS = Map<string, { mu: number; sigma: number }>;

const AGIRLIK_DOSYA = "src/lib/methodology/weights/v546-1-saf-weights.json";
const SEG_B_DOSYA = "src/lib/methodology/weights/v546-1-saf-segment-dusuk-deneyim-acc.json";
const BASE = ["idmJokey", "h2hNetSkor", "hizDerecesi", "zeminToleransi", "zeminMesafeDeneyim", "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru", "sireOrani", "ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED", "PS_front", "PS_lone", "PS_closerFit", "jokeyFormuGenel"];
const YENI = [...BASE, "jokeyPIT", "antrenorPIT", "galopKalite", "lastWon"];

const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const bul = (r: Satir["runners"][number], ad: string) => r.sinyaller.find((s) => s.ad === ad);
const setSig = (r: Satir["runners"][number], s: Sig) => { const i = r.sinyaller.findIndex((x) => x.ad === s.ad); if (i >= 0) r.sinyaller[i] = s; else r.sinyaller.push(s); };

function muSigma(train: Satir[], ad: string) {
  let s = 0, n = 0; for (const r of train) for (const x of r.runners) { const g = bul(x, ad); if (g?.observed && g.raw != null) { s += g.raw; n++; } }
  const mu = n ? s / n : 0; let s2 = 0;
  for (const r of train) for (const x of r.runners) { const g = bul(x, ad); if (g?.observed && g.raw != null) s2 += (g.raw - mu) ** 2; }
  return { mu, sigma: n ? Math.sqrt(s2 / n) || 1 : 1 };
}
const vek = (x: Satir["runners"][number], f: string[], ms: MS) => f.map((ad) => { const g = bul(x, ad); if (!g?.observed || g.raw == null) return 0; const q = ms.get(ad)!; return g.reliability * (g.raw - q.mu) / q.sigma; });
function egit(train: Satir[], f: string[], ms: MS): number[] {
  const d = f.length;
  const X = train.map((r) => ({ x: r.runners.map((x) => vek(x, f, ms)), w: r.runners.findIndex((x) => x.kazandi) })).filter((q) => q.w >= 0);
  const w = new Float64Array(d), vel = new Float64Array(d);
  for (let ep = 0; ep < 800; ep++) {
    const g = new Float64Array(d);
    for (const q of X) {
      const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i] * w[i]; return s; }));
      for (let i = 0; i < q.x.length; i++) { const c = p[i] - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k] += c * q.x[i][k]; }
    }
    for (let k = 0; k < d; k++) { const gk = g[k] / X.length + 0.02 * w[k]; vel[k] = 0.9 * vel[k] - 0.08 * gk; w[k] += vel[k]; }
  }
  return Array.from(w);
}
function degerlendir(set: Satir[], skor: (x: Satir["runners"][number]) => number) {
  let t1 = 0, t3 = 0, ll = 0, n = 0;
  for (const r of set) {
    const kz = r.runners.findIndex((x) => x.kazandi); if (kz < 0) continue;
    const p = softmax(r.runners.map(skor)); const sr = p.map((v, i) => ({ i, v })).sort((a, b) => b.v - a.v);
    if (sr[0].i === kz) t1++; if (sr.slice(0, 3).some((q) => q.i === kz)) t3++; ll += -Math.log(Math.max(p[kz], 1e-15)); n++;
  }
  return { n, top1: n ? t1 / n : 0, top3: n ? t3 / n : 0, logLoss: n ? ll / n : 0 };
}

type Ev = { t: number[]; cum: number[] };
const evKur = (list: { t: number; won: number }[]): Ev => { list.sort((a, b) => a.t - b.t); const cum = [0]; for (const x of list) cum.push(cum[cum.length - 1] + x.won); return { t: list.map((x) => x.t), cum }; };
const bisect = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; };

async function main() {
  const d16 = JSON.parse(fs.readFileSync("C:/tmp/saf-model-egitim-verisi-16ozellik.json", "utf8")) as Satir[];
  const d18 = JSON.parse(fs.readFileSync("C:/tmp/saf18-model-egitim-verisi.json", "utf8")) as Satir[];

  // ── Meta: runner → tjk/jokey/antrenör; yarış → mesafe/pist/sınıf ──
  const tumRunnerId = [...new Set(d18.flatMap((r) => r.runners.map((x) => x.runnerId)))];
  const meta = new Map<string, { jockey: string | null; trainer: string | null; tjk: number | null; hp: number | null; kilo: number | null }>();
  for (let i = 0; i < tumRunnerId.length; i += 3000) { await new Promise((r) => setTimeout(r, 600)); for (const x of await db.runner.findMany({ where: { id: { in: tumRunnerId.slice(i, i + 3000) } }, select: { id: true, jockey: true, trainer: true, tjkAtId: true, hp: true, weight: true } })) meta.set(x.id, { jockey: x.jockey, trainer: x.trainer, tjk: x.tjkAtId, hp: x.hp, kilo: x.weight }); }
  const raceMeta = new Map((await db.race.findMany({ where: { id: { in: d18.map((r) => r.raceId) } }, select: { id: true, distance: true, surface: true, classType: true } })).map((r) => [r.id, r]));
  for (const r of d18) r.classType = raceMeta.get(r.raceId)?.classType;

  // ── TJK geçmiş satırları (HorseRaceHistoryCache; tarih < yarış günü) — "t*" aday özellikleri için (sitenin kendi kısıtlı geçmişi DEĞİL) ──
  console.log("TJK geçmiş önbelleği yükleniyor...");
  const tjkIdler = [...new Set([...meta.values()].map((m) => m.tjk).filter((v): v is number => v != null))];
  const gecmisT = new Map<number, { t: number; fin: number | null; jk: string | null; cls: string; hp: number | null }[]>();
  const trT = (d: string) => { const [g, a, y] = d.split("."); return Date.UTC(+y, +a - 1, +g); };
  const numT = (s: unknown) => { if (s == null) return null; const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
  const anah = (s: string | null | undefined) => { if (!s) return null; const q = String(s).toLocaleUpperCase("tr").split(/[. ]+/).filter(Boolean); return q.length < 2 ? null : q[0][0] + "." + q[q.length - 1]; };
  for (let i = 0; i < tjkIdler.length; i += 150) {
    await new Promise((r) => setTimeout(r, 700));
    for (const x of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkIdler.slice(i, i + 150) } }, select: { tjkAtId: true, rowsJson: true } })) gecmisT.set(x.tjkAtId, (x.rowsJson as { date?: string; finishPos?: string; jockey?: string; classType?: string; hp?: string }[]).filter((q) => q.date).map((q) => ({ t: trT(q.date!), fin: numT(q.finishPos), jk: anah(q.jockey), cls: String(q.classType ?? "").split("/")[0].replace(/\s+/g, " ").trim().toUpperCase(), hp: numT(q.hp) })).sort((a, b) => a.t - b.t));
  }
  console.log("TJK geçmişi bulunan at: " + gecmisT.size + " / " + tjkIdler.length);
  const hpTip: Record<string, number[]> = {};
  for (const rows of gecmisT.values()) for (const q of rows) if (q.hp != null && q.cls) (hpTip[q.cls] ??= []).push(q.hp);
  const sev: Record<string, number> = {}; for (const [k, v] of Object.entries(hpTip)) if (v.length >= 40) sev[k] = v.reduce((a, b) => a + b, 0) / v.length;
  const nrm = (c: string | null | undefined) => String(c ?? "").split("/")[0].replace(/\s+/g, " ").trim().toUpperCase();

  // ── ACC özelliklerini YUMUŞAK yüzey kuralıyla arşivden yeniden üret (canlı motorla AYNI çağrılar) ──
  console.log("Accurace arşivi yükleniyor...");
  const runs = await accuraceKosulari();
  const byTjk = new Map<number, typeof runs>();
  for (const r of runs) { const a = byTjk.get(r.tjk) ?? []; a.push(r); byTjk.set(r.tjk, a); }
  const baselineAt = makeBaselineCache(runs), closingBaselineAt = makeClosingBaselineCache(runs);
  const accYeni = new Map<string, { cr: Sig; la: Sig; sp: Sig }>();
  for (const race of d18) {
    const rm = raceMeta.get(race.raceId); if (!rm) continue;
    const target = { date: new Date(race.tarih + "T00:00:00.000Z"), length: rm.distance, surface: (rm.surface === "CIM" || rm.surface === "KUM" || rm.surface === "SENTETIK" ? rm.surface : null) as Surface | null };
    for (const x of race.runners) {
      const tjk = meta.get(x.runnerId)?.tjk;
      const g = tjk != null ? (byTjk.get(tjk) ?? []) : [];
      const cr = closingResidual(g, target, closingBaselineAt), la = lateSegmentSpeed(g, target), sp = speedResidual(g, target, baselineAt);
      accYeni.set(x.runnerId, {
        cr: { ad: "ACC_CLOSE_RES", raw: cr.observed ? cr.raw : null, observed: cr.observed, reliability: cr.reliability },
        la: { ad: "ACC_LATE", raw: la.observed ? la.raw : null, observed: la.observed, reliability: la.reliability },
        sp: { ad: "ACC_SPEED", raw: sp.observed ? sp.raw : null, observed: sp.observed, reliability: sp.reliability },
      });
    }
  }

  // ── PIT geçmiş endeksi (pit-seviye.actions.ts ile AYNI mantık, tek toplu okuma) ──
  console.log("PIT geçmiş yükleniyor...");
  const jL = new Map<string, { t: number; won: number }[]>(), tL = new Map<string, { t: number; won: number }[]>(), hL = new Map<number, { t: number; won: number }[]>();
  const hpL = new Map<number, { t: number; hp: number | null; kilo: number | null }[]>();
  const ajL = new Map<string, { t: number; won: number }[]>();
  let toplam = 0, kaz = 0, cursor: string | undefined;
  for (;;) {
    const batch = await db.runner.findMany({
      where: { scratched: false, race: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } },
      select: { id: true, no: true, jockey: true, trainer: true, tjkAtId: true, hp: true, weight: true, race: { select: { raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } },
      orderBy: { id: "asc" }, take: 10000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    for (const b of batch) {
      const t = b.race.raceDay.date.getTime(), won = b.race.result?.winnerNos.includes(b.no) ? 1 : 0; toplam++; kaz += won;
      if (b.jockey) (jL.get(b.jockey) ?? jL.set(b.jockey, []).get(b.jockey)!).push({ t, won });
      if (b.trainer) (tL.get(b.trainer) ?? tL.set(b.trainer, []).get(b.trainer)!).push({ t, won });
      if (b.tjkAtId != null) (hL.get(b.tjkAtId) ?? hL.set(b.tjkAtId, []).get(b.tjkAtId)!).push({ t, won });
      if (b.tjkAtId != null) (hpL.get(b.tjkAtId) ?? hpL.set(b.tjkAtId, []).get(b.tjkAtId)!).push({ t, hp: b.hp, kilo: b.weight });
      if (b.tjkAtId != null && b.jockey) { const ak = b.tjkAtId + "|" + b.jockey; (ajL.get(ak) ?? ajL.set(ak, []).get(ak)!).push({ t, won }); }
    }
    cursor = batch[batch.length - 1].id;
    await new Promise((r) => setTimeout(r, 600));
  }
  for (const v of hpL.values()) v.sort((a, b) => a.t - b.t);
  // Atın t'den ÖNCEKİ son (null olmayan) HP / kilo değeri (point-in-time)
  const oncekiDeger = (tjk: number | null | undefined, t: number, alan: "hp" | "kilo"): number | null => {
    if (tjk == null) return null; const v = hpL.get(tjk); if (!v) return null;
    for (let i = bisect(v.map((x) => x.t), t) - 1; i >= 0; i--) if (v[i][alan] != null) return v[i][alan];
    return null;
  };
  const ajEv = new Map([...ajL].map(([k, v]) => [k, evKur(v)]));
  const jEv = new Map([...jL].map(([k, v]) => [k, evKur(v)])), tEv = new Map([...tL].map(([k, v]) => [k, evKur(v)])), hEv = new Map([...hL].map(([k, v]) => [k, evKur(v)]));
  const genel = kaz / toplam;
  const seviye = (ev: Ev | undefined, t: number): number | null => { if (!ev) return null; const hi = bisect(ev.t, t), lo = bisect(ev.t, t - 365 * 86400000); const rd = hi - lo; return rd <= 0 ? null : (((ev.cum[hi] - ev.cum[lo]) + 20 * genel) / (rd + 20)) * 100; };

  const galopOf = new Map<string, Sig | undefined>();
  for (const r of d18) for (const x of r.runners) galopOf.set(x.runnerId, bul(x, "galopKalite"));

  // ── Varsayılan veri kümesini kur: B0(SERT, mevcut canlı) ve YENİ ──
  const sirali = [...d16].sort((a, b) => a.tarih.localeCompare(b.tarih));
  const eskiAcc = new Map<string, Sig[]>();
  for (const r of sirali) for (const x of r.runners) eskiAcc.set(x.runnerId, ["ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED"].map((a) => bul(x, a)!));
  const ort = (a: number[]) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : null);
  const akim = (yeniAcc: boolean) => sirali.map((r) => { const hpOrt = ort(r.runners.map((x) => meta.get(x.runnerId)?.hp).filter((v): v is number => v != null)), kiloOrt = ort(r.runners.map((x) => meta.get(x.runnerId)?.kilo).filter((v): v is number => v != null)); return ({ ...r, runners: r.runners.map((x) => {
    const c: Satir["runners"][number] = { ...x, sinyaller: x.sinyaller.map((s) => ({ ...s })) };
    const t = new Date(r.tarih + "T00:00:00.000Z").getTime(), m = meta.get(x.runnerId);
    // Handikap sinyalleri (yalnız hp dolu koşularda gözlemli; diğer koşularda "veri yok" = sıfır katkı)
    const hpVar = m?.hp != null && hpOrt != null, kiloVar = m?.kilo != null && kiloOrt != null;
    setSig(c, { ad: "hpRel", raw: hpVar ? m!.hp! - hpOrt! : null, observed: hpVar, reliability: 1 });
    setSig(c, { ad: "kiloRel", raw: kiloVar ? m!.kilo! - kiloOrt! : null, observed: kiloVar, reliability: 1 });
    const oncekiHp = oncekiDeger(m?.tjk, t, "hp"), oncekiKilo = oncekiDeger(m?.tjk, t, "kilo");
    setSig(c, { ad: "hpDelta", raw: m?.hp != null && oncekiHp != null ? m.hp - oncekiHp : null, observed: m?.hp != null && oncekiHp != null, reliability: 1 });
    setSig(c, { ad: "kiloDelta", raw: m?.kilo != null && oncekiKilo != null ? m.kilo - oncekiKilo : null, observed: m?.kilo != null && oncekiKilo != null, reliability: 1 });
    if (yeniAcc) { const a = accYeni.get(x.runnerId); if (a) { setSig(c, a.cr); setSig(c, a.la); setSig(c, a.sp); } }
    setSig(c, { ad: "jokeyPIT", raw: seviye(m?.jockey ? jEv.get(m.jockey) : undefined, t), observed: seviye(m?.jockey ? jEv.get(m.jockey) : undefined, t) != null, reliability: 1 });
    setSig(c, { ad: "antrenorPIT", raw: seviye(m?.trainer ? tEv.get(m.trainer) : undefined, t), observed: seviye(m?.trainer ? tEv.get(m.trainer) : undefined, t) != null, reliability: 1 });
    const hev = m?.tjk != null ? hEv.get(m.tjk) : undefined; const hi = hev ? bisect(hev.t, t) : 0;
    setSig(c, hev && hi > 0 ? { ad: "lastWon", raw: hev.cum[hi] - hev.cum[hi - 1], observed: true, reliability: 1 } : { ad: "lastWon", raw: null, observed: false, reliability: 1 });
    const g = galopOf.get(x.runnerId); setSig(c, g ? { ad: "galopKalite", raw: g.raw, observed: g.observed, reliability: 1 } : { ad: "galopKalite", raw: null, observed: false, reliability: 1 });
    return c;
  }) }); });
  const veriYum = akim(true);
  void eskiAcc;

  // ── 5 kat genişleyen pencere CV ──
  const gunler = [...new Set(sirali.map((s) => s.tarih))].sort();
  const kesim = [0.4, 0.52, 0.64, 0.76, 0.88].map((q) => gunler[Math.floor(gunler.length * q)]);
  const YENI22 = [...YENI, "hpRel", "kiloRel"];

  // ═══ Aday ham alanlar (Runner program alanları; yarış öncesi bilinen) ═══
  const tumIds = veriYum.flatMap((r) => r.runners.map((x) => x.runnerId));
  const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);
  const ex = new Map<string, { age: string | null; weight: number | null; recentForm: string | null; recentFormSurfaces: string | null; equipment: string | null; apprentice: boolean; jockeyChanged: boolean; sameJockey: boolean; startNo: number | null; tjkKgs: number | null }>();
  for (let i = 0; i < tumIds.length; i += 3000) { await new Promise((r) => setTimeout(r, 600)); for (const x of await db.runner.findMany({ where: { id: { in: tumIds.slice(i, i + 3000) } }, select: { id: true, age: true, weight: true, recentForm: true, recentFormSurfaces: true, equipment: true, apprentice: true, jockeyChanged: true, sameJockey: true, startNo: true, tjkKgs: true } })) ex.set(x.id, x); }
  const pos = (c: string) => (c >= "1" && c <= "9" ? +c : c === "0" ? 10 : null);
  for (const r of veriYum) {
    const rm = raceMeta.get(r.raceId); const surfCh = rm?.surface === "CIM" ? "C" : rm?.surface === "KUM" ? "K" : rm?.surface === "SENTETIK" ? "S" : "";
    const wts = r.runners.map((x) => ex.get(x.runnerId)?.weight).filter((v): v is number => v != null), wm = wts.length ? avg(wts) : null;
    const sts = r.runners.map((x) => ex.get(x.runnerId)?.startNo).filter((v): v is number => v != null), sm = sts.length ? avg(sts) : null;
    for (const x of r.runners) {
      const e = ex.get(x.runnerId);
      const S = (ad: string, raw: number | null | undefined) => setSig(x, { ad, raw: raw ?? null, observed: raw != null && Number.isFinite(raw), reliability: 1 });
      const rf = e?.recentForm ?? ""; const ps = [0, 1, 2, 3, 4, 5].map((i) => (i < rf.length ? pos(rf[i]) : null));
      ps.forEach((p, i) => S("fp" + (i + 1), p));
      const kn = ps.filter((p): p is number => p != null);
      S("fMean", kn.length ? avg(kn) : null); S("fWins", kn.length ? kn.filter((p) => p === 1).length : null); S("fTop3", kn.length ? kn.filter((p) => p <= 3).length : null);
      const tk = (e?.age ?? "").trim().split(/\s+/); S("ageN", parseInt(tk[0]) || null); S("sexE", tk[2] ? (tk[2] === "e" ? 1 : 0) : null); S("sexA", tk[2] ? (tk[2] === "a" ? 1 : 0) : null);
      S("wtRel", e?.weight != null && wm != null ? e.weight - wm : null); S("startRel", e?.startNo != null && sm != null ? e.startNo - sm : null);
      S("apprentice", e ? (e.apprentice ? 1 : 0) : null); S("jockeyChanged", e ? (e.jockeyChanged ? 1 : 0) : null); S("sameJockey", e ? (e.sameJockey ? 1 : 0) : null);
      S("kgsLog", e?.tjkKgs != null ? Math.log1p(e.tjkKgs) : null);
      { const yn = parseInt(tk[0]) || null; S("sexM", tk[2] ? (["e", "a", "g"].includes(tk[2]) ? 1 : 0) : null); S("age5p", yn != null ? (yn >= 5 ? 1 : 0) : null);
        const m2 = meta.get(x.runnerId), tt = new Date(r.tarih + "T00:00:00.000Z").getTime();
        const hev2 = m2?.tjk != null ? hEv.get(m2.tjk) : undefined, hi2 = hev2 ? bisect(hev2.t, tt) : 0;
        S("kStarts", m2?.tjk != null ? hi2 : null); S("kWinRate", hev2 && hi2 >= 3 ? hev2.cum[hi2] / hi2 : null);
        const aev = m2?.tjk != null && m2?.jockey ? ajEv.get(m2.tjk + "|" + m2.jockey) : undefined, ai = aev ? bisect(aev.t, tt) : 0;
        S("ajRides", m2?.tjk != null && m2?.jockey ? ai : null); S("ajWins", m2?.tjk != null && m2?.jockey ? (aev ? aev.cum[ai] : 0) : null); }
      { const m3 = meta.get(x.runnerId), tt3 = new Date(r.tarih + "T00:00:00.000Z").getTime();
        const rows3 = (m3?.tjk != null ? gecmisT.get(m3.tjk) : undefined)?.filter((q) => q.t < tt3) ?? [];
        const fins = rows3.map((q) => q.fin).filter((v): v is number => v != null);
        S("tStarts", m3?.tjk != null && gecmisT.has(m3.tjk) ? rows3.length : null);
        S("tWinRate", rows3.length >= 3 ? fins.filter((v) => v === 1).length / rows3.length : null);
        S("tTop3Rate", rows3.length >= 3 ? fins.filter((v) => v <= 3).length / rows3.length : null);
        const son3 = rows3.slice(-3).map((q) => q.fin).filter((v): v is number => v != null); S("tOrt3", son3.length ? avg(son3) : null);
        S("tSon", rows3.length ? rows3[rows3.length - 1].fin : null);
        const jk3 = anah(m3?.jockey); const aj3 = jk3 ? rows3.filter((q) => q.jk === jk3) : [];
        S("tAjN", m3?.tjk != null && jk3 && gecmisT.has(m3.tjk) ? aj3.length : null); S("tAjW", m3?.tjk != null && jk3 && gecmisT.has(m3.tjk) ? aj3.filter((q) => q.fin === 1).length : null); }
      { const m4 = meta.get(x.runnerId), tt4 = new Date(r.tarih + "T00:00:00.000Z").getTime();
        const rows4 = (m4?.tjk != null ? gecmisT.get(m4.tjk) : undefined)?.filter((q) => q.t < tt4) ?? [];
        const son = rows4.length ? rows4[rows4.length - 1] : undefined; const jk4 = anah(m4?.jockey);
        S("sameJockeyT", son && jk4 && son.jk ? (son.jk === jk4 ? 1 : 0) : null);
        const curK = nrm(raceMeta.get(r.raceId)?.classType); const cv4 = sev[curK]; const pv = son ? sev[son.cls] : undefined; const dlt = cv4 != null && pv != null ? cv4 - pv : null;
        S("classDelta", dlt); S("classDrop", dlt != null ? (dlt <= -3 ? 1 : 0) : null);
        const sf = son?.fin ?? null;
        S("dropTop3", dlt != null && sf != null ? (dlt <= -3 && sf <= 3 ? 1 : 0) : null);
        S("riseBad", dlt != null && sf != null ? (dlt >= 3 && sf >= 7 ? 1 : 0) : null);
        const ayniSinif = rows4.filter((q) => q.cls === curK);
        S("sinifKazanma", rows4.length ? (ayniSinif.some((q) => q.fin === 1) ? 1 : 0) : null); }
      const sf = (e?.recentFormSurfaces ?? "").split("").filter((c) => "CKS".includes(c)); S("surfMatch", sf.length && surfCh ? sf.filter((c) => c === surfCh).length / sf.length : null);
      S("eqN", e?.equipment ? e.equipment.split(",").filter(Boolean).length : 0);
    }
  }
  const FORM = ["fp1", "fp2", "fp3", "fp4", "fp5", "fp6", "fMean", "fWins", "fTop3"], STAT = ["ageN", "sexE", "sexA", "wtRel", "startRel"], FLAG = ["apprentice", "jockeyChanged", "sameJockey"], DIG = ["kgsLog", "surfMatch", "eqN"];
  const CANDS = [...FORM, ...STAT, ...FLAG, ...DIG]; const F22 = YENI22;
  const grupOf = (id: string) => { const c = (raceMeta.get(id)?.classType ?? "").toUpperCase(); if (c.includes("HANDIKAP")) return 0; if (c.includes("MAIDEN") || c.includes("ŞARTLI 19")) return 3; if (c.includes("ŞARTLI 1") || c.includes("ŞARTLI 27")) return 4; if (c.includes("ŞARTLI") || c.includes("SARTLI")) return 1; return 2; };
  const GN = ["Handikap", "ŞARTLI 2-5", "KV/Satış/Grup/Diğer", "Maiden/ŞARTLI 19", "ŞARTLI 1/27"];
  // doluluk raporu (canlıda da dolu olacak mı?)
  { const n = veriYum.reduce((p, r) => p + r.runners.length, 0); console.log("DOLULUK (gözlemli at oranı): " + CANDS.map((c) => { let o = 0; for (const r of veriYum) for (const x of r.runners) if (bul(x, c)?.observed) o++; return c + " %" + (o / n * 100).toFixed(0); }).join(" | ")); }

  type RS = { ll: number; t1: number; t3: number; fold: number };
  const kosu = (fs2: string[], folds: number[]) => {
    const out = new Map<string, RS>();
    for (const k of folds) {
      const bas = kesim[k], bit = k === 4 ? "9999" : kesim[k + 1];
      const train = veriYum.filter((x) => x.tarih < bas), test = veriYum.filter((x) => x.tarih >= bas && x.tarih < bit);
      const ms: MS = new Map(fs2.map((x) => [x, muSigma(train, x)])); const b = egit(train, fs2, ms);
      for (const r of test) {
        const kz = r.runners.findIndex((x) => x.kazandi); if (kz < 0) continue;
        const p = softmax(r.runners.map((x) => { const v = vek(x, fs2, ms); let t = 0; for (let i = 0; i < v.length; i++) t += v[i] * b[i]; return t; }));
        const sr = p.map((v, i) => ({ i, v })).sort((a, b2) => b2.v - a.v);
        out.set(r.raceId, { ll: -Math.log(Math.max(p[kz], 1e-15)), t1: sr[0].i === kz ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === kz) ? 1 : 0, fold: k });
      }
    }
    return out;
  };
  let seed = 101; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ciOf = (dif: number[]) => { const n = dif.length; const bs: number[] = []; for (let b = 0; b < 2000; b++) { let q = 0; for (let i = 0; i < n; i++) q += dif[Math.floor(rnd() * n)]; bs.push(q / n); } bs.sort((p, q) => p - q); return { m: avg(dif), lo: bs[49], hi: bs[1949] }; };
  const dl = (m: Map<string, RS>, baz: Map<string, RS>) => { const ids = [...baz.keys()]; return ciOf(ids.map((id) => m.get(id)!.ll - baz.get(id)!.ll)); };
  const ozet = (m: Map<string, RS>) => { const v = [...m.values()]; return "Top1 %" + (avg(v.map((x) => x.t1)) * 100).toFixed(1) + " | Top3 %" + (avg(v.map((x) => x.t3)) * 100).toFixed(1) + " | LL " + avg(v.map((x) => x.ll)).toFixed(4); };

  // ═══════════════ KAYIP ANALİZİ — model neyi yanlış tartıyor? (SALT-OKUMA) ═══════════════
  // 1) Güncel AGF'siz modelin (21 sinyal) çıkış-dışı (5 ardışık blok, kendisi hariç eğitilmiş) puanları.
  // 2) Her faktör AİLESİNİN saha içi yönlü yüzdeliği modelin puanına 1 parametreyle (β) EKLENİR; β eğitim bloklarında, ΔLogLoss sınama bloğunda ölçülür.
  //    ΔLL < 0 ve GA sıfırı dışlıyorsa: model o aileyi EKSİK/YANLIŞ tartıyor. ≈0 ise model o aileyi zaten doğru taşıyor.
  const OLU = ["idmJokey", "sonIdmanSprint", "takiDegisikligi", "PS_lone"];
  const LIVE21 = [...F22, "fMean", "kgsLog", "sexE"].filter((x) => !OLU.includes(x));
  const sirala = [...veriYum].sort((a, b) => a.tarih.localeCompare(b.tarih));
  const NB = 5, bsz = Math.ceil(sirala.length / NB);
  type Rec = { tip?: string; g: number; blok: number; kz: number; s: number[]; runners: (typeof veriYum)[number]["runners"] };
  const kayit: Rec[] = [];
  for (let b = 0; b < NB; b++) {
    const test = sirala.slice(b * bsz, (b + 1) * bsz), train = [...sirala.slice(0, b * bsz), ...sirala.slice((b + 1) * bsz)];
    const ms: MS = new Map(LIVE21.map((x) => [x, muSigma(train, x)])); const w = egit(train, LIVE21, ms);
    for (const r of test) { const kz = r.runners.findIndex((x) => x.kazandi); if (kz < 0) continue; kayit.push({ tip: String(raceMeta.get(r.raceId)?.classType ?? "?"), g: grupOf(r.raceId), blok: b, kz, runners: r.runners, s: r.runners.map((x) => { const v = vek(x, LIVE21, ms); let t = 0; for (let i = 0; i < v.length; i++) t += v[i] * w[i]; return t; }) }); }
  }
  console.log("çıkış-dışı model puanı: " + kayit.length + " yarış");
  // ── yönlü yüzdelikler ──
  const FAM: Record<string, [string, 1 | -1][]> = {
    "FORM (son 6, son derece, kariyer%)": [["fMean", -1], ["tSon", -1], ["tWinRate", 1], ["tTop3Rate", 1]],
    "SINIF/HP/KİLO": [["hpRel", 1], ["kiloRel", 1]],
    "HIZ (hız derecesi, H2H)": [["hizDerecesi", 1], ["h2hNetSkor", 1]],
    "ACCURACE (geç, kapanış, hız)": [["ACC_LATE", 1], ["ACC_CLOSE_RES", 1], ["ACC_SPEED", 1]],
    "TEMPO (öne çıkma, arkadan gelme, gidişat)": [["PS_front", -1], ["PS_closerFit", -1], ["yarisGidisatiSkoru", 1]],
    "JOKEY/ANTRENÖR (PIT, bu jokeyle kazanma)": [["jokeyPIT", 1], ["antrenorPIT", 1], ["tAjW", 1]],
    "MEDYAN/PROFİL SKORU (13 sağlam faktör)": [["fMean", -1], ["tSon", -1], ["tWinRate", 1], ["tTop3Rate", 1], ["hpRel", 1], ["kiloRel", 1], ["hizDerecesi", 1], ["h2hNetSkor", 1], ["ACC_LATE", 1], ["ACC_CLOSE_RES", 1], ["ACC_SPEED", 1], ["yarisGidisatiSkoru", 1], ["tAjW", 1]],
  };
  const pctOf = (rec: Rec, ad: string, yon: 1 | -1) => {
    const vals = rec.runners.map((x) => { const g = bul(x, ad); return g?.observed && g.raw != null ? (g.raw as number) : null; });
    const v = vals.filter((q): q is number => q != null); const ok = v.length >= 4 && new Set(v).size >= 2;
    return vals.map((q) => { if (!ok || q == null) return null; const lo = v.filter((z) => z < q).length, eq = v.filter((z) => z === q).length; const p = (lo + (eq - 1) / 2) / (v.length - 1); return yon > 0 ? p : 1 - p; });
  };
  const famX = (rec: Rec, fam: [string, 1 | -1][]) => { const ps = fam.map(([ad, y]) => pctOf(rec, ad, y)); return rec.runners.map((_, i) => { const v = ps.map((p) => p[i]).filter((q): q is number => q != null); return (v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0.5) - 0.5; }); };
  const lse = (a: number[]) => { const m = Math.max(...a); return m + Math.log(a.reduce((s, v) => s + Math.exp(v - m), 0)); };
  const nll = (s: number[], kz: number) => lse(s) - s[kz];
  const fitBeta = (RS: { s: number[]; x: number[]; kz: number }[]) => { let b = 0; for (let it = 0; it < 25; it++) { let g = 0, h = 1e-9; for (const r of RS) { const sb = r.s.map((v, i) => v + b * r.x[i]); const m = Math.max(...sb); const e = sb.map((v) => Math.exp(v - m)); const z = e.reduce((a, c) => a + c, 0); const p = e.map((v) => v / z); const ex = p.reduce((a, v, i) => a + v * r.x[i], 0), ex2 = p.reduce((a, v, i) => a + v * r.x[i] * r.x[i], 0); g += r.x[r.kz] - ex; h += ex2 - ex * ex; } b += g / h; if (!isFinite(b)) return 0; b = Math.max(-30, Math.min(30, b)); } return b; };
  let sd = 31; const rn = () => (sd = (sd * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ciM = (d: number[]) => { const b: number[] = []; for (let k = 0; k < 800; k++) { let q = 0; for (let i = 0; i < d.length; i++) q += d[Math.floor(rn() * d.length)]; b.push(q / d.length); } b.sort((x, y) => x - y); return [b[20], b[779]]; };
  const GNN = ["Handikap", "ŞARTLI 2-5", "KV/Satış/Grup/Diğer", "Maiden/ŞARTLI 19", "ŞARTLI 1/27"];
  console.log("\n=== AİLE EKLEME TESTİ: modelin puanına aile yüzdeliği (β) eklenince ΔLogLoss (negatif = iyileşme; sınama bloğunda, β eğitim bloklarında) ===");
  console.log("aile".padEnd(46) + "β(tüm)  | TÜM ΔLL [%95 GA]            | " + GNN.slice(0, 4).map((g) => g.slice(0, 10).padEnd(10)).join(" | "));
  const FX = new Map<string, number[][]>(); for (const [ad, fam] of Object.entries(FAM)) FX.set(ad, kayit.map((r) => famX(r, fam)));
  for (const [ad] of Object.entries(FAM)) {
    const X = FX.get(ad)!; const farklar: number[] = []; const grup: number[][] = [[], [], [], [], []]; const betalar: number[] = [];
    for (let b = 0; b < NB; b++) {
      const tr = kayit.map((r, i) => ({ r, i })).filter((q) => q.r.blok !== b), te = kayit.map((r, i) => ({ r, i })).filter((q) => q.r.blok === b);
      const beta = fitBeta(tr.map((q) => ({ s: q.r.s, x: X[q.i], kz: q.r.kz }))); betalar.push(beta);
      for (const q of te) { const d = nll(q.r.s.map((v, i) => v + beta * X[q.i][i]), q.r.kz) - nll(q.r.s, q.r.kz); farklar.push(d); grup[q.r.g].push(d); }
    }
    const [lo, hi] = ciM(farklar); const m = farklar.reduce((a, c) => a + c, 0) / farklar.length;
    const gs = grup.slice(0, 4).map((a) => { if (a.length < 40) return "–".padEnd(10); const mm = a.reduce((x, y) => x + y, 0) / a.length; const [l2, h2] = ciM(a); return ((mm >= 0 ? "+" : "") + mm.toFixed(4) + (h2 < 0 ? "✔" : l2 > 0 ? "✘" : "")).padEnd(10); });
    console.log(ad.padEnd(46) + (betalar.reduce((a, c) => a + c, 0) / NB).toFixed(2).padStart(6) + "  | " + ((m >= 0 ? "+" : "") + m.toFixed(4) + " [" + lo.toFixed(4) + ", " + hi.toFixed(4) + "]" + (hi < 0 ? " ✔ EKSİK" : lo > 0 ? " ✘ ZARARLI" : "")).padEnd(34) + "| " + gs.join(" | "));
  }
  // ── Model hatası kimde? İlk-1 yanlış seçilirken / kazanan kaçırılırken ailelerin durumu ──
  console.log("\n=== HATA TEŞHİSİ: ailede kazananın ve modelin 1. seçiminin yüzdeliği (0.50 = sahanın ortası; ① kazanan kaçırıldığında kazananın ② model 1.si kaybedince onun) ===");
  console.log("aile".padEnd(46) + "kazanan(tümü) | kazanan(model KAÇIRDI,sıra>3) | model 1.si KAYBEDİNCE | model 1.si KAZANINCA");
  for (const [ad] of Object.entries(FAM)) {
    const X = FX.get(ad)!; const a: number[] = [], k: number[] = [], l: number[] = [], w: number[] = [];
    kayit.forEach((r, i) => { const x = X[i].map((v) => v + 0.5); const top = r.s.indexOf(Math.max(...r.s)); const rank = r.s.filter((v) => v > r.s[r.kz]).length + 1; a.push(x[r.kz]); if (rank > 3) k.push(x[r.kz]); if (top === r.kz) w.push(x[top]); else l.push(x[top]); });
    const mm = (q: number[]) => (q.reduce((s, v) => s + v, 0) / Math.max(q.length, 1)).toFixed(3);
    console.log(ad.padEnd(46) + mm(a).padStart(8) + "      | " + (mm(k) + " (n=" + k.length + ")").padStart(26) + "         | " + (mm(l) + " (n=" + l.length + ")").padStart(14) + "      | " + mm(w) + " (n=" + w.length + ")");
  }
  // ═══════════ SAHA BÜYÜKLÜĞÜ DAHİL YENİDEN İNCELEME ═══════════
  const SB = (n: number) => (n <= 9 ? 0 : n <= 12 ? 1 : 2); const SBN = ["≤9 at", "10-12 at", "13+ at"];
  const idx = (f: (r: Rec) => boolean) => kayit.map((r, i) => ({ r, i })).filter((q) => f(q.r));
  console.log("\n######## SAHA BÜYÜKLÜĞÜ DAHİL ########\nYarış sayısı: " + SBN.map((nm, b) => nm + " " + kayit.filter((r) => SB(r.runners.length) === b).length).join(" | "));
  // B) kalibrasyon: modelin puanı saha büyüklüğüne göre doğru ölçekli mi? (s → s·(1+b); b>0 model az-emin, b<0 aşırı-emin)
  console.log("\n=== B) MODEL KALİBRASYONU (çıkış-dışı puan, saha bazında ölçek b: >0 az-emin, <0 aşırı-emin) ===");
  for (let b = 0; b < 3; b++) { const q = idx((r) => SB(r.runners.length) === b); const RS = q.map(({ r }) => { const m = r.s.reduce((a, c) => a + c, 0) / r.s.length; return { s: r.s, x: r.s.map((v) => v - m), kz: r.kz }; }); const bb = fitBeta(RS); const d = RS.map((r) => nll(r.s.map((v, i) => v + bb * r.x[i]), r.kz) - nll(r.s, r.kz)); const [lo, hi] = ciM(d); console.log(SBN[b].padEnd(10) + "n=" + String(q.length).padStart(4) + " | ölçek b=" + (bb >= 0 ? "+" : "") + bb.toFixed(2) + " | ΔLL(örnek-içi) " + (d.reduce((a, c) => a + c, 0) / d.length).toFixed(4) + " [" + lo.toFixed(4) + "," + hi.toFixed(4) + "]"); }
  // C) aile ekleme ΔLL — saha bazında
  console.log("\n=== C) AİLE EKLEME ΔLL (blok-CV β) — SAHA BÜYÜKLÜĞÜNE GÖRE (negatif=iyileşme; ✔ GA sıfırı dışlıyor) ===");
  console.log("aile".padEnd(46) + SBN.map((s) => s.padEnd(22)).join(""));
  for (const [ad] of Object.entries(FAM)) {
    const X = FX.get(ad)!; const per: number[][] = [[], [], []];
    for (let b = 0; b < NB; b++) { const tr = kayit.map((r, i) => ({ r, i })).filter((q) => q.r.blok !== b), te = kayit.map((r, i) => ({ r, i })).filter((q) => q.r.blok === b); const beta = fitBeta(tr.map((q) => ({ s: q.r.s, x: X[q.i], kz: q.r.kz }))); for (const q of te) per[SB(q.r.runners.length)].push(nll(q.r.s.map((v, i) => v + beta * X[q.i][i]), q.r.kz) - nll(q.r.s, q.r.kz)); }
    console.log(ad.padEnd(46) + per.map((a) => { const m = a.reduce((x, y) => x + y, 0) / a.length; const [l, h] = ciM(a); return ((m >= 0 ? "+" : "") + m.toFixed(4) + (h < 0 ? "✔" : l > 0 ? "✘" : "")).padEnd(22); }).join(""));
  }
  // D) tekil faktörlerde kazananın yönlü yüzdeliği — saha bazında (0.50 = ayırt etmez)
  console.log("\n=== D) KAZANANIN YÖNLÜ YÜZDELİĞİ (tek faktör) — SAHA BÜYÜKLÜĞÜNE GÖRE (0.50=ayırt etmez) ===");
  const TEK: [string, string, 1 | -1][] = [["Son 6 derece ort.", "fMean", -1], ["Son yarış derecesi", "tSon", -1], ["Kariyer kazanma%", "tWinRate", 1], ["Kariyer ilk-3%", "tTop3Rate", 1], ["HP", "hpRel", 1], ["Kilo", "kiloRel", 1], ["Hız derecesi", "hizDerecesi", 1], ["H2H net skor", "h2hNetSkor", 1], ["Accurace GEÇ", "ACC_LATE", 1], ["Accurace kapanış", "ACC_CLOSE_RES", 1], ["Accurace hız", "ACC_SPEED", 1], ["Tempo: öne çıkma", "PS_front", -1], ["Tempo: arkadan gelme", "PS_closerFit", -1], ["Yarış gidişatı", "yarisGidisatiSkoru", 1], ["Jokey PIT", "jokeyPIT", 1], ["Antrenör PIT", "antrenorPIT", 1], ["Bu jokeyle kazanma", "tAjW", 1]];
  console.log("faktör".padEnd(26) + SBN.map((s) => s.padEnd(18)).join("") + "| MODEL kazanan yüzdeliği (≤9/10-12/13+)");
  for (const [ad, kod, y] of TEK) {
    const v: number[][] = [[], [], []]; const mv: number[][] = [[], [], []];
    for (const r of kayit) { const p = pctOf(r, kod, y)[r.kz]; if (p != null) v[SB(r.runners.length)].push(p); }
    console.log(ad.padEnd(26) + v.map((a) => (a.length < 30 ? "–" : a.reduce((x, z) => x + z, 0) / a.length).toString().slice(0, 5).padEnd(8) + ("n=" + a.length).padEnd(10)).join(""));
  }
  { const mv: number[][] = [[], [], []]; for (const r of kayit) { const rank = r.s.filter((v) => v > r.s[r.kz]).length; mv[SB(r.runners.length)].push(1 - rank / (r.runners.length - 1)); } console.log("MODEL (kazananın model yüzdeliği)".padEnd(26) + mv.map((a) => (a.reduce((x, z) => x + z, 0) / a.length).toFixed(3).padEnd(18)).join("")); }
  // E) tip etkisi, saha büyüklüğünden ARINDIRILMIŞ: gözlenen ilk-3 − (saha-grubu taban oranı)
  console.log("\n=== E) KOŞU TİPİ — SAHA ARINDIRILMIŞ (gözlenen ilk-3 isabeti − aynı büyüklükteki sahaların genel oranı; + iyi, − kötü) ===");
  const SB5 = (n: number) => Math.min(Math.floor((n - 5) / 2), 5); const taban = new Map<number, [number, number]>(); const t3of = (r: Rec) => (r.s.filter((v) => v > r.s[r.kz]).length < 3 ? 1 : 0);
  for (const r of kayit) { const k = SB5(r.runners.length), c = taban.get(k) ?? [0, 0]; c[0] += t3of(r); c[1]++; taban.set(k, c); }
  const grT = new Map<string, Rec[]>(); for (const r of kayit) { const t = (r.tip ?? "?").split("/")[0].replace(/s+/g, " ").trim().toUpperCase(); const a = grT.get(t) ?? []; a.push(r); grT.set(t, a); }
  console.log("tip".padEnd(20) + "n   | ham ilk3 | beklenen(saha) | FARK(puan) [GA]");
  for (const [t, a] of [...grT.entries()].filter(([, a]) => a.length >= 40).sort((x, y) => y[1].length - x[1].length)) { const d = a.map((r) => t3of(r) - taban.get(SB5(r.runners.length))![0] / taban.get(SB5(r.runners.length))![1]); const m = d.reduce((x, y) => x + y, 0) / d.length; const [l, h] = ciM(d); const ham = a.reduce((x, r) => x + t3of(r), 0) / a.length; console.log(t.padEnd(20) + String(a.length).padStart(4) + " | %" + (ham * 100).toFixed(1).padStart(5) + "    | %" + ((ham - m) * 100).toFixed(1).padStart(5) + "        | " + (m >= 0 ? "+" : "") + (m * 100).toFixed(1) + " [" + (l * 100).toFixed(1) + "," + (h * 100).toFixed(1) + "]" + (h < 0 ? " ✘ GERÇEKTEN KÖTÜ" : l > 0 ? " ✔ GERÇEKTEN İYİ" : " (saha etkisiyle açıklanır)")); }
  process.exit(0);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
