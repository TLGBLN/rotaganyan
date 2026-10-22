// DENEYSEL SAĞLAMLAŞTIRMA ÇALIŞMASI — mevcut V1.0 (v1-trained-model.json) KESİNLİKLE
// DEĞİŞTİRİLMEZ. Kullanıcı kararı (2026-10-21, VALENTINE GIRL/GEN_PMZ_YET_01 vakası
// sonrası): "Sınırlı ilişkisel sinyallerle ayrı bir deneme modeli eğitmeliyiz."
//
// YÖNTEM (kullanıcının son tur TAM spesifikasyonu, birebir):
//  1. Sinyal se\u00e7imi SADECE 120 TRAIN yarışındaki HAM verinin yapısına göre, önceden
//     tanımlanmış genel bir kuralla yapılır (sonuçlara bakılmaz):
//       - İkili (gözlemlenen değerler yalnız {0,1}) -> KIRPMA YOK.
//       - Düşük kardinalite (TRAIN'de gözlemlenen FARKLI değer sayısı < DISTINCT_THRESHOLD) -> KIRPMA YOK.
//       - Aksi halde (sürekli/çok-değerli, ikili değil) -> %1-%99 KIRPMA UYGULANIR.
//  2. Alt/üst sınırlar (p1/p99) YALNIZ TRAIN'in gözlemlenen ham değerlerinden hesaplanır.
//  3. Kırpma standardizasyondan (z-skor) ÖNCE uygulanır; mu/sigma KIRPILMIŞ TRAIN
//     değerlerinden yeniden hesaplanır (computeFeatureStats, training.ts'in KENDİSİ).
//  4. Katsayılar training.ts::fitModel ile YENİDEN öğrenilir (aynı fitOpts: lambda=1,
//     learningRate=0.05, iterations=300 — mevcut üretim artefaktıyla AYNI, adil karşılaştırma).
//  5. Eğitim ve tahminde AYNI (TRAIN'den türetilmiş) sınırlar kullanılır — HOLDOUT'un
//     kendi ham değerleri sınır/yöntem seçimine KATILMAZ, yalnız SONUÇ DEĞERLENDİRMESİNDE
//     kullanılır (sızıntı yok).
//  6. Eksik veri (observed=false) sözleşmesi DOKUNULMADAN korunur — kırpma yalnız
//     observed=true VE rawValue!=null olan girdilere uygulanır.
//  7. Çıktı: hangi kodun kırpıldığı/dışlandığı + gerekçe, kaç TRAIN gözleminin sınıra
//     çarptığı, HOLDOUT (30 yarış, görülmemiş) üzerinde mevcut model ile bu deneysel
//     modelin LogLoss/Top1 karşılaştırması. Yeni artefakt AYRI bir dosyaya yazılır,
//     v1-trained-model.json'a DOKUNULMAZ.
import fs from "node:fs";
import {
  fitModel, computeFeatureStats, scoreRace, DEFAULT_FIT_OPTIONS,
  type TrainingRace, type FittedModel,
} from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

const DISTINCT_THRESHOLD = 10; // ön-kayıtlı (pre-registered) eşik — sonuçlara bakılmadan seçildi

type CacheSignal = { code: string; family: string; rawValue: number | null; observed: boolean };
type CacheRunner = { no: number; name: string; vectors: CacheSignal[] };
type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: CacheRunner[] };

function toRunnerFeatureVector(raceId: string, r: CacheRunner): RunnerFeatureVector {
  const signals: SignalEntry[] = r.vectors.map((v) => ({
    code: v.code, family: v.family, rawValue: v.rawValue, observed: v.observed,
    coverageState: null, asOfSafe: true, missingReason: null,
  }));
  return { raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 1) return sortedAsc[0];
  const idx = (p / 100) * (sortedAsc.length - 1);
  const lo = Math.floor(idx), hi = Math.ceil(idx);
  if (lo === hi) return sortedAsc[lo];
  const frac = idx - lo;
  return sortedAsc[lo] * (1 - frac) + sortedAsc[hi] * frac;
}

function logLoss(probWinner: number): number {
  return -Math.log(Math.max(probWinner, 1e-9));
}

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as {
    trainRaceIds: string[]; holdoutRaceIds: string[];
  };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-150-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const currentModel = loadTrainedV1Model();
  const codes = [...currentModel.stats.keys()];

  const trainRaces = lock.trainRaceIds.map((id) => cache[id]).filter((r): r is CacheRace => !!r);
  const holdoutRaces = lock.holdoutRaceIds.map((id) => cache[id]).filter((r): r is CacheRace => !!r);
  console.log(`TRAIN: ${trainRaces.length}/${lock.trainRaceIds.length} | HOLDOUT: ${holdoutRaces.length}/${lock.holdoutRaceIds.length}`);

  // --- 1) Yapısal sınıflandırma: yalnız TRAIN ham gözlemlerinden, sonuca bakmadan ---
  type Siniflandirma = { code: string; nObs: number; distinct: number; isBinary: boolean; uygun: boolean; gerekce: string; p1?: number; p99?: number };
  const siniflandirma = new Map<string, Siniflandirma>();
  for (const code of codes) {
    const values: number[] = [];
    for (const race of trainRaces) {
      for (const runner of race.runners) {
        const sig = runner.vectors.find((v) => v.code === code);
        if (sig && sig.observed && sig.rawValue != null && Number.isFinite(sig.rawValue)) values.push(sig.rawValue);
      }
    }
    const distinctSet = new Set(values);
    const distinct = distinctSet.size;
    const isBinary = distinct > 0 && [...distinctSet].every((v) => v === 0 || v === 1);
    let uygun: boolean, gerekce: string;
    if (isBinary) { uygun = false; gerekce = `ikili (gözlemlenen değerler yalnız {0,1}, n=${values.length})`; }
    else if (distinct < DISTINCT_THRESHOLD) { uygun = false; gerekce = `düşük kardinalite (${distinct} farklı değer < eşik=${DISTINCT_THRESHOLD})`; }
    else { uygun = true; gerekce = `sürekli/çok-değerli (${distinct} farklı değer, n=${values.length})`; }
    const rec: Siniflandirma = { code, nObs: values.length, distinct, isBinary, uygun, gerekce };
    if (uygun) {
      const sorted = [...values].sort((a, b) => a - b);
      rec.p1 = percentile(sorted, 1);
      rec.p99 = percentile(sorted, 99);
    }
    siniflandirma.set(code, rec);
  }

  console.log(`\n=== SİNYAL SINIFLANDIRMASI (yalnız TRAIN ham veri yapısından, sonuca bakılmadan) ===`);
  console.log("kod".padEnd(20), "nObs".padStart(6), "distinct".padStart(9), "KIRPILACAK?".padStart(12), "  gerekçe / [p1,p99]");
  for (const code of codes) {
    const r = siniflandirma.get(code)!;
    const bounds = r.uygun ? `[${r.p1!.toFixed(3)}, ${r.p99!.toFixed(3)}]` : "";
    console.log(code.padEnd(20), String(r.nObs).padStart(6), String(r.distinct).padStart(9), (r.uygun ? "EVET" : "hayır").padStart(12), " ", r.gerekce, bounds);
  }
  const uygunKodlar = codes.filter((c) => siniflandirma.get(c)!.uygun);
  console.log(`\nKırpılacak kod sayısı: ${uygunKodlar.length}/${codes.length}`);

  // --- 2) Kırpma fonksiyonu — yalnız uygun kodlara, yalnız observed=true değerlere ---
  function clipSignal(sig: CacheSignal): CacheSignal {
    if (!sig.observed || sig.rawValue == null) return sig; // eksik veri DOKUNULMAZ
    const rec = siniflandirma.get(sig.code);
    if (!rec || !rec.uygun) return sig; // ikili/düşük-kardinalite DOKUNULMAZ
    const clipped = Math.min(Math.max(sig.rawValue, rec.p1!), rec.p99!);
    return clipped === sig.rawValue ? sig : { ...sig, rawValue: clipped };
  }

  let toplamKirpilanDeger = 0;
  const kirpilanSayisi = new Map<string, number>();
  function clipRace(race: CacheRace): CacheRace {
    return {
      ...race,
      runners: race.runners.map((r) => ({
        ...r,
        vectors: r.vectors.map((sig) => {
          const clipped = clipSignal(sig);
          if (clipped !== sig) {
            toplamKirpilanDeger++;
            kirpilanSayisi.set(sig.code, (kirpilanSayisi.get(sig.code) ?? 0) + 1);
          }
          return clipped;
        }),
      })),
    };
  }

  const clippedTrainRaces = trainRaces.map(clipRace);
  const clippedHoldoutRaces = holdoutRaces.map(clipRace); // AYNI (TRAIN'den türetilmiş) sınırlar

  console.log(`\n=== KIRPMA ETKİSİ (TRAIN, sınıra ÇARPAN gözlem sayısı) ===`);
  for (const code of uygunKodlar) {
    const n = kirpilanSayisi.get(code) ?? 0;
    const nObs = siniflandirma.get(code)!.nObs;
    console.log(`  ${code.padEnd(20)} ${n}/${nObs} gözlem kırpıldı (%${((n / nObs) * 100).toFixed(1)})`);
  }

  // --- 3) Yeniden eğitim: KIRPILMIŞ TRAIN verisinden mu/sigma + fitModel (AYNI fitOpts) ---
  const trainVectors: RunnerFeatureVector[] = clippedTrainRaces.flatMap((race) =>
    race.runners.map((r) => toRunnerFeatureVector(race.raceId, r))
  );
  const newStats = computeFeatureStats(trainVectors, codes as never);

  const trainingSet: TrainingRace[] = clippedTrainRaces.map((race) => ({
    raceId: race.raceId,
    date: new Date(race.date),
    winnerNo: race.winnerNo,
    vectors: race.runners.map((r) => toRunnerFeatureVector(race.raceId, r)),
  }));

  console.log(`\nYeniden eğitim başlıyor (fitOpts=${JSON.stringify(DEFAULT_FIT_OPTIONS)})...`);
  const newModel: FittedModel = fitModel(trainingSet, newStats as never, DEFAULT_FIT_OPTIONS);
  console.log(`Eğitim bitti. nRacesUsed=${newModel.nRacesUsed} nRacesSkipped=${newModel.nRacesSkipped}`);

  // --- 4) HOLDOUT (30, görülmemiş) üzerinde MEVCUT model (kırpılmamış) vs DENEYSEL model (kırpılmış) ---
  let currLL = 0, newLL = 0, currTop1 = 0, newTop1 = 0, nEval = 0;
  const detaylar: string[] = [];
  for (let i = 0; i < holdoutRaces.length; i++) {
    const raw = holdoutRaces[i];
    const clipped = clippedHoldoutRaces[i];
    if (raw.winnerNo == null) continue;
    const rawVectors = raw.runners.map((r) => toRunnerFeatureVector(raw.raceId, r));
    const clippedVectors = clipped.runners.map((r) => toRunnerFeatureVector(clipped.raceId, r));

    const currScored = scoreRace(rawVectors, currentModel);
    const newScored = scoreRace(clippedVectors, newModel);

    const currWinner = currScored.find((s) => s.no === raw.winnerNo);
    const newWinner = newScored.find((s) => s.no === raw.winnerNo);
    if (!currWinner || !newWinner) continue;

    nEval++;
    currLL += logLoss(currWinner.probability);
    newLL += logLoss(newWinner.probability);
    const currRanked = [...currScored].sort((a, b) => b.probability - a.probability);
    const newRanked = [...newScored].sort((a, b) => b.probability - a.probability);
    const currHit = currRanked[0].no === raw.winnerNo;
    const newHit = newRanked[0].no === raw.winnerNo;
    if (currHit) currTop1++;
    if (newHit) newTop1++;

    const currRank = currRanked.findIndex((s) => s.no === raw.winnerNo) + 1;
    const newRank = newRanked.findIndex((s) => s.no === raw.winnerNo) + 1;
    if (currRank !== newRank) {
      detaylar.push(`  ${raw.date.slice(0, 10)} ${raw.raceId} kazanan#${raw.winnerNo}: MEVCUT sıra=${currRank}/${raw.runners.length} (P=${(currWinner.probability * 100).toFixed(1)}%) -> DENEYSEL sıra=${newRank}/${raw.runners.length} (P=${(newWinner.probability * 100).toFixed(1)}%)`);
    }
  }

  console.log(`\n=== HOLDOUT DEĞERLENDİRMESİ (${nEval} yarış, GÖRÜLMEMİŞ — sınır/yöntem seçiminde KULLANILMADI) ===`);
  console.log(`Mevcut V1.0   — ortalama LogLoss=${(currLL / nEval).toFixed(4)}  Top1 isabet=${currTop1}/${nEval} (%${((currTop1 / nEval) * 100).toFixed(1)})`);
  console.log(`Deneysel(kırp)— ortalama LogLoss=${(newLL / nEval).toFixed(4)}  Top1 isabet=${newTop1}/${nEval} (%${((newTop1 / nEval) * 100).toFixed(1)})`);
  console.log(`\nKazananın sırasının DEĞİŞTİĞİ yarışlar (${detaylar.length}/${nEval}):`);
  detaylar.forEach((l) => console.log(l));

  // --- 5) Yeni artefaktı AYRI bir dosyaya yaz — v1-trained-model.json'a DOKUNULMAZ ---
  const outPath = "src/lib/motor-v1/artifacts/experimental-winsorized-v1.json";
  const artifact = {
    modelVersion: "rotaganyan-v1.0-EXPERIMENTAL-winsorized-2026-10-21",
    note: "SALT DENEYSEL — production'da KULLANILMAZ, v1-trained-model.json DEĞİŞTİRİLMEDİ. Yalnız sürekli/çok-değerli (ikili olmayan, TRAIN'de >=10 farklı değeri olan) sinyaller TRAIN %1-%99 sınırına kırpıldı; ikili ve düşük-kardinaliteli sinyaller DOKUNULMADI.",
    beta: newModel.beta,
    names: newModel.names,
    muSigma: Object.fromEntries([...newModel.stats.entries()].map(([k, v]) => [k, v])),
    nTrainRaces: newModel.nRacesUsed,
    nRacesSkipped: newModel.nRacesSkipped,
    fitOpts: newModel.opts,
    distinctThreshold: DISTINCT_THRESHOLD,
    clippedCodes: uygunKodlar.map((c) => ({ code: c, p1: siniflandirma.get(c)!.p1, p99: siniflandirma.get(c)!.p99, nClippedInTrain: kirpilanSayisi.get(c) ?? 0, nObservedInTrain: siniflandirma.get(c)!.nObs })),
    excludedFromClipping: codes.filter((c) => !siniflandirma.get(c)!.uygun).map((c) => ({ code: c, gerekce: siniflandirma.get(c)!.gerekce })),
    holdoutEvaluation: { nEval, currentLogLoss: currLL / nEval, experimentalLogLoss: newLL / nEval, currentTop1: currTop1, experimentalTop1: newTop1 },
  };
  fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2));
  console.log(`\nDeneysel artefakt yazıldı: ${outPath} (v1-trained-model.json DEĞİŞMEDİ)`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
