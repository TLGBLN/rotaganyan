import type { AltiliCityResult, YediliGanyanSonuc } from "@/server/services/ingest/tjk-altili.adapter";

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

/**
 * 2026-10-17 kullanıcı bulgusu — "Ankara — 7'li Ganyan" kupon kartında ikramiye cümlesi hiç
 * yoktu. Kök neden: findIkramiyeForHippodrome yalnız "N." ile başlayan Altılı etiketlerini
 * ("1. Altılı") eşliyor — "7'li Ganyan" etiketi bu kalıba UYMUYOR, bu yüzden 2026-08-16'dan
 * beri SESSİZCE null dönüyordu (bkz. race.service.ts'teki eski yorum). Bu fonksiyon AYNI
 * "{şehir} — {etiket}" formatını ayrıştırır ama "7'li Ganyan" etiketini tanır ve TJK'nın
 * kendi cümle biçimine ("6'lı Ganyan X ₺ vermiştir." ile AYNI format) uygun bir cümle üretir.
 */
export function findYediliIkramiyeForHippodrome(hippodromeName: string, yediliResults: YediliGanyanSonuc[]): string | null {
  const [cityName, label] = hippodromeName.split(" — ");
  if (!cityName || !label || !/7['’]?l[iİı]\s+ganyan/i.test(label)) return null;
  const city = yediliResults.find((c) => c.sehirAdi.trim().toLowerCase() === cityName.trim().toLowerCase());
  if (!city) return null;
  const tutar = city.gercekIkramiye.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `7'li Ganyan ${tutar} ₺ vermiştir.`;
}
