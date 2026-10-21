// READ-ONLY. trainable-features.ts::computeTrainableFeaturesForRace ile, verilen bir yaris
// ID listesi icin TAM aday ozellik kumesini (10 aile + 11 iliski, START_RISK/PIST_DURUM HARIC)
// hesaplayip diske yazar. Yeniden baslatilabilir (yaris-basi yazma), tek process.
import { db } from "./src/lib/db";
import fs from "node:fs";
import { computeTrainableFeaturesForRace, loadTempoContextFromDisk, loadGalopPaceIndexFromDisk, type TrainableRaceResult } from "./src/lib/motor-v1/engine/trainable-features";

const RACE_IDS_PATH = process.argv[2];
const CACHE_PATH = process.argv[3];
const PROGRESS_PATH = process.argv[4];

function log(line: string) {
  const stamped = `[${new Date().toISOString()}] ${line}`;
  console.log(stamped);
  fs.appendFileSync(PROGRESS_PATH, stamped + "\n");
}
function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      log(`  [retry ${i + 1}/${tries}] ${label}: ${(e as Error).message}`);
      await sleep(3000 * (i + 1));
    }
  }
  throw lastErr;
}

async function main() {
  const raceIds: string[] = JSON.parse(fs.readFileSync(RACE_IDS_PATH, "utf8"));
  log(`Hedef: ${raceIds.length} yaris. (${RACE_IDS_PATH} -> ${CACHE_PATH})`);

  let cache: Record<string, TrainableRaceResult> = {};
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    log(`Onbellekte zaten var: ${Object.keys(cache).length} yaris`);
  }

  const tempoCtx = loadTempoContextFromDisk();
  const galopPaceIndex = loadGalopPaceIndexFromDisk();
  log(`Disk arsivleri yuklendi.`);

  let processed = 0;
  for (const id of raceIds) {
    if (cache[id]) continue;
    try {
      const result = await withRetry(() => computeTrainableFeaturesForRace(id, tempoCtx, galopPaceIndex), `race(${id})`);
      if (result) cache[id] = result;
      processed++;
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
      log(`islenen: ${processed} yeni (toplam onbellek: ${Object.keys(cache).length}/${raceIds.length})`);
    } catch (e) {
      log(`[ATLANDI] ${id}: ${(e as Error).message}`);
    }
  }
  log(`TAMAMLANDI. Onbellekte: ${Object.keys(cache).length}/${raceIds.length} yaris.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
