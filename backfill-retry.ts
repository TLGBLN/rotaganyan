import "dotenv/config";
import { ingestDate, toTjkDate } from "./src/server/services/ingest/tjk-info.adapter";
import { syncResultsForDate } from "./src/server/services/result-sync";
import { db } from "./src/lib/db";

const MISSING_DATES = [
  "2026-05-27","2026-05-28","2026-05-29","2026-05-30","2026-05-31","2026-06-01","2026-06-02","2026-06-03","2026-06-04",
  "2026-06-05","2026-06-06","2026-06-07","2026-06-08","2026-06-09","2026-06-11","2026-06-14","2026-06-15","2026-06-16",
];

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function ingestOneDate(dateStr: string): Promise<{ ok: boolean; runners: number; cities: number; error?: string }> {
  const tjkDate = toTjkDate(new Date(dateStr + "T00:00:00Z"));
  const MAX_ATTEMPTS = 5;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await ingestDate(tjkDate);
      const okCities = result.cities.filter((c) => c.ok);
      const totalRunners = okCities.reduce((s, c) => s + c.runners, 0);
      if (result.cities.length > 0 && okCities.length === result.cities.length) {
        await syncResultsForDate(dateStr);
        return { ok: true, runners: totalRunners, cities: okCities.length };
      }
      // partial or zero success -- retry the whole day
      if (attempt === MAX_ATTEMPTS) {
        if (okCities.length > 0) {
          await syncResultsForDate(dateStr);
          return { ok: false, runners: totalRunners, cities: okCities.length, error: "partial after max attempts" };
        }
        return { ok: false, runners: 0, cities: 0, error: "zero cities succeeded after max attempts" };
      }
    } catch (e) {
      if (attempt === MAX_ATTEMPTS) {
        return { ok: false, runners: 0, cities: 0, error: String(e).slice(0, 200) };
      }
    }
    await sleep(3000 * attempt);
  }
  return { ok: false, runners: 0, cities: 0, error: "unreachable" };
}

async function main() {
  let done = 0;
  const failures: { date: string; error?: string }[] = [];

  for (const dateStr of MISSING_DATES) {
    done++;
    const r = await ingestOneDate(dateStr);
    console.log(`[${done}/${MISSING_DATES.length}] ${dateStr}: ok=${r.ok} cities=${r.cities} runners=${r.runners}${r.error ? " ERR:" + r.error : ""}`);
    if (!r.ok) failures.push({ date: dateStr, error: r.error });
  }

  console.log("RETRY PASS DONE. Remaining failures:", failures.length);
  console.log(JSON.stringify(failures));
  await db.$disconnect();
}

main();
