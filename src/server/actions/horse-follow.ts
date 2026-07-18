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

