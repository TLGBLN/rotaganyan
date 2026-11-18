# PEDİGRİ — PED_SIRE, PED_DAM, PED_DAMSIRE araştırması (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)
**KEŞİF (A/B/C dönemi, tekrar kullanıldı): NİHAİ DOĞRULAMA DEĞİLDİR.**

## 0. Tanım, parametreler, doğrulama
- **P̂_{l,g} = (W + k·P_g)/(N + k)**; l: soy hattı (SIRE: babanın yavruları; DAM: annenin DİĞER yavruları = kardeşler; DAMSIRE: anne-babasının soyundan gelen atlar); g: koşul = zemin (K/Ç/S) × mesafe bandı (≤1300 / 1400–1900 / ≥2000); W,N: hattın o koşuldaki yavru galibiyet/start sayısı; P_g: aynı koşuldaki TÜM startların galibiyet oranı. **Özellik = artık = P̂ − P_g** (koşula göre sapma; bilinmeyen hatta 0 = nötr). Yalnız tarih < yarış günü startları.
- **k:** kullanıcı değer vermedi; **önceden bildirilen iki değer: 10 ve 30 yan yana raporlanır; hiçbiri seçilmedi.** Karar tablolarında özet olarak k=30 gösterilir (az örnekli hatlara karşı daha muhafazakâr olduğu için önceden bildirilen birincil değer).
- **ÖRTÜŞME KORUMASI:** hedef atın KENDİ geçmiş startları W, N ve P_g'den çıkarılır (kendi geçmişi soy hattı istatistiğine ikinci kez girmez; SON6/ACC_HIZ çift sayılmaz). Birim testi bunu doğrular.
- **Doğrulama:** gelecek-bozma testi (gerçek veri, 1593 hat-at okuması) GEÇTİ; bağımsız yeniden hesap (düz döngü, ham başlangıçlardan) 200 atta 0 uyuşmazlık. Birim testleri: `pedigri-aday.test.ts` (formül, kendi startlarını çıkarma, as-of, sızıntı, düz-döngü, saflık).
- **Taban B6 (güncel araştırma havuzu):** ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (H_180_3), Y_son, T_son. **cB6:** B6 + hp, son 10 yarış kazanma/ilk-3 oranı, sınıf değişimi. Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 puan; [%95 eşleştirilmiş bootstrap]; ✓/○/✗; (+/−) test yarılarında ΔLL işareti.
- **Örneklem:** tüm yarışlar 5309 (2026-01-01→2026-11-17). 6 blok ileri-yönlü β. **Keşif sonucu nihai doğrulama sayılmaz.**

## 1. Veri envanteri
- Soyu bilinen at (tjkAtId'li, veritabanındaki koşucular): **7229**; baba 7229, anne 7229, anne-babası 7227 (hepsi: 7227). Yavru start (önbellekten; geçerli bitiş sırası, zemin ve mesafesi olan): **118572**; galibiyet oranı 12.8%.
| Hat | Farklı hat | Medyan yavru (at) | ≥10 yavrulu hat | ≥30 yavrulu hat | En kalabalık |
|---|---|---|---|---|---|
| Baba | 611 | 3 | 159 | 70 | 134 yavru |
| Anne (kardeşler) | 5027 | 1 | 0 | 0 | 5 yavru |
| Anne-babası | 876 | 2 | 154 | 52 | 213 yavru |

- **Yarış anında kullanılabilir hat verisi** (hedef atın kendi startları çıkarıldıktan sonra, aynı koşulda): hat start sayısı N ≥ 1: baba %93.9, anne %33.4, anne-babası %90.6; N ≥ 10: baba %84.0, anne %9.4, anne-babası %77.0; N ≥ 30: baba %69.7, anne %1.0, anne-babası %60.6. Özellik değeri olan at: baba 99.6%, anne 99.6%, anne-babası 99.6%.
- **Kendi startları çıkarılan at payı** (baba hattında ≥1 kendi start çıkarıldı): 76.4% (bu atlar için çift sayım engellendi).
- **Anne hattı çok seyrek:** annelerin çoğunun veritabanımızda tek yavrusu var; PED_DAM ağırlıklı olarak bilgisiz (nötr) kalacaktır.

## 2. Özel durum popülasyonları (kullanıcı)
| Popülasyon | Tanım | At | Yarış (≥1 at) | At payı |
|---|---|---|---|---|
| İlk kez koşan / kayıtlı geçmişi yok | hedef günden önce kayıtlı yarışı yok | 3226 | 857 | 6.1% |
| İlk kez farklı mesafe bandı | bugünkü mesafe bandında önceki yarışı yok (≥1 önceki yarışı var) | 3928 | 1458 | 7.4% |
| Pist (zemin) değiştiren | bugünkü zeminde önceki yarışı yok (≥1 önceki yarışı var) | 3354 | 1543 | 6.3% |
| Deneyimli | ≥6 önceki yarış | 38009 | 4758 | 71.5% |
*İlk kez koşan grubu 'kayıtlı geçmişi yok' atlarını da içerir (önbellekte olmayan atlar).*

## 3. Örtüşme (yarış içi merkezlenmiş; k=30)
| Bileşen | r(SON6) | r(ACC_HIZ) | r(J_SEVIYE) | r(H2H) | r(GALOP) | r(Y_son) | r(T_son) | r(hp) | r(son10 kazanma) | R² (B6) | R² (cB6) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PED_SIRE | 0.02 | 0.03 | 0.01 | 0.02 | 0.01 | -0.00 | 0.01 | 0.02 | -0.01 | 0.002 | 0.003 |
| PED_DAM | 0.02 | 0.02 | 0.02 | 0.01 | 0.00 | 0.01 | 0.01 | 0.00 | 0.01 | 0.001 | 0.001 |
| PED_DAMSIRE | 0.02 | 0.02 | 0.01 | 0.01 | 0.02 | 0.01 | -0.00 | 0.01 | 0.02 | 0.001 | 0.002 |

**Bileşenler arası r:** SIRE–DAM 0.05, SIRE–DAMSIRE 0.02, DAM–DAMSIRE 0.26.

## 4. Tek başına, B6 üzerine ve bileşenler birbirine karşı
Test yarışı 4424. B6: kazanç 9.95%, Top1 25.7%, Top3 59.1%; cB6: 11.47%.
### k = 10
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| PED_SIRE tek başına (1/N'ye) | ✓ 0.08 [0.02; 0.13] | -0.1 [-1.0; 0.7] | 1.8 [0.5; 3.2] | ++ |
| PED_DAM tek başına (1/N'ye) | ○ 0.04 [-0.04; 0.11] | 0.8 [0.1; 1.6] | 1.1 [0.2; 2.1] | ++ |
| PED_DAMSIRE tek başına (1/N'ye) | ✓ 0.05 [0.00; 0.09] | 1.6 [0.6; 2.6] | 1.6 [0.3; 3.0] | ++ |
| **PED_SIRE, B6 üzerine** | ✓ 0.05 [0.01; 0.09] | 0.1 [-0.3; 0.5] | -0.1 [-0.4; 0.3] | ++ |
| **PED_DAM, B6 üzerine** | ○ -0.03 [-0.10; 0.05] | 0.0 [-0.4; 0.4] | 0.1 [-0.3; 0.5] | −− |
| **PED_DAMSIRE, B6 üzerine** | ○ 0.02 [-0.01; 0.05] | -0.0 [-0.4; 0.3] | 0.0 [-0.2; 0.3] | ++ |
| Üç bileşen birlikte, B6 üzerine | ○ 0.03 [-0.07; 0.12] | -0.1 [-0.6; 0.5] | -0.1 [-0.6; 0.4] | −+ |
| PED_SIRE, cB6 üzerine | ✓ 0.05 [0.00; 0.09] | 0.1 [-0.3; 0.4] | 0.0 [-0.4; 0.4] | ++ |
| PED_DAM, cB6 üzerine | ○ -0.01 [-0.07; 0.05] | -0.1 [-0.5; 0.3] | 0.1 [-0.3; 0.4] | −− |
| PED_DAMSIRE, cB6 üzerine | ○ 0.02 [-0.01; 0.05] | 0.1 [-0.2; 0.4] | 0.1 [-0.2; 0.5] | ++ |
| Üç bileşen birlikte, cB6 üzerine | ○ 0.04 [-0.04; 0.11] | 0.1 [-0.4; 0.5] | 0.0 [-0.5; 0.5] | ++ |
| **Özgün katkı (LOO): PED_SIRE** (üçü − diğer ikisi, B6 üzerine) | ✓ 0.05 [0.01; 0.09] | -0.3 [-0.7; 0.1] | -0.3 [-0.7; 0.0] | ++ |
| **Özgün katkı (LOO): PED_DAM** | ○ -0.04 [-0.11; 0.03] | 0.0 [-0.4; 0.4] | 0.0 [-0.4; 0.5] | −− |
| **Özgün katkı (LOO): PED_DAMSIRE** | ○ 0.01 [-0.02; 0.03] | 0.1 [-0.1; 0.4] | 0.0 [-0.3; 0.3] | −+ |
| Özgün katkı (LOO, kontrollü): PED_SIRE | ✓ 0.04 [0.01; 0.08] | 0.2 [-0.1; 0.6] | -0.2 [-0.6; 0.2] | ++ |
| Özgün katkı (LOO, kontrollü): PED_DAM | ○ -0.03 [-0.08; 0.03] | -0.1 [-0.5; 0.2] | 0.0 [-0.4; 0.4] | −− |
| Özgün katkı (LOO, kontrollü): PED_DAMSIRE | ○ 0.00 [-0.02; 0.03] | 0.1 [-0.2; 0.3] | -0.1 [-0.4; 0.2] | −+ |

### k = 30
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| PED_SIRE tek başına (1/N'ye) | ✓ 0.07 [0.01; 0.13] | 0.1 [-0.8; 1.0] | 1.8 [0.5; 3.1] | ++ |
| PED_DAM tek başına (1/N'ye) | ○ 0.04 [-0.04; 0.11] | 0.9 [0.2; 1.8] | 1.1 [0.1; 2.1] | ++ |
| PED_DAMSIRE tek başına (1/N'ye) | ○ 0.04 [-0.00; 0.08] | 1.3 [0.3; 2.2] | 1.7 [0.5; 3.0] | ++ |
| **PED_SIRE, B6 üzerine** | ✓ 0.04 [0.00; 0.09] | -0.0 [-0.4; 0.4] | -0.2 [-0.6; 0.2] | ++ |
| **PED_DAM, B6 üzerine** | ○ -0.02 [-0.09; 0.05] | 0.0 [-0.4; 0.4] | 0.2 [-0.2; 0.6] | −− |
| **PED_DAMSIRE, B6 üzerine** | ○ 0.01 [-0.02; 0.04] | 0.2 [-0.1; 0.5] | 0.0 [-0.2; 0.3] | ++ |
| Üç bileşen birlikte, B6 üzerine | ○ 0.01 [-0.08; 0.10] | 0.1 [-0.4; 0.6] | -0.1 [-0.7; 0.4] | −+ |
| PED_SIRE, cB6 üzerine | ○ 0.04 [-0.00; 0.08] | 0.2 [-0.2; 0.6] | 0.0 [-0.5; 0.4] | ++ |
| PED_DAM, cB6 üzerine | ○ -0.01 [-0.07; 0.05] | -0.1 [-0.5; 0.2] | 0.2 [-0.2; 0.5] | −+ |
| PED_DAMSIRE, cB6 üzerine | ○ 0.01 [-0.02; 0.03] | 0.1 [-0.2; 0.4] | 0.0 [-0.3; 0.3] | +− |
| Üç bileşen birlikte, cB6 üzerine | ○ 0.02 [-0.05; 0.09] | 0.1 [-0.4; 0.5] | -0.0 [-0.5; 0.5] | −+ |
| **Özgün katkı (LOO): PED_SIRE** (üçü − diğer ikisi, B6 üzerine) | ○ 0.04 [-0.00; 0.08] | -0.1 [-0.5; 0.2] | -0.3 [-0.7; 0.1] | ++ |
| **Özgün katkı (LOO): PED_DAM** | ○ -0.04 [-0.11; 0.03] | 0.1 [-0.3; 0.5] | 0.1 [-0.4; 0.5] | −− |
| **Özgün katkı (LOO): PED_DAMSIRE** | ○ -0.00 [-0.03; 0.02] | 0.3 [0.0; 0.6] | 0.0 [-0.2; 0.3] | −+ |
| Özgün katkı (LOO, kontrollü): PED_SIRE | ✓ 0.04 [0.00; 0.08] | 0.1 [-0.3; 0.5] | -0.2 [-0.6; 0.2] | ++ |
| Özgün katkı (LOO, kontrollü): PED_DAM | ○ -0.02 [-0.08; 0.03] | -0.2 [-0.5; 0.2] | 0.0 [-0.4; 0.4] | −− |
| Özgün katkı (LOO, kontrollü): PED_DAMSIRE | ○ -0.01 [-0.03; 0.02] | -0.0 [-0.2; 0.2] | -0.1 [-0.3; 0.2] | −− |

## 5. Özel durum popülasyonlarında pedigri (k=30; B6 üzerine ΔLL%)
Her satır, yalnızca o popülasyondaki atlara uygulanan pedigri özelliği (diğer atlar nötr = 0) eklenince B6'ya ek ΔLL% (tüm test yarışları üzerinden; popülasyon küçükse seyrelir). Betimleyici tablolar altta.
| Popülasyon | PED_SIRE | PED_DAM | PED_DAMSIRE | Üçü birlikte |
|---|---|---|---|---|
| İlk kez koşan / geçmişi yok | ○ -0.02% (−+) | ○ 0.01% (+−) | ○ -0.02% (−−) | ○ -0.04% (−+) |
| İlk kez farklı mesafe bandı | ○ -0.03% (−−) | ○ -0.01% (+−) | ○ -0.03% (−−) | ○ -0.08% (−−) |
| Pist (zemin) değiştiren | ○ -0.02% (−+) | ○ 0.00% (−+) | ○ -0.01% (+−) | ○ -0.03% (−−) |
| Deneyimli (≥6 yarış) | ○ 0.01% (−+) | ○ -0.03% (−+) | ○ -0.00% (−+) | ○ -0.03% (−+) |

**Ayrıntı (ΔTop1 / ΔTop3 puan; üçü birlikte):**
| Popülasyon | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] |
|---|---|---|---|
| İlk kez koşan / geçmişi yok | ○ -0.04 [-0.12; 0.04] | -0.0 [-0.3; 0.2] | -0.4 [-0.7; -0.1] |
| İlk kez farklı mesafe bandı | ○ -0.08 [-0.17; 0.02] | -0.0 [-0.3; 0.3] | -0.2 [-0.5; 0.0] |
| Pist (zemin) değiştiren | ○ -0.03 [-0.11; 0.05] | 0.0 [-0.2; 0.3] | -0.0 [-0.3; 0.3] |
| Deneyimli (≥6 yarış) | ○ -0.03 [-0.10; 0.04] | 0.1 [-0.2; 0.5] | 0.0 [-0.3; 0.4] |

**Betimleyici: popülasyon içinde pedigri üçte biri → B6 beklentisine göre kazanma** (test yarışları; z = (kazanan − ΣP)/√ΣP(1−P); üçte birler popülasyon içi, bileşen değerine göre; çok hücre, düzeltme yok):
| Popülasyon | Bileşen | Üçte bir | n at | Kazanan | Beklenen (B6) | z |
|---|---|---|---|---|---|---|
| İlk kez koşan / geçmişi yok | PED_SIRE | alt | 921 | 69 | 83.0 | -1.63 |
| İlk kez koşan / geçmişi yok | PED_SIRE | orta | 922 | 74 | 85.8 | -1.35 |
| İlk kez koşan / geçmişi yok | PED_SIRE | üst | 922 | 97 | 88.8 | 0.93 |
| İlk kez koşan / geçmişi yok | PED_DAMSIRE | alt | 921 | 62 | 81.8 | -2.31 |
| İlk kez koşan / geçmişi yok | PED_DAMSIRE | orta | 922 | 83 | 86.5 | -0.40 |
| İlk kez koşan / geçmişi yok | PED_DAMSIRE | üst | 922 | 95 | 89.2 | 0.65 |
| İlk kez farklı mesafe bandı | PED_SIRE | alt | 1083 | 98 | 108.0 | -1.07 |
| İlk kez farklı mesafe bandı | PED_SIRE | orta | 1084 | 113 | 111.6 | 0.15 |
| İlk kez farklı mesafe bandı | PED_SIRE | üst | 1084 | 108 | 119.0 | -1.13 |
| İlk kez farklı mesafe bandı | PED_DAMSIRE | alt | 1083 | 95 | 108.6 | -1.46 |
| İlk kez farklı mesafe bandı | PED_DAMSIRE | orta | 1082 | 107 | 110.9 | -0.41 |
| İlk kez farklı mesafe bandı | PED_DAMSIRE | üst | 1086 | 117 | 119.2 | -0.22 |
| Pist (zemin) değiştiren | PED_SIRE | alt | 1003 | 73 | 81.9 | -1.06 |
| Pist (zemin) değiştiren | PED_SIRE | orta | 1003 | 81 | 83.8 | -0.33 |
| Pist (zemin) değiştiren | PED_SIRE | üst | 1003 | 91 | 87.5 | 0.40 |
| Pist (zemin) değiştiren | PED_DAMSIRE | alt | 1002 | 83 | 83.5 | -0.06 |
| Pist (zemin) değiştiren | PED_DAMSIRE | orta | 1003 | 69 | 83.6 | -1.72 |
| Pist (zemin) değiştiren | PED_DAMSIRE | üst | 1003 | 93 | 85.9 | 0.83 |
| Deneyimli (≥6 yarış) | PED_SIRE | alt | 10451 | 956 | 1013.4 | -1.97 |
| Deneyimli (≥6 yarış) | PED_SIRE | orta | 10451 | 1030 | 1027.9 | 0.07 |
| Deneyimli (≥6 yarış) | PED_SIRE | üst | 10452 | 1076 | 1058.5 | 0.59 |
| Deneyimli (≥6 yarış) | PED_DAMSIRE | alt | 10450 | 982 | 1000.7 | -0.64 |
| Deneyimli (≥6 yarış) | PED_DAMSIRE | orta | 10450 | 1019 | 1032.4 | -0.46 |
| Deneyimli (≥6 yarış) | PED_DAMSIRE | üst | 10450 | 1060 | 1066.3 | -0.21 |

## 6. Yarış tipine göre (k=30; n ≥ 150 'yeterli')
| Karşılaştırma | Tümü (n=4424) | Maiden (n=890) | Şartlı (n=1498) | Handikap (n=1289) | KV (n=491) | Grup (n=128, yetersiz) | Satış (n=123, yetersiz) |
|---|---|---|---|---|---|---|---|
| PED_SIRE → B6 | ○ 0.04% (++) | ○ 0.03% (++) | ○ 0.04% (++) | ○ 0.04% (++) | ○ 0.06% (−+) | ○ -0.12% (−−) | ○ 0.22% (++) |
| PED_DAM → B6 | ○ -0.02% (−−) | ○ 0.07% (++) | ○ -0.10% (−−) | ○ -0.00% (−+) | ○ -0.01% (−+) | ○ 0.14% (+−) | ○ -0.19% (−+) |
| PED_DAMSIRE → B6 | ○ 0.01% (++) | ○ 0.00% (+−) | ○ 0.03% (++) | ○ 0.01% (++) | ○ 0.01% (−+) | ○ -0.01% (+−) | ○ 0.02% (−+) |
| Üçü birlikte → B6 | ○ 0.01% (−+) | ○ 0.09% (++) | ○ -0.06% (−−) | ○ 0.04% (−+) | ○ 0.02% (−+) | ○ -0.00% (+−) | ○ 0.03% (−+) |
| Üçü birlikte → cB6 | ○ 0.02% (−+) | ○ 0.08% (++) | ○ -0.07% (−−) | ○ 0.08% (++) | ○ 0.03% (−+) | ○ -0.02% (+−) | ○ 0.16% (++) |
| LOO PED_SIRE | ✓ 0.04% (++) | ○ 0.03% (++) | ○ 0.04% (++) | ○ 0.04% (++) | ○ 0.06% (−+) | ○ -0.11% (−−) | ○ 0.21% (++) |
| LOO PED_DAMSIRE | ○ -0.00% (−+) | ○ -0.01% (+−) | ○ 0.00% (−+) | ○ 0.00% (++) | ○ -0.03% (−+) | ○ -0.04% (−−) | ○ 0.01% (−+) |

## 7. SADECE Şartlı 1 ve Şartlı 27 (kullanıcı isteği)
Bu iki sınıfın test yarışı sayısı: **Şartlı 1: 164; Şartlı 27: 11; birlikte: 175** (tüm yarışlarda eğitilmiş ortak β ile bu yarışlara dilimlenerek değerlendirildi; yalnız bu yarışlarda ayrı model eğitilmedi). Veritabanında toplam Şartlı 1 = 183 ve Şartlı 27 = 11 yarış var; **Şartlı 27 çıkarım için fazla küçüktür (yetersiz n).** Aşağıdaki aralıklar çok geniştir; ✓/✗ yokluğu 'etki yok' değil 'ölçülemedi' demektir.
| Karşılaştırma | Şartlı 1 (n=164) | Şartlı 27 (n=11) | Şartlı 1 + 27 (n=175) |
|---|---|---|---|
| PED_SIRE → B6 (k=30) | ○ 0.18% (−+) | — (n<30) | ○ 0.16% (−+) |
| PED_DAM → B6 (k=30) | ○ 0.08% (+−) | — (n<30) | ○ 0.06% (+−) |
| PED_DAMSIRE → B6 (k=30) | ○ -0.00% (+−) | — (n<30) | ○ -0.01% (+−) |
| Üçü birlikte → B6 (k=30) | ○ 0.18% (++) | — (n<30) | ○ 0.15% (++) |
| PED_SIRE → B6 (k=10) | ○ 0.20% (−+) | — (n<30) | ○ 0.19% (−+) |
| Üçü birlikte → B6 (k=10) | ○ 0.28% (++) | — (n<30) | ○ 0.24% (++) |
| Üçü birlikte → cB6 (k=30) | ○ 0.17% (++) | — (n<30) | ○ 0.14% (++) |

**Aynı yarışlarda mevcut havuzun özgün katkısı (B6 − sinyalsiz model; ΔLL%):**
| Sinyal | Şartlı 1 (n=164) | Şartlı 27 (n=11) | Şartlı 1 + 27 (n=175) |
|---|---|---|---|
| ACC_HIZ | ✗ -0.05% (−−) | — (n<30) | ✗ -0.05% (−−) |
| GALOP_KAPASITE | ○ -0.19% (−−) | — (n<30) | ○ -0.48% (−−) |
| J_SEVIYE | ✓ 3.09% (++) | — (n<30) | ✓ 3.22% (++) |
| SON6 | ✗ -0.49% (−−) | — (n<30) | ✗ -0.51% (−−) |
| H2H_NET | ✗ -0.38% (−−) | — (n<30) | ✗ -0.45% (−−) |
| Y_son | ✓ 0.03% (−+) | — (n<30) | ✓ 0.04% (−+) |
| T_son | ✗ -0.03% (−−) | — (n<30) | ✗ -0.03% (−−) |

**Top1/Top3 (Şartlı 1 + 27, birlikte):**
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] |
|---|---|---|---|
| PED_SIRE → B6 (k=30) | ○ 0.16 [-0.07; 0.39] | -0.6 [-4.6; 2.9] | -2.9 [-7.4; 1.1] |
| Üçü birlikte → B6 (k=30) | ○ 0.15 [-0.24; 0.57] | 2.3 [-2.9; 7.4] | -0.6 [-5.7; 4.6] |
| SON6 özgün katkı | ✗ -0.51 [-0.67; -0.36] | -0.6 [-1.7; 0.0] | 0.0 [-1.7; 1.7] |
| Y_son özgün katkı | ✓ 0.04 [0.02; 0.06] | 0.0 [0.0; 0.0] | 0.6 [0.0; 1.7] |
| T_son özgün katkı | ✗ -0.03 [-0.05; -0.01] | 0.0 [0.0; 0.0] | 0.6 [0.0; 1.7] |

**B6 modeli bu yarışlarda:** kazanç 2.63%, Top1 22.3%, Top3 55.4%; rastgele (1/N) Top1 11.2%.

**Betimleyici: Şartlı 1 + 27 test yarışlarında pedigri üçte biri → B6 beklentisine göre kazanma** (üçte birler bu yarışlardaki bileşen değerine göre; z = (kazanan − ΣP)/√ΣP(1−P)):
| Bileşen | Üçte bir | n at | Kazanan | Beklenen (B6) | z |
|---|---|---|---|---|---|
| PED_SIRE | alt | 554 | 53 | 56.8 | -0.54 |
| PED_SIRE | orta | 557 | 56 | 57.5 | -0.21 |
| PED_SIRE | üst | 556 | 66 | 60.7 | 0.73 |
| PED_DAMSIRE | alt | 555 | 42 | 56.0 | -1.98 |
| PED_DAMSIRE | orta | 555 | 68 | 59.5 | 1.17 |
| PED_DAMSIRE | üst | 557 | 65 | 59.5 | 0.76 |

## 8. Şartlı 1/27'de sinyaller neden zayıf? (tanı; yeni sinyal yok)
**(a) Yarış/at bileşimi (tüm yarışlar, kıyas grupları ile):** sinyal kapsamı = değeri olan at payı; ilk kez koşan = kayıtlı önceki yarışı yok.
| Grup | n yarış | Ort. saha | İlk kez koşan | Ort. önceki yarış sayısı | ACC_HIZ kapsamı | SON6 kapsamı | H2H kapsamı | GALOP kapsamı | J_SEVIYE kapsamı |
|---|---|---|---|---|---|---|---|---|---|
| Şartlı 1/27 | 191 | 9.6 | 100.0% | 0.0 | 0.0% | 0.0% | 0.0% | 44.1% | 91.2% |
| Şartlı 3/4/5 (diğer) | 1406 | 9.0 | 0.9% | 22.3 | 78.7% | 98.8% | 76.2% | 37.5% | 84.3% |
| Şartlı 19/2 | 166 | 12.1 | 5.8% | 8.7 | 75.5% | 93.2% | 69.2% | 46.0% | 95.8% |
| Maiden | 1092 | 10.8 | 8.9% | 4.6 | 65.1% | 90.0% | 52.6% | 40.6% | 83.1% |
| Handikap | 1566 | 11.0 | 0.5% | 21.3 | 82.1% | 99.5% | 82.1% | 36.9% | 83.8% |
| KV | 587 | 7.8 | 0.4% | 22.0 | 80.7% | 99.4% | 77.9% | 44.6% | 87.1% |
| Tümü | 5309 | 10.0 | 6.1% | 16.7 | 74.3% | 93.6% | 70.2% | 39.6% | 84.9% |

**(b) Modelden bağımsız ayırt edicilik: kazananın yarış-içi yüzdeliği** (kazananın, değeri olan atlar arasında yüzdelik sırası; 0,50 = ayırt etmiyor; yüksek = iyi; ± = standart hata; her yarışta ≥3 değerli at):
| Grup | n yarış | ACC_HIZ | GALOP_KAPASITE | J_SEVIYE | SON6 | H2H_NET | Y_son | T_son | PED_SIRE | PED_DAMSIRE | hp |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Şartlı 1/27 | 191 | — | 0.659 ✓ ±0.032 | 0.667 ✓ ±0.023 | — | — | — | — | 0.509 ±0.024 | 0.533 ±0.021 | — |
| Şartlı 3/4/5 (diğer) | 1406 | 0.672 ✓ ±0.009 | 0.579 ✓ ±0.014 | 0.621 ✓ ±0.009 | 0.702 ✓ ±0.008 | 0.651 ✓ ±0.010 | 0.556 ✓ ±0.006 | 0.540 ✓ ±0.006 | 0.499 ±0.009 | 0.525 ✓ ±0.009 | 0.696 ✓ ±0.008 |
| Şartlı 19/2 | 166 | 0.680 ✓ ±0.026 | 0.524 ±0.036 | 0.663 ✓ ±0.023 | 0.678 ✓ ±0.024 | 0.633 ✓ ±0.031 | 0.506 ±0.007 | 0.572 ✓ ±0.019 | 0.503 ±0.025 | 0.514 ±0.026 | 0.669 ✓ ±0.028 |
| Maiden | 1092 | 0.717 ✓ ±0.010 | 0.582 ✓ ±0.015 | 0.652 ✓ ±0.010 | 0.723 ✓ ±0.009 | 0.671 ✓ ±0.013 | 0.501 ±0.001 | 0.632 ✓ ±0.008 | 0.523 ✓ ±0.010 | 0.498 ±0.010 | 0.703 ✓ ±0.011 |
| Handikap | 1566 | 0.643 ✓ ±0.008 | 0.548 ✓ ±0.013 | 0.626 ✓ ±0.008 | 0.656 ✓ ±0.007 | 0.638 ✓ ±0.009 | 0.542 ✓ ±0.005 | 0.559 ✓ ±0.006 | 0.514 ±0.008 | 0.505 ±0.008 | 0.562 ✓ ±0.008 |
| KV | 587 | 0.640 ✓ ±0.015 | 0.547 ✓ ±0.020 | 0.630 ✓ ±0.014 | 0.676 ✓ ±0.013 | 0.662 ✓ ±0.015 | 0.574 ✓ ±0.011 | 0.511 ±0.011 | 0.507 ±0.013 | 0.518 ±0.013 | 0.674 ✓ ±0.013 |
| Tümü | 5309 | 0.667 ✓ ±0.005 | 0.565 ✓ ±0.007 | 0.635 ✓ ±0.005 | 0.686 ✓ ±0.004 | 0.651 ✓ ±0.005 | 0.540 ✓ ±0.003 | 0.561 ✓ ±0.004 | 0.511 ✓ ±0.004 | 0.511 ✓ ±0.004 | 0.649 ✓ ±0.004 |

**(c) Ağırlık uyumsuzluğu testi: yalnız Şartlı 1/27 yarışlarında β öğrenilirse** (segment-only 6 blok ileri-yönlü; test 160 yarış; ortak β sonuçlarıyla AYNI test yarışları DEĞİL, yalnız büyüklük karşılaştırması içindir):
| Model | Kazanç (1/N'ye göre) % | Top1 % | Top3 % |
|---|---|---|---|
| B6 (tüm yedi sinyal) | 7.20 | 26.9 | 60.0 |
| yalnız J_SEVIYE | 5.02 | 25.0 | 57.5 |
| yalnız SON6 | 0.00 | 11.2 | 33.5 |
| yalnız ACC_HIZ | 0.00 | 11.2 | 33.5 |
| yalnız H2H_NET | 0.00 | 11.2 | 33.5 |
| yalnız Y_son+T_son | 0.00 | 11.2 | 33.5 |
| B6 − performans sinyalleri (J_SEVIYE + Y + T) | 5.02 | 25.0 | 57.5 |

Segment-only B6'da her sinyalin özgün katkısı (B6 − sinyalsiz; ΔLL%):
| Sinyal | ΔLL% [%95] |
|---|---|
| ACC_HIZ | ○ 0.00 [0.00; 0.00] |
| GALOP_KAPASITE | ✓ 2.18 [0.60; 3.83] |
| J_SEVIYE | ✓ 4.41 [2.70; 6.08] |
| SON6 | ○ 0.00 [0.00; 0.00] |
| H2H_NET | ○ 0.00 [0.00; 0.00] |
| Y_son | ○ 0.00 [0.00; 0.00] |
| T_son | ○ 0.00 [0.00; 0.00] |

Karşılaştırma için: ortak β ile Şartlı 1/27 dilimi (n=175) B6 kazancı 2.63%, tüm yarışlarda 9.95%.

## 9. Pedigrinin ilk kez koşan atlardaki ek katkısı
İlk kez koşan (kayıtlı önceki yarışı olmayan) en az bir at içeren test yarışı: **758** (4424 içinde); bu yarışların 33.6%'ünde kazanan ilk kez koşan bir at (tüm atlar arasında ilk kez koşan payı %6.1). **ΔLL% yalnız bu yarışlarda** (daha önce tüm yarışlar üzerinden seyreltilmişti):
| Karşılaştırma (B6 üzerine) | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| İlk kez koşanlara özel PED_SIRE (k=30) | ○ -0.09 [-0.34; 0.12] | -0.4 [-1.6; 0.8] | -2.9 [-4.5; -1.3] | −+ |
| İlk kez koşanlara özel PED_DAM (k=30) | ○ 0.03 [-0.20; 0.28] | -0.9 [-2.4; 0.4] | -0.5 [-2.0; 0.9] | +− |
| İlk kez koşanlara özel PED_DAMSIRE (k=30) | ○ -0.13 [-0.30; 0.05] | -1.2 [-2.2; -0.1] | -1.3 [-2.9; 0.3] | −− |
| **İlk kez koşanlara özel, üçü birlikte (k=30)** | ○ -0.25 [-0.73; 0.22] | -0.1 [-1.6; 1.3] | -2.5 [-4.6; -0.7] | −+ |
| Tüm atlara uygulanan PED_SIRE (k=30) | ○ 0.01 [-0.10; 0.12] | 0.1 [-1.2; 1.5] | -0.9 [-2.4; 0.4] | −+ |
| Tüm atlara uygulanan üçü birlikte (k=30) | ○ -0.06 [-0.27; 0.15] | 0.3 [-1.3; 2.0] | -0.4 [-2.0; 1.2] | −+ |
| Tüm atlara uygulanan üçü birlikte (k=10) | ○ -0.04 [-0.27; 0.18] | -0.5 [-2.1; 1.1] | -0.5 [-2.1; 1.2] | −+ |

**İlk kez koşanlı yarışlarda tipe göre (ilk kez koşanlara özel, üçü birlikte; ΔLL%):**
| Tip | n yarış | ΔLL% [%95] | ΔTop3 p [%95] |
|---|---|---|---|
| Maiden | 436 | ○ 0.01 [-0.50; 0.49] | -2.3 [-4.6; -0.2] |
| Şartlı | 303 | ○ -0.65 [-1.52; 0.22] | -3.0 [-6.6; 0.7] |

## 10. TEK TABLO — yarış tiplerine göre özgün katkı (ΔLL%; ✓/○/✗; parantez: test 1./2. yarı işareti)
Satır = sinyal; hücre = B6 (yedi sinyal) içinde o sinyalin özgün katkısı (B6 − sinyalsiz) veya pedigrinin B6 üzerine ek katkısı. Ortak β (tüm yarışlarda eğitilmiş) tipe dilimlenmiştir; n < 100 'yetersiz'.
| Sinyal / bileşen | Tümü (n=4424) | Maiden (n=890) | Şartlı (tümü) (n=1498) | Şartlı 1/27 (n=175) | Şartlı 3/4/5 (n=1163) | Handikap (n=1289) | KV (n=491) | Grup + Satış (n=251) |
|---|---|---|---|---|---|---|---|---|
| ACC_HIZ | ✓ 0.26% (++) | ✓ 0.48% (++) | ✓ 0.31% (++) | ✗ -0.05% (−−) | ✓ 0.38% (++) | ○ 0.14% (++) | ○ -0.07% (+−) | ○ 0.41% (++) |
| GALOP_KAPASITE | ✗ -0.40% (−−) | ○ -0.13% (−+) | ✗ -0.64% (−−) | ○ -0.48% (−−) | ✗ -0.64% (−−) | ✗ -0.62% (−−) | ○ 0.10% (−+) | ○ 0.19% (−+) |
| J_SEVIYE | ✓ 1.08% (++) | ✓ 0.97% (++) | ✓ 1.26% (++) | ✓ 3.22% (++) | ✓ 0.89% (++) | ✓ 0.85% (++) | ✓ 1.07% (++) | ✓ 1.66% (++) |
| SON6 | ✓ 1.18% (++) | ✓ 1.68% (++) | ✓ 1.69% (++) | ✗ -0.51% (−−) | ✓ 2.16% (++) | ○ 0.03% (−+) | ✓ 2.29% (++) | ○ 0.57% (+−) |
| H2H_NET | ✓ 0.38% (++) | ○ -0.22% (−−) | ○ 0.08% (+−) | ✗ -0.45% (−−) | ○ 0.18% (+−) | ✓ 0.62% (++) | ✓ 1.32% (++) | ✓ 1.42% (++) |
| Y_son | ✓ 0.49% (++) | ✓ 0.42% (++) | ○ 0.35% (++) | ✓ 0.04% (−+) | ✓ 0.47% (++) | ✓ 0.71% (++) | ○ 0.71% (++) | ○ -0.08% (−+) |
| T_son | ✓ 0.35% (++) | ✓ 0.88% (++) | ○ 0.01% (−+) | ✗ -0.03% (−−) | ○ 0.03% (++) | ✓ 0.61% (++) | ○ -0.24% (−−) | ○ -0.08% (+−) |
| PED_SIRE (k=30) | ○ 0.04% (++) | ○ 0.03% (++) | ○ 0.04% (++) | ○ 0.16% (−+) | ○ 0.04% (++) | ○ 0.04% (++) | ○ 0.06% (−+) | ○ 0.05% (++) |
| PED_DAM (k=30) | ○ -0.02% (−−) | ○ 0.07% (++) | ○ -0.10% (−−) | ○ 0.06% (+−) | ✗ -0.18% (−−) | ○ -0.00% (−+) | ○ -0.01% (−+) | ○ -0.02% (+−) |
| PED_DAMSIRE (k=30) | ○ 0.01% (++) | ○ 0.00% (+−) | ○ 0.03% (++) | ○ -0.01% (+−) | ○ 0.04% (++) | ○ 0.01% (++) | ○ 0.01% (−+) | ○ 0.00% (+−) |
| PED üçü birlikte (k=30) | ○ 0.01% (−+) | ○ 0.09% (++) | ○ -0.06% (−−) | ○ 0.15% (++) | ○ -0.12% (−−) | ○ 0.04% (−+) | ○ 0.02% (−+) | ○ 0.01% (+−) |
| PED ilk kez koşanlarda (yalnız ilk kez koşanlı yarışlar) | ○ -0.25% (−+) | ○ 0.01% (−+) | ○ -0.65% (−−) | ○ -0.84% (−−) | — (n=69) | — (n=7) | — (n=7) | — (n=5) |

**B6 modeli tipe göre (kazanç = 1/N log-loss'un kapatılan %'si):**
| Tip | n | B6 kazanç % | Top1 % | Top3 % | 1/N Top1 % |
|---|---|---|---|---|---|
| Tümü | 4424 | 9.95 | 25.7 | 59.1 | 11.1 |
| Maiden | 890 | 12.97 | 26.2 | 61.1 | 9.7 |
| Şartlı (tümü) | 1498 | 9.80 | 27.0 | 60.9 | 11.9 |
| Şartlı 1/27 | 175 | 2.63 | 22.3 | 55.4 | 11.2 |
| Şartlı 3/4/5 | 1163 | 11.39 | 28.3 | 63.0 | 12.4 |
| Handikap | 1289 | 7.63 | 22.0 | 52.5 | 10.0 |
| KV | 491 | 10.82 | 29.1 | 66.8 | 13.8 |
| Grup + Satış | 251 | 10.25 | 27.5 | 58.2 | 10.7 |

## Sınırlar ve dürüst notlar
- **Keşif sonucudur;** A/B/C dönemi tekrar kullanıldı. Tanım/parametre dondurulduktan sonra `--after` ile ileri-yönlü doğrulama yapılacaktır.
- Yavru performansı yalnızca veritabanımızdaki atların soy bilgisi ve bu atların önbellekteki startlarından gelir (7 bin at; soy hatları kısmi, anne hattı çok seyrek). Soy hattı verisi, atın kendi startlarından çıkarılmış olsa da kardeşler/ortak sahip/antrenör/yarış tarihi örtüşmesi gibi dolaylı çift sayımlar ayrıca ölçülmedi. Hat başına ağır sahip/antrenör etkisi (aynı ahırın yavruları) kontrol edilmedi.
- Pedigri koşul (zemin×mesafe bandı) düzeyinde; hipodrom, pist durumu ve yaş etkisi yok. Çoklu karşılaştırma düzeltilmedi. Doğrusal-logit ve ortak β varsayımı geçerlidir.