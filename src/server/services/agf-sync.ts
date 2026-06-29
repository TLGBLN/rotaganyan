/**
 * AGF sync from TJK's daily program page (same page/columns the regular
 * program ingest already fetches — the AGFORAN cell just wasn't read before).
 * Called by /api/admin/sync-agf (manual) and /api/cron/agf-sync (scheduled).
 */

import { db } from "@/lib/db";
import { discoverTurkishCities, fetchCityProgram, toSlug, toTjkDate } from "./ingest/tjk-info.adapter";

export type AgfSyncCityResult = {
  name: string;
  ok: boolean;
  racesUpdated: number;
  runnersUpdated: number;
  error?: string;
};

export type AgfSyncResult = {
  date: string;
  cities: AgfSyncCityResult[];
};

export async function syncAgfForDate(date: Date): Promise<AgfSyncResult> {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const tjkDate = toTjkDate(d);

  const cities = await discoverTurkishCities(tjkDate);
  const cityResults: AgfSyncCityResult[] = [];

  for (const city of cities) {
    try {
      const slug = toSlug(city.sehirAdi);
      const hippodrome = await db.hippodrome.findFirst({ where: { slug } });
      if (!hippodrome) {
        cityResults.push({
          name: city.sehirAdi,
          ok: false,
          racesUpdated: 0,
          runnersUpdated: 0,
          error: `Hippodrome not in DB: ${slug}`,
        });
        continue;
      }

      const raceDay = await db.raceDay.findFirst({
        where: { date: d, hippodromeId: hippodrome.id },
        include: { races: { include: { runners: { select: { id: true, no: true } } } } },
      });
      if (!raceDay || raceDay.races.length === 0) {
        cityResults.push({
          name: city.sehirAdi,
          ok: false,
          racesUpdated: 0,
          runnersUpdated: 0,
          error: "No race day found in DB",
        });
        continue;
      }

      const program = await fetchCityProgram(city, tjkDate);
      if (!program) {
        cityResults.push({
          name: city.sehirAdi,
          ok: false,
          racesUpdated: 0,
          runnersUpdated: 0,
          error: "TJK program sayfası boş döndü",
        });
        continue;
      }

      let racesUpdated = 0;
      let runnersUpdated = 0;

      for (const race of raceDay.races) {
        const programRace = program.races.find((r) => r.raceNo === race.raceNo);
        if (!programRace) continue;

        const withAgf = programRace.runners.filter((r) => r.agf !== undefined);
        if (withAgf.length === 0) continue;

        racesUpdated++;
        for (const pr of withAgf) {
          const dbRunner = race.runners.find((r) => r.no === pr.no);
          if (!dbRunner) continue;

          await db.runner.update({
            where: { id: dbRunner.id },
            data: { agf: pr.agf },
          });
          // Her senkronizasyonda bir an'lık kayıt da düşürülür — zaman içindeki AGF
          // değişimini (para hareketi / "steam") gösterebilmek için.
          await db.agfSnapshot.create({
            data: { runnerId: dbRunner.id, agf: pr.agf as number },
          });
          runnersUpdated++;
        }
      }

      cityResults.push({ name: city.sehirAdi, ok: true, racesUpdated, runnersUpdated });
    } catch (err) {
      cityResults.push({
        name: city.sehirAdi,
        ok: false,
        racesUpdated: 0,
        runnersUpdated: 0,
        error: String(err),
      });
    }

    await new Promise((r) => setTimeout(r, 400));
  }

  return { date: tjkDate, cities: cityResults };
}
