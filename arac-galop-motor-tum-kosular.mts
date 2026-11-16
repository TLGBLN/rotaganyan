// SALT-OKUMA — GALOP ANALİZ MOTORU v1.0 (kullanıcı formülü) TEK BAŞINA: Maiden / Şartlı 1 / Şartlı 19 / Şartlı 27 TÜM sonuçlanmış yarışlarda.
// Başka sinyal YOK, canlı model YOK, AGF YOK. Atlar yalnız formülün çıktısıyla sıralanır; kazananı bulma oranı tesadüf düzeyiyle kıyaslanır.
// Yalnız yarış gününden ÖNCEKİ galoplar. Referans dağılım sabitleri (medyan/σ/regresyon) TÜM galop verisinden (sonuç bilgisi içermez).
// Ganyan yalnız DEĞERLENDİRMEDE (düz bahis getirisi), modele girmez.
import { db } from "./src/lib/db";
import { parseGalopSec } from "./src/components/program/panels/galop-helpers";
import { sinifSeviyesi } from "./src/lib/methodology/ham-alan-sinyalleri";

type GH = { date: Date; track: string | null; form: string | null; splits: Record<string, string | null> };
const DK = ["1400", "1200", "1000", "800", "600", "400"];
const Phi = (z: number) => { const x = Math.abs(z) / Math.SQRT2; const tt = 1 / (1 + 0.3275911 * x); const y = 1 - (((((1.061405429 * tt - 1.453152027) * tt) + 1.421413741) * tt - 0.284496736) * tt + 0.254829592) * tt * Math.exp(-x * x); return 0.5 * (1 + (z < 0 ? -y : y)); };
const med = (v: number[]) => { const s = [...v].sort((p, q) => p - q); const n = s.length; return n % 2 ? s[(n - 1) / 2]! : (s[n / 2 - 1]! + s[n / 2]!) / 2; };
const ozG = (g: { track: string | null; splits: Record<string, string | null> }) => {
  const d = DK.find((k) => parseGalopSec(g.splits[k] ?? null) != null); if (!d) return null;
  const T = parseGalopSec(g.splits[d]!)!; const t4 = parseGalopSec(g.splits["400"] ?? null);
  const pist = String(g.splits.pist ?? "") || "?"; const ic = String(g.splits.ic_dis ?? "") ? "ic" : "x"; const tur = (g.track ?? "").toUpperCase().includes("SPRINT") ? "S" : "G";
  return { d, T, t4, pist, ic, tur };
};
const keyOf = (breed: string, o: { d: string; pist: string; ic: string; tur: string }, lv: number) => [breed, o.d, lv <= 2 ? o.pist : "*", lv <= 1 ? o.tur : "*", lv <= 0 ? o.ic : "*"].join("|");
const EFOR: Record<string, number> = { "ÇR": 90, "ÇOK RAHAT": 90, "R": 85, "RAHAT": 85, "HR": 80, "HAFİF RAHAT": 80, "HÇ": 65, "HAFİF ÇALIŞARAK": 65, "Ç": 55, "ÇALIŞARAK": 55 };
const pct = (a: number, n: number) => (n ? (a / n * 100).toFixed(1) : "—") + "%";

async function main() {
  // ── referans ──
  console.log("Galop referansı yükleniyor...");
  const refT = new Map<string, number[]>(); const refXY = new Map<string, { x: number[]; y: number[] }>();
  { let cur: string | undefined; for (;;) { await new Promise((q) => setTimeout(q, 400));
      const bt = await db.gallop.findMany({ take: 20000, orderBy: { id: "asc" }, ...(cur ? { skip: 1, cursor: { id: cur } } : {}), select: { id: true, track: true, splits: true, runner: { select: { race: { select: { breed: true } } } } } });
      if (!bt.length) break; cur = bt[bt.length - 1]!.id;
      for (const g of bt) { const o = ozG({ track: g.track, splits: (g.splits ?? {}) as Record<string, string | null> }); if (!o) continue; const b = g.runner.race.breed;
        for (let lv = 0; lv <= 3; lv++) { const k = keyOf(b, o, lv); const a = refT.get(k); if (a) a.push(o.T); else refT.set(k, [o.T]); }
        if (o.d !== "400" && o.t4 != null) { const k = keyOf(b, o, 2); const e = refXY.get(k) ?? { x: [], y: [] }; e.x.push(o.T); e.y.push(o.t4); refXY.set(k, e); } } } }
  const iC = new Map<string, { m: number; s: number; n: number }>();
  const istat = (k: string, d: string) => { let q = iC.get(k); if (!q) { const v = refT.get(k) ?? []; const m = v.length ? med(v) : 0; const mad = v.length ? 1.4826 * med(v.map((z) => Math.abs(z - m))) : 0; q = { m, s: Math.max(mad, 0.25 * (Number(d) / 400)), n: v.length }; iC.set(k, q); } return q; };
  const oC = new Map<string, { a: number; b: number; s: number } | null>();
  const ols = (k: string) => { if (oC.has(k)) return oC.get(k)!; const e = refXY.get(k); let r: { a: number; b: number; s: number } | null = null; if (e && e.x.length >= 30) { const n = e.x.length; const mx = e.x.reduce((p, z) => p + z, 0) / n, my = e.y.reduce((p, z) => p + z, 0) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (e.x[i]! - mx) * (e.y[i]! - my); sxx += (e.x[i]! - mx) ** 2; } const b = sxx > 0 ? sxy / sxx : 0; const a = my - b * mx; const res = e.x.map((xx, i) => e.y[i]! - (a + b * xx)); const mr = med(res); r = { a, b, s: Math.max(1.4826 * med(res.map((z) => Math.abs(z - mr))), 0.15) }; } oC.set(k, r); return r; };
  const qOf = (g: GH, breed: string): number | null => {
    if ((g.track ?? "").toUpperCase().includes("KENTER")) return null; const o = ozG(g); if (!o) return null;
    let st: { m: number; s: number; n: number } | null = null; for (let lv = 0; lv <= 3; lv++) { const q = istat(keyOf(breed, o, lv), o.d); if (q.n >= 30) { st = q; break; } } if (!st) return null;
    let sw = 0.5, sum = 0.5 * (100 * Phi((st.m - o.T) / st.s));
    if (o.d !== "400" && o.t4 != null) { const q = ols(keyOf(breed, o, 2)); if (q) { sw += 0.25; sum += 0.25 * 100 * Phi(((q.a + q.b * o.T) - o.t4) / q.s); } }
    const e = EFOR[(g.form ?? "").toUpperCase().trim()]; if (e != null) { sw += 0.15; sum += 0.15 * e; }
    return sum / sw;
  };

  // ── yarışlar ──
  const idler = (await db.race.findMany({ where: { result: { isNot: null } }, select: { id: true, classType: true } })).filter((r) => sinifSeviyesi(r.classType) === 1).map((r) => r.id);
  console.log("Maiden/Şartlı 1/19/27 sonuçlanmış yarış:", idler.length);
  type R = { raceId: string; tarih: string; sinif: string; kayitli: boolean; atlar: { no: number; pos: number; gk: number | null; n14: number; hz: HZ | null; nQ: number }[]; ganyan: number | null; winners: number[] };
  type HZ = { n14: number; bins: number; cesit: number; gunS: number; kgsLog: number | null };
  const yarislar: R[] = [];
  for (let i = 0; i < idler.length; i += 120) {
    await new Promise((q) => setTimeout(q, 500));
    const rs = await db.race.findMany({ where: { id: { in: idler.slice(i, i + 120) } }, select: { id: true, classType: true, breed: true, conditions: true, raceDay: { select: { date: true } }, prediction: { select: { published: true } }, result: { select: { actualOrder: true, winnerNos: true, ganyan: true } }, runners: { select: { no: true, scratched: true, tjkKgs: true, gallops: { select: { date: true, track: true, form: true, splits: true } } } } } });
    for (const r of rs) {
      const order = (r.result?.actualOrder ?? []) as number[]; if (!order.length) continue; const gun = r.raceDay.date.getTime();
      const atlar: R["atlar"] = [];
      for (const x of r.runners) { if (x.scratched) continue; const pos = order.indexOf(x.no) + 1; if (pos <= 0) continue;
        const gl: GH[] = x.gallops.filter((g) => g.date.getTime() < gun).map((g) => ({ date: g.date, track: g.track, form: g.form, splits: (g.splits ?? {}) as Record<string, string | null> })).sort((p, q) => q.date.getTime() - p.date.getTime());
        const qs: number[] = []; for (const g of gl) { const q = qOf(g, r.breed); if (q != null) qs.push(q); if (qs.length >= 3) break; }
        let gk: number | null = null; if (qs.length) { const w = [0.5, 0.3, 0.2].slice(0, qs.length); const qo = qs.reduce((p, q, k) => p + q * w[k]!, 0) / w.reduce((p, q) => p + q, 0); gk = qs.length >= 2 ? 0.9 * qo + 0.1 * Math.max(0, Math.min(100, 50 + 1.5 * (qs[0]! - qs[1]!))) : qs[0]!; }
        const g30 = gl.filter((g) => gun - g.date.getTime() <= 30 * 864e5); const g14 = g30.filter((g) => gun - g.date.getTime() <= 14 * 864e5);
        let hz: HZ | null = null; if (g30.length) { const bins = [[0, 3], [4, 7], [8, 14]].filter(([lo, hi]) => g14.some((g) => { const dd = (gun - g.date.getTime()) / 864e5; return dd >= lo! && dd <= hi!; })).length / 3; const ciddi = gl.find((g) => (g.form ?? "").toUpperCase().trim() !== "ÇR" && !(g.track ?? "").toUpperCase().includes("KENTER")); hz = { n14: g14.length, bins, cesit: new Set(g14.map((g) => (g.track ?? "?").toUpperCase())).size, gunS: ciddi ? Math.min(14, (gun - ciddi.date.getTime()) / 864e5) : 14, kgsLog: x.tjkKgs != null ? Math.log(1 + x.tjkKgs) : null }; }
        atlar.push({ no: x.no, pos, gk, n14: g14.length, hz, nQ: qs.length }); }
      if (atlar.length < 4) continue;
      const wn = (r.result?.winnerNos?.length ? r.result.winnerNos : [order[0]!]) as number[];
      yarislar.push({ raceId: r.id, tarih: r.raceDay.date.toISOString().slice(0, 10), sinif: r.classType, kayitli: !!r.prediction?.published && r.conditions == null, atlar, ganyan: r.result?.ganyan ?? null, winners: wn });
    }
  }
  yarislar.sort((a, b) => a.tarih.localeCompare(b.tarih));
  const nAt = yarislar.reduce((p, r) => p + r.atlar.length, 0), nGk = yarislar.reduce((p, r) => p + r.atlar.filter((a) => a.gk != null).length, 0);
  console.log(`Değerlendirilen yarış: ${yarislar.length} (${yarislar[0]?.tarih} → ${yarislar.at(-1)?.tarih}) | at: ${nAt} | GALOP_KALITE hesaplanan at: ${nGk} (%${(nGk / nAt * 100).toFixed(0)}) | kayıtlı (kosu-tipleri) yarış: ${yarislar.filter((r) => r.kayitli).length}`);

  // ── hazırlık bileşik puanı (popülasyon sabitleri; Y: KGS'ye göre beklenen son-14-gün galop sayısı) ──
  const hzAll = yarislar.flatMap((r) => r.atlar.map((a) => a.hz)).filter((v): v is HZ => v != null);
  const kv = hzAll.filter((v) => v.kgsLog != null); const mx = kv.reduce((p, v) => p + v.kgsLog!, 0) / kv.length, my = kv.reduce((p, v) => p + v.n14, 0) / kv.length;
  let sxy = 0, sxx = 0; for (const v of kv) { sxy += (v.kgsLog! - mx) * (v.n14 - my); sxx += (v.kgsLog! - mx) ** 2; } const yB = sxy / sxx, yA = my - yB * mx; const yS = Math.sqrt(kv.reduce((p, v) => p + (v.n14 - (yA + yB * v.kgsLog!)) ** 2, 0) / kv.length);
  console.log(`Y beklenen galop sayısı = ${yA.toFixed(2)} + ${yB.toFixed(2)}×log(1+KGS) (σ ${yS.toFixed(2)}, n=${kv.length})`);
  const mS = (f: (v: HZ) => number) => { const m = hzAll.reduce((p, v) => p + f(v), 0) / hzAll.length; return { m, s: Math.sqrt(hzAll.reduce((p, v) => p + (f(v) - m) ** 2, 0) / hzAll.length) || 1 }; };
  const sD = mS((v) => v.bins), sC = mS((v) => v.cesit), sS = mS((v) => -v.gunS);
  const hzOf = (v: HZ | null): number | null => { if (!v) return null; const parts: [number | null, number][] = [[v.kgsLog != null ? (v.n14 - (yA + yB * v.kgsLog)) / yS : null, 0.35], [(v.bins - sD.m) / sD.s, 0.30], [(v.cesit - sC.m) / sC.s, 0.20], [(-v.gunS - sS.m) / sS.s, 0.15]]; const ok = parts.filter(([x]) => x != null); return ok.reduce((p, [x, w]) => p + x! * w, 0) / ok.reduce((p, [, w]) => p + w, 0); };
  const gkAll = yarislar.flatMap((r) => r.atlar.map((a) => a.gk)).filter((v): v is number => v != null); const gM = gkAll.reduce((p, v) => p + v, 0) / gkAll.length, gSd = Math.sqrt(gkAll.reduce((p, v) => p + (v - gM) ** 2, 0) / gkAll.length);
  const hzArr = yarislar.flatMap((r) => r.atlar.map((a) => hzOf(a.hz))).filter((v): v is number => v != null); const hM = hzArr.reduce((p, v) => p + v, 0) / hzArr.length, hSd = Math.sqrt(hzArr.reduce((p, v) => p + (v - hM) ** 2, 0) / hzArr.length);

  // ── model puanları ──
  type Model = { ad: string; skor: (a: R["atlar"][number]) => number | null };
  const MODELLER: Model[] = [
    { ad: "A  GALOP_KALITE", skor: (a) => a.gk },
    { ad: "H  GALOP_HAZIRLIK tek başına", skor: (a) => hzOf(a.hz) },
    { ad: "B  KALITE + HAZIRLIK (z'lerin eşit toplamı)", skor: (a) => { const h = hzOf(a.hz); if (a.gk == null && h == null) return null; return (a.gk != null ? (a.gk - gM) / gSd : 0) + (h != null ? (h - hM) / hSd : 0); } },
  ];
  const tesadufTop1 = (rs: R[]) => rs.reduce((p, r) => p + 1 / r.atlar.length, 0) / rs.length, tesadufTop3 = (rs: R[]) => rs.reduce((p, r) => p + Math.min(3, r.atlar.length) / r.atlar.length, 0) / rs.length;
  const degerlendir = (rs: R[], m: Model) => {
    let t1 = 0, t3 = 0, n = 0, getiri = 0, ort = 0, bankoN = 0, bankoH = 0;
    for (const r of rs) { const sk = r.atlar.map((a) => ({ a, s: m.skor(a) })).filter((q) => q.s != null).sort((p, q) => q.s! - p.s!); if (sk.length < 2) continue; n++;
      const top = sk[0]!; const kazandi = r.winners.includes(top.a.no); if (kazandi) { t1++; getiri += r.ganyan ?? 0; } if (sk.slice(0, 3).some((q) => r.winners.includes(q.a.no))) t3++;
      const wi = sk.findIndex((q) => r.winners.includes(q.a.no)); ort += (wi >= 0 ? wi + 1 : sk.length + 1) / (sk.length + 1);
      if (top.s! - sk[1]!.s! >= (m.ad.startsWith("B") ? 1.0 : 10)) { bankoN++; if (kazandi) bankoH++; } }
    return { n, t1, t3, roi: n ? getiri / n - 1 : 0, ort: n ? ort / n : 0, bankoN, bankoH };
  };
  const rapor = (baslik: string, rs: R[]) => {
    if (!rs.length) return; console.log(`\n── ${baslik}: ${rs.length} yarış ──  tesadüf: Top1 ${(tesadufTop1(rs) * 100).toFixed(1)}%  Top3 ${(tesadufTop3(rs) * 100).toFixed(1)}%`);
    for (const m of MODELLER) { const d = degerlendir(rs, m); console.log(`  ${m.ad.padEnd(46)} n=${String(d.n).padStart(4)} | Top1 ${pct(d.t1, d.n).padStart(6)} | Top3 ${pct(d.t3, d.n).padStart(6)} | kazananın ort. göreli sırası ${d.ort.toFixed(3)} (0.5=tesadüf) | düz Top1 bahsi getirisi ${(d.roi * 100).toFixed(0)}% | "banko" (fark büyük) ${d.bankoN} yarış, isabet ${pct(d.bankoH, d.bankoN)}`); }
  };
  rapor("TÜM Maiden/Şartlı 1/19/27", yarislar);
  rapor("YALNIZ kayıtlı yarışlar (kosu-tipleri)", yarislar.filter((r) => r.kayitli));
  for (const s of [...new Set(yarislar.map((r) => r.sinif))].sort()) rapor("Sınıf: " + s, yarislar.filter((r) => r.sinif === s));
  const yarim = Math.floor(yarislar.length / 2); rapor("Kronolojik 1. yarı (" + yarislar[0]?.tarih + " →)", yarislar.slice(0, yarim)); rapor("Kronolojik 2. yarı (→ " + yarislar.at(-1)?.tarih + ")", yarislar.slice(yarim));
  // galop sayısına göre: kazanan/ilk3 oranı (at düzeyinde, formül içi)
  console.log("\nAT DÜZEYİNDE: GALOP_KALITE dilimine göre kazanma / ilk3 oranı (tüm yarışlar)");
  const atSatir = yarislar.flatMap((r) => r.atlar.filter((a) => a.gk != null).map((a) => ({ gk: a.gk!, win: r.winners.includes(a.no) ? 1 : 0, t3: a.pos <= 3 ? 1 : 0 }))).sort((p, q) => p.gk - q.gk);
  for (let i = 0; i < 5; i++) { const dl = atSatir.slice(Math.floor(i * atSatir.length / 5), Math.floor((i + 1) * atSatir.length / 5)); console.log(`  Q${i + 1} (${dl[0]!.gk.toFixed(0)}–${dl.at(-1)!.gk.toFixed(0)}): n=${dl.length} kazanma ${pct(dl.reduce((p, q) => p + q.win, 0), dl.length)} ilk3 ${pct(dl.reduce((p, q) => p + q.t3, 0), dl.length)}`); }
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
