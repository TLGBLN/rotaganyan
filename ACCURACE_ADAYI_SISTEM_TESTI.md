# ACCURACE ADAYI — sistemdeki tüm Accurace'li yarışlarda test (ACC_HIZ ve ACC_BITIRIS AYRI AYRI)
**Yeni model, katsayı, ağırlık (w_H) veya sinyal YOK; birleşik ACCURACE kurulmadı; `SINYAL_KAYDI` boş.** Gün/tarih kırılımı verilmedi (yalnız toplu sonuç). Test popülasyonu: Accurace kaydı olan, sonuçlanmış **4931 yarış, 49183 at** (Karma/koşullu kopyalar hariç; veri aralığı yıl başından 313 farklı yarış günü).

**Zaman bütünlüğü:** her yarışın ACC_HIZ / ACC_BITIRIS puanı ve referansları o yarışın gününden ÖNCEKİ (tarih < t) Accurace kayıtlarıyla hesaplanır; yarışın kendi Accurace kaydı ve aynı gün/sonrası kayıtlar dışarıdadır. Gelecek-bozma testi (8 gün, 1006 at; t ve sonrası bozuldu, aynı güne sahte kayıt eklendi): **GEÇTİ — bileşenler birebir aynı, sızıntı yok**. Puanlar yarış sonucu yüklenmeden önce hesaplandı; sonuç hesaba girmez. Test, **zaman içinde genişleyen** referansla yapıldığı için yılın ilk haftalarındaki yarışlarda geçmiş az, kapsam düşüktür.

## Okuma kılavuzu
- **Top1** = puanı en yüksek atın kazanması; **Top3** = kazananın puana göre ilk 3'te olması. **Değerlendirilebilir**: yalnız puanı olan atlar sıralanır; kazananın puanı da olmalı ve puanlı en az 4 at bulunmalı (aksi halde o yarış sayılmaz); rastgele = 1/n, 3/n; eşit puanda isabet payı bölünür. **fark** = bileşen − rastgele (puan); köşeli parantez = eşleştirilmiş bootstrap %95 (1000); 0'ı içeriyorsa gürültüden ayırt edilemez.
- **Tam saha**: puansız atlar nötr (puanlı atların ortalaması), kazananı puansız yarışlar da sayılır. **At kapsamı** = puanı hesaplanabilen at payı. **Üst puan eşitliği** = en yüksek puanın ≥2 atta eşit çıktığı yarış payı.
- Gruplar çok; **çoklu karşılaştırma düzeltilmedi**; n<30 işaretli. Gruplar bağımsız değil (ırk ↔ tip ↔ mesafe ↔ hipodrom). Referans sınıf düzeltmesizdir (aynı ırk+zemin+mesafedeki tüm sınıflar).

## 1. Genel
**ACC_HIZ**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Tüm yarışlar | 4931 | 3747 | 74% | 25.1% (rast. 13.0%) · fark 12.2 puan [10.8; 13.5] | 59.4% (rast. 38.9%) · fark 20.5 puan [19.0; 21.8] | 0.0% | 21.3% / 51.2% (rast. 11.2% / 33.6%) |  |

**ACC_BITIRIS**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Tüm yarışlar | 4931 | 3730 | 74% | 20.9% (rast. 13.0%) · fark 7.9 puan [6.7; 9.3] | 52.3% (rast. 38.9%) · fark 13.3 puan [11.9; 14.9] | 0.0% | 17.8% / 45.4% (rast. 11.2% / 33.6%) |  |

## 2. Koşul kırılımı (yarış düzeyi)
### 2a. Irk
**ACC_HIZ**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| İngiliz | 2750 | 2041 | 73% | 26.8% (rast. 14.0%) · fark 12.9 puan [11.0; 14.9] | 62.5% (rast. 41.9%) · fark 20.6 puan [18.5; 22.6] | 0.0% | 22.6% / 54.0% (rast. 12.2% / 36.5%) |  |
| Arap | 2181 | 1706 | 75% | 23.1% (rast. 11.7%) · fark 11.3 puan [9.3; 13.4] | 55.6% (rast. 35.2%) · fark 20.4 puan [18.1; 22.8] | 0.0% | 19.7% / 47.7% (rast. 10.0% / 30.0%) |  |

**ACC_BITIRIS**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| İngiliz | 2750 | 2031 | 73% | 22.6% (rast. 14.0%) · fark 8.7 puan [7.0; 10.5] | 55.0% (rast. 41.9%) · fark 13.1 puan [10.9; 15.2] | 0.0% | 19.2% / 47.9% (rast. 12.2% / 36.5%) |  |
| Arap | 2181 | 1699 | 74% | 18.8% (rast. 11.8%) · fark 7.0 puan [5.1; 8.9] | 48.9% (rast. 35.4%) · fark 13.5 puan [11.3; 15.9] | 0.1% | 16.1% / 42.3% (rast. 10.0% / 30.0%) |  |

### 2b. Koşu tipi
**ACC_HIZ**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Maiden | 1049 | 738 | 65% | 28.7% (rast. 13.0%) · fark 15.7 puan [12.5; 19.1] | 68.6% (rast. 38.9%) · fark 29.6 puan [26.2; 32.9] | 0.0% | 22.2% / 53.6% (rast. 9.8% / 29.3%) |  |
| Şartlı | 1593 | 1084 | 69% | 26.5% (rast. 13.8%) · fark 12.7 puan [10.1; 15.1] | 63.7% (rast. 41.3%) · fark 22.4 puan [19.4; 25.4] | 0.0% | 21.3% / 53.1% (rast. 12.2% / 36.5%) |  |
| Handikap | 1448 | 1230 | 82% | 20.7% (rast. 11.3%) · fark 9.4 puan [7.2; 11.5] | 48.9% (rast. 33.8%) · fark 15.1 puan [12.3; 17.7] | 0.0% | 18.6% / 45.0% (rast. 10.1% / 30.3%) |  |
| KV | 554 | 450 | 80% | 26.9% (rast. 15.8%) · fark 11.1 puan [7.0; 15.3] | 63.8% (rast. 47.3%) · fark 16.5 puan [12.3; 20.7] | 0.0% | 24.5% / 57.6% (rast. 14.1% / 42.4%) |  |
| Grup | 139 | 117 | 84% | 24.8% (rast. 12.3%) · fark 12.5 puan [4.9; 20.5] | 56.4% (rast. 36.9%) · fark 19.5 puan [11.5; 27.7] | 0.0% | 22.3% / 50.7% (rast. 11.1% / 33.4%) |  |
| Satış | 144 | 125 | 80% | 29.6% (rast. 12.8%) · fark 16.8 puan [9.3; 25.3] | 56.0% (rast. 38.5%) · fark 17.5 puan [9.4; 25.9] | 0.0% | 27.2% / 50.9% (rast. 10.7% / 32.2%) |  |
| Diğer | 4 | 3 | 77% | 66.7% (rast. 19.8%) · fark 46.9 puan [—] | 100.0% (rast. 59.3%) · fark 40.7 puan [—] | 0.0% | 50.0% / 81.3% (rast. 16.5% / 49.6%) | AZ ÖRNEK |

**ACC_BITIRIS**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Maiden | 1049 | 728 | 65% | 21.8% (rast. 13.0%) · fark 8.9 puan [5.7; 11.8] | 56.0% (rast. 39.0%) · fark 17.1 puan [13.6; 20.3] | 0.0% | 17.4% / 44.9% (rast. 9.8% / 29.3%) |  |
| Şartlı | 1593 | 1081 | 68% | 24.3% (rast. 13.8%) · fark 10.5 puan [8.1; 13.1] | 56.6% (rast. 41.4%) · fark 15.2 puan [12.4; 18.0] | 0.1% | 19.2% / 47.9% (rast. 12.2% / 36.5%) |  |
| Handikap | 1448 | 1230 | 82% | 17.4% (rast. 11.3%) · fark 6.1 puan [4.1; 8.3] | 45.8% (rast. 33.9%) · fark 11.9 puan [9.1; 14.8] | 0.0% | 15.8% / 41.6% (rast. 10.1% / 30.3%) |  |
| KV | 554 | 448 | 80% | 22.1% (rast. 15.7%) · fark 6.4 puan [2.6; 10.2] | 57.1% (rast. 47.2%) · fark 9.9 puan [5.5; 14.0] | 0.0% | 20.7% / 51.5% (rast. 14.1% / 42.4%) |  |
| Grup | 139 | 115 | 84% | 17.4% (rast. 12.4%) · fark 5.0 puan [-1.4; 11.7] | 42.6% (rast. 37.3%) · fark 5.3 puan [-2.7; 14.3] | 0.0% | 15.8% / 38.9% (rast. 11.1% / 33.4%) |  |
| Satış | 144 | 125 | 80% | 18.4% (rast. 12.9%) · fark 5.5 puan [-1.2; 12.4] | 46.4% (rast. 38.6%) · fark 7.8 puan [-0.3; 16.2] | 0.0% | 16.7% / 41.9% (rast. 10.7% / 32.2%) |  |
| Diğer | 4 | 3 | 77% | 66.7% (rast. 19.8%) · fark 46.9 puan [—] | 100.0% (rast. 59.3%) · fark 40.7 puan [—] | 0.0% | 50.0% / 81.3% (rast. 16.5% / 49.6%) | AZ ÖRNEK |

### 2c. Yarış zemini
**ACC_HIZ**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Kum | 2973 | 2414 | 80% | 24.8% (rast. 12.7%) · fark 12.1 puan [10.4; 13.8] | 58.8% (rast. 38.1%) · fark 20.7 puan [18.8; 22.5] | 0.0% | 22.1% / 53.0% (rast. 11.4% / 34.2%) |  |
| Çim | 1176 | 854 | 68% | 23.2% (rast. 13.1%) · fark 10.1 puan [7.5; 13.0] | 57.5% (rast. 39.3%) · fark 18.2 puan [14.9; 21.7] | 0.0% | 19.2% / 48.7% (rast. 10.9% / 32.7%) |  |
| Sentetik | 782 | 479 | 61% | 30.3% (rast. 14.0%) · fark 16.3 puan [12.4; 20.3] | 65.6% (rast. 42.0%) · fark 23.5 puan [19.6; 27.8] | 0.0% | 21.5% / 48.4% (rast. 10.8% / 32.5%) |  |

**ACC_BITIRIS**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Kum | 2973 | 2413 | 80% | 19.7% (rast. 12.8%) · fark 7.0 puan [5.4; 8.5] | 50.1% (rast. 38.3%) · fark 11.9 puan [10.0; 13.7] | 0.0% | 17.7% / 45.7% (rast. 11.4% / 34.2%) |  |
| Çim | 1176 | 838 | 67% | 21.1% (rast. 13.0%) · fark 8.1 puan [5.4; 10.7] | 52.5% (rast. 39.1%) · fark 13.4 puan [10.2; 16.7] | 0.0% | 17.5% / 44.5% (rast. 10.9% / 32.7%) |  |
| Sentetik | 782 | 479 | 61% | 26.5% (rast. 14.0%) · fark 12.5 puan [8.4; 16.6] | 62.4% (rast. 42.0%) · fark 20.4 puan [16.0; 24.5] | 0.0% | 18.9% / 46.0% (rast. 10.8% / 32.5%) |  |

### 2d. Mesafe
**ACC_HIZ**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| ≤1200 m | 1050 | 661 | 62% | 25.3% (rast. 13.3%) · fark 11.9 puan [8.7; 15.2] | 60.7% (rast. 40.0%) · fark 20.6 puan [16.9; 24.1] | 0.0% | 19.5% / 49.2% (rast. 11.2% / 33.6%) |  |
| 1300–1400 m | 1502 | 1112 | 72% | 26.7% (rast. 12.9%) · fark 13.8 puan [11.1; 16.2] | 63.6% (rast. 38.8%) · fark 24.8 puan [21.9; 27.5] | 0.0% | 22.4% / 53.2% (rast. 10.8% / 32.5%) |  |
| 1500–1800 m | 991 | 797 | 78% | 24.2% (rast. 12.3%) · fark 11.9 puan [9.0; 15.0] | 54.0% (rast. 36.8%) · fark 17.1 puan [13.8; 20.4] | 0.0% | 21.3% / 47.5% (rast. 10.8% / 32.4%) |  |
| 1900+ m | 1388 | 1177 | 82% | 24.2% (rast. 13.3%) · fark 11.0 puan [8.5; 13.4] | 58.4% (rast. 39.8%) · fark 18.6 puan [15.9; 21.4] | 0.0% | 21.5% / 53.2% (rast. 11.9% / 35.7%) |  |

**ACC_BITIRIS**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| ≤1200 m | 1050 | 650 | 61% | 20.1% (rast. 13.3%) · fark 6.7 puan [3.6; 9.6] | 51.1% (rast. 40.0%) · fark 11.1 puan [7.2; 14.9] | 0.2% | 15.9% / 43.2% (rast. 11.2% / 33.6%) |  |
| 1300–1400 m | 1502 | 1108 | 72% | 21.5% (rast. 12.9%) · fark 8.5 puan [6.2; 11.0] | 54.4% (rast. 38.8%) · fark 15.6 puan [12.8; 18.5] | 0.0% | 17.9% / 45.7% (rast. 10.8% / 32.5%) |  |
| 1500–1800 m | 991 | 795 | 78% | 20.3% (rast. 12.3%) · fark 7.9 puan [5.2; 10.8] | 48.7% (rast. 36.9%) · fark 11.8 puan [8.6; 15.0] | 0.0% | 17.9% / 43.6% (rast. 10.8% / 32.4%) |  |
| 1900+ m | 1388 | 1177 | 82% | 21.2% (rast. 13.3%) · fark 8.0 puan [5.6; 10.6] | 53.3% (rast. 39.8%) · fark 13.4 puan [10.8; 16.0] | 0.0% | 19.1% / 48.2% (rast. 11.9% / 35.7%) |  |

### 2e. Hipodrom
**ACC_HIZ**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Adana | 559 | 375 | 64% | 31.2% (rast. 13.8%) · fark 17.4 puan [12.6; 21.9] | 64.8% (rast. 41.5%) · fark 23.3 puan [18.6; 28.0] | 0.0% | 24.3% / 53.2% (rast. 11.2% / 33.7%) |  |
| Ankara | 697 | 568 | 78% | 25.4% (rast. 14.2%) · fark 11.2 puan [7.6; 14.7] | 60.4% (rast. 42.5%) · fark 17.9 puan [13.9; 21.9] | 0.0% | 23.0% / 55.0% (rast. 12.3% / 37.0%) |  |
| Antalya | 207 | 125 | 57% | 26.4% (rast. 15.8%) · fark 10.6 puan [3.2; 18.4] | 63.2% (rast. 47.5%) · fark 15.7 puan [7.5; 24.3] | 0.0% | 18.7% / 47.9% (rast. 12.1% / 36.2%) |  |
| Bursa | 641 | 498 | 74% | 23.1% (rast. 12.3%) · fark 10.8 puan [7.4; 14.2] | 60.2% (rast. 37.0%) · fark 23.2 puan [19.1; 27.1] | 0.0% | 19.9% / 52.6% (rast. 10.7% / 32.0%) |  |
| Elazığ | 358 | 335 | 91% | 15.2% (rast. 11.3%) · fark 3.9 puan [0.3; 8.0] | 46.0% (rast. 34.0%) · fark 12.0 puan [6.7; 17.5] | 0.0% | 15.0% / 44.8% (rast. 10.7% / 32.0%) |  |
| İstanbul | 1005 | 659 | 66% | 26.1% (rast. 13.6%) · fark 12.5 puan [9.2; 15.7] | 62.2% (rast. 40.7%) · fark 21.5 puan [18.3; 25.1] | 0.0% | 20.0% / 48.4% (rast. 11.0% / 33.0%) |  |
| İzmir | 759 | 613 | 80% | 29.5% (rast. 13.1%) · fark 16.4 puan [12.7; 19.8] | 64.6% (rast. 39.2%) · fark 25.4 puan [21.8; 28.8] | 0.0% | 25.9% / 57.6% (rast. 12.0% / 35.9%) |  |
| Kocaeli | 350 | 290 | 83% | 23.8% (rast. 12.0%) · fark 11.8 puan [7.0; 16.6] | 56.6% (rast. 36.0%) · fark 20.5 puan [15.2; 25.9] | 0.0% | 20.8% / 50.6% (rast. 11.0% / 32.9%) |  |
| Şanlıurfa | 355 | 284 | 77% | 21.1% (rast. 10.5%) · fark 10.6 puan [6.1; 15.8] | 47.9% (rast. 31.6%) · fark 16.3 puan [10.4; 22.0] | 0.0% | 17.9% / 41.4% (rast. 9.1% / 27.2%) |  |

**ACC_BITIRIS**
| Grup | Yarış | Değerlendirilebilir yarış | At kapsamı | Top1 | Top3 | Üst puan eşitliği | Tam saha Top1 / Top3 | Not |
|---|---|---|---|---|---|---|---|
| Adana | 559 | 374 | 64% | 21.4% (rast. 13.8%) · fark 7.6 puan [3.4; 11.9] | 56.7% (rast. 41.5%) · fark 15.2 puan [10.6; 20.1] | 0.0% | 17.2% / 46.8% (rast. 11.2% / 33.7%) |  |
| Ankara | 697 | 560 | 77% | 21.3% (rast. 14.2%) · fark 7.1 puan [3.9; 10.5] | 55.4% (rast. 42.6%) · fark 12.8 puan [9.0; 17.0] | 0.0% | 19.3% / 49.2% (rast. 12.3% / 37.0%) |  |
| Antalya | 207 | 125 | 57% | 27.2% (rast. 15.9%) · fark 11.3 puan [3.8; 19.0] | 67.2% (rast. 47.6%) · fark 19.6 puan [11.9; 28.0] | 0.0% | 19.2% / 49.6% (rast. 12.1% / 36.2%) |  |
| Bursa | 641 | 498 | 74% | 21.3% (rast. 12.4%) · fark 8.9 puan [5.5; 12.4] | 51.0% (rast. 37.1%) · fark 13.9 puan [9.7; 18.3] | 0.0% | 18.2% / 45.2% (rast. 10.7% / 32.0%) |  |
| Elazığ | 358 | 335 | 90% | 13.1% (rast. 11.4%) · fark 1.7 puan [-1.7; 5.2] | 37.6% (rast. 34.2%) · fark 3.4 puan [-1.4; 8.3] | 0.0% | 12.4% / 37.0% (rast. 10.7% / 32.0%) |  |
| İstanbul | 1005 | 652 | 66% | 24.1% (rast. 13.5%) · fark 10.6 puan [7.4; 13.7] | 56.6% (rast. 40.6%) · fark 16.0 puan [12.6; 19.9] | 0.0% | 18.3% / 44.5% (rast. 11.0% / 33.0%) |  |
| İzmir | 759 | 613 | 80% | 24.4% (rast. 13.1%) · fark 11.3 puan [7.9; 14.8] | 56.0% (rast. 39.3%) · fark 16.7 puan [12.9; 20.8] | 0.2% | 21.9% / 51.3% (rast. 12.0% / 35.9%) |  |
| Kocaeli | 350 | 290 | 83% | 19.3% (rast. 12.0%) · fark 7.3 puan [3.1; 11.8] | 50.3% (rast. 36.0%) · fark 14.3 puan [9.1; 19.8] | 0.0% | 17.0% / 45.1% (rast. 11.0% / 32.9%) |  |
| Şanlıurfa | 355 | 283 | 76% | 12.0% (rast. 10.7%) · fark 1.3 puan [-2.5; 5.3] | 37.1% (rast. 32.1%) · fark 5.0 puan [-0.5; 10.7] | 0.0% | 10.6% / 32.7% (rast. 9.1% / 27.2%) |  |

## 3. At düzeyi koşullar
At düzeyi gruplar yarışı bölmez: o gruptan bir at bileşenin tüm sahadaki sıralamasında **1. sırada (Top1 seçimi)** veya **ilk 3'te (Top3 seçimi)** çıktığında kazanma oranı; *beklenen* = o yarışta puanlı atlar arasından rastgele seçilen atın kazanma olasılığı (kazananı puansız yarışlar beklenende 0). **oran** = kazanan / beklenen (1,00 = rastgele), köşeli parantez bootstrap %95. Seçim sayıları eşit puanda kesirlidir.
### 3a. Puana giren yarış sayısı (o bileşen için)
**ACC_HIZ**
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 yarış | 8497 | 100% | 1450 | 314 (21.7%) | 11.9% | **1.82** [1.66; 1.98] | 3481 | 576 (16.5%) | 11.8% | **1.40** [1.32; 1.48] | 0% |  |
| 2 yarış | 6363 | 100% | 730 | 190 (26.0%) | 12.6% | **2.07** [1.83; 2.33] | 2259 | 447 (19.8%) | 12.2% | **1.62** [1.50; 1.75] | 0% |  |
| 3 yarış (tam) | 21501 | 100% | 2279 | 492 (21.6%) | 11.4% | **1.89** [1.74; 2.04] | 7531 | 1305 (17.3%) | 11.6% | **1.50** [1.44; 1.56] | 0% |  |

**ACC_BITIRIS**
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 yarış | 8538 | 100% | 1456 | 250 (17.1%) | 11.9% | **1.45** [1.29; 1.60] | 3532 | 526 (14.9%) | 11.7% | **1.27** [1.19; 1.35] | 0% |  |
| 2 yarış | 6363 | 100% | 750 | 152 (20.3%) | 12.1% | **1.68** [1.47; 1.91] | 2282 | 399 (17.5%) | 12.2% | **1.44** [1.33; 1.55] | 0% |  |
| 3 yarış (tam) | 21294 | 100% | 2245 | 422 (18.8%) | 11.6% | **1.62** [1.49; 1.76] | 7430 | 1128 (15.2%) | 11.6% | **1.31** [1.25; 1.37] | 0% |  |

### 3b. Son Accurace kaydından beri geçen gün
**ACC_HIZ**
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ≤30 gün | 34810 | 88% | 3764 | 859 (22.8%) | 11.7% | **1.94** [1.83; 2.05] | 11354 | 2021 (17.8%) | 11.8% | **1.51** [1.47; 1.55] | 0% |  |
| 31–60 gün | 4779 | 83% | 473 | 106 (22.4%) | 12.0% | **1.86** [1.58; 2.16] | 1349 | 240 (17.8%) | 11.7% | **1.52** [1.34; 1.69] | 0% |  |
| >60 gün | 2382 | 76% | 222 | 31 (14.0%) | 11.7% | **1.19** [0.83; 1.57] | 568 | 67 (11.8%) | 11.1% | **1.06** [0.82; 1.29] | 0% |  |
| hiç kayıt yok | 7212 | 0% | 0 | 0 (0.0%) | 0.0% | **0.00** [—; —] | 0 | 0 (0.0%) | 0.0% | **0.00** [—; —] | 0% | AZ ÖRNEK |

**ACC_BITIRIS**
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| ≤30 gün | 34810 | 87% | 3794 | 708 (18.6%) | 11.8% | **1.58** [1.48; 1.68] | 11407 | 1784 (15.6%) | 11.8% | **1.33** [1.28; 1.37] | 0% |  |
| 31–60 gün | 4779 | 83% | 459 | 92 (20.0%) | 12.0% | **1.67** [1.38; 1.99] | 1313 | 206 (15.7%) | 11.6% | **1.35** [1.18; 1.50] | 0% |  |
| >60 gün | 2382 | 76% | 197 | 24 (12.2%) | 10.6% | **1.15** [0.72; 1.62] | 525 | 63 (12.0%) | 10.9% | **1.10** [0.87; 1.36] | 0% |  |
| hiç kayıt yok | 7212 | 0% | 0 | 0 (0.0%) | 0.0% | **0.00** [—; —] | 0 | 0 (0.0%) | 0.0% | **0.00** [—; —] | 0% | AZ ÖRNEK |

### 3c. Referans seviyesi (1 = ırk+zemin+hipodrom+mesafe; 2 = hipodromsuz)
**ACC_HIZ**
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| seviye 1 | 32460 | 100% | 3929 | 884 (22.5%) | 11.7% | **1.92** [1.81; 2.03] | 11677 | 2089 (17.9%) | 11.7% | **1.53** [1.49; 1.57] | 0% |  |
| seviye 2 | 3901 | 100% | 530 | 112 (21.1%) | 12.1% | **1.75** [1.49; 2.02] | 1594 | 239 (15.0%) | 12.1% | **1.24** [1.13; 1.37] | 0% |  |

**ACC_BITIRIS**
| Grup | At | At kapsamı | Top1 seçimi | kazanan | isabet | beklenen | oran [%95] | Top3 seçimi | kazanan | isabet | beklenen | oran [%95] | Eşit puan payı | Not |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| seviye 1 | 32460 | 100% | 3945 | 737 (18.7%) | 11.7% | **1.60** [1.50; 1.71] | 11689 | 1824 (15.6%) | 11.7% | **1.34** [1.30; 1.38] | 0% |  |
| seviye 2 | 3901 | 100% | 505 | 87 (17.2%) | 12.3% | **1.40** [1.16; 1.65] | 1556 | 229 (14.7%) | 12.2% | **1.20** [1.08; 1.33] | 0% |  |

## 4. Veri kapsamı ve güveni
| Ölçü | At | Oran |
|---|---|---|
| ACC_HIZ hesaplanabildi | 36361 | 73.9% |
| ACC_BITIRIS hesaplanabildi | 36195 | 73.6% |
| İkisi de puansız (ata bağlı değil / geçmiş Accurace yok / zemin farklı / referans yok) | 12822 | 26.1% |
| Puana 3 yarış giren (hız) | 21501 | 43.7% |
| Tahmin edilen ara zaman kullanıldı | 0 | 0.0% |

Yarış sayısı 4931; puanlı at yok / <4 olan yarış: hız 719, bitiriş 735. Normalleştirilemeyen Accurace kaydı: 383 (hız makul değil: 127, ata bağlı değil: 253, kontrol noktaları monoton değil: 3).

## Sınırlar
- Accurace kayıtlarının veritabanına ne zaman girdiği saklanmıyor; tarihler gerçek yarış tarihidir (yarış öncesi) ama "o gün sistemde görünüyor muydu" kanıtlanamaz. Referans, zaman içinde genişler; yıl başı yarışlarında geçmiş yetersizdir.
- Referans sınıf düzeltmesiz: bir Maiden atının hızı tüm sınıfların dağılımına göre yüzdeliğe çevrilir; bu yüzden puanlar sınıfa göre değil genel popülasyona göredir.
- Bu analiz seçim yapmaz: hiçbir gruba göre formül, ağırlık veya sinyal değiştirilmedi. İki bileşenin birleşimi (w_H) test edilmedi; karar sizindir.