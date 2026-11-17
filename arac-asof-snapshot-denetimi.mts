// KALICI ARAÇ — AS-OF DENETİMİ (snapshot ↔ yeniden hesap). SALT-OKUMA. Kod sürümü farkını DIŞLAR: yarış anında KAYDEDİLEN snapshot (Pick.featureSnapshot, o günkü kodla) ile AYNI kodla şimdi yeniden hesaplanan ham sinyal karşılaştırılır.
// As-of doğruysa (yarış günü ve sonrası bilgi girmiyorsa) iki değer AYNI olmalı. Fark = sinyal "şimdiki" veriye bağlı (sızıntı/kararsızlık). Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-asof-snapshot-denetimi.mts [--from 2026-11-17]
import { gatherV461RawSinyaller } from "./src/lib/methodology/v546-1-engine";
import { db } from "./src/lib/db";
const fi = process.argv.indexOf("--from"); const from = new Date((fi >= 0 ? process.argv[fi + 1]! : "2026-11-17") + "T00:00:00Z");
const races = await db.race.findMany({ where: { raceDay: { date: { gte: from } , hippodrome: { name: { not: "Karma" } } }, prediction: { is: { published: true } }, result: { isNot: null } }, select: { id: true, raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } }, runners: { select: { id: true, no: true } }, prediction: { select: { picks: { select: { runnerId: true, featureSnapshot: true } } } } } });
type S = { kod: string; hamDeger: number | null; observed: boolean; reliability?: number };
const ist: Record<string, { n: number; ayni: number; mutlak: number[]; durum: number }> = {}; let islenen = 0;
for (const r of races) {
  const yeni = await gatherV461RawSinyaller(r.id).catch(() => null); if (!yeni) continue; islenen++;
  const noOf = new Map(r.runners.map((x) => [x.id, x.no])); const yeniMap = new Map(yeni.runners.map((x) => [x.r.no, new Map(x.rawSinyaller.map((s) => [s.ad, s]))]));
  for (const p of r.prediction?.picks ?? []) { const no = p.runnerId ? noOf.get(p.runnerId) : undefined; if (no == null) continue; const ym = yeniMap.get(no); if (!ym) continue;
    for (const s of ((p.featureSnapshot as { tumSinyaller?: S[] } | null)?.tumSinyaller ?? [])) { const y = ym.get(s.kod); if (!y) continue; const o = (ist[s.kod] ??= { n: 0, ayni: 0, mutlak: [], durum: 0 }); if (s.observed !== y.observed) o.durum++; if (s.hamDeger == null || y.raw == null) continue; o.n++; const d = Math.abs(s.hamDeger - y.raw); if (d < 1e-6) o.ayni++; o.mutlak.push(d); } }
  console.log("işlendi " + islenen + "/" + races.length + " " + r.raceDay.hippodrome.slug + " K" + r.raceNo);
}
const ort = (a: number[]) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0);
console.log("\n# AS-OF SNAPSHOT DENETİMİ — " + islenen + " yarış (" + from.toISOString().slice(0, 10) + " →)\n| Sinyal | karşılaştırılan at | birebir aynı % | ort. mutlak fark | gözlem durumu değişen | yorum |\n|---|---|---|---|---|---|");
for (const [k, o] of Object.entries(ist).sort()) { const p = o.n ? o.ayni / o.n * 100 : NaN; console.log("| " + k + " | " + o.n + " | " + (o.n ? p.toFixed(1) : "—") + " | " + ort(o.mutlak).toExponential(2) + " | " + o.durum + " | " + (!o.n ? "veri yok" : p >= 99 ? "AYNI (as-of kararlı)" : p >= 90 ? "az sapma" : "⚠ SAPIYOR") + " |"); }
await db.$disconnect(); process.exit(0);
