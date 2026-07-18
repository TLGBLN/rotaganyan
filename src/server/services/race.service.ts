import { db } from "@/lib/db";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { turkeyDateString } from "@/lib/tz";
import type { Prisma, Confidence } from "@prisma/client";
import { syncResultsForDate } from "./result-sync";
import { fetchApprenticeRemainingRaces, normalizeJockeyName } from "./ingest/tjk-apprentice.adapter";

/** Runner.raceStyle JSON alanından ("style" + "percent") ekranda gösterilecek değeri çıkarır. */
function parseRaceStyle(raw: unknown): { style: string; percent: number } | null {
  const r = raw as { style?: string; percent?: number } | null;
  if (!r?.style || r.percent == null) return null;
  return { style: r.style, percent: r.percent };
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type ProgramRaceDay = Prisma.RaceDayGetPayload<{
  include: {
    hippodrome: true;
    races: {
      include: {
        prediction: {
          select: {
            id: true;
            published: true;
            confidence: true;
            isBanko: true;
            couponNormal: true;
            couponWide: true;
            picks: {
              orderBy: { rank: "asc" };
              select: {
                id: true;
                rank: true;
                score: true;
                isTarget: true;
                runnerLabel: true;
                details: true;
                runner: { select: { name: true; no: true; jockeyChanged: true; previousJockey: true; scratched: true } };
              };
            };
          };
        };
        result: { select: { hitTop1: true; hitInCoupon: true; ganyan: true; winnerNo: true; actualOrder: true } };
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
          include: { runner: { select: { name: true; no: true; jockeyChanged: true; previousJockey: true } } };
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
              id: true,
              published: true,
              confidence: true,
              isBanko: true,
              couponNormal: true,
              couponWide: true,
              picks: {
                orderBy: { rank: "asc" },
                select: {
                  id: true,
                  rank: true,
                  score: true,
                  isTarget: true,
                  runnerLabel: true,
                  details: true,
                  runner: { select: { name: true, no: true, jockeyChanged: true, previousJockey: true, scratched: true } },
                },
              },
            },
          },
          result: { select: { hitTop1: true, hitInCoupon: true, ganyan: true, winnerNo: true, actualOrder: true } },
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
            include: { runner: { select: { name: true, no: true, jockeyChanged: true, previousJockey: true } } },
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
  const today = new Date(turkeyDateString() + "T00:00:00.000Z");
  return db.prediction.findMany({
    where: {
      published: true,
      race: {
        result: null,
        raceDay: { date: { gte: today } },
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
  // Aynı sorguda o ayağın analiz sırasını (Pick.rank) da çekiyoruz — kupondaki atlar sayı sırasına göre
  // değil, analizdeki tahmin sırasına göre dizilsin diye.
  const resultByRaceNo = new Map<number, { winnerNo: number | null; resulted: boolean }>();
  const rankByRaceNo = new Map<number, Map<number, number>>();
  const races = await db.race.findMany({
    where: {
      raceNo: { in: legs.map((l) => l.raceNo) },
      raceDay: {
        date: { gte: startOfDay(active.date), lte: endOfDay(active.date) },
        hippodrome: { name: baseName },
      },
    },
    include: {
      result: { select: { winnerNo: true } },
      prediction: { select: { picks: { select: { rank: true, runner: { select: { no: true } } } } } },
    },
  });
  for (const r of races) {
    resultByRaceNo.set(r.raceNo, { winnerNo: r.result?.winnerNo ?? null, resulted: r.result != null });
    const rankByNo = new Map<number, number>();
    for (const pick of r.prediction?.picks ?? []) {
      if (pick.runner) rankByNo.set(pick.runner.no, pick.rank);
    }
    if (rankByNo.size > 0) rankByRaceNo.set(r.raceNo, rankByNo);
  }

  /** Atları sayı sırası yerine analizdeki tahmin sırasına (Pick.rank) göre dizer; analizde olmayanlar sona, kendi aralarında sayı sırasına göre eklenir. */
  function sortByAnalysisRank(raceNo: number, nos: number[]): number[] {
    const rankByNo = rankByRaceNo.get(raceNo);
    if (!rankByNo) return nos;
    return [...nos].sort((a, b) => {
      const ra = rankByNo.get(a) ?? Infinity;
      const rb = rankByNo.get(b) ?? Infinity;
      if (ra !== rb) return ra - rb;
      return a - b;
    });
  }

  function toLegs(nosFn: (l: HomeKuponLeg) => number[]): KuponLeg[] {
    return legs.map((l) => {
      const entry = resultByRaceNo.get(l.raceNo);
      return {
        raceNo: l.raceNo,
        nos: sortByAnalysisRank(l.raceNo, nosFn(l)),
        winnerNo: entry?.winnerNo ?? null,
        resulted: entry?.resulted ?? false,
      };
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

  if (validActives.length > 0) {
    await syncResultsForDate(today);
  }

  const results = await Promise.all(validActives.map((a) => buildKuponOnerisi(a)));
  // Yatan (miss) varyantlar gün bitmeden anasayfadan kalksın — tutan (hit) ve henüz
  // sonuçlanmamış (pending) varyantlar gün boyu yayında kalmaya devam eder. Bir
  // hipodromun Ekonomik/Normal/Geniş varyantları birbirinden bağımsız yatabilir
  // (ör. Ekonomik yatar ama Geniş hâlâ tutuyor olabilir). Geçmiş (yatan dahil)
  // admin panelindeki "Geçmiş Kuponlar" listesinde zaten saklanıyor — bu sadece
  // anasayfa görünümünü filtreler, veriyi silmez.
  return results
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .map((r) => ({ ...r, variants: r.variants.filter((v) => v.status !== "miss") }))
    .filter((r) => r.variants.length > 0);
}

// ─── Canlı Oranlar (anasayfa) ───────────────────────────────────────────────────

export type CurrentRace = {
  raceId: string;
  raceNo: number;
  time: string | null;
  hippodromeName: string;
  hippodromeSlug: string;
  runners: { no: number; name: string }[];
};

/** Her hipodromun o gün henüz sonuçlanmamış (şu an açık/yaklaşan) koşusunu döner — canlı oran paneli için. */
export async function getCurrentRaces(dateStr: string): Promise<CurrentRace[]> {
  const date = new Date(dateStr + "T00:00:00.000Z");

  const raceDays = await db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: { select: { name: true, slug: true } },
      races: {
        select: {
          id: true,
          raceNo: true,
          time: true,
          result: { select: { id: true } },
          runners: { select: { no: true, name: true }, orderBy: { no: "asc" } },
        },
        orderBy: { raceNo: "asc" },
      },
    },
  });

  const current: CurrentRace[] = [];
  for (const rd of raceDays) {
    const next = rd.races.find((r) => r.result == null);
    if (!next) continue;
    current.push({
      raceId: next.id,
      raceNo: next.raceNo,
      time: next.time,
      hippodromeName: rd.hippodrome.name,
      hippodromeSlug: rd.hippodrome.slug,
      runners: next.runners,
    });
  }
  return current;
}

// ─── Program Sayfası ──────────────────────────────────────────────────────────

export type ProgramGallop = {
  date: Date;
  track: string | null;
  form: string | null;
  jockey: string | null;
  splits: Record<string, string | null>;
};

export type ProgramRunner = {
  id: string;
  no: number;
  name: string;
  age: string | null;
  weight: number | null;
  weightChange: number | null;
  startNo: number | null;
  jockey: string | null;
  jockeyChanged: boolean;
  previousJockey: string | null;
  trainer: string | null;
  owner: string | null;
  sire: string | null;
  dam: string | null;
  damSire: string | null;
  pedigreeNote: string | null;
  hp: number | null;
  equipment: string | null;
  equipmentAdded: string | null;
  equipmentRemoved: string | null;
  bestTime: string | null;
  recentForm: string | null;
  recentFormSurfaces: string | null;
  agf: number | null;
  scratched: boolean;
  gallops: ProgramGallop[];
  ekuriGroup: number | null;
  apprentice: boolean;
  apprenticeRemaining: number | null;
  raceStyle: { style: string; percent: number } | null; // style: "KACAK" | "ON_GRUP" | "BEKLEME" | "EN_GERI"
  tjkAtId: number | null;
};

export type ProgramPick = {
  rank: number;
  runnerLabel: string | null;
  runner: { no: number; name: string } | null;
  score: number | null;
  details: string[];
};

export type ProgramRace = {
  id: string;
  raceNo: number;
  time: string | null;
  classType: string;
  breed: string;
  surface: string;
  distance: number;
  conditions: string | null;
  runners: ProgramRunner[];
  result: { winnerNo: number | null } | null;
  hasAnalysis: boolean;
  picks: ProgramPick[];
};

export type ProgramDay = {
  id: string;
  hippodromeName: string;
  hippodromeSlug: string;
  races: ProgramRace[];
  surfaceConditions: { label: string; detail: string }[] | null;
  weather: string | null;
};

export async function getProgramData(dateStr: string): Promise<ProgramDay[]> {
  const date = new Date(dateStr + "T00:00:00.000Z");

  const [raceDays, apprenticeRemainingMap] = await Promise.all([
    db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: { select: { name: true, slug: true } },
      races: {
        orderBy: { raceNo: "asc" },
        include: {
          result: { select: { winnerNo: true } },
          prediction: {
            select: {
              picks: {
                orderBy: { rank: "asc" },
                select: {
                  rank: true,
                  runnerLabel: true,
                  score: true,
                  details: true,
                  runner: { select: { no: true, name: true } },
                },
              },
            },
          },
          runners: {
            orderBy: { no: "asc" },
            select: {
              id: true, no: true, name: true, age: true, weight: true,
              weightChange: true, startNo: true, jockey: true,
              jockeyChanged: true, previousJockey: true, trainer: true,
              owner: true, sire: true, dam: true, damSire: true, pedigreeNote: true, hp: true,
              equipment: true, equipmentAdded: true, equipmentRemoved: true,
              bestTime: true, recentForm: true, recentFormSurfaces: true, agf: true,
              scratched: true, ekuriGroup: true, apprentice: true, raceStyle: true, tjkAtId: true,
              gallops: {
                orderBy: { date: "desc" },
                take: 3,
                select: { date: true, track: true, form: true, jockey: true, splits: true },
              },
            },
          },
        },
      },
    },
    orderBy: { hippodrome: { name: "asc" } },
    }),
    fetchApprenticeRemainingRaces().catch(() => ({}) as Record<string, number>),
  ]);

  // "Karma" hipodromu, gerçek koşuların kombine bahis için aynadaki (mirror) kopyasıdır —
  // idman/yarış stili senkronu "karma" için hiç çalışmaz (gerçek tekil hipodrom değil), bu
  // yüzden galop, yarış stili ve tahmin de orijinal koşudan miras alınmalı. Eşleştirme
  // Race.conditions metin alanına (mevcut ingest hiç doldurmuyor) değil, doğrudan atların
  // isim kümesine bakılarak yapılır — karma bir koşu, orijinal koşuyla birebir aynı atlara
  // sahiptir, bu yüzden isim kümesi imzası güvenilir bir eşleştirme anahtarıdır.
  function normHorseNameForMirror(name: string): string {
    return name.replace(/\([A-Z]{2,3}\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
  }
  function runnerSetSignature(runners: { name: string }[]): string {
    return runners.map((r) => normHorseNameForMirror(r.name)).sort().join("|");
  }

  // Build lookup for original (non-karma) races: at isim kümesi imzası → prediction + runner verisi
  const originalPred = new Map<string, typeof raceDays[0]["races"][0]["prediction"]>();
  const originalRunnerData = new Map<string, Map<string, { gallops: typeof raceDays[0]["races"][0]["runners"][0]["gallops"]; raceStyle: unknown }>>();
  for (const rd of raceDays) {
    if (rd.hippodrome.slug === "karma") continue;
    for (const r of rd.races) {
      if (r.runners.length === 0) continue;
      const key = runnerSetSignature(r.runners);
      originalPred.set(key, r.prediction);
      originalRunnerData.set(
        key,
        new Map(r.runners.map((ru) => [normHorseNameForMirror(ru.name), { gallops: ru.gallops, raceStyle: ru.raceStyle }]))
      );
    }
  }

  return raceDays.map((rd) => ({
    id: rd.id,
    hippodromeName: rd.hippodrome.name,
    hippodromeSlug: rd.hippodrome.slug,
    surfaceConditions: (rd.surfaceConditions as { label: string; detail: string }[] | null) ?? null,
    weather: rd.weather,
    races: rd.races.map((r) => {
      // Karma mirror: inherit prediction + galop/yarış stili from original race
      let pred = r.prediction;
      let originalRunners: Map<string, { gallops: typeof raceDays[0]["races"][0]["runners"][0]["gallops"]; raceStyle: unknown }> | undefined;
      if (rd.hippodrome.slug === "karma" && r.runners.length > 0) {
        const key = runnerSetSignature(r.runners);
        if (pred == null) pred = originalPred.get(key) ?? null;
        originalRunners = originalRunnerData.get(key);
      }
      return {
        id: r.id,
        raceNo: r.raceNo,
        time: r.time,
        classType: r.classType,
        breed: r.breed,
        surface: r.surface,
        distance: r.distance,
        conditions: r.conditions,
        runners: r.runners.map((ru) => {
          const inherited = originalRunners?.get(normHorseNameForMirror(ru.name));
          const gallops = ru.gallops.length > 0 ? ru.gallops : inherited?.gallops ?? ru.gallops;
          const raceStyle = ru.raceStyle ?? inherited?.raceStyle ?? null;
          const apprenticeRemaining =
            ru.apprentice && ru.jockey
              ? apprenticeRemainingMap[normalizeJockeyName(ru.jockey)] ?? null
              : null;
          return {
            ...ru,
            apprenticeRemaining,
            raceStyle: parseRaceStyle(raceStyle),
            gallops: gallops.map((g) => ({
              ...g,
              splits: (g.splits ?? {}) as Record<string, string | null>,
            })),
          };
        }),
        result: r.result,
        hasAnalysis: pred != null && pred.picks.length > 0,
        picks: (pred?.picks ?? []).map((p) => ({
          ...p,
          details: Array.isArray(p.details) ? (p.details as string[]) : [],
        })),
      };
    }),
  }));
}

// ─── Jokey İstatistikleri ─────────────────────────────────────────────────────

export type StatBucket = {
  wins: number;
  rides: number;
  winRate?: number;
  tableRate?: number;
  performanceScore?: number;
};

export type JockeyStat = {
  overall: StatBucket;
  byHippo: Record<string, StatBucket>;
  bySurface: Record<string, StatBucket>;
  byContext: Record<string, StatBucket>;        // "ankara:CIM:INGILIZ" | "ankara:CIM"
};

export function _norm(s: string) {
  return s.toUpperCase()
    .replace(/İ/g, "I").replace(/Ğ/g, "G").replace(/Ü/g, "U")
    .replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/\s+/g, " ").trim();
}

// "V.ABİŞ" veya "VURAL ABİŞ" → "ABIS" (nokta/boşlukla bölüp son token)
function _surname(normName: string): string {
  return normName.split(/[\s.]+/).filter(Boolean).at(-1) ?? normName;
}

// TJK'nın arama motoru Türkçe karakter (Ş/Ç/Ğ/Ü/Ö/İ) - ASCII eşdeğeri eşleştirmesi
// yapmıyor ("COSKUN" ile "COŞKUN" bulunamıyor) — bu yüzden TJK sorgusu için
// orijinal (ASCII'ye çevrilmemiş) soyadı gerekir; sadece boşluk/nokta ile böler.
function _surnameOriginal(name: string): string {
  return name.trim().split(/[\s.]+/).filter(Boolean).at(-1) ?? name;
}

/** Sadece jockeyStatSync tablosundan çeker — race results fallback yok. */
export async function getJockeyStats(names: string[]): Promise<Record<string, JockeyStat>> {
  if (names.length === 0) return {};
  const year = new Date().getFullYear();

  const allSyncRows = await db.jockeyStatSync.findMany({ where: { year } });

  // normalize → sync ismi + soyadı haritaları
  const normMap = new Map<string, string>();
  const surnameMap = new Map<string, string>();
  for (const row of allSyncRows) {
    const n = _norm(row.jockey);
    normMap.set(n, row.jockey);
    const sur = _surname(n);
    if (!surnameMap.has(sur)) surnameMap.set(sur, row.jockey);
  }

  // Baş harf + soyad eşleşmesi: "M.S.CELİK" → initials=["M","S"], sur="CELIK"
  // Soyada uyan adayları başharflere göre filtrele; tekse döndür, çoksa en fazla biniş yapanı al
  function resolveByInitials(n: string): string | undefined {
    const parts = n.split(/[\s.]+/).filter(Boolean);
    if (parts.length < 2) return undefined;
    const sur = parts[parts.length - 1];
    const initials = parts.slice(0, -1);
    const candidates = allSyncRows.filter((r) => {
      const rn = _norm(r.jockey).split(/\s+/);
      if (_surname(_norm(r.jockey)) !== sur) return false;
      return initials.every((init, i) => (rn[i] ?? "").startsWith(init));
    });
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0].jockey;
    // Birden fazla aday varsa en fazla biniş yapanı döndür
    return candidates.sort((a, b) => b.rides - a.rides)[0].jockey;
  }

  function resolve(name: string): string | undefined {
    const n = _norm(name);
    return normMap.get(n) ?? resolveByInitials(n) ?? surnameMap.get(_surname(n));
  }

  const out: Record<string, JockeyStat> = {};

  for (const name of names) {
    const syncName = resolve(name);
    if (!syncName) continue;

    const rows = allSyncRows.filter((r) => r.jockey === syncName);
    if (rows.length === 0) continue;

    if (!out[name]) out[name] = { overall: { wins: 0, rides: 0 }, byHippo: {}, bySurface: {}, byContext: {} };
    const stat = out[name];
    for (const row of rows) {
      if (row.hippoSlug && row.surface && row.breed) {
        stat.byContext[`${row.hippoSlug}:${row.surface}:${row.breed}`] = {
          wins: row.wins, rides: row.rides,
          winRate: row.winRate, tableRate: row.tableRate,
          performanceScore: row.performanceScore ?? undefined,
        };
        const k2 = `${row.hippoSlug}:${row.surface}`;
        stat.byContext[k2] ??= { wins: 0, rides: 0 };
        stat.byContext[k2].wins += row.wins;
        stat.byContext[k2].rides += row.rides;
      }
      stat.overall.wins += row.wins;
      stat.overall.rides += row.rides;
    }
  }

  return out;
}

/**
 * TJK'nın resmi Jokey İstatistikleri sayfasından JockeyStatSync tablosunu günceller
 * (cron tarafından çağrılır). Kendi program/sonuç verimizdeki eksiklerden etkilenmeyen
 * tek doğru kaynak — hippoSlug="overall", breed/surface=null olarak, yıl geneli
 * biniş/galibiyet sayılarını doğrudan TJK'dan yazar.
 */
export async function syncJockeyStatsFromTjk(
  year = new Date().getFullYear(),
  opts: { includeMissing?: boolean } = {}
): Promise<number> {
  const { fetchTjkJockeyStats, fetchTjkJockeyStatsByName } = await import("./ingest/tjk-jockey-stats.adapter");
  const rows = await fetchTjkJockeyStats(year);

  // TJK'nın toplu sayfalaması güvenilir değil ("Toplam X sonuçtan" dediği sayı,
  // DataRows ile gerçekte erişilebilenden fazla) — düşük binişli jokeyler/aprantiler
  // (örn. Enes Atlamaz, Mehmet Taha Coşkun) toplu listede hiç görünmüyor. Kendi
  // Runner verimizdeki isimlerle karşılaştırıp eksik kalanları soyadına göre
  // tek tek TJK'dan sorgulayarak tamamlıyoruz.
  if (opts.includeMissing) {
    const bulkSurnames = new Set(rows.map((r) => _surname(_norm(r.jockey))));
    const ourRunners = await db.runner.findMany({
      where: { jockey: { not: null }, race: { raceDay: { date: { gte: new Date(`${year}-01-01T00:00:00Z`) } } } },
      select: { jockey: true },
      distinct: ["jockey"],
    });
    const missingSurnames = new Map<string, string>(); // normalized → orijinal (TJK araması için)
    for (const r of ourRunners) {
      if (!r.jockey || r.jockey.includes("*")) continue;
      const sur = _surname(_norm(r.jockey));
      if (sur.length >= 2 && !bulkSurnames.has(sur)) missingSurnames.set(sur, _surnameOriginal(r.jockey));
    }

    const foundJockeys = new Set(rows.map((r) => r.jockey));
    for (const sur of missingSurnames.values()) {
      try {
        const found = await fetchTjkJockeyStatsByName(sur, year);
        for (const f of found) {
          if (!foundJockeys.has(f.jockey)) {
            rows.push(f);
            foundJockeys.add(f.jockey);
          }
        }
      } catch { /* TJK'da bu soyad için sonuç yok — atla */ }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Prisma'nın compound-unique kısayolu (jockey_hippoSlug_year_breed_surface) null
  // değer kabul etmiyor (Postgres'te NULL != NULL, unique lookup için belirsiz) —
  // bu yüzden "overall" satırlarını find + create/update ile yönetiyoruz.
  const existing = await db.jockeyStatSync.findMany({
    where: { year, hippoSlug: "overall", breed: null, surface: null },
    select: { id: true, jockey: true },
  });
  const existingByJockey = new Map(existing.map((r) => [r.jockey, r.id]));

  let updated = 0;
  for (const r of rows) {
    const tableCount = r.wins + r.place2 + r.place3 + r.place4 + r.place5;
    const winRate = r.races > 0 ? r.wins / r.races : 0;
    const tableRate = r.races > 0 ? tableCount / r.races : 0;
    const data = {
      rides: r.races, wins: r.wins, place2: r.place2, place3: r.place3, place4: r.place4, place5: r.place5,
      tableCount, winRate, tableRate,
    };

    const existingId = existingByJockey.get(r.jockey);
    if (existingId) {
      await db.jockeyStatSync.update({ where: { id: existingId }, data });
    } else {
      await db.jockeyStatSync.create({
        data: { jockey: r.jockey, hippoSlug: "overall", year, breed: null, surface: null, ...data, prizeTl: 0 },
      });
    }
    updated++;
  }

  return updated;
}

// ─── Antrenör İstatistikleri (TJK'dan çekilen) ───────────────────────────────

export type TrainerStat = { wins: number; rides: number };

/** Sadece trainerStatSync tablosundan çeker — TJK'nın resmi 2026 kazanma oranı. */
export async function getTrainerStats(names: string[]): Promise<Record<string, TrainerStat>> {
  if (names.length === 0) return {};
  const year = new Date().getFullYear();

  const allSyncRows = await db.trainerStatSync.findMany({ where: { year } });

  const normMap = new Map<string, string>();
  const surnameMap = new Map<string, string>();
  for (const row of allSyncRows) {
    const n = _norm(row.trainer);
    normMap.set(n, row.trainer);
    const sur = _surname(n);
    if (!surnameMap.has(sur)) surnameMap.set(sur, row.trainer);
  }

  function resolveByInitials(n: string): string | undefined {
    const parts = n.split(/[\s.]+/).filter(Boolean);
    if (parts.length < 2) return undefined;
    const sur = parts[parts.length - 1];
    const initials = parts.slice(0, -1);
    const candidates = allSyncRows.filter((r) => {
      const rn = _norm(r.trainer).split(/\s+/);
      if (_surname(_norm(r.trainer)) !== sur) return false;
      return initials.every((init, i) => (rn[i] ?? "").startsWith(init));
    });
    if (candidates.length === 0) return undefined;
    if (candidates.length === 1) return candidates[0].trainer;
    return candidates.sort((a, b) => b.rides - a.rides)[0].trainer;
  }

  function resolve(name: string): string | undefined {
    const n = _norm(name);
    return normMap.get(n) ?? resolveByInitials(n) ?? surnameMap.get(_surname(n));
  }

  const out: Record<string, TrainerStat> = {};
  for (const name of names) {
    const syncName = resolve(name);
    if (!syncName) continue;
    const row = allSyncRows.find((r) => r.trainer === syncName);
    if (!row) continue;
    out[name] = { wins: row.wins, rides: row.rides };
  }

  return out;
}

/**
 * TJK'nın resmi Antrenör İstatistikleri sayfasından TrainerStatSync tablosunu günceller
 * (cron tarafından çağrılır) — yıl geneli biniş/galibiyet sayılarını doğrudan TJK'dan yazar.
 */
export async function syncTrainerStatsFromTjk(
  year = new Date().getFullYear(),
  opts: { includeMissing?: boolean } = {}
): Promise<number> {
  const { fetchTjkTrainerStats, fetchTjkTrainerStatsByName } = await import("./ingest/tjk-trainer-stats.adapter");
  const rows = await fetchTjkTrainerStats(year);

  // Jokey sync'teki aynı boşluk: TJK'nın toplu sayfalaması düşük binişli
  // antrenörleri kesebiliyor — eksik kalanları soyadına göre tamamlıyoruz.
  if (opts.includeMissing) {
    const bulkSurnames = new Set(rows.map((r) => _surname(_norm(r.trainer))));
    const ourRunners = await db.runner.findMany({
      where: { trainer: { not: null }, race: { raceDay: { date: { gte: new Date(`${year}-01-01T00:00:00Z`) } } } },
      select: { trainer: true },
      distinct: ["trainer"],
    });
    const missingSurnames = new Map<string, string>(); // normalized → orijinal (TJK araması için)
    for (const r of ourRunners) {
      if (!r.trainer || r.trainer.includes("*")) continue;
      const sur = _surname(_norm(r.trainer));
      if (sur.length >= 2 && !bulkSurnames.has(sur)) missingSurnames.set(sur, _surnameOriginal(r.trainer));
    }

    const foundTrainers = new Set(rows.map((r) => r.trainer));
    for (const sur of missingSurnames.values()) {
      try {
        const found = await fetchTjkTrainerStatsByName(sur, year);
        for (const f of found) {
          if (!foundTrainers.has(f.trainer)) {
            rows.push(f);
            foundTrainers.add(f.trainer);
          }
        }
      } catch { /* TJK'da bu soyad için sonuç yok — atla */ }
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  let updated = 0;
  for (const r of rows) {
    const winRate = r.races > 0 ? r.wins / r.races : 0;
    await db.trainerStatSync.upsert({
      where: { trainer_year: { trainer: r.trainer, year } },
      update: { rides: r.races, wins: r.wins, winRate },
      create: { trainer: r.trainer, year, rides: r.races, wins: r.wins, winRate },
    });
    updated++;
  }

  return updated;
}

export type JockeyRow = {
  jockey: string;
  wins: number;
  rides: number;
  winPct: number;
};

/** Admin jokey veri sayfası için tüm jokeyler — hipodrom, pist ve ırk filtresiyle. */
export async function getAllJockeyStats(params: {
  hippoSlug?: string;
  surface?: string;
  breed?: string;
  year?: number;
}): Promise<JockeyRow[]> {
  const year = params.year ?? new Date().getFullYear();
  const since = new Date(`${year}-01-01T00:00:00Z`);

  const runners = await db.runner.findMany({
    where: {
      jockey: { not: null },
      race: {
        ...(params.surface ? { surface: params.surface as "CIM" | "KUM" | "SENTETIK" } : {}),
        ...(params.breed ? { breed: params.breed as "INGILIZ" | "ARAP" } : {}),
        raceDay: {
          date: { gte: since },
          ...(params.hippoSlug ? { hippodrome: { slug: params.hippoSlug } } : {}),
        },
        result: { isNot: null },
      },
    },
    select: {
      jockey: true,
      no: true,
      name: true,
      race: { select: { result: { select: { winnerNo: true } } } },
    },
  });

  const horseNames = new Set(runners.map((r) => r.name).filter(Boolean));

  const agg: Record<string, { wins: number; rides: number }> = {};
  for (const r of runners) {
    if (!r.jockey) continue;
    if (horseNames.has(r.jockey)) continue;
    const s = agg[r.jockey] ?? { wins: 0, rides: 0 };
    s.rides++;
    if (r.race.result?.winnerNo === r.no) s.wins++;
    agg[r.jockey] = s;
  }

  return Object.entries(agg)
    .map(([jockey, s]) => ({ jockey, ...s, winPct: s.rides > 0 ? Math.round(s.wins / s.rides * 100) : 0 }))
    .sort((a, b) => b.winPct - a.winPct || b.rides - a.rides);
}
