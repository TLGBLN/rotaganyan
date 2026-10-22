// Bugunun (2026-10-21) Bursa + Istanbul programi icin V1.0'in TAM siralama tablosu
// (yalniz izlenen 5 kod degil, her at icin olasilik). Retry-korumali (DB pooler kesintileri).
import { predictRaceV1 } from "./src/lib/motor-v1/engine/predict-v1";
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
  const model = loadTrainedV1Model();
  for (const race of RACES) {
    try {
      const result = await withRetry(() => predictRaceV1(race.id, model));
      if (!result) { console.log(`\n=== ${race.hip} K${race.no}: analiz uretilemedi ===`); continue; }
      const ranked = [...result.scored].sort((a, b) => b.probability - a.probability);
      console.log(`\n=== ${race.hip} K${race.no} (saha=${ranked.length}) ===`);
      ranked.forEach((s, i) => console.log(`  ${String(i + 1).padStart(2)}. #${String(s.no).padEnd(3)} ${s.name.padEnd(22)} P=${(s.probability * 100).toFixed(1)}%`));
    } catch (e) {
      console.log(`\n=== ${race.hip} K${race.no}: KALICI HATA — ${e instanceof Error ? e.message : e} ===`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
