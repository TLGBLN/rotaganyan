import type { AltiliCityResult } from "@/server/services/ingest/tjk-altili.adapter";

/** "İstanbul — 1. Altılı" gibi bir etiketten şehir adı + slot numarasını ayıklayıp TJK sonucundan ikramiye cümlesini bulur. */
export function findIkramiyeForHippodrome(hippodromeName: string, altiliResults: AltiliCityResult[]): string | null {
  const [cityName, altiliLabel] = hippodromeName.split(" — ");
  if (!cityName || !altiliLabel) return null;
  const slotMatch = altiliLabel.match(/^(\d+)\./);
  if (!slotMatch) return null;
  const slot = parseInt(slotMatch[1], 10);
  const city = altiliResults.find((c) => c.sehirAdi.trim().toLowerCase() === cityName.trim().toLowerCase());
  return city?.groups[slot - 1]?.ikramiye ?? null;
}
