import { db } from "@/lib/db";
import { startOfDay, endOfDay, subDays } from "date-fns";
import { turkeyDateString } from "@/lib/tz";
import type { Prisma, Confidence } from "@prisma/client";
import { syncResultsForDate } from "./result-sync";

/** "Bursa 4. Koşu" → { slug: "bursa", raceNo: 4 } */
function parseConditionsRef(conditions: string): { slug: string; raceNo: number } | null {
  const m = conditions.match(/^(.+?)\s+(\d+)\.\s*Ko[şs]u/i);
  if (!m) return null;
  const slug = m[1].trim()
    .replace(/[İI]/g, "i").replace(/ı/g, "i")
    .replace(/[ğĞ]/g, "g").replace(/[üÜ]/g, "u")
    .replace(/[şŞ]/g, "s").replace(/[öÖ]/g, "o").replace(/[çÇ]/g, "c")
    .toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  return { slug, raceNo: parseInt(m[2], 10) };
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
          include: { runner: { select: { name: true; no: true; pedigreeUrl: true; jockeyChanged: true; previousJockey: true } } };
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
            include: { runner: { select: { name: true, no: true, pedigreeUrl: true, jockeyChanged: true, previousJockey: true } } },
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
  return results.filter((r): r is NonNullable<typeof r> => r !== null);
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
  hp: number | null;
  bestTime: string | null;
  recentForm: string | null;
  recentFormSurfaces: string | null;
  agf: number | null;
  scratched: boolean;
  ekuriGroup: number | null;
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
};

export async function getProgramData(dateStr: string): Promise<ProgramDay[]> {
  const date = new Date(dateStr + "T00:00:00.000Z");

  const raceDays = await db.raceDay.findMany({
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
              owner: true, sire: true, dam: true, hp: true,
              bestTime: true, recentForm: true, recentFormSurfaces: true, agf: true,
              scratched: true, ekuriGroup: true,
            },
          },
        },
      },
    },
    orderBy: { hippodrome: { name: "asc" } },
  });

  // Build lookup for original races (conditions = null): "slug:raceNo" → prediction
  const originalPred = new Map<string, typeof raceDays[0]["races"][0]["prediction"]>();
  for (const rd of raceDays) {
    for (const r of rd.races) {
      if (r.conditions == null) {
        originalPred.set(`${rd.hippodrome.slug}:${r.raceNo}`, r.prediction);
      }
    }
  }

  return raceDays.map((rd) => ({
    id: rd.id,
    hippodromeName: rd.hippodrome.name,
    hippodromeSlug: rd.hippodrome.slug,
    races: rd.races.map((r) => {
      // Karma mirror: inherit prediction from original race
      let pred = r.prediction;
      if (r.conditions != null && pred == null) {
        const ref = parseConditionsRef(r.conditions);
        if (ref) pred = originalPred.get(`${ref.slug}:${ref.raceNo}`) ?? null;
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
        runners: r.runners,
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

async function _calcJockeyStatsFromResults(names: string[]): Promise<Record<string, JockeyStat>> {
  const since = new Date(`${new Date().getFullYear()}-01-01T00:00:00Z`);
  const runners = await db.runner.findMany({
    where: {
      jockey: { in: names },
      race: { raceDay: { date: { gte: since } }, result: { isNot: null } },
    },
    select: {
      jockey: true,
      no: true,
      race: {
        select: {
          surface: true,
          breed: true,
          raceDay: { select: { hippodrome: { select: { slug: true } } } },
          result: { select: { winnerNo: true } },
        },
      },
    },
  });

  const out: Record<string, JockeyStat> = {};
  for (const r of runners) {
    if (!r.jockey) continue;
    const isWin = r.race.result?.winnerNo === r.no;
    const hippoSlug = r.race.raceDay.hippodrome.slug;
    const contextKey = `${hippoSlug}:${r.race.surface}:${r.race.breed}`;
    const contextKeyNoBreed = `${hippoSlug}:${r.race.surface}`;
    if (!out[r.jockey]) out[r.jockey] = { overall: { wins: 0, rides: 0 }, byHippo: {}, bySurface: {}, byContext: {} };
    const stat = out[r.jockey];
    stat.overall.rides++; if (isWin) stat.overall.wins++;
    stat.byHippo[hippoSlug] ??= { wins: 0, rides: 0 }; stat.byHippo[hippoSlug].rides++; if (isWin) stat.byHippo[hippoSlug].wins++;
    stat.bySurface[r.race.surface] ??= { wins: 0, rides: 0 }; stat.bySurface[r.race.surface].rides++; if (isWin) stat.bySurface[r.race.surface].wins++;
    stat.byContext[contextKey] ??= { wins: 0, rides: 0 }; stat.byContext[contextKey].rides++; if (isWin) stat.byContext[contextKey].wins++;
    stat.byContext[contextKeyNoBreed] ??= { wins: 0, rides: 0 }; stat.byContext[contextKeyNoBreed].rides++; if (isWin) stat.byContext[contextKeyNoBreed].wins++;
  }
  return out;
}

/** Yarış sonuçlarından JockeyStatSync tablosunu günceller (cron tarafından çağrılır). */
export async function syncJockeyStatsFromResults(): Promise<number> {
  const year = new Date().getFullYear();
  const yearStart = new Date(`${year}-01-01T00:00:00Z`);

  // Load existing JockeyStatSync rows (with jsonCutoffDate for additive logic).
  const existingRows = await db.jockeyStatSync.findMany({
    where: { year },
    select: { jockey: true, hippoSlug: true, surface: true, breed: true, jsonCutoffDate: true,
              rides: true, wins: true, place2: true, place3: true, place4: true, place5: true, tableCount: true },
  });

  // surname → canonical name (for TJK abbreviated names like "V.ABİŞ" → "VEDAT ABİŞ")
  const canonicalBySurname = new Map<string, string>();
  for (const row of existingRows) {
    const sur = _surname(_norm(row.jockey));
    if (!canonicalBySurname.has(sur)) canonicalBySurname.set(sur, row.jockey);
  }

  // canonical key → existing row (for additive update)
  type SyncRow = typeof existingRows[number];
  const existingByKey = new Map<string, SyncRow>();
  for (const row of existingRows) {
    existingByKey.set(`${row.jockey}|${row.hippoSlug}|${row.surface}|${row.breed}`, row);
  }

  // Fetch runners with results. For rows with jsonCutoffDate, only count races AFTER
  // that cutoff so we add the delta on top of JSON baseline without double-counting.
  // For rows without jsonCutoffDate (no JSON import), count from year start.
  const runners = await db.runner.findMany({
    where: {
      jockey: { not: null },
      race: { raceDay: { date: { gte: yearStart } }, result: { isNot: null } },
    },
    select: {
      jockey: true,
      no: true,
      race: {
        select: {
          surface: true,
          breed: true,
          raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } },
          result: { select: { actualOrder: true, winnerNo: true } },
        },
      },
    },
  });

  type Agg = { wins: number; rides: number; p2: number; p3: number; p4: number; p5: number };
  const agg = new Map<string, Agg>();

  for (const r of runners) {
    if (!r.jockey) continue;
    const hippo = r.race.raceDay.hippodrome.slug;
    const surf = r.race.surface as string;
    const breed = r.race.breed as string;
    const raceDate = r.race.raceDay.date;

    // Resolve canonical name
    const sur = _surname(_norm(r.jockey));
    const jockey = canonicalBySurname.get(sur) ?? r.jockey;
    const canonicalKey = `${jockey}|${hippo}|${surf}|${breed}`;

    // If JSON import covers this combo, only count races after the cutoff
    const existingRow = existingByKey.get(canonicalKey);
    if (existingRow?.jsonCutoffDate && raceDate <= existingRow.jsonCutoffDate) continue;

    let a = agg.get(canonicalKey);
    if (!a) { a = { wins: 0, rides: 0, p2: 0, p3: 0, p4: 0, p5: 0 }; agg.set(canonicalKey, a); }
    a.rides++;
    const order = r.race.result?.actualOrder as number[] | null;
    if (Array.isArray(order)) {
      const pos = order.indexOf(r.no);
      if (pos === 0) a.wins++;
      else if (pos === 1) a.p2++;
      else if (pos === 2) a.p3++;
      else if (pos === 3) a.p4++;
      else if (pos === 4) a.p5++;
    } else if (r.race.result?.winnerNo === r.no) {
      a.wins++;
    }
  }

  // Track raw TJK names that resolved to a different canonical (to delete orphan rows)
  const orphanNames = new Set<string>();
  for (const r of runners) {
    if (!r.jockey) continue;
    const sur = _surname(_norm(r.jockey));
    const canonical = canonicalBySurname.get(sur);
    if (canonical && canonical !== r.jockey) orphanNames.add(r.jockey);
  }

  let updated = 0;

  for (const [canonicalKey, delta] of agg) {
    const [jockey, hippoSlug, surface, breed] = canonicalKey.split("|");
    const existing = existingByKey.get(canonicalKey);

    // Additive: JSON baseline + delta from DB races after cutoff
    const baseRides = existing?.rides ?? 0;
    const baseWins = existing?.wins ?? 0;
    const baseP2 = existing?.place2 ?? 0;
    const baseP3 = existing?.place3 ?? 0;
    const baseP4 = existing?.place4 ?? 0;
    const baseP5 = existing?.place5 ?? 0;

    const rides = baseRides + delta.rides;
    const wins = baseWins + delta.wins;
    const p2 = baseP2 + delta.p2;
    const p3 = baseP3 + delta.p3;
    const p4 = baseP4 + delta.p4;
    const p5 = baseP5 + delta.p5;
    const tableCount = wins + p2 + p3 + p4 + p5;
    const winRate = rides > 0 ? wins / rides : 0;
    const tableRate = rides > 0 ? tableCount / rides : 0;

    await db.jockeyStatSync.upsert({
      where: { jockey_hippoSlug_year_breed_surface: { jockey, hippoSlug, year, breed, surface } },
      update: { rides, wins, place2: p2, place3: p3, place4: p4, place5: p5, tableCount, winRate, tableRate },
      create: { jockey, hippoSlug, year, breed, surface, rides, wins, place2: p2, place3: p3, place4: p4, place5: p5, tableCount, winRate, tableRate, prizeTl: 0 },
    });
    updated++;
  }

  // Delete orphan rows (abbreviated TJK names superseded by canonical JSON-imported names).
  if (orphanNames.size > 0) {
    await db.jockeyStatSync.deleteMany({ where: { year, jockey: { in: [...orphanNames] } } });
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
