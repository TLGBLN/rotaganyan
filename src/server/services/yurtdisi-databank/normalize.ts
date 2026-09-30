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

/**
 * TJK'nın yurt dışı program tablosundaki "Yaş" hücresi "4y a k" gibi 3 parçalı geliyor
 * (yaş + ırk kodu + cinsiyet kodu — TR'nin 2 parçalı "4y a" formatından FARKLI). Kesin bir
 * doğum tarihi VERMEZ, yalnız YAKLAŞIK bir doğrulama sinyali üretir (Entity Resolution
 * V1.1 — kullanıcının notu: "isimle merge etme; mümkünse name+country+birthYear+sex
 * composite identity kullan"). approxBirthYear ±1 yıl yanlış olabilir (yarış takvimi
 * ülkeye göre nominal doğum günü farklı sayabiliyor) — bu yüzden KESİN eşitlik değil,
 * yalnız "belirgin çelişki var mı" testinde kullanılmalı.
 */
export function yasHucresiniAyristir(raw: string, referansYil: number): { approxBirthYear: number | null; sexCode: string | null } {
  const m = raw.trim().match(/^(\d+)\s*y\s+\S+\s+(\S+)$/i);
  if (!m) return { approxBirthYear: null, sexCode: null };
  const yas = parseInt(m[1], 10);
  if (!Number.isFinite(yas)) return { approxBirthYear: null, sexCode: null };
  return { approxBirthYear: referansYil - yas, sexCode: m[2].toUpperCase() };
}
