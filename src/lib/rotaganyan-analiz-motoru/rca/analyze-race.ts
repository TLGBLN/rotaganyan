// ROTAGANYAN ANALİZ MOTORU — RCA: TEK YARIŞ orkestratörü (Faz 2).
//
// Eski RCA'dan (root-cause.service.ts) FARKI: (a) STALE denetimi Faz 1'in
// snapshot-integrity.ts'inden GEÇMEDEN HİÇBİR kayıt işlenmez (eski RCA bunu ayırt
// edemiyordu — "OLCULMEDI" ile "bayat snapshot" aynı kefeye giriyordu); (b) "kaçırma"
// Top-6 değil Top-1/Top-3 (bu motorda öncelik orada); (c) AGF SKORA GİRMEZ — yalnız ayrı,
// karşılaştırmalı bir bilgi olarak gösterilir, hiçbir kategoriye KARAR VERDİRMEZ (eski
// RCA'nın "AGF asla model/sinyal adayı olamaz" ilkesiyle AYNI, burada da uygulanıyor).
//
// root-cause.service.ts'e DOKUNMAZ, ondan BAĞIMSIZ (ayrı dosya, ayrı klasör). SALT OKUMA.

import { gatherFaz1V5Historical } from "@/lib/methodology/v5-engine";
import { scoreRace, explainRunner, type FittedModel } from "@/lib/motor-v1/engine/training";
import { buildUnifiedFeatureVectorsForRace, UNIFIED_MODEL_CODES } from "../feature-calculators/unified-feature-vector";
import { computeWeightsFingerprint, validateSnapshot } from "../snapshot-integrity";
import { getCurrentRanEngineVersion } from "../engine-versions";
import { crosscheckAlternativeSignals } from "./alt-signal-crosscheck";
import { computeDemotionDrivers, classifyDemotion, type DemotionDriver, type RootCauseCategory } from "./root-cause-classifier";
import type { AccuraceRun } from "@/lib/accurace/types";

export type MissAnalysis = {
  rivalNo: number;
  rivalName: string;
  demotionDrivers: DemotionDriver[]; // en büyük 5 (rakibi öne çıkaran fark, azalan)
  category: RootCauseCategory;
  evidence: string[];
};

/** Kazananın GÜÇLÜ yönü — "neden kaybetti" (demotionDrivers, rakip-göreli) SORUSUNUN
 *  TERSİ: bu at için TEK BAŞINA (rakipsiz) en olumlu katkı yapan sinyaller. Teslim raporu
 *  Faz 2 madde 3: "sadece neden kaybetti değil, hangi güçlü yönleri vardı ama yetmedi" —
 *  yalnız winnerRank>1 olduğunda dolu (winnerRank===1 ise açıklanacak bir "yetmedi" yok). */
export type WinnerPositiveSignal = {
  code: string;
  rawValue: number | null;
  /** scoreContribution + missingIndicatorContribution — explainRunner'ın SATIR TOPLAMI. */
  totalContribution: number;
};

export type AgfComparison = {
  winnerAgfSirasi: number;
  winnerAgfPayi: number;
  not: string;
};

export type RaceRcaResult =
  | { status: "STALE"; raceId: string; reasons: string[]; not: string }
  | { status: "NO_DATA"; raceId: string }
  | { status: "NO_WINNER_MATCH"; raceId: string }
  | {
      status: "OK";
      raceId: string;
      winnerNo: number;
      winnerName: string;
      winnerRank: number;
      fieldSize: number;
      ranked: { no: number; name: string; probability: number }[];
      top1Miss: MissAnalysis | null; // winnerRank>1 ise dolu
      top3Miss: MissAnalysis | null; // winnerRank>3 ise dolu (top1Miss'ten BAĞIMSIZ, farklı rakip: 3.sıradaki)
      winnerPositiveSignals: WinnerPositiveSignal[] | null; // winnerRank>1 ise dolu (bkz. WinnerPositiveSignal)
      agfComparison: AgfComparison | null;
    };

/**
 * TEK yarış için RCA. `model` çağıran tarafından yüklenir (bu modül hiçbir eğitim/fit
 * yapmaz, hiçbir ağırlık dosyası okumaz — salt-okuma prensibi burada da geçerli).
 * `preloadedAccuraceRuns` opsiyoneldir — çoklu yarış toplu çalıştırmada (bkz.
 * arac-ran-rca-calistir.mts) accuraceKosulari()'nin HER yarış için (hatta aynı yarış içinde
 * HEM buildUnifiedFeatureVectorsForRace HEM crosscheckAlternativeSignals tarafından) tekrar
 * tekrar çağrılmasını önler — tek bir üst-seviye fetch, tüm raceId'ler arasında paylaşılır.
 * AYNI disiplin gatherFaz1V5Historical için de BU fonksiyon içinde uygulanır (bkz. aşağıdaki
 * `faz1` değişkeni, Faz 3 PERF yorumu) — raceId başına BİR KEZ çekilir, üç kullanım noktasına
 * (feature build + alt-signal crosscheck + AGF karşılaştırması) PAYLAŞILIR.
 */
export async function analyzeRaceDemotion(
  raceId: string,
  model: FittedModel<string>,
  winnerNo: number,
  preloadedAccuraceRuns?: AccuraceRun[]
): Promise<RaceRcaResult> {
  // FAZ 3 PERF (teslim raporu madde 1 — GERÇEK profiling bulgusu): gatherFaz1V5Historical
  // (v5-engine.ts, 11 paralel alt-sorgu/hesaplamalı AĞIR fonksiyon) ÖNCEDEN BU OTURUMDA
  // raceId başına ÜÇ KEZ çağrılıyordu (buildUnifiedFeatureVectorsForRace içinde, SONRA
  // crosscheckAlternativeSignals içinde TEKRAR, SONRA aşağıdaki AGF karşılaştırması için
  // DOĞRUDAN). Burada BİR KEZ çekilip HER ÜÇ kullanım noktasına taşınır — v5-engine.ts'in
  // KENDİSİ DEĞİŞMEDİ (V5.46.1 BİREBİR aynı davranır), yalnız RAN'ın KENDİ çağrı grafiği
  // içindeki tekrar ELENİR.
  const faz1 = await gatherFaz1V5Historical(raceId);

  const { vectors } = await buildUnifiedFeatureVectorsForRace(raceId, preloadedAccuraceRuns, faz1);
  if (vectors.length === 0) return { status: "NO_DATA", raceId };

  // --- FAZ 1 KAPISI: STALE ise hiçbir şey işlenmez (eski RCA'nın OLCULMEDI disiplini) ---
  const fingerprint = computeWeightsFingerprint(model);
  const currentVersion = getCurrentRanEngineVersion();
  for (const v of vectors) {
    const validation = validateSnapshot(
      { engineVersion: currentVersion.surum, weightsFingerprint: fingerprint, signals: v.signals.map((s) => ({ code: s.code, raw: s.rawValue, observed: s.observed, reliability: s.observed ? 1 : 0 })) },
      { expectedCodes: UNIFIED_MODEL_CODES, expectedFingerprint: fingerprint, expectedEngineVersion: currentVersion.surum }
    );
    if (validation.status === "STALE") {
      return { status: "STALE", raceId, reasons: validation.reasons, not: "Bu yarış pattern istatistiğine KATILMAZ — eski RCA'daki OLCULMEDI deseniyle AYNI disiplin." };
    }
  }

  const scored = scoreRace(vectors, model);
  const ranked = [...scored].sort((a, b) => b.probability - a.probability);
  const winnerIdx = ranked.findIndex((r) => r.no === winnerNo);
  if (winnerIdx === -1) return { status: "NO_WINNER_MATCH", raceId };
  const winnerRank = winnerIdx + 1;

  const probs = ranked.map((r) => r.probability);
  const fieldProbabilitySpread = Math.max(...probs) - Math.min(...probs);
  const allAbsBeta = model.beta.filter((_, i) => model.names[i].endsWith("_z")).map((b) => Math.abs(b));

  const winnerVec = vectors.find((v) => v.no === winnerNo)!;
  const winnerExplain = explainRunner(winnerVec, model);

  const altRowsForRace = await crosscheckAlternativeSignals(raceId, preloadedAccuraceRuns, faz1);
  const altRowsForWinner = altRowsForRace.get(winnerNo) ?? [];

  async function miss(rivalNo: number): Promise<MissAnalysis> {
    const rivalVec = vectors.find((v) => v.no === rivalNo)!;
    const rivalExplain = explainRunner(rivalVec, model);
    const drivers = computeDemotionDrivers(winnerExplain.rows, rivalExplain.rows);
    const topCode = drivers[0]?.code ?? null;
    const altDisagreement = topCode ? !!altRowsForWinner.find((r) => r.canonical === topCode)?.rankDisagreement : false;
    const classification = classifyDemotion({
      drivers,
      winnerRowsByCode: new Map(winnerExplain.rows.map((r) => [r.code, r])),
      allAbsBetaForComparison: allAbsBeta,
      fieldProbabilitySpread,
      topDriverHasAltDisagreement: altDisagreement,
    });
    return { rivalNo, rivalName: rivalVec.name, demotionDrivers: drivers.slice(0, 5), category: classification.category, evidence: classification.evidence };
  }

  const top1Miss = winnerRank > 1 ? await miss(ranked[0].no) : null;
  const top3Miss = winnerRank > 3 ? await miss(ranked[2].no) : null;

  // Faz 2 madde 3: kazananın rakipsiz, TEK BAŞINA en olumlu katkılı sinyalleri — "güçlü
  // yönleri vardı ama yetmedi" sorusunun cevabı. demotionDrivers'tan BAĞIMSIZ (orada rakip-
  // göreli fark sıralanır, burada kazananın KENDİ satırları, yalnız pozitif katkı > 0).
  const winnerPositiveSignals: WinnerPositiveSignal[] | null =
    winnerRank > 1
      ? winnerExplain.rows
          .map((r) => ({ code: r.code, rawValue: r.rawValue, totalContribution: r.scoreContribution + r.missingIndicatorContribution }))
          .filter((r) => r.totalContribution > 0)
          .sort((a, b) => b.totalContribution - a.totalContribution)
          .slice(0, 5)
      : null;

  let agfComparison: AgfComparison | null = null;
  const winnerFaz1 = faz1?.runners.find((r) => r.no === winnerNo);
  if (winnerFaz1) {
    agfComparison = {
      winnerAgfSirasi: winnerFaz1.agfSirasi,
      winnerAgfPayi: winnerFaz1.agfPayi,
      not: "AGF bu motorun skoruna HİÇ girmiyor (yapısal) — yalnız 'piyasa bu kazananı kaçırdı mı' bilgisi, hiçbir kök-neden kategorisine karar verdirilmez.",
    };
  }

  return {
    status: "OK",
    raceId,
    winnerNo,
    winnerName: winnerVec.name,
    winnerRank,
    fieldSize: vectors.length,
    ranked: ranked.map((r) => ({ no: r.no, name: r.name, probability: r.probability })),
    top1Miss,
    top3Miss,
    winnerPositiveSignals,
    agfComparison,
  };
}
