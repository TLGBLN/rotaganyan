import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const future = await db.gallop.findMany({
    where: { date: { gt: new Date("2026-08-02T00:00:00.000Z") } },
    orderBy: { date: "desc" },
    take: 10,
    include: { runner: { select: { name: true } } },
  });
  console.log("Gelecek tarihli galop kayıtları:", future.length);
  for (const g of future) {
    console.log(g.date.toISOString(), "-", g.runner?.horseName, "-", g.track, g.surface);
  }
  const total = await db.gallop.count();
  const totalFuture = await db.gallop.count({ where: { date: { gt: new Date("2026-08-02T00:00:00.000Z") } } });
  console.log("\nToplam galop:", total, " / gelecek tarihli:", totalFuture);
  await db.$disconnect();
}
main();
