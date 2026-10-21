// READ-ONLY (modeli diske yazar, DB'ye yazmaz, YENI DB sorgusu YOK). ROTAGANYAN ANALIZ
// MOTORU V1.0 — HIZLI ILK EGITIM (kullanici talimati, 2026-10-20: "mevcut 150 yarislik
// onbellegi kullan, yeni veri taramasi baslatma"). Bu, 10 ailenin TAMAMININ ogrenildigi
// nihai bir model DEGILDIR - yalniz MEVCUT 150-yarislik onbellekte GERCEKTEN bulunan
// (saf-20 + GEN_SIRE_PMZ_01 + 3 iliski) kodlarin ilk, dakikalar-seviyesinde egitimidir.
// Hangi ailelerin bu onbellekte HIC VERISI OLMADIGI (ANT/DAV/RAK, GEN'in cogu, 9/13 iliski)
// ACIKCA raporlanir - gizlenmez, "tamamlandi" diye sunulmaz.
import fs from "node:fs";
import { computeFeatureStats, fitModel, scoreRace, DEFAULT_FIT_OPTIONS, SIGNAL_CODES, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { cacheToTrainingRaces, MODEL_B_CODES, type CachedRaceShape } from "./src/lib/motor-v1/engine/model-b-relational";
import { FULL_CANDIDATE_CODES } from "./src/lib/motor-v1/engine/trainable-features";

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
// TMP_DAV_KULVAR_01 bilerek FULL_CANDIDATE_CODES'ta da YOK (DAV_START_RISK bagimliligi) - aday listesi 42 + bu = 13 iliski toplami.
const ALL_13_INTERACTIONS = [
  "GEN_PMZ_YET_01", "YET_PMZ_01", "FRM_GEN_01", "FRM_IDMAN_DINLENME_01", "JOK_FRM_TMP_01",
  "ANT_FRM_01", "TMP_DAV_01", "TMP_DAV_KULVAR_01", "FRM_GALOP_ANT_01", "YET_PMZ_RAK_01",
  "KIL_PMZ_YET_01", "RAK_YET_TMP_01", "TMP_KULVAR_01",
];

function top1(s: { no: number; probability: number }[], w: number | null) { if (w == null || s.length === 0) return false; return [...s].sort((a, b) => b.probability - a.probability)[0].no === w; }
function top3(s: { no: number; probability: number }[], w: number | null) { if (w == null) return false; return [...s].sort((a, b) => b.probability - a.probability).slice(0, 3).some((x) => x.no === w); }
function winP(s: { no: number; probability: number }[], w: number | null) { return w == null ? null : s.find((x) => x.no === w)?.probability ?? null; }
function logLoss(probs: (number | null)[]) { const p = probs.filter((x): x is number => x != null && x > 0); return p.length ? -p.reduce((s, x) => s + Math.log(x), 0) / p.length : null; }

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-feature-cache.json", "utf8")) as Record<string, CachedRaceShape>;

  const trainSet: TrainingRace[] = cacheToTrainingRaces(cache, lock.trainRaceIds);
  const holdoutSet: TrainingRace[] = cacheToTrainingRaces(cache, lock.holdoutRaceIds);
  console.log(`TRAIN: ${trainSet.length} yaris. HOLDOUT: ${holdoutSet.length} yaris (daha once incelenmis — ILK KONTROL, bagimsiz nihai test DEGIL).`);

  // --- Bu onbellekte GERCEKTEN hangi aday kodlar var, hangileri HIC YOK ---
  const trainVectorsFlat = trainSet.flatMap((t) => t.vectors);
  const coverage = new Map<string, number>();
  const allCandidates = [...new Set([...SIGNAL_CODES, ...FULL_CANDIDATE_CODES])];
  for (const code of allCandidates) {
    const observed = trainVectorsFlat.filter((v) => v.signals.find((s) => s.code === code)?.observed).length;
    coverage.set(code, trainVectorsFlat.length > 0 ? observed / trainVectorsFlat.length : 0);
  }
  const finalCodes = allCandidates.filter((c) => (coverage.get(c) ?? 0) > 0);
  const zeroCodes = allCandidates.filter((c) => (coverage.get(c) ?? 0) === 0);
  console.log(`\nBu 150-yarislik onbellekte VERISI OLAN kod: ${finalCodes.length} — ${JSON.stringify(finalCodes)}`);
  console.log(`\nBu onbellekte HIC VERISI OLMAYAN (egitime giremeyen) aday kod: ${zeroCodes.length} — ${JSON.stringify(zeroCodes)}`);

  // --- Tek seferlik egitim (kullanici talimati: "tek seferde", lambda aramasi YOK) ---
  const stats = computeFeatureStats(trainVectorsFlat, finalCodes);
  const model = fitModel(trainSet, stats, DEFAULT_FIT_OPTIONS);
  const modelVersion = "rotaganyan-v1.0-ilk-egitim-150cache-2026-10-20";
  console.log(`\nMODEL: ${modelVersion}`);
  console.log(`nRacesUsed=${model.nRacesUsed}, nRacesSkipped=${model.nRacesSkipped}, egitilen kod sayisi=${model.stats.size}`);

  const wp: (number | null)[] = []; let t1 = 0, t3 = 0;
  for (const t of holdoutSet) {
    const s = scoreRace(t.vectors, model);
    if (top1(s, t.winnerNo)) t1++;
    if (top3(s, t.winnerNo)) t3++;
    wp.push(winP(s, t.winnerNo));
  }
  const n = holdoutSet.length;
  const result = { n, top1: t1 / n, top3: t3 / n, logLoss: logLoss(wp) };
  console.log(`\nILK KONTROL (30 yarış, DAHA ÖNCE incelenmiş — bağımsız nihai test değil): top1=${(result.top1*100).toFixed(1)}% top3=${(result.top3*100).toFixed(1)}% logLoss=${result.logLoss?.toFixed(4)}`);

  // --- Aile bazlı GERCEK egitim durumu ---
  console.log(`\n=== AILE DURUMU (10 ailenin TAMAMI DEGIL — yalniz bu onbellekte VERISI OLANLAR) ===`);
  const familyReport: Record<string, unknown> = {};
  for (const fam of FAMILIES) {
    const trainedCodes = finalCodes.filter((c) => FAMILY_OF[c] === fam);
    const allFamCandidates = allCandidates.filter((c) => FAMILY_OF[c] === fam);
    const missingCodes = allFamCandidates.filter((c) => !trainedCodes.includes(c));
    const betas = trainedCodes.map((code) => {
      const idx = model.names.indexOf(`${code}_z` as never);
      return { code, beta_z: model.beta[idx] };
    });
    const durum = trainedCodes.length === 0 ? "EGITILMEDI (bu onbellekte hic veri yok)" : missingCodes.length > 0 ? "KISMEN EGITILDI" : "TAMAMEN EGITILDI (bu aday listesine gore)";
    familyReport[fam] = { durum, trainedCodeCount: trainedCodes.length, betas, missingCodes };
    console.log(`[${durum}] ${fam}: egitilen=${trainedCodes.length} (${trainedCodes.join(",")||"-"}) | eksik=${missingCodes.join(",")||"-"}`);
  }

  // --- 13 iliskinin GERCEK durumu ---
  console.log(`\n=== 13 ILISKI DURUMU ===`);
  const interactionReport = ALL_13_INTERACTIONS.map((code) => {
    const trained = finalCodes.includes(code);
    const reason = code === "TMP_DAV_KULVAR_01" ? "YAPISAL DISARIDA (DAV_START_RISK secilim yanliligi)" : trained ? "EGITILDI" : "bu onbellekte veri yok";
    if (trained) {
      const idx = model.names.indexOf(`${code}_z` as never);
      console.log(`  [EGITILDI] ${code}: beta_z=${model.beta[idx].toFixed(4)}`);
      return { code, status: "EGITILDI", beta_z: model.beta[idx] };
    }
    console.log(`  [YOK] ${code}: ${reason}`);
    return { code, status: "YOK", reason };
  });

  const artifact = {
    modelVersion,
    uyari: "BU, 10 AILENIN TAMAMINI OGRENEN NIHAI BIR MODEL DEGILDIR. Yalniz mevcut 150-yarislik onbellekte GERCEKTEN bulunan verilerle yapilan ILK, hizli egitimdir. ANT/DAV/RAK aileleri ve GEN'in buyuk kismi bu onbellekte HIC YOK - egitilemedi.",
    nTrainRaces: trainSet.length, nTrainRunners: trainVectorsFlat.length, nHoldoutRaces: holdoutSet.length,
    holdoutStatus: "ILK KONTROL - bu 30 yarış daha önce defalarca incelenmiş, bağımsız nihai test OLARAK SUNULMUYOR",
    fitOpts: DEFAULT_FIT_OPTIONS,
    trainedCodes: finalCodes, codesWithNoDataInThisCache: zeroCodes,
    coverageByCode: Object.fromEntries(allCandidates.map((c) => [c, coverage.get(c)])),
    beta: model.beta, names: model.names,
    muSigma: Object.fromEntries([...model.stats.entries()]),
    holdoutResult: result,
    familyReport, interactionReport,
  };
  fs.writeFileSync("C:/tmp/rotaganyan-v1-ilk-egitim-artifact.json", JSON.stringify(artifact, null, 2));
  console.log(`\nArtefakt yazildi: C:/tmp/rotaganyan-v1-ilk-egitim-artifact.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
