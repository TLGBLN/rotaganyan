/** Result.actualOrder (JSON, bitiş sırasıyla at numaraları) içinde verilen atın kaçıncı
 *  bitirdiğini bulur — bulunamazsa null. Tek kaynak: PuanTablosu.tsx ve own-stat hesaplama
 *  servisi (pedigri-own-stat.service.ts) aynı parse mantığını paylaşır. */
export function finishPos(actualOrder: unknown, runnerNo: number | null | undefined): number | null {
  if (!Array.isArray(actualOrder) || runnerNo == null) return null;
  const idx = (actualOrder as string[]).findIndex((s) => parseInt(String(s), 10) === runnerNo);
  return idx >= 0 ? idx + 1 : null;
}
