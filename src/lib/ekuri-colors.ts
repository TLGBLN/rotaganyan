/**
 * Eküri (coupled entry) grup renk paleti — ProgramView.tsx'teki EKURI_COLORS ile AYNI hex
 * değerleri kullanır (renk tutarlılığı sitenin her yerinde korunsun diye). O dosya Tailwind
 * arbitrary-value class'ları olarak statik yazılmak zorunda (JIT derlemesi için); burada aynı
 * değerler inline style ile boyanan yerler (OG posterleri, dinamik rozet renkleri) için düz hex
 * dizisi olarak tutuluyor.
 */
export const EKURI_HEX = ["#3498db", "#e67e22", "#9b59b6", "#e74c3c"];

export function ekuriColorFor(ekuriGroup: number): string {
  return EKURI_HEX[(ekuriGroup - 1) % EKURI_HEX.length];
}
