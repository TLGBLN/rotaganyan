"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { postTweet } from "@/lib/x";

export type HomeKuponLegInput = {
  raceNo: number;
  narrow: number[];
  normal: number[];
  wide: number[];
};

export type HomeKuponInput = {
  hippodromeName: string;
  date: string;
  legs: HomeKuponLegInput[];
  slot: number;
};

/**
 * Bir hipodrom/günün koşu+at listesini döner. Yayınlanmış analizi olan koşularda
 * atlar /kosular sayfasındaki gibi analiz sıralamasına (Pick.rank) göre dizilir;
 * analizde yer almayan atlar listenin sonuna at numarasına göre eklenir.
 */
export async function getRaceDayLegs(hippodromeSlug: string, dateStr: string) {
  await requireRole("EDITOR");

  const date = new Date(dateStr + "T00:00:00.000Z");
  const dayEnd = new Date(date.getTime() + 86_400_000);

  const raceDay = await db.raceDay.findFirst({
    where: {
      date: { gte: date, lt: dayEnd },
      hippodrome: { slug: hippodromeSlug },
    },
    include: {
      hippodrome: true,
      races: {
        include: {
          runners: { orderBy: { no: "asc" }, select: { id: true, no: true, name: true } },
          prediction: {
            select: {
              picks: {
                orderBy: { rank: "asc" },
                select: { rank: true, runnerId: true },
              },
            },
          },
        },
        orderBy: { raceNo: "asc" },
      },
    },
  });
  if (!raceDay) return null;

  // Karma altılılarda her koşu başka bir hipodromun aynasıdır (conditions = "İstanbul 8. Koşu" gibi).
  // Bu yarışların kendi prediction'ı olmaz; at sıralaması için kaynak yarışın pick'leri bulunur.
  const karmaRaces = raceDay.races.filter((r) => !r.prediction && r.conditions);
  const sourcePicksById = new Map<string, { rank: number; runnerId: string }[]>();

  // rankByNo: Karma yarışlar için at numarası → analiz sırası eşlemesi
  const rankByNoById = new Map<string, Map<number, number>>();

  if (karmaRaces.length > 0) {
    // conditions → "HipodromAdı RaceNo. Koşu" formatından parse et
    const parsedSources = karmaRaces.flatMap((r) => {
      const m = r.conditions?.match(/^(.+?)\s+(\d+)\.\s*Ko[şs]u/i);
      if (!m) return [];
      return [{ raceId: r.id, hippodromeName: m[1].trim(), raceNo: parseInt(m[2], 10) }];
    });

    if (parsedSources.length > 0) {
      // Kaynak yarışları + runner'larını + pick'lerini tek sorguda çek
      const sourceRaces = await db.race.findMany({
        where: {
          raceDay: { date: { gte: date, lt: dayEnd } },
          raceNo: { in: parsedSources.map((s) => s.raceNo) },
          prediction: { isNot: null },
        },
        include: {
          raceDay: { include: { hippodrome: { select: { name: true } } } },
          runners: { select: { id: true, no: true } },
          prediction: {
            select: {
              picks: { orderBy: { rank: "asc" }, select: { rank: true, runnerId: true } },
            },
          },
        },
      });

      for (const src of parsedSources) {
        const match = sourceRaces.find(
          (sr) =>
            sr.raceNo === src.raceNo &&
            sr.raceDay.hippodrome.name.toLowerCase().includes(src.hippodromeName.toLowerCase())
        );
        if (!match?.prediction) continue;

        // Kaynak runner ID'den at numarasına map oluştur, sonra no→rank yap
        const runnerIdToNo = new Map(match.runners.map((ru) => [ru.id, ru.no]));
        const noToRank = new Map<number, number>();
        for (const pick of match.prediction.picks) {
          const no = runnerIdToNo.get(pick.runnerId);
          if (no != null) noToRank.set(no, pick.rank);
        }
        rankByNoById.set(src.raceId, noToRank);
      }
    }
  }

  return {
    hippodromeName: raceDay.hippodrome.name,
    races: raceDay.races.map((r) => {
      // Kendi prediction'ı varsa runnerId bazlı, Karma aynasıysa no bazlı sırala
      let rankByRunnerId: Map<string, number> | null = null;
      let rankByNo: Map<number, number> | null = null;

      if (r.prediction) {
        const picks = r.prediction.picks;
        rankByRunnerId = new Map(picks.map((p) => [p.runnerId, p.rank]));
      } else {
        rankByNo = rankByNoById.get(r.id) ?? null;
      }

      const runners = [...r.runners].sort((a, b) => {
        const rankA = rankByRunnerId?.get(a.id) ?? rankByNo?.get(a.no) ?? Infinity;
        const rankB = rankByRunnerId?.get(b.id) ?? rankByNo?.get(b.no) ?? Infinity;
        if (rankA !== rankB) return rankA - rankB;
        return a.no - b.no;
      });
      return {
        raceNo: r.raceNo,
        runners: runners.map((runner) => ({ no: runner.no, name: runner.name })),
      };
    }),
  };
}

export async function publishHomeKupon(input: HomeKuponInput) {
  await requireRole("EDITOR");

  const legs = input.legs
    .filter((l) => l.narrow.length > 0 || l.normal.length > 0 || l.wide.length > 0)
    .map((l) => ({
      raceNo: l.raceNo,
      narrow: l.narrow,
      normal: l.normal,
      wide: l.wide,
    }));

  await db.$transaction([
    db.homeKupon.updateMany({ where: { isActive: true, slot: input.slot }, data: { isActive: false } }),
    db.homeKupon.create({
      data: {
        hippodromeName: input.hippodromeName,
        date: new Date(input.date + "T00:00:00.000Z"),
        legs,
        slot: input.slot,
        isActive: true,
      },
    }),
  ]);

  revalidatePath("/");
  revalidatePath("/admin/kupon");
}

export async function setActiveHomeKupon(id: string) {
  await requireRole("EDITOR");

  const target = await db.homeKupon.findUnique({ where: { id }, select: { slot: true } });
  if (!target) return;

  await db.$transaction([
    db.homeKupon.updateMany({ where: { isActive: true, slot: target.slot }, data: { isActive: false } }),
    db.homeKupon.update({ where: { id }, data: { isActive: true } }),
  ]);

  revalidatePath("/");
  revalidatePath("/admin/kupon");
}

export async function deactivateHomeKupon(id: string) {
  await requireRole("EDITOR");

  await db.homeKupon.update({ where: { id }, data: { isActive: false } });

  revalidatePath("/");
  revalidatePath("/admin/kupon");
}

export async function deleteHomeKupon(id: string) {
  await requireRole("EDITOR");

  await db.homeKupon.delete({ where: { id } });

  revalidatePath("/admin/kupon");
}

export async function shareHomeKuponOnX(text: string) {
  await requireRole("EDITOR");
  return postTweet(text);
}
