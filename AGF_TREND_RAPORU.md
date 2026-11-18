# AGF_TREND — ek katkı araştırması (aday sinyal DEĞİL; MOTORA/KUPONA GİRMEZ; `SINYAL_KAYDI` boş)
Soru: **AGF Trend (yarış öncesi kesitlerde son − ilk AGF) yarışın kazananını bulmaya, (a) dört sinyalli tabana, (b) AGF'nin son düzeyine (piyasanın kapanışa yakın görüşü) ve (c) altı sinyalli tabana EK bilgi katıyor mu?** AGF yalnız değerlendirmede kullanılır (kullanıcı kararı 2026-11-14); bu çalışma salt-okuma bir ölçümdür.

## 0. Tanım, veri, doğrulama
- **Kesitler:** `AgfSnapshot` (günde ~4 kez). Yarış başlangıcı = `Race.time` (TR duvar saati, UTC+3) + yarış günü; **yalnız başlangıçtan KESİN önceki kesitler** kullanılır (mevcut `getAgfTrendForRace` ile aynı kural). Saat ayrıştırılamayan yarış dışarıda (sessiz varsayım yok).
- **AGF_TREND (T)** = son − ilk (yüzde puan; koddaki mevcut tanım). Tek kesitli atta NULL. Karşılaştırma: **TR** = ln(son/ilk) (göreli; küçük paydada gürültülü), **TE** = başlangıçtan ≥2 saat önceki son kesit − ilk (kapanışa yakın bilgiyi dışarıda bırakan duyarlılık). **L** = ln(son AGF) (piyasanın kapanışa yakın düzeyi; yalnız karşılaştırma için).
- Hiçbir tanım sonuca göre SEÇİLMEDİ: T asıl tanımdır (koddaki), TR ve TE duyarlılık olarak yan yana.
- **Örneklem S:** 2026-07-01 sonrası, ≥%80 atında ≥2 yarış-öncesi kesit olan 2353 yarış (2026-07-01→2026-11-17; AGF kesitleri ancak Temmuz 2026'dan beri birikiyor). Tek kronolojik örneklem, 6 blokluk ileri-yönlü β (β yalnız önceki bloklardan; ilk blok yalnız eğitim). **S, daha önce A ve B olarak tekrar kullanılan dönemle örtüşür; bağımsız/ileri-yönlü doğrulama DEĞİLDİR.**
- **Gelecek-bozma testi (gerçek veri, 400 at):** GEÇTİ — sızıntı yok (başlangıç ve sonrası kesitler bozulur, sahte uç kesitler eklenir). **Bağımsız yeniden hesap:** 400 atta 0 uyuşmaz. Birim testleri vitest'te geçiyor.
- **Ölçü cihazı:** yarış-içi softmax (koşullu logit), ridge 0,02; eksik → yarış-içi ortalama. **ΔLL%** = (dar model log-loss − geniş model log-loss)/(rastgele 1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]. ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ sıfırın altında. 'Tut.' = ΔLL işareti test yarışlarının 1. ve 2. yarısında.

## 1. Kapsam ve kesit zamanlaması
- Koşan at 23815. AGF seviyesi (≥1 kesit) olan at 100.0%; **trendi (≥2 kesit) olan at 99.8%**; erken trendi (başlangıçtan ≥2 saat önce ≥2 kesit) olan 91.3%.
- At başına kesit sayısı: medyan 6, ortalama 7.6. **Son kesitin yarış başlangıcından uzaklığı (saat):** medyan 1.24; ≤1 saat 42.7%; ≤3 saat 99.2%; >6 saat 0.0%.
- Trend dağılımı (yüzde puan): medyan 0.06; |trend|≥1 puan olan at 48.3%.

## 2. Betimleyici: trend, kapanış düzeyine rağmen kazananı gösteriyor mu? (TÜM S örnekleme, as-of özellik; yalnız bilgi)
Her at için piyasa olasılığı p = AGF / (yarıştaki AGF toplamı). z = (kazanan − Σp)/√Σp(1−p). **'z (son AGF)'**: kapanışa yakın düzeyin ima ettiği beklentiye göre; **'z (ilk AGF)'**: açılış düzeyine göre. Trend kapanış düzeyinde zaten fiyatlanmışsa 'z (son AGF)' ≈ 0 beklenir. Çok sayıda hücre var; düzeltme yok.
| Trend aralığı (puan) | n at | Kazanan | Beklenen (son AGF) | z (son AGF) | Beklenen (ilk AGF) | z (ilk AGF) |
|---|---|---|---|---|---|---|
| ≤ −3 | 2368 | 355 | 369.7 | -0.88 | 550.0 | -10.13 |
| −3 … −1 | 2947 | 284 | 313.1 | -1.84 | 367.2 | -4.87 |
| −1 … +1 | 12296 | 711 | 703.1 | 0.32 | 702.0 | 0.37 |
| +1 … +3 | 3689 | 404 | 401.4 | 0.15 | 338.5 | 3.98 |
| ≥ +3 | 2476 | 599 | 563.1 | 1.85 | 392.7 | 12.27 |

## 3. Örtüşme (yarış içi merkezlenmiş)
| Sinyal | r(AGF_L) | r(ACC_HIZ) | r(GALOP) | r(J_SEVIYE) | r(SON6) | R² (taban 4 + AGF_L) | R² (yalnız taban 4) |
|---|---|---|---|---|---|---|---|
| AGF_T | 0.08 | 0.01 | 0.04 | 0.03 | 0.00 | 0.013 | 0.002 |
| AGF_TR | 0.08 | -0.01 | 0.02 | 0.02 | 0.00 | 0.008 | 0.001 |
| AGF_TE | 0.11 | 0.03 | 0.03 | 0.06 | 0.02 | 0.020 | 0.006 |
| AGF_L (karşılaştırma) | — | 0.61 | 0.19 | 0.53 | 0.61 | — | 0.569 |

## 4. Model düzeyleri (test yarışları; aynı yarışlarda)
Test yarışı 1961; rastgele (1/N) Top1 10.8%, Top3 32.5%. 'Kazanç %' = 1/N log-loss'un yüzde kaçı kapatıldı.
| Model | Kazanç % | Top1 % | Top3 % |
|---|---|---|---|
| L | 18.15% | 32.6% | 65.7% |
| L+T | 18.15% | 32.4% | 65.8% |
| L+TR | 18.16% | 32.8% | 65.8% |
| L+TE | 18.12% | 32.4% | 65.6% |
| B4 | 10.42% | 24.9% | 58.3% |
| B4+T | 10.90% | 25.5% | 58.1% |
| B4+TR | 10.62% | 25.2% | 58.0% |
| B4+TE | 10.80% | 25.8% | 58.0% |
| B4+L | 18.18% | 33.1% | 65.6% |
| B4+L+T | 18.19% | 32.9% | 65.7% |
| B4+L+TR | 18.20% | 33.4% | 65.5% |
| B4+L+TE | 18.16% | 32.9% | 65.5% |
| B6 | 11.41% | 25.8% | 59.1% |
| B6+T | 11.83% | 26.5% | 59.6% |
| B6+L | 18.15% | 33.0% | 65.8% |
| B6+L+T | 18.16% | 32.8% | 65.9% |
| B6+L+TR | 18.17% | 33.2% | 65.8% |
| c4 | 11.78% | 25.9% | 59.8% |
| c4+T | 12.24% | 26.9% | 60.4% |
| c4+L | 18.31% | 33.2% | 65.8% |
| c4+L+T | 18.30% | 32.8% | 65.9% |

## 5. Ek katkı (tüm test yarışları)
| Karşılaştırma | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] | Tut. |
|---|---|---|---|---|
| AGF_L (kapanış düzeyi) dört sinyalli tabana (B4+L − B4) | ✓ 7.76 [6.55; 8.96] | 8.16 [5.97; 10.30] | 7.29 [5.10; 9.64] | ++ |
| **AGF_T dört sinyalli tabana** (B4+T − B4) | ✓ 0.48 [0.23; 0.72] | 0.56 [-0.51; 1.68] | -0.15 [-1.12; 0.82] | ++ |
| AGF_TR dört sinyalli tabana (B4+TR − B4) | ✓ 0.19 [0.00; 0.40] | 0.25 [-0.61; 1.17] | -0.25 [-1.17; 0.71] | ++ |
| AGF_TE dört sinyalli tabana (B4+TE − B4) | ✓ 0.38 [0.12; 0.63] | 0.87 [-0.10; 1.89] | -0.25 [-1.22; 0.71] | ++ |
| **AGF_T, taban 4 + AGF_L üzerine (asıl soru)** (B4+L+T − B4+L) | ○ 0.01 [-0.04; 0.05] | -0.15 [-0.46; 0.20] | 0.10 [-0.15; 0.36] | −+ |
| AGF_TR, taban 4 + AGF_L üzerine (B4+L+TR − B4+L) | ○ 0.02 [-0.05; 0.08] | 0.25 [0.00; 0.56] | -0.10 [-0.41; 0.25] | −+ |
| AGF_TE, taban 4 + AGF_L üzerine (B4+L+TE − B4+L) | ○ -0.02 [-0.10; 0.05] | -0.15 [-0.61; 0.25] | -0.05 [-0.31; 0.20] | −− |
| AGF_T, AGF_L tek başına üzerine (yalnız piyasa) (L+T − L) | ○ 0.00 [-0.04; 0.05] | -0.20 [-0.51; 0.05] | 0.10 [0.00; 0.25] | −+ |
| AGF_TE, AGF_L tek başına üzerine (L+TE − L) | ○ -0.03 [-0.11; 0.06] | -0.20 [-0.66; 0.25] | -0.05 [-0.25; 0.15] | −− |
| Dört sinyalli taban, AGF_L üzerine (bizim sinyaller piyasaya ek katıyor mu?) (B4+L − L) | ○ 0.03 [-0.15; 0.22] | 0.46 [-0.36; 1.27] | -0.10 [-0.82; 0.61] | −+ |
| AGF_T altı sinyalli tabana (B6+T − B6) | ✓ 0.42 [0.20; 0.66] | 0.71 [-0.31; 1.73] | 0.51 [-0.41; 1.33] | ++ |
| AGF_L altı sinyalli tabana (B6+L − B6) | ✓ 6.74 [5.62; 7.86] | 7.19 [5.05; 9.28] | 6.68 [4.49; 8.72] | ++ |
| **AGF_T, altı sinyal + AGF_L üzerine** (B6+L+T − B6+L) | ○ 0.00 [-0.04; 0.06] | -0.15 [-0.56; 0.25] | 0.15 [-0.10; 0.41] | −+ |
| AGF_TR, altı sinyal + AGF_L üzerine (B6+L+TR − B6+L) | ○ 0.02 [-0.04; 0.08] | 0.25 [0.00; 0.56] | 0.00 [-0.31; 0.31] | −+ |
| AGF_T, kontrollü taban (c4) üzerine (c4+T − c4) | ✓ 0.46 [0.23; 0.71] | 0.97 [-0.05; 2.04] | 0.61 [-0.25; 1.53] | ++ |
| AGF_T, kontrollü taban + AGF_L üzerine (c4+L+T − c4+L) | ○ -0.01 [-0.07; 0.04] | -0.41 [-0.66; -0.15] | 0.10 [-0.05; 0.31] | −+ |

## 6. Yarış tipine göre (n ≥ 150 'yeterli')
Her hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti). β tüm tiplerde ortak eğitildi.
| Karşılaştırma | Tümü (n=1961) | Maiden (n=395) | Şartlı (n=644) | Handikap (n=553) | KV (n=244) | Grup (n=67, yetersiz) | Satış (n=56, yetersiz) | Diğer (n=2, yetersiz) |
|---|---|---|---|---|---|---|---|---|
| AGF_L → taban 4 | ✓ 7.76% (++) | ✓ 6.60% (++) | ✓ 7.69% (++) | ✓ 7.77% (++) | ✓ 8.51% (++) | ✓ 16.13% (·+) | ○ 5.33% (··) | ✗ -34.56% (··) |
| AGF_T → taban 4 | ✓ 0.48% (++) | ○ 0.12% (−+) | ✓ 0.81% (++) | ✓ 0.48% (++) | ○ 0.40% (++) | ○ -0.10% (·−) | ○ 0.29% (··) | ✓ 1.50% (··) |
| **AGF_T → taban 4 + AGF_L** | ○ 0.01% (−+) | ○ -0.02% (−+) | ○ 0.01% (−+) | ○ 0.03% (++) | ○ 0.01% (+−) | ○ -0.04% (·−) | ○ -0.09% (··) | ✗ -0.06% (··) |
| AGF_TE → taban 4 + AGF_L | ○ -0.02% (−−) | ○ -0.03% (−−) | ○ -0.10% (−−) | ○ 0.04% (+−) | ○ 0.01% (+−) | ○ 0.06% (·+) | ○ -0.02% (··) | ✗ -0.16% (··) |
| AGF_T → altı sinyal + AGF_L | ○ 0.00% (−+) | ○ -0.01% (−+) | ○ 0.00% (−+) | ○ 0.03% (++) | ○ 0.01% (++) | ○ -0.04% (·−) | ○ -0.11% (··) | ✗ -0.08% (··) |

**Asıl karşılaştırma (AGF_T → taban 4 + AGF_L) tip başına ayrıntı:**
| Tip | n | ΔLL% [%95] | ΔTop1 p [%95] | ΔTop3 p [%95] |
|---|---|---|---|---|
| Tümü | 1961 | 0.01 [-0.04; 0.06] | -0.15 [-0.51; 0.20] | 0.10 [-0.15; 0.41] |
| Maiden | 395 | -0.02 [-0.16; 0.15] | -0.25 [-1.27; 0.51] | 0.25 [-0.51; 1.27] |
| Şartlı | 644 | 0.01 [-0.08; 0.09] | -0.16 [-1.09; 0.93] | 0.16 [-0.31; 0.62] |
| Handikap | 553 | 0.03 [-0.03; 0.09] | -0.18 [-0.72; 0.00] | -0.18 [-0.54; 0.00] |
| KV | 244 | 0.01 [-0.11; 0.12] | 0.00 [0.00; 0.00] | 0.00 [0.00; 0.00] |
| Grup (yetersiz n) | 67 | -0.04 [-0.30; 0.19] | 0.00 [0.00; 0.00] | 0.00 [0.00; 0.00] |
| Satış (yetersiz n) | 56 | -0.09 [-0.31; 0.11] | 0.00 [0.00; 0.00] | 1.79 [0.00; 5.36] |

## Sınırlar ve dürüst notlar
- **AGF kesitleri yalnız Temmuz 2026'dan beri** birikiyor; S, A ve B olarak tekrar kullanılan dönemle örtüşür. Bağımsız ileri-yönlü doğrulama için yeni yarışlarla aynı aracın yeniden çalıştırılması gerekir.
- **Piyasa kapanışa yakın bilgi taşır:** son kesit yarışa saatler kala olabilir (bölüm 1). AGF_L ile kıyas piyasanın kapanış görüşünü yaklaşık gösterir; gerçek kapanış oranı değildir (AGF altılı ganyan favorisi yüzdesidir, ganyan oranı değildir). TE duyarlılığı kapanışa yakın bilgiyi çıkarır.
- **Trend yönü iki yönlü yorumlanabilir:** AGF yükselen at 'paranın aktığı' at olabilir; ama sinyalin yarış-öncesi bilgi mi yoksa piyasanın zaten bilinen verileri fiyatlaması mı olduğu bu testle ayrılamaz. Katkı varsa bile bu, AGF'nin motora girmesi gerektiği anlamına gelmez (2026-11-14 kararı geçerli).
- Çok sayıda karşılaştırma (model × tip × ölçüt) düzeltilmedi; tek hücredeki ✓/✗ kanıt sayılmaz. Doğrusal-logit ve ortak β varsayımı geçerlidir.