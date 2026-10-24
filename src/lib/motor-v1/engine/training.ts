// ROTAGANYAN ANALİZ MOTORU v1.0 — ORTAK EĞİTİM/SKORLAMA bağlantısı.
//
// KULLANICI TALİMATI (2026-10-17): "Tekil sinyaller ile doğrulanmış etkileşimleri ortak bir
// eğitim ve tahmin sistemine bağlayın." Fit edici (gradyan inişi, ridge-düzenlileştirilmiş
// koşullu-logit NLL) YENİDEN YAZILMADI — src/lib/v5461/conditional-logit.ts (fitConditionalLogit/
// raceGradient/raceNll/dot) ve math.ts (softmax) DOĞRUDAN import edildi; bunlar V5.46.1'e
// ÖZGÜ bir katsayı TAŞIMAZ, saf matematik — V5.46.1 katsayıları KULLANILMADI (kullanıcı kuralı).
//
// EKSİK-VERİ SÖZLEŞMESİ (kullanıcı talimatı §4, "aynı sözleşmeyle EĞİTİM ve TAHMİNDE
// uygulanmalı"): her sinyal İKİ model sütunu üretir — z (gözlemliyse standardize değer, YOKSA
// 0/nötr) ve bir AYRI "eksik" gösterge sütunu (0/1). Bu, "sahte sıfır" İLE "gerçek nötr z-skor"
// arasındaki farkı modelin KENDİSİNE görünür kılar (missing-indicator tekniği) — rawValue'nun
// kendisi HİÇBİR ZAMAN uydurulmaz, yalnız STANDARDİZE sütununda nötr bir yer-tutucu kullanılır
// ve BU sahtelik modelin AYRI bir katsayıyla (missing-indicator β'sı) öğrenmesine AÇIKÇA bırakılır.
//
// ÖNEMLİ DÜRÜSTLÜK NOTU: Bu dosyadaki eğitim, GERÇEK (uydurulmamış) ama KÜÇÜK ÖRNEKLEMLİ bir
// KANIT ÇALIŞMASIDIR — zincirin (veri→özellik→eğitim→skor→softmax→açıklama) UÇTAN UCA
// ÇALIŞTIĞINI kanıtlamak için. Nihai/üretim-kalite kalibrasyon İÇİN DEĞİL (örneklem küçük,
// hiperparametreler elle seçildi, interaction terimleri (γ_m·I_im) bu ilk sürümde YOK — yalnız
// ana etkiler Σβ_k·z_ik). MODEL_VERSION alanı bu durumu her raporda AÇIKÇA taşır.

import { db } from "@/lib/db";
import { dot, fitConditionalLogit, type TrainingRunner } from "@/lib/v5461/conditional-logit";
import { softmax } from "@/lib/v5461/math";
import { buildFeatureVectorsForRace, type RunnerFeatureVector } from "./feature-vector";
import type { TempoContext } from "../features/tempo";

export const MODEL_VERSION = "rotaganyan-v1.0-preliminary-smallsample-2026-10-17";

// Eğitime giren sinyal kodları — "registry'de ACTIVE yazması kullanıldığı anlamına gelmez"
// ilkesi burada TERS yönde de geçerli: bu liste KENDİSİ, hangi sinyallerin GERÇEKTEN eğitime
// sunulduğunun TEK doğru kaynağıdır (registry'nin status alanından BAĞIMSIZ okunmalı).
export const SIGNAL_CODES = [
  "FORM_01", "FORM_02", "FORM_03",
  "HIZ_01",
  "SINIF_01",
  "PMZ_01", "PMZ_02", "FORM_x_ZEMIN",
  "TEMPO_01", "TEMPO_02", "TEMPO_03", "TEMPO_04",
  "JOKEY_01", "JOKEY_02", "JOKEY_03", "JOKEY_04",
  "KILO_01", "KILO_02", "KILO_03", "KILO_04",
] as const;
export type SignalCode = (typeof SIGNAL_CODES)[number];

export type FeatureStats<C extends string = SignalCode> = Map<C, { mu: number; sigma: number; nObserved: number }>;

// 2026-10-18 — ROTAGANYAN V1.0 AGF ailesi hazırlığı (kullanıcı onayı): bu dosyadaki fonksiyonlar
// artık sinyal-kodu listesinde GENERIC (<C extends string = SignalCode>). `codes` argümanı
// VERİLMEZSE davranış/çıktı ESKİSİYLE BİREBİR AYNIDIR (varsayılan hâlâ SIGNAL_CODES, saf 20
// sinyal) — training.test.ts'teki eski testler DEĞİŞTİRİLMEDEN geçer (parite kanıtı). Yeni
// çağıranlar (AGF ailesi dahil edilmiş bir codes listesiyle) AYNI makineyi, kod tekrarı
// olmadan kullanabilir. `buildFeatureVectorForRunner`/`buildFeatureVectorsForRace` (saf motorun
// KENDİSİ) bu değişiklikten HİÇ etkilenmez — AGF sinyalleri ayrı bir katmanda (bkz. agf.ts +
// combine.ts) vektöre SONRADAN eklenir, saf hesaplama mantığına dokunulmaz.

/** μ/σ YALNIZ verilen (eğitim) örnekleminden hesaplanır — common.ts::zScore'un dayattığı AYNI
 *  kural ("μ/σ yalnız eğitim bölümünden"). Gözlem sayısı<2 ise sigma=1/mu=0 (standardizasyon
 *  etkisiz kalır, UYDURULMUŞ bir dağılım İDDİA EDİLMEZ). `codes` verilmezse SIGNAL_CODES
 *  (saf 20 sinyal, eski davranış) kullanılır. */
export function computeFeatureStats<C extends string = SignalCode>(
  vectors: RunnerFeatureVector[],
  codes: readonly C[] = SIGNAL_CODES as unknown as readonly C[]
): FeatureStats<C> {
  const stats: FeatureStats<C> = new Map();
  for (const code of codes) {
    const values = vectors.flatMap((v) => {
      const s = v.signals.find((x) => x.code === code);
      return s && s.observed && s.rawValue != null && Number.isFinite(s.rawValue) ? [s.rawValue] : [];
    });
    if (values.length < 2) {
      stats.set(code, { mu: 0, sigma: 1, nObserved: values.length });
      continue;
    }
    const mu = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + (b - mu) ** 2, 0) / values.length;
    stats.set(code, { mu, sigma: Math.sqrt(variance) || 1, nObserved: values.length });
  }
  return stats;
}

export type ModelFeatureName<C extends string = SignalCode> = `${C}_z` | `${C}_missing`;

/** Her sinyal → [z (gözlemsizse 0), missing (0/1)]. EĞİTİM ve SKORLAMA bu fonksiyonu AYNI
 *  şekilde çağırır — iki ayrı kod yolu YOK, sözleşme sapması YAPISAL olarak İMKANSIZ.
 *  Sinyal sırası/kümesi AYRI bir `codes` argümanından DEĞİL, `stats`in KENDİSİNDEN (Map
 *  insertion-order, computeFeatureStats'ın ürettiği sırayla AYNI) okunur — iki kaynağın
 *  (codes listesi + stats) birbirinden SESSİZCE sapması (ör. AGF kodlu stats'a saf codes
 *  listesi geçmek) YAPISAL olarak İMKANSIZ hâle gelir. */
export function toModelVector<C extends string = SignalCode>(
  fv: RunnerFeatureVector,
  stats: FeatureStats<C>
): { vector: number[]; names: ModelFeatureName<C>[] } {
  const vector: number[] = [];
  const names: ModelFeatureName<C>[] = [];
  for (const [code, { mu, sigma }] of stats) {
    const s = fv.signals.find((x) => x.code === code);
    const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
    vector.push(observed ? (s!.rawValue! - mu) / (sigma || 1) : 0);
    names.push(`${code}_z` as ModelFeatureName<C>);
    vector.push(observed ? 0 : 1);
    names.push(`${code}_missing` as ModelFeatureName<C>);
  }
  return { vector, names };
}

export type TrainingRace = { raceId: string; date: Date; vectors: RunnerFeatureVector[]; winnerNo: number | null };

/** Geçmiş (Result'u olan) bir yarış örneklemi seçer — hedef yarıştan BAĞIMSIZ, gerçek TJK
 *  sonuçlu yarışlar. `beforeDate` ile hedef yarışın tarihinden SONRAKİ hiçbir yarış örnekleme
 *  giremez (point-in-time eğitim/test ayrımı — kullanıcı kuralı: "zaman sıralı"). */
export async function selectTrainingRaces(limit: number, beforeDate: Date): Promise<{ raceId: string; date: Date }[]> {
  const races = await db.race.findMany({
    where: { raceDay: { date: { lt: beforeDate } }, result: { isNot: null } },
    select: { id: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true } } },
    orderBy: { raceDay: { date: "desc" } },
    take: limit * 2,
  });
  return races
    .filter((r) => r.runners.length >= 3)
    .slice(0, limit)
    .map((r) => ({ raceId: r.id, date: r.raceDay.date }));
}

function resolveWinnerNo(actualOrder: unknown, winnerNos: number[] | null | undefined): number | null {
  if (winnerNos && winnerNos.length > 0) return winnerNos[0];
  if (Array.isArray(actualOrder) && actualOrder.length > 0) {
    const n = parseInt(String(actualOrder[0]), 10);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** HER geçmiş yarış için FeatureVector'ları O YARIŞIN KENDİ tarihine göre (point-in-time)
 *  inşa eder — buildFeatureVectorsForRace'in kendisi zaten her ailenin point-in-time
 *  garantisini miras alır, burada EK bir cutoff mantığı UYGULANMAZ (zaten doğru). */
export async function buildTrainingSet(raceStubs: { raceId: string; date: Date }[], tempoCtx: TempoContext): Promise<TrainingRace[]> {
  const out: TrainingRace[] = [];
  for (const stub of raceStubs) {
    const [vectors, result] = await Promise.all([
      buildFeatureVectorsForRace(stub.raceId, tempoCtx),
      db.result.findUnique({ where: { raceId: stub.raceId }, select: { actualOrder: true, winnerNos: true } }),
    ]);
    const winnerNo = resolveWinnerNo(result?.actualOrder ?? null, result?.winnerNos ?? null);
    out.push({ raceId: stub.raceId, date: stub.date, vectors, winnerNo });
  }
  return out;
}

export type FitOptions = { lambda: number; learningRate: number; iterations: number };
export const DEFAULT_FIT_OPTIONS: FitOptions = { lambda: 1, learningRate: 0.05, iterations: 300 };

export type FittedModel<C extends string = SignalCode> = {
  beta: number[]; names: ModelFeatureName<C>[]; stats: FeatureStats<C>; nRacesUsed: number; nRacesSkipped: number; opts: FitOptions;
};

/** Kazananı bilinmeyen veya saha<2 olan yarışlar eğitime KATILMAZ (raceGradient bir kazanan
 *  BEKLER) — sessizce atlanmaz, nRacesSkipped'te SAYILIR. */
export function fitModel<C extends string = SignalCode>(
  trainingSet: TrainingRace[],
  stats: FeatureStats<C>,
  opts: FitOptions = DEFAULT_FIT_OPTIONS
): FittedModel<C> {
  let names: ModelFeatureName<C>[] = [];
  let nSkipped = 0;
  const races: TrainingRunner[][] = [];
  for (const t of trainingSet) {
    if (t.winnerNo == null || t.vectors.length < 2) {
      nSkipped++;
      continue;
    }
    const race: TrainingRunner[] = t.vectors.map((v) => {
      const { vector, names: n } = toModelVector(v, stats);
      names = n;
      return { raceId: t.raceId, runnerId: String(v.no), winner: v.no === t.winnerNo, features: vector };
    });
    if (!race.some((r) => r.winner)) {
      nSkipped++;
      continue;
    }
    races.push(race);
  }
  const featureCount = names.length;
  const beta = races.length > 0 ? fitConditionalLogit(races, featureCount, opts) : Array(featureCount).fill(0);
  return { beta, names, stats, nRacesUsed: races.length, nRacesSkipped: nSkipped, opts };
}

export type ScoredRunner = { no: number; name: string; score: number; probability: number };

/** P_i = e^Si/Σe^Sj — softmax.ts'TEN DOĞRUDAN kullanılır, yeniden yazılmadı. Olasılık toplamı
 *  softmax'ın matematiksel garantisiyle HER ZAMAN 1.0 (kullanıcı kuralı §7: "olasılık toplamı
 *  %100 olmalı"). */
export function scoreRace<C extends string = SignalCode>(vectors: RunnerFeatureVector[], model: FittedModel<C>): ScoredRunner[] {
  const scored = vectors.map((v) => {
    const { vector } = toModelVector(v, model.stats);
    return { no: v.no, name: v.name, score: dot(vector, model.beta) };
  });
  const probs = softmax(scored.map((s) => s.score));
  return scored.map((s, i) => ({ ...s, probability: probs[i] }));
}

export type SignalEffectRow<C extends string = SignalCode> = {
  code: C;
  family: string | null;
  rawValue: number | null;
  standardizedValue: number;
  learnedCoefficient: number;
  scoreContribution: number;
  missingIndicatorCoefficient: number;
  missingIndicatorContribution: number;
  observed: boolean;
  coverageState: string | null;
  modelVersion: string;
};

/**
 * Sinyal Etki Raporu (kullanıcı talimatı §5) — HER satır modelin KENDİ β'sından ve HER
 * koşuda YENİDEN hesaplanan standardize değerden türetilir, SONRADAN gösterim için ayrıca
 * yazılmış bir rapor DEĞİLDİR (doğrudan toModelVector+model.beta'dan okunur). Etkileşim
 * terimleri (γ_m·I_im) bu İLK sürümde YOK — scoreContribution yalnız ANA etkidir, bu AÇIKÇA
 * `interactionContribution: null` ile işaretlenir (uydurulmaz).
 */
export function explainRunner<C extends string = SignalCode>(
  fv: RunnerFeatureVector,
  model: FittedModel<C>
): { rows: SignalEffectRow<C>[]; totalScore: number; interactionContribution: null } {
  const { vector } = toModelVector(fv, model.stats);
  const codes = [...model.stats.keys()];
  const rows: SignalEffectRow<C>[] = codes.map((code, i) => {
    const zIdx = i * 2;
    const missIdx = i * 2 + 1;
    const s = fv.signals.find((x) => x.code === code);
    return {
      code,
      family: s?.family ?? null,
      rawValue: s?.rawValue ?? null,
      standardizedValue: vector[zIdx],
      learnedCoefficient: model.beta[zIdx],
      scoreContribution: model.beta[zIdx] * vector[zIdx],
      missingIndicatorCoefficient: model.beta[missIdx],
      missingIndicatorContribution: model.beta[missIdx] * vector[missIdx],
      observed: !!s?.observed,
      coverageState: s?.coverageState ?? null,
      modelVersion: MODEL_VERSION,
    };
  });
  const totalScore = rows.reduce((acc, r) => acc + r.scoreContribution + r.missingIndicatorContribution, 0);
  return { rows, totalScore, interactionContribution: null };
}
