# HANDİKAP araştırması — kilo, sınıf farkı, sıklet değişimi ve GALOP_KAPASITE etkileşimi (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)
Hiçbir katsayı, ağırlık veya aktivasyon kararı verilmedi. Karşılaştırma tabanı: **ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (B5)**; ‘kontrollü’ taban ayrıca handikap puanı (hp), geçmiş kazanma/ilk-3 oranı ve sınıf değişimi içerir (ağır kilo taşıyan kaliteli atın başarısını kilo avantajı sanmamak için). H_APRANTI_ETKI mevcut veriyle **hesaplanamaz** (bölüm 0).

## 0. Düzenek, veri gerçekleri, doğrulama
- **Handikap yarışları:** 1566 yarış (2026-01-02→2026-11-17), 17214 koşan at; sınıflar H13–H21 (H14 ve H15–16 en kalabalık). **Tekrar kullanılmış dönemle örtüşür; bağımsız/ileri-yönlü doğrulama DEĞİLDİR.**
- **Kapsam:** sıklet (Runner.weight) 100.0% ; handikap puanı 95.0% (Haziran 2026'da yarısı eksik, eksik değer sıfır sayılmaz); H_SINIF_FARKI 94.4% (geçmiş 3 yarışın rakip hp'leri yalnız önbellekteki atlardan, ≥3 rakip); H_SIKLET_DEGISIMI (göreli) 99.5%; mutlak 99.5%. Bugünkü pist durumu (RaceDay.surfaceConditions) yalnız 33.9% yarışta var ve bunların çoğu 'Normal' → pist etkileşimi (WgZ) çok az varyansa sahip.
- **Apranti:** `Runner.apprentice` hiçbir kayıtta dolu değil (68.219 koşucuda 0) ve jokey adlarında işaret yok. **H_APRANTI_ETKI hesaplanamaz.** Kilo artığı (bölüm 1) apranti indirimi DEĞİLDİR: yaş/mesafe indirimleri, özel durumlar ve farklı taban kilo da aynı sapmayı üretir; apranti gerçek bayrak verisiyle (ör. programdaki işaret) ayrı toplanmalı.
- **Tanımlar (kullanıcı):** W_göreli = W − yarış ortalaması. H_SINIF = geçmiş 3 yarıştaki rakiplerin (o yarıştaki kendi hp'leri) hp ortalaması − bugünkü rakiplerin hp ortalaması. ΔW = bugünkü göreli kilo − geçmiş 3 yarıştaki göreli kilo ortalaması (mutlak kg sürümü ayrıca). Kilo artığı = W_göreli − 0,5·(hp − yarış hp ortalaması) (TJK: her handikap puanı için 0,5 kg). Pist: 'Normal'=0, diğer=1.
- Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama (neutral). **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]; ✓/○/✗ aralık sıfırın üstünde/içinde/altında; (+/−) = ΔLL işareti test yarışlarının 1./2. yarısında. **Protokol 1:** yalnız handikap yarışlarında 6 blok ileri-yönlü β. **Protokol 2 (galop):** galop kapsamlı tüm yarışlarda eğitim, handikap test yarışlarında değerlendirme (galop verisi Temmuz 2026'dan beri var; handikap-only galop dönemi çok küçük).
- Doğrulama: ACC, GALOP, J_SEVIYE, SON6, H2H için gelecek-bozma/bağımsız hesap testleri önceki raporlarda ve birim testlerinde geçmiştir (bu çalışmada yeniden koşulmadı). Geçmiş sıklet/hp/rakip alanları yalnız tarih < yarış günü satırlarından (as-of) hesaplanır. Yeni handikap özellikleri için ayrı vitest modülü yazılmadı (araç içi hesap); bağımsız yeniden hesap aşağıda.
- **Bağımsız yeniden hesap (düz döngü, ham önbellekten):** 120 ata karşı H_SINIF_FARKI ve H_SIKLET_DEGISIMI 0 uyuşmazlık.

## 1. Kilo, handikap puanı ve örtüşme
**Kilo artığı** (W_göreli − 0,5·ΔHP): p05 -3.1, p25 -1.2, medyan -0.0, p75 0.7, p95 3.6 kg. Kilo yarış içinde hp farkıyla neredeyse mekanik ilişkili: **r(W_göreli, hp) = 0.87**. Bu yüzden 'kilo' ile 'sınıf kalitesi' ayrıştırılmadan yorumlanamaz; kontrollü taban (hp dahil) ve kilo artığı (formülün ötesindeki sıklet) ayrı raporlandı.

| Özellik | r(ACC_HIZ) | r(GALOP) | r(J_SEVIYE) | r(SON6) | r(H2H) | r(hp) | r(son10 kazanma) | r(son10 ilk-3) | r(sınıf değişimi) | R² (B5+kontrol) |
|---|---|---|---|---|---|---|---|---|---|---|
| W_göreli | 0.24 | 0.07 | 0.25 | 0.28 | 0.26 | 0.87 | 0.17 | 0.23 | -0.19 | 0.747 |
| Kilo artığı | -0.25 | -0.05 | -0.10 | -0.30 | -0.19 | -0.73 | -0.23 | -0.33 | 0.18 | 0.582 |
| H_SINIF_FARKI | 0.05 | 0.03 | 0.08 | 0.09 | 0.11 | 0.57 | -0.05 | -0.04 | -0.30 | 0.395 |
| ΔW göreli | 0.20 | 0.05 | 0.20 | 0.23 | 0.23 | 0.68 | 0.13 | 0.12 | -0.22 | 0.452 |
| ΔW mutlak | 0.20 | 0.05 | 0.20 | 0.23 | 0.23 | 0.66 | 0.12 | 0.12 | -0.26 | 0.415 |
| Δhp | 0.28 | 0.04 | 0.13 | 0.25 | 0.26 | 0.08 | 0.31 | 0.29 | 0.14 | 0.234 |

## 2–3. Her aday: tek başına, ve mevcut sinyallerin üzerine ÖZGÜN katkı (handikap yarışları, test)
Test yarışı 1305; 1/N Top1 10.0%. B5 modeli: kazanç 7.61%, kontrollü (cB5) 8.23%.
| Aday | Tek başına ΔLL% (1/N'ye) | **B5 üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | **Kontrollü taban (cB5) üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | Tut. (kontrollü) |
|---|---|---|---|---|---|---|---|---|
| H_KILO_ETKI (β1: göreli kilo) | ○ 0.36% (+−) | ○ 0.12 [-0.01; 0.24] | 0.5 [-0.5; 1.4] | -0.2 [-1.0; 0.8] | ○ 0.23 [-0.04; 0.49] | 0.1 [-1.0; 1.0] | 0.3 [-1.0; 1.8] | ++ |
| H_KILO_ETKI (+ mesafe etkileşimi) | ✓ 0.41% (+−) | ✓ 0.14 [0.01; 0.28] | 0.3 [-0.6; 1.1] | 0.1 [-0.8; 1.0] | ○ 0.25 [-0.04; 0.54] | 0.3 [-0.8; 1.4] | 0.1 [-1.4; 1.5] | ++ |
| H_KILO_ETKI (+ mesafe + pist etkileşimi) | ○ 0.19% (+−) | ○ 0.00 [-0.43; 0.41] | 0.3 [-0.8; 1.4] | -0.2 [-1.4; 1.1] | ○ 0.12 [-0.37; 0.62] | 0.0 [-1.3; 1.2] | -0.2 [-1.8; 1.5] | ++ |
| Kilo artığı (handikap formülünden sapma) | ✓ 1.40% (++) | ○ 0.27 [-0.04; 0.58] | 0.1 [-1.0; 1.2] | 0.2 [-1.1; 1.6] | ✓ 0.28 [0.02; 0.52] | 0.2 [-0.8; 1.2] | 0.8 [-0.6; 2.0] | ++ |
| H_SINIF_FARKI | ○ -0.03% (−−) | ○ 0.13 [-0.01; 0.29] | 0.1 [-0.9; 1.0] | 0.2 [-0.7; 1.3] | ○ 0.03 [-0.00; 0.06] | -0.3 [-0.7; 0.1] | -0.1 [-0.5; 0.4] | ++ |
| H_SIKLET_DEGISIMI (göreli) | ○ 0.20% (+−) | ○ 0.11 [-0.03; 0.25] | -0.5 [-1.5; 0.5] | 0.3 [-0.6; 1.1] | ○ 0.13 [-0.03; 0.30] | -0.3 [-1.3; 0.7] | -0.1 [-1.2; 1.1] | ++ |
| H_SIKLET_DEGISIMI (mutlak kg) | ○ 0.22% (+−) | ○ 0.10 [-0.03; 0.22] | -0.5 [-1.5; 0.3] | 0.4 [-0.4; 1.2] | ○ 0.10 [-0.07; 0.25] | -0.3 [-1.4; 0.7] | 0.0 [-1.0; 0.9] | ++ |
| H_SIKLET_DEGISIMI + Δhp + Δmesafe | ✓ 2.47% (++) | ✓ 0.99 [0.57; 1.44] | 1.2 [-0.3; 2.8] | 2.1 [0.4; 3.7] | ✓ 0.72 [0.31; 1.12] | 0.5 [-1.0; 2.0] | 2.1 [0.5; 3.9] | ++ |
| Δhp (handikap puanı değişimi) TEK BAŞINA | ✓ 2.36% (++) | ✓ 0.71 [0.31; 1.10] | 0.1 [-1.5; 1.7] | 1.4 [-0.2; 2.9] | ✓ 0.42 [0.16; 0.70] | 0.3 [-1.0; 1.6] | 1.5 [0.2; 2.8] | ++ |
| Δmesafe (ln bugün/geçmiş) TEK BAŞINA | ○ 0.02% (+−) | ○ 0.17 [-0.02; 0.36] | 0.4 [-0.8; 1.5] | 0.2 [-1.1; 1.3] | ○ 0.17 [-0.06; 0.42] | -0.4 [-1.4; 0.6] | 0.6 [-0.7; 2.0] | ++ |
| ΔW göreli + Δhp | ✓ 2.47% (++) | ✓ 0.82 [0.44; 1.24] | 0.5 [-1.1; 2.1] | 1.3 [-0.3; 2.9] | ✓ 0.58 [0.25; 0.89] | 0.5 [-0.9; 2.1] | 1.6 [0.2; 3.1] | ++ |
| ΔW göreli + Δmesafe | ○ 0.21% (+−) | ✓ 0.30 [0.02; 0.56] | 0.4 [-0.8; 1.7] | 0.5 [-0.8; 1.8] | ✓ 0.31 [0.02; 0.60] | -0.3 [-1.5; 0.8] | 0.6 [-0.9; 1.9] | ++ |
| KİLO + SINIF birlikte | ✓ 0.63% (++) | ✓ 0.18 [0.01; 0.35] | 0.1 [-0.9; 1.1] | 0.3 [-0.8; 1.5] | ○ 0.25 [-0.03; 0.50] | 0.3 [-0.8; 1.4] | 0.3 [-1.1; 1.8] | ++ |
| KİLO + SINIF + SIKLET DEĞİŞİMİ | ○ 0.41% (+−) | ○ 0.02 [-0.38; 0.44] | -0.4 [-1.5; 0.9] | 0.2 [-1.1; 1.5] | ○ 0.08 [-0.43; 0.58] | 0.1 [-1.3; 1.4] | -0.5 [-2.2; 1.1] | ++ |

## 4. Alt gruplarda tutarlılık (kontrollü taban üzerine ΔLL%; n ≥ 150 'yeterli')
**Handikap sınıfı:**
| Aday | ? (n=3) | H13–14 (n=294) | H15–16 (n=813) | H17+ (n=195) |
|---|---|---|---|---|
| H_KILO_ETKI (β1) | — | ○ -0.40% (−−) | ✓ 0.40% (++) | ○ 0.45% (++) |
| H_KILO_ETKI (3 terim) | — | ○ -0.50% (−−) | ○ 0.37% (++) | ○ -0.04% (+−) |
| Kilo artığı | — | ○ -0.28% (−−) | ✓ 0.44% (++) | ○ 0.46% (++) |
| H_SINIF_FARKI | — | ○ 0.06% (++) | ○ 0.01% (−+) | ○ 0.05% (++) |
| H_SIKLET_DEGISIMI | — | ○ -0.30% (−+) | ✓ 0.27% (++) | ○ 0.16% (++) |
| ΔW+Δhp+Δmesafe | — | ○ 0.35% (−+) | ✓ 0.90% (++) | ○ 0.51% (−+) |
| Δhp tek başına | — | ○ 0.30% (++) | ✓ 0.52% (++) | ○ 0.18% (−+) |
| ΔW+Δhp | — | ○ -0.01% (−+) | ✓ 0.84% (++) | ○ 0.29% (−+) |
| KİLO+SINIF | — | ○ -0.42% (−−) | ✓ 0.45% (++) | ○ 0.36% (++) |
| KİLO+SINIF+SIKLET | — | ✗ -0.68% (−−) | ○ 0.34% (++) | ○ 0.03% (+−) |

**Mesafe:**
| Aday | kısa (≤1300) (n=260) | orta (1400–1900) (n=705) | uzun (≥2000) (n=340) |
|---|---|---|---|
| H_KILO_ETKI (β1) | ○ 0.15% (++) | ○ 0.28% (++) | ○ 0.20% (−+) |
| H_KILO_ETKI (3 terim) | ○ 0.27% (++) | ○ 0.23% (++) | ○ -0.24% (−−) |
| Kilo artığı | ○ 0.10% (++) | ○ 0.32% (++) | ○ 0.33% (++) |
| H_SINIF_FARKI | ○ 0.06% (++) | ○ 0.04% (++) | ○ -0.01% (−−) |
| H_SIKLET_DEGISIMI | ○ 0.24% (++) | ○ 0.13% (++) | ○ 0.03% (−+) |
| ΔW+Δhp+Δmesafe | ○ 0.37% (+−) | ✓ 1.09% (++) | ○ 0.20% (−+) |
| Δhp tek başına | ○ 0.19% (+−) | ✓ 0.66% (++) | ○ 0.09% (++) |
| ΔW+Δhp | ○ 0.48% (++) | ✓ 0.83% (++) | ○ 0.11% (−+) |
| KİLO+SINIF | ○ 0.15% (+−) | ○ 0.25% (++) | ○ 0.31% (−+) |
| KİLO+SINIF+SIKLET | ○ 0.32% (++) | ○ 0.15% (++) | ○ -0.30% (−−) |

**Pist durumu:**
| Aday | Normal (n=440) | Normal dışı (n=91) | pist durumu yok (n=774) |
|---|---|---|---|
| H_KILO_ETKI (β1) | ○ 0.12% (·+) | ✓ 0.73% (·+) (yetersiz n) | ○ 0.24% (++) |
| H_KILO_ETKI (3 terim) | ○ 0.25% (·+) | ○ -1.35% (·−) (yetersiz n) | ○ 0.22% (++) |
| Kilo artığı | ○ 0.09% (·+) | ○ 0.82% (·+) (yetersiz n) | ○ 0.33% (++) |
| H_SINIF_FARKI | ○ 0.04% (·+) | ○ 0.02% (·+) (yetersiz n) | ○ 0.02% (++) |
| H_SIKLET_DEGISIMI | ○ 0.02% (·+) | ✓ 0.70% (·+) (yetersiz n) | ○ 0.12% (++) |
| ΔW+Δhp+Δmesafe | ✓ 0.89% (·+) | ○ 0.49% (·+) (yetersiz n) | ✓ 0.65% (++) |
| Δhp tek başına | ✓ 0.59% (·+) | ○ -0.18% (·−) (yetersiz n) | ✓ 0.40% (++) |
| ΔW+Δhp | ✓ 0.63% (·+) | ○ 0.57% (·+) (yetersiz n) | ✓ 0.55% (++) |
| KİLO+SINIF | ○ 0.26% (·+) | ○ 0.53% (·+) (yetersiz n) | ○ 0.21% (++) |
| KİLO+SINIF+SIKLET | ○ 0.26% (·+) | ○ -1.32% (·−) (yetersiz n) | ○ 0.13% (++) |

**Saha büyüklüğü:**
| Aday | saha ≤9 (n=460) | saha ≥10 (n=845) |
|---|---|---|
| H_KILO_ETKI (β1) | ○ -0.04% (+−) | ✓ 0.35% (++) |
| H_KILO_ETKI (3 terim) | ○ -0.54% (+−) | ○ 0.41% (++) |
| Kilo artığı | ○ -0.04% (+−) | ✓ 0.42% (++) |
| H_SINIF_FARKI | ○ -0.02% (−−) | ✓ 0.05% (++) |
| H_SIKLET_DEGISIMI | ○ -0.16% (−−) | ✓ 0.25% (++) |
| ΔW+Δhp+Δmesafe | ○ 0.56% (++) | ✓ 0.79% (++) |
| Δhp tek başına | ✓ 0.60% (++) | ✓ 0.35% (++) |
| ΔW+Δhp | ○ 0.45% (++) | ✓ 0.63% (++) |
| KİLO+SINIF | ○ 0.01% (+−) | ✓ 0.35% (++) |
| KİLO+SINIF+SIKLET | ○ -0.67% (−−) | ○ 0.40% (++) |

**Zaman:**
| Aday | test 1. yarı (n=653) | test 2. yarı (n=652) |
|---|---|---|
| H_KILO_ETKI (β1) | ○ 0.19% (+·) | ○ 0.28% (·+) |
| H_KILO_ETKI (3 terim) | ○ 0.22% (+·) | ○ 0.03% (·+) |
| Kilo artığı | ○ 0.27% (+·) | ○ 0.29% (·+) |
| H_SINIF_FARKI | ○ 0.00% (+·) | ○ 0.06% (·+) |
| H_SIKLET_DEGISIMI | ○ 0.04% (+·) | ✓ 0.21% (·+) |
| ΔW+Δhp+Δmesafe | ○ 0.50% (+·) | ✓ 0.94% (·+) |
| Δhp tek başına | ✓ 0.34% (+·) | ✓ 0.51% (·+) |
| ΔW+Δhp | ○ 0.39% (+·) | ✓ 0.76% (·+) |
| KİLO+SINIF | ○ 0.20% (+·) | ○ 0.30% (·+) |
| KİLO+SINIF+SIKLET | ○ 0.12% (+·) | ○ 0.03% (·+) |

## 5. Galop ve jokey ile etkileşim (kontrollü taban + ana etki üzerine, yalnız etkileşim terimi)
Etkileşim = ana etkinin yarış-içi galop yüzdeliği (kap−0,5) veya jokey seviyesi (S − yarış ort.) ile çarpımı. Ana etki zaten modelde; ΔLL% yalnızca etkileşim terimini ölçer.
| Etkileşim | ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Tut. | B5 tabanında (kontrolsüz) ΔLL% |
|---|---|---|---|---|---|
| Kilo × GALOP_KAPASITE | ○ 0.00 [-0.10; 0.09] | -0.2 [-0.7; 0.4] | 0.2 [-0.4; 0.8] | −+ | ○ 0.00% (−+) |
| Kilo × J_SEVIYE | ○ 0.01 [-0.01; 0.03] | 0.2 [-0.2; 0.5] | -0.2 [-0.4; 0.0] | −+ | ○ 0.02% (−+) |
| H_SINIF × GALOP_KAPASITE | ○ 0.02 [-0.10; 0.12] | 0.4 [-0.2; 1.0] | 0.5 [0.1; 1.1] | −+ | ○ 0.02% (−+) |
| H_SINIF × J_SEVIYE | ○ -0.05 [-0.14; 0.05] | 0.2 [-0.4; 0.6] | 0.2 [-0.5; 0.8] | −− | ○ -0.05% (−−) |

## 6. GALOP_KAPASITE için özel Handikap testi (Protokol 2: galop kapsamlı yarışlar)
Galop kapsamlı 2064 yarışta (tüm tipler) eğitim; test yarışı 1720, bunların **Handikap'ı 467**. ΔLL% = (B5 − B4) yani GALOP_KAPASITE'nin ACC+J_SEVIYE+SON6+H2H üzerine katkısı. Alt gruplarda n küçük: aralık genişse 'değersiz' değil 'doğrulanamadı' anlamına gelir.
| Dilim | n yarış | GALOP katkısı ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Kontrollü ΔLL% [%95] | Tut. |
|---|---|---|---|---|---|---|
| Tüm tipler | 1720 | ✓ 0.43 [0.12; 0.75] | 1.1 [-0.2; 2.4] | -0.2 [-1.6; 1.3] | ✓ 0.42 [0.07; 0.72] | ++ |
| **Handikap (tümü)** | 467 | ○ -0.09 [-0.68; 0.51] | 0.9 [-1.5; 3.2] | -2.6 [-5.6; 0.0] | ○ -0.14 [-0.71; 0.47] | +− |
| Handikap · H13–14 (yetersiz n) | 99 | ○ 0.37 [-0.78; 1.54] | 2.0 [-2.0; 6.1] | -1.0 [-7.1; 5.1] | ○ 0.39 [-0.77; 1.52] | −+ |
| Handikap · H15–16 | 282 | ○ -0.15 [-0.97; 0.67] | 1.4 [-1.4; 4.3] | -2.5 [-6.0; 0.7] | ○ -0.27 [-1.09; 0.50] | −− |
| Handikap · H17+ (yetersiz n) | 86 | ○ -0.43 [-2.05; 1.09] | -2.3 [-8.1; 3.5] | -4.7 [-10.5; 1.2] | ○ -0.33 [-1.72; 1.24] | +− |
| Handikap · kısa (≤1300) (yetersiz n) | 106 | ○ 0.15 [-1.13; 1.38] | 1.9 [-1.9; 5.7] | -2.8 [-8.5; 2.8] | ○ 0.05 [-1.28; 1.24] | −+ |
| Handikap · orta (1400–1900) | 245 | ○ 0.11 [-0.71; 0.93] | 2.9 [0.0; 6.1] | -1.6 [-4.9; 2.0] | ○ 0.12 [-0.74; 0.87] | +− |
| Handikap · uzun (≥2000) (yetersiz n) | 116 | ○ -0.76 [-1.95; 0.43] | -4.3 [-9.5; 0.9] | -4.3 [-10.3; 1.7] | ○ -0.89 [-2.10; 0.35] | −− |
| Handikap · Normal | 313 | ○ 0.19 [-0.54; 0.88] | 0.3 [-2.6; 3.2] | -1.3 [-4.8; 1.9] | ○ 0.13 [-0.61; 0.83] | ++ |
| Handikap · Normal dışı (yetersiz n) | 66 | ○ -0.11 [-1.95; 1.68] | 6.1 [0.0; 13.6] | -3.0 [-9.1; 3.0] | ○ -0.09 [-1.79; 1.57] | ·− |
| Handikap · pist durumu yok (yetersiz n) | 88 | ○ -1.06 [-2.53; 0.36] | -1.1 [-5.7; 2.3] | -6.8 [-12.5; -1.1] | ○ -1.10 [-2.58; 0.25] | ·− |
| Handikap · saha ≤9 | 170 | ○ 0.32 [-0.77; 1.43] | 1.8 [-2.9; 6.5] | -1.8 [-5.9; 2.4] | ○ 0.28 [-0.78; 1.31] | ++ |
| Handikap · saha ≥10 | 297 | ○ -0.28 [-1.02; 0.51] | 0.3 [-2.0; 2.7] | -3.0 [-6.4; 0.3] | ○ -0.33 [-1.00; 0.37] | +− |
| Maiden (karşılaştırma) | 365 | ✓ 0.93 [0.21; 1.58] | 0.8 [-2.2; 3.8] | 1.6 [-1.4; 4.9] | ✓ 0.87 [0.18; 1.52] | ++ |
| Şartlı (karşılaştırma) | 547 | ✓ 0.68 [0.12; 1.23] | 1.5 [-1.1; 4.4] | 2.2 [-0.2; 4.9] | ✓ 0.68 [0.10; 1.29] | ++ |
| KV (karşılaştırma) | 220 | ○ 0.29 [-0.77; 1.28] | 2.3 [-1.4; 6.4] | -1.8 [-6.4; 2.7] | ○ 0.33 [-0.67; 1.31] | −+ |

**Kilo ve galop etkileşimi (handikap test yarışları; B5 modeli üzerine):**
| Karşılaştırma | n | ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Tut. |
|---|---|---|---|---|---|
| Kilo ana etkisi (G1+W − G1) | 467 | ○ 0.43 [-0.10; 1.03] | 0.9 [-1.7; 3.6] | 2.6 [0.0; 5.1] | ++ |
| **Kilo × GALOP etkileşimi** (G1+W+IWK − G1+W) | 467 | ○ -0.06 [-0.26; 0.15] | -0.4 [-1.7; 0.9] | 0.2 [-1.7; 2.1] | +− |
| Kilo × J_SEVIYE (G1+W+IWJ − G1+W) | 467 | ○ 0.02 [-0.21; 0.24] | 0.2 [-1.3; 1.7] | -2.1 [-3.9; -0.6] | ++ |
| Kontrollü: kilo × GALOP | 467 | ○ -0.07 [-0.28; 0.12] | -0.9 [-2.1; 0.4] | -0.2 [-1.3; 0.9] | +− |
| H_SINIF × GALOP (G1+HS+IHK − G1+HS) | 467 | ○ -0.02 [-0.07; 0.03] | 0.0 [-0.6; 0.6] | 0.4 [-0.6; 1.5] | +− |

**Betimleyici: ağır/hafif kilo × iyi/zayıf galop** (handikap test yarışları; beklenti = GALOPSUZ model G0'ın olasılığı; z = (kazanan − ΣP)/√ΣP(1−P)). 'Ağır' = yarış medyanından fazla kilo; 'iyi galop' = GALOP_KAPASITE yüzdeliği ≥ 0,5.
| Kilo | Galop | n at | Kazanan | Beklenen (G0) | z |
|---|---|---|---|---|---|
| ağır | iyi galop (≥0,5) | 994 | 96 | 111.4 | -1.59 |
| ağır | zayıf galop (<0,5) | 794 | 73 | 86.9 | -1.62 |
| ağır | galopsuz | 282 | 18 | 28.4 | -2.10 |
| hafif | iyi galop (≥0,5) | 1408 | 161 | 120.8 | 3.91 |
| hafif | zayıf galop (<0,5) | 1250 | 93 | 93.3 | -0.04 |
| hafif | galopsuz | 392 | 26 | 26.1 | -0.03 |

## Sınırlar ve dürüst notlar
- **Veri:** apranti işareti yok (H_APRANTI_ETKI yapılamadı); bugünkü pist durumu çoğu handikap yarışında bilinmiyor ve çoğu 'Normal' (pist etkileşimi ölçülemez); rakiplerin geçmiş hp/sıkleti yalnız önbellekteki atlardan geliyor (kapsam kısmi); Haziran 2026 hp eksikleri sıfır sayılmadı. Handikap yarışları ~1.500; alt gruplar (özellikle H17+, uzun mesafe, Normal dışı pist) çok küçüktür.
- **Kilo/hp ilişkisi mekaniktir** (TJK her handikap puanı için 0,5 kg): kilonun etkisi hp ile ayrıştırılamıyorsa 'etki var/yok' diyemeyiz. Kontrollü taban (hp dahil) ve kilo artığı bu yüzden yan yana verildi; artığın içinde yaş/mesafe indirimleri ve apranti indirimi karışıktır.
- Etkileşimler doğrusal-logit içinde tek çarpım terimidir; mesafe ve zemin etkisi için bilimsel literatürün sınırlı olduğu varsayımı korunur. Çoklu karşılaştırma düzeltilmedi; tek hücredeki ✓/✗ kanıt sayılmaz. Katsayılar ölçü cihazının (ileri-yönlü β) çıktısıdır, sinyal ağırlığı kararı değildir.
- GALOP için 'değersiz' veya 'değerli' hükmü verilmedi: alt gruplardaki geniş aralıklar doğrulanamadığını gösterir.