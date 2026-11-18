# RAN F6 — maskesiz katsayılar ve kronolojik geriye dönük test (BAĞIMSIZ DOĞRULAMA DEĞİL)

Kullanıcı kararı 2026-11-18: tip bazlı ek kapatma YOK; beş sinyal ailesi (altı bileşen) veri varsa her tipte hesaplanır. Yalnız Şartlı 1/27'de (tüm atlar ilk kez koşan) geçmiş yarış gerektiren sinyaller doğal olarak yoktur; J_SEVIYE + GALOP_KAPASITE, ayrı katsayıyla.

Kronolojik aylık katlar (Ağu–Kas 2026), keşif örneklemidir.

| Küme | n yarış | Top1 | Top3 | Log-loss |
|---|---|---|---|---|
| Tümü | 1959 | 24.9% | 55.9% | 2.0718 |
| Maiden | 393 | 25.7% | 57.8% | 2.1085 |
| Şartlı 3/4/5 | 493 | 25.2% | 57.0% | 2.0021 |
| Şartlı 2/19 | 78 | 23.1% | 48.7% | 2.3054 |
| Şartlı 1/27 | 82 | 29.3% | 65.9% | 2.0148 |
| Handikap | 548 | 21.2% | 50.9% | 2.1789 |
| KV | 239 | 26.4% | 57.3% | 1.9054 |
| Grup + Satış | 124 | 32.3% | 62.9% | 1.9842 |

## Dondurulmuş katsayılar (ölçekli birimler; maskesiz veriyle eğitildi; 5309 yarış, τ=1.12; sürüm F6-2026-11-18)
acc 2.2853 · kap 1.1439 · S 0.3041 · H_180_3 0.5321 · sY 0.6281 · sT 0.4730 · Şartlı 1/27 modeli: S 0.5378, kap 2.9579.

Not: önceki maskeli sürüm ile maskesiz sürüm arasında anlamlı fark yoktu (önceki rapor: ΔLL −0.0011 [−0.0080; 0.0061]). Parite denetimi (52 yarış/539 at) altı özellikte %100, olasılık farkı 0.
