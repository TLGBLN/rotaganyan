// ASAMA 2 — GEN duzeltmesini DAV'dan AYRI, tek basina olcer. DAV ve digerleri ESKI
// (production'in su an kullandigi) ham veride kalir; YALNIZ GEN_SIRE_01/DAM_01/DAMSIRE_01/
// SIRE_PMZ_01 degerleri duzeltilmis cache'ten alinir. Donmus production katsayisi/mu/sigma
// AYNI kalir — yeniden egitim YOK, yalniz arimetik deger degisimi + skorlama.
import fs from "node:fs";
import { scoreRace } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
const GEN_CODES = ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"];

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const genDavFixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-fixed-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const model = loadTrainedV1Model();

  function evalSet(ids: string[], label: string) {
    let llOld = 0, llNew = 0, top1Old = 0, top1New = 0, top3Old = 0, top3New = 0, n = 0;
    let genDegistiRunnerSayisi = 0, genDegistiYarisSayisi = 0;
    for (const id of ids) {
      const oldRace = oldCache[id];
      const fixedRace = genDavFixedCache[id];
      if (!oldRace || !fixedRace || oldRace.winnerNo == null) continue;

      // GEN-SADECE vektor: oldRace'in TUM sinyalleri + yalniz GEN kodlari fixedRace'ten
      const mergedVectors: RunnerFeatureVector[] = oldRace.runners.map((r) => {
        const fixedR = fixedRace.runners.find((x) => x.no === r.no);
        const signals = r.vectors.map((s) => {
          if (!GEN_CODES.includes(s.code)) return s;
          const fixedS = fixedR?.vectors.find((x) => x.code === s.code);
          return fixedS ?? s;
        });
        return { raceId: id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals };
      });
      const oldVectors: RunnerFeatureVector[] = oldRace.runners.map((r) => ({ raceId: id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));

      let anyChanged = false;
      for (let i = 0; i < mergedVectors.length; i++) {
        for (const code of GEN_CODES) {
          const a = oldVectors[i].signals.find((s) => s.code === code);
          const b = mergedVectors[i].signals.find((s) => s.code === code);
          if (a?.rawValue !== b?.rawValue || a?.observed !== b?.observed) { anyChanged = true; genDegistiRunnerSayisi++; }
        }
      }
      if (anyChanged) genDegistiYarisSayisi++;

      const oldScored = scoreRace(oldVectors, model);
      const newScored = scoreRace(mergedVectors, model);
      const winIdxOld = oldScored.findIndex((s) => s.no === oldRace.winnerNo);
      const winIdxNew = newScored.findIndex((s) => s.no === oldRace.winnerNo);
      if (winIdxOld < 0 || winIdxNew < 0) continue;
      const rankedOld = [...oldScored].sort((a, b) => b.probability - a.probability);
      const rankedNew = [...newScored].sort((a, b) => b.probability - a.probability);

      llOld += logLoss(oldScored[winIdxOld].probability);
      llNew += logLoss(newScored[winIdxNew].probability);
      if (rankedOld[0].no === oldRace.winnerNo) top1Old++;
      if (rankedNew[0].no === oldRace.winnerNo) top1New++;
      if (rankedOld.slice(0, 3).some((r) => r.no === oldRace.winnerNo)) top3Old++;
      if (rankedNew.slice(0, 3).some((r) => r.no === oldRace.winnerNo)) top3New++;
      n++;
    }
    console.log(`\n${label} (n=${n}, GEN degisen yaris=${genDegistiYarisSayisi}, degisen runner-kod=${genDegistiRunnerSayisi}):`);
    console.log(`  ESKI: Top1=%${(top1Old/n*100).toFixed(1)} Top3=%${(top3Old/n*100).toFixed(1)} LogLoss=${(llOld/n).toFixed(4)}`);
    console.log(`  YENI(GEN-sadece): Top1=%${(top1New/n*100).toFixed(1)} Top3=%${(top3New/n*100).toFixed(1)} LogLoss=${(llNew/n).toFixed(4)}`);
  }

  console.log(`UYARI: bu olcum, DONMUS production katsayisina GEN'in DUZELTILMIS ham verisini\narimetik olarak besler — yeniden egitim YOK. DAV ve diger 9 aile ESKI veridedir.`);
  evalSet(lock.trainRaceIds, "TRAIN(120)");
  evalSet(lock.holdoutRaceIds, "HOLDOUT(30) — UYARI: bu set arastirmada ONCEDEN kullanildi, bagimsiz kanit DEGIL");
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
