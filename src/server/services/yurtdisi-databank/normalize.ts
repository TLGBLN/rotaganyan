/**
 * YD Veri Bankası — isim normalizasyonu. TR kodundan TAMAMEN AYRI (kullanıcı kararı,
 * 2026-09-30) — hiçbir TR dosyasından import etmez.
 *
 * "C Appleby" / "Charlie Appleby" / "C. Appleby" / "APPLEBY C" gibi aynı kişinin farklı
 * kaynak yazımlarını TEK normalizedName'e indirger — YurtDisiEntityAlias bu değer
 * üzerinden eşleştirme yapar. Kasıtlı olarak BASİT tutuldu (yalnız büyük harf + noktalama
 * temizliği + fazla boşluk) — "C Appleby" ile "Charlie Appleby" gibi kısaltma/tam-ad
 * farklarını otomatik ÇÖZMEZ, bunlar EntityAlias tablosuna elle/ayrı bir eşleştirme
 * turuyla eklenir (kullanıcının notu: "EntityAlias gerçekten çalıştırılmalı" — bu, ilk
 * günden mükemmel bir isim-çözücü değil, GENİŞLETİLEBİLİR bir alias sözleşmesi kurmaktır).
 */

/** At isimlerindeki "(USA)"/"(GB)"/"(IRE)" gibi ülke sonekini ayırır. */
export function atAdiUlkeAyristir(raw: string): { isim: string; ulkeKodu: string | null } {
  const m = raw.trim().match(/^(.*?)\s*\(([A-Z]{2,4})\)\s*$/);
  if (!m) return { isim: raw.trim(), ulkeKodu: null };
  return { isim: m[1].trim(), ulkeKodu: m[2] };
}

/** Genel normalize: büyük harf, noktalama/fazla boşluk temizliği. Ülke soneki KORUNUR
 *  (at isimleri için ayrı normalize edilir, bkz. normalizeHorseName) — jokey/antrenör/
 *  hipodrom isimleri için kullanılır. */
export function normalizeName(raw: string): string {
  return raw
    .trim()
    .toUpperCase()
    .replace(/[.,'’]/g, "")
    .replace(/\s+/g, " ");
}

/** At isimleri için normalize — "FOOLIN (USA)" ve "FOOLIN" aynı ata işaret etmeli, bu
 *  yüzden ülke soneki normalizedName'den ÇIKARILIR (ayrı equine kaydı olarak saklanmaz);
 *  gerçek ülke bilgisi countryOfBirth alanına gider (bkz. entity-resolution.ts). */
export function normalizeHorseName(raw: string): string {
  const { isim } = atAdiUlkeAyristir(raw);
  return normalizeName(isim);
}
