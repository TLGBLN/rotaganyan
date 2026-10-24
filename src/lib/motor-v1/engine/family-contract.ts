// ROTAGANYAN ANALİZ MOTORU v1.0 — 10 PERFORMANS AİLESİ sözleşmesi (kullanıcı talimatı,
// 2026-10-19). Her aile bu TEK şemayla raporlanır — registry'de tanımlı olmak, sinyalin
// gerçekten hesaplandığı veya skora girdiği ANLAMINA GELMEZ (signal-registry.ts'in KENDİ
// ilkesiyle AYNI).

export type PitStatus = "VERIFIED" | "PIT_UNVERIFIED" | "NOT_APPLICABLE";

/**
 * KULLANICI TALİMATI (2026-10-19) — "tamamlanmış saymam için gereken ayrım", İKİNCİ TUR
 * DÜZELTMESİYLE (isim değişikliği): "SKORDA_AKTIF adını değiştirelim... gerçekte üretimde
 * aktif olmayı ifade etmiyor. EGITIM_SETINDE_GOZLEMLI daha doğru. Bir sinyalin hesaplanması,
 * eğitim setinde bulunması ve eğitilmiş model tarafından kullanılması AYRI durumlar."
 *
 *   HESAPLANDI            = gerçek tarihsel veriden elde edildi (observed=true, tek aile),
 *                            HİÇBİR eğitim kodu listesinde DEĞİL.
 *   ILISKILENDIRILDI      = birden fazla aileden gelen verinin BİRLEŞİMİ (etkileşim terimi),
 *                            HİÇBİR eğitim kodu listesinde DEĞİL.
 *   EGITIM_SETINDE_GOZLEMLI = verilen `codesSet`te (bkz. aşağı — ÇAĞIRANIN belirttiği bir
 *                            MODEL SÜRÜMÜNÜN gerçek `codes` listesi, varsayılan SIGNAL_CODES)
 *                            VE gözlemli. Bu, "codes argümanı verilmeden fitModel
 *                            çağrıldığında GERÇEKTEN kullanılır" demektir — "ÜRETİMDE AKTİF"
 *                            DEĞİL (hiçbir V1.0 modeli henüz dağıtılmadı/production'da değil).
 *   BEKLEMEDE             = gözlemsiz (veri eksik VEYA PIT doğrulanamadı).
 *
 * `codesSet` HER ZAMAN açıkça belirtilir — "hangi model sürümü hangi özellikleri kullanıyor"
 * sorusuna CEVAP bu parametredir. Varsayılanı training.ts::SIGNAL_CODES (mevcut araştırma
 * seti) — GERÇEKTEN fit edilmiş bir FittedModel'in `names`/`stats` anahtarları da buraya
 * verilebilir (bkz. modelVersionCodes()).
 *
 * ÜÇÜNCÜ TUR DÜZELTMESİ (2026-10-19) — kullanıcı: "Yalnız stats anahtarında bulunmak, her
 * uygulamada özelliğin nihai skora katkı verdiğini GARANTİ ETMEYEBİLİR. Modelin gerçek
 * katsayıları ve skorlama yolu da esas alınmalı." EGITIM_SETINDE_GOZLEMLI yalnız "bu kod bir
 * codes/model.stats KÜMESİNDE var" demektir (istatistiksel μ/σ hesaplanmış olabilir, ama bu
 * BAŞKA BİR konfigürasyon/tasarım kararı olabilir — GERÇEK bir FittedModel nesnesiyle
 * ilişkilendirilmemiş olabilir). MODELIN_SKORUNDA ise yalnız GERÇEKTEN fit edilmiş bir
 * FittedModel + bu atın GERÇEK RunnerFeatureVector'ü training.ts::explainRunner()'dan
 * geçirilip o kodun satırının observed=true döndüğü DOĞRUDAN KANITLANDIĞINDA verilir — bkz.
 * upgradeStatusWithModelScore().
 */
export type SignalStatus = "HESAPLANDI" | "ILISKILENDIRILDI" | "EGITIM_SETINDE_GOZLEMLI" | "MODELIN_SKORUNDA" | "BEKLEMEDE";

export type FamilyFeature = {
  code: string;
  rawValue: number | null;
  observed: boolean;
  missingReason: string | null;
  status: SignalStatus;
};

export type FamilyBlock = {
  family: "GEN" | "YET" | "FRM" | "PMZ" | "TMP" | "JOK" | "ANT" | "KIL" | "DAV" | "RAK";
  features: FamilyFeature[];
  observedCount: number; // features icinde observed=true olan sayisi
  totalCount: number; // features.length
  coverage: number; // observedCount/totalCount (0 ise NaN degil 0)
  missingReason: string | null; // TUMU gozlemsizse ozet neden, aksi halde null (features kendi nedenini tasir)
  pitStatus: PitStatus;
  source: string; // kullanilan gercek kaynak/fonksiyon(lar), denetlenebilirlik icin
  interactions: string[]; // bu ailenin katildigi, GERCEKTEN hesaplanan etkilesim kodlari
};

/** 13 teknik aile (signal-registry.ts) -> 10 ana performans ailesi eslemesi (kullanici
 *  talimati tablosu, BIREBIR). MARKET bilerek DISINDA - hicbir performans ailesine girmez. */
export const FAMILY_GROUP_MAP: Record<string, FamilyBlock["family"]> = {
  PEDIGRI: "GEN",
  HIZ: "YET",
  SINIF: "YET",
  FORM: "FRM",
  IDMAN: "FRM",
  PIST_MESAFE_ZEMIN: "PMZ",
  PIST_DURUM: "PMZ",
  TEMPO_STYLE: "TMP",
  KULVAR: "TMP",
  JOKEY: "JOK",
  ANTRENOR: "ANT",
  KILO: "KIL",
  TAKI: "DAV",
  // RAK (rakip gucu) signal-registry.ts'te AYRI bir teknik aile olarak YOKTU - bu
  // entegrasyonla ILK KEZ eklendi (RAK_H2H_01).
};

import { SIGNAL_CODES, explainRunner, type FittedModel } from "./training";
import type { RunnerFeatureVector } from "./feature-vector";

/** VARSAYILAN model sürümü — "mevcut araştırma seti" (saf 20, codes argümanı verilmeden
 *  fitModel çağrıldığında kullanılan liste). Bu ismi AÇIKÇA taşır, "production" DEĞİL. */
export const DEFAULT_RESEARCH_MODEL_CODES: ReadonlySet<string> = new Set(SIGNAL_CODES);

/** GERÇEKTEN fit edilmiş bir FittedModel'in kullandığı kod kümesini çıkarır — "hangi model
 *  sürümü hangi özellikleri kullanıyor" sorusunun GERÇEK (research-default'tan BAĞIMSIZ)
 *  cevabı budur. `model.stats` Map'inin anahtarları, o modelin fit edildiği `codes`
 *  listesiyle AYNI sırada/kümede (training.ts::computeFeatureStats'ın garantisi). */
export function modelVersionCodes<C extends string>(model: FittedModel<C>): ReadonlySet<string> {
  return new Set(model.stats.keys());
}

export type FamilyFeatureInput = { code: string; rawValue: number | null; observed: boolean; missingReason: string | null };

function deriveStatus(code: string, observed: boolean, codesSet: ReadonlySet<string>, fallbackIfNotInSet: "HESAPLANDI" | "ILISKILENDIRILDI"): SignalStatus {
  if (!observed) return "BEKLEMEDE";
  if (codesSet.has(code)) return "EGITIM_SETINDE_GOZLEMLI";
  return fallbackIfNotInSet;
}

export function interactionStatus(observed: boolean, code: string, codesSet: ReadonlySet<string> = DEFAULT_RESEARCH_MODEL_CODES): SignalStatus {
  return deriveStatus(code, observed, codesSet, "ILISKILENDIRILDI");
}

/**
 * EGITIM_SETINDE_GOZLEMLI → MODELIN_SKORUNDA yükseltmesi — YALNIZ GERÇEK bir FittedModel
 * nesnesiyle, bu atın GERÇEK (unifiedVector'den seçilmiş, modelin kendi `codes`'una uygun)
 * özellik vektörü training.ts::explainRunner()'dan geçirilip o kodun satırı GERÇEKTEN
 * observed=true döndüğünde yükseltilir. Model verilmezse (çağıran taraf opsiyonel bırakırsa)
 * HİÇBİR kod MODELIN_SKORUNDA olamaz — bu DAİMA dürüst bir varsayılandır (üretimde hiçbir
 * model dağıtılmadı).
 */
export function upgradeStatusWithModelScore<C extends string>(
  statusMap: Readonly<Record<string, SignalStatus>>,
  fv: RunnerFeatureVector,
  model: FittedModel<C>
): Record<string, SignalStatus> {
  const { rows } = explainRunner(fv, model);
  const upgraded: Record<string, SignalStatus> = { ...statusMap };
  for (const row of rows) {
    if (row.observed && upgraded[row.code] === "EGITIM_SETINDE_GOZLEMLI") {
      upgraded[row.code] = "MODELIN_SKORUNDA";
    }
  }
  return upgraded;
}

export function familyBlock(
  family: FamilyBlock["family"],
  featuresInput: FamilyFeatureInput[],
  pitStatus: PitStatus,
  source: string,
  interactions: string[] = [],
  codesSet: ReadonlySet<string> = DEFAULT_RESEARCH_MODEL_CODES
): FamilyBlock {
  const features = featuresInput.map((f): FamilyFeature => ({ ...f, status: deriveStatus(f.code, f.observed, codesSet, "HESAPLANDI") }));
  const observedCount = features.filter((f) => f.observed).length;
  const totalCount = features.length;
  const allMissing = observedCount === 0 && totalCount > 0;
  return {
    family, features, observedCount, totalCount,
    coverage: totalCount > 0 ? observedCount / totalCount : 0,
    missingReason: allMissing ? `ailenin ${totalCount} özelliğinin TAMAMI gözlemsiz` : null,
    pitStatus, source, interactions,
  };
}
