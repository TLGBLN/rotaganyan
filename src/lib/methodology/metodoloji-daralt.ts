/**
 * v6.42 — kullanıcı denetimi (2026-08-02, İzmir 7.Koşu canlı testi sonrası): metodoloji
 * metni (§VII 10 kart + §XI galop barajları) her çağrıda TAM olarak gönderiliyordu — bir
 * Şartlı 4/Arap koşusu için Grup/KV kartları ve İngiliz safkan galop barajları da dahil
 * olmak üzere HİÇ kullanılmayacak ~9 kart daha gidiyordu. Bu fonksiyon yalnız STATİK
 * REFERANS TABLOLARINI (§VII kartı, §XI galop barajı) koşu tipine göre daraltır.
 *
 * BİLİNÇLİ SINIR (kullanıcıyla netleştirildi): bu daraltma YALNIZ metodoloji referans
 * metnine uygulanır — Faz1'in 77 veri kalemi ve Faz2'nin 64 maddesi HİÇBİR ŞEKİLDE
 * koşu tipine göre elenmiyor/atlanmıyor (bunlar zaten evrensel, her koşuda tüm atlar için
 * zorunlu — §XVII.1 "Tam Saha Muhakeme Zorunluluğu"). Bu ayrım kasıtlı: DARKROK/Çokomel
 * Kız/ELİTE TOUCH vakalarının kökü, bir kategorinin "bu koşu tipinde önemsiz" diye baştan
 * devre dışı bırakılmasıydı — o hatayı burada TEKRARLAMIYORUZ, yalnız Claude'un ihtiyaç
 * duymayacağı SABİT REFERANS verisini (başka bir ırkın galop saniye barajı, başka bir
 * sınıfın kart ağırlığı) göndermekten kaçınıyoruz.
 *
 * Cache etkisi: methodologyBlock artık koşu tipine göre FARKLILAŞIYOR — cache yalnız
 * AYNI kart+ırk kombinasyonundaki ardışık çağrılar arasında tam hızda paylaşılır, farklı
 * tipte bir koşuya geçişte cache write tekrar tetiklenir. Kullanıcı bu ödünleşimi
 * onayladı ("sen önce dediğimi yap").
 */

const KART_ESLESME: { test: (t: string) => boolean; kart: number }[] = [
  { test: (t) => /[ŞS]ARTLI\s*1\b|[ŞS]ARTLI\s*27\b/.test(t), kart: 1 },
  { test: (t) => /MAIDEN|[ŞS]ARTLI\s*19\b/.test(t), kart: 2 },
  { test: (t) => /[ŞS]ARTLI\s*2\b|[ŞS]ARTLI\s*3\b/.test(t), kart: 3 },
  { test: (t) => /[ŞS]ARTLI\s*4\b|[ŞS]ARTLI\s*5\b/.test(t), kart: 4 },
  { test: (t) => /HAND[İI]KAP\s*1[3-6]\b/.test(t), kart: 5 },
  { test: (t) => /HAND[İI]KAP\s*(1[7-9]|2[0-4])\b/.test(t), kart: 6 },
  { test: (t) => /\bKV[\s-]?\d/.test(t), kart: 7 },
  { test: (t) => /\bG\s*[123]\b/.test(t), kart: 8 },
  { test: (t) => /SAT(?:IŞ|IS)\s*\d/.test(t), kart: 9 },
  { test: (t) => /AMAT[ÖO]R|YAMAK|KADIN/.test(t), kart: 10 },
];

/** classType metninden hangi §VII.N kartının uygulandığını belirler. Eşleşme yoksa 0
 * döner — 0, "bilinmiyor, tam metni gönder" anlamına gelir (güvenli taraf). */
export function koşuTipiKarti(classType: string | null | undefined): number {
  if (!classType) return 0;
  const t = classType.toUpperCase();
  for (const { test, kart } of KART_ESLESME) {
    if (test(t)) return kart;
  }
  return 0;
}

/** Metodoloji metnindeki §VII.1-10 kartlarından yalnız ilgili olanı, §XI galop
 * barajlarından yalnız ilgili ırkınkini bırakır. Eşleşme bulunamazsa (kartNo=0 veya
 * breed=null) metni OLDUĞU GİBİ döndürür — belirsizlikte daraltma YAPILMAZ. */
export function daraltMetodoloji(fullText: string, classType: string | null | undefined, breed: string | null | undefined): string {
  const kartNo = koşuTipiKarti(classType);
  const lines = fullText.split("\n");
  const result: string[] = [];
  let skippingKart = false;

  for (const line of lines) {
    if (kartNo !== 0) {
      const viiMatch = line.match(/^### VII\.(\d+)\b/);
      if (viiMatch) {
        const n = parseInt(viiMatch[1], 10);
        skippingKart = n !== 0 && n !== kartNo;
      } else if (skippingKart && (line.startsWith("## ") || line.trim() === "---")) {
        skippingKart = false;
      }
      if (skippingKart) continue;
    }

    if (breed === "ARAP" && /\*\*İngiliz safkan:\*\*/.test(line)) continue;
    if (breed === "INGILIZ" && /\*\*Arap safkan:\*\*/.test(line)) continue;

    result.push(line);
  }
  return result.join("\n");
}
