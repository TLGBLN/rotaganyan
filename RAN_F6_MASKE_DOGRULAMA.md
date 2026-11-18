# RAN F6 — tip bazlı kullanım maskesinin doğrulaması (kronolojik aylık katlar Ağu–Kas 2026; BAĞIMSIZ DOĞRULAMA DEĞİL)

**Maske kuralı (SINYAL_SETI_RAPORU'ndan önceden türetildi, test sonucuna göre değiştirilmedi):** sinyal bir tipte AKTİF = özgün katkı ΔLL% noktası > 0 (GALOP için P2); ✓ → etkili, ○ pozitif → izlenir, ≤ 0 → KAPALI; n<200 test yarışlı tipte (Şartlı 2/19) maske uygulanmaz; Şartlı 1/27 yalnız J_SEVIYE+GALOP (kullanıcı kararı).
Kapalı sinyaller: MAIDEN: H2H_NET; HANDIKAP: GALOP_KAPASITE; KV: T_son; GRUP_SATIS: T_son.

| Küme | n yarış | Maskesiz Top1 | Maskeli Top1 | Maskesiz Top3 | Maskeli Top3 | Maskesiz log-loss | Maskeli log-loss | ΔLL (maskesiz − maskeli) [%95] |
|---|---|---|---|---|---|---|---|---|
| Tümü | 1958 | 24.9% | 25.2% | 56.0% | 55.9% | 2.0716 | 2.0727 | -0.0011 [-0.0080; 0.0061] |
| Maiden | 393 | 25.7% | 28.5% | 57.8% | 57.3% | 2.1085 | 2.1249 | -0.0164 [-0.0362; 0.0043] |
| Şartlı 3/4/5 | 492 | 25.2% | 24.8% | 57.1% | 57.3% | 2.0013 | 2.0061 | -0.0047 [-0.0097; 0.0005] |
| Şartlı 2/19 | 78 | 23.1% | 21.8% | 48.7% | 47.4% | 2.3054 | 2.3066 | -0.0012 [-0.0122; 0.0096] |
| Şartlı 1/27 | 82 | 29.3% | 29.3% | 65.9% | 65.9% | 2.0148 | 2.0100 | 0.0048 [0.0023; 0.0070] |
| Handikap | 548 | 21.2% | 22.1% | 50.9% | 51.1% | 2.1789 | 2.1697 | 0.0091 [-0.0055; 0.0261] |
| KV | 239 | 26.4% | 24.3% | 57.3% | 59.0% | 1.9054 | 1.9031 | 0.0023 [-0.0219; 0.0269] |
| Grup + Satış | 124 | 32.3% | 29.8% | 62.9% | 59.7% | 1.9842 | 1.9783 | 0.0059 [-0.0291; 0.0379] |

ΔLL > 0: maskeli model daha iyi (log-loss daha küçük). Aralık sıfırı içeriyorsa maske ile maskesiz arasında fark gösterilemedi.

## Dondurulmuş katsayılar (ölçekli birimler; maskeli veriyle eğitildi)
Eğitim: 5308 yarış (2026-01-01 → 2026-11-17); τ=1.12.
| Bileşen | β (ana model) |
|---|---|
| acc | 2.4060 |
| kap | 1.1874 |
| S | 0.3089 |
| H_180_3 | 0.5414 |
| sY | 0.5745 |
| sT | 0.5329 |
| Şartlı 1/27 modeli (J_SEVIYE, GALOP) | 0.5378, 2.9579 |