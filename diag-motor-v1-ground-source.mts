import { db } from "./src/lib/db";

function hasGoing(value: unknown, depth = 0): boolean {
  if (depth > 8 || value == null ||
      typeof value !== "object") return false;

  if (Array.isArray(value)) {
    return value.some(v => hasGoing(v, depth + 1));
  }

  for (const [key, val] of Object.entries(value)) {
    if (
      /^(surfaceConditions|pistDurumu|trackCondition|groundCondition)$/i.test(key) &&
      val != null
    ) return true;

    if (hasGoing(val, depth + 1)) return true;
  }

  return false;
}

async function main() {
  const [predictions, days, goingGroups] = await Promise.all([
    db.prediction.findMany({
      select: {
        createdAt: true,
        updatedAt: true,
        publishedAt: true,
        contextSnapshotJson: true,
        race: {
          select: {
            time: true,
            raceDay: {
              select: {
                date: true,
                surfaceConditions: true
              }
            }
          }
        }
      }
    }),

    db.raceDay.findMany({
      where: {
        date: {
          gte: new Date("2026-01-01T00:00:00Z"),
          lt: new Date("2026-10-18T00:00:00Z")
        }
      },
      select: {
        surfaceConditions: true
      }
    }),

    db.tjkDereceKaydi.groupBy({
      by: ["pistDurumu"],
      _count: { _all: true }
    })
  ]);

  const nonempty = (value: unknown): boolean =>
    Array.isArray(value) && value.length > 0;

  let withSnapshot = 0;
  let snapshotWithGoing = 0;
  let stablePreRace = 0;
  let stablePreRaceWithGoing = 0;

  for (const p of predictions) {
    if (p.contextSnapshotJson != null) withSnapshot++;

    const found = hasGoing(p.contextSnapshotJson);
    if (found) snapshotWithGoing++;

    const time = /^(\d{1,2}):([0-5]\d)$/.exec(
      p.race.time?.trim() ?? ""
    );

    if (!time || Number(time[1]) > 23) continue;

    const d = p.race.raceDay.date;

    const start = Date.UTC(
      d.getUTCFullYear(),
      d.getUTCMonth(),
      d.getUTCDate(),
      Number(time[1]) - 3,
      Number(time[2])
    );

    const stable =
      p.publishedAt != null &&
      p.createdAt.getTime() < start &&
      p.updatedAt.getTime() < start &&
      p.publishedAt.getTime() < start;

    if (stable) {
      stablePreRace++;
      if (found) stablePreRaceWithGoing++;
    }
  }

  console.log("V1_GROUND_DAYS", JSON.stringify({
    total: days.length,
    withConditions: days.filter(d =>
      nonempty(d.surfaceConditions)
    ).length
  }));

  console.log("V1_GROUND_PREDICTIONS", JSON.stringify({
    total: predictions.length,
    withContextSnapshot: withSnapshot,
    withGoingFieldInSnapshot: snapshotWithGoing,
    stablePreRace,
    stablePreRaceWithGoing
  }));

  console.log("V1_GROUND_ARCHIVE", JSON.stringify(
    goingGroups
      .map(x => ({
        condition: x.pistDurumu,
        count: x._count._all
      }))
      .sort((a,b) => b.count - a.count)
  ));

  console.log("V1_GROUND_AUDIT_PASS");
}

main().catch(e => {
  console.error("V1_GROUND_AUDIT_ERROR", e);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});