import { db } from "@/lib/db";
async function main() {
  const rows = await db.homeKupon.findMany({
    where: { hippodromeName: { contains: "Karma" } },
    orderBy: { date: "desc" },
    take: 10,
    select: { id: true, hippodromeName: true, date: true, slot: true, ikramiye: true, isActive: true, updatedAt: true },
  });
  console.log(JSON.stringify(rows, null, 2));
  await db.$disconnect();
}
main().catch(async (e) => { console.error(e); await db.$disconnect(); process.exit(1); });
