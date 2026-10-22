// GEN DUZELTMESININ IZOLE ETKI TESTI (kullanici talimati, 2026-10-22, "Son Dogrulama" #1).
// gen-pedigri.ts/v5461-sire.actions.ts'e DOKUNULMAZ. Yalniz 108 EK yarista, AYNI kayitli
// model/katsayilarla, ESKI (gercek, kirlenmeye acik) GEN degerleri ile DUZELTILMIS (oz-haric)
// GEN degerleri KARSILASTIRILIR. GEN_SIRE_PMZ_01/FRM_GEN_01/GEN_PMZ_YET_01 de corrected
// genSire degeriyle YENIDEN hesaplanir (hamCarpim ile AYNI formul: basit carpim). Baska
// hicbir aile/formul degismez.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "./src/lib/sire-stat-match";
import { finishPos } from "./src/lib/race-result";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { scoreRace } from "./src/lib/motor-v1/engine/training";
import type { SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] }>;
  const model = loadTrainedV1Model();
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const ekIds = Object.keys(cache).filter((id) => !trainSet.has(id) && !holdoutSet.has(id));
  console.log(`EK yaris sayisi: ${ekIds.length}`);

  const races = await db.race.findMany({
    where: { id: { in: ekIds } },
    select: {
      id: true, breed: true, surface: true, distance: true,
      raceDay: { select: { date: true } },
      runners: { where: { scratched: false }, select: { no: true, sire: true, dam: true, damSire: true, tjkAtId: true } },
    },
  });

  console.log("Tum gecmis pedigri satirlari cekiliyor...");
  const allRows = await db.runner.findMany({
    where: { scratched: false, race: { result: { isNot: null } } },
    select: {
      sire: true, dam: true, damSire: true, no: true, tjkAtId: true,
      race: { select: { breed: true, surface: true, distance: true, raceDay: { select: { date: true } }, result: { select: { actualOrder: true, winnerNos: true } } } },
    },
  });
  console.log(`Toplam gecmis satir: ${allRows.length}`);

  function hesaplaKYuzde(field: "sire" | "dam" | "damSire", name: string, irk: string, pist: string, mesafe: string, cutoffMs: number, kendiTjkAtId: number | null): { kYuzde: number | null; nObs: number } {
    const hedefIsim = normalizeSireName(name);
    let start = 0, wins = 0, kendiDahil = 0, kendiWins = 0;
    for (const r of allRows) {
      const rawName = field === "sire" ? r.sire : field === "dam" ? r.dam : r.damSire;
      if (!rawName || !r.race.result) continue;
      if (r.race.raceDay.date.getTime() >= cutoffMs) continue;
      if (breedToIrk(r.race.breed) !== irk) continue;
      if (surfaceToPist(r.race.surface) !== pist) continue;
      if (mesafeBucket(r.race.distance) !== mesafe) continue;
      if (normalizeSireName(rawName) !== hedefIsim) continue;
      const isWin = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos) === 1;
      start++;
      if (isWin) wins++;
      if (kendiTjkAtId != null && r.tjkAtId === kendiTjkAtId) { kendiDahil++; if (isWin) kendiWins++; }
    }
    const dStart = start - kendiDahil, dWins = wins - kendiWins;
    return { kYuzde: dStart > 0 ? (dWins / dStart) * 100 : null, nObs: dStart };
  }

  let currTop1 = 0, currTop3 = 0, corrTop1 = 0, corrTop3 = 0, nEval = 0;
  let currLLsum = 0, corrLLsum = 0;
  const rankSifts: number[] = [];
  const probDiffs: number[] = [];
  let siraDegisen = 0;

  for (const race of races) {
    const c = cache[race.id];
    if (!c || c.winnerNo == null) continue;
    const cutoffMs = race.raceDay.date.getTime();
    const irk = breedToIrk(race.breed), pist = surfaceToPist(race.surface), mesafe = mesafeBucket(race.distance);

    const origVectors = c.runners.map((r) => ({ raceId: race.id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));

    const corrVectors = c.runners.map((r) => {
      const meta = race.runners.find((rr) => rr.no === r.no);
      const genSireSig = r.vectors.find((s) => s.code === "GEN_SIRE_01");
      const genDamSig = r.vectors.find((s) => s.code === "GEN_DAM_01");
      const genDamSireSig = r.vectors.find((s) => s.code === "GEN_DAMSIRE_01");
      const pmz01Sig = r.vectors.find((s) => s.code === "PMZ_01");
      const sinif01Sig = r.vectors.find((s) => s.code === "SINIF_01");
      const form02Sig = r.vectors.find((s) => s.code === "FORM_02");

      let newGenSireVal = genSireSig?.rawValue ?? null, newGenSireObs = !!genSireSig?.observed;
      let newGenDamVal = genDamSig?.rawValue ?? null, newGenDamObs = !!genDamSig?.observed;
      let newGenDamSireVal = genDamSireSig?.rawValue ?? null, newGenDamSireObs = !!genDamSireSig?.observed;

      if (meta?.sire && genSireSig?.observed) {
        const corr = hesaplaKYuzde("sire", meta.sire, irk, pist, mesafe, cutoffMs, meta.tjkAtId);
        newGenSireVal = corr.kYuzde; newGenSireObs = corr.kYuzde != null;
      }
      if (meta?.dam && genDamSig?.observed) {
        const corr = hesaplaKYuzde("dam", meta.dam, irk, pist, mesafe, cutoffMs, meta.tjkAtId);
        newGenDamVal = corr.kYuzde; newGenDamObs = corr.kYuzde != null;
      }
      if (meta?.damSire && genDamSireSig?.observed) {
        const corr = hesaplaKYuzde("damSire", meta.damSire, irk, pist, mesafe, cutoffMs, meta.tjkAtId);
        newGenDamSireVal = corr.kYuzde; newGenDamSireObs = corr.kYuzde != null;
      }

      const yeniSignals: SignalEntry[] = r.vectors.map((sig) => {
        if (sig.code === "GEN_SIRE_01") return { ...sig, rawValue: newGenSireVal, observed: newGenSireObs };
        if (sig.code === "GEN_DAM_01") return { ...sig, rawValue: newGenDamVal, observed: newGenDamObs };
        if (sig.code === "GEN_DAMSIRE_01") return { ...sig, rawValue: newGenDamSireVal, observed: newGenDamSireObs };
        // GEN_SIRE_PMZ_01 = genSire * pmz01 (ayni carpim mantigi, gen-pedigri.ts)
        if (sig.code === "GEN_SIRE_PMZ_01") {
          const obs = newGenSireObs && !!pmz01Sig?.observed;
          return { ...sig, rawValue: obs ? newGenSireVal! * pmz01Sig!.rawValue! : null, observed: obs };
        }
        // FRM_GEN_01 = form02 * genSire (hamCarpim)
        if (sig.code === "FRM_GEN_01") {
          const obs = !!form02Sig?.observed && newGenSireObs;
          return { ...sig, rawValue: obs ? form02Sig!.rawValue! * newGenSireVal! : null, observed: obs };
        }
        // GEN_PMZ_YET_01 = genSire * pmz01 * sinif01 (hamCarpim)
        if (sig.code === "GEN_PMZ_YET_01") {
          const obs = newGenSireObs && !!pmz01Sig?.observed && !!sinif01Sig?.observed;
          return { ...sig, rawValue: obs ? newGenSireVal! * pmz01Sig!.rawValue! * sinif01Sig!.rawValue! : null, observed: obs };
        }
        return sig;
      });
      return { raceId: race.id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: yeniSignals };
    });

    const origScored = [...scoreRace(origVectors, model)].sort((a, b) => b.probability - a.probability);
    const corrScored = [...scoreRace(corrVectors, model)].sort((a, b) => b.probability - a.probability);
    const origIdx = origScored.findIndex((s) => s.no === c.winnerNo);
    const corrIdx = corrScored.findIndex((s) => s.no === c.winnerNo);
    if (origIdx < 0 || corrIdx < 0) continue;

    nEval++;
    if (origIdx === 0) currTop1++;
    if (corrIdx === 0) corrTop1++;
    if (origIdx < 3) currTop3++;
    if (corrIdx < 3) corrTop3++;
    currLLsum += logLoss(origScored[origIdx].probability);
    corrLLsum += logLoss(corrScored[corrIdx].probability);
    rankSifts.push((corrIdx + 1) - (origIdx + 1));
    probDiffs.push(corrScored[corrIdx].probability - origScored[origIdx].probability);
    if (origIdx !== corrIdx) siraDegisen++;
  }

  console.log(`\n=== GEN DUZELTMESI IZOLE ETKI (EK=${nEval} yaris, AYNI model/katsayilar) ===`);
  console.log(`Top-1: eski=${currTop1}/${nEval} (%${(currTop1/nEval*100).toFixed(1)}) -> duzeltilmis=${corrTop1}/${nEval} (%${(corrTop1/nEval*100).toFixed(1)})`);
  console.log(`Top-3: eski=${currTop3}/${nEval} (%${(currTop3/nEval*100).toFixed(1)}) -> duzeltilmis=${corrTop3}/${nEval} (%${(corrTop3/nEval*100).toFixed(1)})`);
  console.log(`LogLoss ortalama: eski=${(currLLsum/nEval).toFixed(4)} -> duzeltilmis=${(corrLLsum/nEval).toFixed(4)} (fark=${((corrLLsum-currLLsum)/nEval).toFixed(4)})`);
  console.log(`Kazananin sirasi degisen yaris: ${siraDegisen}/${nEval}`);
  const ortRankSift = rankSifts.reduce((a,b)=>a+b,0)/rankSifts.length;
  const ortProbDiff = probDiffs.reduce((a,b)=>a+b,0)/probDiffs.length;
  console.log(`Ortalama sira kaymasi: ${ortRankSift.toFixed(3)} (pozitif=kotulesme, negatif=iyilesme)`);
  console.log(`Ortalama olasilik farki: ${ortProbDiff.toFixed(4)}`);
  const iyilesen = rankSifts.filter(r=>r<0).length, kotulesen = rankSifts.filter(r=>r>0).length, ayni = rankSifts.filter(r=>r===0).length;
  console.log(`Sira: iyilesen=${iyilesen} kotulesen=${kotulesen} ayni=${ayni}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
