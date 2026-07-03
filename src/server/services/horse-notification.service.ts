import { db } from "@/lib/db";
import { turkeyDateString } from "@/lib/tz";

/**
 * Sabah bildirimleri: bugün takip edilen atların koşacağını bildirir.
 * Her kullanıcı için takip ettiği atları kontrol eder.
 */
export async function createMorningHorseNotifications() {
  const today = turkeyDateString();

  // Bugün yarışacak tüm atları çek (runner name → race info)
  const runners = await db.runner.findMany({
    where: {
      race: {
        raceDay: { date: new Date(today + "T00:00:00Z") },
        prediction: { published: true },
      },
    },
    select: {
      name: true,
      no: true,
      race: {
        select: {
          raceNo: true,
          time: true,
          raceDay: {
            select: { hippodrome: { select: { name: true, slug: true } } },
          },
        },
      },
    },
  });

  if (runners.length === 0) return { created: 0 };

  // At isimlerini normalize et → race bilgisine map
  const raceByHorse = new Map<string, { raceNo: number; time: string | null; hippodromeName: string }>();
  for (const r of runners) {
    raceByHorse.set(r.name.toLowerCase(), {
      raceNo: r.race.raceNo,
      time: r.race.time,
      hippodromeName: r.race.raceDay.hippodrome.name,
    });
  }

  // Tüm takip kayıtlarını çek
  const follows = await db.horseFollow.findMany({
    select: { userId: true, horseName: true },
  });

  const toCreate: Array<{
    userId: string;
    type: "HORSE_RACE";
    title: string;
    body: string;
    link: string;
  }> = [];

  for (const follow of follows) {
    const race = raceByHorse.get(follow.horseName.toLowerCase());
    if (!race) continue;

    const timeStr = race.time ? ` saat ${race.time}'de` : "";
    toCreate.push({
      userId: follow.userId,
      type: "HORSE_RACE",
      title: `${follow.horseName} bugün koşuyor`,
      body: `${race.hippodromeName} ${race.raceNo}. Koşu${timeStr}`,
      link: `/kosular?tarih=${today}`,
    });
  }

  if (toCreate.length === 0) return { created: 0 };

  await db.notification.createMany({ data: toCreate, skipDuplicates: true });
  return { created: toCreate.length };
}

/**
 * Saatlik bildirimler: koşusuna 1 saat kalan takip atları için bildirim oluşturur.
 * Türkiye saati (UTC+3) hesaba katılır.
 */
export async function createHourlyHorseNotifications() {
  const today = turkeyDateString();

  // Şu anki Türkiye saati
  const nowUtc = new Date();
  const nowTr = new Date(nowUtc.getTime() + 3 * 60 * 60 * 1000);
  const targetHour = (nowTr.getUTCHours() + 1) % 24;
  const targetMin = nowTr.getUTCMinutes();
  // "HH:MM" formatını hedefle — koşu saatini 1 saat içinde olan atlar
  const targetTimeStr = `${String(targetHour).padStart(2, "0")}:${String(targetMin).padStart(2, "0")}`;

  const runners = await db.runner.findMany({
    where: {
      race: {
        time: targetTimeStr,
        raceDay: { date: new Date(today + "T00:00:00Z") },
        prediction: { published: true },
      },
    },
    select: {
      name: true,
      race: {
        select: {
          raceNo: true,
          time: true,
          raceDay: {
            select: { hippodrome: { select: { name: true } } },
          },
        },
      },
    },
  });

  if (runners.length === 0) return { created: 0 };

  const raceByHorse = new Map<string, { raceNo: number; time: string | null; hippodromeName: string }>();
  for (const r of runners) {
    raceByHorse.set(r.name.toLowerCase(), {
      raceNo: r.race.raceNo,
      time: r.race.time,
      hippodromeName: r.race.raceDay.hippodrome.name,
    });
  }

  const follows = await db.horseFollow.findMany({
    select: { userId: true, horseName: true },
  });

  const toCreate: Array<{
    userId: string;
    type: "HORSE_RACE";
    title: string;
    body: string;
    link: string;
  }> = [];

  for (const follow of follows) {
    const race = raceByHorse.get(follow.horseName.toLowerCase());
    if (!race) continue;

    toCreate.push({
      userId: follow.userId,
      type: "HORSE_RACE",
      title: `${follow.horseName} 1 saat içinde koşuyor`,
      body: `${race.hippodromeName} ${race.raceNo}. Koşu — ${race.time}`,
      link: `/kosular?tarih=${today}`,
    });
  }

  if (toCreate.length === 0) return { created: 0 };

  await db.notification.createMany({ data: toCreate, skipDuplicates: true });
  return { created: toCreate.length };
}
