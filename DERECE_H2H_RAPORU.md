# SON_6_DERECE, HIZ_DERECESI ve H2H_NET_SKOR — formül taslakları: ham değerler, sıralama ve banko testi
**Bunlar onaylanmış sinyal DEĞİLDİR. Motorun aktif sinyal listesine hiçbir şey eklenmedi (`SINYAL_KAYDI` boş); ağırlık/0–100 dönüşümü belirlenmedi.** Üç hesap AYRI tutuldu. Her değer yarış gününden ÖNCEKİ kayıtlarla yeniden hesaplandı.

## 0. Tanımlar, veri ve açık uyarılar
- **SON6** = (6Z1+5Z2+4Z3+3Z4+2Z5+Z6)/21; Z = (μ − T)/σ, T = **TJK resmî bitiş süresi** (HorseRaceHistoryCache 'time'; Accurace zamanı karıştırılmadı). μ,σ = aynı **ırk + yüzey (K/Ç/S) + hipodrom + mesafe** grubunun yarış gününden önceki satırları (n ≥ 30; yoksa **hipodromsuz** grup). Z1 = en son yarış; < 6 uygun yarışta ağırlıklar mevcut yarışların toplamına bölünür. Tek yarış veya referanssız → kaydedilir/null (uydurma puan yok).
- **HIZ_DERECESI** = son 6 uygun yarışın **en iyi 2 Z'sinin ortalaması**; tek uygun yarış varsa o yarışın Z'si ve 'düşük güven' işareti.
- **H2H_NET**: X=+1/−1/0 (iki atın da bitiş sırası bilinen ortak yarışlarda); H2H_{h,j} = Σ w·X /(Σ w + λ); H2H_NET_h = bugünkü rakiplerden geçmişte ≥1 ortak yarışı olanlar üzerinde ortalama; hiç ortak yarış yoksa **null** (nötr doldurulur, sıfır puan değil); kaç rakibe karşı veri olduğu ayrı gösterilir.
- **TANIMLANMAMIŞ PARAMETRELER (geçici varsayım; öğrenilmedi; sizin onayınıza tabi):** w_r = 0,5^(gün/90) × (farklı yüzey ×0.5) × (|Δmesafe| > 200 m ise ×0.5); λ = 1; referans asgari n = 30; "son 6" = son 6 **uygun** (geçerli süre + yeterli referans) yarış.
- **Veri:** HorseRaceHistoryCache 118928 satır; geçerli resmî süre + ırk/yüzey/hipodrom/mesafe 117320 (geçersiz 'Drcsz'/'99.99'/boş süre ve 10–20 m/s dışı hızlar çıkarıldı); H2H için geçerli sıra+yarış anahtarı 118483. **Yüzey durumu (Normal/Nemli/Islak…) referans grubuna girmedi** (yalnız K/Ç/S). H2H ortak yarışları **yalnız önbellekteki atlar** üzerinden bulunur: bir yarışın tüm atları önbellekte olmayabilir → H2H kapsamı kısmidir.
- **Örneklem A** (/admin/kosu-tipleri, 1510 yarış) model kararlarında defalarca kullanıldı → **bağımsız nihai doğrulama DEĞİLDİR.** **Örneklem B** (01.07–15.08.2026, 829 yarış) daha az kullanılmış.
- Gelecek-bozma testi (5 gün): SON6/HIZ 936 at → **GEÇTİ**; H2H 936 at → **GEÇTİ**. Bağımsız yeniden hesap (düz döngü, 80 rastgele at-yarış): SON6/HIZ uyuşmayan **0**, H2H uyuşmayan **0**.

## 1. Örnek: Bursa 16.11.2026 K1 (1300 m) — ham değerler
| No | At | ACC_HIZ | SON6 | HIZ_DERECESI | Uygun yarış (kullanılan) | Z1…Z6 (en yeni → eski) | Güven | H2H_NET | Veri olan rakip | En belirgin çift |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ARSLANBEYLİ | 44.9 | -0.17 | -0.15 | 2 (2) | -0.34 ; 0.04 | kısmi (2/6) | 0.475 | 1/8 | MİR BEG 0.47 (n=1, 1G/0M) |
| 2 | KUMKADI ASLANI | 21.0 | -0.77 | -0.80 | 2 (2) | -0.50 ; -1.09 | kısmi (2/6) | — | 0/8 | — |
| 3 | MİR BEG | 27.9 | -0.43 | -0.43 | 1 (1) | -0.43 | DÜŞÜK (tek yarış) | -0.475 | 1/8 | ARSLANBEYLİ -0.47 (n=1, 0G/1M) |
| 4 | MY NOBLE SON | 10.7 | -1.29 | -0.52 | 4 (4) | -1.70 ; -1.73 ; -1.24 ; 0.20 | kısmi (4/6) | 0.113 | 1/8 | RAŞAMO 0.11 (n=3, 2G/1M) |
| 5 | RAŞAMO | 27.8 | -1.35 | -0.44 | 10 (6) | -3.13 ; -0.73 ; -0.44 ; -0.88 ; -0.44 ; -0.57 | tam | -0.113 | 1/8 | MY NOBLE SON -0.11 (n=3, 1G/2M) |
| 6 | HOLD ON TO LIFE | 24.8 | -0.36 | 0.13 | 6 (6) | -0.64 ; -0.70 ; -0.00 ; -0.23 ; 0.14 ; 0.12 | tam | — | 0/8 | — |
| 7 | WORKIN LADY | 19.3 | -1.68 | -0.59 | 4 (4) | -2.53 ; -2.26 ; -0.22 ; -0.96 | kısmi (4/6) | — | 0/8 | — |
| 8 | MY LIFE ELİF | 37.1 | -0.28 | -0.28 | 1 (1) | -0.28 | DÜŞÜK (tek yarış) | — | 0/8 | — |
| 9 | STEEL HUNTER | 40.3 | -0.56 | -0.22 | 6 (6) | -0.35 ; -0.09 ; -0.40 ; -1.75 ; -0.82 ; -0.67 | tam | — | 0/8 | — |

## 2. Kapsam ve ham dağılım (Örneklem A)
| Ölçü | At | Oran |
|---|---|---|
| SON6 var (≥1 uygun yarış) | 14663 | 94.7% |
| SON6 tam (6 yarış) | 10863 | 70.1% |
| Yalnız tek uygun yarış (düşük güven) | 840 | 5.4% |
| H2H_NET var (≥1 rakibe karşı veri) | 12293 | 79.4% |
| H2H en az 3 rakibe karşı veri | 7702 | 49.7% |

SON6 dağılımı (5/25/50/75/95. yüzdelik): -1.57 / -0.49 / -0.01 / 0.37 / 0.82; HIZ_DERECESI: -0.98 / 0.09 / 0.51 / 0.84 / 1.21; H2H_NET: -0.42 / -0.16 / 0.00 / 0.15 / 0.42. Medyan veri olan rakip sayısı (H2H olanlarda): 3; Yarışta H2H'li at oranı ≥ %50 olan yarış: 86.1%.

## 3. Yarış sınıfı etkisi denetimi (süre Z'si sınıfı taşıyor mu?)
Denetim (özellik DEĞİL): tüm geçerli geçmiş satırlarda grup-içi Z (tüm zamanlı referans; yalnız betimleme), kaba sınıfa (Maiden/Şartlı/Handikap/KV/Grup/Satış/Diğer) göre sınıflanmış. Satır 116634; **Z varyansının sınıfa bağlı payı (η²) = %7.10** (şans düzeltmeli ≈ %7.10). Sınıf ortalamaları:
| Sınıf | Satır | Ort. Z (süre hızı; 0 = grup ortalaması) |
|---|---|---|
| Şartlı | 36675 | 0.033 |
| Handikap | 36496 | 0.069 |
| Maiden | 23343 | -0.457 |
| KV | 13019 | 0.455 |
| Grup | 4058 | 0.318 |
| Satış | 2842 | -0.118 |
| Diğer | 201 | 0.312 |

Yorum için not: Z yalnız grup (ırk+yüzey+hipodrom+mesafe) içinde standartlaştırıldığından **sınıf farkı çıkarılmadı**; yüksek sınıflarda süre ortalaması farkı varsa SON6/HIZ_DERECESI sınıf bilgisini de taşır. Bunun etkisini aşağıda "taban + kontroller (sınıf değişimi dahil)" modelleri ayrıca sınar.

## 4. SIRALAMA (Örneklem A — TEKRAR KULLANILMIŞ)
Ölçü cihazı: β'lar YALNIZ geçmiş bloklardan; eksik puan yarış ortalamasına (nötr); yön varsayımı yok. 1259 test yarışı. ΔLL pozitif = iyileşme; Top1/Top3 puan; köşeli parantez eşleştirilmiş bootstrap %95. Ölçekler sabit (SON6, HIZ: 1; H2H: 0,3).
| Ölçüm | Log-loss | ΔLL (1/N taban − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|
| ACC_HIZ (tek) | 2.1521 | 0.1374 [0.1083; 0.1693] | 20.3% (10.7%) | 51.4% (32.0%) | 3.66 ; 4.05 ; 3.90 ; 3.77 ; 3.67 |
| ACC_HIZ + SON6 | 2.0936 | 0.1960 [0.1628; 0.2318] | 21.9% (10.7%) | 55.7% (32.0%) | 1.10/1.43 ; 1.90/1.23 ; 1.88/1.15 ; 1.57/1.27 ; 1.70/1.13 |
| ACC_HIZ + HIZ_DERECESI | 2.1059 | 0.1837 [0.1515; 0.2167] | 21.9% (10.7%) | 53.9% (32.0%) | 1.99/1.32 ; 2.75/1.05 ; 2.59/1.07 ; 2.35/1.16 ; 2.33/1.10 |
| ACC_HIZ + SON6 + HIZ_DERECESI | 2.0890 | 0.2005 [0.1651; 0.2357] | 22.9% (10.7%) | 55.4% (32.0%) | 0.97/1.05/0.66 ; 1.84/1.00/0.37 ; 1.80/0.87/0.47 ; 1.49/0.96/0.52 ; 1.60/0.81/0.54 |
| Yalnız SON6 | 2.1119 | 0.1776 [0.1419; 0.2152] | 21.3% (10.7%) | 54.6% (32.0%) | 1.72 ; 1.68 ; 1.58 ; 1.63 ; 1.51 |
| Yalnız HIZ_DERECESI | 2.1485 | 0.1410 [0.1062; 0.1741] | 21.9% (10.7%) | 51.9% (32.0%) | 1.81 ; 1.66 ; 1.63 ; 1.68 ; 1.61 |
| Yalnız H2H_NET | 2.2070 | 0.0826 [0.0611; 0.1041] | 19.0% (10.7%) | 47.6% (32.0%) | 0.60 ; 0.57 ; 0.58 ; 0.59 ; 0.58 |
| T. ACC_HIZ + GALOP_KAPASITE + J_SEVIYE (taban) | 2.0767 | 0.2129 [0.1787; 0.2460] | 23.0% (10.7%) | 57.8% (32.0%) | 3.18/1.33/0.54 ; 3.65/1.77/0.51 ; 3.45/1.47/0.55 ; 3.26/1.36/0.63 ; 3.13/1.27/0.64 |
| T + SON6 | 2.0386 | 0.2509 [0.2094; 0.2880] | 24.8% (10.7%) | 59.0% (32.0%) | 1.08/1.21/0.44/1.25 ; 1.89/1.66/0.42/1.06 ; 1.81/1.39/0.46/0.98 ; 1.50/1.25/0.53/1.07 ; 1.58/1.17/0.55/0.94 |
| T + HIZ_DERECESI | 2.0431 | 0.2465 [0.2081; 0.2834] | 24.2% (10.7%) | 58.5% (32.0%) | 1.76/1.23/0.48/1.20 ; 2.53/1.75/0.47/0.96 ; 2.33/1.48/0.50/0.97 ; 2.06/1.34/0.57/1.04 ; 2.01/1.24/0.58/0.97 |
| T + SON6 + HIZ_DERECESI | 2.0338 | 0.2558 [0.2187; 0.2966] | 24.5% (10.7%) | 58.5% (32.0%) | 0.96/1.19/0.44/0.87/0.65 ; 1.82/1.68/0.43/0.82/0.41 ; 1.73/1.42/0.46/0.68/0.51 ; 1.41/1.27/0.53/0.74/0.55 ; 1.48/1.19/0.55/0.62/0.55 |
| T + H2H_NET | 2.0535 | 0.2360 [0.2026; 0.2685] | 25.1% (10.7%) | 58.9% (32.0%) | 2.68/1.35/0.50/0.35 ; 3.23/1.76/0.49/0.28 ; 3.00/1.48/0.52/0.31 ; 2.78/1.38/0.59/0.33 ; 2.67/1.29/0.61/0.33 |
| T + SON6 + H2H_NET | 2.0245 | 0.2650 [0.2258; 0.3043] | 25.5% (10.7%) | 59.4% (32.0%) | 0.82/1.24/0.42/1.16/0.29 ; 1.69/1.66/0.41/0.99/0.21 ; 1.58/1.40/0.45/0.90/0.24 ; 1.28/1.27/0.51/0.98/0.26 ; 1.36/1.20/0.53/0.85/0.26 |
| T + HIZ_DERECESI + H2H_NET | 2.0272 | 0.2624 [0.2267; 0.3011] | 26.4% (10.7%) | 60.2% (32.0%) | 1.41/1.25/0.46/1.15/0.31 ; 2.24/1.74/0.45/0.91/0.24 ; 2.03/1.49/0.48/0.90/0.26 ; 1.76/1.35/0.55/0.97/0.28 ; 1.72/1.25/0.56/0.89/0.28 |
| TK. taban + kontroller (hp, geçmiş performans, sınıf değişimi) | 2.0234 | 0.2661 [0.2316; 0.3031] | 26.0% (10.7%) | 59.9% (32.0%) | 2.44/1.31/0.45/0.24/0.92/1.39/-0.13 ; 2.87/1.71/0.42/0.34/0.76/1.27/-0.19 ; 2.66/1.45/0.45/0.44/0.62/1.22/-0.17 ; 2.46/1.35/0.52/0.50/0.61/1.14/-0.19 ; 2.33/1.26/0.52/0.49/0.84/1.17/-0.27 |
| TK + SON6 | 2.0048 | 0.2848 [0.2470; 0.3240] | 25.9% (10.7%) | 60.7% (32.0%) | 0.94/1.20/0.40/0.13/1.05/0.73/-0.11/1.06 ; 1.69/1.64/0.37/0.24/0.98/0.67/-0.18/0.87 ; 1.59/1.39/0.40/0.35/0.78/0.71/-0.17/0.77 ; 1.28/1.26/0.46/0.41/0.75/0.60/-0.18/0.85 ; 1.33/1.19/0.47/0.41/0.96/0.71/-0.26/0.71 |
| TK + HIZ_DERECESI | 2.0067 | 0.2829 [0.2442; 0.3233] | 26.5% (10.7%) | 60.8% (32.0%) | 1.38/1.21/0.43/0.04/1.55/0.91/-0.03/1.12 ; 2.16/1.70/0.40/0.17/1.35/0.85/-0.13/0.82 ; 1.98/1.45/0.43/0.28/1.16/0.80/-0.12/0.78 ; 1.72/1.32/0.49/0.34/1.18/0.72/-0.14/0.84 ; 1.65/1.23/0.49/0.33/1.34/0.79/-0.23/0.76 |
| TK + H2H_NET | 2.0137 | 0.2758 [0.2375; 0.3127] | 26.6% (10.7%) | 59.6% (32.0%) | 2.14/1.33/0.44/0.19/0.89/1.19/-0.08/0.28 ; 2.66/1.71/0.41/0.31/0.76/1.10/-0.15/0.19 ; 2.44/1.46/0.44/0.40/0.63/1.00/-0.14/0.22 ; 2.22/1.36/0.50/0.46/0.59/0.91/-0.16/0.24 ; 2.10/1.27/0.51/0.44/0.82/0.95/-0.25/0.23 |

**Ek katkılar (büyük model vs her bir küçük model):**
| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| **SON6 → ACC_HIZ** (ACC_HIZ'a ek bilgi mi?) | 1259 | 0.0585 [0.0339; 0.0823] | 1.65 [-0.25; 3.61] | 4.27 [2.07; 6.75] |
| **HIZ_DERECESI → ACC_HIZ** (ACC_HIZ'ın ötesinde katkı mı?) | 1259 | 0.0462 [0.0255; 0.0643] | 1.57 [-0.35; 3.39] | 2.53 [0.60; 4.72] |
| HIZ_DERECESI → ACC_HIZ + SON6 | 1259 | 0.0045 [-0.0022; 0.0109] | 0.95 [-0.24; 2.14] | -0.24 [-1.59; 0.95] |
| SON6 → ACC_HIZ + HIZ_DERECESI | 1259 | 0.0168 [0.0027; 0.0295] | 1.03 [-0.64; 2.62] | 1.51 [-0.48; 3.42] |
| SON6 → taban | 1259 | 0.0381 [0.0180; 0.0556] | 1.75 [0.00; 3.57] | 1.19 [-0.79; 3.18] |
| HIZ_DERECESI → taban | 1259 | 0.0336 [0.0137; 0.0517] | 1.19 [-0.64; 3.02] | 0.71 [-0.95; 2.70] |
| **H2H_NET → taban** | 1259 | 0.0232 [0.0115; 0.0344] | 2.07 [0.32; 3.81] | 1.03 [-0.79; 2.94] |
| HIZ_DERECESI → taban + SON6 | 1259 | 0.0048 [-0.0019; 0.0117] | -0.24 [-1.35; 0.87] | -0.48 [-1.75; 0.87] |
| SON6 → taban + HIZ_DERECESI | 1259 | 0.0093 [-0.0003; 0.0184] | 0.32 [-0.87; 1.67] | 0.00 [-1.51; 1.75] |
| H2H_NET → taban + SON6 | 1259 | 0.0141 [0.0057; 0.0232] | 0.71 [-0.87; 2.22] | 0.40 [-1.27; 1.91] |
| SON6 → taban + H2H_NET | 1259 | 0.0290 [0.0114; 0.0467] | 0.40 [-1.43; 2.14] | 0.56 [-1.19; 2.30] |
| H2H_NET → taban + HIZ_DERECESI | 1259 | 0.0159 [0.0068; 0.0257] | 2.22 [0.79; 3.97] | 1.67 [-0.08; 3.34] |
| HIZ_DERECESI → taban + H2H_NET | 1259 | 0.0263 [0.0078; 0.0413] | 1.35 [-0.48; 3.18] | 1.35 [-0.48; 3.26] |
| SON6 → taban + kontroller | 1259 | 0.0187 [0.0022; 0.0326] | -0.08 [-1.67; 1.51] | 0.79 [-0.87; 2.54] |
| HIZ_DERECESI → taban + kontroller | 1259 | 0.0168 [0.0023; 0.0305] | 0.56 [-0.87; 2.07] | 0.87 [-0.79; 2.46] |
| H2H_NET → taban + kontroller | 1259 | 0.0098 [0.0019; 0.0177] | 0.64 [-0.87; 2.14] | -0.32 [-1.91; 1.19] |
| Kontroller → taban (bilgi) | 1259 | 0.0532 [0.0376; 0.0680] | 2.94 [0.95; 4.77] | 2.07 [0.00; 4.13] |

**Sönümlenme:** SON6 kontrolsüz 0.0381 → kontrollü 0.0187; HIZ_DERECESI 0.0336 → 0.0168; H2H_NET 0.0232 → 0.0098.

**H2H yalnız kapsamlı yarışlarda (atların ≥ yarısında H2H var; 1090 test yarışı):**
| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| H2H_NET → taban | 1090 | 0.0254 [0.0130; 0.0376] | 2.57 [0.64; 4.40] | 0.92 [-1.10; 2.84] |
| H2H_NET → taban + kontroller | 1090 | 0.0108 [0.0024; 0.0194] | 0.73 [-0.92; 2.39] | -0.09 [-1.74; 1.47] |

**Koşu tipine göre (→ taban, ΔLL / Top1 / Top3):**
| Koşu tipi | Ölçüt | Test yarışı | ΔLL [%95] | Top1 [%95] | Top3 [%95] |
|---|---|---|---|---|---|
| Maiden | SON6 | 256 | 0.0542 [0.0031; 0.1046] | -3.13 [-7.42; 0.39] | 0.78 [-3.52; 5.08] |
| Maiden | HIZ_DERECESI | 256 | 0.0431 [-0.0190; 0.0942] | -3.13 [-7.03; 0.78] | 1.56 [-3.13; 5.86] |
| Maiden | H2H_NET | 256 | 0.0127 [-0.0167; 0.0415] | -1.56 [-5.86; 2.73] | 1.95 [-1.95; 5.86] |
| Şartlı | SON6 | 411 | 0.0186 [-0.0249; 0.0561] | 1.22 [-1.70; 3.89] | 3.65 [0.49; 7.06] |
| Şartlı | HIZ_DERECESI | 411 | 0.0145 [-0.0199; 0.0460] | 0.97 [-1.95; 3.89] | 2.68 [-0.73; 5.84] |
| Şartlı | H2H_NET | 411 | 0.0171 [-0.0011; 0.0348] | 1.95 [-0.73; 4.62] | 0.49 [-2.43; 3.41] |
| Handikap | SON6 | 352 | 0.0329 [0.0019; 0.0633] | 4.55 [1.14; 8.24] | -1.70 [-5.11; 1.70] |
| Handikap | HIZ_DERECESI | 352 | 0.0304 [0.0080; 0.0565] | 3.69 [0.57; 7.10] | -1.70 [-5.11; 1.70] |
| Handikap | H2H_NET | 352 | 0.0210 [0.0009; 0.0425] | 2.56 [-0.28; 5.97] | 1.70 [-1.70; 5.40] |
| KV | SON6 | 155 | 0.0928 [0.0543; 0.1295] | 3.87 [-1.94; 9.68] | 3.23 [-2.58; 9.03] |
| KV | HIZ_DERECESI | 155 | 0.0788 [0.0462; 0.1127] | 3.23 [-1.94; 8.39] | 0.00 [-4.52; 3.87] |
| KV | H2H_NET | 155 | 0.0264 [-0.0079; 0.0619] | 3.23 [-2.58; 9.68] | -0.65 [-5.16; 3.87] |
| Grup | SON6 | 48 | -0.0470 [-0.1522; 0.0337] | 6.25 [-4.17; 16.67] | -6.25 [-18.75; 4.17] |
| Grup | HIZ_DERECESI | 48 | -0.0026 [-0.0748; 0.0655] | 2.08 [-8.33; 12.50] | -6.25 [-16.67; 4.17] |
| Grup | H2H_NET | 48 | 0.1157 [0.0629; 0.1688] | 16.67 [6.25; 29.17] | 0.00 [-10.42; 10.42] |
| Satış | SON6 | 35 | 0.0961 [-0.0344; 0.2027] | 2.86 [-5.71; 14.29] | 5.71 [-8.57; 22.86] |
| Satış | HIZ_DERECESI | 35 | 0.0893 [0.0187; 0.1578] | 0.00 [-11.43; 11.43] | 8.57 [-2.86; 20.00] |
| Satış | H2H_NET | 35 | 0.0573 [-0.0186; 0.1349] | 0.00 [-11.43; 11.43] | 2.86 [-11.43; 14.29] |

## 5. Örneklem B (01.07–15.08.2026; daha az kullanılmış)
Yarış 829, test 691; SON6 kapsamı 93.2%, H2H kapsamı 76.6%.
| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| SON6 → ACC_HIZ | 691 | 0.0506 [0.0267; 0.0732] | 1.54 [-1.19; 4.28] | 3.27 [0.41; 6.25] |
| HIZ_DERECESI → ACC_HIZ | 691 | 0.0397 [0.0190; 0.0608] | 0.38 [-2.22; 3.00] | 1.48 [-1.37; 4.14] |
| SON6 → taban | 691 | 0.0404 [0.0188; 0.0614] | 0.72 [-1.88; 3.33] | 3.18 [0.43; 6.22] |
| HIZ_DERECESI → taban | 691 | 0.0329 [0.0117; 0.0547] | 1.16 [-1.45; 3.76] | 1.88 [-0.87; 4.92] |
| H2H_NET → taban | 691 | 0.0207 [0.0080; 0.0338] | 2.17 [0.14; 4.34] | -0.43 [-2.60; 2.17] |
| SON6 → taban + kontroller | 691 | 0.0191 [0.0065; 0.0302] | 0.00 [-1.74; 1.88] | 1.16 [-0.87; 3.18] |
| HIZ_DERECESI → taban + kontroller | 691 | 0.0177 [0.0050; 0.0291] | 0.43 [-1.30; 2.32] | 1.16 [-1.01; 3.33] |
| H2H_NET → taban + kontroller | 691 | 0.0048 [-0.0030; 0.0129] | -2.03 [-3.76; -0.29] | 0.14 [-1.74; 2.03] |

## 6. Bilgi tekrarı / gölgelenme (yarış-içi korelasyon)
| Çift | Yarış-içi Pearson |
|---|---|
| SON6 ↔ ACC_HIZ | 0.67 (n 12776) |
| HIZ_DERECESI ↔ ACC_HIZ | 0.55 (n 12776) |
| SON6 ↔ HIZ_DERECESI | 0.81 (n 14663) |
| H2H_NET ↔ ACC_HIZ | 0.39 (n 10856) |
| H2H_NET ↔ SON6 | 0.40 (n 12059) |
| SON6 ↔ GALOP_KAPASITE | 0.11 (n 12113) |
| SON6 ↔ handikap puanı | 0.42 (n 13166) |
| SON6 ↔ geçmiş ilk-3 oranı | 0.38 (n 14663) |
| HIZ_DERECESI ↔ geçmiş ilk-3 oranı | 0.30 (n 14663) |
| H2H_NET ↔ geçmiş ilk-3 oranı | 0.36 (n 12062) |
| H2H_NET ↔ geçmiş kazanma oranı | 0.16 (n 12062) |

## 7. BANKO: aynı sayıda favoride isabet ve NET GETİRİ (Örneklem A test yarışları — TEKRAR KULLANILMIŞ)
**Tanım:** her yarışta modelin olasılığı en yüksek atı "favori" sayılır; modelin favori olasılığı en yüksek olan en üst %K yarış "banko" seçilir (her model KENDİ olasılığıyla seçer, **banko sayısı aynıdır**). İsabet = favorinin kazanması. **Net getiri** = 1 birim ganyan bahsi (Result.ganyan, kazananın ganyan oranı; kazanırsa oran − 1, kaybederse −1) ortalaması; ganyanı olmayan yarışlar getiriden çıkarıldı (A'da ganyanı olan yarış: 1510/1510; medyan ganyan 4.00). Ganyan bahsi KUPON değil tek-at bahsi göstergesidir; beraberlikte (dead-heat) ganyan tek değer olarak alınmıştır. Köşeli parantez: yarış yeniden örnekleme (400) %95; "Ortak" = iki modelin seçtiği yarışların örtüşmesi. Puan = yüzde puan.
**SON6 ekli (taban: ACC_HIZ + GALOP + J_SEVIYE)**
| Banko sayısı | Taban isabet | Ekli isabet | İsabet farkı puan [%95] | Taban net getiri | Ekli net getiri | Getiri farkı puan [%95] | Ortak seçim |
|---|---|---|---|---|---|---|---|
| 63 (%5) | 34.9% | 42.9% | 7.94 [-4.76; 19.05] | -18.3% | -36.0% | -17.70 [-66.59; 19.52] | %54 |
| 126 (%10) | 38.1% | 40.5% | 2.38 [-3.97; 11.11] | -18.5% | -14.0% | 4.44 [-20.67; 30.67] | %63 |
| 252 (%20) | 33.7% | 34.9% | 1.19 [-3.57; 5.95] | -21.5% | -22.8% | -1.33 [-15.54; 13.95] | %71 |
| 378 (%30) | 31.7% | 32.8% | 1.06 [-3.17; 4.23] | -21.3% | -23.4% | -2.04 [-15.82; 8.32] | %75 |

**HIZ_DERECESI ekli (taban: ACC_HIZ + GALOP + J_SEVIYE)**
| Banko sayısı | Taban isabet | Ekli isabet | İsabet farkı puan [%95] | Taban net getiri | Ekli net getiri | Getiri farkı puan [%95] | Ortak seçim |
|---|---|---|---|---|---|---|---|
| 63 (%5) | 34.9% | 38.1% | 3.17 [-9.52; 12.70] | -18.3% | -39.4% | -21.11 [-69.68; 15.40] | %57 |
| 126 (%10) | 38.1% | 36.5% | -1.59 [-7.14; 7.14] | -18.5% | -24.4% | -5.91 [-30.04; 24.09] | %67 |
| 252 (%20) | 33.7% | 33.7% | 0.00 [-4.76; 5.56] | -21.5% | -16.3% | 5.14 [-10.36; 22.34] | %69 |
| 378 (%30) | 31.7% | 31.2% | -0.53 [-4.23; 2.91] | -21.3% | -24.4% | -3.03 [-13.37; 6.68] | %74 |

**H2H_NET ekli (taban: ACC_HIZ + GALOP + J_SEVIYE)**
| Banko sayısı | Taban isabet | Ekli isabet | İsabet farkı puan [%95] | Taban net getiri | Ekli net getiri | Getiri farkı puan [%95] | Ortak seçim |
|---|---|---|---|---|---|---|---|
| 63 (%5) | 34.9% | 41.3% | 6.35 [-6.35; 17.46] | -18.3% | -26.6% | -8.33 [-52.54; 34.21] | %57 |
| 126 (%10) | 38.1% | 40.5% | 2.38 [-4.76; 10.32] | -18.5% | -22.6% | -4.13 [-26.94; 20.95] | %71 |
| 252 (%20) | 33.7% | 34.9% | 1.19 [-3.17; 5.95] | -21.5% | -19.4% | 2.08 [-14.66; 18.37] | %74 |
| 378 (%30) | 31.7% | 33.6% | 1.85 [-2.12; 4.76] | -21.3% | -21.4% | -0.05 [-13.81; 8.93] | %78 |

**SON6 + H2H_NET ekli (taban: ACC_HIZ + GALOP + J_SEVIYE)**
| Banko sayısı | Taban isabet | Ekli isabet | İsabet farkı puan [%95] | Taban net getiri | Ekli net getiri | Getiri farkı puan [%95] | Ortak seçim |
|---|---|---|---|---|---|---|---|
| 63 (%5) | 34.9% | 39.7% | 4.76 [-7.94; 17.46] | -18.3% | -37.7% | -19.44 [-60.87; 28.73] | %46 |
| 126 (%10) | 38.1% | 43.7% | 5.56 [-3.17; 12.70] | -18.5% | -11.9% | 6.51 [-23.73; 31.98] | %62 |
| 252 (%20) | 33.7% | 38.1% | 4.37 [-0.40; 10.71] | -21.5% | -23.1% | -1.67 [-20.00; 15.97] | %63 |
| 378 (%30) | 31.7% | 34.4% | 2.65 [-2.38; 6.35] | -21.3% | -26.3% | -4.91 [-19.51; 6.31] | %68 |

**HIZ_DERECESI + H2H_NET ekli (taban: ACC_HIZ + GALOP + J_SEVIYE)**
| Banko sayısı | Taban isabet | Ekli isabet | İsabet farkı puan [%95] | Taban net getiri | Ekli net getiri | Getiri farkı puan [%95] | Ortak seçim |
|---|---|---|---|---|---|---|---|
| 63 (%5) | 34.9% | 41.3% | 6.35 [-9.52; 20.63] | -18.3% | -29.9% | -11.67 [-57.54; 35.48] | %48 |
| 126 (%10) | 38.1% | 38.9% | 0.79 [-7.94; 8.73] | -18.5% | -16.8% | 1.63 [-26.43; 29.60] | %58 |
| 252 (%20) | 33.7% | 37.7% | 3.97 [-0.79; 10.32] | -21.5% | -18.9% | 2.52 [-15.95; 23.29] | %62 |
| 378 (%30) | 31.7% | 33.6% | 1.85 [-2.65; 6.08] | -21.3% | -24.9% | -3.57 [-17.86; 9.68] | %69 |

**Aynı olasılıktaki favoriler arasında ayrım ("tek bırakılmaya uygun mu?"):** taban modelin favorisi, taban P_fav'ına göre üç dilime bölünür; her dilimde favorinin aday değeri dilim medyanının üstünde/altında olanların isabeti ve net getirisi karşılaştırılır (dilim içi P_fav'lar eşleştirilmiş kabul edilir; ort. P_fav üst/alt gösterilir). Pozitif fark = aday değeri yüksek favori daha sık kazanıyor.
**SON6**
| Dilim | Favori sayısı | Ort. P_fav (üst/alt yarı) | İsabet (üst yarı) | İsabet (alt yarı) | Fark puan [%95] | Net getiri (üst / alt) |
|---|---|---|---|---|---|---|
| 1. dilim (ort. P_fav 17.4%) | 403 | 17.7% / 17.1% | 18.4% (201) | 16.8% (202) | 1.58 [-5.37; 9.03] | -34.1% / -41.6% |
| 2. dilim (ort. P_fav 24.0%) | 403 | 24.0% / 23.9% | 20.4% (201) | 17.8% (202) | 2.58 [-5.87; 10.03] | -38.6% / -33.5% |
| 3. dilim (ort. P_fav 35.1%) | 403 | 35.7% / 34.4% | 32.8% (201) | 30.2% (202) | 2.64 [-5.80; 11.07] | -27.3% / -15.6% |

**HIZ_DERECESI**
| Dilim | Favori sayısı | Ort. P_fav (üst/alt yarı) | İsabet (üst yarı) | İsabet (alt yarı) | Fark puan [%95] | Net getiri (üst / alt) |
|---|---|---|---|---|---|---|
| 1. dilim (ort. P_fav 17.4%) | 403 | 17.8% / 17.0% | 17.4% (201) | 17.8% (202) | -0.41 [-7.85; 6.04] | -39.4% / -36.3% |
| 2. dilim (ort. P_fav 24.0%) | 403 | 24.0% / 23.9% | 19.9% (201) | 18.3% (202) | 1.58 [-6.36; 9.03] | -32.0% / -40.0% |
| 3. dilim (ort. P_fav 35.1%) | 403 | 35.2% / 35.0% | 34.3% (201) | 28.7% (202) | 5.62 [-2.83; 14.55] | -14.4% / -28.4% |

**H2H_NET**
| Dilim | Favori sayısı | Ort. P_fav (üst/alt yarı) | İsabet (üst yarı) | İsabet (alt yarı) | Fark puan [%95] | Net getiri (üst / alt) |
|---|---|---|---|---|---|---|
| 1. dilim (ort. P_fav 17.1%) | 337 | 17.2% / 17.0% | 22.6% (168) | 8.3% (169) | 14.34 [6.61; 22.05] | -19.6% / -70.2% |
| 2. dilim (ort. P_fav 23.4%) | 338 | 23.3% / 23.5% | 20.1% (169) | 16.0% (169) | 4.14 [-4.14; 12.43] | -45.5% / -28.4% |
| 3. dilim (ort. P_fav 33.9%) | 338 | 35.2% / 32.6% | 36.7% (169) | 24.9% (169) | 11.83 [1.18; 21.30] | -20.4% / -15.0% |

## Sınırlar
- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. A örneklemi tekrar kullanıldı; B kısa. Çoklu karşılaştırma düzeltilmedi; koşu tipi ve banko dilimleri küçük örneklidir (banko %5 ≈ 63 yarış) — net getiri farkları bu büyüklükte çok gürültülüdür.
- μ,σ referansı yarış tarihli satırları dışlayan 'tüm geçmiş' havuzdur (yaş/sınıf/koşu şartı ayrımı yok); atın kendi geçmiş koşuları da havuzdadır (n büyük olduğundan etkisi küçük). Yüzey durumu (nemli/ıslak) ayrılmadı. H2H ortak yarışları yalnız önbellekteki atlarla sınırlıdır; w_r ve λ geçici varsayımdır.
- Bu rapor seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.