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
export type CouponTier = "ekonomik" | "normal" | "genis" | "kacti";
export type CouponTierBreakdown = { label: string; total: number; ekonomik: number; normal: number; genis: number; kacti: number };
export type AnalystStats = {
  overall: { total: number; hits: number; rate: number };
  byClassType: AnalystBreakdown[];
  bySurface: AnalystBreakdown[];
  byConfidence: AnalystBreakdown[];
  byHippodrome: AnalystBreakdown[];
  recentTrend: boolean[];
  couponTierByClassType: CouponTierBreakdown[];
};

const SURFACE_LABEL: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };
const CONFIDENCE_LABEL: Record<string, string> = { DUSUK: "Düşük Güven", ORTA: "Orta Güven", YUKSEK: "Yüksek Güven" };

/** Kazananın bulunduğu sıraya göre hangi kupon kademesinde (Ekonomik/Normal/Geniş) yakalandığını, hiç yakalanmadıysa "kacti" döner. */
function couponTierForRank(rank: number | undefined): CouponTier {
  if (rank == null) return "kacti";
  if (rank <= 3) return "ekonomik";
  if (rank <= 7) return "normal";
  return "genis";
}

/** Yayında ve sonuçlanmış tahminleri sınıf/pist/güven/hipodroma göre kırarak isabet oranını çıkarır. */
export async function getAnalystStats(): Promise<AnalystStats> {
  const rows = await db.prediction.findMany({
    where: { published: true, race: { result: { isNot: null } } },
    select: {
      confidence: true,
      isBanko: true,
      picks: { select: { rank: true, runner: { select: { no: true } } } },
      race: {
        select: {
          classType: true,
          surface: true,
          raceDay: { select: { hippodrome: { select: { name: true } } } },
          result: { select: { hitTop1: true, winnerNo: true } },
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

  function groupCouponTier(keyFn: (r: (typeof rows)[number]) => string): CouponTierBreakdown[] {
    const map = new Map<string, CouponTierBreakdown>();
    for (const r of rows) {
      const key = keyFn(r);
      const entry = map.get(key) ?? { label: key, total: 0, ekonomik: 0, normal: 0, genis: 0, kacti: 0 };
      const winnerNo = r.race.result?.winnerNo;
      const matchedPick = winnerNo != null ? r.picks.find((p) => p.runner?.no === winnerNo) : undefined;
      entry.total++;
      entry[couponTierForRank(matchedPick?.rank)]++;
      map.set(key, entry);
    }
    return [...map.values()].sort((a, b) => b.total - a.total);
  }

  const totalHits = rows.filter((r) => r.race.result?.hitTop1).length;

  return {
    overall: { total: rows.length, hits: totalHits, rate: rows.length > 0 ? (totalHits / rows.length) * 100 : 0 },
    byClassType: group((r) => r.race.classType),
    bySurface: group((r) => SURFACE_LABEL[r.race.surface] ?? r.race.surface),
    byConfidence: group((r) => (r.isBanko ? "★ Banko" : CONFIDENCE_LABEL[r.confidence] ?? r.confidence)),
    byHippodrome: group((r) => r.race.raceDay.hippodrome.name),
    recentTrend: rows.slice(-20).map((r) => r.race.result?.hitTop1 ?? false),
    couponTierByClassType: groupCouponTier((r) => r.race.classType),
  };
}

export type ClassTypeAdvice = { level: "warn" | "info" | "good"; text: string };

/**
 * Bir koşu sınıfının geçmiş performansından, o sınıfta analiz girerken dikkat
 * edilmesi gereken noktayı çıkarır. Az veri varsa (n<3) yanlış güven vermemek
 * için uyarı üretmez.
 */
export function getClassTypeAdvice(stats: AnalystStats, classType: string): ClassTypeAdvice | null {
  const breakdown = stats.byClassType.find((b) => b.label === classType);
  if (!breakdown || breakdown.total < 3) return null;

  if (breakdown.rate < 20) {
    return { level: "warn", text: `Bu sınıfta tarihsel isabet düşük (%${breakdown.rate.toFixed(0)}, ${breakdown.hits}/${breakdown.total}) — dikkatli ol` };
  }

  const tier = stats.couponTierByClassType.find((t) => t.label === classType);
  if (tier && tier.total >= 3) {
    const economicShare = tier.ekonomik / tier.total;
    const genisShare = tier.genis / tier.total;
    if (genisShare >= 0.4) {
      return { level: "warn", text: `Bu sınıfta kazanan genelde Geniş kuponda çıkıyor — dar kupon riskli` };
    }
    if (economicShare < 0.4) {
      return { level: "info", text: `Bu sınıfta kazanan sık sık Ekonomik kuponun dışında kalıyor — Normal/Geniş düşün` };
    }
  }

  if (breakdown.rate >= 50) {
    return { level: "good", text: `Bu sınıfta tarihsel isabet yüksek (%${breakdown.rate.toFixed(0)}, ${breakdown.hits}/${breakdown.total})` };
  }

  return null;
}
