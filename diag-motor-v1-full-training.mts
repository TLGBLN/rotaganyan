// READ-ONLY (modeli DISKE yazar, DB'ye yazmaz). ROTAGANYAN ANALIZ MOTORU V1.0 — GERCEK EGITIM.
// Kullanici talimati (2026-10-20, "EGITIMI BASLAT" + "Katsayilar nasil ogrenilecek"):
// - Aile AGIRLIKLARI elle verilmez; her alt-sinyalin kendi beta'si ogrenilir.
// - AGF/ganyan hicbir kodda yok (FULL_CANDIDATE_CODES'ta zaten yok).
// - PIST_DURUM_01/DAV_START_RISK/TMP_DAV_KULVAR_01 EGITIME HIC GIRMEZ (trainable-features.ts
//   bu kodlari hesaplamiyor bile).
// - Dusuk-kapsamli kodlar ZORLA eklenmez: train setindeki GERCEK gozlem oranina gore
//   filtrelenir (tek-lambda ridge disinda, mevcut mimariyi DEGISTIRMEDEN).
// - lambda=DEFAULT_FIT_OPTIONS (1), bu holdout'a BAKILARAK SECILMEDI.
// - Aile katkisi: dogrudan beta'lar + ablation (aile cikarilinca holdout LogLoss/Top1/Top3
//   nasil degisiyor).
import fs from "node:fs";
import { computeFeatureStats, fitModel, scoreRace, explainRunner, DEFAULT_FIT_OPTIONS, MODEL_VERSION as BASE_MODEL_VERSION, type TrainingRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { FULL_CANDIDATE_CODES, type FullCandidateCode, type TrainableRaceResult } from "./src/lib/motor-v1/engine/trainable-features";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";

const MIN_OBSERVED_RATE = 0.15; // GECICI, kullanici ayarlamadi - mevcut proje normlariyla (shrinkage k~8-15, MIN_GUVENILIR_START=5) TUTARLI bir taban. Bunun ALTINDAKI kodlar egitime ALINMAZ.

// Kullanici talimati (2026-10-20, "HIZLI VE GUVENILIR KATSAYI EGITIMI"): "yalniz birkac
// ONCEDEN BELIRLENMIS duzenlilestirme degerini karsilastiralim" - ARAMA/TUNING degil, kucuk
// SABIT bir kume. 1.0 mevcut onaylanmis DEFAULT_FIT_OPTIONS'tir (holdout'a bakilarak
// SECILMEMISTI) - 0.5/2.0 simetrik duyarlilik kontrolu icin EKLENDI, holdout sonucuna gore
// SONRADAN baska bir deger EKLENMEDI/DENENMEDI.
const LAMBDA_GRID = [0.5, 1, 2] as const;
const PRIMARY_LAMBDA = 1; // nihai/"birincil" model - degismedi, mevcut onayli deger

/** Egitim setindeki (HOLDOUT DEGIL) standartlastirilmis z-degerleri uzerinden basit pairwise
 *  Pearson korelasyonu - "cift sayim/asiri korelasyon" denetimi (kullanici talimati). Yeni bir
 *  VIF/collinearity altyapisi KURULMADI - mevcut mimariye en ucuz, en dogrulanabilir ek. */
function pearson(a: number[], b: number[]): number {
  const n = a.length;
  const ma = a.reduce((s, x) => s + x, 0) / n, mb = b.reduce((s, x) => s + x, 0) / n;
  let num = 0, da = 0, db = 0;
  for (let i = 0; i < n; i++) { const xa = a[i] - ma, xb = b[i] - mb; num += xa * xb; da += xa * xa; db += xb * xb; }
  const denom = Math.sqrt(da * db);
  return denom > 0 ? num / denom : 0;
}

const FAMILY_OF: Record<string, string> = {
  GEN_SIRE_01: "GEN", GEN_DAM_01: "GEN", GEN_DAMSIRE_01: "GEN", GEN_SIRE_PMZ_01: "GEN",
  HIZ_01: "YET", SINIF_01: "YET",
  FORM_01: "FRM", FORM_02: "FRM", FORM_03: "FRM", IDMAN_01: "FRM",
  PMZ_01: "PMZ", PMZ_02: "PMZ", FORM_x_ZEMIN: "PMZ",
  TEMPO_01: "TMP", TEMPO_02: "TMP", TEMPO_03: "TMP", TEMPO_04: "TMP", KULVAR_01_HAM: "TMP",
  JOKEY_01: "JOK", JOKEY_02: "JOK", JOKEY_03: "JOK", JOKEY_04: "JOK", JOKEY_TREND30: "JOK",
  ANT_TREND30: "ANT",
  KILO_01: "KIL", KILO_02: "KIL", KILO_03: "KIL", KILO_04: "KIL",
  DAV_TAKI_EKLENDI: "DAV", DAV_TAKI_CIKARILDI: "DAV",
  RAK_H2H_01: "RAK", RAK_GAP_01: "RAK",
  GEN_PMZ_YET_01: "INTERACTION", YET_PMZ_01: "INTERACTION", FRM_GEN_01: "INTERACTION",
  FRM_IDMAN_DINLENME_01: "INTERACTION", JOK_FRM_TMP_01: "INTERACTION", ANT_FRM_01: "INTERACTION",
  TMP_DAV_01: "INTERACTION", FRM_GALOP_ANT_01: "INTERACTION", YET_PMZ_RAK_01: "INTERACTION",
  KIL_PMZ_YET_01: "INTERACTION", RAK_YET_TMP_01: "INTERACTION", TMP_KULVAR_01: "INTERACTION",
};
const FAMILIES = ["GEN", "YET", "FRM", "PMZ", "TMP", "JOK", "ANT", "KIL", "DAV", "RAK"] as const;

function toTrainingRaces(cache: Record<string, TrainableRaceResult>, raceIds: string[]): TrainingRace[] {
  return raceIds.filter((id) => cache[id]).map((id) => {
    const r = cache[id];
    const vectors: RunnerFeatureVector[] = r.runners.map((rr) => ({ raceId: id, no: rr.no, name: rr.name, tjkAtId: null, jockey: null, signals: rr.vectors }));
    return { raceId: id, date: new Date(r.date), vectors, winnerNo: r.winnerNo };
  });
}

function top1(s: { no: number; probability: number }[], w: number | null) { if (w == null || s.length === 0) return false; return [...s].sort((a, b) => b.probability - a.probability)[0].no === w; }
function top3(s: { no: number; probability: number }[], w: number | null) { if (w == null) return false; return [...s].sort((a, b) => b.probability - a.probability).slice(0, 3).some((x) => x.no === w); }
function winP(s: { no: number; probability: number }[], w: number | null) { return w == null ? null : s.find((x) => x.no === w)?.probability ?? null; }
function logLoss(probs: (number | null)[]) { const p = probs.filter((x): x is number => x != null && x > 0); return p.length ? -p.reduce((s, x) => s + Math.log(x), 0) / p.length : null; }

function evaluate(testSet: TrainingRace[], model: FittedModel<string>) {
  const wp: (number | null)[] = []; let t1 = 0, t3 = 0;
  for (const t of testSet) {
    const s = scoreRace(t.vectors, model);
    if (top1(s, t.winnerNo)) t1++;
    if (top3(s, t.winnerNo)) t3++;
    wp.push(winP(s, t.winnerNo));
  }
  return { n: testSet.length, top1: t1 / testSet.length, top3: t3 / testSet.length, logLoss: logLoss(wp) };
}

async function main() {
  // 2026-10-20 kullanici karari: GENISLEME YOK - YALNIZ mevcut 150 yarisin (120 train + 30
  // holdout, AYNI kilitli bolunme) eksik alanlari dolduruldu. Holdout bu yuzden "ILK KONTROL"
  // statusunu korur (daha once defalarca incelenmis) - bagimsiz nihai test OLARAK SUNULMAZ.
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const fullCache = JSON.parse(fs.readFileSync("C:/tmp/existing-150-full-feature-cache.json", "utf8")) as Record<string, TrainableRaceResult>;
  const trainSet = toTrainingRaces(fullCache, lock.trainRaceIds);
  const holdoutSet = toTrainingRaces(fullCache, lock.holdoutRaceIds);
  console.log(`TRAIN: ${trainSet.length}/${lock.trainRaceIds.length} yaris (${trainSet[0]?.date.toISOString().slice(0,10)} .. ${trainSet[trainSet.length-1]?.date.toISOString().slice(0,10)})`);
  console.log(`HOLDOUT: ${holdoutSet.length}/${lock.holdoutRaceIds.length} yaris — ILK KONTROL, bagimsiz nihai test DEGIL (${holdoutSet[0]?.date.toISOString().slice(0,10)} .. ${holdoutSet[holdoutSet.length-1]?.date.toISOString().slice(0,10)})`);

  // --- Kapsam olcumu (TRAIN uzerinde, holdout'a HIC bakilmadan) ---
  const trainVectorsFlat = trainSet.flatMap((t) => t.vectors);
  const coverage = new Map<string, number>();
  for (const code of FULL_CANDIDATE_CODES) {
    const observed = trainVectorsFlat.filter((v) => v.signals.find((s) => s.code === code)?.observed).length;
    coverage.set(code, trainVectorsFlat.length > 0 ? observed / trainVectorsFlat.length : 0);
  }
  const finalCodes = FULL_CANDIDATE_CODES.filter((c) => (coverage.get(c) ?? 0) >= MIN_OBSERVED_RATE);
  const excludedCodes = FULL_CANDIDATE_CODES.filter((c) => (coverage.get(c) ?? 0) < MIN_OBSERVED_RATE);
  console.log(`\nKapsam esigi: >=${MIN_OBSERVED_RATE*100}% gozlem (train, n=${trainVectorsFlat.length} at-satiri, ${trainSet.length} yaris)`);
  console.log(`Egitime ALINAN kod sayisi: ${finalCodes.length}/${FULL_CANDIDATE_CODES.length}`);
  console.log(`DISARIDA KALAN (yetersiz kapsam): ${excludedCodes.map((c) => `${c}(${(coverage.get(c)!*100).toFixed(1)}%)`).join(", ") || "yok"}`);

  // --- Cift-sayim/asiri-korelasyon denetimi (TRAIN z-degerleri uzerinde) ---
  const statsForCorr = computeFeatureStats(trainVectorsFlat, finalCodes);
  const zByCode = new Map<string, number[]>();
  for (const code of finalCodes) {
    const { mu, sigma } = statsForCorr.get(code)!;
    const zs = trainVectorsFlat.map((v) => {
      const s = v.signals.find((x) => x.code === code);
      return s?.observed && s.rawValue != null ? (s.rawValue - mu) / (sigma || 1) : null;
    }).filter((z): z is number => z != null);
    zByCode.set(code, zs);
  }
  const highCorrPairs: { a: string; b: string; r: number }[] = [];
  for (let i = 0; i < finalCodes.length; i++) {
    for (let j = i + 1; j < finalCodes.length; j++) {
      const a = finalCodes[i], b = finalCodes[j];
      const za = zByCode.get(a)!, zb = zByCode.get(b)!;
      const n = Math.min(za.length, zb.length);
      if (n < 20) continue;
      const r = pearson(za.slice(0, n), zb.slice(0, n));
      if (Math.abs(r) >= 0.7) highCorrPairs.push({ a, b, r });
    }
  }
  highCorrPairs.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  console.log(`\nYUKSEK KORELASYON (|r|>=0.7, cift-sayim riski): ${highCorrPairs.length} cift`);
  for (const p of highCorrPairs.slice(0, 15)) console.log(`  ${p.a} <-> ${p.b}: r=${p.r.toFixed(3)}`);

  // --- Egitim: ONCEDEN BELIRLENMIS kucuk lambda kumesi (ARAMA degil, kullanici talimati) ---
  const lambdaResults: Record<number, ReturnType<typeof evaluate>> = {};
  const modelsByLambda: Record<number, FittedModel<string>> = {};
  for (const lambda of LAMBDA_GRID) {
    const stats = computeFeatureStats(trainVectorsFlat, finalCodes);
    const m = fitModel(trainSet, stats, { ...DEFAULT_FIT_OPTIONS, lambda });
    modelsByLambda[lambda] = m;
    lambdaResults[lambda] = evaluate(holdoutSet, m);
    console.log(`lambda=${lambda}: top1=${(lambdaResults[lambda].top1*100).toFixed(1)}% top3=${(lambdaResults[lambda].top3*100).toFixed(1)}% logLoss=${lambdaResults[lambda].logLoss?.toFixed(4)}`);
  }
  const model = modelsByLambda[PRIMARY_LAMBDA];
  const modelVersion = "rotaganyan-v1.0-full-family-2026-10-20";
  console.log(`\nBIRINCIL MODEL (lambda=${PRIMARY_LAMBDA}, onceden onayli, holdout'a bakilarak SECILMEDI): ${modelVersion}`);
  console.log(`nRacesUsed=${model.nRacesUsed}, nRacesSkipped=${model.nRacesSkipped}, kod sayisi=${model.stats.size}`);

  const full = lambdaResults[PRIMARY_LAMBDA];
  console.log(`\nHOLDOUT SONUC (birincil, lambda=${PRIMARY_LAMBDA}): top1=${(full.top1*100).toFixed(1)}% top3=${(full.top3*100).toFixed(1)}% logLoss=${full.logLoss?.toFixed(4)}`);

  // --- Aile raporu: beta'lar + kapsam ---
  const familyReport: Record<string, unknown> = {};
  for (const fam of FAMILIES) {
    const famCodes = finalCodes.filter((c) => FAMILY_OF[c] === fam);
    const betas = famCodes.map((code) => {
      const idx = model.names.indexOf(`${code}_z` as never);
      return { code, beta_z: model.beta[idx], observedRate: coverage.get(code) };
    });
    familyReport[fam] = { trainedFeatureCount: famCodes.length, betas, excludedFromThisFamily: excludedCodes.filter((c) => FAMILY_OF[c] === fam) };
  }

  // --- Ablation: her aile icin, o ailenin kodlarini CIKARIP yeniden egit, holdout farki olc ---
  console.log(`\n=== AILE ABLATION (aile cikarilinca holdout nasil degisiyor) ===`);
  const ablationReport: Record<string, unknown> = {};
  for (const fam of FAMILIES) {
    const withoutFamCodes = finalCodes.filter((c) => FAMILY_OF[c] !== fam);
    if (withoutFamCodes.length === finalCodes.length) {
      ablationReport[fam] = { not_trained_in_full_model: true };
      console.log(`${fam}: egitimli kodu yok, ablation atlandi`);
      continue;
    }
    const statsAbl = computeFeatureStats(trainVectorsFlat, withoutFamCodes);
    const modelAbl = fitModel(trainSet, statsAbl, DEFAULT_FIT_OPTIONS);
    const ablEval = evaluate(holdoutSet, modelAbl);
    const delta = { top1: full.top1 - ablEval.top1, top3: full.top3 - ablEval.top3, logLoss: ablEval.logLoss != null && full.logLoss != null ? ablEval.logLoss - full.logLoss : null };
    ablationReport[fam] = { withoutFamily: ablEval, delta };
    console.log(`${fam} CIKARILINCA: top1=${(ablEval.top1*100).toFixed(1)}% (Δ${(delta.top1*100).toFixed(1)}pp) top3=${(ablEval.top3*100).toFixed(1)}% (Δ${(delta.top3*100).toFixed(1)}pp) logLoss=${ablEval.logLoss?.toFixed(4)} (Δ${delta.logLoss?.toFixed(4)})`);
  }

  // --- Interactions ayri rapor (FAMILY_OF'ta "INTERACTION" olanlar) ---
  const interactionCodes = finalCodes.filter((c) => FAMILY_OF[c] === "INTERACTION");
  const interactionBetas = interactionCodes.map((code) => {
    const idx = model.names.indexOf(`${code}_z` as never);
    return { code, beta_z: model.beta[idx], observedRate: coverage.get(code) };
  });

  const artifact = {
    modelVersion, baseEngineVersion: BASE_MODEL_VERSION,
    trainDateRange: [trainSet[0]?.date.toISOString(), trainSet[trainSet.length-1]?.date.toISOString()],
    holdoutDateRange: [holdoutSet[0]?.date.toISOString(), holdoutSet[holdoutSet.length-1]?.date.toISOString()],
    nTrainRaces: trainSet.length, nTrainRunners: trainVectorsFlat.length,
    nHoldoutRaces: holdoutSet.length, nHoldoutRunners: holdoutSet.flatMap((t) => t.vectors).length,
    lambdaGrid: LAMBDA_GRID, primaryLambda: PRIMARY_LAMBDA, lambdaResults,
    highCorrelationPairs: highCorrPairs,
    fitOpts: { ...DEFAULT_FIT_OPTIONS, lambda: PRIMARY_LAMBDA },
    candidateCodeCount: FULL_CANDIDATE_CODES.length,
    trainedCodeCount: finalCodes.length,
    excludedCodes: excludedCodes.map((c) => ({ code: c, observedRate: coverage.get(c) })),
    trainedCodes: finalCodes,
    coverageByCode: Object.fromEntries(FULL_CANDIDATE_CODES.map((c) => [c, coverage.get(c)])),
    beta: model.beta, names: model.names,
    muSigma: Object.fromEntries([...model.stats.entries()].map(([k, v]) => [k, v])),
    holdoutResult: full,
    familyReport,
    interactionBetas,
    ablationReport,
  };
  fs.writeFileSync("C:/tmp/rotaganyan-v1-full-training-artifact.json", JSON.stringify(artifact, null, 2));
  console.log(`\nArtefakt yazildi: C:/tmp/rotaganyan-v1-full-training-artifact.json`);

  // --- ONCEKI (24-ozellikli "ilk egitim") artefaktla FARK (kullanici talimati) ---
  try {
    const prev = JSON.parse(fs.readFileSync("C:/tmp/rotaganyan-v1-ilk-egitim-artifact.json", "utf8"));
    const prevCodes = new Set(prev.trainedCodes as string[]);
    const newlyTrained = finalCodes.filter((c) => !prevCodes.has(c));
    const stillMissing = (prev.codesWithNoDataInThisCache as string[]).filter((c) => !finalCodes.includes(c));
    console.log(`\n=== ONCEKI ARTEFAKTLA FARK ===`);
    console.log(`Onceki egitilen kod sayisi: ${prevCodes.size} -> Yeni: ${finalCodes.length}`);
    console.log(`YENI olarak egitime giren kodlar (${newlyTrained.length}): ${JSON.stringify(newlyTrained)}`);
    console.log(`Hala egitilemeyen (bu 150 yariste de yetersiz kapsamli) kodlar (${stillMissing.length}): ${JSON.stringify(stillMissing)}`);
    console.log(`Onceki holdout: top1=${(prev.holdoutResult.top1*100).toFixed(1)}% top3=${(prev.holdoutResult.top3*100).toFixed(1)}% logLoss=${prev.holdoutResult.logLoss?.toFixed(4)}`);
    console.log(`Yeni    holdout: top1=${(full.top1*100).toFixed(1)}% top3=${(full.top3*100).toFixed(1)}% logLoss=${full.logLoss?.toFixed(4)}`);
  } catch (e) {
    console.log(`\n(Onceki artefakt karsilastirmasi atlandi: ${(e as Error).message})`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
