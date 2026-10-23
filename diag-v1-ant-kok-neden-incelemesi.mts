// ROTAGANYAN V1.0 — ANT (Antrenor) KOK NEDEN INCELEMESI (SALT-OKUNUR, SON AILE).
// ANT'nin yalniz aktif/egitimli dogrudan kodu: ANT_TREND30 (ANT_01/02 registry'de bloke
// edilmisti, TrainerStatSync sizintisi nedeniyle — ANT_TREND30 bunun yerine Runner/Race/
// Result'tan sifirdan, cutoff'lu hesaplaniyor). Kimlik eslestirme: trainer ADI, TEK kaynak
// (Runner tablosu) icinde TAM STRING esitligi — JOKEY_04'teki kisaltma/soyad riski BURADA
// YOK (ayri kaynak eslestirmesi yapilmiyor). ANT tek iliskisel kodda yer alir: ANT_FRM_01
// (esit-bolustur 1/2).
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

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);
  console.log(`DOGRULAMA: ANT_TREND30 egitimli mi? ${trainedCodes.has("ANT_TREND30" as never)} (EVET beklenir)`);
  console.log(`DOGRULAMA: ANT_01/ANT_02 egitimli mi? ${trainedCodes.has("ANT_01" as never)}/${trainedCodes.has("ANT_02" as never)} (HAYIR beklenir — registry'de blokeliydi)`);
  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);

  function antBreakdown(fv: RunnerFeatureVector) {
    const { rows } = explainRunner(fv, model);
    const r = rows.find((x) => x.code === "ANT_TREND30");
    const direct = r ? r.scoreContribution + r.missingIndicatorContribution : 0;
    let iliski = 0;
    for (const rr of rows) {
      if (!trainedCodes.has(rr.code)) continue;
      if (rr.code === "ANT_FRM_01") iliski += (rr.scoreContribution + rr.missingIndicatorContribution) / 2;
    }
    return { raw: r?.rawValue ?? null, obs: !!r?.observed, direct, iliski, total: direct + iliski };
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
    const isFocus = raceId.startsWith("cmr5xihb");

    const winnerAnt = antBreakdown(vectors[winIdx]);
    const favAnt = antBreakdown(vectors[favIdx]);
    const fark = favAnt.total - winnerAnt.total;

    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}]${isFocus ? " *** OZEL ODAK ***" : ""} ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);
    console.log(`  ANT_TREND30: Kazanan ham=${winnerAnt.obs ? winnerAnt.raw!.toFixed(3) : "GOZLEMSIZ"} dogrudan-katki=${winnerAnt.direct.toFixed(3)}  |  Favori ham=${favAnt.obs ? favAnt.raw!.toFixed(3) : "GOZLEMSIZ"} dogrudan-katki=${favAnt.direct.toFixed(3)}`);
    console.log(`  ANT ILISKISEL PAYI (ANT_FRM_01/2) — Kazanan: ${winnerAnt.iliski.toFixed(3)}  Favori: ${favAnt.iliski.toFixed(3)}  Fark: ${(favAnt.iliski-winnerAnt.iliski).toFixed(3)}`);
    console.log(`  TOPLAM ANT — Fark: ${fark.toFixed(3)}`);

    const adjScores = explains.map((e, i) => {
      if (i === winIdx) return e.totalScore - winnerAnt.total;
      if (i === favIdx) return e.totalScore - favAnt.total;
      return e.totalScore;
    });
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const winnerRankNew = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`  ANT CIKARILINCA (yalniz K/F ayarlandi, digerleri SABIT): Sira ${winnerRankOld}.->${winnerRankNew}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}->%${(adjProbs[winIdx]*100).toFixed(2)}`);

    let tani: string;
    if (Math.abs(fark) < 0.1) tani = "ETKISIZ";
    else if (fark < -0.1) tani = "ANT KAZANANI DESTEKLIYOR (hatanin nedeni DEGIL)";
    else if (!winnerAnt.obs) tani = "VERI EKSIKLIGI (kazananin antrenoru son30/onceki30 penceresinde hic binis yapmamis — GERCEK yetersizlik, kimlik sorunu DEGIL cunku tek-kaynak TAM string eslesmesi kullaniliyor)";
    else tani = "OGRENILMIS KATKI (veri mevcut, ANT kazanani geriye itiyor)";
    console.log(`  TANI: ${tani}`);
    summaryRows.push({ set, winner: race.runners.find((r)=>r.no===race.winnerNo)?.name ?? "?", direct: favAnt.direct-winnerAnt.direct, iliski: favAnt.iliski-winnerAnt.iliski, total: fark, tani });
  }

  console.log(`\n\n=== OZET (15 yaris) ===`);
  for (const r of summaryRows) console.log(`  [${r.set}] ${r.winner}: dogrudan=${r.direct.toFixed(2)} iliskisel=${r.iliski.toFixed(2)} toplam=${r.total.toFixed(2)} -> ${r.tani}`);
  const counts: Record<string, number> = {};
  for (const r of summaryRows) counts[r.tani] = (counts[r.tani] ?? 0) + 1;
  console.log(`\nKategori toplami (15'e esit olmali): ${Object.values(counts).reduce((a,b)=>a+b,0)}`);
  console.log(JSON.stringify(counts, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
