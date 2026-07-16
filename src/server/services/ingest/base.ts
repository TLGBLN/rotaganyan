import type { IngestRaceDay, IngestResult } from "./types";

/**
 * Abstract data provider. Implement this interface for each source
 * (TJK, ganyandefteri.com, etc.) and register in ingest/index.ts.
 */
export interface DataProvider {
  /** Human-readable name for logging */
  readonly name: string;

  /**
   * Fetch race days for the given date (defaults to today).
   * Should return all hippodromes that ran on that date.
   */
  fetchRaceDays(date?: Date): Promise<IngestRaceDay[]>;
}

/**
 * Persist fetched race days into the database.
 * Called by the ingest API route after provider.fetchRaceDays().
 */
export async function persistRaceDays(raceDays: IngestRaceDay[]): Promise<IngestResult> {
  const { db } = await import("@/lib/db");
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const rd of raceDays) {
    try {
      // Upsert hippodrome
      const hippodrome = await db.hippodrome.upsert({
        where: { slug: rd.hippodromeSlug },
        create: { name: rd.hippodromeName, slug: rd.hippodromeSlug },
        update: { name: rd.hippodromeName },
      });

      const date = new Date(rd.date);
      date.setUTCHours(0, 0, 0, 0);

      // Upsert race day
      const conditionData = {
        surfaceConditions: rd.surfaceConditions ?? undefined,
        weather: rd.weather ?? undefined,
      };
      const raceDay = await db.raceDay.upsert({
        where: { date_hippodromeId: { date, hippodromeId: hippodrome.id } },
        create: { date, hippodromeId: hippodrome.id, ...conditionData },
        update: conditionData,
      });

      for (const r of rd.races) {
        const existing = await db.race.findUnique({
          where: { raceDayId_raceNo: { raceDayId: raceDay.id, raceNo: r.raceNo } },
        });

        const raceData = {
          raceDayId: raceDay.id,
          raceNo: r.raceNo,
          time: r.time,
          classType: r.classType,
          breed: r.breed,
          surface: r.surface,
          distance: r.distance,
          conditions: r.conditions,
          ageWeight: r.ageWeight,
          trackRecord: r.trackRecord,
        };

        const race = existing
          ? (await db.race.update({ where: { id: existing.id }, data: raceData }), updated++, existing)
          : (inserted++, await db.race.create({ data: raceData }));

        // Upsert runners — detect jockey changes between ingests
        // "existing.jockey" bazı koşularda geçmiş bir manuel yükleme yüzünden aslında bir
        // at ismi olabiliyor (sütun kayması) — bu değeri gerçek bir jokey değişikliği gibi
        // previousJockey'e taşırsak bozuk veri kalıcılaşıyor. Aynı koşudaki at isimleriyle
        // eşleşen değerleri geçersiz sayıp temizliyoruz (kendi kendini düzelten senkron).
        const raceHorseNames = new Set(r.runners.map((x) => x.name.trim().toUpperCase()));
        for (const runner of r.runners) {
          const existing = await db.runner.findUnique({
            where: { raceId_no: { raceId: race.id, no: runner.no } },
            select: { jockey: true },
          });

          const existingJockeyClean = existing?.jockey?.replace(/\*\*/g, "").trim() || null;
          const existingJockeyValid =
            existingJockeyClean != null && !raceHorseNames.has(existingJockeyClean.toUpperCase());

          const jockeyChanged =
            existingJockeyValid &&
            runner.jockey != null &&
            existingJockeyClean !== runner.jockey;

          await db.runner.upsert({
            where: { raceId_no: { raceId: race.id, no: runner.no } },
            create: { raceId: race.id, ...runner },
            update: {
              ...runner,
              jockeyChanged,
              previousJockey: jockeyChanged ? existingJockeyClean : null,
            },
          });
        }

        // Insert gallops (skip duplicates by date+runner)
        for (const gallop of r.gallops) {
          const runner = await db.runner.findUnique({
            where: { raceId_no: { raceId: race.id, no: gallop.runnerNo } },
          });
          if (!runner) continue;

          const gallopDate = new Date(gallop.date);
          const exists = await db.gallop.findFirst({
            where: { runnerId: runner.id, date: gallopDate },
          });
          if (!exists) {
            await db.gallop.create({
              data: {
                runnerId: runner.id,
                date: gallopDate,
                track: gallop.track,
                form: gallop.form,
                splits: gallop.splits,
              },
            });
          }
        }
      }
    } catch (err) {
      errors.push(`${rd.hippodromeSlug} ${rd.date}: ${String(err)}`);
    }
  }

  return { ok: errors.length === 0, inserted, updated, errors };
}
