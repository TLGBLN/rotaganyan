// ROTAGANYAN ANALİZ MOTORU v1.0 — SAF MODEL + AGF AİLESİ BİRLEŞTİRME katmanı.
//
// KULLANICI TALİMATI (2026-10-18): "C için iki yaklaşım: (1) saf motorun çıktısını
// SABİTLEYİP AGF ile küçük, düzenlileştirilmiş bir birleşim modeli eğitmek, (2) saf ve AGF
// sinyallerini ortak modelde yeniden eğitmek. İlk yöntemi ÖNCELİKLENDİR."
//
// Bu dosya YENİDEN fit edici yazmaz — training.ts'teki (artık generic) computeFeatureStats/
// toModelVector/fitModel/scoreRace/explainRunner AYNEN reuse edilir. İki küçük köprü
// fonksiyonu sağlar:
//   - buildCombinerVector: Yaklaşım 1 (ÖNCELİKLİ) — DONDURULMUŞ saf model skorunu TEK bir
//     sentetik "PURE_SCORE" sinyali olarak AGF_01/02 ile YAN YANA koyar; training.ts bunu
//     sıradan bir SIGNAL_CODES listesiymiş gibi (["PURE_SCORE","AGF_01","AGF_02"]) eğitir —
//     saf modelin 20 sinyali YENİDEN FIT EDİLMEZ (A dondurulmuş kalır).
//   - mergeAgfIntoVectors: Yaklaşım 2 (SONRA, istenirse) — AGF sinyallerini saf
//     FeatureVector'ların ÜZERİNE ekler, 22 kodluk (20+2) TEK ortak eğitim mümkün olur.
//     `buildFeatureVectorForRunner`'ın KENDİSİ bu dosyada HİÇ çağrılmaz/değiştirilmez.

import type { RunnerFeatureVector, SignalEntry } from "./feature-vector";
import type { AgfSignalEntry } from "../features/agf";
import { SIGNAL_CODES, type SignalCode } from "./training";

/** Yaklaşım 1 (ÖNCELİKLİ, dondurulmuş saf skor + AGF). `pureScore`, A modelinin (fitModel
 *  SIGNAL_CODES ile, AGF'siz) scoreRace çıktısındaki `.score`'udur (olasılık DEĞİL — ham
 *  koşullu-logit skoru, softmax öncesi; AYNI ölçekte standardize edilmesi gerektiği için
 *  olasılığa DÖNÜŞTÜRÜLMEDEN taşınır). */
export type CombinerSignalCode = "PURE_SCORE" | AgfSignalEntry["code"];

export function buildCombinerVector(
  raceId: string,
  no: number,
  name: string,
  pureScore: number | null,
  agfSignals: AgfSignalEntry[]
): RunnerFeatureVector {
  const pureEntry: SignalEntry = {
    code: "PURE_SCORE",
    family: "COMBINER",
    rawValue: pureScore,
    observed: pureScore != null && Number.isFinite(pureScore),
    coverageState: null,
    asOfSafe: true,
    missingReason: pureScore == null ? "saf model bu at için skor üretemedi (bkz. A modelinin kendi eksik-veri raporu)" : null,
  };
  return { raceId, no, name, tjkAtId: null, jockey: null, signals: [pureEntry, ...agfSignals] };
}

export const COMBINER_CODES: readonly CombinerSignalCode[] = ["PURE_SCORE", "AGF_01", "AGF_02"] as const;

/** Yaklaşım 2 (SONRA) — AGF sinyallerini saf FeatureVector'ların KOPYASINA ekler (orijinal
 *  nesne MUTATE edilmez — saf motorun çıktısı başka bir yerde yanlışlıkla değişmiş gibi
 *  görünmesin diye). Dönen vektörler SIGNAL_CODES ∪ {"AGF_01","AGF_02"} ile eğitilebilir. */
export function mergeAgfIntoVectors(
  pureVectors: RunnerFeatureVector[],
  agfByNo: Map<number, AgfSignalEntry[]>
): RunnerFeatureVector[] {
  return pureVectors.map((v) => ({ ...v, signals: [...v.signals, ...(agfByNo.get(v.no) ?? [])] }));
}

export const PURE_PLUS_AGF_CODES: readonly (SignalCode | AgfSignalEntry["code"])[] = [...SIGNAL_CODES, "AGF_01", "AGF_02"] as const;
