# AGF_TREND — derin araştırma (aday sinyal DEĞİL; MOTORA/KUPONA GİRMEZ; `SINYAL_KAYDI` boş)
Kullanıcının itirazı kabul edildi: trend ile kapanış düzeyi arasındaki yarış-içi korelasyon 0,08'dir; yani aynı bilgiyi ölçmüyorlar. Önceki rapordaki yargı yalnızca şuydu: **son AGF modelde varken, DOĞRUSAL bir modelde trendin ek katkısı gösterilemedi.** Bu rapor doğrusal olmayan etkileri, eşit uzunluklu zaman pencerelerini, aynı kapanış düzeyindeki atların karşılaştırmasını, favori düşüşü senaryosunu ve yarış tiplerini ayrıca sınar. AGF yalnız değerlendirmede kullanılır (2026-11-14 kararı).

## 0. Düzenek ve veri gerçekleri
- **Örneklem S:** 2353 yarış (2026-07-01→2026-11-17); ≥%80 atında ≥2 yarış-öncesi kesit. Tek kronolojik havuz, 6 blokluk ileri-yönlü β. **A ve B dönemiyle örtüşür; bağımsız/ileri-yönlü doğrulama değildir.**
- **Kesitler yalnız yarış GÜNÜ içindedir** (ilk kesit yarıştan medyan ~6,5 saat önce; önceki günün AGF'si yok). 'Trend' bu yüzden günün içindeki harekettir; 'ilk AGF' yarış başına farklı zamanda alınmıştır (3–10 saat önce). Kesit aralığı düzensiz (medyan ~43 dk; son kesit medyan ~1,15 saat önce).
- **AGF toplam havuzdaki payıdır:** gerçek TL girişi bilinmez; havuz hacmi veride yoktur. Payın düşmesi 'para çıktı' değil, 'başkalarına daha çok girdi' de olabilir.
- **Eşit zaman pencereleri:** son kesite sabitli 30/60/120/240 dk pencereleri (D30…D240 = son AGF − son kesitten en az o kadar önceki en son kesit; yoksa NULL). Kesit aralığı düzensiz olduğundan gerçek aralık ≥ pencere uzunluğudur; bölüm 4'te raporlanır.
- **Sabit sınıflar (önceden bildirildi, sonuca göre ayarlanmadı):** trend sınıfları ≤−3 / −3…−1 / −1…+1 (düz) / +1…+3 / ≥+3 puan; kapanış düzeyi (son AGF %) <3 / 3–6 / 6–10 / 10–15 / 15–25 / ≥25; favori düşüşü: yarışın en yüksek son AGF'li atının trendi ≤ −3 puan.
- **Doğrulama:** gelecek-bozma testi (gerçek veri, 400 at) GEÇTİ; bağımsız yeniden hesap 0/400 uyuşmaz. Pencere fonksiyonu birim testlerinde (sızıntı dahil). Ölçü cihazı: yarış-içi softmax, ridge 0,02, eksik → yarış-içi ortalama; **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; [%95 bootstrap]; ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ altında; 'Tut.' = ΔLL işareti test yarışlarının 1./2. yarısında.

## 1. AYNI son AGF düzeyi, FARKLI para hareketi (kullanıcının asıl sorusu)
p = piyasa olasılığı (AGF/yarış toplamı). z = (kazanan − Σp)/√Σp(1−p). Aynı kapanış düzeyinde düşen ve yükselen atlar aynı sıklıkla mı kazanıyor? Çok hücre var, düzeltme yok.
| Son AGF % | Trend sınıfı (puan) | n at | Kazanan | Kazanma % | Piyasa beklentisi % | z |
|---|---|---|---|---|---|---|
| <3 | ≤ −3 | 190 | 4 | 2.1 | 2.0 | 0.15 |
| <3 | −3…−1 | 587 | 11 | 1.9 | 1.7 | 0.36 |
| <3 | düz (−1…+1) | 6515 | 108 | 1.7 | 1.4 | 1.58 |
| <3 | +1…+3 | 496 | 14 | 2.8 | 2.3 | 0.74 |
| 3–6 | ≤ −3 | 346 | 16 | 4.6 | 4.5 | 0.09 |
| 3–6 | −3…−1 | 635 | 29 | 4.6 | 4.5 | 0.13 |
| 3–6 | düz (−1…+1) | 2098 | 100 | 4.8 | 4.3 | 0.99 |
| 3–6 | +1…+3 | 966 | 43 | 4.5 | 4.4 | 0.05 |
| 3–6 | ≥ +3 | 148 | 10 | 6.8 | 5.1 | 0.89 |
| 6–10 | ≤ −3 | 430 | 32 | 7.4 | 8.1 | -0.50 |
| 6–10 | −3…−1 | 542 | 42 | 7.7 | 8.0 | -0.19 |
| 6–10 | düz (−1…+1) | 1430 | 111 | 7.8 | 7.9 | -0.16 |
| 6–10 | +1…+3 | 766 | 73 | 9.5 | 7.9 | 1.69 |
| 6–10 | ≥ +3 | 389 | 33 | 8.5 | 8.2 | 0.23 |
| 10–15 | ≤ −3 | 407 | 50 | 12.3 | 12.7 | -0.26 |
| 10–15 | −3…−1 | 464 | 56 | 12.1 | 12.5 | -0.30 |
| 10–15 | düz (−1…+1) | 1135 | 121 | 10.7 | 12.4 | -1.82 |
| 10–15 | +1…+3 | 640 | 89 | 13.9 | 12.4 | 1.19 |
| 10–15 | ≥ +3 | 466 | 59 | 12.7 | 12.6 | 0.05 |
| 15–25 | ≤ −3 | 592 | 107 | 18.1 | 19.5 | -0.86 |
| 15–25 | −3…−1 | 511 | 86 | 16.8 | 19.1 | -1.29 |
| 15–25 | düz (−1…+1) | 813 | 166 | 20.4 | 19.0 | 1.01 |
| 15–25 | +1…+3 | 548 | 88 | 16.1 | 19.3 | -1.92 |
| 15–25 | ≥ +3 | 628 | 159 | 25.3 | 19.7 | 3.54 |
| ≥25 | ≤ −3 | 403 | 146 | 36.2 | 36.8 | -0.26 |
| ≥25 | −3…−1 | 208 | 60 | 28.8 | 36.6 | -2.40 |
| ≥25 | düz (−1…+1) | 305 | 105 | 34.4 | 36.3 | -0.72 |
| ≥25 | +1…+3 | 273 | 97 | 35.5 | 37.4 | -0.65 |
| ≥25 | ≥ +3 | 845 | 338 | 40.0 | 40.4 | -0.24 |

**Eşleştirilmiş fark (aynı son-AGF düzeyi içinde; yükselen − düşen; düz olanlar dışarıda):** düzey hücrelerinde yükselen (≥+1) ve düşen (≤−1) atların kazanma yüzdesi farkı; ağırlık n_R·n_D/(n_R+n_D); **yarış kümesi bootstrap'ı** (aynı yarıştaki atlar bağımlı). 'Piyasaya göre' sütunu (kazanma − beklenen) farkıdır; ilk sütun ham kazanma yüzdesi farkıdır.
| Dilim | n yarış | Ham fark (puan) [%95] | Piyasaya göre fark (puan) [%95] |
|---|---|---|---|
| Tümü | 2256 | 2.08 [0.79; 3.36] | 1.59 [0.27; 2.89] |
| Maiden | 448 | 1.30 [-1.63; 4.15] | 0.88 [-2.05; 3.75] |
| Şartlı | 747 | 2.70 [0.38; 5.03] | 1.95 [-0.33; 4.32] |
| Handikap | 629 | 2.53 [0.17; 4.71] | 2.18 [-0.13; 4.40] |
| KV | 288 | 0.27 [-4.47; 4.16] | -0.13 [-4.80; 3.84] |

## 2. Hareketin büyüklüğü: doğrusal mı, yoksa büyük hareketlerde farklı mı?
Piyasa beklentisine (son AGF'ye) göre kazanma. Doğrusal bir etki z'nin hareketle monoton artmasını gerektirir; basamaklı/eşikli davranış farklı görünür.
**Mutlak hareket (puan):**
| Trend aralığı | n at | Kazanan | Beklenen | z (son AGF) |
|---|---|---|---|---|
| ≤ −6 | 1071 | 170 | 190.1 | -1.71 |
| −6…−3 | 1297 | 185 | 179.6 | 0.46 |
| −3…−1 | 2947 | 284 | 313.1 | -1.84 |
| −1…+1 | 12296 | 711 | 703.1 | 0.32 |
| +1…+3 | 3689 | 404 | 401.4 | 0.15 |
| +3…+6 | 1447 | 265 | 252.3 | 0.93 |
| ≥ +6 | 1029 | 334 | 310.8 | 1.68 |

**Göreli hareket ln(son/ilk):**
| Aralık | n at | Kazanan | Beklenen | z (son AGF) |
|---|---|---|---|---|
| ≤ −0,5 (yarıya düşüş) | 2011 | 94 | 96.6 | -0.29 |
| −0,5…−0,15 | 4169 | 298 | 328.0 | -1.83 |
| −0,15…+0,15 | 10239 | 1235 | 1255.0 | -0.65 |
| +0,15…+0,5 | 4480 | 505 | 459.4 | 2.44 |
| ≥ +0,5 (1,6 kat+) | 2877 | 221 | 211.4 | 0.74 |

## 3. Doğrusal olmayan modeller (kapanış düzeyi doğrusal olmayan hâliyle modelde; her satır KARŞILAŞTIRMA)
Test yarışı 1961. Model düzeyleri: L 18.15%, L² 18.13% (1/N log-loss'un kapatılan yüzdesi).
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| Düzeyin doğrusal olmayan hâli (L²) ekliyor mu? (L2 − L) | ○ -0.02 [-0.08; 0.04] | 0.00 [0.00; 0.00] | 0.00 [0.00; 0.00] | −+ |
| T (doğrusal), L² üzerine (L2+T − L2) | ○ 0.01 [-0.03; 0.05] | -0.20 [-0.51; 0.05] | 0.15 [0.00; 0.36] | −+ |
| **T, yükseliş/düşüş AYRI eğimle (Tpos, Tneg)** (L2+Tpm − L2) | ○ -0.02 [-0.11; 0.06] | 0.25 [-0.15; 0.71] | 0.10 [-0.15; 0.41] | −+ |
| Asimetri: ayrı eğim vs tek eğim (L2+Tpm − L2+T) | ○ -0.03 [-0.09; 0.04] | 0.46 [0.00; 0.92] | -0.05 [-0.31; 0.20] | −+ |
| **T, beş sabit sınıf (basamaklı)** (L2+Tbin − L2) | ○ -0.01 [-0.21; 0.18] | 0.25 [-0.61; 1.12] | -0.46 [-1.17; 0.15] | −+ |
| T × düzey etkileşimi, T üzerine (L2+TL − L2+T) | ○ -0.08 [-0.21; 0.05] | 0.00 [-0.31; 0.25] | -0.36 [-0.76; 0.05] | −+ |
| **D30 (son 30 dk penceresi)**, L² üzerine (L2+D30 − L2) | ✓ 0.20 [0.08; 0.32] | 0.25 [-0.51; 1.02] | 0.10 [-0.31; 0.51] | ++ |
| D30 ayrı eğim (L2+D30pm − L2) | ✓ 0.20 [0.09; 0.31] | 0.41 [-0.31; 1.17] | 0.00 [-0.41; 0.41] | ++ |
| **D60 (son 60 dk)** (L2+D60 − L2) | ✓ 0.20 [0.11; 0.30] | 0.15 [-0.51; 0.87] | 0.20 [-0.10; 0.51] | ++ |
| D60 ayrı eğim (L2+D60pm − L2) | ✓ 0.19 [0.09; 0.28] | 0.20 [-0.46; 0.92] | 0.20 [-0.10; 0.56] | ++ |
| D120 (L2+D120 − L2) | ✓ 0.23 [0.10; 0.34] | 0.51 [-0.25; 1.27] | 0.25 [-0.20; 0.71] | ++ |
| D120 ayrı eğim (L2+D120pm − L2) | ✓ 0.22 [0.10; 0.34] | 0.61 [-0.05; 1.38] | 0.05 [-0.36; 0.46] | ++ |
| D240 (L2+D240 − L2) | ○ 0.09 [-0.03; 0.21] | 0.36 [-0.31; 1.02] | 0.00 [-0.41; 0.36] | −+ |
| D240 ayrı eğim (L2+D240pm − L2) | ○ -0.01 [-0.17; 0.15] | 0.15 [-0.51; 0.82] | -0.05 [-0.46; 0.36] | −+ |
| **Favori düşerken diğerlerinin yükselişi (FR)** (L2+FR − L2) | ○ 0.01 [-0.01; 0.04] | 0.05 [-0.25; 0.36] | 0.15 [0.00; 0.36] | −+ |
| Favori düşerken en büyük yükselen (RISER) (L2+RISER − L2) | ○ -0.00 [-0.01; 0.00] | 0.05 [0.00; 0.15] | -0.05 [-0.15; 0.00] | −− |
| Favorinin düşüşü (FAVNEG) (L2+FAVNEG − L2) | ○ -0.02 [-0.10; 0.05] | -0.05 [-0.51; 0.36] | 0.00 [0.00; 0.00] | −− |
| Üçü birlikte (FAV3) (L2+FAV3 − L2) | ○ -0.02 [-0.10; 0.07] | 0.05 [-0.41; 0.56] | 0.20 [0.05; 0.46] | −+ |
| Dört sinyalli taban + L²: T ayrı eğim (B4L2+Tpm − B4L2) | ○ -0.02 [-0.10; 0.07] | 0.10 [-0.36; 0.56] | 0.00 [-0.31; 0.31] | −+ |
| Dört sinyalli taban + L²: beş sınıf (B4L2+Tbin − B4L2) | ○ 0.00 [-0.19; 0.17] | -0.15 [-1.17; 0.71] | 0.05 [-0.71; 0.82] | −+ |
| Dört sinyalli taban + L²: D60 ayrı eğim (B4L2+D60pm − B4L2) | ✓ 0.20 [0.10; 0.29] | 0.15 [-0.61; 0.82] | -0.31 [-0.71; 0.05] | ++ |
| Dört sinyalli taban + L²: FAV3 (B4L2+FAV3 − B4L2) | ○ -0.01 [-0.09; 0.08] | -0.31 [-0.82; 0.20] | -0.05 [-0.25; 0.10] | −+ |

## 4. Eşit zaman pencereleri: kapsam ve gerçek aralık
| Pencere | D'si olan at | Gerçek aralık medyan (dk) | p10 | p90 | Pencere için yarış payı (≥%80 atta D var) |
|---|---|---|---|---|---|
| 30 dk | 98.9% | 71 | 38 | 145 | 99.1% |
| 60 dk | 97.0% | 89 | 62 | 162 | 96.8% |
| 120 dk | 92.6% | 161 | 125 | 218 | 92.0% |
| 240 dk | 70.3% | 276 | 241 | 360 | 68.3% |

**Pencere hareketine göre kazanma (piyasa beklentisi = son AGF; yalnız D'si olan atlar):**
| Pencere | Hareket (puan) | n at | Kazanan | Beklenen | z |
|---|---|---|---|---|---|
| 30 dk | ≤ −3 | 383 | 102 | 124.4 | -2.55 |
| 30 dk | −3…−1 | 1585 | 309 | 365.9 | -3.61 |
| 30 dk | −1…+1 | 19545 | 1521 | 1480.3 | 1.17 |
| 30 dk | +1…+3 | 1762 | 311 | 278.1 | 2.29 |
| 30 dk | ≥ +3 | 284 | 89 | 80.5 | 1.20 |
| 60 dk | ≤ −3 | 602 | 148 | 187.1 | -3.60 |
| 60 dk | −3…−1 | 1790 | 332 | 380.0 | -2.94 |
| 60 dk | −1…+1 | 18125 | 1312 | 1282.9 | 0.89 |
| 60 dk | +1…+3 | 2185 | 372 | 319.9 | 3.35 |
| 60 dk | ≥ +3 | 403 | 118 | 108.9 | 1.08 |
| 120 dk | ≤ −3 | 1021 | 233 | 280.5 | -3.48 |
| 120 dk | −3…−1 | 2106 | 329 | 365.2 | -2.20 |
| 120 dk | −1…+1 | 15049 | 911 | 921.3 | -0.37 |
| 120 dk | +1…+3 | 3056 | 444 | 384.7 | 3.40 |
| 120 dk | ≥ +3 | 822 | 252 | 218.6 | 2.81 |
| 240 dk | ≤ −3 | 1344 | 231 | 272.8 | -2.99 |
| 240 dk | −3…−1 | 2012 | 222 | 243.1 | -1.52 |
| 240 dk | −1…+1 | 9310 | 504 | 503.7 | 0.02 |
| 240 dk | +1…+3 | 2759 | 319 | 300.9 | 1.16 |
| 240 dk | ≥ +3 | 1324 | 352 | 312.7 | 2.73 |

## 5. Ters hareket: favorinin AGF'si düşerken başka bir at yükseliyor mu — kazananı bulmaya yardım ediyor mu?
Favori = yarışta en yüksek son AGF'li at. 'Favori düştü' = favorinin trendi ≤ −3 puan. 'En büyük yükselen' = favori dışında trendi en yüksek (≥ +1) at.
| Yarış grubu | n yarış | Favori kazandı (n / % / beklenen %) | z (favori) | En büyük yükselen kazandı (n / % / beklenen %) | z (yükselen) |
|---|---|---|---|---|---|
| Favori düştü (≤ −3) | 459 | 145 / 31.6 / 33.9 | -1.07 | 72 / 15.8 / 15.5 (n=455) | 0.17 |
| Favori düz (−1…+1) | 400 | 125 / 31.3 / 31.7 | -0.18 | 46 / 16.2 / 14.2 (n=284) | 0.96 |
| Favori yükseldi (≥ +1) | 1190 | 428 / 36.0 / 37.7 | -1.27 | 139 / 15.4 / 13.1 (n=901) | 2.11 |

## 6. Yarış tipine göre (n ≥ 150 'yeterli')
Hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti); hepsi L² üzerine.
| Karşılaştırma | Tümü (n=1961) | Maiden (n=395) | Şartlı (n=644) | Handikap (n=553) | KV (n=244) | Grup (n=67, yetersiz) | Satış (n=56, yetersiz) |
|---|---|---|---|---|---|---|---|
| T doğrusal | ○ 0.01% (−+) | ○ -0.03% (−+) | ○ 0.02% (−+) | ○ 0.04% (++) | ○ 0.01% (++) | ○ -0.02% (·−) | ○ -0.12% (··) |
| **T ayrı eğim** | ○ -0.02% (−+) | ○ -0.10% (−+) | ○ 0.05% (−+) | ○ -0.03% (−+) | ○ 0.01% (−+) | ○ -0.09% (·−) | ○ -0.16% (··) |
| T beş sınıf | ○ -0.01% (−+) | ○ -0.01% (−+) | ○ 0.14% (++) | ○ -0.18% (−+) | ○ -0.27% (−−) | ○ 0.06% (·−) | ✓ 0.92% (··) |
| D60 ayrı eğim | ✓ 0.19% (++) | ○ 0.04% (−+) | ✓ 0.18% (++) | ✓ 0.20% (++) | ✓ 0.36% (++) | ○ 0.12% (·+) | ○ 0.52% (··) |
| D30 ayrı eğim | ✓ 0.20% (++) | ○ 0.14% (++) | ○ 0.16% (++) | ○ 0.18% (++) | ○ 0.31% (++) | ○ 0.19% (·+) | ✓ 0.65% (··) |
| Favori düşüşü (FAV3) | ○ -0.02% (−+) | ○ 0.01% (+−) | ○ -0.01% (−+) | ○ -0.01% (−+) | ○ -0.07% (−+) | ○ -0.22% (·+) | ○ 0.06% (··) |

**L² modelinin kalıntısı: trend sınıfına göre (L² olasılığı beklenti; test yarışları).** Modelde kalan sistematik yapı varsa z ≠ 0:
| Dilim | ≤ −3 | −3…−1 | düz (−1…+1) | +1…+3 | ≥ +3 |
|---|---|---|---|---|---|
| Tümü | -1.28 (n=2094) | -1.39 (n=2505) | -0.25 (n=10053) | -0.04 (n=3175) | 2.61 (n=2176) |
| Maiden | 0.38 (n=447) | -0.45 (n=407) | -0.22 (n=2429) | 0.53 (n=652) | -0.09 (n=462) |
| Şartlı | -1.70 (n=750) | -0.82 (n=808) | -0.01 (n=2987) | -0.57 (n=981) | 2.60 (n=778) |
| Handikap | -0.79 (n=591) | -1.04 (n=821) | -0.13 (n=3073) | 0.80 (n=1058) | 1.00 (n=566) |
| KV | -0.80 (n=231) | 0.69 (n=307) | 0.35 (n=814) | -2.13 (n=321) | 1.55 (n=277) |
| Grup | 1.39 (n=40) | 0.47 (n=82) | -0.88 (n=424) | -0.23 (n=86) | 0.12 (n=40) |
| Satış | 0.45 (n=34) | -2.47 (n=77) | 0.11 (n=321) | 1.89 (n=72) | 0.06 (n=53) |

## Sınırlar ve dürüst notlar
- **Yalnız yarış-günü içi hareket:** kesitler yarış gününden önce başlamıyor; 'ilk AGF' yarışlara göre farklı zamanda alınmış. D pencereleri bunu eşitlemeye çalışır ama kesit aralığı düzensizdir (bölüm 4); 30 dk penceresinde gerçek aralık sıklıkla 30 dk'dan uzundur.
- **AGF toplam havuz payıdır, TL girişi değildir.** 'Ani para girişi' ile 'başka atlara girişin payı düşürmesi' ayrılamaz; havuz hacmi veride yok.
- **Eşleştirme/kalıntı tabloları betimleyicidir;** çok sayıda hücre düzeltilmedi. S, A ve B dönemiyle örtüşür (tekrar kullanıldı). Kalıntı tablosu yalnız ileri-yönlü β ile tahmin edilen test yarışlarındadır.
- Piyasa kapanışına yakın bilgi (son kesit medyan 1,15 saat önce) gerçek kapanış değildir; son kesitten sonraki hareket görünmez.
- Katkı çıksa bile AGF'nin motora girmesi gerektiği anlamına gelmez (2026-11-14 kararı); trend başarılı sinyal olarak kabul EDİLMEDİ.