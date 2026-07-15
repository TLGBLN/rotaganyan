"use server";

import { db } from "@/lib/db";

export type HorseHistoryEntry = {
  raceId: string;
  date: string;
  hippodrome: string;
  raceNo: number;
  distance: number;
  surface: string;
  jockey: string | null;
  weight: number | null;
  hp: number | null;
  agf: number | null;
  bestTime: string | null;
  scratched: boolean;
  finishPos: number | null;
};

function finishPosition(actualOrder: unknown, runnerNo: number): number | null {
  if (!Array.isArray(actualOrder)) return null;
  const idx = actualOrder.findIndex((v) => Number(v) === runnerNo);
  return idx === -1 ? null : idx + 1;
}

/** Bir atın (isme göre) geçmiş yarışlarını, en yeniden eskiye, en fazla 15 kayıt döner. */
export async function getHorseHistory(name: string): Promise<HorseHistoryEntry[]> {
  const runners = await db.runner.findMany({
    where: { name },
    orderBy: { race: { raceDay: { date: "desc" } } },
    take: 15,
    select: {
      no: true,
      jockey: true,
      weight: true,
      hp: true,
      agf: true,
      bestTime: true,
      scratched: true,
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

  return runners.map((r) => ({
    raceId: r.race.id,
    date: r.race.raceDay.date.toISOString(),
    hippodrome: r.race.raceDay.hippodrome.name,
    raceNo: r.race.raceNo,
    distance: r.race.distance,
    surface: r.race.surface,
    jockey: r.jockey,
    weight: r.weight,
    hp: r.hp,
    agf: r.agf,
    bestTime: r.bestTime,
    scratched: r.scratched,
    finishPos: r.race.result ? finishPosition(r.race.result.actualOrder, r.no) : null,
  }));
}