"use server";

import { db } from "@/lib/db";
import { fetchTjkAtKosuBilgileri, type TjkAtKosuRow } from "@/server/services/ingest/tjk-at-performans.adapter";

export type AtPerformansRunnerData = {
  runnerNo: number;
  horseName: string;
  hasTjkId: boolean;
  records: TjkAtKosuRow[];
};

const SURFACE_PREFIX: Record<string, string> = { CIM: "Ç", KUM: "K", SENTETIK: "S" };

/**
 * Bu koşudaki her at için, TJK'nın resmi at profilinden aynı hipodrom + aynı mesafe +
 * aynı pist tipinde, koşunun kendi yılına ait geçmiş performansını döner.
 */
export async function getAtPerformansForRace(raceId: string): Promise<AtPerformansRunnerData[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      distance: true,
      surface: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true } } } },
      runners: { select: { no: true, name: true, tjkAtId: true } },
    },
  });
  if (!race) return [];

  const hippodromeName = race.raceDay.hippodrome.name.trim();
  const surfacePrefix = SURFACE_PREFIX[race.surface] ?? "";
  const raceYear = race.raceDay.date.getUTCFullYear().toString();

  return Promise.all(
    race.runners.map(async (r): Promise<AtPerformansRunnerData> => {
      if (!r.tjkAtId) {
        return { runnerNo: r.no, horseName: r.name, hasTjkId: false, records: [] };
      }
      try {
        const all = await fetchTjkAtKosuBilgileri(r.tjkAtId);
        const filtered = all.filter(
          (row) =>
            row.year === raceYear &&
            row.distance === race.distance &&
            row.city.includes(hippodromeName) &&
            (surfacePrefix === "" || row.surface.startsWith(surfacePrefix))
        );
        return { runnerNo: r.no, horseName: r.name, hasTjkId: true, records: filtered };
      } catch {
        return { runnerNo: r.no, horseName: r.name, hasTjkId: true, records: [] };
      }
    })
  );
}
