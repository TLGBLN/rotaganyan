"use server";

import { db } from "@/lib/db";
import { fetchTjkSon800ByHorseName, type TjkSon800Row } from "@/server/services/ingest/tjk-son800-stats.adapter";

export type Son800RunnerData = {
  runnerNo: number;
  horseName: string;
  records: TjkSon800Row[];
};

/** Bir koşudaki tüm atların TJK Son 800 geçmişini (en fazla son 3 kayıt) döner. */
export async function getSon800ForRace(raceId: string): Promise<Son800RunnerData[]> {
  const [race, runners] = await Promise.all([
    db.race.findUnique({ where: { id: raceId }, select: { raceDay: { select: { date: true } } } }),
    db.runner.findMany({ where: { raceId }, orderBy: { no: "asc" }, select: { no: true, name: true } }),
  ]);
  const raceYear = (race?.raceDay.date ?? new Date()).getUTCFullYear().toString();

  const results = await Promise.all(
    runners.map(async (r): Promise<Son800RunnerData> => {
      try {
        const rows = await fetchTjkSon800ByHorseName(r.name);
        const rowsBuYil = rows.filter((row) => row.year === raceYear);
        return { runnerNo: r.no, horseName: r.name, records: rowsBuYil.slice(-3).reverse() };
      } catch {
        return { runnerNo: r.no, horseName: r.name, records: [] };
      }
    })
  );

  return results;
}