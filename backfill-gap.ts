import "dotenv/config";
import { ingestDate, toTjkDate } from "./src/server/services/ingest/tjk-info.adapter";
import { syncResultsForDate } from "./src/server/services/result-sync";
import { db } from "./src/lib/db";

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

type CityOutcome = { date: string; city: string; ok: boolean; runners: number; error?: string };

async function ingestDateWithRetry(dateStr: string, tjkDate: string, outcomes: CityOutcome[]) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = await ingestDate(tjkDate);
    if (result.cities.length === 0) {
      // No cities discovered at all — could be a transient fetch failure of the day page. Retry.
      if (attempt < 3) {
        await new Promise((r) => setTimeout(r, 1500 * attempt));
        continue;
      }
    }
    const failed = result.cities.filter((c) => !c.ok);
    for (const c of result.cities) {
      outcomes.push({ date: dateStr, city: c.sehirAdi, ok: c.ok, runners: c.runners, error: c.error });
    }
    if (failed.length === 0) return result;
    if (attempt === 3) return result; // give up after 3 tries, keep partial result recorded
    // Retry only makes sense by re-running the whole day (adapter has no per-city retry hook)
    await new Promise((r) => setTimeout(r, 1500 * attempt));
    // remove the outcomes we just pushed for this attempt so we don't double-record; keep last attempt's only
    outcomes.length -= result.cities.length;
  }
  return { date: tjkDate, cities: [] };
}

async function main() {
  const start = new Date("2026-06-20T00:00:00Z");
  const end = new Date("2026-07-14T00:00:00Z");

  let dayNo = 0;
  const totalDays = Math.round((end.getTime() - start.getTime()) / 86400000) + 1;
  const outcomes: CityOutcome[] = [];

  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    dayNo++;
    const dateStr = fmt(d);
    const tjkDate = toTjkDate(d);
    try {
      const ingestResult = await ingestDateWithRetry(dateStr, tjkDate, outcomes);
      const okCities = ingestResult.cities.filter((c) => c.ok);
      const totalRunners = okCities.reduce((s, c) => s + c.runners, 0);
      await syncResultsForDate(dateStr);
      const failedNames = ingestResult.cities.filter((c) => !c.ok).map((c) => c.sehirAdi);
      console.log(
        `[${dayNo}/${totalDays}] ${dateStr}: ${okCities.length}/${ingestResult.cities.length} cities ok, ${totalRunners} runners` +
          (failedNames.length ? ` | FAILED: ${failedNames.join(",")}` : "")
      );
    } catch (e) {
      console.log(`[${dayNo}/${totalDays}] ${dateStr}: ERROR ${String(e).slice(0, 150)}`);
    }
  }

  const failedOutcomes = outcomes.filter((o) => !o.ok);
  console.log("BACKFILL DONE. Failed city-days:", failedOutcomes.length);
  if (failedOutcomes.length > 0) {
    console.log(JSON.stringify(failedOutcomes, null, 2));
  }
  await db.$disconnect();
}

main();
