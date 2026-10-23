// ROTAGANYAN V1.0 — PMZ (Pist, Mesafe, Zemin) KOK NEDEN INCELEMESI (SALT-OKUNUR).
// PMZ kodlari: PMZ_01 (zeminUyumu), PMZ_02 (mesafeUyumu), FORM_x_ZEMIN. PMZ 4 iliskisel
// kodda yer alir (esit-bolustur, cift sayim yok): GEN_PMZ_YET_01(1/3), YET_PMZ_01(1/2),
// YET_PMZ_RAK_01(1/3), KIL_PMZ_YET_01(1/3). Hicbir model/katsayi/kod degismez.
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
const PMZ_DIRECT = ["PMZ_01", "PMZ_02", "FORM_x_ZEMIN"];

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);
  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);

  function pmzBreakdown(fv: RunnerFeatureVector) {
    const { rows } = explainRunner(fv, model);
    const perCode: Record<string, { raw: number | null; obs: boolean; contrib: number }> = {};
    let total = 0;
    for (const code of PMZ_DIRECT) {
      const r = rows.find((x) => x.code === code);
      const c = r ? r.scoreContribution + r.missingIndicatorContribution : 0;
      perCode[code] = { raw: r?.rawValue ?? null, obs: !!r?.observed, contrib: c };
      total += c;
    }
    for (const r of rows) {
      if (!trainedCodes.has(r.code)) continue;
      const contrib = r.scoreContribution + r.missingIndicatorContribution;
      if (r.code === "GEN_PMZ_YET_01") total += contrib / 3;
      else if (r.code === "YET_PMZ_01") total += contrib / 2;
      else if (r.code === "YET_PMZ_RAK_01") total += contrib / 3;
      else if (r.code === "KIL_PMZ_YET_01") total += contrib / 3;
    }
    return { perCode, total };
  }

  const summaryRows: { set: string; raceId: string; winner: string; fark: number; tani: string }[] = [];

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
    const isFocus = raceId.startsWith("cmup2gg0") || raceId.startsWith("cmu60zh6");

    const winnerPmz = pmzBreakdown(vectors[winIdx]);
    const favPmz = pmzBreakdown(vectors[favIdx]);
    const fark = favPmz.total - winnerPmz.total;

    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}]${isFocus ? " *** OZEL ODAK ***" : ""} ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);
    for (const code of PMZ_DIRECT) {
      const w = winnerPmz.perCode[code], f = favPmz.perCode[code];
      console.log(`  ${code}: Kazanan ham=${w.obs ? w.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${w.contrib.toFixed(3)}  |  Favori ham=${f.obs ? f.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${f.contrib.toFixed(3)}`);
    }
    console.log(`  TOPLAM PMZ katki (3 dogrudan + 4 iliski payi) — Kazanan: ${winnerPmz.total.toFixed(3)}  Favori: ${favPmz.total.toFixed(3)}  Fark: ${fark.toFixed(3)}`);

    const adjScores = explains.map((e, i) => {
      if (i === winIdx) return e.totalScore - winnerPmz.total;
      if (i === favIdx) return e.totalScore - favPmz.total;
      return e.totalScore;
    });
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const winnerRankNew = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`  PMZ CIKARILINCA (yalniz K/F ayarlandi, digerleri SABIT — gercek-zamanli tahmin DEGIL): Sira ${winnerRankOld}.->${winnerRankNew}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}->%${(adjProbs[winIdx]*100).toFixed(2)}`);

    let tani: string;
    const kazananGozlemsizSayisi = PMZ_DIRECT.filter((c) => !winnerPmz.perCode[c].obs).length;
    if (Math.abs(fark) < 0.1) tani = "ETKISIZ";
    else if (kazananGozlemsizSayisi >= 2) tani = "YETERSIZ KARSILASTIRMA KOSULU (kazananin PMZ kodlarinin cogu gozlemsiz)";
    else tani = "OGRENILMIS KATKI (ham veri mevcut, katsayi/standardizasyon kazanani geriye itiyor)";
    console.log(`  TANI: ${tani}`);
    summaryRows.push({ set, raceId, winner: race.runners.find((r)=>r.no===race.winnerNo)?.name ?? "?", fark, tani });
  }

  console.log(`\n\n=== OZET (15 yaris, set bazinda) ===`);
  for (const s of ["TRAIN", "HOLDOUT", "EK"]) {
    const subset = summaryRows.filter((r) => r.set === s);
    console.log(`${s} (n=${subset.length}): ${subset.map((r) => `${r.winner}=${r.fark.toFixed(2)}`).join(", ")}`);
  }
  const buyuk = summaryRows.filter((r) => Math.abs(r.fark) > 0.3);
  console.log(`\n|PMZ farki|>0.3 olan yaris: ${buyuk.length}/15 -> ${buyuk.map((r)=>`${r.winner}(${r.tani})`).join("; ")}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
