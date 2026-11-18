# GALOP kalitesi — yeniden inceleme (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)
Kullanıcı gözlemi: galop her yarış tipinde faydalı olmalı. Önceki testlerde GALOP_KAPASITE küçük çıktı; bu rapor bunun **veri kapsamından mı, tanımdan mı, gerçekten küçük etkiden mi** kaynaklandığını ayırmaya çalışır. **Yeni formül/sinyal önerilmedi ve hiçbir parametre sonuca göre seçilmedi**; yalnız mevcut tanım (GALOP_KAPASITE = hız, kapanış, efor yüzdeliklerinin ortalaması; her biri o yarışta atlar arası yüzdelik) farklı koşullarda ölçüldü, bileşenleri ayrı gösterildi.

## 0. Düzenek
- **Galop kapsamlı yarış** = atlarının ≥%70'inde yarış-öncesi (tarih < yarış günü; atın son koşusundan sonraki galoplar) GALOP_KAPASITE hesaplanabilen yarış. Bu, yarıştan ÖNCE bilinen bir koşuldur (sonuca bağlı değil). Eşik önceden belirlendi, sonuca göre ayarlanmadı.
- **Örneklem S:** galop kapsamlı 2064 yarış (2026-07-01 → 2026-11-17), tek kronolojik havuz, 6 blokluk ileri-yönlü β (yalnız önceki bloklardan). Tüm yarışlar 5309. **S, A ve B olarak tekrar kullanılan dönemle örtüşür; bağımsız/ileri-yönlü doğrulama değildir.**
- Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş model log-loss)/(rastgele 1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]; ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ altında; 'Tut.' = ΔLL işareti test yarışlarının 1. ve 2. yarısında.
- **B5** = ACC_HIZ + J_SEVIYE + SON6 + H2H_NET (H_180_3, seçim değil) + ANT_SEVIYE (galopsuz beş sinyal); **B6** = B5 + GALOP_KAPASITE. Kontrollü (c) = hp, geçmiş performans, sınıf değişimi eklenmiş.
- Doğrulama: H2H ızgarası gelecek-bozma testi GEÇTİ; ANT GEÇTİ; bağımsız yeniden hesap H2H 0/80, ANT 0/150. GALOP'un as-of/sızıntı testleri birim testlerinde (galop-aday.test.ts).

## 1. Neden önceki testlerde etkisi küçük göründü? — kapsam
Galop kaydı yılın başında seyrek, sonlara doğru dolu (referans grupları ≥30 galop gerektirdiği için ilk aylarda ayrıca hesaplanamıyor). Eksik değer yarış-içi ortalamayla doldurulduğundan, kapsamı düşük dönemlerin eklenmesi β'yı ve görünen katkıyı **seyreltir**.
| Ay | Galop kaydı (galop tarihine göre) | Yarış | At kapsamı (GALOP_KAPASITE) | Galop kapsamlı yarış payı |
|---|---|---|---|---|
| 2026-01 | 78 | 353 | 0.7% | 0.0% |
| 2026-02 | 75 | 414 | 0.1% | 0.0% |
| 2026-03 | 206 | 481 | 0.0% | 0.0% |
| 2026-04 | 301 | 516 | 0.1% | 0.0% |
| 2026-05 | 775 | 562 | 0.6% | 0.0% |
| 2026-06 | 3781 | 473 | 1.7% | 0.0% |
| 2026-07 | 11240 | 552 | 78.6% | 77.0% |
| 2026-08 | 12778 | 569 | 84.3% | 84.0% |
| 2026-09 | 11228 | 516 | 83.8% | 85.1% |
| 2026-10 | 10986 | 572 | 83.1% | 83.6% |
| 2026-11 | 3500 | 301 | 81.7% | 81.1% |

- **Ham galop kaydı:** 75543; kabul edilen 73229 (%96.9); reddedilen nedenler: sure-yok 2146, mesafe<400 111, hiz-makul-degil 36, sure-monoton-degil 21. Tekilleştirme sonrası 55208 kayıt.
- **Kapsamlı yarışlarda** at kapsamı 87.9%; atın son galopundan yarışa kadar medyan 2 gün; son koşudan sonraki galop sayısı medyan 2.

## 2. Seyreltme kontrolü: aynı model, galop kapsamlı ve kapsamsız yarışlarda ayrı
**TÜM yarışlar** (kapsamsız dahil) üzerinde 6 blok ileri-yönlü β ile B5 ve B6 eğitildi; test yarışları galop kapsamlı / kapsamsız diye ayrı değerlendirildi. Aynı modelde galop katkısı kapsamlı yarışlarda belirgin farklıysa, önceki küçük sonuç büyük ölçüde kapsam seyreltmesidir.
| Test dilimi | n yarış | ΔLL% (B6 − B5) [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|---|
| Tümü | 4424 | ✗ -0.41 [-0.61; -0.21] | -0.36 [-1.02; 0.29] | -0.57 [-1.27; 0.16] | −− |
| Galop kapsamlı yarışlar | 2064 | ✗ -0.80 [-1.20; -0.39] | -0.58 [-1.89; 0.63] | -1.41 [-2.76; -0.05] | −− |
| Galop kapsamsız yarışlar | 2360 | ○ -0.08 [-0.24; 0.08] | -0.17 [-0.64; 0.30] | 0.17 [-0.34; 0.72] | −− |

## 3. Galop kapsamlı yarışlarda katkı (tüm test yarışları)
Test yarışı 1720; rastgele (1/N) Top1 10.9%, Top3 32.8%.
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| GALOP_KAPASITE tek başına (1/N'ye karşı) (G − 1N) | ✓ 0.89 [0.47; 1.32] | 4.28 [2.77; 6.05] | 7.88 [5.71; 10.17] | ++ |
| ACC_HIZ tek başına (1/N'ye karşı) (ACC − 1N) | ✓ 5.58 [4.67; 6.52] | 9.96 [7.93; 11.88] | 17.71 [15.58; 19.87] | ++ |
| GALOP, ACC_HIZ üzerine (ACC+G − ACC) | ✓ 0.69 [0.29; 1.09] | 1.42 [-0.17; 2.93] | 0.79 [-1.00; 2.50] | ++ |
| **GALOP_KAPASITE, B5 üzerine (kapsamlı yarışlar)** (B6 − B5) | ✓ 0.40 [0.08; 0.71] | 0.35 [-0.87; 1.57] | -0.06 [-1.45; 1.40] | ++ |
|   hız bileşeni, B5 üzerine (B5+kH − B5) | ○ 0.22 [-0.04; 0.46] | 0.12 [-1.10; 1.34] | 0.23 [-1.10; 1.63] | ++ |
|   kapanış bileşeni, B5 üzerine (B5+kK − B5) | ○ 0.05 [-0.07; 0.17] | 0.12 [-0.87; 1.05] | -0.06 [-0.93; 0.87] | +− |
|   efor bileşeni, B5 üzerine (B5+kE − B5) | ○ 0.09 [-0.03; 0.21] | -0.29 [-1.05; 0.41] | -0.29 [-1.16; 0.52] | −+ |
|   üç bileşen ayrı ayrı (B8), B6 üzerine (ayrıştırmak ek katıyor mu?) (B8 − B6) | ○ -0.01 [-0.12; 0.11] | 0.00 [-0.81; 0.93] | 0.06 [-0.76; 0.87] | −+ |
| GALOP_KAPASITE, kontrollü B5 üzerine (c6 − c5) | ✓ 0.39 [0.08; 0.71] | 0.29 [-0.93; 1.57] | 1.63 [0.12; 3.08] | ++ |
|   hız, kontrollü (c5+kH − c5) | ○ 0.24 [-0.04; 0.52] | 0.52 [-0.76; 1.74] | 1.16 [-0.17; 2.56] | ++ |
|   kapanış, kontrollü (c5+kK − c5) | ○ 0.03 [-0.07; 0.14] | -0.06 [-0.87; 0.76] | 0.81 [-0.06; 1.69] | +− |
|   efor, kontrollü (c5+kE − c5) | ○ 0.08 [-0.04; 0.21] | -0.06 [-0.81; 0.64] | 0.35 [-0.47; 1.16] | −+ |

**Model düzeyleri:**
| Model | Kazanç % | Top1 % | Top3 % |
|---|---|---|---|
| G | 0.89% | 15.2% | 40.7% |
| ACC | 5.58% | 20.9% | 50.5% |
| ACC+G | 6.27% | 22.3% | 51.3% |
| B5 | 11.24% | 25.9% | 59.7% |
| B6 | 11.65% | 26.2% | 59.7% |
| B5+kH | 11.46% | 26.0% | 59.9% |
| B5+kK | 11.29% | 26.0% | 59.7% |
| B5+kE | 11.33% | 25.6% | 59.4% |
| B8 | 11.64% | 26.2% | 59.7% |
| c5 | 12.36% | 27.2% | 59.7% |
| c6 | 12.75% | 27.5% | 61.3% |
| c5+kH | 12.60% | 27.7% | 60.9% |
| c5+kK | 12.39% | 27.2% | 60.5% |
| c5+kE | 12.44% | 27.2% | 60.1% |

**Örtüşme (yarış-içi merkezlenmiş r; kapsamlı yarışlar):**
| Sinyal | r(ACC_HIZ) | r(J_SEVIYE) | r(SON6) | r(H2H) | R² (B5 ile) |
|---|---|---|---|---|---|
| GALOP_KAPASITE | 0.07 | 0.09 | 0.10 | 0.03 | 0.011 |
| hız yüzdeliği | 0.03 | 0.08 | 0.03 | 0.01 | 0.005 |
| kapanış yüzdeliği | 0.04 | 0.03 | 0.05 | 0.01 | 0.002 |
| efor yüzdeliği | 0.07 | 0.06 | 0.10 | 0.05 | 0.011 |

## 4. Yarış tipine göre (galop kapsamlı yarışlar; n ≥ 150 'yeterli')
Hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti). β tüm tiplerde ortak.
| Karşılaştırma | Tümü (n=1720) | Maiden (n=365) | Şartlı (n=547) | Handikap (n=467) | KV (n=220) | Grup (n=69, yetersiz) | Satış (n=50, yetersiz) | Diğer (n=2, yetersiz) |
|---|---|---|---|---|---|---|---|---|
| **GALOP_KAPASITE → B5** | ✓ 0.40% (++) | ✓ 0.91% (++) | ✓ 0.65% (++) | ○ -0.13% (+−) | ○ 0.23% (−+) | ○ 0.30% (−+) | ○ -0.21% (··) | ○ 1.36% (··) |
| hız → B5 | ○ 0.22% (++) | ✓ 0.58% (++) | ○ 0.14% (−+) | ○ 0.00% (−+) | ○ 0.35% (++) | ○ 0.02% (−+) | ○ 0.20% (··) | ○ 1.75% (··) |
| kapanış → B5 | ○ 0.05% (+−) | ○ 0.12% (−+) | ✓ 0.26% (++) | ✗ -0.27% (+−) | ○ 0.04% (−+) | ○ 0.22% (−+) | ○ 0.02% (··) | ✗ -0.13% (··) |
| efor → B5 | ○ 0.09% (−+) | ○ 0.26% (−+) | ○ 0.08% (+−) | ○ 0.16% (++) | ○ -0.13% (−+) | ○ -0.18% (−−) | ○ -0.52% (··) | ✓ 0.04% (··) |
| GALOP_KAPASITE → c5 (kontrollü) | ✓ 0.39% (++) | ✓ 0.85% (++) | ✓ 0.65% (++) | ○ -0.16% (−−) | ○ 0.29% (−+) | ○ 0.27% (−+) | ○ -0.05% (··) | ○ 1.04% (··) |
| GALOP → ACC_HIZ | ✓ 0.69% (++) | ✓ 1.42% (++) | ✓ 1.04% (++) | ○ -0.08% (+−) | ○ 0.52% (−+) | ○ 0.28% (−+) | ○ 0.07% (··) | ○ 0.78% (··) |

**GALOP_KAPASITE → B5 tip başına ayrıntı:**
| Tip | n | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] |
|---|---|---|---|---|
| Tümü | 1720 | 0.40 [0.07; 0.73] | 0.35 [-0.93; 1.69] | -0.06 [-1.51; 1.28] |
| Maiden | 365 | 0.91 [0.22; 1.60] | 0.00 [-2.74; 3.01] | 0.00 [-3.29; 3.29] |
| Şartlı | 547 | 0.65 [0.07; 1.19] | 1.65 [-0.73; 3.84] | 1.46 [-1.10; 3.84] |
| Handikap | 467 | -0.13 [-0.74; 0.44] | -0.43 [-2.78; 1.93] | -1.50 [-4.28; 1.07] |
| KV | 220 | 0.23 [-0.78; 1.17] | -1.82 [-5.45; 2.27] | 0.00 [-4.55; 4.09] |
| Grup (yetersiz n) | 69 | 0.30 [-1.14; 1.89] | 2.90 [-4.35; 10.14] | 0.00 [-7.25; 7.25] |
| Satış (yetersiz n) | 50 | -0.21 [-2.13; 1.70] | 2.00 [-4.00; 8.00] | -4.00 [-14.00; 4.00] |

## 5. Betimleyici: galopsuz beş sinyalin (B5) beklentisine göre kazanma
B5 modelinin (ileri-yönlü β) test yarışlarındaki olasılığı P; z = (kazanan − ΣP)/√ΣP(1−P). Galop, B5'in ötesinde bilgi taşıyorsa yüksek yüzdelikli atlarda z>0, düşüklerde z<0 beklenir. Çok sayıda hücre; düzeltme yok.
**GALOP_KAPASITE yüzdeliği (yarış-içi; 0=en düşük, 1=en yüksek)**
| Grup | n at | Kazanan | Beklenen (B5) | z |
|---|---|---|---|---|
| galopsuz | 2021 | 146 | 170.9 | -2.04 |
| 0,0–0,2 | 357 | 18 | 24.7 | -1.42 |
| 0,2–0,4 | 3379 | 254 | 309.9 | -3.44 |
| 0,4–0,6 | 7743 | 797 | 799.6 | -0.10 |
| 0,6–0,8 | 3682 | 479 | 393.1 | 4.73 |
| 0,8–1,0 | 225 | 26 | 21.8 | 0.98 |

**Son galopun yarıştan uzaklığı (gün)**
| Grup | n at | Kazanan | Beklenen (B5) | z |
|---|---|---|---|---|
| galopsuz | 2021 | 146 | 170.9 | -2.04 |
| 0–3 gün | 11567 | 1163 | 1138.9 | 0.78 |
| 4–7 gün | 3447 | 388 | 378.7 | 0.52 |
| 8–14 gün | 279 | 22 | 25.7 | -0.79 |
| 15+ gün | 93 | 1 | 5.8 | -2.10 |

**Son koşudan sonraki galop sayısı**
| Grup | n at | Kazanan | Beklenen (B5) | z |
|---|---|---|---|---|
| 1 galop | 6470 | 597 | 604.4 | -0.33 |
| 2 galop | 3279 | 369 | 340.4 | 1.69 |
| 3+ galop | 7658 | 754 | 775.1 | -0.83 |

## Sınırlar ve dürüst notlar
- Bu, galop için bir **tanı** çalışmasıdır: tanım değiştirilmedi, bileşenler yalnız ölçüldü. Bölüm 3'te üç bileşenin ayrı verilmesi, kullanıcı onayı olmadan yeni bir galop sinyalinin kabulü değildir.
- Galop kapsamlı yarışlar seçilmiş bir altkümedir (galop verisi toplanmış dönem/hipodromlar, referans grupları dolu olanlar): bu dönemde başka koşullar da farklı olabilir; sonuç tüm yarışlara doğrudan genellenemez.
- Galop bilgisi atın antrenman kayıtlarıdır: jokey/antrenör tercihleri ve koşu planlarıyla (örneğin hazırlıklı atlara daha çok galop yaptırılması) ilişkili olabilir; nedensel yorum yapılamaz.
- A ve B tekrar kullanıldı; S bu dönemle örtüşür. Çoklu karşılaştırma düzeltilmedi; tek hücredeki ✓/✗ kanıt sayılmaz. Doğrusal-logit ve ortak β varsayımı geçerlidir.