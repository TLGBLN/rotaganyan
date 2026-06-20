"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";

type ResultInput = {
  raceId: string;
  winnerNo: number;
  actualOrder: number[];
  cikan?: string;
  hitTop1: boolean;
  hitInCoupon: boolean;
  errorTag?: string;
  errorNote?: string;
};

export async function enterResult(input: ResultInput) {
  await requireRole("EDITOR");

  const existing = await db.result.findUnique({ where: { raceId: input.raceId } });

  if (existing) {
    await db.result.update({
      where: { raceId: input.raceId },
      data: {
        winnerNo: input.winnerNo,
        actualOrder: input.actualOrder,
        cikan: input.cikan,
        hitTop1: input.hitTop1,
        hitInCoupon: input.hitInCoupon,
        errorTag: input.errorTag,
        errorNote: input.errorNote,
      },
    });
  } else {
    await db.result.create({
      data: {
        raceId: input.raceId,
        winnerNo: input.winnerNo,
        actualOrder: input.actualOrder,
        cikan: input.cikan,
        hitTop1: input.hitTop1,
        hitInCoupon: input.hitInCoupon,
        errorTag: input.errorTag,
        errorNote: input.errorNote,
      },
    });
  }

  revalidatePath("/admin/sonuclar");
  revalidatePath("/istatistik");
  revalidatePath("/analizler");
  revalidatePath("/kosular");
}
