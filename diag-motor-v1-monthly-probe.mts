import { db } from "./src/lib/db";
import { loadTempoContext } from "./src/lib/motor-v1/features/tempo";
import { buildTrainingSet } from "./src/lib/motor-v1/engine/training";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";

const output = resolve(
  "src/lib/motor-v1/artifacts/v1-historical-monthly-probe.json"
);

async function main() {
  const races = await db.race.findMany({
    where: {
      result: { isNot: null },
      raceDay: {
        date: { lt: new Date("2026-10-18T00:00:00Z") }
      }
    },
    select: {
      id: true,
      raceNo: true,
      raceDay: { select: { date: true } },
      result: {
        select: { winnerNo: true, winnerNos: true }
      },
      runners: {
        where: { scratched: false },
        select: { no: true }
      }
    },
    orderBy: [
      { raceDay: { date: "asc" } },
      { raceNo: "asc" }
    ]
  });

  const months = new Map<string, typeof races>();

  for (const r of races) {
    const winners = r.result?.winnerNos?.length
      ? r.result.winnerNos
      : r.result?.winnerNo != null
        ? [r.result.winnerNo]
        : [];

    if (
      r.runners.length < 3 ||
      !winners.some(w => r.runners.some(x => x.no === w))
    ) continue;

    const month = r.raceDay.date.toISOString().slice(0, 7);
    if (!months.has(month)) months.set(month, []);
    months.get(month)!.push(r);
  }

  const selected = [...months.entries()].map(([month, arr]) => ({
    month,
    race: arr[Math.floor(arr.length / 2)]
  }));

  if (selected.length !== 10) {
    throw new Error("Expected ten months");
  }

  mkdirSync(dirname(output), { recursive: true });

  const saved = existsSync(output)
    ? JSON.parse(readFileSync(output, "utf8"))
    : { version: 1, races: [] };

  if (
    saved.version !== 1 ||
    !Array.isArray(saved.races)
  ) throw new Error("Invalid checkpoint");

  const ctx = await loadTempoContext();

  for (const item of selected) {
    if (saved.races.some((x: any) =>
      x.raceId === item.race.id
    )) continue;

    const start = Date.now();

    const [race] = await buildTrainingSet([{
      raceId: item.race.id,
      date: item.race.raceDay.date
    }], ctx);

    if (
      !race ||
      race.vectors.length < 3 ||
      race.winnerNo == null ||
      !race.vectors.some(v => v.no === race.winnerNo)
    ) {
      throw new Error(`Feature build invalid: ${item.month}`);
    }

    const coverage: Record<string, number> = {};

    for (const code of [
      "FORM_01", "FORM_02", "HIZ_01",
      "PMZ_01", "JOKEY_03", "TEMPO_01"
    ]) {
      coverage[code] = race.vectors.filter(v => {
        const s = v.signals.find(s => s.code === code);
        return !!s?.observed &&
          s.rawValue != null &&
          Number.isFinite(s.rawValue);
      }).length;
    }

    const elapsedMs = Date.now() - start;

    saved.races.push({
      ...race,
      month: item.month,
      elapsedMs,
      coverage
    });

    writeFileSync(output, JSON.stringify(saved), "utf8");

    console.log("V1_PROBE_RACE", JSON.stringify({
      month: item.month,
      horses: race.vectors.length,
      elapsedMs,
      coverage
    }));
  }

  console.log("V1_PROBE_SUMMARY", JSON.stringify({
    processed: saved.races.length,
    totalMs: saved.races.reduce(
      (s: number, r: any) => s + r.elapsedMs, 0
    ),
    output
  }));

  console.log("V1_PROBE_PASS");
}

main().catch(error => {
  console.error("V1_PROBE_ERROR", error);
  process.exitCode = 1;
}).finally(async () => {
  await db.$disconnect();
});