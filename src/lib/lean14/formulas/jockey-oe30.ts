/** LEAN14-only JOCKEY_OE30. Research-only; read-only. No AGF dependence. */
import { db } from "@/lib/db";
import { finishPos } from "@/lib/race-result";

import { aggregateJockeyOE30, type JockeyOE30Result } from "./jockey-oe30-math";

/** Excludes target race day entirely; result dates must be strictly earlier. */
export async function computeJockeyOE30(jockey: string | null, cutoff: Date): Promise<JockeyOE30Result> {
  if (!jockey) return { ...aggregateJockeyOE30([]), missingReason: "JOCKEY_IDENTITY_MISSING" };
  const start = new Date(cutoff.getTime() - 30 * 86_400_000);
  const mounts = await db.runner.findMany({
    where: { jockey, scratched: false, race: { raceDay: { date: { gte: start, lt: cutoff } } } },
    select: {
      no: true,
      race: {
        select: {
          result: { select: { actualOrder: true, winnerNos: true } },
          runners: { where: { scratched: false }, select: { id: true } },
        },
      },
    },
  });
  return aggregateJockeyOE30(mounts.map(m => ({
    fieldSize: m.race.runners.length,
    position: finishPos(m.race.result?.actualOrder ?? null, m.no, m.race.result?.winnerNos ?? null),
  })));
}
