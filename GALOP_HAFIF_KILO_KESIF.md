# GALOP_KAPASITE × hafif kilo — önceden bildirilmiş hipotez testi (aday sinyal DEĞİL; `SINYAL_KAYDI` boş)
**KEŞİF (A/B/C dönemi; hipotez bu dönemde bulundu): NİHAİ DOĞRULAMA DEĞİLDİR; yalnız mevcut değerleri gösterir.**

## 0. Dondurulmuş tanım ve karar kuralı (kullanıcı onayı 2026-11-18; eşikler test sonucuna göre DEĞİŞTİRİLMEZ)
- **Hücreler (yalnız Handikap yarışları):** hafif = atın göreli kilosu (W − yarış ortalaması) o yarışın göreli-kilo medyanına eşit veya altında; iyi galop = GALOP_KAPASITE yarış-içi yüzdeliği ≥ 0,50; zayıf galop < 0,50. **Ana hücre = hafif ∧ iyi galop.** Karşıt hücreler: hafif ∧ zayıf, ağır ∧ iyi, ağır ∧ zayıf. Galopsuz atlar hücrelere girmez.
- **Beklenti modeli G0:** galopsuz B4 (ACC_HIZ, J_SEVIYE, SON6, H2H_NET); **B5/G1** = B4 + GALOP_KAPASITE. Örneklem: galop kapsamlı (≥%70 atında GALOP_KAPASITE) yarışlar; β yalnız önceki verilerden.
- **Birlikte aranan dört koşul (hepsi sağlanmadan hipotez doğrulanmış sayılmaz):** (1) ana hücrede ≥150 at ve ≥100 handikap yarışı; (2) **z ≥ +2** (z = (kazanan − ΣP)/√ΣP(1−P), P: G0); (3) **yarış bazında (küme) bootstrap %95 aralığının alt sınırı > 0** hem hücrenin beklenti üstü kazanma farkı için hem de ana − (hafif ∧ zayıf) hücre farkı için; (4) **mevcut sinyallerin (B5/G1 ve kontrollü cG1) üzerine ek katkı:** HAIG bayrağının ΔLL% %95 aralığı sıfırın üstünde.

- Örneklem: galop kapsamlı 2064 yarış (2026-07-01→2026-11-17). Keşif (6 blok ileri-yönlü β; handikap test yarışları dilimi).

## 1. Hücre sonuçları (handikap test yarışları: 467; beklenti G0)
| Hücre | n at | n yarış | Kazanan | Beklenen (G0) | z | Beklenti-üstü fark/at (puan) [küme %95] |
|---|---|---|---|---|---|---|
| hafif ∧ iyi galop (ANA) | 1408 | 463 | 161 | 120.8 | 3.91 | 2.85 [1.52; 4.14] |
| hafif ∧ zayıf galop | 1250 | 456 | 93 | 93.3 | -0.04 | -0.03 [-1.32; 1.26] |
| ağır ∧ iyi galop | 994 | 436 | 96 | 111.4 | -1.59 | -1.55 [-3.02; 0.32] |
| ağır ∧ zayıf galop | 794 | 416 | 73 | 86.9 | -1.62 | -1.75 [-3.67; 0.22] |

**Ana − (hafif ∧ zayıf galop) fark (beklenti-üstü kazanma, puan/at):** 2.88 [0.88; 5.05] (yarış kümesi bootstrap %95).

## 2. Mevcut sinyallerin üzerine ek katkı (handikap test yarışları, ΔLL%)
| Karşılaştırma | ΔLL% [%95] |
|---|---|
| HAIG bayrağı, G1 (B5) üzerine | 0.38 [-0.13; 0.90] |
| HAIG bayrağı, kontrollü cG1 üzerine | 0.66 [-0.05; 1.31] |
| HAIG bayrağı, G1 + göreli kilo üzerine | 0.03 [-0.22; 0.29] |
| (bilgi) GALOP_KAPASITE'nin kendisi, G0 üzerine | -0.09 [-0.70; 0.50] |

## 3. Karar kuralı (dört koşulun TAMAMI gerekir)
| Koşul | Değer | Sağlandı mı |
|---|---|---|
| (1) ana hücre ≥150 at ve ≥100 yarış | 1408 at / 463 yarış | EVET |
| (2) z ≥ +2 | 3.91 | EVET |
| (3) küme %95 alt sınırı > 0 (hücre ve ana−zayıf fark) | hücre alt 1.52; fark alt 0.88 | EVET |
| (4) ek ΔLL% alt sınırı > 0 (G1 ve cG1 üzerine) | alt -0.13 / -0.05 | HAYIR |

**Sonuç: hipotez DOĞRULANMADI (koşulların tamamı sağlanmadı).** Bu çalışma KEŞİF dönemidir (hipotezin bulunduğu veri); sonuç doğrulama sayılmaz, yalnız ileri-yönlü modun başlangıç değerleridir.

## Sınırlar
- Çoklu karşılaştırma düzeltilmedi; hücre tanımı keşifte bulunduğu için keşif dönemindeki sonuç iyimserdir. Eşikler (≥150 at, ≥100 yarış, z≥2, küme CI, ek ΔLL) dondurulmuştur ve test sonucuna göre değiştirilmez. Galop kapsamlı dönem Temmuz 2026'dan sonrasıdır; handikap yarışı sayısı sınırlıdır.