// ROTAGANYAN V1.0 — KOSULA UYARLANMIS HIYERARSIK MODEL: GEN+DAV duzeltmeli TRAIN(120)
// uzerinde basit KRONOLOJIK CV ile lambda sec, tam TRAIN(120)'de yeniden egit, HOLDOUT(30)
// uzerinde mevcut (production) V1.0 ile Top-1/Top-3/LogLoss/kalibrasyon karsilastir.
// Kullanici talimati (2026-10-22): "Artik plan degil, calisan model ve olculmus sonuc
// istiyorum." CV/duzenlilestirme BASIT tutuldu, ayri arastirma projesine donusturulmedi.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { computeFeatureStats, scoreRace, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { fitConditionalLogitHierarchical, KOSUL_KATEGORILERI, kosulKategorisiCoz, isIkiliKod, turetZCap, zKirp, type KosulKategorisi } from "./src/lib/motor-v1/engine/hierarchical-fit";
import { dot } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";
import type { TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

const FAMILY_DIRECT_CODES: Record<string, string[]> = {
  GEN: ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"],
  YET: ["HIZ_01", "SINIF_01"],
  FRM: ["FORM_01", "FORM_02", "FORM_03"],
  PMZ: ["PMZ_01", "PMZ_02", "FORM_x_ZEMIN"],
  TMP: ["TEMPO_01", "TEMPO_02", "TEMPO_03", "TEMPO_04", "KULVAR_01_HAM"],
  JOK: ["JOKEY_01", "JOKEY_02", "JOKEY_04", "JOKEY_TREND30"],
  ANT: ["ANT_TREND30"],
  KIL: ["KILO_01", "KILO_02", "KILO_03", "KILO_04"],
  DAV: ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"],
  RAK: ["RAK_H2H_01", "RAK_GAP_01"],
};
const FAMILIES = Object.keys(FAMILY_DIRECT_CODES);

function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const fixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-fixed-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const currentModel = loadTrainedV1Model();
  const codes = [...currentModel.stats.keys()];

  const metas = await db.race.findMany({
    where: { id: { in: [...lock.trainRaceIds, ...lock.holdoutRaceIds] } },
    select: { id: true, classType: true },
  });
  const kosulById = new Map(metas.map((m) => [m.id, kosulKategorisiCoz(m.classType)]));

  const trainRacesRaw = lock.trainRaceIds.map((id) => fixedCache[id]).filter((r): r is CacheRace => !!r);
  const holdoutRacesRaw = lock.holdoutRaceIds.map((id) => fixedCache[id]).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN (GEN/DAV duzeltmeli): ${trainRacesRaw.length}/${lock.trainRaceIds.length}`);
  console.log(`HOLDOUT (GEN/DAV duzeltmeli): ${holdoutRacesRaw.length}/${lock.holdoutRaceIds.length}`);

  type StatsMap = Map<string, { mu: number; sigma: number; nObserved: number }>;

  // --- yardimci: verilen yaris kumesi + stats + zCap ile ozellik vektoru insasi ---
  function buildFeatures(stats: StatsMap, ikiliKodlar: Set<string>, zCap: number, fv: RunnerFeatureVector, kosul: KosulKategorisi): number[] {
    const vec: number[] = [];
    const zOf = (code: string, rawValue: number): number => {
      const st = stats.get(code as never)!;
      const zHam = (rawValue - st.mu) / (st.sigma || 1);
      return zKirp(zHam, code, ikiliKodlar.has(code), zCap);
    };
    for (const code of codes) {
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null;
      vec.push(observed ? zOf(code, s!.rawValue!) : 0);
    }
    for (const fam of FAMILIES) {
      for (const k of KOSUL_KATEGORILERI) {
        if (k !== kosul) { vec.push(0); continue; }
        let toplam = 0;
        for (const code of FAMILY_DIRECT_CODES[fam]) {
          const s = fv.signals.find((x) => x.code === code);
          if (!s || !s.observed || s.rawValue == null) continue;
          toplam += zOf(code, s.rawValue);
        }
        vec.push(toplam);
      }
    }
    return vec;
  }

  function computeStatsAndCap(racesSubset: CacheRace[]): { stats: StatsMap; zCap: number; ikiliKodlar: Set<string> } {
    const vectorsAll: RunnerFeatureVector[] = racesSubset.flatMap((race) =>
      race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }))
    );
    const stats = computeFeatureStats(vectorsAll, codes as never) as unknown as StatsMap;
    const rawByCode = new Map<string, number[]>();
    for (const code of codes) rawByCode.set(code, []);
    for (const fv of vectorsAll) {
      for (const code of codes) {
        const s = fv.signals.find((x) => x.code === code);
        if (s?.observed && s.rawValue != null) rawByCode.get(code)!.push(s.rawValue);
      }
    }
    const zCap = turetZCap(rawByCode);
    const ikiliKodlar = new Set(codes.filter((c) => isIkiliKod(rawByCode.get(c) ?? [])));
    return { stats, zCap, ikiliKodlar };
  }

  function toTrainingRunners(racesSubset: CacheRace[], stats: StatsMap, ikiliKodlar: Set<string>, zCap: number): TrainingRunner[][] {
    const races: TrainingRunner[][] = [];
    for (const race of racesSubset) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const kosul = kosulById.get(race.raceId) ?? "DİĞER";
      const runners: TrainingRunner[] = race.runners.map((r) => {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildFeatures(stats, ikiliKodlar, zCap, fv, kosul) };
      });
      if (runners.some((r) => r.winner)) races.push(runners);
    }
    return races;
  }

  function evalLogLossTop1Top3(races: TrainingRunner[][], beta: number[]): { ll: number; top1: number; top3: number; n: number; probs: number[] } {
    let ll = 0, top1 = 0, top3 = 0, n = 0;
    const probs: number[] = [];
    for (const race of races) {
      const scores = race.map((r) => dot(r.features, beta));
      const p = softmax(scores);
      const winIdx = race.findIndex((r) => r.winner);
      if (winIdx < 0) continue;
      const ranked = [...p.keys()].sort((a, b) => p[b] - p[a]);
      ll += logLoss(p[winIdx]);
      if (ranked[0] === winIdx) top1++;
      if (ranked.slice(0, 3).includes(winIdx)) top3++;
      n++;
      probs.push(...p);
    }
    return { ll: ll / n, top1: top1 / n, top3: top3 / n, n, probs };
  }

  // ====== ADIM 1: KRONOLOJIK CV ICINDE TRAIN(120) — lambda secimi ======
  const trainSorted = [...trainRacesRaw].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2); // 24
  const cvFitRaces = trainSorted.slice(0, trainSorted.length - cvValSize); // 96, KRONOLOJIK ONCEKI
  const cvValRaces = trainSorted.slice(trainSorted.length - cvValSize); // 24, KRONOLOJIK SONRAKI
  console.log(`\nCV: fit=${cvFitRaces.length} (${cvFitRaces[0]?.date}..${cvFitRaces[cvFitRaces.length-1]?.date}), val=${cvValRaces.length} (${cvValRaces[0]?.date}..${cvValRaces[cvValRaces.length-1]?.date})`);

  const { stats: cvStats, zCap: cvZCap, ikiliKodlar: cvIkili } = computeStatsAndCap(cvFitRaces); // YALNIZ cv-fit'ten
  const cvFitTR = toTrainingRunners(cvFitRaces, cvStats, cvIkili, cvZCap);
  const cvValTR = toTrainingRunners(cvValRaces, cvStats, cvIkili, cvZCap); // AYNI (cv-fit) stats/zCap uygulanir

  const interactionNames: string[] = [];
  for (const fam of FAMILIES) for (const kosul of KOSUL_KATEGORILERI) interactionNames.push(`${fam}__${kosul}`);
  const featureCount = codes.length + interactionNames.length;

  // TASARIM DUZELTMESI (kullanicinin onaylanmis mimarisi: "Orijinal 38 sutun, mevcut
  // beta'lara (prior) hafif bir lambda_temel ile cekilir" — prior=0 DEGIL). Mevcut
  // production artefaktinin 76-uzunluklu beta'si [kod1_z, kod1_missing, kod2_z, ...]
  // sirasinda — z-katsayilarini (cift indeksler) codes ile AYNI sirada cikariyoruz.
  //
  // 2. DUZELTME (ilk denemede HOLDOUT LogLoss daha da kotulestigi icin bulundu): bu
  // ankraj SADECE standardizasyonu DEGISMEMIS 32 kod icin gecerli. GEN_* (4 kod) ve
  // DAV_* (2 kod) icin production beta'si, TAM OLARAK duzelttigimiz kirli/bozuk veri
  // uzerinde ogrenildi (GEN: atin kendi kazanclari sizan bir sinyal; DAV: %77 "sahte
  // cikarildi=1" uzerinde ogrenilen, pratikte gurultu bir katsayi). Bu iki aileyi eski
  // beta'ya cekmek, duzelttigimiz seyi tekrar ice sizdirmak olur — bu 6 kod icin
  // prior=0 (yeni ailelerle AYNI muamele) kullanilir.
  const PRIOR_ZERO_CODES = new Set(["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01", "DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"]);
  const productionZBeta: number[] = codes.map((code, i) => PRIOR_ZERO_CODES.has(code) ? 0 : (currentModel.beta[2 * i] ?? 0));
  const basePriorVector = [...productionZBeta, ...interactionNames.map(() => 0)];

  const lambdaTemelGrid = [0.5, 1, 2];
  const lambdaEtkilesimGrid = [4, 8, 16, 32];
  let best = { lt: 1, le: 8, valLL: Infinity };
  console.log(`\n=== Kronolojik CV grid (${lambdaTemelGrid.length}x${lambdaEtkilesimGrid.length}=${lambdaTemelGrid.length*lambdaEtkilesimGrid.length} kombinasyon) ===`);
  for (const lt of lambdaTemelGrid) {
    for (const le of lambdaEtkilesimGrid) {
      const lambdaVector = codes.map(() => lt).concat(interactionNames.map(() => le));
      const beta = fitConditionalLogitHierarchical(cvFitTR, featureCount, { lambdaVector, priorVector: basePriorVector, learningRate: 0.05, iterations: 300 });
      const valRes = evalLogLossTop1Top3(cvValTR, beta);
      console.log(`  lambda_temel=${lt} lambda_etkilesim=${le}: val LogLoss=${valRes.ll.toFixed(4)} Top1=%${(valRes.top1*100).toFixed(1)} Top3=%${(valRes.top3*100).toFixed(1)} (n=${valRes.n})`);
      if (valRes.ll < best.valLL) best = { lt, le, valLL: valRes.ll };
    }
  }
  console.log(`\nSECILEN: lambda_temel=${best.lt} lambda_etkilesim=${best.le} (val LogLoss=${best.valLL.toFixed(4)})`);

  // ====== ADIM 2: TAM TRAIN(120) UZERINDE YENIDEN EGITIM (secilen lambda) ======
  const { stats: fullStats, zCap: fullZCap, ikiliKodlar: fullIkili } = computeStatsAndCap(trainRacesRaw);
  console.log(`\nTAM TRAIN Z_CAP: ${fullZCap}, ikili kodlar: ${[...fullIkili].join(", ")}`);
  const fullTrainTR = toTrainingRunners(trainRacesRaw, fullStats, fullIkili, fullZCap);
  const lambdaVectorFinal = codes.map(() => best.lt).concat(interactionNames.map(() => best.le));
  console.log(`Tam TRAIN'de fit ediliyor (${fullTrainTR.length} yaris, ${featureCount} ozellik)...`);
  const t0 = Date.now();
  const finalBeta = fitConditionalLogitHierarchical(fullTrainTR, featureCount, { lambdaVector: lambdaVectorFinal, priorVector: basePriorVector, learningRate: 0.05, iterations: 300 });
  console.log(`Fit bitti (${((Date.now()-t0)/1000).toFixed(1)}s). NaN var mi: ${finalBeta.some((b) => !Number.isFinite(b))}`);

  // ====== ADIM 3: HOLDOUT(30) — YENI MODEL ======
  const holdoutTR = toTrainingRunners(holdoutRacesRaw, fullStats, fullIkili, fullZCap);
  const newRes = evalLogLossTop1Top3(holdoutTR, finalBeta);

  // ====== ADIM 4: HOLDOUT(30) — MEVCUT (PRODUCTION) V1.0, ESKI (duzeltilmemis) cache ile ======
  let curLL = 0, curTop1 = 0, curTop3 = 0, curN = 0;
  const curProbsWithOutcome: { p: number; won: boolean }[] = [];
  const newProbsWithOutcome: { p: number; won: boolean }[] = [];
  for (const raceId of lock.holdoutRaceIds) {
    const oldRace = oldCache[raceId];
    if (!oldRace || oldRace.winnerNo == null) continue;
    const vectors: RunnerFeatureVector[] = oldRace.runners.map((r) => ({ raceId: oldRace.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const scored = scoreRace(vectors, currentModel);
    const winIdx = scored.findIndex((s) => s.no === oldRace.winnerNo);
    if (winIdx < 0) continue;
    const ranked = [...scored].sort((a, b) => b.probability - a.probability);
    const rank = ranked.findIndex((s) => s.no === oldRace.winnerNo);
    curLL += logLoss(scored[winIdx].probability);
    if (rank === 0) curTop1++;
    if (rank < 3) curTop3++;
    curN++;
    scored.forEach((s) => curProbsWithOutcome.push({ p: s.probability, won: s.no === oldRace.winnerNo }));
  }
  curLL /= curN;

  // yeni model icin de kalibrasyon amacli (p, won) ciftleri
  for (let i = 0; i < holdoutTR.length; i++) {
    const race = holdoutTR[i];
    const scores = race.map((r) => dot(r.features, finalBeta));
    const p = softmax(scores);
    race.forEach((r, j) => newProbsWithOutcome.push({ p: p[j], won: r.winner }));
  }

  function calibrationTable(data: { p: number; won: boolean }[], label: string) {
    const sorted = [...data].sort((a, b) => a.p - b.p);
    const bucketCount = 3;
    const bucketSize = Math.ceil(sorted.length / bucketCount);
    console.log(`\n  ${label} kalibrasyon (${bucketCount} terzil, n=${sorted.length}):`);
    for (let b = 0; b < bucketCount; b++) {
      const chunk = sorted.slice(b * bucketSize, (b + 1) * bucketSize);
      if (chunk.length === 0) continue;
      const meanPred = chunk.reduce((a, c) => a + c.p, 0) / chunk.length;
      const actualRate = chunk.filter((c) => c.won).length / chunk.length;
      console.log(`    terzil ${b + 1}: n=${chunk.length}, ortalama tahmin=%${(meanPred*100).toFixed(1)}, gercek kazanma orani=%${(actualRate*100).toFixed(1)}`);
    }
  }

  console.log(`\n\n================ SONUC: HOLDOUT(30) KARSILASTIRMASI ================`);
  console.log(`\nMEVCUT (production) V1.0 — eski/duzeltilmemis cache, donmus 76-ozellik model:`);
  console.log(`  n=${curN}  Top1=%${(curTop1/curN*100).toFixed(1)}  Top3=%${(curTop3/curN*100).toFixed(1)}  LogLoss=${curLL.toFixed(4)}`);
  console.log(`\nYENI (kosula-uyarlanmis hiyerarsik) model — GEN+DAV duzeltmeli, lambda_temel=${best.lt} lambda_etkilesim=${best.le}:`);
  console.log(`  n=${newRes.n}  Top1=%${(newRes.top1*100).toFixed(1)}  Top3=%${(newRes.top3*100).toFixed(1)}  LogLoss=${newRes.ll.toFixed(4)}`);
  console.log(`\nEsit-olasilik referansi (saf sans, saha buyuklugune gore ortalama):`);
  const avgFieldSize = holdoutRacesRaw.reduce((a, r) => a + r.runners.length, 0) / holdoutRacesRaw.length;
  console.log(`  ortalama saha=${avgFieldSize.toFixed(1)}, esit-olasilik LogLoss=ln(${avgFieldSize.toFixed(1)})=${Math.log(avgFieldSize).toFixed(4)}`);

  calibrationTable(curProbsWithOutcome, "MEVCUT model");
  calibrationTable(newProbsWithOutcome, "YENI model");

  fs.writeFileSync("C:/tmp/v1-hiyerarsik-egitim-sonuc.json", JSON.stringify({
    secilenLambda: best, finalBeta, interactionNames, codes, fullZCap, ikiliKodlar: [...fullIkili],
    mevcut: { n: curN, top1: curTop1/curN, top3: curTop3/curN, logLoss: curLL },
    yeni: { n: newRes.n, top1: newRes.top1, top3: newRes.top3, logLoss: newRes.ll },
  }, null, 2));
  console.log(`\nSonuc dosyasi: C:/tmp/v1-hiyerarsik-egitim-sonuc.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
