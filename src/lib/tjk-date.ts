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

// 2026-08-24 kullanıcı bulgusu (İSPANOZ vakası, gerçek kuponları etkiledi): TJK'nın
// "GG.AA.YYYY" formatı için kod tabanında 4 AYRI fonksiyon vardı, biri (hiz-derecesi.
// actions.ts) gün/ay sırasını TERS yazmıştı — "15.08.2026" 8 Mart 2027'ye dönüşüyordu.
// Artık TEK paylaşılan implementasyon burada — yeni bir TJK tarih ayrıştırması
// gerektiğinde YENİDEN YAZILMAMALI, buradan import edilmeli.
export function parseTjkDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])));
  if (d.getUTCDate() !== Number(m[1]) || d.getUTCMonth() !== Number(m[2]) - 1) return null;
  return d;
}

/** Sıralama için: geçersiz tarih NaN döner (önceki yerel kopyaların davranışı korunur). */
export function tjkTarihMs(s: string): number {
  return parseTjkDate(s)?.getTime() ?? NaN;
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

/** Araştırma yolları için sıkı (fail-closed) karşılaştırma: parse edilemeyen tarih de
 * "geçmiş" sayılmaz. Canlı tahmin yolu bunu kullanmaz (orada tjkTarihOncesiMi). */
export function tjkTarihOncesiKatiMi(rowDateStr: string, targetDate: Date): boolean {
  const rowSortable = sortableFromTjkDate(rowDateStr);
  if (!rowSortable) return false;
  return rowSortable < sortableFromDate(targetDate);
}

/** Araştırma/feature üretimi için zorunlu kapı: geçmiş satır hedef yarışın kesin önünde
 * değilse (aynı gün dahil, bozuk tarih dahil) hata fırlatır. */
export function assertBeforeRace(historicalDateStr: string, targetRaceDate: Date): void {
  if (!tjkTarihOncesiKatiMi(historicalDateStr, targetRaceDate)) {
    throw new Error(`LEAKAGE_GUARD: geçmiş tarih (${historicalDateStr}) hedef yarış tarihinden (${sortableFromDate(targetRaceDate)}) önce değil`);
  }
}
