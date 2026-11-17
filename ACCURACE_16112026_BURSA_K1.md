# ACCURACE ADAYI — ACC_HIZ ve ACC_BITIRIS, hedef: 16.11.2026 Bursa (Osmangazi) K1, 1300 m Kum
**Yeni model, katsayı, ağırlık (w_H) veya sinyal YOK; `SINYAL_KAYDI` boş.** İki bileşen AYRI hesaplanır; birleşik ACCURACE bu raporda KURULMADI (ağırlık kararı sizindir). Koşu stili / liderlik baskısı TEMPO modülüne bırakıldı. Bu rapor yalnız 16 Kasım **öncesi** puanları gösterir; yarış sonucu hiçbir yerde kullanılmadı.

**Hedef yarış:** 16.11.2026 Bursa K1, 1300 m, KUM, INGILIZ, Maiden; 9 at. Bu yarışın kendi Accurace kaydı veritabanında **VAR ve hesap DIŞINDA bırakıldı**; bu 9 ata ait tarihi ≥ 16.11.2026 olan toplam 9 Accurace kaydı da dışarıda. Referans evreni: yalnız tarih < 16.11.2026 (48563 at-yarış kaydı).

## 0. Yöntem
- **Kayıt:** 48907 at-yarış Accurace kaydı (2026-01-01 → 2026-11-17); normalleştirilemeyen 383 (hız makul değil: 127, ata bağlı değil: 253, kontrol noktaları monoton değil: 3); 48524 kullanılabilir. Ata bağlantısı: Runner.tjkAtId; ırk/zemin: yarışın kaydı (K=Kum, Ç=Çim, S=Sentetik).
- **ACC_HIZ:** atın her geçmiş yarışındaki bitiş süresi, **aynı ırk + zemin + hipodrom + aynı mesafe** referansındaki (n ≥ 30) bitiş sürelerinin dağılımında yüzdelik puana çevrilir (hızlı = yüksek; yavaş süre oranı + beraberlikte yarım). Hipodromda n yetmezse **aynı ırk + zemin + mesafe** (tüm hipodromlar) referansı (seviye 2). Hiçbirinde n yetmezse BİLİNMİYOR. Ham derece veya bitiş sırası puanlanmaz.
- **ACC_BITIRIS:** son 800 m süresi = bitiş − (mesafe−800). metredeki kümülatif süre. Aynı referans grubunda `son800 ~ a + b·(erken bölüm süresi)` doğrusu kurulur; atın **beklenen kapanıştan farkı (artık)** referans artıklarının dağılımında yüzdelik puana çevrilir (beklenenden iyi = yüksek). Erken bölümü çok yavaş koşan atın hızlı kapanışı otomatik üstün sayılmaz: beklenen kapanış erken süreye göre artar.
- **Seçim:** yalnız **hedefle aynı zemin (Kum)** yarışları; kum/çim/sentetik karıştırılmaz (farklı zemin kayıtları tabloda "dışlandı" olarak görünür). Puan = **son 3 uygun yarışın** yüzdelik ortalaması; daha eski uygun yarışlar ve toplam uygun sayısı ayrıca gösterilir (puana girmez). Mesafe < 1000 m yarışta bitiriş hesaplanmaz (hız hesaplanır). 800 m'ye ait ara zaman yoksa komşu kontrol noktalarından doğrusal TAHMİN yapılır ve **"tahmin"** işaretlenir (referans grubuna girmez). Eksik veri 0 puan sayılmaz.

## 1. 9 atın puanları (16 Kasım öncesi)
| No | At | ACC_HIZ (0–100) | ACC_BITIRIS (0–100) | Uygun yarış (hız / bitiriş) | Puana giren (hız / bitiriş) | Son kayıttan beri | Tahmin ara zaman | Referans seviyesi (1=hipodromlu) | Tüm uygun yarış ort. (hız / bitiriş) | Bağımsız hesap |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ARSLANBEYLİ | 44.9 | 35.1 | 2 / 2 | 2 / 2 | 13 gün | 0 | 1 | 44.9 / 35.1 | EŞLEŞTİ |
| 2 | KUMKADI ASLANI | 21.0 | 16.7 | 2 / 2 | 2 / 2 | 44 gün | 0 | 1 | 21.0 / 16.7 | EŞLEŞTİ |
| 3 | MİR BEG | 27.9 | 18.1 | 1 / 1 | 1 / 1 | 13 gün | 0 | 1 | 27.9 / 18.1 | EŞLEŞTİ |
| 4 | MY NOBLE SON | 10.7 | 19.0 | 2 / 2 | 2 / 2 | 45 gün | 0 | 1 | 10.7 / 19.0 | EŞLEŞTİ |
| 5 | RAŞAMO | 27.8 | 44.5 | 6 / 6 | 3 / 3 | 45 gün | 0 | 1 | 21.7 / 33.1 | EŞLEŞTİ |
| 6 | HOLD ON TO LIFE | 24.8 | 24.7 | 2 / 2 | 2 / 2 | 7 gün | 0 | 1 | 24.8 / 24.7 | EŞLEŞTİ |
| 7 | WORKIN LADY | 19.3 | 10.1 | 1 / 1 | 1 / 1 | 43 gün | 0 | 1 | 19.3 / 10.1 | EŞLEŞTİ |
| 8 | MY LIFE ELİF | 37.1 | 44.7 | 1 / 1 | 1 / 1 | 112 gün | 0 | 1 | 37.1 / 44.7 | EŞLEŞTİ |
| 9 | STEEL HUNTER | 40.3 | 35.9 | 6 / 6 | 3 / 3 | 13 gün | 0 | 1 | 29.6 / 29.4 | EŞLEŞTİ |

Eşit puanlı atlar — ACC_HIZ: yok · ACC_BITIRIS: yok. Puansız (bilinmiyor) atlar: yok.

## 2. At at döküm (t'den önceki TÜM Accurace kayıtları)
Tablo: her geçmiş yarış. **Kullanım:** SON3 = puana giren; ESKİ = uygun ama son 3 dışında; dışlandı = zemin farklı / referans yok / bitiriş hesaplanamıyor. HIZ ve BİTİRİŞ referansı: seviye · n · ort(sn) · sd(sn) (bitiriş için: a · b · artık sd) · en yeni referans kaydı tarihi.
### #1 ARSLANBEYLİ (tjkAtId 114754)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 06.10.2026 | KOCAELI | 1200 | KUM | 77.56 | 25.41 → 52.15 | +1.52 | S1 · 313 · 78.35 · 2.71 · 03.11.2026 | 56.7 (z 0.29) | S1 · n313 · a 47.33 b 0.211 · sd 2.24 · 03.11.2026 | 52.70 → -0.55 | 51.6 | hız SON3 · bitiriş SON3 |
| 03.11.2026 | KOCAELI | 1500 | KUM | 98.22 | 41.88 → 56.34 | +2.82 | S1 · 213 · 97.97 · 3.72 · 03.11.2026 | 33.1 (z -0.07) | S1 · n213 · a 20.39 b 0.797 · sd 3.35 · 03.11.2026 | 53.78 → +2.57 | 18.5 | hız SON3 · bitiriş SON3 |

**ACC_HIZ** = ortalama(56.7, 33.1) = **44.90** · **ACC_BITIRIS** = ortalama(51.6, 18.5) = **35.07** · bağımsız ikinci hesap: EŞLEŞTİ

### #2 KUMKADI ASLANI (tjkAtId 112681)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.07.2026 | KOCAELI | 1200 | KUM | 80.40 | 26.06 → 54.34 | +3.21 | S1 · 313 · 78.35 · 2.71 · 03.11.2026 | 16.5 (z -0.76) | S1 · n313 · a 47.33 b 0.211 · sd 2.24 · 03.11.2026 | 52.84 → +1.50 | 17.7 | hız SON3 · bitiriş SON3 |
| 03.10.2026 | IZMIR | 1200 | KUM | 78.41 | 25.42 → 52.98 | +3.11 | S1 · 760 · 77.25 · 3.12 · 14.11.2026 | 25.5 (z -0.37) | S1 · n759 · a 26.77 b 0.958 · sd 2.07 · 14.11.2026 | 51.12 → +1.86 | 15.6 | hız SON3 · bitiriş SON3 |

**ACC_HIZ** = ortalama(16.5, 25.5) = **20.96** · **ACC_BITIRIS** = ortalama(17.7, 15.6) = **16.67** · bağımsız ikinci hesap: EŞLEŞTİ

### #3 MİR BEG (tjkAtId 112921)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03.11.2026 | KOCAELI | 1500 | KUM | 98.52 | 42.03 → 56.49 | +2.97 | S1 · 213 · 97.97 · 3.72 · 03.11.2026 | 27.9 (z -0.15) | S1 · n213 · a 20.39 b 0.797 · sd 3.35 · 03.11.2026 | 53.90 → +2.60 | 18.1 | hız SON3 · bitiriş SON3 |

**ACC_HIZ** = ortalama(27.9) = **27.93** · **ACC_BITIRIS** = ortalama(18.1) = **18.08** · bağımsız ikinci hesap: EŞLEŞTİ

### #4 MY NOBLE SON (tjkAtId 112689)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.09.2026 | IZMIR | 1600 | KUM | 108.36 | 53.30 → 55.05 | +3.18 | S1 · 642 · 105.04 · 3.35 · 12.11.2026 | 12.5 (z -0.99) | S1 · n642 · a 40.34 b 0.266 · sd 2.97 · 12.11.2026 | 54.49 → +0.56 | 29.4 | hız SON3 · bitiriş SON3 |
| 22.09.2026 | KOCAELI | 1400 | KUM | 96.40 | 37.67 → 58.72 | +5.24 | S1 · 518 · 91.57 · 3.38 · 10.11.2026 | 8.8 (z -1.43) | S1 · n518 · a 39.87 b 0.385 · sd 3.11 · 10.11.2026 | 54.37 → +4.35 | 8.6 | hız SON3 · bitiriş SON3 |
| 02.10.2026 | BURSA | 1500 | CIM | 97.31 | 44.07 → 53.23 | +0.84 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |

**ACC_HIZ** = ortalama(12.5, 8.8) = **10.66** · **ACC_BITIRIS** = ortalama(29.4, 8.6) = **18.98** · bağımsız ikinci hesap: EŞLEŞTİ

### #5 RAŞAMO (tjkAtId 114264)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 29.06.2026 | BURSA | 1200 | KUM | 79.73 | 25.24 → 54.49 | +3.38 | S1 · 166 · 76.34 · 2.07 · 31.08.2026 | 7.5 (z -1.64) | S1 · n166 · a 48.39 b 0.099 · sd 1.82 · 31.08.2026 | 50.89 → +3.59 | 6.9 | hız ESKI · bitiriş ESKI |
| 21.07.2026 | ANKARA | 1300 | KUM | 87.62 | 32.00 → 55.62 | +2.91 | S1 · 114 · 84.06 · 2.67 · 07.11.2026 | 12.7 (z -1.34) | S1 · n114 · a 36.54 b 0.522 · sd 2.48 · 07.11.2026 | 53.24 → +2.38 | 17.1 | hız ESKI · bitiriş ESKI |
| 02.08.2026 | IZMIR | 1400 | KUM | 91.72 | 38.60 → 53.12 | +2.14 | S1 · 900 · 90.41 · 2.67 · 12.11.2026 | 26.7 (z -0.49) | S1 · n900 · a 34.11 b 0.491 · sd 2.23 · 12.11.2026 | 53.06 → +0.06 | 40.7 | hız ESKI · bitiriş ESKI |
| 11.08.2026 | KOCAELI | 1400 | KUM | 92.11 | 37.64 → 54.47 | +1.95 | S1 · 518 · 91.57 · 3.38 · 10.11.2026 | 32.7 (z -0.16) | S1 · n518 · a 39.87 b 0.385 · sd 3.11 · 10.11.2026 | 54.36 → +0.11 | 35.0 | hız SON3 · bitiriş SON3 |
| 28.08.2026 | BURSA | 1400 | KUM | 92.46 | 39.11 → 53.35 | +1.74 | S1 · 604 · 90.59 · 3.21 · 13.11.2026 | 21.1 (z -0.58) | S1 · n604 · a 38.01 b 0.399 · sd 2.99 · 13.11.2026 | 53.62 → -0.27 | 44.5 | hız SON3 · bitiriş SON3 |
| 10.09.2026 | IZMIR | 1600 | KUM | 106.00 | 52.60 → 53.41 | +1.53 | S1 · 642 · 105.04 · 3.35 · 12.11.2026 | 29.7 (z -0.29) | S1 · n642 · a 40.34 b 0.266 · sd 2.97 · 12.11.2026 | 54.30 → -0.90 | 54.1 | hız SON3 · bitiriş SON3 |
| 20.09.2026 | ISTANBUL | 1600 | CIM | 101.19 | 49.69 → 51.49 | +2.58 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |
| 02.10.2026 | BURSA | 1500 | CIM | 101.85 | 43.15 → 58.70 | +6.30 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |

**ACC_HIZ** = ortalama(32.7, 21.1, 29.7) = **27.83** · **ACC_BITIRIS** = ortalama(35.0, 44.5, 54.1) = **44.54** · bağımsız ikinci hesap: EŞLEŞTİ

### #6 HOLD ON TO LIFE (tjkAtId 113305)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.06.2026 | BURSA | 1200 | CIM | 72.95 | 25.28 → 47.67 | +0.45 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |
| 03.07.2026 | BURSA | 1200 | CIM | 72.89 | 26.02 → 46.88 | +0.05 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |
| 20.07.2026 | BURSA | 1200 | CIM | 73.76 | 26.26 → 47.50 | +0.21 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |
| 12.10.2026 | BURSA | 1400 | CIM | 86.00 | 36.24 → 49.75 | +1.35 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |
| 30.10.2026 | BURSA | 1400 | KUM | 92.07 | 38.15 → 53.92 | +0.17 | S1 · 604 · 90.59 · 3.21 · 13.11.2026 | 24.1 (z -0.46) | S1 · n604 · a 38.01 b 0.399 · sd 2.99 · 13.11.2026 | 53.24 → +0.68 | 30.2 | hız SON3 · bitiriş SON3 |
| 09.11.2026 | BURSA | 1400 | KUM | 91.94 | 37.14 → 54.80 | +1.17 | S1 · 604 · 90.59 · 3.21 · 13.11.2026 | 25.4 (z -0.42) | S1 · n604 · a 38.01 b 0.399 · sd 2.99 · 13.11.2026 | 52.83 → +1.97 | 19.1 | hız SON3 · bitiriş SON3 |

**ACC_HIZ** = ortalama(24.1, 25.4) = **24.75** · **ACC_BITIRIS** = ortalama(30.2, 19.1) = **24.67** · bağımsız ikinci hesap: EŞLEŞTİ

### #7 WORKIN LADY (tjkAtId 113879)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.08.2026 | KOCAELI | 1200 | KUM | 80.01 | 24.79 → 55.22 | +3.64 | S1 · 313 · 78.35 · 2.71 · 03.11.2026 | 19.3 (z -0.61) | S1 · n313 · a 47.33 b 0.211 · sd 2.24 · 03.11.2026 | 52.57 → +2.64 | 10.1 | hız SON3 · bitiriş SON3 |
| 04.09.2026 | BURSA | 1400 | CIM | 86.86 | 37.50 → 49.37 | +0.84 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |
| 11.09.2026 | BURSA | 1300 | CIM | 87.53 | 30.20 → 57.34 | +9.44 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |
| 04.10.2026 | ISTANBUL | 1200 | CIM | 79.41 | 25.28 → 54.13 | +5.21 | — | — | — | — | — | dışlandı: zemin farklı (CIM ≠ KUM) — karıştırılmadı |

**ACC_HIZ** = ortalama(19.3) = **19.33** · **ACC_BITIRIS** = ortalama(10.1) = **10.06** · bağımsız ikinci hesap: EŞLEŞTİ

### #8 MY LIFE ELİF (tjkAtId 122794)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.07.2026 | BURSA | 1300 | KUM | 84.23 | 31.87 → 52.36 | +0.95 | S1 · 209 · 83.86 · 2.89 · 02.11.2026 | 37.1 (z -0.13) | S1 · n209 · a 37.06 b 0.490 · sd 2.58 · 02.11.2026 | 52.68 → -0.32 | 44.7 | hız SON3 · bitiriş SON3 |

**ACC_HIZ** = ortalama(37.1) = **37.08** · **ACC_BITIRIS** = ortalama(44.7) = **44.74** · bağımsız ikinci hesap: EŞLEŞTİ

### #9 STEEL HUNTER (tjkAtId 116717)
| Tarih | Hip. | Mesafe | Zemin | Süre (sn) | 500 m süre → son 800 (sn) | Yarış-içi son 800 farkı (en hızlıya göre) | HIZ referansı | HIZ yüzdelik (z) | BİTİRİŞ referansı | Beklenen son 800 → artık | BİTİRİŞ yüzdelik | Kullanım |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.08.2026 | KOCAELI | 1200 | KUM | 79.28 | 25.65 → 53.63 | +2.03 | S1 · 313 · 78.35 · 2.71 · 03.11.2026 | 27.3 (z -0.35) | S1 · n313 · a 47.33 b 0.211 · sd 2.24 · 03.11.2026 | 52.75 → +0.88 | 26.4 | hız ESKI · bitiriş ESKI |
| 08.09.2026 | KOCAELI | 1400 | KUM | 93.40 | 38.53 → 54.87 | +3.03 | S1 · 518 · 91.57 · 3.38 · 10.11.2026 | 20.6 (z -0.54) | S1 · n518 · a 39.87 b 0.385 · sd 3.11 · 10.11.2026 | 54.70 → +0.17 | 34.7 | hız ESKI · bitiriş ESKI |
| 22.09.2026 | KOCAELI | 1400 | KUM | 96.36 | 37.36 → 59.00 | +5.40 | S1 · 518 · 91.57 · 3.38 · 10.11.2026 | 9.0 (z -1.41) | S1 · n518 · a 39.87 b 0.385 · sd 3.11 · 10.11.2026 | 54.25 → +4.74 | 7.4 | hız ESKI · bitiriş ESKI |
| 13.10.2026 | KOCAELI | 1200 | KUM | 78.57 | 25.69 → 52.88 | +2.64 | S1 · 313 · 78.35 · 2.71 · 03.11.2026 | 38.2 (z -0.08) | S1 · n313 · a 47.33 b 0.211 · sd 2.24 · 03.11.2026 | 52.76 → +0.12 | 39.8 | hız SON3 · bitiriş SON3 |
| 20.10.2026 | KOCAELI | 1200 | KUM | 77.84 | 25.06 → 52.78 | +2.01 | S1 · 313 · 78.35 · 2.71 · 03.11.2026 | 51.0 (z 0.19) | S1 · n313 · a 47.33 b 0.211 · sd 2.24 · 03.11.2026 | 52.63 → +0.15 | 39.1 | hız SON3 · bitiriş SON3 |
| 03.11.2026 | KOCAELI | 1500 | KUM | 98.29 | 43.01 → 55.28 | +1.34 | S1 · 213 · 97.97 · 3.72 · 03.11.2026 | 31.7 (z -0.09) | S1 · n213 · a 20.39 b 0.797 · sd 3.35 · 03.11.2026 | 54.67 → +0.61 | 28.9 | hız SON3 · bitiriş SON3 |

**ACC_HIZ** = ortalama(38.2, 51.0, 31.7) = **40.28** · **ACC_BITIRIS** = ortalama(39.8, 39.1, 28.9) = **35.93** · bağımsız ikinci hesap: EŞLEŞTİ

## 3. Sizin örnek "son 800 m farkları" ile karşılaştırma
Bildirdiğiniz farkların tanımı verilmedi; "+" işareti ve değerler, **o yarışta en hızlı son 800'e göre kaybedilen saniye** biçiminde okunabilir. Aşağıda aynı tanımla bu sistemin kum yarışları için hesapladığı fark (16 Kasım hariç) yan yana. Tanımınız farklıysa uyuşmazlık beklenir; bunu sonucu zorlamadan olduğu gibi gösteriyorum.
| At | Sizin farklar | Bu sistemde Kum yarışları: son 800 farkı (eskiden yeniye) | Tarihler | Eşleşme |
|---|---|---|---|---|
| ARSLANBEYLİ | +2,82 / +1,52 | +1.52 / +2.82 | 06.10.2026 / 03.11.2026 | 2/2 değer eşleşti (±0,015 sn) |
| MİR BEG | +2,97 | +2.97 | 03.11.2026 | 1/1 değer eşleşti (±0,015 sn) |
| RAŞAMO | +1,53 / +1,74 / +1,95 | +3.38 / +2.91 / +2.14 / +1.95 / +1.74 / +1.53 | 29.06.2026 / 21.07.2026 / 02.08.2026 / 11.08.2026 / 28.08.2026 / 10.09.2026 | 3/3 değer eşleşti (±0,015 sn) |
| HOLD ON TO LIFE | +0,17 / +1,17 | +0.17 / +1.17 | 30.10.2026 / 09.11.2026 | 2/2 değer eşleşti (±0,015 sn) |
| MY LIFE ELİF | +0,95 (Temmuz) | +0.95 | 27.07.2026 | 1/1 değer eşleşti (±0,015 sn) |
| STEEL HUNTER | +1,34 / +2,01 / +2,64 | +2.03 / +3.03 / +5.40 / +2.64 / +2.01 / +1.34 | 25.08.2026 / 08.09.2026 / 22.09.2026 / 13.10.2026 / 20.10.2026 / 03.11.2026 | 3/3 değer eşleşti (±0,015 sn) |

## 4. Zaman bütünlüğü ve doğrulama
- **Hedef gün hariç:** kullanılan her kaydın tarihi < 16.11.2026: en yeni kullanılan kayıt **09.11.2026**, hiçbir referans havuzunda 16.11.2026 veya sonrası yok (en yeni referans kaydı **14.11.2026**). Yarış sonrası veri kullanan hesap: **0 (GEÇERSİZ yok)**.
- **Gelecek-bozma testi:** 16.11.2026 ve sonrası TÜM kayıtlar bozulup, aynı güne ve geleceğe uç değerli sahte kayıtlar eklenerek yeniden hesaplandı: 9 atın bileşenleri **birebir aynı kaldı (sızıntı yok)**. Birim testleri (`accurace-aday.test.ts`) ve yapısal kural (saf dosya: db/ağ/saat/rastgele/sonuç yok) geçti.
- **Bağımsız ikinci hesap** (modüle bakmadan, ham kontrol noktalarından düz döngüyle): 9 at karşılaştırıldı, **uyuşmayan 0**.
- **Sonuç etiketi:** hesapta yarış sonucu hiçbir yerde okunmadı (bu araç Result tablosuna hiç erişmez).

## 5. Sınırlar
- **Referans sınıf/ırk karması:** referans, aynı ırk+zemin+mesafedeki TÜM yarışlardır (Maiden'den Gruba); sınıf düzeltmesi yapılmadı. Bu yüzden ACC_HIZ, atın "o mesafede o zemindeki genel yarış popülasyonuna göre" hızını gösterir, sınıfına göre değil.
- Accurace kayıtlarının veritabanına **ne zaman** girdiği saklanmıyor; tarihler gerçek yarış tarihidir (< 16 Kasım) ama "o gün sistemde görünüyor muydu" kanıtlanamaz. Hipodrom bazlı referanslar küçük olabilir (n gösterildi).
- Yalnız son 3 uygun yarış puana girer; tek uygun yarışı olan atın puanı o tek yarışa dayanır (veri güveni sütunlarına bakınız, puana katılmaz).
- Bu rapor ACC_HIZ ve ACC_BITIRIS'in **geçmiş yarışlarda tahmin gücünü** henüz test etmez; testler bir sonraki adımda, onayınızla.