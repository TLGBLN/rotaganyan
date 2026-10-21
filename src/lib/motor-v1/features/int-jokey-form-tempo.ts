// ROTAGANYAN ANALİZ MOTORU v1.0 — İLİŞKİ #3: JOKEYİN 30 GÜNLÜK TRENDİ × AT FORMU × TEMPO.
//
// 2026-10-18 KULLANICI DÜZELTMESİ (uygulandı): "JOKEY_01 son 30 günlük performansı
// ölçüyorsa bu, yükseliş/düşüş TRENDİYLE AYNI ŞEY DEĞİLDİR." İlk sürüm yanlışlıkla JOKEY_01'in
// (bir SEVİYE) kendisini kullanıyordu — artık `int-jokey-trend.ts::computeJokeyTrend30`'un
// ÜRETTİĞİ GERÇEK FARK (son-30g − önceki-30g, logit ölçeğinde) kullanılıyor. Mount-kalitesi
// kontrolü HENÜZ YOK (bkz. int-jokey-trend.ts başlığı) — bu kısıt burada da GEÇERLİ,
// gizlenmiyor.
//
// Registry'nin kendi JOK_T05 = f(JOK_TREND, FORM_TREND, TMP_02) önerisiyle TUTARLI — FORM_02
// (zaten "trend", form.ts'in kendi tanımıyla) ve TEMPO_01'in frontGroupTendency'si BURADA
// YENİDEN HESAPLANMAZ — çağıran taraftan (feature-vector.ts'in zaten hesapladığı) ham
// değerler alınır.

export type IntJokeyFormTempoCode = "INT_JOKEY_FORM_TEMPO_01";

export type IntJokeyFormTempoEntry = {
  code: IntJokeyFormTempoCode;
  family: "INTERACTION";
  rawValue: number | null;
  observed: boolean;
  asOfSafe: true;
  missingReason: string | null;
};

/**
 * İLİŞKİ #3 — jokeyin son-30-gün (naif, AGF'siz) trendi × atın form trendi × atın tempo/
 * ön-grup eğilimi. Ham üçlü çarpım (§5.6) — standardizasyon eğitimde yapılır.
 */
export function computeJokeyFormTempoInteraction(
  jokeyTrendRaw: number | null, // computeJokeyTrend30().value — GERÇEK TREND (son30-önceki30), SEVİYE DEĞİL
  jokeyTrendObserved: boolean,
  form02Raw: number | null, // FORM_02.rawValue (form trendi) — YENİDEN HESAPLANMADI
  form02Observed: boolean,
  tempoFrontGroupTendency: number | null, // TEMPO_01 sonucunun frontGroupTendency alanı — YENİDEN HESAPLANMADI
  tempoObserved: boolean
): IntJokeyFormTempoEntry {
  const missing: string[] = [];
  if (!jokeyTrendObserved || jokeyTrendRaw == null) missing.push("JOKEY_TREND gözlemsiz");
  if (!form02Observed || form02Raw == null) missing.push("FORM_02 gözlemsiz (5'ten az geçerli yarış)");
  if (!tempoObserved || tempoFrontGroupTendency == null) missing.push("TEMPO_01 gözlemsiz");

  if (missing.length > 0) {
    return { code: "INT_JOKEY_FORM_TEMPO_01", family: "INTERACTION", rawValue: null, observed: false, asOfSafe: true, missingReason: missing.join("; ") };
  }
  return {
    code: "INT_JOKEY_FORM_TEMPO_01",
    family: "INTERACTION",
    rawValue: jokeyTrendRaw! * form02Raw! * tempoFrontGroupTendency!,
    observed: true,
    asOfSafe: true,
    missingReason: null,
  };
}
