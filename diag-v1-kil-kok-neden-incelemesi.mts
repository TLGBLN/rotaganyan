// ROTAGANYAN V1.0 — KIL (Kilo, Dayaniklilik) KOK NEDEN INCELEMESI (SALT-OKUNUR).
// KIL dogrudan kodlari: KILO_01 (saha-goreli), KILO_02 (gecmise-gore fark, shrinkage YOK —
// acik is), KILO_03 (kilo x mesafe HAM carpim), KILO_04 (kilo x handikap-bayragi). KIL tek
// iliskisel kodda yer alir: KIL_PMZ_YET_01 (esit-bolustur 1/3). Runner.weight = TJK'nin
// yayinladigi NET tasinan kilo (jokey indirimi ZATEN icinde, ayri bir "temel kilo" sutunu
// YOK — bu veri-kisiti, bug degil).
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
const KIL_DIRECT = ["KILO_01", "KILO_02", "KILO_03", "KILO_04"];

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);
  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);

  function kilBreakdown(fv: RunnerFeatureVector) {
    const { rows } = explainRunner(fv, model);
    const perCode: Record<string, { raw: number | null; obs: boolean; contrib: number }> = {};
    let direct = 0, iliski = 0;
    for (const code of KIL_DIRECT) {
      const r = rows.find((x) => x.code === code);
      const c = r ? r.scoreContribution + r.missingIndicatorContribution : 0;
      perCode[code] = { raw: r?.rawValue ?? null, obs: !!r?.observed, contrib: c };
      direct += c;
    }
    for (const r of rows) {
      if (!trainedCodes.has(r.code)) continue;
      if (r.code === "KIL_PMZ_YET_01") iliski += (r.scoreContribution + r.missingIndicatorContribution) / 3;
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

    const winnerKil = kilBreakdown(vectors[winIdx]);
    const favKil = kilBreakdown(vectors[favIdx]);
    const fark = favKil.total - winnerKil.total;

    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}] ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);
    for (const code of KIL_DIRECT) {
      const w = winnerKil.perCode[code], f = favKil.perCode[code];
      console.log(`  ${code}: Kazanan ham=${w.obs ? w.raw!.toFixed(2) : "GOZLEMSIZ"} katki=${w.contrib.toFixed(3)}  |  Favori ham=${f.obs ? f.raw!.toFixed(2) : "GOZLEMSIZ"} katki=${f.contrib.toFixed(3)}`);
    }
    // KILO_01 vs KILO_04 artiklik kontrolu (Handikap'ta esit olmali)
    const w01 = winnerKil.perCode["KILO_01"].raw, w04 = winnerKil.perCode["KILO_04"].raw;
    const redundant = w01 != null && w04 != null && Math.abs(w01 - w04) < 0.01 && w04 !== 0;
    console.log(`  KILO_01 vs KILO_04 (kazanan) esit mi (Handikap artikligi): ${redundant ? "EVET, BIREBIR AYNI (artiklik DOGRULANDI)" : "hayir/farkli"}`);
    console.log(`  KIL DOGRUDAN — Kazanan: ${winnerKil.direct.toFixed(3)}  Favori: ${favKil.direct.toFixed(3)}  Fark: ${(favKil.direct-winnerKil.direct).toFixed(3)}`);
    console.log(`  KIL ILISKISEL PAYI (KIL_PMZ_YET_01/3) — Kazanan: ${winnerKil.iliski.toFixed(3)}  Favori: ${favKil.iliski.toFixed(3)}  Fark: ${(favKil.iliski-winnerKil.iliski).toFixed(3)}`);
    console.log(`  TOPLAM KIL — Fark: ${fark.toFixed(3)}`);

    const adjScores = explains.map((e, i) => {
      if (i === winIdx) return e.totalScore - winnerKil.total;
      if (i === favIdx) return e.totalScore - favKil.total;
      return e.totalScore;
    });
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const winnerRankNew = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`  KIL CIKARILINCA (yalniz K/F ayarlandi, digerleri SABIT): Sira ${winnerRankOld}.->${winnerRankNew}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}->%${(adjProbs[winIdx]*100).toFixed(2)}`);

    let tani: string;
    const kazananGozlemsizSayisi = KIL_DIRECT.filter((c) => !winnerKil.perCode[c].obs).length;
    if (Math.abs(fark) < 0.1) tani = "ETKISIZ";
    else if (fark < -0.1) tani = "KIL KAZANANI DESTEKLIYOR (hatanin nedeni DEGIL)";
    else if (kazananGozlemsizSayisi >= 2) tani = "HAM VERI EKSIKLIGI (kazananin kilo kodlarinin cogu gozlemsiz)";
    else tani = "OGRENILMIS KATKI (veri mevcut, KIL kazanani geriye itiyor)";
    console.log(`  TANI: ${tani}`);
    summaryRows.push({ set, winner: race.runners.find((r)=>r.no===race.winnerNo)?.name ?? "?", direct: favKil.direct-winnerKil.direct, iliski: favKil.iliski-winnerKil.iliski, total: fark, tani });
  }

  console.log(`\n\n=== OZET (15 yaris) ===`);
  for (const r of summaryRows) console.log(`  [${r.set}] ${r.winner}: dogrudan=${r.direct.toFixed(2)} iliskisel=${r.iliski.toFixed(2)} toplam=${r.total.toFixed(2)} -> ${r.tani}`);
  const counts: Record<string, number> = {};
  for (const r of summaryRows) counts[r.tani] = (counts[r.tani] ?? 0) + 1;
  console.log(`\nKategori toplami (15'e esit olmali): ${Object.values(counts).reduce((a,b)=>a+b,0)}`);
  console.log(JSON.stringify(counts, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
