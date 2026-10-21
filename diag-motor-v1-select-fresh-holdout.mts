// READ-ONLY. GERCEKTEN DOKUNULMAMIS bir holdout seti secer: ab-split-locked.json'daki 150
// (120 train + 30 eski holdout) + 163'luk RCA/kiyas seti + 79 RCA MODEL_MISS yarisinin
// TAMAMI DISLANIR. Kronolojik yayilim icin stride-sample.
import fs from "node:fs";
import { db } from "./src/lib/db";

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const rcaCompare = JSON.parse(fs.readFileSync("C:/tmp/v546-eligible-race-ids.json", "utf8")) as string[];
  const rcaMiss = JSON.parse(fs.readFileSync("C:/tmp/rca-model-miss-agf-stripped.json", "utf8")) as { raceId: string }[];

  const excluded = new Set([...lock.trainRaceIds, ...lock.holdoutRaceIds, ...rcaCompare, ...rcaMiss.map((r) => r.raceId)]);
  console.log(`Disinda tutulan (daha once kullanilmis/incelenmis) yaris sayisi: ${excluded.size}`);

  const raceStubs = await db.race.findMany({
    where: { result: { isNot: null } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
  });
  const eligible = raceStubs.filter((r) => r.runners.length >= 3 && !excluded.has(r.id));
  eligible.sort((a, b) => a.raceDay.date.getTime() - b.raceDay.date.getTime());
  console.log(`TAZE (hic kullanilmamis) uygun yaris: ${eligible.length}`);
  console.log(`Tarih araligi: ${eligible[0]?.raceDay.date.toISOString().slice(0,10)} .. ${eligible[eligible.length-1]?.raceDay.date.toISOString().slice(0,10)}`);

  // Stride-sample 50 yaris, kronolojik yayilim icin
  const TARGET = 50;
  const stride = Math.max(1, Math.floor(eligible.length / TARGET));
  const sample = eligible.filter((_, i) => i % stride === 0).slice(0, TARGET);
  console.log(`Secilen taze holdout: ${sample.length} yaris`);
  console.log(`Tarih araligi (secilen): ${sample[0]?.raceDay.date.toISOString().slice(0,10)} .. ${sample[sample.length-1]?.raceDay.date.toISOString().slice(0,10)}`);

  fs.writeFileSync("C:/tmp/fresh-holdout-race-ids.json", JSON.stringify(sample.map((r) => r.id), null, 2));
  console.log("Yazildi: C:/tmp/fresh-holdout-race-ids.json");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
