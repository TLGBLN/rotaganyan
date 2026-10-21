import { db } from "@/lib/db";

async function main() {
  const names = ["SHIMMER", "SECRET OF DRAGON"];
  for (const name of names) {
    const rows = await db.runner.findMany({
      where: { name: { contains: name, mode: "insensitive" } },
      select: {
        id: true,
        tjkAtId: true,
        name: true,
        raceId: true,
        no: true,
        race: { select: { raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, raceNo: true } },
      },
      orderBy: { race: { raceDay: { date: "desc" } } },
      take: 10,
    });
    console.log(name, JSON.stringify(rows, null, 2));
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
