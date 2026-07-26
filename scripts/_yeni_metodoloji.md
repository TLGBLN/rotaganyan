# ROTAGANYAN BÜTÜNLEŞİK ANALİZ MOTORU — v6.6

*(v6.1 revizyonu — canlı yarış geri bildirimiyle: düşük AGF artık teknik açıdan güçlü bir atı geriye çekme gerekçesi değil; Son800+galop zinciri kombinasyonu gerçek bir destekleyici unsur; yüksek ham HP tek başına üstünlük garantilemez. Bkz. §XVI, §X, §XI, §XX.26-28.)*
*(v6.2 revizyonu — ★ Hedef/isTarget artık pasif bir rozet değil: işaretlenen at sıralamada ilk 3'ün hemen altına getirilir, puanı 3. sıraya yakın/eşit verilir. Bkz. §XIX.0a.)*
*(v6.3 revizyonu — Yarış Stili 5'li şemadan (KAÇAK/ÖNCÜ/PRESÇİ/TAKİPÇİ/BEKLEYEN — çoğu at gerçek dışı şekilde "Takipçi"ye düşüyordu, %62) saha-büyüklüğü-yüzdelik 4'lü şemaya geçti: Kaçak At/Ön Grup Arkası/Bekleme Grubu/En Geri Takip — bitiş sırasıyla karışmaz, yalnız erken pozisyonu anlatır. Bkz. §IX.0.)*
*(v6.4 revizyonu — kullanıcının canlı gözlemine dayanan 4 yeni OLUMLU kombinasyon kuralı eklendi: yağışlı hava + Kaçak At stili (§IX.6), kalabalık sahada kaçak dezavantajı/az atlı sahada sprinter avantajı (§IX.5), Şartlı 1/27 gibi giriş seviyeli koşularda takısız taylar (§XIII.1), 30+ gün aradan dönüp güçlü jokeyle koşan atlar (§XX.29). Dördü de yalnız olumlu yönde işler, hiçbiri tek başına bir atı cezalandırma gerekçesi değildir.)*
*(v6.5 revizyonu — canlı yarış geri bildirimi (İstanbul 2.Koşu, GIRALAMO): Aygır ve Kısrak İstatistiği artık kesinlikle AYRI değerlendirilir — biri zayıf diye diğerinin kendi eşiğini geçen olumlu sinyali "pedigri zayıf" gibi toptan bir hükümle gölgelenmez. Bkz. §XII.1.)*
*(v6.6 revizyonu — canlı yarış geri bildirimi (İstanbul 2. ve 10.Koşu, aynı gün iki banko birden kaybetti): Banko kararı artık confidence=YUKSEK şartını da zorunlu tutuyor — eskiden yalnız sayısal eşiğe (puan/fark/AGF riski) bakılıyordu, Claude'un kendi "confidence" değerlendirmesi ve bankoNote'taki çekinceler hesaba katılmıyordu. Bkz. §XIX.0b.)*

## I. SİSTEMİN AMACI

ROTAGANYAN; aynı yarıştaki atları aynı veri disipliniyle değerlendiren, gerekçeleri görünür kılan, eksik veriyi uydurmayan, yarış sonrası hataları sınıflandıran ve zamanla kalibre edilen bir karar çerçevesidir.

Sistem: kazanma olasılığı üretmez · aynı yarış içindeki atları karşılaştırır · bir yarıştaki puanı başka yarıştaki puanla kıyaslamaz · bilinmeyen veriyi olumsuz saymaz · piyasa görüşünü teknik veriyle karıştırmaz · aynı ham veriyi iki kez puanlamaz · sıralama öncesinde zorunlu kural denetimi uygular.

---

## II. TEMEL İLKELER

### II.1 Kanıt yokluğu olumsuz kanıt değildir

Otomatik eksi olmayan durumlar: bugünkü pist/mesafe/zemin/hipodromda hiç koşmamış olma · tek startlı olma · exact kaydı yokluğu · HP ivmesinin bilinmemesi · düşük jokey/antrenör yüzdesi · handikapta dalgalı form · kilo/takı/mesafe/sınıf değişikliği · düşük AGF · H2H mağlubiyeti · ilk start.

Bilinmeyen veri **NÖTR** kabul edilir. Görülmeyen veri uydurulmaz.

**Bu ilke belgedeki HER veri kalemi için geçerlidir** (pedigri örneklemi, tempo örneklemi, Son 800 örneklemi, galop verisi, jokey/antrenör yüzdesi, H2H, takı geçmişi — istisnasız). Örneklem/veri yetersizse o kalem NÖTR sayılır ve analiz süreci **HİÇBİR ZAMAN durdurulmaz** — yalnız o kalemin notu zayıf/az güvenilir olarak işaretlenir.

### II.2 Değişiklik tek başına olumlu veya olumsuz değildir

Kilo, takı, mesafe, sınıf, jokey, pist veya zemin değişikliği ancak geçmiş performans ve bugünkü yarış bağlamıyla anlam kazanır.

### II.3 Dürüstlük sınırı

Skor kazanma ihtimali değildir · ağırlıklar hipotezdir · tek yarıştan yeni kural çıkarılmaz · piyasanın tamamını taklit eden sistem değer üretmez · bahis kumardır.

### II.4 Kural Denetim Protokolü

Nihai değerlendirme öncesinde zorunlu kontroller:

1. Koşmayacak atlar çıkarıldı mı?
2. Kritik alan doluluğu yeterli mi?
3. HP ivmesi ile form birlikte okundu mu?
4. Sınıf geçişi açıkça bildirildi mi?
5. Sınıf koruma adayı kontrol edildi mi?
6. Takı değişikliği önceki takıyla karşılaştırıldı mı?
7. Son 800 zeminden ve tempodan bağımsız yorumlandı mı?
8. Aynı ham veri iki kez puanlandı mı?
9. Bilinmeyen veri cezaya dönüştürüldü mü?
10. Metin, puan ve sıra birbiriyle tutarlı mı?
11. AGF, §XVI'daki ASİMETRİK kuralla değerlendirildi mi (yüksek AGF hem destek hem çelişki yönünde işleyebilir; düşük AGF ASLA bir atı geriye çekme gerekçesi olarak kullanılmadı mı)?
11b. Yüksek ham HP, zayıf form/tempo uyumsuzluğuna rağmen otomatik üstünlük gerekçesi yapılmadı mı?
11c. Yeterli örneklemli güçlü Son800 + keskin galop zinciri birlikte görüldüğünde gerçek bir destekleyici çift olarak (§X, §XI) tanındı mı?
12. Çapraz Doğrulama Katsayısı (§XVIII.3) her at için doğru gerekçeyle uygulandı mı?

---

## III. ORTAK BAĞLAM KATMANI

Zemin yalnız tek bir satırda değil, bütün verilerin yorumunda kullanılan ortak bağlamdır: pist türü + zemin durumu + hipodrom geometrisi + mesafe + sınıf + rakip kalitesi + saha büyüklüğü + yaş/cinsiyet şartı + yarış temposu + gün aralığı + örneklem büyüklüğü.

### III.1 Pist ve zemin ayrımı

Pist türü: Kum, çim, sentetik. Zemin durumu: Normal, hızlı, ıslak, ağır, yumuşak, çok yumuşak vb. Aynı pist türünde farklı zemin koşulları aynı performans sayılmaz.

### III.2 Koşul benzerliği

| Başlık | Öncelik |
|---|---:|
| Pist türü | Çok yüksek |
| Zemin durumu | Çok yüksek |
| Mesafe bandı | Çok yüksek |
| Sınıf ve rakip kalitesi | Yüksek |
| Yarış temposu | Yüksek |
| Hipodrom geometrisi | Orta |
| Saha büyüklüğü | Orta |
| Kilo | Orta |
| Gün aralığı | Orta |

Düşük benzerlik geçmiş yarışı silmez; güvenini azaltır.

*(Hipodrom geometrisi: pist uzunluğu/genişliği ve mesafe/start noktası diyagramı sitede "Hipodrom Özellikleri" panelinde görüntülenebilir. Kulvar çıkışlarının virajdan/düz yoldan başlaması bu diyagramdan okunur — YALNIZ DESTEKLEYİCİ bir unsurdur, en fazla Katman 4-5 seviyesinde yer alır, HİÇBİR VERİYİ GÖLGELEYEMEZ/GEÇERSİZ KILAMAZ. HP, sınıf, tempo, form gibi ana kalemlerin önüne asla geçmez. Her atın kulvar/start numarası (v6.2'den itibaren) ATLAR tablosunda "Kulvar:N" olarak veriliyor — düşük numara/iç kulvar dar virajlarda avantaj, dış kulvar mesafe kaybı olabilir, ama bu KESİN bir kural değil, koşunun kendi bağlamına göre değerlendir.)*

### III.3 Zemin Kilo Katsayısı

| Zemin | Katsayı |
|---|---:|
| Sert/Normal | ×1.0 |
| Hafif Islak/Nemli | ×1.15 |
| Islak/Ağır | ×1.30 |

Bu bir kod-çarpanı DEĞİLDİR (mekanik hesap yok) — kilo etkisini ne kadar GÜÇLÜ değerlendireceğine dair bir yönlendirmedir: ıslak/ağır zeminde kilo farkının puan etkisi normalden belirgin şekilde (kabaca %15-30) daha ağır tutulur, §VII.0 Katman 4 aralığı içinde kalınarak.

---

## IV. VERİ ÇİFTİ DOKTRİNİ

### IV.1 Nihai eşleştirme matrisi

| Veri paketi | Ne anlatır | En güçlü olduğu yarışlar | Zorunlu not |
|---|---|---|---|
| Tempo stili + saha tempo haritası + zemin | At bugün istediği yarış düzenini bulabilir mi? | Tüm tecrübeli yarışlar | Kaç öncü olduğu ve baskı şiddeti birlikte okunur |
| Tempo + ara geçişler + Son 800 + zemin | Enerji nerede kullanıldı, sona güç kaldı mı? | Maiden, Ş2-5, Handikap, KV, Grup, Satış | Son 800 tek başına stil değildir |
| Son 800 + yarış içi en iyi Son 800 farkı | Aynı yarış içindeki kapanış gücü | Tüm tecrübeli yarışlar | Ham saniye yerine yarış içi fark tercih edilir |
| Son 800 + pist/mesafe/zemin geçmişi | Kapanış tekrarlanabilir mi? | Ş4-5, Handikap, KV, Grup | Benzer şart örneklemi gerekir |
| HP ivmesi + form dizisi + zemin | Sonuç yanıltıcı mı, gizli gelişim var mı? | Maiden, Ş2-5, Handikap, KV | Form, HP ivmesinden bağımsız yorumlanmaz. Yüksek HAM HP tek başına (form zayıfsa) üstünlük gerekçesi DEĞİLDİR (§XX.27) |
| HP + kilo + sınıf + zemin | Kalitesine göre taşıdığı yük uygun mu? | Handikap merkezli | Kilo etkisi doğrusal kabul edilmez |
| Sınıf geçişi + rakip kalitesi + kilo | Gerçek düşüş/yükseliş var mı? | Ş3-5, H17+, KV, Grup | SKK tek başına puan değildir |
| Galop + son yarış + geçen gün + çalışma zemini | Form devamı, toparlanma/eksiklik | Ş1/27, Maiden, Ş2-3, Satış, uzun ara | Tek galop yerine zincir okunur |
| Pedigri + pist/mesafe/zemin + örneklem | Deneyim azken teorik yatkınlık | Ş1/27, Maiden, az startlılar | Deneyim arttıkça pedigri ağırlığı düşer |
| Takı değişikliği + önceki takı + geçmiş sonuç | Davranış/performans değişikliği beklenir mi? | Tüm tipler | İlk kez/yeniden/çıkarma ayrı sinyaldir |
| Jokey + antrenör + stil + zemin deneyimi | Binici–hazırlık–plan uyumu | Tüm tipler | Düşük yüzdeler tek başına ceza değildir |
| Kulvar + stil + pist geometrisi + zemin | Pozisyon ve yol maliyeti | 800–1600 m, kalabalık saha | Kulvar tek başına iyi/kötü değildir; hiçbir zaman ana kalemleri (HP/sınıf/tempo/form) gölgelemez |
| Kilo + aynı pist/mesafe/zemin geçmişi | Bugünkü kilo geçmişe göre avantajlı mı? | Handikap ve KV | Sınıf/tempo benzerliği de kontrol edilir |
| H2H + aynı koşullar | Önceki karşılaşma bugün anlamlı mı? | Handikap, KV, Grup | Tek karşılaşma kesin üstünlük değildir |
| AGF + teknik veri ayrışması | Piyasa ile sistem arasında fark var mı? | Kupon aşaması + her koşuda destekleyici | AGF doğrudan teknik puan değildir |
| Eküri + tempo rolleri + zemin | Olası taktik rol uyumu | Taktik ve çok öncülü yarışlar | Kesin taktik varsayılmaz |

### IV.2 Zorunlu çekirdek paketler

**Tempo:** Tempo stili + saha tempo haritası + ara geçiş sıraları + Son 800 + zemin
**Form:** Form dizisi + HP ivmesi + sınıf + rakip kalitesi + zemin
**Kilo:** Bugünkü kilo + kilo değişimi + HP + sınıf + tempo stili + benzer zemin geçmişi
**Kondisyon:** Son yarış + geçen gün + son galop zinciri + galop splitleri + çalışma pist/zemini
**Pedigri:** Baba istatistiği + anne üretimi + anne baba etkisi + kardeş performansı + pist/mesafe/zemin + örneklem
**Takı:** Bugünkü takı + önceki takı + değişiklik türü + geçmiş sonuç + start/yarış davranışı

---

## V. REDUNDANS VE ÇİFTE SAYIM KONTROLÜ

Kontrol edilecek gruplar: AGF stil etiketi ↔ tempo-split stil etiketi · Tempo+Son800 ↔ tempo+ara geçişler · Son yarış form dizisi ↔ aynı yarıştan türetilen başka form sinyalleri · HP ivmesi ↔ HP patlaması · Aynı pist/mesafe başarısı ↔ koşul benzerliği katsayısı · Jokey-antrenör yüzdeleri ↔ sınıf/HP kalitesi · Pedigri pist uyumu ↔ kardeş performansı (aynı kaynaksa).

> Aynı yarış akışından türeyen üç tempo sinyalinden en fazla ikisi birincil ağırlıkta kullanılabilir.

---

## VI. VERİ ŞEMASI

Her at kaydı en az şu alanları taşır: ad, koşmayacakMı, kilo, kulvar, jokey, aprantiMi, antrenör, hpBugun, hpÖnceki, hpİvmesi, formDizisi, ilkStart, bitirişGeriliyor, bitirişİyileşiyor, agfYüzde, agfSırası, tempoVeriN, kaçakYüzdesi, tempoStili, son800, son800Farkı, son800BenzerKoşuN, pistTürü, zeminDurumu, mesafe, hipodrom, eskiSkk, yeniSkk, sonGaloplar, baba, anne, anneBaba, pedigriÖrneklemBoyutu, bugünküTakı, önceküTakı, takıDeğişikliği.

---

## VII. YARIŞ TİPİ AĞIRLIKLARI

### VII.0 Sabit 5 Katmanlı Puan Havuzu

```
Katman 1 (Ana Dayanak):     22-30 puan
Katman 2 (Güçlü Destek):    16-22 puan
Katman 3 (Orta Destek):     12-16 puan
Katman 4 (Bağlamsal):        8-12 puan
Katman 5 (Tamamlayıcı):      5-8  puan
Ham Toplam ≈ 100 (normalize et)
```

Her kart yalnız hangi paketin hangi katmana girdiğini belirtir; aralıklar sabittir. Bir katmana birden fazla paket düşerse aralık kanıt gücüne göre paylaştırılır, katman toplamı aşılmaz.

**Kalabalık Saha Katman Yükseltmesi (10+ at):** Kartın kendi ataması ne olursa olsun, Tempo + Yarış Stili + Accurace verisi otomatik Katman 1-2'ye yükseltilir — kartın ana dayanağıyla EŞİT ağırlıkta değerlendirilir, katman aralığı ikisi arasında paylaştırılır (BIG RUGGED/KÜÇÜKDEMİRCİK dersi: kalabalık sahada Bekleme Grubu/Ön Grup Arkası stilindeki atlar modelin öngördüğünden belirgin iyi bitirdi).

**Evrensel asgari:** Tempo + Yarış Stili + Accurace, veri varsa HER koşu tipinde en az bir katmanda (asgari Katman 4-5) yer alır. Veri yoksa nötr sayılır, kart dışı bırakılmaz.

### VII.1 Şartlı 1 / Şartlı 27

1-Pedigri · 2-Galop/kondisyon · 3-Ekip (jokey+antrenör) · 4-Pist/mesafe/zemin uyumu · 5-Kulvar/start + Tempo/Stil/Accurace (veri varsa)

Geçmiş tempo, HP ivmesi, H2H ve Son 800 yokluğu eksi değildir.

### VII.2 Maiden / Şartlı 19 / Maiden Satış

1-Gelişim (HP ivmesi+form yönü) · 2-Tempo+Son 800 · 3-Galop/kondisyon · 4-Pist/mesafe/zemin · 5-Ekip

Az startlılarda pedigri Katman 1-2'ye taşınabilir; start arttıkça gerçek yarış verisi ağırlık kazanır.

### VII.3 Şartlı 2 / Şartlı 3

1-HP ivmesi · 2-Tempo+Son 800 · 3-Galop/kondisyon · 4-Sınıf geçişi+zemin uyumu · 5-Ekip

### VII.4 Şartlı 4 / Şartlı 5

1-Sınıf+rakip kalitesi · 2-Tempo+Son 800 · 3-HP · 4-Kilo+pist/mesafe/zemin geçmişi · 5-Ekip

### VII.5 Handikap 13–16

1-HP+kilo dengesi · 2-Sınıf · 3-Tempo+Son 800 · 4-Zemin · 5-Form/HP ivmesi çapraz kontrolü

10+ atlı sahada: Katman 3'e Tempo +3, Kulvar +2 (bkz. §IX.4).

### VII.6 Handikap 17–24

1-HP–kilo dengesi · 2-Sınıf+rakip kalitesi · 3-Saha temposu+Son 800 · 4-Benzer zemin geçmişi · 5-Kariyer yükü

### VII.7 KV Yarışları

1-Sınıf kanıtı+rakip kalitesi · 2-Tempo haritası+Son 800 · 3-Pist/mesafe/zemin · 4-Jokey uyumu · 5-Kariyer yükü

### VII.8 Grup Yarışları (G1/G2/G3)

1-Üst sınıf performansı+rakip kalitesi · 2-Tempo+ara geçişler+Son 800 farkı · 3-Pist/mesafe/zemin kanıtı · 4-Seyahat/iklim etkisi · 5-Kariyer yükü

### VII.9 Satış Koşuları

**İlk start:** 1-Pedigri · 2-Galop · 3-Ekip · 4-Zemin · 5-Tempo/Stil/Accurace (veri varsa)
**Tecrübeli:** 1-Sınıf · 2-Form+HP ivmesi · 3-Tempo+Son 800 · 4-Zemin · 5-Yarış Stili/Accurace eğilimi

Satış etiketi tek başına kalite düşüklüğü değildir; bu tipte banko önerilmez.

### VII.10 Amatör / Kadın Amatör / Kadın Binici / Yamak

1-Binici deneyimi+at-binici uyumu · 2-Asıl koşu tipinin kendi kartı · 3-Stil uyumu+start yönetimi · 4-Tempo kontrolü+zemin deneyimi · 5-Kilo indirimi (bağlamsal)

"Kadın binici/amatör" ibaresi tek başına puan üretmez; zor idare edilen at + tecrübesiz binici somut olumsuz kanıttır, cinsiyetle karıştırılmaz.

---

## VIII. SKK SINIF PİRAMİDİ VE GEÇİŞ MOTORU

### VIII.1 SKK referans tablosu

| SKK | Yarış türü |
|---:|---|
| 10 | G1 |
| 9 | G2 |
| 8 | G3 |
| 7 | G3-H, KV-18, KV-9, KV-8 |
| 6 | KV-7, KV-6 |
| 5 | H17–H24 |
| 4 | H13–H16, Şartlı 5 |
| 3 | Şartlı 2–3–4 |
| 2 | Maiden, Şartlı 19 |
| 1 | Şartlı 1, Şartlı 27 |

Satış 1-4, SKK piramidinin doğal parçası değildir — yalnız geçiş hesabı için yaklaşık: Satış N ≈ Şartlı N referansı, gerçek eşdeğerlik iddiası değil.

### VIII.2 Ham geçiş

`Ham geçiş = Eski SKK − Yeni SKK` — Pozitif: düşüş · Negatif: yükseliş · Sıfır: yatay.

### VIII.3 Açık bildirim zorunluluğu

Her at için: [Eski sınıf]→[Yeni sınıf], ham değişim kademesi, HP konumu, koşul taşınabilirliği, kilo etkisi, nihai sınıf etkisi (Katman 2'ye gömülür, −3 ile +3), koruma durumu.

### VIII.4 Düzeltilmiş sınıf etkisi

**Düşüş:** 1 kademe destek yok=0 · 1 kademe 2+ destek=+1 · 2 kademe zayıf=0/+1 · 2 kademe destekli=+2 · 3+ kademe güçlü=+3 · 3+ kademe zayıf=0/+1
**Yükseliş:** 1 kademe güçlü=0 · 1 kademe destek yok=−1 · 2 kademe güçlü=−1 · 2 kademe yetersiz=−2 · 3+ kanıt yok=−3 · 3+ kanıt var=−1/−2

### VIII.5 Koşullu ilk 3 koruması

`SINIF_KORUMA_ADAYI = true` yalnız TÜMÜ sağlanırsa: (1) en az 2 SKK düşüş, (2) HP alt bölümde değil, (3) üst sınıf performansı taşınabilir, (4) kilo artışı avantajı silmiyor, (5) en az bir ek destek, (6) ilgili veri kalemleri (HP, sınıf geçmişi, kilo) yeterince dolu ve tutarlı, (7) ciddi negatif kanıt yok.

Otomatik ilk 3 garantisi değildir; Kural Denetim Protokolü'nün (§II.4) 4-5. maddeleri tarafından denetlenir.

---

## IX. TEMPO ANALİZİ

### IX.0 Yarış Stili — 4 Kategori (v6.3)

Accurace GPS/sektörel verisinden, saha büyüklüğüne göre YÜZDELİK dilimlenmiş, yalnız erken pozisyona (mesafenin ~%25'i) bakan 4 kategori — bitiş sırasıyla karışmaz, "o at o yarışta sahanın neresinde gitti" sorusuna cevaptır, sonucu değil:

| Kategori | Tanım |
|---|---|
| Kaçak At | Erken bölümde sahanın en önünde. |
| Ön Grup Arkası | Erken bölümde sahanın ön yüzdelik diliminde (lider hariç). |
| Bekleme Grubu | Erken bölümde sahanın orta yüzdelik diliminde. |
| En Geri Takip | Erken bölümde sahanın en gerisinde. |

n≥3 yarış birleştirilerek KALICI eğilim üretilir (tek yarıştan kalıcı stil çıkarılmaz, §XVIII).

### IX.1 Kaçak sayısı haritası

| Kaçak | Tempo | Avantaj |
|---:|---|---|
| 0 | Avare | Önde giden/lideri takip |
| 1 | Düşük | Kaçak At veya Ön Grup Arkası |
| 2–3 | Sert | En Geri Takip, sprinter, hafif kilolu |
| 4+ | Çok sert | Güçlü finiş yapan En Geri Takip grubu |

### IX.2 Örneklem kuralı

n≥10 güvenilir · n=5-9 kullanılır-güven düşük · n<5 sinyal sayılmaz · yüzde örneklemsiz yazılmaz · resmî split yoksa saniye uydurulmaz.

### IX.3 EP–MP–LP

| Mesafe | EP | MP | LP |
|---|---|---|---|
| 1000–1200 m | İlk 400 | Orta | Son 400 |
| 1300–1600 m | İlk 600 | Orta | Son 400 |
| 1700–2000 m | İlk 800 | Orta | Son 600 |
| 2100–2400 m | İlk 1000 | Orta | Son 600–800 |

### IX.4 Kalabalık Saha (10+ at)

Bkz. §VII.0 "Kalabalık Saha Katman Yükseltmesi" — buradaki etkiler bağımsız bonus değil, yükseltilmiş katmanın İÇİNE gömülür.

| Sinyal | Puan etkisi |
|---|---:|
| Ön Grup Arkası/Bekleme Grubu, n≥5 tutarlı üst-orta sıra | +3 ila +5 |
| Kaçak At eğilimi + tekrarlı zayıf bitiriş geçmişi (form dizisinden) | −3 ila −5 |
| İç kulvar (1-4) + Kaçak At eğilimi | +2 |
| Dış kulvar (10+) + tempo bilgisi yetersiz | −2 |

### IX.5 Saha büyüklüğü × Yarış stili (v6.4)

Kullanıcı gözlemi: kalabalık sahada trafik/blokaj riski, az atlı sahada boş alan bolluğu stil tercihinin gerçek performansa etkisini değiştirir. Yalnız OLUMLU/nötr yönde işler — bir stili doğrudan cezalandırmaz, yalnız rakip stilleri öne çıkarır:

- **Kalabalık saha (10+ at):** Kaçak At stili trafik/blokaj riski taşır (§IX.4 ile tutarlı) — bu bir ceza değil, dikkatli/nötr bir not.
- **Az atlı saha (≤6 at):** Sprinter/En Geri Takip tipi (final kapanışa güvenen) atlar boş alan bulma sorunu yaşamaz, kapanış gücünü tam kullanabilir — olumlu değerlendir.

### IX.6 Hava durumu × Kaçak At (v6.4)

Yağışlı/ıslak hava (RaceDay.weather, TJK kaynaklı, sabit anahtar kelime listesi değil — kendi muhakemenle değerlendir) ile Kaçak At stili birlikte olumlu bir kombinasyondur: önden giden at diğer atların üzerine su/çamur sıçratmaktan kaçınır, bozulan izden önce geçer. Yalnız olumlu yönde işler, kuru havada bu bonus uygulanmaz (ceza da değil, nötr).

---

## X. SON 800 ANALİZİ — GÖLGE MOD

`son800Farki = atın Son 800'ü − referans Son 800` (aynı yarışın en iyisi). Negatif = daha hızlı.

**Karşılaştırma koşulları:** Pist türü, zemin, ırk, mesafe (±200m), sınıf, tempo yapısı. Hipodrom aynı olmak zorunda değil, güven düzeltmesi olarak tutulur.

**Örneklem:** 0-1: sinyal yok · 2: sınırlı destek · 3+: medyan kullanılabilir.

**Eşikler:** n≥3 ve medyan ≤−0.5sn: güçlü kapanış · n≥3 ve medyan ≥+0.7sn: düşük kapanış · diğer: nötr.

**Yapmadıkları:** HP'nin, P-HP'nin, exact sicilin yerine geçmez; TEK BAŞINA (başka hiçbir destek olmadan) bir banko gerekçesi olmaz.

**v6.1 — Son800 + Galop kombinasyonu gerçek bir destekleyici çifttir:** Yeterli örneklemli güçlü Son800 (n≥3, medyan≤−0.5sn) ile §XI'deki keskin/iyi bir galop zinciri AYNI ANDA görüldüğünde, bu ikili yalnız "ek bir not" değil, GERÇEK ve GÜÇLÜ bir destekleyici pakettir — Çapraz Doğrulama Katsayısı'nda artı yönde (×1.05-1.10) sayılabilir ve atı sıralamada belirgin biçimde yukarı taşıyabilir, ilk 4'e/üst sıralara girmesini haklı çıkarabilir. Bu kombinasyonu görüp de düşük AGF veya sınıf/HP gibi başka bir kaleme dayanarak geri planda bırakmak, kanıtı görmezden gelmek olur.

---

## XI. GALOP ANALİZİ

Galop tek dereceyle değil, zincir olarak okunur.

**İngiliz safkan:** 400m: 26-28sn normal/24-26sn iyi/≤23sn çok iyi · 600m: 38-41/36-38/≤35 · 800m: 50-54/46-50/≤46 · 1000m: 1:03-1:07/1:01-1:03/≤1:01

**Arap safkan:** 400m: 28-31/25-28/≤25 · 600m: 42-46/39-42/≤39 · 800m: 56-61/52-56/≤52 · 1000m: 1:10-1:15/1:06-1:10/≤1:06

İç pist ~1sn yavaş değerlendirilebilir (sabit değil). Farklı zeminde galop hazırlık gösterir, pist uyumu kanıtlamaz. Tek hızlı iş form garantisi değildir.

**v6.1:** Keskin/iyi bir galop zinciri, güçlü bir Son800 kaydıyla (§X) BİRLİKTE görüldüğünde gerçek bir destekleyici kombinasyondur — bkz. §X "Son800 + Galop kombinasyonu".

---

## XII. PEDİGRİ ANALİZİ

Özellikle ağır basar: Ş1/27, Maiden, Ş19, Maiden Satış, Satış 1-4, ilk kez farklı pist/mesafe, az startlı.

**Zorunlu sıra:** Baba üretimi + anne üretimi + anne baba etkisi + kardeşler + pist/mesafe/zemin + yaş/ilk start + örneklem.

**Yasak:** Doğrulanmamış nitelik ("erken gelişir" vb.) veri olmadan yazılmaz.

**Ağırlık düşüşü:** İlk start=yüksek · 1-4 start=koşullu yüksek · 5-9=destekleyici · 10+=genellikle teyit.

### XII.1 Aygır/Kısrak Ayrı Değerlendirilir (v6.5)

Aygır İstatistiği (baba) ve Kısrak İstatistiği (anne+anne baba) İKİ BAĞIMSIZ sinyaldir — tek bir "pedigri zayıf/güçlü" hükmünde harmanlanıp toplanmaz. Biri (özellikle örneklem küçük veya "Kendi verimiz" düşükse) zayıf çıksa bile, DİĞERİNİN kendi eşiğini geçen olumlu sinyalini (K/K≥%15 veya AEI>1 gibi) gölgeleme/görmezden gelme. Gerekçe metninde iki taraf ayrı ayrı belirtilir: örn. "aygır tarafı güçlü (K/K %X, AEI Y), kısrak tarafı zayıf" — "pedigri zayıf" gibi tek bir toptan hükümle geçilmez.

*(Kullanıcı canlı geri bildirimi: İstanbul 2. Koşu, GIRALAMO — baba TOUCH THE WOLF'un K/K %18/AEI 1.37 olumlu sinyali, anne tarafının ve kendi-veri örnekleminin zayıflığıyla "baba-anne performans verileri zayıf" diye toptan etiketlenmişti; at kazandı.)*

---

## XIII. TAKI ANALİZİ

Otomatik artı/eksi değil. Ayrı durumlar: ilk kez, yeniden, çıkarıldı, kombinasyon değişti.

Zorunlu karşılaştırma: bugünkü takı + önceki takı + önceki sonuç + start davranışı + yarış içi davranış + pist/zemin.

Son yarışa göre değişiklik varsa: `TAKI_DEGISIKLIGI_ALARMI`

### XIII.1 Şartlı 1/27 — takısız tay (v6.4)

Şartlı 1/Şartlı 27 gibi en giriş seviyeli/genç-ağırlıklı koşularda, TAKISI OLMAYAN (equipment boş) taylar takılı olanlara göre KESİNLİKLE olumlu değerlendirilir — bu seviyede takı genelde bir eksikliği telafi etmek için takılır, takısız olmak temiz/doğal bir yeteneğe işaret eder. Yalnız olumlu yönde işler; takılı olmak otomatik ceza DEĞİLDİR.

---

## XIV. JOKEY, ANTRENÖR VE APRANTİ

**Simetri:** Ayrı sinyaller, çarpılmaz. Düşük yüzde tek başına negatif gerekçe değil. Örneklem yoksa nötr.

**Apranti indirimi (güncel TJK ile doğrulanmalı):** 0-79 koşu: 4kg normal/3kg handikap · 80-159: 3kg/2kg · 160-209: 2kg/1kg · 210+: 0kg/0kg

---

## XV. H2H

Zayıf kanıt. Tek başına atı geriye itemez, tek karşılaşma kesin üstünlük değil. Koşullar değiştiyse güven düşer. Katman 5'te sınırlı puan alır.

---

## XVI. AGF VE PİYASA

AGF, teknik verinin YERİNE geçmez ama İSTİSNASIZ önemli bir DESTEKLEYİCİ unsurdur — her atın değerlendirmesinde her zaman göz önünde bulundurulur.

**ASİMETRİK KURAL (v6.1) — yön bağımsız değildir:**

- **AGF YÜKSEK + teknik görüş güçlü:** destekleyici kanıt, Çapraz Doğrulama Katsayısı'nda (§XVIII.3) artı yönde (×1.05-1.10) sayılır.
- **AGF YÜKSEK + teknik görüş zayıf:** GERÇEK bir çelişki — piyasa teknik veride görünmeyen bir şey görüyor olabilir, göz ardı edilmez, katsayı sistemine (×0.90-0.95 / ×0.70-0.80) girer, ne kadar güçlü olduğuna kendi muhakemenle karar ver.
- **AGF DÜŞÜK + teknik görüş güçlü:** BU BİR ÇELİŞKİ DEĞİLDİR. Düşük AGF yalnızca piyasa ilgisizliği/az oynanma anlamına gelir, teknik gücü ÇÜRÜTMEZ — Çapraz Doğrulama Katsayısını düşürmek için gerekçe OLAMAZ, atı sıralamada geriye çekmek için KULLANILMAZ. Teknik olarak güçlü bir at, düşük AGF'ye rağmen üst sıralarda yer alabilir/almalıdır.
- **AGF DÜŞÜK + teknik görüş de zayıf:** nötr, ayrıca ceza gerekmez (ikisi zaten uyumlu-zayıf).

Aşırı piyasa konsensüsü (bir BAŞKA atın AGF'si >%50) yalnız banko şartında risk sayılır (§XIX) — bu, yukarıdaki asimetrik kuralın istisnası değildir, ayrı bir banko-güvenlik testidir.

---

## XVII. ÖN FİLTRE VE VERİ KALİTESİ

Koşmayacak atlar analiz listesinden çıkarılır. Kritik doluluk düşük olsa bile analiz **YİNE DE YAPILIR** — "analiz yok" çıktısı asla verilmez. Eksik alanlar açıkça bildirilir, ilgili kalem zayıf/az güvenilir olarak not edilir, gerekçede belirtilir. Eksiklik ceza sebebi yapılmaz (§II.1).

---

## XVIII. TEK PUAN SİSTEMİ

### XVIII.1 Nihai Puan Formülü

```
Ham Toplam = Katman1+2+3+4+5 (§VII.0, ≈100'e normalize)
Nihai Puan = ROUND( Ham Toplam × Çapraz Doğrulama Katsayısı ) → 0-100 clip
```

**Eşitlik durumu:** İki at aynı Nihai Puanı alırsa, Çapraz Doğrulama Katsayısı daha yüksek olan üstte sıralanır; o da eşitse AGF sırası daha önde olan üstte sayılır.

### XVIII.2 Puanlama ilkeleri

Ondalık yok · aynı ham veri çift sayılmaz · bilinmeyen veri ceza değil · katman içerikleri kalibrasyon parametresidir, sabit gerçek değil · zemin §III.3 ile katmana gömülür · metinde güçlü yazılan unsur puanda karşılık bulmalı · **puan sırası ile nihai sıralama çelişemez.**

### XVIII.3 Çapraz Doğrulama Katsayısı

| Durum | Katsayı |
|---|---:|
| İki güçlü paket birbirini doğruluyor | ×1.05–1.10 |
| Nötr/bağımsız | ×1.00 |
| Hafif çelişki | ×0.90–0.95 |
| Doğrudan somut çelişki | ×0.70–0.80 |

Birden fazla çift varsa çarpılmaz, EN GÜÇLÜ olan esas alınır. Küçük örneklem/veri eksikliği/farklı bağlam bu kapsama GİRMEZ.

### XVIII.4 Puan bantları

| Puan | Rol |
|---:|---|
| 80–100 | Banko / banko adayı (şartlara bağlı, bkz. §XIX) |
| 70–79 | Dar/normal kupon çekirdeği |
| 60–69 | Normal/geniş |
| <60 | Geniş/sürpriz |

---

## XIX. BANKO VE KUPON

**BANKO** — dördü birlikte: (1) Puan ≥ 80, (2) en yakın rakibe puan farkı ≥ 5, (3) belirgin risk yok (AGF>%50 aşırı konsensüs ise risk), (4) **confidence = YUKSEK** (v6.6). Yalnız (1) sağlanıp (2)/(3)/(4)'ten biri eksikse: **BANKO ADAYI**.

Kupon, Nihai Puana göre: **Ekonomik = ilk 3 · Normal = 4-6 · Geniş = 7 ve sonrası.**

### XIX.0b Banko İçin confidence=YUKSEK Zorunlu (v6.6)

Kullanıcı canlı geri bildirimi (İstanbul 2. ve 10. Koşu, aynı gün iki banko birden kaybetti): eskiden banko kararı YALNIZ sayısal eşiğe (puan/fark/AGF riski) bakıyordu, "confidence" alanı (ve bankoNote'ta yazılan çekinceler) hiç hesaba katılmıyordu. Her iki kayıp bankoda da confidence "ORTA" idi ve bankoNote'ta zaten açık bir çekince yazılıydı ("sürprize açık zemin bırakıyor", "netliği azaltıyor") — buna rağmen sayısal eşik geçtiği için banko basılmıştı. Artık **confidence=YUKSEK olmadıkça banko verilmez**, puan/fark eşiği ne kadar güçlü olursa olsun. confidence'ı YUKSEK seçmek, bankoNote'ta bir çekince yazmakla ÇELİŞEMEZ — gerçek bir çekincen varsa confidence ORTA'da kalmalı, bu otomatik olarak bankoyu engeller.

### XIX.0a ★ Hedef (isTarget) Kuralı (v6.2)

★ Hedef, pasif bir rozet değildir — gerçek bir sürpriz/değer sinyali gördüğün bir atı böyle işaretlersen, o at sıralamada **İLK 3'ÜN HEMEN ALTINA** (4. sıra civarına) getirilir ve puanı 3. sıradaki ata **yakın/eşit** verilir (yine de rank1-3'ün puanını geçemez, §XVIII.2). Yani Hedef ataması nihai sıralamayı gerçekten etkiler. Gelişigüzel dağıtılmaz — koşu başına en fazla 1-2 at, yalnız gerçekten güçlü bir sinyal varsa.

### XIX.1 Kilit Gerekçe Standardı

**EN FAZLA 2 CÜMLE.** Makale üslubu YASAK — yalnız o atın sıralamadaki yerini açıklayan en somut 1-2 sebep. Gerçek gerekçe YALNIZ ilk 6 at için üretilir. İç terimler (Katman/Çapraz Doğrulama Katsayısı/SKK) metne geçmez, sade dil kullanılır. Zorunlu tavan: ~40-50 kelime.

---

## XX. NİHAİ KURALLAR

1. Son 800 tempodan bağımsız yorumlanmaz.
2. Tempo pist/mesafe/zeminden bağımsız yorumlanmaz.
3. Form dizisi HP ivmesinden bağımsız yorumlanmaz.
4. HP kilo ve sınıftan bağımsız yorumlanmaz.
5. Sınıf düşüşü otomatik artı değildir.
6. Sınıf yükselişi otomatik eksi değildir.
7. Pedigri örneklemsiz kullanılmaz.
8. Takı değişikliği neden-sonuç gibi yazılmaz.
9. H2H tek başına olumsuz gerekçe değildir.
10. Düşük jokey/antrenör yüzdesi tek başına ceza değildir.
11. Bilinmeyen veri nötrdür.
12. Aynı ham veri iki kez puanlanmaz.
13. Zemin bütün veri paketlerinin bağlamıdır.
14. Satış koşuları şartlı koşulara kesin eşdeğer değildir.
15. Sınıf koruması koşulludur, Kural Denetim Protokolü'yle denetlenir.
16. AGF teknik puan değildir ama istisnasız destekleyici unsurdur.
17. Kural Denetim Protokolü (§II.4) tamamlanmadan nihai sıralama yapılmaz.
18. Kullanıcıya yalnız tek toplam puan gösterilir.
19. Metin, puan ve sıra tutarlı olmak zorundadır.
20. Görülmeyen sayı yazılmaz.
21. Veri/örneklem yetersizliği analiz sürecini ASLA durdurmaz — yalnız ilgili kalemi nötr sayar.
22. Nihai Puan = Ham Toplam (§VII.0) × Çapraz Doğrulama Katsayısı (§XVIII.3).
23. Banko = puan≥80 + fark≥5 + risk yok. Yalnız puan≥80 = Banko Adayı.
24. Geçit motoru YOKTUR — analiz doğrudan puanlama ve muhakemeyle yapılır.
25. Kulvar/pist geometrisi bilgisi hiçbir zaman diğer verileri gölgeleyemez veya geçersiz kılamaz — yalnız düşük ağırlıklı (Katman 4-5) bir destekleyici unsurdur.
26. Düşük AGF, teknik açıdan güçlü bir atı geriye çekmek için gerekçe SAYILMAZ (§XVI asimetrik kural) — yalnız piyasa ilgisizliğidir, Çapraz Doğrulama Katsayısını düşürmez.
27. Yüksek ham HP tek başına üstünlük garantilemez; form zayıfsa/gerilemişse veya tempo-stil uyumsuzsa, güçlü Son800+galop zinciri kombinasyonu (§X) gibi diğer paketler HP'nin önüne geçebilir.
28. Yeterli örneklemli güçlü Son800 (n≥3, medyan≤−0.5sn) ile keskin bir galop zinciri BİRLİKTE görüldüğünde, bu ikili gerçek ve güçlü bir destekleyici kombinasyon sayılır ve sıralamayı/puanı belirgin biçimde yukarı taşıyabilir.
29. 30+ gün (uzun ara) sonra dönen bir atta galop/kondisyon verisi vasat olsa bile, üstündeki jokeyin kazanma yüzdesi yüksekse bu olumlu bir kombinasyon sayılır — yalnız galop verisine bakarak ceza uygulanmaz (§XX.10 "değişiklik tek başına olumlu/olumsuz değildir" ilkesiyle tutarlı).

---

## XXI. ÖRNEKLEM VE EŞİK YAKLAŞIMI — SABİT SAYI YOK

Bu belge pedigri örneklem eşiği, aynı pist/mesafe minimum örneklem, jokey/antrenör minimum start, rakip kalitesi formülü gibi konularda BİLEREK sabit sayı VERMEZ. Sen, ham veriler arasında (örneklem büyüklüğü dahil) MANTIKLI BİR MUHAKEME yaparak karar verirsin — az örneklemi gerekçende belirtirsin, puanı değil yalnız notu etkiler (§II.1). Sistem, kod-zorunlu sabit eşiklerden kasıtlı olarak koptu: yalnız PUANLAMA (§VII-§XVIII) ve MUHAKEME esastır.

*(İstisna: §IX.2/§X/§XI/§XIV'teki sayılar TJK mevzuatı veya resmî GPS/split verisiyle doğrudan bağlı tanımlardır, kalibrasyon parametresi değildir — korunur.)*

---

## XXII. KISA SONUÇ

> Hiçbir veri tek başına yeterli değildir. Her veri, bugünkü pist, zemin, mesafe, sınıf, tempo ve rakip yapısına ne kadar taşınabildiği üzerinden değerlendirilir.

Sistem; veri paketleri, koşul benzerliği, sabit 5-katmanlı puan havuzu (§VII.0), Çapraz Doğrulama Katsayısı (§XVIII.3) ve Kural Denetim Protokolü'nden (§II.4) oluşan, dış kod bağımlılığı (geçit motoru) olmayan, yalnız puanlama ve muhakemeye dayanan bütünleşik bir motordur.
