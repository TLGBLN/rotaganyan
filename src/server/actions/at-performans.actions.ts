"use server";

import { db } from "@/lib/db";
import { fetchTjkAtKosuBilgileri, type TjkAtKosuRow } from "@/server/services/ingest/tjk-at-performans.adapter";
import { tjkTarihOncesiMi } from "@/lib/tjk-date";

export type AtPerformansRunnerData = {
  runnerNo: number;
  horseName: string;
  hasTjkId: boolean;
  records: TjkAtKosuRow[];
};

const SURFACE_PREFIX: Record<string, string> = { CIM: "Ç", KUM: "K", SENTETIK: "S" };

/**
 * Bu koşudaki her at için, TJK'nın resmi at profilinden aynı mesafe + aynı pist tipinde,
 * koşunun kendi yılına ait geçmiş performansını döner. v6.10 (kullanıcı kararı 2026-07-27):
 * HİPODROM ARTIK ŞART DEĞİL — yalnız pist+mesafe eşleşmesi yeterli, hipodrom aynı olmak
 * zorunda değil (eskiden kesin hipodrom eşleşmesi de aranıyordu, örneklem daha dardı).
 * Pist+mesafe hâlâ KESİN eşleşme (tolerans/etiket yaklaşımı yok).
 */
export async function getAtPerformansForRace(raceId: string): Promise<AtPerformansRunnerData[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      distance: true,
      surface: true,
      raceDay: { select: { date: true } },
      runners: { select: { no: true, name: true, tjkAtId: true } },
    },
  });
  if (!race) return [];

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
            tjkTarihOncesiMi(row.date, race.raceDay.date) && // bkz. tjk-date.ts — hedef yarıştan sonraki hiçbir kayıt "geçmiş" sayılmaz
            row.year === raceYear &&
            row.distance === race.distance &&
            (surfacePrefix === "" || row.surface.startsWith(surfacePrefix))
        );
        return { runnerNo: r.no, horseName: r.name, hasTjkId: true, records: filtered };
      } catch {
        return { runnerNo: r.no, horseName: r.name, hasTjkId: true, records: [] };
      }
    })
  );
}
