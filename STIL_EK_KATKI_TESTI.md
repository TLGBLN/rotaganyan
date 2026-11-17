# KOSU_STILI — (ACC_HIZ + GALOP_KAPASITE) modeline ek katkı (kronolojik)
**Yeni motora sinyal eklenmedi; ağırlık/katsayı SEÇİLMEDİ; `SINYAL_KAYDI` boş.** Üç aday: ACC_HIZ (genel hız), GALOP_KAPASITE (idman), KOSU_STILI (yarış içi konumlanma; S, N = TJK gerçek saha, 200/400/600 m).
Popülasyon: /admin/kosu-tipleri — **1510 yarış, 15487 at**; ileri-genişleyen 6 blok, **1259 test yarışı**. Her puan yarış gününden ÖNCEKİ kayıtlarla (as-of). KOSU_STILI bileşenleri için **gelecek-bozma testi** (8 gün, 1336 at): **GEÇTİ — birebir aynı, sızıntı yok** (ACC_HIZ ve GALOP_KAPASITE modülleri önceki raporlarda ayrı ayrı denetlendi). Puanlar sonuç yüklenmeden önce hesaplandı.

## Okuma kılavuzu
- **Karar kuralınız:** KOSU_STILI, **Top1/Top3'e taşımıyor VE log-loss katkısı doğrulanmıyorsa** ayrı sinyal olarak alınmaz. Asıl satır: **D2 − D1** (ACC_HIZ + GALOP_KAPASITE modeline KOSU_STILI eklenince).
- Ölçü cihazı: β'lar YALNIZ blok 0..k−1'den; eksik puan yarış ortalamasına (nötr); yön varsayımı yok. ΔLL = taban(1/N) − ölçüm; **ek katkı** = (taban modelin log-loss'u − eklenmiş modelin log-loss'u), pozitif = KOSU_STILI eklenince iyileşme; Top1/Top3 farkları puan. Köşeli parantez = eşleştirilmiş bootstrap %95 (1000). Girdi ölçekleri: ACC_HIZ/100, GALOP_KAPASITE (0–1), KOSU_STILI (0–1).

## 1. Kapsam
| Ölçü | At | Oran |
|---|---|---|
| ACC_HIZ var | 12878 | 83.2% |
| GALOP_KAPASITE var | 12853 | 83.0% |
| KOSU_STILI var | 14526 | 93.8% |
| Üçü de var | 10502 | 67.8% |
| Hiçbiri yok | 43 | 0.3% |

## 2. Ayrı ayrı ve birlikte (ölçü cihazı, tam saha)
| Ölçüm | Log-loss | ΔLL (taban−ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|
| A. Yalnız ACC_HIZ | 2.1521 | 0.1374 [0.1090; 0.1655] | 20.3% (10.7%) | 51.4% (32.0%) | 3.66 ; 4.05 ; 3.90 ; 3.77 ; 3.67 |
| B. Yalnız GALOP_KAPASITE | 2.2685 | 0.0210 [0.0093; 0.0324] | 15.3% (10.7%) | 38.9% (32.0%) | 1.50 ; 1.89 ; 1.68 ; 1.68 ; 1.59 |
| C. Yalnız KOSU_STILI | 2.2694 | 0.0201 [0.0084; 0.0325] | 13.9% (10.7%) | 38.8% (32.0%) | 1.08 ; 0.85 ; 0.86 ; 0.91 ; 0.86 |
| D1. ACC_HIZ + GALOP_KAPASITE (taban model) | 2.1362 | 0.1533 [0.1237; 0.1856] | 21.2% (10.7%) | 52.4% (32.0%) | 3.67/1.46 ; 4.06/1.91 ; 3.90/1.65 ; 3.75/1.61 ; 3.63/1.48 |
| D2. ACC_HIZ + GALOP_KAPASITE + KOSU_STILI | 2.1275 | 0.1621 [0.1296; 0.1953] | 21.8% (10.7%) | 53.6% (32.0%) | 3.57/1.47/0.94 ; 3.96/1.89/0.59 ; 3.79/1.64/0.60 ; 3.64/1.59/0.66 ; 3.54/1.46/0.62 |
| E. ACC_HIZ + KOSU_STILI (referans) | 2.1430 | 0.1465 [0.1158; 0.1770] | 20.0% (10.7%) | 51.8% (32.0%) | 3.56/0.94 ; 3.95/0.61 ; 3.79/0.61 ; 3.66/0.68 ; 3.56/0.64 |

## 3. KOSU_STILI'nın ek katkısı
| Karşılaştırma | Yarış | ΔLL ek katkı [%95] | Top1 farkı (puan) [%95] | Top3 farkı (puan) [%95] |
|---|---|---|---|---|
| **KOSU_STILI → ACC_HIZ + GALOP_KAPASITE (D2 − D1) — KARAR SATIRI** | 1259 | **0.0087 [-0.0002; 0.0171]** | **0.60 [-0.83; 2.03]** | **1.28 [-0.30; 2.97]** |
| KOSU_STILI → yalnız ACC_HIZ (E − A; önceki test) | 1259 | 0.0091 [-0.0003; 0.0182] | -0.26 [-1.85; 1.33] | 0.43 [-1.27; 2.24] |
| GALOP_KAPASITE → ACC_HIZ + KOSU_STILI (D2 − E) | 1259 | 0.0155 [0.0039; 0.0269] | 1.71 [-0.08; 3.50] | 1.82 [-0.26; 3.78] |

## 4. Sağlamlık: saha atlarının ≥%70'inde üç puan da olan yarışlar
Eksik veri nötr doldurulduğu için, üç puanı da yaygın olan yarışlara ayrıca bakıldı (694 test yarışı). **D2 − D1:** ΔLL 0.0015 [-0.0105; 0.0140] · Top1 1.01 [-0.86; 3.03] · Top3 1.30 [-0.86; 3.46].

## 5. Koşu tipine göre (D2 − D1)
| Koşu tipi | Test yarışı | ΔLL ek katkı [%95] | Top1 farkı (puan) [%95] | Top3 farkı (puan) [%95] |
|---|---|---|---|---|
| Maiden | 256 | 0.0207 [0.0007; 0.0399] | 2.34 [-0.39; 5.47] | 3.78 [0.00; 7.68] |
| Şartlı | 411 | -0.0041 [-0.0176; 0.0099] | 0.85 [-1.46; 3.28] | -0.36 [-2.80; 2.31] |
| Handikap | 352 | 0.0150 [-0.0008; 0.0300] | -0.28 [-2.84; 2.27] | 0.57 [-2.56; 3.69] |
| KV | 155 | -0.0031 [-0.0312; 0.0240] | -1.94 [-7.10; 3.23] | 0.65 [-4.52; 7.10] |
| Grup | 48 | 0.0033 [-0.0389; 0.0451] | 0.00 [-8.33; 8.33] | 4.17 [-8.33; 14.58] |
| Satış | 35 | 0.0820 [0.0312; 0.1289] | 5.71 [0.00; 14.29] | 8.57 [0.00; 17.14] |

## 6. Bilgi tekrarı (aynı yarışta ortalamadan sapma ile; iki puanı da olan atlar)
| Çift | Pearson / Spearman / yarış-içi |
|---|---|
| KOSU_STILI ↔ ACC_HIZ | 0.15 / 0.13 / **0.12** (n 12786) |
| KOSU_STILI ↔ GALOP_KAPASITE | 0.03 / 0.02 / **0.03** (n 11864) |
| ACC_HIZ ↔ GALOP_KAPASITE | 0.04 / 0.04 / **0.07** (n 10275) |

## Sınırlar
- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya mevcut motorun diğer sinyalleriyle kıyas değildir. β'lar yalnız ölçü cihazıdır. Çoklu karşılaştırma düzeltilmedi; koşu tipi tabloları küçük örneklidir. Eksik puan yarış ortalamasıyla nötrdür.
- KOSU_STILI atın SON 3 yarışındaki S ortalamasıdır (veri yoksa bilinmiyor). Accurace/galop kaydının veritabanına giriş zamanı saklanmıyor; tarihler gerçek (yarış öncesi) tarihlerdir. Bu test seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.