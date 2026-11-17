# GALOP ADAYI — Veri kalitesi, bileşenler, sızıntı denetimi ve test (2026-11-17)
**Bu rapor aday hesabın ÖLÇÜMÜDÜR; aktif sinyal DEĞİLDİR.** `SINYAL_KAYDI` boş kalır; motora ekleme yalnız kullanıcı onayıyla. Katsayı/ağırlık öğrenilmedi, bileşen seçilmedi.

## 1. Ham galop verisi (Adım 1: tamamlama + mükerrer temizliği)
| Ölçü | Değer |
|---|---|
| Veritabanındaki ham galop satırı | 75228 |
| tjkAtId'siz (kullanılamaz) | 22 |
| Normalleştirilemeyen (neden aşağıda) | 2308 |
| Normalleştirilen | 72898 |
| Mükerrer kaldırıldıktan sonra benzersiz idman | 54899 (kaldırılan 17999) |
| Karşılaştırma referansı kurulabilir (pist+tür+ırk biliniyor) | 54706 (99.6%) |
Normalleştirme red nedenleri: sure-yok 2141 · hiz-makul-degil 35 · mesafe<400 111 · sure-monoton-degil 21
Tür: GALOP 46938 · SPRINT 7767 · BILINMIYOR 193 · KENTER 1
Pist: KUM 51045 · SENTETIK 3661 · bilinmiyor 193
İç/dış: bilinmiyor 39820 · IC 14946 · DIS 133
Mesafe: 600 20006 · 800 16014 · 1000 9002 · 400 7761 · 1200 2015 · 1400 101
Efor kaydı: 4 46124 · 1 4156 · 2 2321 · 5 1414 · 3 743 · yok 141  (5=ÇR 4=R 3=HR 2=HÇ 1=Ç)
Hipodrom: galop kaydında idman hipodromu YOK (`İ.Hip.` sütunu kaydımızda tutulmuyor) → hipodrom bazlı grup KURULAMADI, uydurulmadı. Pist durumu (P.Dur) de yok.

## 2. Test popülasyonu
/admin/kosu-tipleri yarışları: **1510** yarış, 15487 at (2026-08-16 → 2026-11-17). Galop referansı ve her at için galop görünümü yalnız o yarış gününden ÖNCEKİ kayıtlardan kurulur.

## 3. Sızıntı denetimi (gelecek-bozma metamorfik testi)
Yarış günü t ve sonrasındaki TÜM galop değerleri/efor kodları bozulup, uç değerli gelecek galop ve gelecek koşu günü eklenerek bileşenler yeniden hesaplandı. 6 farklı yarış günü, 903 at (786 atta hız bileşeni dolu → test boş geçmedi).
**Sonuç: GEÇTİ — tüm bileşenler birebir aynı, sızıntı yok.** Ek olarak birim testleri (`galop-aday.test.ts`) ve yapısal kural (saf dosya: db/ağ/saat/rastgele yok) geçiyor.

## 4. Test sonuçları (ileri-genişleyen kronolojik; 1259 test yarışı)
Yöntem: yarışlar tarihe göre 6 bloğa bölünür; blok k için β YALNIZ blok 0..k−1'den öğrenilir (tek parametre, ridge 0.02), blok k'da olasılık = yarış-içi softmax(β·x). Eksik değer 0 puan SAYILMAZ: yarışın veri-olan atlarının ortalamasına (nötr) eşitlenir; yarışta <2 atta veri varsa o yarış sinyalsiz (1/N) kalır. z-bileşenleri ±3'e kırpılır (aşırı uç koruması; bildirilen teknik sınır). **Taban = sinyal-siz 1/N.** Δ = aday − taban; köşeli parantez = eşleştirilmiş bootstrap %95 AA (1000). ΔLL>0 = aday daha iyi.

| Ölçüm | Veri olan at | Veri ≥%50 olan yarış | Top1 | Top3 | Log-loss | ΔLog-loss (taban−aday) | β (blok 1…5) |
|---|---|---|---|---|---|---|---|
| HIZ (genel hız, z) | 82.3% | 95.9% | 12.8% (taban 10.7%) Δ2.14 [0.45; 4.00] | 37.4% (taban 32.0%) Δ5.42 [2.81; 8.10] | 2.2766 (taban 2.2895) | 0.0130 [0.0048; 0.0206] | 0.22 / 0.29 / 0.26 / 0.30 / 0.29 |
| KAPANIŞ (son 400, z) | 77.0% | 92.4% | 11.1% (taban 10.7%) Δ0.42 [-1.38; 2.25] | 35.3% (taban 32.0%) Δ3.31 [0.89; 5.79] | 2.2869 (taban 2.2895) | 0.0027 [-0.0019; 0.0074] | 0.11 / 0.16 / 0.14 / 0.15 / 0.14 |
| EFOR (z) | 82.3% | 96.2% | 11.4% (taban 10.7%) Δ0.71 [-0.13; 1.68] | 34.7% (taban 32.0%) Δ2.70 [1.33; 4.22] | 2.2788 (taban 2.2895) | 0.0107 [0.0032; 0.0184] | 0.31 / 0.26 / 0.21 / 0.22 / 0.23 |
| TREND (gelişim, z farkı) | 26.1% | 14.5% | 11.0% (taban 10.7%) Δ0.38 [-0.95; 1.82] | 32.3% (taban 32.0%) Δ0.31 [-1.32; 1.91] | 2.2901 (taban 2.2895) | -0.0006 [-0.0027; 0.0012] | -0.18 / -0.09 / -0.08 / -0.02 / -0.06 |
| SÜREKLİLİK (28g idman günü) | 82.5% | 96.2% | 12.3% (taban 10.7%) Δ1.62 [0.07; 3.28] | 34.2% (taban 32.0%) Δ2.20 [0.06; 4.25] | 2.2888 (taban 2.2895) | 0.0007 [-0.0006; 0.0019] | 0.01 / 0.01 / 0.01 / 0.02 / 0.03 |
| GALOP_KAPASITE (yarış-içi yüzdelik ort.) | 82.5% | 96.2% | 15.7% (taban 10.7%) Δ5.01 [3.11; 7.05] | 38.8% (taban 32.0%) Δ6.84 [4.52; 9.58] | 2.2688 (taban 2.2895) | 0.0207 [0.0085; 0.0327] | 1.50 / 1.88 / 1.66 / 1.66 / 1.58 |
| GALOP_HAZIRLIK (yarış-içi yüzdelik ort.) | 82.5% | 96.2% | 11.9% (taban 10.7%) Δ1.24 [-0.44; 2.99] | 33.2% (taban 32.0%) Δ1.27 [-0.90; 3.58] | 2.2888 (taban 2.2895) | 0.0007 [-0.0016; 0.0033] | 0.26 / 0.21 / 0.12 / 0.22 / 0.25 |
| BİRLEŞİK α=0 (α·KAPASİTE+(1−α)·HAZIRLIK) | 82.5% | 96.2% | 11.9% (taban 10.7%) Δ1.24 [-0.30; 3.04] | 33.2% (taban 32.0%) Δ1.27 [-1.13; 3.48] | 2.2888 (taban 2.2895) | 0.0007 [-0.0018; 0.0032] | 0.26 / 0.21 / 0.12 / 0.22 / 0.25 |
| BİRLEŞİK α=0.25 (α·KAPASİTE+(1−α)·HAZIRLIK) | 82.5% | 96.2% | 11.7% (taban 10.7%) Δ1.09 [-0.57; 2.89] | 35.5% (taban 32.0%) Δ3.58 [1.16; 5.93] | 2.2859 (taban 2.2895) | 0.0036 [-0.0014; 0.0086] | 0.59 / 0.60 / 0.46 / 0.58 / 0.61 |
| BİRLEŞİK α=0.5 (α·KAPASİTE+(1−α)·HAZIRLIK) | 82.5% | 96.2% | 12.7% (taban 10.7%) Δ2.07 [0.29; 3.84] | 37.8% (taban 32.0%) Δ5.85 [3.24; 8.53] | 2.2780 (taban 2.2895) | 0.0115 [0.0032; 0.0197] | 1.30 / 1.45 / 1.19 / 1.33 / 1.35 |
| BİRLEŞİK α=0.75 (α·KAPASİTE+(1−α)·HAZIRLIK) | 82.5% | 96.2% | 14.6% (taban 10.7%) Δ3.96 [2.15; 5.88] | 39.1% (taban 32.0%) Δ7.13 [4.56; 9.72] | 2.2682 (taban 2.2895) | 0.0213 [0.0090; 0.0331] | 1.94 / 2.28 / 1.95 / 2.02 / 1.98 |
| BİRLEŞİK α=1 (α·KAPASİTE+(1−α)·HAZIRLIK) | 82.5% | 96.2% | 15.7% (taban 10.7%) Δ5.01 [3.31; 6.95] | 38.8% (taban 32.0%) Δ6.84 [4.25; 9.46] | 2.2688 (taban 2.2895) | 0.0207 [0.0091; 0.0324] | 1.50 / 1.88 / 1.66 / 1.66 / 1.58 |

**Yalnız sahanın ≥%50'sinde galop verisi olan yarışlarda** (çok idman kaydı olan atlar avantajlı görünmesin diye ayrıca):
| Ölçüm | Yarış | Δ |
|---|---|---|
| HIZ (genel hız, z) | 1208 | ΔLL 0.0134 [0.0056; 0.0213] | ΔTop1 2.09 [0.20; 4.05] |
| KAPANIŞ (son 400, z) | 1163 | ΔLL 0.0027 [-0.0022; 0.0074] | ΔTop1 0.07 [-1.63; 1.94] |
| EFOR (z) | 1211 | ΔLL 0.0115 [0.0033; 0.0202] | ΔTop1 0.69 [-0.15; 1.60] |
| TREND (gelişim, z farkı) | 182 | ΔLL 0.0048 [-0.0050; 0.0130] | ΔTop1 2.55 [-2.30; 8.14] |
| SÜREKLİLİK (28g idman günü) | 1211 | ΔLL 0.0008 [-0.0006; 0.0021] | ΔTop1 1.61 [-0.06; 3.28] |
| GALOP_KAPASITE (yarış-içi yüzdelik ort.) | 1211 | ΔLL 0.0205 [0.0089; 0.0322] | ΔTop1 4.85 [2.98; 6.96] |
| GALOP_HAZIRLIK (yarış-içi yüzdelik ort.) | 1211 | ΔLL 0.0007 [-0.0021; 0.0034] | ΔTop1 1.21 [-0.51; 3.04] |
| BİRLEŞİK α=0 (α·KAPASİTE+(1−α)·HAZIRLIK) | 1211 | ΔLL 0.0007 [-0.0018; 0.0031] | ΔTop1 1.21 [-0.46; 2.99] |
| BİRLEŞİK α=0.25 (α·KAPASİTE+(1−α)·HAZIRLIK) | 1211 | ΔLL 0.0036 [-0.0013; 0.0083] | ΔTop1 0.95 [-0.78; 2.68] |
| BİRLEŞİK α=0.5 (α·KAPASİTE+(1−α)·HAZIRLIK) | 1211 | ΔLL 0.0114 [0.0030; 0.0205] | ΔTop1 2.01 [0.11; 4.06] |
| BİRLEŞİK α=0.75 (α·KAPASİTE+(1−α)·HAZIRLIK) | 1211 | ΔLL 0.0211 [0.0084; 0.0330] | ΔTop1 3.77 [1.87; 5.93] |
| BİRLEŞİK α=1 (α·KAPASİTE+(1−α)·HAZIRLIK) | 1211 | ΔLL 0.0205 [0.0084; 0.0335] | ΔTop1 4.85 [2.79; 6.77] |

## 5b. TOP1 / TOP3 — düz sıralama (parametresiz)
Her yarışta atlar adayın puanına göre sıralanır (en yüksek = 1.). **Top1** = puanı en yüksek olan atın kazandığı yarış oranı; **Top3** = kazananın puana göre ilk 3 içinde olduğu yarış oranı. Hiçbir katsayı öğrenilmedi (β yok), tüm 1510 yarış. Galop verisi olmayan atlar nötr (veri olanların ortalaması) alınır; eşit puanlı atlar arasında beraberlik payı eşit bölünür. **Rastgele** = sinyalsiz tahmin (1/N ve 3/N ortalaması).

**GALOP_KAPASITE (yarış-içi yüzdelik ort.)**
| Koşu tipi | Yarış | Top1 isabet | Top1 rastgele | Top3 isabet | Top3 rastgele |
|---|---|---|---|---|---|
| TÜMÜ | 1510 | 235 (15.6%) | 10.8% | 587 (38.9%) | 32.3% |
| Maiden | 301 | 44 (14.7%) | 9.4% | 118 (39.1%) | 28.2% |
| Şartlı | 499 | 92 (18.4%) | 11.2% | 200 (40.0%) | 33.6% |
| Handikap | 418 | 49 (11.8%) | 9.8% | 141 (33.8%) | 29.5% |
| KV | 194 | 41 (20.9%) | 13.6% | 91 (47.1%) | 40.9% |
| Satış | 42 | 2 (4.8%) | 11.1% | 13 (29.8%) | 33.2% |
| Veri ≥%50 olan yarışlar | 1460 | 226 (15.5%) | 10.8% | 569 (39.0%) | 32.3% |

**GALOP_HAZIRLIK (yarış-içi yüzdelik ort.)**
| Koşu tipi | Yarış | Top1 isabet | Top1 rastgele | Top3 isabet | Top3 rastgele |
|---|---|---|---|---|---|
| TÜMÜ | 1510 | 177 (11.7%) | 10.8% | 506 (33.5%) | 32.3% |
| Maiden | 301 | 33 (11.0%) | 9.4% | 96 (32.0%) | 28.2% |
| Şartlı | 499 | 56 (11.2%) | 11.2% | 173 (34.6%) | 33.6% |
| Handikap | 418 | 38 (9.1%) | 9.8% | 115 (27.6%) | 29.5% |
| KV | 194 | 33 (16.9%) | 13.6% | 86 (44.5%) | 40.9% |
| Satış | 42 | 8 (19.0%) | 11.1% | 15 (34.9%) | 33.2% |
| Veri ≥%50 olan yarışlar | 1460 | 171 (11.7%) | 10.8% | 490 (33.6%) | 32.3% |

**BİRLEŞİK α=0.5 (α·KAPASİTE+(1−α)·HAZIRLIK)**
| Koşu tipi | Yarış | Top1 isabet | Top1 rastgele | Top3 isabet | Top3 rastgele |
|---|---|---|---|---|---|
| TÜMÜ | 1510 | 191 (12.7%) | 10.8% | 573 (37.9%) | 32.3% |
| Maiden | 301 | 32 (10.7%) | 9.4% | 111 (37.0%) | 28.2% |
| Şartlı | 499 | 67 (13.5%) | 11.2% | 201 (40.4%) | 33.6% |
| Handikap | 418 | 40 (9.6%) | 9.8% | 125 (30.0%) | 29.5% |
| KV | 194 | 35 (18.2%) | 13.6% | 96 (49.6%) | 40.9% |
| Satış | 42 | 6 (14.3%) | 11.1% | 14 (34.2%) | 33.2% |
| Veri ≥%50 olan yarışlar | 1460 | 184 (12.6%) | 10.8% | 554 (37.9%) | 32.3% |

**Temiz sıralama testi (yokluk etkisi ayrıldı):** Galop verisi olmayan atlar sahadan çıkarılır; sıralama yalnız verisi olan atlar arasında yapılır ve yalnız kazananın da verisi olduğu yarışlarda sayılır. Bu koşulda sıralama bilgisizse Top1 = 1/n, Top3 = 3/n olur; aradaki fark yalnız galop puanının bilgisidir. (Kazananı galopsuz olan yarışlar: veri-yokluğunun kendi etkisi — bu ayrı raporlanır.)

**GALOP_KAPASITE (yarış-içi yüzdelik ort.)** — temiz test
| Koşu tipi | Yarış (sayılan/toplam) | Kazananı galopsuz | Top1 | Rastgele | Top3 | Rastgele |
|---|---|---|---|---|---|---|
| TÜMÜ | 1294/1510 | 205 | 17.8% | 12.7% | 45.0% | 38.0% |
| Maiden | 260/301 | 40 | 16.8% | 11.0% | 44.4% | 32.9% |
| Şartlı | 431/499 | 63 | 20.6% | 13.4% | 46.6% | 40.3% |
| Handikap | 348/418 | 68 | 13.7% | 11.8% | 39.6% | 35.4% |
| KV | 172/194 | 20 | 23.4% | 15.3% | 52.9% | 46.0% |
| Satış | 30/42 | 11 | 6.7% | 13.6% | 44.4% | 40.8% |

**GALOP_HAZIRLIK (yarış-içi yüzdelik ort.)** — temiz test
| Koşu tipi | Yarış (sayılan/toplam) | Kazananı galopsuz | Top1 | Rastgele | Top3 | Rastgele |
|---|---|---|---|---|---|---|
| TÜMÜ | 1294/1510 | 205 | 13.3% | 12.7% | 39.0% | 38.0% |
| Maiden | 260/301 | 40 | 12.7% | 11.0% | 36.4% | 32.9% |
| Şartlı | 431/499 | 63 | 12.4% | 13.4% | 41.5% | 40.3% |
| Handikap | 348/418 | 68 | 10.4% | 11.8% | 32.3% | 35.4% |
| KV | 172/194 | 20 | 18.7% | 15.3% | 49.8% | 46.0% |
| Satış | 30/42 | 11 | 26.5% | 13.6% | 41.9% | 40.8% |

## 5. Yön varsayılmayan betimleyiciler (bileşik puana GİRMEDİ)
Kazanma oranı ÷ beklenen (Σ1/N). 1,00 = beklenenle aynı. Yalnız betimleme; sıralama/hüküm değildir.

**Son galoptan yarışa kalan gün**
| Kova | At | Kazanan | Beklenen | Oran |
|---|---|---|---|---|
| 0–2 | 8180 | 830.0 | 791.5 | 1.05 |
| 3–4 | 2638 | 275.0 | 265.7 | 1.03 |
| 5–7 | 1748 | 182.0 | 180.9 | 1.01 |
| 8–14 | 224 | 18.0 | 21.3 | 0.85 |
| 15+ | 63 | 0.0 | 5.5 | 0.00 |
| bilinmiyor | 2634 | 205.0 | 245.1 | 0.84 |

**Aradan dönüş (önceki koşudan beri gün)**
| Kova | At | Kazanan | Beklenen | Oran |
|---|---|---|---|---|
| ≤21 | 10632 | 1076.0 | 1032.1 | 1.04 |
| 22–35 | 2164 | 234.0 | 216.0 | 1.08 |
| 36–60 | 830 | 82.0 | 81.2 | 1.01 |
| 61–120 | 683 | 38.0 | 63.6 | 0.60 |
| >120 | 343 | 8.0 | 30.3 | 0.26 |
| bilinmiyor | 835 | 72.0 | 86.9 | 0.83 |

**Hazırlık yükü: son 28 gün toplam galop metresi**
| Kova | At | Kazanan | Beklenen | Oran |
|---|---|---|---|---|
| ≤1600 | 8130 | 785.0 | 783.0 | 1.00 |
| 1601–3000 | 3081 | 339.0 | 315.5 | 1.07 |
| 3001–5000 | 1283 | 160.0 | 129.9 | 1.23 |
| >5000 | 328 | 21.0 | 33.7 | 0.62 |
| bilinmiyor | 2665 | 205.0 | 247.8 | 0.83 |

**Son 28 günde en uzun idmansız boşluk (gün)**
| Kova | At | Kazanan | Beklenen | Oran |
|---|---|---|---|---|
| ≤3 | 1206 | 128.0 | 120.8 | 1.06 |
| 4–6 | 3450 | 417.0 | 358.1 | 1.16 |
| 7–10 | 2080 | 212.0 | 205.8 | 1.03 |
| >10 | 501 | 34.0 | 47.5 | 0.72 |
| bilinmiyor | 8250 | 719.0 | 777.8 | 0.92 |

**Veri-var etkisi (galop kaydı olan / olmayan atlar):** kayıtlı 12853 at, kazanan 1305.0, beklenen 1264.9, oran 1.03 · kayıtsız 2634 at, kazanan 205.0, beklenen 245.1, oran 0.84. (İkisi arasındaki fark, galop verisinin KENDİSİNİN değil veri bulunmasının taşıdığı bilgidir; bileşenler bu yüzden eksiği nötr bırakır.)

## 6. Bileşen kapsamı ve veri güveni (15487 at-yarış)
| Ölçü | At | Oran |
|---|---|---|
| ≥1 galop (önceki koşudan sonra) | 12853 | 83.0% |
| Hız bileşeni hesaplanabildi | 12824 | 82.8% |
| Kapanış bileşeni hesaplanabildi | 12013 | 77.6% |
| Efor bileşeni hesaplanabildi | 12827 | 82.8% |
| Trend hesaplanabildi (≥2 karşılaştırılabilir galop) | 4102 | 26.5% |
| Süreklilik (28g) hesaplanabildi | 12853 | 83.0% |
| Önceki koşu tarihi biliniyor | 14652 | 94.6% |
| Hiç galop kaydı yok / bileşenlerin tamamı bilinmiyor | 2634 | 17.0% |

Atın hız bileşeninde kullanılan EN GEVŞEK referans seviyesi dağılımı (1=en ayrıntılı): seviye 1: 3167 at · seviye 2: 9343 at · seviye 3: 314 at. **Uyarı:** iç/dış bilgisi olan galoplar seviye-1 havuzuna, bilgisi olmayanlar seviye-2 havuzuna girer; aynı yarışta farklı havuzlara göre hesaplanmış z'ler karşılaştırılabilir ama TAM aynı referans değildir (iç/dış kaydı galopların ~%73'ünde yok).

Referans seviyesi: 1 = ırk+yaş+mesafe+pist+tür+iç/dış (≥30 geçmiş galop), 2 = iç/dış olmadan, 3 = yaş olmadan. Hiçbir seviyede ≥30 galop yoksa bileşen BİLİNMİYOR (uydurulmaz). Hipodrom ve pist durumu kaydımızda olmadığından kesin performans sıralaması YAPILAMAZ; z-değerleri yalnız "benzer koşulda kendi grubuna göre" okunur.

## 7. Bildirilen teknik varsayımlar (kullanıcı onayına tabi — öğrenilmedi)
- Efor sırası ÇR>R>HR>HÇ>Ç (5…1) yalnız sıralamayı kullanır; efor katkısı tarihsel sonuçla doğrulanmadı (yukarıdaki EFOR satırı betimleyicidir).
- Bileşen başına son 3 geçerli galobun ortalaması; trend = aynı (mesafe/tür/pist) grubunda son−ilk hız-z; süreklilik = son 28 gün farklı idman günü; pencere = atın önceki koşusundan sonrası (önceki koşu yoksa son 60 gün).
- KAPASİTE/HAZIRLIK = ilgili bileşenlerin YARIŞ-İÇİ yüzdeliklerinin eşit ağırlıklı ortalaması (ağırlık öğrenilmedi). Yük, aradan dönüş, son-idman-günü ve boşluk yön varsayılmadığı için bileşik puana GİRMEDİ.
- 400 m sprint, 800 m galobun son 400 m'siyle eşitlenmez: referans grubu mesafe+tür bazında ayrıdır.