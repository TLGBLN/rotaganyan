# JOKEY MODELİ v1.0 — J_SEVIYE, J_FORM30, J_BEKLENTI (ham değerler + kronolojik test)
**Motorun aktif sinyal listesine hiçbir şey eklenmedi; katsayı/birleşim ağırlığı belirlenmedi; `SINYAL_KAYDI` boş.** Üç hesap AYRI tutuldu (genel seviye, güncel form, beklenti farkı karıştırılmadı).

## 0. Tanımlar, veri ve açık uyarılar
- **Binişler:** kendi `Runner`+`Result` kayıtlarımız (Karma/koşullu kopyalar hariç; `JockeyStatSync` KULLANILMADI). Galibiyet = `Result.winnerNos`'ta olma. **Tarih < yarış günü**: hedef yarışın günü ve aynı gün önceki koşular dahil değil (muhafazakâr; sitedeki 17 Kasım kesitiyle KARŞILAŞTIRILMAMALI).
- **J_SEVIYE** = W_ref/N_ref; referans = [t−365 gün, t−30 gün) (son 30 gün HARİÇ). **J_FORM30** = N30/(N30+8)·(W30/N30 − P_ref); son 30 gün = [t−30 gün, t). **J_BEKLENTI** = Σ(Y_i − P_i)/(N + k), son 30 gün, yalnız P_i'si bilinen binişler.
- **k = 8 GEÇİCİ SABİTTİR; öğrenilmedi** (talimatınız katsayı belirlememi yasakladığı için J_FORM30'daki 8 ile aynı ölçekte bıraktım; "eğitim verisiyle belirlenecek" ifadesi bu aşamada uygulanmadı — karar sizin).
- **P_i (jokeyden bağımsız beklenti):** yalnız ACC_HIZ + GALOP_KAPASITE'li yarış-içi softmax; her blokta β YALNIZ önceki bloklardan öğrenilir (ölçü cihazı; model önerisi değil), P_i o yarışın öncesinde bilinen bilgilerle üretilir. **Blok 0 (en eski ~%17 yarış) için P_i YOK**; P_i'si olmayan biniş J_BEKLENTI'ye girmez, kapsam her satırda gösterilir. Popülasyon dışı (16 Ağustos öncesi) binişler de P_i'siz kalır.
- **Veri sınırı:** veritabanımız **2026-01-01**'den başlar; "365 günlük referans" Ağustos–Kasım hedeflerinde 7–10 ay uzunluğundadır (J_SEVIYE ve J_FORM30'ın P_ref'i buna göre ölçülür). Tabela (ilk 5) oranı KULLANILMADI.
- Geçmişi olmayan jokey: değer **null (veri yok)**, negatif sayılmaz. J_FORM30 için P_ref (referansta biniş) ve N30 gerekir; J_BEKLENTI için P_i'si bilinen son-30-gün binişi gerekir.
- Gelecek-bozma testi (8 gün, 416 jokey: t ve sonrası bozuldu, aynı güne sahte biniş eklendi): **GEÇTİ — birebir aynı, sızıntı yok**. Bağımsız yeniden hesap (modüle bakmadan düz döngü, 150 rastgele jokey-yarış): **uyuşmayan 0**. Puanlar sonuç yüklenmeden önce hesaplandı.

## 1. Örnek: 16.11.2026 Bursa K1 — 9 jokeyin ham değerleri (as-of < 16.11.2026)
| No | At | Jokey | N_ref | W_ref | **J_SEVIYE (P_ref)** | N30 | W30 | oran30 | ağırlık N/(N+8) | **J_FORM30** | P_i'si bilinen biniş / N30 | W (bilinen) | E (beklenen) | **J_BEKLENTI** | Sitedeki 17.11 kesiti (Son 30G · Ref K%) |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | ARSLANBEYLİ | HIŞMAN ÇİZİK | 676 | 86 | 12.7% | 104 | 20 | 19.2% | 0.93 | +6.04 puan | 91/104 | 17 | 11.13 | +0.0593 | 19/107 · 12.1% |
| 2 | KUMKADI ASLANI | ALİ YILDIZ | 865 | 95 | 11.0% | 132 | 13 | 9.8% | 0.94 | -1.07 puan | 125/132 | 12 | 14.73 | -0.0205 | 14/130 · 9.6% |
| 3 | MİR BEG | MUHAMMED MİR BİLGİN | 968 | 190 | 19.6% | 100 | 21 | 21.0% | 0.93 | +1.27 puan | 94/100 | 20 | 11.57 | +0.0827 | 21/99 · 20.9% |
| 4 | MY NOBLE SON | MEHMET KAYA | 660 | 95 | 14.4% | 103 | 9 | 8.7% | 0.93 | -5.25 puan | 99/103 | 9 | 12.25 | -0.0304 | 9/111 · 13.3% |
| 5 | RAŞAMO | RECEP KETME | 580 | 46 | 7.9% | 82 | 7 | 8.5% | 0.91 | +0.55 puan | 75/82 | 6 | 6.91 | -0.0110 | 8/87 · 8.1% |
| 6 | HOLD ON TO LIFE | ALİCAN İNCİ | 355 | 31 | 8.7% | 57 | 7 | 12.3% | 0.88 | +3.11 puan | 54/57 | 7 | 4.59 | +0.0388 | 7/60 · 9.5% |
| 7 | WORKIN LADY | ONUR ATMACA | 517 | 30 | 5.8% | 50 | 1 | 2.0% | 0.86 | -3.28 puan | 45/50 | 1 | 3.68 | -0.0505 | 1/54 · 5.9% |
| 8 | MY LIFE ELİF | İSMAİL GÜN | 32 | 0 | 0.0% | 9 | 0 | 0.0% | 0.53 | +0.00 puan | 8/9 | 0 | 0.32 | -0.0200 | 0/11 · 0.0% |
| 9 | STEEL HUNTER | MAHMUT TURAN | 389 | 31 | 8.0% | 53 | 3 | 5.7% | 0.87 | -2.01 puan | 49/53 | 2 | 4.23 | -0.0392 | 4/62 · 9.3% |

Sitedeki sütun **yalnız karşılaştırma içindir** (17 Kasım kesiti: 16 Kasım yarışı sonuçları dahil olabilir, Karma/çift sayım ve farklı pencere farkları olabilir); hesaba girmedi. Bizim değerler 16.11 öncesi, kendi kayıtlarımızla.

## 2. Test popülasyonu ve kapsam
/admin/kosu-tipleri: **1510 yarış, 15487 at**; ileri-genişleyen 6 blok, **1259 test yarışı** (blok 1–5). Jokey binişi: 53088 (Karma/koşullu hariç).
| Ölçü | At | Oran |
|---|---|---|
| Jokey adı var | 15487 | 100.0% |
| J_SEVIYE var (referansta ≥1 biniş) | 15424 | 99.6% |
| J_FORM30 var (N30≥1 ve P_ref var) | 15337 | 99.0% |
| J_BEKLENTI var (P_i'si bilinen ≥1 biniş) | 12589 | 81.3% |
| Üçü de var | 12555 | 81.1% |
| N_ref ≥ 30 | 15059 | 97.2% |
| N30 ≥ 10 | 14651 | 94.6% |
| J_BEKLENTI'de P_i'si bilinen biniş ≥ 10 | 10935 | 70.6% |

J_BEKLENTI'de son-30-gün binişlerinin P_i'si bilinen payı (medyan): **%84**; medyan N_ref 299, medyan N30 53.

## 3. Kronolojik test: ACC_HIZ + GALOP_KAPASITE üzerine ek katkı
Ölçü cihazı: β'lar YALNIZ geçmiş bloklardan (ridge 0.02); eksik puan yarış ortalamasına (nötr); yön varsayımı yok. **ek katkı** = taban modelin log-loss'u − eklenmiş modelin log-loss'u (pozitif = iyileşme); Top1/Top3 farkı puan; köşeli parantez eşleştirilmiş bootstrap %95 (1000). Girdi ölçekleri sabit (P_ref/0,10; J_FORM30/0,06; J_BEKLENTI/0,03), formüller değişmedi.
| Ölçüm | Log-loss | ΔLL (taban 1/N − ölçüm) [%95] | Top1 (rastgele) | Top3 (rastgele) | β (blok 1…5) |
|---|---|---|---|---|---|
| M0. ACC_HIZ + GALOP_KAPASITE (taban) | 2.1362 | 0.1533 [0.1213; 0.1845] | 21.2% (10.7%) | 52.4% (32.0%) | 3.67/1.46 ; 4.06/1.91 ; 3.90/1.65 ; 3.75/1.61 ; 3.63/1.48 |
| + J_SEVIYE | 2.0763 | 0.2133 [0.1792; 0.2466] | 23.1% (10.7%) | 57.8% (32.0%) | 3.18/1.32/0.54 ; 3.65/1.76/0.51 ; 3.45/1.46/0.55 ; 3.26/1.39/0.63 ; 3.13/1.29/0.64 |
| + J_FORM30 | 2.1358 | 0.1538 [0.1218; 0.1848] | 21.0% (10.7%) | 52.1% (32.0%) | 3.64/1.47/-0.08 ; 4.04/1.91/-0.09 ; 3.87/1.65/-0.10 ; 3.74/1.60/-0.10 ; 3.62/1.47/-0.09 |
| + J_BEKLENTI | 2.1212 | 0.1683 [0.1363; 0.1968] | 21.1% (10.7%) | 54.1% (32.0%) | 3.67/1.46/0.00 ; 4.06/1.90/0.04 ; 3.87/1.63/0.07 ; 3.69/1.57/0.12 ; 3.56/1.44/0.13 |
| + J_SEVIYE + J_FORM30 | 2.0751 | 0.2144 [0.1781; 0.2515] | 23.2% (10.7%) | 57.4% (32.0%) | 3.17/1.29/0.60/0.12 ; 3.64/1.75/0.55/0.09 ; 3.44/1.45/0.60/0.09 ; 3.24/1.39/0.68/0.11 ; 3.11/1.28/0.68/0.10 |
| + J_SEVIYE + J_BEKLENTI | 2.0772 | 0.2124 [0.1776; 0.2454] | 23.4% (10.7%) | 57.5% (32.0%) | 3.18/1.32/0.54/0.00 ; 3.65/1.77/0.53/-0.04 ; 3.45/1.47/0.57/-0.02 ; 3.26/1.39/0.62/0.01 ; 3.13/1.29/0.63/0.01 |
| + J_FORM30 + J_BEKLENTI | 2.1128 | 0.1767 [0.1454; 0.2083] | 21.7% (10.7%) | 54.3% (32.0%) | 3.64/1.47/-0.08/0.00 ; 4.03/1.90/-0.09/0.04 ; 3.83/1.61/-0.14/0.09 ; 3.64/1.54/-0.19/0.16 ; 3.50/1.41/-0.22/0.17 |
| + J_SEVIYE + J_FORM30 + J_BEKLENTI | 2.0757 | 0.2139 [0.1784; 0.2477] | 23.4% (10.7%) | 57.9% (32.0%) | 3.17/1.29/0.60/0.12/0.00 ; 3.63/1.75/0.59/0.10/-0.05 ; 3.43/1.45/0.64/0.12/-0.05 ; 3.23/1.39/0.71/0.13/-0.03 ; 3.10/1.28/0.73/0.14/-0.04 |
| Yalnız J_SEVIYE | 2.1802 | 0.1093 [0.0880; 0.1307] | 19.9% (10.7%) | 50.3% (32.0%) | 0.71 ; 0.72 ; 0.75 ; 0.82 ; 0.83 |
| Yalnız J_FORM30 | 2.2882 | 0.0013 [-0.0031; 0.0055] | 10.9% (10.7%) | 34.0% (32.0%) | -0.13 ; -0.14 ; -0.15 ; -0.14 ; -0.12 |
| Yalnız J_BEKLENTI | 2.2654 | 0.0241 [0.0151; 0.0344] | 15.7% (10.7%) | 40.3% (32.0%) | 0.00 ; 0.07 ; 0.10 ; 0.16 ; 0.16 |

**Ek katkılar** (Top1/Top3: puan; ΔLL: pozitif = iyileşme):
| Karşılaştırma | Yarış | ΔLL ek katkı [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| J_SEVIYE → taban | 1259 | 0.0599 [0.0417; 0.0756] | 1.96 [0.05; 4.21] | 5.47 [3.03; 7.97] |
| J_FORM30 → taban | 1259 | 0.0004 [-0.0023; 0.0034] | -0.11 [-1.10; 0.99] | -0.25 [-1.27; 0.85] |
| J_BEKLENTI → taban | 1259 | 0.0150 [0.0078; 0.0224] | -0.03 [-1.24; 1.31] | 1.69 [0.42; 3.14] |
| J_SEVIYE + J_FORM30 → taban | 1259 | 0.0611 [0.0435; 0.0781] | 2.04 [-0.16; 4.17] | 5.07 [2.61; 7.48] |
| J_FORM30 + J_BEKLENTI → taban | 1259 | 0.0234 [0.0164; 0.0304] | 0.53 [-0.95; 1.88] | 1.97 [0.58; 3.52] |
| üçü birlikte → taban | 1259 | 0.0605 [0.0433; 0.0763] | 2.28 [0.04; 4.49] | 5.55 [3.08; 8.18] |
| **J_BEKLENTI → taban + J_FORM30** (aynı bilgi mi?) | 1259 | 0.0229 [0.0148; 0.0321] | 0.64 [-0.64; 1.91] | 2.22 [0.71; 3.73] |
| **J_FORM30 → taban + J_BEKLENTI** (aynı bilgi mi?) | 1259 | 0.0084 [0.0044; 0.0126] | 0.56 [-0.60; 1.63] | 0.28 [-0.94; 1.51] |
| J_SEVIYE + J_BEKLENTI → taban | 1259 | 0.0590 [0.0432; 0.0760] | 2.20 [0.16; 4.42] | 5.15 [2.90; 7.66] |
| **J_FORM30 → taban + J_SEVIYE** (seviye dışında form bilgisi var mı?) | 1259 | 0.0011 [-0.0020; 0.0046] | 0.08 [-0.87; 1.03] | -0.40 [-1.51; 0.71] |
| **J_BEKLENTI → taban + J_SEVIYE** (seviye dışında beklenti bilgisi var mı?) | 1259 | -0.0009 [-0.0024; 0.0005] | 0.24 [-0.40; 0.79] | -0.32 [-0.95; 0.32] |
| **J_BEKLENTI → taban + J_SEVIYE + J_FORM30** | 1259 | -0.0005 [-0.0025; 0.0015] | 0.24 [-0.32; 0.79] | 0.48 [-0.08; 1.11] |
| **J_FORM30 → taban + J_SEVIYE + J_BEKLENTI** | 1259 | 0.0015 [-0.0012; 0.0043] | 0.08 [-0.79; 0.95] | 0.40 [-0.56; 1.35] |
| **J_FORM30 + J_BEKLENTI → taban + J_SEVIYE** (güncel bilgi, seviyenin ötesinde) | 1259 | 0.0006 [-0.0020; 0.0036] | 0.32 [-0.56; 1.19] | 0.08 [-0.79; 1.03] |

## 4. Sağlamlık ve bilgi tekrarı
- J_FORM30 ve J_BEKLENTI'nin ikisi de atların ≥%70'inde bulunan **1223** test yarışında: J_FORM30 → taban ΔLL 0.0001 [-0.0028; 0.0032], Top1 -0.11 [-1.14; 0.95], Top3 -0.34 [-1.40; 0.68]; J_BEKLENTI → taban ΔLL 0.0154 [0.0083; 0.0233], Top1 -0.03 [-1.25; 1.32], Top3 1.74 [0.37; 3.16]; BEKLENTİ → +FORM30 ΔLL 0.0236 [0.0151; 0.0319]; FORM30 → +BEKLENTİ ΔLL 0.0083 [0.0041; 0.0122].
- Korelasyon (Pearson / Spearman / **yarış-içi**; ikisi de olan atlar):
| Çift | Korelasyon |
|---|---|
| J_FORM30 ↔ J_BEKLENTI | 0.53 / 0.55 / **0.55** (n 12527) |
| J_SEVIYE ↔ J_FORM30 | -0.28 / -0.26 / **-0.28** (n 15333) |
| J_SEVIYE ↔ J_BEKLENTI | 0.50 / 0.40 / **0.46** (n 12527) |

## 5. Tarihsel kalibrasyon (0–100 ölçeğine ÇEVRİLMEDİ)
Ham değer beşte birliklerine (outcome'dan bağımsız eşikler; tüm değeri olan atlar) göre: gerçekleşen kazanma oranı ve jokeyden bağımsız beklenen (P_i; yalnız P_i'si olan atlar). **Gözlenen − beklenen** pozitifse o kovadaki atlar jokey dışı bilgiye göre beklenenden fazla kazanmıştır. Bu tablo 0–100 dönüşümü için kalibrasyon girdisidir, dönüşüm yapılmadı.
**J_SEVIYE (P_ref)**
| Kova (düşük → yüksek) | At | Ort. ham değer | Kazanma oranı | Beklenen (P_i) | Gözlenen − beklenen (P_i'li atlarda) |
|---|---|---|---|---|---|
| 1 | 3103 | 0.0306 | 4.7% | 7.2% | -2.81 puan (n 2539) |
| 2 | 3072 | 0.0680 | 6.4% | 8.5% | -1.93 puan (n 2627) |
| 3 | 3085 | 0.0897 | 8.8% | 9.0% | -0.12 puan (n 2680) |
| 4 | 3083 | 0.1255 | 11.0% | 11.1% | -0.34 puan (n 2646) |
| 5 | 3081 | 0.2025 | 18.0% | 12.6% | 5.47 puan (n 2478) |

**J_FORM30**
| Kova (düşük → yüksek) | At | Ort. ham değer | Kazanma oranı | Beklenen (P_i) | Gözlenen − beklenen (P_i'li atlarda) |
|---|---|---|---|---|---|
| 1 | 3068 | -0.0590 | 11.0% | 10.3% | 0.19 puan (n 2615) |
| 2 | 3068 | -0.0246 | 9.3% | 9.6% | 0.03 puan (n 2554) |
| 3 | 3069 | -0.0042 | 9.2% | 9.3% | 0.22 puan (n 2638) |
| 4 | 3066 | 0.0147 | 10.8% | 9.7% | 0.73 puan (n 2614) |
| 5 | 3066 | 0.0497 | 8.7% | 9.6% | -1.04 puan (n 2479) |

**J_BEKLENTI**
| Kova (düşük → yüksek) | At | Ort. ham değer | Kazanma oranı | Beklenen (P_i) | Gözlenen − beklenen (P_i'li atlarda) |
|---|---|---|---|---|---|
| 1 | 2520 | -0.0499 | 7.7% | 9.1% | -1.46 puan (n 2520) |
| 2 | 2523 | -0.0249 | 7.0% | 8.7% | -1.72 puan (n 2523) |
| 3 | 2510 | -0.0074 | 8.7% | 9.2% | -0.56 puan (n 2510) |
| 4 | 2518 | 0.0198 | 10.9% | 9.9% | 0.99 puan (n 2518) |
| 5 | 2518 | 0.0730 | 14.6% | 11.4% | 3.18 puan (n 2518) |

## 6. Koşu tipine göre: J_FORM30 + J_BEKLENTI → taban (Top1/Top3 farkı, puan)
| Koşu tipi | Test yarışı | ΔLL ek katkı [%95] | Top1 farkı [%95] | Top3 farkı [%95] |
|---|---|---|---|---|
| Maiden | 256 | 0.0192 [0.0046; 0.0352] | -1.17 [-3.91; 1.17] | 3.39 [0.26; 6.64] |
| Şartlı | 411 | 0.0254 [0.0123; 0.0372] | 2.60 [0.53; 4.87] | 1.99 [-0.61; 4.58] |
| Handikap | 352 | 0.0154 [0.0013; 0.0303] | -0.85 [-3.69; 1.99] | -0.85 [-3.69; 1.99] |
| KV | 155 | 0.0294 [0.0079; 0.0484] | 1.29 [-2.58; 5.81] | 6.45 [3.23; 10.97] |
| Grup | 48 | 0.0413 [0.0037; 0.0801] | -2.08 [-12.50; 6.25] | 0.00 [-8.33; 8.33] |
| Satış | 35 | 0.0602 [0.0176; 0.1035] | 2.86 [-5.71; 14.29] | 2.86 [0.00; 8.57] |

## Sınırlar
- Taban 1/N (sinyalsiz) ve zayıf; piyasa/AGF veya motorun diğer sinyalleriyle kıyas değildir. β'lar yalnız ölçü cihazıdır. Çoklu karşılaştırma düzeltilmedi; koşu tipi tabloları küçük örneklidir.
- **Jokey ↔ at ayrımı:** J_BEKLENTI'nin P_i'si yalnız ACC_HIZ + GALOP_KAPASITE'den gelir; bu iki puan atı tam açıklamaz (örneğin sınıf, kilo, form, kulvar yok). Beklenen eksik kaldığı ölçüde, jokey bu eksik bilgiye bağlı "beklenti üstü" görünebilir. Bu yüzden J_BEKLENTI de "jokeyin bağımsız katkısı" kanıtı DEĞİLDİR.
- Veritabanı 2026-01-01'den başlar (referans penceresi kısa); P_i blok 0 ve 16 Ağustos öncesi binişlerde yok; k geçici sabit. Aynı gün önceki koşular bilerek dışarıda. Tarihsel kalibrasyon yapıldı, 0–100 dönüşümü yapılmadı.