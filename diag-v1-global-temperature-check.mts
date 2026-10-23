// SALT-OKUNUR TANI (yeniden egitim DEGIL): 258-havuzda, SABIT skorlar uzerinde tek bir
// global sicaklik (T) parametresinin LogLoss'u ne kadar degistirdigini olcer — modelin
// GENEL olarak asiri-keskin (overconfident) olup olmadigini, herhangi bir aile/katsayi
// degistirmeden sinar. T>1 LogLoss'u iyilestiriyorsa model GENEL OLARAK fazla keskindir.
import fs from "node:fs";
import { explainRunner } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const model = loadTrainedV1Model();
  const races: { scores: number[]; winIdx: number }[] = [];
  for (const raceId of Object.keys(cache)) {
    const race = cache[raceId];
    if (race.winnerNo == null || race.runners.length < 2) continue;
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const winIdx = vectors.findIndex((v) => v.no === race.winnerNo);
    if (winIdx < 0) continue;
    const scores = vectors.map((v) => explainRunner(v, model).totalScore);
    races.push({ scores, winIdx });
  }
  console.log(`Yaris sayisi: ${races.length}`);
  for (const T of [0.5, 0.75, 1, 1.5, 2, 3, 5, 8, 12]) {
    let ll = 0;
    for (const r of races) { const p = softmax(r.scores.map((s) => s / T)); ll += logLoss(p[r.winIdx]); }
    console.log(`T=${T}: LogLoss=${(ll/races.length).toFixed(4)}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
