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
        prediction: {
          select: {
            id: true;
            published: true;
            picks: { select: { rank: true; isTarget: true } };
          };
        };
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
          prediction: {
            select: {
              id: true,
              published: true,
              picks: { select: { rank: true, isTarget: true } },
            },
          },
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

export type AnalystBreakdown = { label: string; total: number; hits: number; rate: number; group?: string };
export type CouponTier = "ekonomik" | "normal" | "genis" | "kacti";
export type CouponTierBreakdown = { label: string; total: number; ekonomik: number; normal: number; genis: number; kacti: number; group?: string };
export type AnalystStats = {
  overall: { total: number; hits: number; rate: number };
  byClassType: AnalystBreakdown[];
  bySurface: AnalystBreakdown[];
  byConfidence: AnalystBreakdown[];
  byHippodrome: AnalystBreakdown[];
  recentTrend: boolean[];
  couponTierByClassType: CouponTierBreakdown[];
  overallCouponTier: CouponTierBreakdown;
};

const SURFACE_LABEL: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Sentetik" };
const CONFIDENCE_LABEL: Record<string, string> = { DUSUK: "Düşük Güven", ORTA: "Orta Güven", YUKSEK: "Yüksek Güven" };

/**
 * Koşu sınıfı metinleri "/H2", "/DHÖW", "/Dişi" gibi eklerle aşırı parçalanır
 * (her biri n=1 olan onlarca benzersiz etiket). "/" öncesindeki temel sınıfı
 * alarak gruplama ve geçmiş-eşleştirme anlamlı kalabilsin diye sadeleştirir.
 */
function normalizeClassType(classType: string): string {
  return classType.split("/")[0].trim();
}

/**
 * Sadeleştirilmiş sınıf adı bile "Handikap 13..24", "ŞARTLI 1..27",
 * "KV-6..26" gibi tek başına anlamlı bir örneklem oluşturamayan onlarca alt
 * kategoriye bölünüyor. Performans analizinde istatistiksel anlamlılık için
 * bunları TJK'nın resmi yarış kategorilerine toplar:
 * - Şartlı Koşular: ŞARTLI 1, 2, 3, 4, 5, 11, 12, 19, 27...
 * - Handikap Koşular: Handikap 13-17, 21, 22, 24 ve Kısa Vade Handikap (22/24) dahil
 * - Kısa Vadeli (KV) Koşular: KV-6, 7, 8, 9, 10, 11, 18, 21-26
 * - Satış Koşular: SATIŞ 1, 2, 3, 4...
 * - Açık (Grup) Koşular: G 1/2/3 (Grup 1/2/3) ve A 2/3 (Açık 2/3)
 * "Kısa Vade Handikap" adında "Handikap" geçtiği için KV- önekinden önce
 * kontrol edilir, böylece Handikap grubuna düşer (KV grubuna değil).
 */
function classTypeGroup(classType: string): string {
  const normalized = normalizeClassType(classType);
  if (!normalized || normalized === "—") return "Diğer";
  if (normalized.startsWith("Maiden")) return "Maiden Koşular";
  if (normalized.toUpperCase().startsWith("ŞARTLI")) return "Şartlı Koşular";
  if (normalized.includes("Handikap")) return "Handikap Koşular";
  if (normalized.startsWith("KV-")) return "Kısa Vadeli (KV) Koşular";
  if (normalized.toUpperCase().startsWith("SATIŞ")) return "Satış Koşular";
  if (/^[GA]\s*\d/.test(normalized)) return "Açık (Grup) Koşular";
  return normalized;
}

/** Kazananın bulunduğu sıraya göre hangi kupon kademesinde (Ekonomik/Normal/Geniş) yakalandığını, hiç yakalanmadıysa "kacti" döner. */
function couponTierForRank(rank: number | undefined): CouponTier {
  if (rank == null) return "kacti";
  if (rank <= 3) return "ekonomik";
  if (rank <= 6) return "normal";
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

  /** Aynı üst gruba (örn. "Handikap") ait satırları yan yana toplar; gruplar kendi içindeki toplam koşu
   *  sayısına göre, satırlar da grup içinde toplam koşu sayısına göre sıralanır. */
  function sortByGroup<T extends { label: string; total: number; group?: string }>(items: T[]): T[] {
    const groupTotals = new Map<string, number>();
    for (const item of items) {
      if (!item.group) continue;
      groupTotals.set(item.group, (groupTotals.get(item.group) ?? 0) + item.total);
    }
    return [...items].sort((a, b) => {
      const aGroup = a.group ?? a.label;
      const bGroup = b.group ?? b.label;
      if (aGroup !== bGroup) return (groupTotals.get(bGroup) ?? b.total) - (groupTotals.get(aGroup) ?? a.total);
      return b.total - a.total;
    });
  }

  function group(
    keyFn: (r: (typeof rows)[number]) => string,
    groupFn?: (key: string) => string
  ): AnalystBreakdown[] {
    const map = new Map<string, { total: number; hits: number }>();
    for (const r of rows) {
      const key = keyFn(r);
      const entry = map.get(key) ?? { total: 0, hits: 0 };
      entry.total++;
      if (r.race.result?.hitTop1) entry.hits++;
      map.set(key, entry);
    }
    const items = [...map.entries()].map(([label, v]) => ({
      label,
      total: v.total,
      hits: v.hits,
      rate: v.total > 0 ? (v.hits / v.total) * 100 : 0,
      group: groupFn?.(label),
    }));
    return groupFn ? sortByGroup(items) : items.sort((a, b) => b.total - a.total);
  }

  function groupCouponTier(
    keyFn: (r: (typeof rows)[number]) => string,
    groupFn?: (key: string) => string
  ): CouponTierBreakdown[] {
    const map = new Map<string, CouponTierBreakdown>();
    for (const r of rows) {
      const key = keyFn(r);
      const entry =
        map.get(key) ?? { label: key, total: 0, ekonomik: 0, normal: 0, genis: 0, kacti: 0, group: groupFn?.(key) };
      const winnerNo = r.race.result?.winnerNo;
      const matchedPick = winnerNo != null ? r.picks.find((p) => p.runner?.no === winnerNo) : undefined;
      entry.total++;
      entry[couponTierForRank(matchedPick?.rank)]++;
      map.set(key, entry);
    }
    const items = [...map.values()];
    return groupFn ? sortByGroup(items) : items.sort((a, b) => b.total - a.total);
  }

  const totalHits = rows.filter((r) => r.race.result?.hitTop1).length;

  return {
    overall: { total: rows.length, hits: totalHits, rate: rows.length > 0 ? (totalHits / rows.length) * 100 : 0 },
    byClassType: group((r) => normalizeClassType(r.race.classType), classTypeGroup),
    bySurface: group((r) => SURFACE_LABEL[r.race.surface] ?? r.race.surface),
    byConfidence: group((r) => (r.isBanko ? "★ Banko" : CONFIDENCE_LABEL[r.confidence] ?? r.confidence)),
    byHippodrome: group((r) => r.race.raceDay.hippodrome.name),
    recentTrend: rows.slice(-20).map((r) => r.race.result?.hitTop1 ?? false),
    couponTierByClassType: groupCouponTier((r) => normalizeClassType(r.race.classType), classTypeGroup),
    overallCouponTier: groupCouponTier(() => "Tüm Tahminler")[0] ?? {
      label: "Tüm Tahminler",
      total: 0,
      ekonomik: 0,
      normal: 0,
      genis: 0,
      kacti: 0,
    },
  };
}

export type ClassTypeAdvice = { level: "warn" | "info" | "good" | "none"; text: string };

/**
 * Bir koşu sınıfının geçmiş performansından, o sınıfta analiz girerken dikkat
 * edilmesi gereken noktayı çıkarır. Az veri varsa (n<3) yanlış güven vermemek
 * için yorum yapmaz, ama "veri yok" olduğunu da ayrıca belirtir — aksi halde
 * rozetin hiç görünmemesi, özelliğin çalışmadığıyla karıştırılabiliyor.
 */
export function getClassTypeAdvice(stats: AnalystStats, classType: string): ClassTypeAdvice {
  const normalized = normalizeClassType(classType);
  const breakdown = stats.byClassType.find((b) => b.label === normalized);

  // Az veriyle anlamlı yorum yapılamaz — yeterli veri yoksa uyarı ver.
  if (!breakdown || breakdown.total < 5) {
    const n = breakdown?.total ?? 0;
    return { level: "warn", text: n > 0 ? `${n} koşu — yeterli geçmiş veri yok` : "Geçmiş veri yok" };
  }

  const tier = stats.couponTierByClassType.find((t) => t.label === normalized);
  const pct = (n: number) => Math.round((n / (tier?.total ?? breakdown.total)) * 100);

  const tierText = tier && tier.total >= 5
    ? `Eko %${pct(tier.ekonomik)} · Nor %${pct(tier.normal)} · Gen %${pct(tier.genis)}` +
      (tier.kacti > 0 ? ` · Kaçtı %${pct(tier.kacti)}` : "")
    : null;

  const isabet = `%${breakdown.rate.toFixed(0)} (${breakdown.hits}/${breakdown.total})`;
  const text = tierText
    ? `${tierText} (${tier!.total} koşu) · isabet ${isabet}`
    : `isabet ${isabet} (${breakdown.total} koşu)`;

  const economicShare = (tier?.ekonomik ?? 0) / (tier?.total ?? 1);
  const genisShare = (tier?.genis ?? 0) / (tier?.total ?? 1);

  let level: ClassTypeAdvice["level"] = "info";
  if (breakdown.rate < 25 || (tier && tier.total >= 5 && genisShare >= 0.45)) level = "warn";
  else if (breakdown.rate >= 50 && economicShare >= 0.35) level = "good";

  return { level, text };
}
