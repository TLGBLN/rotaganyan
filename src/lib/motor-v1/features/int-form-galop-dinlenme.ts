// ROTAGANYAN ANALİZ MOTORU v1.0 — İLİŞKİ #2: FORM × GALOP × DİNLENME.
// Ham üçlü çarpım (§5.6) — FORM_01 (form seviyesi) × IDMAN_01 (galop, rakiplere göre robust
// z-skor) × FORM_03 (dinlenme, log(1+gün)). Hiçbiri burada YENİDEN HESAPLANMAZ.

export type IntFormGalopDinlenmeCode = "INT_FORM_GALOP_DINLENME_01";

export type IntFormGalopDinlenmeEntry = {
  code: IntFormGalopDinlenmeCode;
  family: "INTERACTION";
  rawValue: number | null;
  observed: boolean;
  asOfSafe: true;
  missingReason: string | null;
};

export function computeFormGalopDinlenmeInteraction(
  form01Raw: number | null, form01Observed: boolean,
  idman01Raw: number | null, idman01Observed: boolean,
  form03Raw: number | null // FORM_03 (dinlenme) tanım gereği N-bağımsız — "gözlemsiz" durumu yalnız ilk-start'ta (null)
): IntFormGalopDinlenmeEntry {
  const missing: string[] = [];
  if (!form01Observed || form01Raw == null) missing.push("FORM_01 gözlemsiz");
  if (!idman01Observed || idman01Raw == null) missing.push("IDMAN_01 gözlemsiz (galop kaydı yok veya popülasyon örneklemi yetersiz)");
  if (form03Raw == null) missing.push("FORM_03 gözlemsiz (hiç geçmiş yarış yok)");

  if (missing.length > 0) {
    return { code: "INT_FORM_GALOP_DINLENME_01", family: "INTERACTION", rawValue: null, observed: false, asOfSafe: true, missingReason: missing.join("; ") };
  }
  return {
    code: "INT_FORM_GALOP_DINLENME_01", family: "INTERACTION",
    rawValue: form01Raw! * idman01Raw! * form03Raw!,
    observed: true, asOfSafe: true, missingReason: null,
  };
}
