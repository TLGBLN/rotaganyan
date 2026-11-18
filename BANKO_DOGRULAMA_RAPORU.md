# BANKO araştırması — model (altı bileşen) vs AGF referansı (kronolojik geriye dönük test)
**Aktif sinyal 0; üretim/canlı motor/kupon değişikliği YOK.** SON6 ve AGF modele GİRMEZ; AGF yalnız ayrı referanstır.

## 0. Düzenek ve DÜRÜSTLÜK NOTU
- **Bu, bağımsız ileri-yönlü doğrulama DEĞİLDİR.** Elimizdeki tüm yarışlar (2026-01-01→11-17) sinyal seçimi aşamasında kullanıldı. Aşağıdaki test, **kronolojik geriye dönük simülasyondur**: her aylık kat (Ağu, Eyl, Eki, Kas 2026) için eğitim YALNIZ o aydan önceki yarışlardır; ancak sinyallerin kendisi aynı dönemin verisiyle seçildiği için sonuçlar iyimser olabilir. Gerçek ileri-yönlü doğrulama ayrı izlenecektir (dondurma 2026-11-18; sonuçlanan yeni yarışlar).
- **Model:** F6 = ACC_HIZ, GALOP_KAPASITE, J_SEVIYE, H2H_NET (H_180_3), Y_son, T_son; yarış-içi koşullu logit, ridge 0,02, eksik → yarış-içi ortalama. **Şartlı 1/27 yarışlarında ayrı model, yalnız J_SEVIYE + GALOP** (eğitim yalnız o sınıfın önceki yarışlarından). **SON6 yok. AGF yok.**
- **Her kat için (eşikler/kalibrasyon TEST'e bakılmadan):** eğitim = kattan önceki tüm yarışlar; ilk %75'inde β, son %25'inde **sıcaklık (τ) kalibrasyonu ve banko eşikleri**. Test yarışları kat içindedir; β eğitimin ilk %75'inden alınır (tutarlı eşik için). Belirsizlik: β'nın 15 önyükleme (yeniden örnekleme) modelinden birinci adayın olasılığı ve birinci−ikinci fark için standart sapma (sd).
- **Banko kuralları (önceden bildirildi, sonuca göre değiştirilmedi):** R1: p1 (olasılık); R2: p1 − p2 (fark); R3: p1 alt güven sınırı (p1 − sd); R4: fark alt güven sınırı ((p1−p2) − sd). Eşik = eğitimin kalibrasyon kesiminde skorun üst %q kuantili; **q ∈ {%5, %10, %20} üçü de raporlanır, hiçbiri seçilmedi.** Alt güven sınırı çarpanı 1 (sabit). Banko = modelin birinci adayı.
- **Net getiri:** her banko için 1 birim ganyan (kazanırsa Result.ganyan − 1, kaybederse −1); aynı bütçe (birim başına). **Altılı/çoklu ayak kuponu simüle EDİLMEDİ**; ganyan oranı olmayan yarışlar getiri hesabından çıkarıldı (hedef sayıları belirtilir).
- **AGF referansı:** AGF = yarış başlangıcından KESİN önceki son kesitin piyasa payı; AGF favorisi = en yüksek paylı at. AGF banko seçimi, modelin banko SAYISI kadar (her seçim kapsamında) AGF'nin kendi güvenine göre (favori payı veya favori−ikinci farkı) en yüksek yarışlardır. AGF değerlendirmesi yalnız AGF'si olan yarışlarda yapılır; model aynı yarışlarda da raporlanır.

## 1. Katlar
- 2026-08: eğitim 3350 (β: 2512; kalibrasyon/eşik: 838), test 569; τ=0.72; eşikler R3 %5/10/20: 0.325 / 0.287 / 0.251
- 2026-09: eğitim 3919 (β: 2939; kalibrasyon/eşik: 980), test 516; τ=0.98; eşikler R3 %5/10/20: 0.393 / 0.346 / 0.301
- 2026-10: eğitim 4435 (β: 3326; kalibrasyon/eşik: 1109), test 572; τ=1.04; eşikler R3 %5/10/20: 0.395 / 0.367 / 0.313
- 2026-11: eğitim 5007 (β: 3755; kalibrasyon/eşik: 1252), test 301; τ=1.08; eşikler R3 %5/10/20: 0.418 / 0.373 / 0.312

Test yarışı toplam 1958; AGF'li 1938; Şartlı 1/27 ayrı model yarışı 82. Ganyan oranı olan 1958.

## 2. Top1 / Top3 (tüm test yarışları ve AGF'li alt küme)
| Küme | n | Model Top1 [%95] | AGF Top1 [%95] | Rastgele Top1 | Model Top3 [%95] | AGF Top3 [%95] | Rastgele Top3 |
|---|---|---|---|---|---|---|---|
| Tüm test yarışları | 1958 | 24.9% [23.0; 27.0] | 32.5% [30.4; 34.6] | 10.9% | 56.0% [54.0; 58.2] | 65.2% [63.1; 67.4] | 32.6% |
| AGF'li yarışlar | 1938 | 24.8% [22.9; 26.8] | 32.8% [30.4; 34.7] | 10.8% | 55.8% [53.6; 57.7] | 65.8% [63.7; 68.2] | 32.5% |

**Olasılık kalitesi (AGF'li yarışlar, log-loss; küçük = iyi):** model 2.0742; AGF 1.8607; rastgele 2.2728. (Model AGF'yi görmez.)

**Model kalibrasyonu (test; birinci adayın tahmini olasılığı vs gerçekleşme):**
| p1 aralığı | n yarış | Ort. tahmin p1 | Gerçek isabet % |
|---|---|---|---|
| 0.00–0.15 | 172 | 13.3% | 16.9% |
| 0.15–0.20 | 463 | 17.7% | 19.2% |
| 0.20–0.25 | 485 | 22.5% | 22.1% |
| 0.25–0.30 | 388 | 27.3% | 26.3% |
| 0.30–0.40 | 341 | 34.1% | 33.7% |
| 0.40–1.00 | 109 | 46.6% | 42.2% |

## 3. BANKO sonuçları (eşikler eğitim kalibrasyon kesiminden; kapsam açıkça raporlanır)
Kapsam = test yarışlarının banko verilen payı. 'Seçilmeyen' = banko verilmeyen yarışlarda birinci adayın isabeti (kapsam azaltılarak başarının şişirilmediğini görmek için). Aynı kuralın tüm q değerleri raporlanır.
### R1: p1 (olasılık)
| q | Banko sayısı (kapsam) | Banko isabeti [%95] | Seçilmeyen isabeti | Net getiri / banko [%95] | Genel Top1 |
|---|---|---|---|---|---|
| %5 | 95 (%4.9) | 41.1% [31.6; 50.5] | 24.1% | -0.27 [-0.45; -0.06] (n=95) | 24.9% |
| %10 | 195 (%10.0) | 37.9% [30.8; 44.1] | 23.5% | -0.23 [-0.40; -0.07] (n=195) | 24.9% |
| %20 | 368 (%18.8) | 36.4% [31.3; 41.3] | 22.3% | -0.17 [-0.31; -0.03] (n=368) | 24.9% |

### R2: p1 − p2 (fark)
| q | Banko sayısı (kapsam) | Banko isabeti [%95] | Seçilmeyen isabeti | Net getiri / banko [%95] | Genel Top1 |
|---|---|---|---|---|---|
| %5 | 80 (%4.1) | 38.8% [28.7; 48.8] | 24.3% | -0.40 [-0.58; -0.23] (n=80) | 24.9% |
| %10 | 179 (%9.1) | 33.5% [25.7; 40.8] | 24.1% | -0.35 [-0.52; -0.18] (n=179) | 24.9% |
| %20 | 376 (%19.2) | 32.4% [28.2; 37.2] | 23.1% | -0.31 [-0.41; -0.19] (n=376) | 24.9% |

### R3: p1 alt güven sınırı (p1 − sd)
| q | Banko sayısı (kapsam) | Banko isabeti [%95] | Seçilmeyen isabeti | Net getiri / banko [%95] | Genel Top1 |
|---|---|---|---|---|---|
| %5 | 88 (%4.5) | 43.2% [34.1; 53.4] | 24.1% | -0.22 [-0.42; 0.00] (n=88) | 24.9% |
| %10 | 180 (%9.2) | 40.0% [33.3; 47.2] | 23.4% | -0.23 [-0.38; -0.05] (n=180) | 24.9% |
| %20 | 353 (%18.0) | 36.8% [32.3; 41.9] | 22.3% | -0.20 [-0.34; -0.07] (n=353) | 24.9% |

### R4: fark alt güven sınırı ((p1−p2) − sd)
| q | Banko sayısı (kapsam) | Banko isabeti [%95] | Seçilmeyen isabeti | Net getiri / banko [%95] | Genel Top1 |
|---|---|---|---|---|---|
| %5 | 79 (%4.0) | 43.0% [31.6; 53.2] | 24.2% | -0.30 [-0.50; -0.11] (n=79) | 24.9% |
| %10 | 165 (%8.4) | 38.8% [32.7; 47.9] | 23.6% | -0.25 [-0.41; -0.05] (n=165) | 24.9% |
| %20 | 349 (%17.8) | 34.4% [29.2; 39.5] | 22.9% | -0.30 [-0.42; -0.18] (n=349) | 24.9% |

## 4. AGF referansıyla karşılaştırma (AGF'li yarışlar; AGF aynı SAYIDA banko seçer)
AGF banko iki biçimde: **AGF-pay** (en yüksek AGF favori payı) ve **AGF-fark** (favori−ikinci pay farkı). Fark sütunu model − AGF (yüzde puan / net getiri), yarış kümesi bootstrap aralığı.
### R1: p1 (olasılık)
| q | Banko sayısı | Model isabet | AGF-pay isabet | AGF-fark isabet | Model net getiri | AGF-pay net getiri | AGF-fark net getiri | İsabet farkı (model − AGF-pay) [%95] | Getiri farkı (model − AGF-pay) [%95] |
|---|---|---|---|---|---|---|---|---|---|
| %5 | 93 (%4.8) | 39.8% | 65.6% | 63.4% | -0.29 | -0.19 | -0.21 | -25.8 [-39.0; -13.6] | -0.10 [-0.34; 0.11] |
| %10 | 193 (%10.0) | 37.3% | 57.0% | 57.5% | -0.24 | -0.24 | -0.23 | -19.7 [-27.1; -11.4] | 0.00 [-0.17; 0.19] |
| %20 | 364 (%18.8) | 36.0% | 52.2% | 49.2% | -0.18 | -0.24 | -0.29 | -16.2 [-22.1; -10.7] | 0.06 [-0.09; 0.21] |

### R2: p1 − p2 (fark)
| q | Banko sayısı | Model isabet | AGF-pay isabet | AGF-fark isabet | Model net getiri | AGF-pay net getiri | AGF-fark net getiri | İsabet farkı (model − AGF-pay) [%95] | Getiri farkı (model − AGF-pay) [%95] |
|---|---|---|---|---|---|---|---|---|---|
| %5 | 78 (%4.0) | 37.2% | 66.7% | 69.2% | -0.42 | -0.18 | -0.14 | -29.5 [-43.2; -14.9] | -0.24 [-0.44; -0.03] |
| %10 | 177 (%9.1) | 32.8% | 56.5% | 57.6% | -0.36 | -0.26 | -0.24 | -23.7 [-32.8; -16.9] | -0.10 [-0.27; 0.05] |
| %20 | 373 (%19.2) | 32.2% | 52.0% | 49.1% | -0.31 | -0.24 | -0.29 | -19.8 [-25.1; -14.3] | -0.08 [-0.19; 0.05] |

### R3: p1 alt güven sınırı (p1 − sd)
| q | Banko sayısı | Model isabet | AGF-pay isabet | AGF-fark isabet | Model net getiri | AGF-pay net getiri | AGF-fark net getiri | İsabet farkı (model − AGF-pay) [%95] | Getiri farkı (model − AGF-pay) [%95] |
|---|---|---|---|---|---|---|---|---|---|
| %5 | 86 (%4.4) | 41.9% | 66.3% | 66.3% | -0.24 | -0.19 | -0.18 | -24.4 [-37.0; -11.0] | -0.05 [-0.29; 0.19] |
| %10 | 178 (%9.2) | 39.3% | 56.7% | 57.9% | -0.23 | -0.25 | -0.24 | -17.4 [-26.4; -8.4] | 0.02 [-0.16; 0.19] |
| %20 | 350 (%18.1) | 36.3% | 52.9% | 49.1% | -0.22 | -0.24 | -0.30 | -16.6 [-21.6; -10.5] | 0.02 [-0.10; 0.18] |

### R4: fark alt güven sınırı ((p1−p2) − sd)
| q | Banko sayısı | Model isabet | AGF-pay isabet | AGF-fark isabet | Model net getiri | AGF-pay net getiri | AGF-fark net getiri | İsabet farkı (model − AGF-pay) [%95] | Getiri farkı (model − AGF-pay) [%95] |
|---|---|---|---|---|---|---|---|---|---|
| %5 | 77 (%4.0) | 41.6% | 67.5% | 68.8% | -0.32 | -0.17 | -0.15 | -26.0 [-41.1; -12.3] | -0.14 [-0.35; 0.09] |
| %10 | 163 (%8.4) | 38.0% | 58.3% | 56.4% | -0.26 | -0.24 | -0.27 | -20.2 [-28.5; -11.9] | -0.02 [-0.18; 0.17] |
| %20 | 344 (%17.8) | 34.0% | 52.6% | 49.1% | -0.30 | -0.24 | -0.30 | -18.6 [-24.9; -12.3] | -0.06 [-0.20; 0.08] |

## 5. Banko kapsamı ve isabeti — yarış tipine göre (R3: p1 alt güven sınırı, q=%10)
| Tip | Test yarışı | Banko | Kapsam | Banko isabeti | Genel Top1 | Net getiri / banko |
|---|---|---|---|---|---|---|
| Maiden | 393 | 28 | %7.1 | 57.1% | 25.7% | -0.04 |
| Şartlı 3/4/5 | 492 | 71 | %14.4 | 38.0% | 25.2% | -0.27 |
| Şartlı 1/27 (J+GALOP modeli) | 82 | 0 | %0.0 | — | 29.3% | — |
| Handikap | 548 | 34 | %6.2 | 29.4% | 21.2% | -0.38 |
| KV | 239 | 32 | %13.4 | 34.4% | 26.4% | -0.19 |
| Grup + Satış | 124 | 10 | %8.1 | 70.0% | 32.3% | 0.20 |

## 6. Eğitilmiş model (≤ 2026-11-17; yalnız rapor — ÜRETİME ALINMADI)
| Bileşen | Ana model β (ölçekli birim) |
|---|---|
| ACC_HIZ | 2.282 |
| GALOP_KAPASITE | 1.142 |
| J_SEVIYE | 0.304 |
| H2H_NET | 0.533 |
| Y_son | 0.629 |
| T_son | 0.474 |
| Şartlı 1/27 modeli: J_SEVIYE, GALOP | 0.538, 2.958 |
Katlara göre sıcaklık (τ>1 daha keskin, <1 daha düz): 2026-08: 0.72, 2026-09: 0.98, 2026-10: 1.04, 2026-11: 1.08.

## Sınırlar ve dürüst notlar
- **İyimserlik:** sinyal seçimi aynı dönemin verisiyle yapıldı; bu kronolojik test bağımsız doğrulama değildir. Test katları küçüktür (ay başına ~300–570 yarış); banko alt kümeleri (q=%5 → ~100 yarış) için aralıklar geniştir.
- **Banko sayısı yapay azaltılmadı:** q kapsam düzeyleri önceden bildirildi ve üçü de raporlandı; 'seçilmeyen yarış' isabeti ve kapsam açıkça verildi.
- **Net getiri ganyan tabanlıdır** (1 birim/banko); altılı ganyan veya çoklu ayak kupon bütçesi simüle edilmedi. Ganyan oranı olmayan yarışlar getiriden çıkarıldı. Piyasa oranları (ganyan) yarış sonrası belirlendiği için gerçek bahis oranı değişebilir.
- **AGF** altılı ganyan favorisi yüzdesidir (kapanışa yakın piyasa görüşü; son kesit medyan ~1 saat önce), gerçek oran değildir. AGF modele girmez; yalnız referanstır.
- Doğrusal-logit varsayımı, ortak β (Şartlı 1/27 hariç), çoklu karşılaştırma (3 q × 4 kural) düzeltilmedi; tek hücreye değil kural/kapsam örüntüsüne bakın.