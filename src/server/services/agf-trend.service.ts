/**
 * AGF zaman serisi — runner.agf yalnızca "şu anki" değeri tutar, geçmiş senkronizasyonlardaki
 * değerler AgfSnapshot tablosunda birikir (bkz. agf-sync.ts). Bu servis o birikimden günün
 * "para hareketi" (steam) sinyalini çıkarır: AGF'si en çok yükselen/düşen atlar.
 */

import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export type SteamPoint = { agf: number; capturedAt: Date };
export type Steamer = {
  runnerId: string;
  no: number;
  name: string;
  raceId: string;
  raceNo: number;
  hippodromeName: string;
  hippodromeSlug: string;
  first: number;
  last: number;
  delta: number;
  points: SteamPoint[];
};

/** Bir gündeki tüm koşularda, ilk ve son AGF senkronizasyonu arasında en çok değişen atları döner. */
export async function getSteamers(dateStr: string, limit = 12): Promise<Steamer[]> {
  const date = new Date(dateStr + "T00:00:00.000Z");

  const raceDays = await db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: { select: { name: true, slug: true } },
      races: {
        select: {
          id: true,
          raceNo: true,
          runners: {
            select: {
              id: true,
              no: true,
              name: true,
              agfSnapshots: {
                orderBy: { capturedAt: "asc" },
                select: { agf: true, capturedAt: true },
              },
            },
          },
        },
        orderBy: { raceNo: "asc" },
      },
    },
  });

  const steamers: Steamer[] = [];
  for (const rd of raceDays) {
    for (const race of rd.races) {
      for (const runner of race.runners) {
        if (runner.agfSnapshots.length < 2) continue;
        const first = runner.agfSnapshots[0].agf;
        const last = runner.agfSnapshots[runner.agfSnapshots.length - 1].agf;
        const delta = Math.round((last - first) * 100) / 100;
        if (delta === 0) continue;
        steamers.push({
          runnerId: runner.id,
          no: runner.no,
          name: runner.name,
          raceId: race.id,
          raceNo: race.raceNo,
          hippodromeName: rd.hippodrome.name,
          hippodromeSlug: rd.hippodrome.slug,
          first,
          last,
          delta,
          points: runner.agfSnapshots,
        });
      }
    }
  }

  return steamers.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, limit);
}
