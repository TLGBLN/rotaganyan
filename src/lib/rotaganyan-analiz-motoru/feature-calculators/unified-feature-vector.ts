// ROTAGANYAN ANALİZ MOTORU — ORTAK ÖZELLİK VEKTÖRÜ (D + V1 birleşimi).
//
// Bu dosya PR#12'nin sözleşme katmanını (signal-integration.ts::buildUnifiedSignalVector)
// GERÇEK hesaplayıcılara bağlar:
//   - D (Saf Model, 15 sinyal): ./saf-model-signals.ts (düzeltilmiş PS + evidenceObserved)
//   - V1 (10 aile, GEN/RAK/ANT/JOK/TMP/KULVAR/FRM/PMZ/YET/KIL): @/lib/motor-v1/engine/unified-family-engine
//
// Çift sayım, buildUnifiedSignalVector'ın KENDİ denetimiyle (canonical başına TEK seçim,
// PRIMARY/INCLUDE dışındakiler diagnostics'e düşer) YAPISAL olarak engellenir — burada AYRICA
// hiçbir "aynı işi yapan iki sinyali topla" mantığı YOK. AGF ailesi hiçbir koddan gelmez.
//
// EĞİTİM/CANLI PARİTE: bu modüldeki `buildUnifiedFeatureVectorsForRace` tek fonksiyon; eğitim
// verisi toplama script'i VE (ileride) canlı tahmin AYNI fonksiyonu çağırır — iki ayrı kopya YOK.

import { db } from "@/lib/db";
import { computeSafModelSignalsForRace, type SafModelRaceSignals } from "./saf-model-signals";
import { computeUnifiedFamiliesForRace, type UnifiedRunnerResult } from "@/lib/motor-v1/engine/unified-family-engine";
import { tempoContextFromRuns } from "@/lib/motor-v1/features/tempo";
import { EXCLUDED_FROM_SCORING } from "@/lib/motor-v1/engine/predict-v1";
import { buildUnifiedSignalVector, SIGNAL_SPECS, type SignalObservation, type SignalSource } from "../signal-integration";
import type { AccuraceRun } from "@/lib/accurace/types";
import type { RunnerFeatureVector, SignalEntry } from "@/lib/motor-v1/engine/feature-vector";
import type { Faz1SonucV5 } from "@/lib/methodology/v5-engine";
import type { FieldSizeResolverFn } from "@/lib/motor-v1/features/history-source";

/** V1 unifiedVector'dan, bu entegrasyonda GERÇEKTEN kullanılacak (BLOCKED/ALTERNATIVE/
 *  interaction DIŞINDA) 20 kod — signal-integration.ts::SIGNAL_SPECS'teki "V1" + "INCLUDE"
 *  kayıtlarıyla BİREBİR (GEN_SIRE_01/RAK_H2H_01/HIZ_01/TEMPO_02-04 kasıtlı olarak YOK —
 *  bunlar ALTERNATIVE, D'nin eşdeğer PRIMARY sinyali seçildi). */
const V1_INCLUDED_CODES = [
  "GEN_DAM_01", "GEN_DAMSIRE_01",
  "RAK_GAP_01",
  "ANT_TREND30",
  "JOKEY_01", "JOKEY_02", "JOKEY_04", "JOKEY_TREND30",
  "TEMPO_01",
  "KULVAR_01_HAM",
  "FORM_01", "FORM_02", "FORM_03",
  "PMZ_01", "PMZ_02", "FORM_x_ZEMIN",
  "SINIF_01",
  "KILO_01", "KILO_02", "KILO_03", "KILO_04",
] as const;

/** D (Saf Model)'den gelen 15 kod — registry'de HEPSİ PRIMARY/INCLUDE (hiç ALTERNATIVE/BLOCKED
 *  yok), bu yüzden tamamı doğrudan beslenir. */
const D_INCLUDED_CODES = [
  "idmJokey", "h2hNetSkor", "hizDerecesi", "zeminToleransi", "zeminMesafeDeneyim",
  "sonIdmanSprint", "takiDegisikligi", "yarisGidisatiSkoru", "sireOrani",
  "ACC_CLOSE_RES", "ACC_LATE", "ACC_SPEED", "PS_front", "PS_lone", "PS_closerFit",
] as const;

const familyBySourceCode = new Map(SIGNAL_SPECS.map((s) => [`${s.source}:${s.code}`, s.family]));

// SAVUNMA HATTI (modül yükleme zamanında, runtime'da bir kere): PIT-güvensiz/seçilim-yanlılıklı
// V1 kodları (predict-v1.ts::EXCLUDED_FROM_SCORING) bu listeye İLERİDE yanlışlıkla eklenirse
// hemen patlar — "sessizce skora sızma" imkansız hale gelir.
for (const code of V1_INCLUDED_CODES) {
  if (EXCLUDED_FROM_SCORING.has(code)) {
    throw new Error(`unified-feature-vector.ts: ${code} PIT-güvensiz/seçilim-yanlılıklı (EXCLUDED_FROM_SCORING) — V1_INCLUDED_CODES'a ASLA eklenemez.`);
  }
}

export type UnifiedRawSources = { safResult: SafModelRaceSignals | null; v1Results: UnifiedRunnerResult[] };

export type UnifiedFeatureBuildResult = {
  /** Sadece RCA açıkça istediğinde: karşılaştırma için ikinci hesaplamayı önler. */
  rawSources?: UnifiedRawSources;
  vectors: RunnerFeatureVector[];
  diagnostics: { no: number; source: SignalSource; code: string; reason: string }[];
  /** Runner.id (Prisma cuid, Pick.runnerId ile AYNI alan/tip) — no'ya göre. RunnerFeatureVector
   *  (motor-v1'in paylaşılan, eğitim/V1.0 ile ORTAK tipi) tjkAtId taşır ama Runner.id'yi KASITLI
   *  OLARAK taşımaz (o tip genişletilirse eğitim JSON cache'leri/diğer çağıranlar etkilenir) —
   *  bu yüzden snapshot'ın runnerId alanını doldurmak isteyen çağıranlar (route.ts) AYRI bir DB
   *  sorgusu YAPMADAN burada taşınan haritayı kullanır. */
  runnerIdByNo: Map<number, string | null>;
};

/**
 * TEK yarış için D+V1 birleşik, çift-sayımsız özellik vektörlerini üretir. Hem eğitim veri
 * toplama script'i hem (ileride) canlı tahmin yolu AYNI fonksiyonu çağırmalı — iki ayrı
 * kopya YAZILMAMALI.
 */
export async function buildUnifiedFeatureVectorsForRace(
  raceId: string,
  preloadedAccuraceRuns?: AccuraceRun[],
  // FAZ 3 PERF (bkz. saf-model-signals.ts'teki AYNI isimli parametrenin yorumu) — analyze-race.ts
  // raceId başına BİR KEZ gatherFaz1V5Historical çağırıp buraya taşır, bu fonksiyon KENDİ
  // tekrar sorgusunu YAPMAZ. Verilmezse (ör. eğitim veri toplama script'leri) davranış AYNI:
  // computeSafModelSignalsForRace kendi taze çağrısını yapar.
  preloadedFaz1?: Faz1SonucV5 | null,
  sharedFieldSizeResolver?: FieldSizeResolverFn,
  captureRcaRawSources = false,
  onRcaPhase?: (stage: string) => void
): Promise<UnifiedFeatureBuildResult> {
  // RCA-only: D ve V1 TEMPO aynı Accurace snapshot dizisini kullanır; prefetching
  // dışında canlı/production çağrılarında eski loadTempoContext davranışı korunur.
  const rcaTempo = captureRcaRawSources && preloadedAccuraceRuns
    ? tempoContextFromRuns(preloadedAccuraceRuns)
    : undefined;
  // RCA profil aşamaları asıl paralel iki hesaplayıcıyı birbirinden ayırır.
  // Her ikisi eskisi gibi Promise.all içinde eşzamanlı çalışır.
  const [safResult, v1Results, runnerMeta] = await Promise.all([
    (async () => {
      onRcaPhase?.("D_SIGNALS_STARTED");
      const result = await computeSafModelSignalsForRace(raceId, preloadedAccuraceRuns, preloadedFaz1);
      onRcaPhase?.("D_SIGNALS_FINISHED");
      return result;
    })(),
    (async () => {
      onRcaPhase?.("V1_FAMILIES_STARTED");
      const result = await computeUnifiedFamiliesForRace(raceId, undefined, sharedFieldSizeResolver, rcaTempo, onRcaPhase);
      onRcaPhase?.("V1_FAMILIES_FINISHED");
      return result;
    })(),
    db.runner.findMany({ where: { raceId, scratched: false }, select: { id: true, no: true, name: true, tjkAtId: true, jockey: true } }),
  ]);
  const extra = captureRcaRawSources ? { rawSources: { safResult, v1Results } } : {};
  if (!safResult || v1Results.length === 0) return { vectors: [], diagnostics: [], runnerIdByNo: new Map(), ...extra };

  const safByNo = new Map(safResult.runners.map((r) => [r.no, r]));
  const v1ByNo = new Map(v1Results.map((r) => [r.no, r]));
  const metaByNo = new Map(runnerMeta.map((r) => [r.no, r]));

  const vectors: RunnerFeatureVector[] = [];
  const diagnostics: UnifiedFeatureBuildResult["diagnostics"] = [];

  for (const no of metaByNo.keys()) {
    const safRunner = safByNo.get(no);
    const v1Runner = v1ByNo.get(no);
    if (!safRunner || !v1Runner) continue; // bir taraf bu koşucu için hesaplanamadıysa dahil edilmez (uydurma yok)

    const inputs: SignalObservation[] = [];
    for (const code of D_INCLUDED_CODES) {
      const s = safRunner.signals.find((x) => x.code === code);
      if (!s) continue;
      const rel = Number.isFinite(s.reliability) ? s.reliability : 1; // 0 GERÇEK bir güvenilirlik değeri olabilir — "||" ile yanlışlıkla 1'e YUVARLANMAZ
      inputs.push({ source: "D", code, raw: s.raw, observed: s.observed, asOfSafe: true, reliability: s.observed ? Math.min(1, Math.max(0, rel)) : 0 });
    }
    for (const code of V1_INCLUDED_CODES) {
      const s = v1Runner.unifiedVector.find((x) => x.code === code);
      if (!s) continue;
      inputs.push({ source: "V1", code, raw: s.rawValue, observed: s.observed, asOfSafe: true, reliability: s.observed ? 1 : 0 });
    }

    const { features, diagnostics: runnerDiag } = buildUnifiedSignalVector(inputs);
    for (const d of runnerDiag) diagnostics.push({ no, ...d });

    const meta = metaByNo.get(no)!;
    const signals: SignalEntry[] = features.map((f) => ({
      code: f.canonical,
      family: familyBySourceCode.get(`${f.source}:${f.sourceCode}`) ?? "UNKNOWN",
      rawValue: f.raw,
      observed: f.observed,
      coverageState: null,
      asOfSafe: true,
      missingReason: f.observed ? null : `gözlemsiz (${f.source}:${f.sourceCode})`,
    }));

    vectors.push({
      raceId,
      no,
      name: meta.name,
      tjkAtId: meta.tjkAtId,
      jockey: meta.jockey,
      signals,
    });
  }

  const runnerIdByNo = new Map(runnerMeta.map((r) => [r.no, r.id]));
  return { vectors, diagnostics, runnerIdByNo, ...extra };
}

/** Bu entegrasyonda GERÇEKTEN eğitime sunulan canonical kod listesi (35 kod) — training.ts'in
 *  generic `codes` argümanına verilir. SIGNAL_SPECS'ten TÜRETİLİR (elle kopyalanmış, senkronizasyon
 *  dışı kalabilecek ikinci bir liste DEĞİL). */
export const UNIFIED_MODEL_CODES: readonly string[] = (() => {
  const wanted = new Set<string>([
    ...D_INCLUDED_CODES.map((c) => `D:${c}`),
    ...V1_INCLUDED_CODES.map((c) => `V1:${c}`),
  ]);
  const canonical: string[] = [];
  const seen = new Set<string>();
  for (const spec of SIGNAL_SPECS) {
    if (!wanted.has(`${spec.source}:${spec.code}`)) continue;
    if (spec.decision !== "PRIMARY" && spec.decision !== "INCLUDE") {
      throw new Error(`UNIFIED_MODEL_CODES: ${spec.source}:${spec.code} PRIMARY/INCLUDE değil (${spec.decision})`);
    }
    if (seen.has(spec.canonical)) throw new Error(`UNIFIED_MODEL_CODES: canonical çift sayım: ${spec.canonical}`);
    seen.add(spec.canonical);
    canonical.push(spec.canonical);
  }
  return canonical;
})();
