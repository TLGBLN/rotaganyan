/**
 * Yurt dışı (yabancı) hipodromlar için TAMAMEN AYRI bir persist fonksiyonu.
 *
 * Kullanıcı kararı (2026-09-30, üç kez tekrarlandı): "tr yarışları ile ilgili hiçbir şeyi
 * bozmadan apayrı olarak yabancı yarışlar için altyapı kurulacak, birbirleri ile hiçbir
 * bağlantısı olmayacak." base.ts'teki persistRaceDays TR'ye özgü karmaşık mantık taşıyor
 * (raceStyle mirası + eski-şema Accurace yeniden hesaplama, jockeyChanged tespiti) — bunların
 * HİÇBİRİ yurt dışı atlar için anlamlı değil (Accurace yalnız TR pistlerinde tutuluyor,
 * raceStyle yalnız Accurace'ten türetiliyor). Bu dosya o karmaşıklığı hiç İÇERMEYEN, yalnız
 * temel Hippodrome/RaceDay/Race/Runner upsert'ini yapan, base.ts'i HİÇ import ETMEYEN,
 * TR koduyla SIFIR paylaşımlı bağımsız bir kopyadır — persistRaceDays'e yapılacak gelecekteki
 * bir TR'ye-özgü değişiklik bu dosyayı ASLA etkilemez, ve tersi de doğrudur.
 *
 * Çağıranlar: ingest-program/route.ts (yurt dışı program adımı), agf-sync.ts (yalnız
 * program/raceDay DB'de yoksa ilk kez oluşturma anı).
 */
import type { IngestRaceDay, IngestResult } from "./types";

export async function persistYurtDisiRaceDays(raceDays: IngestRaceDay[]): Promise<IngestResult> {
  const { db } = await import("@/lib/db");
  let inserted = 0;
  let updated = 0;
  const errors: string[] = [];

  for (const rd of raceDays) {
    try {
      const hippodrome = await db.hippodrome.upsert({
        where: { slug: rd.hippodromeSlug },
        create: { name: rd.hippodromeName, slug: rd.hippodromeSlug, isForeign: rd.isForeign ?? true, country: rd.country },
        update: { name: rd.hippodromeName, isForeign: rd.isForeign ?? true, country: rd.country },
      });

      const date = new Date(rd.date);
      date.setUTCHours(0, 0, 0, 0);

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
        const existingRace = await db.race.findUnique({
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
          ...(r.ikramiyeDetay ? { ikramiyeDetay: r.ikramiyeDetay } : {}),
        };

        const race = existingRace
          ? (await db.race.update({ where: { id: existingRace.id }, data: raceData }), updated++, existingRace)
          : (inserted++, await db.race.create({ data: raceData }));

        // Yurt dışı atlarda raceStyle/jockeyChanged/gallop KAVRAMLARI YOK (Accurace ve
        // idman videosu yalnız TR pistlerinde) — bu yüzden TR'deki miras/karşılaştırma
        // mantığının HİÇBİRİ burada tekrarlanmıyor, düz bir upsert yeterli.
        for (const runner of r.runners) {
          await db.runner.upsert({
            where: { raceId_no: { raceId: race.id, no: runner.no } },
            create: { raceId: race.id, ...runner },
            update: { ...runner },
          });
        }
      }
    } catch (err) {
      errors.push(`${rd.hippodromeSlug} ${rd.date}: ${String(err)}`);
    }
  }

  return { ok: errors.length === 0, inserted, updated, errors };
}
