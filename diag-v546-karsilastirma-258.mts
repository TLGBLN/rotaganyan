// V1.0 ile AYNI 258 yarislik havuzda V5.46 (AGF'li), V5.46 Saf Model (AGF'siz) ve V5.46.1
// (donmus, 19-ozellik) tahminlerini uretir. Salt-okunur, hicbir motor degistirilmez.
import fs from "node:fs";
import { gatherFaz1V5Historical, faz2V5Sirala } from "./src/lib/methodology/v5-engine";
import { scoreV461 } from "./src/lib/methodology/v546-1-engine";

function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
async function withRetry<T>(fn: () => Promise<T>, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) { lastErr = e; await new Promise((r) => setTimeout(r, 3000 * (i + 1))); }
  }
  throw lastErr;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string }[] }>;
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const allIds = Object.keys(cache);
  console.log(`Islenecek: ${allIds.length} yaris.`);

  type Row = { raceId: string; set: string; winnerNo: number; v546Top1: boolean; v546Top3: boolean; v546LL: number; safTop1: boolean; safTop3: boolean; safLL: number; v461Top1: boolean; v461Top3: boolean; v461LL: number };
  const results: Row[] = [];
  const atlananlar: string[] = [];
  let i = 0;

  for (const raceId of allIds) {
    i++;
    const c = cache[raceId];
    if (c.winnerNo == null) continue;
    try {
      const faz1 = await withRetry(() => gatherFaz1V5Historical(raceId));
      if (!faz1) { atlananlar.push(`${raceId}: faz1 null`); continue; }
      const sirali = faz2V5Sirala(faz1);
      const v461 = await withRetry(() => scoreV461(raceId));
      if (!v461 || !v461.picks || v461.picks.length === 0) { atlananlar.push(`${raceId}: v461 null/bos`); continue; }

      const v546Ranked = [...sirali].sort((a, b) => b.olasilik - a.olasilik);
      const safRanked = [...sirali].sort((a, b) => b.marketBlindProb1 - a.marketBlindProb1);
      const v461Ranked = [...v461.picks].sort((a, b) => b.probability - a.probability);

      const v546Idx = v546Ranked.findIndex((r) => r.no === c.winnerNo);
      const safIdx = safRanked.findIndex((r) => r.no === c.winnerNo);
      const v461Idx = v461Ranked.findIndex((r) => r.no === c.winnerNo);
      if (v546Idx < 0 || safIdx < 0 || v461Idx < 0) { atlananlar.push(`${raceId}: kazanan no eslemedi`); continue; }

      results.push({
        raceId, set: trainSet.has(raceId) ? "TRAIN" : holdoutSet.has(raceId) ? "HOLDOUT" : "EK", winnerNo: c.winnerNo,
        v546Top1: v546Idx === 0, v546Top3: v546Idx < 3, v546LL: logLoss(v546Ranked[v546Idx].olasilik),
        safTop1: safIdx === 0, safTop3: safIdx < 3, safLL: logLoss(safRanked[safIdx].marketBlindProb1),
        v461Top1: v461Idx === 0, v461Top3: v461Idx < 3, v461LL: logLoss(v461Ranked[v461Idx].probability),
      });
      if (i % 20 === 0) console.log(`  islenen: ${i}/${allIds.length} (basarili=${results.length}, atlanan=${atlananlar.length})`);
    } catch (e) {
      atlananlar.push(`${raceId}: HATA ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(`\nTamamlandi. Basarili=${results.length} Atlanan=${atlananlar.length}`);
  if (atlananlar.length > 0) { console.log("Atlanan ornekleri:"); atlananlar.slice(0, 10).forEach((a) => console.log("  " + a)); }
  fs.writeFileSync("C:/tmp/v546-karsilastirma-raw.json", JSON.stringify(results, null, 0));

  function ozet(label: string, filterFn: (r: Row) => boolean) {
    const sub = results.filter(filterFn);
    const n = sub.length;
    if (n === 0) { console.log(`${label}: n=0`); return; }
    const v546t1 = sub.filter((r) => r.v546Top1).length, saft1 = sub.filter((r) => r.safTop1).length, v461t1 = sub.filter((r) => r.v461Top1).length;
    const v546t3 = sub.filter((r) => r.v546Top3).length, saft3 = sub.filter((r) => r.safTop3).length, v461t3 = sub.filter((r) => r.v461Top3).length;
    const v546ll = sub.reduce((a, r) => a + r.v546LL, 0) / n, safll = sub.reduce((a, r) => a + r.safLL, 0) / n, v461ll = sub.reduce((a, r) => a + r.v461LL, 0) / n;
    console.log(`\n${label} (n=${n}):`);
    console.log(`  Top1:    V5.46(AGF'li)=${v546t1}/${n}(%${(v546t1/n*100).toFixed(1)})  V5.46-Saf(AGF'siz)=${saft1}/${n}(%${(saft1/n*100).toFixed(1)})  V5.46.1=${v461t1}/${n}(%${(v461t1/n*100).toFixed(1)})`);
    console.log(`  Top3:    V5.46(AGF'li)=${v546t3}/${n}(%${(v546t3/n*100).toFixed(1)})  V5.46-Saf(AGF'siz)=${saft3}/${n}(%${(saft3/n*100).toFixed(1)})  V5.46.1=${v461t3}/${n}(%${(v461t3/n*100).toFixed(1)})`);
    console.log(`  LogLoss: V5.46(AGF'li)=${v546ll.toFixed(4)}  V5.46-Saf(AGF'siz)=${safll.toFixed(4)}  V5.46.1=${v461ll.toFixed(4)}`);
  }

  ozet("TUM", () => true);
  ozet("TRAIN(120)", (r) => r.set === "TRAIN");
  ozet("HOLDOUT(30)", (r) => r.set === "HOLDOUT");
  ozet("EK(108)", (r) => r.set === "EK");
  ozet("BAGIMSIZ(138)", (r) => r.set !== "TRAIN");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
