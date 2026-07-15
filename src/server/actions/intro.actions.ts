"use server";

import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** Yeni üye tanıtım turunu bir daha göstermemek için işaretler. */
export async function markIntroSeen(): Promise<void> {
  const session = await auth();
  if (!session?.user?.id) return;
  await db.user.update({
    where: { id: session.user.id },
    data: { hasSeenIntro: true },
  });
}