// READ-ONLY. diag-motor-v1-full-cache-builder.mts ile AYNI iş, yalnız N-yarış PARALEL
// işlenir (kullanıcı talebi, 2026-10-22: "8-10 saat çok uzun"). Her parça (chunk) bitince
// TEK seferde diske yazılır (eşzamanlı dosya yazma çakışması YOK). Tekrar-başlatılabilir
// (yarış-bazlı atlamalı), aynı dosyayı diag-motor-v1-full-cache-builder.mts ile paylaşır.
import { db } from "./src/lib/db";
import fs from "node:fs";
import { computeTrainableFeaturesForRace, loadTempoContextFromDisk, loadGalopPaceIndexFromDisk, type TrainableRaceResult } from "./src/lib/motor-v1/engine/trainable-features";

const RACE_IDS_PATH = process.argv[2];
const CACHE_PATH = process.argv[3];
const PROGRESS_PATH = process.argv[4];
const CONCURRENCY = Number(process.argv[5] ?? "5");

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
  log(`Hedef: ${raceIds.length} yaris, paralellik=${CONCURRENCY}. (${RACE_IDS_PATH} -> ${CACHE_PATH})`);

  let cache: Record<string, TrainableRaceResult> = {};
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    log(`Onbellekte zaten var: ${Object.keys(cache).length} yaris`);
  }

  const tempoCtx = loadTempoContextFromDisk();
  const galopPaceIndex = loadGalopPaceIndexFromDisk();
  log(`Disk arsivleri yuklendi.`);

  const todo = raceIds.filter((id) => !cache[id]);
  log(`Islenecek: ${todo.length} yeni yaris.`);

  for (let i = 0; i < todo.length; i += CONCURRENCY) {
    const chunk = todo.slice(i, i + CONCURRENCY);
    const results = await Promise.allSettled(
      chunk.map((id) => withRetry(() => computeTrainableFeaturesForRace(id, tempoCtx, galopPaceIndex), `race(${id})`))
    );
    for (let j = 0; j < chunk.length; j++) {
      const r = results[j];
      if (r.status === "fulfilled" && r.value) cache[chunk[j]] = r.value;
      else if (r.status === "rejected") log(`[ATLANDI] ${chunk[j]}: ${(r.reason as Error)?.message ?? r.reason}`);
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
    log(`islenen: ${Math.min(i + CONCURRENCY, todo.length)}/${todo.length} yeni (toplam onbellek: ${Object.keys(cache).length}/${raceIds.length})`);
  }
  log(`TAMAMLANDI. Onbellekte: ${Object.keys(cache).length}/${raceIds.length} yaris.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
