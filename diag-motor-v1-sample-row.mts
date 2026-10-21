import { db } from "@/lib/db";

async function main() {
  const r = await db.horseRaceHistoryCache.findFirst({ where: { tjkAtId: 113531 } });
  console.log(JSON.stringify((r?.rowsJson as any[])?.slice(0, 3), null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
