/** LEAN14 read-only V2-equivalent stable-speed source for RIVAL_GAP. */
import { db } from "@/lib/db";
import { breedToIrk } from "@/lib/sire-stat-match";
import {
  hizPaceIndexKur, hizDerecesiHesaplaOrtak,
  type HizGecmisSatir, type PaceIndex,
} from "@/lib/methodology/hiz-derecesi-hesapla";
import { speedObservedAsOf } from "./pit-sire-speed";

export type StableSpeed = {
  history: Map<number, HizGecmisSatir[]>;
  index: PaceIndex;
  ambiguousIds: Set<number>;
};
let pending: Promise<StableSpeed> | null = null;

/** Mirrors V2's stable-speed construction, including mixed-breed identity exclusion. */
export function loadLean14StableSpeed(): Promise<StableSpeed> {
  if (pending) return pending;
  const request = (async () => {
    const [historyRows, breedRows] = await Promise.all([
      db.horseRaceHistoryCache.findMany({
        select: { tjkAtId: true, rowsJson: true }, orderBy: { tjkAtId: "asc" },
      }),
      db.runner.findMany({
        where: { scratched: false, tjkAtId: { not: null } },
        select: { tjkAtId: true, race: { select: { breed: true } } }, orderBy: { id: "asc" },
      }),
    ]);
    const history = new Map<number, HizGecmisSatir[]>(historyRows.map(row => [
      row.tjkAtId, row.rowsJson as unknown as HizGecmisSatir[],
    ]));
    const breedById = new Map<number, string>();
    const ambiguousIds = new Set<number>();
    for (const row of breedRows) {
      const id = row.tjkAtId;
      if (id === null || ambiguousIds.has(id)) continue;
      const breed = breedToIrk(row.race.breed);
      const prior = breedById.get(id);
      if (prior !== undefined && prior !== breed) {
        breedById.delete(id);
        ambiguousIds.add(id);
      } else {
        breedById.set(id, breed);
      }
    }
    return { history, index: hizPaceIndexKur(history, breedById), ambiguousIds };
  })();
  pending = request;
  request.catch(() => { if (pending === request) pending = null; });
  return request;
}

export function stableSpeedForRunner(
  source: StableSpeed, id: number | null, breed: string, cutoff: Date
): { value: number | null; observed: boolean } {
  if (id === null || source.ambiguousIds.has(id)) return { value: null, observed: false };
  const runs = source.history.get(id) ?? [];
  const observed = speedObservedAsOf(runs, breedToIrk(breed), cutoff, source.index);
  return { value: observed ? hizDerecesiHesaplaOrtak(runs, breedToIrk(breed), cutoff, source.index) : null, observed };
}
