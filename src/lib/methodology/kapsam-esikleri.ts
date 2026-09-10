// "İlk N at yeter mi" sorusunun TEK, paylaşılan eşiği — RaceAdviceCard.tsx (rozet +
// açık eşik metni) ve KuponForm.tsx (seçim tablosundaki kırmızı/yeşil ayraç) AYNI
// sayılara bakmalı. 2026-09-10 kullanıcı bulgusu: eşikler daha önce yalnız
// RaceAdviceCard.tsx içinde gömülüydü, KuponForm.tsx'teki ayraç rengi bundan habersiz
// hep kırmızıydı — iki dosya sessizce ayrışabilirdi (bu oturumda tekrar tekrar
// bulunan "aynı bug iki dosyada" deseninin AYNISI).
export const KAPSAM_ESIK_ILK3 = 65;
export const KAPSAM_ESIK_ILK6 = 80;
