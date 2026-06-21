"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import type { Confidence, PedigreeRating } from "@prisma/client";

type PickInput = {
  rank: number;
  runnerId?: string;
  runnerLabel: string;
  score?: number;
  details: string[];
  pedigreeRating: PedigreeRating;
  isTarget: boolean;
};

type PredictionInput = {
  raceId: string;
  confidence: Confidence;
  notes: string;
  tempo?: string;
  couponNarrow?: string;
  couponNormal?: string;
  couponWide?: string;
  isBanko: boolean;
  bankoNote?: string;
  picks: PickInput[];
};

export async function upsertPrediction(input: PredictionInput) {
  const session = await requireRole("EDITOR");

  const existing = await db.prediction.findUnique({ where: { raceId: input.raceId } });

  if (existing) {
    await db.pick.deleteMany({ where: { predictionId: existing.id } });
    await db.prediction.update({
      where: { id: existing.id },
      data: {
        confidence: input.confidence,
        notes: input.notes,
        tempo: input.tempo,
        couponNarrow: input.couponNarrow,
        couponNormal: input.couponNormal,
        couponWide: input.couponWide,
        isBanko: input.isBanko,
        bankoNote: input.bankoNote,
        // Var olan bir analizin üzerine yeniden girilip kaydedilmesi, en güncel
        // hâlinin otomatik yayında olmasını gerektirir — taslağa düşürüp admini
        // tekrar checklist'e yönlendirmiyoruz.
        published: true,
        publishedAt: new Date(),
        picks: {
          create: input.picks.map((p) => ({
            rank: p.rank,
            runnerId: p.runnerId,
            runnerLabel: p.runnerLabel,
            score: p.score,
            details: p.details,
            pedigreeRating: p.pedigreeRating,
            isTarget: p.isTarget,
          })),
        },
      },
    });
    revalidatePath("/admin/analizler");
    revalidatePath("/analizler");
    revalidatePath("/kosular");
    revalidatePath("/tahmin-onerileri");
    revalidatePath("/");
    return { id: existing.id };
  }

  const created = await db.prediction.create({
    data: {
      raceId: input.raceId,
      authorId: session.user.id,
      confidence: input.confidence,
      notes: input.notes,
      tempo: input.tempo,
      couponNarrow: input.couponNarrow,
      couponNormal: input.couponNormal,
      couponWide: input.couponWide,
      isBanko: input.isBanko,
      bankoNote: input.bankoNote,
      picks: {
        create: input.picks.map((p) => ({
          rank: p.rank,
          runnerId: p.runnerId,
          runnerLabel: p.runnerLabel,
          score: p.score,
          details: p.details,
          pedigreeRating: p.pedigreeRating,
          isTarget: p.isTarget,
        })),
      },
    },
  });

  revalidatePath("/admin/analizler");
  return { id: created.id };
}

export async function publishPrediction(id: string) {
  await requireRole("EDITOR");

  await db.prediction.update({
    where: { id },
    data: { published: true, publishedAt: new Date() },
  });

  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");

  // Fire and forget — don't block publish on notification errors
  const { notifyNewPrediction } = await import("./notification.actions");
  notifyNewPrediction(id).catch(console.error);
}

export async function unpublishPrediction(id: string) {
  await requireRole("EDITOR");

  await db.prediction.update({
    where: { id },
    data: { published: false, publishedAt: null },
  });

  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
}

export async function deletePrediction(id: string) {
  await requireRole("ADMIN");

  await db.prediction.delete({ where: { id } });
  revalidatePath("/admin/analizler");
}
