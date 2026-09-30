/**
 * YD Veri Bankası — HorseRun ETL. Kullanıcının notu: "Bu çok önemli... zamanla bütün
 * sistemin yakıtı olacak." Zaten çekilmiş YurtDisiAtRaceHistoryCache'ten (tjk-at-yurtdisi.
 * adapter.ts, program-etl.ts'in resolveOrCreateEquine ile bağladığı atlar için) besleniyor
 * — EK bir TJK isteği YAPMAZ (fetchYurtDisiAtKosuBilgileri önbellek-öncelikli).
 *
 * program-etl.ts'ten (PRE-RACE) KASITLI olarak AYRI dosya/fonksiyon — kullanıcının point-
 * in-time disiplini notu: sonuç/geçmiş verisi ile program verisi aynı işlemde karışmasın.
 */

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fetchYurtDisiAtKosuBilgileri } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";
import { resolveOrCreateTrack } from "./entity-resolution";

export type HorseRunEtlSonuc = { equinesProcessed: number; rowsUpserted: number; errors: string[] };

function paraninSayisi(raw: string): number | null {
  const n = parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function paraBirimi(raw: string): string | null {
  const m = raw.match(/[^\d.,\s]+/);
  return m ? m[0] : null;
}
function trSayi(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}
function tarihAyristir(dmy: string): Date | null {
  const [d, m, y] = dmy.split(".");
  if (!d || !m || !y) return null;
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`);
}

/**
 * Zaten resolveOrCreateEquine ile YurtDisiEquine'e bağlanmış (sourceIds.tjkYurtDisiAtId
 * dolu) atların geçmiş yarış satırlarını YurtDisiHorseRun'a normalize eder.
 */
export async function ingestYurtDisiHorseRunsToDatabank(limit = 50): Promise<HorseRunEtlSonuc> {
  const equines = await db.yurtDisiEquine.findMany({
    where: { sourceIds: { not: Prisma.DbNull } },
    select: { id: true, sourceIds: true },
    take: limit,
  });

  let rowsUpserted = 0;
  const errors: string[] = [];
  let processed = 0;

  for (const eq of equines) {
    const sourceIds = eq.sourceIds as Record<string, unknown> | null;
    const atId = sourceIds?.tjkYurtDisiAtId;
    if (typeof atId !== "number") continue;
    processed++;

    try {
      const rows = await fetchYurtDisiAtKosuBilgileri(atId);
      for (const row of rows) {
        const raceDate = tarihAyristir(row.date);
        if (!raceDate) continue;

        const trackId = await resolveOrCreateTrack(row.city, "BILINMIYOR");
        const sourceKey = `${row.date}|${row.city}|${row.raceNoName}`;

        const finishMatch = row.finish.match(/^(\d+)\/(\d+)$/);
        const finishPosition = finishMatch ? parseInt(finishMatch[1], 10) : null;
        const fieldSize = finishMatch ? parseInt(finishMatch[2], 10) : null;
        // Kullanıcının formülü: FinishPercentile = 1 - (FinishPosition-1)/(FieldSize-1) —
        // farklı saha büyüklüklerini karşılaştırılabilir kılar.
        const finishPercentile =
          finishPosition != null && fieldSize != null && fieldSize > 1 && finishPosition > 0
            ? 1 - (finishPosition - 1) / (fieldSize - 1)
            : null;

        const data = {
          raceDate,
          trackId,
          trackNameRaw: row.city,
          distance: row.distance || null,
          surface: row.surface ? row.surface.trim().charAt(0).toUpperCase() : null,
          classRaw: row.classType || null,
          weight: row.weight ? trSayi(row.weight) : null,
          jockeyName: row.jockey || null,
          trainerName: row.trainer || null,
          finishPosition,
          fieldSize,
          finishPercentile,
          raceTime: row.time || null,
          odds: row.ganyan ? trSayi(row.ganyan) : null,
          purseTotal: row.purse ? paraninSayisi(row.purse) : null,
          currency: row.purse ? paraBirimi(row.purse) : null,
          source: "TJK",
        };

        await db.yurtDisiHorseRun.upsert({
          where: { horseId_sourceKey: { horseId: eq.id, sourceKey } },
          create: { horseId: eq.id, sourceKey, ...data },
          update: data,
        });
        rowsUpserted++;
      }
    } catch (err) {
      errors.push(`equine ${eq.id}: ${String(err)}`);
    }
  }

  return { equinesProcessed: processed, rowsUpserted, errors };
}
