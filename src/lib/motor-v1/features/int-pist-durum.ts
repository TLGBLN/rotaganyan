// ROTAGANYAN ANALİZ MOTORU v1.0 — İLİŞKİ #1 (HIZ×SINIF×PİST_DURUMU) ve İLİŞKİ #6
// (KİLO×MESAFE×PİST_DURUMU). Üçlü etkileşim, kullanıcı formülasyon standardı §5.6:
// I(i,a,b,c) = z(a)·z(b)·z(c) — standardizasyon EĞİTİM aşamasında ortak μ/σ ile yapılır,
// burada yalnız HAM üçlü çarpım döner (SINIF_01/KILO_03 ile AYNI disiplin).
//
// KRİTİK KISIT (bkz. pist-durum-wiring.ts başlığı): PİST_DURUM'un TARGET tarafı yalnız
// CANLI (henüz koşulmamış) yarışlarda güvenli — 452-yarış backtest kohortunun TAMAMINDA bu
// iki ilişki de observed=false döner (UYDURULMAZ, sessizce atlanmaz — missingReason açıkça
// "TARGET_NOT_PIT_VERIFIED" taşır). Bu DÜRÜST bir kısıttır, gizlenmez.

import type { GoingScoreResult } from "./pist-durum-score";

export type IntPistDurumCode = "INT_HIZ_SINIF_PIST_01" | "INT_KILO_MESAFE_PIST_01";

export type IntPistDurumEntry = {
  code: IntPistDurumCode;
  family: "INTERACTION";
  rawValue: number | null;
  observed: boolean;
  asOfSafe: true;
  missingReason: string | null;
};

function entry(code: IntPistDurumCode, rawValue: number | null, observed: boolean, missingReason: string | null): IntPistDurumEntry {
  return { code, family: "INTERACTION", rawValue, observed, asOfSafe: true, missingReason };
}

function pistObserved(score: GoingScoreResult): boolean {
  return score.value != null && score.reason === "OBSERVED";
}

function pistMissingReason(score: GoingScoreResult): string {
  // computePistDurum01'in kendi `reason` alanı zaten açıklayıcı — AYNEN taşınır, yeniden
  // yorumlanmaz (ör. TARGET_NOT_PIT_VERIFIED, TARGET_GOING_UNKNOWN, INSUFFICIENT_COMPARISON).
  return `pist durumu: ${score.reason}`;
}

/** İLİŞKİ #1 — hız × sınıf-gücü × pist-durumu-toleransı ham üçlü çarpımı. */
export function computeHizSinifPistInteraction(
  hiz01Raw: number | null,
  hiz01Observed: boolean,
  sinif01Raw: number | null,
  sinif01Observed: boolean,
  pistDurum: GoingScoreResult
): IntPistDurumEntry {
  if (!hiz01Observed || hiz01Raw == null) return entry("INT_HIZ_SINIF_PIST_01", null, false, "HIZ_01 gözlemsiz");
  if (!sinif01Observed || sinif01Raw == null) return entry("INT_HIZ_SINIF_PIST_01", null, false, "SINIF_01 gözlemsiz");
  if (!pistObserved(pistDurum)) return entry("INT_HIZ_SINIF_PIST_01", null, false, pistMissingReason(pistDurum));
  return entry("INT_HIZ_SINIF_PIST_01", hiz01Raw * sinif01Raw * pistDurum.value!, true, null);
}

/** İLİŞKİ #6 — göreli kilo × mesafe × pist-durumu-toleransı ham üçlü çarpımı (KILO_03'ün
 *  (kilo×mesafe) üzerine pist-durumu eklenmiş hâli — KILO_03 YENİDEN HESAPLANMAZ, ham girdi
 *  olarak alınır). */
export function computeKiloMesafePistInteraction(
  kilo03Raw: number | null, // computeKiloMesafeEtkilesimHam çıktısı — YENİDEN HESAPLANMADI
  pistDurum: GoingScoreResult
): IntPistDurumEntry {
  if (kilo03Raw == null) return entry("INT_KILO_MESAFE_PIST_01", null, false, "KILO_03 gözlemsiz");
  if (!pistObserved(pistDurum)) return entry("INT_KILO_MESAFE_PIST_01", null, false, pistMissingReason(pistDurum));
  return entry("INT_KILO_MESAFE_PIST_01", kilo03Raw * pistDurum.value!, true, null);
}
