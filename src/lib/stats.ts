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

// v4.12: Runner.raceStyle artık Accurace (GPS/sektörel zamanlama) tabanlı 5'li
// sistemi kullanıyor (bkz. pace-analizi.ts) — eski TJK Son800 tabanlı 4'lü sistem
// (ON_GRUP/BEKLEME/EN_GERI) tamamen kaldırıldı, bu eşleme de ona göre güncellendi.
const RACE_STYLE_LABELS: Record<string, string> = {
  KACAK: "Kaçak",
  ONCU: "Öncü",
  PRESCI: "Presçi",
  TAKIPCI: "Takipçi",
  BEKLEYEN: "Bekleyen",
};
const RACE_STYLE_ORDER = ["KACAK", "ONCU", "PRESCI", "TAKIPCI", "BEKLEYEN"];

export type RaceStyleWinBreakdown = {
  bucket: string;
  label: string;
  total: number;
  byStyle: { style: string; label: string; wins: number; rate: number }[];
};

function distanceBucket(distance: number): { key: string; label: string } {
  if (distance <= 1200) return { key: "1", label: "≤1200m" };
  if (distance <= 1600) return { key: "2", label: "1201–1600m" };
  if (distance <= 2000) return { key: "3", label: "1601–2000m" };
  return { key: "4", label: "2001m+" };
}

function fieldSizeBucket(count: number): { key: string; label: string } {
  if (count <= 6) return { key: "1", label: "≤6 atlı" };
  if (count <= 10) return { key: "2", label: "7–10 atlı" };
  return { key: "3", label: "11+ atlı" };
}

function buildBreakdown(
  rows: { bucketKey: string; bucketLabel: string; style: string }[]
): RaceStyleWinBreakdown[] {
  const byBucket = new Map<string, { label: string; styles: Map<string, number>; total: number }>();
  for (const row of rows) {
    const entry = byBucket.get(row.bucketKey) ?? { label: row.bucketLabel, styles: new Map<string, number>(), total: 0 };
    entry.styles.set(row.style, (entry.styles.get(row.style) ?? 0) + 1);
    entry.total += 1;
    byBucket.set(row.bucketKey, entry);
  }
  return Array.from(byBucket.entries())
    .map(([key, entry]) => ({
      bucket: key,
      label: entry.label,
      total: entry.total,
      byStyle: RACE_STYLE_ORDER.map((style) => {
        const wins = entry.styles.get(style) ?? 0;
        return { style, label: RACE_STYLE_LABELS[style], wins, rate: entry.total > 0 ? Math.round((wins / entry.total) * 100) : 0 };
      }),
    }))
    .sort((a, b) => a.bucket.localeCompare(b.bucket));
}

/** Yüzülen yarışlarda kazanan atın yarış stiline (Kaçak/Öncü/Presçi/Takipçi/Bekleyen) göre, mesafe ve at sayısı kırılımında kazanma dağılımı. */
export async function getRaceStyleWinStats(): Promise<{
  byDistance: RaceStyleWinBreakdown[];
  byFieldSize: RaceStyleWinBreakdown[];
}> {
  const results = await db.result.findMany({
    where: { winnerNo: { not: null } },
    select: {
      winnerNo: true,
      race: {
        select: {
          distance: true,
          runners: { select: { no: true, raceStyle: true } },
        },
      },
    },
  });

  const distanceRows: { bucketKey: string; bucketLabel: string; style: string }[] = [];
  const fieldSizeRows: { bucketKey: string; bucketLabel: string; style: string }[] = [];

  for (const r of results) {
    const winner = r.race.runners.find((x) => x.no === r.winnerNo);
    const style = (winner?.raceStyle as { style?: string } | null)?.style;
    if (!style || !RACE_STYLE_LABELS[style]) continue;

    const db_ = distanceBucket(r.race.distance);
    distanceRows.push({ bucketKey: db_.key, bucketLabel: db_.label, style });

    const fb = fieldSizeBucket(r.race.runners.length);
    fieldSizeRows.push({ bucketKey: fb.key, bucketLabel: fb.label, style });
  }

  return {
    byDistance: buildBreakdown(distanceRows),
    byFieldSize: buildBreakdown(fieldSizeRows),
  };
}

/** Admin dashboard'ındaki PerformanceBreakdown kartlarıyla aynı formata (group + hits/total/rate) çevirir. */
export function raceStyleBreakdownToRows(
  breakdown: RaceStyleWinBreakdown[]
): { label: string; total: number; hits: number; rate: number; group?: string }[] {
  return breakdown.flatMap((bucket) =>
    bucket.byStyle.map((s) => ({
      group: `${bucket.label} (${bucket.total} koşu)`,
      label: s.label,
      hits: s.wins,
      total: bucket.total,
      rate: s.rate,
    }))
  );
}

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
