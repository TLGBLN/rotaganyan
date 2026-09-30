"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";

/** YD Veri Bankası — unresolved kaydını "gözden geçirildi" olarak işaretler. TR
 *  action'larından TAMAMEN AYRI, yalnız YurtDisiUnresolvedEntity'e dokunur. */
export async function markYdUnresolvedReviewed(formData: FormData): Promise<void> {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) return;

  const id = formData.get("id");
  if (typeof id !== "string" || !id) return;

  await db.yurtDisiUnresolvedEntity.update({ where: { id }, data: { status: "REVIEWED" } }).catch(() => {});
  revalidatePath("/admin/yd-unresolved");
}
