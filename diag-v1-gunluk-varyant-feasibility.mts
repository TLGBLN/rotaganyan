// YET - gunluk pist varyanti FEASIBILITY kontrolu: her (hipodrom, tarih) icin KAC start
// var (TUM atlar, yalniz TRAIN/HOLDOUT degil) - guvenilir bir "o gun pist nasildi" sinyali
// icin yeterli ornek var mi?
import { db } from "./src/lib/db";

async function main() {
  const raceDays = await db.raceDay.findMany({
    select: {
      date: true, hippodrome: { select: { name: true } },
      races: { select: { surface: true, distance: true, runners: { where: { scratched: false }, select: { id: true } } } },
    },
    orderBy: { date: "desc" },
    take: 60, // son 60 yaris gunu orneklemi
  });
  const rows = raceDays.map((rd) => {
    const totalStarts = rd.races.reduce((a, r) => a + r.runners.length, 0);
    const surfaces = new Set(rd.races.map((r) => r.surface));
    return { date: rd.date.toISOString().slice(0,10), hip: rd.hippodrome.name, raceCount: rd.races.length, totalStarts, surfaces: [...surfaces] };
  });
  console.log(`Ornek ${rows.length} yaris gunu:`);
  for (const r of rows.slice(0, 20)) console.log(`  ${r.date} ${r.hip}: ${r.raceCount} yaris, ${r.totalStarts} start, zeminler=${r.surfaces.join(",")}`);
  const avgStarts = rows.reduce((a,r)=>a+r.totalStarts,0)/rows.length;
  const avgRaces = rows.reduce((a,r)=>a+r.raceCount,0)/rows.length;
  console.log(`\nOrtalama: ${avgRaces.toFixed(1)} yaris/gun, ${avgStarts.toFixed(1)} start/gun (ayni hipodrom+gun)`);
  // Ayni gun+hipodrom+ZEMIN (surface) icin ortalama start sayisi (bucket-ozel feasibility)
  let bucketCounts: number[] = [];
  for (const rd of raceDays) {
    const bySurface: Record<string, number> = {};
    for (const race of rd.races) bySurface[race.surface] = (bySurface[race.surface] ?? 0) + race.runners.length;
    for (const v of Object.values(bySurface)) bucketCounts.push(v);
  }
  bucketCounts.sort((a,b)=>a-b);
  console.log(`\nAyni gun+hipodrom+ZEMIN bucket basi start sayisi: min=${bucketCounts[0]} medyan=${bucketCounts[Math.floor(bucketCounts.length/2)]} ort=${(bucketCounts.reduce((a,b)=>a+b,0)/bucketCounts.length).toFixed(1)} max=${bucketCounts[bucketCounts.length-1]}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
