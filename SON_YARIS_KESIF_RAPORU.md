# SON_YARIS_SONUCU — yeni aday sinyal araştırması (aktif sinyal DEĞİL; `SINYAL_KAYDI` boş)
**KEŞİF (A/B/C dönemi, tekrar kullanıldı): NİHAİ DOĞRULAMA DEĞİLDİR.**

## 0. Tanım ve düzenek
- **Y_son** = atın hedef günden KESİN önceki en son yarışında birinci ise 1, aksi 0. **T_son** = aynı yarışta ikinci veya üçüncü ise 1, aksi 0. Önceki yarışın bitiş sırası bilinmiyorsa (veya at ilk yarışında) ikisi de NULL (0 sayılmaz). Tanım ve bileşenler önceden bildirilmiştir; sonuca göre değiştirilmedi.
- **Kontroller (açıklama testleri):** yarıştan geçen gün (ln(1+gün)), önceki yarışın sınıf düzeyi (Maiden=1, Şartlı/Satış=2, Handikap/KV=3, Grup=4), önceki yarıştaki rakiplerin kalitesi (önceki yarışta önbellekteki rakiplerin handikap puanı ortalaması; ≥3 rakip, yoksa NULL). Rakip puanları o yarıştan SONRA atanan puanlardır (önbellek hizalaması); hedef yarıştan önce bilinir.
- **Taban B5:** ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (H_180_3). **cB5:** B5 + hp, son 10 yarış kazanma/ilk-3 oranı, sınıf değişimi. SON6 ve H2H üzerine ayrı sınama bölüm 3'te. Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 puan; [%95 eşleştirilmiş bootstrap]; ✓/○/✗; (+/−) test yarılarında ΔLL işareti.
- **Örneklemler:** P1 = tüm yarışlar 5309 (2026-01-01→2026-11-17); P2 = galop kapsamlı 2064 yarış (B5'in GALOP bileşeni seyreltmesin diye). 6 blok ileri-yönlü β. **Keşif sonucu nihai doğrulama sayılmaz.**

## 1. Kapsam ve betimleyici
- Önceki yarış sonucu bilinen at: 93.5%. Bunlardan Y_son=1: 10.6%, T_son=1: 21.1%. Yarıştan geçen gün medyan 15.

## 2. Örtüşme
Yarış içi merkezlenmiş Pearson r; **R² = Y_son / T_son'un listelenen değişkenlerle doğrusal açıklanabilen payı.**
| Değişken | r(Y_son) | r(T_son) |
|---|---|---|
| SON6 | 0.12 | 0.25 |
| H2H_NET | 0.16 | 0.22 |
| ACC_HIZ | 0.15 | 0.25 |
| J_SEVIYE | 0.06 | 0.13 |
| GALOP_KAPASITE | 0.01 | 0.04 |
| hp | 0.08 | 0.13 |
| son 10 yarış kazanma oranı | 0.34 | -0.07 |
| son 10 yarış ilk-3 oranı | 0.17 | 0.36 |
| sınıf değişimi | 0.17 | -0.01 |
| yarıştan geçen gün (ln) | 0.02 | -0.06 |
| önceki yarış sınıfı | -0.18 | -0.01 |
| önceki yarış rakip hp ort. | -0.23 | -0.02 |

**R²:** Y_son: B5 ile 0.029, B5+kontroller 0.150, yalnız SON6+H2H 0.029. T_son: B5 ile 0.077, B5+kontroller 0.167.

## 3. Ek katkı
### P1 — tüm yarışlar
Test yarışı 4424. B5: kazanç 9.33%, Top1 25.4%, Top3 57.9%.
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| Y_son tek başına (1/N'ye) (a_Y − 1N) | ✓ 1.01 [0.72; 1.32] | 4.1 [3.4; 4.8] | 5.0 [4.2; 5.8] | ++ |
| T_son tek başına (1/N'ye) (a_T − 1N) | ✓ 1.53 [1.17; 1.92] | 5.3 [4.6; 6.0] | 8.6 [7.4; 9.7] | ++ |
| Y_son+T_son tek başına (1/N'ye) (a_YT − 1N) | ✓ 3.47 [2.90; 4.03] | 7.9 [7.1; 8.8] | 14.0 [12.9; 15.2] | ++ |
| **Y_son, B5 üzerine** (b_Y − B5) | ✓ 0.27 [0.12; 0.44] | 0.4 [-0.3; 1.0] | 0.3 [-0.4; 0.9] | ++ |
| **T_son, B5 üzerine** (b_T − B5) | ✓ 0.13 [0.05; 0.22] | -0.2 [-0.8; 0.3] | 0.5 [-0.0; 1.0] | ++ |
| **Y_son+T_son, B5 üzerine** (b_YT − B5) | ✓ 0.62 [0.42; 0.85] | 0.3 [-0.6; 1.2] | 1.1 [0.2; 2.0] | ++ |
| Y_son+T_son, cB5 üzerine (c_YT − cB5) | ✓ 0.39 [0.25; 0.55] | 0.5 [-0.2; 1.2] | 0.2 [-0.6; 0.8] | ++ |
| Y_son, cB5 üzerine (c_Y − cB5) | ✓ 0.13 [0.04; 0.22] | 0.5 [-0.0; 1.0] | 0.5 [-0.0; 1.0] | ++ |
| T_son, cB5 üzerine (c_T − cB5) | ✓ 0.12 [0.05; 0.20] | 0.0 [-0.5; 0.6] | -0.1 [-0.6; 0.4] | ++ |
| **SON6 üzerine (yalnız SON6 ile)** (S6+YT − S6) | ✓ 1.06 [0.79; 1.34] | 0.8 [-0.3; 1.8] | 1.5 [0.4; 2.7] | ++ |
| **H2H_NET üzerine (yalnız H2H ile)** (H2H+YT − H2H) | ✓ 2.03 [1.64; 2.42] | 2.4 [1.3; 3.5] | 4.4 [3.1; 5.7] | ++ |
| **SON6 + H2H üzerine** (S6H+YT − S6H) | ✓ 0.74 [0.51; 0.99] | 0.8 [-0.1; 1.8] | 1.5 [0.6; 2.5] | ++ |
| ACC_HIZ üzerine (ACC+YT − ACC) | ✓ 1.54 [1.16; 1.90] | 2.3 [1.1; 3.3] | 2.7 [1.5; 4.0] | ++ |
| ACC_HIZ + SON6 üzerine (ACCS6+YT − ACCS6) | ✓ 0.92 [0.65; 1.17] | 1.0 [-0.0; 2.0] | 2.1 [1.0; 3.1] | ++ |
| B5 + kontrol değişkenleri (gün, sınıf, rakip kalitesi) üzerine (kkYT − kk) | ✓ 1.08 [0.79; 1.36] | 1.3 [0.4; 2.3] | 1.8 [0.8; 2.8] | ++ |
| cB5 + kontrol değişkenleri üzerine (cKYT − cK) | ✓ 0.43 [0.25; 0.60] | 0.2 [-0.5; 0.9] | 0.5 [-0.3; 1.3] | ++ |

### P2 — galop kapsamlı yarışlar (duyarlılık)
Test yarışı 1720. B5: kazanç 11.33%, Top1 26.7%, Top3 59.7%.
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| Y_son tek başına (1/N'ye) (a_Y − 1N) | ✓ 1.15 [0.63; 1.66] | 4.2 [3.3; 5.3] | 5.4 [4.1; 6.7] | ++ |
| T_son tek başına (1/N'ye) (a_T − 1N) | ✓ 1.13 [0.57; 1.72] | 4.5 [3.3; 5.7] | 7.7 [6.0; 9.4] | ++ |
| Y_son+T_son tek başına (1/N'ye) (a_YT − 1N) | ✓ 3.20 [2.40; 4.01] | 7.8 [6.5; 9.2] | 13.5 [11.7; 15.6] | ++ |
| **Y_son, B5 üzerine** (b_Y − B5) | ✓ 0.34 [0.08; 0.60] | 0.2 [-1.0; 1.5] | -0.3 [-1.4; 0.6] | ++ |
| **T_son, B5 üzerine** (b_T − B5) | ○ 0.01 [-0.19; 0.19] | -0.9 [-2.0; 0.2] | -0.3 [-1.5; 0.8] | +− |
| **Y_son+T_son, B5 üzerine** (b_YT − B5) | ✓ 0.50 [0.07; 0.89] | 0.1 [-1.6; 1.7] | -0.2 [-1.7; 1.4] | ++ |
| Y_son+T_son, cB5 üzerine (c_YT − cB5) | ○ 0.32 [-0.02; 0.65] | 0.8 [-0.5; 2.2] | -2.2 [-3.7; -0.6] | ++ |
| Y_son, cB5 üzerine (c_Y − cB5) | ○ 0.18 [-0.04; 0.39] | 0.7 [-0.3; 1.7] | -0.6 [-1.7; 0.5] | ++ |
| T_son, cB5 üzerine (c_T − cB5) | ○ 0.05 [-0.11; 0.21] | 0.3 [-0.8; 1.3] | -0.5 [-1.6; 0.6] | ++ |
| **SON6 üzerine (yalnız SON6 ile)** (S6+YT − S6) | ✓ 0.96 [0.46; 1.44] | 1.8 [0.1; 3.5] | -0.8 [-2.7; 1.3] | ++ |
| **H2H_NET üzerine (yalnız H2H ile)** (H2H+YT − H2H) | ✓ 1.91 [1.22; 2.60] | 2.7 [0.9; 4.4] | 5.0 [2.7; 7.2] | ++ |
| **SON6 + H2H üzerine** (S6H+YT − S6H) | ✓ 0.69 [0.25; 1.12] | 0.6 [-1.0; 2.3] | 0.3 [-1.5; 2.1] | ++ |
| ACC_HIZ üzerine (ACC+YT − ACC) | ✓ 1.49 [0.86; 2.05] | 2.0 [0.3; 3.7] | 3.4 [1.2; 5.4] | ++ |
| ACC_HIZ + SON6 üzerine (ACCS6+YT − ACCS6) | ✓ 0.86 [0.37; 1.33] | 1.5 [-0.3; 3.3] | 1.3 [-0.6; 3.1] | ++ |
| B5 + kontrol değişkenleri (gün, sınıf, rakip kalitesi) üzerine (kkYT − kk) | ✓ 0.95 [0.46; 1.41] | 0.5 [-1.1; 2.2] | 0.9 [-0.9; 2.5] | ++ |
| cB5 + kontrol değişkenleri üzerine (cKYT − cK) | ✓ 0.37 [0.05; 0.67] | 0.1 [-1.3; 1.5] | -0.2 [-1.6; 1.3] | ++ |

## 4. Yarış tipine göre (P1; n ≥ 150 'yeterli')
Hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti).
| Karşılaştırma | Tümü (n=4424) | Maiden (n=890) | Şartlı (n=1498) | Handikap (n=1289) | KV (n=491) | Grup (n=128, yetersiz) | Satış (n=123, yetersiz) | Handikap H15–16 (n=806) |
|---|---|---|---|---|---|---|---|---|
| Y_son+T_son → B5 | ✓ 0.62% (++) | ✓ 0.93% (++) | ○ 0.32% (++) | ✓ 0.97% (++) | ○ 0.37% (+−) | ○ -0.45% (−+) | ○ 0.06% (+−) | ✓ 1.30% (++) |
| Y_son+T_son → cB5 | ✓ 0.39% (++) | ✓ 0.37% (++) | ○ 0.24% (++) | ✓ 0.68% (++) | ○ 0.16% (++) | ○ 0.22% (−+) | ○ 0.20% (++) | ✓ 0.92% (++) |
| Y_son → B5 | ✓ 0.27% (++) | ○ 0.05% (++) | ✓ 0.31% (++) | ✓ 0.36% (++) | ○ 0.60% (++) | ○ 0.06% (−+) | ○ -0.31% (−+) | ✓ 0.51% (++) |
| T_son → B5 | ✓ 0.13% (++) | ✓ 0.51% (++) | ○ -0.04% (−−) | ✓ 0.26% (++) | ✗ -0.34% (−−) | ○ -0.51% (−−) | ○ 0.28% (+−) | ✓ 0.32% (++) |
| Y_son+T_son → SON6 | ✓ 1.06% (++) | ✓ 1.56% (++) | ✓ 0.53% (++) | ✓ 1.60% (++) | ○ 0.61% (++) | ○ 0.42% (−+) | ○ 0.09% (+−) | ✓ 2.10% (++) |
| Y_son+T_son → SON6+H2H | ✓ 0.74% (++) | ✓ 1.21% (++) | ○ 0.38% (++) | ✓ 1.13% (++) | ○ 0.32% (+−) | ○ -0.49% (−+) | ○ 0.12% (+−) | ✓ 1.51% (++) |
| Y_son+T_son → cB5+kontroller | ✓ 0.43% (++) | ✓ 0.43% (++) | ✓ 0.39% (++) | ✓ 0.59% (++) | ○ 0.32% (++) | ○ 0.09% (−+) | ○ 0.00% (+−) | ✓ 0.83% (++) |

## 5. Önceki yarış sonucuna göre kazanma (beklenti: B5; ileri-yönlü β)
z = (kazanan − ΣP)/√ΣP(1−P). Y_son/T_son, B5'in ötesinde bilgi taşıyorsa Y_son=1 atlarda z>0 beklenir. Çok sayıda hücre; düzeltme yok.
| Dilim | Önceki yarış | n at | Kazanan | Beklenen (B5) | z |
|---|---|---|---|---|---|
| Tümü | birinci (Y) | 4336 | 793 | 653.7 | 6.16 |
| Tümü | 2.–3. (T) | 8655 | 1376 | 1249.9 | 4.00 |
| Tümü | diğer | 28535 | 1993 | 2234.5 | -5.50 |
| Tümü | bilinmiyor | 3100 | 263 | 285.9 | -1.44 |
| Handikap | birinci (Y) | 1445 | 239 | 189.8 | 3.96 |
| Handikap | 2.–3. (T) | 2613 | 397 | 342.7 | 3.24 |
| Handikap | diğer | 10057 | 643 | 746.1 | -4.04 |
| Handikap | bilinmiyor | 113 | 10 | 10.4 | -0.12 |
| Maiden | 2.–3. (T) | 1862 | 383 | 307.0 | 4.94 |
| Maiden | diğer | 6836 | 446 | 507.9 | -2.96 |
| Maiden | bilinmiyor | 984 | 60 | 74.1 | -1.72 |
| Şartlı | birinci (Y) | 1541 | 310 | 257.8 | 3.74 |
| Şartlı | 2.–3. (T) | 2406 | 369 | 364.5 | 0.26 |
| Şartlı | diğer | 8279 | 629 | 678.4 | -2.05 |
| Şartlı | bilinmiyor | 1958 | 190 | 197.2 | -0.55 |

## Sınırlar ve dürüst notlar
- **Keşif sonucudur:** A/B/C dönemi tekrar kullanıldı; tanım ve yöntem dondurulmuştur, `--after` modunda ileri-yönlü doğrulama yapılacaktır.
- **Karar kuralı (kullanıcı):** SON6 ve H2H_NET üzerine ek katkı yoksa ayrı sinyal kabul edilmez (bölüm 3: 'SON6 üzerine', 'H2H_NET üzerine', 'SON6 + H2H üzerine' satırları). Katkı bulunsa bile bu, yarıştan geçen gün/önceki yarış kalitesi gibi kontrollerle (bölüm 3 son iki satır) açıklanıp açıklanmadığıyla birlikte değerlendirilir.
- Önceki yarış sonucu, atın son yarışındaki sahanın büyüklüğü/pace/talih gibi etkilerden bağımsız değildir; bunlar ayrıca modellenmedi. Doğrusal-logit ve ortak β varsayımı geçerlidir.