# J_SEVIYE DOĞRULAMASI — sınıf, handikap puanı ve geçmiş performans kontrol edilince katkı sürüyor mu?
**Yeni motora sinyal eklenmedi; katsayı/ağırlık belirlenmedi; `SINYAL_KAYDI` boş.** Kontrol değişkenleri (aşağıda) **sinyal adayı DEĞİLDİR**; yalnız J_SEVIYE'nin at kalitesini ikinci kez puanlayıp puanlamadığını sınamak için modele konur.

## 0. Yöntem ve DÜRÜST ÇERÇEVE
- **Soru:** (ACC_HIZ + GALOP_KAPASITE) tabanında J_SEVIYE'nin ek katkısı, atın **sınıf değişimi**, **handikap puanı** ve **geçmiş performansı** modele KONTROL olarak girince de sürüyor mu? Anahtar karşılaştırma **MCS − MC** (kontrollere rağmen J_SEVIYE'nin ek katkısı); kontrolsüz karşılaştırma **MS − M0**.
- **Kontroller (yarış öncesi, tarih < yarış günü; bildirilen tanımlar, öğrenilmedi):** **handikap puanı** = programdaki `hp` (yarış-içi nötr doldurma; /20 ölçek); **geçmiş performans** = atın son ≤10 yarışında (TJK geçmiş önbelleği) **kazanma** ve **ilk-3** oranları, Laplace düzeltmeli (1+k)/(2+n); **sınıf değişimi** = bugünkü yarışın sınıf sırası − atın son 3 yarışının sınıf sırası ortalaması (Maiden 1 · Şartlı/Satış 2 · Handikap/KV 3 · Grup 4; /2 ölçek). Yarışın kendi sınıfı aynı yarıştaki tüm atlar için ortak olduğundan ana etki olarak yarış-içi modelde etkisizdir; bu yüzden **atın kendi sınıf geçmişine göre farkı** kullanıldı.
- **ÖRNEKLEM A** = /admin/kosu-tipleri (1510 yarış, 1259 test): bu yarışlar yeni-motor adaylarının seçiminde (ACC_HIZ, GALOP, KOSU_STILI, TEMPO, JOKEY) **defalarca kullanıldı → aşağıdaki A sonuçları BAĞIMSIZ NİHAİ DOĞRULAMA DEĞİLDİR.** **ÖRNEKLEM B** = 01.07–15.08.2026 (Karma hariç tüm sonuçlu yarışlar): yeni-motor adaylarının seçiminde kullanılmamış dönem; ama (i) galop kaydı yalnız Temmuz'dan itibaren var (Şubat–Haziran yok), bu yüzden Nisan–Haziran alınamadı, (ii) jokey referansı kısa (Ocak başlangıçlı), (iii) küçük. B, "daha az kullanılmış" bir kontrol örneğidir, gerçek ileriye dönük (gelecek yarışlarda dondurulmuş tanımla) bir doğrulamanın yerine geçmez.
- **Veri düzeltmesi (açık beyan):** TJK geçmiş önbelleğinde tarihler **GG.AA.YYYY** biçimindedir. Önceki galop/Accurace araçlarımda önbellek ISO (YYYY-AA-GG) ile ayrıştırıldığı için **eşleşme hiç olmadı** ve "önceki koşu tarihi kendi kayıtlarımız + TJK geçmişi" dediğim yerde yalnız kendi kayıtlarımız kullanıldı. Bu araçta ayrıştırma düzeltildi: popülasyon A'da **15487** at-yarıştan **118 (0.8%)** önceki-koşu tarihi geçmiş önbelleği eklenince DEĞİŞTİ. Etki yalnız atın son koşusundan sonraki galop penceresinde (özellikle uzun aradan dönenlerde); önceki raporlar bu hatayla üretildi, ama sonuç yönleri bu fark oranının küçüklüğü nedeniyle değişmesi beklenmez (yeniden üretilmedi).
- Ölçü cihazı: ileri-genişleyen 6 blok; β'lar YALNIZ geçmiş bloklardan (ridge 0.02); eksik puan yarış ortalamasına (nötr); yön varsayımı yok. ΔLL: pozitif = iyileşme; Top1/Top3 farkı puan; köşeli parantez eşleştirilmiş bootstrap %95 (1000).

## 1. Örneklem A — /admin/kosu-tipleri (TEKRAR KULLANILMIŞ; bağımsız nihai doğrulama DEĞİL)
> **Uyarı:** bu 1259 test yarışı model kararlarında defalarca kullanıldı; sonuç, kararları destekleyen tekrarlı bir kontroldür, bağımsız doğrulama değildir.
Yarış 1510, test yarışı 1259. Kapsam (at payı): ACC_HIZ 83.2% | GALOP 83.0% | handikap puanı 85.8% | geçmiş performans 94.9% | sınıf değişimi 94.8% | J_SEVIYE 99.6%.

| Ölçüm | Log-loss | ΔLL (taban 1/N − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|
| M0. ACC_HIZ + GALOP_KAPASITE (taban) | 2.1362 | 0.1534 [0.1200; 0.1872] | 21.2% (10.7%) | 52.4% (32.0%) | 3.67/1.49 ; 4.07/1.92 ; 3.90/1.66 ; 3.75/1.61 ; 3.63/1.49 |
| MC. M0 + kontroller (sınıf değişimi, handikap puanı, geçmiş performans) | 2.0568 | 0.2327 [0.1994; 0.2651] | 25.9% (10.7%) | 58.4% (32.0%) | 2.64/1.43/0.32/0.86/1.66/-0.21 ; 3.04/1.83/0.40/0.85/1.47/-0.24 ; 2.85/1.60/0.50/0.74/1.45/-0.24 ; 2.65/1.55/0.58/0.75/1.41/-0.27 ; 2.53/1.44/0.56/0.97/1.45/-0.34 |
| MS. M0 + J_SEVIYE | 2.0763 | 0.2133 [0.1801; 0.2480] | 23.0% (10.7%) | 57.8% (32.0%) | 3.18/1.35/0.54 ; 3.66/1.77/0.51 ; 3.45/1.47/0.55 ; 3.26/1.40/0.63 ; 3.13/1.29/0.64 |
| MCS. M0 + kontroller + J_SEVIYE | 2.0231 | 0.2665 [0.2290; 0.3048] | 26.0% (10.7%) | 60.0% (32.0%) | 2.44/1.32/0.24/0.92/1.39/-0.13/0.45 ; 2.87/1.72/0.34/0.76/1.27/-0.19/0.42 ; 2.66/1.45/0.44/0.62/1.22/-0.17/0.45 ; 2.46/1.38/0.50/0.61/1.14/-0.19/0.51 ; 2.33/1.28/0.49/0.84/1.17/-0.27/0.52 |
| MCS30. M0 + kontroller + J_SEVIYE (yalnız N_ref ≥ 30 jokey) | 2.0247 | 0.2649 [0.2279; 0.3042] | 26.2% (10.7%) | 60.0% (32.0%) | 2.43/1.31/0.24/0.91/1.38/-0.14/0.47 ; 2.87/1.71/0.34/0.76/1.27/-0.19/0.42 ; 2.66/1.45/0.44/0.62/1.22/-0.18/0.45 ; 2.46/1.38/0.50/0.61/1.15/-0.19/0.52 ; 2.33/1.28/0.49/0.85/1.17/-0.27/0.52 |

**J_SEVIYE ek katkısı** (ΔLL pozitif = iyileşme; Top1/Top3 puan):
| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| J_SEVIYE → taban (kontrolsüz) | 1259 | 0.0599 [0.0438; 0.0758] | 1.80 [-0.32; 3.83] | 5.47 [2.86; 7.89] |
| **J_SEVIYE → taban + kontroller (KONTROLLÜ; anahtar satır)** | 1259 | 0.0338 [0.0208; 0.0472] | 0.09 [-1.79; 1.99] | 1.64 [-0.24; 3.83] |
| J_SEVIYE (yalnız N_ref≥30 jokey) → taban + kontroller | 1259 | 0.0322 [0.0199; 0.0453] | 0.33 [-1.55; 2.48] | 1.56 [-0.46; 3.44] |
| Kontroller → taban (J_SEVIYE'siz) | 1259 | 0.0793 [0.0607; 0.0988] | 4.73 [2.54; 7.11] | 6.05 [3.59; 8.50] |
| Kontroller → taban + J_SEVIYE | 1259 | 0.0532 [0.0367; 0.0677] | 3.02 [1.19; 5.00] | 2.22 [0.32; 4.37] |

**Sönümlenme:** J_SEVIYE'nin ΔLL katkısı kontrolsüz 0.0599 → kontrollü 0.0338 (oran %56). Oran %100'e yakınsa katkı at kalitesi kontrolleriyle açıklanmıyor; sıfıra yakınsa büyük ölçüde at kalitesini yansıtıyor.

**Koşu tipine göre (kontrollü katkı MCS − MC):**
| Koşu tipi | Test yarışı | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| Maiden | 256 | 0.0245 [-0.0028; 0.0510] | -1.95 [-5.86; 2.34] | -1.95 [-5.86; 1.95] |
| Şartlı | 411 | 0.0472 [0.0256; 0.0701] | 1.99 [-1.95; 5.76] | 2.60 [-0.97; 5.80] |
| Handikap | 352 | 0.0276 [0.0029; 0.0540] | -0.85 [-4.55; 2.84] | 3.98 [0.00; 7.95] |
| KV | 155 | 0.0290 [-0.0046; 0.0591] | 1.94 [-3.87; 7.74] | 1.94 [-4.52; 8.39] |
| Grup | 48 | 0.0304 [-0.0230; 0.0832] | 2.08 [-6.25; 10.42] | -4.17 [-14.58; 6.25] |
| Satış | 35 | 0.0378 [-0.0402; 0.1194] | -8.57 [-22.86; 5.71] | 0.00 [-11.43; 11.43] |
| Handikap puanı atların ≥%70'inde olan yarışlar | 1010 | 0.0311 [0.0174; 0.0455] | 0.50 [-1.68; 2.77] | 1.49 [-0.59; 3.66] |

**J_SEVIYE ile kontrollerin yarış-içi korelasyonu:** handikap puanı 0.29 (n 13115) · geçmiş kazanma oranı 0.17 (n 14627) · geçmiş ilk-3 oranı 0.29 (n 14627) · sınıf değişimi -0.09 (n 14635) · ACC_HIZ 0.27 (n 12748) · GALOP_KAPASITE 0.10 (n 12759).

## 2. Örneklem B — 01.07–15.08.2026 (yeni-motor adayları için daha az kullanılmış dönem)
> **Not:** galop yalnız Temmuz'dan itibaren var; dönem kısa; jokey referansı Ocak'tan; yine geriye dönük (retrospektif) bir örneklemdir.
Yarış 829, test yarışı 691. Kapsam (at payı): ACC_HIZ 82.2% | GALOP 80.2% | handikap puanı 83.5% | geçmiş performans 93.5% | sınıf değişimi 93.4% | J_SEVIYE 97.8%.

| Ölçüm | Log-loss | ΔLL (taban 1/N − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|
| M0. ACC_HIZ + GALOP_KAPASITE (taban) | 2.1252 | 0.1090 [0.0698; 0.1447] | 19.6% (11.3%) | 49.7% (33.8%) | 2.88/1.25 ; 2.81/1.15 ; 2.99/1.29 ; 3.19/1.16 ; 3.07/1.01 |
| MC. M0 + kontroller (sınıf değişimi, handikap puanı, geçmiş performans) | 2.0681 | 0.1661 [0.1213; 0.2136] | 23.3% (11.3%) | 55.8% (33.8%) | 1.46/1.27/0.76/-0.83/2.71/-0.38 ; 1.50/1.15/0.64/-0.23/2.22/-0.18 ; 1.72/1.25/0.66/0.54/1.76/-0.27 ; 1.93/1.09/0.51/0.42/1.96/-0.41 ; 1.75/0.96/0.56/0.68/1.89/-0.30 |
| MS. M0 + J_SEVIYE | 2.0927 | 0.1415 [0.1041; 0.1768] | 22.9% (11.3%) | 54.6% (33.8%) | 2.67/1.12/0.30 ; 2.59/1.07/0.34 ; 2.75/1.18/0.33 ; 2.89/1.02/0.37 ; 2.75/0.88/0.38 |
| MCS. M0 + kontroller + J_SEVIYE | 2.0489 | 0.1853 [0.1402; 0.2329] | 23.6% (11.3%) | 56.9% (33.8%) | 1.40/1.22/0.74/-0.83/2.59/-0.36/0.16 ; 1.42/1.10/0.62/-0.28/2.09/-0.17/0.25 ; 1.63/1.18/0.63/0.51/1.65/-0.25/0.24 ; 1.80/0.99/0.48/0.40/1.82/-0.38/0.28 ; 1.62/0.88/0.52/0.64/1.76/-0.26/0.29 |
| MCS30. M0 + kontroller + J_SEVIYE (yalnız N_ref ≥ 30 jokey) | 2.0490 | 0.1852 [0.1356; 0.2305] | 23.7% (11.3%) | 57.7% (33.8%) | 1.41/1.22/0.73/-0.85/2.58/-0.34/0.26 ; 1.43/1.11/0.61/-0.28/2.09/-0.15/0.33 ; 1.63/1.17/0.63/0.51/1.64/-0.24/0.31 ; 1.81/0.99/0.47/0.40/1.82/-0.38/0.33 ; 1.63/0.87/0.51/0.65/1.75/-0.26/0.32 |

**J_SEVIYE ek katkısı** (ΔLL pozitif = iyileşme; Top1/Top3 puan):
| Karşılaştırma | Yarış | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| J_SEVIYE → taban (kontrolsüz) | 691 | 0.0325 [0.0171; 0.0479] | 3.24 [0.65; 5.70] | 4.83 [1.79; 7.61] |
| **J_SEVIYE → taban + kontroller (KONTROLLÜ; anahtar satır)** | 691 | 0.0193 [0.0083; 0.0297] | 0.27 [-1.90; 2.32] | 1.06 [-1.13; 3.25] |
| J_SEVIYE (yalnız N_ref≥30 jokey) → taban + kontroller | 691 | 0.0191 [0.0064; 0.0311] | 0.42 [-2.04; 3.02] | 1.93 [-0.38; 4.39] |
| Kontroller → taban (J_SEVIYE'siz) | 691 | 0.0571 [0.0259; 0.0912] | 3.69 [0.72; 6.73] | 6.08 [2.97; 9.77] |
| Kontroller → taban + J_SEVIYE | 691 | 0.0439 [0.0148; 0.0734] | 0.72 [-2.46; 3.91] | 2.32 [-0.87; 5.35] |

**Sönümlenme:** J_SEVIYE'nin ΔLL katkısı kontrolsüz 0.0325 → kontrollü 0.0193 (oran %59). Oran %100'e yakınsa katkı at kalitesi kontrolleriyle açıklanmıyor; sıfıra yakınsa büyük ölçüde at kalitesini yansıtıyor.

**Koşu tipine göre (kontrollü katkı MCS − MC):**
| Koşu tipi | Test yarışı | ΔLL [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| Maiden | 131 | 0.0185 [-0.0054; 0.0423] | -0.76 [-5.34; 3.82] | 0.00 [-3.82; 4.58] |
| Şartlı | 231 | 0.0174 [-0.0026; 0.0386] | 1.69 [-2.64; 5.63] | 3.18 [-0.89; 7.25] |
| Handikap | 199 | 0.0210 [0.0020; 0.0398] | 0.00 [-3.52; 4.02] | -1.01 [-4.52; 3.02] |
| KV | 80 | 0.0134 [-0.0197; 0.0495] | 1.25 [-3.75; 6.25] | 2.50 [-3.75; 10.00] |
| Grup | 24 (AZ ÖRNEK) | 0.0570 [-0.0171; 0.1404] | -4.17 [-20.83; 12.50] | 0.00 [0.00; 0.00] |
| Satış | 25 (AZ ÖRNEK) | 0.0110 [-0.0460; 0.0684] | -4.00 [-12.00; 0.00] | 0.00 [-12.00; 12.00] |
| Handikap puanı atların ≥%70'inde olan yarışlar | 544 | 0.0147 [0.0028; 0.0273] | 0.00 [-2.39; 2.39] | 0.00 [-2.02; 2.21] |

**J_SEVIYE ile kontrollerin yarış-içi korelasyonu:** handikap puanı 0.26 (n 6556) · geçmiş kazanma oranı 0.12 (n 7459) · geçmiş ilk-3 oranı 0.24 (n 7459) · sınıf değişimi -0.08 (n 7462) · ACC_HIZ 0.25 (n 6510) · GALOP_KAPASITE 0.09 (n 6333).

## Sınırlar
- Hiçbir örneklem GERÇEK ileriye dönük doğrulama değildir. Bağımsız doğrulama için tanımları (ACC_HIZ, GALOP_KAPASITE, J_SEVIYE) **dondurup**, bundan sonraki yarışlarda biriken sonuçlarla ölçmek gerekir.
- Kontroller kusurludur: handikap puanı yalnız handikap ağırlıklı yarışlarda yaygındır (Maiden'de %59); geçmiş performans TJK geçmiş önbelleğine bağlıdır (sonradan güncellenmiş olabilir, yalnız yarış gününden önceki satırlar kullanıldı); sınıf sırası kaba bir 4 basamaklı ölçektir. Kontrol edilemeyen faktörler (kilo, kulvar, antrenör, saha, pist durumu) hâlâ jokey seviyesiyle karışık olabilir. Bu yüzden "sönümlenme yok" bile jokey becerisinin KANITI olmaz, yalnız bu kontrollerle açıklanmadığını gösterir.
- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. Çoklu karşılaştırma düzeltilmedi. Bu test seçim yapmaz; hiçbir formül/ağırlık değiştirilmedi.