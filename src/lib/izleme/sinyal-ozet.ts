import { PRODUCTION_FEATURE_CODES } from "@/lib/methodology/signal-registry";
import safW from "@/lib/methodology/weights/v546-1-saf-weights.json";

type Satir = { kod: string; durum: "SAGLAM" | "IZLE" | "SORUN" | "DATA_HOLD" };

/** Sinyal sağlığı özeti — SAYILAR yalnız CANLI motordaki sinyaller için; eski/yalnız-analiz kayıtları ayrı satırda.
 *  Böyle "varsayılan 21" ile "kayıtlı 27" çelişkisi oluşmaz: 21 = varsayılan model, 23 = üç modelin birleşimi (segmentlere özgü ek sinyaller dahil),
 *  geri kalanı yalnızca eski kayıtlarda geçen (emekli / AGF / aday) kodlardır. */
export function sinyalOzetMetni(satirlar: Satir[]): string {
  const canliSet = new Set(PRODUCTION_FEATURE_CODES);
  const canli = satirlar.filter((s) => canliSet.has(s.kod));
  const dig = satirlar.length - canli.length;
  const say = (d: Satir["durum"]) => canli.filter((s) => s.durum === d).length;
  return `Varsayılan model ${safW.featureNames.length} sinyal (üç modelin birleşimi ${PRODUCTION_FEATURE_CODES.length}) · canlı ${canli.length}: ${say("SAGLAM")} sağlam · ${say("IZLE")} izle · ${say("SORUN")} sorun · ${say("DATA_HOLD")} veri yetersiz` + (dig ? ` · ayrıca ${dig} eski/yalnız-analiz kayıt (sağlık sayısına dahil değil)` : "");
}

/** Genel durum için yalnız CANLI sinyaller sayılır. */
export function canliSinyalSayilari(satirlar: Satir[]) {
  const canliSet = new Set(PRODUCTION_FEATURE_CODES);
  const c = satirlar.filter((s) => canliSet.has(s.kod));
  return { SAGLAM: c.filter((s) => s.durum === "SAGLAM").length, IZLE: c.filter((s) => s.durum === "IZLE").length, SORUN: c.filter((s) => s.durum === "SORUN").length, DATA_HOLD: c.filter((s) => s.durum === "DATA_HOLD").length };
}
