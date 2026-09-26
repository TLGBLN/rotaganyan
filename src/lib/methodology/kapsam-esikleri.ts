// "İlk N at yeter mi" sorusunun TEK, paylaşılan eşiği — RaceAdviceCard.tsx (rozet +
// açık eşik metni) ve KuponForm.tsx (seçim tablosundaki kırmızı/yeşil ayraç) AYNI
// sayılara bakmalı. 2026-09-10 kullanıcı bulgusu: eşikler daha önce yalnız
// RaceAdviceCard.tsx içinde gömülüydü, KuponForm.tsx'teki ayraç rengi bundan habersiz
// hep kırmızıydı — iki dosya sessizce ayrışabilirdi (bu oturumda tekrar tekrar
// bulunan "aynı bug iki dosyada" deseninin AYNISI).
export const KAPSAM_ESIK_ILK3 = 65;
export const KAPSAM_ESIK_ILK6 = 80;
// 2026-09-27 kullanıcı talebi: İlk3 barajını "zar zor geçmek" (%65.0) ile "rahat geçmek"
// (%90) aynı yeşil ✓ olmamalı — 5 puanlık ürün güvenlik tamponu. Yalnız görsel (kırmızı/
// amber/yeşil ayraç) DEĞİL, kupon-auto-fill.ts'teki coverage risk-floor'un 3. dalı (Q3
// %65-70 arası → minimum derinlik 4) da bu sabitle sınırlanıyor — gerçek kupon derinliğini
// etkiliyor, yalnız gösterim değil.
export const KAPSAM_ESIK_ILK3_AMBER_UST = 70;
