/**
 * AGF zaman serisi — runner.agf yalnızca "şu anki" değeri tutar, geçmiş senkronizasyonlardaki
 * değerler AgfSnapshot tablosunda birikir (bkz. agf-sync.ts). Bu servis o birikimden günün
 * "para hareketi" sinyalini çıkarır: AGF'si en çok yükselen/düşen atlar (atkolik.net'teki
 * "Oran Yükselen/Düşen" listelerinin AGF karşılığı).
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
  resulted: boolean;
  points: SteamPoint[];
};
export type AgfMovers = { risers: Steamer[]; fallers: Steamer[] };

/** Bir gündeki tüm koşularda, ilk ve son AGF senkronizasyonu arasındaki değişimi yükselen/düşen olarak ikiye ayırır. */
export async function getAgfMovers(dateStr: string, limitPerDirection = 10): Promise<AgfMovers> {
  const date = new Date(dateStr + "T00:00:00.000Z");

  const raceDays = await db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: { select: { name: true, slug: true } },
      races: {
        select: {
          id: true,
          raceNo: true,
          result: { select: { id: true } },
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

  const all: Steamer[] = [];
  for (const rd of raceDays) {
    for (const race of rd.races) {
      for (const runner of race.runners) {
        if (runner.agfSnapshots.length < 2) continue;
        const first = runner.agfSnapshots[0].agf;
        const last = runner.agfSnapshots[runner.agfSnapshots.length - 1].agf;
        const delta = Math.round((last - first) * 100) / 100;
        if (delta === 0) continue;
        all.push({
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
          resulted: race.result != null,
          points: runner.agfSnapshots,
        });
      }
    }
  }

  const risers = all.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta).slice(0, limitPerDirection);
  const fallers = all.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta).slice(0, limitPerDirection);

  return { risers, fallers };
}
