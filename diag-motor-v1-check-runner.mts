import { db } from "@/lib/db";
import { computeSpeedRatingForRace } from "@/lib/motor-v1/features/hiz";

async function main() {
  const raceId = "cmtxx2vsx001f04jza03ag2c6";
  const runners = await db.runner.findMany({ where: { raceId }, select: { no: true, tjkAtId: true, name: true, scratched: true } });
  console.log("runners:", JSON.stringify(runners, null, 2));
  const hizMap = await computeSpeedRatingForRace(raceId);
  console.log("hizMap:", JSON.stringify([...hizMap.entries()]));
}

main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
