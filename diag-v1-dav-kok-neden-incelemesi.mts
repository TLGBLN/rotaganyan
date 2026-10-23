// ROTAGANYAN V1.0 — DAV AILESI KOK NEDEN INCELEMESI (SALT-OKUNUR).
// Kullanici talimati (2026-10-22): "Eski onbellegin hatali olmasi, canli production'in
// halen hatali oldugunu kanitlamaz. Production'da kullanilan gercek veri akisini salt
// okunur bicimde dogrula." Bu script, EK(108) setindeki yarislar icin GUNCEL (duzeltilmis)
// dav-taki.ts kodunu CANLI DB'ye karsi calistirir — onbellege GUVENMEZ.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { explainRunner } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { computeDavTakiDegisikligi } from "./src/lib/motor-v1/features/dav-taki";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

// 15 buyuk hatanin TAMAMI (onceki turda belirlendi) — 7 "DAV-dominant" + diger 8.
const RACE_PREFIXES_15 = [
  "cmt875dz", "cmtfiu84", "cmt5caao", "cmu52aat", "cmrx3813", "cmudmxle", "cmup2gg0",
  "cmu60zh6", "cmrl0m3t", "cmr5xihb", "cmsh1uys", "cmrpxdmb", "cmunn07g", "cmsr1wh7", "cmunn1bq",
];
const DAV_DOMINANT_7 = ["cmt875dz", "cmt5caao", "cmu52aat", "cmudmxle", "cmup2gg0", "cmu60zh6", "cmsh1uys"];

async function liveDavFromDb(raceId: string, runnerNo: number): Promise<{ eklendi: number | null; cikarildi: number | null; obsEklendi: boolean; obsCikarildi: boolean; backfilled: boolean; equipmentRaw: string | null }> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { no: true, equipment: true, tjkAtId: true } } },
  });
  if (!race) return { eklendi: null, cikarildi: null, obsEklendi: false, obsCikarildi: false, backfilled: false, equipmentRaw: null };
  const backfilled = race.runners.some((r) => r.equipment != null && r.equipment.trim() !== "");
  const r = race.runners.find((x) => x.no === runnerNo);
  if (!r) return { eklendi: null, cikarildi: null, obsEklendi: false, obsCikarildi: false, backfilled, equipmentRaw: null };
  const cacheRow = r.tjkAtId != null ? await db.horseRaceHistoryCache.findUnique({ where: { tjkAtId: r.tjkAtId }, select: { rowsJson: true } }) : null;
  const dav = computeDavTakiDegisikligi(r.equipment, r.tjkAtId, cacheRow?.rowsJson ?? [], race.raceDay.date, backfilled);
  const ekl = dav.signals.find((s) => s.code === "DAV_TAKI_EKLENDI")!;
  const cik = dav.signals.find((s) => s.code === "DAV_TAKI_CIKARILDI")!;
  return { eklendi: ekl.rawValue, cikarildi: cik.rawValue, obsEklendi: ekl.observed, obsCikarildi: cik.observed, backfilled, equipmentRaw: r.equipment };
}

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);

  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);
  console.log(`Eslesen yaris: ${matched.length}/15\n`);

  function davContrib(fv: RunnerFeatureVector): number {
    const { rows } = explainRunner(fv, model);
    let c = 0;
    for (const r of rows) {
      if (!trainedCodes.has(r.code)) continue;
      const contrib = r.scoreContribution + r.missingIndicatorContribution;
      if (r.code === "DAV_TAKI_EKLENDI" || r.code === "DAV_TAKI_CIKARILDI") c += contrib;
      else if (r.code === "TMP_DAV_01") c += contrib / 2; // esit-bolustur (TMP+DAV)
    }
    return c;
  }

  for (const raceId of matched) {
    const race = cache[raceId];
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const explains = vectors.map((v) => explainRunner(v, model));
    const scores = explains.map((e) => e.totalScore);
    const probs = softmax(scores);
    const winIdx = vectors.findIndex((v) => v.no === race.winnerNo);
    if (winIdx < 0) continue;
    const ranked = vectors.map((v, i) => ({ no: v.no, name: v.name, p: probs[i] })).sort((a, b) => b.p - a.p);
    const fav = ranked[0];
    const favIdx = vectors.findIndex((v) => v.no === fav.no);

    const isDavDominant = DAV_DOMINANT_7.some((p) => raceId.startsWith(p));
    const set = trainSet.has(raceId) ? "TRAIN" : holdoutSet.has(raceId) ? "HOLDOUT" : "EK";
    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}]${isDavDominant ? " *** DAV-BASKIN ***" : ""} ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);

    // Q1-Q2: ham veri (eski onbellek)
    const winnerDavRaw = vectors[winIdx].signals.filter((s) => s.code === "DAV_TAKI_EKLENDI" || s.code === "DAV_TAKI_CIKARILDI");
    const favDavRaw = vectors[favIdx].signals.filter((s) => s.code === "DAV_TAKI_EKLENDI" || s.code === "DAV_TAKI_CIKARILDI");
    console.log(`Q1 (eski onbellek) Kazananin DAV ham verisi: ${winnerDavRaw.map((s) => `${s.code}=${s.observed ? s.rawValue : "GOZLEMSIZ"}`).join(", ")}`);
    console.log(`Q2 (eski onbellek) Favorinin DAV ham verisi: ${favDavRaw.map((s) => `${s.code}=${s.observed ? s.rawValue : "GOZLEMSIZ"}`).join(", ")}`);

    // CANLI DOGRULAMA (DB'den, GUNCEL/duzeltilmis kod)
    const liveWinner = await liveDavFromDb(raceId, race.winnerNo!);
    const liveFav = await liveDavFromDb(raceId, fav.no);
    console.log(`>>> CANLI (guncel kod, DB'den) Kazanan: backfilled=${liveWinner.backfilled} equipment="${liveWinner.equipmentRaw}" EKLENDI=${liveWinner.obsEklendi ? liveWinner.eklendi : "GOZLEMSIZ"} CIKARILDI=${liveWinner.obsCikarildi ? liveWinner.cikarildi : "GOZLEMSIZ"}`);
    console.log(`>>> CANLI (guncel kod, DB'den) Favori:  backfilled=${liveFav.backfilled} equipment="${liveFav.equipmentRaw}" EKLENDI=${liveFav.obsEklendi ? liveFav.eklendi : "GOZLEMSIZ"} CIKARILDI=${liveFav.obsCikarildi ? liveFav.cikarildi : "GOZLEMSIZ"}`);
    const eskiVsYeniDegisti = !liveWinner.backfilled || !liveFav.backfilled;
    console.log(`>>> SONUC: eski/yeni DAV degeri bu yariste ${eskiVsYeniDegisti ? "DEGISTI (backfill-bosluk tespit edildi, guncel kod artik observed=false donuyor)" : "DEGISMEDI (equipment o yaris icin gercekten dolu, sahte-veri bugu bu yarisi etkilemiyordu)"}`);

    // Q3: DAV skor katkisi (ayri ayri)
    const winnerContrib = davContrib(vectors[winIdx]);
    const favContrib = davContrib(vectors[favIdx]);
    console.log(`Q3 DAV skor katkisi — Kazanan: ${winnerContrib.toFixed(3)}  Favori: ${favContrib.toFixed(3)}  Fark: ${(favContrib-winnerContrib).toFixed(3)}`);

    // Q4: DAV ablasyonu (TUM atlardan DAV+yarisi-TMP_DAV_01 cikar, yeniden softmax)
    const adjScores = explains.map((e) => {
      let dav = 0;
      for (const r of e.rows) {
        if (!trainedCodes.has(r.code)) continue;
        const contrib = r.scoreContribution + r.missingIndicatorContribution;
        if (r.code === "DAV_TAKI_EKLENDI" || r.code === "DAV_TAKI_CIKARILDI") dav += contrib;
        else if (r.code === "TMP_DAV_01") dav += contrib / 2;
      }
      return e.totalScore - dav;
    });
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const adjWinnerRank = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`Q4 DAV CIKARILINCA (aritmetik, GERCEK anlik-tahmin DEGIL — yeniden egitim yok): Kazanan sirasi ${winIdx>=0?ranked.findIndex(r=>r.no===race.winnerNo)+1:"?"}.→${adjWinnerRank}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}→%${(adjProbs[winIdx]*100).toFixed(2)}`);

    // Q5: tani
    let tani: string;
    if (!liveWinner.backfilled && winnerDavRaw.some(s=>s.observed)) tani = "SAHTE TAKI VERISI (eski onbellekte 'gozlemli' gorunen deger, guncel kodla backfill-bosluk oldugu dogrulandi — equipment o yarista HIC kayitli degil)";
    else if (Math.abs(favContrib - winnerContrib) > 1.5 && liveFav.backfilled && liveWinner.backfilled) tani = "ASIRI SKOR KATKISI (equipment verisi GERCEK/backfill'li ama DAV'in katsayisi/agirligi orantisiz buyuk)";
    else if (adjWinnerRank === (ranked.findIndex(r=>r.no===race.winnerNo)+1)) tani = "BASKA AILELER (DAV cikarilsa da kazananin sirasi degismiyor — DAV tek basina belirleyici degil)";
    else tani = "KARMA (hem veri hem agirlik hem baska aileler birlikte etkili)";
    console.log(`Q5 TANI: ${tani}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
