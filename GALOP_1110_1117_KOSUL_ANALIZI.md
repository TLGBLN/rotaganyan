# GALOP_KAPASITE — 10.11–17.11.2026 tüm koşular (Karma hariç), koşul analizi
**Yeni formül, katsayı, sinyal veya ağırlık YOK.** Yalnız mevcut `GALOP_KAPASITE` (galop-aday.ts değişmedi; `SINYAL_KAYDI` boş). Kapsam: **140 koşu, 1398 at**, 8 yarış günü (10.11, 11.11, 12.11, 13.11, 14.11, 15.11, 16.11, 17.11), sonuçlanmış, Karma hariç. Arşiv/öğrenme yok.

**Referans tarihi:** her koşunun galop referansı (grup ortalaması/sapması, kapanış regresyonu, efor dağılımı) ve atın galopları o koşunun KENDİ gününden ÖNCEKİ (tarih < t) kayıtlardan kurulur; atın galopları ayrıca son koşusundan sonrasıyla sınırlıdır. Gelecek-bozma testi (her gün için t ve sonrası bozuldu): 1398 at, **GEÇTİ — sızıntı yok**. Puanlar sonuç yüklemesinden önce hesaplandı; sonuç hesaba girmez.

## Okuma kılavuzu
- **Top1** = KAPASİTE puanı en yüksek atın kazanması; **Top3** = kazananın puana göre ilk 3'te olması. **Değerlendirilebilir**: yalnız galoplu atlar sıralanır; kazananın galopu da olmalı ve galoplu en az 4 at bulunmalı (aksi halde o koşu sayılmaz); rastgele = 1/n, 3/n. Eşit puanda isabet payı bölünür.
- **fark (puan)** = aday − rastgele; köşeli parantez = eşleştirilmiş bootstrap %95 aralığı (1000). Aralık 0'ı içeriyorsa gürültüden ayırt edilemez. **Tam saha**: galopsuz atlar nötr, kazananı galopsuz koşular da sayılır.
- **At kapsamı** = sahadaki atların KAPASİTE'si hesaplanabilen payı. **Üst puan eşitliği** = en yüksek puanın ≥2 atta eşit çıktığı koşu payı.
- Çok sayıda grup var: **çoklu karşılaştırma düzeltilmedi**; n<30 işaretli. Bir grubun iyi/kötü görünmesi tek başına kanıt değildir.

## 1. Gün gün özet
| Gün | Koşu | Değerlendirilebilir | At kapsamı | Top1 (rastgele) | Top3 (rastgele) | Tam saha Top1 / Top3 (rastgele) |
|---|---|---|---|---|---|---|
| 10.11 (Adana, Kocaeli) | 18 | 16 | 81% | 25.0% (12.8%) | 62.5% (38.3%) | 22.2% / 55.6% (10.8% / 32.4%) |
| 11.11 (Elazığ, İstanbul) | 17 | 12 | 74% | 25.0% (15.3%) | 58.3% (46.0%) | 23.5% / 49.0% (13.2% / 39.6%) |
| 12.11 (Ankara, İzmir) | 18 | 15 | 77% | 23.3% (15.9%) | 58.9% (47.6%) | 19.4% / 48.1% (11.9% / 35.7%) |
| 13.11 (Bursa, İstanbul) | 16 | 15 | 86% | 22.2% (13.3%) | 53.3% (39.8%) | 20.8% / 50.0% (11.5% / 34.6%) |
| 14.11 (Ankara, Diyarbakır, İzmir) | 23 | 19 | 75% | 21.1% (14.1%) | 42.1% (42.2%) | 17.4% / 33.7% (10.7% / 32.1%) |
| 15.11 (Adana, İstanbul) | 17 | 16 | 87% | 15.6% (12.4%) | 53.1% (37.1%) | 14.7% / 50.0% (10.8% / 32.4%) |
| 16.11 (Bursa, Şanlıurfa) | 15 | 14 | 84% | 7.1% (9.8%) | 48.8% (29.3%) | 6.7% / 45.6% (8.6% / 25.8%) |
| 17.11 (Adana, Antalya) | 16 | 14 | 83% | 50.0% (13.4%) | 75.0% (40.3%) | 43.8% / 64.6% (10.6% / 31.9%) |

## 2. Toplam
| Grup | Koşu | Değerlendirilebilir koşu | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|---|
| Tüm koşular | 140 | 121 | 81% | 23.4% (rast. 13.3%) · fark 10.1 puan [3.0; 17.7] | 55.9% (rast. 40.0%) · fark 15.9 puan [7.3; 24.1] | 9% | 21.0% / 48.9% (rast. 11.0% / 33.1%) |  |

## 3. Irk
| Grup | Koşu | Değerlendirilebilir koşu | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|---|
| İngiliz | 81 | 72 | 86% | 24.1% (rast. 14.0%) · fark 10.1 puan [0.6; 19.5] | 58.6% (rast. 41.9%) · fark 16.7 puan [5.7; 27.1] | 10% | 22.6% / 52.2% (rast. 12.3% / 36.9%) |  |
| Arap | 59 | 49 | 75% | 22.4% (rast. 12.4%) · fark 10.0 puan [-0.3; 21.8] | 52.0% (rast. 37.3%) · fark 14.8 puan [2.3; 27.3] | 8% | 18.6% / 44.4% (rast. 9.3% / 28.0%) |  |

## 4. Koşu tipi
| Grup | Koşu | Değerlendirilebilir koşu | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|---|
| Maiden | 33 | 31 | 84% | 25.8% (rast. 11.7%) · fark 14.1 puan [0.1; 28.9] | 59.7% (rast. 35.0%) · fark 24.6 puan [8.5; 41.4] | 13% | 24.2% / 55.1% (rast. 10.0% / 29.9%) |  |
| Şartlı | 44 | 38 | 79% | 24.6% (rast. 14.6%) · fark 10.0 puan [-1.4; 23.4] | 62.7% (rast. 43.7%) · fark 19.0 puan [5.2; 32.6] | 13% | 21.2% / 54.9% (rast. 11.4% / 34.2%) |  |
| Handikap | 38 | 30 | 79% | 26.7% (rast. 12.0%) · fark 14.7 puan [-1.1; 30.1] | 45.0% (rast. 36.0%) · fark 9.0 puan [-6.7; 26.5] | 3% | 23.7% / 38.4% (rast. 10.4% / 31.2%) |  |
| KV | 16 | 14 | 79% | 14.3% (rast. 15.9%) · fark -1.6 puan [-15.9; 18.8] | 52.4% (rast. 47.6%) · fark 4.8 puan [-23.7; 32.3] | 0% | 12.5% / 43.8% (rast. 13.1% / 39.3%) | AZ ÖRNEK (n<30) |
| Grup | 5 | 5 | 98% | 20.0% (rast. 12.6%) · fark 7.4 puan [-13.9; 47.0] | 70.0% (rast. 37.8%) · fark 32.2 puan [-2.9; 59.3] | 20% | 20.0% / 70.0% (rast. 12.3% / 36.8%) | AZ ÖRNEK (n<30) |
| Satış | 4 | 3 | 73% | 0.0% (rast. 17.8%) · fark -17.8 puan [—] | 33.3% (rast. 53.3%) · fark -20.0 puan [—] | 0% | 0.0% / 25.0% (rast. 12.1% / 36.4%) | AZ ÖRNEK (n<30) |

## 5. Yarış pisti (koşunun yüzeyi; galop pisti DEĞİL)
| Grup | Koşu | Değerlendirilebilir koşu | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|---|
| Kum | 80 | 65 | 81% | 23.1% (rast. 13.3%) · fark 9.8 puan [0.6; 20.2] | 54.9% (rast. 39.8%) · fark 15.1 puan [3.8; 26.9] | 9% | 20.0% / 44.9% (rast. 11.1% / 33.2%) |  |
| Çim | 30 | 28 | 82% | 15.5% (rast. 13.5%) · fark 2.0 puan [-8.8; 15.3] | 60.7% (rast. 40.5%) · fark 20.2 puan [2.1; 36.7] | 11% | 14.4% / 58.3% (rast. 11.2% / 33.7%) |  |
| Sentetik | 30 | 28 | 79% | 32.1% (rast. 13.4%) · fark 18.8 puan [1.3; 35.4] | 53.6% (rast. 40.1%) · fark 13.4 puan [-4.2; 31.3] | 7% | 30.0% / 50.0% (rast. 10.8% / 32.3%) |  |

## 6. Hipodrom
| Grup | Koşu | Değerlendirilebilir koşu | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|---|
| Adana | 25 | 23 | 81% | 32.6% (rast. 12.7%) · fark 19.9 puan [0.8; 39.5] | 65.2% (rast. 38.1%) · fark 27.1 puan [6.7; 44.6] | 9% | 30.0% / 60.0% (rast. 10.0% / 30.0%) | AZ ÖRNEK (n<30) |
| Ankara | 19 | 16 | 75% | 25.0% (rast. 15.9%) · fark 9.1 puan [-9.8; 32.7] | 65.6% (rast. 47.8%) · fark 17.9 puan [-2.8; 36.8] | 13% | 21.1% / 53.9% (rast. 11.8% / 35.5%) | AZ ÖRNEK (n<30) |
| Antalya | 8 | 7 | 84% | 57.1% (rast. 13.9%) · fark 43.2 puan [1.1; 74.6] | 78.6% (rast. 41.8%) · fark 36.8 puan [5.4; 63.6] | 14% | 50.0% / 66.7% (rast. 11.5% / 34.6%) | AZ ÖRNEK (n<30) |
| Bursa | 14 | 14 | 90% | 25.0% (rast. 11.4%) · fark 13.6 puan [-4.7; 37.7] | 39.3% (rast. 34.1%) · fark 5.2 puan [-17.5; 33.3] | 7% | 25.0% / 39.3% (rast. 10.3% / 31.0%) | AZ ÖRNEK (n<30) |
| Diyarbakır | 6 | 4 | 77% | 25.0% (rast. 11.9%) · fark 13.1 puan [—] | 50.0% (rast. 35.7%) · fark 14.3 puan [—] | 0% | 16.7% / 33.3% (rast. 9.7% / 29.0%) | AZ ÖRNEK (n<30) |
| Elazığ | 8 | 4 | 70% | 25.0% (rast. 15.7%) · fark 9.3 puan [—] | 100.0% (rast. 47.0%) · fark 53.0 puan [—] | 0% | 25.0% / 66.7% (rast. 13.7% / 41.2%) | AZ ÖRNEK (n<30) |
| İstanbul | 27 | 25 | 84% | 9.3% (rast. 13.7%) · fark -4.4 puan [-13.1; 6.9] | 50.0% (rast. 41.2%) · fark 8.8 puan [-9.1; 27.1] | 8% | 8.6% / 46.3% (rast. 11.9% / 35.7%) | AZ ÖRNEK (n<30) |
| İzmir | 16 | 14 | 77% | 17.9% (rast. 14.5%) · fark 3.4 puan [-13.8; 24.9] | 31.0% (rast. 43.5%) · fark -12.5 puan [-33.6; 12.6] | 14% | 15.6% / 26.0% (rast. 11.1% / 33.3%) | AZ ÖRNEK (n<30) |
| Kocaeli | 9 | 7 | 85% | 28.6% (rast. 13.6%) · fark 15.0 puan [-12.2; 54.1] | 57.1% (rast. 40.7%) · fark 16.4 puan [-21.1; 47.8] | 0% | 22.2% / 44.4% (rast. 12.3% / 37.0%) | AZ ÖRNEK (n<30) |
| Şanlıurfa | 8 | 7 | 78% | 7.1% (rast. 8.5%) · fark -1.3 puan [-9.2; 13.3] | 61.9% (rast. 25.5%) · fark 36.4 puan [4.9; 65.8] | 14% | 6.3% / 54.2% (rast. 7.1% / 21.4%) | AZ ÖRNEK (n<30) |

## 7–8. At düzeyi koşullar
At düzeyi gruplar koşuyu bölmez. KAPASİTE'nin tüm sahadaki sıralamasında o gruptan bir at **1. sırada (Top1 seçimi)** veya **ilk 3'te (Top3 seçimi)** çıktığında kazanma oranına bakılır. *Beklenen* = o koşuda galoplu atlar arasından rastgele seçilen atın kazanma olasılığı (kazananı galopsuz koşular beklenende de 0). **oran** = kazanan / beklenen (1,00 = rastgele); köşeli parantez bootstrap %95. Seçim sayıları eşit puanda kesirlidir.
### 7. Son koşudan sonraki galop sayısı
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| tek galop | 558 | 100% | 76.7 | 16.5 (21.5%) | 12.2% | **1.77** [1.08; 2.46] | 222.9 | 36.5 (16.4%) | 11.9% | **1.38** [1.07; 1.69] | 7% |  |
| 2–3 galop | 375 | 100% | 38.7 | 7.3 (19.0%) | 11.8% | **1.61** [0.65; 2.66] | 127.3 | 21.5 (16.9%) | 11.8% | **1.43** [0.96; 1.99] | 15% |  |
| 4+ galop | 193 | 100% | 24.7 | 5.5 (22.3%) | 11.9% | **1.87** [0.51; 3.53] | 68.8 | 11.7 (16.9%) | 12.9% | **1.31** [0.74; 1.90] | 7% | AZ ÖRNEK (Top1 seçimi<30) |
| galop yok | 272 | 0% | 0.0 | 0.0 (0.0%) | 0.0% | **0.00** [—; —] | 0.0 | 0.0 (0.0%) | 0.0% | **0.00** [—; —] | 0% | AZ ÖRNEK (Top1 seçimi<30) |

### 8. Önceki koşudan beri geçen gün
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| yakın (≤35 gün) | 1211 | 79% | 122.7 | 25.8 (21.1%) | 12.0% | **1.76** [1.21; 2.34] | 368.3 | 59.8 (16.2%) | 11.9% | **1.36** [1.13; 1.59] | 10% |  |
| orta (36–60 gün) | 92 | 90% | 9.0 | 2.5 (27.8%) | 15.1% | **1.84** [0.00; 4.30] | 26.8 | 7.5 (28.0%) | 13.4% | **2.08** [0.95; 3.29] | 11% | AZ ÖRNEK (Top1 seçimi<30) |
| uzun aradan (>60 gün) | 78 | 91% | 8.3 | 1.0 (12.0%) | 9.0% | **1.33** [0.00; 4.33] | 21.3 | 2.3 (10.9%) | 12.3% | **0.89** [0.00; 1.97] | 4% | AZ ÖRNEK (Top1 seçimi<30) |
| önceki koşu yok | 17 | 94% | 0.0 | 0.0 (0.0%) | 0.0% | **0.00** [—; —] | 2.5 | 0.0 (0.0%) | 10.8% | **0.00** [0.00; 0.00] | 0% | AZ ÖRNEK (Top1 seçimi<30) |

## 9. HER KOŞU AYRI AYRI
### 9a. Koşulları ve galop kapsamı
Galop sayısı: tek / 2–3 / 4+ / yok (at). Aradan: yakın / orta / uzun / önceki koşu yok (at).
| Koşu | Mesafe | Irk | Tip | Yüzey | At | KAPASİTE hesaplanan (kapsam) | Galop sayısı | Aradan |
|---|---|---|---|---|---|---|---|---|
| 10.11 Adana K1 | 1200 m | İngiliz | Handikap | Sentetik | 9 | 8 (89%) | 3 / 5 / 0 / 1 | 8 / 1 / 0 / 0 |
| 10.11 Adana K2 | 1500 m | Arap | Maiden | Sentetik | 14 | 11 (79%) | 6 / 4 / 1 / 3 | 13 / 1 / 0 / 0 |
| 10.11 Adana K3 | 1500 m | İngiliz | Şartlı | Sentetik | 6 | 5 (83%) | 0 / 4 / 1 / 1 | 5 / 0 / 1 / 0 |
| 10.11 Adana K4 | 1900 m | Arap | Şartlı | Sentetik | 12 | 10 (83%) | 7 / 3 / 0 / 2 | 12 / 0 / 0 / 0 |
| 10.11 Adana K5 | 1900 m | Arap | Satış | Sentetik | 18 | 12 (67%) | 3 / 6 / 3 / 6 | 14 / 3 / 1 / 0 |
| 10.11 Adana K6 | 1500 m | Arap | Maiden | Sentetik | 14 | 12 (86%) | 4 / 6 / 2 / 2 | 11 / 0 / 2 / 1 |
| 10.11 Adana K7 | 1500 m | İngiliz | KV | Sentetik | 10 | 8 (80%) | 4 / 4 / 0 / 2 | 10 / 0 / 0 / 0 |
| 10.11 Adana K8 | 1400 m | Arap | Şartlı | Sentetik | 10 | 5 (50%) | 4 / 1 / 0 / 5 | 8 / 1 / 1 / 0 |
| 10.11 Adana K9 | 1500 m | Arap | Maiden | Sentetik | 14 | 12 (86%) | 11 / 1 / 0 / 2 | 13 / 0 / 0 / 1 |
| 10.11 Kocaeli K1 | 1800 m | Arap | Handikap | Kum | 9 | 6 (67%) | 5 / 1 / 0 / 3 | 9 / 0 / 0 / 0 |
| 10.11 Kocaeli K2 | 1400 m | Arap | Maiden | Kum | 10 | 10 (100%) | 6 / 4 / 0 / 0 | 8 / 1 / 0 / 1 |
| 10.11 Kocaeli K3 | 2000 m | İngiliz | Şartlı | Kum | 5 | 5 (100%) | 1 / 1 / 3 / 0 | 2 / 0 / 3 / 0 |
| 10.11 Kocaeli K4 | 1400 m | Arap | Handikap | Kum | 11 | 11 (100%) | 4 / 5 / 2 / 0 | 7 / 3 / 1 / 0 |
| 10.11 Kocaeli K5 | 1900 m | İngiliz | Şartlı | Kum | 12 | 8 (67%) | 5 / 2 / 1 / 4 | 10 / 1 / 0 / 1 |
| 10.11 Kocaeli K6 | 1500 m | Arap | KV | Kum | 6 | 6 (100%) | 3 / 2 / 1 / 0 | 6 / 0 / 0 / 0 |
| 10.11 Kocaeli K7 | 1400 m | İngiliz | Şartlı | Kum | 8 | 7 (88%) | 4 / 2 / 1 / 1 | 8 / 0 / 0 / 0 |
| 10.11 Kocaeli K8 | 1800 m | İngiliz | Handikap | Kum | 7 | 6 (86%) | 2 / 3 / 1 / 1 | 6 / 1 / 0 / 0 |
| 10.11 Kocaeli K9 | 1400 m | Arap | Maiden | Kum | 11 | 8 (73%) | 7 / 1 / 0 / 3 | 11 / 0 / 0 / 0 |
| 11.11 Elazığ K1 | 1500 m | Arap | Şartlı | Kum | 8 | 5 (63%) | 1 / 4 / 0 / 3 | 8 / 0 / 0 / 0 |
| 11.11 Elazığ K2 | 1600 m | İngiliz | Maiden | Kum | 7 | 5 (71%) | 2 / 2 / 1 / 2 | 4 / 2 / 1 / 0 |
| 11.11 Elazığ K3 | 2000 m | İngiliz | Handikap | Kum | 9 | 7 (78%) | 6 / 1 / 0 / 2 | 8 / 1 / 0 / 0 |
| 11.11 Elazığ K4 | 1800 m | Arap | Handikap | Kum | 13 | 9 (69%) | 6 / 3 / 0 / 4 | 12 / 1 / 0 / 0 |
| 11.11 Elazığ K5 | 1600 m | İngiliz | Maiden | Kum | 5 | 3 (60%) | 3 / 0 / 0 / 2 | 4 / 0 / 1 / 0 |
| 11.11 Elazığ K6 | 1200 m | Arap | Handikap | Kum | 5 | 2 (40%) | 2 / 0 / 0 / 3 | 5 / 0 / 0 / 0 |
| 11.11 Elazığ K7 | 1500 m | İngiliz | Handikap | Kum | 6 | 3 (50%) | 3 / 0 / 0 / 3 | 5 / 1 / 0 / 0 |
| 11.11 Elazığ K8 | 1600 m | İngiliz | Şartlı | Kum | 13 | 12 (92%) | 9 / 2 / 1 / 1 | 10 / 1 / 1 / 1 |
| 11.11 İstanbul K1 | 1500 m | Arap | Handikap | Sentetik | 9 | 9 (100%) | 7 / 2 / 0 / 0 | 9 / 0 / 0 / 0 |
| 11.11 İstanbul K2 | 1400 m | İngiliz | Şartlı | Sentetik | 8 | 6 (75%) | 6 / 0 / 0 / 2 | 8 / 0 / 0 / 0 |
| 11.11 İstanbul K3 | 1500 m | İngiliz | Handikap | Sentetik | 6 | 4 (67%) | 1 / 2 / 1 / 2 | 6 / 0 / 0 / 0 |
| 11.11 İstanbul K4 | 1500 m | Arap | Maiden | Sentetik | 12 | 11 (92%) | 7 / 3 / 1 / 1 | 10 / 0 / 2 / 0 |
| 11.11 İstanbul K5 | 2100 m | İngiliz | Şartlı | Sentetik | 5 | 4 (80%) | 2 / 2 / 0 / 1 | 5 / 0 / 0 / 0 |
| 11.11 İstanbul K6 | 2000 m | Arap | KV | Sentetik | 8 | 5 (63%) | 3 / 2 / 0 / 3 | 7 / 1 / 0 / 0 |
| 11.11 İstanbul K7 | 1400 m | İngiliz | KV | Sentetik | 5 | 5 (100%) | 2 / 1 / 2 / 0 | 5 / 0 / 0 / 0 |
| 11.11 İstanbul K8 | 1500 m | Arap | Maiden | Sentetik | 13 | 12 (92%) | 7 / 4 / 1 / 1 | 11 / 0 / 1 / 1 |
| 11.11 İstanbul K9 | 1500 m | Arap | Handikap | Sentetik | 18 | 9 (50%) | 4 / 3 / 2 / 9 | 18 / 0 / 0 / 0 |
| 12.11 Ankara K1 | 1600 m | İngiliz | Maiden | Çim | 9 | 7 (78%) | 2 / 4 / 1 / 2 | 7 / 0 / 1 / 1 |
| 12.11 Ankara K2 | 2000 m | Arap | Şartlı | Kum | 7 | 5 (71%) | 3 / 2 / 0 / 2 | 6 / 0 / 1 / 0 |
| 12.11 Ankara K3 | 2200 m | İngiliz | Şartlı | Çim | 6 | 5 (83%) | 3 / 2 / 0 / 1 | 6 / 0 / 0 / 0 |
| 12.11 Ankara K4 | 1600 m | İngiliz | Maiden | Çim | 10 | 9 (90%) | 3 / 6 / 0 / 1 | 10 / 0 / 0 / 0 |
| 12.11 Ankara K5 | 1400 m | Arap | Handikap | Kum | 12 | 8 (67%) | 7 / 0 / 1 / 4 | 10 / 0 / 2 / 0 |
| 12.11 Ankara K6 | 1400 m | Arap | KV | Çim | 12 | 8 (67%) | 2 / 4 / 2 / 4 | 10 / 1 / 1 / 0 |
| 12.11 Ankara K7 | 1600 m | İngiliz | Maiden | Çim | 10 | 10 (100%) | 4 / 3 / 3 / 0 | 10 / 0 / 0 / 0 |
| 12.11 Ankara K8 | 1600 m | İngiliz | Şartlı | Çim | 9 | 8 (89%) | 0 / 5 / 3 / 1 | 9 / 0 / 0 / 0 |
| 12.11 Ankara K9 | 1200 m | İngiliz | KV | Çim | 8 | 7 (88%) | 2 / 4 / 1 / 1 | 8 / 0 / 0 / 0 |
| 12.11 Ankara K10 | 1600 m | Arap | Handikap | Çim | 13 | 11 (85%) | 9 / 1 / 1 / 2 | 11 / 2 / 0 / 0 |
| 12.11 İzmir K1 | 1600 m | Arap | Maiden | Kum | 10 | 6 (60%) | 5 / 1 / 0 / 4 | 10 / 0 / 0 / 0 |
| 12.11 İzmir K2 | 1600 m | İngiliz | Satış | Kum | 6 | 5 (83%) | 2 / 3 / 0 / 1 | 6 / 0 / 0 / 0 |
| 12.11 İzmir K3 | 1600 m | Arap | Şartlı | Kum | 8 | 4 (50%) | 3 / 1 / 0 / 4 | 8 / 0 / 0 / 0 |
| 12.11 İzmir K4 | 1900 m | İngiliz | Handikap | Kum | 12 | 6 (50%) | 3 / 2 / 1 / 6 | 12 / 0 / 0 / 0 |
| 12.11 İzmir K5 | 1400 m | İngiliz | KV | Kum | 6 | 5 (83%) | 0 / 4 / 1 / 1 | 5 / 1 / 0 / 0 |
| 12.11 İzmir K6 | 1900 m | Arap | Şartlı | Kum | 7 | 5 (71%) | 3 / 1 / 1 / 2 | 6 / 0 / 1 / 0 |
| 12.11 İzmir K7 | 1400 m | İngiliz | KV | Kum | 6 | 5 (83%) | 1 / 1 / 3 / 1 | 6 / 0 / 0 / 0 |
| 12.11 İzmir K8 | 1200 m | İngiliz | Şartlı | Kum | 11 | 11 (100%) | 2 / 3 / 6 / 0 | 4 / 2 / 5 / 0 |
| 13.11 Bursa K1 | 1400 m | İngiliz | Şartlı | Kum | 9 | 9 (100%) | 5 / 1 / 3 / 0 | 5 / 1 / 3 / 0 |
| 13.11 Bursa K2 | 1400 m | Arap | KV | Kum | 11 | 8 (73%) | 5 / 1 / 2 / 3 | 10 / 0 / 1 / 0 |
| 13.11 Bursa K3 | 1400 m | Arap | Handikap | Kum | 12 | 10 (83%) | 5 / 4 / 1 / 2 | 11 / 1 / 0 / 0 |
| 13.11 Bursa K4 | 1800 m | İngiliz | Handikap | Kum | 9 | 9 (100%) | 4 / 3 / 2 / 0 | 7 / 2 / 0 / 0 |
| 13.11 Bursa K5 | 1400 m | İngiliz | Grup | Kum | 7 | 7 (100%) | 4 / 1 / 2 / 0 | 6 / 1 / 0 / 0 |
| 13.11 Bursa K6 | 1400 m | İngiliz | Maiden | Kum | 9 | 8 (89%) | 2 / 5 / 1 / 1 | 8 / 1 / 0 / 0 |
| 13.11 Bursa K7 | 1400 m | Arap | Şartlı | Kum | 13 | 10 (77%) | 4 / 4 / 2 / 3 | 11 / 0 / 2 / 0 |
| 13.11 İstanbul K1 | 2200 m | Arap | Şartlı | Sentetik | 9 | 8 (89%) | 7 / 1 / 0 / 1 | 8 / 0 / 0 / 1 |
| 13.11 İstanbul K2 | 2100 m | İngiliz | Şartlı | Çim | 8 | 5 (63%) | 3 / 2 / 0 / 3 | 8 / 0 / 0 / 0 |
| 13.11 İstanbul K3 | 1300 m | İngiliz | Şartlı | Çim | 4 | 4 (100%) | 0 / 0 / 4 / 0 | 2 / 1 / 1 / 0 |
| 13.11 İstanbul K4 | 1300 m | İngiliz | Maiden | Çim | 11 | 11 (100%) | 4 / 3 / 4 / 0 | 8 / 2 / 1 / 0 |
| 13.11 İstanbul K5 | 2100 m | Arap | Handikap | Çim | 11 | 9 (82%) | 4 / 5 / 0 / 2 | 11 / 0 / 0 / 0 |
| 13.11 İstanbul K6 | 1500 m | İngiliz | Handikap | Çim | 9 | 7 (78%) | 2 / 4 / 1 / 2 | 8 / 1 / 0 / 0 |
| 13.11 İstanbul K7 | 1500 m | Arap | KV | Sentetik | 6 | 6 (100%) | 6 / 0 / 0 / 0 | 6 / 0 / 0 / 0 |
| 13.11 İstanbul K8 | 1300 m | İngiliz | Maiden | Çim | 11 | 10 (91%) | 3 / 5 / 2 / 1 | 9 / 1 / 1 / 0 |
| 13.11 İstanbul K9 | 1900 m | İngiliz | Handikap | Çim | 12 | 9 (75%) | 7 / 1 / 1 / 3 | 11 / 0 / 1 / 0 |
| 14.11 Ankara K1 | 1400 m | İngiliz | Şartlı | Çim | 7 | 4 (57%) | 1 / 1 / 2 / 3 | 4 / 1 / 2 / 0 |
| 14.11 Ankara K2 | 1600 m | Arap | Maiden | Çim | 10 | 4 (40%) | 3 / 1 / 0 / 6 | 10 / 0 / 0 / 0 |
| 14.11 Ankara K3 | 1500 m | İngiliz | Satış | Kum | 5 | 4 (80%) | 3 / 1 / 0 / 1 | 4 / 1 / 0 / 0 |
| 14.11 Ankara K4 | 2000 m | İngiliz | Handikap | Kum | 7 | 4 (57%) | 3 / 0 / 1 / 3 | 7 / 0 / 0 / 0 |
| 14.11 Ankara K5 | 1600 m | İngiliz | Handikap | Çim | 10 | 8 (80%) | 4 / 2 / 2 / 2 | 8 / 1 / 1 / 0 |
| 14.11 Ankara K6 | 1400 m | İngiliz | Grup | Çim | 8 | 8 (100%) | 0 / 5 / 3 / 0 | 7 / 1 / 0 / 0 |
| 14.11 Ankara K7 | 1900 m | İngiliz | Handikap | Çim | 6 | 6 (100%) | 3 / 1 / 2 / 0 | 4 / 1 / 1 / 0 |
| 14.11 Ankara K8 | 1600 m | Arap | Maiden | Çim | 10 | 7 (70%) | 3 / 3 / 1 / 3 | 8 / 0 / 1 / 1 |
| 14.11 Ankara K9 | 1600 m | Arap | Şartlı | Çim | 14 | 7 (50%) | 3 / 3 / 1 / 7 | 14 / 0 / 0 / 0 |
| 14.11 Diyarbakır K1 | 1200 m | İngiliz | Handikap | Kum | 8 | 8 (100%) | 6 / 0 / 2 / 0 | 8 / 0 / 0 / 0 |
| 14.11 Diyarbakır K2 | 1900 m | İngiliz | Şartlı | Kum | 12 | 7 (58%) | 2 / 4 / 1 / 5 | 10 / 0 / 2 / 0 |
| 14.11 Diyarbakır K3 | 2000 m | Arap | Şartlı | Kum | 12 | 6 (50%) | 5 / 0 / 1 / 6 | 10 / 2 / 0 / 0 |
| 14.11 Diyarbakır K4 | 1700 m | Arap | Handikap | Kum | 10 | 8 (80%) | 5 / 2 / 1 / 2 | 9 / 1 / 0 / 0 |
| 14.11 Diyarbakır K5 | 1200 m | İngiliz | Şartlı | Kum | 9 | 8 (89%) | 7 / 1 / 0 / 1 | 8 / 1 / 0 / 0 |
| 14.11 Diyarbakır K6 | 1200 m | İngiliz | Handikap | Kum | 13 | 12 (92%) | 8 / 4 / 0 / 1 | 11 / 2 / 0 / 0 |
| 14.11 İzmir K1 | 1600 m | Arap | Şartlı | Kum | 12 | 8 (67%) | 3 / 3 / 2 / 4 | 11 / 0 / 1 / 0 |
| 14.11 İzmir K2 | 1400 m | Arap | Maiden | Kum | 14 | 10 (71%) | 4 / 5 / 1 / 4 | 10 / 1 / 1 / 2 |
| 14.11 İzmir K3 | 2000 m | Arap | Handikap | Kum | 13 | 10 (77%) | 4 / 3 / 3 / 3 | 12 / 1 / 0 / 0 |
| 14.11 İzmir K4 | 1200 m | Arap | Şartlı | Kum | 14 | 11 (79%) | 5 / 5 / 1 / 3 | 12 / 0 / 1 / 1 |
| 14.11 İzmir K5 | 1200 m | İngiliz | Handikap | Kum | 8 | 7 (88%) | 2 / 3 / 2 / 1 | 6 / 0 / 2 / 0 |
| 14.11 İzmir K6 | 1200 m | İngiliz | Şartlı | Kum | 6 | 6 (100%) | 1 / 5 / 0 / 0 | 6 / 0 / 0 / 0 |
| 14.11 İzmir K7 | 1400 m | Arap | Maiden | Kum | 13 | 11 (85%) | 7 / 1 / 3 / 2 | 10 / 2 / 0 / 1 |
| 14.11 İzmir K8 | 1900 m | İngiliz | Şartlı | Kum | 16 | 14 (88%) | 12 / 2 / 0 / 2 | 13 / 1 / 2 / 0 |
| 15.11 Adana K1 | 1300 m | Arap | Handikap | Kum | 10 | 8 (80%) | 5 / 0 / 3 / 2 | 8 / 1 / 1 / 0 |
| 15.11 Adana K2 | 1300 m | İngiliz | Maiden | Kum | 8 | 7 (88%) | 0 / 5 / 2 / 1 | 8 / 0 / 0 / 0 |
| 15.11 Adana K3 | 1500 m | Arap | Şartlı | Sentetik | 12 | 10 (83%) | 4 / 6 / 0 / 2 | 12 / 0 / 0 / 0 |
| 15.11 Adana K4 | 1300 m | İngiliz | Maiden | Kum | 9 | 8 (89%) | 1 / 1 / 6 / 1 | 8 / 0 / 1 / 0 |
| 15.11 Adana K5 | 1200 m | İngiliz | Şartlı | Kum | 9 | 5 (56%) | 2 / 1 / 2 / 4 | 7 / 1 / 1 / 0 |
| 15.11 Adana K6 | 1400 m | İngiliz | KV | Kum | 8 | 6 (75%) | 1 / 2 / 3 / 2 | 6 / 1 / 1 / 0 |
| 15.11 Adana K7 | 1300 m | İngiliz | Şartlı | Kum | 7 | 7 (100%) | 2 / 2 / 3 / 0 | 7 / 0 / 0 / 0 |
| 15.11 Adana K8 | 2100 m | İngiliz | Şartlı | Sentetik | 11 | 11 (100%) | 2 / 4 / 5 / 0 | 9 / 0 / 2 / 0 |
| 15.11 İstanbul K1 | 1900 m | Arap | Handikap | Çim | 10 | 8 (80%) | 2 / 5 / 1 / 2 | 10 / 0 / 0 / 0 |
| 15.11 İstanbul K2 | 1600 m | Arap | Şartlı | Çim | 13 | 10 (77%) | 6 / 2 / 2 / 3 | 11 / 1 / 1 / 0 |
| 15.11 İstanbul K3 | 1400 m | İngiliz | Maiden | Çim | 9 | 9 (100%) | 1 / 7 / 1 / 0 | 8 / 1 / 0 / 0 |
| 15.11 İstanbul K4 | 2000 m | İngiliz | Handikap | Sentetik | 10 | 8 (80%) | 2 / 4 / 2 / 2 | 9 / 1 / 0 / 0 |
| 15.11 İstanbul K5 | 1800 m | İngiliz | Grup | Çim | 13 | 13 (100%) | 4 / 7 / 2 / 0 | 12 / 1 / 0 / 0 |
| 15.11 İstanbul K6 | 1400 m | İngiliz | Grup | Çim | 7 | 7 (100%) | 1 / 1 / 5 / 0 | 6 / 1 / 0 / 0 |
| 15.11 İstanbul K7 | 2400 m | İngiliz | Grup | Çim | 8 | 7 (88%) | 2 / 3 / 2 / 1 | 7 / 1 / 0 / 0 |
| 15.11 İstanbul K8 | 1400 m | İngiliz | Maiden | Çim | 7 | 7 (100%) | 2 / 4 / 1 / 0 | 6 / 1 / 0 / 0 |
| 15.11 İstanbul K9 | 1200 m | İngiliz | Handikap | Çim | 14 | 12 (86%) | 6 / 2 / 4 / 2 | 10 / 2 / 2 / 0 |
| 16.11 Bursa K1 | 1300 m | İngiliz | Maiden | Kum | 9 | 9 (100%) | 4 / 2 / 3 / 0 | 4 / 4 / 1 / 0 |
| 16.11 Bursa K2 | 1400 m | İngiliz | Handikap | Kum | 11 | 10 (91%) | 7 / 0 / 3 / 1 | 8 / 2 / 1 / 0 |
| 16.11 Bursa K3 | 1400 m | Arap | Şartlı | Kum | 13 | 13 (100%) | 5 / 7 / 1 / 0 | 13 / 0 / 0 / 0 |
| 16.11 Bursa K4 | 1300 m | İngiliz | Maiden | Kum | 10 | 10 (100%) | 5 / 3 / 2 / 0 | 8 / 1 / 0 / 1 |
| 16.11 Bursa K5 | 1300 m | İngiliz | KV | Kum | 6 | 6 (100%) | 4 / 1 / 1 / 0 | 5 / 0 / 1 / 0 |
| 16.11 Bursa K6 | 1200 m | Arap | Şartlı | Kum | 10 | 7 (70%) | 5 / 2 / 0 / 3 | 10 / 0 / 0 / 0 |
| 16.11 Bursa K7 | 1900 m | Arap | Handikap | Kum | 14 | 13 (93%) | 10 / 2 / 1 / 1 | 13 / 1 / 0 / 0 |
| 16.11 Şanlıurfa K1 | 1400 m | İngiliz | Şartlı | Kum | 10 | 5 (50%) | 3 / 2 / 0 / 5 | 9 / 0 / 0 / 1 |
| 16.11 Şanlıurfa K2 | 1400 m | Arap | Maiden | Kum | 15 | 11 (73%) | 5 / 5 / 1 / 4 | 14 / 1 / 0 / 0 |
| 16.11 Şanlıurfa K3 | 1400 m | İngiliz | Handikap | Kum | 15 | 14 (93%) | 8 / 5 / 1 / 1 | 13 / 0 / 2 / 0 |
| 16.11 Şanlıurfa K4 | 1400 m | Arap | Maiden | Kum | 15 | 13 (87%) | 3 / 8 / 2 / 2 | 12 / 0 / 2 / 1 |
| 16.11 Şanlıurfa K5 | 2000 m | Arap | KV | Kum | 15 | 9 (60%) | 4 / 3 / 2 / 6 | 12 / 3 / 0 / 0 |
| 16.11 Şanlıurfa K6 | 1200 m | İngiliz | Şartlı | Kum | 15 | 13 (87%) | 9 / 3 / 1 / 2 | 12 / 0 / 3 / 0 |
| 16.11 Şanlıurfa K7 | 1400 m | Arap | Maiden | Kum | 14 | 12 (86%) | 9 / 3 / 0 / 2 | 11 / 2 / 0 / 1 |
| 16.11 Şanlıurfa K8 | 1200 m | İngiliz | Şartlı | Kum | 15 | 12 (80%) | 6 / 4 / 2 / 3 | 12 / 1 / 2 / 0 |
| 17.11 Adana K1 | 1300 m | İngiliz | Maiden | Kum | 11 | 10 (91%) | 3 / 6 / 1 / 1 | 9 / 1 / 1 / 0 |
| 17.11 Adana K2 | 1200 m | İngiliz | Handikap | Kum | 7 | 7 (100%) | 2 / 3 / 2 / 0 | 6 / 1 / 0 / 0 |
| 17.11 Adana K3 | 1400 m | Arap | Handikap | Sentetik | 12 | 5 (42%) | 4 / 1 / 0 / 7 | 12 / 0 / 0 / 0 |
| 17.11 Adana K4 | 1200 m | İngiliz | Handikap | Sentetik | 13 | 12 (92%) | 4 / 6 / 2 / 1 | 13 / 0 / 0 / 0 |
| 17.11 Adana K5 | 2000 m | İngiliz | Şartlı | Kum | 10 | 9 (90%) | 7 / 1 / 1 / 1 | 10 / 0 / 0 / 0 |
| 17.11 Adana K6 | 1900 m | Arap | KV | Kum | 8 | 6 (75%) | 2 / 1 / 3 / 2 | 7 / 1 / 0 / 0 |
| 17.11 Adana K7 | 1300 m | İngiliz | Maiden | Kum | 10 | 10 (100%) | 3 / 3 / 4 / 0 | 8 / 2 / 0 / 0 |
| 17.11 Adana K8 | 1300 m | Arap | Satış | Kum | 16 | 12 (75%) | 9 / 2 / 1 / 4 | 15 / 1 / 0 / 0 |
| 17.11 Antalya K1 | 1200 m | İngiliz | Maiden | Sentetik | 9 | 8 (89%) | 3 / 2 / 3 / 1 | 8 / 0 / 1 / 0 |
| 17.11 Antalya K2 | 1300 m | İngiliz | Şartlı | Kum | 6 | 5 (83%) | 1 / 4 / 0 / 1 | 4 / 2 / 0 / 0 |
| 17.11 Antalya K3 | 1400 m | Arap | Şartlı | Kum | 10 | 10 (100%) | 7 / 1 / 2 / 0 | 8 / 0 / 2 / 0 |
| 17.11 Antalya K4 | 2200 m | İngiliz | Şartlı | Sentetik | 8 | 8 (100%) | 5 / 1 / 2 / 0 | 5 / 2 / 1 / 0 |
| 17.11 Antalya K5 | 2200 m | Arap | KV | Kum | 9 | 7 (78%) | 5 / 1 / 1 / 2 | 8 / 0 / 1 / 0 |
| 17.11 Antalya K6 | 1400 m | İngiliz | KV | Sentetik | 9 | 8 (89%) | 3 / 2 / 3 / 1 | 7 / 1 / 1 / 0 |
| 17.11 Antalya K7 | 1200 m | İngiliz | Maiden | Sentetik | 8 | 5 (63%) | 2 / 2 / 1 / 3 | 8 / 0 / 0 / 0 |
| 17.11 Antalya K8 | 1400 m | Arap | Handikap | Sentetik | 14 | 10 (71%) | 5 / 5 / 0 / 4 | 12 / 2 / 0 / 0 |

### 9b. Sonuç: kazanan, KAPASİTE sırası, Top1 / Top3, eşitlik
| Koşu | Kazanan | Kazananın galop / aradan | KAPASİTE sırası | Top1 / Top3 kredi (değerlendirilebilir) | Rastgele | Tam saha Top1 / Top3 | Üst puan eşitliği | KAPASİTE 1. sıradaki at(lar) |
|---|---|---|---|---|---|---|---|---|
| 10.11 Adana K1 | #5 SILLAGE | 1 galop · yakın (≤35 gün) (10 gün) | 1/8 | 1.00 / 1.00 | 0.125 / 0.375 | 1.00 / 1.00 | yok | #5 SILLAGE (tek galop) ✔ |
| 10.11 Adana K2 | #3 KOYUNEVİ ASLANI | 1 galop · yakın (≤35 gün) (7 gün) | 2/11 | 0.00 / 1.00 | 0.091 / 0.273 | 0.00 / 1.00 | yok | #7 SERÇE KIZI (tek galop) |
| 10.11 Adana K3 | #5 RESTAURADORES | 2 galop · yakın (≤35 gün) (14 gün) | 4/5 | 0.00 / 0.00 | 0.200 / 0.600 | 0.00 / 0.00 | VAR: #1=#4=#6 | #1 BİZON (4+ galop) ; #4 MAMDANI (2–3 galop) ; #6 SMALL BURGAZ (2–3 galop) |
| 10.11 Adana K4 | #1 AZERBAYCANLI | 2 galop · yakın (≤35 gün) (14 gün) | 3/10 | 0.00 / 1.00 | 0.100 / 0.300 | 0.00 / 1.00 | yok | #9 BAŞARAN TAY (2–3 galop) |
| 10.11 Adana K5 | #3 SERDENİZ | 1 galop · yakın (≤35 gün) (13 gün) | 6/12 | 0.00 / 0.00 | 0.083 / 0.250 | 0.00 / 0.00 | yok | #1 ÇELİK PARÇASI (2–3 galop) |
| 10.11 Adana K6 | #9 BODRUM GÜLÜ | 3 galop · yakın (≤35 gün) (16 gün) | 1/12 | 1.00 / 1.00 | 0.083 / 0.250 | 1.00 / 1.00 | yok | #9 BODRUM GÜLÜ (2–3 galop) ✔ |
| 10.11 Adana K7 | #8 SING SCAT | 1 galop · yakın (≤35 gün) (14 gün) | 2/8 | 0.00 / 1.00 | 0.125 / 0.375 | 0.00 / 1.00 | yok | #9 DICE MAN (2–3 galop) |
| 10.11 Adana K8 | #5 ERDİ BEY | 1 galop · yakın (≤35 gün) (12 gün) | 2/5 | 0.00 / 1.00 | 0.200 / 0.600 | 0.00 / 1.00 | yok | #2 MİRŞEŞEN (tek galop) |
| 10.11 Adana K9 | #1 YALIN ATEŞ | 1 galop · yakın (≤35 gün) (10 gün) | 4/12 | 0.00 / 0.00 | 0.083 / 0.250 | 0.00 / 0.00 | yok | #6 SELİM USTA (tek galop) |
| 10.11 Kocaeli K1 | #3 BEŞİR ÇAVUŞ | 0 galop · yakın (≤35 gün) (10 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #2 CANYAMAN (tek galop) |
| 10.11 Kocaeli K2 | #6 GÖKKILIÇ | 1 galop · yakın (≤35 gün) (8 gün) | 2/10 | 0.00 / 1.00 | 0.100 / 0.300 | 0.00 / 1.00 | yok | #4 BİRTUGAN (2–3 galop) |
| 10.11 Kocaeli K3 | #1 STEEL STRONG | 2 galop · yakın (≤35 gün) (14 gün) | 1/5 | 1.00 / 1.00 | 0.200 / 0.600 | 1.00 / 1.00 | yok | #1 STEEL STRONG (2–3 galop) ✔ |
| 10.11 Kocaeli K4 | #5 CABİRE SULTAN | 1 galop · yakın (≤35 gün) (13 gün) | 5/11 | 0.00 / 0.00 | 0.091 / 0.273 | 0.00 / 0.00 | yok | #3 SEMENDİN GÜCÜ (tek galop) |
| 10.11 Kocaeli K5 | #2 BLACK BLAZE | 1 galop · yakın (≤35 gün) (10 gün) | 8/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #5 VISERRA (tek galop) |
| 10.11 Kocaeli K6 | #5 SALGUR | 3 galop · yakın (≤35 gün) (17 gün) | 1/6 | 1.00 / 1.00 | 0.167 / 0.500 | 1.00 / 1.00 | yok | #5 SALGUR (2–3 galop) ✔ |
| 10.11 Kocaeli K7 | #1 BRAVE ATHENA | 5 galop · yakın (≤35 gün) (28 gün) | 2–3/7 | 0.00 / 1.00 | 0.143 / 0.429 | 0.00 / 1.00 | yok | #5 ROYAL MAJESTY (tek galop) |
| 10.11 Kocaeli K8 | #3 KING MAHİR | 0 galop · yakın (≤35 gün) (7 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | VAR: #1=#5 | #1 AFTER BURNER (2–3 galop) ; #5 GRANDE TEMPESTA (2–3 galop) |
| 10.11 Kocaeli K9 | #4 ILGARCAN | 1 galop · yakın (≤35 gün) (11 gün) | 6–7/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #6 ORUNBAY (2–3 galop) |
| 11.11 Elazığ K1 | #2 GÜNÇİÇEK | 1 galop · yakın (≤35 gün) (11 gün) | 2–3/5 | 0.00 / 1.00 | 0.200 / 0.600 | 0.00 / 1.00 | yok | #3 SEYYARETAY (2–3 galop) |
| 11.11 Elazığ K2 | #2 MİR KARAN | 2 galop · orta (36–60 gün) (49 gün) | 2/5 | 0.00 / 1.00 | 0.200 / 0.600 | 0.00 / 0.67 | yok | #1 KURT BEY (4+ galop) |
| 11.11 Elazığ K3 | #2 INFORMACTION | 1 galop · yakın (≤35 gün) (21 gün) | 1/7 | 1.00 / 1.00 | 0.143 / 0.429 | 1.00 / 1.00 | yok | #2 INFORMACTION (tek galop) ✔ |
| 11.11 Elazığ K4 | #12 GÖZE ÇARPAN | 0 galop · yakın (≤35 gün) (9 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #11 GELİNİM SİNEM (tek galop) |
| 11.11 Elazığ K5 | #7 MI GULIETTA | 1 galop · yakın (≤35 gün) (13 gün) | 3/3 | sayılmadı | — | 0.00 / 0.00 | yok | #1 GLACIUS BOREAS (tek galop) |
| 11.11 Elazığ K6 | #3 HÜKÜMSÜREN | 0 galop · yakın (≤35 gün) (7 gün) | galop yok | sayılmadı | — | 0.00 / 0.67 | yok | #6 ÖZGÜRAK (tek galop) |
| 11.11 Elazığ K7 | #2 ÇELİK STAR | 1 galop · orta (36–60 gün) (42 gün) | 1/3 | sayılmadı | — | 1.00 / 1.00 | yok | #2 ÇELİK STAR (tek galop) ✔ |
| 11.11 Elazığ K8 | #1 BOSTON LIGHT | 1 galop · yakın (≤35 gün) (15 gün) | 2/12 | 0.00 / 1.00 | 0.083 / 0.250 | 0.00 / 1.00 | yok | #3 ASALTIN (tek galop) |
| 11.11 İstanbul K1 | #7 AYNASIZ | 1 galop · yakın (≤35 gün) (12 gün) | 6–7/9 | 0.00 / 0.00 | 0.111 / 0.333 | 0.00 / 0.00 | yok | #2 GÜMÜŞ KILIÇ (tek galop) |
| 11.11 İstanbul K2 | #3 DIVINE SON | 1 galop · yakın (≤35 gün) (21 gün) | 1/6 | 1.00 / 1.00 | 0.167 / 0.500 | 1.00 / 1.00 | yok | #3 DIVINE SON (tek galop) ✔ |
| 11.11 İstanbul K3 | #1 KING BALDWIN | 0 galop · yakın (≤35 gün) (12 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | VAR: #4=#5=#6 | #4 ANY GIVEN SUNDAY (2–3 galop) ; #5 MICKEY MO (4+ galop) ; #6 IMPERATORE (tek galop) |
| 11.11 İstanbul K4 | #3 DAĞYIKAN | 2 galop · yakın (≤35 gün) (12 gün) | 7–8/11 | 0.00 / 0.00 | 0.091 / 0.273 | 0.00 / 0.00 | yok | #6 MAVİ HAKAN (tek galop) |
| 11.11 İstanbul K5 | #2 IRON SKY | 2 galop · yakın (≤35 gün) (14 gün) | 2/4 | 0.00 / 1.00 | 0.250 / 0.750 | 0.00 / 1.00 | yok | #1 COOL STAR (tek galop) |
| 11.11 İstanbul K6 | #1 GÖZPINARI | 1 galop · yakın (≤35 gün) (11 gün) | 1/5 | 1.00 / 1.00 | 0.200 / 0.600 | 1.00 / 1.00 | yok | #1 GÖZPINARI (tek galop) ✔ |
| 11.11 İstanbul K7 | #4 MİHRA FARAH | 5 galop · yakın (≤35 gün) (28 gün) | 5/5 | 0.00 / 0.00 | 0.200 / 0.600 | 0.00 / 0.00 | yok | #6 ARISTOCAT (tek galop) |
| 11.11 İstanbul K8 | #1 ATEŞİZİ | 1 galop · yakın (≤35 gün) (8 gün) | 4–5/12 | 0.00 / 0.00 | 0.083 / 0.250 | 0.00 / 0.00 | VAR: #2=#7=#11 | #2 KAHRAMAN FATİH (tek galop) ; #7 PLOMARİ (tek galop) ; #11 UFUKTEPE (tek galop) |
| 11.11 İstanbul K9 | #15 KONAKLI | 2 galop · yakın (≤35 gün) (14 gün) | 6–7/9 | 0.00 / 0.00 | 0.111 / 0.333 | 0.00 / 0.00 | yok | #14 GÜMBÜRHAN (2–3 galop) |
| 12.11 Ankara K1 | #7 TIME BREAKER | 2 galop · yakın (≤35 gün) (14 gün) | 1/7 | 1.00 / 1.00 | 0.143 / 0.429 | 1.00 / 1.00 | yok | #7 TIME BREAKER (2–3 galop) ✔ |
| 12.11 Ankara K2 | #1 ATEŞİM | 1 galop · yakın (≤35 gün) (11 gün) | 2–3/5 | 0.00 / 1.00 | 0.200 / 0.600 | 0.00 / 1.00 | yok | #2 IRMAK SU (tek galop) |
| 12.11 Ankara K3 | #1 KİNJAL | 1 galop · yakın (≤35 gün) (12 gün) | 1/5 | 1.00 / 1.00 | 0.200 / 0.600 | 1.00 / 1.00 | yok | #1 KİNJAL (tek galop) ✔ |
| 12.11 Ankara K4 | #7 ROHİRRİM | 2 galop · yakın (≤35 gün) (21 gün) | 3–4/9 | 0.00 / 0.50 | 0.111 / 0.333 | 0.00 / 0.50 | yok | #6 MR AREK (tek galop) |
| 12.11 Ankara K5 | #3 ERKURT | 0 galop · yakın (≤35 gün) (5 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #12 BEYPARS (tek galop) |
| 12.11 Ankara K6 | #3 DERTSAÇANKIZ | 2 galop · yakın (≤35 gün) (21 gün) | 2/8 | 0.00 / 1.00 | 0.125 / 0.375 | 0.00 / 1.00 | yok | #5 UĞURLU BEBEK (2–3 galop) |
| 12.11 Ankara K7 | #3 PAGANINI | 4 galop · yakın (≤35 gün) (33 gün) | 5–6/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | VAR: #2=#9 | #2 EL QUIQUE (2–3 galop) ; #9 CARITA LINDA (tek galop) |
| 12.11 Ankara K8 | #3 DERBY WARRIOR | 5 galop · yakın (≤35 gün) (27 gün) | 1/8 | 1.00 / 1.00 | 0.125 / 0.375 | 1.00 / 1.00 | yok | #3 DERBY WARRIOR (4+ galop) ✔ |
| 12.11 Ankara K9 | #7 TOUCH THE MOON | 2 galop · yakın (≤35 gün) (30 gün) | 2/7 | 0.00 / 1.00 | 0.143 / 0.429 | 0.00 / 1.00 | yok | #8 TRAİDORA (2–3 galop) |
| 12.11 Ankara K10 | #10 BÜYÜK DESTAN | 1 galop · yakın (≤35 gün) (13 gün) | 6/11 | 0.00 / 0.00 | 0.091 / 0.273 | 0.00 / 0.00 | yok | #1 CANBULUT (tek galop) |
| 12.11 İzmir K1 | #6 KUZEYİN POYRAZI | 0 galop · yakın (≤35 gün) (7 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #2 ERGİDEN (2–3 galop) |
| 12.11 İzmir K2 | #1 BEAUTY ALYA | 1 galop · yakın (≤35 gün) (12 gün) | 5/5 | 0.00 / 0.00 | 0.200 / 0.600 | 0.00 / 0.00 | yok | #6 LAL KIZIM (2–3 galop) |
| 12.11 İzmir K3 | #9 ÖKE HATUN | 1 galop · yakın (≤35 gün) (7 gün) | 3/4 | 0.00 / 1.00 | 0.250 / 0.750 | 0.00 / 1.00 | yok | #6 IRMAĞIN GÜLÜ (2–3 galop) |
| 12.11 İzmir K4 | #3 STORM QUEEN | 0 galop · yakın (≤35 gün) (7 gün) | galop yok | sayılmadı | — | 0.00 / 0.17 | yok | #2 RACING RAPTURE (tek galop) |
| 12.11 İzmir K5 | #3 MOMENT SAVER | 2 galop · yakın (≤35 gün) (23 gün) | 5/5 | 0.00 / 0.00 | 0.200 / 0.600 | 0.00 / 0.00 | yok | #1 DANCE OF WIND (2–3 galop) |
| 12.11 İzmir K6 | #1 SEMEND BATUR | 2 galop · yakın (≤35 gün) (14 gün) | 1–2/5 | 0.50 / 1.00 | 0.200 / 0.600 | 0.50 / 1.00 | VAR: #1=#5 | #1 SEMEND BATUR (2–3 galop) ✔ ; #5 GERARD (tek galop) |
| 12.11 İzmir K7 | #3 LILLE HAMMER | 5 galop · yakın (≤35 gün) (33 gün) | 3–5/5 | 0.00 / 0.33 | 0.200 / 0.600 | 0.00 / 0.00 | yok | #2 ANKA ERÇELİK (4+ galop) |
| 12.11 İzmir K8 | #2 LODATO | 3 galop · yakın (≤35 gün) (19 gün) | 8/11 | 0.00 / 0.00 | 0.091 / 0.273 | 0.00 / 0.00 | yok | #3 BLACK GALAXY (4+ galop) |
| 13.11 Bursa K1 | #4 LEJUR | 7 galop · uzun aradan (>60 gün) (74 gün) | 1/9 | 1.00 / 1.00 | 0.111 / 0.333 | 1.00 / 1.00 | yok | #4 LEJUR (4+ galop) ✔ |
| 13.11 Bursa K2 | #1 DADAKBEY | 4 galop · yakın (≤35 gün) (27 gün) | 8/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #10 GOZEYOĞLU (tek galop) |
| 13.11 Bursa K3 | #8 DEMON HUNTER | 2 galop · yakın (≤35 gün) (13 gün) | 1/10 | 1.00 / 1.00 | 0.100 / 0.300 | 1.00 / 1.00 | yok | #8 DEMON HUNTER (2–3 galop) ✔ |
| 13.11 Bursa K4 | #9 KARA BERELİ | 5 galop · orta (36–60 gün) (38 gün) | 6/9 | 0.00 / 0.00 | 0.111 / 0.333 | 0.00 / 0.00 | yok | #7 LORD PROTECTOR (tek galop) |
| 13.11 Bursa K5 | #2 FORTISSIMO | 1 galop · yakın (≤35 gün) (14 gün) | 1/7 | 1.00 / 1.00 | 0.143 / 0.429 | 1.00 / 1.00 | yok | #2 FORTISSIMO (tek galop) ✔ |
| 13.11 Bursa K6 | #7 PERSIAN MEMO | 8 galop · orta (36–60 gün) (49 gün) | 8/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #3 SHADOW GENIUS (tek galop) |
| 13.11 Bursa K7 | #8 ŞANKUT HATUN | 2 galop · yakın (≤35 gün) (15 gün) | 4/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | yok | #7 JALELA (tek galop) |
| 13.11 İstanbul K1 | #4 ALMUTANABİY | 0 galop · yakın (≤35 gün) (9 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #1 ERSANŞAH (tek galop) |
| 13.11 İstanbul K2 | #4 BARBOOM | 2 galop · yakın (≤35 gün) (22 gün) | 1–3/5 | 0.33 / 1.00 | 0.200 / 0.600 | 0.33 / 1.00 | VAR: #2=#4=#8 | #2 IŞILS A MELİNA (tek galop) ; #4 BARBOOM (2–3 galop) ✔ ; #8 SWEET LADY (2–3 galop) |
| 13.11 İstanbul K3 | #3 ŞAHİ | 6 galop · uzun aradan (>60 gün) (105 gün) | 2–3/4 | 0.00 / 1.00 | 0.250 / 0.750 | 0.00 / 1.00 | yok | #2 ADA EFSANESİ (4+ galop) |
| 13.11 İstanbul K4 | #10 QUEEN MİHRİ | 2 galop · yakın (≤35 gün) (17 gün) | 3/11 | 0.00 / 1.00 | 0.091 / 0.273 | 0.00 / 1.00 | yok | #4 KIZIM ELEKTRA (tek galop) |
| 13.11 İstanbul K5 | #2 BY TÜRKOĞLU | 2 galop · yakın (≤35 gün) (14 gün) | 4–5/9 | 0.00 / 0.00 | 0.111 / 0.333 | 0.00 / 0.00 | yok | #4 ATİLLABEY (tek galop) |
| 13.11 İstanbul K6 | #2 JOYFUL FOREVER | 2 galop · yakın (≤35 gün) (19 gün) | 2/7 | 0.00 / 1.00 | 0.143 / 0.429 | 0.00 / 1.00 | yok | #7 DARK MONEY (tek galop) |
| 13.11 İstanbul K7 | #2 ÇİLEKEŞ ÖMER | 1 galop · yakın (≤35 gün) (7 gün) | 4/6 | 0.00 / 0.00 | 0.167 / 0.500 | 0.00 / 0.00 | yok | #1 AKERBEY (tek galop) |
| 13.11 İstanbul K8 | #8 QUEEN Z | 3 galop · yakın (≤35 gün) (20 gün) | 10/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | yok | #1 KIMDRAKA (tek galop) |
| 13.11 İstanbul K9 | #11 DANCING KING | 1 galop · yakın (≤35 gün) (9 gün) | 2/9 | 0.00 / 1.00 | 0.111 / 0.333 | 0.00 / 1.00 | yok | #3 KING OF THE WIN (tek galop) |
| 14.11 Ankara K1 | #1 DEJAME | 0 galop · yakın (≤35 gün) (7 gün) | galop yok | sayılmadı | — | 0.00 / 0.50 | yok | #2 GANİİY (4+ galop) |
| 14.11 Ankara K2 | #1 ETMAN | 1 galop · yakın (≤35 gün) (7 gün) | 1/4 | 1.00 / 1.00 | 0.250 / 0.750 | 1.00 / 1.00 | yok | #1 ETMAN (tek galop) ✔ |
| 14.11 Ankara K3 | #1 CRIMSON POWER | 1 galop · yakın (≤35 gün) (13 gün) | 2/4 | 0.00 / 1.00 | 0.250 / 0.750 | 0.00 / 1.00 | yok | #3 LA MUNECA (tek galop) |
| 14.11 Ankara K4 | #4 GOLDEN PROMISE | 1 galop · yakın (≤35 gün) (16 gün) | 3/4 | 0.00 / 1.00 | 0.250 / 0.750 | 0.00 / 0.25 | yok | #7 FOOT LOOS (tek galop) |
| 14.11 Ankara K5 | #8 MIZMIZ MYRTLE | 1 galop · yakın (≤35 gün) (7 gün) | 8/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #2 ÇEVİK VAKTİ (tek galop) |
| 14.11 Ankara K6 | #2 HAROLDCOOPER | 3 galop · yakın (≤35 gün) (20 gün) | 3/8 | 0.00 / 1.00 | 0.125 / 0.375 | 0.00 / 1.00 | VAR: #1=#3 | #1 BABA OCAĞI (4+ galop) ; #3 MANGUDAI (2–3 galop) |
| 14.11 Ankara K7 | #4 LUPELIUS | 6 galop · orta (36–60 gün) (48 gün) | 5/6 | 0.00 / 0.00 | 0.167 / 0.500 | 0.00 / 0.00 | yok | #3 BROTHER LOVIE (2–3 galop) |
| 14.11 Ankara K8 | #6 SEYRAN HANIM | 3 galop · yakın (≤35 gün) (20 gün) | 7/7 | 0.00 / 0.00 | 0.143 / 0.429 | 0.00 / 0.00 | yok | #1 ATAERİ (tek galop) |
| 14.11 Ankara K9 | #6 KATICESUR | 0 galop · yakın (≤35 gün) (7 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #5 BURÇİGİN (4+ galop) |
| 14.11 Diyarbakır K1 | #1 KURTTEKİN OĞLU | 1 galop · yakın (≤35 gün) (14 gün) | 1/8 | 1.00 / 1.00 | 0.125 / 0.375 | 1.00 / 1.00 | yok | #1 KURTTEKİN OĞLU (tek galop) ✔ |
| 14.11 Diyarbakır K2 | #3 VERMİTHRAX | 2 galop · yakın (≤35 gün) (21 gün) | 7/7 | 0.00 / 0.00 | 0.143 / 0.429 | 0.00 / 0.00 | yok | #9 AZMİN ZAFERİ (4+ galop) |
| 14.11 Diyarbakır K3 | #1 ARAPÇELİK | 0 galop · yakın (≤35 gün) (7 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #7 MEGA STAR (4+ galop) |
| 14.11 Diyarbakır K4 | #3 ENESPAŞA | 2 galop · yakın (≤35 gün) (14 gün) | 8/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #9 GÜLPAŞA (tek galop) |
| 14.11 Diyarbakır K5 | #5 KING SMART | 0 galop · orta (36–60 gün) (42 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #2 AMALASUNTA (tek galop) |
| 14.11 Diyarbakır K6 | #12 GOLDEN SOUL | 1 galop · orta (36–60 gün) (42 gün) | 2/12 | 0.00 / 1.00 | 0.083 / 0.250 | 0.00 / 1.00 | yok | #7 GREEN GÖLE (tek galop) |
| 14.11 İzmir K1 | #1 AKGOBAK | 1 galop · yakın (≤35 gün) (9 gün) | 1/8 | 1.00 / 1.00 | 0.125 / 0.375 | 1.00 / 1.00 | yok | #1 AKGOBAK (tek galop) ✔ |
| 14.11 İzmir K2 | #8 KALEMLİ ŞAHI | 2 galop · yakın (≤35 gün) (14 gün) | 7/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | yok | #9 LADY BRIDGERTON (tek galop) |
| 14.11 İzmir K3 | #4 BABY ARYA | 2 galop · yakın (≤35 gün) (14 gün) | 5/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | VAR: #5=#6 | #5 SÜTLİMAN (tek galop) ; #6 BEDİZ DE FAUST (tek galop) |
| 14.11 İzmir K4 | #7 KÖSE RECEP | 2 galop · yakın (≤35 gün) (14 gün) | 9/11 | 0.00 / 0.00 | 0.091 / 0.273 | 0.00 / 0.00 | yok | #1 ZAZA ENES (2–3 galop) |
| 14.11 İzmir K5 | #2 WHITE WOLF | 8 galop · uzun aradan (>60 gün) (124 gün) | 5/7 | 0.00 / 0.00 | 0.143 / 0.429 | 0.00 / 0.00 | yok | #5 BOARDING PASS (2–3 galop) |
| 14.11 İzmir K6 | #2 GOLDEN CITY | 2 galop · yakın (≤35 gün) (15 gün) | 6/6 | 0.00 / 0.00 | 0.167 / 0.500 | 0.00 / 0.00 | yok | #5 MUKKİ (2–3 galop) |
| 14.11 İzmir K7 | #1 İZOTOP | 4 galop · orta (36–60 gün) (40 gün) | 1/11 | 1.00 / 1.00 | 0.091 / 0.273 | 1.00 / 1.00 | yok | #1 İZOTOP (4+ galop) ✔ |
| 14.11 İzmir K8 | #7 MASTER KINGDOM | 1 galop · yakın (≤35 gün) (16 gün) | 6–7/14 | 0.00 / 0.00 | 0.071 / 0.214 | 0.00 / 0.00 | yok | #11 MARY JANE (tek galop) |
| 15.11 Adana K1 | #4 ALİMENDER | 1 galop · yakın (≤35 gün) (21 gün) | 4/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #11 KÜLÜNÇE BEYİ (tek galop) |
| 15.11 Adana K2 | #5 THUNDERSTRUCK | 3 galop · yakın (≤35 gün) (29 gün) | 1/7 | 1.00 / 1.00 | 0.143 / 0.429 | 1.00 / 1.00 | yok | #5 THUNDERSTRUCK (2–3 galop) ✔ |
| 15.11 Adana K3 | #8 YARIŞ KRALİÇESİ | 3 galop · yakın (≤35 gün) (26 gün) | 9/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | yok | #1 PİSİFORMİS (2–3 galop) |
| 15.11 Adana K4 | #2 HYPER ROCKER | 5 galop · yakın (≤35 gün) (28 gün) | 1/8 | 1.00 / 1.00 | 0.125 / 0.375 | 1.00 / 1.00 | yok | #2 HYPER ROCKER (4+ galop) ✔ |
| 15.11 Adana K5 | #3 DOLCE MARE | 7 galop · orta (36–60 gün) (45 gün) | 1–2/5 | 0.50 / 1.00 | 0.200 / 0.600 | 0.50 / 1.00 | VAR: #1=#3 | #1 LEVERO (tek galop) ; #3 DOLCE MARE (4+ galop) ✔ |
| 15.11 Adana K6 | #1 GÖK BERK | 0 galop · yakın (≤35 gün) (22 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #3 REFLECTED GLORY (2–3 galop) |
| 15.11 Adana K7 | #3 NOBLE CREST | 4 galop · yakın (≤35 gün) (29 gün) | 3/7 | 0.00 / 1.00 | 0.143 / 0.429 | 0.00 / 1.00 | yok | #6 AMORES (4+ galop) |
| 15.11 Adana K8 | #4 ANOTHER BANGER | 2 galop · yakın (≤35 gün) (26 gün) | 10/11 | 0.00 / 0.00 | 0.091 / 0.273 | 0.00 / 0.00 | yok | #6 EXPRESS (4+ galop) |
| 15.11 İstanbul K1 | #9 EFE KAPTAN | 1 galop · yakın (≤35 gün) (14 gün) | 8/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #1 ÜSTÜNSOY (4+ galop) |
| 15.11 İstanbul K2 | #5 EFLAH | 1 galop · yakın (≤35 gün) (9 gün) | 3/10 | 0.00 / 1.00 | 0.100 / 0.300 | 0.00 / 1.00 | yok | #12 DELİ ŞİMŞEK (tek galop) |
| 15.11 İstanbul K3 | #9 RECHARGE MY HEART | 2 galop · orta (36–60 gün) (46 gün) | 3/9 | 0.00 / 1.00 | 0.111 / 0.333 | 0.00 / 1.00 | yok | #7 MIO ZIO (2–3 galop) |
| 15.11 İstanbul K4 | #7 SOCIAL BEE | 13 galop · orta (36–60 gün) (56 gün) | 5–7/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #4 VOLITIVO (2–3 galop) |
| 15.11 İstanbul K5 | #2 BATURALP CAN | 2 galop · yakın (≤35 gün) (16 gün) | 3–4/13 | 0.00 / 0.50 | 0.077 / 0.231 | 0.00 / 0.50 | yok | #1 AYTOR (IRE) (tek galop) |
| 15.11 İstanbul K6 | #7 WHIZBANG | 1 galop · yakın (≤35 gün) (17 gün) | 4–5/7 | 0.00 / 0.00 | 0.143 / 0.429 | 0.00 / 0.00 | yok | #4 SUBUTAI (4+ galop) |
| 15.11 İstanbul K7 | #6 BRANDO | 2 galop · yakın (≤35 gün) (15 gün) | 3/7 | 0.00 / 1.00 | 0.143 / 0.429 | 0.00 / 1.00 | yok | #1 AL TAN (4+ galop) |
| 15.11 İstanbul K8 | #6 KING LEGACY | 7 galop · orta (36–60 gün) (46 gün) | 2–3/7 | 0.00 / 1.00 | 0.143 / 0.429 | 0.00 / 1.00 | yok | #1 MY ZEKO (tek galop) |
| 15.11 İstanbul K9 | #4 FLYING JO | 8 galop · orta (36–60 gün) (44 gün) | 11/12 | 0.00 / 0.00 | 0.083 / 0.250 | 0.00 / 0.00 | yok | #7 GLONASS (tek galop) |
| 16.11 Bursa K1 | #9 STEEL HUNTER | 1 galop · yakın (≤35 gün) (13 gün) | 1–2/9 | 0.50 / 1.00 | 0.111 / 0.333 | 0.50 / 1.00 | VAR: #1=#9 | #1 ARSLANBEYLİ (tek galop) ; #9 STEEL HUNTER (tek galop) ✔ |
| 16.11 Bursa K2 | #7 TM BATAILE | 1 galop · yakın (≤35 gün) (13 gün) | 4/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | yok | #2 KUZEY EFESİ (tek galop) |
| 16.11 Bursa K3 | #3 PRENSES BERRİN | 2 galop · yakın (≤35 gün) (17 gün) | 2/13 | 0.00 / 1.00 | 0.077 / 0.231 | 0.00 / 1.00 | yok | #5 KAYALARIN ASLANI (tek galop) |
| 16.11 Bursa K4 | #3 COLLECTOR MAN | 5 galop · yakın (≤35 gün) (26 gün) | 10/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | yok | #1 DRAGON FURIOUS (tek galop) |
| 16.11 Bursa K5 | #4 KEÇİKHAN | 1 galop · yakın (≤35 gün) (20 gün) | 4/6 | 0.00 / 0.00 | 0.167 / 0.500 | 0.00 / 0.00 | yok | #1 LOST TREASURE (tek galop) |
| 16.11 Bursa K6 | #3 BAD REFTAR | 1 galop · yakın (≤35 gün) (11 gün) | 5/7 | 0.00 / 0.00 | 0.143 / 0.429 | 0.00 / 0.00 | yok | #5 DESPOTLU (tek galop) |
| 16.11 Bursa K7 | #1 SERİNTEPE | 1 galop · yakın (≤35 gün) (15 gün) | 3–4/13 | 0.00 / 0.50 | 0.077 / 0.231 | 0.00 / 0.50 | yok | #3 ESKİ TOPRAK (tek galop) |
| 16.11 Şanlıurfa K1 | #3 ADARYAM | 0 galop · yakın (≤35 gün) (9 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #4 BERRYBELLA (tek galop) |
| 16.11 Şanlıurfa K2 | #4 ÇILGINKRAL | 1 galop · yakın (≤35 gün) (14 gün) | 2/11 | 0.00 / 1.00 | 0.091 / 0.273 | 0.00 / 1.00 | yok | #14 MY LAGERTHA (2–3 galop) |
| 16.11 Şanlıurfa K3 | #15 LORD SEYFO | 1 galop · yakın (≤35 gün) (8 gün) | 2/14 | 0.00 / 1.00 | 0.071 / 0.214 | 0.00 / 1.00 | yok | #4 BLACK BREEZE (tek galop) |
| 16.11 Şanlıurfa K4 | #2 ADNANHAN | 2 galop · yakın (≤35 gün) (14 gün) | 7–8/13 | 0.00 / 0.00 | 0.077 / 0.231 | 0.00 / 0.00 | yok | #6 SELANİK PAŞASI (4+ galop) |
| 16.11 Şanlıurfa K5 | #7 DERBEDER ALİ | 1 galop · yakın (≤35 gün) (7 gün) | 2/9 | 0.00 / 1.00 | 0.111 / 0.333 | 0.00 / 1.00 | yok | #13 PEKALP (2–3 galop) |
| 16.11 Şanlıurfa K6 | #12 LORD OF THE BLACK | 1 galop · yakın (≤35 gün) (9 gün) | 6/13 | 0.00 / 0.00 | 0.077 / 0.231 | 0.00 / 0.00 | yok | #14 İSMETİM (tek galop) |
| 16.11 Şanlıurfa K7 | #1 ÇAKAL ÇÖKERTEN | 2 galop · yakın (≤35 gün) (14 gün) | 1–2/12 | 0.50 / 1.00 | 0.083 / 0.250 | 0.50 / 1.00 | VAR: #1=#15 | #1 ÇAKAL ÇÖKERTEN (2–3 galop) ✔ ; #15 TUMBUL NURÇİÇEĞİ (2–3 galop) |
| 16.11 Şanlıurfa K8 | #2 MANY MORE | 4 galop · uzun aradan (>60 gün) (91 gün) | 3–5/12 | 0.00 / 0.33 | 0.083 / 0.250 | 0.00 / 0.33 | yok | #17 YELİN (2–3 galop) |
| 17.11 Adana K1 | #1 TIMEWARDEN | 1 galop · yakın (≤35 gün) (16 gün) | 2/10 | 0.00 / 1.00 | 0.100 / 0.300 | 0.00 / 1.00 | yok | #11 QUEEN LARA (2–3 galop) |
| 17.11 Adana K2 | #3 COOGER FIRE | 4 galop · yakın (≤35 gün) (30 gün) | 1/7 | 1.00 / 1.00 | 0.143 / 0.429 | 1.00 / 1.00 | yok | #3 COOGER FIRE (4+ galop) ✔ |
| 17.11 Adana K3 | #8 AZERBAYCANLI | 1 galop · yakın (≤35 gün) (7 gün) | 1/5 | 1.00 / 1.00 | 0.200 / 0.600 | 1.00 / 1.00 | yok | #8 AZERBAYCANLI (tek galop) ✔ |
| 17.11 Adana K4 | #5 MAMDANI | 1 galop · yakın (≤35 gün) (7 gün) | 1/12 | 1.00 / 1.00 | 0.083 / 0.250 | 1.00 / 1.00 | yok | #5 MAMDANI (tek galop) ✔ |
| 17.11 Adana K5 | #5 QUEEN SEÇİL | 1 galop · yakın (≤35 gün) (14 gün) | 6/9 | 0.00 / 0.00 | 0.111 / 0.333 | 0.00 / 0.00 | yok | #3 COMPETITOR (tek galop) |
| 17.11 Adana K6 | #2 ORÇUNTAY | 5 galop · yakın (≤35 gün) (35 gün) | 3/6 | 0.00 / 1.00 | 0.167 / 0.500 | 0.00 / 1.00 | yok | #3 SER DAĞYUDAN (4+ galop) |
| 17.11 Adana K7 | #8 YAĞIZ EFENDİ | 4 galop · yakın (≤35 gün) (30 gün) | 5/10 | 0.00 / 0.00 | 0.100 / 0.300 | 0.00 / 0.00 | yok | #1 DR NECO (4+ galop) |
| 17.11 Adana K8 | #1 DİCLE FIRAT | 0 galop · yakın (≤35 gün) (9 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #8 TERKEN HATUN (2–3 galop) |
| 17.11 Antalya K1 | #1 HAS TURBO | 1 galop · yakın (≤35 gün) (17 gün) | 2–3/8 | 0.00 / 1.00 | 0.125 / 0.375 | 0.00 / 1.00 | yok | #7 SON OF ŞÜKRAN (4+ galop) |
| 17.11 Antalya K2 | #1 RAZENOID | 3 galop · orta (36–60 gün) (46 gün) | 3–4/5 | 0.00 / 0.50 | 0.200 / 0.600 | 0.00 / 0.33 | VAR: #2=#6 | #2 MR ÇINAR (tek galop) ; #6 ÇİKOK POWER (2–3 galop) |
| 17.11 Antalya K3 | #5 YAYLA ÇİÇEĞİ | 1 galop · yakın (≤35 gün) (11 gün) | 1/10 | 1.00 / 1.00 | 0.100 / 0.300 | 1.00 / 1.00 | yok | #5 YAYLA ÇİÇEĞİ (tek galop) ✔ |
| 17.11 Antalya K4 | #1 THUNDER HORSE | 1 galop · yakın (≤35 gün) (11 gün) | 1/8 | 1.00 / 1.00 | 0.125 / 0.375 | 1.00 / 1.00 | yok | #1 THUNDER HORSE (tek galop) ✔ |
| 17.11 Antalya K5 | #8 CİHANA BEDEL | 0 galop · yakın (≤35 gün) (14 gün) | galop yok | sayılmadı | — | 0.00 / 0.00 | yok | #4 SAADIN KASIRGASI (2–3 galop) |
| 17.11 Antalya K6 | #3 GENERAL BRIELLA | 1 galop · yakın (≤35 gün) (18 gün) | 5–6/8 | 0.00 / 0.00 | 0.125 / 0.375 | 0.00 / 0.00 | yok | #4 PEHLİVAN YILDIZI (4+ galop) |
| 17.11 Antalya K7 | #7 SON OF FIRE | 1 galop · yakın (≤35 gün) (17 gün) | 1/5 | 1.00 / 1.00 | 0.200 / 0.600 | 1.00 / 1.00 | yok | #7 SON OF FIRE (tek galop) ✔ |
| 17.11 Antalya K8 | #1 HARESE | 1 galop · yakın (≤35 gün) (20 gün) | 1/10 | 1.00 / 1.00 | 0.100 / 0.300 | 1.00 / 1.00 | yok | #1 HARESE (tek galop) ✔ |

## Sınırlar
- Galop kaydının veritabanına ne zaman girdiği saklanmıyor; tarihler gerçek idman tarihidir (yarış öncesi) ama "o gün sistemde görünüyor muydu" kanıtlanamaz. Hipodrom ve pist durumu yok. Önceki koşu tarihi kendi kayıtlarımız + TJK geçmiş önbelleğinden gelir (yalnız t'den önceki satırlar).
- Gruplar bağımsız değil (ör. Maiden ↔ tek galop ↔ 2 yaşlı İngiliz); tek tek tablolar etkileşimi göstermez. Çoklu karşılaştırma düzeltilmedi.
- Bu analiz seçim yapmaz: hiçbir gruba göre formül, ağırlık veya sinyal değiştirilmedi.