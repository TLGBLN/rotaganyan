# Sinyal seti yeniden ölçümü — SON6 ÇIKARILDIKTAN SONRA (aktif sinyal 0; katsayı/ağırlık/banko/kupon YOK)
**KEŞİF (A/B/C dönemi, tekrar kullanıldı): NİHAİ DOĞRULAMA DEĞİLDİR.**

## 0. Düzenek
- **Güncel havuz (kullanıcı kararı 2026-11-18):** ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON_YARIS_SONUCU (Y_son + T_son), H2H_NET (koşullu). **SON6 çıkarıldı;** bu çalışma kararı sorgulamaz, yalnız kalan sinyallerin SON6 olmadan ölçümünü ve karşılaştırma için SON6'lı modelin farkını verir. Altı bileşen: **F6** = ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, H2H_NET (H_180_3), Y_son, T_son; **cF6** = F6 + hp, son 10 yarış kazanma/ilk-3 oranı, sınıf değişimi; **B7** = F6 + SON6 (yalnız karşılaştırma).
- **İki örneklem (AYNI yarışlarda tüm karşılaştırmalar):** **P1** tüm yarışlar (5309; 2026-01-01→2026-11-17) — ancak GALOP verisi Temmuz 2026'dan beri var, bu yüzden P1'de GALOP seyreltilmiştir; **P2** galop kapsamlı yarışlar (2064; ≥%70 atında GALOP_KAPASITE) — GALOP için asıl ölçüm P2'dir. Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama (SON6 yokluğu dahil değil, modelde yok). 6 blok ileri-yönlü β. **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 puan; [%95 eşleştirilmiş bootstrap]; ✓/○/✗; (+/−) test yarılarında ΔLL işareti. **Keşif sonucu nihai doğrulama sayılmaz.**
- **Şartlı 1/27 notu:** bu sınıfta atların %100'ü ilk kez koşan (ACC_HIZ, H2H_NET, Y_son/T_son verisi YOK); yalnız J_SEVIYE ve GALOP_KAPASITE vardır. Önceki kontrol, bu sınıfta GALOP'un ancak segment-özel β ile ✓ olduğunu gösterdi; bu yüzden ayrı sütunda segment-özel sonuç da verilir.

## 1. Örtüşme (yarış içi merkezlenmiş; altı bileşen)
**P1 (tüm yarışlar):**
| Sinyal | r(ACC_HIZ) | r(GALOP_KAPASITE) | r(J_SEVIYE) | r(H2H_NET) | r(Y_son) | r(T_son) | R² (diğer beşi) |
|---|---|---|---|---|---|---|---|
| ACC_HIZ | — | 0.07 | 0.23 | 0.43 | 0.15 | 0.25 | 0.226 |
| GALOP_KAPASITE | 0.07 | — | 0.09 | 0.03 | 0.01 | 0.04 | 0.007 |
| J_SEVIYE | 0.23 | 0.09 | — | 0.19 | 0.06 | 0.13 | 0.088 |
| H2H_NET | 0.43 | 0.03 | 0.19 | — | 0.16 | 0.22 | 0.220 |
| Y_son | 0.15 | 0.01 | 0.06 | 0.16 | — | -0.21 | 0.107 |
| T_son | 0.25 | 0.04 | 0.13 | 0.22 | -0.21 | — | 0.144 |

**P2 (galop kapsamlı):**
| Sinyal | r(ACC_HIZ) | r(GALOP_KAPASITE) | r(J_SEVIYE) | r(H2H_NET) | r(Y_son) | r(T_son) | R² (diğer beşi) |
|---|---|---|---|---|---|---|---|
| ACC_HIZ | — | 0.07 | 0.27 | 0.43 | 0.12 | 0.22 | 0.229 |
| GALOP_KAPASITE | 0.07 | — | 0.09 | 0.03 | 0.01 | 0.04 | 0.007 |
| J_SEVIYE | 0.27 | 0.09 | — | 0.22 | 0.07 | 0.14 | 0.088 |
| H2H_NET | 0.43 | 0.03 | 0.22 | — | 0.15 | 0.21 | 0.224 |
| Y_son | 0.12 | 0.01 | 0.07 | 0.15 | — | -0.23 | 0.113 |
| T_son | 0.22 | 0.04 | 0.14 | 0.21 | -0.23 | — | 0.149 |

## 2. Tekil performans (her sinyal tek başına; 1/N'ye karşı)
### P1 — tüm yarışlar (test 4424; 1/N Top1 11.1%, Top3 33.2%)
| Sinyal | ΔLL% [%95] | Top1 % | ΔTop1 p [%95] | Top3 % | ΔTop3 p [%95] |
|---|---|---|---|---|---|
| ACC_HIZ | ✓ 5.47 [4.87; 6.07] | 20.8 | 9.7 [8.6; 10.8] | 51.0 | 17.9 [16.5; 19.2] |
| GALOP_KAPASITE | ○ -0.03 [-0.21; 0.15] | 12.6 | 1.5 [0.8; 2.3] | 35.7 | 2.6 [1.5; 3.6] |
| J_SEVIYE | ✓ 2.70 [2.46; 2.96] | 20.3 | 9.3 [8.1; 10.5] | 49.7 | 16.6 [15.2; 18.1] |
| H2H_NET | ✓ 3.43 [2.88; 3.96] | 19.1 | 8.1 [7.0; 9.2] | 47.6 | 14.4 [13.2; 15.8] |
| Y_son | ✓ 1.01 [0.70; 1.30] | 15.2 | 4.1 [3.4; 4.8] | 38.2 | 5.0 [4.2; 5.8] |
| T_son | ✓ 1.53 [1.16; 1.91] | 16.4 | 5.3 [4.6; 6.1] | 41.7 | 8.6 [7.4; 9.6] |
| SON_YARIS_SONUCU (Y+T) | ✓ 3.47 [2.95; 4.00] | 19.0 | 7.9 [7.0; 8.8] | 47.2 | 14.0 [12.8; 15.1] |
| **F6 (altı bileşen birlikte)** | ✓ 8.77 [7.93; 9.60] | 24.9 | 13.9 [12.5; 15.2] | 58.2 | 25.0 [23.5; 26.4] |
| (karşılaştırma) B7 = F6 + SON6 | ✓ 9.95 [9.01; 10.76] | 25.7 | 14.6 [13.4; 15.9] | 59.1 | 25.9 [24.4; 27.2] |

### P2 — galop kapsamlı yarışlar (test 1720; 1/N Top1 10.9%, Top3 32.8%)
| Sinyal | ΔLL% [%95] | Top1 % | ΔTop1 p [%95] | Top3 % | ΔTop3 p [%95] |
|---|---|---|---|---|---|
| ACC_HIZ | ✓ 5.58 [4.60; 6.48] | 20.9 | 10.0 [8.0; 11.9] | 50.5 | 17.7 [15.5; 20.0] |
| GALOP_KAPASITE | ✓ 0.89 [0.48; 1.29] | 15.2 | 4.3 [2.8; 5.8] | 40.7 | 7.9 [5.8; 10.1] |
| J_SEVIYE | ✓ 4.61 [3.95; 5.31] | 21.1 | 10.2 [8.1; 12.1] | 51.6 | 18.8 [16.5; 21.2] |
| H2H_NET | ✓ 3.32 [2.60; 4.09] | 18.5 | 7.5 [5.8; 9.2] | 47.1 | 14.3 [12.2; 16.4] |
| Y_son | ✓ 1.15 [0.64; 1.63] | 15.2 | 4.2 [3.2; 5.4] | 38.2 | 5.4 [4.1; 6.7] |
| T_son | ✓ 1.13 [0.58; 1.73] | 15.5 | 4.5 [3.4; 5.9] | 40.5 | 7.7 [6.0; 9.7] |
| SON_YARIS_SONUCU (Y+T) | ✓ 3.20 [2.28; 4.05] | 18.8 | 7.8 [6.6; 9.3] | 46.4 | 13.5 [11.5; 15.6] |
| **F6 (altı bileşen birlikte)** | ✓ 10.59 [9.42; 11.85] | 26.3 | 15.4 [13.4; 17.4] | 58.7 | 25.8 [23.5; 27.8] |
| (karşılaştırma) B7 = F6 + SON6 | ✓ 11.83 [10.62; 13.14] | 26.8 | 15.9 [13.9; 18.1] | 59.5 | 26.7 [24.2; 28.7] |

## 3. Sinyal çıkarma (özgün katkı: F6 − o sinyalsiz model)
### P1 — tüm yarışlar
| Sinyal | ΔLL% [%95] | ΔTop1 p [%95] | **ΔTop3 p [%95]** | Kontrollü (cF6) ΔLL% [%95] | Tut. |
|---|---|---|---|---|---|
| ACC_HIZ | ✓ 2.01 [1.65; 2.35] | 1.9 [0.8; 2.9] | 3.3 [2.2; 4.4] | ✓ 1.06 [0.76; 1.37] | ++ |
| GALOP_KAPASITE | ✗ -0.33 [-0.55; -0.13] | -0.9 [-1.6; -0.3] | -0.3 [-1.0; 0.4] | ✗ -0.34 [-0.54; -0.13] | −− |
| J_SEVIYE | ✓ 1.37 [1.19; 1.55] | 0.9 [0.2; 1.7] | 2.4 [1.6; 3.3] | ✓ 0.88 [0.74; 1.03] | ++ |
| H2H_NET | ✓ 0.49 [0.19; 0.80] | 0.6 [-0.4; 1.6] | 1.3 [0.2; 2.3] | ✓ 0.22 [0.04; 0.39] | ++ |
| Y_son | ✓ 0.67 [0.43; 0.90] | 0.8 [0.0; 1.7] | 1.5 [0.6; 2.3] | ✓ 0.34 [0.18; 0.49] | ++ |
| T_son | ✓ 0.61 [0.36; 0.85] | 0.6 [-0.3; 1.4] | 1.8 [0.9; 2.7] | ✓ 0.33 [0.19; 0.48] | ++ |
| SON_YARIS_SONUCU (Y+T) | ✓ 0.96 [0.64; 1.27] | 1.3 [0.4; 2.2] | 2.1 [1.0; 3.1] | ✓ 0.50 [0.32; 0.69] | ++ |

### P2 — galop kapsamlı yarışlar
| Sinyal | ΔLL% [%95] | ΔTop1 p [%95] | **ΔTop3 p [%95]** | Kontrollü (cF6) ΔLL% [%95] | Tut. |
|---|---|---|---|---|---|
| ACC_HIZ | ✓ 1.85 [1.33; 2.39] | 0.9 [-0.7; 2.7] | 2.8 [1.2; 4.8] | ✓ 0.98 [0.62; 1.36] | ++ |
| GALOP_KAPASITE | ✓ 0.50 [0.14; 0.84] | 0.6 [-0.8; 2.0] | 0.9 [-0.7; 2.3] | ✓ 0.47 [0.14; 0.80] | ++ |
| J_SEVIYE | ✓ 2.09 [1.67; 2.53] | 2.5 [0.6; 4.2] | 2.3 [0.3; 4.0] | ✓ 1.39 [1.06; 1.73] | ++ |
| H2H_NET | ✓ 0.65 [0.36; 0.97] | 0.8 [-0.5; 2.1] | 0.3 [-0.9; 1.6] | ✓ 0.30 [0.09; 0.51] | ++ |
| Y_son | ✓ 0.67 [0.28; 1.07] | 0.7 [-0.7; 2.2] | 0.2 [-1.2; 1.8] | ✓ 0.36 [0.04; 0.70] | ++ |
| T_son | ✓ 0.38 [0.00; 0.76] | 0.1 [-1.5; 1.6] | -0.6 [-2.2; 0.9] | ○ 0.22 [-0.08; 0.52] | ++ |
| SON_YARIS_SONUCU (Y+T) | ✓ 0.79 [0.26; 1.22] | 0.7 [-0.9; 2.4] | -0.3 [-2.0; 1.6] | ✓ 0.43 [0.07; 0.83] | ++ |

## 4. SON6'lı ve SON6'suz karşılaştırma (aynı yarışlar; bilgi amaçlı — karar değişmez)
Her satır: sinyalin özgün katkısı SON6 modeldeyken (B7 − sinyalsiz) ve SON6 yokken (F6 − sinyalsiz). Fark, SON6'nın diğer sinyalleri ne kadar gölgelediğini gösterir. Son satır SON6'yı çıkarmanın modele maliyetidir.
### P1 — tüm yarışlar
| Sinyal | SON6 VAR (B7) ΔLL% | SON6 YOK (F6) ΔLL% | Değişim |
|---|---|---|---|
| ACC_HIZ | ✓ 0.26% (++) | ✓ 2.01% (++) | 1.75 |
| GALOP_KAPASITE | ✗ -0.40% (−−) | ✗ -0.33% (−−) | 0.07 |
| J_SEVIYE | ✓ 1.08% (++) | ✓ 1.37% (++) | 0.29 |
| H2H_NET | ✓ 0.38% (++) | ✓ 0.49% (++) | 0.11 |
| Y_son | ✓ 0.49% (++) | ✓ 0.67% (++) | 0.18 |
| T_son | ✓ 0.35% (++) | ✓ 0.61% (++) | 0.26 |
| SON_YARIS_SONUCU (Y+T) | ✓ 0.62% (++) | ✓ 0.96% (++) | 0.34 |
| **SON6'yı çıkarmanın maliyeti (B7 − F6)** | ✓ 1.18 [0.74; 1.56] | | Top1 0.8 [-0.1; 1.7]; Top3 0.9 [-0.1; 1.9] |

### P2 — galop kapsamlı yarışlar
| Sinyal | SON6 VAR (B7) ΔLL% | SON6 YOK (F6) ΔLL% | Değişim |
|---|---|---|---|
| ACC_HIZ | ✓ 0.28% (++) | ✓ 1.85% (++) | 1.57 |
| GALOP_KAPASITE | ✓ 0.42% (++) | ✓ 0.50% (++) | 0.08 |
| J_SEVIYE | ✓ 1.65% (++) | ✓ 2.09% (++) | 0.44 |
| H2H_NET | ✓ 0.49% (++) | ✓ 0.65% (++) | 0.15 |
| Y_son | ✓ 0.49% (++) | ✓ 0.67% (++) | 0.18 |
| T_son | ○ 0.16% (++) | ○ 0.38% (++) | 0.22 |
| SON_YARIS_SONUCU (Y+T) | ✓ 0.50% (++) | ✓ 0.79% (++) | 0.29 |
| **SON6'yı çıkarmanın maliyeti (B7 − F6)** | ✓ 1.24 [0.74; 1.77] | | Top1 0.5 [-0.9; 1.9]; Top3 0.8 [-0.6; 2.2] |

## 5. Yarış tipine göre özgün katkı — P1 — tüm yarışlar (F6 − sinyalsiz; ΔLL%; (+/−) test yarıları; n<100 yetersiz)
| Sinyal | Tümü (n=4424) | Maiden (n=890) | Şartlı 3/4/5 (n=1163) | Şartlı 2/19 (n=160) | Şartlı 1/27 (ortak β) (n=175) | Handikap (n=1289) | KV (n=491) | Grup + Satış (n=251) | Şartlı 1/27 (segment-özel β; n=160) |
|---|---|---|---|---|---|---|---|---|---|
| ACC_HIZ | ✓ 2.01% (++) | ✓ 2.76% (++) | ✓ 3.00% (++) | ○ 1.66% (++) | **kullanılamaz** (veri yok) | ✓ 1.29% (++) | ○ 1.11% (++) | ✓ 1.93% (++) | **kullanılamaz** (veri yok) |
| GALOP_KAPASITE | ✗ -0.33% (−−) | ○ -0.07% (−+) | ✗ -0.56% (−−) | ○ -0.73% (−−) | ○ -0.29% (−−) | ✗ -0.57% (−−) | ○ 0.19% (−+) | ○ 0.28% (−+) | ✓ 2.18% (++) |
| J_SEVIYE | ✓ 1.37% (++) | ✓ 1.39% (++) | ✓ 1.17% (++) | ✓ 2.09% (++) | ✓ 3.52% (++) | ✓ 1.05% (++) | ✓ 1.41% (++) | ✓ 1.85% (++) | ✓ 4.41% (++) |
| H2H_NET | ✓ 0.49% (++) | ○ -0.38% (−−) | ○ 0.38% (++) | ○ -0.07% (−+) | **kullanılamaz** (veri yok) | ✓ 0.72% (++) | ✓ 1.88% (++) | ✓ 1.70% (++) | **kullanılamaz** (veri yok) |
| Y_son | ✓ 0.67% (++) | ✓ 0.47% (++) | ✓ 0.81% (++) | ○ -0.16% (−+) | **kullanılamaz** (veri yok) | ✓ 0.82% (++) | ✓ 1.22% (++) | ○ 0.07% (−+) | **kullanılamaz** (veri yok) |
| T_son | ✓ 0.61% (++) | ✓ 1.68% (++) | ○ 0.12% (++) | ○ -0.20% (−−) | **kullanılamaz** (veri yok) | ✓ 0.85% (++) | ○ -0.11% (+−) | ○ -0.17% (+−) | **kullanılamaz** (veri yok) |
| SON_YARIS_SONUCU (Y+T) | ✓ 0.96% (++) | ✓ 1.65% (++) | ✓ 0.71% (++) | ○ -0.16% (−+) | **kullanılamaz** (veri yok) | ✓ 1.27% (++) | ○ 0.69% (++) | ○ -0.18% (−+) | **kullanılamaz** (veri yok) |
*'kullanılamaz (veri yok)': o gruptaki atların <%5'inde sinyal değeri var; bu bir 'sıfır katkı' değil, sinyalin o grupta HESAPLANAMADIĞI anlamına gelir (modelde nötr doldurulur).*

F6 modeli tipe göre: kazanç / Top1 / Top3 (1/N Top1):
| Tip | n | Kazanç % | Top1 % | Top3 % | 1/N Top1 % |
|---|---|---|---|---|---|
| Tümü | 4424 | 8.77 | 24.9 | 58.2 | 11.1 |
| Maiden | 890 | 11.29 | 25.2 | 60.5 | 9.7 |
| Şartlı 3/4/5 | 1163 | 9.23 | 27.3 | 61.0 | 12.4 |
| Şartlı 2/19 | 160 | 5.92 | 20.0 | 50.6 | 9.1 |
| Şartlı 1/27 (ortak β) | 175 | 3.15 | 22.9 | 55.4 | 11.2 |
| Handikap | 1289 | 7.61 | 21.9 | 53.1 | 10.0 |
| KV | 491 | 8.54 | 27.3 | 63.5 | 13.8 |
| Grup + Satış | 251 | 9.68 | 28.3 | 57.8 | 10.7 |

## 5. Yarış tipine göre özgün katkı — P2 — galop kapsamlı yarışlar (F6 − sinyalsiz; ΔLL%; (+/−) test yarıları; n<100 yetersiz)
| Sinyal | Tümü (n=1720) | Maiden (n=365) | Şartlı 3/4/5 (n=407) | Şartlı 2/19 (n=64) | Şartlı 1/27 (ortak β) (n=76) | Handikap (n=467) | KV (n=220) | Grup + Satış (n=119) |
|---|---|---|---|---|---|---|---|---|
| ACC_HIZ | ✓ 1.85% (++) | ✓ 2.52% (++) | ✓ 3.04% (++) | — (n=64) | — (n=76) | ✓ 1.35% (++) | ○ 0.88% (++) | ○ 1.27% (++) |
| GALOP_KAPASITE | ✓ 0.50% (++) | ✓ 1.01% (++) | ○ 0.43% (++) | — (n=64) | — (n=76) | ○ -0.10% (+−) | ○ 0.40% (−+) | ○ 0.32% (++) |
| J_SEVIYE | ✓ 2.09% (++) | ✓ 1.54% (++) | ✓ 2.37% (++) | — (n=64) | — (n=76) | ✓ 1.75% (++) | ✓ 1.94% (++) | ✓ 2.51% (++) |
| H2H_NET | ✓ 0.65% (++) | ○ 0.14% (−+) | ○ 0.34% (++) | — (n=64) | — (n=76) | ○ 0.60% (++) | ✓ 1.59% (++) | ✓ 1.95% (++) |
| Y_son | ✓ 0.67% (++) | ○ 0.33% (+−) | ○ 0.60% (++) | — (n=64) | — (n=76) | ✓ 0.84% (++) | ○ 0.87% (++) | ○ 1.83% (++) |
| T_son | ○ 0.38% (++) | ✓ 1.57% (++) | ○ -0.21% (−+) | — (n=64) | — (n=76) | ○ 0.69% (++) | ○ -0.59% (−−) | ○ -0.69% (−−) |
| SON_YARIS_SONUCU (Y+T) | ✓ 0.79% (++) | ✓ 1.49% (++) | ○ 0.30% (++) | — (n=64) | — (n=76) | ✓ 1.19% (++) | ○ 0.01% (−+) | ○ 0.72% (++) |
*'kullanılamaz (veri yok)': o gruptaki atların <%5'inde sinyal değeri var; bu bir 'sıfır katkı' değil, sinyalin o grupta HESAPLANAMADIĞI anlamına gelir (modelde nötr doldurulur).*

F6 modeli tipe göre: kazanç / Top1 / Top3 (1/N Top1):
| Tip | n | Kazanç % | Top1 % | Top3 % | 1/N Top1 % |
|---|---|---|---|---|---|
| Tümü | 1720 | 10.59 | 26.3 | 58.7 | 10.9 |
| Maiden | 365 | 13.33 | 29.0 | 58.1 | 9.4 |
| Şartlı 3/4/5 | 407 | 11.38 | 29.5 | 62.7 | 12.1 |
| Şartlı 2/19 | 64 | 11.04 | 26.6 | 59.4 | 8.5 |
| Şartlı 1/27 (ortak β) | 76 | 8.53 | 31.6 | 67.1 | 11.9 |
| Handikap | 467 | 8.77 | 20.8 | 53.3 | 10.0 |
| KV | 220 | 7.81 | 22.3 | 58.2 | 13.6 |
| Grup + Satış | 119 | 11.81 | 31.9 | 62.2 | 11.3 |

## 6. Şartlı 1/27 — segment-özel β ayrıntısı (test 160; yalnız J_SEVIYE ve GALOP_KAPASITE verisi var)
| Model | Kazanç % | Top1 % | Top3 % |
|---|---|---|---|
| F6 | 7.20 | 26.9 | 60.0 |
| yalnız J_SEVIYE | 5.02 | 25.0 | 57.5 |
| yalnız GALOP_KAPASITE | 2.79 | 17.2 | 42.2 |

## Sınırlar ve dürüst notlar
- Keşif sonucudur (A/B/C dönemi tekrar kullanıldı); sinyal seti dondurulduktan sonra ileri-yönlü doğrulama gerekir. Çoklu karşılaştırma düzeltilmedi; tek hücredeki ✓/✗ kanıt sayılmaz.
- P1'de GALOP, galop verisi olmayan dönemle seyreltildiği için yanlı düşük görünür; GALOP için P2 (ve Şartlı 1/27'de segment-özel β) esas alınmalıdır. Ortak β tipe dilimlenmiştir; tipe özel ağırlık öğrenilmedi (Şartlı 1/27 dışında).
- Ağırlık, katsayı, banko veya kupon kararı verilmedi; bu bir ölçüm raporudur.