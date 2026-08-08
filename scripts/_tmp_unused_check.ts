import { gatherFaz1 } from "@/lib/methodology/veri-toplama";
import { db } from "@/lib/db";

async function main() {
  const names = ["KASIRGA AĞASI", "ATLI FIRTINA"];
  const runners = await db.runner.findMany({
    where: { name: { in: names } },
    include: { race: { include: { raceDay: { include: { hippodrome: true } } } } },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });
  const seen = new Set<string>();
  for (const r of runners) {
    if (seen.has(r.name)) continue;
    seen.add(r.name);
    console.log(`\n### ${r.name} — raceId ${r.raceId} (${r.race.raceDay.hippodrome.name} ${r.race.raceDay.date.toISOString().slice(0,10)} #${r.race.raceNo})`);
    const faz1 = await gatherFaz1(r.raceId);
    const runner = faz1?.runners.find(x => x.ad === r.name);
    if (!runner) { console.log("Faz1 runner bulunamadı"); continue; }
    console.log("V3 equipment:", runner.equipment, "eklenen/cikarilan kontrolü ayrı");
    console.log("V5 h2hOzet:", runner.h2hOzet);
    console.log("V9 son800BenzerKosuN:", runner.son800BenzerKosuN, "son800TumOzet:", runner.son800TumOzet);
    console.log("V14 sinifOnceki:", runner.sinifOnceki, "classType bugün:", faz1?.race.classType);
    console.log("V15 gunAralik:", runner.gunAralik);
    console.log("V18 startNo:", runner.startNo);
    console.log("V21 agf:", runner.agf);
    console.log("V22 zeminGecmisiOzet:", runner.zeminGecmisiOzet);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
