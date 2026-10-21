import { db } from "@/lib/db";

async function main() {
  const raceId = "cmv92m7yh003x06jnunvw8ydp";
  const result = await db.result.findUnique({ where: { raceId }, select: { actualOrder: true, winnerNos: true, winnerNo: true, time: true, ganyan: true } });
  console.log("Result:", JSON.stringify(result, null, 2));
  const runners = await db.runner.findMany({ where: { raceId, scratched: false }, select: { no: true, name: true, agf: true } });
  console.log("Runners (agf):", JSON.stringify(runners, null, 2));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
