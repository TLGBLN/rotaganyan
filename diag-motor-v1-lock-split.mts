// READ-ONLY. Model A/B karsilastirmasi icin KRONOLOJIK egitim/dogrulama ayrimini SABITLER
// ve yaris kimliklerini bir artefakta YAZAR - bu dosya yazildiktan SONRA hicbir sonuca
// bakilarak degistirilmeyecek (kullanici kurali: "test sonucuna bakarak secim yapma").
//
// 452-yarislik AGF kohortuyla KARISTIRILMAZ (kullanici kurali) - saf motorun GENIS tarihsel
// evreninden (yalniz result!=null, sahada >=3 at) secilir, AGF'ye hic bakilmaz.
//
// 2026-10-19 TASARIM DUZELTMESI: ilk deneme "en son N yaris" secimi gun basina COK sayida
// yaris oldugu icin yalniz ~6 gunluk bir pencereye sikisti (10/11-10/18) - gercekci bir
// genelleme testi icin YETERSIZ takvim cesitliligi. Simdi HEM holdout HEM train, GENIS bir
// takvim araligindan ESIT ARALIKLI (stride) orneklenir - yaris SAYISI ayni (120/30) kalir,
// yalniz takvim yayilimi genisler (ekstra DB maliyeti YOK, yalniz secim mantigi).
import { db } from "./src/lib/db";
import fs from "node:fs";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const TRAIN_SIZE = 120;
const HOLDOUT_SIZE = 30;
const HOLDOUT_PENCERE_GUN = 90; // son 90 gunden esit-aralikli 30 yaris
const TRAIN_PENCERE_GUN = 270; // holdout'tan once 270 gunluk pencereden esit-aralikli 120 yaris

function stride<T>(items: T[], n: number): T[] {
  if (items.length <= n) return items;
  const out: T[] = [];
  const step = items.length / n;
  for (let i = 0; i < n; i++) out.push(items[Math.floor(i * step)]);
  return out;
}

async function main() {
  const now = new Date();
  const holdoutWindowStart = new Date(now.getTime() - HOLDOUT_PENCERE_GUN * 86_400_000);

  const holdoutCandidates = await db.race.findMany({
    where: { result: { isNot: null }, runners: { some: { scratched: false } }, raceDay: { date: { gte: holdoutWindowStart } } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
    orderBy: { raceDay: { date: "asc" } },
  });
  const holdoutEligible = holdoutCandidates.filter((r) => r.runners.length >= 3);
  const holdout = stride(holdoutEligible, HOLDOUT_SIZE);
  if (holdout.length < HOLDOUT_SIZE) console.log(`UYARI: holdout penceresinde yeterli yaris yok (${holdout.length}/${HOLDOUT_SIZE})`);
  const earliestHoldoutDate = holdout[0].raceDay.date;

  const trainWindowStart = new Date(earliestHoldoutDate.getTime() - TRAIN_PENCERE_GUN * 86_400_000);
  const trainCandidates = await db.race.findMany({
    where: { result: { isNot: null }, runners: { some: { scratched: false } }, raceDay: { date: { gte: trainWindowStart, lt: earliestHoldoutDate } } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
    orderBy: { raceDay: { date: "asc" } },
  });
  const trainEligible = trainCandidates.filter((r) => r.runners.length >= 3);
  const train = stride(trainEligible, TRAIN_SIZE);
  if (train.length < TRAIN_SIZE) console.log(`UYARI: train penceresinde yeterli yaris yok (${train.length}/${TRAIN_SIZE})`);

  const lock = {
    lockedAt: new Date().toISOString(),
    note: "SABIT - sonrasinda hicbir sonuca bakilarak DEGISTIRILMEZ. 452-AGF-kohortundan BAGIMSIZ. Esit-aralikli (stride) secim, gun-basina-coklu-yaris nedeniyle dar bir takvim penceresine sikismayi onlemek icin.",
    trainRaceIds: train.map((r) => r.id),
    trainDateRange: [train[0].raceDay.date.toISOString(), train[train.length - 1].raceDay.date.toISOString()],
    holdoutRaceIds: holdout.map((r) => r.id),
    holdoutDateRange: [holdout[0].raceDay.date.toISOString(), holdout[holdout.length - 1].raceDay.date.toISOString()],
  };
  fs.writeFileSync(LOCK_PATH, JSON.stringify(lock, null, 2));
  console.log(`Train: ${train.length} yaris, ${lock.trainDateRange[0].slice(0,10)} -> ${lock.trainDateRange[1].slice(0,10)} (${trainEligible.length} uygun aday icinden esit-aralikli secildi)`);
  console.log(`Holdout: ${holdout.length} yaris, ${lock.holdoutDateRange[0].slice(0,10)} -> ${lock.holdoutDateRange[1].slice(0,10)} (${holdoutEligible.length} uygun aday icinden esit-aralikli secildi)`);
  console.log(`KILITLENDI: ${LOCK_PATH}`);
  const trainLatest = new Date(lock.trainDateRange[1]).getTime();
  const holdoutEarliest = new Date(lock.holdoutDateRange[0]).getTime();
  console.log(`Sizinti kontrolu: train_en_gec < holdout_en_erken? ${trainLatest < holdoutEarliest}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
