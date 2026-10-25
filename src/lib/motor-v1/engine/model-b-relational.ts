// ROTAGANYAN ANALİZ MOTORU v1.0 — KONTROLLÜ KATSAYI ÖĞRENME, "MODEL B" (kullanıcı onayı,
// 2026-10-19: "RotaGanyan V1.0 — Kontrollü Katsayı Öğrenme Onayı").
//
// ADIM 1 (kullanıcı talimatı §1, ZORUNLU): "Önce 150 yarışlık mevcut önbellekte hangi yeni
// özelliklerin gerçekten bulunduğunu belirle. Bulunmayanları mevcutmuş gibi eğitime katma."
// `ab-feature-cache.json` (150 yarış, A/B deneyinin ONAYLANMIŞ önbelleği) İNCELENDİ — SAF 20
// (SIGNAL_CODES) DIŞINDA yalnız 4 kod GERÇEKTEN mevcut:
//   GEN_SIRE_PMZ_01, INT_FORM_GALOP_DINLENME_01, INT_JOKEY_FORM_TEMPO_01,
//   INT_TEMPO_STIL_KULVAR_01 (bunlar 2026-10-17'deki ilk A/B deneyinin "4 ilişkisel" seti).
// GEN_SIRE_01/GEN_DAM_01/GEN_DAMSIRE_01 (ham, çarpımdan ÖNCEki GEN seviyeleri), ANT_TREND30,
// DAV_TAKI_EKLENDİ/ÇIKARILDI, RAK_H2H_01, RAK_GAP_01, IDMAN_01, JOKEY_TREND30, KULVAR_01_HAM
// (ana etki), PIST_DURUM_01, DAV_START_RISK, ve diğer 9 ilişki kodu — ÖNBELLEKTE YOK. Bu
// kodlar bu nedenle eğitime KATILMIYOR (uydurma yasağı, §1) — hesaplama katmanında kalıyorlar
// (unified-family-engine.ts değişmedi), yalnız bu modelin `codes` listesinde YOKLAR.
//
// AD-HOC İSİM UYUMU: unified-family-engine.ts bu 3 ilişkiyi (2026-10-19 10-aile
// entegrasyonunda) FARKLI kod adlarıyla üretiyor (FRM_IDMAN_DINLENME_01, JOK_FRM_TMP_01,
// TMP_KULVAR_01) — AMA bileşenleri BİREBİR AYNI (int-form-galop-dinlenme.ts/int-jokey-form-
// tempo.ts/int-tempo-stil-kulvar.ts'in kaynak kodu okunarak doğrulandı: aynı FORM_01/IDMAN_01/
// FORM_03, aynı jokeyTrend/FORM_02/TEMPO_01, aynı KULVAR_01_HAM/TEMPO_01 ham çarpımı). Bu
// yüzden önbellekteki değerler GERÇEK ve GEÇERLİ — yalnız CODE_RENAME_MAP ile GÜNCEL isimlere
// eşleniyor (predictRaceV1'in unifiedVector'üyle eşleşmesi için), DEĞER UYDURULMUYOR.
//
// KULLANICI KISITI §3: Model A (SIGNAL_CODES, training.ts, MODEL_VERSION) HİÇ DEĞİŞMEDİ. Bu
// dosya training.ts'in GENERIC makinesini (computeFeatureStats/fitModel<C>) AYRI bir `codes`
// listesiyle ikinci kez çağırır — training.ts'e TEK satır dokunulmadı.
// KULLANICI KISITI §5: DEFAULT_FIT_OPTIONS (ridge λ=1, mevcut düzenlileştirme) DEĞİŞTİRİLMEDİ
// — yeni bir regularization altyapısı EKLENMEDİ, parametre sayısı yalnız 4 kod (8 model
// sütunu: z+missing) kadar büyüdü.
// KULLANICI KISITI §6: fit YALNIZ train split'ten (120 yarış) — holdout (30) hiçbir
// normalizasyon/katsayıya KARIŞMAZ, bu dosyada holdout hiç kullanılmaz (ayrı rapor
// script'inin işi).

import { computeFeatureStats, fitModel, SIGNAL_CODES, DEFAULT_FIT_OPTIONS, type FittedModel, type TrainingRace } from "./training";
import type { RunnerFeatureVector, SignalEntry } from "./feature-vector";
import { EXCLUDED_FROM_SCORING } from "./predict-v1";

export const MODEL_B_VERSION = "rotaganyan-v1.0-modelB-relational-2026-10-19";

/** Önbellekte (eski adlarıyla) gerçekten bulunan 3 ilişki — bkz. dosya başı doğrulama notu. */
export const CODE_RENAME_MAP: ReadonlyMap<string, string> = new Map([
  ["INT_FORM_GALOP_DINLENME_01", "FRM_IDMAN_DINLENME_01"],
  ["INT_JOKEY_FORM_TEMPO_01", "JOK_FRM_TMP_01"],
  ["INT_TEMPO_STIL_KULVAR_01", "TMP_KULVAR_01"],
  // GEN_SIRE_PMZ_01 ad DEĞİŞTİRMEDİ (unified-family-engine.ts AYNI adı üretiyor) - haritaya girmez.
]);

export const MODEL_B_RELATIONAL_CODES = ["GEN_SIRE_PMZ_01", "FRM_IDMAN_DINLENME_01", "JOK_FRM_TMP_01", "TMP_KULVAR_01"] as const;
export const MODEL_B_CODES = [...SIGNAL_CODES, ...MODEL_B_RELATIONAL_CODES] as const;
export type ModelBCode = (typeof MODEL_B_CODES)[number];

// GÜVENLİK DOĞRULAMASI (modül yükleme zamanı, kullanıcı talimatı §2'nin YAPISAL güvencesi):
// MODEL_B_CODES, predict-v1.ts::EXCLUDED_FROM_SCORING'teki (PIT-güvensiz/seçilim-yanlılığı)
// hiçbir kodu ASLA içeremez — ileride bu liste yanlışlıkla genişletilirse modül YÜKLENMEZ.
for (const forbidden of EXCLUDED_FROM_SCORING.keys()) {
  if ((MODEL_B_CODES as readonly string[]).includes(forbidden)) {
    throw new Error(`model-b-relational.ts: MODEL_B_CODES, EXCLUDED_FROM_SCORING'teki "${forbidden}" kodunu içeremez (PIT/seçilim-yanlılığı kısıtı).`);
  }
}

export type CachedRaceShape = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

/** Önbellekteki eski kod adlarını (varsa) günceline çevirir — başka hiçbir şeyi değiştirmez. */
export function remapLegacyCacheCodes(vectors: SignalEntry[]): SignalEntry[] {
  return vectors.map((s) => (CODE_RENAME_MAP.has(s.code) ? { ...s, code: CODE_RENAME_MAP.get(s.code)! } : s));
}

export function cacheToTrainingRaces(cache: Record<string, CachedRaceShape>, raceIds: readonly string[]): TrainingRace[] {
  return raceIds.filter((id) => cache[id]).map((id) => {
    const r = cache[id];
    const vectors: RunnerFeatureVector[] = r.runners.map((rr) => ({
      raceId: id, no: rr.no, name: rr.name, tjkAtId: null, jockey: null,
      signals: remapLegacyCacheCodes(rr.vectors),
    }));
    return { raceId: id, date: new Date(r.date), vectors, winnerNo: r.winnerNo };
  });
}

/** Model B — TRAIN split'ten (ÖNBELLEK, 0 yeni DB sorgusu) fit edilir. Holdout bu fonksiyona
 *  hiç girmez (kullanıcı §6). `DEFAULT_FIT_OPTIONS` training.ts'TEN AYNEN alınır. */
export function fitModelBFromCache(cache: Record<string, CachedRaceShape>, trainRaceIds: readonly string[]): FittedModel<ModelBCode> {
  const trainSet = cacheToTrainingRaces(cache, trainRaceIds);
  const stats = computeFeatureStats<ModelBCode>(trainSet.flatMap((t) => t.vectors), MODEL_B_CODES);
  return fitModel<ModelBCode>(trainSet, stats, DEFAULT_FIT_OPTIONS);
}
