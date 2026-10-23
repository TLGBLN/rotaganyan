// ROTAGANYAN V1.0 — GEN AILESI KOK NEDEN INCELEMESI (SALT-OKUNUR).
// Kullanici talimati (2026-10-22/23): ayni 15 buyuk-hata yarisinda, ESKI (kirli, oz-dahil
// etme hatali) vs YENI (duzeltilmis, excludeTjkAtIds'li) GEN ham verisini, AYNI donmus
// katsayilarla karsilastir. Hicbir model/katsayi/production kodu degismez — HAZIR
// (zaten commit edilmis) duzeltme fonksiyonlari CANLI DB'ye karsi cagrilir.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { explainRunner } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { computeGenPedigriForRace } from "./src/lib/motor-v1/features/gen-pedigri";
import { getV5461SireOzetleriForRace } from "./src/server/actions/v5461-sire.actions";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

const RACE_PREFIXES_15 = [
  "cmt875dz", "cmtfiu84", "cmt5caao", "cmu52aat", "cmrx3813", "cmudmxle", "cmup2gg0",
  "cmu60zh6", "cmrl0m3t", "cmr5xihb", "cmsh1uys", "cmrpxdmb", "cmunn07g", "cmsr1wh7", "cmunn1bq",
];

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const stats = model.stats;
  const trainedCodes = new Set([...stats.keys()]);

  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);

  function zOf(code: string, rawValue: number | null): number {
    if (rawValue == null) return 0;
    const st = stats.get(code as never);
    if (!st) return 0;
    return (rawValue - st.mu) / (st.sigma || 1);
  }
  function betaOf(code: string): number {
    const i = [...stats.keys()].indexOf(code as never);
    return i >= 0 ? model.beta[i * 2] : 0;
  }

  // GEN'in dogrudan kodlari + katildigi 2 iliskisel kod (esit-bolustur: GEN_PMZ_YET_01 -> 1/3, FRM_GEN_01 -> 1/2)
  function genContrib(fv: RunnerFeatureVector): number {
    const { rows } = explainRunner(fv, model);
    let c = 0;
    for (const r of rows) {
      if (!trainedCodes.has(r.code)) continue;
      const contrib = r.scoreContribution + r.missingIndicatorContribution;
      if (["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"].includes(r.code)) c += contrib;
      else if (r.code === "GEN_PMZ_YET_01") c += contrib / 3;
      else if (r.code === "FRM_GEN_01") c += contrib / 2;
    }
    return c;
  }

  for (const raceId of matched) {
    const race = cache[raceId];
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const explains = vectors.map((v) => explainRunner(v, model));
    const probs = softmax(explains.map((e) => e.totalScore));
    const winIdx = vectors.findIndex((v) => v.no === race.winnerNo);
    if (winIdx < 0) continue;
    const ranked = vectors.map((v, i) => ({ no: v.no, p: probs[i] })).sort((a, b) => b.p - a.p);
    const fav = ranked[0];
    const favIdx = vectors.findIndex((v) => v.no === fav.no);
    const winnerRankOld = ranked.findIndex((r) => r.no === race.winnerNo) + 1;

    const set = trainSet.has(raceId) ? "TRAIN" : holdoutSet.has(raceId) ? "HOLDOUT" : "EK";
    const isSonKralice = raceId.startsWith("cmtfiu84");

    // DB'den gercek yaris meta + sire/dam/damSire + tjkAtId
    const raceMeta = await db.race.findUnique({
      where: { id: raceId },
      select: { breed: true, surface: true, distance: true, raceDay: { select: { date: true } },
        runners: { where: { scratched: false }, select: { no: true, sire: true, dam: true, damSire: true, tjkAtId: true } } },
    });
    if (!raceMeta) continue;
    const cutoff = raceMeta.raceDay.date;
    const allRunnersInput = raceMeta.runners.map((r) => ({ no: r.no, sire: r.sire, dam: r.dam, damSire: r.damSire, tjkAtId: r.tjkAtId }));

    // PMZ_01 (eski onbellekten, GEN duzeltmesinden ETKILENMEZ) -> GEN_SIRE_PMZ_01 yeniden-hesap girdisi
    const pmzHam = new Map<number, number | null>();
    for (const r of race.runners) {
      const pmz = r.vectors.find((s) => s.code === "PMZ_01");
      pmzHam.set(r.no, pmz?.observed ? pmz.rawValue : null);
    }

    // YENI (duzeltilmis, commit edilmis kod) GEN hesap — canli DB'ye karsi
    const genNew = await computeGenPedigriForRace(allRunnersInput, raceMeta.breed, raceMeta.surface, raceMeta.distance, cutoff, pmzHam);
    const genNewByNo = new Map(genNew.map((g) => [g.no, g.signals]));

    const oldVals = (no: number) => {
      const fv = vectors.find((v) => v.no === no)!;
      return {
        sire: fv.signals.find((s) => s.code === "GEN_SIRE_01"), dam: fv.signals.find((s) => s.code === "GEN_DAM_01"),
        damSire: fv.signals.find((s) => s.code === "GEN_DAMSIRE_01"), sirePmz: fv.signals.find((s) => s.code === "GEN_SIRE_PMZ_01"),
      };
    };
    const newVals = (no: number) => {
      const sig = genNewByNo.get(no) ?? [];
      return {
        sire: sig.find((s) => s.code === "GEN_SIRE_01"), dam: sig.find((s) => s.code === "GEN_DAM_01"),
        damSire: sig.find((s) => s.code === "GEN_DAMSIRE_01"), sirePmz: sig.find((s) => s.code === "GEN_SIRE_PMZ_01"),
      };
    };

    const winnerOld = oldVals(race.winnerNo!), winnerNew = newVals(race.winnerNo!);
    const favOld = oldVals(fav.no), favNew = newVals(fav.no);

    const fmt = (v: { rawValue: number | null; observed: boolean } | undefined) => v ? (v.observed ? v.rawValue!.toFixed(1) : "GOZLEMSIZ") : "YOK";
    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}]${isSonKralice ? " *** SON KRALICE/NARLIGOL ***" : ""} ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);
    console.log(`Q1/Q2 Kazanan GEN (eski->yeni): SIRE=${fmt(winnerOld.sire)}->${fmt(winnerNew.sire)} DAM=${fmt(winnerOld.dam)}->${fmt(winnerNew.dam)} DAMSIRE=${fmt(winnerOld.damSire)}->${fmt(winnerNew.damSire)} SIRE_PMZ=${fmt(winnerOld.sirePmz)}->${fmt(winnerNew.sirePmz)}`);
    console.log(`         Favori GEN  (eski->yeni): SIRE=${fmt(favOld.sire)}->${fmt(favNew.sire)} DAM=${fmt(favOld.dam)}->${fmt(favNew.dam)} DAMSIRE=${fmt(favOld.damSire)}->${fmt(favNew.damSire)} SIRE_PMZ=${fmt(favOld.sirePmz)}->${fmt(favNew.sirePmz)}`);

    const degisenVarMi = [winnerOld.sire?.rawValue !== winnerNew.sire?.rawValue, winnerOld.dam?.rawValue !== winnerNew.dam?.rawValue,
      winnerOld.damSire?.rawValue !== winnerNew.damSire?.rawValue, favOld.sire?.rawValue !== favNew.sire?.rawValue,
      favOld.dam?.rawValue !== favNew.dam?.rawValue, favOld.damSire?.rawValue !== favNew.damSire?.rawValue].some(Boolean);

    // Q3: GEN skor katkisi (eski)
    const winnerContribOld = genContrib(vectors[winIdx]);
    const favContribOld = genContrib(vectors[favIdx]);
    console.log(`Q3 GEN skor katkisi (eski veriyle) — Kazanan: ${winnerContribOld.toFixed(3)}  Favori: ${favContribOld.toFixed(3)}  Fark: ${(favContribOld-winnerContribOld).toFixed(3)}`);

    // Q4: AYNI donmus beta ile YENI ham degerleri z-skorlayip skor farkini yeniden hesapla (yalniz GEN_SIRE/DAM/DAMSIRE/SIRE_PMZ 4 kodu icin; etkilesimler SABIT birakilir cunku onlarin PMZ/YET/FRM bileseni degismedi)
    function genContribNew(no: number, oldFv: RunnerFeatureVector, newG: { sire?: typeof winnerNew.sire; dam?: typeof winnerNew.dam; damSire?: typeof winnerNew.damSire; sirePmz?: typeof winnerNew.sirePmz }): number {
      const { rows } = explainRunner(oldFv, model);
      let c = 0;
      for (const r of rows) {
        if (!trainedCodes.has(r.code)) continue;
        if (r.code === "GEN_SIRE_01") { const v = newG.sire; c += v?.observed ? betaOf(r.code) * zOf(r.code, v.rawValue) : 0; continue; }
        if (r.code === "GEN_DAM_01") { const v = newG.dam; c += v?.observed ? betaOf(r.code) * zOf(r.code, v.rawValue) : 0; continue; }
        if (r.code === "GEN_DAMSIRE_01") { const v = newG.damSire; c += v?.observed ? betaOf(r.code) * zOf(r.code, v.rawValue) : 0; continue; }
        if (r.code === "GEN_SIRE_PMZ_01") { const v = newG.sirePmz; c += v?.observed ? betaOf(r.code) * zOf(r.code, v.rawValue) : 0; continue; }
        const contrib = r.scoreContribution + r.missingIndicatorContribution;
        if (r.code === "GEN_PMZ_YET_01") c += contrib / 3;
        else if (r.code === "FRM_GEN_01") c += contrib / 2;
      }
      return c;
    }
    const winnerContribNew = genContribNew(race.winnerNo!, vectors[winIdx], winnerNew);
    const favContribNew = genContribNew(fav.no, vectors[favIdx], favNew);
    const deltaGenEffect = (favContribNew - winnerContribNew) - (favContribOld - winnerContribOld);
    const adjScores = explains.map((e, i) => {
      if (i === winIdx) return e.totalScore - winnerContribOld + winnerContribNew;
      if (i === favIdx) return e.totalScore - favContribOld + favContribNew;
      return e.totalScore;
    });
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const winnerRankNew = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`Q4 ESKI->YENI (ayni donmus katsayi): Kazanan sirasi ${winnerRankOld}.->${winnerRankNew}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}->%${(adjProbs[winIdx]*100).toFixed(2)}  (GEN-kaynakli etki degisimi: ${deltaGenEffect.toFixed(3)})`);

    let tani: string;
    if (!degisenVarMi) tani = "GEN verisi bu iki at icin DEGISMEDI (oz-dahil hatasi bu yarista TETIKLENMEDI)";
    else if (winnerRankNew < winnerRankOld) tani = `GEN DUZELTMESI KAZANANI DAHA IYI SIRAYA TASIR (${winnerRankOld}.->${winnerRankNew}.) — eski veri kazanani haksiz yere geriye itiyormus`;
    else if (winnerRankNew > winnerRankOld) tani = `GEN DUZELTMESI KAZANANI DAHA DA GERIYE ITER (${winnerRankOld}.->${winnerRankNew}.) — bu yariste eski veri kazanana AVANTAJ sagliyormus`;
    else tani = "GEN verisi degisti ama sira degismedi (etki kucuk)";
    console.log(`Q5 TANI: ${tani}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
