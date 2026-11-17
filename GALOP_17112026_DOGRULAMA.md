# GALOP_17112026_DOGRULAMA — 17.11.2026 Adana ve Antalya galop adayı doğrulaması
Üretim: araç `arac-galop-dogrulama-17112026.mts` (salt-okuma). **Yeni model, katsayı veya sinyal eklenmedi; `SINYAL_KAYDI` boş.** Yarış günü t = 2026-11-17 00:00 UTC; tüm galop/referans filtreleri **tarih < t** (yarış günü dahil değil).

## 0. Yöntem ve doğrulama mantığı
1. Hesap, ham `Gallop` satırlarından **galop-aday.ts'e güvenmeden** (ayrı kod, düz döngü, artımlı önbellek yok) yeniden yapıldı (A). Aynı atlar için modülün (galop-aday.ts) çıktısı bire bir karşılaştırıldı (B).
2. Her galop için kullanılan referans havuzunun üye sayısı, ortalaması, standart sapması ve **havuzdaki en yeni galop tarihi** gösterildi (C). Havuzda t ve sonrası bir galop varsa o hesap **GEÇERSİZ** işaretlenir.
3. Top1/Top3, sonuç etiketleri puanlar kilitlendikten SONRA yüklenerek yeniden üretildi (D, E).

**Veri özeti:** ham galop satırı 75228; normalleştirilemeyen 2330 (tjkAtId yok: 22, süre yok: 2141, hız makul değil: 35, mesafe<400: 111, süreler monoton değil: 21); mükerrer kaldırıldıktan sonra benzersiz idman 54899; **t'den önceki** referans havuzu 54896 idman, havuzun en yeni galop tarihi **16.11.2026**. Efor referansı: 54755 kayıt, ort 3.700 sd 0.896, en yeni tarih 16.11.2026.

## 1–3. Yarış yarış, at at döküm
### Adana K1 (1300 m) — 11 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #3 HOPE HEAD
Eşit puanlı atlar — KAPASİTE: #6=#8 (33.3) | HAZIRLIK: #1=#4=#10 (20.0) · #2=#7=#9 (60.0)

#### Adana K1 #1 TIMEWARDEN (tjkAtId 114408) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 21.08.2026 | GALOP | 600 m | 37.70 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 64.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 600 m | 37.00 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 37.70 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 64.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 64.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 40.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.09.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 37.90 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 37.90 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 51.00 | 25.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 800 m | 47.20 | 23.60 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 49.70 | 24.80 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 1.12 | 24.55 · 0.25 · 0.70 · 2699 | -0.35 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.12] → ortalama **1.123** · kapanış: [-0.35] → **-0.351** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.950 · kapanış 0.650 · efor 0.600 · trend — · süreklilik 0.200
**KAPASİTE** = ortalama(0.950, 0.650, 0.600) = **73.3** · **HAZIRLIK** = ortalama(0.200) = **20.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #2 SAND PIPER (tjkAtId 116617) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15.08.2026 | GALOP | 600 m | 45.80 | 31.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 44.00 | 29.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 41.00 | 27.50 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 800 m | 54.30 | 26.80 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 600 m | 44.00 | 29.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | GALOP | 600 m | 46.00 | 30.50 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 1000 m | 72.40 | 28.50 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 43.00 | 28.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 43.50 | 28.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.11.2026 | GALOP | 600 m | 42.80 | 28.00 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | -1.67 | 28.11 · -0.11 · 0.48 · 907 | 0.23 | 0.34 |
| 14.11.2026 | GALOP | 800 m | 52.30 | 26.00 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | 0.29 | 25.77 · 0.23 · 0.92 · 747 | -0.25 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-1.67, 0.29] → ortalama **-0.694** · kapanış: [0.23, -0.25] → **-0.008** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (12.11.2026, 14.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.350 · kapanış 0.950 · efor 0.600 · trend — · süreklilik 0.600
**KAPASİTE** = ortalama(0.350, 0.950, 0.600) = **63.3** · **HAZIRLIK** = ortalama(0.600) = **60.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #3 HOPE HEAD (tjkAtId 116606) — önceki koşu: 09.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03.10.2026 | GALOP | 800 m | 55.30 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 800 m | 57.60 | 27.70 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 800 m | 52.00 | 26.60 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 800 m | 56.20 | 28.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #4 IRON VALOR (tjkAtId 113108) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 30.10.2026 | SPRINT | 400 m | 27.30 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 41.00 | 27.50 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -1.17 | 26.83 · 0.67 · 0.45 · 3203 | -1.49 | 0.34 |
| 15.11.2026 | Sprint | — | — | — | R | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |

**Ara adımlar** — hız: son 1 hızZ [-1.17] → ortalama **-1.168** · kapanış: [-1.49] → **-1.485** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (13.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.050 · kapanış 0.050 · efor 0.600 · trend — · süreklilik 0.200
**KAPASİTE** = ortalama(0.050, 0.050, 0.600) = **23.3** · **HAZIRLIK** = ortalama(0.200) = **20.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #5 LODBROK (tjkAtId 115313) — önceki koşu: 20.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.08.2026 | GALOP | 800 m | 52.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 51.40 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 51.50 | 25.60 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 48.60 | 24.50 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 38.80 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 62.00 | 24.50 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 38.50 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | SPRINT | 400 m | 26.20 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 52.90 | 26.50 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.23 | 26.12 · 0.38 · 0.70 · 2699 | -0.55 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.07 | 25.51 · 0.49 · 0.45 · 3203 | -1.08 | 0.34 |
| 15.11.2026 | GALOP | 1000 m | 66.50 | 26.60 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | -0.97 | 26.25 · 0.35 · 0.67 · 1780 | -0.52 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.23, -0.07, -0.97] → ortalama **-0.423** · kapanış: [-0.55, -1.08, -0.52] → **-0.717** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (08.11.2026, 13.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.550 · kapanış 0.550 · efor 0.600 · trend — · süreklilik 0.850
**KAPASİTE** = ortalama(0.550, 0.550, 0.600) = **56.7** · **HAZIRLIK** = ortalama(0.850) = **85.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #6 PIPO DAYI (tjkAtId 114704) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.07.2026 | GALOP | 800 m | 50.20 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 51.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 37.30 | 25.00 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 50.80 | 25.60 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 37.60 | 25.40 | ÇR→5 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 51.00 | 25.70 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 800 m | 51.50 | 26.00 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 38.20 | 25.20 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 42.80 | 28.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 53.90 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 800 m | 53.70 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 41.60 | 27.50 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -1.50 | 27.22 · 0.28 · 0.45 · 3203 | -0.62 | 0.34 |
| 15.11.2026 | GALOP | 600 m | 39.30 | 26.40 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.24 | 25.71 · 0.69 · 0.45 · 3203 | -1.53 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-1.50, -0.24] → ortalama **-0.867** · kapanış: [-0.62, -1.53] → **-1.072** · efor: [0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 13.11.2026→z=-1.496, 15.11.2026→z=-0.237 → **1.259** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.250 · kapanış 0.150 · efor 0.600 · trend 0.833 · süreklilik 0.600
**KAPASİTE** = ortalama(0.250, 0.150, 0.600) = **33.3** · **HAZIRLIK** = ortalama(0.833, 0.600) = **71.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #7 SON OF SPARTACUS (tjkAtId 113862) — önceki koşu: 11.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 23.08.2026 | GALOP | 800 m | 52.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 41.00 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 52.20 | 26.10 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 51.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 39.80 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 66.80 | 26.90 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 54.00 | 27.50 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.69 | 26.65 · 0.85 · 0.70 · 2699 | -1.21 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 42.70 | 27.70 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | -1.63 | 28.04 · -0.34 · 0.48 · 907 | 0.72 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-0.69, -1.63] → ortalama **-1.158** · kapanış: [-1.21, 0.72] → **-0.246** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (08.11.2026, 13.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.150 · kapanış 0.750 · efor 0.600 · trend — · süreklilik 0.600
**KAPASİTE** = ortalama(0.150, 0.750, 0.600) = **50.0** · **HAZIRLIK** = ortalama(0.600) = **60.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #8 STAR FACE (tjkAtId 114741) — önceki koşu: 22.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.07.2026 | GALOP | 600 m | 38.20 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 1000 m | 64.50 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 1000 m | 65.30 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 51.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 600 m | 39.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 50.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 51.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 52.20 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | SPRINT | 400 m | 26.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 1000 m | 62.70 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 800 m | 54.00 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.10.2026 | GALOP | 800 m | 53.60 | 26.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 1000 m | 64.70 | 26.40 | Ç→1 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | 0.01 | 25.54 · 0.86 · 0.67 · 1780 | -1.27 | -3.01 |
| 08.11.2026 | GALOP | 1000 m | 66.80 | 27.80 | HÇ→2 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | -1.13 | 26.37 · 1.43 · 0.67 · 1780 | -2.13 | -1.90 |
| 12.11.2026 | GALOP | 600 m | 41.20 | 27.00 | ÇR→5 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -1.28 | 26.96 · 0.04 · 0.45 · 3203 | -0.10 | 1.45 |
| 15.11.2026 | GALOP | 800 m | 50.30 | 25.50 | HÇ→2 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.87 | 24.85 · 0.65 · 0.70 · 2699 | -0.93 | -1.90 |

**Ara adımlar** — hız: son 3 hızZ [-1.13, -1.28, 0.87] → ortalama **-0.514** · kapanış: [-2.13, -0.10, -0.93] → **-1.053** · efor: [-1.90, 1.45, -1.90] → **-0.781** · trend: 1000|GALOP|KUM: 01.11.2026→z=0.012, 08.11.2026→z=-1.134 → **-1.146** · süreklilik: son 28 günde 4 farklı idman günü (01.11.2026, 08.11.2026, 12.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.450 · kapanış 0.350 · efor 0.200 · trend 0.500 · süreklilik 0.950
**KAPASİTE** = ortalama(0.450, 0.350, 0.200) = **33.3** · **HAZIRLIK** = ortalama(0.500, 0.950) = **72.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #9 WHITE WRIST (tjkAtId 113537) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.07.2026 | GALOP | 600 m | 37.30 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.07.2026 | SPRINT | 400 m | 25.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 54.40 | 27.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | SPRINT | 400 m | 24.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 51.50 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 51.50 | 25.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.09.2026 | GALOP | 800 m | 51.80 | 26.30 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 40.00 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 51.00 | 26.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 800 m | 50.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 53.50 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 52.80 | 26.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 53.00 | 26.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 800 m | 52.40 | 27.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 37.80 | 25.60 | HÇ→2 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 0.66 | 24.64 · 0.96 · 0.48 · 907 | -2.01 | -1.90 |
| 15.11.2026 | GALOP | 800 m | 52.50 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.06 | 25.92 · 0.08 · 0.70 · 2699 | -0.11 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.66, -0.06] → ortalama **0.299** · kapanış: [-2.01, -0.11] → **-1.062** · efor: [-1.90, 0.34] → **-0.781** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.750 · kapanış 0.250 · efor 0.200 · trend — · süreklilik 0.600
**KAPASİTE** = ortalama(0.750, 0.250, 0.200) = **40.0** · **HAZIRLIK** = ortalama(0.600) = **60.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #10 CEYHAN SULTANI (tjkAtId 114247) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.06.2026 | SPRINT | 600 m | 38.50 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.06.2026 | GALOP | 800 m | 51.30 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.06.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 800 m | 51.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.07.2026 | GALOP | 600 m | 37.30 | 24.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.07.2026 | GALOP | 600 m | 39.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.07.2026 | GALOP | 600 m | 39.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.07.2026 | GALOP | 600 m | 39.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 51.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 51.40 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 51.40 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 51.40 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 65.50 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 65.50 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 65.50 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 65.50 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.09.2026 | SPRINT | 400 m | 25.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 63.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 51.00 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 800 m | 52.50 | 25.30 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 54.50 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.11.2026 | GALOP | 1000 m | 64.00 | 25.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 38.00 | 25.20 | Ç→1 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 0.47 | 24.85 · 0.35 · 0.45 · 3203 | -0.77 | -3.01 |

**Ara adımlar** — hız: son 1 hızZ [0.47] → ortalama **0.475** · kapanış: [-0.77] → **-0.769** · efor: [-3.01] → **-3.015** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.850 · kapanış 0.450 · efor 0.050 · trend — · süreklilik 0.200
**KAPASİTE** = ortalama(0.850, 0.450, 0.050) = **45.0** · **HAZIRLIK** = ortalama(0.200) = **20.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K1 #11 QUEEN LARA (tjkAtId 114827) — önceki koşu: 11.08.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.07.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 600 m | 38.60 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 600 m | 40.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 600 m | 40.00 | 26.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 600 m | 40.00 | 26.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 62.80 | 24.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 62.80 | 24.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 62.80 | 24.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 62.80 | 24.50 | R→4 | KUM/IC | KULLANILDI | S1 · 492 · 64.81 · 2.35 · 14.11.2026 | 0.86 | 24.63 · -0.13 · 0.70 · 492 | 0.18 | 0.34 |
| 11.10.2026 | GALOP | 600 m | 39.50 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.35 | 25.84 · 0.16 · 0.45 · 3203 | -0.36 | 0.34 |
| 15.11.2026 | GALOP | 600 m | 43.00 | 28.20 | ÇR→5 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | -1.77 | 28.25 · -0.05 · 0.48 · 907 | 0.11 | 1.45 |

**Ara adımlar** — hız: son 3 hızZ [0.86, -0.35, -1.77] → ortalama **-0.419** · kapanış: [0.18, -0.36, 0.11] → **-0.021** · efor: [0.34, 0.34, 1.45] → **0.707** · trend: 600|GALOP|KUM: 11.10.2026→z=-0.347, 15.11.2026→z=-1.767 → **-1.420** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.650 · kapanış 0.850 · efor 0.950 · trend 0.167 · süreklilik 0.200
**KAPASİTE** = ortalama(0.650, 0.850, 0.950) = **81.7** · **HAZIRLIK** = ortalama(0.167, 0.200) = **18.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Adana K2 (1200 m) — 7 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): yok
Eşit puanlı atlar — KAPASİTE: yok | HAZIRLIK: #5=#7 (14.3)

#### Adana K2 #1 GHOSHA (tjkAtId 116762) — önceki koşu: 07.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 18.07.2026 | GALOP | 600 m | 41.40 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 600 m | 41.40 | 26.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.08.2026 | GALOP | 800 m | 55.80 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 600 m | 40.40 | 27.70 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | -0.56 | 26.44 · 1.26 · 0.48 · 907 | -2.62 | 0.34 |
| 31.10.2026 | GALOP | 600 m | 42.80 | 28.30 | ÇR→5 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -2.15 | 28.01 · 0.29 · 0.45 · 3203 | -0.64 | 1.45 |
| 07.11.2026 | GALOP | 800 m | 53.50 | 26.80 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.48 | 26.41 · 0.39 · 0.70 · 2699 | -0.56 | 0.34 |
| 14.11.2026 | GALOP | 800 m | 53.60 | 27.90 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | -0.20 | 26.47 · 1.43 · 0.92 · 747 | -1.55 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-2.15, -0.48, -0.20] → ortalama **-0.942** · kapanış: [-0.64, -0.56, -1.55] → **-0.916** · efor: [1.45, 0.34, 0.34] → **0.707** · trend: 800|GALOP|KUM: 07.11.2026→z=-0.479, 14.11.2026→z=-0.195 → **0.284** · süreklilik: son 28 günde 4 farklı idman günü (24.10.2026, 31.10.2026, 07.11.2026, 14.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.357 · kapanış 0.417 · efor 0.929 · trend 0.375 · süreklilik 0.857
**KAPASİTE** = ortalama(0.357, 0.417, 0.929) = **56.7** · **HAZIRLIK** = ortalama(0.375, 0.857) = **61.6**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K2 #2 SIBLINGS (tjkAtId 112908) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.07.2026 | GALOP | 800 m | 51.60 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 50.70 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.07.2026 | SPRINT | 400 m | 23.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 49.00 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 49.00 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.60 | 26.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.60 | 26.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.60 | 26.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 51.30 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 50.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 800 m | 49.70 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 800 m | 49.00 | 25.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 800 m | 49.00 | 26.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 600 m | 36.80 | 24.50 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 1.13 | 24.06 · 0.44 · 0.45 · 3203 | -0.97 | 0.34 |
| 12.11.2026 | SPRINT | 400 m | 23.50 | — | HÇ→2 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 1.46 | — | — | -1.90 |
| 14.11.2026 | GALOP | 800 m | 50.20 | 26.00 | HÇ→2 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.91 | 24.80 · 1.20 · 0.70 · 2699 | -1.71 | -1.90 |

**Ara adımlar** — hız: son 3 hızZ [1.13, 1.46, 0.91] → ortalama **1.167** · kapanış: [-0.97, -1.71] → **-1.340** · efor: [0.34, -1.90, -1.90] → **-1.154** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (08.11.2026, 12.11.2026, 14.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.929 · kapanış 0.083 · efor 0.071 · trend — · süreklilik 0.500
**KAPASİTE** = ortalama(0.929, 0.083, 0.071) = **36.1** · **HAZIRLIK** = ortalama(0.500) = **50.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K2 #3 COOGER FIRE (tjkAtId 113192) — önceki koşu: 18.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.10.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 63.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 36.40 | 23.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.11.2026 | GALOP | 1000 m | 65.20 | 25.80 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | -0.26 | 25.74 · 0.06 · 0.67 · 1780 | -0.09 | 0.34 |
| 06.11.2026 | GALOP | 600 m | 38.20 | 25.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 0.37 | 24.98 · 0.02 · 0.45 · 3203 | -0.04 | 0.34 |
| 09.11.2026 | GALOP | 1000 m | 63.70 | 24.00 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | 0.56 | 25.15 · -1.15 · 0.67 · 1780 | 1.71 | 0.34 |
| 14.11.2026 | GALOP | 600 m | 37.00 | 24.30 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 1.02 | 24.19 · 0.11 · 0.45 · 3203 | -0.24 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.37, 0.56, 1.02] → ortalama **0.648** · kapanış: [-0.04, 1.71, -0.24] → **0.480** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 06.11.2026→z=0.365, 14.11.2026→z=1.022 → **0.657** · süreklilik: son 28 günde 4 farklı idman günü (02.11.2026, 06.11.2026, 09.11.2026, 14.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.786 · kapanış 0.917 · efor 0.500 · trend 0.625 · süreklilik 0.857
**KAPASİTE** = ortalama(0.786, 0.917, 0.500) = **73.4** · **HAZIRLIK** = ortalama(0.625, 0.857) = **74.1**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K2 #4 LOVESICK GRILS (tjkAtId 115979) — önceki koşu: 21.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.06.2026 | GALOP | 600 m | 39.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 58.00 | 29.40 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 58.00 | 29.40 | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 58.00 | 29.40 | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 57.00 | 28.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 57.00 | 28.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 57.00 | 28.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 57.00 | 28.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 57.00 | 28.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 29.08.2026 | GALOP | 600 m | 41.50 | 27.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 41.30 | 27.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | SPRINT | 400 m | 25.90 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 600 m | 44.00 | 29.00 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 600 m | 40.80 | 26.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | GALOP | 800 m | 55.50 | 28.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | GALOP | 600 m | 42.00 | 28.10 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -1.72 | 27.48 · 0.62 · 0.45 · 3203 | -1.36 | 0.34 |
| 07.11.2026 | SPRINT | 400 m | 27.30 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | -0.95 | — | — | 0.34 |
| 13.11.2026 | GALOP | 600 m | 41.80 | 27.80 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -1.61 | 27.35 · 0.45 · 0.45 · 3203 | -0.99 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-1.72, -0.95, -1.61] → ortalama **-1.425** · kapanış: [-1.36, -0.99] → **-1.172** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 31.10.2026→z=-1.715, 13.11.2026→z=-1.606 → **0.110** · süreklilik: son 28 günde 3 farklı idman günü (31.10.2026, 07.11.2026, 13.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.071 · kapanış 0.250 · efor 0.500 · trend 0.125 · süreklilik 0.500
**KAPASİTE** = ortalama(0.071, 0.250, 0.500) = **27.4** · **HAZIRLIK** = ortalama(0.125, 0.500) = **31.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K2 #5 MELEKCAN (tjkAtId 116050) — önceki koşu: 07.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20.08.2026 | SPRINT | 400 m | 26.40 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 56.00 | 27.40 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 600 m | 42.70 | 28.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | GALOP | 800 m | 59.00 | 28.80 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | SPRINT | 400 m | 31.70 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 03.10.2026 | SPRINT | 400 m | 31.70 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | SPRINT | 400 m | 29.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.11.2026 | GALOP | 600 m | 41.00 | 26.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | SPRINT | 400 m | 27.50 | — | R→4 | KUM/IC | KULLANILDI | S1 · 459 · 26.24 · 1.88 · 16.11.2026 | -0.67 | — | — | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.67] → ortalama **-0.671** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.500 · kapanış — · efor 0.500 · trend — · süreklilik 0.143
**KAPASİTE** = ortalama(0.500, 0.500) = **50.0** · **HAZIRLIK** = ortalama(0.143) = **14.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K2 #6 ZELAL HANIM (tjkAtId 113403) — önceki koşu: 27.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.08.2026 | GALOP | 800 m | 51.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 37.70 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 64.00 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 64.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 41.00 | 26.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 1000 m | 64.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 54.00 | 26.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 53.20 | 26.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 67.00 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 53.60 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 52.50 | 26.50 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.06 | 25.92 · 0.58 · 0.70 · 2699 | -0.83 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 38.60 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 0.15 | 25.25 · 0.35 · 0.45 · 3203 | -0.78 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 50.00 | 25.00 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 1.00 | 24.70 · 0.30 · 0.70 · 2699 | -0.43 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.06, 0.15, 1.00] → ortalama **0.362** · kapanış: [-0.83, -0.78, -0.43] → **-0.678** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 01.11.2026→z=-0.057, 15.11.2026→z=0.997 → **1.054** · süreklilik: son 28 günde 3 farklı idman günü (01.11.2026, 13.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.643 · kapanış 0.583 · efor 0.500 · trend 0.875 · süreklilik 0.500
**KAPASİTE** = ortalama(0.643, 0.583, 0.500) = **57.5** · **HAZIRLIK** = ortalama(0.875, 0.500) = **68.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K2 #7 GREENLIFE (tjkAtId 115663) — önceki koşu: 04.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 22.07.2026 | GALOP | 800 m | 52.00 | 25.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.07.2026 | GALOP | 800 m | 52.00 | 25.20 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 51.30 | 25.70 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 51.30 | 25.70 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 51.30 | 25.70 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 03.10.2026 | GALOP | 600 m | 41.00 | 27.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 800 m | 55.30 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | SPRINT | 400 m | 26.80 | — | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | SPRINT | 400 m | 26.30 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 800 m | 53.60 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | GALOP | 800 m | 55.40 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 600 m | 40.80 | 26.80 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -1.06 | 26.69 · 0.11 · 0.45 · 3203 | -0.23 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-1.06] → ortalama **-1.058** · kapanış: [-0.23] → **-0.234** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.214 · kapanış 0.750 · efor 0.500 · trend — · süreklilik 0.143
**KAPASİTE** = ortalama(0.214, 0.750, 0.500) = **48.8** · **HAZIRLIK** = ortalama(0.143) = **14.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Adana K3 (1400 m) — 12 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #1 GÜNÇE KIZ, #3 FENNAN, #7 MİRŞEŞEN, #9 SALAHİYET, #10 KARANURA, #11 LAVİSTAKAYA, #12 ÇELİKOVİÇ
Eşit puanlı atlar — KAPASİTE: yok | HAZIRLIK: #2=#4=#6=#8 (40.0)

#### Adana K3 #1 GÜNÇE KIZ (tjkAtId 106501) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.04.2026 | GALOP | 800 m | 50.30 | 25.00 | Ç→1 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | SPRINT | 400 m | 28.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | GALOP | 1000 m | 75.30 | 30.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 42.40 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 42.40 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 58.80 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 58.80 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 58.80 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.09.2026 | GALOP | 800 m | 56.80 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 44.20 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 44.80 | 29.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 57.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | SPRINT | 400 m | 27.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #2 EPARVEN (tjkAtId 96007) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 14.06.2026 | GALOP | 800 m | 57.50 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.06.2026 | GALOP | 600 m | 41.70 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 1000 m | 71.50 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 1000 m | 71.50 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.07.2026 | GALOP | 600 m | 45.70 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.07.2026 | GALOP | 600 m | 45.70 | 29.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.07.2026 | GALOP | 1000 m | 71.90 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 1000 m | 71.90 | 28.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.07.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.07.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 72.00 | 28.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 72.00 | 28.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 72.00 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.08.2026 | GALOP | 1000 m | 74.00 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | GALOP | 1000 m | 74.00 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | GALOP | 1000 m | 74.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 46.00 | 31.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 46.00 | 31.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 46.00 | 31.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 46.00 | 31.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.09.2026 | GALOP | 600 m | 43.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 73.50 | 29.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 42.50 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 59.00 | 29.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.10.2026 | GALOP | 1200 m | 88.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 71.00 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.10.2026 | SPRINT | 400 m | 30.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 1000 m | 76.50 | 31.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.11.2026 | GALOP | 1000 m | 74.80 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 44.00 | 30.70 | Ç→1 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.42 | 29.04 · 1.66 · 0.79 · 4212 | -2.09 | -3.01 |

**Ara adımlar** — hız: son 1 hızZ [-0.42] → ortalama **-0.417** · kapanış: [-2.09] → **-2.094** · efor: [-3.01] → **-3.015** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.300 · kapanış 0.125 · efor 0.200 · trend — · süreklilik 0.400
**KAPASİTE** = ortalama(0.300, 0.125, 0.200) = **20.8** · **HAZIRLIK** = ortalama(0.400) = **40.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #3 FENNAN (tjkAtId 101925) — önceki koşu: 07.11.2026 (kendi kaydımız)
Hiç galop kaydı yok. KAPASİTE = bilinmiyor, HAZIRLIK = bilinmiyor (sıfır puan verilmedi).

#### Adana K3 #4 PİRNUR (tjkAtId 103592) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.07.2026 | GALOP | 600 m | 42.00 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 43.30 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 43.30 | 28.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 41.30 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 41.30 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 41.30 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.08.2026 | GALOP | 600 m | 49.50 | 33.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.09.2026 | GALOP | 800 m | 59.60 | 29.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 600 m | 44.70 | 28.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 800 m | 62.00 | 32.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | SPRINT | 400 m | 30.40 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 800 m | 59.50 | 29.10 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 800 m | 60.80 | 30.00 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 1000 m | 74.00 | 30.90 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | GALOP | 1000 m | 74.30 | 29.10 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 44.40 | 29.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 600 m | 44.00 | 28.00 | R→4 | KUM/IC | KULLANILDI | S1 · 1256 · 43.38 · 2.33 · 16.11.2026 | -0.27 | 29.06 · -1.06 · 0.92 · 1256 | 1.16 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.27] → ortalama **-0.266** · kapanış: [1.16] → **1.158** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.500 · kapanış 0.875 · efor 0.600 · trend — · süreklilik 0.400
**KAPASİTE** = ortalama(0.500, 0.875, 0.600) = **65.8** · **HAZIRLIK** = ortalama(0.400) = **40.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #5 ARSLAN OĞLU (tjkAtId 103593) — önceki koşu: 25.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 17.07.2026 | SPRINT | 400 m | 28.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 58.40 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 43.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 56.70 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 41.70 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.08.2026 | GALOP | 800 m | 56.50 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.08.2026 | GALOP | 800 m | 56.50 | 27.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | SPRINT | 400 m | 27.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | SPRINT | 400 m | 27.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | SPRINT | 400 m | 27.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 44.20 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 42.60 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 45.20 | 30.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 600 m | 43.80 | 29.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 58.50 | 29.20 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 42.50 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 44.80 | 29.80 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.83 | 29.59 · 0.21 · 0.79 · 4212 | -0.27 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 60.00 | 29.60 | ÇR→5 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | -0.75 | 30.08 · -0.48 · 0.69 · 3129 | 0.69 | 1.45 |

**Ara adımlar** — hız: son 2 hızZ [-0.83, -0.75] → ortalama **-0.787** · kapanış: [-0.27, 0.69] → **0.213** · efor: [0.34, 1.45] → **0.894** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.100 · kapanış 0.625 · efor 0.900 · trend — · süreklilik 0.900
**KAPASİTE** = ortalama(0.100, 0.625, 0.900) = **54.2** · **HAZIRLIK** = ortalama(0.900) = **90.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #6 CESURSOY (tjkAtId 105521) — önceki koşu: 29.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.06.2026 | GALOP | 600 m | 43.90 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.06.2026 | GALOP | 600 m | 41.70 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 1000 m | 71.50 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | GALOP | 600 m | 41.70 | 27.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 43.20 | 29.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 43.20 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 56.20 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 56.20 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 41.30 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 41.30 | 27.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 55.30 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 55.30 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 55.30 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 42.40 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 42.40 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 42.40 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 42.40 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.08.2026 | GALOP | 600 m | 41.80 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.08.2026 | GALOP | 800 m | 55.80 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 800 m | 55.60 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.10.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 57.50 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 41.30 | 27.50 | Ç→1 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.96 | 27.21 · 0.29 · 0.79 · 4212 | -0.37 | -3.01 |

**Ara adımlar** — hız: son 1 hızZ [0.96] → ortalama **0.963** · kapanış: [-0.37] → **-0.369** · efor: [-3.01] → **-3.015** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.700 · kapanış 0.375 · efor 0.200 · trend — · süreklilik 0.400
**KAPASİTE** = ortalama(0.700, 0.375, 0.200) = **42.5** · **HAZIRLIK** = ortalama(0.400) = **40.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #7 MİRŞEŞEN (tjkAtId 101070) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.07.2026 | SPRINT | 400 m | 28.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.07.2026 | GALOP | 800 m | 58.20 | 30.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | SPRINT | 400 m | 29.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | SPRINT | 400 m | 29.40 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.07.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.07.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.07.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 59.50 | 30.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 59.50 | 30.00 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 59.50 | 30.00 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 61.80 | 31.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 61.80 | 31.50 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 61.80 | 31.50 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 61.80 | 31.50 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 47.00 | 32.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 45.20 | 30.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 28.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 57.60 | 28.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 600 m | 43.80 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | GALOP | 800 m | 62.00 | 31.80 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | GALOP | 600 m | 48.60 | 32.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | SPRINT | 400 m | 29.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #8 AZERBAYCANLI (tjkAtId 99930) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.04.2026 | GALOP | 800 m | 57.50 | 29.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.04.2026 | GALOP | 800 m | 60.00 | 30.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | SPRINT | 400 m | 30.00 | — | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 600 m | 43.50 | 29.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 44.60 | 30.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1200 m | 84.70 | 28.80 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1200 m | 86.80 | 29.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | SPRINT | 400 m | 29.20 | — | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.08.2026 | GALOP | 800 m | 57.60 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.70 | 29.00 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.70 | 29.00 | HÇ→2 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.08.2026 | GALOP | 800 m | 56.20 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | SPRINT | 400 m | 29.40 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 41.50 | 27.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 43.70 | 29.20 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 71.80 | 29.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | GALOP | 800 m | 56.80 | 28.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 59.00 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 1000 m | 76.50 | 30.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 41.70 | 27.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | GALOP | 600 m | 41.00 | 27.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 600 m | 42.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | SPRINT | 400 m | 28.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 56.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1535 · 28.96 · 1.67 · 15.11.2026 | 1.18 | — | — | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.18] → ortalama **1.176** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.900 · kapanış — · efor 0.600 · trend — · süreklilik 0.400
**KAPASİTE** = ortalama(0.900, 0.600) = **75.0** · **HAZIRLIK** = ortalama(0.400) = **40.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #9 SALAHİYET (tjkAtId 106865) — önceki koşu: 12.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.07.2026 | GALOP | 600 m | 44.50 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 55.80 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 55.80 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 55.80 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 71.00 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 71.00 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 71.00 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 55.90 | 27.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 55.90 | 27.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 55.90 | 27.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 41.80 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 41.80 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 41.80 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 41.80 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 18.09.2026 | GALOP | 800 m | 53.00 | 26.60 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 58.20 | 29.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 70.30 | 28.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 800 m | 60.00 | 30.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 57.40 | 29.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #10 KARANURA (tjkAtId 99728) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.07.2026 | GALOP | 600 m | 40.70 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 600 m | 40.70 | 27.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 600 m | 40.70 | 27.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 42.60 | 28.30 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 43.00 | 28.90 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 44.20 | 29.70 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #11 LAVİSTAKAYA (tjkAtId 107088) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.07.2026 | SPRINT | 400 m | 29.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.07.2026 | GALOP | 800 m | 59.00 | 30.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 800 m | 59.20 | 29.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | SPRINT | 400 m | 29.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | SPRINT | 400 m | 29.90 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.07.2026 | GALOP | 800 m | 57.70 | 28.90 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.07.2026 | GALOP | 800 m | 57.70 | 28.90 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 1000 m | 77.30 | 32.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.08.2026 | GALOP | 1000 m | 77.30 | 32.50 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 1000 m | 77.30 | 32.50 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 62.00 | 31.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 62.00 | 31.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 62.00 | 31.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 62.00 | 31.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.09.2026 | GALOP | 800 m | 60.40 | 30.60 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.09.2026 | GALOP | 800 m | 60.40 | 30.60 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.09.2026 | GALOP | 800 m | 60.60 | 30.10 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.09.2026 | GALOP | 800 m | 60.60 | 30.10 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.09.2026 | SPRINT | 400 m | 29.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 600 m | 41.90 | 28.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | SPRINT | 400 m | 26.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 54.20 | 27.50 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | SPRINT | 400 m | 27.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 55.50 | 27.70 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K3 #12 ÇELİKOVİÇ (tjkAtId 100147) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.09.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Adana K4 (1200 m) — 13 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #4 MY SON NADİR
Eşit puanlı atlar — KAPASİTE: #9=#10 (50.8) | HAZIRLIK: #1=#2=#9=#11=#12 (54.2) · #5=#6=#8=#13 (16.7)

#### Adana K4 #1 SYRENA (tjkAtId 107988) — önceki koşu: 31.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15.03.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 18.03.2026 | Nemli | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 09.04.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 24.04.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 01.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 08.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 24.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 07.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 28.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 28.06.2026 | SPRINT | 400 m | 26.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 11.07.2026 | GALOP | 600 m | 36.90 | 23.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 11.07.2026 | GALOP | 600 m | 36.90 | 23.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.08.2026 | GALOP | 600 m | 39.20 | 25.80 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | GALOP | 600 m | 39.20 | 25.80 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | GALOP | 600 m | 39.20 | 25.80 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | GALOP | 600 m | 39.20 | 25.80 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | GALOP | 600 m | 39.20 | 25.80 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.08.2026 | GALOP | 600 m | 38.30 | 25.30 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 19.08.2026 | GALOP | 600 m | 38.30 | 25.30 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 19.08.2026 | GALOP | 600 m | 38.30 | 25.30 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 19.08.2026 | GALOP | 600 m | 38.30 | 25.30 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 19.08.2026 | GALOP | 600 m | 38.30 | 25.30 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.08.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 600 m | 40.80 | 26.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 600 m | 39.00 | 25.80 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.10.2026 | GALOP | 600 m | 38.90 | 25.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 53.50 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | -0.53 | 26.38 · -0.38 · 0.59 · 2996 | 0.64 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 38.50 | 25.30 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.16 | 25.19 · 0.11 · 0.49 · 3826 | -0.23 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-0.53, 0.16] → ortalama **-0.186** · kapanış: [0.64, -0.23] → **0.206** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (08.11.2026, 13.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.375 · kapanış 0.850 · efor 0.667 · trend — · süreklilik 0.542
**KAPASİTE** = ortalama(0.375, 0.850, 0.667) = **63.1** · **HAZIRLIK** = ortalama(0.542) = **54.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #2 FAST FOTON (tjkAtId 103729) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.06.2026 | SPRINT | 400 m | 25.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.06.2026 | GALOP | 800 m | 54.20 | 26.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.07.2026 | SPRINT | 400 m | 25.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.07.2026 | GALOP | 800 m | 53.40 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 800 m | 51.30 | 25.90 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 600 m | 40.20 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 600 m | 40.20 | 25.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 54.60 | 27.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 54.60 | 27.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 53.00 | 26.40 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 53.00 | 26.40 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 53.00 | 26.40 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.08.2026 | GALOP | 800 m | 51.50 | 26.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 39.50 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | SPRINT | 400 m | 24.50 | — | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 66.40 | 26.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | SPRINT | 400 m | 26.60 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 943 · 25.95 · 1.57 · 16.11.2026 | -0.03 | — | — | 0.34 |
| 15.11.2026 | GALOP | 1000 m | 62.80 | 25.30 | Ç→1 | KUM/? | KULLANILDI | S2 · 1341 · 64.85 · 2.38 · 15.11.2026 | 0.86 | 24.78 · 0.52 · 0.63 · 1341 | -0.82 | -3.01 |

**Ara adımlar** — hız: son 2 hızZ [-0.03, 0.86] → ortalama **0.417** · kapanış: [-0.82] → **-0.818** · efor: [0.34, -3.01] → **-1.340** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (06.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.792 · kapanış 0.450 · efor 0.125 · trend — · süreklilik 0.542
**KAPASİTE** = ortalama(0.792, 0.450, 0.125) = **45.6** · **HAZIRLIK** = ortalama(0.542) = **54.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #3 BORGA (tjkAtId 109432) — önceki koşu: 27.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.06.2026 | GALOP | 600 m | 41.30 | 27.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.06.2026 | GALOP | 800 m | 50.20 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.06.2026 | GALOP | 600 m | 38.30 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | SPRINT | 400 m | 24.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 600 m | 40.40 | 27.00 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 54.00 | 26.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 39.50 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 53.70 | 26.80 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | SPRINT | 400 m | 23.50 | — | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 52.50 | 26.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 37.00 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 62.30 | 25.40 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 38.30 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 65.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 39.00 | 26.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 64.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 37.30 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1200 m | 76.30 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 800 m | 49.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 38.50 | 25.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 50.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | GALOP | 600 m | 37.70 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 62.70 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 800 m | 50.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 600 m | 38.70 | 25.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 52.70 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 600 m | 38.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 600 m | 38.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.11.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1314 · 25.87 · 1.54 · 16.11.2026 | -0.08 | — | — | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 64.90 | 26.20 | HÇ→2 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | -0.08 | 25.60 · 0.60 · 0.67 · 1876 | -0.89 | -1.90 |
| 15.11.2026 | GALOP | 600 m | 38.80 | 25.80 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | -0.01 | 25.37 · 0.43 · 0.49 · 3826 | -0.87 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.08, -0.08, -0.01] → ortalama **-0.056** · kapanış: [-0.89, -0.87] → **-0.878** · efor: [0.34, -1.90, 0.34] → **-0.409** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (05.11.2026, 08.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.458 · kapanış 0.350 · efor 0.292 · trend — · süreklilik 0.792
**KAPASİTE** = ortalama(0.458, 0.350, 0.292) = **36.7** · **HAZIRLIK** = ortalama(0.792) = **79.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #4 MY SON NADİR (tjkAtId 104726) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.09.2026 | GALOP | 600 m | 37.80 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 38.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 37.70 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | SPRINT | 400 m | 25.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 66.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 50.50 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 50.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | SPRINT | 400 m | 25.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #5 MAMDANI (tjkAtId 110397) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 28.06.2026 | GALOP | 600 m | 37.00 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.07.2026 | GALOP | 1000 m | 62.90 | 26.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 600 m | 38.60 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.07.2026 | GALOP | 1000 m | 64.60 | 24.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.07.2026 | GALOP | 1000 m | 64.60 | 24.00 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 38.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 1000 m | 64.40 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 1000 m | 64.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | GALOP | 1000 m | 63.30 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 1000 m | 63.30 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 52.20 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | SPRINT | 400 m | 25.50 | — | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 65.70 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 800 m | 49.80 | 24.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 38.50 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 1000 m | 63.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | SPRINT | 400 m | 24.20 | — | R→4 | KUM/? | KULLANILDI | S2 · 1314 · 25.87 · 1.54 · 16.11.2026 | 1.09 | — | — | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.09] → ortalama **1.090** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.958 · kapanış — · efor 0.667 · trend — · süreklilik 0.167
**KAPASİTE** = ortalama(0.958, 0.667) = **81.3** · **HAZIRLIK** = ortalama(0.167) = **16.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #6 MYBOYFRIEND (tjkAtId 107733) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 29.06.2026 | GALOP | 800 m | 58.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.07.2026 | GALOP | 1000 m | 67.20 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.08.2026 | GALOP | 600 m | 41.00 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.08.2026 | GALOP | 600 m | 41.00 | 27.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 41.00 | 26.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.10.2026 | GALOP | 800 m | 55.00 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 37.20 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 54.00 | 27.00 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | -0.74 | 26.62 · 0.38 · 0.59 · 2996 | -0.64 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.74] → ortalama **-0.740** · kapanış: [-0.64] → **-0.640** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.042 · kapanış 0.550 · efor 0.667 · trend — · süreklilik 0.167
**KAPASİTE** = ortalama(0.042, 0.550, 0.667) = **41.9** · **HAZIRLIK** = ortalama(0.167) = **16.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #7 STRONG HEARD (tjkAtId 110063) — önceki koşu: 24.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.07.2026 | GALOP | 800 m | 52.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 40.50 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 40.50 | 26.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 63.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 63.50 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 65.20 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 65.20 | 25.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 64.50 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 64.50 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.08.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 40.50 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 64.50 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 38.00 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 51.30 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | SPRINT | 400 m | 25.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 51.00 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 38.20 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 24.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 64.80 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 51.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.10.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 600 m | 37.60 | 24.60 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.66 | 24.62 · -0.02 · 0.49 · 3826 | 0.05 | 0.34 |
| 08.11.2026 | GALOP | 800 m | 52.00 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | 0.10 | 25.64 · -0.04 · 0.59 · 2996 | 0.07 | 0.34 |
| 13.11.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | KULLANILDI | S2 · 1314 · 25.87 · 1.54 · 16.11.2026 | 0.24 | — | — | 0.34 |
| 15.11.2026 | GALOP | 800 m | 52.60 | 25.70 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | -0.15 | 25.94 · -0.24 · 0.59 · 2996 | 0.40 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.10, 0.24, -0.15] → ortalama **0.064** · kapanış: [0.05, 0.07, 0.40] → **0.174** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 08.11.2026→z=0.100, 15.11.2026→z=-0.152 → **-0.252** · süreklilik: son 28 günde 4 farklı idman günü (29.10.2026, 08.11.2026, 13.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.625 · kapanış 0.750 · efor 0.667 · trend 0.750 · süreklilik 0.917
**KAPASİTE** = ortalama(0.625, 0.750, 0.667) = **68.1** · **HAZIRLIK** = ortalama(0.750, 0.917) = **83.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #8 MEKANSIZ KRAL (tjkAtId 108312) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.08.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | GALOP | 600 m | 40.20 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 50.80 | 25.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1200 m | 82.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 51.30 | 25.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 600 m | 39.30 | 25.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 37.20 | 24.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 67.00 | 27.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 54.00 | 26.00 | HÇ→2 | KUM/IC | KULLANILDI | S1 · 900 · 52.67 · 2.80 · 15.11.2026 | -0.47 | 26.67 · -0.67 · 0.65 · 900 | 1.03 | -1.90 |

**Ara adımlar** — hız: son 1 hızZ [-0.47] → ortalama **-0.474** · kapanış: [1.03] → **1.034** · efor: [-1.90] → **-1.898** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.292 · kapanış 0.950 · efor 0.042 · trend — · süreklilik 0.167
**KAPASİTE** = ortalama(0.292, 0.950, 0.042) = **42.8** · **HAZIRLIK** = ortalama(0.167) = **16.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #9 BON CHEVAL (tjkAtId 105014) — önceki koşu: 27.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 23.07.2026 | GALOP | 800 m | 54.30 | 27.60 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 800 m | 54.30 | 27.60 | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 52.80 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 52.80 | 25.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 52.80 | 25.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 52.80 | 25.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 39.40 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 39.40 | 25.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 39.40 | 25.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 39.40 | 25.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 29.08.2026 | GALOP | 600 m | 39.60 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 800 m | 49.90 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | GALOP | 1000 m | 64.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.10.2026 | GALOP | 600 m | 37.70 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 800 m | 50.00 | 25.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 1200 m | 77.00 | 26.50 | R→4 | KUM/? | KULLANILDI | S2 · 524 · 77.83 · 2.18 · 08.11.2026 | 0.38 | 25.24 · 1.26 · 0.73 · 522 | -1.73 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 2921 · 38.96 · 1.87 · 15.11.2026 | -0.02 | 25.51 · 0.49 · 0.46 · 2921 | -1.06 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.38, -0.02] → ortalama **0.181** · kapanış: [-1.73, -1.06] → **-1.398** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (08.11.2026, 13.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.708 · kapanış 0.150 · efor 0.667 · trend — · süreklilik 0.542
**KAPASİTE** = ortalama(0.708, 0.150, 0.667) = **50.8** · **HAZIRLIK** = ortalama(0.542) = **54.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #10 CASH FOR YOU (tjkAtId 108859) — önceki koşu: 18.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.06.2026 | GALOP | 1200 m | 78.50 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.06.2026 | SPRINT | 400 m | 24.70 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.06.2026 | GALOP | 1000 m | 61.30 | 24.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.06.2026 | GALOP | 1000 m | 64.00 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 800 m | 51.60 | 24.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.07.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.07.2026 | GALOP | 1000 m | 65.00 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.07.2026 | GALOP | 1000 m | 65.00 | 26.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 49.70 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 49.70 | 24.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.00 | 26.40 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.00 | 26.40 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.00 | 26.40 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.00 | 26.40 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1200 m | 76.70 | 24.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1200 m | 76.70 | 24.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1200 m | 76.70 | 24.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1200 m | 76.70 | 24.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 07.08.2026 | GALOP | 800 m | 48.70 | 23.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 800 m | 48.70 | 23.70 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 07.08.2026 | GALOP | 800 m | 48.70 | 23.70 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 07.08.2026 | GALOP | 800 m | 48.70 | 23.70 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 36.80 | 24.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 38.50 | 25.40 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.16 | 25.19 · 0.21 · 0.49 · 3826 | -0.44 | 0.34 |
| 08.11.2026 | GALOP | 800 m | 52.20 | 26.20 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | 0.02 | 25.74 · 0.46 · 0.59 · 2996 | -0.78 | 0.34 |
| 13.11.2026 | GALOP | 800 m | 53.50 | 26.50 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | -0.53 | 26.38 · 0.12 · 0.59 · 2996 | -0.21 | 0.34 |
| 15.11.2026 | GALOP | 1000 m | 67.00 | 27.00 | R→4 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | -1.07 | 26.39 · 0.61 · 0.67 · 1876 | -0.91 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.02, -0.53, -1.07] → ortalama **-0.528** · kapanış: [-0.78, -0.21, -0.91] → **-0.634** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 08.11.2026→z=0.016, 13.11.2026→z=-0.530 → **-0.546** · süreklilik: son 28 günde 4 farklı idman günü (06.11.2026, 08.11.2026, 13.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.208 · kapanış 0.650 · efor 0.667 · trend 0.250 · süreklilik 0.917
**KAPASİTE** = ortalama(0.208, 0.650, 0.667) = **50.8** · **HAZIRLIK** = ortalama(0.250, 0.917) = **58.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #11 LUCKY ANGEL (tjkAtId 109909) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.07.2026 | GALOP | 800 m | 53.90 | 26.70 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.08.2026 | GALOP | 600 m | 40.20 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.08.2026 | GALOP | 600 m | 40.20 | 26.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.09.2026 | GALOP | 600 m | 40.90 | 26.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.09.2026 | GALOP | 600 m | 41.20 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 35.60 | 23.80 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 61.50 | 25.00 | Ç→1 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 800 m | 51.80 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | Sprint | — | — | — | ÇR | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 40.50 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 51.80 | 25.70 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 38.20 | 25.40 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.33 | 25.00 · 0.40 · 0.49 · 3826 | -0.82 | 0.34 |
| 15.11.2026 | GALOP | 1000 m | 65.20 | 27.00 | R→4 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | -0.22 | 25.72 · 1.28 · 0.67 · 1876 | -1.91 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.33, -0.22] → ortalama **0.052** · kapanış: [-0.82, -1.91] → **-1.365** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.542 · kapanış 0.250 · efor 0.667 · trend — · süreklilik 0.542
**KAPASİTE** = ortalama(0.542, 0.250, 0.667) = **48.6** · **HAZIRLIK** = ortalama(0.542) = **54.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #12 FEARLESS QUEEN (tjkAtId 111513) — önceki koşu: 25.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 24.05.2026 | GALOP | 800 m | 51.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.06.2026 | GALOP | 600 m | 41.70 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.06.2026 | SPRINT | 400 m | 25.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 600 m | 38.50 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 52.20 | 26.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 600 m | 39.50 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 39.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 1000 m | 64.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.07.2026 | GALOP | 800 m | 51.20 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 50.00 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 50.00 | 24.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 53.00 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 53.00 | 26.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 36.00 | 24.00 | Ç→1 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.11.2026 | GALOP | 600 m | 39.70 | 27.00 | R→4 | SENTETIK/? | KULLANILDI | S2 · 199 · 37.71 · 1.45 · 12.11.2026 | -1.37 | 25.87 · 1.13 · 0.49 · 199 | -2.31 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 51.60 | 26.00 | HÇ→2 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | 0.27 | 25.44 · 0.56 · 0.59 · 2996 | -0.95 | -1.90 |

**Ara adımlar** — hız: son 2 hızZ [-1.37, 0.27] → ortalama **-0.550** · kapanış: [-2.31, -0.95] → **-1.629** · efor: [0.34, -1.90] → **-0.781** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (12.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.125 · kapanış 0.050 · efor 0.208 · trend — · süreklilik 0.542
**KAPASİTE** = ortalama(0.125, 0.050, 0.208) = **12.8** · **HAZIRLIK** = ortalama(0.542) = **54.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K4 #13 STEELL FOOT (tjkAtId 110680) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20.09.2026 | GALOP | 1000 m | 73.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 68.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1200 m | 85.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1200 m | 83.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 69.50 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 800 m | 54.00 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | SPRINT | 400 m | 25.00 | — | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | SPRINT | 400 m | 23.50 | — | R→4 | SENTETIK/? | KULLANILDI | S2 · 65 · 24.51 · 1.24 · 15.11.2026 | 0.81 | — | — | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.81] → ortalama **0.813** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.875 · kapanış — · efor 0.667 · trend — · süreklilik 0.167
**KAPASİTE** = ortalama(0.875, 0.667) = **77.1** · **HAZIRLIK** = ortalama(0.167) = **16.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Adana K5 (2000 m) — 10 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #6 SON OF FEARLESS
Eşit puanlı atlar — KAPASİTE: #7=#8 (59.3) | HAZIRLIK: #1=#3=#4=#5=#7=#8=#10 (38.9)

#### Adana K5 #1 TALADRRO (tjkAtId 109306) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.07.2026 | GALOP | 800 m | 54.70 | 28.30 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.07.2026 | GALOP | 800 m | 55.30 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.07.2026 | GALOP | 600 m | 39.40 | 25.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.07.2026 | GALOP | 600 m | 39.40 | 25.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 55.50 | 26.40 | HÇ→2 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 55.50 | 26.40 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | SPRINT | 400 m | 25.40 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | SPRINT | 400 m | 25.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 54.60 | 26.40 | HÇ→2 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 800 m | 54.60 | 26.40 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 53.80 | 25.80 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 53.80 | 25.80 | HÇ→2 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.08.2026 | GALOP | 800 m | 54.70 | 27.30 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 55.60 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 39.50 | 25.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | GALOP | 600 m | 39.40 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 52.50 | 26.00 | ÇR→5 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 52.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | SPRINT | 400 m | 25.20 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.11.2026 | SPRINT | 400 m | 25.20 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 800 m | 52.60 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 53.40 | 26.50 | R→4 | KUM/IC | KULLANILDI | S1 · 900 · 52.67 · 2.80 · 15.11.2026 | -0.26 | 26.35 · 0.15 · 0.65 · 900 | -0.23 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.26] → ortalama **-0.260** · kapanış: [-0.23] → **-0.227** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.389 · kapanış 0.833 · efor 0.444 · trend — · süreklilik 0.389
**KAPASİTE** = ortalama(0.389, 0.833, 0.444) = **55.6** · **HAZIRLIK** = ortalama(0.389) = **38.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #2 KİP MUSA (tjkAtId 108844) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.07.2026 | GALOP | 600 m | 37.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | Galop | — | — | — | R | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 62.70 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.80 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 62.50 | 25.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 51.00 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 37.80 | 24.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 37.80 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 37.40 | 25.40 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 37.30 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 63.60 | 25.20 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 49.50 | 24.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 01.11.2026 | GALOP | 600 m | 39.90 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.11.2026 | GALOP | 600 m | 40.80 | 27.00 | ÇR→5 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | -1.12 | 26.62 · 0.38 · 0.49 · 3826 | -0.77 | 1.45 |
| 14.11.2026 | GALOP | 1000 m | 65.20 | 27.20 | R→4 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | -0.22 | 25.72 · 1.48 · 0.67 · 1876 | -2.21 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-1.12, -0.22] → ortalama **-0.669** · kapanış: [-0.77, -2.21] → **-1.491** · efor: [1.45, 0.34] → **0.894** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (12.11.2026, 14.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.278 · kapanış 0.056 · efor 0.833 · trend — · süreklilik 0.833
**KAPASİTE** = ortalama(0.278, 0.056, 0.833) = **38.9** · **HAZIRLIK** = ortalama(0.833) = **83.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #3 COMPETITOR (tjkAtId 108651) — önceki koşu: 31.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.07.2026 | GALOP | 800 m | 51.30 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 38.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 37.50 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | SPRINT | 400 m | 26.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 51.00 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 63.70 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 66.50 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 68.00 | 28.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 600 m | 37.00 | 24.80 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 57.50 | 27.50 | ÇR→5 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | -2.21 | 28.34 · -0.84 · 0.59 · 2996 | 1.44 | 1.45 |

**Ara adımlar** — hız: son 1 hızZ [-2.21] → ortalama **-2.211** · kapanış: [1.44] → **1.436** · efor: [1.45] → **1.452** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.056 · kapanış 0.944 · efor 0.944 · trend — · süreklilik 0.389
**KAPASİTE** = ortalama(0.056, 0.944, 0.944) = **64.8** · **HAZIRLIK** = ortalama(0.389) = **38.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #4 MERT KHAN (tjkAtId 108203) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.09.2026 | GALOP | 800 m | 58.00 | 29.20 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 40.40 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 600 m | 40.00 | 26.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 1000 m | 66.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.10.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 38.20 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 600 m | 41.00 | 27.40 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | -1.23 | 26.75 · 0.65 · 0.49 · 3826 | -1.33 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-1.23] → ortalama **-1.230** · kapanış: [-1.33] → **-1.330** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.167 · kapanış 0.278 · efor 0.444 · trend — · süreklilik 0.389
**KAPASİTE** = ortalama(0.167, 0.278, 0.444) = **29.6** · **HAZIRLIK** = ortalama(0.389) = **38.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #5 QUEEN SEÇİL (tjkAtId 111484) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.08.2026 | GALOP | 600 m | 39.70 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | SPRINT | 400 m | 25.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 52.20 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 63.20 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | SPRINT | 400 m | 26.00 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 1000 m | 64.20 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 800 m | 50.80 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 39.00 | 26.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 63.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 800 m | 50.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 48.50 | 24.40 | HÇ→2 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 51.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 1000 m | 64.00 | 25.80 | HÇ→2 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | 0.35 | 25.27 · 0.53 · 0.67 · 1876 | -0.79 | -1.90 |

**Ara adımlar** — hız: son 1 hızZ [0.35] → ortalama **0.346** · kapanış: [-0.79] → **-0.794** · efor: [-1.90] → **-1.898** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.722 · kapanış 0.611 · efor 0.056 · trend — · süreklilik 0.389
**KAPASİTE** = ortalama(0.722, 0.611, 0.056) = **46.3** · **HAZIRLIK** = ortalama(0.389) = **38.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #6 SON OF FEARLESS (tjkAtId 110988) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 23.07.2026 | GALOP | 1000 m | 75.00 | 29.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 800 m | 58.10 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | GALOP | 800 m | 58.10 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 800 m | 58.80 | 28.90 | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 800 m | 58.80 | 28.90 | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 800 m | 58.80 | 28.90 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 29.70 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 29.70 | — | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 29.70 | — | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 29.70 | — | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.08.2026 | GALOP | 800 m | 53.40 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #7 BUSINESS (tjkAtId 112198) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03.07.2026 | GALOP | 600 m | 39.50 | 25.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 51.50 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 39.00 | 25.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 39.00 | 25.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 64.70 | 24.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 64.70 | 24.70 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.50 | 24.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.50 | 24.00 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.50 | 24.00 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.08.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 38.40 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 51.00 | 24.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 50.50 | 24.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 55.00 | 27.80 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 40.50 | 26.80 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 54.50 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 54.70 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | 0.10 | 25.64 · 0.36 · 0.59 · 2996 | -0.61 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.10] → ortalama **0.100** · kapanış: [-0.61] → **-0.611** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.611 · kapanış 0.722 · efor 0.444 · trend — · süreklilik 0.389
**KAPASİTE** = ortalama(0.611, 0.722, 0.444) = **59.3** · **HAZIRLIK** = ortalama(0.389) = **38.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #8 GO HER LED (tjkAtId 110165) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 23.07.2026 | GALOP | 1200 m | 75.50 | 26.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 1200 m | 75.50 | 26.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.07.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.07.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 11.08.2026 | GALOP | 1200 m | 75.40 | 24.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.08.2026 | GALOP | 1200 m | 75.40 | 24.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.09.2026 | GALOP | 600 m | 36.30 | 23.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | GALOP | 600 m | 37.00 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1200 m | 78.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 800 m | 49.80 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 600 m | 37.60 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1200 m | 78.00 | 26.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | GALOP | 600 m | 37.10 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 50.90 | 25.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 38.20 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 38.00 | 25.40 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.44 | 24.87 · 0.53 · 0.49 · 3826 | -1.07 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.44] → ortalama **0.436** · kapanış: [-1.07] → **-1.071** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.833 · kapanış 0.500 · efor 0.444 · trend — · süreklilik 0.389
**KAPASİTE** = ortalama(0.833, 0.500, 0.444) = **59.3** · **HAZIRLIK** = ortalama(0.389) = **38.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #9 ROCKIN TIZWAY (tjkAtId 109918) — önceki koşu: 25.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03.07.2026 | GALOP | 600 m | 42.50 | 27.80 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 56.40 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 56.40 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.09.2026 | SPRINT | 400 m | 26.20 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.09.2026 | GALOP | 1000 m | 68.80 | 26.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.09.2026 | GALOP | 800 m | 53.80 | 25.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 800 m | 52.50 | 26.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | SPRINT | 400 m | 25.90 | — | R→4 | KUM/? | KULLANILDI | S2 · 1314 · 25.87 · 1.54 · 16.11.2026 | -0.02 | — | — | 0.34 |
| 08.11.2026 | GALOP | 800 m | 53.30 | 27.00 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | -0.45 | 26.28 · 0.72 · 0.59 · 2996 | -1.23 | 0.34 |
| 13.11.2026 | SPRINT | 400 m | 26.20 | — | R→4 | KUM/? | KULLANILDI | S2 · 1314 · 25.87 · 1.54 · 16.11.2026 | -0.21 | — | — | 0.34 |
| 15.11.2026 | GALOP | 800 m | 51.60 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | 0.27 | 25.44 · 0.56 · 0.59 · 2996 | -0.95 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.45, -0.21, 0.27] → ortalama **-0.130** · kapanış: [-1.23, -0.95] → **-1.085** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 08.11.2026→z=-0.446, 15.11.2026→z=0.268 → **0.714** · süreklilik: son 28 günde 4 farklı idman günü (06.11.2026, 08.11.2026, 13.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.500 · kapanış 0.389 · efor 0.444 · trend — · süreklilik 0.944
**KAPASİTE** = ortalama(0.500, 0.389, 0.444) = **44.4** · **HAZIRLIK** = ortalama(0.944) = **94.4**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K5 #10 SPRINT MASTER (tjkAtId 111589) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 21.06.2026 | GALOP | 600 m | 39.00 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.06.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 800 m | 50.50 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | GALOP | 600 m | 38.60 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 1000 m | 64.50 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.07.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 1000 m | 63.80 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 38.30 | 24.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 1000 m | 64.70 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 600 m | 37.50 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.07.2026 | GALOP | 1000 m | 63.00 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.08.2026 | GALOP | 1200 m | 78.80 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.08.2026 | GALOP | 600 m | 37.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 1400 m | 91.90 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 51.20 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 51.20 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.11.2026 | GALOP | 800 m | 52.00 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 36.80 | 24.80 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 1.10 | 24.13 · 0.67 · 0.49 · 3826 | -1.37 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.10] → ortalama **1.103** · kapanış: [-1.37] → **-1.375** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.944 · kapanış 0.167 · efor 0.444 · trend — · süreklilik 0.389
**KAPASİTE** = ortalama(0.944, 0.167, 0.444) = **51.9** · **HAZIRLIK** = ortalama(0.389) = **38.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Adana K6 (1900 m) — 8 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #6 ERKURT, #8 DOĞAN KARDEŞLER
Eşit puanlı atlar — KAPASİTE: yok | HAZIRLIK: #5=#7 (16.7)

#### Adana K6 #1 BAY TOSUNOĞLU (tjkAtId 88855) — önceki koşu: 24.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 28.06.2026 | GALOP | 800 m | 59.00 | 30.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | GALOP | 600 m | 45.50 | 30.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 1000 m | 75.80 | 30.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 56.00 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 56.00 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 71.80 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 71.80 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 71.80 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 63.00 | 29.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 63.00 | 29.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 63.00 | 29.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 63.00 | 29.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.08.2026 | GALOP | 600 m | 45.00 | 29.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 57.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | SPRINT | 400 m | 29.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 70.00 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | GALOP | 600 m | 44.00 | 29.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 56.20 | 27.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 60.00 | 30.00 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 42.20 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1200 m | 86.80 | 29.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 45.00 | 30.00 | ÇR→5 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.93 | 29.72 · 0.28 · 0.79 · 4212 | -0.35 | 1.45 |
| 01.11.2026 | GALOP | 800 m | 58.00 | 29.20 | ÇR→5 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 0.05 | 28.91 · 0.29 · 0.69 · 3129 | -0.43 | 1.45 |
| 06.11.2026 | GALOP | 600 m | 44.00 | 29.50 | ÇR→5 | KUM/IC | KULLANILDI | S1 · 1256 · 43.38 · 2.33 · 16.11.2026 | -0.27 | 29.06 · 0.44 · 0.92 · 1256 | -0.48 | 1.45 |
| 13.11.2026 | GALOP | 600 m | 43.80 | 29.20 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.32 | 28.91 · 0.29 · 0.79 · 4212 | -0.37 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 55.00 | 28.00 | Ç→1 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 1.25 | 27.15 · 0.85 · 0.69 · 3129 | -1.23 | -3.01 |

**Ara adımlar** — hız: son 3 hızZ [-0.27, -0.32, 1.25] → ortalama **0.222** · kapanış: [-0.48, -0.37, -1.23] → **-0.693** · efor: [1.45, 0.34, -3.01] → **-0.409** · trend: 600|GALOP|KUM: 30.10.2026→z=-0.928, 06.11.2026→z=-0.266, 13.11.2026→z=-0.315 → **0.613** · süreklilik: son 28 günde 5 farklı idman günü (30.10.2026, 01.11.2026, 06.11.2026, 13.11.2026, 15.11.2026) → **5**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.583 · kapanış 0.250 · efor 0.083 · trend 0.500 · süreklilik 0.750
**KAPASİTE** = ortalama(0.583, 0.250, 0.083) = **30.6** · **HAZIRLIK** = ortalama(0.500, 0.750) = **62.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K6 #2 ORÇUNTAY (tjkAtId 102960) — önceki koşu: 13.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.07.2026 | GALOP | 600 m | 41.50 | 26.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 56.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.07.2026 | SPRINT | 400 m | 27.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 55.80 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.07.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 56.00 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 56.00 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.00 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.00 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.00 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 58.30 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 58.30 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 58.30 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 58.30 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.09.2026 | GALOP | 800 m | 56.00 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | SPRINT | 400 m | 27.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 800 m | 55.50 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 57.50 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.10.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 25.10.2026 | GALOP | 600 m | 44.70 | 29.50 | HÇ→2 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.78 | 29.52 · -0.02 · 0.79 · 4212 | 0.02 | -1.90 |
| 03.11.2026 | GALOP | 800 m | 57.00 | 28.00 | Ç→1 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 0.45 | 28.32 · -0.32 · 0.69 · 3129 | 0.47 | -3.01 |
| 08.11.2026 | GALOP | 600 m | 44.00 | 29.00 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.42 | 29.04 · -0.04 · 0.79 · 4212 | 0.06 | 0.34 |
| 12.11.2026 | GALOP | 600 m | 42.50 | 28.50 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.35 | 28.02 · 0.48 · 0.79 · 4212 | -0.60 | 0.34 |
| 14.11.2026 | GALOP | 800 m | 56.00 | 28.00 | R→4 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 0.85 | 27.74 · 0.26 · 0.69 · 3129 | -0.38 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.42, 0.35, 0.85] → ortalama **0.260** · kapanış: [0.06, -0.60, -0.38] → **-0.309** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 25.10.2026→z=-0.775, 08.11.2026→z=-0.417, 12.11.2026→z=0.349 → **1.124** · süreklilik: son 28 günde 5 farklı idman günü (25.10.2026, 03.11.2026, 08.11.2026, 12.11.2026, 14.11.2026) → **5**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.750 · kapanış 0.417 · efor 0.417 · trend 0.833 · süreklilik 0.750
**KAPASİTE** = ortalama(0.750, 0.417, 0.417) = **52.8** · **HAZIRLIK** = ortalama(0.833, 0.750) = **79.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K6 #3 SER DAĞYUDAN (tjkAtId 106374) — önceki koşu: 19.09.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.06.2026 | GALOP | 600 m | 43.00 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.06.2026 | GALOP | 800 m | 56.30 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.06.2026 | GALOP | 600 m | 42.40 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.06.2026 | GALOP | 1000 m | 71.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.06.2026 | GALOP | 600 m | 41.70 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 1000 m | 70.00 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | GALOP | 600 m | 41.50 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 1200 m | 86.00 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.07.2026 | GALOP | 600 m | 42.20 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.07.2026 | GALOP | 600 m | 42.20 | 27.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 44.50 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 44.50 | 29.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 71.50 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 71.50 | 29.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 41.80 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 41.80 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 56.50 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 56.50 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 57.50 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 41.50 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 43.00 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 43.00 | 28.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 70.00 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 70.00 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.09.2026 | GALOP | 600 m | 42.70 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | GALOP | 600 m | 42.70 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 42.00 | 27.40 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.60 | 27.68 · -0.28 · 0.79 · 4212 | 0.36 | 0.34 |
| 09.10.2026 | GALOP | 600 m | 43.20 | 29.00 | HÇ→2 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.01 | 28.50 · 0.50 · 0.79 · 4212 | -0.63 | -1.90 |
| 01.11.2026 | GALOP | 600 m | 43.00 | 28.50 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.09 | 28.36 · 0.14 · 0.79 · 4212 | -0.17 | 0.34 |
| 06.11.2026 | GALOP | 600 m | 45.00 | 29.60 | ÇR→5 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.93 | 29.72 · -0.12 · 0.79 · 4212 | 0.16 | 1.45 |
| 08.11.2026 | GALOP | 600 m | 43.70 | 29.00 | ÇR→5 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.26 | 28.84 · 0.16 · 0.79 · 4212 | -0.20 | 1.45 |
| 13.11.2026 | GALOP | 600 m | 44.40 | 29.00 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.62 | 29.32 · -0.32 · 0.79 · 4212 | 0.40 | 0.34 |
| 15.11.2026 | GALOP | 1000 m | 70.50 | 28.00 | R→4 | KUM/? | KULLANILDI | S2 · 1511 · 71.90 · 2.40 · 15.11.2026 | 0.58 | 28.09 · -0.09 · 0.89 · 1511 | 0.10 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.26, -0.62, 0.58] → ortalama **-0.101** · kapanış: [-0.20, 0.40, 0.10] → **0.100** · efor: [1.45, 0.34, 0.34] → **0.707** · trend: 600|GALOP|KUM: 25.09.2026→z=0.605, 09.10.2026→z=-0.008, 01.11.2026→z=0.094, 06.11.2026→z=-0.928, 08.11.2026→z=-0.264, 13.11.2026→z=-0.622 → **-1.227** · süreklilik: son 28 günde 5 farklı idman günü (01.11.2026, 06.11.2026, 08.11.2026, 13.11.2026, 15.11.2026) → **5**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.417 · kapanış 0.917 · efor 0.750 · trend 0.167 · süreklilik 0.750
**KAPASİTE** = ortalama(0.417, 0.917, 0.750) = **69.4** · **HAZIRLIK** = ortalama(0.167, 0.750) = **45.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K6 #4 SONYEL (tjkAtId 106923) — önceki koşu: 27.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 07.07.2026 | GALOP | 600 m | 43.60 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 600 m | 41.80 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 600 m | 41.80 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 54.80 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 54.80 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 54.80 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | SPRINT | 400 m | 28.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 58.60 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 57.80 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 600 m | 45.50 | 30.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | SPRINT | 400 m | 30.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 67.50 | 27.00 | Ç→1 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | SPRINT | 400 m | 27.30 | — | R→4 | KUM/? | KULLANILDI | S2 · 1535 · 28.96 · 1.67 · 15.11.2026 | 1.00 | — | — | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 70.00 | 28.50 | R→4 | KUM/? | KULLANILDI | S2 · 1511 · 71.90 · 2.40 · 15.11.2026 | 0.79 | 27.91 · 0.59 · 0.89 · 1511 | -0.67 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 56.80 | 28.00 | R→4 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 0.53 | 28.21 · -0.21 · 0.69 · 3129 | 0.30 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [1.00, 0.79, 0.53] → ortalama **0.772** · kapanış: [-0.67, 0.30] → **-0.184** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (06.11.2026, 08.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.917 · kapanış 0.583 · efor 0.417 · trend — · süreklilik 0.417
**KAPASİTE** = ortalama(0.917, 0.583, 0.417) = **63.9** · **HAZIRLIK** = ortalama(0.417) = **41.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K6 #5 ANKA ATEŞİ (tjkAtId 96634) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.07.2026 | GALOP | 600 m | 47.50 | 31.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | SPRINT | 400 m | 32.10 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 63.80 | 31.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 71.50 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 71.50 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 44.50 | 29.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | SPRINT | 400 m | 29.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 800 m | 63.00 | 32.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 800 m | 62.00 | 31.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 800 m | 65.50 | 33.50 | R→4 | KUM/IC | KULLANILDI | S1 · 870 · 58.54 · 3.11 · 15.11.2026 | -2.23 | 33.51 · -0.01 · 0.75 · 870 | 0.01 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-2.23] → ortalama **-2.234** · kapanış: [0.01] → **0.014** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.250 · kapanış 0.750 · efor 0.417 · trend — · süreklilik 0.167
**KAPASİTE** = ortalama(0.250, 0.750, 0.417) = **47.2** · **HAZIRLIK** = ortalama(0.167) = **16.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K6 #6 ERKURT (tjkAtId 111448) — önceki koşu: 12.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.08.2026 | GALOP | 600 m | 44.50 | 29.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 43.60 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 62.20 | 31.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | SPRINT | 400 m | 30.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 59.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | SPRINT | 400 m | 31.60 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 43.60 | 28.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.11.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.11.2026 | GALOP | 800 m | 59.90 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K6 #7 SABIR ÇİÇEĞİ (tjkAtId 99161) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.07.2026 | GALOP | 600 m | 48.00 | 32.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 14.11.2026 | GALOP | 1000 m | 82.00 | 34.70 | ÇR→5 | KUM/? | KULLANILDI | S2 · 1511 · 71.90 · 2.40 · 15.11.2026 | -4.21 | 32.37 · 2.33 · 0.89 · 1511 | -2.61 | 1.45 |

**Ara adımlar** — hız: son 1 hızZ [-4.21] → ortalama **-4.205** · kapanış: [-2.61] → **-2.613** · efor: [1.45] → **1.452** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.083 · kapanış 0.083 · efor 0.917 · trend — · süreklilik 0.167
**KAPASİTE** = ortalama(0.083, 0.083, 0.917) = **36.1** · **HAZIRLIK** = ortalama(0.167) = **16.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K6 #8 DOĞAN KARDEŞLER (tjkAtId 93751) — önceki koşu: 05.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01.03.2026 | GALOP | 1000 m | 72.80 | 29.20 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.03.2026 | GALOP | 1000 m | 71.30 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.03.2026 | GALOP | 1000 m | 70.20 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Adana K7 (1300 m) — 10 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): yok
Eşit puanlı atlar — KAPASİTE: yok | HAZIRLIK: #2=#9=#11 (15.0) · #4=#7 (50.0)

#### Adana K7 #1 DR NECO (tjkAtId 112590) — önceki koşu: 11.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 07.08.2026 | GALOP | 600 m | 38.50 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 38.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 50.70 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 50.70 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.00 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.00 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.08.2026 | GALOP | 600 m | 36.50 | 23.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 50.90 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 62.30 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | GALOP | 600 m | 38.60 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 64.20 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 800 m | 47.90 | 23.70 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 800 m | 50.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | GALOP | 600 m | 39.70 | 26.50 | ÇR→5 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.46 | 25.97 · 0.53 · 0.45 · 3203 | -1.17 | 1.45 |
| 25.10.2026 | GALOP | 1000 m | 64.00 | 25.50 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | 0.39 | 25.27 · 0.23 · 0.67 · 1780 | -0.34 | 0.34 |
| 30.10.2026 | SPRINT | 400 m | 26.00 | — | ÇR→5 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | -0.13 | — | — | 1.45 |
| 01.11.2026 | GALOP | 1200 m | 78.00 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 131 · 78.34 · 1.90 · 08.11.2026 | 0.18 | 25.48 · 0.12 · 0.78 · 131 | -0.15 | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 63.80 | 25.40 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | 0.50 | 25.19 · 0.21 · 0.67 · 1780 | -0.31 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 48.50 | 24.50 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 1.63 | 23.97 · 0.53 · 0.70 · 2699 | -0.76 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.18, 0.50, 1.63] → ortalama **0.771** · kapanış: [-0.15, -0.31, -0.76] → **-0.407** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 1000|GALOP|KUM: 25.10.2026→z=0.394, 08.11.2026→z=0.503 → **0.109** · süreklilik: son 28 günde 6 farklı idman günü (22.10.2026, 25.10.2026, 30.10.2026, 01.11.2026, 08.11.2026, 15.11.2026) → **6**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.950 · kapanış 0.611 · efor 0.700 · trend 0.375 · süreklilik 0.800
**KAPASİTE** = ortalama(0.950, 0.611, 0.700) = **75.4** · **HAZIRLIK** = ortalama(0.375, 0.800) = **58.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #2 FOREVER DALLAS (tjkAtId 115156) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16.07.2026 | GALOP | 600 m | 40.00 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 52.90 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 39.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 1000 m | 63.00 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 39.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 1000 m | 65.50 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | GALOP | 1000 m | 65.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 800 m | 51.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 800 m | 51.50 | 25.70 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 65.40 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 37.40 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.07 | 25.51 · 0.49 · 0.45 · 3203 | -1.08 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.07] → ortalama **-0.073** · kapanış: [-1.08] → **-1.081** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.550 · kapanış 0.278 · efor 0.700 · trend — · süreklilik 0.150
**KAPASİTE** = ortalama(0.550, 0.278, 0.700) = **50.9** · **HAZIRLIK** = ortalama(0.150) = **15.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #4 BAŞIMIN BELASI (tjkAtId 115516) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 17.07.2026 | GALOP | 600 m | 38.20 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 51.60 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 51.60 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.20 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.20 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.20 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 18.10.2026 | GALOP | 600 m | 38.50 | 25.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 68.40 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 1000 m | 67.50 | 28.00 | R→4 | KUM/IC | KULLANILDI | S1 · 492 · 64.81 · 2.35 · 14.11.2026 | -1.15 | 26.68 · 1.32 · 0.70 · 492 | -1.89 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 38.30 | 24.50 | Ç→1 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 0.42 | 24.98 · -0.48 · 0.48 · 907 | 1.01 | -3.01 |
| 15.11.2026 | GALOP | 800 m | 54.20 | 27.00 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | -0.42 | 26.80 · 0.20 · 0.92 · 747 | -0.22 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-1.15, 0.42, -0.42] → ortalama **-0.380** · kapanış: [-1.89, 1.01, -0.22] → **-0.368** · efor: [0.34, -3.01, 0.34] → **-0.781** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (08.11.2026, 13.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.250 · kapanış 0.722 · efor 0.200 · trend — · süreklilik 0.500
**KAPASİTE** = ortalama(0.250, 0.722, 0.200) = **39.1** · **HAZIRLIK** = ortalama(0.500) = **50.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #5 DE HELE (tjkAtId 114331) — önceki koşu: 17.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.07.2026 | GALOP | 800 m | 50.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 50.00 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | SPRINT | 400 m | 24.30 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | SPRINT | 400 m | 23.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 51.30 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 50.20 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 49.40 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | SPRINT | 400 m | 24.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 49.30 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 63.40 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | GALOP | 600 m | 37.80 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 51.00 | 25.50 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.58 | 25.19 · 0.31 · 0.70 · 2699 | -0.44 | 0.34 |
| 29.10.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 1.14 | — | — | 0.34 |
| 01.11.2026 | GALOP | 800 m | 49.40 | 24.70 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 1.25 | 24.41 · 0.29 · 0.70 · 2699 | -0.42 | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 65.40 | 28.00 | Ç→1 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | -0.37 | 25.82 · 2.18 · 0.67 · 1780 | -3.25 | -3.01 |
| 13.11.2026 | SPRINT | 400 m | 25.20 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 0.38 | — | — | 0.34 |
| 15.11.2026 | GALOP | 600 m | 38.50 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 0.20 | 25.18 · 0.82 · 0.45 · 3203 | -1.81 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.37, 0.38, 0.20] → ortalama **0.069** · kapanış: [-0.42, -3.25, -1.81] → **-1.823** · efor: [-3.01, 0.34, 0.34] → **-0.781** · trend: 400|SPRINT|KUM: 29.10.2026→z=1.139, 13.11.2026→z=0.377 → **-0.761** · süreklilik: son 28 günde 6 farklı idman günü (25.10.2026, 29.10.2026, 01.11.2026, 08.11.2026, 13.11.2026, 15.11.2026) → **6**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.750 · kapanış 0.056 · efor 0.200 · trend 0.125 · süreklilik 0.800
**KAPASİTE** = ortalama(0.750, 0.056, 0.200) = **33.5** · **HAZIRLIK** = ortalama(0.125, 0.800) = **46.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #6 SAGENDOR (tjkAtId 112847) — önceki koşu: 18.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20.08.2026 | SPRINT | 400 m | 24.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 51.70 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.08.2026 | SPRINT | 400 m | 26.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 600 m | 38.80 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | SPRINT | 400 m | 24.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 52.60 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 24.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 51.50 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | SPRINT | 400 m | 24.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 49.80 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 50.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | SPRINT | 400 m | 24.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 63.50 | 25.60 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 64.00 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 0.50 | — | — | 0.34 |
| 25.10.2026 | SPRINT | 400 m | 25.60 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 0.12 | — | — | 0.34 |
| 01.11.2026 | GALOP | 800 m | 52.40 | 26.20 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.02 | 25.87 · 0.33 · 0.70 · 2699 | -0.47 | 0.34 |
| 05.11.2026 | SPRINT | 400 m | 24.40 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 0.89 | — | — | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 64.00 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | 0.39 | 25.27 · 0.73 · 0.67 · 1780 | -1.09 | 0.34 |
| 13.11.2026 | SPRINT | 400 m | 24.20 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 1.01 | — | — | 0.34 |
| 15.11.2026 | GALOP | 600 m | 37.50 | 25.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 0.75 | 24.52 · 0.48 · 0.45 · 3203 | -1.05 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.39, 1.01, 0.75] → ortalama **0.718** · kapanış: [-0.47, -1.09, -1.05] → **-0.869** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 400|SPRINT|KUM: 23.10.2026→z=0.504, 25.10.2026→z=0.124, 05.11.2026→z=0.885, 13.11.2026→z=1.012 → **0.508** · süreklilik: son 28 günde 7 farklı idman günü (23.10.2026, 25.10.2026, 01.11.2026, 05.11.2026, 08.11.2026, 13.11.2026, 15.11.2026) → **7**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.850 · kapanış 0.389 · efor 0.700 · trend 0.625 · süreklilik 0.950
**KAPASİTE** = ortalama(0.850, 0.389, 0.700) = **64.6** · **HAZIRLIK** = ortalama(0.625, 0.950) = **78.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #7 ÜNLÜ PAŞA (tjkAtId 121992) — önceki koşu: 18.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 03.10.2026 | GALOP | 800 m | 54.70 | 26.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 800 m | 54.70 | 28.10 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 43.30 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.11.2026 | GALOP | 600 m | 43.60 | 28.20 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -2.59 | 28.54 · -0.34 · 0.45 · 3203 | 0.74 | 0.34 |
| 12.11.2026 | SPRINT | 400 m | 26.40 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | -0.38 | — | — | 0.34 |
| 14.11.2026 | GALOP | 800 m | 55.80 | 30.50 | HÇ→2 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -1.45 | 27.53 · 2.97 · 0.70 · 2699 | -4.23 | -1.90 |

**Ara adımlar** — hız: son 3 hızZ [-2.59, -0.38, -1.45] → ortalama **-1.474** · kapanış: [0.74, -4.23] → **-1.745** · efor: [0.34, 0.34, -1.90] → **-0.409** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (07.11.2026, 12.11.2026, 14.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.050 · kapanış 0.167 · efor 0.400 · trend — · süreklilik 0.500
**KAPASİTE** = ortalama(0.050, 0.167, 0.400) = **20.6** · **HAZIRLIK** = ortalama(0.500) = **50.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #8 YAĞIZ EFENDİ (tjkAtId 113772) — önceki koşu: 18.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 08.10.2026 | GALOP | 600 m | 42.00 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 66.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | GALOP | 800 m | 51.70 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 52.40 | 26.20 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.02 | 25.87 · 0.33 · 0.70 · 2699 | -0.47 | 0.34 |
| 06.11.2026 | GALOP | 600 m | 40.00 | 26.50 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.62 | 26.17 · 0.33 · 0.45 · 3203 | -0.73 | 0.34 |
| 08.11.2026 | GALOP | 600 m | 40.40 | 26.00 | HÇ→2 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.84 | 26.43 · -0.43 · 0.45 · 3203 | 0.95 | -1.90 |
| 15.11.2026 | GALOP | 800 m | 50.60 | 25.30 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.74 | 24.99 · 0.31 · 0.70 · 2699 | -0.44 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.62, -0.84, 0.74] → ortalama **-0.239** · kapanış: [-0.73, 0.95, -0.44] → **-0.074** · efor: [0.34, -1.90, 0.34] → **-0.409** · trend: 800|GALOP|KUM: 01.11.2026→z=-0.015, 15.11.2026→z=0.744 → **0.759** · süreklilik: son 28 günde 4 farklı idman günü (01.11.2026, 06.11.2026, 08.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.450 · kapanış 0.833 · efor 0.400 · trend 0.875 · süreklilik 0.650
**KAPASİTE** = ortalama(0.450, 0.833, 0.400) = **56.1** · **HAZIRLIK** = ortalama(0.875, 0.650) = **76.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #9 BITTERSWEET (tjkAtId 114476) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.08.2026 | GALOP | 400 m | 24.50 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 11.08.2026 | GALOP | 400 m | 24.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 49.50 | 24.30 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 49.50 | 24.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 24.20 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 24.20 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 40.90 | 27.20 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 51.60 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 39.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 65.50 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 600 m | 38.50 | 25.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 37.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 39.40 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | SPRINT | 400 m | 26.20 | — | ÇR→5 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | -0.26 | — | — | 1.45 |

**Ara adımlar** — hız: son 1 hızZ [-0.26] → ortalama **-0.257** · kapanış: [] → **—** · efor: [1.45] → **1.452** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.350 · kapanış — · efor 0.950 · trend — · süreklilik 0.150
**KAPASİTE** = ortalama(0.350, 0.950) = **65.0** · **HAZIRLIK** = ortalama(0.150) = **15.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #10 İPTİSAM (tjkAtId 116757) — önceki koşu: 11.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16.04.2026 | SPRINT | 400 m | 26.40 | — | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 39.50 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 69.00 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 800 m | 52.90 | 26.40 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 41.40 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | SPRINT | 400 m | 26.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 69.00 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 52.80 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 800 m | 53.60 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 40.20 | 25.60 | HÇ→2 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | -0.46 | 26.30 · -0.70 · 0.48 · 907 | 1.47 | -1.90 |
| 15.11.2026 | GALOP | 800 m | 55.50 | 26.00 | HÇ→2 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | -0.90 | 27.50 · -1.50 · 0.92 · 747 | 1.63 | -1.90 |

**Ara adımlar** — hız: son 2 hızZ [-0.46, -0.90] → ortalama **-0.680** · kapanış: [1.47, 1.63] → **1.549** · efor: [-1.90, -1.90] → **-1.898** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.150 · kapanış 0.944 · efor 0.050 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.150, 0.944, 0.050) = **38.1** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K7 #11 QUEEN BADE (tjkAtId 116435) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20.09.2026 | GALOP | 800 m | 53.50 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 53.90 | 26.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 36.70 | 24.00 | Ç→1 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 66.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 37.20 | 24.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 600 m | 39.50 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 51.40 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | SPRINT | 400 m | 25.10 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 52.30 | 26.20 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.03 | 25.82 · 0.38 · 0.70 · 2699 | -0.54 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.03] → ortalama **0.027** · kapanış: [-0.54] → **-0.537** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.650 · kapanış 0.500 · efor 0.700 · trend — · süreklilik 0.150
**KAPASİTE** = ortalama(0.650, 0.500, 0.700) = **61.7** · **HAZIRLIK** = ortalama(0.150) = **15.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Adana K8 (1300 m) — 16 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #1 DİCLE FIRAT, #4 SERPENÇE, #9 OĞLUM VELAT, #12 KIRKPINAR BEYİ
Eşit puanlı atlar — KAPASİTE: yok | HAZIRLIK: #2=#3=#5=#7=#10=#11=#14=#15=#16 (37.5)

#### Adana K8 #1 DİCLE FIRAT (tjkAtId 107583) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 23.04.2026 | GALOP | 800 m | 62.00 | 31.00 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.06.2026 | GALOP | 800 m | 56.90 | 28.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.06.2026 | GALOP | 600 m | 44.50 | 29.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.06.2026 | GALOP | 600 m | 44.50 | 29.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #2 DUMANLIGÖZ (tjkAtId 105467) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01.11.2026 | GALOP | 800 m | 60.60 | 30.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 43.00 | 28.80 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.09 | 28.36 · 0.44 · 0.79 · 4212 | -0.55 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.09] → ortalama **0.094** · kapanış: [-0.55] → **-0.551** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.591 · kapanış 0.389 · efor 0.583 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.591, 0.389, 0.583) = **52.1** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #3 MESTAN BEY (tjkAtId 103615) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 18.07.2026 | GALOP | 800 m | 58.20 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 800 m | 58.20 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 59.50 | 29.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 59.50 | 29.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 59.50 | 29.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 61.80 | 30.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 61.80 | 30.00 | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 61.80 | 30.00 | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 63.00 | 30.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 63.00 | 30.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 63.00 | 30.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 63.00 | 30.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.09.2026 | GALOP | 800 m | 60.00 | 30.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 55.80 | 28.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | SPRINT | 400 m | 27.80 | — | R→4 | KUM/? | KULLANILDI | S2 · 1535 · 28.96 · 1.67 · 15.11.2026 | 0.70 | — | — | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.70] → ortalama **0.696** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.773 · kapanış — · efor 0.583 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.773, 0.583) = **67.8** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #4 SERPENÇE (tjkAtId 111360) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.08.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 58.50 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.70 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.70 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.08.2026 | GALOP | 600 m | 41.00 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 43.00 | 26.80 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 42.70 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 600 m | 42.20 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 600 m | 42.70 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 56.20 | 28.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 55.80 | 28.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 56.70 | 30.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #5 UMUDUM DENİZ (tjkAtId 106591) — önceki koşu: 07.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.06.2026 | GALOP | 600 m | 46.20 | 31.20 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.07.2026 | SPRINT | 400 m | 28.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.07.2026 | GALOP | 800 m | 58.00 | 29.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.07.2026 | GALOP | 600 m | 42.00 | 27.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.07.2026 | GALOP | 600 m | 42.00 | 27.80 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 800 m | 58.50 | 30.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | GALOP | 800 m | 58.50 | 30.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 800 m | 58.50 | 30.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 32.40 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 32.40 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 32.40 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 32.40 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 64.30 | 31.20 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 64.30 | 31.20 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 64.30 | 31.20 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 64.30 | 31.20 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 29.08.2026 | GALOP | 800 m | 64.00 | 32.70 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.09.2026 | GALOP | 800 m | 60.20 | 30.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 22.10.2026 | SPRINT | 400 m | 30.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 600 m | 45.70 | 28.70 | R→4 | KUM/IC | KULLANILDI | S1 · 1256 · 43.38 · 2.33 · 16.11.2026 | -1.00 | 30.30 · -1.60 · 0.92 · 1256 | 1.75 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-1.00] → ortalama **-0.997** · kapanış: [1.75] → **1.747** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.136 · kapanış 0.833 · efor 0.583 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.136, 0.833, 0.583) = **51.8** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #6 EFRUZKIZI (tjkAtId 111453) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.07.2026 | SPRINT | 400 m | 30.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.07.2026 | GALOP | 800 m | 63.00 | 32.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 61.00 | 31.20 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 61.00 | 31.20 | HÇ→2 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 600 m | 46.80 | 30.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 600 m | 46.80 | 30.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 600 m | 46.80 | 30.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 600 m | 46.80 | 30.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.09.2026 | GALOP | 600 m | 45.80 | 30.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.09.2026 | SPRINT | 400 m | 31.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 43.50 | 29.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 42.80 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 43.00 | 28.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 58.00 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 44.00 | 29.00 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 43.70 | 2.88 | Ç→1 | KUM/IC | KULLANILDI | S1 · 1256 · 43.38 · 2.33 · 16.11.2026 | -0.14 | 28.84 · -25.96 · 0.92 · 1256 | 28.27 | -3.01 |
| 15.11.2026 | GALOP | 600 m | 45.80 | 30.50 | ÇR→5 | KUM/IC | KULLANILDI | S1 · 1256 · 43.38 · 2.33 · 16.11.2026 | -1.04 | 30.38 · 0.12 · 0.92 · 1256 | -0.13 | 1.45 |

**Ara adımlar** — hız: son 2 hızZ [-0.14, -1.04] → ortalama **-0.589** · kapanış: [28.27, -0.13] → **14.070** · efor: [-3.01, 1.45] → **-0.781** · trend: 600|GALOP|KUM: 13.11.2026→z=-0.137, 15.11.2026→z=-1.040 → **-0.903** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.227 · kapanış 0.944 · efor 0.125 · trend 0.167 · süreklilik 0.792
**KAPASİTE** = ortalama(0.227, 0.944, 0.125) = **43.2** · **HAZIRLIK** = ortalama(0.167, 0.792) = **47.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #7 GÜLÜMSE BİRAZ (tjkAtId 104295) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 29.06.2026 | GALOP | 600 m | 47.80 | 32.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 600 m | 46.50 | 30.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.07.2026 | GALOP | 800 m | 61.30 | 31.30 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.07.2026 | GALOP | 800 m | 61.30 | 31.30 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | SPRINT | 400 m | 28.40 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | SPRINT | 400 m | 28.40 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | SPRINT | 400 m | 28.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 44.00 | 29.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 44.00 | 29.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 44.00 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.08.2026 | GALOP | 600 m | 46.50 | 30.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.09.2026 | GALOP | 800 m | 60.20 | 30.20 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.09.2026 | GALOP | 600 m | 43.30 | 27.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 60.00 | 29.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 43.50 | 28.00 | HÇ→2 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.16 | 28.70 · -0.70 · 0.79 · 4212 | 0.89 | -1.90 |

**Ara adımlar** — hız: son 1 hızZ [-0.16] → ortalama **-0.162** · kapanış: [0.89] → **0.890** · efor: [-1.90] → **-1.898** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.500 · kapanış 0.722 · efor 0.042 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.500, 0.722, 0.042) = **42.1** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #8 TERKEN HATUN (tjkAtId 111397) — önceki koşu: 18.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.07.2026 | GALOP | 800 m | 56.50 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 56.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 42.00 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 58.80 | 28.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 42.80 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 59.50 | 30.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 68.50 | 28.00 | Ç→1 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 600 m | 40.20 | 26.60 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 57.80 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 53.80 | 27.00 | R→4 | SENTETIK/? | KULLANILDI | S2 · 214 · 55.72 · 2.11 · 15.11.2026 | 0.91 | 26.70 · 0.30 · 0.73 · 214 | -0.41 | 0.34 |
| 13.11.2026 | SPRINT | 400 m | 27.00 | — | R→4 | SENTETIK/? | KULLANILDI | S2 · 107 · 27.68 · 1.50 · 13.11.2026 | 0.45 | — | — | 0.34 |
| 15.11.2026 | GALOP | 800 m | 53.10 | 26.50 | R→4 | SENTETIK/? | KULLANILDI | S2 · 214 · 55.72 · 2.11 · 15.11.2026 | 1.24 | 26.39 · 0.11 · 0.73 · 214 | -0.15 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.91, 0.45, 1.24] → ortalama **0.870** · kapanış: [-0.41, -0.15] → **-0.284** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|SENTETIK: 08.11.2026→z=0.912, 15.11.2026→z=1.243 → **0.332** · süreklilik: son 28 günde 3 farklı idman günü (08.11.2026, 13.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.955 · kapanış 0.611 · efor 0.583 · trend 0.833 · süreklilik 0.875
**KAPASİTE** = ortalama(0.955, 0.611, 0.583) = **71.6** · **HAZIRLIK** = ortalama(0.833, 0.875) = **85.4**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #9 OĞLUM VELAT (tjkAtId 107260) — önceki koşu: 10.11.2026 (kendi kaydımız)
Hiç galop kaydı yok. KAPASİTE = bilinmiyor, HAZIRLIK = bilinmiyor (sıfır puan verilmedi).

#### Adana K8 #10 NERGİSLİK TAY (tjkAtId 106951) — önceki koşu: 13.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 08.08.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 32.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 600 m | 46.50 | 31.30 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 46.30 | 31.90 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.08.2026 | SPRINT | 400 m | 29.70 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.08.2026 | GALOP | 800 m | 62.50 | 32.00 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.09.2026 | GALOP | 800 m | 62.90 | 32.50 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 30.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 600 m | 47.00 | 32.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 1000 m | 77.80 | 32.00 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 800 m | 61.00 | 30.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 58.70 | 29.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 44.00 | 30.20 | ÇR→5 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.42 | 29.04 · 1.16 · 0.79 · 4212 | -1.46 | 1.45 |

**Ara adımlar** — hız: son 1 hızZ [-0.42] → ortalama **-0.417** · kapanış: [-1.46] → **-1.462** · efor: [1.45] → **1.452** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.318 · kapanış 0.167 · efor 0.958 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.318, 0.167, 0.958) = **48.1** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #11 YOSUNKAYA (tjkAtId 106947) — önceki koşu: 11.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15.11.2026 | GALOP | 800 m | 61.60 | 33.00 | R→4 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | -1.39 | 31.01 · 1.99 · 0.69 · 3129 | -2.89 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-1.39] → ortalama **-1.387** · kapanış: [-2.89] → **-2.893** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.045 · kapanış 0.056 · efor 0.583 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.045, 0.056, 0.583) = **22.8** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #12 KIRKPINAR BEYİ (tjkAtId 111373) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01.07.2026 | GALOP | 600 m | 42.60 | 28.30 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 44.20 | 29.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 71.50 | 28.70 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 800 m | 61.50 | 31.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 60.00 | 31.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 43.70 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 62.00 | 32.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 63.00 | 33.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #13 KİRAZLI (tjkAtId 107661) — önceki koşu: 14.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 08.08.2026 | Galop | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 08.08.2026 | Galop | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 15.08.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 15.08.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | GALOP | 600 m | 47.00 | 31.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 29.70 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 29.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 29.70 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.08.2026 | GALOP | 600 m | 46.80 | 30.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.09.2026 | GALOP | 600 m | 47.00 | 31.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | SPRINT | 400 m | 30.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.10.2026 | GALOP | 800 m | 59.80 | 29.70 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 600 m | 43.20 | 28.60 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.01 | 28.50 · 0.10 · 0.79 · 4212 | -0.13 | 0.34 |
| 01.11.2026 | GALOP | 600 m | 42.80 | 28.40 | HÇ→2 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.20 | 28.23 · 0.17 · 0.79 · 4212 | -0.22 | -1.90 |
| 08.11.2026 | GALOP | 1000 m | 75.50 | 31.50 | R→4 | KUM/? | KULLANILDI | S2 · 1511 · 71.90 · 2.40 · 15.11.2026 | -1.50 | 29.95 · 1.55 · 0.89 · 1511 | -1.74 | 0.34 |
| 12.11.2026 | SPRINT | 400 m | 29.60 | — | R→4 | KUM/? | KULLANILDI | S2 · 1535 · 28.96 · 1.67 · 15.11.2026 | -0.38 | — | — | 0.34 |
| 14.11.2026 | GALOP | 800 m | 55.90 | 28.00 | HÇ→2 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 0.89 | 27.68 · 0.32 · 0.69 · 3129 | -0.47 | -1.90 |

**Ara adımlar** — hız: son 3 hızZ [-1.50, -0.38, 0.89] → ortalama **-0.332** · kapanış: [-0.22, -1.74, -0.47] → **-0.807** · efor: [0.34, 0.34, -1.90] → **-0.409** · trend: 600|GALOP|KUM: 25.10.2026→z=-0.008, 01.11.2026→z=0.196 → **0.204** · süreklilik: son 28 günde 5 farklı idman günü (25.10.2026, 01.11.2026, 08.11.2026, 12.11.2026, 14.11.2026) → **5**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.409 · kapanış 0.278 · efor 0.208 · trend 0.500 · süreklilik 0.958
**KAPASİTE** = ortalama(0.409, 0.278, 0.208) = **29.8** · **HAZIRLIK** = ortalama(0.500, 0.958) = **72.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #14 ÇETİNYEL (tjkAtId 104881) — önceki koşu: 27.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.04.2026 | GALOP | 600 m | 43.60 | 29.10 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.05.2026 | GALOP | 800 m | 59.50 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.05.2026 | GALOP | 800 m | 56.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.05.2026 | GALOP | 600 m | 41.20 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.05.2026 | SPRINT | 400 m | 26.70 | — | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 59.70 | 29.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 600 m | 44.80 | 29.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 600 m | 44.80 | 29.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 30.40 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 30.40 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 30.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 61.80 | 30.60 | HÇ→2 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 61.80 | 30.60 | HÇ→2 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 61.80 | 30.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.08.2026 | GALOP | 600 m | 45.40 | 29.70 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 800 m | 56.60 | 27.80 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 45.80 | 30.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 600 m | 43.30 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 56.90 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 41.70 | 27.80 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.76 | 27.48 · 0.32 · 0.79 · 4212 | -0.40 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.76] → ortalama **0.758** · kapanış: [-0.40] → **-0.404** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.864 · kapanış 0.500 · efor 0.583 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.864, 0.500, 0.583) = **64.9** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #15 BİRÇEKIZ (tjkAtId 111409) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.07.2026 | GALOP | 600 m | 47.80 | 30.80 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | SPRINT | 400 m | 29.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | SPRINT | 400 m | 29.80 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 600 m | 45.80 | 29.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.08.2026 | GALOP | 600 m | 45.80 | 29.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 600 m | 45.80 | 29.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 62.50 | 30.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 62.50 | 30.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 62.50 | 30.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 41.60 | 27.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 57.50 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 43.40 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 56.00 | 28.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 800 m | 53.70 | 26.80 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 44.50 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 45.40 | 30.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 43.80 | 29.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 600 m | 44.70 | 29.50 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 59.50 | 30.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | SPRINT | 600 m | 43.00 | 29.00 | R→4 | KUM/? | KULLANILDI | referans yok (n<30) | — | — | — | 0.34 |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor 0.583 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.583) = **58.3** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Adana K8 #16 İYİMSER (tjkAtId 107647) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.06.2026 | GALOP | 800 m | 54.40 | 27.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.06.2026 | SPRINT | 400 m | 27.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.06.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 30.06.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 57.40 | 27.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 57.40 | 27.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 42.30 | 28.10 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 42.30 | 28.10 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 42.30 | 28.10 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.40 | 28.20 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.40 | 28.20 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.40 | 28.20 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.09.2026 | GALOP | 800 m | 56.20 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 600 m | 42.00 | 28.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 42.60 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 44.00 | 29.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 71.00 | 29.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 57.40 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 1000 m | 71.20 | 29.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | SPRINT | 400 m | 28.20 | — | R→4 | KUM/? | KULLANILDI | S2 · 1535 · 28.96 · 1.67 · 15.11.2026 | 0.46 | — | — | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.46] → ortalama **0.456** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.682 · kapanış — · efor 0.583 · trend — · süreklilik 0.375
**KAPASİTE** = ortalama(0.682, 0.583) = **63.3** · **HAZIRLIK** = ortalama(0.375) = **37.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K1 (1200 m) — 9 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #8 ELİFCİM
Eşit puanlı atlar — KAPASİTE: #1=#5 (64.6) · #2=#6 (47.9) | HAZIRLIK: #1=#2=#4 (18.8)

#### Antalya K1 #1 HAS TURBO (tjkAtId 116486) — önceki koşu: 31.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.07.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 38.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 50.20 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 63.60 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 800 m | 51.60 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 800 m | 49.50 | 24.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 800 m | 49.50 | 24.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.09.2026 | GALOP | 1000 m | 63.50 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 800 m | 52.80 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.09.2026 | GALOP | 600 m | 37.70 | 25.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 1000 m | 65.00 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | GALOP | 600 m | 37.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 800 m | 51.70 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 800 m | 51.70 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 600 m | 38.20 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.11.2026 | GALOP | 800 m | 52.70 | 25.20 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.14 | 26.02 · -0.82 · 0.70 · 2699 | 1.17 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.14] → ortalama **-0.142** · kapanış: [1.17] → **1.165** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (12.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.438 · kapanış 0.938 · efor 0.563 · trend — · süreklilik 0.188
**KAPASİTE** = ortalama(0.438, 0.938, 0.563) = **64.6** · **HAZIRLIK** = ortalama(0.188) = **18.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #2 BATURTAY (tjkAtId 114473) — önceki koşu: 07.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 24.09.2026 | GALOP | 600 m | 37.30 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 1000 m | 66.30 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | GALOP | 800 m | 52.00 | 26.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.10.2026 | GALOP | 1200 m | 81.20 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 600 m | 37.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | GALOP | 800 m | 51.00 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.11.2026 | GALOP | 1400 m | 96.20 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.11.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 14.11.2026 | GALOP | 800 m | 52.00 | 25.80 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.15 | 25.68 · 0.12 · 0.70 · 2699 | -0.18 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.15] → ortalama **0.154** · kapanış: [-0.18] → **-0.176** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.563 · kapanış 0.313 · efor 0.563 · trend — · süreklilik 0.188
**KAPASİTE** = ortalama(0.563, 0.313, 0.563) = **47.9** · **HAZIRLIK** = ortalama(0.188) = **18.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #3 FULLSET (tjkAtId 115938) — önceki koşu: 30.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 14.08.2026 | GALOP | 600 m | 39.20 | 25.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 53.30 | 26.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 53.30 | 26.30 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 71.00 | 26.70 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 40.50 | 25.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 69.00 | 28.70 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.09.2026 | GALOP | 800 m | 53.00 | 26.30 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.10.2026 | GALOP | 800 m | 50.60 | 24.70 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | GALOP | 800 m | 53.40 | 24.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 39.00 | 25.80 | HÇ→2 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.07 | 25.51 · 0.29 · 0.45 · 3203 | -0.64 | -1.90 |
| 08.11.2026 | GALOP | 800 m | 52.40 | 27.00 | Ç→1 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.02 | 25.87 · 1.13 · 0.70 · 2699 | -1.61 | -3.01 |
| 16.11.2026 | SPRINT | 400 m | 25.40 | — | R→4 | SENTETIK/? | KULLANILDI | S2 · 116 · 24.34 · 1.17 · 16.11.2026 | -0.91 | — | — | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.07, -0.02, -0.91] → ortalama **-0.331** · kapanış: [-0.64, -1.61] → **-1.124** · efor: [-1.90, -3.01, 0.34] → **-1.526** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (06.11.2026, 08.11.2026, 16.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.063 · kapanış 0.063 · efor 0.063 · trend — · süreklilik 0.563
**KAPASİTE** = ortalama(0.063, 0.063, 0.063) = **6.3** · **HAZIRLIK** = ortalama(0.563) = **56.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #4 KADİRİNOĞLU (tjkAtId 115215) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20.09.2026 | GALOP | 1000 m | 66.40 | 26.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 38.60 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 52.00 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 65.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 1000 m | 70.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 53.60 | 26.50 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | -0.20 | 26.47 · 0.03 · 0.92 · 747 | -0.03 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.20] → ortalama **-0.195** · kapanış: [-0.03] → **-0.030** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.313 · kapanış 0.438 · efor 0.563 · trend — · süreklilik 0.188
**KAPASİTE** = ortalama(0.313, 0.438, 0.563) = **43.8** · **HAZIRLIK** = ortalama(0.188) = **18.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #5 PETIT PRINCE (tjkAtId 115590) — önceki koşu: 28.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 18.10.2026 | GALOP | 1000 m | 64.50 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 37.80 | 25.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 65.00 | 25.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 1000 m | 64.00 | 25.30 | R→4 | KUM/IC | KULLANILDI | S1 · 492 · 64.81 · 2.35 · 14.11.2026 | 0.34 | 25.15 · 0.15 · 0.70 · 492 | -0.21 | 0.34 |
| 06.11.2026 | GALOP | 600 m | 38.60 | 25.20 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 0.28 | 25.19 · 0.01 · 0.48 · 907 | -0.02 | 0.34 |
| 08.11.2026 | GALOP | 800 m | 53.00 | 25.80 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | 0.03 | 26.15 · -0.35 · 0.92 · 747 | 0.38 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 51.00 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | 0.77 | 25.07 · -0.07 · 0.92 · 747 | 0.07 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.28, 0.03, 0.77] → ortalama **0.359** · kapanış: [-0.02, 0.38, 0.07] → **0.145** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 08.11.2026→z=0.027, 15.11.2026→z=0.766 → **0.739** · süreklilik: son 28 günde 4 farklı idman günü (01.11.2026, 06.11.2026, 08.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.813 · kapanış 0.563 · efor 0.563 · trend 0.833 · süreklilik 0.688
**KAPASİTE** = ortalama(0.813, 0.563, 0.563) = **64.6** · **HAZIRLIK** = ortalama(0.833, 0.688) = **76.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #6 ROCINANTE (tjkAtId 114590) — önceki koşu: 21.07.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.07.2026 | GALOP | 600 m | 38.80 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 1000 m | 66.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 800 m | 51.80 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | SPRINT | 400 m | 26.50 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | -0.45 | — | — | 0.34 |
| 13.09.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | -0.13 | — | — | 0.34 |
| 20.09.2026 | SPRINT | 400 m | 26.20 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | -0.26 | — | — | 0.34 |
| 27.09.2026 | GALOP | 600 m | 40.50 | 26.50 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.89 | 26.50 · 0.00 · 0.45 · 3203 | -0.01 | 0.34 |
| 01.10.2026 | GALOP | 600 m | 40.50 | 26.20 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.89 | 26.50 · -0.30 · 0.45 · 3203 | 0.65 | 0.34 |
| 04.10.2026 | GALOP | 800 m | 53.00 | 26.30 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.27 | 26.16 · 0.14 · 0.70 · 2699 | -0.19 | 0.34 |
| 09.10.2026 | GALOP | 600 m | 39.70 | 25.70 | — | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.46 | 25.97 · -0.27 · 0.45 · 3203 | 0.59 | — |
| 11.10.2026 | GALOP | 800 m | 52.00 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.15 | 25.68 · -0.08 · 0.70 · 2699 | 0.11 | 0.34 |
| 15.10.2026 | GALOP | 600 m | 37.00 | 24.40 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 1.02 | 24.19 · 0.21 · 0.45 · 3203 | -0.46 | 0.34 |
| 22.10.2026 | GALOP | 600 m | 37.00 | 24.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 1.02 | 24.19 · -0.19 · 0.45 · 3203 | 0.42 | 0.34 |
| 25.10.2026 | GALOP | 1000 m | 65.80 | 25.80 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | -0.59 | 25.98 · -0.18 · 0.67 · 1780 | 0.26 | 0.34 |
| 29.10.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.07 | 25.51 · 0.49 · 0.45 · 3203 | -1.08 | 0.34 |
| 01.11.2026 | GALOP | 800 m | 51.00 | 25.70 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.58 | 25.19 · 0.51 · 0.70 · 2699 | -0.73 | 0.34 |
| 10.11.2026 | GALOP | 600 m | 39.60 | 26.50 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | -0.18 | 25.89 · 0.61 · 0.48 · 907 | -1.28 | 0.34 |
| 12.11.2026 | GALOP | 1000 m | 64.20 | 24.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.11.2026 | GALOP | 1000 m | 64.20 | 24.50 | R→4 | KUM/IC | KULLANILDI | S1 · 492 · 64.81 · 2.35 · 14.11.2026 | 0.26 | 25.24 · -0.74 · 0.70 · 492 | 1.06 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.58, -0.18, 0.26] → ortalama **0.217** · kapanış: [-0.73, -1.28, 1.06] → **-0.316** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 27.09.2026→z=-0.894, 01.10.2026→z=-0.894, 09.10.2026→z=-0.456, 15.10.2026→z=1.022, 22.10.2026→z=1.022, 29.10.2026→z=-0.073, 10.11.2026→z=-0.183 → **0.711** · süreklilik: son 28 günde 6 farklı idman günü (22.10.2026, 25.10.2026, 29.10.2026, 01.11.2026, 10.11.2026, 12.11.2026) → **6**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.688 · kapanış 0.188 · efor 0.563 · trend 0.500 · süreklilik 0.875
**KAPASİTE** = ortalama(0.688, 0.188, 0.563) = **47.9** · **HAZIRLIK** = ortalama(0.500, 0.875) = **68.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #7 SON OF ŞÜKRAN (tjkAtId 113895) — önceki koşu: 15.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.07.2026 | GALOP | 600 m | 38.40 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 600 m | 38.40 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.60 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.60 | 24.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 37.00 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 37.00 | 24.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 37.00 | 24.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 37.00 | 24.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.10.2026 | GALOP | 600 m | 38.80 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 800 m | 52.00 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 600 m | 38.50 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 1000 m | 63.50 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.10.2026 | SPRINT | 400 m | 25.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 600 m | 38.20 | 25.50 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 0.37 | 24.98 · 0.52 · 0.45 · 3203 | -1.14 | 0.34 |
| 28.10.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 0.50 | — | — | 0.34 |
| 31.10.2026 | GALOP | 600 m | 40.00 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | -0.62 | 26.17 · -0.57 · 0.45 · 3203 | 1.25 | 0.34 |
| 07.11.2026 | GALOP | 600 m | 38.80 | 25.30 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 0.04 | 25.38 · -0.08 · 0.45 · 3203 | 0.17 | 0.34 |
| 12.11.2026 | SPRINT | 400 m | 24.80 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 0.63 | — | — | 0.34 |
| 14.11.2026 | GALOP | 800 m | 50.70 | 25.30 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.70 | 25.04 · 0.26 · 0.70 · 2699 | -0.37 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.04, 0.63, 0.70] → ortalama **0.456** · kapanış: [1.25, 0.17, -0.37] → **0.350** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 24.10.2026→z=0.365, 31.10.2026→z=-0.620, 07.11.2026→z=0.037 → **-0.329** · süreklilik: son 28 günde 6 farklı idman günü (24.10.2026, 28.10.2026, 31.10.2026, 07.11.2026, 12.11.2026, 14.11.2026) → **6**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.938 · kapanış 0.688 · efor 0.563 · trend 0.167 · süreklilik 0.875
**KAPASİTE** = ortalama(0.938, 0.688, 0.563) = **72.9** · **HAZIRLIK** = ortalama(0.167, 0.875) = **52.1**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #8 ELİFCİM (tjkAtId 113511) — önceki koşu: 04.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.08.2026 | GALOP | 800 m | 51.00 | 25.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 40.30 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.08.2026 | GALOP | 800 m | 54.50 | 25.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.09.2026 | GALOP | 800 m | 53.50 | 26.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.10.2026 | GALOP | 800 m | 53.30 | 25.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | GALOP | 800 m | 52.30 | 26.30 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 53.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K1 #9 SINISTRA DERMAN (tjkAtId 112829) — önceki koşu: 04.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.08.2026 | GALOP | 1000 m | 64.60 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 63.00 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 25.40 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 1200 m | 77.70 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.09.2026 | GALOP | 800 m | 48.70 | 24.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 1000 m | 63.50 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 43.00 | 28.50 | ÇR→5 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 50.00 | 24.20 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 37.20 | 24.30 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 50.30 | 25.20 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.11.2026 | GALOP | 600 m | 39.00 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 0.10 | 25.47 · -0.47 · 0.48 · 907 | 0.98 | 0.34 |
| 13.11.2026 | GALOP | 1000 m | 66.00 | 25.50 | R→4 | KUM/IC | KULLANILDI | S1 · 492 · 64.81 · 2.35 · 14.11.2026 | -0.51 | 26.02 · -0.52 · 0.70 · 492 | 0.75 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.10, -0.51] → ortalama **-0.206** · kapanış: [0.98, 0.75] → **0.865** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (11.11.2026, 13.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.188 · kapanış 0.813 · efor 0.563 · trend — · süreklilik 0.438
**KAPASİTE** = ortalama(0.188, 0.813, 0.563) = **52.1** · **HAZIRLIK** = ortalama(0.438) = **43.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K2 (1300 m) — 6 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #4 USLU TAY
Eşit puanlı atlar — KAPASİTE: #1=#3 (50.0) · #2=#6 (56.7) | HAZIRLIK: #3=#6 (40.0)

#### Antalya K2 #1 RAZENOID (tjkAtId 113536) — önceki koşu: 02.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.07.2026 | SPRINT | 400 m | 26.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 54.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 53.40 | 24.40 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.08.2026 | GALOP | 600 m | 38.20 | 24.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 600 m | 38.20 | 24.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 62.00 | 24.50 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 62.00 | 24.50 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 62.00 | 24.50 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 62.00 | 24.50 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 37.70 | 24.70 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 49.00 | 24.50 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.09.2026 | GALOP | 1000 m | 63.50 | 24.70 | R→4 | SENTETIK/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 40.50 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.09.2026 | GALOP | 600 m | 38.00 | 25.20 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 0.56 | 24.78 · 0.22 · 0.48 · 907 | -0.47 | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 62.00 | 25.20 | R→4 | KUM/IC | KULLANILDI | S1 · 492 · 64.81 · 2.35 · 14.11.2026 | 1.20 | 24.28 · 0.92 · 0.70 · 492 | -1.32 | 0.34 |
| 15.11.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 0.56 | 24.78 · 0.22 · 0.48 · 907 | -0.47 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.56, 1.20, 0.56] → ortalama **0.774** · kapanış: [-0.47, -1.32, -0.47] → **-0.751** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 06.11.2026→z=0.563, 15.11.2026→z=0.563 → **0.000** · süreklilik: son 28 günde 3 farklı idman günü (06.11.2026, 08.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.900 · kapanış 0.100 · efor 0.500 · trend 0.250 · süreklilik 0.800
**KAPASİTE** = ortalama(0.900, 0.100, 0.500) = **50.0** · **HAZIRLIK** = ortalama(0.250, 0.800) = **52.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K2 #2 MR ÇINAR (tjkAtId 116454) — önceki koşu: 12.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.07.2026 | GALOP | 600 m | 38.20 | 24.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 56.80 | 28.40 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 56.80 | 28.40 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 800 m | 57.00 | 29.60 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 800 m | 57.00 | 29.60 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 19.09.2026 | GALOP | 800 m | 56.00 | 29.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 39.00 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | SPRINT | 400 m | 26.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 38.60 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 0.28 | 25.19 · -0.19 · 0.48 · 907 | 0.40 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.28] → ortalama **0.283** · kapanış: [0.40] → **0.401** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.300 · kapanış 0.900 · efor 0.500 · trend — · süreklilik 0.100
**KAPASİTE** = ortalama(0.300, 0.900, 0.500) = **56.7** · **HAZIRLIK** = ortalama(0.100) = **10.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K2 #3 ALPERİN KIZI (tjkAtId 122567) — önceki koşu: 29.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 06.07.2026 | GALOP | 600 m | 40.90 | 26.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.07.2026 | GALOP | 600 m | 40.90 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.07.2026 | SPRINT | 400 m | 28.50 | — | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.07.2026 | SPRINT | 400 m | 28.50 | — | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.07.2026 | SPRINT | 400 m | 28.50 | — | ÇR→5 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.30 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.30 | 26.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.30 | 26.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 40.30 | 26.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 54.50 | 27.10 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 54.50 | 27.10 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 54.50 | 27.10 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 54.50 | 27.10 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 54.50 | 27.10 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 26.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 26.90 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 26.90 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 26.90 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 26.90 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 26.90 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | SPRINT | 400 m | 26.90 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 07.09.2026 | GALOP | 800 m | 53.50 | 26.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.09.2026 | GALOP | 800 m | 54.60 | 26.90 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.09.2026 | GALOP | 600 m | 40.60 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 600 m | 40.80 | 26.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.10.2026 | GALOP | 800 m | 51.80 | 26.20 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.10.2026 | SPRINT | 400 m | 26.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 37.00 | 24.50 | R→4 | KUM/IC | KULLANILDI | S1 · 907 · 39.21 · 2.15 · 16.11.2026 | 1.03 | 24.08 · 0.42 · 0.48 · 907 | -0.88 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 51.70 | 25.60 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | 0.51 | 25.45 · 0.15 · 0.92 · 747 | -0.17 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [1.03, 0.51] → ortalama **0.768** · kapanış: [-0.88, -0.17] → **-0.522** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.700 · kapanış 0.300 · efor 0.500 · trend — · süreklilik 0.400
**KAPASİTE** = ortalama(0.700, 0.300, 0.500) = **50.0** · **HAZIRLIK** = ortalama(0.400) = **40.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K2 #4 USLU TAY (tjkAtId 113425) — önceki koşu: 09.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 22.06.2026 | GALOP | 600 m | 46.00 | 32.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 400 m | 26.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 400 m | 26.80 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 45.10 | 30.90 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 45.10 | 30.90 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 45.10 | 30.90 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 45.10 | 30.90 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 600 m | 45.10 | 30.90 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.08.2026 | GALOP | 800 m | 54.00 | 26.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 26.09.2026 | GALOP | 800 m | 57.00 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | SPRINT | 400 m | 27.10 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 800 m | 55.90 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | GALOP | 600 m | 42.90 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 800 m | 57.80 | 29.80 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | GALOP | 600 m | 43.80 | 29.20 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.11.2026 | GALOP | 800 m | 59.50 | 29.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K2 #5 İLARMALI (tjkAtId 112955) — önceki koşu: 17.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.06.2026 | Galop | — | — | — | R | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 21.06.2026 | GALOP | 600 m | 40.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 600 m | 41.00 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 51.60 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.07.2026 | GALOP | 600 m | 37.70 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 51.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 1000 m | 65.30 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 37.00 | 24.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 50.20 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 38.60 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.09.2026 | GALOP | 600 m | 38.90 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 52.00 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | GALOP | 600 m | 37.20 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 63.90 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 64.90 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 52.90 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.23 | 26.12 · -0.12 · 0.70 · 2699 | 0.16 | 0.34 |
| 30.10.2026 | GALOP | 1000 m | 65.50 | 26.20 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | -0.42 | 25.86 · 0.34 · 0.67 · 1780 | -0.51 | 0.34 |
| 12.11.2026 | GALOP | 800 m | 51.00 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | 0.77 | 25.07 · -0.07 · 0.92 · 747 | 0.07 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.23, -0.42, 0.77] → ortalama **0.039** · kapanış: [0.16, -0.51, 0.07] → **-0.090** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 25.10.2026→z=-0.226, 12.11.2026→z=0.766 → **0.992** · süreklilik: son 28 günde 3 farklı idman günü (25.10.2026, 30.10.2026, 12.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.100 · kapanış 0.500 · efor 0.500 · trend 0.750 · süreklilik 0.800
**KAPASİTE** = ortalama(0.100, 0.500, 0.500) = **36.7** · **HAZIRLIK** = ortalama(0.750, 0.800) = **77.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K2 #6 ÇİKOK POWER (tjkAtId 122373) — önceki koşu: 30.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 30.08.2026 | GALOP | 1000 m | 66.40 | 25.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 40.90 | 26.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 54.50 | 27.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.09.2026 | GALOP | 600 m | 38.50 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 800 m | 53.00 | 24.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 52.80 | 25.80 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | SPRINT | 400 m | 24.60 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 67.80 | 27.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | GALOP | 600 m | 38.50 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.11.2026 | SPRINT | 400 m | 24.80 | — | R→4 | KUM/IC | KULLANILDI | S1 · 459 · 26.24 · 1.88 · 16.11.2026 | 0.76 | — | — | 0.34 |
| 13.11.2026 | GALOP | 800 m | 52.00 | 25.30 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | 0.40 | 25.61 · -0.31 · 0.92 · 747 | 0.33 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.76, 0.40] → ortalama **0.581** · kapanış: [0.33] → **0.334** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (11.11.2026, 13.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.500 · kapanış 0.700 · efor 0.500 · trend — · süreklilik 0.400
**KAPASİTE** = ortalama(0.500, 0.700, 0.500) = **56.7** · **HAZIRLIK** = ortalama(0.400) = **40.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K3 (1400 m) — 10 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): yok
Eşit puanlı atlar — KAPASİTE: #1=#4 (38.3) · #3=#9 (45.0) | HAZIRLIK: #1=#2=#5=#6=#7=#9=#10 (35.0)

#### Antalya K3 #1 ADANALI DEMİR (tjkAtId 110963) — önceki koşu: 01.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.06.2026 | SPRINT | 400 m | 29.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.06.2026 | GALOP | 800 m | 64.50 | 34.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 800 m | 58.30 | 28.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 800 m | 58.30 | 28.80 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 59.50 | 29.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 59.50 | 29.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.07.2026 | GALOP | 800 m | 59.50 | 29.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 62.60 | 31.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 62.60 | 31.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 62.60 | 31.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 62.60 | 31.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 58.30 | 29.40 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 58.30 | 29.40 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 58.30 | 29.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 58.30 | 29.40 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 800 m | 58.30 | 29.40 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 60.70 | 31.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 60.70 | 31.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 60.70 | 31.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 60.70 | 31.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 60.70 | 31.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 29.08.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 07.09.2026 | SPRINT | 400 m | 29.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.10.2026 | SPRINT | 400 m | 27.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 47.00 | 31.40 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 46.00 | 30.50 | R→4 | KUM/? | KULLANILDI | S2 · 3580 · 43.33 · 1.94 · 16.11.2026 | -1.37 | 30.56 · -0.06 · 0.52 · 3579 | 0.12 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-1.37] → ortalama **-1.374** · kapanış: [0.12] → **0.124** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (13.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.050 · kapanış 0.550 · efor 0.550 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.050, 0.550, 0.550) = **38.3** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #2 DÜZ KOŞU (tjkAtId 110702) — önceki koşu: 07.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.08.2026 | GALOP | 600 m | 43.50 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 58.00 | 29.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 43.00 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.09.2026 | GALOP | 800 m | 55.30 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | SPRINT | 400 m | 27.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 58.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 56.50 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | SPRINT | 400 m | 27.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.11.2026 | SPRINT | 400 m | 28.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 600 m | 42.00 | 27.60 | R→4 | KUM/? | KULLANILDI | S2 · 3580 · 43.33 · 1.94 · 16.11.2026 | 0.69 | 27.70 · -0.10 · 0.52 · 3579 | 0.19 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.69] → ortalama **0.687** · kapanış: [0.19] → **0.188** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.650 · kapanış 0.750 · efor 0.550 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.650, 0.750, 0.550) = **65.0** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #3 TOSBEY (tjkAtId 109045) — önceki koşu: 30.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20.09.2026 | GALOP | 800 m | 53.30 | 26.30 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 56.40 | 26.40 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 600 m | 41.80 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 43.30 | 28.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 69.00 | 27.00 | HR→3 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | SPRINT | 400 m | 27.20 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 56.00 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | Sprint | — | — | — | R | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 08.11.2026 | GALOP | 600 m | 45.00 | 29.60 | R→4 | KUM/IC | KULLANILDI | S1 · 916 · 43.79 · 2.33 · 16.11.2026 | -0.52 | 29.88 · -0.28 · 0.56 · 916 | 0.49 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 42.00 | 27.50 | R→4 | KUM/IC | KULLANILDI | S1 · 916 · 43.79 · 2.33 · 16.11.2026 | 0.77 | 27.64 · -0.14 · 0.56 · 916 | 0.26 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 57.00 | 28.70 | R→4 | KUM/IC | KULLANILDI | S1 · 806 · 58.93 · 3.13 · 15.11.2026 | 0.62 | 28.36 · 0.34 · 0.84 · 806 | -0.40 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.52, 0.77, 0.62] → ortalama **0.290** · kapanış: [0.49, 0.26, -0.40] → **0.115** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 08.11.2026→z=-0.518, 13.11.2026→z=0.768 → **1.286** · süreklilik: son 28 günde 3 farklı idman günü (08.11.2026, 13.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.350 · kapanış 0.450 · efor 0.550 · trend 0.833 · süreklilik 0.750
**KAPASİTE** = ortalama(0.350, 0.450, 0.550) = **45.0** · **HAZIRLIK** = ortalama(0.833, 0.750) = **79.2**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #4 TERZİCAN (tjkAtId 108480) — önceki koşu: 11.07.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.07.2026 | GALOP | 600 m | 42.00 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.07.2026 | GALOP | 1000 m | 70.40 | 29.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 600 m | 46.50 | 30.00 | Ç→1 | KUM/IC | KULLANILDI | S1 · 916 · 43.79 · 2.33 · 16.11.2026 | -1.16 | 30.99 · -0.99 · 0.56 · 916 | 1.76 | -3.01 |
| 30.10.2026 | GALOP | 600 m | 42.20 | 27.60 | R→4 | KUM/? | KULLANILDI | S2 · 3580 · 43.33 · 1.94 · 16.11.2026 | 0.58 | 27.84 · -0.24 · 0.52 · 3579 | 0.47 | 0.34 |
| 01.11.2026 | GALOP | 800 m | 56.30 | 27.60 | R→4 | KUM/? | KULLANILDI | S2 · 3235 · 58.24 · 2.43 · 16.11.2026 | 0.80 | 27.93 · -0.33 · 0.71 · 3234 | 0.47 | 0.34 |
| 06.11.2026 | GALOP | 600 m | 43.40 | 29.20 | R→4 | KUM/? | KULLANILDI | S2 · 3580 · 43.33 · 1.94 · 16.11.2026 | -0.03 | 28.70 · 0.50 · 0.52 · 3579 | -0.97 | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 73.00 | 29.00 | Ç→1 | KUM/? | KULLANILDI | S2 · 1166 · 72.16 · 2.13 · 15.11.2026 | -0.39 | 29.17 · -0.17 · 0.90 · 1166 | 0.18 | -3.01 |
| 14.11.2026 | GALOP | 800 m | 56.80 | 28.50 | R→4 | KUM/IC | KULLANILDI | S1 · 806 · 58.93 · 3.13 · 15.11.2026 | 0.68 | 28.24 · 0.26 · 0.84 · 806 | -0.31 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 57.00 | 27.80 | R→4 | KUM/IC | KULLANILDI | S1 · 806 · 58.93 · 3.13 · 15.11.2026 | 0.62 | 28.36 · -0.56 · 0.84 · 806 | 0.67 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.39, 0.68, 0.62] → ortalama **0.303** · kapanış: [0.18, -0.31, 0.67] → **0.183** · efor: [-3.01, 0.34, 0.34] → **-0.781** · trend: 800|GALOP|KUM: 01.11.2026→z=0.799, 14.11.2026→z=0.683, 15.11.2026→z=0.619 → **-0.180** · süreklilik: son 28 günde 7 farklı idman günü (25.10.2026, 30.10.2026, 01.11.2026, 06.11.2026, 08.11.2026, 14.11.2026, 15.11.2026) → **7**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.450 · kapanış 0.650 · efor 0.050 · trend 0.167 · süreklilik 0.950
**KAPASİTE** = ortalama(0.450, 0.650, 0.050) = **38.3** · **HAZIRLIK** = ortalama(0.167, 0.950) = **55.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #5 YAYLA ÇİÇEĞİ (tjkAtId 116347) — önceki koşu: 06.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16.08.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 41.00 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.08.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 600 m | 41.80 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 42.80 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 56.70 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 42.70 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.11.2026 | GALOP | 600 m | 42.70 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 55.50 | 27.00 | R→4 | KUM/? | KULLANILDI | S2 · 3235 · 58.24 · 2.43 · 16.11.2026 | 1.13 | 27.45 · -0.45 · 0.71 · 3234 | 0.64 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.13] → ortalama **1.128** · kapanış: [0.64] → **0.639** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.950 · kapanış 0.850 · efor 0.550 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.950, 0.850, 0.550) = **78.3** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #6 YOLDERE GÜZELİ (tjkAtId 110911) — önceki koşu: 06.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.07.2026 | GALOP | 1200 m | 82.80 | 27.80 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 26.50 | — | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.08.2026 | GALOP | 800 m | 55.40 | 27.80 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.08.2026 | GALOP | 800 m | 55.40 | 27.80 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 54.00 | 27.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.08.2026 | SPRINT | 400 m | 26.30 | — | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.09.2026 | GALOP | 1000 m | 75.30 | 29.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 600 m | 42.00 | 27.20 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 600 m | 43.30 | 28.30 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.10.2026 | SPRINT | 400 m | 29.20 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | GALOP | 800 m | 57.50 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 42.20 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 57.50 | 28.30 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.11.2026 | GALOP | 800 m | 56.80 | 27.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 55.00 | 26.50 | R→4 | SENTETIK/? | KULLANILDI | S2 · 233 · 55.52 · 1.90 · 15.11.2026 | 0.27 | 27.30 · -0.80 · 0.70 · 233 | 1.14 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.27] → ortalama **0.273** · kapanış: [1.14] → **1.136** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.250 · kapanış 0.950 · efor 0.550 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.250, 0.950, 0.550) = **58.3** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #7 ABANOZ (tjkAtId 116164) — önceki koşu: 14.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.07.2026 | GALOP | 600 m | 41.80 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 800 m | 59.60 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 57.00 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 800 m | 58.80 | 29.60 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 800 m | 58.80 | 29.60 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 59.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 59.00 | 29.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 73.00 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 73.00 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 58.60 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 73.00 | 29.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 73.40 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 57.00 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 56.60 | 28.50 | R→4 | KUM/IC | KULLANILDI | S1 · 806 · 58.93 · 3.13 · 15.11.2026 | 0.75 | 28.12 · 0.38 · 0.84 · 806 | -0.46 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.75] → ortalama **0.747** · kapanış: [-0.46] → **-0.456** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.850 · kapanış 0.250 · efor 0.550 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.850, 0.250, 0.550) = **55.0** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #8 AKİFBERK (tjkAtId 111857) — önceki koşu: 11.06.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.10.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/? | KULLANILDI | S2 · 3580 · 43.33 · 1.94 · 16.11.2026 | 0.43 | 28.06 · -0.06 · 0.52 · 3579 | 0.11 | 0.34 |
| 01.11.2026 | GALOP | 600 m | 44.00 | 29.00 | R→4 | KUM/? | KULLANILDI | S2 · 3580 · 43.33 · 1.94 · 16.11.2026 | -0.34 | 29.13 · -0.13 · 0.52 · 3579 | 0.25 | 0.34 |
| 08.11.2026 | GALOP | 800 m | 57.00 | 28.50 | R→4 | KUM/? | KULLANILDI | S2 · 3235 · 58.24 · 2.43 · 16.11.2026 | 0.51 | 28.35 · 0.15 · 0.71 · 3234 | -0.21 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 54.80 | 27.70 | R→4 | KUM/? | KULLANILDI | S2 · 3235 · 58.24 · 2.43 · 16.11.2026 | 1.42 | 27.04 · 0.66 · 0.71 · 3234 | -0.93 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.34, 0.51, 1.42] → ortalama **0.528** · kapanış: [0.25, -0.21, -0.93] → **-0.298** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 08.11.2026→z=0.510, 15.11.2026→z=1.416 → **0.906** · süreklilik: son 28 günde 4 farklı idman günü (25.10.2026, 01.11.2026, 08.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.550 · kapanış 0.350 · efor 0.550 · trend 0.500 · süreklilik 0.850
**KAPASİTE** = ortalama(0.550, 0.350, 0.550) = **48.3** · **HAZIRLIK** = ortalama(0.500, 0.850) = **67.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #9 GÖKKILIÇ (tjkAtId 116250) — önceki koşu: 10.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.05.2026 | GALOP | 600 m | 41.80 | 26.90 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 600 m | 45.00 | 29.60 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 800 m | 57.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 800 m | 57.00 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 800 m | 56.50 | 28.40 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 800 m | 56.50 | 28.40 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 800 m | 56.50 | 28.40 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 44.00 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 44.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 44.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 44.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 44.00 | 28.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.09.2026 | GALOP | 800 m | 58.00 | 28.60 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.10.2026 | GALOP | 600 m | 43.50 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 58.60 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 56.70 | 28.80 | R→4 | KUM/IC | KULLANILDI | S1 · 806 · 58.93 · 3.13 · 15.11.2026 | 0.72 | 28.18 · 0.62 · 0.84 · 806 | -0.74 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.72] → ortalama **0.715** · kapanış: [-0.74] → **-0.740** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.750 · kapanış 0.050 · efor 0.550 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.750, 0.050, 0.550) = **45.0** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K3 #10 SOSAN AĞA (tjkAtId 112527) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 28.02.2026 | GALOP | 600 m | 47.10 | 32.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.03.2026 | GALOP | 800 m | 60.00 | 29.60 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 24.10.2026 | GALOP | 800 m | 67.00 | 34.50 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 600 m | 44.00 | 29.50 | R→4 | KUM/IC | KULLANILDI | S1 · 916 · 43.79 · 2.33 · 16.11.2026 | -0.09 | 29.13 · 0.37 · 0.56 · 916 | -0.65 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.09] → ortalama **-0.090** · kapanış: [-0.65] → **-0.652** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.150 · kapanış 0.150 · efor 0.550 · trend — · süreklilik 0.350
**KAPASİTE** = ortalama(0.150, 0.150, 0.550) = **28.3** · **HAZIRLIK** = ortalama(0.350) = **35.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K4 (2200 m) — 8 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): yok
Eşit puanlı atlar — KAPASİTE: #5=#8 (50.0) · #6=#7 (41.7) | HAZIRLIK: #1=#2=#4=#5=#6 (31.3)

#### Antalya K4 #1 THUNDER HORSE (tjkAtId 104680) — önceki koşu: 06.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 22.02.2026 | GALOP | 600 m | 38.80 | 25.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.03.2026 | GALOP | 600 m | 37.00 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.03.2026 | GALOP | 1000 m | 63.50 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.03.2026 | GALOP | 800 m | 51.50 | 25.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.03.2026 | GALOP | 600 m | 36.50 | 24.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.04.2026 | GALOP | 600 m | 40.00 | 26.40 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.04.2026 | GALOP | 800 m | 52.50 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.05.2026 | GALOP | 800 m | 51.00 | 24.90 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.05.2026 | SPRINT | 400 m | 26.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.05.2026 | GALOP | 800 m | 53.50 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.05.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.05.2026 | GALOP | 800 m | 56.00 | 28.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.06.2026 | GALOP | 600 m | 39.40 | 25.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 51.50 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | SPRINT | 400 m | 28.30 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 52.50 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | SPRINT | 400 m | 26.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 65.80 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.80 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 65.80 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 600 m | 40.30 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 65.50 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 37.70 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 64.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 40.40 | 26.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 64.70 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 39.20 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 64.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.10.2026 | GALOP | 800 m | 51.70 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.11.2026 | GALOP | 1000 m | 64.20 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 800 m | 52.00 | 25.40 | R→4 | KUM/? | KULLANILDI | S2 · 2266 · 52.41 · 2.48 · 16.11.2026 | 0.17 | 25.64 · -0.24 · 0.63 · 2266 | 0.38 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.17] → ortalama **0.166** · kapanış: [0.38] → **0.380** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.563 · kapanış 0.938 · efor 0.500 · trend — · süreklilik 0.313
**KAPASİTE** = ortalama(0.563, 0.938, 0.500) = **66.7** · **HAZIRLIK** = ortalama(0.313) = **31.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K4 #2 ŞEN AKYÜZ (tjkAtId 86186) — önceki koşu: 06.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.07.2026 | GALOP | 600 m | 36.30 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 52.30 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | SPRINT | 400 m | 25.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 600 m | 39.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 600 m | 39.00 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 37.00 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 37.00 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.60 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.60 | 24.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.60 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.50 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.50 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.50 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 1000 m | 67.70 | 26.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 1000 m | 67.70 | 26.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 1000 m | 67.70 | 26.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 1000 m | 67.70 | 26.20 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 50.30 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 50.30 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 50.30 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 50.30 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 38.20 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 1000 m | 62.70 | 25.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 1000 m | 67.30 | 27.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.09.2026 | GALOP | 600 m | 38.80 | 25.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.09.2026 | GALOP | 600 m | 37.40 | 24.40 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 52.60 | 25.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.10.2026 | GALOP | 1000 m | 64.20 | 25.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 600 m | 37.00 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 1000 m | 65.70 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.11.2026 | GALOP | 600 m | 37.50 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 1000 m | 65.00 | 25.40 | R→4 | KUM/IC | KULLANILDI | S1 · 379 · 65.26 · 2.98 · 15.11.2026 | 0.09 | 25.56 · -0.16 · 0.69 · 379 | 0.23 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.09] → ortalama **0.086** · kapanış: [0.23] → **0.230** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.438 · kapanış 0.813 · efor 0.500 · trend — · süreklilik 0.313
**KAPASİTE** = ortalama(0.438, 0.813, 0.500) = **58.3** · **HAZIRLIK** = ortalama(0.313) = **31.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K4 #3 AEGEAN WOLF (tjkAtId 105340) — önceki koşu: 24.03.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 23.04.2026 | GALOP | 600 m | 41.00 | 26.00 | R→4 | KUM/? | KULLANILDI | S2 · 2921 · 38.96 · 1.87 · 15.11.2026 | -1.09 | 26.80 · -0.80 · 0.46 · 2921 | 1.74 | 0.34 |
| 26.04.2026 | GALOP | 1000 m | 64.00 | 25.50 | R→4 | KUM/? | KULLANILDI | S2 · 1341 · 64.85 · 2.38 · 15.11.2026 | 0.36 | 25.24 · 0.26 · 0.63 · 1341 | -0.41 | 0.34 |
| 29.10.2026 | GALOP | 800 m | 54.00 | 27.70 | R→4 | KUM/? | KULLANILDI | S2 · 2266 · 52.41 · 2.48 · 16.11.2026 | -0.64 | 26.63 · 1.07 · 0.63 · 2266 | -1.70 | 0.34 |
| 08.11.2026 | GALOP | 1200 m | 78.00 | 26.00 | R→4 | KUM/IC | KULLANILDI | S1 · 188 · 77.16 · 2.07 · 08.11.2026 | -0.40 | 25.50 · 0.50 · 0.74 · 188 | -0.67 | 0.34 |
| 13.11.2026 | GALOP | 800 m | 52.00 | 25.70 | R→4 | KUM/IC | KULLANILDI | S1 · 723 · 52.83 · 2.89 · 15.11.2026 | 0.29 | 25.61 · 0.09 · 0.74 · 723 | -0.12 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.64, -0.40, 0.29] → ortalama **-0.253** · kapanış: [-1.70, -0.67, -0.12] → **-0.830** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 29.10.2026→z=-0.641, 13.11.2026→z=0.286 → **0.927** · süreklilik: son 28 günde 3 farklı idman günü (29.10.2026, 08.11.2026, 13.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.313 · kapanış 0.313 · efor 0.500 · trend 0.750 · süreklilik 0.813
**KAPASİTE** = ortalama(0.313, 0.313, 0.500) = **37.5** · **HAZIRLIK** = ortalama(0.750, 0.813) = **78.1**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K4 #4 DORUKLAR BEYİ (tjkAtId 112206) — önceki koşu: 30.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.06.2026 | SPRINT | 400 m | 26.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.06.2026 | GALOP | 800 m | 55.50 | 27.40 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 800 m | 55.40 | 27.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | GALOP | 1000 m | 69.80 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 400 m | 26.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 400 m | 26.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 68.80 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 68.80 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 55.70 | 26.80 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 55.70 | 26.80 | Ç→1 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 54.30 | 27.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 54.30 | 27.60 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 65.00 | 26.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 65.00 | 26.20 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.09.2026 | SPRINT | 400 m | 25.70 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 26.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 52.60 | 26.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.09.2026 | GALOP | 600 m | 39.80 | 26.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 52.20 | 26.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 600 m | 39.00 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 67.00 | 26.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | SPRINT | 400 m | 25.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/IC | KULLANILDI | S1 · 900 · 52.67 · 2.80 · 15.11.2026 | 0.24 | 25.60 · 0.40 · 0.65 · 900 | -0.61 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.24] → ortalama **0.239** · kapanış: [-0.61] → **-0.610** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (13.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.688 · kapanış 0.438 · efor 0.500 · trend — · süreklilik 0.313
**KAPASİTE** = ortalama(0.688, 0.438, 0.500) = **54.2** · **HAZIRLIK** = ortalama(0.313) = **31.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K4 #5 AĞA HALİL (tjkAtId 105800) — önceki koşu: 05.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.07.2026 | GALOP | 800 m | 51.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 800 m | 52.20 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 63.40 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.40 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 49.50 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 38.10 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 63.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.08.2026 | GALOP | 600 m | 37.80 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.08.2026 | GALOP | 600 m | 37.80 | 24.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.09.2026 | GALOP | 1000 m | 63.50 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | GALOP | 600 m | 38.50 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 36.50 | 24.40 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 37.50 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 41.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | GALOP | 800 m | 50.00 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.10.2026 | GALOP | 800 m | 51.60 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 37.50 | 24.90 | R→4 | KUM/IC | KULLANILDI | S1 · 960 · 39.18 · 2.09 · 15.11.2026 | 0.80 | 24.45 · 0.45 · 0.44 · 960 | -1.03 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.80] → ortalama **0.804** · kapanış: [-1.03] → **-1.025** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.938 · kapanış 0.063 · efor 0.500 · trend — · süreklilik 0.313
**KAPASİTE** = ortalama(0.938, 0.063, 0.500) = **50.0** · **HAZIRLIK** = ortalama(0.313) = **31.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K4 #6 QUIET RIVER (tjkAtId 100227) — önceki koşu: 16.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 28.06.2026 | GALOP | 1000 m | 65.50 | 25.50 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 64.80 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 64.80 | 24.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 67.00 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 63.00 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 52.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.10.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 54.20 | 26.80 | R→4 | KUM/IC | KULLANILDI | S1 · 723 · 52.83 · 2.89 · 15.11.2026 | -0.48 | 26.79 · 0.01 · 0.74 · 723 | -0.02 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.48] → ortalama **-0.476** · kapanış: [-0.02] → **-0.018** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.063 · kapanış 0.688 · efor 0.500 · trend — · süreklilik 0.313
**KAPASİTE** = ortalama(0.063, 0.688, 0.500) = **41.7** · **HAZIRLIK** = ortalama(0.313) = **31.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K4 #7 VEN CONMİGO (tjkAtId 108685) — önceki koşu: 30.09.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.07.2026 | GALOP | 800 m | 51.50 | 25.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 51.50 | 25.30 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | SPRINT | 400 m | 24.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | SPRINT | 400 m | 24.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 12.08.2026 | SPRINT | 400 m | 24.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 51.00 | 25.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.09.2026 | GALOP | 800 m | 50.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.09.2026 | GALOP | 600 m | 37.70 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.11.2026 | GALOP | 600 m | 37.70 | 24.80 | R→4 | KUM/IC | KULLANILDI | S1 · 1252 · 38.94 · 2.04 · 14.11.2026 | 0.61 | 24.62 · 0.18 · 0.51 · 1252 | -0.35 | 0.34 |
| 15.11.2026 | GALOP | 1000 m | 67.70 | 27.00 | R→4 | KUM/IC | KULLANILDI | S1 · 543 · 64.70 · 2.61 · 15.11.2026 | -1.15 | 26.67 · 0.33 · 0.74 · 543 | -0.44 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.61, -1.15] → ortalama **-0.269** · kapanış: [-0.35, -0.44] → **-0.398** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (12.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.188 · kapanış 0.563 · efor 0.500 · trend — · süreklilik 0.688
**KAPASİTE** = ortalama(0.188, 0.563, 0.500) = **41.7** · **HAZIRLIK** = ortalama(0.688) = **68.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K4 #8 SINIR KARTALI (tjkAtId 111582) — önceki koşu: 25.09.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.07.2026 | GALOP | 1000 m | 65.00 | 26.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 39.20 | 25.70 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 1200 m | 78.70 | 25.80 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 38.80 | 25.30 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1200 m | 80.00 | 25.90 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.08.2026 | GALOP | 800 m | 51.80 | 25.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 54.00 | 26.30 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | GALOP | 600 m | 39.00 | 25.50 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 800 m | 52.50 | 26.70 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 68.90 | 27.60 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 800 m | 52.00 | 26.00 | R→4 | KUM/IC | KULLANILDI | S1 · 900 · 52.67 · 2.80 · 15.11.2026 | 0.24 | 25.60 · 0.40 · 0.65 · 900 | -0.61 | 0.34 |
| 04.11.2026 | GALOP | 600 m | 38.80 | 25.20 | R→4 | KUM/IC | KULLANILDI | S1 · 1252 · 38.94 · 2.04 · 14.11.2026 | 0.07 | 25.33 · -0.13 · 0.51 · 1252 | 0.26 | 0.34 |
| 06.11.2026 | GALOP | 800 m | 51.00 | 26.50 | R→4 | KUM/IC | KULLANILDI | S1 · 900 · 52.67 · 2.80 · 15.11.2026 | 0.60 | 25.07 · 1.43 · 0.65 · 900 | -2.20 | 0.34 |
| 13.11.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/IC | KULLANILDI | S1 · 441 · 26.30 · 1.81 · 14.11.2026 | 0.72 | — | — | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.07, 0.60, 0.72] → ortalama **0.461** · kapanış: [-0.61, 0.26, -2.20] → **-0.850** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 30.10.2026→z=0.239, 06.11.2026→z=0.596 → **0.357** · süreklilik: son 28 günde 4 farklı idman günü (30.10.2026, 04.11.2026, 06.11.2026, 13.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.813 · kapanış 0.188 · efor 0.500 · trend 0.250 · süreklilik 0.938
**KAPASİTE** = ortalama(0.813, 0.188, 0.500) = **50.0** · **HAZIRLIK** = ortalama(0.250, 0.938) = **59.4**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K5 (2200 m) — 9 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #3 UFKUN ÖTESİ, #8 CİHANA BEDEL
Eşit puanlı atlar — KAPASİTE: yok | HAZIRLIK: #1=#5=#6=#7=#9 (35.7)

#### Antalya K5 #1 GÜÇLÜ PRENS (tjkAtId 95797) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 28.06.2026 | GALOP | 800 m | 56.00 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 600 m | 40.80 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 600 m | 40.80 | 26.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 42.40 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 42.40 | 27.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 59.30 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 59.30 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 44.00 | 28.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 44.00 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 44.00 | 28.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 44.00 | 28.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.30 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.30 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.30 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.30 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 43.00 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 43.00 | 28.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 43.00 | 28.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 43.00 | 28.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 59.50 | 29.00 | ÇR→5 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 57.40 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 41.90 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 1000 m | 70.90 | 29.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | GALOP | 600 m | 41.30 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 600 m | 41.80 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 600 m | 42.00 | 28.00 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.60 | 27.68 · 0.32 · 0.79 · 4212 | -0.40 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.60] → ortalama **0.605** · kapanış: [-0.40] → **-0.399** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.714 · kapanış 0.417 · efor 0.571 · trend — · süreklilik 0.357
**KAPASİTE** = ortalama(0.714, 0.417, 0.571) = **56.7** · **HAZIRLIK** = ortalama(0.357) = **35.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #2 METİNCİM (tjkAtId 104420) — önceki koşu: 10.09.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.07.2026 | GALOP | 600 m | 41.30 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 1000 m | 70.80 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 42.60 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 56.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 40.50 | 26.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 70.20 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 56.00 | 27.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 56.00 | 27.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 56.00 | 27.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 56.60 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 56.60 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 56.60 | 28.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 41.80 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 1000 m | 70.20 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 41.20 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.86 | 27.34 · 0.16 · 0.79 · 4212 | -0.20 | 0.34 |
| 01.11.2026 | GALOP | 800 m | 57.00 | 28.80 | R→4 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 0.45 | 28.32 · 0.48 · 0.69 · 3129 | -0.70 | 0.34 |
| 13.11.2026 | GALOP | 600 m | 43.50 | 28.50 | R→4 | KUM/IC | KULLANILDI | S1 · 1256 · 43.38 · 2.33 · 16.11.2026 | -0.05 | 28.70 · -0.20 · 0.92 · 1256 | 0.22 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 56.70 | 27.60 | R→4 | KUM/IC | KULLANILDI | S1 · 870 · 58.54 · 3.11 · 15.11.2026 | 0.59 | 28.19 · -0.59 · 0.75 · 870 | 0.79 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.45, -0.05, 0.59] → ortalama **0.330** · kapanış: [-0.70, 0.22, 0.79] → **0.102** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 01.11.2026→z=0.449, 15.11.2026→z=0.592 → **0.143** · süreklilik: son 28 günde 4 farklı idman günü (30.10.2026, 01.11.2026, 13.11.2026, 15.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.214 · kapanış 0.750 · efor 0.571 · trend — · süreklilik 0.929
**KAPASİTE** = ortalama(0.214, 0.750, 0.571) = **51.2** · **HAZIRLIK** = ortalama(0.929) = **92.9**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #3 UFKUN ÖTESİ (tjkAtId 102939) — önceki koşu: 04.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.07.2026 | SPRINT | 400 m | 27.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.07.2026 | SPRINT | 400 m | 27.20 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 42.40 | 28.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 42.80 | 28.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1200 m | 86.80 | 29.40 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 1000 m | 71.00 | 26.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | SPRINT | 400 m | 26.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 71.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 70.60 | 27.40 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #4 SAADIN KASIRGASI (tjkAtId 93963) — önceki koşu: 04.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15.07.2026 | SPRINT | 400 m | 27.50 | — | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.07.2026 | SPRINT | 400 m | 27.50 | — | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 42.00 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 42.00 | 28.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 01.09.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 01.09.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.09.2026 | GALOP | 800 m | 55.00 | 27.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | SPRINT | 400 m | 29.80 | — | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 55.30 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.11.2026 | GALOP | 600 m | 40.70 | 26.40 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | SPRINT | 400 m | 28.60 | — | R→4 | KUM/IC | KULLANILDI | S1 · 517 · 29.21 · 1.97 · 13.11.2026 | 0.31 | — | — | 0.34 |
| 15.11.2026 | GALOP | 800 m | 56.00 | 27.60 | R→4 | KUM/IC | KULLANILDI | S1 · 870 · 58.54 · 3.11 · 15.11.2026 | 0.82 | 27.77 · -0.17 · 0.75 · 870 | 0.22 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.31, 0.82] → ortalama **0.562** · kapanış: [0.22] → **0.223** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (13.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.500 · kapanış 0.917 · efor 0.571 · trend — · süreklilik 0.786
**KAPASİTE** = ortalama(0.500, 0.917, 0.571) = **66.3** · **HAZIRLIK** = ortalama(0.786) = **78.6**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #5 ÖZGÜNALP (tjkAtId 107551) — önceki koşu: 04.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 29.05.2026 | SPRINT | 400 m | 29.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.05.2026 | GALOP | 800 m | 57.70 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 58.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 43.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 57.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 57.00 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 42.20 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 57.00 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 43.00 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | SPRINT | 400 m | 28.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 60.00 | 29.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 42.50 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.11.2026 | SPRINT | 400 m | 28.20 | — | R→4 | KUM/? | KULLANILDI | S2 · 1535 · 28.96 · 1.67 · 15.11.2026 | 0.46 | — | — | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.46] → ortalama **0.456** · kapanış: [] → **—** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (11.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.357 · kapanış — · efor 0.571 · trend — · süreklilik 0.357
**KAPASİTE** = ortalama(0.357, 0.571) = **46.4** · **HAZIRLIK** = ortalama(0.357) = **35.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #6 TABİP BEY (tjkAtId 106877) — önceki koşu: 07.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 05.07.2026 | GALOP | 800 m | 56.00 | 28.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 800 m | 56.30 | 27.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 56.00 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 58.00 | 29.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.50 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 56.50 | 28.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.00 | 27.30 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.00 | 27.30 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 55.00 | 27.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 43.50 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.09.2026 | GALOP | 800 m | 55.00 | 27.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 56.40 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 44.00 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 600 m | 41.70 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.11.2026 | GALOP | 800 m | 56.60 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 56.20 | 28.20 | R→4 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | 0.77 | 27.85 · 0.35 · 0.69 · 3129 | -0.50 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.77] → ortalama **0.768** · kapanış: [-0.50] → **-0.503** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.929 · kapanış 0.250 · efor 0.571 · trend — · süreklilik 0.357
**KAPASİTE** = ortalama(0.929, 0.250, 0.571) = **58.3** · **HAZIRLIK** = ortalama(0.357) = **35.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #7 SARPER (tjkAtId 101923) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 12.07.2026 | GALOP | 800 m | 56.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 42.50 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 1000 m | 71.00 | 28.90 | — | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 55.50 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.08.2026 | SPRINT | 400 m | 26.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.08.2026 | SPRINT | 400 m | 26.70 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 43.50 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 43.50 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 43.50 | 27.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.08.2026 | GALOP | 1000 m | 70.50 | 27.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 600 m | 42.50 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 69.50 | 28.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | SPRINT | 400 m | 27.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.10.2026 | GALOP | 1000 m | 70.50 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | GALOP | 1000 m | 70.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 600 m | 41.80 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 42.00 | 27.70 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.60 | 27.68 · 0.02 · 0.79 · 4212 | -0.02 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.60] → ortalama **0.605** · kapanış: [-0.02] → **-0.020** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (13.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.714 · kapanış 0.583 · efor 0.571 · trend — · süreklilik 0.357
**KAPASİTE** = ortalama(0.714, 0.583, 0.571) = **62.3** · **HAZIRLIK** = ortalama(0.357) = **35.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #8 CİHANA BEDEL (tjkAtId 102034) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 30.05.2026 | GALOP | 800 m | 58.00 | 28.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 31.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 60.00 | 29.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 41.70 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 41.70 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 44.00 | 29.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 56.80 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | GALOP | 600 m | 45.50 | 30.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K5 #9 IŞIK GECE (tjkAtId 95983) — önceki koşu: 05.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15.03.2026 | GALOP | 600 m | 43.00 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 57.60 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 1000 m | 72.50 | 30.80 | Ç→1 | KUM/? | KULLANILDI | S2 · 1511 · 71.90 · 2.40 · 15.11.2026 | -0.25 | 28.84 · 1.96 · 0.89 · 1511 | -2.21 | -3.01 |

**Ara adımlar** — hız: son 1 hızZ [-0.25] → ortalama **-0.250** · kapanış: [-2.21] → **-2.205** · efor: [-3.01] → **-3.015** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.071 · kapanış 0.083 · efor 0.071 · trend — · süreklilik 0.357
**KAPASİTE** = ortalama(0.071, 0.083, 0.071) = **7.5** · **HAZIRLIK** = ortalama(0.357) = **35.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K6 (1400 m) — 9 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #2 İPHİKLOS
Eşit puanlı atlar — KAPASİTE: #3=#6 (43.8) | HAZIRLIK: #3=#5=#8 (18.8)

#### Antalya K6 #1 CONTINUOUS (tjkAtId 93486) — önceki koşu: 17.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 08.07.2026 | GALOP | 800 m | 51.30 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | SPRINT | 400 m | 26.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | SPRINT | 400 m | 26.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 27.07.2026 | GALOP | 800 m | 50.50 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.07.2026 | GALOP | 800 m | 50.50 | 25.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 25.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | SPRINT | 400 m | 25.70 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 64.00 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 64.00 | 24.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | SPRINT | 400 m | 24.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | SPRINT | 400 m | 24.60 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 1200 m | 77.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1200 m | 77.00 | 25.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 14.08.2026 | GALOP | 800 m | 50.00 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.08.2026 | GALOP | 800 m | 50.00 | 24.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.08.2026 | Kenter | — | — | — | R | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 10.09.2026 | GALOP | 600 m | 40.20 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1200 m | 76.20 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | GALOP | 600 m | 39.50 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 49.60 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 1200 m | 78.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.10.2026 | GALOP | 800 m | 51.30 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 600 m | 38.30 | 25.00 | R→4 | KUM/? | KULLANILDI | S2 · 2921 · 38.96 · 1.87 · 15.11.2026 | 0.35 | 25.06 · -0.06 · 0.46 · 2921 | 0.12 | 0.34 |
| 01.11.2026 | GALOP | 1000 m | 62.30 | 24.50 | R→4 | KUM/? | KULLANILDI | S2 · 1341 · 64.85 · 2.38 · 15.11.2026 | 1.07 | 24.59 · -0.09 · 0.63 · 1341 | 0.15 | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 66.20 | 26.40 | R→4 | KUM/? | KULLANILDI | S2 · 1341 · 64.85 · 2.38 · 15.11.2026 | -0.57 | 26.09 · 0.31 · 0.63 · 1341 | -0.50 | 0.34 |
| 12.11.2026 | GALOP | 1000 m | 64.20 | 27.00 | R→4 | KUM/? | KULLANILDI | S2 · 1341 · 64.85 · 2.38 · 15.11.2026 | 0.28 | 25.32 · 1.68 · 0.63 · 1341 | -2.66 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [1.07, -0.57, 0.28] → ortalama **0.261** · kapanış: [0.15, -0.50, -2.66] → **-1.004** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 1000|GALOP|KUM: 01.11.2026→z=1.074, 08.11.2026→z=-0.566, 12.11.2026→z=0.275 → **-0.799** · süreklilik: son 28 günde 4 farklı idman günü (29.10.2026, 01.11.2026, 08.11.2026, 12.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.438 · kapanış 0.063 · efor 0.438 · trend 0.167 · süreklilik 0.688
**KAPASİTE** = ortalama(0.438, 0.063, 0.438) = **31.3** · **HAZIRLIK** = ortalama(0.167, 0.688) = **42.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #2 İPHİKLOS (tjkAtId 107073) — önceki koşu: 08.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 16.07.2026 | GALOP | 800 m | 51.20 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 800 m | 51.00 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 800 m | 50.80 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.07.2026 | GALOP | 800 m | 49.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.08.2026 | GALOP | 800 m | 49.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.50 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 800 m | 50.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 38.90 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 63.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 26.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 51.60 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 600 m | 39.20 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 63.90 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 800 m | 51.40 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #3 GENERAL BRIELLA (tjkAtId 93874) — önceki koşu: 30.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.10.2026 | GALOP | 800 m | 52.50 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.10.2026 | GALOP | 800 m | 50.70 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 51.80 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 2266 · 52.41 · 2.48 · 16.11.2026 | 0.25 | 25.54 · 0.06 · 0.63 · 2266 | -0.10 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.25] → ortalama **0.247** · kapanış: [-0.10] → **-0.097** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (08.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.313 · kapanış 0.563 · efor 0.438 · trend — · süreklilik 0.188
**KAPASİTE** = ortalama(0.313, 0.563, 0.438) = **43.8** · **HAZIRLIK** = ortalama(0.188) = **18.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #4 PEHLİVAN YILDIZI (tjkAtId 104897) — önceki koşu: 07.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.07.2026 | SPRINT | 400 m | 26.30 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.07.2026 | GALOP | 600 m | 37.20 | 23.40 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.07.2026 | GALOP | 600 m | 37.20 | 23.40 | R→4 | SENTETIK/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 41.00 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 41.00 | 26.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 36.00 | 23.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 36.00 | 23.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 36.00 | 23.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 36.60 | 24.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 36.60 | 24.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 36.60 | 24.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 36.60 | 24.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 18.08.2026 | GALOP | 600 m | 37.00 | 24.40 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 18.08.2026 | GALOP | 600 m | 37.00 | 24.40 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.08.2026 | GALOP | 600 m | 37.00 | 24.40 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 18.08.2026 | GALOP | 600 m | 37.00 | 24.40 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.08.2026 | GALOP | 600 m | 36.80 | 23.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.08.2026 | GALOP | 600 m | 36.80 | 23.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.08.2026 | GALOP | 600 m | 36.80 | 23.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 25.08.2026 | GALOP | 600 m | 36.80 | 23.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.08.2026 | GALOP | 600 m | 36.70 | 24.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 50.30 | 24.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 36.70 | 24.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 1000 m | 63.70 | 25.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 37.00 | 24.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 36.50 | 23.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 47.70 | 23.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 38.20 | 24.70 | R→4 | KUM/IC | KULLANILDI | S1 · 960 · 39.18 · 2.09 · 15.11.2026 | 0.47 | 24.93 · -0.23 · 0.44 · 960 | 0.53 | 0.34 |
| 25.10.2026 | GALOP | 1200 m | 77.20 | 24.00 | R→4 | KUM/IC | KULLANILDI | S1 · 188 · 77.16 · 2.07 · 08.11.2026 | -0.02 | 25.24 · -1.24 · 0.74 · 188 | 1.68 | 0.34 |
| 01.11.2026 | GALOP | 1200 m | 77.20 | 25.20 | R→4 | KUM/IC | KULLANILDI | S1 · 188 · 77.16 · 2.07 · 08.11.2026 | -0.02 | 25.24 · -0.04 · 0.74 · 188 | 0.05 | 0.34 |
| 06.11.2026 | GALOP | 600 m | 37.80 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 960 · 39.18 · 2.09 · 15.11.2026 | 0.66 | 24.66 · 0.34 · 0.44 · 960 | -0.78 | 0.34 |
| 08.11.2026 | GALOP | 1000 m | 62.50 | 24.20 | R→4 | KUM/IC | KULLANILDI | S1 · 379 · 65.26 · 2.98 · 15.11.2026 | 0.93 | 24.53 · -0.33 · 0.69 · 379 | 0.48 | 0.34 |
| 14.11.2026 | GALOP | 800 m | 52.00 | 25.20 | R→4 | KUM/IC | KULLANILDI | S1 · 723 · 52.83 · 2.89 · 15.11.2026 | 0.29 | 25.61 · -0.41 · 0.74 · 723 | 0.56 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.66, 0.93, 0.29] → ortalama **0.624** · kapanış: [-0.78, 0.48, 0.56] → **0.086** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 600|GALOP|KUM: 23.10.2026→z=0.469, 06.11.2026→z=0.660 → **0.191** · süreklilik: son 28 günde 6 farklı idman günü (23.10.2026, 25.10.2026, 01.11.2026, 06.11.2026, 08.11.2026, 14.11.2026) → **6**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.813 · kapanış 0.938 · efor 0.438 · trend 0.833 · süreklilik 0.875
**KAPASİTE** = ortalama(0.813, 0.938, 0.438) = **72.9** · **HAZIRLIK** = ortalama(0.833, 0.875) = **85.4**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #5 SMART CHILDREN (tjkAtId 106028) — önceki koşu: 07.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.06.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 800 m | 51.70 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 50.00 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 39.00 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.07.2026 | GALOP | 600 m | 39.00 | 24.90 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.60 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.60 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 800 m | 50.60 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 39.00 | 26.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 52.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 24.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.09.2026 | GALOP | 800 m | 50.20 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.10.2026 | GALOP | 800 m | 50.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.10.2026 | GALOP | 1000 m | 63.00 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.11.2026 | GALOP | 800 m | 52.70 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 49.60 | 24.50 | R→4 | KUM/IC | KULLANILDI | S1 · 723 · 52.83 · 2.89 · 15.11.2026 | 1.12 | 24.33 · 0.17 · 0.74 · 723 | -0.23 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.12] → ortalama **1.117** · kapanış: [-0.23] → **-0.232** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.938 · kapanış 0.313 · efor 0.438 · trend — · süreklilik 0.188
**KAPASİTE** = ortalama(0.938, 0.313, 0.438) = **56.3** · **HAZIRLIK** = ortalama(0.188) = **18.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #6 THEATER OF WAR (tjkAtId 107843) — önceki koşu: 02.09.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 06.07.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.07.2026 | GALOP | 1000 m | 67.30 | 27.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.07.2026 | GALOP | 600 m | 40.20 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.07.2026 | GALOP | 1000 m | 64.50 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.07.2026 | GALOP | 600 m | 39.00 | 25.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 38.50 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 64.60 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 64.60 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 600 m | 38.50 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 600 m | 38.50 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.08.2026 | GALOP | 1000 m | 64.00 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.08.2026 | GALOP | 600 m | 37.90 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 38.80 | 25.70 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | -0.01 | 25.37 · 0.33 · 0.49 · 3826 | -0.66 | 0.34 |
| 18.10.2026 | GALOP | 1000 m | 64.70 | 25.60 | HÇ→2 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | 0.02 | 25.53 · 0.07 · 0.67 · 1876 | -0.11 | -1.90 |
| 23.10.2026 | GALOP | 600 m | 38.70 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.05 | 25.31 · 0.29 · 0.49 · 3826 | -0.59 | 0.34 |
| 25.10.2026 | GALOP | 1000 m | 66.50 | 26.50 | R→4 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | -0.83 | 26.20 · 0.30 · 0.67 · 1876 | -0.44 | 0.34 |
| 01.11.2026 | GALOP | 1000 m | 65.10 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | -0.17 | 25.68 · -0.08 · 0.67 · 1876 | 0.12 | 0.34 |
| 08.11.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.16 | 25.19 · 0.31 · 0.49 · 3826 | -0.64 | 0.34 |
| 10.11.2026 | GALOP | 1200 m | 77.80 | 26.00 | ÇR→5 | KUM/? | KULLANILDI | S2 · 563 · 77.94 · 2.16 · 10.11.2026 | 0.07 | 25.50 · 0.50 · 0.75 · 563 | -0.67 | 1.45 |
| 15.11.2026 | GALOP | 800 m | 52.10 | 26.10 | R→4 | KUM/? | KULLANILDI | S2 · 2998 · 52.24 · 2.38 · 16.11.2026 | 0.06 | 25.69 · 0.41 · 0.59 · 2996 | -0.70 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.16, 0.07, 0.06] → ortalama **0.094** · kapanış: [-0.64, -0.67, -0.70] → **-0.667** · efor: [0.34, 1.45, 0.34] → **0.707** · trend: 600|GALOP|KUM: 16.10.2026→z=-0.008, 23.10.2026→z=0.048, 08.11.2026→z=0.159 → **0.167** · süreklilik: son 28 günde 6 farklı idman günü (23.10.2026, 25.10.2026, 01.11.2026, 08.11.2026, 10.11.2026, 15.11.2026) → **6**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.188 · kapanış 0.188 · efor 0.938 · trend 0.500 · süreklilik 0.875
**KAPASİTE** = ortalama(0.188, 0.188, 0.938) = **43.8** · **HAZIRLIK** = ortalama(0.500, 0.875) = **68.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #7 ANGEL OF DEFNE (tjkAtId 110532) — önceki koşu: 02.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.06.2026 | GALOP | 600 m | 39.80 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 1000 m | 64.20 | 24.90 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.07.2026 | GALOP | 600 m | 35.80 | 23.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 65.10 | 24.90 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 65.10 | 24.90 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 39.40 | 25.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 39.40 | 25.50 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 39.40 | 25.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 16.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 37.00 | 24.80 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 37.00 | 24.80 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 37.00 | 24.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | GALOP | 1000 m | 63.00 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 37.40 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 1000 m | 62.60 | 24.80 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.09.2026 | GALOP | 600 m | 38.70 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 36.00 | 23.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 50.40 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 600 m | 41.00 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 38.20 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | GALOP | 800 m | 50.40 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 800 m | 49.60 | 23.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | SPRINT | 400 m | 23.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | SPRINT | 400 m | 26.50 | — | R→4 | KUM/IC | KULLANILDI | S1 · 441 · 26.30 · 1.81 · 14.11.2026 | -0.11 | — | — | 0.34 |
| 13.11.2026 | GALOP | 600 m | 36.50 | 24.00 | R→4 | KUM/IC | KULLANILDI | S1 · 1252 · 38.94 · 2.04 · 14.11.2026 | 1.20 | 23.84 · 0.16 · 0.51 · 1252 | -0.32 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 51.00 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 900 · 52.67 · 2.80 · 15.11.2026 | 0.60 | 25.07 · -0.07 · 0.65 · 900 | 0.10 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.11, 1.20, 0.60] → ortalama **0.562** · kapanış: [-0.32, 0.10] → **-0.108** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (08.11.2026, 13.11.2026, 15.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.563 · kapanış 0.438 · efor 0.438 · trend — · süreklilik 0.563
**KAPASİTE** = ortalama(0.563, 0.438, 0.438) = **47.9** · **HAZIRLIK** = ortalama(0.563) = **56.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #8 HAS SERÇE (tjkAtId 112148) — önceki koşu: 02.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 23.04.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 07.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 09.05.2026 | BILINMIYOR | 1000 m | 64.20 | — | Rahat→4 | ?/DIS | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 28.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 05.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 28.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 28.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 03.07.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 03.07.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 05.07.2026 | BILINMIYOR | 1000 m | 64.50 | — | Rahat→4 | ?/DIS | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | BILINMIYOR | 1000 m | 64.50 | — | Rahat→4 | ?/DIS | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 11.07.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 11.07.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 37.00 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1000 m | 61.70 | 23.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 600 m | 39.60 | 25.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 15.08.2026 | GALOP | 600 m | 39.60 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 600 m | 40.70 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | GALOP | 600 m | 36.50 | 24.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 1200 m | 77.80 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 600 m | 39.70 | 26.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 1000 m | 65.20 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.10.2026 | GALOP | 600 m | 41.30 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.10.2026 | GALOP | 600 m | 36.80 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.10.2026 | GALOP | 800 m | 50.30 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.11.2026 | GALOP | 600 m | 38.70 | 25.30 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.05 | 25.31 · -0.01 · 0.49 · 3826 | 0.02 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.05] → ortalama **0.048** · kapanış: [0.02] → **0.023** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (14.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.063 · kapanış 0.688 · efor 0.438 · trend — · süreklilik 0.188
**KAPASİTE** = ortalama(0.063, 0.688, 0.438) = **39.6** · **HAZIRLIK** = ortalama(0.188) = **18.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K6 #9 INCOME (tjkAtId 107840) — önceki koşu: 25.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 20.06.2026 | GALOP | 800 m | 49.00 | 23.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.06.2026 | SPRINT | 400 m | 24.30 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.06.2026 | GALOP | 1000 m | 62.50 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.07.2026 | SPRINT | 400 m | 25.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.07.2026 | GALOP | 800 m | 49.00 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.07.2026 | GALOP | 1000 m | 66.00 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.07.2026 | GALOP | 1000 m | 66.00 | 27.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 600 m | 37.50 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.08.2026 | GALOP | 600 m | 37.50 | 24.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.08.2026 | GALOP | 600 m | 37.50 | 24.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 1000 m | 62.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | GALOP | 1000 m | 62.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | GALOP | 1000 m | 62.00 | 25.00 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 03.09.2026 | SPRINT | 400 m | 24.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 25.30 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 1000 m | 64.40 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 800 m | 51.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.10.2026 | GALOP | 1000 m | 63.40 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 400 m | 24.40 | — | — | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.10.2026 | GALOP | 1000 m | 63.50 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.10.2026 | GALOP | 1000 m | 64.70 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.11.2026 | GALOP | 1000 m | 64.40 | 25.40 | R→4 | KUM/? | KULLANILDI | S2 · 1876 · 64.73 · 2.12 · 15.11.2026 | 0.16 | 25.42 · -0.02 · 0.67 · 1876 | 0.03 | 0.34 |
| 15.11.2026 | GALOP | 600 m | 37.00 | 24.20 | R→4 | KUM/? | KULLANILDI | S2 · 3826 · 38.79 · 1.80 · 16.11.2026 | 0.99 | 24.25 · -0.05 · 0.49 · 3826 | 0.10 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.16, 0.99] → ortalama **0.575** · kapanış: [0.03, 0.10] → **0.064** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (09.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.688 · kapanış 0.813 · efor 0.438 · trend — · süreklilik 0.438
**KAPASİTE** = ortalama(0.688, 0.813, 0.438) = **64.6** · **HAZIRLIK** = ortalama(0.438) = **43.8**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K7 (1200 m) — 8 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #3 HUNTER MAN, #4 IBAN, #5 ILLEGAL
Eşit puanlı atlar — KAPASİTE: #1=#2 (50.0) | HAZIRLIK: #7=#8 (20.0)

#### Antalya K7 #1 BORSACI BABA (tjkAtId 113631) — önceki koşu: 18.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.10.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 64.50 | 25.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 52.00 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | 0.15 | 25.68 · -0.08 · 0.70 · 2699 | 0.11 | 0.34 |
| 30.10.2026 | SPRINT | 400 m | 24.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 1.14 | — | — | 0.34 |
| 08.11.2026 | GALOP | 800 m | 66.60 | 26.30 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -6.00 | 32.80 · -6.50 · 0.70 · 2699 | 9.26 | 0.34 |
| 13.11.2026 | SPRINT | 400 m | 24.50 | — | R→4 | KUM/? | KULLANILDI | S2 · 1391 · 25.79 · 1.58 · 16.11.2026 | 0.82 | — | — | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [1.14, -6.00, 0.82] → ortalama **-1.347** · kapanış: [0.11, 9.26] → **4.685** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 400|SPRINT|KUM: 30.10.2026→z=1.139, 13.11.2026→z=0.822 → **-0.317** · süreklilik: son 28 günde 4 farklı idman günü (25.10.2026, 30.10.2026, 08.11.2026, 13.11.2026) → **4**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.100 · kapanış 0.900 · efor 0.500 · trend 0.250 · süreklilik 0.900
**KAPASİTE** = ortalama(0.100, 0.900, 0.500) = **50.0** · **HAZIRLIK** = ortalama(0.250, 0.900) = **57.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K7 #2 ÇİMEN BERA (tjkAtId 114744) — önceki koşu: 29.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.04.2026 | GALOP | 600 m | 39.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.06.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.06.2026 | GALOP | 800 m | 51.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.06.2026 | GALOP | 1000 m | 65.70 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 50.90 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.07.2026 | GALOP | 600 m | 37.50 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.07.2026 | GALOP | 1000 m | 64.20 | 25.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.07.2026 | GALOP | 600 m | 38.00 | 24.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 1000 m | 66.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 40.80 | 26.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 51.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | GALOP | 600 m | 37.30 | 24.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 40.50 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 63.60 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 1200 m | 78.00 | 26.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 40.00 | 26.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.08.2026 | GALOP | 1000 m | 63.50 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | GALOP | 600 m | 37.80 | 23.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 800 m | 51.20 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 38.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 51.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 37.70 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.09.2026 | GALOP | 800 m | 50.50 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 800 m | 51.20 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.10.2026 | GALOP | 600 m | 38.30 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 800 m | 53.30 | 25.60 | R→4 | KUM/? | KULLANILDI | S2 · 2699 · 52.36 · 2.37 · 16.11.2026 | -0.39 | 26.31 · -0.71 · 0.70 · 2699 | 1.01 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 51.00 | 25.00 | R→4 | KUM/IC | KULLANILDI | S1 · 747 · 53.07 · 2.70 · 15.11.2026 | 0.77 | 25.07 · -0.07 · 0.92 · 747 | 0.07 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-0.39, 0.77] → ortalama **0.186** · kapanış: [1.01, 0.07] → **0.543** · efor: [0.34, 0.34] → **0.335** · trend: 800|GALOP|KUM: 08.11.2026→z=-0.394, 15.11.2026→z=0.766 → **1.161** · süreklilik: son 28 günde 2 farklı idman günü (08.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.500 · kapanış 0.500 · efor 0.500 · trend 0.750 · süreklilik 0.600
**KAPASİTE** = ortalama(0.500, 0.500, 0.500) = **50.0** · **HAZIRLIK** = ortalama(0.750, 0.600) = **67.5**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K7 #3 HUNTER MAN (tjkAtId 113083) — önceki koşu: 09.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15.08.2026 | GALOP | 800 m | 56.00 | 27.70 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | Galop | — | — | — | HÇ | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 43.00 | 29.00 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 800 m | 53.80 | 26.90 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | GALOP | 800 m | 57.00 | 27.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | SPRINT | 400 m | 26.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 800 m | 56.20 | 27.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | GALOP | 800 m | 54.80 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.11.2026 | GALOP | 800 m | 55.40 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K7 #4 IBAN (tjkAtId 114464) — önceki koşu: 09.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 30.04.2026 | SPRINT | 400 m | 25.20 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.05.2026 | GALOP | 800 m | 50.80 | 25.10 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.06.2026 | SPRINT | 400 m | 27.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.07.2026 | GALOP | 600 m | 41.00 | 27.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.07.2026 | GALOP | 800 m | 56.50 | 27.90 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.50 | 26.50 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 600 m | 40.50 | 26.50 | HR→3 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 56.00 | 27.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 56.00 | 27.50 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 56.00 | 27.50 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 10.09.2026 | SPRINT | 400 m | 27.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | GALOP | 600 m | 40.70 | 25.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 800 m | 56.30 | 27.20 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 42.10 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 31.10.2026 | GALOP | 1000 m | 68.30 | 28.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 38.50 | 25.30 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K7 #5 ILLEGAL (tjkAtId 113968) — önceki koşu: 13.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 21.06.2026 | GALOP | 1000 m | 66.50 | 26.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 400 m | 26.00 | — | Ç→1 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 42.20 | 27.20 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.08.2026 | GALOP | 600 m | 40.00 | 26.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 800 m | 53.00 | 26.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.09.2026 | GALOP | 600 m | 40.00 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 53.50 | 26.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | GALOP | 600 m | 38.70 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 69.00 | 28.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 54.00 | 26.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 40.00 | 26.00 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 67.00 | 27.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 38.40 | 24.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 52.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K7 #6 LION MAN (tjkAtId 114929) — önceki koşu: 30.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 26.07.2026 | GALOP | 1000 m | 63.50 | 24.50 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | SPRINT | 400 m | 24.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 65.70 | 25.70 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 64.20 | 24.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 37.00 | 24.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 66.00 | 25.60 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | GALOP | 600 m | 37.90 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 600 m | 36.00 | 24.00 | R→4 | KUM/? | KULLANILDI | S2 · 3203 · 38.87 · 1.83 · 16.11.2026 | 1.57 | 23.53 · 0.47 · 0.45 · 3203 | -1.02 | 0.34 |
| 15.11.2026 | GALOP | 800 m | 50.00 | 24.20 | R→4 | SENTETIK/? | KULLANILDI | S2 · 184 · 50.07 · 1.57 · 15.11.2026 | 0.05 | 24.61 · -0.41 · 0.62 · 184 | 0.66 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [1.57, 0.05] → ortalama **0.808** · kapanış: [-1.02, 0.66] → **-0.183** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (08.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.700 · kapanış 0.100 · efor 0.500 · trend — · süreklilik 0.600
**KAPASİTE** = ortalama(0.700, 0.100, 0.500) = **43.3** · **HAZIRLIK** = ortalama(0.600) = **60.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K7 #7 SON OF FIRE (tjkAtId 116087) — önceki koşu: 31.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 08.10.2026 | GALOP | 1000 m | 64.00 | 25.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | GALOP | 1200 m | 77.30 | 24.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.10.2026 | SPRINT | 400 m | 25.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | GALOP | 800 m | 51.30 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.11.2026 | GALOP | 1000 m | 62.60 | 24.30 | R→4 | KUM/? | KULLANILDI | S2 · 1781 · 64.72 · 1.83 · 15.11.2026 | 1.16 | 24.72 · -0.42 · 0.67 · 1780 | 0.63 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.16] → ortalama **1.158** · kapanış: [0.63] → **0.628** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (10.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.900 · kapanış 0.700 · efor 0.500 · trend — · süreklilik 0.200
**KAPASİTE** = ortalama(0.900, 0.700, 0.500) = **70.0** · **HAZIRLIK** = ortalama(0.200) = **20.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K7 #8 TATLI AKYÜZ (tjkAtId 113956) — önceki koşu: 09.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.07.2026 | SPRINT | 400 m | 26.70 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.07.2026 | GALOP | 800 m | 53.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 600 m | 37.20 | 24.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 600 m | 38.00 | 25.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 600 m | 38.00 | 25.40 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 65.00 | 26.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 65.00 | 26.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 26.07.2026 | GALOP | 1000 m | 65.00 | 26.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.20 | 24.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.20 | 24.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 37.20 | 24.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 65.00 | 25.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 65.00 | 25.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 65.00 | 25.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 38.30 | 25.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 38.30 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.08.2026 | GALOP | 600 m | 38.30 | 25.20 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 38.00 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 38.00 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 38.00 | 25.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | GALOP | 600 m | 38.00 | 25.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 23.08.2026 | SPRINT | 400 m | 25.50 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 53.40 | 26.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 68.80 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.09.2026 | GALOP | 600 m | 40.70 | 26.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.09.2026 | GALOP | 600 m | 38.50 | 25.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 800 m | 52.60 | 26.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 600 m | 39.50 | 26.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 66.40 | 27.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | GALOP | 600 m | 38.30 | 25.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 42.00 | 28.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 64.80 | 25.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | GALOP | 600 m | 38.30 | 24.90 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.11.2026 | GALOP | 600 m | 39.30 | 26.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 800 m | 50.00 | 24.50 | R→4 | SENTETIK/? | KULLANILDI | S2 · 184 · 50.07 · 1.57 · 15.11.2026 | 0.05 | 24.61 · -0.11 · 0.62 · 184 | 0.18 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [0.05] → ortalama **0.046** · kapanış: [0.18] → **0.179** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.300 · kapanış 0.300 · efor 0.500 · trend — · süreklilik 0.200
**KAPASİTE** = ortalama(0.300, 0.300, 0.500) = **36.7** · **HAZIRLIK** = ortalama(0.200) = **20.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

### Antalya K8 (1400 m) — 14 at
Galopsuz at (son koşusundan sonra kullanılabilir galop yok): #2 KRAL YAZICI, #5 ÇALIŞTAY, #7 EĞRİCAN, #10 ASIM EFE
Eşit puanlı atlar — KAPASİTE: #3=#11 (43.3) | HAZIRLIK: #1=#3=#9=#11=#12 (25.0)

#### Antalya K8 #1 HARESE (tjkAtId 104282) — önceki koşu: 28.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.07.2026 | GALOP | 1000 m | 71.60 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.08.2026 | GALOP | 600 m | 40.40 | 26.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2026 | GALOP | 800 m | 55.10 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | SPRINT | 400 m | 27.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 55.00 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 42.10 | 26.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.09.2026 | GALOP | 800 m | 54.60 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 41.40 | 26.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.10.2026 | GALOP | 600 m | 56.20 | 26.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.10.2026 | SPRINT | 400 m | 28.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.10.2026 | GALOP | 1000 m | 70.20 | 28.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.10.2026 | GALOP | 600 m | 41.80 | 27.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 1000 m | 68.50 | 25.50 | R→4 | KUM/IC | KULLANILDI | S1 · 389 · 72.11 · 2.98 · 15.11.2026 | 1.21 | 27.29 · -1.79 · 0.93 · 389 | 1.92 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [1.21] → ortalama **1.211** · kapanış: [1.92] → **1.917** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (13.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.950 · kapanış 0.950 · efor 0.700 · trend — · süreklilik 0.250
**KAPASİTE** = ortalama(0.950, 0.950, 0.700) = **86.7** · **HAZIRLIK** = ortalama(0.250) = **25.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #2 KRAL YAZICI (tjkAtId 99521) — önceki koşu: 06.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 14.03.2026 | Normal | — | — | — | Çalışarak | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 19.03.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 11.04.2026 | Normal | — | — | — | Çalışarak | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 18.04.2026 | Islak | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 25.04.2026 | BILINMIYOR | 1000 m | 72.90 | — | Hafif Çalışarak→2 | ?/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.04.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 08.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 22.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 05.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 05.07.2026 | GALOP | 600 m | 44.00 | 28.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.07.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 10.07.2026 | GALOP | 600 m | 41.80 | 28.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.07.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.07.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.07.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | SPRINT | 400 m | 31.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | SPRINT | 400 m | 31.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | SPRINT | 400 m | 31.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | SPRINT | 400 m | 31.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 17.08.2026 | SPRINT | 400 m | 31.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 58.50 | 27.80 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 56.30 | 27.20 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #3 BELALI CİBEK (tjkAtId 104577) — önceki koşu: 03.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 11.06.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.07.2026 | GALOP | 600 m | 44.00 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.07.2026 | SPRINT | 400 m | 31.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 64.50 | 33.10 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | SPRINT | 400 m | 29.80 | — | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 61.00 | 30.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 31.60 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 64.00 | 34.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 29.30 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 63.00 | 31.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 29.08.2026 | GALOP | 800 m | 60.30 | 30.40 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.09.2026 | GALOP | 1000 m | 76.00 | 31.10 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | GALOP | 600 m | 46.50 | 30.90 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.09.2026 | SPRINT | 400 m | 32.20 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | SPRINT | 400 m | 28.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | SPRINT | 400 m | 30.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | GALOP | 600 m | 44.50 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.11.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.93 | 29.72 · 0.28 · 0.79 · 4212 | -0.35 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.93] → ortalama **-0.928** · kapanış: [-0.35] → **-0.349** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (12.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.250 · kapanış 0.350 · efor 0.700 · trend — · süreklilik 0.250
**KAPASİTE** = ortalama(0.250, 0.350, 0.700) = **43.3** · **HAZIRLIK** = ortalama(0.250) = **25.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #4 GÜNMETE (tjkAtId 106869) — önceki koşu: 10.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 02.07.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 75.70 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 75.70 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 04.08.2026 | GALOP | 1000 m | 75.70 | 28.80 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.09.2026 | GALOP | 600 m | 44.50 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 58.50 | 30.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | SPRINT | 400 m | 27.60 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 800 m | 56.70 | 28.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.10.2026 | GALOP | 800 m | 58.00 | 28.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.10.2026 | SPRINT | 400 m | 30.00 | — | R→4 | KUM/? | KULLANILDI | S2 · 1535 · 28.96 · 1.67 · 15.11.2026 | -0.62 | — | — | 0.34 |
| 11.11.2026 | SPRINT | 400 m | 30.00 | — | R→4 | KUM/IC | KULLANILDI | S1 · 517 · 29.21 · 1.97 · 13.11.2026 | -0.40 | — | — | 0.34 |
| 15.11.2026 | GALOP | 800 m | 56.00 | 27.00 | R→4 | KUM/IC | KULLANILDI | S1 · 870 · 58.54 · 3.11 · 15.11.2026 | 0.82 | 27.77 · -0.77 · 0.75 · 870 | 1.02 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [-0.62, -0.40, 0.82] → ortalama **-0.070** · kapanış: [1.02] → **1.020** · efor: [0.34, 0.34, 0.34] → **0.335** · trend: 400|SPRINT|KUM: 16.10.2026→z=-0.624, 11.11.2026→z=-0.401 → **0.222** · süreklilik: son 28 günde 2 farklı idman günü (11.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.750 · kapanış 0.850 · efor 0.700 · trend 0.500 · süreklilik 0.700
**KAPASİTE** = ortalama(0.750, 0.850, 0.700) = **76.7** · **HAZIRLIK** = ortalama(0.500, 0.700) = **60.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #5 ÇALIŞTAY (tjkAtId 99220) — önceki koşu: 05.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.10.2026 | GALOP | 1000 m | 60.00 | 29.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 45.00 | 29.50 | ÇR→5 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 61.00 | 30.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.10.2026 | SPRINT | 400 m | 29.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 800 m | 60.00 | 30.00 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.10.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | GALOP | 1000 m | 72.50 | 29.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #6 RÜZGAR DELEN (tjkAtId 98184) — önceki koşu: 27.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 18.06.2026 | SPRINT | 400 m | 27.80 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.06.2026 | GALOP | 800 m | 57.70 | 29.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.06.2026 | GALOP | 600 m | 45.10 | 30.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.06.2026 | GALOP | 1000 m | 73.30 | 28.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.07.2026 | GALOP | 600 m | 44.30 | 29.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.07.2026 | GALOP | 1000 m | 73.50 | 28.20 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.07.2026 | GALOP | 600 m | 43.90 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.07.2026 | GALOP | 1000 m | 72.10 | 29.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 16.07.2026 | SPRINT | 400 m | 29.90 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.07.2026 | GALOP | 800 m | 56.50 | 28.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 63.00 | 31.40 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.08.2026 | GALOP | 800 m | 63.00 | 31.40 | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 06.08.2026 | SPRINT | 400 m | 30.80 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.08.2026 | SPRINT | 400 m | 30.80 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 62.40 | 31.90 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 800 m | 62.40 | 31.90 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 31.30 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 13.08.2026 | SPRINT | 400 m | 31.30 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 62.00 | 32.00 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2026 | GALOP | 800 m | 62.00 | 32.00 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 31.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.08.2026 | SPRINT | 400 m | 31.00 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 60.50 | 31.10 | HÇ→2 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 22.08.2026 | GALOP | 800 m | 60.50 | 31.10 | HÇ→2 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 29.08.2026 | GALOP | 800 m | 60.00 | 30.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 05.09.2026 | GALOP | 1000 m | 75.00 | 30.10 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.09.2026 | GALOP | 600 m | 46.00 | 30.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 18.09.2026 | SPRINT | 400 m | 28.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.09.2026 | GALOP | 800 m | 64.00 | 32.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.10.2026 | SPRINT | 400 m | 30.50 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 800 m | 60.60 | 29.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.10.2026 | SPRINT | 400 m | 30.50 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | SPRINT | 400 m | 32.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 17.10.2026 | SPRINT | 400 m | 32.00 | — | R→4 | KUM/IC | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 07.11.2026 | GALOP | 600 m | 45.70 | 29.40 | HÇ→2 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -1.29 | 30.20 · -0.80 · 0.79 · 4212 | 1.01 | -1.90 |
| 12.11.2026 | GALOP | 600 m | 45.00 | 30.00 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.93 | 29.72 · 0.28 · 0.79 · 4212 | -0.35 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-1.29, -0.93] → ortalama **-1.107** · kapanış: [1.01, -0.35] → **0.331** · efor: [-1.90, 0.34] → **-0.781** · trend: 600|GALOP|KUM: 07.11.2026→z=-1.286, 12.11.2026→z=-0.928 → **0.358** · süreklilik: son 28 günde 2 farklı idman günü (07.11.2026, 12.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.050 · kapanış 0.750 · efor 0.350 · trend 0.833 · süreklilik 0.700
**KAPASİTE** = ortalama(0.050, 0.750, 0.350) = **38.3** · **HAZIRLIK** = ortalama(0.833, 0.700) = **76.7**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #7 EĞRİCAN (tjkAtId 112168) — önceki koşu: 26.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 01.07.2026 | GALOP | 800 m | 57.00 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 10.07.2026 | GALOP | 600 m | 41.70 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 41.30 | 27.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2026 | GALOP | 600 m | 41.30 | 27.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 02.08.2026 | GALOP | 1000 m | 72.80 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 43.00 | 27.70 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 21.08.2026 | GALOP | 600 m | 43.00 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 59.50 | 29.30 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 800 m | 59.50 | 29.30 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 09.09.2026 | GALOP | 600 m | 45.50 | 29.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.10.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #8 BABA TUNA (tjkAtId 106025) — önceki koşu: 05.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 15.03.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 22.03.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 27.03.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 28.03.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 15.04.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 13.05.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 03.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 09.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 21.06.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 10.07.2026 | Normal | — | — | — | Rahat | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 10.07.2026 | GALOP | 600 m | 42.50 | 28.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | GALOP | 600 m | 44.50 | 29.50 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 800 m | 57.80 | 29.00 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 56.50 | 28.40 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.09.2026 | GALOP | 800 m | 57.00 | 28.40 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 1000 m | 70.00 | 27.40 | R→4 | SENTETIK/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 800 m | 56.50 | 27.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 02.10.2026 | GALOP | 600 m | 40.00 | 26.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 69.00 | 27.10 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 54.50 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.10.2026 | GALOP | 600 m | 41.50 | 27.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 25.10.2026 | GALOP | 1000 m | 71.20 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 01.11.2026 | SPRINT | 400 m | 28.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.11.2026 | GALOP | 800 m | 56.20 | 27.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.11.2026 | SPRINT | 400 m | 27.30 | — | R→4 | KUM/IC | KULLANILDI | S1 · 517 · 29.21 · 1.97 · 13.11.2026 | 0.97 | — | — | 0.34 |
| 15.11.2026 | GALOP | 800 m | 56.00 | 27.60 | R→4 | KUM/IC | KULLANILDI | S1 · 870 · 58.54 · 3.11 · 15.11.2026 | 0.82 | 27.77 · -0.17 · 0.75 · 870 | 0.22 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [0.97, 0.82] → ortalama **0.892** · kapanış: [0.22] → **0.223** · efor: [0.34, 0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 2 farklı idman günü (11.11.2026, 15.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.850 · kapanış 0.650 · efor 0.700 · trend — · süreklilik 0.700
**KAPASİTE** = ortalama(0.850, 0.650, 0.700) = **73.3** · **HAZIRLIK** = ortalama(0.700) = **70.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #9 ALŞUBATHAN (tjkAtId 106140) — önceki koşu: 05.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.07.2026 | GALOP | 600 m | 43.50 | 28.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.07.2026 | GALOP | 600 m | 43.50 | 28.50 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.07.2026 | GALOP | 600 m | 44.40 | 29.60 | R→4 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 28.07.2026 | GALOP | 600 m | 44.40 | 29.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 30.08.2026 | GALOP | 600 m | 46.00 | 30.30 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.09.2026 | GALOP | 600 m | 42.50 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.11.2026 | GALOP | 600 m | 43.50 | 29.20 | R→4 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | -0.16 | 28.70 · 0.50 · 0.79 · 4212 | -0.63 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.16] → ortalama **-0.162** · kapanış: [-0.63] → **-0.627** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (13.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.650 · kapanış 0.150 · efor 0.700 · trend — · süreklilik 0.250
**KAPASİTE** = ortalama(0.650, 0.150, 0.700) = **50.0** · **HAZIRLIK** = ortalama(0.250) = **25.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #10 ASIM EFE (tjkAtId 106844) — önceki koşu: 29.09.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 04.09.2026 | SPRINT | 400 m | 32.90 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 12.09.2026 | SPRINT | 400 m | 33.00 | — | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |

**Ara adımlar** — hız: son 0 hızZ [] → ortalama **—** · kapanış: [] → **—** · efor: [] → **—** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 0 farklı idman günü → **—**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız — · kapanış — · efor — · trend — · süreklilik —
**KAPASİTE** = ortalama(—) = **bilinmiyor** · **HAZIRLIK** = ortalama(—) = **bilinmiyor**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 01.01.1970) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #11 BUDABEŞTE GÜLÜ (tjkAtId 107692) — önceki koşu: 13.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 30.03.2026 | GALOP | 600 m | 41.90 | 27.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.07.2026 | SPRINT | 400 m | 29.00 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.07.2026 | GALOP | 800 m | 55.60 | 27.90 | HÇ→2 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.09.2026 | GALOP | 1000 m | 72.00 | 28.40 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 20.09.2026 | GALOP | 800 m | 57.80 | 27.80 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 800 m | 56.80 | 29.00 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.11.2026 | GALOP | 600 m | 43.00 | 28.50 | R→4 | SENTETIK/? | KULLANILDI | S2 · 283 · 41.87 · 1.58 · 15.11.2026 | -0.72 | 28.22 · 0.28 · 0.52 · 283 | -0.54 | 0.34 |

**Ara adımlar** — hız: son 1 hızZ [-0.72] → ortalama **-0.718** · kapanış: [-0.54] → **-0.537** · efor: [0.34] → **0.335** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (08.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.350 · kapanış 0.250 · efor 0.700 · trend — · süreklilik 0.250
**KAPASİTE** = ortalama(0.350, 0.250, 0.700) = **43.3** · **HAZIRLIK** = ortalama(0.250) = **25.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #12 CÜDA (tjkAtId 95738) — önceki koşu: 05.11.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 17.07.2026 | SPRINT | 400 m | 29.40 | — | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.07.2026 | GALOP | 600 m | 43.20 | 28.40 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.07.2026 | GALOP | 800 m | 60.50 | 29.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 07.08.2026 | GALOP | 600 m | 42.00 | 27.60 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 23.08.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 23.08.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 23.08.2026 | Kenter | — | — | — | — | — | KULLANILAMAZ (normalleştirilemedi) | — | — | — | — | — |
| 06.09.2026 | GALOP | 1000 m | 75.80 | 28.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 19.09.2026 | GALOP | 600 m | 46.20 | 30.80 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 1000 m | 74.80 | 30.50 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 03.10.2026 | GALOP | 600 m | 44.50 | 29.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 1000 m | 73.40 | 29.60 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 75.70 | 30.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 14.10.2026 | GALOP | 600 m | 41.50 | 27.50 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.11.2026 | GALOP | 1000 m | 74.50 | 29.50 | Ç→1 | KUM/? | KULLANILDI | S2 · 1511 · 71.90 · 2.40 · 15.11.2026 | -1.08 | 29.58 · -0.08 · 0.89 · 1511 | 0.09 | -3.01 |

**Ara adımlar** — hız: son 1 hızZ [-1.08] → ortalama **-1.082** · kapanış: [0.09] → **0.092** · efor: [-3.01] → **-3.015** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 1 farklı idman günü (15.11.2026) → **1**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.150 · kapanış 0.550 · efor 0.050 · trend — · süreklilik 0.250
**KAPASİTE** = ortalama(0.150, 0.550, 0.050) = **25.0** · **HAZIRLIK** = ortalama(0.250) = **25.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #13 TARIKCANBEY (tjkAtId 112172) — önceki koşu: 30.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 29.08.2026 | GALOP | 600 m | 43.00 | 28.30 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 27.09.2026 | GALOP | 600 m | 41.00 | 27.00 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 04.10.2026 | GALOP | 600 m | 44.30 | 28.70 | R→4 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.10.2026 | GALOP | 600 m | 41.90 | 27.20 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 11.10.2026 | GALOP | 1000 m | 73.50 | 28.70 | Ç→1 | KUM/IC | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 28.10.2026 | GALOP | 600 m | 42.90 | 29.00 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 06.11.2026 | GALOP | 600 m | 43.00 | 28.50 | Ç→1 | KUM/? | KULLANILDI | S2 · 4212 · 43.18 · 1.96 · 16.11.2026 | 0.09 | 28.36 · 0.14 · 0.79 · 4212 | -0.17 | -3.01 |
| 08.11.2026 | GALOP | 1000 m | 74.60 | 31.60 | Ç→1 | KUM/? | KULLANILDI | S2 · 1511 · 71.90 · 2.40 · 15.11.2026 | -1.12 | 29.62 · 1.98 · 0.89 · 1511 | -2.23 | -3.01 |
| 14.11.2026 | GALOP | 800 m | 57.80 | 29.50 | R→4 | KUM/IC | KULLANILDI | S1 · 870 · 58.54 · 3.11 · 15.11.2026 | 0.24 | 28.86 · 0.64 · 0.75 · 870 | -0.86 | 0.34 |

**Ara adımlar** — hız: son 3 hızZ [0.09, -1.12, 0.24] → ortalama **-0.264** · kapanış: [-0.17, -2.23, -0.86] → **-1.085** · efor: [-3.01, -3.01, 0.34] → **-1.898** · trend: ≥2 karşılaştırılabilir galop yok → BİLİNMİYOR → **—** · süreklilik: son 28 günde 3 farklı idman günü (06.11.2026, 08.11.2026, 14.11.2026) → **3**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.450 · kapanış 0.050 · efor 0.150 · trend — · süreklilik 0.950
**KAPASİTE** = ortalama(0.450, 0.050, 0.150) = **21.7** · **HAZIRLIK** = ortalama(0.950) = **95.0**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

#### Antalya K8 #14 KÜHEYLAN BAKÜRA (tjkAtId 100805) — önceki koşu: 14.10.2026 (kendi kaydımız)
| İdman tarihi | Tür | Mesafe | Süre (sn) | Son 400 | Efor (ham→1-5) | Pist/İç-dış | Durum | Hız referansı (seviye · n · ort · sd · havuz en yeni) | hızZ | Kapanış (beklenen · artık · sd · n) | kapZ | eforZ |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.07.2024 | GALOP | 600 m | 43.50 | 29.20 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 31.07.2024 | GALOP | 600 m | 44.50 | 29.00 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 09.08.2024 | GALOP | 800 m | 55.00 | 27.70 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 15.08.2024 | GALOP | 600 m | 42.30 | 27.80 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 13.07.2026 | GALOP | 600 m | 44.50 | 29.50 | R→4 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 08.08.2026 | GALOP | 600 m | 43.00 | 29.30 | HR→3 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 58.80 | 29.70 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 24.08.2026 | GALOP | 800 m | 58.80 | 29.70 | Ç→1 | KUM/? | MÜKERRER — kaldırıldı (aynı idman başka kayıtta) | — | — | — | — | — |
| 05.09.2026 | GALOP | 600 m | 45.20 | 30.20 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 21.09.2026 | GALOP | 800 m | 60.00 | 30.60 | Ç→1 | KUM/? | pencere dışı — önceki koşudan önce/aynı gün | — | — | — | — | — |
| 26.10.2026 | GALOP | 800 m | 58.60 | 29.60 | Ç→1 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | -0.19 | 29.26 · 0.34 · 0.69 · 3129 | -0.50 | -3.01 |
| 09.11.2026 | GALOP | 800 m | 58.90 | 29.40 | R→4 | KUM/? | KULLANILDI | S2 · 3129 · 58.12 · 2.51 · 16.11.2026 | -0.31 | 29.43 · -0.03 · 0.69 · 3129 | 0.05 | 0.34 |

**Ara adımlar** — hız: son 2 hızZ [-0.19, -0.31] → ortalama **-0.250** · kapanış: [-0.50, 0.05] → **-0.224** · efor: [-3.01, 0.34] → **-1.340** · trend: 800|GALOP|KUM: 26.10.2026→z=-0.190, 09.11.2026→z=-0.310 → **-0.120** · süreklilik: son 28 günde 2 farklı idman günü (26.10.2026, 09.11.2026) → **2**
**Yarış-içi yüzdelik** (sahadaki galoplu atlar arasında; beraberlikte yarım): hız 0.550 · kapanış 0.450 · efor 0.250 · trend 0.167 · süreklilik 0.700
**KAPASİTE** = ortalama(0.550, 0.450, 0.250) = **41.7** · **HAZIRLIK** = ortalama(0.167, 0.700) = **43.3**
**Geçerlilik:** GEÇERLİ (kullanılan galoplar ve referans havuzları t'den önce; en yeni referans galobu 16.11.2026) · **Modül karşılaştırması:** EŞLEŞTİ (|Δ|<1e-9)

## 4–5. Top1 / Top3 yeniden üretimi (yarış yarış)
Tanımlar: **Top1** = puanı en yüksek atın kazanması; **Top3** = kazananın puana göre ilk 3'te olması. Eşit puanda beraberlik payı eşit bölünür (kredi = clamp((m − daha yüksek puanlı at sayısı) / eşit puanlı at sayısı, 0, 1)). **Rastgele** = m/n.
- **Değerlendirilebilir atlar:** yalnız galop verisi olan atlar sıralanır; kazananın galopu yoksa yarış SAYILMAZ (bildirdiğim 8/14, 9/14 bu tanımdır).
- **Tam saha:** bütün atlar; galopsuz atlar nötr (sahadaki puanlı atların ortalaması) alınır; kazananı galopsuz yarışlar da sayılır.

### KAPASİTE — DEĞERLENDİRİLEBİLİR ATLAR
| Yarış | Kazanan | Kazananın sırası | Top1 kredi | Top3 kredi | Rastgele Top1 | Rastgele Top3 | Not |
|---|---|---|---|---|---|---|---|
| Adana K1 | #1 TIMEWARDEN | 2/10 | 0.000 | 1.000 | 0.100 | 0.300 |  |
| Adana K2 | #3 COOGER FIRE | 1/7 | 1.000 | 1.000 | 0.143 | 0.429 |  |
| Adana K3 | #8 AZERBAYCANLI | 1/5 | 1.000 | 1.000 | 0.200 | 0.600 |  |
| Adana K4 | #5 MAMDANI | 1/12 | 1.000 | 1.000 | 0.083 | 0.250 |  |
| Adana K5 | #5 QUEEN SEÇİL | 6/9 | 0.000 | 0.000 | 0.111 | 0.333 |  |
| Adana K6 | #2 ORÇUNTAY | 3/6 | 0.000 | 1.000 | 0.167 | 0.500 |  |
| Adana K7 | #8 YAĞIZ EFENDİ | 5/10 | 0.000 | 0.000 | 0.100 | 0.300 |  |
| Adana K8 | #1 DİCLE FIRAT | galop yok | sayılmadı | sayılmadı | — | — | kazananın galopu yok → sayılmadı |
| Antalya K1 | #1 HAS TURBO | 2–3/8 | 0.000 | 1.000 | 0.125 | 0.375 |  |
| Antalya K2 | #1 RAZENOID | 3–4/5 | 0.000 | 0.500 | 0.200 | 0.600 |  |
| Antalya K3 | #5 YAYLA ÇİÇEĞİ | 1/10 | 1.000 | 1.000 | 0.100 | 0.300 |  |
| Antalya K4 | #1 THUNDER HORSE | 1/8 | 1.000 | 1.000 | 0.125 | 0.375 |  |
| Antalya K5 | #8 CİHANA BEDEL | galop yok | sayılmadı | sayılmadı | — | — | kazananın galopu yok → sayılmadı |
| Antalya K6 | #3 GENERAL BRIELLA | 5–6/8 | 0.000 | 0.000 | 0.125 | 0.375 |  |
| Antalya K7 | #7 SON OF FIRE | 1/5 | 1.000 | 1.000 | 0.200 | 0.600 |  |
| Antalya K8 | #1 HARESE | 1/10 | 1.000 | 1.000 | 0.100 | 0.300 |  |
**Toplam (14 yarış): Top1 7.00/14 (50.0%) · Top3 10.50/14 (75.0%) · rastgele Top1 1.88 (13.4%) Top3 5.64 (40.3%)** — Adana 7 yarış: Top1 3.00, Top3 5.00; Antalya 7 yarış: Top1 4.00, Top3 5.50

### HAZIRLIK — DEĞERLENDİRİLEBİLİR ATLAR
| Yarış | Kazanan | Kazananın sırası | Top1 kredi | Top3 kredi | Rastgele Top1 | Rastgele Top3 | Not |
|---|---|---|---|---|---|---|---|
| Adana K1 | #1 TIMEWARDEN | 7–9/10 | 0.000 | 0.000 | 0.100 | 0.300 |  |
| Adana K2 | #3 COOGER FIRE | 1/7 | 1.000 | 1.000 | 0.143 | 0.429 |  |
| Adana K3 | #8 AZERBAYCANLI | 2–5/5 | 0.000 | 0.500 | 0.200 | 0.600 |  |
| Adana K4 | #5 MAMDANI | 9–12/12 | 0.000 | 0.000 | 0.083 | 0.250 |  |
| Adana K5 | #5 QUEEN SEÇİL | 3–9/9 | 0.000 | 0.143 | 0.111 | 0.333 |  |
| Adana K6 | #2 ORÇUNTAY | 1/6 | 1.000 | 1.000 | 0.167 | 0.500 |  |
| Adana K7 | #8 YAĞIZ EFENDİ | 2/10 | 0.000 | 1.000 | 0.100 | 0.300 |  |
| Adana K8 | #1 DİCLE FIRAT | galop yok | sayılmadı | sayılmadı | — | — | kazananın galopu yok → sayılmadı |
| Antalya K1 | #1 HAS TURBO | 6–8/8 | 0.000 | 0.000 | 0.125 | 0.375 |  |
| Antalya K2 | #1 RAZENOID | 2/5 | 0.000 | 1.000 | 0.200 | 0.600 |  |
| Antalya K3 | #5 YAYLA ÇİÇEĞİ | 4–10/10 | 0.000 | 0.000 | 0.100 | 0.300 |  |
| Antalya K4 | #1 THUNDER HORSE | 4–8/8 | 0.000 | 0.000 | 0.125 | 0.375 |  |
| Antalya K5 | #8 CİHANA BEDEL | galop yok | sayılmadı | sayılmadı | — | — | kazananın galopu yok → sayılmadı |
| Antalya K6 | #3 GENERAL BRIELLA | 6–8/8 | 0.000 | 0.000 | 0.125 | 0.375 |  |
| Antalya K7 | #7 SON OF FIRE | 4–5/5 | 0.000 | 0.000 | 0.200 | 0.600 |  |
| Antalya K8 | #1 HARESE | 6–10/10 | 0.000 | 0.000 | 0.100 | 0.300 |  |
**Toplam (14 yarış): Top1 2.00/14 (14.3%) · Top3 4.64/14 (33.2%) · rastgele Top1 1.88 (13.4%) Top3 5.64 (40.3%)** — Adana 7 yarış: Top1 2.00, Top3 3.64; Antalya 7 yarış: Top1 0.00, Top3 1.00

### KAPASİTE — TAM SAHA
| Yarış | Kazanan | Kazananın sırası | Top1 kredi | Top3 kredi | Rastgele Top1 | Rastgele Top3 | Not |
|---|---|---|---|---|---|---|---|
| Adana K1 | #1 TIMEWARDEN | 2/10 | 0.000 | 1.000 | 0.091 | 0.273 |  |
| Adana K2 | #3 COOGER FIRE | 1/7 | 1.000 | 1.000 | 0.143 | 0.429 |  |
| Adana K3 | #8 AZERBAYCANLI | 1/5 | 1.000 | 1.000 | 0.083 | 0.250 |  |
| Adana K4 | #5 MAMDANI | 1/12 | 1.000 | 1.000 | 0.077 | 0.231 |  |
| Adana K5 | #5 QUEEN SEÇİL | 6/9 | 0.000 | 0.000 | 0.100 | 0.300 |  |
| Adana K6 | #2 ORÇUNTAY | 3/6 | 0.000 | 1.000 | 0.125 | 0.375 |  |
| Adana K7 | #8 YAĞIZ EFENDİ | 5/10 | 0.000 | 0.000 | 0.100 | 0.300 |  |
| Adana K8 | #1 DİCLE FIRAT | galop yok | 0.000 | 0.000 | 0.063 | 0.188 | kazananın galopu yok → nötr puan |
| Antalya K1 | #1 HAS TURBO | 2–3/8 | 0.000 | 1.000 | 0.111 | 0.333 |  |
| Antalya K2 | #1 RAZENOID | 3–4/5 | 0.000 | 0.333 | 0.167 | 0.500 |  |
| Antalya K3 | #5 YAYLA ÇİÇEĞİ | 1/10 | 1.000 | 1.000 | 0.100 | 0.300 |  |
| Antalya K4 | #1 THUNDER HORSE | 1/8 | 1.000 | 1.000 | 0.125 | 0.375 |  |
| Antalya K5 | #8 CİHANA BEDEL | galop yok | 0.000 | 0.000 | 0.111 | 0.333 | kazananın galopu yok → nötr puan |
| Antalya K6 | #3 GENERAL BRIELLA | 5–6/8 | 0.000 | 0.000 | 0.111 | 0.333 |  |
| Antalya K7 | #7 SON OF FIRE | 1/5 | 1.000 | 1.000 | 0.125 | 0.375 |  |
| Antalya K8 | #1 HARESE | 1/10 | 1.000 | 1.000 | 0.071 | 0.214 |  |
**Toplam (16 yarış): Top1 7.00/16 (43.8%) · Top3 10.33/16 (64.6%) · rastgele Top1 1.70 (10.6%) Top3 5.11 (31.9%)** — Adana 8 yarış: Top1 3.00, Top3 5.00; Antalya 8 yarış: Top1 4.00, Top3 5.33

### HAZIRLIK — TAM SAHA
| Yarış | Kazanan | Kazananın sırası | Top1 kredi | Top3 kredi | Rastgele Top1 | Rastgele Top3 | Not |
|---|---|---|---|---|---|---|---|
| Adana K1 | #1 TIMEWARDEN | 7–9/10 | 0.000 | 0.000 | 0.091 | 0.273 |  |
| Adana K2 | #3 COOGER FIRE | 1/7 | 1.000 | 1.000 | 0.143 | 0.429 |  |
| Adana K3 | #8 AZERBAYCANLI | 2–5/5 | 0.000 | 0.000 | 0.083 | 0.250 |  |
| Adana K4 | #5 MAMDANI | 9–12/12 | 0.000 | 0.000 | 0.077 | 0.231 |  |
| Adana K5 | #5 QUEEN SEÇİL | 3–9/9 | 0.000 | 0.000 | 0.100 | 0.300 |  |
| Adana K6 | #2 ORÇUNTAY | 1/6 | 1.000 | 1.000 | 0.125 | 0.375 |  |
| Adana K7 | #8 YAĞIZ EFENDİ | 2/10 | 0.000 | 1.000 | 0.100 | 0.300 |  |
| Adana K8 | #1 DİCLE FIRAT | galop yok | 0.000 | 0.000 | 0.063 | 0.188 | kazananın galopu yok → nötr puan |
| Antalya K1 | #1 HAS TURBO | 6–8/8 | 0.000 | 0.000 | 0.111 | 0.333 |  |
| Antalya K2 | #1 RAZENOID | 2/5 | 0.000 | 1.000 | 0.167 | 0.500 |  |
| Antalya K3 | #5 YAYLA ÇİÇEĞİ | 4–10/10 | 0.000 | 0.000 | 0.100 | 0.300 |  |
| Antalya K4 | #1 THUNDER HORSE | 4–8/8 | 0.000 | 0.000 | 0.125 | 0.375 |  |
| Antalya K5 | #8 CİHANA BEDEL | galop yok | 0.000 | 0.500 | 0.111 | 0.333 | kazananın galopu yok → nötr puan |
| Antalya K6 | #3 GENERAL BRIELLA | 6–8/8 | 0.000 | 0.000 | 0.111 | 0.333 |  |
| Antalya K7 | #7 SON OF FIRE | 4–5/5 | 0.000 | 0.000 | 0.125 | 0.375 |  |
| Antalya K8 | #1 HARESE | 6–10/10 | 0.000 | 0.000 | 0.071 | 0.214 |  |
**Toplam (16 yarış): Top1 2.00/16 (12.5%) · Top3 4.50/16 (28.1%) · rastgele Top1 1.70 (10.6%) Top3 5.11 (31.9%)** — Adana 8 yarış: Top1 2.00, Top3 3.00; Antalya 8 yarış: Top1 0.00, Top3 1.50

## 6. Yarış sonucunun hesaba / özellik seçimine girmediğinin doğrulaması
1. **Hesap kodu sonuç verisine erişemez.** `galop-aday.ts`: import yok (yok); winner/result/kazan/sonuç/ganyan/db/ağ kelimeleri geçmiyor. Özellik fonksiyonu yalnız as-of görünümü (`GalopGorunum`) alır; görünüm `tarih < t` galoplarını verir.
2. **Kod sırası:** Bu araçta puanlar (FAZ A) hesaplanıp kilitlendi (puan özeti uzunluğu 4248 karakter); sonuç etiketleri (`Result.winnerNos`) ancak FAZ B'de, puanlardan sonra yüklendi.
3. **Etiket-permütasyon testi:** kazananlar rastgele atlarla değiştirilince puanlar DEĞİŞMEDİ (puan özeti aynı: EVET); yalnız Top1 değişir. Rastgele 3 etiketlemede KAPASİTE Top1 = 3.50, 1.00, 2.00 (gerçek etiketle 7.00).
4. **Özellik seçimi / ayarlama yok:** yalnız iki aday (KAPASİTE, HAZIRLIK) tanımlıdır; bileşen sayısı, son-3-galop, min grup n=30, ±3 kırpma gibi sabitler kullanıcı şartnamesinden sonra koda yazıldı ve **`galop-aday.ts` dosyası oluşturulduğundan beri hiç değiştirilmedi** (git: eef2a6d). Bu dosyadaki hiçbir değer bu günün sonuçlarına bakılarak ayarlanmadı. α (birleşim ağırlığı) bu doğrulamada kullanılmadı.

## 7. Özet
- Yarış: 16 (Adana 8, Antalya 8); at 160.
- **Bağımsız hesap ↔ modül:** 160 at karşılaştırıldı, **uyuşmayan 0**.
- **Geçersiz (yarış-sonrası veri kullanan) at: 0.** Kullanılan galop 304; yarış günü/sonrası tarihli olduğu için DIŞLANAN kayıt 0; mükerrer kaldırılan 502. Kullanılan referans havuzlarındaki en yeni galop tarihi: **16.11.2026** (< 17.11.2026).
- KAPASİTE DEĞERLENDİRİLEBİLİR ATLAR: yarış 14 | Top1 7.00 | Top3 10.50 | rastgele Top1 1.88 Top3 5.64
- HAZIRLIK DEĞERLENDİRİLEBİLİR ATLAR: yarış 14 | Top1 2.00 | Top3 4.64 | rastgele Top1 1.88 Top3 5.64
- KAPASİTE TAM SAHA: yarış 16 | Top1 7.00 | Top3 10.33 | rastgele Top1 1.70 Top3 5.11
- HAZIRLIK TAM SAHA: yarış 16 | Top1 2.00 | Top3 4.50 | rastgele Top1 1.70 Top3 5.11
- **Sınırlar:** (1) 14–16 yarış çok küçük bir örnektir; bu bir gün, bir kanıt değil. (2) Galop kayıtlarının veritabanına **ne zaman** girdiği saklanmıyor: tarihler gerçek idman tarihidir (yarıştan önce olmuştur) ama "o gün o kayıt sistemde görünüyor muydu" kanıtlanamaz. (3) Hipodrom ve pist durumu kaydımızda yok. (4) Önceki koşu tarihi, kendi kayıtlarımız + TJK geçmiş önbelleğinden alınır (önbellek sonradan güncellenmiş olabilir; yalnız t'den önceki satırlar kullanıldı).