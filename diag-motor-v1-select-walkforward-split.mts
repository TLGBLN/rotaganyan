// READ-ONLY. DOGRU kronolojik ayrim: HOLDOUT = en SON donemdeki taze yarislar (gelecegi
// temsil eder), TRAIN = ondan KESINLIKLE ONCEKI genis bir havuz (mevcut 120 train + yeni
// eklemeler ile ~400 hedef). Daha once kullanilmis/incelenmis (150+163+79) TAMAMEN disarida.
import fs from "node:fs";
import { db } from "./src/lib/db";

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const rcaCompare = JSON.parse(fs.readFileSync("C:/tmp/v546-eligible-race-ids.json", "utf8")) as string[];
  const rcaMiss = JSON.parse(fs.readFileSync("C:/tmp/rca-model-miss-agf-stripped.json", "utf8")) as { raceId: string }[];
  const excluded = new Set([...lock.trainRaceIds, ...lock.holdoutRaceIds, ...rcaCompare, ...rcaMiss.map((r) => r.raceId)]);

  const raceStubs = await db.race.findMany({
    where: { result: { isNot: null } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
  });
  const eligible = raceStubs.filter((r) => r.runners.length >= 3 && !excluded.has(r.id));
  eligible.sort((a, b) => a.raceDay.date.getTime() - b.raceDay.date.getTime());
  console.log(`Taze (daha once hic kullanilmamis) uygun yaris: ${eligible.length}, araligi: ${eligible[0]?.raceDay.date.toISOString().slice(0,10)} .. ${eligible[eligible.length-1]?.raceDay.date.toISOString().slice(0,10)}`);

  // HOLDOUT: en SON ~55 gunluk dilimden, taze yarislarin SON kismindan
  const HOLDOUT_TARGET = 55;
  const holdoutPool = eligible.slice(-HOLDOUT_TARGET * 3); // en sondan genis bir havuz, stride icin
  const hStride = Math.max(1, Math.floor(holdoutPool.length / HOLDOUT_TARGET));
  const holdout = holdoutPool.filter((_, i) => i % hStride === 0).slice(0, HOLDOUT_TARGET);
  const holdoutStartMs = Math.min(...holdout.map((r) => r.raceDay.date.getTime()));

  // TRAIN: holdout'un EN ERKEN tarihinden KESINLIKLE once olan TUM taze yarislar - ~400'e stride
  const trainPoolFresh = eligible.filter((r) => r.raceDay.date.getTime() < holdoutStartMs);
  const TRAIN_NEW_TARGET = 280; // mevcut 120 + bu = ~400
  const tStride = Math.max(1, Math.floor(trainPoolFresh.length / TRAIN_NEW_TARGET));
  const trainNew = trainPoolFresh.filter((_, i) => i % tStride === 0).slice(0, TRAIN_NEW_TARGET);

  console.log(`\nHOLDOUT: ${holdout.length} yaris, ${holdout[0]?.raceDay.date.toISOString().slice(0,10)} .. ${holdout[holdout.length-1]?.raceDay.date.toISOString().slice(0,10)}`);
  console.log(`YENI TRAIN (mevcut 120'ye EK): ${trainNew.length} yaris, ${trainNew[0]?.raceDay.date.toISOString().slice(0,10)} .. ${trainNew[trainNew.length-1]?.raceDay.date.toISOString().slice(0,10)}`);
  console.log(`Toplam train hedefi: 120 (mevcut) + ${trainNew.length} (yeni) = ${120+trainNew.length}`);
  console.log(`Walk-forward kontrol: train'in en GEC tarihi (${trainNew[trainNew.length-1]?.raceDay.date.toISOString().slice(0,10)}) < holdout'un en ERKEN tarihi (${holdout[0]?.raceDay.date.toISOString().slice(0,10)}) -> ${trainNew[trainNew.length-1]?.raceDay.date.getTime()! < holdoutStartMs}`);

  fs.writeFileSync("C:/tmp/walkforward-holdout-race-ids.json", JSON.stringify(holdout.map((r) => r.id), null, 2));
  fs.writeFileSync("C:/tmp/walkforward-train-new-race-ids.json", JSON.stringify(trainNew.map((r) => r.id), null, 2));
  console.log("\nYazildi: walkforward-holdout-race-ids.json, walkforward-train-new-race-ids.json");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
