"use server";

import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "@/lib/sire-stat-match";

export type V5461SireOzet = {
  ornekKendiVeri: number | null;
  kYuzde: number | null;
};

export async function getV5461SireOzetleriForRace(
  sireNames: (string | null)[],
  breed: string,
  surface: string,
  distance: number,
  cutoffTarih: Date
): Promise<V5461SireOzet[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const hedefSirelar = new Set(
    sireNames.map((s) => (s ? normalizeSireName(s) : "")).filter((s) => s.length > 0)
  );

  if (hedefSirelar.size === 0) {
    return sireNames.map(() => ({ ornekKendiVeri: null, kYuzde: null }));
  }

  const rows = await db.runner.findMany({
    where: { scratched: false, sire: { not: null }, race: { result: { isNot: null } } },
    select: {
      sire: true,
      no: true,
      race: {
        select: {
          breed: true,
          surface: true,
          distance: true,
          raceDay: { select: { date: true } },
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });

  const sayim = new Map<string, { start: number; wins: number }>();
  const cutoffMs = cutoffTarih.getTime();

  for (const r of rows) {
    if (!r.sire || !r.race.result) continue;
    if (r.race.raceDay.date.getTime() >= cutoffMs) continue;
    if (breedToIrk(r.race.breed) !== irk) continue;
    if (surfaceToPist(r.race.surface) !== pist) continue;
    if (mesafeBucket(r.race.distance) !== mesafe) continue;

    const sire = normalizeSireName(r.sire);
    if (!hedefSirelar.has(sire)) continue;

    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    const cur = sayim.get(sire) ?? { start: 0, wins: 0 };
    cur.start++;
    if (pos === 1) cur.wins++;
    sayim.set(sire, cur);
  }

  return sireNames.map((sireName) => {
    if (!sireName) return { ornekKendiVeri: null, kYuzde: null };
    const cur = sayim.get(normalizeSireName(sireName));
    if (!cur || cur.start === 0) return { ornekKendiVeri: null, kYuzde: null };
    return {
      ornekKendiVeri: cur.start,
      kYuzde: (cur.wins / cur.start) * 100,
    };
  });
}
