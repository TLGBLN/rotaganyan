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

      // TJK'dan programı önce çek (hippodrome/raceDay yoksa ingest için de kullanılır)
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

      // Hippodrome veya raceDay DB'de yoksa ingest et (hippodrome upsert'i de yapar)
      let hippodrome = await db.hippodrome.findFirst({ where: { slug } });
      let raceDay = hippodrome
        ? await db.raceDay.findFirst({
            where: { date: d, hippodromeId: hippodrome.id },
            include: { races: { include: { runners: { select: { id: true, no: true } } } } },
          })
        : null;

      if (!hippodrome || !raceDay || raceDay.races.length === 0) {
        try {
          const { persistRaceDays } = await import("./ingest/base");
          await persistRaceDays([program]);
          hippodrome = await db.hippodrome.findFirst({ where: { slug } });
          if (hippodrome) {
            raceDay = await db.raceDay.findFirst({
              where: { date: d, hippodromeId: hippodrome.id },
              include: { races: { include: { runners: { select: { id: true, no: true } } } } },
            });
          }
        } catch { /* ingest başarısız olursa AGF sync de atla */ }
      }

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

      let racesUpdated = 0;
      let runnersUpdated = 0;

      // Fetch latest snapshot per runner in bulk to avoid N+1 queries
      const allRunnerIds = raceDay.races.flatMap((rc) => rc.runners.map((r) => r.id));
      const latestSnapshots = await db.agfSnapshot.findMany({
        where: { runnerId: { in: allRunnerIds } },
        orderBy: { capturedAt: "desc" },
        select: { runnerId: true, agf: true },
        distinct: ["runnerId"],
      });
      const lastSnapshotMap = new Map(latestSnapshots.map((s) => [s.runnerId, s.agf]));

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

          // Yalnızca değer değiştiyse snapshot oluştur; böylece first≠last garantilenir.
          const prevAgf = lastSnapshotMap.get(dbRunner.id);
          const newAgf = pr.agf as number;
          if (prevAgf === undefined || Math.abs(prevAgf - newAgf) >= 0.01) {
            await db.agfSnapshot.create({
              data: { runnerId: dbRunner.id, agf: newAgf },
            });
            runnersUpdated++;
          }
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
