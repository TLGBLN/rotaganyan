import { syncHorseStatsCache } from "../src/server/services/ingest/tjk-at-profil.adapter";

let totalOk = 0;
let totalFail = 0;
let round = 0;
for (;;) {
  round++;
  const r = await syncHorseStatsCache(60, 3);
  totalOk += r.ok;
  totalFail += r.fail;
  console.log(`round ${round}: ok=${r.ok} fail=${r.fail} remaining=${r.remaining} (toplam ok=${totalOk} fail=${totalFail})`);
  if (r.remaining === 0 && r.ok === 0 && r.fail === 0) break;
  if (r.ok === 0 && r.fail === 0) break;
}
console.log("BACKFILL TAMAMLANDI. toplam ok:", totalOk, "toplam fail:", totalFail);
process.exit(0);
