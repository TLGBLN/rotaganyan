// ROTAGANYAN ANALİZ MOTORU v1.0 — İLİŞKİ #5: TEMPO × YARIŞ STİLİ × KULVAR.
//
// KULLANICI UYARISI (2026-10-18): "Önceden reddedilen genel kulvar yüzdesini geri getirme."
// Registry (KULVAR_01/02, status:DISABLED) 2026-09-21'de BASİT DrawPct + 6 etkileşim
// adayının REDDEDİLDİĞİNİ kaydediyor ("işaret segmentler arası tersine dönüyor"). Bu dosya
// o ANA ETKİYİ (KULVAR_01'i TEK BAŞINA) skora SOKMAZ — yalnız TEMPO_01 (stil) ile ÇARPIMSAL
// bir HAM etkileşim terimi üretir; yönü/anlamlılığı SABİT VARSAYILMAZ, eğitimde öğrenilir.
// Hipodroma göre bağlamsal (KULVAR_02'nin istediği) ayrım bu turda YAPILMADI — AÇIK İŞ
// olarak raporlanır (örneklem yoğunluğu + segment-bazlı fit gerektirir, training.ts'in
// Aşama E'si kapsamında, ileride).

export type IntTempoStilKulvarCode = "KULVAR_01_HAM" | "INT_TEMPO_STIL_KULVAR_01";

export type IntTempoStilKulvarEntry = {
  code: IntTempoStilKulvarCode;
  family: "INTERACTION";
  rawValue: number | null;
  observed: boolean;
  asOfSafe: true;
  missingReason: string | null;
};

/** KULVAR_01 — göreli başlangıç pozisyonu (0-1). Yarış günü sabit veri, PIT sorunu yok. */
export function computeKulvar01(startNo: number | null, fieldSize: number): IntTempoStilKulvarEntry {
  if (startNo == null || !Number.isFinite(fieldSize) || fieldSize < 2) {
    return { code: "KULVAR_01_HAM", family: "INTERACTION", rawValue: null, observed: false, asOfSafe: true, missingReason: startNo == null ? "startNo bilinmiyor" : "saha<2 (N=1 tanımsız)" };
  }
  const value = (startNo - 1) / (fieldSize - 1);
  return { code: "KULVAR_01_HAM", family: "INTERACTION", rawValue: value, observed: true, asOfSafe: true, missingReason: null };
}

/** İLİŞKİ #5 — KULVAR_01 × TEMPO_01(leadTendency) ham çarpımı. Tek başına KULVAR_01'in
 *  REDDEDİLEN ana-etki kullanımından FARKLI — yalnız stil bağlamına göre koşullu bir terim. */
export function computeTempoStilKulvarInteraction(kulvar01: IntTempoStilKulvarEntry, leadTendency: number | null, leadTendencyObserved: boolean): IntTempoStilKulvarEntry {
  if (!kulvar01.observed || kulvar01.rawValue == null) {
    return { code: "INT_TEMPO_STIL_KULVAR_01", family: "INTERACTION", rawValue: null, observed: false, asOfSafe: true, missingReason: kulvar01.missingReason };
  }
  if (!leadTendencyObserved || leadTendency == null) {
    return { code: "INT_TEMPO_STIL_KULVAR_01", family: "INTERACTION", rawValue: null, observed: false, asOfSafe: true, missingReason: "TEMPO_01 gözlemsiz" };
  }
  return { code: "INT_TEMPO_STIL_KULVAR_01", family: "INTERACTION", rawValue: kulvar01.rawValue * leadTendency, observed: true, asOfSafe: true, missingReason: null };
}
