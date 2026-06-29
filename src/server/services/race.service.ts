import { db } from "@/lib/db";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { turkeyDateString } from "@/lib/tz";
import type { Prisma, Confidence } from "@prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgramRaceDay = Prisma.RaceDayGetPayload<{
  include: {
    hippodrome: true;
    races: {
      include: {
        prediction: {
          select: {
            published: true;
            confidence: true;
            isBanko: true;
            couponNormal: true;
            couponWide: true;
            picks: {
              orderBy: { rank: "asc" };
              include: { runner: { select: { name: true; no: true } } };
            };
          };
        };
        result: { select: { hitTop1: true; hitInCoupon: true; ganyan: true; winnerNo: true } };
      };
    };
  };
}>;

export type RaceDetail = Prisma.RaceGetPayload<{
  include: {
    raceDay: { include: { hippodrome: true } };
    runners: {
      include: { gallops: { orderBy: { date: "desc" } } };
      orderBy: { no: "asc" };
    };
    prediction: {
      include: {
        picks: {
          include: { runner: { select: { name: true; no: true; pedigreeUrl: true } } };
          orderBy: { rank: "asc" };
        };
        author: { select: { name: true } };
      };
    };
    result: true;
  };
}>;

export type PredictionListItem = Prisma.PredictionGetPayload<{
  include: {
    race: {
      include: {
        raceDay: { include: { hippodrome: true } };
        result: { select: { hitTop1: true; hitInCoupon: true; winnerNo: true; ganyan: true } };
      };
    };
    picks: {
      where: { rank: 1 };
      include: { runner: { select: { name: true; no: true } } };
    };
    author: { select: { name: true } };
  };
}>;

// ─── Queries ──────────────────────────────────────────────────────────────────

export async function getRaceDaysByDate(
  dateStr?: string,
  hippodromeSlug?: string
): Promise<ProgramRaceDay[]> {
  const date = dateStr ? new Date(dateStr) : new Date();

  return db.raceDay.findMany({
    where: {
      date: {
        gte: startOfDay(date),
        lte: endOfDay(date),
      },
      ...(hippodromeSlug ? { hippodrome: { slug: hippodromeSlug } } : {}),
    },
    include: {
      hippodrome: true,
      races: {
        include: {
          prediction: {
            select: {
              published: true,
              confidence: true,
              isBanko: true,
              couponNormal: true,
              couponWide: true,
              picks: {
                orderBy: { rank: "asc" },
                include: { runner: { select: { name: true, no: true } } },
              },
            },
          },
          result: { select: { hitTop1: true, hitInCoupon: true, ganyan: true, winnerNo: true } },
        },
        orderBy: { raceNo: "asc" },
      },
    },
    orderBy: [{ hippodrome: { name: "asc" } }],
  });
}

export async function getLatestRaceDayDate(): Promise<Date | null> {
  const latest = await db.raceDay.findFirst({
    orderBy: { date: "desc" },
    select: { date: true },
  });
  return latest?.date ?? null;
}

export async function getAvailableDates(limit = 14): Promise<{ date: Date }[]> {
  return db.raceDay.findMany({
    distinct: ["date"],
    orderBy: { date: "desc" },
    take: limit,
    select: { date: true },
  });
}

export async function getHippodromes() {
  return db.hippodrome.findMany({ orderBy: { name: "asc" } });
}

export async function getRaceDetail(
  dateStr: string,
  hippodromeSlug: string,
  raceNo: number
): Promise<RaceDetail | null> {
  const date = new Date(dateStr);

  return db.race.findFirst({
    where: {
      raceNo,
      raceDay: {
        date: { gte: startOfDay(date), lte: endOfDay(date) },
        hippodrome: { slug: hippodromeSlug },
      },
    },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: {
        include: { gallops: { orderBy: { date: "desc" } } },
        orderBy: { no: "asc" },
      },
      prediction: {
        include: {
          picks: {
            include: { runner: { select: { name: true, no: true, pedigreeUrl: true } } },
            orderBy: { rank: "asc" },
          },
          author: { select: { name: true } },
        },
      },
      result: true,
    },
  });
}

export async function getHitPredictions(limit = 12): Promise<PredictionListItem[]> {
  return db.prediction.findMany({
    where: {
      published: true,
      race: { result: { hitTop1: true } },
    },
    include: {
      race: {
        include: {
          raceDay: { include: { hippodrome: true } },
          result: { select: { hitTop1: true, hitInCoupon: true, winnerNo: true, ganyan: true } },
        },
      },
      picks: {
        where: { rank: 1 },
        include: { runner: { select: { name: true, no: true } } },
      },
      author: { select: { name: true } },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
  });
}

export async function getPublishedPredictions(
  page = 1,
  perPage = 20,
  classType?: string
): Promise<{ items: PredictionListItem[]; total: number }> {
  const where: Prisma.PredictionWhereInput = {
    published: true,
    race: {
      result: { hitTop1: true },
      ...(classType ? { classType } : {}),
    },
  };

  const [items, total] = await Promise.all([
    db.prediction.findMany({
      where,
      include: {
        race: {
          include: {
            raceDay: { include: { hippodrome: true } },
            result: { select: { hitTop1: true, hitInCoupon: true, winnerNo: true, ganyan: true } },
          },
        },
        picks: {
          where: { rank: 1 },
          include: { runner: { select: { name: true, no: true } } },
        },
        author: { select: { name: true } },
      },
      orderBy: { publishedAt: "desc" },
      skip: (page - 1) * perPage,
      take: perPage,
    }),
    db.prediction.count({ where }),
  ]);

  return { items, total };
}

/** Henüz sonuçlanmamış (bugün veya ileri tarihli) yayımlanmış aktif öneriler. */
export async function getActivePredictions(): Promise<PredictionListItem[]> {
  return db.prediction.findMany({
    where: {
      published: true,
      race: {
        result: null,
        raceDay: { date: { gte: startOfDay(new Date()) } },
      },
    },
    include: {
      race: {
        include: {
          raceDay: { include: { hippodrome: true } },
          result: { select: { hitTop1: true, hitInCoupon: true, winnerNo: true, ganyan: true } },
        },
      },
      picks: {
        where: { rank: 1 },
        include: { runner: { select: { name: true, no: true } } },
      },
      author: { select: { name: true } },
    },
    orderBy: [{ race: { raceDay: { date: "asc" } } }, { race: { raceNo: "asc" } }],
  });
}

// ─── Kombine Kupon ──────────────────────────────────────────────────────────────

export type ComboLeg = {
  raceId: string;
  raceNo: number;
  time: string | null;
  confidence: Confidence;
  isBanko: boolean;
  horses: { no: number; name: string }[];
};

const MAX_HORSES_PER_LEG = 7;

/** Banko/yüksek güvende az at, düşük güvende daha fazla at — riskli ayaklara site otomatik daha geniş kapsama önerir. */
function legHorseCount(confidence: Confidence, isBanko: boolean): number {
  if (isBanko || confidence === "YUKSEK") return 1;
  if (confidence === "ORTA") return 3;
  return MAX_HORSES_PER_LEG;
}

/** Bir hipodrom/gün için, her koşunun güven seviyesine göre kaç at oynanacağını otomatik belirleyen kombine kupon önerisi. */
export async function getComboCoupon(hippodromeSlug: string, dateStr: string): Promise<ComboLeg[]> {
  const date = new Date(dateStr + "T00:00:00.000Z");
  const raceDay = await db.raceDay.findFirst({
    where: { date, hippodrome: { slug: hippodromeSlug } },
    include: {
      races: {
        where: { prediction: { published: true } },
        include: {
          prediction: {
            include: {
              picks: {
                orderBy: { rank: "asc" },
                include: { runner: { select: { no: true, name: true } } },
              },
            },
          },
        },
        orderBy: { raceNo: "asc" },
      },
    },
  });
  if (!raceDay) return [];

  return raceDay.races
    .filter((r) => r.prediction)
    .map((r) => {
      const pred = r.prediction!;
      const count = Math.min(legHorseCount(pred.confidence, pred.isBanko), MAX_HORSES_PER_LEG);
      const horses = pred.picks.slice(0, count).map((p) => ({
        no: p.runner?.no ?? 0,
        name: p.runner?.name ?? p.runnerLabel,
      }));
      return {
        raceId: r.id,
        raceNo: r.raceNo,
        time: r.time,
        confidence: pred.confidence,
        isBanko: pred.isBanko,
        horses,
      };
    });
}

// ─── Anasayfa: Tahmin Önerileri (Ekonomik/Normal/Geniş kupon) ─────────────────

export type KuponLeg = { raceNo: number; nos: number[]; winnerNo?: number | null; resulted: boolean };
export type KuponStatus = "hit" | "miss" | "pending";
export type KuponVariant = {
  key: "ekonomik" | "normal" | "genis";
  label: string;
  legs: KuponLeg[];
  amount: number;
  status: KuponStatus;
};
export type KuponOnerisi = { hippodromeName: string; variants: KuponVariant[] } | null;
export type HomeKuponLeg = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

/** Tüm yarışlar yurtiçi (yabancı hipodromlar ingest sırasında elenir) — birim bahis bedeli sabit. */
const STAKE_PER_COMBINATION = 1.25;

function kuponAmount(nosPerLeg: number[][]): number {
  const combinations = nosPerLeg.reduce((acc, nos) => acc * Math.max(nos.length, 1), 1);
  return Math.round(combinations * STAKE_PER_COMBINATION * 100) / 100;
}

async function buildKuponOnerisi(active: {
  hippodromeName: string;
  date: Date;
  legs: unknown;
}): Promise<KuponOnerisi> {
  const legs = active.legs as unknown as HomeKuponLeg[];
  if (!Array.isArray(legs) || legs.length === 0) return null;

  // Hipodrom adı artık "Ankara — 1. Altılı" gibi bir etiket içerebilir; gerçek isim kısmını ayıkla.
  const baseName = active.hippodromeName.split(" — ")[0];

  // Her ayağın gerçek kazananını ve sonucun girilip girilmediğini bul — kupon numaralarıyla eşleşeni
  // yeşil göstermek, eşleşmeyeni (sonuç girilmiş ama kazanan seçilmemiş) "kaçtı" olarak işaretlemek için.
  const hippodrome = await db.hippodrome.findUnique({ where: { name: baseName } });
  const resultByRaceNo = new Map<number, { winnerNo: number | null; resulted: boolean }>();
  if (hippodrome) {
    const races = await db.race.findMany({
      where: {
        raceNo: { in: legs.map((l) => l.raceNo) },
        raceDay: { hippodromeId: hippodrome.id, date: { gte: startOfDay(active.date), lte: endOfDay(active.date) } },
      },
      include: { result: { select: { winnerNo: true } } },
    });
    for (const r of races) resultByRaceNo.set(r.raceNo, { winnerNo: r.result?.winnerNo ?? null, resulted: r.result != null });
  }

  function toLegs(nosFn: (l: HomeKuponLeg) => number[]): KuponLeg[] {
    return legs.map((l) => {
      const entry = resultByRaceNo.get(l.raceNo);
      return { raceNo: l.raceNo, nos: nosFn(l), winnerNo: entry?.winnerNo ?? null, resulted: entry?.resulted ?? false };
    });
  }

  function statusFor(variantLegs: KuponLeg[]): KuponStatus {
    if (variantLegs.some((l) => l.resulted && !l.nos.includes(l.winnerNo as number))) return "miss";
    if (variantLegs.some((l) => !l.resulted)) return "pending";
    return "hit";
  }

  // Normal/Geniş için ayrıca seçim yapılmamışsa bir alt seviyeye düşer (Geniş→Normal→Ekonomik).
  const narrowLegs = toLegs((l) => l.narrow);
  const normalLegs = toLegs((l) => (l.normal.length > 0 ? l.normal : l.narrow));
  const wideLegs = toLegs((l) => (l.wide.length > 0 ? l.wide : l.normal.length > 0 ? l.normal : l.narrow));

  return {
    hippodromeName: active.hippodromeName,
    variants: [
      { key: "ekonomik", label: "Ekonomik", legs: narrowLegs, amount: kuponAmount(narrowLegs.map((l) => l.nos)), status: statusFor(narrowLegs) },
      { key: "normal", label: "Normal", legs: normalLegs, amount: kuponAmount(normalLegs.map((l) => l.nos)), status: statusFor(normalLegs) },
      { key: "genis", label: "Geniş", legs: wideLegs, amount: kuponAmount(wideLegs.map((l) => l.nos)), status: statusFor(wideLegs) },
    ],
  };
}

/** Admin'in manuel kurup yayınladığı (isActive) kombine kuponları (her slot/altılı kendi başına) anasayfa için hazırlar. */
export async function getKuponOnerileri(): Promise<KuponOnerisi[]> {
  const actives = await db.homeKupon.findMany({
    where: { isActive: true },
    orderBy: [{ slot: "asc" }, { updatedAt: "desc" }],
  });

  // Günün kuponu sadece o gün için geçerlidir — gün bitince admin elle kaldırmasa da otomatik kalkar.
  const today = turkeyDateString();
  const validActives = actives.filter((a) => a.date.toISOString().slice(0, 10) === today);

  const results = await Promise.all(validActives.map((a) => buildKuponOnerisi(a)));
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
}

// ─── Altılı Ganyan Ne Verir ─────────────────────────────────────────────────────

export type AltiliFavorite = { no: number; name: string; agf: number };
export type AltiliLeg = { raceId: string; raceNo: number; time: string | null; favorites: AltiliFavorite[] };
export type AltiliTier = { label: string; horseCount: number; combinations: number; amount: number };
export type PayoutOutlook = { level: "dusuk" | "orta" | "yuksek"; avgTopAgf: number; text: string };
export type AltiliNeVerir = { hippodromeName: string; legs: AltiliLeg[]; tiers: AltiliTier[]; outlook: PayoutOutlook } | null;

/**
 * Altılı ganyan ikramiyesi havuzun, tutturan bilet sayısına bölünmesiyle belirlenir —
 * gerçek tutarı ancak yarış bitince hesaplanabilir (canlı bahis/havuz verisine erişimimiz yok).
 * Bunun yerine AGF yoğunluğundan kalitatif bir sinyal çıkarırız: favoriler güçlü/tek
 * yönlüyse (yüksek AGF) favoriler kazandığında bilen çok olur → ikramiye düşük gelir;
 * favoriler zayıf/dağınıksa (düşük AGF) sürpriz ihtimali ve olası ikramiye yüksektir.
 */
function computePayoutOutlook(legs: AltiliLeg[]): PayoutOutlook {
  const topAgfs = legs.map((l) => l.favorites[0]?.agf ?? 0);
  const avgTopAgf = topAgfs.length > 0 ? topAgfs.reduce((a, b) => a + b, 0) / topAgfs.length : 0;

  if (avgTopAgf >= 35) {
    return {
      level: "dusuk",
      avgTopAgf,
      text: `Favoriler güçlü ve belirgin (ortalama en favori AGF %${avgTopAgf.toFixed(0)}). Favoriler kazanırsa bilen kişi sayısı yüksek olur — ikramiye düşük gelme olasılığı yüksek.`,
    };
  }
  if (avgTopAgf >= 20) {
    return {
      level: "orta",
      avgTopAgf,
      text: `Favoriler orta düzeyde belirgin (ortalama en favori AGF %${avgTopAgf.toFixed(0)}). İkramiye potansiyeli orta seviyede.`,
    };
  }
  return {
    level: "yuksek",
    avgTopAgf,
    text: `Favoriler zayıf/dağınık (ortalama en favori AGF %${avgTopAgf.toFixed(0)}). Sürpriz ihtimali yüksek — sürpriz gelirse ikramiye büyük gelebilir.`,
  };
}

const ALTILI_TIERS: { label: string; horseCount: number }[] = [
  { label: "1 At (En Favori)", horseCount: 1 },
  { label: "2 At", horseCount: 2 },
  { label: "3 At", horseCount: 3 },
];

/**
 * Bir hipodrom/günün tüm koşularında, TJK'nın resmi AGF (Ağırlıklı Genel Favori)
 * yüzdesine göre en favori atları sıralayıp "Altılı Ganyan ne verir" sorusuna
 * basit bir kombinasyon/tutar tahmini ile cevap verir. Gerçek 1./2. Altılı
 * koşu gruplaması ayrıca tutulmadığından, günün tüm koşuları baz alınır.
 */
export async function getAltiliNeVerir(hippodromeSlug: string, dateStr: string): Promise<AltiliNeVerir> {
  const date = new Date(dateStr + "T00:00:00.000Z");
  const raceDay = await db.raceDay.findFirst({
    where: { date, hippodrome: { slug: hippodromeSlug } },
    include: {
      hippodrome: { select: { name: true } },
      races: {
        include: { runners: { select: { no: true, name: true, agf: true } } },
        orderBy: { raceNo: "asc" },
      },
    },
  });
  if (!raceDay) return null;

  const legs: AltiliLeg[] = raceDay.races
    .filter((r) => r.runners.some((rn) => rn.agf != null))
    .map((r) => ({
      raceId: r.id,
      raceNo: r.raceNo,
      time: r.time,
      favorites: r.runners
        .filter((rn) => rn.agf != null)
        .sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0))
        .slice(0, 5)
        .map((rn) => ({ no: rn.no, name: rn.name, agf: rn.agf as number })),
    }));

  if (legs.length === 0) return null;

  const tiers: AltiliTier[] = ALTILI_TIERS.map((t) => {
    const nosPerLeg = legs.map((l) => l.favorites.slice(0, t.horseCount).map((f) => f.no));
    const combinations = nosPerLeg.reduce((acc, nos) => acc * Math.max(nos.length, 1), 1);
    return { label: t.label, horseCount: t.horseCount, combinations, amount: Math.round(combinations * STAKE_PER_COMBINATION * 100) / 100 };
  });

  return { hippodromeName: raceDay.hippodrome.name, legs, tiers, outlook: computePayoutOutlook(legs) };
}
