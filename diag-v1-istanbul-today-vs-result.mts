// Bugunun (2026-10-21) Istanbul programi (10 yaris, HEPSI SONUCLANMIS) icin uretim V1.0 vs
// deneysel (kirpilmis) model siralamalarini GERCEK kazananla karsilastirir.
import fs from "node:fs";
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";
import { buildScorableVector } from "./src/lib/motor-v1/engine/predict-v1";
import { scoreRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { db } from "./src/lib/db";

const RACES: { no: number; id: string }[] = [
  { no: 1, id: "cmvg7thkn004008jp0owphx4m" },
  { no: 2, id: "cmvg7tl0i004n08jpyhjut4q3" },
  { no: 3, id: "cmvg7to6b005208jp0k9w3l7b" },
  { no: 4, id: "cmvg7tqgv005f08jpju1csgvx" },
  { no: 5, id: "cmvg7ttm8006008jp1ksekl1s" },
  { no: 6, id: "cmvg7txcb006p08jpdl7zajak" },
  { no: 7, id: "cmvg7u1xi007l08jp3alpi27f" },
  { no: 8, id: "cmvg7u531008608jp1vytvu35" },
  { no: 9, id: "cmvg7u7di008l08jpzfnhiigy" },
  { no: 10, id: "cmvg7uais009608jplkzy6icc" },
];

async function withRetry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 3000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { lastErr = e; if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs)); }
  }
  throw lastErr;
}

async function main() {
  const currentModel = loadTrainedV1Model();
  const exp = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/experimental-winsorized-v1.json", "utf8"));
  const clipBounds = new Map<string, { p1: number; p99: number }>();
  for (const c of exp.clippedCodes) clipBounds.set(c.code, { p1: c.p1, p99: c.p99 });
  const expModel: FittedModel = {
    beta: exp.beta, names: exp.names,
    stats: new Map(Object.entries(exp.muSigma).map(([k, v]) => [k, v as { mu: number; sigma: number; nObserved: number }])),
    nRacesUsed: exp.nTrainRaces, nRacesSkipped: exp.nRacesSkipped, opts: exp.fitOpts,
  };

  let currHit = 0, expHit = 0, nEval = 0;
  const basarisiz: string[] = [];

  for (const race of RACES) {
    try {
      const result = await withRetry(() => db.result.findUnique({ where: { raceId: race.id }, select: { winnerNos: true } }));
      const winnerNo = result?.winnerNos?.[0] ?? null;

      const unified = await withRetry(() => computeUnifiedFamiliesForRace(race.id, currentModel));
      if (unified.length === 0) { console.log(`\n=== İstanbul K${race.no}: saha bos ===`); continue; }
      const vectorsRaw = unified.map((r) => buildScorableVector(race.id, r));
      const vectorsClipped = vectorsRaw.map((v) => ({
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

      console.log(`\n=== İstanbul K${race.no} (saha=${currRanked.length}) — GERÇEK KAZANAN: #${winnerNo} ===`);
      console.log("  Sira  ÜRETİM V1.0                      DENEYSEL (kırpılmış)");
      for (let i = 0; i < currRanked.length; i++) {
        const c = currRanked[i], e = expRanked[i];
        const cMark = c.no === winnerNo ? " <<<" : "";
        const eMark = e.no === winnerNo ? " <<<" : "";
        console.log(
          `  ${String(i + 1).padStart(2)}.   #${String(c.no).padStart(2)} ${c.name.padEnd(20)} %${(c.probability * 100).toFixed(1).padStart(5)}${cMark.padEnd(4)}|   #${String(e.no).padStart(2)} ${e.name.padEnd(20)} %${(e.probability * 100).toFixed(1).padStart(5)}${eMark}`
        );
      }
      if (winnerNo != null) {
        nEval++;
        const currRank = currRanked.findIndex((r) => r.no === winnerNo) + 1;
        const expRank = expRanked.findIndex((r) => r.no === winnerNo) + 1;
        if (currRank === 1) currHit++;
        if (expRank === 1) expHit++;
        console.log(`  Kazananın sırası: ÜRETİM=${currRank}/${currRanked.length}  DENEYSEL=${expRank}/${currRanked.length}`);
      }
    } catch (e) {
      console.log(`\n=== İstanbul K${race.no}: KALICI HATA — ${e instanceof Error ? e.message : e} ===`);
      basarisiz.push(`K${race.no}`);
    }
  }

  console.log(`\n\n=== İSTANBUL GÜNÜ ÖZETİ (${nEval} yarış, hepsi sonuçlanmış) ===`);
  console.log(`ÜRETİM V1.0 Top1 isabet: ${currHit}/${nEval}`);
  console.log(`DENEYSEL (kırpılmış) Top1 isabet: ${expHit}/${nEval}`);
  if (basarisiz.length > 0) console.log(`Atlanan: ${basarisiz.join(", ")}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
