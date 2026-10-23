// FRM - IDMAN_01'in %5.99 kapsaminin KOK NEDENINI katman katman olcer: (1) atin HIC galop
// kaydi var mi, (2) varsa populasyon (pist,ic/dis) kovasinda >=20 ornek var mi.
import { db } from "./src/lib/db";
import { loadGalopPaceIndex, splitsToT200Points, groupKey } from "./src/lib/motor-v1/features/idman-galop";
import fs from "node:fs";

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const allIds = [...lock.trainRaceIds, ...lock.holdoutRaceIds];

  const races = await db.race.findMany({
    where: { id: { in: allIds } },
    select: { raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, gallops: { select: { date: true, splits: true } } } } },
  });

  const paceIndex = await loadGalopPaceIndex();
  console.log(`Galop pace index: ${paceIndex.size} (pist|ic-dis) kovasi.`);
  for (const [key, arr] of paceIndex) console.log(`  ${key}: ${arr.length} galop`);

  let toplam = 0, hicGalopYok = 0, galopVarAmaSplitYok = 0, galopVeSplitVar = 0, populasyonYetersiz = 0, basarili = 0;
  for (const race of races) {
    const cutoff = race.raceDay.date;
    for (const r of race.runners) {
      toplam++;
      const past = r.gallops.filter((g) => g.date.getTime() < cutoff.getTime()).sort((a,b)=>b.date.getTime()-a.date.getTime());
      if (past.length === 0) { hicGalopYok++; continue; }
      let own: { key: string } | null = null;
      for (const g of past) {
        const splits = g.splits as Record<string, string | null> | null;
        if (!splits) continue;
        const points = splitsToT200Points(splits);
        if (points.length === 0) continue;
        own = { key: groupKey(splits.pist ?? null, splits.ic_dis ?? null) };
        break;
      }
      if (!own) { galopVarAmaSplitYok++; continue; }
      galopVeSplitVar++;
      const popAll = paceIndex.get(own.key) ?? [];
      const popPast = popAll.filter((p) => p.tarih.getTime() < cutoff.getTime());
      if (popPast.length < 20) { populasyonYetersiz++; continue; }
      basarili++;
    }
  }
  console.log(`\nToplam kosucu: ${toplam}`);
  console.log(`Hic galop kaydi YOK: ${hicGalopYok} (%${(100*hicGalopYok/toplam).toFixed(1)})`);
  console.log(`Galop var ama sayisal split YOK: ${galopVarAmaSplitYok} (%${(100*galopVarAmaSplitYok/toplam).toFixed(1)})`);
  console.log(`Galop+split VAR: ${galopVeSplitVar} (%${(100*galopVeSplitVar/toplam).toFixed(1)})`);
  console.log(`  -> Populasyon (pist|ic-dis kovasi) YETERSIZ (<20): ${populasyonYetersiz}`);
  console.log(`  -> BASARILI (observed=true): ${basarili} (%${(100*basarili/toplam).toFixed(1)})`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
