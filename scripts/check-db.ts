import { db } from "../src/lib/db";

async function main() {
  const predictions = await db.prediction.count();
  const races = await db.race.count();
  const hippos = await db.hippodrome.findMany({ select: { name: true } });
  console.log(`predictions: ${predictions} | races: ${races}`);
  console.log(`hippodromes: ${hippos.map(h => h.name).join(", ") || "(yok)"}`);
}

main().catch(console.error).finally(() => db.$disconnect());
