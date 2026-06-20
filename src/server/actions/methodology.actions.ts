"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

export async function createMethodologyVersion(input: {
  version: string;
  effectiveDate: string;
  content: string;
}) {
  await requireRole("ADMIN");

  const version = input.version.trim();
  const content = input.content.trim();

  if (!version) return { error: "Versiyon adı gerekli." };
  if (!content) return { error: "İçerik boş olamaz." };

  const existing = await db.methodologyVersion.findUnique({ where: { version } });
  if (existing) return { error: "Bu versiyon adı zaten kullanılıyor." };

  await db.$transaction([
    db.methodologyVersion.updateMany({
      where: { isCurrent: true },
      data: { isCurrent: false },
    }),
    db.methodologyVersion.create({
      data: {
        version,
        content,
        effectiveDate: new Date(input.effectiveDate),
        isCurrent: true,
      },
    }),
  ]);

  revalidatePath("/admin/metodoloji");
  return { success: true };
}
