// Bugunun (2026-10-21) Bursa + Istanbul programi icin HEM mevcut uretim V1.0 HEM deneysel
// (kirpilmis) modelin tam siralama tablolarini TEK DB gecisinde (computeUnifiedFamiliesForRace
// bir kez) uretir — iki ayri DB-agir script'i paralel calistirmamak icin birlestirildi.
import fs from "node:fs";
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";
import { buildScorableVector } from "./src/lib/motor-v1/engine/predict-v1";
import { scoreRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

const RACES: { hip: string; no: number; id: string }[] = [
  { hip: "Bursa", no: 1, id: "cmvg7su87000308jpe65z4rod" },
  { hip: "Bursa", no: 2, id: "cmvg7sx5h000n08jp758qhqlp" },
  { hip: "Bursa", no: 3, id: "cmvg7t0bd001708jpc6izctlv" },
  { hip: "Bursa", no: 4, id: "cmvg7t2wu001o08jprukqesuf" },
  { hip: "Bursa", no: 5, id: "cmvg7t5sn002708jpq7fsg52k" },
  { hip: "Bursa", no: 6, id: "cmvg7t7it002j08jpslswccio" },
  { hip: "İstanbul", no: 1, id: "cmvg7thkn004008jp0owphx4m" },
  { hip: "İstanbul", no: 2, id: "cmvg7tl0i004n08jpyhjut4q3" },
  { hip: "İstanbul", no: 3, id: "cmvg7to6b005208jp0k9w3l7b" },
  { hip: "İstanbul", no: 4, id: "cmvg7tqgv005f08jpju1csgvx" },
  { hip: "İstanbul", no: 5, id: "cmvg7ttm8006008jp1ksekl1s" },
  { hip: "İstanbul", no: 6, id: "cmvg7txcb006p08jpdl7zajak" },
  { hip: "İstanbul", no: 7, id: "cmvg7u1xi007l08jp3alpi27f" },
  { hip: "İstanbul", no: 8, id: "cmvg7u531008608jp1vytvu35" },
  { hip: "İstanbul", no: 9, id: "cmvg7u7di008l08jpzfnhiigy" },
  { hip: "İstanbul", no: 10, id: "cmvg7uais009608jplkzy6icc" },
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

  for (const race of RACES) {
    try {
      const unified = await withRetry(() => computeUnifiedFamiliesForRace(race.id, currentModel));
      if (unified.length === 0) { console.log(`\n=== ${race.hip} K${race.no}: saha bos ===`); continue; }
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

      console.log(`\n=== ${race.hip} K${race.no} (saha=${currRanked.length}) ===`);
      console.log("  Sira  ÜRETİM V1.0                      DENEYSEL (kırpılmış)");
      for (let i = 0; i < currRanked.length; i++) {
        const c = currRanked[i], e = expRanked[i];
        const fark = currRanked.findIndex((r) => r.no === e.no); // placeholder, not used
        console.log(
          `  ${String(i + 1).padStart(2)}.   #${String(c.no).padStart(2)} ${c.name.padEnd(20)} %${(c.probability * 100).toFixed(1).padStart(5)}   |   #${String(e.no).padStart(2)} ${e.name.padEnd(20)} %${(e.probability * 100).toFixed(1).padStart(5)}`
        );
      }
      const currTop = currRanked[0].no;
      const expTop = expRanked[0].no;
      if (currTop !== expTop) {
        console.log(`  >>> FAVORİ DEĞİŞTİ: üretim #${currTop} ${currRanked[0].name} -> deneysel #${expTop} ${expRanked[0].name}`);
      }
    } catch (e) {
      console.log(`\n=== ${race.hip} K${race.no}: KALICI HATA — ${e instanceof Error ? e.message : e} ===`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
