# ACC_HIZ + GALOP_KAPASITE — aynı yarışlarda karşılaştırma (yalnız GALOP · yalnız ACC_HIZ · birlikte)
**Yeni motora sinyal eklenmedi; ağırlık/katsayı SEÇİLMEDİ; `SINYAL_KAYDI` boş.** ACC_BITIRIS bu testin dışında (karar: mevcut tanımıyla gereksiz görünüyor). Popülasyon: /admin/kosu-tipleri yarışları — **1510 yarış, 15487 at** (güncel motor dönemi, yayınlanmış tahminli, sonuçlu; Karma/koşullu kopyalar hariç). Gün/tarih kırılımı verilmedi.
Her puan yalnız yarış gününden ÖNCEKİ kayıtlarla (as-of): GALOP_KAPASITE atın son koşusundan sonraki galoplarından, ACC_HIZ atın geçmiş (aynı zemin) Accurace yarışlarından; ikisinin referansları da yarış gününden öncesiyle kurulu. Her iki modül ayrı ayrı gelecek-bozma testinden geçmiştir (galop: önceki raporlar; accurace: önceki raporlar). Puanlar sonuç yüklenmeden önce hesaplandı.

## Okuma kılavuzu
- **Ortak küme:** karşılaştırma adil olsun diye yalnız **iki puanı da olan atlar** sıralanır ve yalnız kazananın da iki puanı olduğu, ≥4 ortak atlı yarışlar sayılır; üç ölçüm de BİREBİR aynı yarış ve aynı atlar üzerinde. Rastgele = 1/n, 3/n. Eşit puanda isabet payı bölünür. **fark** = ölçüm − rastgele (puan); köşeli parantez = eşleştirilmiş bootstrap %95 (1000).
- **"Birlikte" (a):** iki puanın ortak kümedeki yarış-içi yüzdeliklerinin eşit ağırlıklı ortalaması. **Bu bir ağırlık seçimi değildir**; yalnız "ikisini aynı terazide tartarsak" örneğidir.

## 1. Kapsam
| Ölçü | At | Oran |
|---|---|---|
| GALOP_KAPASITE var | 12853 | 83.0% |
| ACC_HIZ var | 12878 | 83.2% |
| İkisi de var (ortak küme) | 10516 | 67.9% |
| Yalnız GALOP var | 2337 | 15.1% |
| Yalnız ACC_HIZ var | 2362 | 15.3% |
| İkisi de yok | 272 | 1.8% |

## 2. Aynı yarışlar, aynı atlar (ortak küme): Top1 / Top3
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 1062 | 17.9% (rast. 14.1%) · fark 3.8 puan [1.6; 6.0] | 49.1% (rast. 42.4%) · fark 6.7 puan [3.8; 9.4] |
| Yalnız ACC_HIZ | 1062 | 25.0% (rast. 14.1%) · fark 10.9 puan [8.4; 13.6] | 61.3% (rast. 42.4%) · fark 18.9 puan [15.9; 21.8] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 1062 | 24.6% (rast. 14.1%) · fark 10.5 puan [8.3; 13.1] | 60.0% (rast. 42.4%) · fark 17.5 puan [14.8; 20.1] |

**Eşleştirilmiş farklar** (aynı yarışlarda; puan; köşeli parantez bootstrap %95):
- ACC_HIZ − GALOP_KAPASITE: Top1 7.1 [3.8; 10.7] · Top3 12.2 [8.4; 15.9]
- Birlikte − yalnız ACC_HIZ: Top1 -0.4 [-3.1; 2.6] · Top3 -1.3 [-4.2; 1.5]
- Birlikte − yalnız GALOP_KAPASITE: Top1 6.7 [4.1; 9.3] · Top3 10.8 [8.1; 13.7]

## 3. Koşu tipine göre (ortak küme)
**Maiden** (203 yarış)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 203 | 17.6% (rast. 14.3%) · fark 3.2 puan [-1.6; 8.2] | 56.1% (rast. 43.0%) · fark 13.1 puan [6.5; 19.9] |
| Yalnız ACC_HIZ | 203 | 30.5% (rast. 14.3%) · fark 16.2 puan [10.5; 22.6] | 71.4% (rast. 43.0%) · fark 28.5 puan [22.0; 34.5] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 203 | 28.2% (rast. 14.3%) · fark 13.8 puan [7.9; 19.5] | 68.8% (rast. 43.0%) · fark 25.8 puan [20.0; 31.8] |

**Şartlı** (304 yarış)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 304 | 20.2% (rast. 15.0%) · fark 5.2 puan [1.0; 9.3] | 50.2% (rast. 45.1%) · fark 5.2 puan [0.3; 10.0] |
| Yalnız ACC_HIZ | 304 | 25.3% (rast. 15.0%) · fark 10.3 puan [5.7; 15.2] | 66.1% (rast. 45.1%) · fark 21.1 puan [15.9; 26.1] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 304 | 24.1% (rast. 15.0%) · fark 9.1 puan [4.6; 13.6] | 61.7% (rast. 45.1%) · fark 16.6 puan [11.9; 21.9] |

**Handikap** (328 yarış)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 328 | 13.0% (rast. 12.5%) · fark 0.6 puan [-2.8; 4.2] | 40.7% (rast. 37.4%) · fark 3.4 puan [-1.4; 8.6] |
| Yalnız ACC_HIZ | 328 | 22.9% (rast. 12.5%) · fark 10.4 puan [6.0; 14.9] | 52.1% (rast. 37.4%) · fark 14.8 puan [9.9; 20.0] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 328 | 22.3% (rast. 12.5%) · fark 9.9 puan [5.8; 14.1] | 53.6% (rast. 37.4%) · fark 16.3 puan [11.6; 21.5] |

**KV** (152 yarış)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 152 | 25.9% (rast. 16.3%) · fark 9.6 puan [3.1; 16.2] | 58.7% (rast. 49.0%) · fark 9.8 puan [2.5; 17.1] |
| Yalnız ACC_HIZ | 152 | 23.0% (rast. 16.3%) · fark 6.7 puan [-0.1; 13.1] | 60.5% (rast. 49.0%) · fark 11.6 puan [4.3; 19.6] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 152 | 28.2% (rast. 16.3%) · fark 11.9 puan [5.1; 19.0] | 62.4% (rast. 49.0%) · fark 13.5 puan [6.1; 20.4] |

**Grup** (49 yarış)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 49 | 16.3% (rast. 12.4%) · fark 4.0 puan [-4.7; 14.3] | 44.9% (rast. 37.1%) · fark 7.8 puan [-6.6; 22.4] |
| Yalnız ACC_HIZ | 49 | 22.4% (rast. 12.4%) · fark 10.1 puan [-2.0; 22.2] | 51.0% (rast. 37.1%) · fark 14.0 puan [1.4; 27.4] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 49 | 23.5% (rast. 12.4%) · fark 11.1 puan [0.5; 22.7] | 55.3% (rast. 37.1%) · fark 18.2 puan [6.4; 31.3] |

**Satış** (25 yarış — AZ ÖRNEK)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 25 | 12.0% (rast. 14.2%) · fark -2.2 puan [-13.0; 10.6] | 37.3% (rast. 42.5%) · fark -5.2 puan [-21.8; 12.6] |
| Yalnız ACC_HIZ | 25 | 20.0% (rast. 14.2%) · fark 5.8 puan [-9.3; 22.8] | 64.0% (rast. 42.5%) · fark 21.5 puan [2.2; 37.9] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 25 | 13.0% (rast. 14.2%) · fark -1.2 puan [-10.8; 10.9] | 43.0% (rast. 42.5%) · fark 0.5 puan [-16.3; 18.6] |

## 4. Irka göre (ortak küme)
**İngiliz** (605 yarış)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 605 | 18.2% (rast. 14.8%) · fark 3.4 puan [0.6; 6.4] | 51.6% (rast. 44.5%) · fark 7.2 puan [3.3; 11.0] |
| Yalnız ACC_HIZ | 605 | 25.5% (rast. 14.8%) · fark 10.6 puan [7.2; 14.2] | 61.3% (rast. 44.5%) · fark 16.9 puan [13.1; 20.4] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 605 | 24.9% (rast. 14.8%) · fark 10.1 puan [6.8; 13.4] | 60.2% (rast. 44.5%) · fark 15.7 puan [12.1; 19.5] |

**Arap** (457 yarış)
| Ölçüm | Yarış | Top1 | Top3 |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 457 | 17.5% (rast. 13.2%) · fark 4.2 puan [1.1; 7.7] | 45.8% (rast. 39.7%) · fark 6.1 puan [1.9; 10.3] |
| Yalnız ACC_HIZ | 457 | 24.5% (rast. 13.2%) · fark 11.3 puan [7.4; 15.1] | 61.3% (rast. 39.7%) · fark 21.6 puan [17.4; 25.9] |
| İkisi birlikte (eşit ağırlıklı yüzdelik ortalaması — ÖRNEK, seçilmiş ağırlık değil) | 457 | 24.3% (rast. 13.2%) · fark 11.1 puan [7.6; 14.9] | 59.7% (rast. 39.7%) · fark 20.0 puan [15.8; 23.9] |

## 5. İki puan aynı atı mı gösteriyor? (ortak küme, en yüksek puanın tek at olduğu yarışlar)
- İkisi **aynı atı** 1. sıraya koyduğunda (148 yarış): bu atın kazanma oranı **%27.7**.
- **Farklı atları** koyduğunda (784 yarış): GALOP'un seçtiği kazandı **%15.9**, ACC_HIZ'ın seçtiği kazandı **%24.9**, ikisi de kazanamadı %59.2.
- Uyuşma oranı (tepe at aynı): %15.9.

## 6. Artımlı bilgi: ileri-bloklu 2-parametreli ölçü cihazı (tam saha)
Yarışlar tarihe göre 6 bloğa bölünür; blok k için β'lar YALNIZ blok 0..k−1'den öğrenilir (ridge 0.02); eksik puan yarışın puanlı atlarının ortalamasına (nötr) eşitlenir; yarışta <2 puanlı at varsa o puan o yarışta bilgisizdir. Bu bir model değil, **iki puanın birbirine yeni bilgi ekleyip eklemediğini** ölçen cihazdır. Taban 1/N.
1259 test yarışı.
| Ölçüm | Log-loss | Δ (taban − ölçüm) [%95] | β (blok 1…5) [GALOP / ACC] |
|---|---|---|---|
| Yalnız GALOP_KAPASITE | 2.2685 | 0.0210 [0.0089; 0.0328] | 1.50 ; 1.89 ; 1.68 ; 1.68 ; 1.59 |
| Yalnız ACC_HIZ | 2.1521 | 0.1374 [0.1087; 0.1655] | 3.66 ; 4.05 ; 3.90 ; 3.77 ; 3.67 |
| İkisi birlikte (2 parametre) | 2.1362 | 0.1533 [0.1244; 0.1862] | 1.46 / 3.67 ; 1.91 / 4.06 ; 1.65 / 3.90 ; 1.61 / 3.75 ; 1.48 / 3.63 |

- **ACC_HIZ'ın GALOP_KAPASITE'ye eklediği bilgi:** ΔLL (yalnız GALOP − birlikte) = **0.1323** [0.1026; 0.1621] (pozitif = ACC_HIZ eklenince iyileşme).
- **GALOP_KAPASITE'nin ACC_HIZ'a eklediği bilgi:** ΔLL (yalnız ACC_HIZ − birlikte) = **0.0159** [0.0046; 0.0271].
- **Korelasyon** (iki puanı da olan atlar, 10275 at-yarış): Pearson 0.04, Spearman 0.04; **yarış-içi** (aynı yarışta ortalamadan sapma) Pearson **0.07**.

## Sınırlar
- Taban 1/N (sinyalsiz) ve zayıf; sonuçlar piyasa/AGF veya mevcut motorun diğer sinyalleriyle karşılaştırma değildir. "Birlikte" eşit ağırlıklı örnek ve ileri-bloklu cihazdır; ağırlık kararı sizindir.
- Galop verisi yalnız son koşudan sonrası; Accurace atın geçmiş aynı-zemin yarışlarının son 3'ü. İkisinin kapsamları farklıdır (bölüm 1); ortak küme her iki puanı olan atlarla sınırlıdır, bu yüzden genel popülasyona genellenmesi sınırlıdır.
- Accurace ve galop kaydının veritabanına ne zaman girdiği saklanmıyor; tarihler gerçek (yarış-öncesi) tarihlerdir, görünürlük kanıtlanamaz. Gruplar bağımsız değil; çoklu karşılaştırma düzeltilmedi.
- Bu test seçim yapmaz; hiçbir formül, ağırlık veya sinyal değiştirilmedi.