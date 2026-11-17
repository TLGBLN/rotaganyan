# TEMPO — ACC_HIZ'dan bağımsız katkı ve bilgi tekrarı (ERKEN_HIZ, KOSU_STILI, LIDERLIK_BASKISI)
**Yeni motora sinyal eklenmedi; ağırlık/katsayı SEÇİLMEDİ; `SINYAL_KAYDI` boş.** Popülasyon: /admin/kosu-tipleri yarışları — **1510 yarış, 15487 at** (güncel motor dönemi, yayınlanmış tahminli, sonuçlu; Karma/koşullu kopyalar hariç). Gün/tarih kırılımı verilmedi.
Her puan yalnız yarış gününden ÖNCEKİ Accurace kayıtlarıyla (as-of); N = TJK'daki gerçek koşan at sayısı; referans ırk+pist+hipodrom+mesafe. **Gelecek-bozma testi** (8 gün, 1464 ölçüm: tüm atların bileşenleri + her yarışın τ'su): **GEÇTİ — birebir aynı, sızıntı yok**. Puanlar sonuç yüklenmeden önce hesaplandı.

## Okuma kılavuzu
- **Ölçü cihazı:** yarışlar tarihe göre 6 bloğa bölünür; blok k için β'lar YALNIZ blok 0..k−1'den öğrenilir (ridge 0.02); eksik puan yarışın puanlı atlarının ortalamasına (nötr) eşitlenir; **yön varsayımı yok** (β işareti veriden). Bu bir model değil, **bilgi katkısını** ölçen cihazdır. Taban = 1/N. Test yarışı: 1259.
- Girdiler (cihaz ölçeği): ACC_HIZ/100, ERKEN_HIZ/100, KOSU_STILI (0–1), LIDERLIK_BASKISI/(B'de bilinen rakip sayısı) (ortalama rakip başına baskı). Formüller değişmedi; yalnız ölçek.
- **ΔLL** = taban − ölçüm (pozitif = daha iyi). **Katkı** = (ACC_HIZ + TEMPO bileşeni) modelinin ΔLL'si − yalnız ACC_HIZ modelinin ΔLL'si; köşeli parantez eşleştirilmiş bootstrap %95 (1000). **Top1/Top3**: öğrenilen olasılıklara göre tam saha; rastgele 1/N, 3/N.

## 1. Kapsam
| Ölçü | At | Oran |
|---|---|---|
| ACC_HIZ var | 12878 | 83.2% |
| ERKEN_HIZ var | 14544 | 93.9% |
| KOSU_STILI var | 14526 | 93.8% |
| LIDERLIK_BASKISI var (τ ve atın V'si bilinen) | 13926 | 89.9% |
| P_öncü'de veri YOK (önsel 0,5) | 961 | 6.2% |
| Dördü de var | 12360 | 79.8% |

τ hesaplanabilen yarış (yeterli benzer geçmiş yarış): 1454/1510 (96.3%).

## 2. Ayrı ayrı ve birlikte (ölçü cihazı, tam saha)
| Ölçüm | Log-loss | ΔLL (taban−ölçüm) [%95] | **ACC_HIZ'a katkı** ΔLL [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|---|
| A. Yalnız ACC_HIZ | 2.1521 | 0.1374 [0.1094; 0.1656] | — | 20.3% (10.7%) | 51.4% (32.0%) | 3.66 ; 4.05 ; 3.90 ; 3.77 ; 3.67 |
| B1. Yalnız ERKEN_HIZ | 2.2747 | 0.0149 [0.0059; 0.0234] | — | 13.4% (10.7%) | 39.5% (32.0%) | 0.68 ; 0.69 ; 0.92 ; 1.06 ; 1.05 |
| B2. Yalnız KOSU_STILI | 2.2694 | 0.0201 [0.0090; 0.0323] | — | 13.9% (10.7%) | 38.8% (32.0%) | 1.08 ; 0.85 ; 0.86 ; 0.91 ; 0.86 |
| B3. Yalnız LIDERLIK_BASKISI | 2.2740 | 0.0156 [0.0061; 0.0243] | — | 15.0% (10.7%) | 39.5% (32.0%) | -1.53 ; -1.34 ; -1.77 ; -1.89 ; -1.86 |
| B4. TEMPO üçü birlikte (ACC yok) | 2.2644 | 0.0251 [0.0133; 0.0379] | — | 15.3% (10.7%) | 39.7% (32.0%) | -0.79/0.94/-1.99 ; 0.08/0.75/-0.56 ; 0.04/0.69/-1.10 ; 0.68/0.75/-0.14 ; 0.62/0.69/-0.26 |
| C1. ACC_HIZ + ERKEN_HIZ | 2.1512 | 0.1383 [0.1117; 0.1648] | 0.0009 [-0.0018; 0.0035] | 19.9% (10.7%) | 52.1% (32.0%) | 3.65/0.07 ; 4.05/-0.00 ; 3.83/0.27 ; 3.66/0.44 ; 3.56/0.41 |
| C2. ACC_HIZ + KOSU_STILI | 2.1430 | 0.1465 [0.1206; 0.1784] | 0.0091 [0.0004; 0.0179] | 20.0% (10.7%) | 51.8% (32.0%) | 3.56/0.94 ; 3.95/0.61 ; 3.79/0.61 ; 3.66/0.68 ; 3.56/0.64 |
| C3. ACC_HIZ + LIDERLIK_BASKISI | 2.1505 | 0.1391 [0.1095; 0.1675] | 0.0016 [-0.0020; 0.0053] | 20.2% (10.7%) | 52.4% (32.0%) | 3.59/-0.56 ; 4.03/-0.23 ; 3.81/-0.73 ; 3.66/-0.87 ; 3.55/-0.83 |
| C5. ACC_HIZ + ERKEN_HIZ + KOSU_STILI | 2.1440 | 0.1456 [0.1153; 0.1757] | 0.0081 [-0.0010; 0.0174] | 20.1% (10.7%) | 52.2% (32.0%) | 3.61/-0.29/0.99 ; 4.00/-0.26/0.66 ; 3.78/0.04/0.60 ; 3.62/0.19/0.65 ; 3.52/0.18/0.60 |
| C4. ACC_HIZ + TEMPO üçü | 2.1451 | 0.1444 [0.1152; 0.1732] | 0.0070 [-0.0023; 0.0159] | 19.8% (10.7%) | 52.4% (32.0%) | 3.61/-1.31/0.91/-1.92 ; 4.00/-0.59/0.64/-0.64 ; 3.79/-0.57/0.56/-1.18 ; 3.62/0.07/0.64/-0.23 ; 3.52/0.03/0.59/-0.29 |

**Eşleştirilmiş Top1/Top3 farkları** (ACC_HIZ'a bileşen eklenince; puan; köşeli parantez bootstrap %95):
- C1. ACC_HIZ + ERKEN_HIZ − yalnız ACC_HIZ: Top1 -0.42 [-1.13; 0.29] · Top3 0.72 [-0.17; 1.61]
- C2. ACC_HIZ + KOSU_STILI − yalnız ACC_HIZ: Top1 -0.26 [-1.78; 1.24] · Top3 0.43 [-1.37; 2.43]
- C3. ACC_HIZ + LIDERLIK_BASKISI − yalnız ACC_HIZ: Top1 -0.10 [-0.97; 0.75] · Top3 0.97 [-0.16; 2.15]
- C5. ACC_HIZ + ERKEN_HIZ + KOSU_STILI − yalnız ACC_HIZ: Top1 -0.18 [-1.84; 1.49] · Top3 0.76 [-1.31; 2.61]
- C4. ACC_HIZ + TEMPO üçü − yalnız ACC_HIZ: Top1 -0.50 [-2.16; 1.26] · Top3 1.00 [-0.86; 2.91]
- **LIDERLIK_BASKISI'nın ERKEN_HIZ+KOSU_STILI ötesindeki katkısı** (C4 − C5, ACC_HIZ'lı): ΔLL -0.0011 [-0.0033; 0.0009] (pozitif = baskı eklenince iyileşme).

## 3. Bilgi tekrarı: ACC_HIZ ve TEMPO bileşenleri arasındaki korelasyon
Pearson / Spearman / **yarış-içi Pearson** (aynı yarışta ortalamadan sapma); iki puanı da olan atlar:
| Çift | Pearson / Spearman / yarış-içi |
|---|---|
| ACC_HIZ ↔ ERKEN_HIZ | 0.39 / 0.38 / **0.22** (n 12800) |
| ACC_HIZ ↔ KOSU_STILI | 0.15 / 0.13 / **0.12** (n 12786) |
| ACC_HIZ ↔ LIDERLIK_BASKISI | -0.10 / -0.10 / **-0.21** (n 12302) |
| ERKEN_HIZ ↔ KOSU_STILI | 0.31 / 0.29 / **0.30** (n 14524) |
| ERKEN_HIZ ↔ LIDERLIK_BASKISI | -0.68 / -0.69 / **-0.96** (n 13926) |
| KOSU_STILI ↔ LIDERLIK_BASKISI | -0.22 / -0.23 / **-0.37** (n 13906) |

## 4. Koşu tipine göre: tüm TEMPO + ACC_HIZ (C4) − yalnız ACC_HIZ (A), Top1/Top3 farkı (puan)
| Koşu tipi | Test yarışı | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|
| Maiden | 256 | 1.9 [-1.3; 5.1] | -2.1 [-6.6; 2.1] |
| Şartlı | 411 | 1.2 [-1.2; 4.1] | 2.6 [-0.3; 5.6] |
| Handikap | 352 | -3.4 [-6.3; -0.3] | 1.4 [-1.8; 4.8] |
| KV | 155 | -1.3 [-6.5; 4.5] | -2.7 [-8.5; 3.2] |
| Grup | 48 | -2.1 [-14.6; 10.4] | 8.3 [-2.1; 18.8] |
| Satış | 35 | -2.9 [-14.3; 8.6] | 6.7 [-3.8; 18.1] |

## Sınırlar
- Taban 1/N (sinyalsiz) ve zayıf; sonuçlar piyasa/AGF veya mevcut motorun diğer sinyalleriyle karşılaştırma değildir. β'lar yalnız ölçü cihazıdır; hangi TEMPO hesabının motora gireceği kararı sizindir.
- LIDERLIK_BASKISI B_h, hesabı gereği atın KENDİ erken hızına bağlıdır (hızlı atın önündeki hızlı rakip azdır); bu bağ yukarıdaki korelasyon satırıyla ölçülmüştür. B'nin "hızlı atı zorlayan rakip" kavramını atın kendi öne gitme eğilimiyle (P_öncü) birleştiren bir etkileşim bu testte KURULMADI; tanım sizindir.
- P_öncü n=3 yarışa dayanan kaba bir eğilimdir; kapsam düşük olan atlarda önsel 0,5 kullanılır (bölüm 1'de sayıldı). Accurace kayıtlarının veritabanına giriş zamanı saklanmıyor. Çoklu karşılaştırma düzeltilmedi.