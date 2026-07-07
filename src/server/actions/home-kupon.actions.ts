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
  const raceDay = await db.raceDay.findFirst({
    where: {
      date: { gte: date, lt: new Date(date.getTime() + 86_400_000) },
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

  return {
    hippodromeName: raceDay.hippodrome.name,
    races: raceDay.races.map((r) => {
      const picks = r.prediction?.picks ?? [];
      const rankByRunnerId = new Map(picks.map((p) => [p.runnerId, p.rank]));
      const runners = [...r.runners].sort((a, b) => {
        const rankA = rankByRunnerId.get(a.id) ?? Infinity;
        const rankB = rankByRunnerId.get(b.id) ?? Infinity;
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
