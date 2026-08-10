# ROTAGANYAN BÜTÜNLEŞİK ANALİZ MOTORU — v6.34

*(Sürüm: v6.34, 2026-08-02 — Ajan-2'nin kod tarafında yaptığı, daha önce bu dökümana yazılmamış değişikliklerin resmî kayda geçirilmesi (Ajan-3, döküman/DB senkronu). Kullanıcının Faz1→Faz2→Faz3 akışı üzerindeki 10 kategorilik denetimi sonucu: (1) `getPistMesafeStilIstatistigi` (bugünkü hipodrom+pist+mesafe ±200m'deki geçmiş kazananların stil dağılımı, önceden yalnız /program'daki bilgi kutusunda kullanıcıya gösteriliyordu) Faz1'e eklendi (§IX.7 madde 5); (2) Faz2 prompt'una madde 24-34 (eküri+tempo, dıştan start+mesafe+stil, kulvar bölgesi, pist rekoru bağlamı, hipodrom+yıl vs pist/mesafe geçmişi çifte-sayılmaz, start geçmişi ağırlığı koşu tipine bağlı, mesafe değişimi+stil+Son800, jokey değişikliği+stil uyumu, form+sınıf+HP ivmesi çatalı, pedigri ağırlığı deneyimle azalır, H2H geçerlilik şartı) + REDUNDANS/"TEK PAKET" kuralı eklendi (§V, §XX.42); (3) Faz3'ün Kural Denetim Protokolü'ne (§II.4) k-t maddeleri eklendi (a-j'nin YANINA, onlar bozulmadı) — k-t şu an yalnız prompt talimatı, kod-taraflı mekanik doğrulaması Ajan-2 tarafından ayrıca yazılıyor (bkz. `rotaganyan/AKTIF_GOREVLER.md`); (4) §VII.0'daki 5 katmanlı puan aralıkları ARDIŞIK hale getirildi (22-30/16-22/12-16/8-12/5-8 → 23-30/17-22/13-16/9-12/5-8, eski sınırlarda üst-alt çakışma vardı) ve `score`'a `min(100,...)` tavanı eklendi. Kullanıcının istediği ama bilinçli REDDEDİLEN/orantısız bulunan 2 madde: mekanik ön-hesaplamanın SESSİZCE değil yalnız KANITLA değiştirilebilmesi zorunluluğu (§XX.41 — Çokomel Kız post-mortem'i nedeniyle "sessizce değiştirilemez" tam yasağı yerine bu yumuşatılmış hâliyle kabul edildi) ve her Faz1 alanına provenance-metadata eklenmesi (orantısız bulundu, yerine ucuz TEK PAKET kuralı kondu). Gerçek koşuda (İzmir 1.Koşu, ŞARTLI 5/1400m) uçtan uca canlı test edildi: 362sn'de tamamlandı, pist+mesafe stil sinyali gerekçe metninde fiilen kullanıldı, puanlar 100'ü aşmadı.)*
*(Sürüm: v6.33, 2026-08-02 — kullanıcı kararı: v6.32'de own-data'ya (SireStatOwn/DamStatOwn) geçilirken, eski üçüncü-parti-kaynak döneminden kalma sabit "örneklem <3 start ise gösterme" eşiği (`OWN_MIN_ORNEK`) korunmuştu — bu, 1-2 startlık aygır/kısrak eşleşmelerini Faz2'ye HİÇ göndermeden sessizce siliyordu. Kullanıcı "ya aslında yarış sınırı kalksın değerlendirmeye alınsın" dedi — bu, §II.1'in ("Bilinmeyen veri NÖTR kabul edilir... Örneklem/veri yetersizse o kalem NÖTR sayılır, analiz süreci HİÇBİR ZAMAN durdurulmaz — yalnız o kalemin notu zayıf/az güvenilir olarak işaretlenir") ve [[feedback_sert_kosul_yasak]] doktrininin doğrudan bir uygulaması: hiçbir kural sabit eşikle Claude'un elindeki veriyi analiz dışı bırakamaz. Değişiklik (`sire-stat-match.ts`): `formatSireStatOzet`/`formatDamStatOzet`/`formatDamSireStatOzet`'teki `if (s.start < OWN_MIN_ORNEK) return null` satırları kaldırıldı — artık start≥1 olan HER eşleşme formatlanıp gönderiliyor. Güven etiketi (`ornekGuveniEtiketi`) ince bir basamak kazandı: n<3 artık "[ÇOK DÜŞÜK ÖRNEKLEM]" (öncekinden ayrı), n<10 "[DÜŞÜK ÖRNEKLEM]", n≥50 "[geniş örneklem]" — veri gizlenmiyor, güvenilirliği açıkça söyleniyor. Gerçek bir koşuda doğrulandı: 1-2 startlık kısrak eşleşmeleri (ör. GÖLALAN, 2 start) artık "[ÇOK DÜŞÜK ÖRNEKLEM]" etiketiyle çıktıda görünüyor, öncesinde tamamen sessizce atlanıyordu.)*
*(Sürüm: v6.32, 2026-08-01 — kullanıcı kararı: aygır/kısrak istatistiğinde iki paralel kaynak vardı — üçüncü parti bir siteden elle kopyala-yapıştır (SireStat/DamStat, geniş tarihsel taban + AEI) ve rotaganyan'ın kendi Runner/Result verisinden otomatik hesaplanan (SireStatOwn/DamStatOwn, ince pist×mesafe kırılımı, cron ile günlük güncel). Site sağlık kontrolü sırasında üçüncü parti tabloların 8-9 gündür elle güncellenmediği fark edildi; kullanıcı "kendi verimiz (otomatik): daha ince pist×mesafe kırılımı daha önemli bence, AEI'ye gerek yok" dedi ve o kaynağın analiz akışından TAMAMEN kaldırılmasını istedi. Değişiklik: `getSireStatOzetleriForRace`/`getDamStatOzetleriForRace` (sire-stat.actions.ts/dam-stat.actions.ts) artık yalnızca SireStatOwn/DamStatOwn'dan okuyor, üçüncü parti pool sorgusu ve eşleştirmesi (`findSireStat`/`findDamStat`, `SireStatLite`/`DamStatLite`) tamamen silindi; Faz2 prompt'undaki AEI/örneklem-ikili-kaynak metni kaldırılıp tek-kaynak metne çevrildi (oto-analiz-faz2/route.ts). Üçüncü parti kaynaktan yapıştırılan SireStat/DamStat modelleri ve admin'deki Aygır/Kısrak İstatistik elle-giriş sayfaları o dönem kod tabanında duruyordu (2026-08-10'da tamamen kaldırıldı) ama zaten analiz akışına hiç girmiyordu. §XII.1'deki AEI örneği own-data K% örneğiyle değiştirildi, kuralın özü (aygır/kısrak/damsire üç bağımsız sinyal) değişmedi.)*
*(Sürüm: v6.31, 2026-08-01 — kullanıcı talimatı: thinking kapalı/açık kalite testinde (aynı koşu, RASTGELOĞLUM örneği) nihai sıralamanın thinking olmadan belirgin oynadığı (bazı atlar 3-4 sıra kayıyordu) gözlendi — kök neden tek tek veri okuma değil, kanıtları tartıp sıraya dökme (sentez) adımıydı. Kullanıcı, bu sentezi thinking'e bağımlı olmaktan çıkarıp PROMPT İÇİNDE daha açık bir öncelik çerçevesine bağlamayı istedi: "Şartlı 1/19/27 gibi ya da ilk defa mesafeye/zemine çıkacak atlarda pedigriler/galoplar önde olmalı, diğer her yarış türünde tempo+takı değişikliği ağırlık verilmeli, ama jokey uyumu/antrenör istatistikleri/Son Hazırlıklar/Pedigriler/H2H/Aynı Pist-Mesafe karşılaştırması/Son Yarış Detayları/Detaylı İstatistikler kesinlikle göz ardı edilmemeli." Bu öncelik sırası aslında §VII.1/§VII.2/§VII.9 kartlarında zaten VARDI — yeni olan, (a) "ilk defa bu mesafe/pist kombinasyonu" için AT BAZINDA bir istisna kartı (aşağıda §VII.0) ve (b) bu önceliğin Faz2 prompt'unda madde 23 olarak AYRICA, thinking'siz de kaçırılamayacak netlikte tekrarlanması. Mevcut 22 maddenin hiçbiri kaldırılmadı/daraltılmadı — bu saf bir EKLEME.)*
*(Sürüm: v6.30, 2026-08-01 — kullanıcı talebi: "Start Sorunu olan atları tespit edebilir miyiz. geç çıkan hiç çıkmayan vs". Araştırma: TJK'nın canlı sonuç sayfasında (`GunlukYarisSonuclari`) gerçek bir "Geç Çıkış" (G. Çık.) sütunu olduğu bulundu — TJK'nın KENDİ resmi start-kalitesi tespiti (kaç boy geriden kalktığı, örn. "3 Boy"), ölçüm/tahmin değil. Bu alan HTML'de zaten geliyordu ama hiç ayrıştırılıp kaydedilmiyordu. Eklenen: `Result.gecCikanlar` (Json, `{no,name,fark}[]`) — hem ileriye dönük (result-sync.ts, her yeni sonuç senkronizasyonunda otomatik) hem geriye dönük (504 geçmiş hipodrom+gün tek seferlik backfill script'iyle tarandı: 1872 koşuda toplam 2767 geç-çıkış kaydı bulundu). Yeni servis: `gec-cikis.actions.ts` — bir atın TÜM geçmiş sonuçlu starlarını tarayıp "son N startta M kez geç çıktı" özetini üretir (örneklem <3 ise gösterilmez). Faz1'e 13. veri kategorisi olarak eklendi: **Start Geçmişi**. §XX'e madde 39, Faz2 prompt'una madde 22 eklendi — tekrarlayan (2+) geç çıkış GERÇEK olumsuz sinyal, özellikle kısa mesafe/kalabalık sahada ağırlığı artar; temiz sicil olumlu; tek kayıt nötr.)*
*(Sürüm: v6.29, 2026-07-31 — canlı bulgu: v6.26'nın Faz2 "muhakeme" adımı ilk canlı denemede Vercel'in 300sn sert fonksiyon süresi sınırını aştı ("Sunucudan geçerli bir yanıt gelmedi" hatası). Kök neden veri çekme HIZI DEĞİL (Faz1 hâlâ tamamen kendi DB'sinden, hızlı): eski Faz2 yalnız bir sayı+sıra üretirken (birkaç yüz karakter), yeni Faz2 her at için AÇIK UÇLU "ayrıntılı" bir metin üretmeye başlamıştı — bu hem Faz2'nin üretme süresini hem Faz3'ün okuyacağı girdi boyutunu ciddi büyüttü; eski sistemde bile Faz2/Faz3 çağrıları zaten 227-278 saniye sürüyordu (sınıra çok yakın), yeni uzun metin bunu aştı. Kullanıcı önemli bir uyarı ekledi: "bu verileri görmezden gelmesine üstün körü analiz muhakeme yapmasına neden olur" — yani düzeltme YALNIZ FORMAT sıkılaştırması olmalı, kapsam daraltması OLMAMALI. Düzeltme: Faz2 hâlâ veri/sinyal taşıyan HER kategoriyi (19 madde) mutlaka değerlendirip belirtmek ZORUNDA, hiçbiri atlanamaz — yalnız her madde için TEK kısa cümle/madde yeterli, uzun paragraf/deneme yazılmıyor. Toplam uzunluk atın kaç kategoride gerçek sinyali olduğuna göre doğal değişir, kısalık İÇİN veri asla atlanmaz. Ayrıca not: Faz 3 zaten Faz 2'nin özetiyle SINIRLI değil — ham ATLAR verisinin TAMAMINI da ayrıca kendi mesajında görüyor, bilgi kaybı riski yok.)*
*(Sürüm: v6.28, 2026-07-30 — kullanıcı kendi hazırladığı bir "Yarış Öncesi Tempo/Mesafe/Stil Rehberi" görseli paylaştı, "hipodrom özellikleriyle birlikte iyi yorumlanabilir" dedi. Yeni **§IX.7** eklendi: kısa/orta/uzun mesafeye göre hangi yarış stilinin (Kaçak At/Ön Grup Arkası/Bekleme Grubu/En Geri Takip — zaten var olan 4 kategori) avantajlı olduğu matrisi + "kaç net lider adayı var → tempo düşük/orta/sert" pratik okuma + kulvar (§III.2) ile birlikte okuma yöntemi. Hiç yeni veri kalemi gerekmedi — mesafe/sahadakiKacakSayisi/kulvarBolge/raceStyleEtiket zaten Faz1'de vardı, yalnız YORUMLAMA ÇERÇEVESİ eklendi. Jokey "agresif/sabırlı" eğilimi bilinçli olarak EKLENMEDİ (sabit veri kaynağı yok, uydurmamak için atlandı).)*
*(Sürüm: v6.27, 2026-07-30 — kullanıcı talebi: aynı gün içinde, v6.24/v6.25'te "sade ve hızlı" gerekçesiyle kaldırılan 9 kategorilik sabit listeden 2'si geri istendi (ekran görüntüleriyle): (1) **Jokey/Antrenör GENEL yıllık win%** (JockeyStatSync/TrainerStatSync, sync-jokey-stats/sync-trainer-stats) ve (2) **Zemin Geçmişi + Sınıf-bağlamlı Form** (`getGecmisBaglamForRace`, kod hâlâ duruyordu, yalnız Faz1 çağırmıyordu). Jokey pist/mesafe/SKK "kendi verimiz" K%'si, jokey+antrenör "hot streak" kombinasyonu ve at-jokey geçmişi KALDIRILMIŞ olarak kalıyor — yalnız bu 2 kategori geri geldi, liste artık 11 kalem. `getGecmisBaglamForRace` içindeki iki sonuç dizisine (`zemin`/`sinifBaglamliForm`) güvenli eşleştirme için `no` (runner numarası) eklendi — önceki index-bazlı eşleştirme riskli olurdu (fonksiyonun kendi iç sorgusu farklı sırada dönebilirdi).)*
*(Sürüm: v6.26, 2026-07-30 — kullanıcı sorusu: "puanlama sence muhakemeden sonra mı yapılmalı? verile puana göre sıralama için muhakeme yapılıyor ama öncesinde veriler muhakeme edilip sonrasında puanlama yapılsa daha realist olmaz mı?" + doğrudan talimat: "bence şimdi yap". Faz2/Faz3'ün ROLLERİ TERSİNE ÇEVRİLDİ: eskiden Faz2 doğrudan bir 0-100 puan üretiyordu, Faz3 o puanı "başlangıç noktası" sayıp gerekçelendiriyordu — bir sayı bir kez ortaya çıkınca sonraki adım genelde onu DOĞRULAMAYA çalışır, yeniden düşünmez (çapalama/anchoring önyargısı riski). Artık: **Faz 2 = MUHAKEME** (hiçbir sayısal puan üretmeden, her at için ayrıntılı kanıta dayalı analiz metni + yalnız kaba bir "teknikSira" ön-sıralaması yazar), **Faz 3 = PUANLAMA + NİHAİ SIRALAMA** (Faz 2'nin muhakemesini girdi alıp §XVIII formülünü/Çapraz Doğrulama Katsayısı'nı KENDİSİ uygulayarak 0-100 puanı hesaplar, sonra Kural Denetim Protokolü'nü uygulayıp nihai sıralamayı belirler — tek çağrıda). §XVIII.3'teki formülün İÇERİĞİ değişmedi, yalnız NE ZAMAN uygulandığı değişti. AGF Asimetrisi/Motto Senaryosu kontrolleri (§XVI) hâlâ Faz 2'nin "teknikSira"sını (artık saf muhakemeden çıkan bir ön-sıra, sayısal puandan değil) referans alıyor — davranışsal olarak değişmedi. "Tam Saha Muhakeme Zorunluluğu"nun (§XVII.1) mekanik yedek-puan güvenlik ağı artık Faz 2'nin `puan` alanı yerine `teknikSira`'dan kaba bir yaklaşımla türetiliyor (bu yedek yol v6.24'ten beri zaten nadiren tetikleniyor).)*
*(Sürüm: v6.25, 2026-07-30 — kullanıcı talimatı: "analiz motorunu yeniden oluşturuyoruz, sade ve hızlı ve en doğru muhakeme yapılacak şekilde" + kullanıcının onayladığı sabit 9 kategorili kapsam listesi. Faz1'den BİLİNÇLİ olarak kaldırılanlar: jokey/antrenör genel win% yüzdesi, jokeyin pist/mesafe/SKK kademesindeki kendi verimiz K%'si, jokey+antrenör "hot streak" kombinasyonu, at-jokey geçmişi, sınıf-bağlamlı form, zemin geçmişi, antrenör ekipman-değişikliği geçmişi, aprantı kalan koşu sayısı (§XIV.1 lider-only'ye döndü + yeniden yazıldı). Eklenen: HorseStatsCache (TJK Detaylı İstatistikler — Zaman/Hipodrom/Jokey/Pist/Mesafe kırılımı, bugünkü hipodrom/pist/mesafe/jokey bağlamına göre eşleştirilip tek satırlık özet olarak Faz1/Faz2'ye geçiyor, `detayliIstatistikOzet`). §IV.1 eşleşme haritasına 4 yeni satır (Son800 izafi+Yarış Stili, Detaylı İstatistikler Pist kırılımı+bugünkü pist, En İyi Derecesi aynı hipodrom/mesafe/pist+bugünkü bağlam, AGF Trend+Detaylı İstatistikler kazanç geçmişi) ve "Değişim Profili" (KGS+Takı+Kilo+Aynı Jokey bütün olarak okunur) kombinasyonu eklendi. Takı değişikliği Faz2 prompt'unda artık "⚠ RADARA AL" ile ayrıca vurgulanıyor. Kalan 9 veri kategorisi: Accurace/Ara Geçişler, AGF Trend, Son Hazırlıklar (galop+aynı jokey), Pedigriler, H2H, Detaylı At Karşılaştırma (aynı pist/mesafe), Son Yarış Detayları, Hipodrom Özellikleri, HorseStatsCache.)*
*(Sürüm: v6.24, 2026-07-29 — kullanıcı geri bildirimi: "AGF top-3 kuralı toptan saçmalık, ben atları analiz ederken sistemin doğru muhakeme yapmasını istiyorum" + "koşuda yarışan her at detaylarıyla analiz edilecek, analiz detayları göz ardı edilmeden — bu değişmez kural olsun." Gerçek örnek: İstanbul 5.Koşu ÇOKOMEL KIZ (AGF #5, v6.22/v6.23'ün AGF top-3 kuralının kapsamı DIŞINDA), 5.5 kg kilo düşüşü ve kaçak stiline rağmen hiç gerekçelendirilmeden mekanik puanla 8. sıraya düşürülmüş, sonra kazanmıştı — kanıtladı ki kök neden AGF sırası değil, Claude'un enIyiN kadar at için gerçek muhakeme üretmeme riskiydi. Aksiyon: (1) v6.22/v6.23'ün AGF top-3 (lider+#2/#3) gerekçe zorunluluğu GERİ ALINDI, §XVI.1 yeniden yalnız AGF liderini kapsıyor (v6.8 orijinaline döndü); (2) enIyiN artık sahaBuyuklugu'na eşit (kapak kaldırıldı) — TÜM saha gerçek score/details alıyor, yeni §XVII.1 "Tam Saha Muhakeme Zorunluluğu" bunu evrensel, AGF'den bağımsız bir kural olarak kodluyor; (3) assertPublishSafe'teki AGF top-3 sert yayın engeli kaldırıldı (manuel tahminleri bloke etme riski nedeniyle yerine sert bir engel eklenmedi, yalnız admin panelinde her zaman görünür bir denetim var).)*
*(Sürüm: v6.23, 2026-07-27 — netleştirme: kullanıcı v6.22'nin AGF top-3'ü Claude'un kendi top-3'üne YAKINSATABİLECEĞİNDEN, AGF #4/#5'in top-3'e girmesini caydırabileceğinden endişe etti. Netleştirildi: kural yakınsama ZORUNLULUĞU değil, yalnız ŞEFFAFLIK zorunluluğu — AGF top-3'ü geride bırakmak (kanıtla) tamamen serbest kalıyor, yalnız nedeni yazılı olmalı; düşük AGF'li bir atı top-3'e taşımak da hiç caydırılmıyor. §XVI.1 ve Faz3 madde 6'ya bunu açıkça belirten bir cümle eklendi.)*
*(Sürüm: v6.22, 2026-07-27 — gerçek isabet-oranı denetimi: kullanıcı "hâlâ fazların gerçekten çalıştığını düşünmüyorum" dedi, hedefin "kazanan atı ilk 3'te bulmak" olduğunu hatırlattı. 190 sonuçlanmış+yayınlanmış koşu, GÜNCEL picks verisinden (stored hitTop1/hitInCoupon değil, o alanlar bayat çıktı — ayrı bir düzeltme, bkz. result-utils.ts recomputeHitStatsForRace) yeniden tarandı: sistem top-3 isabeti %66.8, yalnız AGF top-3 %69.5 — küçük ama gerçek bir fark. Asıl bulgu KIRILIMDA: sistemin kaçırdığı 15 vakadan 10'u AGF'nin #3'üydü (piyasanın ciddiye aldığı, sürpriz OLMAYAN bir at), çoğunlukla hiç gerekçe üretilmeden top-3 dışına itilmişti. §XVI.1'in "AGF lideri gerekçesiz kalamaz" kuralı artık yalnız lideri değil AGF top-3'ün TAMAMINI kapsıyor — hem Faz2/Faz3 talimatlarında hem yayın güvenlik kontrolünde (assertPublishSafe).)*

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

**Zemin Geçmişi (v6.26, kullanıcı talebi 2026-07-30: "anlık zemin ile koştukları zeminler arasındaki bağ"):** ATLAR tablosunda, bugünküyle AYNI zemin sınıfında (Sert/Normal, Hafif Islak/Nemli, Islak/Ağır) atın TÜM geçmiş start'ları — hipodrom/mesafe/yıl sınırı YOK, yalnız zemin sınıfı eşleşmesi aranır (nadir görülen bir koşul olduğu için örneklem daraltılmaz). Faz2'nin "AÇIKTA VERİ KALMASIN" maddesi bu satırı da kapsıyor — veri varsa sessizce atlanamaz.

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

Tek başına hiçbir modül yeterli kanıt değildir (§II.1/§XXII). Aşağıdaki eşleşme haritası (v6.12, güncellendi v6.24), sahadaki her veri modülünün en az bir eşleşmede geçtiği, kategorilere ayrılmış tam bir okuma rehberidir.

### IV.1 Eşleşme Haritası — Hangi Modüller Birlikte Okunmalı

**A. Performans-içi eşleşmeler (yarış sırasında ne oldu)**

| Eşleşme | Birlikte cevapladığı soru | En güçlü olduğu yer |
|---|---|---|
| Tempo + Son800 | Nerede koştu, gücü sona mı kaldı | Maiden hariç tüm tipler |
| Tempo + Ara Geçişler | Tek yarışlık görüntü mü, tekrarlayan gerçek stil mi | Ş3-5, Handikap, KV, Grup |
| Ara Geçişler + Kulvar | Bu at, bu kulvardan geçmişte hangi pozisyonlara düşüyor | Kalabalık saha, kısa mesafe |
| Tempo Haritası + Kulvar | Bugünkü sahanın yapısına göre pozisyon maliyeti ne kadar | Kalabalık saha (10+), kısa mesafe (≤1300m) |
| Tempo Haritası + Tempo (bireysel) | Atın stili, bugünkü saha dağılımıyla çakışıyor mu | Kaçak sayısı çok olan sahalar |
| Son800 + Kilo Değişimi | Kilo değişimi kapanış gücünü nasıl etkilemiş | Kilo değişen atlar |
| Son800 (izafi, "en iyiye yakın"/"yarışın en iyisi ✓") + Yarış Stili | Son800 artık ham saniye değil, o günkü sahaya göre bağlamsallaştırılmış geliyor — bu izafi değer stil etiketiyle TUTARLI mı (v6.24). Örnek: bir at çoğunlukla "Bekleme Grubu" ama bir seferinde "Kaçak At" + zayıf Son800 ise stil TUTARSIZLIĞI, tek başına zayıf bir sinyal; hem stil hem izafi Son800 aynı yönü destekliyorsa (örn. "Kaçak At" + "yarışın en iyisi ✓") güçlü, birleşik bir sinyaldir | Tekrarlayan Son800 kaydı olan her at |

**B. Kalite-ve-form eşleşmeleri (at gerçekte ne durumda)**

| Eşleşme | Birlikte cevapladığı soru | En güçlü olduğu yer |
|---|---|---|
| HP + Kilo | Kaliteye göre uygun yük taşıyor mu | Handikap'ta merkezi, her tipte önemli |
| HP İvmesi + Form | Bitiriş sırası mı yanıltıyor, gizli gelişim mi var | Maiden, Ş2-5, Handikap, KV |
| HP İvmesi + Sınıf (geçiş yönü) | Sınıf düşüşü gerçek avantaj mı, yoksa HP zaten dipteyken mi geldi | Sınıf değiştiren her at |
| HP + Sınıf + Form yönü | Rakip kalitesine göre gerçek güç nedir (Rakip Kalitesi'nin kaynağı — ayrı alan yok, bkz. §II.4 madde 11) | Tüm tipler |
| Sınıf (geçiş) + Kilo Değişimi | Sınıf düşüşü gerçek avantaj mı, yoksa kilo artışıyla dengelendi mi | Sınıf değiştiren + kilo değişen atlar |
| Form + Dinlenme (gün aralığı) | Bugünkü form eğilimi dinlenme süresiyle tutarlı mı (Sezon Formu'nun kaynağı — ayrı alan yok) | Uzun/kısa aralı çıkışlar |

**C. Hazırlık ve deneyim eşleşmeleri (koşuya nasıl geldi)**

| Eşleşme | Birlikte cevapladığı soru | En güçlü olduğu yer |
|---|---|---|
| Galop + Form (son yarış) | Toparlanma / form devamlılığı gerçek mi | Ş1/27, Maiden, uzun ara sonrası |
| Galop + Dinlenme (gün aralığı) | Uzun aradan dönüşte hazırlık yeterli mi | >180 gün aradan dönen atlar |
| Pedigri + Pist/Mesafe Uyumu | Deneyim yoksa yatkınlık var mı | Ş1/27, Maiden, ilk kez farklı pist/mesafe |
| Pedigri + Zemin Uyumu | Islak/ağır zeminde hat avantajlı mı (anne hattı kontrolü) | Ağır/ıslak pist günleri, az startlı atlar |

**D. Koşul-uyumu eşleşmeleri (bugünkü şartlar ne kadar tanıdık)**

| Eşleşme | Birlikte cevapladığı soru | En güçlü olduğu yer |
|---|---|---|
| Kilo + Kilo Değişimi + Pist/Mesafe Uyumu | Bugünkü kilo, o pist/mesafede geçmişte taşıdığına göre avantajlı mı (§IV.2 Kilo paketi) | Tüm tipler, özellikle Handikap/KV |
| Kilo + Zemin Uyumu | Islak zeminde kilo etkisi büyüyor mu (§III.3, ×1.15/×1.30) | Ağır/ıslak pist günleri |
| Pist/Mesafe Uyumu + Zemin Uyumu | Bugünkü koşullar, en iyi sonuç aldığı koşullara ne kadar benziyor (Koşul Benzerliği'nin kaynağı — bkz. §III.2) | Tüm tipler |
| Detaylı İstatistikler (Pist kırılımı: Çim/Kum/Sentetik) + bugünkü pist türü | Zemin/Pist Uyumu artık tahmine değil doğrudan sayıya dayanır — "Kum: 1 start, 1.sıra, 120.000₺" gibi gerçek TJK kaydı (v6.24). Bugünkü pist türüyle eşleşen satır DİREKT kullanılır, diğer pist satırları yalnız referans kalır | Pist türü belirli her koşu |
| En İyi Derecesi (aynı hipodrom+mesafe+pist) + bugünkü hipodrom/mesafe/pist | Pist/Mesafe/Hipodrom Uyumu'nun en somut hali — "benzer" değil birebir eşleşen bir geçmiş kayıt (v6.24) | Tüm tipler, veri varsa öncelikli |

**E. İnsan-faktörü eşleşmeleri**

| Eşleşme | Birlikte cevapladığı soru | En güçlü olduğu yer |
|---|---|---|
| Jokey + Antrenör + Tempo (stil) | Binici-at-hazırlık gerçekten uyumlu mu | Ş1/27, Maiden, hassas tempolu KV/Grup |
| Jokey + Takı ("aynı jokey idman yaptı" etiketi) | İdman jokeyi = yarış jokeyi mi (atı bizzat tanıyor mu) | Tüm tipler, özellikle az startlı atlar |
| Takı + önceki takı sonucu | Bu değişiklik davranış sorununu hedefliyor mu | Huysuz/start sorunlu atlar, Maiden, alt handikap |

**F. Geçmiş-karşılaşma eşleşmesi**

| Eşleşme | Birlikte cevapladığı soru | En güçlü olduğu yer |
|---|---|---|
| H2H + (Kilo/Takı/Mesafe/Sınıf değişimi) | Geçmiş karşılaşma bugün hâlâ geçerli mi, yoksa şartlar değişti mi | H2H'si olan her eşleşme |

**Üçlü / daha geniş kombinasyonlar:**
- **Pedigri + Galop + Jokey+Antrenör** — az startlı/ilk-start atlarda üç ayrı zayıf sinyalin birleşimi, tek başına hiçbirinin veremeyeceği bir güven oluşturur (§III zorunlu taban kuralının temeli).
- **Kilo + Kilo Değişimi + Pist/Mesafe Uyumu + Zemin Uyumu** — dördü birden, ağır/ıslak pistte kilo değişen ve daha önce aynı yerde farklı kiloyla koşmuş bir atta en yüksek bilgi değerini taşır.
- **"Değişim Profili" — KGS + Takı + Kilo Değişimi + Aynı Jokey BİR ARADA (v6.24):** Faz1'in "Son Yarış Detayları" satırı bu dördünü zaten TEK satırda verir — bunlar dört ayrı puan kalemi olarak değil, TEK bir "bugün geçen seferden ne değişti" sorusu olarak okunur. Aynı anda BİRDEN FAZLA değişim varsa (örn. takı eklendi/çıkarıldı + kilo değişti + jokey değişti + uzun aradan geliyor), bu tek tek değil BÜTÜN olarak yüksek belirsizlik taşıyan bir "büyük değişim" durumu sayılır — gerekçede bu bütünlük açıkça belirtilir, tek bir değişikliğe indirgenmez.

**Eşleşmeme durumu:** Bir modülün eşleştiği veri yoksa (örn. ilk-start atta Tempo/Son800/Ara Geçişler hiç yok), o modül TEK BAŞINA, SINIRLI bir kanıt olarak okunur — bu bir ceza sebebi DEĞİLDİR, yalnız o çiftin sağladığı ek güven kaybedilir (§II.1).

**Ayrıca (AGF ve Eküri — az sayıda ama önemli, kendi bölümlerinde detaylandırılan) tekil eşleşmeler:**

| Eşleşme | Ne anlatır |
|---|---|
| AGF + teknik veri ayrışması | Piyasa ile sistem arasında fark var mı — AGF doğrudan teknik puan değildir (§XVI) |
| AGF Trend (mutlak fark) + Detaylı İstatistikler kazanç/start geçmişi | Piyasanın kaydırdığı para, atın GERÇEK geçmiş performansıyla örtüşüyor mu (v6.24). Örnek: bir at belirgin yükselen trend + yüksek AGF ile favori ama Detaylı İstatistikler'de hiç start/kazanç kaydı yoksa (debüt/ilk start) — piyasa güveniyor ama geçmiş veri yok, bu AGF ayrışma bulgusunun TERSİ bir uyumsuzluk sinyalidir (veri yokluğuna rağmen güçlü AGF), temkinli okunmalı — otomatik olumlu ya da olumsuz sayılmaz, yalnız not düşülür |
| Eküri + tempo rolleri + zemin | Olası taktik rol uyumu — kesin taktik varsayılmaz |

### IV.2 Zorunlu çekirdek paketler

**Tempo:** Tempo stili + saha tempo haritası + ara geçiş sıraları + Son 800 + zemin
**Form:** Form dizisi + HP ivmesi + sınıf + rakip kalitesi + zemin — çıplak "5-1-8-7" bitiriş sırası dizisi (recentForm) tek başına sınıf bağlamı taşımaz, atın ÖNCEKİ sınıfı (sinifOnceki) ile BUGÜNKÜ sınıfı (classType) ayrıca karşılaştırılır — aynı rakam farklı sınıfta farklı anlam taşıyabileceğini (v6.10) bu ikisini birlikte okuyarak KENDİN değerlendir. **Sınıf-bağlamlı Form (v6.26, kullanıcı talebi 2026-07-30):** ATLAR tablosunda artık ayrıca "Sınıf-bağlamlı Form" satırı var — son 5 start'ın bitiriş sırası, HER BİRİNİN o günkü sınıfıyla birlikte ("6.(Handikap 14)" gibi) — daha zor bir sınıfa karşı orta sırada bitirmek, kolay bir sınıfta iyi sırada bitirmekten daha güçlü bir sinyal olabilir.
**Kilo:** Bugünkü kilo + kilo değişimi + HP + sınıf + tempo stili + benzer zemin geçmişi — MUTLAK değil sahadaki DİĞER atlara göre GÖRELİ okunur (bir atın 56kg taşıması, sahanın ortalaması 60kg'sa avantaj, ortalaması 52kg'sa dezavantajdır)
**Kondisyon:** Son yarış + geçen gün + son galop zinciri + galop splitleri + çalışma pist/zemini
**Pedigri:** Baba istatistiği + anne üretimi + anne baba etkisi + kardeş performansı + pist/mesafe/zemin + örneklem
**Takı:** Bugünkü takı + önceki takı + değişiklik türü + geçmiş sonuç + start/yarış davranışı

---

## V. REDUNDANS VE ÇİFTE SAYIM KONTROLÜ

Kontrol edilecek gruplar: AGF stil etiketi ↔ tempo-split stil etiketi · Tempo+Son800 ↔ tempo+ara geçişler · Son yarış form dizisi ↔ aynı yarıştan türetilen başka form sinyalleri · HP ivmesi ↔ HP patlaması · Aynı pist/mesafe başarısı ↔ koşul benzerliği katsayısı · Jokey-antrenör yüzdeleri ↔ sınıf/HP kalitesi · Pedigri pist uyumu ↔ kardeş performansı (aynı kaynaksa).

> Aynı yarış akışından türeyen üç tempo sinyalinden en fazla ikisi birincil ağırlıkta kullanılabilir.

**"TEK PAKET" kuralı (v6.34):** Faz2 prompt'unun 23. maddesi (v6.31 "Öncelik Sırası") kanıt sayısı/çeşitliliğinin `teknikSira`yı etkilediğini söylüyor — ama aynı ham veriden türeyen birden fazla maddeyi bağımsız kanıt gibi saymak bu sayımı yapay şişirir. v6.34 bunu netleştirdi: Tempo/Stil paketi (raceStyleEtiket+kaçak sayısı+Accurace eğilimi), HP paketi (hpBugun+hpOnceki+hpIvmesi), Sınıf paketi (sinifOnceki+sinifSkk+sinifBaglamliForm), Koşul-uyumu paketi (§III.2 koşul benzerliği+zemin), Kondisyon/galop paketi (galopOzet+kondisyonZinciri) — her biri TEK kategori sayılır, içindeki alt-maddeler ayrı ayrı sayılmaz. Faz3'ün Kural Denetim Protokolü (§II.4) bunu ayrıca mekanik olarak denetler (bkz. `kuralKontrolleriUret`, "Redundans Kontrolü").

---

## VII. YARIŞ TİPİ AĞIRLIKLARI

### VII.0 Sabit 5 Katmanlı Puan Havuzu

```
Katman 1 (Ana Dayanak):     23-30 puan
Katman 2 (Güçlü Destek):    17-22 puan
Katman 3 (Orta Destek):     13-16 puan
Katman 4 (Bağlamsal):        9-12 puan
Katman 5 (Tamamlayıcı):      5-8  puan
Ham Toplam ≈ 100 (normalize et)
```

*(v6.34 düzeltme: aralıklar ARDIŞIK ve ÇAKIŞMAZ — eskiden 22-30/16-22/12-16/8-12 sınırlarında üst-alt çakışma vardı (22 hem Katman1 hem Katman2'de, 16 hem Katman2 hem Katman3'te, 12 hem Katman3 hem Katman4'te), her puan artık tam olarak bir katmana ait. `score` (Faz3'ün ürettiği 0-100 puan) `min(100, ...)` ile sabitlenir — Ham Toplam × Çapraz Doğrulama Katsayısı 100'ü aşarsa 100'de kesilir, üstüne çıkmaz.)*

Her kart yalnız hangi paketin hangi katmana girdiğini belirtir; aralıklar sabittir. Bir katmana birden fazla paket düşerse aralık kanıt gücüne göre paylaştırılır, katman toplamı aşılmaz.

**Kalabalık Saha Katman Yükseltmesi (10+ at):** Kartın kendi ataması ne olursa olsun, Tempo + Yarış Stili + Accurace verisi otomatik Katman 1-2'ye yükseltilir — kartın ana dayanağıyla EŞİT ağırlıkta değerlendirilir, katman aralığı ikisi arasında paylaştırılır (BIG RUGGED/KÜÇÜKDEMİRCİK dersi: kalabalık sahada Bekleme Grubu/Ön Grup Arkası stilindeki atlar modelin öngördüğünden belirgin iyi bitirdi).

**Evrensel asgari:** Tempo + Yarış Stili + Accurace, veri varsa HER koşu tipinde en az bir katmanda (asgari Katman 4-5) yer alır. Veri yoksa nötr sayılır, kart dışı bırakılmaz.

**İlk Defa Bu Mesafe/Pist Kombinasyonunda (v6.31):** Bir atın "Aynı Pist/Mesafe geçmişi" kaydı hiç yoksa (gerçek toplam kayıt 0 — genel deneyimli bir at olsa bile bu spesifik mesafe/pist ilk kez), o at için SADECE bu koşuda Pedigri ve Galop/kondisyon sinyalleri §VII.1/§VII.9'daki "ilk start" kartına benzer şekilde yukarı taşınır (Katman 1-2'ye), diğer atların kartı değişmez — bu, at bazında bir istisna, koşu genelinde bir kart değişikliği değildir.

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

**v6.10 netleştirmesi (kullanıcı tespiti, 2026-07-27):** Yukarıdaki "Yükseliş" satırındaki değerler bir TAVAN değil, yalnız TİPİK aralıktır — sınıf yükselişi otomatik olarak negatif OLMAK ZORUNDA DEĞİLDİR. Bir at ÇOK GÜÇLÜ kanıt taşıyorsa (örn. bir alt sınıfta baskın farkla kazanmış, HP'de belirgin alan var, form net yükseliyor, güçlü galop zinciri) — yükseliş bile POZİTİF puanlanabilir. Mantık: bazen bir at o kadar iyidir ki yükseliş zaten kaçınılmazdır ve bu güç yeni sınıfta da taşınır ("belki de gerçekten iyi bir at" — sabit negatif varsayım bunu görmezden gelir). Kod tarafındaki mekanik "Sınıf Geçiş" sayısı yalnız TEDBİRLİ bir başlangıç noktasıdır, Claude bunu kanıta göre yukarı (gerekirse pozitife) düzeltmekle YÜKÜMLÜDÜR.

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

### IX.1 Kaçak sayısı haritası (v6.9: OLASILIK çerçevesi netleştirildi)

| Kaçak | Tempo | Kazanma olasılığı daha yüksek eğilim |
|---:|---|---|
| 0 | Avare | Önde giden/lideri takip |
| 1 | Düşük | Kaçak At veya Ön Grup Arkası |
| 2–3 | Sert | En Geri Takip, sprinter, hafif kilolu |
| 4+ | Çok sert | Güçlü finiş yapan En Geri Takip grubu |

**Kullanıcı netleştirmesi (v6.9, 2026-07-26):** "Çok atlı yarışlarda kaçak olan, az atlı yarışlarda sprinter olan atlar KAZANIR" denilmedi — "kazanma OLASILIĞI yüksek" denildi. Bu tablo bir GARANTİ/KURAL değil, yalnızca bir EĞİLİMdir. Zıt stildeki bir at güçlü form/tempo geçmişi/pedigri gibi başka sinyallerle bu eğilimi rahatlıkla geçersiz kılabilir — tablo TEK BAŞINA bir stili elemek veya cezalandırmak için KULLANILMAZ, her zaman diğer senaryolar da (o atın kendi güçlü yönleri) birlikte değerlendirilir.

*(Canlı yarış geri bildirimi: İzmir 7.Koşu — 0 kaçak/"Avare" tempoda "avantajlı: önde giden" eğilimine dayanılarak En Geri Takip stilindeki AGF lideri YILDIZ SOY geride bırakılmıştı; at geriden gelip kazandı, üstelik ilk 5'in 4'ü de Bekleme Grubu/En Geri Takip stilindeydi — bu tablo bir kural gibi kullanıldığında yanıltıcı olabileceğinin somut kanıtı.)*

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
| Kısa mesafe (≤1300m) + iç kulvar | Avantaj büyür (dar viraj, daha az yol kaybı) |

### IX.5 Saha büyüklüğü × Yarış stili (v6.4)

Kullanıcı gözlemi: kalabalık sahada trafik/blokaj riski, az atlı sahada boş alan bolluğu stil tercihinin gerçek performansa etkisini değiştirir. Yalnız OLUMLU/nötr yönde işler — bir stili doğrudan cezalandırmaz, yalnız rakip stilleri öne çıkarır:

- **Kalabalık saha (10+ at):** Kaçak At stili trafik/blokaj riski taşır (§IX.4 ile tutarlı) — bu bir ceza değil, dikkatli/nötr bir not.
- **Az atlı saha (≤6 at):** Sprinter/En Geri Takip tipi (final kapanışa güvenen) atlar boş alan bulma sorunu yaşamaz, kapanış gücünü tam kullanabilir — olumlu değerlendir.

### IX.6 Hava durumu × Kaçak At (v6.4)

Yağışlı/ıslak hava (RaceDay.weather, TJK kaynaklı, sabit anahtar kelime listesi değil — kendi muhakemenle değerlendir) ile Kaçak At stili birlikte olumlu bir kombinasyondur: önden giden at diğer atların üzerine su/çamur sıçratmaktan kaçınır, bozulan izden önce geçer. Yalnız olumlu yönde işler, kuru havada bu bonus uygulanmaz (ceza da değil, nötr).

### IX.7 Mesafe × Yarış Stili Avantaj Matrisi ve Pratik Tempo Okuma (v6.28, kullanıcı talebi 2026-07-30/31: "tempo okumada... özellikle hipodrom özellikleri ile birlikte iyi yorumlanabilir")

**Temel mantık:** Bir koşuyu okurken yalnız "hangi at iyi" diye bakılmaz — asıl soru: "bu yarışın temposu nasıl kurulacak ve bu tempo kime yarayacak?" Sonuç çoğu zaman mesafeye değil, ilk bölümün nasıl geçeceğine bağlıdır. Bu madde §IX.0-6'yı YENİDEN AÇIKLAMAZ, onları MESAFE ekseninde ve pratik bir okuma sırasıyla bir araya getirir — hepsi zaten Faz1'de var olan verilerden (mesafe, sahadakiKacakSayisi, kulvar/startNo, per-at raceStyleEtiket) türetilir, yeni bir veri kalemi gerekmez.

**Mesafeye göre hangi stil avantajlı olur (§IX.1/§IX.5'in mesafe eksenindeki tamamlayıcısı, çelişmez):**

| Mesafe | Avantajlı stil(ler) | Not |
|---|---|---|
| Kısa (≤1300m) | Kaçak At, Ön Grup Arkası | Yarış çabuk biter, geriden gelenin fark kapatacak zamanı azalır. Çok geriden gelenler daha zorlanır. |
| Orta (1400-1700m) | Ön Grup Arkası güçlü profildir, Bekleme Grubu çok etkili olabilir | En dengeli bölge — uygun tempoda Kaçak At da kazanabilir, çoğu stil doğru akışta kazanabilir. |
| Uzun (1800-3000m) | Bekleme Grubu, En Geri Takip | Temposunu iyi ayarlayan dayanıklı bir Kaçak At da etkili olabilir, ama yalnız temposunu dağıtmayan ve nefesini iyi kullanan at kalabilir. |

**Tempo, mesafeden daha belirleyicidir:** Yavaş tempo varsa Kaçak At/önde gidenler avantajlı (öndeki fazla yıpranmaz, düzlükte direnç gösterebilir); sert tempo varsa Bekleme Grubu/En Geri Takip avantajlı (öndekiler birbirini yorar, sonlarda düşer). Kısa mesafede bile tempo çok yükselirse geriden gelen kazanabilir; uzun mesafede bile tempo düşük kalırsa öndeki at yarışı çalabilir — "kısa mesafe = öndeki kazanır" gibi tek başına bir kural KURULMAZ.

**Yarıştan önce tempo nasıl okunur — pratik sıra (§III.2 Hipodrom geometrisi ile BİRLİKTE okunmalı, kullanıcı talebi):**
1. **Öne gitmek isteyen at sayısı** — Kaçak At + Ön Grup Arkası eğilimli atların sayısı (bkz. §IX.0/mevcut `raceStyleEtiket`, ve sahadakiKacakSayisi zaten §IX.1'in girdisi): 1 net lider varsa tempo düşük/kontrollü kalabilir; 2 lider adayı orta-sert; 3+ lider karakteri sertleşebilir.
2. **Kulvar** (§III.2, mevcut `kulvarBolge`/`startNo`) — iç kulvardaki hızlı/Kaçak At eğilimli atlar öne çıkmayı daha kolay başarır (daha az enerji); dış kulvardan gelen birkaç hızlı at tempoyu yükseltebilir.
3. **Son yarışların akışı** — bu at kendi karakterinde mi koştu yoksa mecburen mi geride kaldı (bkz. Accurace eğilimi/`accuraceEgilim`, H2H); geçmiş yarış sert mi gitmişti, lider rahat mı kalmıştı.
4. **Jokey eğilimi** — agresif/öne oynayan mı, sabırlı/geriden mi bindiriyor: bu konuda AYRI bir veri kalemi YOK (sabit bir jokey-stil istatistiği tutulmuyor), yalnız varsa Accurace/galop/H2H notlarından dolaylı bir izlenim çıkarılabilir — kesin bir sayı gibi sunulmaz, yalnız düşük güvenli bir destekleyici gözlem olarak kullanılır (§II.1).
5. **Bugünkü hipodrom+pist+mesafe (±200m) kombinasyonunda tarihsel olarak hangi stil en çok kazanmış** (v6.34): `getPistMesafeStilIstatistigi` daha önce yalnız `/program`'daki tıklanabilir "Bu Koşu Tipinde Kazananlar" bilgi kutusunda kullanıcıya gösteriliyordu, Faz1'e hiç gitmiyordu — artık `race.pistMesafeStilOzeti`/`pistMesafeStilEnCokKazanan`/`pistMesafeStilEnCokKazananYuzde` olarak Faz1/Faz2'ye de aktarılıyor. En çok kazanan stildeki atlar sıralamada gereksiz yere geride kalmamalı — ama bu yalnız geçmiş bir eğilimdir, garanti değildir (§II.1 ile tutarlı: tek bir istatistik tek başına belirleyici olamaz).

**Pratik özet:** Atları üç gruba ayır (lider/kaçak adayları · ön grup arkası+bekleyenler · geriden gelenler), lider sayısını say, kulvarları kontrol et, mesafe+pisti düşün, iki senaryo kur ("tempo düşük kalırsa kim kazanır, tempo yükselirse kim kazanır") — bu ikili senaryo, tek bir "en güçlü at" hükmünden daha güvenilirdir çünkü tempo kendi kendine belirsizdir.

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

Aygır İstatistiği (baba) ve Kısrak İstatistiği (anne+anne baba) İKİ BAĞIMSIZ sinyaldir — tek bir "pedigri zayıf/güçlü" hükmünde harmanlanıp toplanmaz. Biri (özellikle örneklem küçükse) zayıf çıksa bile, DİĞERİNİN kendi eşiğini geçen olumlu sinyalini (K%≥%15 ve geniş örneklem gibi) gölgeleme/görmezden gelme. Gerekçe metninde iki taraf ayrı ayrı belirtilir: örn. "aygır tarafı güçlü (K% X, N start), kısrak tarafı zayıf" — "pedigri zayıf" gibi tek bir toptan hükümle geçilmez.

*(Kullanıcı canlı geri bildirimi: İstanbul 2. Koşu, GIRALAMO — baba TOUCH THE WOLF'un K/K %18/AEI 1.37 olumlu sinyali [üçüncü parti kaynak, o dönem kaynaktı], anne tarafının ve kendi-veri örnekleminin zayıflığıyla "baba-anne performans verileri zayıf" diye toptan etiketlenmişti; at kazandı. v6.32'de o kaynak tamamen kaldırıldı, kural artık own-data K% için geçerli — kuralın özü [iki sinyal ayrı okunur] değişmedi.)*

### XII.2 Damsire — Üçüncü Ayrı Sinyal (v6.7)

Damsire (kısrağın babası), atın fiziksel yapısı ve mizacı üzerinde aygır/kısrak kadar gerçek bir etki taşır — yalnız "kısrak + kısrak babası" birleşik satırının bir parçası olarak DEĞİL, hangi kısraktan gelirse gelsin bu damsire'nin TÜM yavrularının toplu performansı ayrı bir sinyal olarak değerlendirilir (bkz. "Damsire İstatistiği" satırı, kendi verimiz). Aygır/Kısrak/Damsire ÜÇÜ de bağımsızdır; biri zayıf/örneklemsiz diye diğer ikisinin olumlu sinyali gölgelenmez.

---

## XIII. TAKI ANALİZİ

Otomatik artı/eksi değil. Ayrı durumlar: ilk kez, yeniden, çıkarıldı, kombinasyon değişti.

Zorunlu karşılaştırma: bugünkü takı + önceki takı + önceki sonuç + start davranışı + yarış içi davranış + pist/zemin.

Son yarışa göre değişiklik varsa: `TAKI_DEGISIKLIGI_ALARMI`

### XIII.1 Şartlı 1/27 — takısız tay (v6.4)

Şartlı 1/Şartlı 27 gibi en giriş seviyeli/genç-ağırlıklı koşularda, TAKISI OLMAYAN (equipment boş) taylar takılı olanlara göre KESİNLİKLE olumlu değerlendirilir — bu seviyede takı genelde bir eksikliği telafi etmek için takılır, takısız olmak temiz/doğal bir yeteneğe işaret eder. Yalnız olumlu yönde işler; takılı olmak otomatik ceza DEĞİLDİR.

### XIII.2 Ekipman Değişikliği — Varsayılan Olarak Olumlu (v6.14, v6.24 sadeleştirme)

*(v6.14 — eskiden "tek başına ne olumlu ne olumsuz" idi, kullanıcı talimatıyla değişti: "herhangi bir takının eklenmesi yada çıkarılması olumlu görülsün ilk etapta ne olur ne olmaz.")*

Bugünkü herhangi bir takı değişikliği (eklendi VEYA çıkarıldı, hangi takı olursa olsun) VARSAYILAN OLARAK olumlu bir sinyal sayılır: bir antrenörün bilinçli bir müdahalesi olarak okunur (bir sorunu düzeltme/iyileştirme çabası), kesin nedensellik iddia edilmeden "ne olur ne olmaz" iyimser bir başlangıç noktası olarak. Faz2 prompt'unda bu değişiklik "⚠ TAKI DEĞİŞİKLİĞİ (RADARA AL)" olarak ayrıca vurgulanır — göze çarpmadan geçilmemesi için (kullanıcı talimatı 2026-07-30).

---

## XIV. JOKEY, ANTRENÖR VE APRANTİ

**Simetri:** Ayrı sinyaller, çarpılmaz. Düşük yüzde tek başına negatif gerekçe değil. Örneklem yoksa nötr.

### XIV.1 Jokey Değerlendirme (v6.24 sadeleştirme, v6.26'da genel win% geri eklendi)

*(v6.10-v6.22'de burada jokey/antrenör genel win%'i, jokeyin bu pist/mesafe/SKK kademesindeki kendi verimiz K%'si, jokey+antrenör "hot streak" kombinasyonu ve at-jokey geçmişi gibi ayrı ayrı hesaplanan 5 kademeli bir öncelik sistemi vardı. Kullanıcı talimatı 2026-07-30 — "analiz motorunu yeniden oluşturuyoruz, sade ve hızlı ve en doğru muhakeme yapılacak şekilde" — ile bu kırılım BİLİNÇLİ olarak kaldırıldı; jokeyin bu pist/mesafe/SKK "kendi verimiz" K%'si, jokey+antrenör "hot streak" kombinasyonu ve at-jokey geçmişi KALDIRILMIŞ olarak kalıyor, ama genel yıllık win% AYNI GÜN İÇİNDE kullanıcı talebiyle geri eklendi — v6.26.)*

1. **Bu jokeyle geçmiş (TJK, HorseStatsCache — Detaylı İstatistikler'in "Jokey" kırılımından)**: Bu at bugünkü jokeyle daha önce kaç kez start almış, kaçını kazanmış — TJK'nın kendi tam kariyer verisinden, kendi at profili sayfasındaki AYNI kırılım. Örneklem küçükse (1-2 start) puanda cezalandırılmaz, yalnız gerekçede belirtilir (§II.1). Bu, Jokey/Antrenör genel win%'inden DAHA GÜÇLÜ bir sinyaldir (bu ata özgü, kırılımlı).
2. **Son Hazırlıklar'daki "aynı jokey" işareti**: bugünkü jokey atın SON İDMANINI da bindiyse (galop kaydında ✓ işaretiyle gösterilir), süreklilik/uyum açısından OLUMLU bir destekleyici unsurdur.
3. **Jokey/Antrenör GENEL yıllık win% (v6.26)**: "Jokey:...(%X genel kazanma)" / "Antrenör:...(%Y genel kazanma)" — TJK'nın yıllık senkronize istatistiği (sync-jokey-stats/sync-trainer-stats, 22:00), kırılımsız. Madde 1'deki bu-ata-özgü sinyalden DAHA ZAYIF ama tamamen boş bırakılmaz — yüksekse (örn. %15+) hafif destekleyici bir not, düşükse ASLA tek başına cezalandırma gerekçesi değildir (§II.1).

**Apranti indirimi (güncel TJK ile doğrulanmalı):** 0-79 koşu: 4kg normal/3kg handikap · 80-159: 3kg/2kg · 160-209: 2kg/1kg · 210+: 0kg/0kg

---

## XV. H2H

Zayıf kanıt. Tek başına atı geriye itemez, tek karşılaşma kesin üstünlük değil. Koşullar değiştiyse güven düşer. Katman 5'te sınırlı puan alır. Farklı bağlamda (farklı kilo/takı/mesafe/sınıf) alınmış bir galibiyet OTOMATİK olarak zayıf/geçersiz sayılmaz (v6.10) — yalnız güven düzeyi düşer, kanıt tamamen yok sayılmaz.

**Açıkta kalmasın (v6.21):** Canlı denetimde bir atın H2H verisi olmasına rağmen gerekçede hiç geçmediği görüldü. Zayıf kanıt olması, PUANLAMAYA hiç girmeden sessizce atlanabileceği anlamına gelmez — veri varsa Çapraz Doğrulama Katsayısı'nda değerlendirilmeli, en azından bilinçli olarak "zayıf/anlamsız" diye not düşülmeli.

---

## XVI. AGF VE PİYASA

AGF, teknik verinin YERİNE geçmez ama İSTİSNASIZ önemli bir DESTEKLEYİCİ unsurdur — her atın değerlendirmesinde her zaman göz önünde bulundurulur.

**ASİMETRİK KURAL (v6.18 — SEVİYE + TREND birlikte) — yön bağımsız değildir:**

AGF Trend (kaynağı: AgfSnapshot, agf-sync'in günde birkaç kez aldığı ölçümlerden ilk↔son fark) ayrı bir ek not değil, AGF'nin çekirdek okunuş biçiminin PARÇASI — "seviye" ile "trend" HER ZAMAN birlikte değerlendirilir. Trend değerlendirilirken ÖNCE MUTLAK PUAN farkına bakılır, göreli %'ye değil — küçük başlangıç yüzdesinden gelen büyük % sıçramaları çoğunlukla gürültüdür. "[KÜÇÜK PAYDADAN GÜRÜLTÜ OLABİLİR]" etiketi kod tarafından hesaplanan bir ŞÜPHEDİR, KESİN HÜKÜM/dışlama DEĞİL (§XXI ilkesiyle tutarlı — sabit bir eşik hiçbir veriyi analiz dışı bırakamaz) — Claude bu veriyi göz ardı etmez, diğer sinyallerle birlikte kendi muhakemesiyle değerlendirir. Trend AGF SIRASINI değiştirmişse (yeni bir favori adayına dönüşmüş gibi) bu daha güçlü bir sinyaldir. En az 2 ölçüm birikmemişse trend "veri yok" sayılır (§II.1).

- **YÜKSEK seviye + YÜKSELEN trend + teknik görüş güçlü:** EN GÜÇLÜ destekleyici kombinasyon — piyasa hem şu an güveniyor hem güvenini artırıyor, Çapraz Doğrulama Katsayısı'nda (§XVIII.3) üst banda (×1.10) çekilir.
- **YÜKSEK seviye + teknik görüş zayıf** (trend ne olursa olsun, DÜŞEN trend'de daha da güçlü): GERÇEK bir çelişki — piyasa teknik veride görünmeyen bir şey görüyor olabilir, göz ardı edilmez, katsayı sistemine (×0.90-0.95 / ×0.70-0.80) girer.
- **DÜŞÜK seviye + YÜKSELEN trend + teknik görüş güçlü:** ROTAGANYAN'ın motto'suna (piyasanın henüz göremediğini görmek) tam uyan senaryo — piyasa HENÜZ düşük ama bu ata doğru para kaymaya BAŞLAMIŞ, teknik veri de destekliyor. Bu yalnız "ceza değil" değil, AKTİF bir destekleyici sinyaldir — katsayı yukarı çekilebilir.
- **DÜŞÜK seviye + DÜŞEN/SABİT/trend-yok + teknik görüş güçlü:** BU BİR ÇELİŞKİ DEĞİLDİR. Düşük/düşen AGF yalnızca piyasa ilgisizliği/az oynanma anlamına gelir, teknik gücü ÇÜRÜTMEZ — Çapraz Doğrulama Katsayısını düşürmek için gerekçe OLAMAZ, atı sıralamada geriye çekmek için KULLANILMAZ. Teknik olarak güçlü bir at, düşük AGF'ye rağmen üst sıralarda yer alabilir/almalıdır.
- **DÜŞÜK seviye + teknik görüş de zayıf:** nötr, ayrıca ceza gerekmez (ikisi zaten uyumlu-zayıf).

Aşırı piyasa konsensüsü (bir BAŞKA atın AGF'si >%50) yalnız banko şartında risk sayılır (§XIX) — bu, yukarıdaki asimetrik kuralın istisnası değildir, ayrı bir banko-güvenlik testidir.

**Public sitede:** her koşunun kendi sayfasında ayrı bir "AGF Trend" paneli var — "En Çok Düşenler"/"En Çok Yükselenler" özet kartları (yükselen=yeşil, düşen=kırmızı) + sahadaki TÜM atların tam listesi (istisnasız görünürlük ilkesiyle). Eskiden sitede günün TÜM koşularını birlikte tarayan genel bir "Para Akışı (AGF)" widget'ı vardı (SteamWidget) — koşuya özel panel eklendikten sonra, kullanıcı talimatıyla bu genel widget kaldırıldı.

### XVI.1 AGF Lideri İçin Zorunlu Denetlenebilirlik (v6.8, lider-only)

Sahadaki AGF LİDERİ (agfSirasi=1) nihai sıralamada kendi top-6'nın dışında kalırsa, bunun için MUTLAKA bir "picks" kaydı VE bir "note" (Kilit Gerekçe) üretilir — kod, gerekçesi olmayan atları mekanik bir yedek puanla tamamladığı için (bkz. §XVII.1), gerekçesiz kalması o atı sonradan denetlenemez hale getirir. Bu, düşük AGF'nin ceza sebebi olmaması kuralının (§XVI asimetrik kural) TERSİ değil TAMAMLAYICISI: piyasanın en çok para yatırdığı at geride kalıyorsa, NEDEN geride kaldığı her zaman yazılı olmalı.

**Bu bir yakınsama zorunluluğu DEĞİLDİR:** AGF liderinin Claude'un kendi top-3'ünde KALMASI gerektiği anlamına gelmez — güçlü teknik/trend kanıtıyla onu geride bırakmak (motto senaryosu dahil) tamamen geçerli, yalnız NEDENİ yazılı olmalı. Kural yalnız ŞEFFAFLIK zorunluluğudur.

*(Kullanıcı canlı geri bildirimi, 2026-07-26: İzmir 7. Koşu, YILDIZ SOY — sahadaki AGF lideri (%18.46, en yakın rakibi %14.47), eski %25 sabit eşiği yüzünden hiçbir kontrol mekanizması tetiklenmemiş, 20 attan 7. sıraya konmuş, hiç detay/gerekçe üretilmemişti; at kazandı.)*

*(v6.22/v6.23'te bu kural geçici olarak AGF top-3'ün TAMAMINI (#2/#3 dahil) kapsayacak şekilde genişletilmişti — 190 koşuluk bir denetimde kaybedilen kazananların 10/15'inin AGF'nin #3'ü olduğu bulunmuştu. v6.24'te bu genişletme GERİ ALINDI: İstanbul 5.Koşu ÇOKOMEL KIZ (AGF #5, bu kuralın kapsamı dışında kalırdı) aynı sorunla — hiç gerekçelendirilmeden mekanik puanla düşürülmüş — yine de kazanınca, kök nedenin AGF sırası değil §XVII.1'deki evrensel "tam saha muhakeme" eksikliği olduğu netleşti. Kullanıcı: "AGF top-3 kuralı toptan saçmalık, ben atların doğru muhakeme edilmesini istiyorum." Bkz. §XVII.1.)*

---

## XVII. ÖN FİLTRE VE VERİ KALİTESİ

Koşmayacak atlar analiz listesinden çıkarılır. Kritik doluluk düşük olsa bile analiz **YİNE DE YAPILIR** — "analiz yok" çıktısı asla verilmez. Eksik alanlar açıkça bildirilir, ilgili kalem zayıf/az güvenilir olarak not edilir, gerekçede belirtilir. Eksiklik ceza sebebi yapılmaz (§II.1).

### XVII.1 Tam Saha Muhakeme Zorunluluğu (v6.24 — değişmez kural)

**Koşuda yarışan HER at gerçekten muhakeme edilir — hiçbiri atlanamaz.** "picks" dizisi TÜM sahayı (enIyiN = sahaBuyuklugu, kapak yok) kapsar; her at gerçek "score" ve "details" alır. Kod, Claude'un ürettiği picks eksik kalırsa geri kalanları hiç muhakeme edilmeden Faz 2'nin ön teknik sırasından türetilmiş kaba bir yedek puanla mekanik olarak tamamlar (`details: []`, v6.26 — Faz 2 artık numerik puan üretmediği için bu yedek gerçek §XVIII formülü DEĞİL, yalnız bir sıralama iskelesidir) — bu, o atın gerçek sinyallerinin (kilo değişimi, koşu stili, form) hiç değerlendirilmeden sıralamaya girmesi demektir ve KABUL EDİLEMEZ.

Bu kural bir üst sınır kuralı değil, bir ALT SINIR kuralıdır: Claude'un kendi top-N'inin dışına attığı atlar bile (rank ne olursa olsun) gerçek details taşımalıdır — yalnız public "Kilit Gerekçe" (note, madde 6) maliyet/okunabilirlik nedeniyle ilk 6 ile sınırlı kalır, ama iç "details" etiketleri hiçbir at için boş bırakılamaz.

*(Kullanıcı talimatı, 2026-07-29 — İstanbul 5.Koşu ÇOKOMEL KIZ örneğinden: 5.5 kg kilo düşüşü ve kaçak stiline rağmen 11 attan yalnız 6'sı gerçek gerekçe almış, bu at hiç değerlendirilmeden 8. sıraya mekanik olarak düşürülmüş, sonra kazanmıştı. "Koşuda yarışan her at detaylarıyla analiz edilecek, analiz detayları göz ardı edilmeden. Bu değişmez kural olsun. Çok basit kaçıyor atlar gözden.")*

Admin panelinde bu kural her zaman görünür bir denetim olarak çalışır (kuralKontrolleriUret, "En İyi N Gerçekten Muhakeme Edildi mi" — GECTI/IHLAL/UYGULANMADI) — ihlal varsa admin görür ve düzeltir, ama bu bir sert yayın engeli DEĞİLDİR: manuel girilen (Faz3'süz) tahminler genelde yalnız birkaç at için details doldurur, sahadaki HER pick'i zorunlu kılmak o meşru senaryoyu bloke ederdi (§XXI'deki "sabit sayı yok, kod-zorunlu sert eşik yok" ilkesiyle tutarlı).

---

## XVIII. TEK PUAN SİSTEMİ

*(v6.26 — kullanıcı talebi 2026-07-30, "puanlama muhakemeden sonra yapılsa daha realist olmaz mı": bu formül artık MUHAKEMEDEN SONRA uygulanır. Motor önce (Faz 2) hiç sayı üretmeden, yalnız her at için ayrıntılı kanıta dayalı muhakeme yazar; bu formül o muhakemeyi girdi alan Faz 3'te işletilir. Eskiden tam tersiydi — önce bir puan üretilir, sonra o puana göre gerekçe/sıralama yapılırdı; bir sayı bir kez ortaya çıkınca sonraki adım genelde onu doğrulamaya çalışır, yeniden düşünmez (çapalama önyargısı) — bu riski azaltmak için sıra tersine çevrildi.)*

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

### XIX.0a ★ Hedef (isTarget) Kuralı (v6.2)

★ Hedef, pasif bir rozet değildir — gerçek bir sürpriz/değer sinyali gördüğün bir atı böyle işaretlersen, o at sıralamada **İLK 3'ÜN HEMEN ALTINA** (4. sıra civarına) getirilir ve puanı 3. sıradaki ata **yakın/eşit** verilir (yine de rank1-3'ün puanını geçemez, §XVIII.2). Yani Hedef ataması nihai sıralamayı gerçekten etkiler. Gelişigüzel dağıtılmaz — koşu başına en fazla 1-2 at, yalnız gerçekten güçlü bir sinyal varsa.

### XIX.0b Banko İçin confidence=YUKSEK Zorunlu (v6.6)

Kullanıcı canlı geri bildirimi (İstanbul 2. ve 10. Koşu, aynı gün iki banko birden kaybetti): eskiden banko kararı YALNIZ sayısal eşiğe (puan/fark/AGF riski) bakıyordu, "confidence" alanı (ve bankoNote'ta yazılan çekinceler) hiç hesaba katılmıyordu. Her iki kayıp bankoda da confidence "ORTA" idi ve bankoNote'ta zaten açık bir çekince yazılıydı ("sürprize açık zemin bırakıyor", "netliği azaltıyor") — buna rağmen sayısal eşik geçtiği için banko basılmıştı. Artık **confidence=YUKSEK olmadıkça banko verilmez**, puan/fark eşiği ne kadar güçlü olursa olsun. confidence'ı YUKSEK seçmek, bankoNote'ta bir çekince yazmakla ÇELİŞEMEZ — gerçek bir çekincen varsa confidence ORTA'da kalmalı, bu otomatik olarak bankoyu engeller.

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
8. Takı değişikliği (herhangi biri, eklenen/çıkarılan) varsayılan olarak olumlu okunur ama kesin neden-sonuç gibi yazılmaz (v6.14).
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
23. Banko = puan≥80 + fark≥5 + risk yok + confidence=YUKSEK (v6.6, bkz. §XIX.0b). Yalnız puan≥80 = Banko Adayı.
24. Geçit motoru YOKTUR — analiz doğrudan puanlama ve muhakemeyle yapılır.
25. Kulvar/pist geometrisi bilgisi hiçbir zaman diğer verileri gölgeleyemez veya geçersiz kılamaz — yalnız düşük ağırlıklı (Katman 4-5) bir destekleyici unsurdur.
26. Düşük AGF, teknik açıdan güçlü bir atı geriye çekmek için gerekçe SAYILMAZ (§XVI asimetrik kural) — yalnız piyasa ilgisizliğidir, Çapraz Doğrulama Katsayısını düşürmez.
27. Yüksek ham HP tek başına üstünlük garantilemez; form zayıfsa/gerilemişse veya tempo-stil uyumsuzsa, güçlü Son800+galop zinciri kombinasyonu (§X) gibi diğer paketler HP'nin önüne geçebilir.
28. Yeterli örneklemli güçlü Son800 (n≥3, medyan≤−0.5sn) ile keskin bir galop zinciri BİRLİKTE görüldüğünde, bu ikili gerçek ve güçlü bir destekleyici kombinasyon sayılır ve sıralamayı/puanı belirgin biçimde yukarı taşıyabilir.
29. 30+ gün (uzun ara) sonra dönen bir atta galop/kondisyon verisi vasat olsa bile, jokeyi güçlüyse (bu jokeyle geçmiş TJK kaydı iyiyse veya son idmanı aynı jokeyle yaptıysa) bu olumlu bir kombinasyon sayılır — yalnız galop verisine bakarak ceza uygulanmaz (§XX.10 "değişiklik tek başına olumlu/olumsuz değildir" ilkesiyle tutarlı).
30. Yağışlı/ıslak hava ile Kaçak At stili birlikte olumlu bir kombinasyon sayılır — önden giden çamur/iz dezavantajından kaçınır (§IX.6).
31. Kalabalık sahada (10+ at) Kaçak At stili trafik/blokaj riski taşır (ceza değil, dikkatli not); az atlı sahada (≤6 at) sprinter/kapanışa güvenen atlar avantajlıdır (§IX.5).
32. Şartlı 1/27 gibi giriş seviyeli koşularda takısız taylar takılı olanlara göre KESİNLİKLE olumlu değerlendirilir (§XIII.1).
33. Aygır ve Kısrak İstatistiği iki bağımsız sinyaldir; biri zayıf diye diğerinin kendi eşiğini geçen olumlu sinyali "pedigri zayıf" gibi toptan bir hükümle gölgelenmez (§XII.1).
34. Damsire (kısrak babası), aygır/kısrak yanında ÜÇÜNCÜ bağımsız bir pedigri sinyalidir — hangi kısraktan gelirse gelsin TÜM yavrularının toplu performansı ayrıca değerlendirilir (§XII.2).
35. Ekipman değişikliği (eklendi VEYA çıkarıldı, hangi takı olursa olsun) VARSAYILAN OLARAK olumlu bir sinyaldir — "RADARA AL" olarak ayrıca vurgulanır (§XIII.2, v6.14/v6.24).
36. AGF lideri ilk 6'nın dışında kalırsa MUTLAKA bir gerekçe/not üretilir — piyasanın en çok güvendiği at geride kalıyorsa neden geride kaldığı her zaman denetlenebilir olmalı (§XVI.1).
37. Kaçak sayısı haritasındaki eğilim ("0 kaçak → önde giden avantajlı" gibi) bir OLASILIK tahminidir, kural/garanti değildir — zıt stildeki güçlü bir atı tek başına elemek/cezalandırmak için kullanılmaz, diğer senaryolar da değerlendirilir (§IX.1).
38. AGF Trend (gün içi para akışı) artık AGF'nin seviyeyle BİRLİKTE okunan çekirdek parçasıdır (v6.16) — düşük seviye + yükselen trend + güçlü teknik görüş, motto senaryosu olarak aktif bir destek sayılır; düşük/düşen trend tek başına bir atı geriye çekme gerekçesi değildir (§XVI).
39. Start Geçmişi (TJK'nın kendi resmi "Geç Çıkış" tespiti, v6.30) — tekrarlayan (2+) geç çıkış kaydı gerçek ve olumsuz bir sinyaldir, özellikle kısa mesafe/kalabalık sahada ağırlığı artar; hiç kaydı olmayan at için temiz sicil olumlu belirtilir; tek bir kayıt (küçük örneklem) tekrarlayan sorun sayılmaz, nötr kalır (§II.1).
40. Bugünkü hipodrom+pist+mesafe (±200m) kombinasyonunda tarihsel olarak en çok kazanan yarış stili (§IX.7 madde 5, v6.34) — o stildeki atlar sıralamada gereksiz yere geride kalmamalı, ama garanti değildir.
41. Mekanik ön-hesaplanmış bir değeri (HP yıldızı vb.) muhakemende zihnen düzeltirsen, bunu HANGİ somut kanıta dayandığını açıkça yazman ZORUNLUDUR — gerekçesiz/keyfi düzeltme yapılamaz (v6.34).
42. Aynı ham veri paketinden türeyen birden fazla madde (Tempo/Stil, HP, Sınıf, Koşul-uyumu, Kondisyon/galop) kanıt çeşitliliği sayımında TEK kategori sayılır, ayrı ayrı sayılıp yapay şişirilmez (§V "TEK PAKET" kuralı, v6.34).
43. "Bu hipodrom+mesafe+pist'te BU YIL kazandı mı" ile "Aynı Pist/Mesafe geçmişi" (hipodrom şartsız, tüm zamanlar) İKİ FARKLI kaynaktır — ikisi de olumluysa "aynı yöne işaret eden iki ayrı gözlem" say, tek kanıtı iki kez sayma (v6.34).
44. Start Geçmişi'nin (§XX.39) olumsuz ağırlığı koşu tipine göre SABİT DEĞİLDİR — kısa mesafe/kalabalık sahada daha ağır, uzun mesafe/az atlı sahada daha hafif okunur (v6.34).
45. Deneyimli bir atta (yeterli gerçek yarış geçmişi biriktiyse) pedigri (§XII) yorumunun ağırlığı gerçek performans kanıtının GERİSİNE düşer — pedigri en çok ilk start'larda veya bu pist/mesafe/zeminde hiç kaydı olmayan atlarda belirleyicidir (§XX.23 öncelik sırasıyla tutarlı, v6.34).
46. H2H yalnız benzer pist/mesafe/zemin/kilo/tempo koşullarında anlamlı bir destekleyici sinyaldir — şartlar çok farklıysa zayıf kanıt sayılır, tek bir karşılaşma kalıcı hüküm oluşturmaz (§XV'e ek netleştirme, v6.34).

*(v6.34: Kural Denetim Protokolü'ne — §II.4, mevcut a-j maddelerine ek — k-t maddeleri eklendi: redundans kontrolü (madde 42), koşul taşınabilirliği, veri güveni-puan uyumu, ilk start istisnası, takı nötr kontrolü, takı değişikliği kontrolü, AGF çift sayım kontrolü, sınıf geçişi çapraz kontrolü, at sayısı/trafik (15+ kulvar), puan tavanı/tabanı. a-j maddelerinin hem prompt talimatı hem koddan (`kuralKontrolleriUret`) mekanik doğrulaması var; k-t maddeleri henüz yalnız prompt talimatı — kod-taraflı mekanik doğrulaması ayrıca yazılıyor.)*

---

## XXI. ÖRNEKLEM VE EŞİK YAKLAŞIMI — SABİT SAYI YOK

Bu belge pedigri örneklem eşiği, aynı pist/mesafe minimum örneklem, jokey/antrenör minimum start, rakip kalitesi formülü gibi konularda BİLEREK sabit sayı VERMEZ. Sen, ham veriler arasında (örneklem büyüklüğü dahil) MANTIKLI BİR MUHAKEME yaparak karar verirsin — az örneklemi gerekçende belirtirsin, puanı değil yalnız notu etkiler (§II.1). Sistem, kod-zorunlu sabit eşiklerden kasıtlı olarak koptu: yalnız PUANLAMA (§VII-§XVIII) ve MUHAKEME esastır.

*(İstisna: §IX.2/§X/§XI/§XIV'teki sayılar TJK mevzuatı veya resmî GPS/split verisiyle doğrudan bağlı tanımlardır, kalibrasyon parametresi değildir — korunur.)*

---

## XXII. KISA SONUÇ

> Hiçbir veri tek başına yeterli değildir. Her veri, bugünkü pist, zemin, mesafe, sınıf, tempo ve rakip yapısına ne kadar taşınabildiği üzerinden değerlendirilir.

Sistem; veri paketleri, koşul benzerliği, sabit 5-katmanlı puan havuzu (§VII.0), Çapraz Doğrulama Katsayısı (§XVIII.3) ve Kural Denetim Protokolü'nden (§II.4) oluşan, dış kod bağımlılığı (geçit motoru) olmayan, yalnız puanlama ve muhakemeye dayanan bütünleşik bir motordur.
