# ANTRENÖR MODELİ v1.0 — ANT_SEVIYE ve ANT_BEKLENTI (ham değerler, sıralama ve banko testi)
**Motorun aktif sinyal listesine hiçbir şey eklenmedi; katsayı/birleşim ağırlığı belirlenmedi; `SINYAL_KAYDI` boş.** Seviye ve beklenti AYRI tutuldu. Her yarış için antrenör sonuçları O yarışın gününden önceki startlarla yeniden hesaplandı; 17.11.2026 toplu antrenör tablosu KULLANILMADI.

## 0. Tanımlar, veri ve açık uyarılar
- **ANT_SEVIYE** = (W + k·P0)/(N + k); pencere [t−365 gün, t); **P0** = antrenörün kendi startlarındaki 1/(sahadaki at sayısı) ortalaması (karşılaştırılabilir yarışlardaki eşit-şans kazanma oranı; yarış karışımına göre). **ANT_BEKLENTI** = Σ(Y_i − P_i)/(N + k), yalnız P_i'si bilinen startlar.
- **k = 8 GEÇİCİ SABİTTİR; öğrenilmedi** (J_FORM30'daki 8 ile aynı). "Testle belirlenecek" ifadesi uygulanmadı; yalnız bölüm 2'de k = 4/8/16/32 için **betimleyici duyarlılık** (seçim DEĞİL) gösterilir; k kararı sizin ve bağımsız veriyle verilmeli.
- **P_i (antrenör etkisi hariç beklenen olasılık):** yalnız ACC_HIZ + GALOP_KAPASITE; her blokta β YALNIZ önceki bloklardan (ölçü cihazı); **blok 0 için P_i YOK**; P_i'siz startlar ANT_BEKLENTI'ye girmez. P_i jokeyi de içermez (jokey etkisi de hariç), böylece antrenör/jokey aynı güçlü atlardan ortak puan almasın.
- **Antrenör adı:** TJK kısaltmaları (ör. "RAM. KAYA", "MEHM.KAYA" farklı kişilerdir); noktadan sonraki boşluklar normalleştirildi (841 farklı ad, medyan 31 start). Tam adla yazılmış (kısaltmasız) varyantlar toplam startın %1.4'i; birleştirilmedi (aynı kişinin tam ad/kısaltma varyantı ayrı sayılmış olabilir).
- **Veri sınırı:** veritabanı 2026-01-01'den başlar (365 günlük pencere kısa); P_i yalnız popülasyon A'nın blok ≥1'indeki yarışlarda var (16 Ağustos öncesi startlar beklentiye girmez).
- **Örneklem A** (/admin/kosu-tipleri, 1510 yarış) model kararlarında defalarca kullanıldı → **bağımsız nihai doğrulama DEĞİLDİR.** **Örneklem B** (01.07–15.08.2026, 829 yarış) daha az kullanılmış; yalnız ANT_SEVIYE için (P_i yok).
- Gelecek-bozma testi (8 gün, 727 antrenör): **GEÇTİ — sızıntı yok**. Bağımsız yeniden hesap (düz döngü, 150 rastgele antrenör-yarış): **uyuşmayan 0**. Puanlar sonuç yüklenmeden önce hesaplandı.

## 1. Kapsam ve ham değer dağılımı (Örneklem A)
| Ölçü | At | Oran |
|---|---|---|
| Antrenör adı var | 15487 | 100.0% |
| ANT_SEVIYE var (pencerede ≥1 start) | 15412 | 99.5% |
| ANT_BEKLENTI var (P_i'si bilinen ≥1 start) | 12109 | 78.2% |
| N ≥ 30 (ANT_SEVIYE) | 13670 | 88.3% |
| P_i'si bilinen start ≥ 10 (ANT_BEKLENTI) | 8193 | 52.9% |

Medyan N (ANT_SEVIYE) 113; medyan P_i'si bilinen start / N 0.12. ANT_SEVIYE ham değer çeyrekleri: 0.037 / 0.071 / 0.093 / 0.121 / 0.190 (5/25/50/75/95. yüzdelik); ANT_BEKLENTI: -0.064 / -0.035 / -0.012 / 0.025 / 0.090.

## 2. SIRALAMA: ACC_HIZ + GALOP_KAPASITE + J_SEVIYE üzerine ek katkı (Örneklem A — TEKRAR KULLANILMIŞ)
Ölçü cihazı: β'lar YALNIZ geçmiş bloklardan; eksik puan yarış ortalamasına (nötr); yön varsayımı yok. 1259 test yarışı. ΔLL pozitif = iyileşme; Top1/Top3 puan; köşeli parantez eşleştirilmiş bootstrap %95. Girdi ölçekleri sabit (ANT_SEVIYE/0,10; ANT_BEKLENTI/0,03).
| Ölçüm | Log-loss | ΔLL (taban 1/N − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|
| T. ACC_HIZ + GALOP_KAPASITE + J_SEVIYE (taban) | 2.0763 | 0.2133 [0.1815; 0.2474] | 23.0% (10.7%) | 57.8% (32.0%) | 3.18/1.35/0.54 ; 3.66/1.77/0.51 ; 3.45/1.47/0.55 ; 3.26/1.40/0.63 ; 3.13/1.29/0.64 |
| T + ANT_SEVIYE | 2.0605 | 0.2291 [0.1953; 0.2632] | 24.8% (10.7%) | 58.0% (32.0%) | 3.16/1.32/0.52/0.22 ; 3.63/1.75/0.49/0.14 ; 3.42/1.42/0.52/0.26 ; 3.22/1.36/0.60/0.27 ; 3.10/1.24/0.60/0.36 |
| T + ANT_BEKLENTI | 2.0661 | 0.2234 [0.1881; 0.2571] | 23.3% (10.7%) | 58.5% (32.0%) | 3.18/1.35/0.54/0.00 ; 3.66/1.77/0.50/0.06 ; 3.46/1.46/0.55/0.08 ; 3.25/1.40/0.62/0.08 ; 3.13/1.30/0.63/0.10 |
| T + ANT_SEVIYE + ANT_BEKLENTI | 2.0566 | 0.2329 [0.1983; 0.2675] | 24.7% (10.7%) | 58.2% (32.0%) | 3.16/1.32/0.52/0.22/0.00 ; 3.63/1.75/0.49/0.12/0.05 ; 3.42/1.42/0.52/0.23/0.06 ; 3.22/1.37/0.60/0.23/0.06 ; 3.10/1.25/0.60/0.30/0.07 |
| Yalnız ANT_SEVIYE | 2.2493 | 0.0402 [0.0283; 0.0514] | 17.5% (10.7%) | 43.2% (32.0%) | 0.41 ; 0.38 ; 0.49 ; 0.50 ; 0.58 |
| Yalnız ANT_BEKLENTI | 2.2748 | 0.0147 [0.0069; 0.0222] | 14.1% (10.7%) | 39.5% (32.0%) | 0.00 ; 0.07 ; 0.09 ; 0.10 ; 0.11 |
| TK. taban + kontroller (hp, geçmiş performans, sınıf değişimi) | 2.0231 | 0.2665 [0.2299; 0.3028] | 26.0% (10.7%) | 60.0% (32.0%) | 2.44/1.32/0.45/0.24/0.92/1.39/-0.13 ; 2.87/1.72/0.42/0.34/0.76/1.27/-0.19 ; 2.66/1.45/0.45/0.44/0.62/1.22/-0.17 ; 2.46/1.38/0.51/0.50/0.61/1.14/-0.19 ; 2.33/1.28/0.52/0.49/0.84/1.17/-0.27 |
| TK + ANT_SEVIYE | 2.0144 | 0.2751 [0.2389; 0.3109] | 26.2% (10.7%) | 59.7% (32.0%) | 2.43/1.31/0.44/0.24/0.83/1.38/-0.14/0.10 ; 2.87/1.71/0.41/0.34/0.73/1.27/-0.18/0.05 ; 2.66/1.42/0.43/0.44/0.49/1.20/-0.17/0.18 ; 2.45/1.36/0.50/0.50/0.48/1.11/-0.19/0.19 ; 2.33/1.24/0.50/0.48/0.64/1.12/-0.27/0.27 |
| TK + ANT_BEKLENTI | 2.0159 | 0.2736 [0.2389; 0.3098] | 27.1% (10.7%) | 59.5% (32.0%) | 2.44/1.32/0.45/0.24/0.92/1.39/-0.13/0.00 ; 2.87/1.72/0.41/0.35/0.74/1.27/-0.19/0.05 ; 2.67/1.44/0.45/0.44/0.56/1.21/-0.18/0.07 ; 2.46/1.39/0.51/0.51/0.50/1.13/-0.21/0.07 ; 2.33/1.29/0.51/0.49/0.68/1.16/-0.30/0.08 |
| TK + ANT_SEVIYE + ANT_BEKLENTI | 2.0111 | 0.2784 [0.2432; 0.3153] | 27.6% (10.7%) | 59.7% (32.0%) | 2.43/1.31/0.44/0.24/0.83/1.38/-0.14/0.10/0.00 ; 2.87/1.71/0.41/0.35/0.71/1.26/-0.19/0.03/0.05 ; 2.66/1.42/0.43/0.44/0.46/1.19/-0.18/0.15/0.06 ; 2.45/1.37/0.50/0.51/0.42/1.11/-0.21/0.15/0.06 ; 2.33/1.26/0.50/0.49/0.57/1.12/-0.29/0.21/0.07 |

**Ek katkılar:**
| Karşılaştırma | Yarış | ΔLL ek katkı [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| ANT_SEVIYE → taban | 1259 | 0.0158 [0.0093; 0.0223] | 1.83 [0.56; 3.10] | 0.16 [-1.35; 1.59] |
| ANT_BEKLENTI → taban | 1259 | 0.0101 [0.0044; 0.0161] | 0.32 [-0.79; 1.43] | 0.71 [-0.56; 1.91] |
| ikisi birlikte → taban | 1259 | 0.0197 [0.0111; 0.0274] | 1.75 [0.32; 3.18] | 0.40 [-1.27; 2.07] |
| **ANT_BEKLENTI → taban + ANT_SEVIYE** (aynı bilgi mi?) | 1259 | 0.0039 [-0.0004; 0.0081] | -0.08 [-1.11; 0.87] | 0.24 [-0.95; 1.43] |
| **ANT_SEVIYE → taban + ANT_BEKLENTI** (aynı bilgi mi?) | 1259 | 0.0095 [0.0046; 0.0147] | 1.43 [0.24; 2.78] | -0.32 [-1.59; 0.87] |
| **ANT_SEVIYE → taban + kontroller** (at kalitesi kontrollü) | 1259 | 0.0087 [0.0044; 0.0127] | 0.24 [-0.64; 1.19] | -0.32 [-1.27; 0.64] |
| **ANT_BEKLENTI → taban + kontroller** | 1259 | 0.0072 [0.0019; 0.0125] | 1.11 [-0.08; 2.38] | -0.56 [-1.59; 0.64] |
| ikisi birlikte → taban + kontroller | 1259 | 0.0120 [0.0058; 0.0184] | 1.59 [0.32; 2.86] | -0.32 [-1.59; 0.87] |
| Kontroller → taban (bilgi) | 1259 | 0.0532 [0.0386; 0.0683] | 3.02 [1.03; 4.85] | 2.22 [0.16; 4.21] |

**Sönümlenme (ANT_SEVIYE):** kontrolsüz 0.0158 → kontrollü 0.0087 (%55 kalıyor).

**k duyarlılığı (BETİMLEYİCİ; seçim DEĞİL — ΔLL taban + ilgili hesap, taban 0,0000):**
| k | ANT_SEVIYE → taban ΔLL [%95] | ANT_BEKLENTI → taban ΔLL [%95] |
|---|---|---|
| 4 | 0.0149 [0.0091; 0.0208] | 0.0095 [0.0046; 0.0150] |
| 8 (geçici sabit) | 0.0158 [0.0094; 0.0222] | 0.0101 [0.0038; 0.0165] |
| 16 | 0.0166 [0.0103; 0.0233] | 0.0106 [0.0044; 0.0176] |
| 32 | 0.0174 [0.0106; 0.0237] | 0.0107 [0.0033; 0.0185] |

**Koşu tipine göre (ANT_SEVIYE → taban, ΔLL / Top1 / Top3):**
| Koşu tipi | Test yarışı | ΔLL [%95] | Top1 [%95] | Top3 [%95] |
|---|---|---|---|---|
| Maiden | 256 | 0.0131 [0.0000; 0.0268] | 1.56 [-0.78; 3.91] | 0.78 [-1.95; 3.52] |
| Şartlı | 411 | 0.0170 [0.0064; 0.0284] | 1.22 [-0.97; 3.65] | 2.68 [0.00; 5.11] |
| Handikap | 352 | 0.0201 [0.0092; 0.0332] | 0.85 [-1.14; 3.13] | -1.42 [-4.26; 1.42] |
| KV | 155 | -0.0032 [-0.0232; 0.0154] | 3.23 [-0.65; 7.74] | -1.94 [-6.45; 2.58] |
| Grup | 48 | 0.0476 [0.0095; 0.0872] | 10.42 [0.00; 20.83] | -4.17 [-10.42; 0.00] |
| Satış | 35 | 0.0177 [-0.0173; 0.0549] | 2.86 [0.00; 8.57] | -2.86 [-11.43; 5.71] |

## 3. Örneklem B (01.07–15.08.2026; daha az kullanılmış) — yalnız ANT_SEVIYE
Yarış 829, test 691; ANT_SEVIYE kapsamı 99.3%.
| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| ANT_SEVIYE → taban | 691 | 0.0089 [-0.0059; 0.0256] | -0.72 [-3.18; 2.03] | -0.43 [-3.04; 1.88] |
| ANT_SEVIYE → taban + kontroller | 691 | 0.0028 [-0.0095; 0.0138] | -0.29 [-2.32; 1.74] | 0.87 [-1.01; 3.04] |

## 4. Bilgi tekrarı: antrenör ↔ jokey ↔ at kalitesi (yarış-içi korelasyon)
| Çift | Yarış-içi Pearson |
|---|---|
| ANT_SEVIYE ↔ J_SEVIYE (iki "seviye" aynı güçlü atlardan mı?) | 0.16 (n 15350) |
| ANT_SEVIYE ↔ ANT_BEKLENTI | 0.40 (n 12048) |
| ANT_SEVIYE ↔ ACC_HIZ | 0.11 (n 12749) |
| ANT_SEVIYE ↔ GALOP_KAPASITE | 0.06 (n 12737) |
| ANT_SEVIYE ↔ handikap puanı | 0.12 (n 13108) |
| ANT_SEVIYE ↔ geçmiş ilk-3 oranı | 0.17 (n 14623) |
| ANT_BEKLENTI ↔ J_SEVIYE | 0.05 (n 12002) |
| ANT_BEKLENTI ↔ ACC_HIZ | 0.04 (n 9975) |

## 5. BANKO: aynı sayıda banko seçerek ek isabet var mı? (Örneklem A test yarışları — TEKRAR KULLANILMIŞ)
**Banko tanımı (bu testte):** her yarışta modelin olasılığı en yüksek atı "favori" sayılır; modelin favori olasılığı en yüksek olan en üst %K yarış "banko" seçilir (her model KENDİ olasılığıyla seçer, **seçilen banko sayısı aynıdır**). Banko isabeti = seçilen yarışlarda favorinin kazanması. Tablo: taban (ACC_HIZ + GALOP + J_SEVIYE) ile antrenör eklenmiş modelin banko isabeti ve eşleştirilmiş bootstrap (400, yarış yeniden örneklemesi; seçim her örneklemde yeniden yapılır). "Ortak" = iki modelin seçtiği banko yarışlarının örtüşme oranı.
**ANT_SEVIYE ekli**
| Banko sayısı | Taban isabet | Antrenörlü isabet | Fark [%95] | Ortak seçim |
|---|---|---|---|---|
| 63 (%5) | 34.9% | 33.3% | -1.59 puan [-7.94; 7.94] | %81 |
| 126 (%10) | 37.3% | 38.9% | 1.59 puan [-3.97; 7.14] | %83 |
| 252 (%20) | 33.7% | 36.9% | 3.17 puan [-0.79; 6.75] | %84 |
| 378 (%30) | 32.0% | 33.9% | 1.85 puan [-0.26; 5.03] | %88 |

**ANT_BEKLENTI ekli**
| Banko sayısı | Taban isabet | Antrenörlü isabet | Fark [%95] | Ortak seçim |
|---|---|---|---|---|
| 63 (%5) | 34.9% | 38.1% | 3.17 puan [-4.76; 12.70] | %78 |
| 126 (%10) | 37.3% | 37.3% | 0.00 puan [-4.76; 5.56] | %85 |
| 252 (%20) | 33.7% | 36.5% | 2.78 puan [-0.40; 5.95] | %86 |
| 378 (%30) | 32.0% | 32.0% | 0.00 puan [-2.38; 2.38] | %90 |

**ANT_SEVIYE + ANT_BEKLENTI ekli**
| Banko sayısı | Taban isabet | Antrenörlü isabet | Fark [%95] | Ortak seçim |
|---|---|---|---|---|
| 63 (%5) | 34.9% | 34.9% | 0.00 puan [-7.94; 12.70] | %73 |
| 126 (%10) | 37.3% | 37.3% | 0.00 puan [-5.56; 6.35] | %75 |
| 252 (%20) | 33.7% | 38.9% | 5.16 puan [0.00; 9.13] | %79 |
| 378 (%30) | 32.0% | 34.9% | 2.91 puan [-0.53; 5.56] | %84 |

**Aynı olasılıktaki favoriler arasında antrenör ayrımı:** taban modelin favorisi, taban P_fav'ına göre üç dilime bölünür; her dilimde favorinin antrenör değeri dilim medyanının üstünde/altında olanların isabeti karşılaştırılır (dilim içinde P_fav'lar eşleştirilmiş kabul edilir; ort. P_fav üst/alt gösterilir).
**ANT_SEVIYE**
| Dilim | Favori sayısı | Ort. P_fav (üst/alt yarı) | İsabet (üst yarı) | İsabet (alt yarı) | Fark [%95] |
|---|---|---|---|---|---|
| 1. dilim (ort. P_fav 17.4%) | 417 | 17.6% / 17.1% | 20.2% (208) | 14.8% (209) | 5.36 puan [-1.84; 12.08] |
| 2. dilim (ort. P_fav 23.8%) | 418 | 23.8% / 23.9% | 23.4% (209) | 15.8% (209) | 7.66 puan [0.00; 15.79] |
| 3. dilim (ort. P_fav 34.9%) | 418 | 34.8% / 34.9% | 32.5% (209) | 31.6% (209) | 0.96 puan [-7.66; 9.09] |

**ANT_BEKLENTI**
| Dilim | Favori sayısı | Ort. P_fav (üst/alt yarı) | İsabet (üst yarı) | İsabet (alt yarı) | Fark [%95] |
|---|---|---|---|---|---|
| 1. dilim (ort. P_fav 17.3%) | 390 | 17.4% / 17.2% | 18.5% (195) | 16.4% (195) | 2.05 puan [-4.62; 9.74] |
| 2. dilim (ort. P_fav 23.8%) | 390 | 23.8% / 23.9% | 24.6% (195) | 13.8% (195) | 10.77 puan [3.59; 18.46] |
| 3. dilim (ort. P_fav 35.0%) | 391 | 35.5% / 34.6% | 35.9% (195) | 28.6% (196) | 7.33 puan [-2.90; 17.03] |

## Sınırlar
- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. A örneklemi tekrar kullanıldı; B kısa ve yalnız ANT_SEVIYE için. Çoklu karşılaştırma düzeltilmedi; koşu tipi ve banko dilimleri küçük örneklidir (banko %5 ≈ 63 yarış).
- P_i yalnız ACC_HIZ + GALOP_KAPASITE'den gelir (sınıf, kilo, kulvar, geçmiş performans yok); ANT_BEKLENTI bu eksikliklerin kısmen "antrenör etkisi" gibi görünmesine açıktır. Banko analizi retrospektiftir; favori olasılıkları kalibre edilmiş gerçek olasılık değildir (ölçü cihazı çıktısı). Bu rapor seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.