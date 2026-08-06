import "dotenv/config";
import { db } from "../src/lib/db";

const now = new Date();
console.log("Şimdi:", now.toISOString());

async function main() {
  const todayStart = new Date(now.toISOString().slice(0, 10) + "T00:00:00.000Z");
  const todayEnd = new Date(todayStart.getTime() + 24 * 3600 * 1000);
  const tomorrowEnd = new Date(todayEnd.getTime() + 24 * 3600 * 1000);

  const todayDays = await db.raceDay.findMany({
    where: { date: { gte: todayStart, lt: todayEnd } },
    include: { hippodrome: true, races: { select: { raceNo: true } } },
  });
  console.log("\n=== BUGÜN PROGRAM (RaceDay) ===");
  if (todayDays.length === 0) console.log("BUGÜN İÇİN VERİ YOK");
  for (const d of todayDays) console.log(d.hippodrome.name, "-", d.races.length, "koşu");

  const tomorrowDays = await db.raceDay.findMany({
    where: { date: { gte: todayEnd, lt: tomorrowEnd } },
    include: { hippodrome: true, races: { select: { raceNo: true } } },
  });
  console.log("\n=== YARIN PROGRAM (RaceDay) ===");
  if (tomorrowDays.length === 0) console.log("YARIN İÇİN VERİ YOK");
  for (const d of tomorrowDays) console.log(d.hippodrome.name, "-", d.races.length, "koşu");

  const lastResult = await db.result.findFirst({ orderBy: { enteredAt: "desc" } });
  console.log("\n=== SON RESULT KAYDI ===");
  console.log(lastResult ? lastResult.enteredAt.toISOString() : "YOK");

  const lastAgf = await db.agfSnapshot.findFirst({ orderBy: { capturedAt: "desc" } });
  console.log("\n=== SON AGF SNAPSHOT ===");
  console.log(lastAgf ? lastAgf.capturedAt.toISOString() : "YOK");

  const lastGallop = await db.gallop.findFirst({ orderBy: { date: "desc" } });
  console.log("\n=== SON GALOP KAYDI ===");
  console.log(lastGallop ? lastGallop.date.toISOString() : "YOK");

  const lastHorseStatsCache = await db.horseStatsCache.findFirst({ orderBy: { updatedAt: "desc" } });
  console.log("\n=== SON HorseStatsCache GÜNCELLEMESİ ===");
  console.log(lastHorseStatsCache ? lastHorseStatsCache.updatedAt.toISOString() : "YOK / TABLO BOŞ");
  const horseStatsCacheCount = await db.horseStatsCache.count();
  console.log("HorseStatsCache toplam kayıt:", horseStatsCacheCount);

  const lastAccurace = await db.accuraceRace.findFirst({ orderBy: { fetchedAt: "desc" } });
  console.log("\n=== SON ACCURACE KAYDI ===");
  console.log(lastAccurace ? lastAccurace.fetchedAt.toISOString() : "YOK");

  const jockeyStatSync = await db.jockeyStatSync.findFirst({ orderBy: { updatedAt: "desc" } });
  console.log("\n=== SON JockeyStatSync ===");
  console.log(jockeyStatSync ? JSON.stringify(jockeyStatSync) : "YOK");

  const trainerStatSync = await db.trainerStatSync.findFirst({ orderBy: { updatedAt: "desc" } });
  console.log("\n=== SON TrainerStatSync ===");
  console.log(trainerStatSync ? JSON.stringify(trainerStatSync) : "YOK");

  const sireStatOwnCount = await db.sireStatOwn.count();
  const damStatOwnCount = await db.damStatOwn.count();
  const trainerEquipCount = await db.trainerEquipmentStatOwn.count();
  const jockeyPistMesafeCount = await db.jockeyPistMesafeSkkStatOwn.count();
  const jokeyAntrenorCount = await db.jokeyAntrenorKombinasyonStatOwn.count();
  console.log("\n=== YENİ İSTATİSTİK TABLOLARI (kayıt sayısı) ===");
  console.log("SireStatOwn:", sireStatOwnCount);
  console.log("DamStatOwn:", damStatOwnCount);
  console.log("TrainerEquipmentStatOwn:", trainerEquipCount);
  console.log("JockeyPistMesafeSkkStatOwn:", jockeyPistMesafeCount);
  console.log("JokeyAntrenorKombinasyonStatOwn:", jokeyAntrenorCount);

  const lastPrediction = await db.prediction.findFirst({ orderBy: { createdAt: "desc" } });
  console.log("\n=== SON PREDICTION (analiz) ===");
  console.log(lastPrediction ? `${lastPrediction.createdAt.toISOString()} | raceId=${lastPrediction.raceId}` : "YOK");

  await db.$disconnect();
}

main().catch((e) => {
  console.error("HATA:", e);
  process.exit(1);
});
