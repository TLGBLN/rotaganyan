// ROTAGANYAN V1.0 — COZUM FAZI, ILK GOREV: DAV + GEN DUZELTMESI (IZOLE, SALT-OKUNUR DOGRULAMA
// + TEK SEFERLIK YENIDEN EGITIM). Mevcut DUZ 38-kod (76-ozellik: z+missing) mimarisi
// KORUNUR — hiyerarsik/yeni mimari YOK. GEN+DAV duzeltmeli cache (gen-dav-fixed-150-cache.json,
// TRAIN120+HOLDOUT30) kullanilir. Z_CAP, "otomatik 11 kabul" EDILMEDEN, TRAIN icinde
// kronolojik CV ile adaylar arasindan SECILIR. V5.46.1/production/paylasilan kod DEGISMEZ —
// yalniz bu worktree'de izole bir egitim calistirilir, hicbir dosya production'a kopyalanmaz.
import fs from "node:fs";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import { scoreRace, explainRunner } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

const DAV_7_PREFIXES = ["cmt875dz", "cmt5caao", "cmu52aat", "cmudmxle", "cmup2gg0", "cmu60zh6", "cmsh1uys"];

async function main() {
  const fixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-fixed-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const currentModel = loadTrainedV1Model();
  const codes = [...currentModel.stats.keys()]; // 38 kod, SABIT sira (production ile AYNI)

  const trainRacesRaw = lock.trainRaceIds.map((id) => fixedCache[id]).filter((r): r is CacheRace => !!r);
  const holdoutRacesRaw = lock.holdoutRaceIds.map((id) => fixedCache[id]).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN(duzeltilmis): ${trainRacesRaw.length}/120  HOLDOUT(duzeltilmis): ${holdoutRacesRaw.length}/30`);

  // --- yardimcilar: ikili kod tespiti + z-cap uygulamali 76-ozellik vektoru ---
  function isIkili(values: number[]): boolean {
    if (values.length < 2) return false;
    const s = new Set(values);
    return [...s].every((v) => v === 0 || v === 1) && s.size <= 2;
  }
  type StatsEntry = { mu: number; sigma: number };
  function computeStats(racesSubset: CacheRace[]): Map<string, StatsEntry> {
    const stats = new Map<string, StatsEntry>();
    for (const code of codes) {
      const values: number[] = [];
      for (const race of racesSubset) for (const r of race.runners) {
        const s = r.vectors.find((x) => x.code === code);
        if (s?.observed && s.rawValue != null && Number.isFinite(s.rawValue)) values.push(s.rawValue);
      }
      if (values.length < 2) { stats.set(code, { mu: 0, sigma: 1 }); continue; }
      const mu = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mu) ** 2, 0) / values.length;
      stats.set(code, { mu, sigma: Math.sqrt(variance) || 1 });
    }
    return stats;
  }
  // HANGI KODLARIN ikili (0/1) oldugu YAPISAL bir gercek — tek bir CV katindaki veri
  // seyrekligine (ornek: DAV'in gercek equipment verisi kronolojik olarak SON tarihli
  // yarislarda yogunlasmis, cv-fit'te neredeyse hic gozlemsiz) BAGLI OLMAMALI. Bu yuzden
  // ikili-tespiti TAM TRAIN(120)'dan BIR KEZ yapilir, mu/sigma ise HER KAT kendi verisinden
  // (kat-ici sizinti olmadan) hesaplanir.
  const globalIkiliKodlar = new Set(
    codes.filter((code) => {
      const vals: number[] = [];
      for (const race of trainRacesRaw) for (const r of race.runners) {
        const s = r.vectors.find((x) => x.code === code);
        if (s?.observed && s.rawValue != null) vals.push(s.rawValue);
      }
      return isIkili(vals);
    })
  );
  console.log(`Ikili tespit edilen kodlar (TAM TRAIN(120)'dan, yapisal — kat-bagimsiz): ${[...globalIkiliKodlar].join(", ")}`);

  // zCap=null -> kirpma YOK (kontrol/baseline adayi)
  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, zCap: number | null): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const st = stats.get(code)!;
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
      let z = observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0;
      if (observed && globalIkiliKodlar.has(code) && zCap != null) z = Math.max(-zCap, Math.min(zCap, z));
      vec.push(z);
      vec.push(observed ? 0 : 1);
    }
    return vec;
  }
  function toTrainingRunners(racesSubset: CacheRace[], stats: Map<string, StatsEntry>, zCap: number | null): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of racesSubset) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const runners: TrainingRunner[] = race.runners.map((r) => {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, zCap) };
      });
      if (runners.some((r) => r.winner)) out.push(runners);
    }
    return out;
  }
  function evalSet(races: TrainingRunner[][], beta: number[]) {
    let ll = 0, top1 = 0, top3 = 0, n = 0;
    for (const race of races) {
      const scores = race.map((r) => dot(r.features, beta));
      const p = softmax(scores);
      const winIdx = race.findIndex((r) => r.winner);
      const ranked = [...p.keys()].sort((a, b) => p[b] - p[a]);
      ll += logLoss(p[winIdx]); if (ranked[0] === winIdx) top1++; if (ranked.slice(0, 3).includes(winIdx)) top3++; n++;
    }
    return { ll: ll / n, top1: top1 / n, top3: top3 / n, n };
  }

  // ====== ADIM 1: KRONOLOJIK CV — Z_CAP adaylari (lambda=1 SABIT, production ile AYNI) ======
  const trainSorted = [...trainRacesRaw].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainSorted.length * 0.2);
  const cvFit = trainSorted.slice(0, trainSorted.length - cvValSize);
  const cvVal = trainSorted.slice(trainSorted.length - cvValSize);
  const cvStats = computeStats(cvFit);

  const Z_CAP_ADAYLARI: (number | null)[] = [null, 6, 8, 11, 15, 20];
  let best: { cap: number | null; ll: number } = { cap: null, ll: Infinity };
  console.log(`\n=== Kronolojik CV: Z_CAP adaylari (lambda=${currentModel.opts.lambda} SABIT, production ile AYNI) ===`);
  for (const cap of Z_CAP_ADAYLARI) {
    const fitRaces = toTrainingRunners(cvFit, cvStats, cap);
    const valRaces = toTrainingRunners(cvVal, cvStats, cap);
    const beta = fitConditionalLogit(fitRaces, codes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(valRaces, beta);
    console.log(`  Z_CAP=${cap ?? "YOK"}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} Top3=%${(val.top3*100).toFixed(1)} (n=${val.n})`);
    if (val.ll < best.ll) best = { cap, ll: val.ll };
  }
  console.log(`\nSECILEN Z_CAP: ${best.cap ?? "YOK"} (val LogLoss=${best.ll.toFixed(4)})`);

  // ====== ADIM 2: TAM TRAIN(120, duzeltilmis) UZERINDE YENIDEN EGITIM ======
  const fullStats = computeStats(trainRacesRaw);
  const fullTrainTR = toTrainingRunners(trainRacesRaw, fullStats, best.cap);
  console.log(`\nTam TRAIN'de (duzeltilmis GEN+DAV, Z_CAP=${best.cap ?? "YOK"}) yeniden egitiliyor (${fullTrainTR.length} yaris, 76 ozellik, lambda=${currentModel.opts.lambda})...`);
  const t0 = Date.now();
  const newBeta = fitConditionalLogit(fullTrainTR, codes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
  console.log(`Bitti (${((Date.now()-t0)/1000).toFixed(1)}s). NaN var mi: ${newBeta.some((b) => !Number.isFinite(b))}`);

  // ====== ADIM 3: 7 DAV-KRITIK YARISTA ESKI vs YENI ======
  console.log(`\n=== 7 DAV-KRITIK YARISTA ESKI (production, donmus) vs YENI (duzeltilmis+Z_CAP) ===`);
  const allIds = Object.keys(fixedCache);
  for (const prefix of DAV_7_PREFIXES) {
    const raceId = allIds.find((id) => id.startsWith(prefix));
    if (!raceId) continue;
    const race = fixedCache[raceId];
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));

    // ESKI: production modeli, duzeltilmis cache'teki ham veriyle (DAV icin cogunlukla ayni, GEN icin degisebilir)
    const oldScored = scoreRace(vectors, currentModel);
    const oldWinIdx = oldScored.findIndex((s) => s.no === race.winnerNo);
    const oldRanked = [...oldScored].sort((a, b) => b.probability - a.probability);
    const oldRank = oldRanked.findIndex((s) => s.no === race.winnerNo) + 1;

    // YENI: yeniden egitilmis beta + fullStats + secilen Z_CAP
    const newVecs = vectors.map((v) => buildVector(v, fullStats, best.cap));
    const newScores = newVecs.map((v) => dot(v, newBeta));
    const newProbs = softmax(newScores);
    const winIdxN = vectors.findIndex((v) => v.no === race.winnerNo);
    const rankedN = vectors.map((v, i) => ({ no: v.no, p: newProbs[i] })).sort((a, b) => b.p - a.p);
    const newRank = rankedN.findIndex((r) => r.no === race.winnerNo) + 1;

    console.log(`  ${race.date.slice(0,10)} ${raceId.slice(0,8)} ${race.runners.find((r)=>r.no===race.winnerNo)?.name}: ESKI sira=${oldRank}. %${(oldScored[oldWinIdx].probability*100).toFixed(2)}  ->  YENI sira=${newRank}. %${(newProbs[winIdxN]*100).toFixed(2)}`);
  }

  // ====== ADIM 4: TUM TRAIN+HOLDOUT(150) — ESKI vs YENI, beklenmeyen bozulma kontrolu ======
  function evalOldOnFixedCache(races: CacheRace[]) {
    let ll = 0, top1 = 0, top3 = 0, n = 0, iyilesen = 0, kotulesen = 0;
    const detay: { raceId: string; oldLL: number; newLL: number }[] = [];
    for (const race of races) {
      if (race.winnerNo == null) continue;
      const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
      const oldScored = scoreRace(vectors, currentModel);
      const oldWinIdx = oldScored.findIndex((s) => s.no === race.winnerNo);
      if (oldWinIdx < 0) continue;
      const oldRanked = [...oldScored].sort((a, b) => b.probability - a.probability);
      const oldLL = logLoss(oldScored[oldWinIdx].probability);

      const newVecs = vectors.map((v) => buildVector(v, fullStats, best.cap));
      const newScores = newVecs.map((v) => dot(v, newBeta));
      const newProbs = softmax(newScores);
      const winIdxN = vectors.findIndex((v) => v.no === race.winnerNo);
      const rankedN = vectors.map((v, i) => ({ no: v.no, p: newProbs[i] })).sort((a, b) => b.p - a.p);
      const newLL = logLoss(newProbs[winIdxN]);

      ll += newLL; n++;
      if (rankedN[0].no === race.winnerNo) top1++;
      if (rankedN.slice(0, 3).some((r) => r.no === race.winnerNo)) top3++;
      if (newLL < oldLL - 0.01) iyilesen++; else if (newLL > oldLL + 0.01) kotulesen++;
      detay.push({ raceId: race.raceId, oldLL, newLL });
    }
    return { ll: ll / n, top1: top1 / n, top3: top3 / n, n, iyilesen, kotulesen, detay };
  }
  const oldOnAll = (() => {
    let ll = 0, top1 = 0, top3 = 0, n = 0;
    for (const race of [...trainRacesRaw, ...holdoutRacesRaw]) {
      if (race.winnerNo == null) continue;
      const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
      const scored = scoreRace(vectors, currentModel);
      const winIdx = scored.findIndex((s) => s.no === race.winnerNo);
      if (winIdx < 0) continue;
      const ranked = [...scored].sort((a, b) => b.probability - a.probability);
      ll += logLoss(scored[winIdx].probability); n++;
      if (ranked[0].no === race.winnerNo) top1++;
      if (ranked.slice(0,3).some((r)=>r.no===race.winnerNo)) top3++;
    }
    return { ll: ll/n, top1: top1/n, top3: top3/n, n };
  })();
  const newOnAll = evalOldOnFixedCache([...trainRacesRaw, ...holdoutRacesRaw]);
  const newOnHoldoutOnly = evalOldOnFixedCache(holdoutRacesRaw);
  const oldOnHoldoutOnly = (() => {
    let ll = 0, top1 = 0, top3 = 0, n = 0;
    for (const race of holdoutRacesRaw) {
      if (race.winnerNo == null) continue;
      const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
      const scored = scoreRace(vectors, currentModel);
      const winIdx = scored.findIndex((s) => s.no === race.winnerNo);
      if (winIdx < 0) continue;
      const ranked = [...scored].sort((a, b) => b.probability - a.probability);
      ll += logLoss(scored[winIdx].probability); n++;
      if (ranked[0].no === race.winnerNo) top1++;
      if (ranked.slice(0,3).some((r)=>r.no===race.winnerNo)) top3++;
    }
    return { ll: ll/n, top1: top1/n, top3: top3/n, n };
  })();

  console.log(`\n\n================ SONUC: TRAIN(120)+HOLDOUT(30)=150 — ESKI vs YENI ================`);
  console.log(`(UYARI: bu 150 yaris arastirmada defalarca kullanildi — BAGIMSIZ nihai kanit DEGIL)`);
  console.log(`\nESKI (production, donmus): n=${oldOnAll.n} Top1=%${(oldOnAll.top1*100).toFixed(1)} Top3=%${(oldOnAll.top3*100).toFixed(1)} LogLoss=${oldOnAll.ll.toFixed(4)}`);
  console.log(`YENI (GEN+DAV duzeltmeli+Z_CAP=${best.cap ?? "YOK"}): n=${newOnAll.n} Top1=%${(newOnAll.top1*100).toFixed(1)} Top3=%${(newOnAll.top3*100).toFixed(1)} LogLoss=${newOnAll.ll.toFixed(4)}`);
  console.log(`\nYalniz HOLDOUT(30) — ESKI: Top1=%${(oldOnHoldoutOnly.top1*100).toFixed(1)} LogLoss=${oldOnHoldoutOnly.ll.toFixed(4)}  |  YENI: Top1=%${(newOnHoldoutOnly.top1*100).toFixed(1)} LogLoss=${newOnHoldoutOnly.ll.toFixed(4)}`);
  console.log(`\nBeklenmeyen bozulma kontrolu (150 yarisin kaci iyilesti/kotulesti, |ΔLL|>0.01): iyilesen=${newOnAll.iyilesen}  kotulesen=${newOnAll.kotulesen}  degismeyen=${newOnAll.n-newOnAll.iyilesen-newOnAll.kotulesen}`);

  fs.writeFileSync("C:/tmp/v1-dav-gen-duzeltme-sonuc.json", JSON.stringify({
    secilenZCap: best.cap, ikiliKodlar: [...globalIkiliKodlar], newBeta, codes,
    eski: oldOnAll, yeni: newOnAll, eskiHoldout: oldOnHoldoutOnly, yeniHoldout: newOnHoldoutOnly,
  }, null, 2));
  console.log(`\nSonuc dosyasi: C:/tmp/v1-dav-gen-duzeltme-sonuc.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
