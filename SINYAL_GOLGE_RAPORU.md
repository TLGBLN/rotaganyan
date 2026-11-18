# Sinyallerin özgün katkısı ve gölgelenmesi — AGF'siz ve AGF kontrollü ayrı ölçüm (aktif sinyal 0; AGF sinyal havuzunda DEĞİL)
Kullanıcı kararı: AGF motorun sinyal havuzuna katılmaz; ayrı bir **karşılaştırma katmanı**dır. İki ayrı ölçüm: **(1) AGF'siz:** ACC_HIZ, GALOP_KAPASITE, SON6, J_SEVIYE, H2H_NET birbirlerine göre özgün katkı ve gölgeleme. **(2) AGF kontrollü:** aynı sinyaller, AGF'nin son düzeyi (L ve doğrusal olmayan L²) modeldeyken piyasanın bildiğinin ötesinde bilgi veriyor mu. AGF hareketi (trend) bu çalışmada KULLANILMADI.

## 0. Düzenek
- **Örneklem SS:** AGF'li (≥%80 atında ≥2 yarış-öncesi kesit) ve galop kapsamlı (≥%70 atında GALOP_KAPASITE var) 1952 yarış (2026-07-01→2026-11-17). Her karşılaştırma AYNI yarışlarda (AGF'siz ve AGF'li modeller birebir aynı test yarışlarında). Tek kronolojik havuz, 6 blokluk ileri-yönlü β. **A ve B dönemiyle örtüşür; bağımsız/ileri-yönlü doğrulama değildir.**
- **AGF katmanı:** L = ln(son AGF) ve L² (kapanışa yakın piyasa düzeyi, yaklaşık; son kesit yarıştan medyan ~1,15 saat önce). AGF altılı ganyan favorisi yüzdesidir, TL girişi değildir. H2H_NET başlangıç H_180_3 (seçim değil).
- Ölçü cihazı: yarış-içi softmax (koşullu logit), ridge 0,02, eksik → yarış-içi ortalama. **ΔLL%** = (dar − geniş model log-loss)/(rastgele 1/N log-loss)×100; ΔTop1/ΔTop3 yüzde puan; [%95 eşleştirilmiş bootstrap]; ✓ aralık sıfırın üstünde, ○ sıfırı içeriyor, ✗ altında; 'Tut.' = ΔLL işareti test yarışlarının 1./2. yarısında. **Özgün katkı (LOO)** = beş sinyalli model − o sinyalsiz model. **Gölgelenme oranı** = LOO ÷ tek başına katkı (1'e yakın: sinyal bağımsız bilgi veriyor; 0'a yakın: diğerleri/piyasa tarafından gölgeleniyor).
- Doğrulama: AGF gelecek-bozma testi (gerçek veri, 400 at) GEÇTİ, bağımsız yeniden hesap 0/400 uyuşmaz. H2H, GALOP, ACC, SON6, J_SEVIYE için gelecek-bozma/bağımsız hesap testleri önceki raporlarda ve birim testlerinde (vitest) geçmiştir; bu çalışmada yeniden koşulmadı.

Test yarışı 1627; 1/N Top1 10.9%, Top3 32.7%.

## 1. Örtüşme (yarış içi merkezlenmiş)
| Sinyal | r(ACC_HIZ) | r(GALOP_KAPASITE) | r(SON6) | r(J_SEVIYE) | r(H2H_NET) | r(AGF_L) | r(AGF trend) | R² (diğer dört sinyal) | R² (AGF_L, L² ile) |
|---|---|---|---|---|---|---|---|---|---|
| ACC_HIZ | — | 0.07 | 0.68 | 0.27 | 0.43 | 0.61 | 0.01 | 0.513 | 0.370 |
| GALOP_KAPASITE | 0.07 | — | 0.09 | 0.09 | 0.03 | 0.19 | 0.03 | 0.010 | 0.038 |
| SON6 | 0.68 | 0.09 | — | 0.28 | 0.40 | 0.61 | 0.00 | 0.506 | 0.380 |
| J_SEVIYE | 0.27 | 0.09 | 0.28 | — | 0.22 | 0.53 | 0.03 | 0.095 | 0.284 |
| H2H_NET | 0.43 | 0.03 | 0.40 | 0.22 | — | 0.53 | -0.00 | 0.210 | 0.285 |

**AGF seviyesi sinyallerle ne kadar açıklanıyor?** AGF_L'nin beş sinyalle doğrusal R²'si: 0.614 (yarış-içi sapmalar). AGF trendinin beş sinyalle R²'si: 0.001. Bu, piyasa hareketinin (trend) bu sinyallerden kaynaklandığına dair bir kanıt ARAMAK içindir; düşük R² 'galop AGF'yi hareket ettiriyor' hipotezini desteklemez (ama çürütmez: nedensel yön bu testle bilinemez).

## 2. AGF'SİZ ölçüm: sinyaller birbirini gölgeliyor mu?
| Sinyal | Tek başına ΔLL% (1/N'ye) | Sıralı ekleme (listelenen sıra) ΔLL% | **Özgün katkı (LOO) ΔLL% [%95]** | Gölgelenme oranı (LOO ÷ tek) | LOO ΔTop1 p | LOO ΔTop3 p | Tut. |
|---|---|---|---|---|---|---|---|
| ACC_HIZ | ✓ 5.39% | ✓ 5.39% (1/N'ye) | ✓ 0.25 [0.02; 0.47] | 0.05 | 0.3 [-0.9; 1.6] | 0.6 [-0.6; 1.8] | ++ |
| GALOP_KAPASITE | ✓ 0.87% | ✓ 0.68% | ✓ 0.43 [0.13; 0.75] | 0.49 | 1.1 [-0.2; 2.4] | -0.4 [-2.0; 1.0] | ++ |
| SON6 | ✓ 7.59% | ✓ 2.60% | ✓ 1.61 [0.98; 2.23] | 0.21 | 0.8 [-0.7; 2.3] | 0.4 [-1.2; 2.1] | ++ |
| J_SEVIYE | ✓ 4.78% | ✓ 2.02% | ✓ 1.89 [1.36; 2.38] | 0.40 | 1.5 [-0.3; 3.1] | 2.3 [0.5; 4.1] | ++ |
| H2H_NET | ✓ 3.21% | ✓ 0.62% | ✓ 0.62 [0.30; 0.97] | 0.19 | 1.0 [-0.3; 2.4] | 0.6 [-0.9; 2.0] | ++ |

Beş sinyalli model (F5): kazanç 11.32%, Top1 26.1%, Top3 59.3%.

**İkili gölgeleme matrisi:** hücre = SÜTUN sinyalinin SATIR sinyaline eklenmesinin ΔLL%'si (✓ sıfırın üstü). Tek başına katkıya göre ne kadar düşüyorsa o ikili gölgeleniyor.
| Satır (taban) \ Eklenen | ACC_HIZ | GALOP_KAPASITE | SON6 | J_SEVIYE | H2H_NET |
|---|---|---|---|---|---|
| ACC_HIZ | — | ✓ 0.68% | ✓ 2.75% | ✓ 2.93% | ✓ 1.13% |
| GALOP_KAPASITE | ✓ 5.20% | — | ✓ 7.25% | ✓ 4.50% | ✓ 3.16% |
| SON6 | ✓ 0.54% | ✓ 0.53% | — | ✓ 2.27% | ✓ 0.96% |
| J_SEVIYE | ✓ 3.55% | ✓ 0.59% | ✓ 5.08% | — | ✓ 2.18% |
| H2H_NET | ✓ 3.31% | ✓ 0.82% | ✓ 5.35% | ✓ 3.75% | — |

## 3. AGF KONTROLLÜ ölçüm: piyasanın bildiğinin ötesinde bilgi veriyor mu?
AGF düzeyi (L, L²) tek başına: kazanç 18.69%, Top1 32.8%, Top3 66.9%. Beş sinyalli AGF'siz model (F5): 11.32%. AGF + beş sinyal (A5): 18.70%, Top1 33.2%, Top3 67.1%.
- **Beş sinyal, AGF üzerine (A5 − A0):** ΔLL% 0.01 [-0.17; 0.19]; ΔTop1 0.4 [-0.4; 1.2]; ΔTop3 0.1 [-0.6; 0.9]. **AGF, beş sinyal üzerine (A5 − F5):** ΔLL% 7.38 [5.99; 8.66].

| Sinyal | AGF üzerine tek başına ΔLL% [%95] | **AGF + diğer dört üzerine (özgün katkı) ΔLL% [%95]** | AGF'siz özgün katkı | **Korunma oranı** (AGF'li ÷ AGF'siz) | ΔTop1 p | ΔTop3 p | Tut. |
|---|---|---|---|---|---|---|---|
| ACC_HIZ | ○ -0.02 [-0.07; 0.02] | ○ -0.02 [-0.08; 0.03] | ✓ 0.25% | -0.10 | 0.4 [-0.2; 0.9] | -0.4 [-0.8; 0.0] | −− |
| GALOP_KAPASITE | ○ 0.04 [-0.10; 0.19] | ○ 0.04 [-0.10; 0.18] | ✓ 0.43% | 0.09 | 0.1 [-0.6; 0.9] | -0.1 [-0.8; 0.6] | −+ |
| SON6 | ○ 0.03 [-0.05; 0.10] | ○ 0.02 [-0.07; 0.12] | ✓ 1.61% | 0.01 | -0.2 [-0.7; 0.2] | -0.2 [-0.7; 0.2] | ++ |
| J_SEVIYE | ○ -0.03 [-0.07; 0.02] | ○ -0.03 [-0.06; 0.02] | ✓ 1.89% | -0.01 | 0.0 [-0.4; 0.4] | -0.1 [-0.4; 0.2] | −− |
| H2H_NET | ○ -0.00 [-0.02; 0.01] | ○ -0.00 [-0.02; 0.02] | ✓ 0.62% | -0.01 | -0.1 [-0.3; 0.1] | 0.0 [-0.2; 0.2] | +− |

**At kalitesi kontrolleriyle (hp, geçmiş performans, sınıf değişimi) aynı iki ölçüm — özgün katkı ΔLL%:**
| Sinyal | AGF'siz, kontrollü [%95] | AGF kontrollü, kontrollü [%95] |
|---|---|---|
| ACC_HIZ | ○ 0.16 [-0.01; 0.34] | ○ -0.02 [-0.08; 0.03] |
| GALOP_KAPASITE | ✓ 0.42 [0.12; 0.74] | ○ 0.03 [-0.10; 0.16] |
| SON6 | ✓ 0.96 [0.49; 1.40] | ○ 0.05 [-0.08; 0.18] |
| J_SEVIYE | ✓ 1.35 [0.95; 1.80] | ○ -0.03 [-0.08; 0.03] |
| H2H_NET | ✓ 0.32 [0.05; 0.57] | ○ -0.00 [-0.02; 0.01] |

## 4. Yarış tipine göre özgün katkı (n ≥ 150 'yeterli')
Hücre: işaret ve ΔLL% (parantez: 1./2. yarı işareti). **Üst blok AGF'siz (F5 − F−s), alt blok AGF kontrollü (A5 − A−s).**
| Sinyal | Tümü (n=1627) | Maiden (n=345) | Şartlı (n=518) | Handikap (n=441) | KV (n=207) | Grup (n=67, yetersiz) | Satış (n=47, yetersiz) |
|---|---|---|---|---|---|---|---|
| ACC_HIZ — AGF'siz | ✓ 0.25% (++) | ✓ 0.61% (++) | ○ 0.36% (++) | ○ 0.08% (++) | ○ -0.50% (−−) | ○ 0.55% (·+) | ○ -0.11% (··) |
| GALOP_KAPASITE — AGF'siz | ✓ 0.43% (++) | ✓ 0.83% (++) | ○ 0.57% (++) | ○ -0.00% (+−) | ○ 0.57% (++) | ○ 0.37% (·+) | ○ -0.40% (··) |
| SON6 — AGF'siz | ✓ 1.61% (++) | ✓ 1.88% (++) | ✓ 1.31% (++) | ✓ 1.55% (++) | ✓ 2.95% (++) | ○ -1.32% (·−) | ○ 2.65% (··) |
| J_SEVIYE — AGF'siz | ✓ 1.89% (++) | ✓ 1.16% (++) | ✓ 2.58% (++) | ✓ 1.70% (++) | ✓ 1.45% (++) | ✓ 2.53% (·+) | ✓ 2.93% (··) |
| H2H_NET — AGF'siz | ✓ 0.62% (++) | ○ 0.17% (−+) | ○ 0.28% (++) | ✓ 0.66% (++) | ✓ 1.53% (++) | ✓ 3.19% (·+) | ○ 0.34% (··) |
| ACC_HIZ — **AGF kontrollü** | ○ -0.02% (−−) | ○ -0.08% (−−) | ○ -0.07% (−+) | ○ 0.05% (++) | ○ 0.09% (++) | ○ -0.06% (·−) | ○ 0.05% (··) |
| GALOP_KAPASITE — **AGF kontrollü** | ○ 0.04% (−+) | ○ 0.09% (−+) | ○ 0.06% (++) | ○ -0.09% (−−) | ○ 0.17% (++) | ○ 0.17% (·+) | ○ -0.05% (··) |
| SON6 — **AGF kontrollü** | ○ 0.02% (++) | ○ -0.09% (+−) | ○ 0.03% (−+) | ○ 0.06% (−+) | ✓ 0.28% (++) | ○ -0.31% (·−) | ○ -0.00% (··) |
| J_SEVIYE — **AGF kontrollü** | ○ -0.03% (−−) | ○ 0.05% (++) | ○ -0.07% (−−) | ○ -0.03% (−−) | ○ -0.01% (−+) | ○ -0.03% (·+) | ○ -0.05% (··) |
| H2H_NET — **AGF kontrollü** | ○ -0.00% (+−) | ○ -0.02% (+−) | ○ -0.01% (−+) | ○ -0.01% (−−) | ○ 0.05% (++) | ○ -0.05% (·−) | ○ 0.05% (··) |

## Sınırlar ve dürüst notlar
- **AGF'li ölçümde 'özgün katkının düşmesi' iki şekilde yorumlanabilir:** (a) sinyalin bilgisi piyasaya önceden yansımış olabilir (örneğin iyi galopu bahisçiler de görmüş olabilir); (b) AGF, sinyallerin kullanmadığı ama onlarla ilişkili başka bilgileri taşıyor olabilir. Bu test hangisi olduğunu ayıramaz; AGF yükselişinin galoptan kaynaklandığına dair doğrudan kanıt yoktur (bölüm 1 yalnız ilişkiyi gösterir).
- AGF altılı ganyan favorisi yüzdesidir, kapanışa yakın görüşü yaklaşık gösterir; TL girişi, havuz hacmi ve son kesitten sonraki hareket bilinmez. Gerçek kapanış oranıyla (ganyan) karşılaştırma yapılmadı.
- S ve dolayısıyla SS, A ve B olarak tekrar kullanılan dönemle örtüşür; çoklu karşılaştırma düzeltilmedi. Doğrusal-logit ve ortak β varsayımı; L² ile düzeyin doğrusal olmayan etkisi kısmen yakalanır, tam esneklik değildir.
- Hedef AGF'nin aynısını tahmin etmek değil, AGF'nin henüz yakalayamadığı bilgiyi bulmaktır: bu yüzden bölüm 3'teki 'AGF üzerine özgün katkı' sütunu asıl göstergedir.