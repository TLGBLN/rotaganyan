// SALT-OKUMA — GALOP ANALİZ MOTORU v1.0 formülünün TEK KOŞUYA uygulanması (Bursa K1, 2026-11-16, Maiden 1300 Kum).
// Backtest DEĞİL. Yarış gününden önceki galoplar. Referans dağılım: tüm galoplar (ırk × galop mesafesi × pist × tür × iç/dış; hipodrom alanı veride YOK).
import { db } from "./src/lib/db";
import { parseGalopSec } from "./src/components/program/panels/galop-helpers";

const RACE_ID = process.argv[2] ?? "cmwhd8zyw000308jnxmwull2s";
type GH = { date: Date; track: string | null; form: string | null; jockey: string | null; splits: Record<string, string | null> };
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
const f1 = (v: number | null | undefined, n = 1) => (v == null ? "—" : v.toFixed(n));

async function main() {
  const race = await db.race.findUniqueOrThrow({ where: { id: RACE_ID }, select: { breed: true, distance: true, classType: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, runners: { orderBy: { no: "asc" }, select: { id: true, no: true, name: true, tjkKgs: true, gallops: { select: { date: true, track: true, form: true, jockey: true, splits: true } } } } } });
  const gun = race.raceDay.date.getTime(); const breed = race.breed;
  console.log(`${race.raceDay.hippodrome.name} ${race.raceDay.date.toISOString().slice(0, 10)} ${race.classType} ${race.distance}m ${breed}\n`);
  const refT = new Map<string, number[]>(); const refXY = new Map<string, { x: number[]; y: number[] }>();
  let cur: string | undefined;
  for (;;) { await new Promise((q) => setTimeout(q, 400));
    const bt = await db.gallop.findMany({ take: 20000, orderBy: { id: "asc" }, ...(cur ? { skip: 1, cursor: { id: cur } } : {}), select: { id: true, track: true, splits: true, runner: { select: { race: { select: { breed: true } } } } } });
    if (!bt.length) break; cur = bt[bt.length - 1]!.id;
    for (const g of bt) { const o = ozG({ track: g.track, splits: (g.splits ?? {}) as Record<string, string | null> }); if (!o) continue; const b = g.runner.race.breed;
      for (let lv = 0; lv <= 3; lv++) { const k = keyOf(b, o, lv); const a = refT.get(k); if (a) a.push(o.T); else refT.set(k, [o.T]); }
      if (o.d !== "400" && o.t4 != null) { const k = keyOf(b, o, 2); const e = refXY.get(k) ?? { x: [], y: [] }; e.x.push(o.T); e.y.push(o.t4); refXY.set(k, e); } } }
  const istat = (k: string, d: string) => { const v = refT.get(k) ?? []; const m = v.length ? med(v) : 0; const mad = v.length ? 1.4826 * med(v.map((z) => Math.abs(z - m))) : 0; return { m, s: Math.max(mad, 0.25 * (Number(d) / 400)), n: v.length }; };
  const ols = (k: string) => { const e = refXY.get(k); if (!e || e.x.length < 30) return null; const n = e.x.length; const mx = e.x.reduce((p, z) => p + z, 0) / n, my = e.y.reduce((p, z) => p + z, 0) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (e.x[i]! - mx) * (e.y[i]! - my); sxx += (e.x[i]! - mx) ** 2; } const b = sxx > 0 ? sxy / sxx : 0; const a = my - b * mx; const res = e.x.map((xx, i) => e.y[i]! - (a + b * xx)); const mr = med(res); return { a, b, s: Math.max(1.4826 * med(res.map((z) => Math.abs(z - mr))), 0.15), n }; };

  type Q = { tarih: string; d: string; T: number; t4: number | null; form: string; pH: number | null; nRef: number; pK: number | null; pE: number | null; q: number | null; tip: string };
  const qDetay = (g: GH): Q | null => {
    const o = ozG(g); if (!o) return null; const tarih = g.date.toISOString().slice(5, 10).split("-").reverse().join(".");
    const form = (g.form ?? "").toUpperCase().trim();
    if ((g.track ?? "").toUpperCase().includes("KENTER")) return { tarih, d: o.d, T: o.T, t4: o.t4, form, pH: null, nRef: 0, pK: null, pE: null, q: null, tip: "Kenter" };
    let st: ReturnType<typeof istat> | null = null; for (let lv = 0; lv <= 3; lv++) { const s = istat(keyOf(breed, o, lv), o.d); if (s.n >= 30) { st = s; break; } }
    const pH = st ? 100 * Phi((st.m - o.T) / st.s) : null;
    let pK: number | null = null; if (o.d !== "400" && o.t4 != null) { const q = ols(keyOf(breed, o, 2)); if (q) pK = 100 * Phi(((q.a + q.b * o.T) - o.t4) / q.s); }
    const pE = EFOR[form] ?? null;
    let sw = 0, sum = 0; if (pH != null) { sw += 0.5; sum += 0.5 * pH; } if (pK != null) { sw += 0.25; sum += 0.25 * pK; } if (pE != null) { sw += 0.15; sum += 0.15 * pE; }
    return { tarih, d: o.d, T: o.T, t4: o.t4, form, pH, nRef: st?.n ?? 0, pK, pE, q: pH != null ? sum / sw : null, tip: o.tur === "S" ? "Sprint" : "Galop" };
  };
  const sonuc: { no: number; ad: string; gk: number | null; guven: number; y: number | null; n14: number }[] = [];
  for (const x of race.runners) {
    const gl: GH[] = x.gallops.filter((g) => g.date.getTime() < gun).map((g) => ({ date: g.date, track: g.track, form: g.form, jockey: g.jockey, splits: (g.splits ?? {}) as Record<string, string | null> })).sort((p, q) => q.date.getTime() - p.date.getTime());
    console.log(`${x.no}. ${x.name}  (galop kaydı: ${gl.length}, KGS: ${x.tjkKgs ?? "—"})`);
    const kul: Q[] = []; for (const g of gl) { const q = qDetay(g); if (q) { console.log(`   ${q.tarih} ${q.tip} ${q.d}m ${f1(q.T, 2)}sn son400 ${f1(q.t4, 2)} ${q.form || "—"} | Hız ${f1(q.pH)} (ref n=${q.nRef}) Kapanış ${f1(q.pK)} Efor ${f1(q.pE, 0)} → Q ${f1(q.q)}${q.q == null ? "  (kullanılamaz: " + q.tip + ")" : ""}`); if (q.q != null && kul.length < 3) kul.push(q); } }
    let gk: number | null = null; const qs = kul.map((q) => q.q!);
    if (qs.length) { const w = [0.5, 0.3, 0.2].slice(0, qs.length); const qo = qs.reduce((p, q, i) => p + q * w[i]!, 0) / w.reduce((p, q) => p + q, 0); const tr = qs.length >= 2 ? Math.max(0, Math.min(100, 50 + 1.5 * (qs[0]! - qs[1]!))) : null; gk = tr != null ? 0.9 * qo + 0.1 * tr : qs[0]!; console.log(`   → ${qs.length} kullanılabilir galop: Qort ${f1(qo)}${tr != null ? " | trend " + f1(tr) : " | trend yok (tek galop, cezalandırılmaz)"} | GALOP_KALITE ${f1(gk)}`); }
    else console.log("   → GALOP_KALITE hesaplanamadı");
    // hazırlık (Y: KGS'ye göre beklenen son 14 gün galop sayısı; katsayılar önceki testten) + ham D/C/S
    const g14 = gl.filter((g) => gun - g.date.getTime() <= 14 * 864e5); const kg = x.tjkKgs != null ? Math.log(1 + x.tjkKgs) : null;
    const beklenen = kg != null ? -0.45 + 0.77 * kg : null; const y = beklenen != null ? (g14.length - beklenen) / 0.89 : null;
    const bins = [[0, 3], [4, 7], [8, 14]].filter(([lo, hi]) => g14.some((g) => { const dd = (gun - g.date.getTime()) / 864e5; return dd >= lo! && dd <= hi!; })).length;
    const ciddi = gl.find((g) => (g.form ?? "").toUpperCase().trim() !== "ÇR" && !(g.track ?? "").toUpperCase().includes("KENTER"));
    console.log(`   HAZIRLIK ham: son 14 günde ${g14.length} galop (KGS'ye göre beklenen ${f1(beklenen, 1)} → Y ${f1(y, 2)}) | zaman dilimi dolu ${bins}/3 | tür çeşidi ${new Set(g14.map((g) => g.track)).size} | son ciddi idman ${ciddi ? Math.round((gun - ciddi.date.getTime()) / 864e5) + " gün önce" : "—"}`);
    // güven: A referans, B hipodrom/pist konumu/pist durumu bilgisi, C son bölüm+efor, D idman sayısı
    const A = kul.length ? Math.min(Math.min(...kul.map((q) => q.nRef)) / 50, 1) : 0;
    const Bn = gl.length ? gl.slice(0, 3).reduce((p, g) => p + (0 /* hipodrom alanı yok */ + (String(g.splits.pist ?? "") ? 1 : 0) + (String(g.splits.ic_dis ?? "") ? 1 : 0)) / 3, 0) / Math.min(3, gl.length) : 0;
    const Cn = gl.length ? gl.slice(0, 3).reduce((p, g) => p + (((g.splits["400"] ?? null) != null ? 1 : 0) + ((g.form ?? "").trim() ? 1 : 0)) / 2, 0) / Math.min(3, gl.length) : 0;
    const D = Math.min(gl.length / 3, 1); const G = 100 * (0.4 * A + 0.25 * Bn + 0.2 * Cn + 0.15 * D);
    console.log(`   GÜVEN ${f1(G, 0)}  (A ${f1(A, 2)}, B ${f1(Bn, 2)} [hipodrom bilgisi yok], C ${f1(Cn, 2)}, D ${f1(D, 2)})\n`);
    sonuc.push({ no: x.no, ad: x.name, gk, guven: G, y, n14: g14.length });
  }
  console.log("ÖZET (GALOP_KALITE'ye göre):");
  for (const s of [...sonuc].sort((a, b) => (b.gk ?? -1) - (a.gk ?? -1))) console.log(`  ${String(s.no).padStart(2)} ${s.ad.padEnd(16)} KALİTE ${f1(s.gk).padStart(5)} | GÜVEN ${f1(s.guven, 0).padStart(3)} | son14g galop ${s.n14} | Y ${f1(s.y, 2)}`);
  await db.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
