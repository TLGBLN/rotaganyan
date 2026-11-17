# TEMPO ADAYI — ERKEN_HIZ ve KOSU_STILI, hedef: 16.11.2026 Bursa K1, 1300 m Kum
**Yeni motora sinyal eklenmedi; `SINYAL_KAYDI` boş; ağırlık/katsayı yok.** Kapsam: yalnız ERKEN_HIZ ve KOSU_STILI (ayrı ayrı); LIDERLIK_BASKISI bir sonraki aşama. Eski `Runner.raceStyle` kullanılmadı. Bu rapor yalnız 16 Kasım **öncesi** değerleri gösterir; yarış sonucu hiçbir yerde kullanılmadı.

**Hedef yarış:** 16.11.2026 Bursa K1, 1300 m, KUM, INGILIZ, Maiden; 9 at. Bu yarışın kendi Accurace kaydı veritabanında **VAR ve hesap DIŞINDA**; bu 9 ata ait tarihi ≥ 16.11.2026 olan 9 kayıt da dışarıda.

## 0. Formüller (sizin tanımınız aynen) ve açık uyarılar
- **ERKEN_HIZ:** V = 400 / (T600 − T200) [m/s]. İlk 100 m (çıkış) ve 100–200 m dışarıda. V, **aynı ırk + yüzey + hipodrom + aynı mesafe** referansında (n ≥ 30; yoksa hipodromsuz) yüzdelik puana (0–100, yüksek = hızlı) çevrilir.
- **KOSU_STILI:** S = 1 − (1/3)·Σ_{d∈{200,400,600}} (R_d − 1)/(N − 1). 1'e yakın = ön, 0'a yakın = geride. İstikrar = son 3 yarıştaki S'nin standart sapması (düşük = istikrarlı).

**Sizden netleştirmem gereken noktalar (varsayımlarım, onay gerekir):**
1. **Pozisyon noktaları:** Metinde "200, 400, 600 **ve 800**", formülde yalnız {200, 400, 600} var. **Formülü uyguladım (800 YOK).** 800 m dahil edilecekse tek satırlık değişiklik; hangisi doğru?
2. **N:** "yarıştaki at sayısı" olarak o yarışın **Accurace'te kaydı olan at sayısı** alındı (sahadaki çekilmeyen at sayısı değil; %12 yarışta bazı atların kaydı eksik). Sıralar 200/400/600'ün üçünde de 1..N geçerli permütasyon değilse veya N < 4 ise o yarışın S'si **hesaplanmadı** (null).
3. **Referans:** ERKEN_HIZ referansına **ırk** eklendi (ACC_HIZ ile tutarlı; metinde hipodrom/yüzey/mesafe yazıyordu). Yüzeyler, referans yüzeye özel olduğu için atın tüm yüzeylerdeki geçmişi birlikte kullanıldı (normalizasyon yüzey farkını alır).
4. **Seçim:** atın **son 3 uygun yarışı** puana girer; daha eski yarışlar ayrıca gösterilir (puana girmez). KOSU_STILI için dört sınıf (ön / takip / orta / geride) **eşiği tanımlı olmadığından sınıflandırma yapılmadı**; S sürekli değer olarak gösterildi.
5. **LIDERLIK_BASKISI:** "rakiplerin öne gitme olasılığı" (P_öncü) ve τ ("veriden belirlenecek") tanımları bu aşamada YOK; ikisi de bir sonraki aşamada sizinle netleştirilecek (τ'yu sonuçlara bakarak ayarlamayacağım).

## 1. 9 atın ERKEN_HIZ ve KOSU_STILI değerleri (16 Kasım öncesi)
| No | At | ERKEN_HIZ (0–100) | Ham V (m/s, son 3 ort.) | KOSU_STILI S (son 3 ort.) | Stil istikrarı (sd, son 3) | S tüm geçmiş (ort. / sd) | Uygun yarış (erken / stil) | Son kayıttan beri | Referans seviyesi | ACC_HIZ (bilgi) | Bağımsız hesap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ARSLANBEYLİ | 86.8 | 17.92 | 0.882 | 0.010 | 0.882 / 0.010 | 2 / 2 | 13 gün | 1 | 44.9 | EŞLEŞTİ |
| 2 | KUMKADI ASLANI | 51.7 | 17.21 | 0.655 | 0.102 | 0.655 / 0.102 | 2 / 2 | 44 gün | 1 | 21.0 | EŞLEŞTİ |
| 3 | MİR BEG | 95.1 | 18.14 | 0.667 | — | 0.667 / — | 1 / 1 | 13 gün | 1 | 27.9 | EŞLEŞTİ |
| 4 | MY NOBLE SON | 18.4 | 17.03 | 0.350 | 0.354 | 0.350 / 0.354 | 3 / 3 | 45 gün | 1 | 10.7 | EŞLEŞTİ |
| 5 | RAŞAMO | 20.6 | 16.95 | 0.739 | 0.067 | 0.532 / 0.321 | 8 / 8 | 45 gün | 1 | 27.8 | EŞLEŞTİ |
| 6 | HOLD ON TO LIFE | 60.1 | 17.54 | 0.730 | 0.166 | 0.416 / 0.366 | 6 / 6 | 7 gün | 1 | 24.8 | EŞLEŞTİ |
| 7 | WORKIN LADY | 26.7 | 17.21 | 0.837 | 0.141 | 0.848 / 0.117 | 4 / 4 | 43 gün | 1 | 19.3 | EŞLEŞTİ |
| 8 | MY LIFE ELİF | 31.3 | 17.00 | 0.167 | — | 0.167 / — | 1 / 1 | 112 gün | 1 | 37.1 | EŞLEŞTİ |
| 9 | STEEL HUNTER | 34.4 | 17.27 | 0.723 | 0.140 | 0.524 / 0.241 | 6 / 6 | 13 gün | 1 | 40.3 | EŞLEŞTİ |

## 2. At at döküm (t'den önceki TÜM Accurace kayıtları)
Sıra sütunları atın 200/400/600 m'deki sırası (R); N = o yarışta Accurace'te kaydı olan at sayısı; "—" = hesaplanamadı (neden: S için sıralar geçerli değil / N<4; V için 200–600 m ara zamanı yok/makul değil). **Kullanım:** SON3 = puana giren; ESKİ = uygun ama son 3 dışında. Referans: seviye · n · ort(m/s) · sd · en yeni referans kaydı tarihi.
### #1 ARSLANBEYLİ (tjkAtId 114754)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 06.10.2026 | KOCAELI | 1200 | KUM | 9 | 14.55 → 37.21 | 17.649 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 0.72 | 77.2 | 2 / 2 / 2 | 0.875 | SON3 / SON3 |
| 03.11.2026 | KOCAELI | 1500 | KUM | 10 | 13.95 → 35.94 | 18.192 | S1 · 214 · 17.617 · 0.348 · 03.11.2026 | 1.65 | 96.5 | 2 / 2 / 2 | 0.889 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(77.2, 96.5) = **86.83** · **KOSU_STILI** = ortalama(0.875, 0.889) = **0.882** (istikrar sd 0.010) · bağımsız ikinci hesap: EŞLEŞTİ

### #2 KUMKADI ASLANI (tjkAtId 112681)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.07.2026 | KOCAELI | 1200 | KUM | 9 | 14.92 → 38.01 | 17.323 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | -0.03 | 50.3 | 5 / 4 / 4 | 0.583 | SON3 / SON3 |
| 03.10.2026 | IZMIR | 1200 | KUM | 12 | 14.46 → 37.87 | 17.091 | S1 · 759 · 17.037 · 0.513 · 14.11.2026 | 0.11 | 53.1 | 5 / 3 / 4 | 0.727 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(50.3, 53.1) = **51.71** · **KOSU_STILI** = ortalama(0.583, 0.727) = **0.655** (istikrar sd 0.102) · bağımsız ikinci hesap: EŞLEŞTİ

### #3 MİR BEG (tjkAtId 112921)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03.11.2026 | KOCAELI | 1500 | KUM | 10 | 14.04 → 36.09 | 18.139 | S1 · 214 · 17.617 · 0.348 · 03.11.2026 | 1.50 | 95.1 | 4 / 4 / 4 | 0.667 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(95.1) = **95.09** · **KOSU_STILI** = ortalama(0.667) = **0.667** (istikrar sd —) · bağımsız ikinci hesap: EŞLEŞTİ

### #4 MY NOBLE SON (tjkAtId 112689)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.09.2026 | IZMIR | 1600 | KUM | 9 | 16.56 → 41.08 | 16.316 | S1 · 642 · 16.688 · 0.473 · 12.11.2026 | -0.79 | 20.7 | 8 / 8 / 8 | 0.125 | SON3 / SON3 |
| 22.09.2026 | KOCAELI | 1400 | KUM | 12 | 14.60 → 37.67 | 17.336 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | -0.83 | 16.1 | 5 / 2 / 4 | 0.758 | SON3 / SON3 |
| 02.10.2026 | BURSA | 1500 | CIM | 11 | 14.84 → 37.80 | 17.424 | S1 · 225 · 17.917 · 0.546 · 22.10.2026 | -0.90 | 18.4 | 9 / 10 / 9 | 0.167 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(20.7, 16.1, 18.4) = **18.43** · **KOSU_STILI** = ortalama(0.125, 0.758, 0.167) = **0.350** (istikrar sd 0.354) · bağımsız ikinci hesap: EŞLEŞTİ

### #5 RAŞAMO (tjkAtId 114264)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 29.06.2026 | BURSA | 1200 | KUM | 9 | 14.10 → 37.65 | 16.985 | S1 · 166 · 17.127 · 0.357 · 31.08.2026 | -0.40 | 37.0 | 4 / 4 / 4 | 0.625 | ESKI / ESKI |
| 21.07.2026 | ANKARA | 1300 | KUM | 4 | 14.10 → 38.34 | 16.500 | S1 · 114 · 17.101 · 0.377 · 07.11.2026 | -1.59 | 2.2 | 4 / 4 / 4 | 0.000 | ESKI / ESKI |
| 02.08.2026 | IZMIR | 1400 | KUM | 5 | 15.10 → 38.60 | 17.021 | S1 · 900 · 17.423 · 0.437 · 12.11.2026 | -0.92 | 16.8 | 4 / 5 / 5 | 0.083 | ESKI / ESKI |
| 11.08.2026 | KOCAELI | 1400 | KUM | 9 | 14.52 → 37.64 | 17.304 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | -0.91 | 14.9 | 5 / 5 / 5 | 0.500 | ESKI / ESKI |
| 28.08.2026 | BURSA | 1400 | KUM | 7 | 14.40 → 39.11 | 16.190 | S1 · 605 · 17.275 · 0.440 · 13.11.2026 | -2.47 | 2.9 | 2 / 2 / 2 | 0.833 | ESKI / ESKI |
| 10.09.2026 | IZMIR | 1600 | KUM | 9 | 15.20 → 40.19 | 16.008 | S1 · 642 · 16.688 · 0.473 · 12.11.2026 | -1.44 | 7.9 | 3 / 3 / 3 | 0.750 | SON3 / SON3 |
| 20.09.2026 | ISTANBUL | 1600 | CIM | 6 | 14.09 → 37.39 | 17.162 | S1 · 464 · 17.451 · 0.435 · 25.10.2026 | -0.66 | 23.1 | 2 / 3 / 3 | 0.667 | SON3 / SON3 |
| 02.10.2026 | BURSA | 1500 | CIM | 11 | 14.31 → 36.93 | 17.681 | S1 · 225 · 17.917 · 0.546 · 22.10.2026 | -0.43 | 30.9 | 3 / 4 / 2 | 0.800 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(7.9, 23.1, 30.9) = **20.61** · **KOSU_STILI** = ortalama(0.750, 0.667, 0.800) = **0.739** (istikrar sd 0.067) · bağımsız ikinci hesap: EŞLEŞTİ

### #6 HOLD ON TO LIFE (tjkAtId 113305)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.06.2026 | BURSA | 1200 | CIM | 8 | 14.37 → 36.56 | 18.025 | S1 · 268 · 17.452 · 0.466 · 21.10.2026 | 1.23 | 91.2 | 8 / 8 / 6 | 0.095 | ESKI / ESKI |
| 03.07.2026 | BURSA | 1200 | CIM | 4 | 14.46 → 37.63 | 17.262 | S1 · 268 · 17.452 · 0.466 · 21.10.2026 | -0.41 | 30.0 | 4 / 4 / 4 | 0.000 | ESKI / ESKI |
| 20.07.2026 | BURSA | 1200 | CIM | 12 | 14.89 → 38.07 | 17.257 | S1 · 268 · 17.452 · 0.466 · 21.10.2026 | -0.42 | 28.5 | 9 / 10 / 10 | 0.212 | ESKI / ESKI |
| 12.10.2026 | BURSA | 1400 | CIM | 11 | 14.11 → 36.24 | 18.074 | S1 · 360 · 17.732 · 0.375 · 26.10.2026 | 0.91 | 83.3 | 3 / 2 / 2 | 0.867 | SON3 / SON3 |
| 30.10.2026 | BURSA | 1400 | KUM | 12 | 14.49 → 38.15 | 16.907 | S1 · 605 · 17.275 · 0.440 · 13.11.2026 | -0.84 | 15.0 | 4 / 6 / 8 | 0.545 | SON3 / SON3 |
| 09.11.2026 | BURSA | 1400 | KUM | 10 | 14.44 → 37.14 | 17.626 | S1 · 605 · 17.275 · 0.440 · 13.11.2026 | 0.80 | 82.0 | 5 / 2 / 2 | 0.778 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(83.3, 15.0, 82.0) = **60.09** · **KOSU_STILI** = ortalama(0.867, 0.545, 0.778) = **0.730** (istikrar sd 0.166) · bağımsız ikinci hesap: EŞLEŞTİ

### #7 WORKIN LADY (tjkAtId 113879)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.08.2026 | KOCAELI | 1200 | KUM | 12 | 13.99 → 37.34 | 17.130 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | -0.48 | 30.8 | 1 / 3 / 3 | 0.879 | ESKI / ESKI |
| 04.09.2026 | BURSA | 1400 | CIM | 8 | 14.07 → 37.50 | 17.077 | S1 · 360 · 17.732 · 0.375 · 26.10.2026 | -1.74 | 3.5 | 1 / 1 / 1 | 1.000 | SON3 / SON3 |
| 11.09.2026 | BURSA | 1300 | CIM | 13 | 13.58 → 36.13 | 17.734 | S1 · 239 · 17.461 · 0.511 · 23.10.2026 | 0.53 | 63.4 | 3 / 4 / 5 | 0.750 | SON3 / SON3 |
| 04.10.2026 | ISTANBUL | 1200 | CIM | 8 | 13.65 → 37.42 | 16.829 | S1 · 270 · 17.418 · 0.618 · 15.11.2026 | -0.95 | 13.1 | 2 / 3 / 3 | 0.762 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(3.5, 63.4, 13.1) = **26.67** · **KOSU_STILI** = ortalama(1.000, 0.750, 0.762) = **0.837** (istikrar sd 0.141) · bağımsız ikinci hesap: EŞLEŞTİ

### #8 MY LIFE ELİF (tjkAtId 122794)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.07.2026 | BURSA | 1300 | KUM | 7 | 14.63 → 38.16 | 16.998 | S1 · 209 · 17.174 · 0.342 · 02.11.2026 | -0.51 | 31.3 | 6 / 6 / 6 | 0.167 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(31.3) = **31.34** · **KOSU_STILI** = ortalama(0.167) = **0.167** (istikrar sd —) · bağımsız ikinci hesap: EŞLEŞTİ

### #9 STEEL HUNTER (tjkAtId 116717)
| Tarih | Hip. | Mesafe | Zemin | N | T200 → T600 (sn) | V (m/s) | Referans | z | ERKEN yüzdelik | R200 / R400 / R600 | S | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.08.2026 | KOCAELI | 1200 | KUM | 11 | 14.84 → 38.27 | 17.073 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | -0.61 | 25.4 | 10 / 7 / 9 | 0.233 | ESKI / ESKI |
| 08.09.2026 | KOCAELI | 1400 | KUM | 9 | 14.95 → 38.53 | 16.967 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | -1.78 | 6.1 | 6 / 6 / 6 | 0.375 | ESKI / ESKI |
| 22.09.2026 | KOCAELI | 1400 | KUM | 12 | 14.67 → 37.36 | 17.626 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | -0.08 | 43.0 | 7 / 10 / 7 | 0.364 | ESKI / ESKI |
| 13.10.2026 | KOCAELI | 1200 | KUM | 13 | 14.43 → 37.92 | 17.025 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | -0.72 | 22.2 | 4 / 5 / 5 | 0.694 | SON3 / SON3 |
| 20.10.2026 | KOCAELI | 1200 | KUM | 9 | 14.22 → 37.17 | 17.428 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 0.21 | 60.5 | 2 / 2 / 2 | 0.875 | SON3 / SON3 |
| 03.11.2026 | KOCAELI | 1500 | KUM | 11 | 13.76 → 36.82 | 17.346 | S1 · 214 · 17.617 · 0.348 · 03.11.2026 | -0.78 | 20.3 | 5 / 4 / 6 | 0.600 | SON3 / SON3 |

**ERKEN_HIZ** = ortalama(22.2, 60.5, 20.3) = **34.36** · **KOSU_STILI** = ortalama(0.694, 0.875, 0.600) = **0.723** (istikrar sd 0.140) · bağımsız ikinci hesap: EŞLEŞTİ

## 3. Zaman bütünlüğü ve doğrulama
- **Hedef gün hariç:** kullanılan her kaydın tarihi < 16.11.2026; en yeni kullanılan kayıt **09.11.2026**, en yeni referans kaydı **15.11.2026**. Yarış sonrası veri kullanan hesap: **0 (GEÇERSİZ yok)**.
- **Gelecek-bozma testi:** 16.11.2026 ve sonrası TÜM kayıtlar (süre, sıra) bozulup aynı güne ve geleceğe uç değerli sahte kayıtlar eklenerek yeniden hesaplandı: 9 atın bileşenleri **birebir aynı kaldı (sızıntı yok)**. Birim testleri (`tempo-aday.test.ts`, formül sayısal örneği dahil) ve yapısal kural geçti.
- **Bağımsız ikinci hesap** (modüle bakmadan, ham kontrol noktalarından düz döngüyle; sıra geçerliliği de ham yarıştan yeniden): 9 at karşılaştırıldı, **uyuşmayan 0**.
- Normalleştirilemeyen kayıt: 265 (ara zamanlar monoton değil: 12, ata bağlı değil: 253). Sıra geçerliliği: 4877/4974 yarışta 200/400/600'de sıralar geçerli.
- **Makul-hız sınırı (V için 10–20 m/s) ve düzeltilen hata:** ilk sürümde üst sınırı ACC_HIZ'dan taşıyarak 18 m/s bırakmıştım; bu, yarışın en hızlı bölümü olan 200–600 m'de geçerli olan 18,0–19,75 m/s değerlerini (ham dağılımda 1529 kayıt, kuyruğun doğal devamı; 20 m/s üstü 0) sessizce dışarıda bırakıyordu — yani en hızlı çıkış yapan atların yarışları ERKEN_HIZ'dan düşüyordu (ör. 03.11 Kocaeli 1500 m'de ARSLANBEYLİ 18,19 m/s). Sınır, sonuçlara değil ham V dağılımına bakılarak 20 m/s yapıldı ve rapor yeniden üretildi.
- **Sonuç etiketi:** hesapta yarış sonucu hiçbir yerde okunmadı (araç Result tablosuna erişmez).

## 4. Sınırlar
- Accurace kayıtlarının veritabanına NE ZAMAN girdiği saklanmıyor; tarihler gerçek yarış tarihidir (< 16 Kasım) ama "o gün sistemde görünüyor muydu" kanıtlanamaz. Konum çözünürlüğü 100 m; ilk 100 m çıkış ivmesi (dışarıda).
- Sıra (R) yalnız Accurace'te kaydı olan atlar arasındadır; eksik at kayıtlı yarışlarda N küçülür. Küçük sahalarda (R−1)/(N−1) kaba çözünürlüktedir (N ≥ 4 şartı).
- Bu rapor TEMPO bileşenlerinin geçmiş yarışlarda tahmin gücünü test ETMEZ; testler sonraki adımda, onayınızla. ACC_HIZ ile bilgi tekrarı denetimi de sonraki adımdadır (bilgi sütunu yalnız yan yana görmek içindir).