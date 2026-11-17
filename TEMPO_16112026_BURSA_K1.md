# TEMPO ADAYI — ERKEN_HIZ, KOSU_STILI ve LIDERLIK_BASKISI, hedef: 16.11.2026 Bursa K1, 1300 m Kum
**Yeni motora sinyal eklenmedi; `SINYAL_KAYDI` boş; ağırlık/katsayı yok.** Eski `Runner.raceStyle` kullanılmadı. Bu rapor yalnız 16 Kasım **öncesi** değerleri gösterir; yarış sonucu hiçbir yerde kullanılmadı.

**Hedef yarış:** 16.11.2026 Bursa K1, 1300 m, KUM, INGILIZ, Maiden; 9 at (TJK'daki gerçek koşan at sayısı N=9). Bu yarışın kendi Accurace kaydı veritabanında **VAR ve hesap DIŞINDA**; bu 9 ata ait tarihi ≥ 16.11.2026 olan 9 kayıt da dışarıda.

## 0. Kararlarınız ve formüller
**Uygulanan kararlar:** (1) Stil 200/400/600 m (800 m saklı, kullanılmadı). (2) **N = TJK'daki gerçek koşan at sayısı** (Accurace kayıtlı at sayısı değil). (3) Referans ırk + pist + hipodrom + mesafe. (4) Stil sınıflaması yok; S sürekli 0–1. (5) Liderlik baskısı erken hız ve öne çıkma eğilimi birlikte.
- **ERKEN_HIZ:** V = 400/(T600−T200) m/s → referansta yüzdelik (0–100); son 3 uygun yarışın ortalaması.
- **KOSU_STILI:** S = 1 − (1/3)·Σ_{d∈{200,400,600}} (R_d − 1)/(N − 1), N gerçek saha. Sıralar Accurace'te kayıtlı atlar arasındadır; kayıtlı at sayısı gerçek sahadan azsa (bu veride yarışların ~%12'si) sıralar 1..kayıtlı aralığındadır; sıra > N olursa o yarış hesaplanmaz.
- **P_öncü** = (1+k)/(2+n): atın son **n=3** uygun yarışında, 200/400/600 m kontrol noktalarının **en az birinde** ön gruptaysa o yarış "ön gruba girdi" (k); **ön grup** = sıra ≤ max(2, ⌈0,20·N⌉). Veri yoksa (n=0) formül önsel 0,5 verir (**"veri yok" olarak işaretlenir**). Kalibre olasılık değildir.
- **V (baskıda):** atın ERKEN_HIZ puanı (0–100 yüzdelik). **τ** = bu hedef yarışın benzer geçmiş yarışlarında (aynı ırk+yüzey+hipodrom+mesafe; ≥30 üye ve ≥10 yarış yoksa hipodromsuz) atlar arası ERKEN_HIZ yüzdelik farklarının (|ΔV|, tüm çiftler) **medyanı**. **B_h** = Σ_{j≠h} P_öncü,j · σ((V_j − V_h)/τ); V'si bilinmeyen rakip toplama girmez (sıfır sayılmaz; kaç rakibin bilindiği gösterilir).

**Sizden onay isteyen yorum noktaları (varsayımlarım):**
1. **"İlk 600 m kontrol noktalarında ön gruba girdiği yarış":** 200/400/600'ün **en az birinde** ön grup = "girdi" olarak yorumladım. "Üçünde de" olsaydı k daha küçük olurdu; tabloda ayrıca bilgi olarak (k_hepsi) gösterdim ama puana girmedi.
2. **Ön grup sınırı:** "ilk iki sıra veya sahanın ilk %20'si" → **büyük olanı** aldım: max(2, ⌈0,20·N⌉) (N=9 için 2, N=12 için 3, N=16 için 4).
3. **n:** metinde "son n uygun yarış" yazıyor, değer verilmedi; ACC/GALOP/TEMPO'daki kuralla **n=3** aldım.
4. **V ve τ birimi:** V = ERKEN_HIZ yüzdeliği (0–100); τ da aynı birimde (yüzdelik puanı farkı). Z-puanı kullanılırsa τ farklı olur ama σ((V_j−V_h)/τ) aynı kalır (ölçek birlikte değişir) — birim seçimi sonucu değiştirmez, yalnız yüzdelik dağılımın şekli etkili.

**τ (bu yarış için):** **13.40** yüzdelik puan (seviye 1: ırk+yüzey+hipodrom+mesafe; 24 geçmiş yarış, 886 at çifti; en yeni referans 02.11.2026) — bağımsız hesap: 13.40 (seviye 1).

## 1. 9 atın TEMPO değerleri (16 Kasım öncesi)
| No | At | ERKEN_HIZ (0–100) | KOSU_STILI S (son 3) | Stil sd | S tüm geçmiş | P_öncü = (1+k)/(2+n) | k / n (k_hepsi) | **LIDERLIK_BASKISI B** | B'de bilinen rakip | ACC_HIZ (bilgi) | Bağımsız hesap |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ARSLANBEYLİ | 86.8 | 0.882 | 0.010 | 0.882 | 0.750 | 2 / 2 (2) | **0.351** | 8/8 | 44.9 | EŞLEŞTİ |
| 2 | KUMKADI ASLANI | 51.7 | 0.655 | 0.102 | 0.655 | 0.500 | 1 / 2 (0) | **1.748** | 8/8 | 21.0 | EŞLEŞTİ |
| 3 | MİR BEG | 95.1 | 0.667 | — | 0.667 | 0.333 | 0 / 1 (0) | **0.338** | 8/8 | 27.9 | EŞLEŞTİ |
| 4 | MY NOBLE SON | 18.4 | 0.350 | 0.354 | 0.350 | 0.400 | 1 / 3 (0) | **3.505** | 8/8 | 10.7 | EŞLEŞTİ |
| 5 | RAŞAMO | 20.6 | 0.739 | 0.067 | 0.535 | 0.600 | 2 / 3 (0) | **3.300** | 8/8 | 27.8 | EŞLEŞTİ |
| 6 | HOLD ON TO LIFE | 60.1 | 0.730 | 0.166 | 0.458 | 0.600 | 2 / 3 (1) | **1.339** | 8/8 | 24.8 | EŞLEŞTİ |
| 7 | WORKIN LADY | 26.7 | 0.837 | 0.141 | 0.848 | 0.800 | 3 / 3 (1) | **2.885** | 8/8 | 19.3 | EŞLEŞTİ |
| 8 | MY LIFE ELİF | 31.3 | 0.167 | — | 0.167 | 0.333 | 0 / 1 (0) | **2.866** | 8/8 | 37.1 | EŞLEŞTİ |
| 9 | STEEL HUNTER | 34.4 | 0.723 | 0.140 | 0.535 | 0.400 | 1 / 3 (1) | **2.669** | 8/8 | 40.3 | EŞLEŞTİ |

B'ye göre (yüksek = önde daha çok/ hızlı rakip; **kazanma puanı DEĞİL**, yalnız tanım gereği sıralama): MY NOBLE SON 3.51 · RAŞAMO 3.30 · WORKIN LADY 2.89 · MY LIFE ELİF 2.87 · STEEL HUNTER 2.67 · KUMKADI ASLANI 1.75 · HOLD ON TO LIFE 1.34 · ARSLANBEYLİ 0.35 · MİR BEG 0.34.

## 2. At at döküm (t'den önceki TÜM Accurace kayıtları)
N = o yarışın TJK'daki gerçek koşan at sayısı; "ön gr." = en az bir noktada ön grup (sıra ≤ max(2,⌈0,2N⌉)); "—" = hesaplanamadı. **Kullanım:** SON3 = puana (erken/stil) giren.
### #1 ARSLANBEYLİ (tjkAtId 114754)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 06.10.2026 | KOCAELI | 1200 | KUM | 9 | 17.649 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 77.2 | 2 / 2 / 2 | 0.875 | EVET | SON3 / SON3 |
| 03.11.2026 | KOCAELI | 1500 | KUM | 10 | 18.192 | S1 · 214 · 17.617 · 0.348 · 03.11.2026 | 96.5 | 2 / 2 / 2 | 0.889 | EVET | SON3 / SON3 |

ERKEN_HIZ **86.83** · S **0.882** (sd 0.010) · P_öncü = (1+2)/(2+2) = **0.750** · B = **0.351** · bağımsız ikinci hesap: EŞLEŞTİ

### #2 KUMKADI ASLANI (tjkAtId 112681)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 09.07.2026 | KOCAELI | 1200 | KUM | 9 | 17.323 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 50.3 | 5 / 4 / 4 | 0.583 | hayır | SON3 / SON3 |
| 03.10.2026 | IZMIR | 1200 | KUM | 12 | 17.091 | S1 · 759 · 17.037 · 0.513 · 14.11.2026 | 53.1 | 5 / 3 / 4 | 0.727 | EVET | SON3 / SON3 |

ERKEN_HIZ **51.71** · S **0.655** (sd 0.102) · P_öncü = (1+1)/(2+2) = **0.500** · B = **1.748** · bağımsız ikinci hesap: EŞLEŞTİ

### #3 MİR BEG (tjkAtId 112921)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 03.11.2026 | KOCAELI | 1500 | KUM | 10 | 18.139 | S1 · 214 · 17.617 · 0.348 · 03.11.2026 | 95.1 | 4 / 4 / 4 | 0.667 | hayır | SON3 / SON3 |

ERKEN_HIZ **95.09** · S **0.667** (sd —) · P_öncü = (1+0)/(2+1) = **0.333** · B = **0.338** · bağımsız ikinci hesap: EŞLEŞTİ

### #4 MY NOBLE SON (tjkAtId 112689)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 10.09.2026 | IZMIR | 1600 | KUM | 9 | 16.316 | S1 · 642 · 16.688 · 0.473 · 12.11.2026 | 20.7 | 8 / 8 / 8 | 0.125 | hayır | SON3 / SON3 |
| 22.09.2026 | KOCAELI | 1400 | KUM | 12 | 17.336 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | 16.1 | 5 / 2 / 4 | 0.758 | EVET | SON3 / SON3 |
| 02.10.2026 | BURSA | 1500 | CIM | 11 | 17.424 | S1 · 225 · 17.917 · 0.546 · 22.10.2026 | 18.4 | 9 / 10 / 9 | 0.167 | hayır | SON3 / SON3 |

ERKEN_HIZ **18.43** · S **0.350** (sd 0.354) · P_öncü = (1+1)/(2+3) = **0.400** · B = **3.505** · bağımsız ikinci hesap: EŞLEŞTİ

### #5 RAŞAMO (tjkAtId 114264)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 29.06.2026 | BURSA | 1200 | KUM | 9 | 16.985 | S1 · 166 · 17.127 · 0.357 · 31.08.2026 | 37.0 | 4 / 4 / 4 | 0.625 | hayır | ESKI / ESKI |
| 21.07.2026 | ANKARA | 1300 | KUM | 4 | 16.500 | S1 · 114 · 17.101 · 0.377 · 07.11.2026 | 2.2 | 4 / 4 / 4 | 0.000 | hayır | ESKI / ESKI |
| 02.08.2026 | IZMIR | 1400 | KUM | 5 | 17.021 | S1 · 900 · 17.423 · 0.437 · 12.11.2026 | 16.8 | 4 / 5 / 5 | 0.083 | hayır | ESKI / ESKI |
| 11.08.2026 | KOCAELI | 1400 | KUM | 9 | 17.304 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | 14.9 | 5 / 5 / 5 | 0.500 | hayır | ESKI / ESKI |
| 28.08.2026 | BURSA | 1400 | KUM | 8 | 16.190 | S1 · 605 · 17.275 · 0.440 · 13.11.2026 | 2.9 | 2 / 2 / 2 | 0.857 | EVET | ESKI / ESKI |
| 10.09.2026 | IZMIR | 1600 | KUM | 9 | 16.008 | S1 · 642 · 16.688 · 0.473 · 12.11.2026 | 7.9 | 3 / 3 / 3 | 0.750 | hayır | SON3 / SON3 |
| 20.09.2026 | ISTANBUL | 1600 | CIM | 6 | 17.162 | S1 · 464 · 17.451 · 0.435 · 25.10.2026 | 23.1 | 2 / 3 / 3 | 0.667 | EVET | SON3 / SON3 |
| 02.10.2026 | BURSA | 1500 | CIM | 11 | 17.681 | S1 · 225 · 17.917 · 0.546 · 22.10.2026 | 30.9 | 3 / 4 / 2 | 0.800 | EVET | SON3 / SON3 |

ERKEN_HIZ **20.61** · S **0.739** (sd 0.067) · P_öncü = (1+2)/(2+3) = **0.600** · B = **3.300** · bağımsız ikinci hesap: EŞLEŞTİ

### #6 HOLD ON TO LIFE (tjkAtId 113305)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 19.06.2026 | BURSA | 1200 | CIM | 8 | 18.025 | S1 · 268 · 17.452 · 0.466 · 21.10.2026 | 91.2 | 8 / 8 / 6 | 0.095 | hayır | ESKI / ESKI |
| 03.07.2026 | BURSA | 1200 | CIM | 5 | 17.262 | S1 · 268 · 17.452 · 0.466 · 21.10.2026 | 30.0 | 4 / 4 / 4 | 0.250 | hayır | ESKI / ESKI |
| 20.07.2026 | BURSA | 1200 | CIM | 12 | 17.257 | S1 · 268 · 17.452 · 0.466 · 21.10.2026 | 28.5 | 9 / 10 / 10 | 0.212 | hayır | ESKI / ESKI |
| 12.10.2026 | BURSA | 1400 | CIM | 11 | 18.074 | S1 · 360 · 17.732 · 0.375 · 26.10.2026 | 83.3 | 3 / 2 / 2 | 0.867 | EVET | SON3 / SON3 |
| 30.10.2026 | BURSA | 1400 | KUM | 12 | 16.907 | S1 · 605 · 17.275 · 0.440 · 13.11.2026 | 15.0 | 4 / 6 / 8 | 0.545 | hayır | SON3 / SON3 |
| 09.11.2026 | BURSA | 1400 | KUM | 10 | 17.626 | S1 · 605 · 17.275 · 0.440 · 13.11.2026 | 82.0 | 5 / 2 / 2 | 0.778 | EVET | SON3 / SON3 |

ERKEN_HIZ **60.09** · S **0.730** (sd 0.166) · P_öncü = (1+2)/(2+3) = **0.600** · B = **1.339** · bağımsız ikinci hesap: EŞLEŞTİ

### #7 WORKIN LADY (tjkAtId 113879)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.08.2026 | KOCAELI | 1200 | KUM | 12 | 17.130 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 30.8 | 1 / 3 / 3 | 0.879 | EVET | ESKI / ESKI |
| 04.09.2026 | BURSA | 1400 | CIM | 8 | 17.077 | S1 · 360 · 17.732 · 0.375 · 26.10.2026 | 3.5 | 1 / 1 / 1 | 1.000 | EVET | SON3 / SON3 |
| 11.09.2026 | BURSA | 1300 | CIM | 13 | 17.734 | S1 · 239 · 17.461 · 0.511 · 23.10.2026 | 63.4 | 3 / 4 / 5 | 0.750 | EVET | SON3 / SON3 |
| 04.10.2026 | ISTANBUL | 1200 | CIM | 8 | 16.829 | S1 · 270 · 17.418 · 0.618 · 15.11.2026 | 13.1 | 2 / 3 / 3 | 0.762 | EVET | SON3 / SON3 |

ERKEN_HIZ **26.67** · S **0.837** (sd 0.141) · P_öncü = (1+3)/(2+3) = **0.800** · B = **2.885** · bağımsız ikinci hesap: EŞLEŞTİ

### #8 MY LIFE ELİF (tjkAtId 122794)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 27.07.2026 | BURSA | 1300 | KUM | 7 | 16.998 | S1 · 209 · 17.174 · 0.342 · 02.11.2026 | 31.3 | 6 / 6 / 6 | 0.167 | hayır | SON3 / SON3 |

ERKEN_HIZ **31.34** · S **0.167** (sd —) · P_öncü = (1+0)/(2+1) = **0.333** · B = **2.866** · bağımsız ikinci hesap: EŞLEŞTİ

### #9 STEEL HUNTER (tjkAtId 116717)
| Tarih | Hip. | Mesafe | Zemin | N | V (m/s) | Referans | ERKEN yüzdelik | R200 / R400 / R600 | S | Ön gr. | Kullanım (erken / stil) |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 25.08.2026 | KOCAELI | 1200 | KUM | 11 | 17.073 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 25.4 | 10 / 7 / 9 | 0.233 | hayır | ESKI / ESKI |
| 08.09.2026 | KOCAELI | 1400 | KUM | 10 | 16.967 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | 6.1 | 6 / 6 / 6 | 0.444 | hayır | ESKI / ESKI |
| 22.09.2026 | KOCAELI | 1400 | KUM | 12 | 17.626 | S1 · 518 · 17.659 · 0.388 · 10.11.2026 | 43.0 | 7 / 10 / 7 | 0.364 | hayır | ESKI / ESKI |
| 13.10.2026 | KOCAELI | 1200 | KUM | 13 | 17.025 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 22.2 | 4 / 5 / 5 | 0.694 | hayır | SON3 / SON3 |
| 20.10.2026 | KOCAELI | 1200 | KUM | 9 | 17.428 | S1 · 313 · 17.338 · 0.432 · 03.11.2026 | 60.5 | 2 / 2 / 2 | 0.875 | EVET | SON3 / SON3 |
| 03.11.2026 | KOCAELI | 1500 | KUM | 11 | 17.346 | S1 · 214 · 17.617 · 0.348 · 03.11.2026 | 20.3 | 5 / 4 / 6 | 0.600 | hayır | SON3 / SON3 |

ERKEN_HIZ **34.36** · S **0.723** (sd 0.140) · P_öncü = (1+1)/(2+3) = **0.400** · B = **2.669** · bağımsız ikinci hesap: EŞLEŞTİ

## 3. Zaman bütünlüğü ve doğrulama
- **Hedef gün hariç:** kullanılan her kaydın tarihi < 16.11.2026; en yeni kullanılan kayıt **09.11.2026**, en yeni referans kaydı **15.11.2026**. Yarış sonrası veri kullanan hesap: **0 (GEÇERSİZ yok)**.
- **Gelecek-bozma testi:** 16.11.2026 ve sonrası TÜM kayıtlar (süre, sıra, ön grup) bozulup aynı güne ve geleceğe uç değerli sahte kayıtlar eklenerek yeniden hesaplandı: 9 atın bileşenleri ve τ **birebir aynı kaldı (sızıntı yok)**. Birim testleri (formül/P_öncü/B/τ sayısal örnekleri dahil) ve yapısal kural geçti.
- **Bağımsız ikinci hesap** (modüle bakmadan, ham kontrol noktalarından düz döngüyle; ERKEN_HIZ, S, k/n, P_öncü, τ, B): 9 at karşılaştırıldı, **uyuşmayan 0**.
- Normalleştirilemeyen kayıt: 265 (ara zamanlar monoton değil: 12, ata bağlı değil: 253). Gerçek saha ≠ Accurace kayıtlı at sayısı olan yarış: 608/4974.
- **Sonuç etiketi:** hesapta yarış sonucu hiçbir yerde okunmadı (araç Result tablosuna erişmez).

## 4. Sınırlar
- Accurace kayıtlarının veritabanına NE ZAMAN girdiği saklanmıyor; tarihler gerçek yarış tarihidir (< 16 Kasım) ama "o gün sistemde görünüyor muydu" kanıtlanamaz. Konum çözünürlüğü 100 m.
- P_öncü kalibre olasılık değil, başlangıç eğilim tahminidir (n küçük; n=1'de P ∈ {1/3, 2/3}). Rakibin V'si bilinmiyorsa B'ye girmez; bu, B'yi eksik bilgiyle düşük bırakabilir (bilinen rakip sayısı tabloda).
- B_h, yarış-içi bir ölçüdür (rakiplere göre); yalnız bu 9 at ve bu yarış için hesaplandı. Hiçbir tahmin gücü testi yapılmadı; sonraki adımda ACC_HIZ'dan bağımsız katkı ölçülecek.