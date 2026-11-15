// SALT-OKUMA — GENİŞ ÖRNEKLİ test: jokeyin SON DÖNEM formu, jokeyin 365 günlük seviyesinin ÖTESİNDE modele bilgi katıyor mu?
// Neden ayrı araç: tam 22 sinyalli CV yalnız 16 Ağu sonrası 1541 yarışa dayanır (galop/ACC/tempo anlık görüntüleri o tarihte başlıyor).
// Burada DB'deki TÜM sonuçlanmış yarışlar (Mart→Kasım 2026, ~4000+) kullanılır; taban yalnız YENİDEN KURULABİLEN sinyallerdir:
//   jokeyPIT, antrenorPIT, lastWon, fMean, kgsLog, sexE, hpRel, kiloRel, dususDelta  (canlı modelin aynı tanımları, point-in-time).
// Aday: jokeySon{30,60,90} (büzülmeli), jokeyFark{30,60,90} (= son dönem − 365 gün). Protokol: 5 kat genişleyen pencere, bootstrap %95 GA.
// Yarış saatinde ÇALIŞTIRMA (Runner tablosunu tamamen tarar).
import { db } from "./src/lib/db";
import { sinifDususu, oncekiYarisSinifi, formOrtalamasi } from "./src/lib/methodology/ham-alan-sinyalleri";

type Sig = { ad: string; raw: number | null; observed: boolean };
type R = { raceId: string; tarih: string; runners: { kazandi: boolean; s: Map<string, Sig> }[] };
type Ev = { t: number[]; cum: number[] };
const evKur = (list: { t: number; won: number }[]): Ev => { list.sort((a, b) => a.t - b.t); const cum = [0]; for (const x of list) cum.push(cum[cum.length - 1] + x.won); return { t: list.map((x) => x.t), cum }; };
const bisect = (a: number[], x: number) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < x) lo = m + 1; else hi = m; } return lo; };
const softmax = (s: number[]) => { const m = Math.max(...s); const e = s.map((x) => Math.exp(x - m)); const z = e.reduce((a, b) => a + b, 0); return e.map((x) => x / z); };
const avg = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);
const GUN = 86400000;

async function main() {
  // ── 1) Tüm sonuçlanmış yarışlar + koşucular ──
  type Rn = { id: string; no: number; jockey: string | null; trainer: string | null; tjk: number | null; hp: number | null; kilo: number | null; form: string | null; age: string | null; kgs: number | null; raceId: string; t: number; won: number; cls: string | null };
  const all: Rn[] = []; const raceTarih = new Map<string, string>();
  let cursor: string | undefined;
  for (;;) {
    const batch = await db.runner.findMany({
      where: { scratched: false, race: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: ["karma", "perak-malezya"] } } } } },
      select: { id: true, no: true, jockey: true, trainer: true, tjkAtId: true, hp: true, weight: true, recentForm: true, age: true, tjkKgs: true, raceId: true, race: { select: { classType: true, raceDay: { select: { date: true } }, result: { select: { winnerNos: true } } } } },
      orderBy: { id: "asc" }, take: 10000, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
    });
    if (!batch.length) break;
    for (const b of batch) {
      const t = b.race.raceDay.date.getTime();
      all.push({ id: b.id, no: b.no, jockey: b.jockey, trainer: b.trainer, tjk: b.tjkAtId, hp: b.hp, kilo: b.weight, form: b.recentForm, age: b.age, kgs: b.tjkKgs, raceId: b.raceId, t, won: b.race.result?.winnerNos.includes(b.no) ? 1 : 0, cls: b.race.classType });
      raceTarih.set(b.raceId, b.race.raceDay.date.toISOString().slice(0, 10));
    }
    cursor = batch[batch.length - 1].id; await new Promise((r) => setTimeout(r, 400));
  }
  console.log("koşucu:", all.length, "yarış:", raceTarih.size);
  // ── 2) PIT endeksleri (pit-seviye.actions.ts mantığı) ──
  const jL = new Map<string, { t: number; won: number }[]>(), tL = new Map<string, { t: number; won: number }[]>(), hL = new Map<number, { t: number; won: number }[]>();
  let kaz = 0; for (const b of all) { kaz += b.won;
    if (b.jockey) (jL.get(b.jockey) ?? jL.set(b.jockey, []).get(b.jockey)!).push({ t: b.t, won: b.won });
    if (b.trainer) (tL.get(b.trainer) ?? tL.set(b.trainer, []).get(b.trainer)!).push({ t: b.t, won: b.won });
    if (b.tjk != null) (hL.get(b.tjk) ?? hL.set(b.tjk, []).get(b.tjk)!).push({ t: b.t, won: b.won }); }
  const genel = kaz / all.length;
  const jEv = new Map([...jL].map(([k, v]) => [k, evKur(v)])), tEv = new Map([...tL].map(([k, v]) => [k, evKur(v)])), hEv = new Map([...hL].map(([k, v]) => [k, evKur(v)]));
  const seviye = (ev: Ev | undefined, t: number): number | null => { if (!ev) return null; const hi = bisect(ev.t, t), lo = bisect(ev.t, t - 365 * GUN); const rd = hi - lo; return rd <= 0 ? null : (((ev.cum[hi] - ev.cum[lo]) + 20 * genel) / (rd + 20)) * 100; };
  // ── 3) TJK geçmiş satırları (önceki yarış sınıfı için) ──
  const tjkIdler = [...new Set(all.map((b) => b.tjk).filter((v): v is number => v != null))];
  const gecmis = new Map<number, unknown[]>();
  for (let i = 0; i < tjkIdler.length; i += 150) { await new Promise((r) => setTimeout(r, 500)); for (const x of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: tjkIdler.slice(i, i + 150) } }, select: { tjkAtId: true, rowsJson: true } })) gecmis.set(x.tjkAtId, x.rowsJson as unknown[]); }
  console.log("geçmiş önbelleği:", gecmis.size, "/", tjkIdler.length);
  // ── 4) Özellik tablosu ──
  const byRace = new Map<string, Rn[]>(); for (const b of all) (byRace.get(b.raceId) ?? byRace.set(b.raceId, []).get(b.raceId)!).push(b);
  const veri: R[] = [];
  for (const [raceId, rs] of byRace) {
    if (rs.length < 4 || rs.reduce((p, q) => p + q.won, 0) < 1) continue;
    const hpO = rs.map((x) => x.hp).filter((v): v is number => v != null), kiloO = rs.map((x) => x.kilo).filter((v): v is number => v != null);
    const hpM = hpO.length ? avg(hpO) : null, kiloM = kiloO.length ? avg(kiloO) : null;
    const runners = rs.map((x) => {
      const s = new Map<string, Sig>(); const S = (ad: string, raw: number | null) => s.set(ad, { ad, raw, observed: raw != null && Number.isFinite(raw) });
      const t = x.t;
      S("jokeyPIT", seviye(x.jockey ? jEv.get(x.jockey) : undefined, t)); S("antrenorPIT", seviye(x.trainer ? tEv.get(x.trainer) : undefined, t));
      const hev = x.tjk != null ? hEv.get(x.tjk) : undefined; const hi = hev ? bisect(hev.t, t) : 0;
      S("lastWon", hev && hi > 0 ? hev.cum[hi] - hev.cum[hi - 1] : null);
      S("fMean", formOrtalamasi(x.form ?? undefined)); S("kgsLog", x.kgs != null ? Math.log1p(x.kgs) : null);
      const tk = (x.age ?? "").trim().split(/\s+/); S("sexE", tk[2] ? (tk[2] === "e" ? 1 : 0) : null);
      S("hpRel", x.hp != null && hpM != null ? x.hp - hpM : null); S("kiloRel", x.kilo != null && kiloM != null ? x.kilo - kiloM : null);
      const rows = x.tjk != null ? (gecmis.get(x.tjk) as { date?: string; classType?: string }[] | undefined) : undefined;
      const onc = rows ? oncekiYarisSinifi(rows as never, t) : null; S("dususDelta", onc != null ? sinifDususu(onc, x.cls) : null);
      // adaylar
      const ev = x.jockey ? jEv.get(x.jockey) : undefined; const uz = seviye(ev, t);
      for (const P of [30, 60, 90]) {
        let v: number | null = null;
        if (ev && uz != null) { const h2 = bisect(ev.t, t), l2 = bisect(ev.t, t - P * GUN); v = (((ev.cum[h2] - ev.cum[l2]) + 10 * (uz / 100)) / ((h2 - l2) + 10)) * 100; }
        S("jokeySon" + P, v); S("jokeyFark" + P, v != null && uz != null ? v - uz : null);
      }
      return { kazandi: x.won === 1, s };
    });
    veri.push({ raceId, tarih: raceTarih.get(raceId)!, runners });
  }
  // İlk 2 ay jokey/antrenör geçmişi ince → Mart başından
  const sirali = veri.filter((r) => r.tarih >= "2026-03-01").sort((a, b) => a.tarih.localeCompare(b.tarih));
  console.log("kullanılan yarış:", sirali.length, "| aralık:", sirali[0].tarih, "→", sirali[sirali.length - 1].tarih);
  // ── 5) Eğitim/CV (motorla aynı: z-skor, softmax, l2=0.02, 800 devir) ──
  type MS = Map<string, { mu: number; sigma: number }>;
  const muSigma = (train: R[], ad: string) => { let s = 0, n = 0; for (const r of train) for (const x of r.runners) { const g = x.s.get(ad); if (g?.observed) { s += g.raw!; n++; } } const mu = n ? s / n : 0; let s2 = 0; for (const r of train) for (const x of r.runners) { const g = x.s.get(ad); if (g?.observed) s2 += (g.raw! - mu) ** 2; } return { mu, sigma: n ? Math.sqrt(s2 / n) || 1 : 1 }; };
  const vek = (x: R["runners"][number], f: string[], ms: MS) => f.map((ad) => { const g = x.s.get(ad); if (!g?.observed) return 0; const q = ms.get(ad)!; return (g.raw! - q.mu) / q.sigma; });
  const egit = (train: R[], f: string[], ms: MS) => {
    const d = f.length; const X = train.map((r) => ({ x: r.runners.map((x) => vek(x, f, ms)), w: r.runners.findIndex((x) => x.kazandi) })).filter((q) => q.w >= 0);
    const w = new Float64Array(d), vel = new Float64Array(d);
    for (let ep = 0; ep < 800; ep++) { const g = new Float64Array(d);
      for (const q of X) { const p = softmax(q.x.map((v) => { let s = 0; for (let i = 0; i < d; i++) s += v[i] * w[i]; return s; })); for (let i = 0; i < q.x.length; i++) { const c = p[i] - (i === q.w ? 1 : 0); for (let k = 0; k < d; k++) g[k] += c * q.x[i][k]; } }
      for (let k = 0; k < d; k++) { const gk = g[k] / X.length + 0.02 * w[k]; vel[k] = 0.9 * vel[k] - 0.08 * gk; w[k] += vel[k]; } }
    return Array.from(w);
  };
  const gunler = [...new Set(sirali.map((s) => s.tarih))].sort();
  const kesim = [0.4, 0.52, 0.64, 0.76, 0.88].map((q) => gunler[Math.floor(gunler.length * q)]);
  const TABAN = ["jokeyPIT", "antrenorPIT", "lastWon", "fMean", "kgsLog", "sexE", "hpRel", "kiloRel", "dususDelta"];
  const kosu = (f: string[]) => {
    const out = new Map<string, { ll: number; t1: number; t3: number; fold: number }>(); const betas: number[][] = [];
    for (let k = 0; k < 5; k++) {
      const bas = kesim[k], bit = k === 4 ? "9999" : kesim[k + 1]; const train = sirali.filter((x) => x.tarih < bas), test = sirali.filter((x) => x.tarih >= bas && x.tarih < bit);
      const ms: MS = new Map(f.map((a) => [a, muSigma(train, a)])); const b = egit(train, f, ms); betas.push(b);
      for (const r of test) { const kz = r.runners.findIndex((x) => x.kazandi); if (kz < 0) continue;
        const p = softmax(r.runners.map((x) => { const v = vek(x, f, ms); let t = 0; for (let i = 0; i < v.length; i++) t += v[i] * b[i]; return t; })); const sr = p.map((v, i) => ({ i, v })).sort((a, c) => c.v - a.v);
        out.set(r.raceId, { ll: -Math.log(Math.max(p[kz], 1e-15)), t1: sr[0].i === kz ? 1 : 0, t3: sr.slice(0, 3).some((q) => q.i === kz) ? 1 : 0, fold: k }); }
    }
    return { out, betas };
  };
  let seed = 101; const rnd = () => (seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296;
  const ciOf = (dif: number[]) => { const n = dif.length; const bs: number[] = []; for (let b = 0; b < 2000; b++) { let q = 0; for (let i = 0; i < n; i++) q += dif[Math.floor(rnd() * n)]; bs.push(q / n); } bs.sort((p, q) => p - q); return { m: avg(dif), lo: bs[49], hi: bs[1949] }; };
  const base = kosu(TABAN); const ids = [...base.out.keys()];
  const dev = ids.filter((id) => base.out.get(id)!.fold <= 2), conf = ids.filter((id) => base.out.get(id)!.fold >= 3);
  console.log("test yarışı:", ids.length, "| DEV:", dev.length, "| SINAMA:", conf.length);
  console.log("TABAN LL:", avg(ids.map((i) => base.out.get(i)!.ll)).toFixed(4), "Top1 %" + (avg(ids.map((i) => base.out.get(i)!.t1)) * 100).toFixed(1), "Top3 %" + (avg(ids.map((i) => base.out.get(i)!.t3)) * 100).toFixed(1));
  const fk = (sub: string[], m: Map<string, { ll: number }>) => { const c = ciOf(sub.map((id) => m.get(id)!.ll - base.out.get(id)!.ll)); return (c.m >= 0 ? "+" : "") + c.m.toFixed(4) + " [" + c.lo.toFixed(4) + "," + c.hi.toFixed(4) + "]" + (c.hi < 0 ? " ✔" : c.lo > 0 ? " ✘" : ""); };
  const ADAY: [string, string[]][] = [
    ["+ jokeySon30", ["jokeySon30"]], ["+ jokeySon60", ["jokeySon60"]], ["+ jokeySon90", ["jokeySon90"]],
    ["+ jokeyFark30", ["jokeyFark30"]], ["+ jokeyFark60", ["jokeyFark60"]], ["+ jokeyFark90", ["jokeyFark90"]],
    ["+ [jokeySon30,jokeySon90]", ["jokeySon30", "jokeySon90"]],
  ];
  for (const [ad, ek] of ADAY) {
    const m = kosu([...TABAN, ...ek]);
    const bi = ek.map((e) => (m.betas[4][TABAN.length + ek.indexOf(e)]).toFixed(3)).join(",");
    console.log(ad.padEnd(28) + " | DEV " + fk(dev, m.out) + " | SINAMA " + fk(conf, m.out) + " | tüm " + fk(ids, m.out) + " | Top1 " + ((avg(ids.map((i) => m.out.get(i)!.t1)) - avg(ids.map((i) => base.out.get(i)!.t1))) * 100).toFixed(1) + "p | β(son kat) " + bi);
  }
  { // ═══ KATSAYISIZ (eğitimsiz) karşılaştırma: tek sinyalle sıralama + eşit ağırlıklı z-toplamı (işaret = "iyi yön"), aynı test yarışlarında ═══
    const test = sirali.filter((r) => r.tarih >= kesim[0] && base.out.has(r.raceId));
    const ms: MS = new Map([...TABAN, "jokeySon30", "jokeySon60", "jokeySon90", "jokeyFark90"].map((a) => [a, muSigma(sirali.filter((r) => r.tarih < kesim[0]), a)]));
    const isaret: Record<string, number> = { jokeyPIT: 1, antrenorPIT: 1, lastWon: 1, fMean: -1, kgsLog: -1, sexE: 1, hpRel: 1, kiloRel: -1, dususDelta: 1 };
    let sd = 7; const nz = () => ((sd = (sd * 1664525 + 1013904223) % 4294967296) / 4294967296) * 1e-9;
    const olc = (skor: (x: R["runners"][number]) => number) => { let t1 = 0, t3 = 0, n = 0, r1 = 0, r3 = 0; for (const r of test) { const kz = r.runners.findIndex((x) => x.kazandi); if (kz < 0) continue; const sr = r.runners.map((x, i) => ({ i, v: skor(x) + nz() })).sort((a, b) => b.v - a.v); n++; if (sr[0].i === kz) t1++; if (sr.slice(0, 3).some((q) => q.i === kz)) t3++; r1 += 1 / r.runners.length; r3 += Math.min(3, r.runners.length) / r.runners.length; } return { n, t1: t1 / n * 100, t3: t3 / n * 100, r1: r1 / n * 100, r3: r3 / n * 100 }; };
    const z = (x: R["runners"][number], a: string) => { const g = x.s.get(a); if (!g?.observed) return 0; const q = ms.get(a)!; return (g.raw! - q.mu) / q.sigma; };
    const satir = (ad: string, o: ReturnType<typeof olc>) => console.log(ad.padEnd(46) + " Top1 %" + o.t1.toFixed(1).padStart(5) + " | Top3 %" + o.t3.toFixed(1).padStart(5));
    const rastgele = olc(() => 0); console.log("\n=== KATSAYISIZ KARŞILAŞTIRMA (" + rastgele.n + " test yarışı; eğitim yok) ===");
    console.log("rastgele sıralama (beklenen)".padEnd(46) + " Top1 %" + rastgele.r1.toFixed(1).padStart(5) + " | Top3 %" + rastgele.r3.toFixed(1).padStart(5));
    for (const a of ["jokeyPIT", "jokeySon30", "jokeySon60", "jokeySon90", "jokeyFark90"]) satir("yalnız " + a + " (ham sıralama)", olc((x) => z(x, a)));
    const tab = (x: R["runners"][number]) => TABAN.reduce((s, a) => s + isaret[a] * z(x, a), 0);
    satir("eşit ağırlıklı 9 sinyal (taban)", olc(tab));
    for (const a of ["jokeySon30", "jokeySon60", "jokeySon90", "jokeyFark90"]) satir("  taban + " + a + " (ağırlık 1)", olc((x) => tab(x) + z(x, a)));
    satir("  taban + jokeyPIT ikinci kez (genel seviye ×2)", olc((x) => tab(x) + z(x, "jokeyPIT")));
    satir("  taban − jokeyPIT + jokeySon90 (genel yerine son dönem)", olc((x) => tab(x) - z(x, "jokeyPIT") + z(x, "jokeySon90")));
    satir("EĞİTİMLİ taban (karşılaştırma)", { n: 0, t1: avg(ids.map((i) => base.out.get(i)!.t1)) * 100, t3: avg(ids.map((i) => base.out.get(i)!.t3)) * 100, r1: 0, r3: 0 });
  }
  console.log("TABAN β (son kat):", TABAN.map((a, i) => a + "=" + base.betas[4][i].toFixed(3)).join(" "));
  await db.$disconnect(); process.exit(0);
}
main().catch((e) => { console.error("HATA:", e); process.exit(1); });
