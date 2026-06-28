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

// ─── Performans Analizi ─────────────────────────────────────────────────────────

export type AnalystBreakdown = { label: string; total: number; hits: number; rate: number };
export type AnalystStats = {
  overall: { total: number; hits: number; rate: number };
  byClassType: AnalystBreakdown[];
  bySurface: AnalystBreakdown[];
  byConfidence: AnalystBreakdown[];
  byHippodrome: AnalystBreakdown[];
  recentTrend: boolean[];
};

const SURFACE_LABEL: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };
const CONFIDENCE_LABEL: Record<string, string> = { DUSUK: "Düşük Güven", ORTA: "Orta Güven", YUKSEK: "Yüksek Güven" };

/** Yayında ve sonuçlanmış tahminleri sınıf/pist/güven/hipodroma göre kırarak isabet oranını çıkarır. */
export async function getAnalystStats(): Promise<AnalystStats> {
  const rows = await db.prediction.findMany({
    where: { published: true, race: { result: { isNot: null } } },
    select: {
      confidence: true,
      isBanko: true,
      race: {
        select: {
          classType: true,
          surface: true,
          raceDay: { select: { hippodrome: { select: { name: true } } } },
          result: { select: { hitTop1: true } },
        },
      },
    },
    orderBy: { publishedAt: "asc" },
  });

  function group(keyFn: (r: (typeof rows)[number]) => string): AnalystBreakdown[] {
    const map = new Map<string, { total: number; hits: number }>();
    for (const r of rows) {
      const key = keyFn(r);
      const entry = map.get(key) ?? { total: 0, hits: 0 };
      entry.total++;
      if (r.race.result?.hitTop1) entry.hits++;
      map.set(key, entry);
    }
    return [...map.entries()]
      .map(([label, v]) => ({ label, total: v.total, hits: v.hits, rate: v.total > 0 ? (v.hits / v.total) * 100 : 0 }))
      .sort((a, b) => b.total - a.total);
  }

  const totalHits = rows.filter((r) => r.race.result?.hitTop1).length;

  return {
    overall: { total: rows.length, hits: totalHits, rate: rows.length > 0 ? (totalHits / rows.length) * 100 : 0 },
    byClassType: group((r) => r.race.classType),
    bySurface: group((r) => SURFACE_LABEL[r.race.surface] ?? r.race.surface),
    byConfidence: group((r) => (r.isBanko ? "★ Banko" : CONFIDENCE_LABEL[r.confidence] ?? r.confidence)),
    byHippodrome: group((r) => r.race.raceDay.hippodrome.name),
    recentTrend: rows.slice(-20).map((r) => r.race.result?.hitTop1 ?? false),
  };
}
