// READ-ONLY. Onceki karsilastirmanin OLCUM METODOLOJISINI denetler: V5.46.1'in kayitli
// olasiliklari gercekten ~%100'e topluyor mu, at listesi V1.0'in listesiyle birebir ayni mi.
import fs from "node:fs";
import { db } from "./src/lib/db";

type CachedRaceShape = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: unknown[] }[] };

async function main() {
  const newCache = JSON.parse(fs.readFileSync("C:/tmp/v546-comparison-feature-cache.json", "utf8")) as Record<string, CachedRaceShape>;
  const raceIds = Object.keys(newCache);

  const picks = await db.pick.findMany({
    where: { prediction: { raceId: { in: raceIds } }, featureSnapshot: { path: ["motorEtiketi"], string_contains: "V5.46.1" } },
    select: { score: true, scoreExact: true, runner: { select: { no: true, scratched: true } }, prediction: { select: { raceId: true } } },
  });
  const v546ByRace = new Map<string, { no: number; prob: number }[]>();
  for (const p of picks) {
    if (p.runner?.no == null) continue;
    const arr = v546ByRace.get(p.prediction.raceId) ?? [];
    arr.push({ no: p.runner.no, prob: (p.scoreExact ?? p.score ?? 0) });
    v546ByRace.set(p.prediction.raceId, arr);
  }

  let sumOffCount = 0, runnerCountMismatch = 0, checked = 0;
  const sumSamples: number[] = [];
  for (const raceId of raceIds) {
    const v1Runners = newCache[raceId].runners.length;
    const v5 = v546ByRace.get(raceId);
    if (!v5) continue;
    checked++;
    const sum = v5.reduce((s, x) => s + x.prob, 0);
    sumSamples.push(sum);
    if (Math.abs(sum - 100) > 5) sumOffCount++;
    if (v5.length !== v1Runners) runnerCountMismatch++;
  }
  const avgSum = sumSamples.reduce((a, b) => a + b, 0) / sumSamples.length;
  const minSum = Math.min(...sumSamples), maxSum = Math.max(...sumSamples);
  console.log(`Kontrol edilen yaris: ${checked}/${raceIds.length}`);
  console.log(`V5.46.1 olasilik toplami - ortalama: ${avgSum.toFixed(2)}, min: ${minSum.toFixed(2)}, max: ${maxSum.toFixed(2)}`);
  console.log(`Toplam %100'den 5+ sapan yaris sayisi: ${sumOffCount}/${checked}`);
  console.log(`V1.0 ve V5.46.1 at SAYISI uyusmayan yaris: ${runnerCountMismatch}/${checked}`);

  // Ornek: en cok sapan 3 yarisin detayini goster
  const withSum = raceIds.filter((id) => v546ByRace.has(id)).map((id) => ({ id, sum: v546ByRace.get(id)!.reduce((s,x)=>s+x.prob,0), v1: newCache[id].runners.length, v5: v546ByRace.get(id)!.length }));
  withSum.sort((a, b) => Math.abs(b.sum - 100) - Math.abs(a.sum - 100));
  console.log("\nEn cok sapan 5 yaris:");
  for (const w of withSum.slice(0, 5)) console.log(`  ${w.id}: toplam=${w.sum.toFixed(1)} v1_at_sayisi=${w.v1} v5_at_sayisi=${w.v5}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
