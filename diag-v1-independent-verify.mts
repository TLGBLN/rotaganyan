// SALT-OKUNUR DOĞRULAMA — yeni eğitim/geliştirme YOK. Kullanıcı talimatı (2026-10-21):
// "Ham değer -> standardizasyon -> öğrenilmiş katsayı -> skor -> softmax hesapları eğitim
// artefaktıyla birebir eşleşiyor mu?" ve "Aile katkıları + ilişkisel katkılar + eksik-veri
// etkileri toplandığında nihai skorla birebir eşleşiyor mu?" — KODUN KENDİSİNİ ÇAĞIRMADAN,
// yalnız artefaktın ham JSON'undan BAĞIMSIZ olarak yeniden hesaplanır, kodun ürettiğiyle
// karşılaştırılır. PASS/FAIL + sayısal fark raporlanır.
import fs from "node:fs";
import { predictRaceV1 } from "./src/lib/motor-v1/engine/predict-v1";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

const RACE_ID = process.argv[2] ?? "cmvg7su87000308jpe65z4rod"; // Bursa 2026-10-21 K1 (daha once test edilmis, sonuclu)

type Artifact = {
  beta: number[];
  names: string[];
  muSigma: Record<string, { mu: number; sigma: number; nObserved: number }>;
};

async function main() {
  const artifact: Artifact = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/v1-trained-model.json", "utf8"));
  const model = loadTrainedV1Model();

  const result = await predictRaceV1(RACE_ID, model);
  if (!result) { console.log("HATA: yaris bulunamadi/bos saha"); process.exit(1); }

  console.log(`\n=== KONTROL 1: ham -> standardizasyon -> katsayi -> skor -> softmax (BAGIMSIZ yeniden hesap) ===`);
  console.log(`Yaris: ${RACE_ID} | At sayisi: ${result.scored.length} | Kod sayisi: ${artifact.names.length / 2}`);

  let maxScoreDiff = 0;
  let maxZDiff = 0;
  let maxContribDiff = 0;
  const independentScores: { no: number; score: number }[] = [];

  for (const s of result.scored) {
    const explain = result.explain.get(s.no)!;
    let independentScore = 0;

    for (const row of explain.rows) {
      const code = row.code as string;
      const muSigma = artifact.muSigma[code];
      if (!muSigma) continue; // kod artefaktta yoksa (olmamali, ama guvenlik)

      // BAGIMSIZ z-skor: (ham - mu) / (sigma || 1), gozlemsizse 0 (missing-indicator teknigi)
      const independentZ = row.observed && row.rawValue != null
        ? (row.rawValue - muSigma.mu) / (muSigma.sigma || 1)
        : 0;
      const zDiff = Math.abs(independentZ - row.standardizedValue);
      if (zDiff > maxZDiff) maxZDiff = zDiff;

      // BAGIMSIZ katsayi: artefaktin kendi beta dizisinden, isim eslestirerek (kodun
      // model.beta[zIdx] INDEX eslestirmesinden TAMAMEN BAGIMSIZ, isim->index kendi
      // aramamizla buluyoruz)
      const zNameIdx = artifact.names.indexOf(`${code}_z`);
      const missNameIdx = artifact.names.indexOf(`${code}_missing`);
      const independentBetaZ = artifact.beta[zNameIdx];
      const independentBetaMiss = artifact.beta[missNameIdx];
      const independentMissInd = row.observed ? 0 : 1;

      const independentContribZ = independentBetaZ * independentZ;
      const independentContribMiss = independentBetaMiss * independentMissInd;
      const contribDiff = Math.abs(independentContribZ - row.scoreContribution) + Math.abs(independentContribMiss - row.missingIndicatorContribution);
      if (contribDiff > maxContribDiff) maxContribDiff = contribDiff;

      independentScore += independentContribZ + independentContribMiss;
    }

    const scoreDiff = Math.abs(independentScore - s.score);
    if (scoreDiff > maxScoreDiff) maxScoreDiff = scoreDiff;
    independentScores.push({ no: s.no, score: independentScore });
  }

  console.log(`  z-skor (standardizasyon) max fark: ${maxZDiff.toExponential(3)}`);
  console.log(`  katsayi x z katki max fark (satir bazinda): ${maxContribDiff.toExponential(3)}`);
  console.log(`  BAGIMSIZ toplam skor vs scoreRace() skoru max fark: ${maxScoreDiff.toExponential(3)}`);

  // Softmax'i da BAGIMSIZ hesapla (kodun softmax() fonksiyonunu COPYALAMADAN, dogrudan formulden)
  const expScores = independentScores.map((x) => Math.exp(x.score));
  const sumExp = expScores.reduce((a, b) => a + b, 0);
  const independentProbs = independentScores.map((x, i) => ({ no: x.no, p: expScores[i] / sumExp }));
  let maxProbDiff = 0;
  for (const ip of independentProbs) {
    const kodunP = result.scored.find((s) => s.no === ip.no)!.probability;
    const d = Math.abs(ip.p - kodunP);
    if (d > maxProbDiff) maxProbDiff = d;
  }
  const probSum = result.scored.reduce((a, s) => a + s.probability, 0);
  console.log(`  softmax olasiligi max fark: ${maxProbDiff.toExponential(3)}`);
  console.log(`  olasilik toplami (1.0 olmali): ${probSum.toFixed(10)}`);

  const EPS = 1e-9;
  const kontrol1Pass = maxZDiff < EPS && maxContribDiff < EPS && maxScoreDiff < EPS && maxProbDiff < EPS && Math.abs(probSum - 1) < 1e-6;
  console.log(`  >>> KONTROL 1: ${kontrol1Pass ? "PASS" : "FAIL"}`);

  console.log(`\n=== KONTROL 2: aile + iliskisel + eksik-veri katkilari toplami = nihai skor ===`);
  let maxFamilySumDiff = 0;
  const familyRows: { no: number; name: string; familySum: number; totalScore: number; diff: number }[] = [];
  for (const s of result.scored) {
    const explain = result.explain.get(s.no)!;
    // explainRunner zaten tum kodlari (saf aileler + 8 egitilen iliski, hepsi model.stats'ta)
    // tek bir listede donduruyor - family etiketine gore grupluyoruz (GEN_PEDIGRI, YET, FRM,
    // PMZ, TMP, JOK/JOKEY, ANT, KIL, DAV, RAK, INTERACTION).
    const familySum = explain.rows.reduce((acc, r) => acc + r.scoreContribution + r.missingIndicatorContribution, 0);
    const diff = Math.abs(familySum - explain.totalScore);
    if (diff > maxFamilySumDiff) maxFamilySumDiff = diff;
    const scoreDiff = Math.abs(explain.totalScore - s.score);
    familyRows.push({ no: s.no, name: s.name, familySum, totalScore: explain.totalScore, diff: Math.max(diff, scoreDiff) });
  }
  for (const f of familyRows) {
    console.log(`  #${f.no} ${f.name}: aile-katki-toplami=${f.familySum.toFixed(6)} explainRunner.totalScore=${f.totalScore.toFixed(6)} fark=${f.diff.toExponential(3)}`);
  }
  const kontrol2Pass = maxFamilySumDiff < EPS;
  console.log(`  >>> KONTROL 2: ${kontrol2Pass ? "PASS" : "FAIL"} (max fark: ${maxFamilySumDiff.toExponential(3)})`);

  console.log(`\n=== SONUC ===`);
  console.log(`Kontrol 1 (ham->z->katsayi->skor->softmax): ${kontrol1Pass ? "PASS" : "FAIL"}`);
  console.log(`Kontrol 2 (aile+iliski+eksik-veri toplami = nihai skor): ${kontrol2Pass ? "PASS" : "FAIL"}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
