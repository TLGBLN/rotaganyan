// KALICI ARAÇ — KOŞU KARTI: her koşu için 13 SAĞLAM faktörle "Kazanan Profili" analizi + model olasılığı yan yana.
//   node --env-file=.env node_modules/tsx/dist/cli.mjs arac-kosu-karti.mts [--tarih 2026-11-15] [--hipodrom ankara] [--kosu 3] [--sonuclanmis-dahil]
// Sağlam faktör = tüm dönemde ≥0.56, iki zaman yarısında ≥0.54, ≥3 koşu tipinde aynı yönde, hiçbir tipte ters değil (455 gerçek yarış, 2026-11-15).
// Kazanan Profili Skoru = sağlam faktörlerin SAHA İÇİ yönlü yüzdeliklerinin EŞİT ağırlıklı ortalaması — HİÇ eğitim/ağırlık yok. Geriye dönük test:
// n=329 koşuda ilk1 %28.0 / ilk3 %58.7 (rastgele %11.2 / %33.5), eğitilmiş AGF'siz modelle (~%26/%61) aynı düzey. AGF KULLANILMAZ (kullanıcı kararı).
// Model olasılığı: kayıtlı tahmin (Pick) varsa ondan, yoksa canlı motordan (scoreV461Saf) — ikisi de AGF'siz.
import fs from "node:fs";
import path from "node:path";
import { db } from "./src/lib/db";
import { scoreV461Saf } from "./src/lib/methodology/v546-1-engine";
import safW from "./src/lib/methodology/weights/v546-1-saf-weights.json";

const get = (b: string) => { const i = process.argv.indexOf(b); return i >= 0 ? process.argv[i + 1] : undefined; };
const tarih = get("--tarih") ?? new Date(Date.now() + 3 * 3600e3).toISOString().slice(0, 10);
const hip = get("--hipodrom"), kosuNo = get("--kosu") ? parseInt(get("--kosu")!, 10) : undefined;
const sonuclanmisDahil = process.argv.includes("--sonuclanmis-dahil");

// [faktör, yön(+1 yüksek iyi / -1 düşük iyi)]
const FAK: [string, 1 | -1][] = [["Son 6 derece ort.", -1], ["Son yarış derecesi", -1], ["Kariyer kazanma%", 1], ["Kariyer ilk-3%", 1], ["HP (sahaya göre)", 1], ["Kilo (sahaya göre)", 1], ["Hız derecesi", 1], ["H2H net skor", 1], ["Accurace geç segment", 1], ["Accurace kapanış", 1], ["Accurace hız", 1], ["Yarış gidişatı", 1], ["Bu jokeyle kazanma", 1]];
const mean = (a: number[]) => a.reduce((p, q) => p + q, 0) / Math.max(a.length, 1);
const numT = (s: unknown) => { if (s == null) return null; const m = String(s).replace(",", ".").match(/-?\d+(\.\d+)?/); return m ? parseFloat(m[0]) : null; };
const trT = (d: string) => { const [g, a, y] = d.split("."); return Date.UTC(+y, +a - 1, +g); };
const anah = (s: string | null | undefined) => { if (!s) return null; const q = String(s).toLocaleUpperCase("tr").split(/[. ]+/).filter(Boolean); return q.length < 2 ? null : q[0][0] + "." + q[q.length - 1]; };
const noOf = (label: string) => parseInt(String(label).match(/#(\d+)/)?.[1] ?? "0", 10);

const d0 = new Date(tarih + "T00:00:00.000Z");
const races = await db.race.findMany({
  where: { raceDay: { date: d0, ...(hip ? { hippodrome: { slug: hip } } : { hippodrome: { name: { not: "Karma" } } }) }, ...(kosuNo ? { raceNo: kosuNo } : {}), ...(sonuclanmisDahil ? {} : { result: { is: null } }) },
  orderBy: [{ raceDay: { hippodrome: { slug: "asc" } } }, { raceNo: "asc" }],
  select: {
    id: true, raceNo: true, classType: true, distance: true, surface: true, raceDay: { select: { hippodrome: { select: { name: true } } } },
    result: { select: { winnerNos: true } },
    runners: { where: { scratched: false }, select: { no: true, name: true, hp: true, weight: true, recentForm: true, jockey: true, tjkAtId: true } },
    prediction: { select: { picks: { select: { runnerLabel: true, rank: true, scoreExact: true, featureSnapshot: true } } } },
  },
});
const out: string[] = [];
const yaz = (s = "") => { out.push(s); console.log(s); };
yaz(`# Koşu kartları — ${tarih}${hip ? " — " + hip : ""}  (${races.length} koşu)`);
yaz("Profil skoru: 13 sağlam faktörün saha içi yönlü yüzdelik ortalaması (0-100). ✔ = o faktörde sahanın üst %20'si, ✘ = alt %20'si. AGF kullanılmaz.\n");

for (const r of races) {
  const t0 = new Date(tarih + "T00:00:00.000Z").getTime();
  // model olasılığı + sinyaller
  type Sg = Record<string, number | null>;
  const sinyal = new Map<number, Sg>(); const modelP = new Map<number, number>(); const modelR = new Map<number, number>();
  const picks = r.prediction?.picks ?? [];
  if (picks.length) {
    for (const p of picks) { const no = noOf(p.runnerLabel); modelP.set(no, p.scoreExact ?? 0); modelR.set(no, p.rank); const sn = p.featureSnapshot as { tumSinyaller?: { kod: string; hamDeger: number; observed: boolean }[] } | null; const s: Sg = {}; for (const x of sn?.tumSinyaller ?? []) s[x.kod] = x.observed ? x.hamDeger : null; sinyal.set(no, s); }
  } else {
    const sc = await scoreV461Saf(r.id, safW as unknown as Parameters<typeof scoreV461Saf>[1]);
    for (const p of sc?.picks ?? []) { modelP.set(p.no, p.probability * 100); modelR.set(p.no, p.rank); const s: Sg = {}; for (const f of p.features) s[f.ad] = f.observed ? (f.raw as number | null) : null; sinyal.set(p.no, s); }
  }
  const hps = r.runners.map((x) => x.hp).filter((v): v is number => v != null), hpO = hps.length ? mean(hps) : null;
  const ks = r.runners.map((x) => x.weight).filter((v): v is number => v != null), kO = ks.length ? mean(ks) : null;
  const ids = r.runners.map((x) => x.tjkAtId).filter((v): v is number => v != null);
  const gec = new Map<number, { t: number; fin: number | null; jk: string | null }[]>();
  if (ids.length) for (const x of await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: ids } }, select: { tjkAtId: true, rowsJson: true } })) gec.set(x.tjkAtId, (x.rowsJson as { date?: string; finishPos?: string; jockey?: string }[]).filter((q) => q.date).map((q) => ({ t: trT(q.date!), fin: numT(q.finishPos), jk: anah(q.jockey) })).filter((q) => q.t < t0).sort((a, b) => b.t - a.t));
  type At = { no: number; ad: string; v: Record<string, number | null>; p: Record<string, number | null>; skor: number | null };
  const atlar: At[] = r.runners.map((x) => {
    const s = sinyal.get(x.no) ?? {}; const f = x.recentForm ? [...x.recentForm].map((c) => (c === "0" ? 10 : +c)).filter((q) => !isNaN(q)) : [];
    const rows = x.tjkAtId != null ? gec.get(x.tjkAtId) ?? [] : []; const fi = rows.map((q) => q.fin).filter((q): q is number => q != null); const jk = anah(x.jockey);
    const v: Record<string, number | null> = {
      "Son 6 derece ort.": f.length ? mean(f) : null, "Son yarış derecesi": f.length ? f[f.length - 1] : null,
      "Kariyer kazanma%": rows.length >= 3 ? fi.filter((q) => q === 1).length / rows.length : null, "Kariyer ilk-3%": rows.length >= 3 ? fi.filter((q) => q <= 3).length / rows.length : null,
      "HP (sahaya göre)": x.hp != null && hpO != null ? x.hp - hpO : null, "Kilo (sahaya göre)": x.weight != null && kO != null ? x.weight - kO : null,
      "Hız derecesi": s.hizDerecesi ?? null, "H2H net skor": s.h2hNetSkor ?? null, "Accurace geç segment": s.ACC_LATE ?? null, "Accurace kapanış": s.ACC_CLOSE_RES ?? null, "Accurace hız": s.ACC_SPEED ?? null, "Yarış gidişatı": s.yarisGidisatiSkoru ?? null,
      "Bu jokeyle kazanma": rows.length && jk ? rows.filter((q) => q.jk === jk && q.fin === 1).length : null,
    };
    return { no: x.no, ad: x.name, v, p: {}, skor: null };
  });
  for (const [ad, yon] of FAK) {
    const vals = atlar.map((a) => a.v[ad]).filter((q): q is number => q != null && !isNaN(q)); const ok = vals.length >= 4 && new Set(vals).size >= 2;
    for (const a of atlar) { const val = a.v[ad]; if (!ok || val == null || isNaN(val)) { a.p[ad] = null; continue; } const lo = vals.filter((q) => q < val).length, eq = vals.filter((q) => q === val).length; const pc = (lo + (eq - 1) / 2) / (vals.length - 1); a.p[ad] = yon > 0 ? pc : 1 - pc; }
  }
  for (const a of atlar) { const vs = FAK.map(([ad]) => a.p[ad]).filter((q): q is number => q != null); a.skor = vs.length >= 7 ? mean(vs) * 100 : null; }
  const kazanan = r.result?.winnerNos ?? [];
  const sirali = [...atlar].sort((a, b) => (b.skor ?? -1) - (a.skor ?? -1));
  const mTop = [...atlar].sort((a, b) => (modelR.get(a.no) ?? 99) - (modelR.get(b.no) ?? 99)).slice(0, 3).map((a) => a.no);
  const pTop = sirali.slice(0, 3).map((a) => a.no);
  yaz(`## ${r.raceDay.hippodrome.name.trim()} K${r.raceNo} — ${r.classType ?? "?"}, ${r.distance}m, ${r.surface}, ${atlar.length} at`);
  yaz("| Profil sırası | No | At | Model % (sıra) | Profil skoru | Güçlü yönler (✔) | Zayıf yönler (✘) |\n|---|---|---|---|---|---|---|");
  sirali.forEach((a, i) => {
    const gu = FAK.filter(([ad]) => (a.p[ad] ?? 0) >= 0.8).map(([ad]) => ad), za = FAK.filter(([ad]) => a.p[ad] != null && a.p[ad]! <= 0.2).map(([ad]) => ad);
    yaz(`| ${i + 1} | ${a.no} | ${a.ad}${kazanan.includes(a.no) ? " 🏆" : ""} | %${(modelP.get(a.no) ?? 0).toFixed(1)} (${modelR.get(a.no) ?? "?"}.) | ${a.skor == null ? "–" : a.skor.toFixed(0)} | ${gu.slice(0, 4).join(", ") || "—"} | ${za.slice(0, 4).join(", ") || "—"} |`);
  });
  const ortak = mTop.filter((n) => pTop.includes(n)), sadeceM = mTop.filter((n) => !pTop.includes(n)), sadeceP = pTop.filter((n) => !mTop.includes(n));
  const adOf = (n: number) => `#${n} ${atlar.find((a) => a.no === n)?.ad ?? ""}`;
  yaz(`\n**Model ilk-3:** ${mTop.map(adOf).join(", ")}  |  **Profil ilk-3:** ${pTop.map(adOf).join(", ")}\n**İkisinin ortak gördüğü:** ${ortak.map(adOf).join(", ") || "—"}  |  **yalnız model:** ${sadeceM.map(adOf).join(", ") || "—"}  |  **yalnız profil:** ${sadeceP.map(adOf).join(", ") || "—"}\n`);
}
fs.mkdirSync(path.join(process.cwd(), ".sinyal-veri"), { recursive: true });
const dosya = path.join(process.cwd(), ".sinyal-veri", `kart-${tarih}${hip ? "-" + hip : ""}.md`);
fs.writeFileSync(dosya, out.join("\n") + "\n");
console.log(`(kart yazıldı: ${dosya})`);
process.exit(0);
