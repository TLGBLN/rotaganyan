"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function isFollowingHorse(horseName: string): Promise<boolean> {
  const session = await auth();
  if (!session?.user?.id) return false;

  const row = await db.horseFollow.findUnique({
    where: { userId_horseName: { userId: session.user.id, horseName } },
  });
  return !!row;
}

export async function getUnreadNotificationCount(): Promise<number> {
  const session = await auth();
  if (!session?.user?.id) return 0;

  return db.notification.count({
    where: { userId: session.user.id, read: false },
  });
}

export async function markAllNotificationsRead() {
  const session = await auth();
  if (!session?.user?.id) return;

  await db.notification.updateMany({
    where: { userId: session.user.id, read: false },
    data: { read: true },
  });
  revalidatePath("/panel/bildirimler");
}
