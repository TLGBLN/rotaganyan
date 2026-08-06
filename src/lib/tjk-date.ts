/** Race.raceDay.date (UTC gece yarısı Date) → TJK'nın kendi geçmiş kayıtlarında kullandığı
 *  "gg.aa.yyyy" biçimi — bir koşunun kendi TARİHİNİ, TJK'dan çekilen "geçmiş" satırlarla
 *  karşılaştırıp DIŞLAMAK için (bkz. at-performans.actions.ts / son-yaris-detay.actions.ts /
 *  h2h.actions.ts ortak kullanımı, kullanıcı tespiti 2026-07-26: koşu bittikten SONRA analiz
 *  tekrar çalıştırılırsa, TJK'nın az önce güncellediği at profili bugünün kendi sonucunu
 *  "geçmiş" gibi geri döndürüyordu — at kendi yarışını "önceden kazanmış" gibi görünüyordu). */
export function toTjkDateString(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function sortableFromTjkDate(tjkDate: string): string | null {
  const m = tjkDate.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function sortableFromDate(date: Date): string {
  const dd = String(date.getUTCDate()).padStart(2, "0");
  const mm = String(date.getUTCMonth() + 1).padStart(2, "0");
  const yyyy = date.getUTCFullYear();
  return `${yyyy}-${mm}-${dd}`;
}

/** v6.59 — kullanıcı bulgusu 2026-08-04: yukarıdaki `!== todayStr` deseni yalnız
 * "hedef yarışla AYNI gün"ü dışlıyordu — bir yarış GEÇMİŞTE test/backtest edilirken
 * (kullanıcı: "koşulmuş bir koşu üzerinde test yaparsak sonuçtan etkilenmeden
 * sıralama yapabilir mi") at hedef yarıştan SONRA da koşmuşsa, o sonraki yarış(lar)
 * hâlâ "geçmiş" gibi süzülüp geri besleniyordu — gerçek bir sızıntı. Bu fonksiyon
 * hem aynı günü hem SONRAKİ günleri dışlar; yalnız hedef tarihten KESİN ÖNCEKİ
 * kayıtları "geçmiş" sayar. Parse edilemeyen tarih güvenli tarafta bırakılır (true —
 * dışlanmaz), çünkü format hatası veri kaybına değil fazladan bir satıra yol açar. */
export function tjkTarihOncesiMi(rowDateStr: string, targetDate: Date): boolean {
  const rowSortable = sortableFromTjkDate(rowDateStr);
  if (!rowSortable) return true;
  return rowSortable < sortableFromDate(targetDate);
}
