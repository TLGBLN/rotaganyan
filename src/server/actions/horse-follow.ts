"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { turkeyDateString } from "@/lib/tz";

export async function toggleHorseFollow(horseName: string, note?: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Giriş yapmalısınız.");

  const existing = await db.horseFollow.findUnique({
    where: { userId_horseName: { userId: session.user.id, horseName } },
  });

  if (existing) {
    await db.horseFollow.delete({ where: { id: existing.id } });
    revalidatePath("/panel/takip-atlarim");
    return { following: false };
  }

  await db.horseFollow.create({
    data: { userId: session.user.id, horseName, note: note?.trim() || null },
  });
  revalidatePath("/panel/takip-atlarim");
  return { following: true };
}

export async function updateFollowNote(horseName: string, note: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Giriş yapmalısınız.");

  await db.horseFollow.update({
    where: { userId_horseName: { userId: session.user.id, horseName } },
    data: { note: note.trim() || null },
  });
  revalidatePath("/panel/takip-atlarim");
}

export async function unfollowHorse(horseName: string) {
  const session = await auth();
  if (!session?.user?.id) throw new Error("Giriş yapmalısınız.");

  await db.horseFollow.deleteMany({
    where: { userId: session.user.id, horseName },
  });
  revalidatePath("/panel/takip-atlarim");
}

export async function getFollowedHorses() {
  const session = await auth();
  if (!session?.user?.id) return [];

  return db.horseFollow.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
}

export type TodaysFollowedRace = {
  horseName: string;
  hippodromeName: string;
  raceNo: number;
  time: string | null;
};

/**
 * Girişte açılan "bugün takip atınız koşuyor" popup'ı için — bugün koşan takip edilen
 * atların listesi. Aynı at ismi eşleştirme mantığı horse-notification.service.ts'teki
 * cron fonksiyonlarıyla TUTARLI tutuldu (küçük harfe çevirip karşılaştırma) — kullanıcı
 * hem bildirim hem popup'ta AYNI atları görmeli.
 */
export async function getTodaysFollowedRaces(): Promise<TodaysFollowedRace[]> {
  const session = await auth();
  if (!session?.user?.id) return [];

  const follows = await db.horseFollow.findMany({
    where: { userId: session.user.id },
    select: { horseName: true },
  });
  if (follows.length === 0) return [];

  const today = turkeyDateString();
  const runners = await db.runner.findMany({
    where: {
      scratched: false,
      race: { raceDay: { date: new Date(today + "T00:00:00Z") } },
    },
    select: {
      name: true,
      race: {
        select: { raceNo: true, time: true, raceDay: { select: { hippodrome: { select: { name: true } } } } },
      },
    },
  });

  const raceByHorse = new Map<string, TodaysFollowedRace>();
  for (const r of runners) {
    raceByHorse.set(r.name.toLowerCase(), {
      horseName: r.name,
      hippodromeName: r.race.raceDay.hippodrome.name,
      raceNo: r.race.raceNo,
      time: r.race.time,
    });
  }

  const results: TodaysFollowedRace[] = [];
  for (const f of follows) {
    const match = raceByHorse.get(f.horseName.toLowerCase());
    if (match) results.push(match);
  }
  return results;
}

/** Popup'ı bugün için "gösterildi" işaretler — aynı gün içinde bir daha açılmaz, yarın tekrar açılabilir. */
export async function markFollowPopupShown() {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.user.update({
    where: { id: session.user.id },
    data: { followPopupShownAt: new Date() },
  });
}

