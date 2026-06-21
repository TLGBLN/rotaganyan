/** actualOrder girişleri hem sayı hem string ("3") olarak kaydedilmiş olabilir. */
function toRunnerNo(entry: unknown): number | null {
  if (typeof entry === "number") return entry;
  if (typeof entry === "string") {
    const n = parseInt(entry, 10);
    return isNaN(n) ? null : n;
  }
  return null;
}

/**
 * "Tuttu" kuralı: tahminin 1. seçimi gerçek sonuçta ilk 6'ya girerse hit sayılır
 * (sadece kesin 1.lik değil). actualOrder boşsa (manuel girişte sık), winnerNo'ya
 * düşülür — kazanan zaten ilk 6'nın içinde olduğundan bu da geçerli bir top-6 sinyalidir.
 */
export function computeHitTop1(
  actualOrder: unknown[] | null | undefined,
  winnerNo: number | null | undefined,
  pickNo: number | null | undefined
): boolean {
  if (pickNo == null) return false;
  const normalized = (actualOrder ?? []).map(toRunnerNo).filter((n): n is number => n != null);
  const top6 = normalized.length > 0 ? normalized.slice(0, 6) : winnerNo != null ? [winnerNo] : [];
  return top6.includes(pickNo);
}
