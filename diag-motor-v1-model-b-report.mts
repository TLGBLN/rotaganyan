// READ-ONLY. KONTROLLÜ KATSAYI ÖĞRENME RAPORU (kullanıcı onayı, 2026-10-19). Adımlar:
// 1) 150-yarislik onbellekte YENİ aile kodlarindan HANGİLERİ GERÇEKTEN var - net sayim.
// 2) Model A (degismedi) ve Model B'yi (GEN_SIRE_PMZ_01 + 3 yeniden-adlandirilmis iliski)
//    AYNI onbellekten, AYNI DEFAULT_FIT_OPTIONS ile fit et - 0 yeni DB sorgusu.
// 3) Holdout LogLoss/Top1/Top3 karsilastirmasinin, 2026-10-17'deki ONAYLANMIS
//    ab-compare-result.json ile BIREBIR AYNI oldugunu dogrula (parite kaniti).
// 4) predictRaceV1()'i Model B ile GERCEK bir yariste calistirip model sozlesmesini goster.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { scoreRace, SIGNAL_CODES, computeFeatureStats, fitModel, DEFAULT_FIT_OPTIONS, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { fitModelBFromCache, cacheToTrainingRaces, MODEL_B_CODES, MODEL_B_RELATIONAL_CODES, MODEL_B_VERSION, type CachedRaceShape } from "./src/lib/motor-v1/engine/model-b-relational";
import { predictRaceV1 } from "./src/lib/motor-v1/engine/predict-v1";
import { EXCLUDED_FROM_SCORING } from "./src/lib/motor-v1/engine/predict-v1";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const CACHE_PATH = "src/lib/motor-v1/artifacts/ab-feature-cache.json";

const NOT_IN_CACHE_CHECK = [
  "GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", // ham GEN seviyeleri (carpimdan ONCE)
  "ANT_TREND30", "DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI", "RAK_H2H_01", "RAK_GAP_01",
  "IDMAN_01", "JOKEY_TREND30", "KULVAR_01_HAM",
  "PIST_DURUM_01", "DAV_START_RISK", // yapisal olarak disarida (PIT/secilim-yanliligi)
  "GEN_PMZ_YET_01", "YET_PMZ_01", "FRM_GEN_01", "ANT_FRM_01", "TMP_DAV_01", "TMP_DAV_KULVAR_01",
  "FRM_GALOP_ANT_01", "YET_PMZ_RAK_01", "KIL_PMZ_YET_01", "RAK_YET_TMP_01",
];

function top1Hit(scored: { no: number; probability: number }[], winnerNo: number | null) {
  if (winnerNo == null || scored.length === 0) return false;
  return [...scored].sort((a, b) => b.probability - a.probability)[0].no === winnerNo;
}
function top3Hit(scored: { no: number; probability: number }[], winnerNo: number | null) {
  if (winnerNo == null) return false;
  return [...scored].sort((a, b) => b.probability - a.probability).slice(0, 3).some((s) => s.no === winnerNo);
}
function winnerProb(scored: { no: number; probability: number }[], winnerNo: number | null) {
  return winnerNo == null ? null : scored.find((s) => s.no === winnerNo)?.probability ?? null;
}
function logLoss(probs: (number | null)[]) {
  const p = probs.filter((x): x is number => x != null && x > 0);
  return p.length ? -p.reduce((s, x) => s + Math.log(x), 0) / p.length : null;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as Record<string, CachedRaceShape>;

  // --- ADIM 1: onbellekte GERCEKTEN ne var ---
  const allCodes = new Set<string>();
  const observedCount = new Map<string, number>();
  for (const r of Object.values(cache)) {
    for (const runner of r.runners) {
      for (const v of runner.vectors) {
        allCodes.add(v.code);
        if (v.observed) observedCount.set(v.code, (observedCount.get(v.code) ?? 0) + 1);
      }
    }
  }
  console.log("=== ADIM 1: ONBELLEKTE GERCEKTEN BULUNAN KODLAR ===");
  console.log("Saf-20 disinda bulunan kodlar:", [...allCodes].filter((c) => !(SIGNAL_CODES as readonly string[]).includes(c)).sort());
  for (const code of MODEL_B_RELATIONAL_CODES) {
    // Not: onbellekte ESKI adlarla kayitli (GEN_SIRE_PMZ_01 haric) - CODE_RENAME_MAP tersini kontrol
    const legacy = code === "FRM_IDMAN_DINLENME_01" ? "INT_FORM_GALOP_DINLENME_01" : code === "JOK_FRM_TMP_01" ? "INT_JOKEY_FORM_TEMPO_01" : code === "TMP_KULVAR_01" ? "INT_TEMPO_STIL_KULVAR_01" : code;
    console.log(`  ${code} (onbellek adi: ${legacy}): observed=${observedCount.get(legacy) ?? 0}`);
  }
  console.log("Onbellekte YOK oldugu dogrulanan (eski aile) kodlar:");
  for (const code of NOT_IN_CACHE_CHECK) {
    const present = allCodes.has(code);
    console.log(`  ${code}: ${present ? "VAR (BEKLENMIYORDU!)" : "yok (dogrulandi)"}`);
  }

  // --- ADIM 2: Model A + Model B fit (0 yeni DB sorgusu) ---
  const trainSet: TrainingRace[] = cacheToTrainingRaces(cache, lock.trainRaceIds);
  const holdoutSet: TrainingRace[] = cacheToTrainingRaces(cache, lock.holdoutRaceIds);
  const statsA = computeFeatureStats(trainSet.flatMap((t) => t.vectors));
  const modelA = fitModel(trainSet, statsA, DEFAULT_FIT_OPTIONS);
  const modelB = fitModelBFromCache(cache, lock.trainRaceIds);
  console.log(`\n=== ADIM 2: FIT ===\nModel A: nRacesUsed=${modelA.nRacesUsed}, kod=${modelA.stats.size}\nModel B (${MODEL_B_VERSION}): nRacesUsed=${modelB.nRacesUsed}, kod=${modelB.stats.size}`);

  // --- ADIM 3: Holdout karsilastirma + onaylanmis sonuçla parite ---
  const aWinP: (number | null)[] = [], bWinP: (number | null)[] = [];
  let aTop1 = 0, aTop3 = 0, bTop1 = 0, bTop3 = 0;
  for (const t of holdoutSet) {
    const scoredA = scoreRace(t.vectors, modelA);
    const scoredB = scoreRace(t.vectors, modelB);
    if (top1Hit(scoredA, t.winnerNo)) aTop1++;
    if (top3Hit(scoredA, t.winnerNo)) aTop3++;
    if (top1Hit(scoredB, t.winnerNo)) bTop1++;
    if (top3Hit(scoredB, t.winnerNo)) bTop3++;
    aWinP.push(winnerProb(scoredA, t.winnerNo));
    bWinP.push(winnerProb(scoredB, t.winnerNo));
  }
  const n = holdoutSet.length;
  console.log(`\n=== ADIM 3: HOLDOUT (n=${n}) ===`);
  console.log(`Model A: top1=${(aTop1 / n * 100).toFixed(1)}% top3=${(aTop3 / n * 100).toFixed(1)}% logLoss=${logLoss(aWinP)?.toFixed(4)}`);
  console.log(`Model B: top1=${(bTop1 / n * 100).toFixed(1)}% top3=${(bTop3 / n * 100).toFixed(1)}% logLoss=${logLoss(bWinP)?.toFixed(4)}`);
  const prior = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-compare-result.json", "utf8"));
  const parityOk = Math.abs((logLoss(aWinP) ?? 0) - prior.modelA.logLoss) < 1e-9 && Math.abs((logLoss(bWinP) ?? 0) - prior.modelB.logLoss) < 1e-9;
  console.log(`Parite (2026-10-17 onayli ab-compare-result.json ile BIREBIR ayni): ${parityOk ? "DOGRULANDI" : "FARKLI - INCELE"}`);

  // --- ADIM 4: predictRaceV1 + model sozlesmesi, GERCEK yarista, Model B ile ---
  const race = await db.race.findFirst({
    where: { result: { isNot: null }, runners: { some: { sire: { not: null }, tjkAtId: { not: null } } } },
    orderBy: { raceDay: { date: "desc" } },
    select: { id: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  if (!race) { console.log("yaris yok"); return; }
  console.log(`\n=== ADIM 4: predictRaceV1 (Model B) — ${race.id} ${race.raceDay.date.toISOString().slice(0, 10)} ${race.raceDay.hippodrome.name} ===`);
  const result = await predictRaceV1(race.id, modelB);
  if (!result) { console.log("predictRaceV1 null"); return; }

  for (const f of result.contract.families) {
    const durum = f.representedInModel ? (f.pendingCodes.length > 0 ? "KISMEN TEMSIL" : "TEMSIL EDILIYOR") : "KATSAYI BEKLIYOR";
    console.log(`  [${durum}] ${f.family}: scored=${JSON.stringify(f.scoredCodes)} pending=${JSON.stringify(f.pendingCodes)} excluded=${JSON.stringify(f.excludedCodes)}`);
  }
  console.log(`Tam/kismi temsil edilen aile sayisi: ${10 - result.contract.fullyPendingFamilies.length}/10`);
  console.log(`Katsayi bekleyen aileler: ${JSON.stringify(result.contract.fullyPendingFamilies)}`);
  const scoredInt = result.contract.interactions.filter((i) => i.scored).length;
  const excludedInt = result.contract.interactions.filter((i) => i.excluded).length;
  console.log(`Iliskiler: ${result.contract.interactions.length} toplam, ${scoredInt} skorda, ${excludedInt} disarida-birakilmis, ${result.contract.interactions.length - scoredInt - excludedInt} katsayi bekliyor`);
  console.log(`\nEXCLUDED_FROM_SCORING (yapisal, degismedi): ${JSON.stringify([...EXCLUDED_FROM_SCORING.keys()])}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
