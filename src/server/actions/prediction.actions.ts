"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { startOfDay, endOfDay } from "date-fns";
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

// ─── Karma Mirror Sync ────────────────────────────────────────────────────────

/**
 * Bir analiz kaydedildiğinde/yayınlandığında, aynı koşuyu kaynak gösteren
 * Karma yarışlarına da aynı analizi otomatik yansıtır.
 * Örnek: İstanbul 8. Koşu için analiz girilince, conditions="İstanbul 8. Koşu"
 * olan tüm Karma koşularına da aynı analiz kopyalanır.
 */
async function syncKarmaMirrors(predictionId: string): Promise<void> {
  const pred = await db.prediction.findUnique({
    where: { id: predictionId },
    include: {
      race: { include: { raceDay: { include: { hippodrome: true } } } },
      picks: true,
    },
  });
  if (!pred) return;

  const { race } = pred;
  const conditionsKey = `${race.raceDay.hippodrome.name} ${race.raceNo}. Koşu`;
  const raceDate = race.raceDay.date;

  const karmaRaces = await db.race.findMany({
    where: {
      conditions: conditionsKey,
      raceDay: { date: { gte: startOfDay(raceDate), lte: endOfDay(raceDate) } },
    },
    select: { id: true },
  });

  if (karmaRaces.length === 0) return;

  for (const karmaRace of karmaRaces) {
    // Pick'leri kaynak runner no'suyla Karma runner'larına eşleştir
    const mirrorPicks = await Promise.all(
      pred.picks.map(async (pick) => {
        let karmaRunnerId: string | undefined;
        if (pick.runnerId) {
          const sourceRunner = await db.runner.findUnique({
            where: { id: pick.runnerId },
            select: { no: true },
          });
          if (sourceRunner) {
            const karmaRunner = await db.runner.findUnique({
              where: { raceId_no: { raceId: karmaRace.id, no: sourceRunner.no } },
              select: { id: true },
            });
            karmaRunnerId = karmaRunner?.id;
          }
        }
        return {
          rank: pick.rank,
          runnerId: karmaRunnerId ?? undefined,
          runnerLabel: pick.runnerLabel,
          score: pick.score ?? undefined,
          details: pick.details as string[],
          pedigreeRating: pick.pedigreeRating,
          isTarget: pick.isTarget,
        };
      })
    );

    const mirrorData = {
      confidence: pred.confidence,
      notes: pred.notes,
      tempo: pred.tempo,
      couponNarrow: pred.couponNarrow,
      couponNormal: pred.couponNormal,
      couponWide: pred.couponWide,
      isBanko: pred.isBanko,
      bankoNote: pred.bankoNote,
      published: pred.published,
      publishedAt: pred.publishedAt,
    };

    const existing = await db.prediction.findUnique({ where: { raceId: karmaRace.id } });
    if (existing) {
      await db.pick.deleteMany({ where: { predictionId: existing.id } });
      await db.prediction.update({
        where: { id: existing.id },
        data: { ...mirrorData, picks: { create: mirrorPicks } },
      });
    } else {
      await db.prediction.create({
        data: {
          raceId: karmaRace.id,
          authorId: pred.authorId,
          ...mirrorData,
          picks: { create: mirrorPicks },
        },
      });
    }
  }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function upsertPrediction(input: PredictionInput) {
  const session = await requireRole("EDITOR");

  const existing = await db.prediction.findUnique({ where: { raceId: input.raceId } });

  let predictionId: string;

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
        // published/publishedAt BİLEREK burada yok — "Kaydet" (bu fonksiyon) bir taslağı
        // düzenlerken sessizce yayına almamalı. Yayına alma YALNIZ publishPrediction()
        // (PublishChecklist'teki "Yayınla" butonu) üzerinden olmalı. Daha önce burada
        // published:true zorlanıyordu — bu da taslak düzenleyip "Kaydet"e basmayı,
        // checklist'i hiç görmeden yayınlamaya eşitliyordu.
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
    predictionId = existing.id;
  } else {
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
    predictionId = created.id;
  }

  // Karma yarışlarına mirror'la (arka planda, hata login'i engellemesin)
  syncKarmaMirrors(predictionId).catch(console.error);

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");
  revalidatePath("/tahmin-onerileri");
  revalidatePath("/");
  return { id: predictionId };
}

export async function publishPrediction(id: string) {
  await requireRole("EDITOR");

  await db.prediction.update({
    where: { id },
    data: { published: true, publishedAt: new Date() },
  });

  // Karma mirror'larını da yayınla
  syncKarmaMirrors(id).catch(console.error);

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");

  const { notifyNewPrediction } = await import("./notification.actions");
  notifyNewPrediction(id).catch(console.error);
}

export async function unpublishPrediction(id: string) {
  await requireRole("EDITOR");

  await db.prediction.update({
    where: { id },
    data: { published: false, publishedAt: null },
  });

  // Karma mirror'larını da geri al
  const pred = await db.prediction.findUnique({
    where: { id },
    include: { race: { include: { raceDay: { include: { hippodrome: true } } } } },
  });
  if (pred) {
    const conditionsKey = `${pred.race.raceDay.hippodrome.name} ${pred.race.raceNo}. Koşu`;
    const karmaRaces = await db.race.findMany({
      where: {
        conditions: conditionsKey,
        raceDay: { date: { gte: startOfDay(pred.race.raceDay.date), lte: endOfDay(pred.race.raceDay.date) } },
      },
      select: { id: true },
    });
    for (const kr of karmaRaces) {
      await db.prediction.updateMany({
        where: { raceId: kr.id },
        data: { published: false, publishedAt: null },
      });
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
}

export async function deletePrediction(id: string) {
  await requireRole("ADMIN");

  // Karma mirror'larını da sil
  const pred = await db.prediction.findUnique({
    where: { id },
    include: { race: { include: { raceDay: { include: { hippodrome: true } } } } },
  });
  if (pred) {
    const conditionsKey = `${pred.race.raceDay.hippodrome.name} ${pred.race.raceNo}. Koşu`;
    const karmaRaces = await db.race.findMany({
      where: {
        conditions: conditionsKey,
        raceDay: { date: { gte: startOfDay(pred.race.raceDay.date), lte: endOfDay(pred.race.raceDay.date) } },
      },
      include: { prediction: { select: { id: true } } },
    });
    for (const kr of karmaRaces) {
      if (kr.prediction) {
        await db.prediction.delete({ where: { id: kr.prediction.id } });
      }
    }
  }

  await db.prediction.delete({ where: { id } });

  revalidatePath("/admin");
  revalidatePath("/admin/analizler");
  revalidatePath("/analizler");
  revalidatePath("/kosular");
  revalidatePath("/tahmin-onerileri");
  revalidatePath("/");
}
