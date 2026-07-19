# ROTAGANYAN ANSİKLOPEDİSİ v4.1

## I. ANAYASA

### 1. Sistemin amacı
ROTAGANYAN bir "kesin kazanan makinesi" değildir. Aynı yarıştaki atları aynı veri disipliniyle değerlendiren, gerekçeleri görünür kılan, hataları yarış sonrasında sınıflandıran ve zamanla kalibre edilen bir karar çerçevesidir.

Üç katman birbirine karıştırılamaz:
1. **Ham veri** — kaynaktan görülen gerçek bilgi.
2. **Değerlendirme** — verinin yarış bağlamındaki anlamı.
3. **Karar** — sıralama, kupon, banko.

### 2. En temel ilke
**Kanıt yokluğu, olumsuz kanıt değildir.**

Zorunlu sonuçları:
- Hiç koşmamış at, kötü koşmuş sayılmaz.
- Tek startlı at, kötü sicilli sayılmaz.
- Exact kaydı olmayan at, exactta başarısız sayılmaz.
- Jokey veya antrenörün düşük yüzdesi tek başına ceza değildir.
- Handikapta dalgalı form tek başına bozulma değildir.
- H2H mağlubiyeti; kilo/takı/mesafe/sınıf değiştiyse güçlü negatif kanıt değildir.
- HP ivmesinin bilinmemesi, atı düşürme sebebi değildir — araştır, bul.
- Pedigri, ilk-start veya exactsız maiden atlarda tek olumlu dayanak olabilir.

### 3. Dürüstlük sınırı
- Skor kazanma olasılığı değildir; aynı yarış içi sıralama aracıdır.
- Ağırlıklar kalibre edilmemiş hipotezlerdir.
- Bir yarıştaki puan başka yarıştaki puanla kıyaslanmaz.
- Yüksek oran tek başına value değildir; düşük AGF tek başına value değildir.
- Piyasa oranı gerçek olasılıktan kesinti düşülerek oluşur.
- Bankroll yönetimi analizden önce gelir.
- Tek yarıştan yeni kalıcı kural çıkarılmaz.

---

## II. HYBRID SCORE KATMANLARI

| Katman | Görev | Puan |
|---|---|---:|
| A | Gerçek kaliteyi belirler — sistemin ana motoru | 60 |
| B+C | Sıralamayı ince ayarlar, sürpriz yakalar | 40 |

Ölçülen gerçek (13.07.2026, 114 at): A puanlaması kazananların 7/10'unu ilk 4'e koydu.

### Tiebreaker Zinciri (bağlayıcı)
1. A yüksek olan önde.
2. A farkı ≤2 VE B+C farkı ≥8 ise B+C sıralamayı değiştirebilir — gerekçe yazılır.
3. A eşitse toplam — B — C.
4. Toplam puan karar vermez.

### A Katmanı Veto Kuralı
Şunlar A eksikliğini kapatamaz: çok iyi jokey · çok avantajlı kilo · çok yüksek AGF · ilk kez takı · çok iyi tek galop.

### Exact = Kalite, Hacim Değil
- Tek startta 3. olmak "az sicil"dir, "kötü sicil" değil.
- Örneklem küçüklüğü yalnız Veri Güveni'nde (A/B/C) cezalandırılır — puanda ikinci kez asla.
- Exact hiç yoksa bileşeni çıkar, kalan A bileşenlerini 60'a normalize et.

---

## III. SKK SINIF PİRAMİDİ

| SKK | Yarış Türü |
|---:|---|
| 10 | G1 |
| 9 | G2 |
| 8 | G3 |
| 7 | G3-H · KV-18 · KV-9 · KV-8 |
| 6 | KV-7 · KV-6 |
| 5 | H17–H24 |
| 4 | H13–H16 · Şartlı 5 |
| 3 | Şartlı 2-3-4 |
| 2 | Maiden · Şartlı 19 |
| 1 | Şartlı 1 · Şartlı 27 |

### Sınıf Geçiş Bonusu
| Kademe | Etki |
|---|---:|
| 1 kademe düşüş | +1 |
| 2 kademe düşüş | +2 |
| 3+ kademe düşüş | +3 |
| 1 kademe yükseliş | −1 · 2 kat: −2 · 3+: −3 |

Zorunlu açık bildirim: `[Eski] → [Yeni] = [X] kademe [düşüş/yükseliş] = [±X puan]`

**HP × Sınıf Çapraz Kontrolü:** Sınıf düşen fakat HP alan dibinde olan at otomatik güçlü sayılmaz. HP göreli sırasıyla çapraz kontrol edilir.

---

## IV. KOŞU TİPİ ÖZET MATRİSLERİ

Her tip için: Ham veri önceliği · A ağırlıkları · B+C ağırlıkları · Veri Güveni tipik seviyesi · en sık risk.

**ŞARTLI 1 / İlk-Start:** A = Galop/kondisyon 20, Pedigri-baba 11, Pedigri-anne+kardeş 9, F% çarpanı ±3, Antrenör debut+pist 8, Jokey+eküri 9. B+C = Start/kulvar 7, Takı(ilk kez) 7, Sarı üçgen 6, Fiziksel gelişim 6, Ant+Jokey kombinasyon 4, AGF 4, F%>%10 uyarısı 3, Sürpriz sinyal 3. Veri Güveni çoğunlukla **C** — exact yokluğu normaldir, ceza değildir. HP ivmesi gerçek kör nokta (ilkStart=true).

**MAİDEN / ŞARTLI 19:** A = Galop/kondisyon 18, Pedigri (F% dahil) 17, Yarış yönü (miktar değil) 12, Antrenör 9, Jokey 4. B+C = Pist/mesafe 7, Tempo 6, Takı 5, Start/kulvar 5, AGF 4, Ant+Jokey 3, H2H 4, geri kalan 6. Veri Güveni **C** tipik.

**ŞARTLI 2/3/4:** A = Exact sicil 18, SKK 10, Derece 9, HP kalitesi 8, Form yönü+HP ivmesi 5, Ant+Jokey 10. B+C = Göreli kilo/zemin 10, Tempo 9, H2H 4, Start/kulvar 4, Takı 3, geri kalan 10. Veri Güveni **A–B**.

**ŞARTLI 5:** A = Exact+SKK 22, Derece 13, HP kalitesi 10, Form yönü+HP ivmesi 7, Ant+Jokey 8. B+C = Göreli kilo/zemin 12, Tempo 9, Start/kulvar 5, Takı 4, geri kalan 10. Veri Güveni **A–B**.

**HANDİKAP H13–H16 (en sık tip):** A = Exact+SKK 24, Derece+taşınan kilo 13, HP kalitesi (sınıf bazlı) 12, Form yönü+HP ivmesi 6, Sınıf düşüş avantajı 5. B+C = Göreli kilo/zemin 11, Tempo 8, Ant+Jokey 7, Start/pist 4, geri kalan 10. 15+ atlık sahada: Tempo +3, Kulvar +2 (motor otomatik uygular). Veri Güveni **A–B** tipik.

HP Kalitesi Okuma: HP↑ + üst sınıf + form↑ = 5 yıldız · HP↑ + üst sınıf + form sabit = 4 yıldız · HP↑ + alt sınıf + form↑ = 3 yıldız (sınıf filtresi) · HP↑ + üst sınıf + form↓ = 2 yıldız (HP ivmesini kontrol et) · HP↑ + üst sınıf rakiplere karşı = 4 yıldız (gözden kaçırma).

**HANDİKAP H17–H24:** Şartlı 5/H13-16 ile aynı temel + RPR/TS (varsa) + kariyer yük (son yarıştan gün sayısı). RPR/TS yoksa Veri Güveni B'de kalır.

**KV-6 / KV-7:** A = Sınıf geçmişi+SKK 20, RPR/TS varsa 8, Exact 12, Derece+kilo 9, HP+kariyer 6, Kariyer yük 5. Kariyer Yük: 28-90 gün=5 puan(tam), 91-180=3-4(normal), <21=2-3(risk), >180=1-5(galop+ant kontrolü).

**KV-8/KV-9/KV-18:** RPR/TS burada ana belirleyici. RPR/TS kaynaklıysa Veri Güveni A, yoksa B (analiz yarım kalır).

**GRUP G1/G2/G3:** RPR/TS ana belirleyici, yoksa analiz tamamlanamaz. Seyahat/iklim etkisi göz ardı edilmez.

**SATIŞ/CLAIMING:** Veri Güveni **B–C**. Ahır niyeti yoruma dayanır. Bu tipte banko önerilmez.

**KISA MESAFE (≤1300m):** Start hızı ve ilk 200m pozisyonu A'ya etkiler. İç kulvar önceliği. Kaçak etkisi maksimum. TEK_KACAK bu tipte en yüksek değerde.

**UZUN MESAFE (≥1900m):** Exact uzun mesafe sicili A'nın ana bileşeni. Stamina pedigrisi DI>4.0 uyarıdır, otomatik eleme değil. HP_PATLAMA uzun mesafede anlamlı.

**KUM PİST:** Kum exact sicili baskın. Fiziksel güç ön planda. Öne/yakın stil avantajlı.

**ÇİM PİST:** Çim exact sicili birincil — kum başarısı çime transfer olmaz. Son 400m sprint kapasitesi A'ya etkiler.

**SENTETİK PİST:** Çim kökenli pedigri genellikle pozitif. Exact sentetik sicil öncelikli.

**AĞIR/ISLAK PİST:** Kilo katsayısı ×1.30 — göreli kilo farkı normalden %30 daha etkili. Hafif kilolu kaçak dezavantajlı olabilir.

**KALABALIK SAHA (15+ at):** Yarış stili ve kulvar çok daha belirleyici. Motor otomatik uygular: startTempoUygun=true olan ata B+C +5. Tempo adayları n≥10 değilse kaçak ilan etme. A eşiği ≥55 önerilir (standart 50 yerine).

---

## V. HP İVMESİ (merkez mekanizma)

**Formül:** `HP ivmesi = bugünkü HP − herhangi bir pistteki en yakın yarış günü P-HP`

### Zorunlu Form Çatalı
| Bitiriş yönü | HP ivmesi | Okuma | Geçit |
|---|---:|---|---|
| Geriliyor | ≥+4 | GİZLİ GÜÇ — sınıf atlıyor, "düşüyor" yasak | GIZLI_GUC |
| Geriliyor | <+4 | Gerçek düşüş | — |
| İyileşiyor | ≤−4 | YANILTICI — düşürülmüş sınıfta almış | uyarı |
| Herhangi | ≥+10 | HANDİKAPÇI GECİKMESİ | HP_PATLAMA |

### Kör Nokta mı, Veri Toplama Hatası mı?
| Durum | Sınıf |
|---|---|
| At daha önce koşmuş, P-HP eksik | VERİ TOPLAMA HATASI — motor bloke eder |
| At ilk kez koşuyor (ilkStart=true) | Gerçek kör nokta — kabul |

**Vaka:** GÜLEYCANOĞLU 6 yarış koşmuş. P-HP "yok" diye geçildi, gömüldü. KAZANDI. Bulunabilecek veriyi "yok" sayıp atı geriye itmek YASAKTIR.

---

## VI. GALOP ANALİZİ

### İngiliz Safkan Barem­leri
| Mesafe | Normal | İyi | Çok İyi |
|---|---|---|---|
| 400m | 26–28sn | 24–26sn | ≤23sn |
| 600m | 38–41sn | 36–38sn | ≤35sn |
| 800m | 50–54sn | 46–50sn | ≤46sn |
| 1000m | 1:03–1:07 | 1:01–1:03 | ≤1:01 |

### Arap Safkan Baremleri
| Mesafe | Normal | İyi | Çok İyi |
|---|---|---|---|
| 400m | 28–31sn | 25–28sn | ≤25sn |
| 600m | 42–46sn | 39–42sn | ≤39sn |
| 800m | 56–61sn | 52–56sn | ≤52sn |
| 1000m | 1:10–1:15 | 1:06–1:10 | ≤1:06 |

İç pist: ~1sn daha yavaş değerlendir. Galop zinciri okunur, tek derece değil. Farklı zeminde galop = hazırlık ölçer, pist uyumu kanıtlamaz.

### Sluicifer Kontrolü (özellikle Maiden, az yarışlı)
1. Yarış sayısı: 1 veya çok sınırlı
2. Galop sırası: sahanın ilk 2 profili
3. Kondisyon tabanı: en az 800/1000m işi
4. Keskinleşme yönü: son 400 yarışa yaklaştıkça iyileşiyor
5. Yarış jokeyiyle iş: son/en güçlü işi yarış jokeyi yaptı
6. Piyasa ayrışması: AGF/oran ilk kötü yarışa aşırı ağırlık veriyor

4+ olumlu → normal kupon için zorunlu yeniden değerlendirme. 5-6 olumlu → ilk 5 alarm + yüksek oranlı value adayı.

---

## VII. KİLO ANALİZİ

Mutlak kilodan çok göreli fark önemlidir.

### Zemin Katsayıları
| Zemin | Kilo Katsayısı |
|---|---|
| Sert/Normal | ×1.0 |
| Hafif ıslak | ×1.15 |
| Islak/Ağır | ×1.30 |

### Apranti İndirim Tablosu (TJK 2025-2026)
| Kazanılan Koşu | Normal | Handikap |
|---|---|---|
| 0-79 | 4kg | 3kg |
| 80-159 | 3kg | 2kg |
| 160-209 | 2kg | 1kg |
| 210+ | 0kg | 0kg |

Jokey Yamağı (ilk 10): 5kg normal / 4kg handikap.

---

## VIII. TEMPO ANALİZİ

### Kaçak Sayısı Haritası
| Kaçak | Tempo | Avantajlı |
|---|---|---|
| 0 | Avare | Önde giden, lideri takip eden |
| 1 | Düşük | Kaçak veya ön grup arkası |
| 2-3 | Sert | Bekleyen · sprinter · hafif kilolu |
| 4+ | Çok sert | En geride bekleyen güçlü finişçiler |

### Tempo Örneklem Kuralı (kritik)
- n≥10: güven
- n=5-9: kullan, güveni düşür
- n<5: sinyal sayma

### EP-MP-LP
| Mesafe | EP | MP | LP |
|---|---|---|---|
| 1000-1200m | İlk 400 | Orta | Son 400 |
| 1300-1600m | İlk 600 | Orta | Son 400 |
| 1700-2000m | İlk 800 | Orta | Son 600 |
| 2100-2400m | İlk 1000 | Orta | Son 600-800 |

---

## VIII-B. SON 800 ANALİZİ — GÖLGE MOD

**Durum:** Gölge mod — mevcut geçitleri değiştirmez, sıralama kararı vermez. Destekleyici bilgi ve post-mortem aracı.

Son 800, atın yarışın son bölümünü nasıl koştuğunu gösterir: kötü bitirişin arkasında gizli hız var mı, iyi bitiriş kolay tempo sayesinde mi geldi, atın gerçekten kapanış gücü mü var yoksa pozisyon avantajı mı kullanıldı.

`son800Farkı = atın son800 − son800'e ilk girenin son800'ü`. Negatif fark = attan daha hızlı kapandı.

Karşılaştırma şartı (zorunlu): hipodrom, pist türü ve durumu, ırk, mesafe (±200m tolerans), koşu sınıfı mümkün olduğunca aynı olmalı.

Kullanım: 0-1 benzer yarış = sinyal yok · 2 = sınırlı destek · 3+ = medyan kullanılabilir.

Motor çıktısı: n≥3 ve medyan ≤−0.5sn → güçlü kapanış (+2 puan) · n≥3 ve medyan ≥+0.7sn → düşük tempo (−1 puan) · aksi halde 0.

---

## IX. PEDİGRİ, LİNEBREEDİNG VE DOZAJ

| Kontrol | Ağırlık |
|---|---|
| Baba hattı mesafe/pist | Ana referans |
| Anne sicili 2-3 yaş | Eşit ağırlık |
| Kardeş üretimi | Zorunlu kontrol |
| F% katsayısı | Çarpan |
| Kısrak babası | Yardımcı |

### F% Aralıkları ve Çarpan
| F% | Sınıf | Çarpan |
|---|---|---|
| %0-3 | Düşük | 0.90 |
| %3.1-6 | Orta | 1.00 |
| %6.1-10 | Yüksek | 1.10 (uyumsuzsa 0.95) |
| >%10 | Çok yüksek | 1.05 + C uyarısı |

### Dozaj (DP/DI/CD/HDY) — Yalnız İngiliz Safkan
`DP = B-I-C-S-P` · `HDY = 100×(B+I)/Toplam` · `DI = (B+I+0.5C)/(0.5C+S+P)`

DI>4.00: 2400+ için uyarı, otomatik eleme değil.

---

## X. RPR / TS ULUSLARARASI DERECE

| Koşu | Kullanım |
|---|---|
| Şartlı 1-4 | Genellikle anlamsız |
| Şartlı 5 / H13-16 | Varsa referans |
| H17-24 | Değerli |
| KV-6/KV-7 | Önemli |
| KV-8+ | Kritik |
| G1/G2/G3 | Ana belirleyici |

TJK HP/P-HP yerine kullanılmaz.

---

## XI. H2H (ZAYIF KANIT)

H2H tek başına atı geriye itemez — YASAK gerekçe. Kilo, takı, mesafe, pist, sınıf, tempo değiştiyse ağırlık azalır. B katmanı max 4 puan.

**Vaka:** DADAKBEY "ERGÜNEŞ'e 2/2 mağlup" diye 7. sıraya kondu. DADAKBEY KAZANDI.

---

## XII. JOKEY, ANTRENÖR, APRANTİ

Jokey %0, antrenör %2 = "veri yok" demektir, "kötü" değil. **Vaka:** GÜLEYCANOĞLU jokey %0 diye gömüldü, kazandı.

Jokey bağlamsal filtre sırası: (1) bu pist+mesafe+koşu tipinde oran, (2) bu antrenörle 60 gün kombinasyon, (3) genel win% (yalnız referans), (4) at-jokey geçmişi, (5) jokey değişikliği yönü.

---

## XIII. TAKI VE EKİPMAN

Her at için: bugünkü takı/ekipman, son yarışta kullanılan, eklenen, çıkarılan, ilk kez kullanılan, kombinasyon değişikliği, daha önce aynı takıyla koştuğu yarışlar ve sonuçları.

Takı değişikliği varsa TAKI_DEGISIKLIGI_ALARMI üretilir — deneme değerlendirilmeden analiz tamamlanmış sayılmaz. Ancak ekleme/çıkarma otomatik olumlu/olumsuz kabul edilmez — somut geçmiş kanıt yoksa nötr + belirsizlik.

---

## XIV. YASAK NEGATİF GEREKÇELER

| Yasak gerekçe | Neden yasak |
|---|---|
| jokey_dusuk_yuzde | "%0" = kanıt yok, ceza değil |
| form_dalgalanmasi | Handikapta normaldir |
| h2h_maglubiyet | Koşullar değişmiş olabilir |
| exact_yok | Kanıt yokluğu ≠ olumsuz kanıt |
| tek_start | Az sicil ≠ kötü sicil |
| hp_ivmesi_bilinmiyor | Git bul; eksiklik ceza sebebi değil |

Geçerli olumsuz kanıtlar: tempo aleyhine · somut kilo dezavantajı · galop düşüşü/kondisyon kopukluğu · sınıf yükselişi · kulvar dezavantajı · sınıf tavanı · mesafe/pist için tekrarlayan somut başarısızlık.

---

## XV. VERİ YETERLİLİĞİ

Kritik alan doluluğu %90 altındaysa motor VERI_YETERSIZ verir, analizi bloke eder. Zorunlu alanlar: hpBugun · hpOnceki · tempoVeriN · agfSirasi · bitirisGeriliyor/bitirisIyilesiyor (False de geçerli cevaptır — boş bırakılamaz).

---

## XVI. GEÇİT ÖZETİ

| Geçit | Tetik | Çözüm |
|---|---|---|
| ATOMIC_FORCE | ≥4/6 sinyal | İlk 4 + ekonomik kupon |
| TEK_KACAK | Sahada tek güvenilir kaçak (n≥10) | Net Rota işareti |
| GIZLI_TOPARLANMA | Zayıf sonuç + keskin galop | "Formu zayıf" yasak |
| HP_PATLAMA | HP ivmesi ≥+10 | Ekonomik kupona zorunlu |
| GIZLI_GUC | Bitiriş↓ + HP ivmesi ≥+4 | "Form düşüyor" yasak |
| AGF_AYRISMA | AGF≤3 + teknik ≥2 geride | Sadece gerçek taşıma |
| HP_SINIF | Sınıf düşüşü + HP üst bandı | Sınıf bonusu +1 kademe |

---

## XVII. KUPON VE BANKO

### Puan Bantları
| Toplam | Rol |
|---|---|
| 90-100 | Elit favori / banko adayı |
| 85-89 | Dar kupon çekirdeği |
| 80-84 | Dar / Normal |
| 75-79 | Normal |
| 70-74 | Normal / Geniş |
| 60-69 | Sürpriz / Geniş |

### Banko Şartları (dördü birden)
- A ≥ 50
- A farkı ≥ 3 (A'dan hesaplanır, toplamdan değil)
- Veri Güveni A
- Somut risk yok

Aşırı piyasa konsensüsü (AGF>%50 + ganyan<1.50) teknik şartları karşılasa bile kesinti riski yaratır — banko yapma, dar kuponda tut.

### Ekonomik Kupon
Slot GEÇİT SKORUYLA dolar, A sırasıyla değil.
`Geçit Skoru = (AF×2) + (tetik sayısı×3) + (B+C÷5) + 6[HP patlaması varsa]`

---

## XVIII. POST-MORTEM VE KALİBRASYON

| Renk | Durum |
|---|---|
| Kırmızı | Geçit tetikledi, at gömüldü — süreç hatası |
| Turuncu-Kırmızı | Kupona alındı ama sıra/çözüm tamamlanmadı |
| Sarı | Geçit tetikledi, at kupondaydı — süreç doğru |
| Turuncu | Hiçbir geçit tetiklemedi — VARYANS, kural çıkarma |

Kazananla birlikte kaybedenler de kaydedilir. Tek yarıştan yeni kural çıkarılmaz — en az 30-50 yarış gerekir.

---

## XIX. TARİHSEL DERSLER

| Vaka | Kalıcı kural |
|---|---|
| KAPTANPAŞALI | HP ivmesi ≥+10 = handikapçı gecikmesi, "form düşüşü" değil |
| AFŞINTAY | HP↓ + bitiriş↑ = yanıltıcı (düşürülmüş sınıfta almış) |
| GÜLEYCANOĞLU | Jokey %0 + form dalgalanması ceza sebebi DEĞİLDİR |
| DADAKBEY | H2H mağlubiyeti zayıf kanıttır |
| Sluicifer | Tek kötü yarış + yükselen galop = gelişim ihtimali |
| Dorukbatur | Sert tempoda kaçak↓, bekleme+hafif+galop↑ |

---

## XX. VERİ KAYNAKLARI

| Veri | Birincil | Not |
|---|---|---|
| HP ve P-HP | TJK "At Koşu Bilgileri" | Herhangi bir pistteki en yakın yarış |
| Galop | TJK İdman İstatistikleri | — |
| Jokey/Antrenör | TJK İstatistikleri | Bağlamsal okunur |
| Tempo VERİ(n) | TJK Yarış Stili | n'siz yazma |
| RPR/TS | Racing Post | — |

Veri yoksa "VERİ YOK" doğru cevaptır. Saniye/istatistik uydurulmaz.

---

**DÜRÜSTLÜK SINIRI:** Skor olasılık değildir. Ağırlıklar hipotezdir. Piyasayı taklit eden sistem kesin kaybeder. Bahis kumardır; bankroll analizden önce gelir.
