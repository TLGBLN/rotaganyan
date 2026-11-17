# ACCURACE ADAYLARI — MATEMATİKSEL DENETİM (ACC_HIZ, ACC_BITIRIS)
**Yeni test, yeni formül, katsayı, ağırlık veya sinyal YOK; `SINYAL_KAYDI` boş; iki hesap aday olarak duruyor.** Bu rapor formüllerin ne ölçtüğünü ve kusurlarının büyüklüğünü sayısal olarak denetler. 2. ve 3. bölümler **betimleyici/yapısal** analizlerdir (tüm yıl verisiyle, referans gruplarının yapısını incelemek için; tahmin puanı hesabı değildir ve yarış sonucuna hiç bakmaz). 4. bölümün artımlı ölçümü yarış-öncesi (as-of) puanlarla ve sonuç etiketiyle yapılır.
Veri: 48907 at-yarış Accurace kaydı, 48524 kullanılabilir. Denetlenen büyük referans grupları (ırk+zemin+hipodrom+mesafe; n≥200 ve ≥15 yarış): **84** grup, 32608 kayıt.

## 1. Formül sağlaması (matematiksel doğruluk)
- **Yüzdelik tanımı (HIZ):** referans üyelerinin kendi yüzdelik ortalaması tam 50 olmalı (yavaş oranı + beraberlikte yarım). 40 büyük grupta en büyük sapma: **7.11e-14** → tanım tutarlı.
- **Regresyon (BİTİRİŞ):** 40 grupta artıkların ortalaması ≈ 0 (en büyük |ort| = 8.35e-14 sn) ve artık ile erken süre arasındaki korelasyon ≈ 0 (en büyük |r| = 3.96e-16) → EKK doğru kurulmuş; artık, erken süreden **doğrusal olarak arındırılmış**.
- **Bağımsız yeniden hesap:** modüle bakmadan, ham kontrol noktalarından düz döngüyle, **120 rastgele at-yarış** (Haziran sonrası, kendi yarış günü t'ye göre as-of) için ACC_HIZ ve ACC_BITIRIS yeniden hesaplandı: **uyuşmayan 0**.
- **Not (HIZ puanı ortalama):** puan = son 3 yüzdelik puanın ORTALAMASI. Birkaç yüzdeliğin ortalaması artık düzgün dağılımlı bir yüzdelik değildir (merkeze sıkışır); puanlar atlar arası sıralamada kullanılabilir ama "50 = ortalama at" gibi okunmamalıdır.

## 2. ACC_HIZ — süreler adil karşılaştırılıyor mu?
Referans grubu (ırk + zemin + hipodrom + aynı mesafe) içinde bitiş süresi varyansı üç parçaya ayrıldı: **sınıf** (Maiden/Şartlı/Handikap/KV/Grup/Satış), sınıf içinde **yarışa özgü** kısım (gün/pist durumu/saha kalitesi/tempo; aynı yarıştaki tüm atlar ortak), ve **yarış-içi** (atlar arası) kısım. Pist durumu (P.Dur), hava ve ağırlık/yaş kayıtlı değil; bu yüzden yarışa özgü kısım gün + pist + saha etkisinin toplamıdır.
| Referans grubu (ırk · zemin · hip. · mesafe) | Kayıt | Yarış | sd (sn) | Sınıf | Yarışa özgü (gün/pist/saha) | Yarış-içi | Sınıf ortalama süreleri (sn, n) |
|---|---|---|---|---|---|---|---|
| INGILIZ · CIM · ANKARA · 1200 | 294 | 33 | 2.91 | 8.7% | 16.5% | 74.7% | Maiden 73.98 (108) · Şartlı 74.01 (92) · Handikap 72.20 (61) · KV 72.08 (24) · Grup 71.98 (9) |
| ARAP · KUM · ANKARA · 1500 | 258 | 29 | 4.52 | 21.2% | 9.9% | 68.9% | Maiden 112.27 (65) · Şartlı 108.26 (46) · Handikap 108.71 (73) · KV 107.47 (30) · Grup 106.03 (34) · Satış 107.79 (10) |
| ARAP · KUM · KOCAELI · 1200 | 455 | 43 | 4.19 | 8.1% | 13.3% | 78.6% | Maiden 89.03 (223) · Şartlı 87.87 (152) · Handikap 86.08 (61) · KV 84.89 (19) |
| ARAP · KUM · IZMIR · 1200 | 727 | 72 | 3.28 | 12.9% | 17.4% | 69.7% | Maiden 87.43 (248) · Şartlı 85.41 (266) · Handikap 85.01 (183) · KV 82.84 (22) · Satış 87.36 (8) |
| INGILIZ · CIM · BURSA · 1500 | 225 | 20 | 3.71 | 12.7% | 26.3% | 60.9% | Maiden 94.34 (68) · Şartlı 92.08 (37) · Handikap 91.06 (68) · KV 92.02 (47) · Satış 91.44 (5) |
| ARAP · KUM · IZMIR · 1400 | 814 | 80 | 4.06 | 19.4% | 13.4% | 67.2% | Maiden 103.90 (216) · Şartlı 100.98 (221) · Handikap 100.21 (248) · KV 98.40 (82) · Grup 97.46 (6) · Satış 102.43 (41) |
| ARAP · KUM · IZMIR · 1600 | 562 | 55 | 4.34 | 16.4% | 12.3% | 71.2% | Maiden 119.16 (119) · Şartlı 116.11 (212) · Handikap 115.82 (180) · KV 112.28 (41) · Grup 114.04 (10) |
| ARAP · SENTETIK · ISTANBUL · 1400 | 589 | 50 | 3.23 | 10.6% | 18.1% | 71.3% | Maiden 98.30 (147) · Şartlı 95.92 (155) · Handikap 96.45 (235) · KV 94.83 (39) · Satış 95.12 (13) |
| INGILIZ · KUM · IZMIR · 1900 | 543 | 68 | 3.95 | 17.1% | 23.2% | 59.7% | Maiden 130.41 (84) · Şartlı 127.23 (157) · Handikap 126.84 (200) · KV 124.41 (62) · Grup 124.99 (6) · Satış 128.36 (34) |
| INGILIZ · KUM · IZMIR · 1400 | 900 | 107 | 2.67 | 21.4% | 22.5% | 56.2% | Maiden 92.24 (240) · Şartlı 90.27 (280) · Handikap 89.75 (241) · KV 88.41 (97) · Grup 88.62 (13) · Satış 89.51 (29) |
| INGILIZ · KUM · SANLIURFA · 1800 | 211 | 18 | 8.34 | 3.4% | 25.2% | 71.4% | Maiden 134.41 (39) · Şartlı 130.65 (88) · Handikap 130.28 (84) |
| INGILIZ · KUM · SANLIURFA · 1300 | 231 | 19 | 4.55 | 3.6% | 35.5% | 60.9% | Maiden 87.68 (90) · Şartlı 88.34 (72) · Handikap 89.77 (69) |

**Tüm 84 grupta (varyansa göre ağırlıklı) — ham:** sınıf **%11.9** · sınıf içi yarışa özgü (gün+pist+saha) **%20.0** · yarış-içi (atlar arası) **%68.0**.
**Şansa göre düzeltilmiş** (hücre sayısı çoksa ham pay yukarı yanlıdır; beklenen şans payı = (hücre sayısı − 1)/(kayıt − 1) çıkarıldı): sınıf **%10.9** (şans payı %1.0) · sınıf içi yarışa özgü **%11.6** (şans payı %8.5) · kalan (yarış-içi + şans) **%77.5**.

**Sınıfın süre ofseti** (grup ortalamasından, grubun standart sapması biriminde; gruplar arası ortalama): Maiden +0.50 sd (80 grup) · Şartlı -0.06 sd (84 grup) · Handikap -0.19 sd (84 grup) · KV -0.57 sd (78 grup) · Grup -0.51 sd (42 grup) · Satış +0.02 sd (48 grup). (+ = daha yavaş.)

**Sınıfa göre ACC_HIZ yüzdeliği** (aynı grup içi yüzdelik; sınıfın ortalaması — sınıf düzeltmesi olmadığı için sınıf, puanı doğrudan kaydırır): Maiden 34.3 (n 8491) · Şartlı 52.0 (n 9510) · Handikap 55.2 (n 9761) · KV 70.0 (n 2795) · Grup 63.3 (n 903) · Satış 47.6 (n 1122)

## 3. ACC_BITIRIS — erken efor düzeltmesi gerçekten ne ölçüyor?
Mevcut formül: referans grubunda `son800 ~ a + b·erken` doğrusu **tüm atlar ve tüm yarışlar birlikte (çapraz-yarış)** kurulur; atın artığı yüzdelik puana çevrilir. Üç şey denetlendi: (i) eğim **işareti ve büyüklüğü**, (ii) aynı eğimin **yarış-içi** karşılığı, (iii) artığın yarışlar arası ortak (tempo/pist) bileşeni.
| Referans grubu | Kayıt | Çapraz-yarış eğim b (sn/sn) | R² | **Yarış-içi** eğim | Artığın yarışa özgü payı |
|---|---|---|---|---|---|
| INGILIZ · KUM · IZMIR · 1400 | 900 | 0.491 | 0.045 | 0.427 | 35.6% |
| ARAP · KUM · IZMIR · 1400 | 813 | 0.690 | 0.053 | 0.609 | 26.2% |
| ARAP · KUM · ELAZIG · 1200 | 788 | 0.859 | 0.029 | 0.690 | 13.5% |
| INGILIZ · KUM · IZMIR · 1200 | 759 | 0.958 | 0.166 | 0.865 | 22.5% |
| INGILIZ · SENTETIK · ISTANBUL · 1500 | 752 | 0.042 | 0.000 | -0.101 | 35.5% |
| ARAP · KUM · IZMIR · 1200 | 727 | 1.080 | 0.074 | 0.737 | 19.8% |
| ARAP · KUM · BURSA · 1400 | 695 | 0.820 | 0.029 | 0.698 | 21.2% |
| INGILIZ · KUM · ELAZIG · 1200 | 650 | 0.510 | 0.018 | -0.018 | 25.9% |
| INGILIZ · KUM · IZMIR · 1600 | 642 | 0.266 | 0.012 | 0.521 | 28.3% |
| INGILIZ · KUM · BURSA · 1400 | 615 | 0.380 | 0.011 | 0.577 | 35.2% |
| INGILIZ · SENTETIK · ISTANBUL · 1400 | 614 | -0.053 | 0.000 | -0.222 | 33.4% |
| ARAP · SENTETIK · ISTANBUL · 1500 | 609 | -0.236 | 0.007 | 0.018 | 40.0% |

**Özet (84 grup):** çapraz-yarış eğim b: medyan **0.382** (aralık -0.54 … 2.13); yarış-içi eğim: medyan **0.405**, ağırlıklı toplam **0.351**. Grup bazında iki eğim arasında |fark| > 0,3 olan: **33/84** grup; işareti farklı olan: **19/84**. Artığın **yarışa özgü** (aynı yarıştaki atlarda ortak) payı: ham **%26.6**, şansa göre düzeltilmiş **%16.9** (şans payı %9.7).
**Bitiş süresi varyansı nereden geliyor** (gruplar içi, ağırlıklı; ortak kovaryans eşit bölündü): erken bölüm payı **%12.5**, son 800 m payı **%87.5**.

**Okuma (hüküm değil, matematik):**
- **Eğimin işareti:** hem çapraz-yarış hem yarış-içi eğim ortalamada **pozitif** (0.38 / 0.35). Verideki ilişki "ilk bölümü yavaş koşan at kapanışta daha hızlı" değil, "erken yavaş olan kapanışta da yavaş": ortalamada kalite etkisi tempo-tasarrufu etkisinden baskın. Mevcut formül bu ortalama ilişkiyi (beklenen kapanış) çıkarıyor ve iki eğim ortalamada birbirine yakın; grup bazında ise 33/84 grupta fark 0,3 sn/sn'den büyük.
- **Yarışa özgü bileşen:** artığın şansa göre düzeltilmiş yaklaşık %17'i aynı yarışta koşan atlar için ortak (tempo, pist durumu, saha). ACC_BITIRIS bunu ayırmıyor; yarış-içi merkezleme bunu çıkarırdı (bu hesap yapılmadı, yalnız büyüklüğü ölçüldü).
- Bu bölüm erken eforun kapanışa "gerçek etkisini" tek başına kanıtlamaz: atlar arası eğim kalite ile tempoyu ayıramaz; yalnızca mevcut formülün ortalama ilişkiyi doğru çıkarıp çıkarmadığını denetler.

## 4. Özgün katkı: ACC_BITIRIS, ACC_HIZ'ın ötesinde bilgi taşıyor mu?
- **Tek yarış kaydı düzeyinde** (aynı yarıştaki HIZ ve BİTİRİŞ yüzdeliği; bitiş = erken + son 800 olduğu için mekanik bağ beklenir): Pearson 0.85, Spearman 0.85 (n 4660).
- **Yarış-öncesi puanlar arasında** (at düzeyi, ACC_HIZ ↔ ACC_BITIRIS, 35471 at-yarış): Pearson **0.84**, Spearman 0.82; **yarış-içi** (aynı yarışta ortalamadan sapmalar): Pearson **0.80**.
- **Artımlı ölçüm** (ileri-genişleyen kronolojik; 4109 test yarışı; β'lar yalnız GEÇMİŞ bloklardan öğrenilir; ölçü cihazıdır, model önerisi değildir; eksik puan yarış ortalamasıyla nötr): log-loss (düşük iyi). Taban = 1/N.
| Ölçüm | Log-loss | Δ (taban − ölçüm) [%95] | β (blok 1…5) |
|---|---|---|---|
| ACC_HIZ tek | 2.1274 | 0.1277 [0.1137; 0.1422] | 3.23 ; 3.57 ; 3.48 ; 3.44 ; 3.52 |
| ACC_BITIRIS tek | 2.1948 | 0.0603 [0.0495; 0.0703] | 2.22 ; 2.26 ; 2.07 ; 2.07 ; 2.16 |
| ACC_HIZ + ACC_BITIRIS | 2.1263 | 0.1288 [0.1150; 0.1441] | 3.26 / -0.04 ; 3.99 / -0.51 ; 4.15 / -0.82 ; 4.06 / -0.76 ; 4.04 / -0.63 |
- **HIZ'ın ötesinde BİTİRİŞ katkısı:** ΔLL (HIZ tek − HIZ+BİTİRİŞ) = **0.0011** [-0.0010; 0.0032] (pozitif = BİTİRİŞ eklenince iyileşme). **BİTİRİŞ'in ötesinde HIZ katkısı:** ΔLL (BİTİRİŞ tek − HIZ+BİTİRİŞ) = **0.0685** [0.0577; 0.0800].

## 5. Özet bulgular (matematiksel denetim)
1. **Formüller kendi tanımlarına göre doğru hesaplanıyor:** yüzdelik tanımı tutarlı, EKK artıkları sıfır ortalamalı ve erken süreden doğrusal olarak arındırılmış; bağımsız yeniden hesapta 120 at-yarışta 0 uyuşmazlık.
2. **HIZ adaleti:** zemin (kum/çim/sentetik), hipodrom ve mesafe referansta **ayrı** tutuluyor; **sınıf ayrılmıyor**. Ham: süre varyansının %12'i sınıfa, %20'i sınıf içi yarışa özgü etkilere bağlı; şansa göre düzeltilmiş: sınıf %11, yarışa özgü %12. Sınıf puanı doğrudan kaydırıyor (ortalama ACC_HIZ yüzdeliği: Maiden 34, KV 70). Pist durumu / gün etkisi ayrıştırılamıyor (kayıt yok).
3. **BİTİRİŞ efor düzeltmesi:** formül erken süreye göre beklenen kapanışı çıkarıyor ve bu işlem matematiksel olarak doğru (artık erken süreden arınık). Çapraz-yarış eğim (medyan 0.38) ile yarış-içi eğim (0.35) ortalamada yakın, grup bazında farklı (33/84 grupta >0,3). Artığın şansa göre düzeltilmiş yaklaşık %17'i yarışa özgü ve ayrıştırılmıyor. Bitiş süresi varyansının %88'i son 800 m'den geldiği için BİTİRİŞ, HIZ ile doğası gereği yüksek bağlı.
4. **Özgün katkı:** yarış-içi korelasyon 0.80; HIZ'a BİTİRİŞ eklendiğinde ΔLL 0.0011 [-0.0010; 0.0032]; BİTİRİŞ'e HIZ eklendiğinde ΔLL 0.0685 [0.0577; 0.0800].

## Sınırlar
- 2. ve 3. bölümler tüm yıl verisiyle referans **yapısını** inceler (as-of puan değil); amaç kusurun büyüklüğünü ölçmektir, tahmin gücü iddiası taşımaz. 1. bölümün bağımsız hesabı ile 4. bölüm as-of'tur.
- Pist durumu, hava, ağırlık, yaş ve cinsiyet kaydımızda yok; "yarışa özgü" varyans bunların toplamıdır, ayrıştırılamaz.
- Bu denetim formülü DEĞİŞTİRMEZ ve yeni bir hesap önermez; iki aday olduğu gibi duruyor, karar sizindir.