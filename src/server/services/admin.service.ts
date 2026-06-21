import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";
import type { Prisma } from "@prisma/client";

export type AdminPrediction = Prisma.PredictionGetPayload<{
  include: {
    race: { include: { raceDay: { include: { hippodrome: true } }; result: true } };
    author: { select: { name: true } };
    picks: { orderBy: { rank: "asc" } };
  };
}>;

export type AdminRaceDay = Prisma.RaceDayGetPayload<{
  include: {
    hippodrome: true;
    races: {
      include: {
        prediction: { select: { id: true; published: true } };
        result: { select: { id: true } };
        runners: { select: { id: true; no: true; name: true } };
      };
    };
  };
}>;

export async function getAdminPredictions(
  page = 1,
  perPage = 30
): Promise<{ items: AdminPrediction[]; total: number }> {
  const [items, total] = await Promise.all([
    db.prediction.findMany({
      include: {
        race: { include: { raceDay: { include: { hippodrome: true } }, result: true } },
        author: { select: { name: true } },
        picks: { orderBy: { rank: "asc" } },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.prediction.count(),
  ]);
  return { items, total };
}

export async function getAdminPredictionById(id: string) {
  return db.prediction.findUnique({
    where: { id },
    include: {
      race: {
        include: {
          raceDay: { include: { hippodrome: true } },
          runners: {
            orderBy: { no: "asc" },
            include: { gallops: { orderBy: { date: "desc" }, take: 3 } },
          },
          result: true,
        },
      },
      picks: { orderBy: { rank: "asc" }, include: { runner: true } },
      author: { select: { name: true } },
    },
  });
}

export async function getRaceForAnalysis(raceId: string) {
  return db.race.findUnique({
    where: { id: raceId },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: {
        orderBy: { no: "asc" },
        include: { gallops: { orderBy: { date: "desc" }, take: 3 } },
      },
      prediction: true,
    },
  });
}

export async function getAdminRaceDays(dateStr?: string, limit = 30): Promise<AdminRaceDay[]> {
  const date = dateStr ? new Date(dateStr) : undefined;

  return db.raceDay.findMany({
    where: date ? { date: { gte: startOfDay(date), lte: endOfDay(date) } } : undefined,
    include: {
      hippodrome: true,
      races: {
        include: {
          prediction: { select: { id: true, published: true } },
          result: { select: { id: true } },
          runners: { select: { id: true, no: true, name: true } },
        },
        orderBy: { raceNo: "asc" },
      },
    },
    orderBy: { date: "desc" },
    take: limit,
  });
}

export async function getAllResults(limit = 50) {
  return db.result.findMany({
    // Analiz edilmemiş (Prediction'sız) yarışların sonuçları bu listede
    // gösterilmez — burası ROTAGANYAN analizlerinin sonuçlarını takip eder.
    where: { race: { prediction: { published: true } } },
    include: {
      race: { include: { raceDay: { include: { hippodrome: true } } } },
    },
    orderBy: { enteredAt: "desc" },
    take: limit,
  });
}

export async function getDashboardStats() {
  // Analiz yapılmamış (Prediction'sız) yarışların sonuçları başarı oranını
  // çarpıtır — dashboard'daki sonuç sayıları ve listesi sadece analiz edilmiş
  // (yayında Prediction'ı olan) yarışları kapsar.
  const analyzedResultFilter = { race: { prediction: { published: true } } };

  const [totalPredictions, publishedPredictions, totalResults, pendingResults, totalUsers, recentResults] =
    await Promise.all([
      db.prediction.count(),
      db.prediction.count({ where: { published: true } }),
      db.result.count({ where: analyzedResultFilter }),
      db.race.count({ where: { prediction: { published: true }, result: null } }),
      db.user.count(),
      db.result.findMany({
        where: analyzedResultFilter,
        take: 5,
        orderBy: { enteredAt: "desc" },
        include: { race: { include: { raceDay: { include: { hippodrome: true } } } } },
      }),
    ]);

  return {
    totalPredictions,
    publishedPredictions,
    totalResults,
    pendingResults,
    totalUsers,
    recentResults,
  };
}
