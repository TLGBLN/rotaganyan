"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { getClaudeBudgetStatus, type BudgetStatus } from "@/lib/claude-cost";
import { revalidatePath } from "next/cache";

export async function getClaudeBudget(): Promise<BudgetStatus | null> {
  return getClaudeBudgetStatus();
}

/** Admin yeni kredi yüklediğinde çağırır — geçmiş harcamayı sıfırlar, yeni başlangıç bakiyesi girer. */
export async function resetClaudeBudget(startingUsd: number, note?: string): Promise<void> {
  await requireRole("ADMIN");
  if (!Number.isFinite(startingUsd) || startingUsd <= 0) throw new Error("Geçersiz bakiye");

  await db.claudeBudget.create({
    data: { startingUsd, note: note?.trim() || null },
  });

  revalidatePath("/admin");
}
