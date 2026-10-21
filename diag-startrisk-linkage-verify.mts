import { db } from "./src/lib/db";
async function main() {
  // Result.gecCikanlar[].no'nun GERCEKTEN o yarisin Runner.no'suyla eslesip eslesmedigini dogrula.
  const results = await db.result.findMany({
    where: { gecCikanlar: { not: null } },
    take: 5,
    select: { raceId: true, gecCikanlar: true, race: { select: { runners: { select: { no: true, name: true, tjkAtId: true } } } } },
  });
  for (const r of results) {
    const gecList = r.gecCikanlar as { no: number; fark: string; name: string }[];
    for (const g of gecList) {
      const runner = r.race.runners.find((rr) => rr.no === g.no);
      console.log(`raceId=${r.raceId} gecCikan: no=${g.no} isim="${g.name}" fark=${g.fark} -> Runner eslesmesi: ${runner ? `BULUNDU (${runner.name}, tjkAtId=${runner.tjkAtId}, isim-eslesme=${runner.name === g.name})` : "BULUNAMADI"}`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
