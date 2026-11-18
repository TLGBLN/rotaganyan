# DELTA_HP — Handikap yarışları için aday sinyal araştırması (aktif sinyal DEĞİL; `SINYAL_KAYDI` boş)
**KEŞİF (A/B/C dönemi, tekrar kullanıldı): NİHAİ DOĞRULAMA DEĞİLDİR.**

## 0. Tanım ve dondurulan düzenek
- **ΔHP v1 = HP_bugün − HP_önceki_yarış** (kullanıcı tanımı). HP_bugün programda ilan edilen puan; HP_önceki, atın hedef gününden KESİN önceki en son yarışındaki puan. **Önceki yarışın HP'si yoksa NULL** (eski bir yarışa sessizce geri gidilmez, sıfır sayılmaz). Pozitif ΔHP otomatik avantaj değildir. **Yalnız Handikap yarışlarında değerlendirilir.**
- **Önceden bildirilmiş duyarlılıklar (hiçbiri seçilmedi):** ΔHP son BİLİNEN HP'ye göre; Δhp son 3 satır (yarış-sonrası puan) ortalamasına göre (önceki raporun tanımı; hizalama farklıdır); yükseliş/düşüş ayrı eğim; beş sabit sınıf (≤−3 / −2…−1 / 0 / +1…+2 / ≥+3 puan; 0 referans). Sonuçlara göre yeni formül seçilmedi.
- **Taban B5:** ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, SON6, H2H_NET (H_180_3). **Kontrollü taban cB5:** B5 + hp, son 10 yarış kazanma/ilk-3 oranı, sınıf değişimi. Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş log-loss)/(1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap 1000]; ✓/○/✗ aralık sıfırın üstünde/içinde/altında; (+/−) test yarışlarının 1./2. yarısında ΔLL işareti.
- **Örneklem:** 1566 handikap yarışı (2026-01-02→2026-11-17). Keşif: 6 blok ileri-yönlü β; test 1305 yarış.
- **Giriş verisi kaynağı denetimi (kritik):** Runner.hp (programdaki puan) ile atın BİR ÖNCEKİ önbellek satırının hp'si 16293 at-yarışta **%99.2 aynı** (farklı 124; fark medyanı -3.0); AYNI yarışın önbellek satırıyla ise yalnız %58.6 (n=15433). **Sonuç: önbellek satırındaki hp, o yarıştan SONRA atanan puandır; yarışa taşınan puan bir önceki satırın hp'sidir.** Bu yüzden her kayıtta yarış-zamanı HP = bir önceki satırın hp'si alınmıştır. (İlk çalıştırmada bu hizalama yapılmamıştı: ΔHP %99,2 sıfır çıkmıştı; o sonuç geçersizdir ve atılmıştır.) Yarışa taşınan puan ve bugünkü puan, hedef yarıştan önce bilinir (as-of).
- Birim testleri: `delta-hp-aday.test.ts` (formül, NULL kuralı, as-of, gelecek-bozma/sızıntı, bağımsız düz-döngü, saflık) vitest'te geçiyor.

## 1. Kapsam ve dağılım
- ΔHP v1 olan at: 93.4%; son BİLİNEN HP'ye göre 93.4%; 3 yarış ortalamasına göre 94.6%. Bugünkü hp yok: 5.0%.
- Dağılım (puan): p05 -2, p25 0, medyan 0, p75 0, p95 7. Değişmeyen (0): %60.3; yükselen: %23.2; düşen: %16.6. Önceki yarışla arası medyan 14 gün.

## 2. Örtüşme: ΔHP mevcut sinyallerle ve geçmiş formla
Yarış içi merkezlenmiş Pearson r; **R² = ΔHP'nin listelenen değişkenlerle doğrusal açıklanabilen payı.**
| Değişken | r(ΔHP v1) |
|---|---|
| SON6 | 0.21 |
| ACC_HIZ | 0.23 |
| J_SEVIYE | 0.10 |
| H2H_NET | 0.23 |
| GALOP_KAPASITE | 0.03 |
| hp (bugünkü puan) | 0.05 |
| son 10 yarış kazanma oranı | 0.28 |
| son 10 yarış ilk-3 oranı | 0.23 |
| sınıf değişimi | 0.15 |
| önceki yarışta kazandı (0/1) | 0.78 |
| önceki yarışta ilk 3 (0/1) | 0.60 |
| önceki yarış bitiş sırası | -0.53 |
| göreli kilo (W_göreli) | 0.02 |
| ΔW göreli | 0.04 |
| Δhp (3 yarış ort.) | 0.90 |

**R²:** B5'in beş sinyaliyle 0.091; B5 + kontrollerle (hp, form, sınıf) 0.172; yalnız SON6+ACC_HIZ+J_SEVIYE ile 0.057.

**Önceki yarıştaki sonuca göre ortalama ΔHP** (ΔHP'nin 'form göstergesi' olup olmadığını görmek için):
| Önceki yarış | n at | Ort. ΔHP | Medyan |
|---|---|---|---|
| kazandı | 1590 | 7.62 | 7.0 |
| 2.–3. | 3059 | 1.39 | 1.0 |
| 4. ve sonrası | 11369 | -0.47 | 0.0 |

## 3. Beş sinyalli taban üzerine ek katkı (yalnız Handikap yarışları)
Test yarışı 1305. B5: kazanç 7.61%, Top1 21.8%, Top3 51.2%; kontrollü cB5: 8.23%.
| Aday | Tek başına ΔLL% | **B5 üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | **cB5 üzerine ΔLL% [%95]** | ΔTop1 p | ΔTop3 p | Tut. |
|---|---|---|---|---|---|---|---|---|
| **ΔHP v1** (HP_bugün − önceki yarışın HP'si) | ✓ 1.68% (++) | ✓ 0.57 [0.22; 0.92] | 0.2 [-1.4; 1.7] | 1.1 [-0.4; 2.6] | ✓ 0.37 [0.13; 0.61] | 0.8 [-0.5; 1.9] | 1.1 [0.0; 2.4] | ++ |
| ΔHP son BİLİNEN HP'ye göre (duyarlılık) | ✓ 1.68% (++) | ✓ 0.57 [0.24; 0.95] | 0.2 [-1.4; 1.5] | 1.1 [-0.3; 2.7] | ✓ 0.37 [0.13; 0.62] | 0.8 [-0.5; 2.0] | 1.1 [0.0; 2.5] | ++ |
| Δhp son 3 yarış ortalamasına göre (önceki testteki tanım) | ✓ 2.36% (++) | ✓ 0.71 [0.33; 1.10] | 0.1 [-1.5; 1.6] | 1.4 [-0.2; 2.9] | ✓ 0.42 [0.17; 0.70] | 0.3 [-0.9; 1.5] | 1.5 [0.2; 2.7] | ++ |
| ΔHP yükseliş / düşüş AYRI eğim | ✓ 2.40% (++) | ✓ 0.69 [0.37; 1.06] | 0.4 [-1.1; 1.8] | 1.7 [0.2; 3.1] | ✓ 0.45 [0.20; 0.71] | 0.8 [-0.4; 1.9] | 1.4 [0.2; 2.6] | ++ |
| ΔHP beş sabit sınıf (≤−3 / −2…−1 / 0 / +1…+2 / ≥+3) | ✓ 3.60% (++) | ✓ 0.84 [0.38; 1.29] | 0.9 [-0.7; 2.6] | 1.8 [0.3; 3.7] | ✓ 0.58 [0.19; 0.94] | 0.2 [-1.4; 1.7] | 2.0 [0.4; 3.7] | ++ |

**Yükseliş ve düşüş ayrı eğimle mi, tek doğrusal terimle mi?** (ΔLL%, ayrı − tek):
| Karşılaştırma | B5 üzerine ΔLL% [%95] | cB5 üzerine ΔLL% [%95] |
|---|---|---|
| Ayrı eğim − tek terim | ✓ 0.11 [0.02; 0.21] | ✓ 0.09 [0.01; 0.17] |
| Beş sınıf − tek terim | ○ 0.27 [-0.02; 0.54] | ○ 0.21 [-0.04; 0.49] |

**ÖNCEKİ YARIŞ SONUCUNA göre kontrollü ek test (kritik):** ΔHP büyük ölçüde 'önceki yarışı kazandı mı' bilgisini taşıyor (bölüm 2). cR = cB5 + önceki yarışta kazandı (0/1) + önceki yarışta ilk 3 (0/1). Aşağıda ΔHP'nin BU bilgiler modeldeyken ek katkısı:
| Dilim | cR üzerine ΔHP tek terim ΔLL% [%95] | ΔTop1 p | ΔTop3 p | cR üzerine yükseliş/düşüş ayrı ΔLL% [%95] | Tut. |
|---|---|---|---|---|---|
| Handikap (tümü) | ○ 0.00 [-0.09; 0.10] | 0.0 [-0.7; 0.7] | -0.4 [-1.1; 0.3] | ○ 0.09 [-0.05; 0.22] | −+ |
| H15–16 | ○ 0.00 [-0.10; 0.11] | 0.2 [-0.6; 1.1] | -0.4 [-1.2; 0.5] | ○ 0.12 [-0.03; 0.26] | −+ |
(cR'nin cB5 üzerine katkısı: ✓ 0.71% (++).)

## 4. Alt gruplar (ΔHP v1, ΔLL%; H15–16 ayrıca; n ≥ 150 'yeterli')
| Dilim | n yarış | B5 üzerine ΔLL% [%95] | ΔTop1 p | ΔTop3 p | cB5 üzerine ΔLL% [%95] | ΔTop1 p | ΔTop3 p | Tut. |
|---|---|---|---|---|---|---|---|---|
| Handikap (tümü) | 1305 | ✓ 0.57 [0.24; 0.93] | 0.2 [-1.3; 1.7] | 1.1 [-0.2; 2.6] | ✓ 0.37 [0.10; 0.61] | 0.8 [-0.5; 1.9] | 1.1 [0.0; 2.4] | ++ |
| **H15–16** | 813 | ✓ 0.75 [0.29; 1.20] | 0.4 [-1.5; 2.2] | 1.6 [-0.2; 3.6] | ✓ 0.47 [0.17; 0.76] | 1.0 [-0.5; 2.3] | 1.5 [0.0; 3.2] | ++ |
| Handikap sınıfı: H13–14 | 294 | ○ 0.21 [-0.45; 0.90] | -0.7 [-3.4; 2.0] | -1.7 [-4.4; 1.0] | ○ 0.30 [-0.18; 0.84] | 0.7 [-1.7; 3.1] | 1.4 [-0.7; 3.7] | ++ |
| Handikap sınıfı: H17+ | 195 | ○ 0.38 [-0.56; 1.37] | 0.5 [-4.6; 6.2] | 3.6 [-0.5; 7.2] | ○ 0.00 [-0.67; 0.74] | 0.0 [-4.1; 4.1] | 0.0 [-2.6; 3.1] | −+ |
| Mesafe: kısa (≤1300) | 260 | ○ 0.62 [-0.13; 1.44] | 0.4 [-2.7; 3.5] | 0.0 [-3.1; 3.1] | ○ 0.29 [-0.25; 0.90] | 1.2 [-1.5; 3.8] | 1.2 [-1.2; 3.8] | ++ |
| Mesafe: orta (1400–1900) | 705 | ✓ 0.67 [0.23; 1.09] | 0.1 [-1.8; 2.3] | 1.8 [0.0; 3.7] | ✓ 0.50 [0.17; 0.82] | 0.3 [-1.4; 1.8] | 1.7 [0.1; 3.4] | ++ |
| Mesafe: uzun (≥2000) | 340 | ○ 0.33 [-0.36; 1.03] | 0.0 [-2.9; 3.5] | 0.6 [-2.6; 4.1] | ○ 0.14 [-0.37; 0.62] | 1.5 [-0.9; 4.1] | 0.0 [-2.6; 2.6] | ++ |
| Saha büyüklüğü: saha ≤9 | 460 | ✓ 1.06 [0.39; 1.82] | 1.1 [-1.3; 3.7] | 0.4 [-2.2; 3.3] | ✓ 0.69 [0.21; 1.21] | 1.7 [-0.4; 4.1] | 1.3 [-0.9; 3.5] | ++ |
| Saha büyüklüğü: saha ≥10 | 845 | ○ 0.36 [-0.02; 0.77] | -0.4 [-2.2; 1.5] | 1.5 [-0.1; 3.2] | ○ 0.22 [-0.03; 0.52] | 0.2 [-1.3; 1.7] | 1.1 [-0.4; 2.6] | ++ |
| Zaman: test 1. yarı | 653 | ○ 0.41 [-0.06; 0.88] | -0.6 [-2.5; 1.4] | 1.5 [-0.5; 3.7] | ○ 0.27 [-0.03; 0.61] | 1.2 [-0.3; 2.8] | 0.9 [-0.5; 2.3] | +· |
| Zaman: test 2. yarı | 652 | ✓ 0.74 [0.19; 1.27] | 0.9 [-1.2; 3.2] | 0.8 [-1.2; 2.9] | ✓ 0.46 [0.08; 0.84] | 0.3 [-1.7; 2.1] | 1.4 [-0.5; 3.5] | ·+ |

## 5. ΔHP sınıflarına göre kazanma (beklenti: ΔHP'siz model; ileri-yönlü β, test yarışları)
z = (kazanan − ΣP)/√ΣP(1−P). ΔHP, tabanın ötesinde bilgi taşıyorsa yükselenlerde/düşenlerde sistematik z ≠ 0 beklenir. Çok sayıda hücre var, düzeltme yok. Yükseliş ve düşüşün aynı yönde mi ters yönde mi etki ettiği buradan okunur; **formül seçmek için kullanılmadı.**
**Tüm handikap test yarışları**
| ΔHP sınıfı | n at | Kazanan | Beklenen B5 | z (B5) | Beklenen cB5 | z (cB5) |
|---|---|---|---|---|---|---|
| ≤ −3 | 181 | 5 | 7.6 | -0.99 | 7.2 | -0.86 |
| −2…−1 | 1965 | 70 | 97.3 | -2.89 | 89.8 | -2.17 |
| 0 (değişmedi) | 8088 | 623 | 690.7 | -2.76 | 672.8 | -2.06 |
| +1…+2 | 1335 | 207 | 172.4 | 2.89 | 169.9 | 3.15 |
| ≥ +3 | 1771 | 294 | 237.2 | 4.08 | 255.7 | 2.68 |
| ΔHP yok | 1072 | 106 | 99.7 | 0.68 | 109.6 | -0.38 |

**H15–16**
| ΔHP sınıfı | n at | Kazanan | Beklenen B5 | z (B5) | Beklenen cB5 | z (cB5) |
|---|---|---|---|---|---|---|
| ≤ −3 | 131 | 3 | 4.9 | -0.87 | 4.6 | -0.76 |
| −2…−1 | 1305 | 41 | 65.3 | -3.13 | 59.8 | -2.52 |
| 0 (değişmedi) | 5009 | 370 | 419.8 | -2.61 | 411.0 | -2.17 |
| +1…+2 | 841 | 138 | 110.6 | 2.87 | 108.3 | 3.15 |
| ≥ +3 | 1131 | 198 | 155.0 | 3.83 | 166.9 | 2.70 |
| ΔHP yok | 627 | 63 | 57.4 | 0.79 | 62.5 | 0.07 |

## Sınırlar ve dürüst notlar
- **Keşif sonucudur.** Bu dönem (A/B/C) daha önce kullanıldığı için sonuçlar nihai doğrulama sayılmaz; parametreler ve yöntem dondurulmuştur, sonraki yarışlarla `--after` modunda kronolojik doğrulama yapılacaktır.
- ΔHP'nin yönü yorumlanmadı: yükseliş yakın dönem başarısını, düşüş daha uygun bir seviyeye gelmeyi gösterebilir; bu test nedensel yorum yapmaz. ΔHP SON6, geçmiş form ve hp ile örtüşebilir (bölüm 2); özgün katkı yalnız bölüm 3'teki cB5 üzerine satırlarından okunmalıdır.
- Ölçü cihazı doğrusal-logit; ΔHP'nin hp düzeyiyle (örn. üst gruptaki atlar) etkileşimi ölçülmedi. H_APRANTI_ETKI, kilo artığı ve diğer handikap adayları bu raporun konusu değildir.