import { db } from "@/lib/db";

export type HitRateByClass = {
  classType: string;
  total: number;
  hitTop1: number;
  hitInCoupon: number;
  hitTop1Rate: number;
  hitInCouponRate: number;
};

export type StatsOverview = {
  totalAnalyses: number;
  totalResults: number;
  overallHitTop1Rate: number;
  overallHitInCouponRate: number;
  byClass: HitRateByClass[];
  recentBanko: { total: number; hit: number; rate: number };
};

export async function getStats(): Promise<StatsOverview> {
  const results = await db.result.findMany({
    include: {
      race: {
        select: {
          classType: true,
          prediction: { select: { isBanko: true } },
        },
      },
    },
  });

  const totalResults = results.length;
  const totalTop1 = results.filter((r) => r.hitTop1).length;
  const totalInCoupon = results.filter((r) => r.hitInCoupon).length;

  // Group by classType
  const byClassMap = new Map<string, { total: number; hitTop1: number; hitInCoupon: number }>();

  for (const r of results) {
    const key = r.race.classType;
    const existing = byClassMap.get(key) ?? { total: 0, hitTop1: 0, hitInCoupon: 0 };
    byClassMap.set(key, {
      total: existing.total + 1,
      hitTop1: existing.hitTop1 + (r.hitTop1 ? 1 : 0),
      hitInCoupon: existing.hitInCoupon + (r.hitInCoupon ? 1 : 0),
    });
  }

  const byClass: HitRateByClass[] = Array.from(byClassMap.entries())
    .map(([classType, stats]) => ({
      classType,
      ...stats,
      hitTop1Rate: stats.total > 0 ? Math.round((stats.hitTop1 / stats.total) * 100) : 0,
      hitInCouponRate: stats.total > 0 ? Math.round((stats.hitInCoupon / stats.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);

  // Banko stats
  const bankoResults = results.filter((r) => r.race.prediction?.isBanko);
  const bankoHit = bankoResults.filter((r) => r.hitTop1).length;

  const totalAnalyses = await db.prediction.count({ where: { published: true } });

  return {
    totalAnalyses,
    totalResults,
    overallHitTop1Rate: totalResults > 0 ? Math.round((totalTop1 / totalResults) * 100) : 0,
    overallHitInCouponRate: totalResults > 0 ? Math.round((totalInCoupon / totalResults) * 100) : 0,
    byClass,
    recentBanko: {
      total: bankoResults.length,
      hit: bankoHit,
      rate: bankoResults.length > 0 ? Math.round((bankoHit / bankoResults.length) * 100) : 0,
    },
  };
}
