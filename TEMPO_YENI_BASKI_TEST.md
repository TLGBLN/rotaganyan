# YENİ LİDERLİK BASKISI (v2) — ACC_HIZ ve KOSU_STILI üzerine ek katkı testi
**Yeni motora sinyal eklenmedi; ağırlık/katsayı SEÇİLMEDİ; `SINYAL_KAYDI` boş.** Eski σ-formülü iptal. **Yeni tanım (sizin):** B_h = P_h · Σ_{j≠h} P_j · exp(−|V_h − V_j| / τ); P_öncü = (1+k)/(2+n) ve k = atın son n=3 uygun yarışında **400 m VE 600 m'de kalıcı ön grupta** olduğu yarış sayısı (ön grup = sıra ≤ max(2, ⌈0,20·N⌉), N = TJK'daki gerçek koşan at sayısı); V = ERKEN_HIZ yüzdeliği; τ = benzer geçmiş yarışlarda atlar arası ERKEN_HIZ farklarının (|ΔV|) medyanı (önceki aşamadaki gibi, sonuçlardan bağımsız, as-of).
Popülasyon: /admin/kosu-tipleri — **1510 yarış, 15487 at**; **aynı 6 blok / 1259 test yarışı**. Her puan yarış gününden ÖNCEKİ kayıtlarla. **Gelecek-bozma testi** (8 gün, 1464 ölçüm: tüm atların bileşenleri + τ): **GEÇTİ — birebir aynı, sızıntı yok**. Puanlar sonuç yüklenmeden önce hesaplandı.

## Okuma kılavuzu
- Ölçü cihazı: β'lar YALNIZ geçmiş bloklardan; eksik puan yarış ortalamasına (nötr); **yön varsayımı yok**. ΔLL = taban(1/N) − ölçüm (pozitif = iyi). Girdi ölçekleri: ACC_HIZ/100, ERKEN_HIZ/100, KOSU_STILI (0–1), BASKI/(B'de bilinen rakip sayısı). Köşeli parantez = eşleştirilmiş bootstrap %95 (1000).
- **Karar kuralınız:** ACC_HIZ ve KOSU_STILI üzerine ek katkı yoksa baskı sinyali oluşturulmaz → bu yüzden asıl karşılaştırma **E2 − D1**. ERKEN_HIZ yardımcı veridir; D2/E3 yalnız baskının ERKEN_HIZ'ın ötesinde bilgi taşıyıp taşımadığını görmek içindir.

## 1. Kapsam
| Ölçü | At | Oran |
|---|---|---|
| ACC_HIZ var | 12878 | 83.2% |
| KOSU_STILI var | 14526 | 93.8% |
| YENİ BASKI var (τ ve atın V'si bilinen) | 13926 | 89.9% |
| P_öncü'de veri YOK (önsel 0,5) | 961 | 6.2% |
| P_öncü ≥ 0,6 (son 3 yarışın ≥2'sinde kalıcı ön grup) | 2720 | 17.6% |

τ hesaplanabilen yarış: 1454/1510 (96.3%).

## 2. Ek katkı (ölçü cihazı, tam saha)
| Ölçüm | Log-loss | ΔLL (taban−ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|
| A. Yalnız ACC_HIZ | 2.1521 | 0.1374 [0.1094; 0.1656] | 20.3% (10.7%) | 51.4% (32.0%) | 3.66 ; 4.05 ; 3.90 ; 3.77 ; 3.67 |
| D1. ACC_HIZ + KOSU_STILI (korunan iki sinyal) | 2.1430 | 0.1465 [0.1139; 0.1773] | 20.0% (10.7%) | 51.8% (32.0%) | 3.56/0.94 ; 3.95/0.61 ; 3.79/0.61 ; 3.66/0.68 ; 3.56/0.64 |
| B. Yalnız YENİ LIDERLIK_BASKISI | 2.2847 | 0.0048 [0.0009; 0.0086] | 13.0% (10.7%) | 36.4% (32.0%) | 2.49 ; 2.73 ; 2.88 ; 4.17 ; 3.78 |
| E1. ACC_HIZ + YENİ BASKI | 2.1498 | 0.1397 [0.1122; 0.1660] | 20.7% (10.7%) | 51.7% (32.0%) | 3.65/2.18 ; 4.04/1.95 ; 3.89/1.79 ; 3.75/3.10 ; 3.65/2.81 |
| E2. ACC_HIZ + KOSU_STILI + YENİ BASKI | 2.1437 | 0.1458 [0.1176; 0.1746] | 20.1% (10.7%) | 52.4% (32.0%) | 3.54/1.10/-2.75 ; 3.94/0.69/-1.46 ; 3.79/0.72/-1.92 ; 3.65/0.72/-0.73 ; 3.56/0.68/-0.83 |
| D2. ACC_HIZ + KOSU_STILI + ERKEN_HIZ (yardımcı) | 2.1440 | 0.1456 [0.1187; 0.1735] | 20.1% (10.7%) | 52.2% (32.0%) | 3.61/0.99/-0.29 ; 4.00/0.66/-0.26 ; 3.78/0.60/0.04 ; 3.62/0.65/0.19 ; 3.52/0.60/0.18 |
| E3. ACC_HIZ + KOSU_STILI + ERKEN_HIZ + YENİ BASKI | 2.1447 | 0.1448 [0.1157; 0.1749] | 20.1% (10.7%) | 52.2% (32.0%) | 3.61/1.17/-0.31/-2.87 ; 3.99/0.75/-0.27/-1.56 ; 3.78/0.71/0.03/-1.91 ; 3.61/0.68/0.18/-0.68 ; 3.52/0.65/0.18/-0.78 |

**Ek katkılar (ΔLL farkı; pozitif = baskı eklenince iyileşme) ve Top1/Top3 farkları (puan):**
- **Baskı → yalnız ACC_HIZ'a** (E1 − A): ΔLL 0.0023 [-0.0005; 0.0052] · Top1 0.38 [-0.59; 1.40] · Top3 0.34 [-0.58; 1.28]
- **Baskı → ACC_HIZ + KOSU_STILI'na (KARAR KURALI)** (E2 − D1): ΔLL -0.0007 [-0.0023; 0.0011] · Top1 0.08 [-0.56; 0.71] · Top3 0.61 [-0.11; 1.38]
- **Baskı → ACC_HIZ + KOSU_STILI + ERKEN_HIZ'a** (E3 − D2): ΔLL -0.0008 [-0.0026; 0.0011] · Top1 0.00 [-0.64; 0.71] · Top3 0.00 [-0.79; 0.87]
- **Referans: KOSU_STILI → yalnız ACC_HIZ'a** (D1 − A): ΔLL 0.0091 [0.0005; 0.0176] · Top1 -0.26 [-1.78; 1.24] · Top3 0.43 [-1.37; 2.43]

## 3. Bilgi tekrarı (eski formülle karşılaştırma için de)
Pearson / Spearman / **yarış-içi Pearson**; iki değeri de olan atlar. (Eski σ-formülünde BASKI ↔ ERKEN_HIZ yarış-içi korelasyonu **−0,96** idi.)
| Çift | Pearson / Spearman / yarış-içi |
|---|---|
| YENİ BASKI ↔ ERKEN_HIZ | 0.18 / 0.19 / **0.20** (n 13926) |
| YENİ BASKI ↔ ACC_HIZ | 0.08 / 0.05 / **0.06** (n 12302) |
| YENİ BASKI ↔ KOSU_STILI | 0.53 / 0.50 / **0.55** (n 13906) |
| YENİ BASKI ↔ P_öncü (atın kendi öne gitme eğilimi) | 0.67 / 0.62 / **0.70** (n 13926) |
| KOSU_STILI ↔ P_öncü | 0.77 / 0.73 / **0.76** (n 14526) |

## 4. Koşu tipine göre: YENİ BASKI ek katkısı (E2 − D1), Top1/Top3 farkı (puan)
| Koşu tipi | Test yarışı | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|
| Maiden | 256 | -0.4 [-1.2; 0.0] | 0.4 [-1.2; 2.0] |
| Şartlı | 411 | -0.2 [-1.0; 0.5] | 0.4 [-1.0; 1.6] |
| Handikap | 352 | 0.9 [-0.6; 2.3] | 0.3 [-0.9; 1.4] |
| KV | 155 | 0.0 [-1.9; 2.6] | 0.6 [0.0; 1.9] |
| Grup | 48 | 0.0 [-6.3; 6.3] | 4.2 [-4.2; 12.5] |
| Satış | 35 | 0.0 [0.0; 0.0] | 2.9 [0.0; 8.6] |

## Sınırlar
- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. β'lar yalnız ölçü cihazıdır. Çoklu karşılaştırma düzeltilmedi; koşu tipi tabloları küçük örneklidir.
- P_öncü n=3'e dayanan kaba bir eğilimdir; veri yoksa önsel 0,5 kullanılır (bölüm 1'de sayıldı). Bu, B'yi bilgisiz atlarda bulanıklaştırır. τ önceki aşamadaki medyan |ΔV| tanımıdır ("önceden belirlenen ölçek" ifadesini böyle yorumladım; farklı bir sabit isteniyorsa belirtilmeli).
- Accurace kayıtlarının veritabanına giriş zamanı saklanmıyor; tarihler gerçek yarış tarihidir. Bu test seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.