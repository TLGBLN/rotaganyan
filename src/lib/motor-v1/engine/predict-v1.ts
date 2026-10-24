// ROTAGANYAN ANALİZ MOTORU v1.0 — TEK TAHMİN GİRİŞ NOKTASI (kullanıcı talimatı, 2026-10-19,
// "durum etiketleme" fazını kapatan son talimat): "unified-family-engine.ts tarafından üretilen
// güvenilir aile özelliklerini, mevcut training.ts ve tahmin skorlama akışına bağla."
//
// Bu dosya İKİ ayrı akışı (10 aileli hesaplama motoru + training.ts'in öğrenilmiş-katsayı
// skorlayıcısı) TEK bir giriş noktasında (predictRaceV1) birleştirir. Önceden öğrenilmiş
// katsayılar KORUNUR — hiçbir yeni fitModel çağrısı YOK, `model` parametresi ÇAĞIRANIN
// önceden fit ettiği (ör. onaylanmış A/B deneyinin Model A'sı) GERÇEK bir FittedModel'dir.
// Yeni ailelerin (GEN/ANT/DAV/RAK) veya 13 ilişkinin kodları model.stats'ta YOKSA,
// training.ts::toModelVector bunları YAPISAL olarak yok sayar (yalnız stats Map'inin
// anahtarları işlenir) — bu dosya o örtük davranışı `buildModelContract()` ile AÇIKÇA
// raporlar: hangi aile skora GERÇEKTEN katkı veriyor, hangisi katsayı öğrenilmesini
// bekliyor, tek yapıdan okunur.
//
// PIT GÜVENLİĞİ / SEÇİLİM YANLILIĞI DIŞARIDA BIRAKMA (kullanıcı talimatı): aşağıdaki kodlar,
// model.stats'ta bulunsalar BİLE (bugün bulunmuyorlar, ama gelecekte bir yeniden-eğitim
// yanlışlıkla ekleyebilir) ASLA skorlamaya girmez — bu YAPISAL bir güvenlik kemeri, bugünkü
// davranışı DEĞİŞTİRMEZ (Model A'nın 20 kodu arasında zaten yoklar):
//   - PIST_DURUM_01: pist-durum-wiring.ts kendi belgeliyor — immutablePreRaceSnapshot YALNIZ
//     race.result==null (canlı/henüz koşulmamış) iken true. Geçmiş/sonuçlanmış hiçbir yarışla
//     fit edilen model bu kodu PIT-güvenli şekilde ÖĞRENEMEZ.
//   - DAV_START_RISK / TMP_DAV_KULVAR_01: dav-start-risk.ts::START_RISK_SECIM_YANLILIGI_UYARISI
//     — P(geç|kayıt var) ≠ P(geç|start aldı) seçilim yanlılığı, tam kayıt kapsamı
//     doğrulanana kadar skora KATILMAZ (kullanıcı talimatı, 2026-10-19 2. tur).

import { computeUnifiedFamiliesForRace, type UnifiedRunnerResult } from "./unified-family-engine";
import { scoreRace, explainRunner, MODEL_VERSION, type FittedModel, type ScoredRunner } from "./training";
import { modelVersionCodes, type FamilyBlock } from "./family-contract";
import type { RunnerFeatureVector } from "./feature-vector";
import { START_RISK_SECIM_YANLILIGI_UYARISI } from "../features/dav-start-risk";

/** Kod → neden. Bu kodlar hiçbir koşulda skorlama vektörüne girmez (bkz. dosya başı notu). */
export const EXCLUDED_FROM_SCORING: ReadonlyMap<string, string> = new Map([
  [
    "PIST_DURUM_01",
    "PIT güvenliği yalnız canlı/henüz koşulmamış yarışta geçerli (immutablePreRaceSnapshot); geçmiş veriyle fit edilen hiçbir model bu kodu güvenle öğrenemez.",
  ],
  ["DAV_START_RISK", START_RISK_SECIM_YANLILIGI_UYARISI],
  ["TMP_DAV_KULVAR_01", `DAV_START_RISK bileşeni nedeniyle aynı kısıtı devralır: ${START_RISK_SECIM_YANLILIGI_UYARISI}`],
]);

/** unifiedVector'ü skorlamaya uygun RunnerFeatureVector'e indirger — EXCLUDED_FROM_SCORING'teki
 *  kodlar FİZİKSEL olarak listeden çıkarılır (model.stats'ta olup olmadığına bakılmaz — bu,
 *  "gelecekte yanlışlıkla model.stats'a girerse de skorlanmaz" garantisidir). tjkAtId/jockey
 *  burada kullanılmaz (scoreRace/explainRunner bu alanlara bakmaz), null bırakılır. */
export function buildScorableVector(raceId: string, result: UnifiedRunnerResult): RunnerFeatureVector {
  return {
    raceId,
    no: result.no,
    name: result.name,
    tjkAtId: null,
    jockey: null,
    signals: result.unifiedVector.filter((s) => !EXCLUDED_FROM_SCORING.has(s.code)),
  };
}

export type FamilyRepresentation = {
  family: FamilyBlock["family"];
  codes: string[];
  scoredCodes: string[]; // model.stats'ta GERÇEKTEN var olan VE dışarıda-bırakılmamış kodlar
  excludedCodes: string[]; // PIT-güvensiz/seçilim-yanlılığı nedeniyle ASLA skorlanmayan kodlar
  pendingCodes: string[]; // hesaplanıyor, dışarıda bırakılmadı, ama henüz katsayı öğrenilmedi
  representedInModel: boolean; // scoredCodes.length > 0
};

export type InteractionRepresentation = {
  code: string;
  scored: boolean;
  excluded: boolean;
  excludedReason: string | null;
};

export type ModelContract<C extends string> = {
  modelVersion: string;
  modelCodeCount: number;
  modelCodes: string[];
  families: FamilyRepresentation[];
  interactions: InteractionRepresentation[];
  /** scoredCodes boş olan aileler — hesaplanıyor+ilişkilendiriliyor ama model HENÜZ bu
   *  ailenin HİÇBİR kodu için katsayı öğrenmedi. */
  fullyPendingFamilies: FamilyBlock["family"][];
  /** bazı kodları skorlanıyor, bazıları (ör. yeni eklenen bir alt-özellik) hâlâ bekliyor. */
  partiallyScoredFamilies: FamilyBlock["family"][];
};

/**
 * TEK MODEL SÖZLEŞMESİ (kullanıcı talimatı): "Hangi ailelerin mevcut eğitilmiş modelde
 * temsil edildiğini, hangilerinin henüz katsayı öğrenilmesini beklediğini tek bir model
 * sözleşmesinde göster." Aile/ilişki kod kümeleri yapısal olarak her runner için AYNIDIR
 * (unified-family-engine.ts'in sabit şeması) — tek bir örnek runner'dan türetilir, 11
 * runner için ayrı ayrı hesaplamaya GEREK yoktur.
 */
export function buildModelContract<C extends string>(sample: UnifiedRunnerResult, model: FittedModel<C>): ModelContract<C> {
  const modelCodes = modelVersionCodes(model);

  const families: FamilyRepresentation[] = sample.families.map((f) => {
    const codes = f.features.map((feat) => feat.code);
    const excludedCodes = codes.filter((c) => EXCLUDED_FROM_SCORING.has(c));
    const scoredCodes = codes.filter((c) => modelCodes.has(c) && !EXCLUDED_FROM_SCORING.has(c));
    const pendingCodes = codes.filter((c) => !modelCodes.has(c) && !EXCLUDED_FROM_SCORING.has(c));
    return { family: f.family, codes, scoredCodes, excludedCodes, pendingCodes, representedInModel: scoredCodes.length > 0 };
  });

  const interactions: InteractionRepresentation[] = sample.interactions.map((i) => ({
    code: i.code,
    scored: modelCodes.has(i.code) && !EXCLUDED_FROM_SCORING.has(i.code),
    excluded: EXCLUDED_FROM_SCORING.has(i.code),
    excludedReason: EXCLUDED_FROM_SCORING.get(i.code) ?? null,
  }));

  return {
    modelVersion: MODEL_VERSION,
    modelCodeCount: modelCodes.size,
    modelCodes: [...modelCodes],
    families,
    interactions,
    fullyPendingFamilies: families.filter((f) => !f.representedInModel).map((f) => f.family),
    partiallyScoredFamilies: families.filter((f) => f.representedInModel && f.pendingCodes.length > 0).map((f) => f.family),
  };
}

export type PredictRaceV1Result<C extends string> = {
  scored: ScoredRunner[]; // training.ts::scoreRace — DEĞİŞTİRİLMEMİŞ, ÖNCEDEN ÖĞRENİLMİŞ model.beta
  explain: Map<number, ReturnType<typeof explainRunner<C>>>; // runner no -> gerçek katkı satırları
  contract: ModelContract<C>;
};

/**
 * TEK GİRİŞ NOKTASI: 10 aileli unified engine → PIT/seçilim-yanlılığı filtresi →
 * training.ts'in ÖNCEDEN FİT EDİLMİŞ modeliyle gerçek skor + açıklama + model sözleşmesi.
 * `model` ZORUNLUDUR — bu fonksiyon hiçbir koşulda yeni bir fitModel() çağırmaz (kullanıcı
 * talimatı: "önceden öğrenilmiş katsayıları koru, yeni özellikler için katsayı uydurma").
 */
export async function predictRaceV1<C extends string>(raceId: string, model: FittedModel<C>): Promise<PredictRaceV1Result<C> | null> {
  const unified = await computeUnifiedFamiliesForRace(raceId, model);
  if (unified.length === 0) return null;

  const vectors = unified.map((r) => buildScorableVector(raceId, r));
  const scored = scoreRace(vectors, model);

  const explain = new Map<number, ReturnType<typeof explainRunner<C>>>();
  for (const v of vectors) explain.set(v.no, explainRunner(v, model));

  const contract = buildModelContract(unified[0], model);
  return { scored, explain, contract };
}
