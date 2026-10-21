import { db } from "./src/lib/db";
import fs from "node:fs";

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const used = new Set([...lock.trainRaceIds, ...lock.holdoutRaceIds]);

  const picks = await db.pick.findMany({
    where: {
      featureSnapshot: { path: ["motorEtiketi"], string_contains: "V5.46.1" },
    },
    select: { prediction: { select: { raceId: true } } },
  });
  const raceIds = new Set(picks.map((p) => p.prediction.raceId));
  console.log(`V5.46.1 fingerprint'li Pick sayisi: ${picks.length}, benzersiz yaris sayisi: ${raceIds.size}`);

  let withResult = 0, outsideV1Cache = 0;
  const eligibleRaceIds: string[] = [];
  for (const raceId of raceIds) {
    const race = await db.race.findUnique({ where: { id: raceId }, select: { result: { select: { id: true } }, raceDay: { select: { date: true } } } });
    if (race?.result) {
      withResult++;
      if (!used.has(raceId)) { outsideV1Cache++; eligibleRaceIds.push(raceId); }
    }
  }
  console.log(`Sonuclanmis (result var) V5.46.1-fingerprint'li yaris: ${withResult}`);
  console.log(`Bunlardan V1.0'in 150-onbelleginin DISINDA (temiz kiyas icin uygun): ${outsideV1Cache}`);
  fs.writeFileSync("/c/tmp/v546-eligible-race-ids.json", JSON.stringify(eligibleRaceIds, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
