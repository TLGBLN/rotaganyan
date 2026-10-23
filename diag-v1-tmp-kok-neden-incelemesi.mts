// ROTAGANYAN V1.0 — TMP AILESI (TEMPO_01-04, KULVAR_01_HAM) KOK NEDEN INCELEMESI (SALT-OKUNUR).
// Kullanici talimati (2026-10-23): TMP'nin 4 TEMPO kodu AYNI styleVector kaynagindan
// turuyor (dosya ici yorum: "DORT BAGIMSIZ OY degil, TEK korelasyonlu bilgi kumesi") —
// bu yuzden her kodun kendi katkisi AYRI AYRI gosterilir (tekrarli-bilgi riskini gormek
// icin). KULVAR_01_HAM bagimsiz (start-pozisyonu, stilden BAGIMSIZ). Iliskisel kodlar
// (TMP_DAV_01, RAK_YET_TMP_01) esit-bolustur (1/2, 1/3) ile cift sayilmadan dahil edilir.
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
const TEMPO_CODES = ["TEMPO_01", "TEMPO_02", "TEMPO_03", "TEMPO_04"];

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);
  const allIds = Object.keys(cache);
  const matched = RACE_PREFIXES_15.map((p) => allIds.find((id) => id.startsWith(p))!).filter(Boolean);

  function tmpBreakdown(fv: RunnerFeatureVector) {
    const { rows } = explainRunner(fv, model);
    const perCode: Record<string, { raw: number | null; obs: boolean; contrib: number }> = {};
    let total = 0;
    for (const code of [...TEMPO_CODES, "KULVAR_01_HAM"]) {
      const r = rows.find((x) => x.code === code);
      const c = r ? r.scoreContribution + r.missingIndicatorContribution : 0;
      perCode[code] = { raw: r?.rawValue ?? null, obs: !!r?.observed, contrib: c };
      total += c;
    }
    for (const r of rows) {
      if (!trainedCodes.has(r.code)) continue;
      const contrib = r.scoreContribution + r.missingIndicatorContribution;
      if (r.code === "TMP_DAV_01") total += contrib / 2;
      else if (r.code === "RAK_YET_TMP_01") total += contrib / 3;
    }
    return { perCode, total };
  }

  const summary: { raceId: string; winnerName: string; totalFark: number; aynıYonSayisi: number }[] = [];

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
    const isKati = raceId.startsWith("cmrpxdmb");
    const winnerTmp = tmpBreakdown(vectors[winIdx]);
    const favTmp = tmpBreakdown(vectors[favIdx]);

    console.log(`\n========== ${race.date.slice(0,10)} ${raceId.slice(0,8)} [${set}]${isKati ? " *** KATI ZAMANI/KARIZMATIK ***" : ""} ==========`);
    console.log(`Kazanan: ${race.runners.find((r)=>r.no===race.winnerNo)?.name}(#${race.winnerNo})  Yanlis favori: ${fav.name}(#${fav.no})`);
    for (const code of [...TEMPO_CODES, "KULVAR_01_HAM"]) {
      const w = winnerTmp.perCode[code], f = favTmp.perCode[code];
      console.log(`  ${code}: Kazanan ham=${w.obs ? w.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${w.contrib.toFixed(3)}  |  Favori ham=${f.obs ? f.raw!.toFixed(3) : "GOZLEMSIZ"} katki=${f.contrib.toFixed(3)}`);
    }
    const fark = favTmp.total - winnerTmp.total;
    console.log(`  TOPLAM TMP katki — Kazanan: ${winnerTmp.total.toFixed(3)}  Favori: ${favTmp.total.toFixed(3)}  Fark: ${fark.toFixed(3)}`);

    // Tekrarli-bilgi testi: TEMPO_01-04'un favori-kazanan farklari AYNI YONDE mi?
    const tempoFarklari = TEMPO_CODES.map((c) => favTmp.perCode[c].contrib - winnerTmp.perCode[c].contrib);
    const pozitifSayisi = tempoFarklari.filter((x) => x > 0.01).length;
    const negatifSayisi = tempoFarklari.filter((x) => x < -0.01).length;
    const aynıYonMu = pozitifSayisi >= 3 || negatifSayisi >= 3;
    console.log(`  Tekrarli-bilgi kontrolu: TEMPO_01-04 farklari = [${tempoFarklari.map((x)=>x.toFixed(2)).join(", ")}] -> ${aynıYonMu ? `AYNI YONDE (${pozitifSayisi} pozitif, ${negatifSayisi} negatif) — 4 kod BIRLIKTE tek bir sinyali tekrarliyor olabilir` : "KARISIK yonlerde — tekrar riski bu yariste belirgin degil"}`);

    // Ablasyon: TMP toplamini TUM atlardan cikar
    const adjScores = explains.map((e, i) => {
      if (i === winIdx) return e.totalScore - winnerTmp.total;
      if (i === favIdx) return e.totalScore - favTmp.total;
      return e.totalScore; // digerleri icin basitlik: yalniz kazanan/favori ayarlanir (rapor amacli)
    });
    // NOT: tam ablasyon icin TUM atlarin TMP'si cikarilmali; burada kazanan/favori disindakiler
    // SABIT kalir (onceki DAV/GEN scriptleriyle AYNI basitlestirme, raporda acikca belirtilir).
    const adjProbs = softmax(adjScores);
    const adjRanked = vectors.map((v, i) => ({ no: v.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
    const winnerRankNew = adjRanked.findIndex((r) => r.no === race.winnerNo) + 1;
    console.log(`  TMP CIKARILINCA (yalniz K/F ayarlandi, digerleri SABIT): Sira ${winnerRankOld}.->${winnerRankNew}.  Olasilik %${(probs[winIdx]*100).toFixed(2)}->%${(adjProbs[winIdx]*100).toFixed(2)}`);

    let tani: string;
    if (Math.abs(fark) < 0.1) tani = "TMP bu yariste ETKISIZ";
    else if (aynıYonMu && Math.abs(fark) > 0.5) tani = "TEKRARLI BILGI + buyuk fark: 4 TEMPO kodu AYNI yonde birikerek fark yaratiyor";
    else if (Math.abs(fark) > 0.5) tani = "BUYUK FARK ama tekrarli degil — tek bir TEMPO kodu veya KULVAR dominant";
    else tani = "KUCUK ETKI";
    console.log(`  TANI: ${tani}`);

    summary.push({ raceId, winnerName: race.runners.find((r)=>r.no===race.winnerNo)?.name ?? "?", totalFark: fark, aynıYonSayisi: Math.max(pozitifSayisi, negatifSayisi) });
  }

  console.log(`\n\n=== OZET (15 yaris) ===`);
  const buyukEtkililer = summary.filter((s) => Math.abs(s.totalFark) > 0.5);
  console.log(`|TMP farki|>0.5 olan yaris sayisi: ${buyukEtkililer.length}/15`);
  console.log(`Bunlardan tekrarli-bilgi deseni gosterenler (>=3/4 TEMPO kodu ayni yonde): ${buyukEtkililer.filter((s)=>s.aynıYonSayisi>=3).length}`);

  console.log(`\nKARSILASTIRMA (FARKLI METODOLOJI, AYNI OLCUT GIBI SUNULMUYOR):`);
  console.log(`  Onceki FAZ3 (genis kapsam: TMP + iki iliskisel kodun TAM katkisi, bolusturmesiz) HOLDOUT+EK(138) ΔLL = -0.0653 (TMP ablasyonu LogLoss'u IYILESTIRIYOR = o genis tanımla TMP NET ZARARLI)`);
  console.log(`  Bu yeni 15-yaris incelemesi: DAR tanım (TMP dogrudan + esit-bolusturulmus 2 iliski), yalniz en kotu 15 yariste nokta-bazli etki — GENELLENEMEZ, FAZ3'un 138-yarislik ortalamasiyla DOGRUDAN KARSILASTIRILAMAZ (farkli kapsam + farkli orneklem).`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
