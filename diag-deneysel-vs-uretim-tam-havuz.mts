// V1.0 uretim vs V1.0 deneysel (kirpilmis) - AYNI 258 yarislik havuzda, saf hesaplama (DB yok).
import fs from "node:fs";
import { scoreRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] }>;
  const currentModel = loadTrainedV1Model();
  const exp = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/experimental-winsorized-v1.json", "utf8"));
  const clipBounds = new Map<string, { p1: number; p99: number }>();
  for (const c of exp.clippedCodes) clipBounds.set(c.code, { p1: c.p1, p99: c.p99 });
  const expModel: FittedModel = {
    beta: exp.beta, names: exp.names,
    stats: new Map(Object.entries(exp.muSigma).map(([k, v]) => [k, v as { mu: number; sigma: number; nObserved: number }])),
    nRacesUsed: exp.nTrainRaces, nRacesSkipped: exp.nRacesSkipped, opts: exp.fitOpts,
  };

  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const allIds = Object.keys(cache);

  type Row = { raceId: string; set: string; currTop1: boolean; currTop3: boolean; currLL: number; expTop1: boolean; expTop3: boolean; expLL: number };
  const results: Row[] = [];

  for (const id of allIds) {
    const c = cache[id];
    if (c.winnerNo == null) continue;
    const vectorsRaw: RunnerFeatureVector[] = c.runners.map((r) => ({ raceId: id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const vectorsClipped: RunnerFeatureVector[] = vectorsRaw.map((v) => ({
      ...v,
      signals: v.signals.map((s) => {
        if (!s.observed || s.rawValue == null) return s;
        const b = clipBounds.get(s.code);
        if (!b) return s;
        const clipped = Math.min(Math.max(s.rawValue, b.p1), b.p99);
        return clipped === s.rawValue ? s : { ...s, rawValue: clipped };
      }),
    }));

    const currRanked = [...scoreRace(vectorsRaw, currentModel)].sort((a, b) => b.probability - a.probability);
    const expRanked = [...scoreRace(vectorsClipped, expModel)].sort((a, b) => b.probability - a.probability);
    const currIdx = currRanked.findIndex((s) => s.no === c.winnerNo);
    const expIdx = expRanked.findIndex((s) => s.no === c.winnerNo);
    if (currIdx < 0 || expIdx < 0) continue;

    results.push({
      raceId: id, set: trainSet.has(id) ? "TRAIN" : holdoutSet.has(id) ? "HOLDOUT" : "EK",
      currTop1: currIdx === 0, currTop3: currIdx < 3, currLL: logLoss(currRanked[currIdx].probability),
      expTop1: expIdx === 0, expTop3: expIdx < 3, expLL: logLoss(expRanked[expIdx].probability),
    });
  }

  function ozet(label: string, filterFn: (r: Row) => boolean) {
    const sub = results.filter(filterFn);
    const n = sub.length;
    const ct1 = sub.filter((r) => r.currTop1).length, et1 = sub.filter((r) => r.expTop1).length;
    const ct3 = sub.filter((r) => r.currTop3).length, et3 = sub.filter((r) => r.expTop3).length;
    const cll = sub.reduce((a, r) => a + r.currLL, 0) / n, ell = sub.reduce((a, r) => a + r.expLL, 0) / n;
    console.log(`${label}: n=${n}`);
    console.log(`  Top1   uretim=${ct1}/${n}(%${(ct1/n*100).toFixed(1)})  deneysel=${et1}/${n}(%${(et1/n*100).toFixed(1)})`);
    console.log(`  Top3   uretim=${ct3}/${n}(%${(ct3/n*100).toFixed(1)})  deneysel=${et3}/${n}(%${(et3/n*100).toFixed(1)})`);
    console.log(`  LogLoss uretim=${cll.toFixed(4)}  deneysel=${ell.toFixed(4)}  (fark=${(ell-cll).toFixed(4)}, negatif=deneysel daha iyi)`);
  }

  ozet("TUM 258", () => true);
  ozet("TRAIN(120, ikisi de bu veriyle fit edildi)", (r) => r.set === "TRAIN");
  ozet("HOLDOUT(30)", (r) => r.set === "HOLDOUT");
  ozet("EK(108, HICBIRI ikisinin de fit'inde yok)", (r) => r.set === "EK");
  ozet("BAGIMSIZ(138 = HOLDOUT+EK)", (r) => r.set !== "TRAIN");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
