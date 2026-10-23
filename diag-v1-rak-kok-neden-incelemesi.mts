// ROTAGANYAN V1.0 — RAK (Rakip Gucu) KOK NEDEN INCELEMESI (SALT-OKUNUR).
// RAK dogrudan kodlari: RAK_H2H_01, RAK_GAP_01. 2 iliskisel koda esit-bolustur:
// YET_PMZ_RAK_01(1/3), RAK_YET_TMP_01(1/3). Hicbir model/katsayi/kod degismez.
import fs from "node:fs";
import { explainRunner } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

const RACE_PREFIXES_15 = [
  "cmt875dz", "cmtfiu84", "cmt5caao", "cmu52aat", "cmrx3813", "cmudmxle", "cmup2gg0",
  "cmu60zh6", "cmrl0m3t", "cmr5xihb", "cmsh1uys", "cmrpxdmb", "cmunn07g", "cmsr1wh7", "cmunn1bq",
];
const RAK_DIRECT = ["RAK_H2H_01", "RAK_GAP_01"];

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);
  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);

  function rakBreakdown(fv: RunnerFeatureVector) {
    const { rows } = explainRunner(fv, model);
    const perCode: Record<string, { raw: number | null; obs: boolean; contrib: number }> = {};
    let direct = 0, iliski = 0;
    for (const code of RAK_DIRECT) {
      const r = rows.find((x) => x.code === code);
      const c = r ? r.scoreContribution + r.missingIndicatorContribution : 0;
      perCode[code] = { raw: r?.rawValue ?? null, obs: !!r?.observed, contrib: c };
      direct += c;
    }
    for (const r of rows) {
      if (!trainedCodes.has(r.code)) continue;
      const contrib = r.scoreContribution + r.missingIndicatorContribution;
      if (r.code === "YET_PMZ_RAK_01") iliski += contrib / 3;
      else if (r.code === "RAK_YET_TMP_01") iliski += contrib / 3;
    }
    return { perCode, direct, iliski, total: direct + iliski };
  }

  const summaryRows: { set: string; winner: string; direct: number; iliski: number; total: number; tani: string }[] = [];

  for (const raceId of matched) {
    const race = cache[raceId];
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const explains = vectors.map((v) => explainRunner(v, model));
    const probs = softmax(explains.map((e) => e.totalScore));
    const winIdx = vectors.findIndex((v) => v.no === race.winnerNo);
    if (winIdx < 0) continue;
    const ranked = vectors.map((v, i) => ({ no: v.no, name: v.name, p: probs[i] })).sort((a, b) => b.p - a.p);
    const fav = ranked[0];
    const favIdx = vectors.findIndex((v) => v.no === fav.no);
    const winnerRankOld = ranked.findIndex((r) => r.no === race.winnerNo) + 1;
    const set = trainSet.has(raceId) ? "TRAIN" : holdoutSet.has(raceId) ? "HOLDOUT" : "EK";
    const isFocus = raceId.startsWith("cmunn07g") || raceId.startsWith("cmu52aat") || raceId.startsWith("cmtfiu84");

    const winnerRak = rakBreakdown(vectors[winIdx]);
    const favRak = rakBreakdown(vectors[favIdx]);
    const fark = favRak.total - winnerRak.total;

    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}]${isFocus ? " *** OZEL ODAK ***" : ""} ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);
    for (const code of RAK_DIRECT) {
      const w = winnerRak.perCode[code], f = favRak.perCode[code];
      console.log(`  ${code}: Kazanan ham=${w.obs ? w.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${w.contrib.toFixed(3)}  |  Favori ham=${f.obs ? f.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${f.contrib.toFixed(3)}`);
    }
    console.log(`  RAK DOGRUDAN — Kazanan: ${winnerRak.direct.toFixed(3)}  Favori: ${favRak.direct.toFixed(3)}  Fark: ${(favRak.direct-winnerRak.direct).toFixed(3)}`);
    console.log(`  RAK ILISKISEL PAYI (YET_PMZ_RAK_01/3 + RAK_YET_TMP_01/3) — Kazanan: ${winnerRak.iliski.toFixed(3)}  Favori: ${favRak.iliski.toFixed(3)}  Fark: ${(favRak.iliski-winnerRak.iliski).toFixed(3)}`);
    console.log(`  TOPLAM RAK — Fark: ${fark.toFixed(3)}`);

    const adjScores = explains.map((e, i) => {
      if (i === winIdx) return e.totalScore - winnerRak.total;
      if (i === favIdx) return e.totalScore - favRak.total;
      return e.totalScore;
    });
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const winnerRankNew = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`  RAK CIKARILINCA (yalniz K/F ayarlandi, digerleri SABIT): Sira ${winnerRankOld}.->${winnerRankNew}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}->%${(adjProbs[winIdx]*100).toFixed(2)}`);

    let tani: string;
    const winnerBothMissing = RAK_DIRECT.every((c) => !winnerRak.perCode[c].obs);
    if (Math.abs(fark) < 0.1) tani = "ETKISIZ";
    else if (winnerBothMissing) tani = "YETERSIZ ORNEKLEM (kazananin RAK_H2H_01 ve RAK_GAP_01'i GOZLEMSIZ)";
    else if (Math.abs(favRak.iliski - winnerRak.iliski) > Math.abs(favRak.direct - winnerRak.direct)) tani = "ILISKISEL YAYILIM (fark cogunlukla YET/PMZ/TMP paylasimli kodlardan geliyor, RAK'a OZGU degil)";
    else tani = "OGRENILMIS KATKI (RAK'in kendi dogrudan kodu kazanani geriye itiyor)";
    console.log(`  TANI: ${tani}`);
    summaryRows.push({ set, winner: race.runners.find((r)=>r.no===race.winnerNo)?.name ?? "?", direct: favRak.direct-winnerRak.direct, iliski: favRak.iliski-winnerRak.iliski, total: fark, tani });
  }

  console.log(`\n\n=== OZET (15 yaris) ===`);
  for (const r of summaryRows) console.log(`  [${r.set}] ${r.winner}: dogrudan=${r.direct.toFixed(2)} iliskisel=${r.iliski.toFixed(2)} toplam=${r.total.toFixed(2)} -> ${r.tani}`);
  console.log(`\nHATIRLATMA (FAZ3'ten, GENIS kapsam — TMP/PMZ scriptlerindekiyle AYNI ilke): HOLDOUT+EK(138) ortalama RAK ΔLL=+0.0374 (ablasyon LogLoss'u KOTULESTIRIYOR = RAK genis orneklemde NET FAYDALI). Bu 15 en-kotu-hata orneklemi KUCUK ve SECILMIS (secim kriteri = en kotu LogLoss) — buradaki bulgular genis ortalamaya GENELLENMEZ.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
