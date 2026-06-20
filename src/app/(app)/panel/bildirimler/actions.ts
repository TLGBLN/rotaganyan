"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function markAllRead(userId: string) {
  await db.notification.updateMany({
    where: { userId, read: false },
    data: { read: true },
  });
  revalidatePath("/panel/bildirimler");
}
