// KALICI ARAÇ — AS-OF DENETİMİ (snapshot ↔ yeniden hesap). SALT-OKUMA. Kod sürümü farkını DIŞLAR: yarış anında KAYDEDİLEN snapshot (Pick.featureSnapshot, o günkü kodla) ile AYNI kodla şimdi yeniden hesaplanan ham sinyal karşılaştırılır.
// As-of doğruysa (yarış günü ve sonrası bilgi girmiyorsa) iki değer AYNI olmalı. Her sinyal için AYRI AYRI raporlanır (hiçbiri birbirinin içinde kaybolmaz):
//   • ham değer: ikisi de gözlemliyse birebir aynı mı, ort./maks. mutlak fark        • gözlem durumu: eski gözlemli→yeni gözlemsiz, eski gözlemsiz→yeni gözlemli (ÖRNEKLERLE)
//   • reliability: ikisi de gözlemliyse aynı mı, ort. fark                             • karşılaştırılamayan: bir tarafta ham değer null
// Kullanım: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-asof-snapshot-denetimi.mts [--from 2026-11-17] → .sinyal-veri/asof-snapshot-denetimi.md
import fs from "node:fs";
import { gatherV461RawSinyaller } from "./src/lib/methodology/v546-1-engine";
import { db } from "./src/lib/db";
const fi = process.argv.indexOf("--from"); const from = new Date((fi >= 0 ? process.argv[fi + 1]! : "2026-11-17") + "T00:00:00Z");
const races = await db.race.findMany({ where: { raceDay: { date: { gte: from }, hippodrome: { name: { not: "Karma" } } }, prediction: { is: { published: true } }, result: { isNot: null } }, select: { id: true, raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } }, runners: { select: { id: true, no: true, scratched: true } }, prediction: { select: { picks: { select: { runnerId: true, featureSnapshot: true } } } } } });
type S = { kod: string; hamDeger: number | null; observed: boolean; reliability?: number };
type Ist = { cift: number; hamAyni: number; hamFark: number[]; relCift: number; relAyni: number; relFark: number[]; eskiGozlemliYeniDegil: number; eskiDegilYeniGozlemli: number; karsilastirilamayan: number; ornek: string[] };
const ist: Record<string, Ist> = {}; let islenen = 0, cekilen = 0;
for (const r of races) {
  const yeni = await gatherV461RawSinyaller(r.id).catch(() => null); if (!yeni) continue; islenen++;
  const info = new Map(r.runners.map((x) => [x.id, x])); const yeniMap = new Map(yeni.runners.map((x) => [x.r.no, new Map(x.rawSinyaller.map((s) => [s.ad, s]))]));
  for (const p of r.prediction?.picks ?? []) { const x = p.runnerId ? info.get(p.runnerId) : undefined; if (!x) continue; if (x.scratched) cekilen++; const ym = yeniMap.get(x.no); if (!ym) continue;
    for (const s of ((p.featureSnapshot as { tumSinyaller?: S[] } | null)?.tumSinyaller ?? [])) { const y = ym.get(s.kod); if (!y) continue; const o = (ist[s.kod] ??= { cift: 0, hamAyni: 0, hamFark: [], relCift: 0, relAyni: 0, relFark: [], eskiGozlemliYeniDegil: 0, eskiDegilYeniGozlemli: 0, karsilastirilamayan: 0, ornek: [] });
      const eskiObs = s.observed && s.hamDeger != null, yeniObs = y.observed && y.raw != null;
      if (eskiObs && !yeniObs) { o.eskiGozlemliYeniDegil++; if (o.ornek.length < 3) o.ornek.push(r.raceDay.hippodrome.slug + " K" + r.raceNo + " #" + x.no + ": snapshot gözlemli (" + s.hamDeger + ") → şimdi gözlemsiz"); continue; }
      if (!eskiObs && yeniObs) { o.eskiDegilYeniGozlemli++; if (o.ornek.length < 3) o.ornek.push(r.raceDay.hippodrome.slug + " K" + r.raceNo + " #" + x.no + ": snapshot gözlemsiz → şimdi gözlemli (" + y.raw + ")"); continue; }
      if (!eskiObs && !yeniObs) { o.karsilastirilamayan++; continue; }
      o.cift++; const d = Math.abs(s.hamDeger! - y.raw!); if (d < 1e-6) o.hamAyni++; o.hamFark.push(d);
      const er = s.reliability ?? null, yr = y.reliability ?? null; if (er != null && yr != null) { o.relCift++; const rd = Math.abs(er - yr); if (rd < 1e-6) o.relAyni++; o.relFark.push(rd); } } }
  console.log("işlendi " + islenen + "/" + races.length + " " + r.raceDay.hippodrome.slug + " K" + r.raceNo);
}
const ort = (a: number[]) => (a.length ? a.reduce((p, q) => p + q, 0) / a.length : 0), mks = (a: number[]) => (a.length ? Math.max(...a) : 0);
const out: string[] = ["# AS-OF SNAPSHOT DENETİMİ — " + islenen + " yarış (" + from.toISOString().slice(0, 10) + " →) | snapshot'ta çekilmiş at sayısı: " + cekilen, "| Sinyal | iki tarafta gözlemli at | ham birebir aynı % | ort/maks ham fark | reliability aynı % | ort rel farkı | eski gözlemli→yeni DEĞİL | eski değil→yeni gözlemli | yorum |", "|---|---|---|---|---|---|---|---|---|"];
for (const [k, o] of Object.entries(ist).sort()) { const p = o.cift ? o.hamAyni / o.cift * 100 : NaN, rp = o.relCift ? o.relAyni / o.relCift * 100 : NaN; const durumVar = o.eskiGozlemliYeniDegil + o.eskiDegilYeniGozlemli > 0;
  const yorum = !o.cift && !durumVar ? "veri yok" : [p < 99 && o.cift ? "⚠ ham değer sapıyor" : "", rp < 99 && o.relCift ? "⚠ reliability sapıyor" : "", durumVar ? "⚠ gözlem durumu değişti" : ""].filter(Boolean).join(" + ") || "AYNI (as-of kararlı)";
  out.push("| " + k + " | " + o.cift + " | " + (o.cift ? p.toFixed(1) : "—") + " | " + ort(o.hamFark).toExponential(1) + " / " + mks(o.hamFark).toExponential(1) + " | " + (o.relCift ? rp.toFixed(1) : "—") + " | " + ort(o.relFark).toExponential(1) + " | " + o.eskiGozlemliYeniDegil + " | " + o.eskiDegilYeniGozlemli + " | " + yorum + " |"); }
out.push("\n## Gözlem durumu değişimi örnekleri"); for (const [k, o] of Object.entries(ist).sort()) if (o.ornek.length) out.push("- **" + k + "**: " + o.ornek.join(" ; "));
fs.mkdirSync(".sinyal-veri", { recursive: true }); fs.writeFileSync(".sinyal-veri/asof-snapshot-denetimi.md", out.join("\n")); console.log(out.join("\n"));
await db.$disconnect(); process.exit(0);
