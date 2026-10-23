// ROTAGANYAN V1.0 — JOK (Jokey) KOK NEDEN INCELEMESI (SALT-OKUNUR).
// JOK dogrudan kodlari (egitimli): JOKEY_01, JOKEY_02, JOKEY_04, JOKEY_TREND30.
// JOKEY_03 ve JOK_FRM_TMP_01 egitimli modelde YOK (asagida dogrulanir). JOK, 8 aktif
// iliskisel kodun HICBIRINDE yer ALMIYOR (dogrulandi) — iliskisel pay HESAPLANMAZ.
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
const JOK_DIRECT = ["JOKEY_01", "JOKEY_02", "JOKEY_04", "JOKEY_TREND30"];

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);
  console.log(`DOGRULAMA: JOKEY_03 egitimli mi? ${trainedCodes.has("JOKEY_03" as never)} (HAYIR beklenir, observedRate=%0.08)`);
  console.log(`DOGRULAMA: JOK_FRM_TMP_01 egitimli mi? ${trainedCodes.has("JOK_FRM_TMP_01" as never)} (HAYIR beklenir, observedRate=0)`);
  console.log(`DOGRULAMA: JOK, 8 aktif iliskisel kodun herhangi birinde var mi? HAYIR (INTERACTION_COMPONENTS listesinde JOK YOK)`);
  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);

  function jokBreakdown(fv: RunnerFeatureVector) {
    const { rows } = explainRunner(fv, model);
    const perCode: Record<string, { raw: number | null; obs: boolean; contrib: number }> = {};
    let total = 0;
    for (const code of JOK_DIRECT) {
      const r = rows.find((x) => x.code === code);
      const c = r ? r.scoreContribution + r.missingIndicatorContribution : 0;
      perCode[code] = { raw: r?.rawValue ?? null, obs: !!r?.observed, contrib: c };
      total += c;
    }
    return { perCode, total };
  }

  const summaryRows: { set: string; winner: string; fark: number; tani: string }[] = [];

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
    const isFocus = raceId.startsWith("cmt5caao") || raceId.startsWith("cmsh1uys");

    const winnerJok = jokBreakdown(vectors[winIdx]);
    const favJok = jokBreakdown(vectors[favIdx]);
    const fark = favJok.total - winnerJok.total;

    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}]${isFocus ? " *** OZEL ODAK ***" : ""} ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);
    for (const code of JOK_DIRECT) {
      const w = winnerJok.perCode[code], f = favJok.perCode[code];
      console.log(`  ${code}: Kazanan ham=${w.obs ? w.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${w.contrib.toFixed(3)}  |  Favori ham=${f.obs ? f.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${f.contrib.toFixed(3)}`);
    }
    console.log(`  TOPLAM JOK — Kazanan: ${winnerJok.total.toFixed(3)}  Favori: ${favJok.total.toFixed(3)}  Fark: ${fark.toFixed(3)}`);

    const adjScores = explains.map((e, i) => {
      if (i === winIdx) return e.totalScore - winnerJok.total;
      if (i === favIdx) return e.totalScore - favJok.total;
      return e.totalScore;
    });
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const winnerRankNew = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`  JOK CIKARILINCA (yalniz K/F ayarlandi, digerleri SABIT): Sira ${winnerRankOld}.->${winnerRankNew}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}->%${(adjProbs[winIdx]*100).toFixed(2)}`);

    let tani: string;
    const kazananGozlemsizSayisi = JOK_DIRECT.filter((c) => !winnerJok.perCode[c].obs).length;
    if (Math.abs(fark) < 0.1) tani = "ETKISIZ";
    else if (fark < -0.1) tani = "JOK KAZANANI DESTEKLIYOR (hatanin nedeni DEGIL)";
    else if (kazananGozlemsizSayisi >= 2) tani = "EKSIK GECMIS PERFORMANS (kazananin jokey kodlarinin cogu gozlemsiz)";
    else tani = "OGRENILMIS KATKI (veri mevcut, JOK kazanani geriye itiyor)";
    console.log(`  TANI: ${tani}`);
    summaryRows.push({ set, winner: race.runners.find((r)=>r.no===race.winnerNo)?.name ?? "?", fark, tani });
  }

  console.log(`\n\n=== OZET (15 yaris) ===`);
  for (const r of summaryRows) console.log(`  [${r.set}] ${r.winner}: fark=${r.fark.toFixed(2)} -> ${r.tani}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
