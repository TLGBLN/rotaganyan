"use server";

import { db } from "@/lib/db";

export type H2HEncounter = {
  raceId: string;
  date: string;
  hippodrome: string;
  raceNo: number;
  distance: number;
  surface: string;
  results: { horseName: string; finishPos: number | null }[];
};

function finishPosition(actualOrder: unknown, runnerNo: number): number | null {
  if (!Array.isArray(actualOrder)) return null;
  const idx = actualOrder.findIndex((v) => Number(v) === runnerNo);
  return idx === -1 ? null : idx + 1;
}

/** Bu koşudaki atlardan en az ikisinin daha önce aynı yarışta birlikte koştuğu geçmiş karşılaşmaları (en yeniden eskiye, en fazla 15) döner. */
export async function getH2HForRace(raceId: string): Promise<H2HEncounter[]> {
  const currentRunners = await db.runner.findMany({
    where: { raceId },
    select: { name: true },
  });
  const names = currentRunners.map((r) => r.name);
  if (names.length < 2) return [];

  const pastRunners = await db.runner.findMany({
    where: { name: { in: names }, raceId: { not: raceId } },
    select: {
      name: true,
      no: true,
      race: {
        select: {
          id: true,
          raceNo: true,
          distance: true,
          surface: true,
          raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
          result: { select: { actualOrder: true } },
        },
      },
    },
  });

  const byRace = new Map<string, typeof pastRunners>();
  for (const r of pastRunners) {
    const list = byRace.get(r.race.id) ?? [];
    list.push(r);
    byRace.set(r.race.id, list);
  }

  const encounters: H2HEncounter[] = [];
  for (const [pastRaceId, runners] of byRace) {
    if (runners.length < 2) continue;
    const ref = runners[0].race;
    encounters.push({
      raceId: pastRaceId,
      date: ref.raceDay.date.toISOString(),
      hippodrome: ref.raceDay.hippodrome.name,
      raceNo: ref.raceNo,
      distance: ref.distance,
      surface: ref.surface,
      results: runners
        .map((r) => ({
          horseName: r.name,
          finishPos: r.race.result ? finishPosition(r.race.result.actualOrder, r.no) : null,
        }))
        .sort((a, b) => (a.finishPos ?? 99) - (b.finishPos ?? 99)),
    });
  }

  return encounters
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 15);
}
