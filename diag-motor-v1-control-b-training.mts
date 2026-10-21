// Kontrol B (kullanıcı talimatı §7): eğitilmiş model varsa skor/softmax/sinyal-katkısı
// gerçekten hesaplanıyor mu? KÜÇÜK ÖRNEKLEMLİ ama GERÇEK bir eğitim turu — nihai kalibrasyon
// DEĞİL, zincirin (veri→özellik→eğitim→skor→softmax→açıklama) UÇTAN UCA çalıştığının kanıtı.

import { loadTempoContext } from "@/lib/motor-v1/features/tempo";
import { buildFeatureVectorsForRace } from "@/lib/motor-v1/engine/feature-vector";
import {
  selectTrainingRaces,
  buildTrainingSet,
  computeFeatureStats,
  fitModel,
  scoreRace,
  explainRunner,
  MODEL_VERSION,
  SIGNAL_CODES,
} from "@/lib/motor-v1/engine/training";

const TODAY_RACE_ID = "cmv92m7yh003x06jnunvw8ydp"; // İstanbul 2026-10-16 Koşu 1
const TODAY_CUTOFF = new Date("2026-10-16T00:00:00.000Z");
const N_TRAIN = 4; // KÜÇÜK örneklem — süre nedeniyle bilinçli olarak sınırlı, bkz. rapor

async function main() {
  const t0 = Date.now();
  const tempoCtx = await loadTempoContext();
  console.log(`[${Date.now() - t0}ms] TempoContext (Accurace arşivi) yüklendi.`);

  const raceStubs = await selectTrainingRaces(N_TRAIN, TODAY_CUTOFF);
  console.log(`[${Date.now() - t0}ms] ${raceStubs.length} eğitim yarışı seçildi:`, raceStubs.map((r) => r.raceId));

  const trainingSet = await buildTrainingSet(raceStubs, tempoCtx);
  console.log(`[${Date.now() - t0}ms] Eğitim FeatureVector'ları inşa edildi.`);
  for (const t of trainingSet) {
    console.log(`  yarış ${t.raceId} (${t.date.toISOString().slice(0, 10)}): ${t.vectors.length} at, winnerNo=${t.winnerNo}`);
  }

  const allTrainingVectors = trainingSet.flatMap((t) => t.vectors);
  const stats = computeFeatureStats(allTrainingVectors);
  console.log(`[${Date.now() - t0}ms] Özellik istatistikleri (μ/σ) eğitim örnekleminden hesaplandı:`);
  for (const code of SIGNAL_CODES) {
    const s = stats.get(code)!;
    console.log(`  ${code.padEnd(14)} n=${s.nObserved} μ=${s.mu.toFixed(4)} σ=${s.sigma.toFixed(4)}`);
  }

  const model = fitModel(trainingSet, stats);
  console.log(`[${Date.now() - t0}ms] Model fit edildi: nRacesUsed=${model.nRacesUsed}, nRacesSkipped=${model.nRacesSkipped}`);
  console.log("Öğrenilmiş katsayılar (β, ana etkiler — z sütunları):");
  for (let i = 0; i < SIGNAL_CODES.length; i++) {
    console.log(`  ${SIGNAL_CODES[i].padEnd(14)} β_z=${model.beta[i * 2].toFixed(5)}  β_missing=${model.beta[i * 2 + 1].toFixed(5)}`);
  }

  // Kontrol B — bugünkü GERÇEK yarışı skorla
  const todayVectors = await buildFeatureVectorsForRace(TODAY_RACE_ID, tempoCtx);
  const scored = scoreRace(todayVectors, model);
  const probSum = scored.reduce((s, r) => s + r.probability, 0);
  console.log(`\n[${Date.now() - t0}ms] BUGÜNKÜ YARIŞ SKORLAMA (model=${MODEL_VERSION}):`);
  for (const s of scored.sort((a, b) => b.probability - a.probability)) {
    console.log(`  no=${s.no} ${s.name.padEnd(20)} score=${s.score.toFixed(4)}  P=${(s.probability * 100).toFixed(2)}%`);
  }
  console.log(`  OLASILIK TOPLAMI: ${(probSum * 100).toFixed(6)}%`);

  // Sinyal Etki Raporu — en yüksek olasılıklı at için
  const top = scored.sort((a, b) => b.probability - a.probability)[0];
  const topVector = todayVectors.find((v) => v.no === top.no)!;
  const { rows, totalScore, interactionContribution } = explainRunner(topVector, model);
  console.log(`\nSİNYAL ETKİ RAPORU — ${topVector.name} (no=${topVector.no}):`);
  console.log("kod            ham      standardize  katsayı    katkı      eksikGöst.katkı  gözlem  kapsam");
  for (const r of rows) {
    console.log(
      `${r.code.padEnd(14)} ${(r.rawValue ?? NaN).toFixed(3).padStart(8)} ${r.standardizedValue.toFixed(3).padStart(10)} ` +
        `${r.learnedCoefficient.toFixed(4).padStart(9)} ${r.scoreContribution.toFixed(4).padStart(9)} ${r.missingIndicatorContribution.toFixed(4).padStart(14)} ` +
        `${String(r.observed).padStart(6)} ${r.coverageState ?? "-"}`
    );
  }
  console.log(`TOPLAM SKOR (bu atın tüm sinyal katkılarının toplamı): ${totalScore.toFixed(4)} (etkileşim katkısı: ${interactionContribution})`);
  console.log(`(karşılaştırma: scoreRace'in bağımsız hesapladığı score=${top.score.toFixed(4)} — AYNI olmalı, çift-sayım kontrolü)`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
