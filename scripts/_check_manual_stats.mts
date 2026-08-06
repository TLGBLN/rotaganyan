import "dotenv/config";
import { db } from "../src/lib/db";

async function main() {
  const sireCount = await db.sireStat.count();
  const damCount = await db.damStat.count();
  const lastSire = await db.sireStat.findFirst({ orderBy: { updatedAt: "desc" } });
  const lastDam = await db.damStat.findFirst({ orderBy: { updatedAt: "desc" } });
  console.log("SireStat (manuel, hipodromx):", sireCount, "kayıt, son güncelleme:", lastSire?.updatedAt.toISOString());
  console.log("DamStat (manuel, hipodromx):", damCount, "kayıt, son güncelleme:", lastDam?.updatedAt.toISOString());
  await db.$disconnect();
}
main();
