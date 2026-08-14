import type { Faz1Sonuc, Faz1Runner } from "@/lib/methodology/veri-toplama";

/**
 * v6.44 — YENİ ANALİZ MOTORU (V1-V22 + A-E Muhakeme Matrisi + Kanıt Ağırlıklı Katman).
 * Bu dosya, 2026-08-02/03 oturumunda "sıfırdan" tasarlanan yeni Faz1/Faz2 mimarisinin
 * PAYLAŞILAN çekirdeği — hem v2-faz2 hem v2-faz3 rotaları buradan besleniyor. Eski
 * sistem (veri-toplama.ts'in mevcut kullanımı, oto-analiz-faz2/faz3) bu dosyadan
 * ETKİLENMEZ — yalnız gatherFaz1'in ürettiği HAM VERİYİ (Faz1Sonuc) okuyoruz, veri
 * toplama altyapısının kendisini değiştirmiyoruz (o zaten TJK/Accurace'den önceden
 * ingest edilmiş, ücretsiz DB okuması).
 */

export type Kategori = "1a" | "1b" | "2" | "3" | "4" | "5" | "bilinmiyor";

export function kategoriTespit(classType: string): Kategori {
  const t = classType.toUpperCase();
  if (/MAIDEN|[ŞS]ARTLI\s*19\b/.test(t)) return "1b";
  if (/[ŞS]ARTLI\s*1\b|[ŞS]ARTLI\s*27\b/.test(t)) return "1a";
  if (/HAND[İI]KAP/.test(t)) return "2";
  if (/[ŞS]ARTLI\s*[2345]\b/.test(t)) return "3";
  if (/\bG\s*[123]\b|\bKV[\s-]?\d/.test(t)) return "4";
  if (/SAT(?:IŞ|IS)\s*\d+\b/.test(t)) return "5";
  return "bilinmiyor";
}

/** Her kategoride hangi V-kodlarının kullanılacağı — kullanıcıyla birlikte tasarlandı. */
export const KATEGORI_KODLARI: Record<Exclude<Kategori, "bilinmiyor">, string[]> = {
  "1a": ["V1", "V2", "V3", "V4", "V16", "V18", "V21"],
  "1b": ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V16", "V18", "V20", "V21", "V22"],
  "2": ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18", "V19", "V21", "V22"],
  "3": ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18", "V19", "V20", "V21", "V22"],
  "4": ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18", "V19", "V20", "V21", "V22"],
  "5": ["V1", "V2", "V3", "V4", "V5", "V6", "V7", "V8", "V9", "V10", "V11", "V12", "V13", "V14", "V15", "V16", "V17", "V18", "V19", "V20", "V21", "V22"],
};

export const KATEGORI_ADI: Record<Exclude<Kategori, "bilinmiyor">, string> = {
  "1a": "Tecrübesiz/Sınırlı Kazanç — Şartlı 1/27 (gerçek debüt)",
  "1b": "Tecrübesiz/Sınırlı Kazanç — Maiden/Şartlı 19",
  "2": "Alt Sınıf/Sürpriz — Handikap (tümü)",
  "3": "Şartlı 2/3/4/5",
  "4": "Üst Sınıf/Kalite — Grup/KV",
  "5": "Satış (tüm varyasyonlar)",
};

// Cache'lenen, TÜM kategorilerde AYNI (birebir), tamamen statik referans metni —
// hangi V-kodunun bu koşuda kullanıldığı VERİYE göre belirlenir (madde kendisi
// evrensel kalır, yalnız veri varsa doldurulur). Bu, kategoriye göre ayrı ayrı metin
// yazmaktan kaçınıp CACHE İSABETİNİ maksimuma çıkarır (kullanıcı: "en maliyetsiz ve
// doğru muhakeme nasıl olacaksa öyle").
export const V_LEGEND = `## V-KODU REFERANS LİSTESİ (V1-V22 — TAM LİSTE, bu koşuda yalnız veri taşıyan kodlar aşağıda AT verisinde görünecek)

V1 — Pedigri: Aygır, Kısrak ve Damsire istatistikleri (pist/mesafe bazlı yavru performansı) — ÜÇÜ BAĞIMSIZ değerlendirilir, biri zayıf çıksa bile diğerinin kendi eşiğini geçen olumlu sinyali gölgelenmez. Ayrıca "V1 Dozaj" satırı görürsen (aygırın DP/DI/CD'si) bu DÖRDÜNCÜ, tamamen bağımsız bir sinyal — aygırın soyağacındaki chef-de-race atalarından hesaplanan GENETİK hız/mesafe eğilimi, kazanma yüzdesine dayanmaz. DI yüksek (≥2.5) hız ağırlıklı, düşük (≤1.0) dayanıklılık ağırlıklı demektir — ama bu TEORİKTİR, doğrudan pist/zemin tercihinin kanıtı değildir, yalnız bugünkü mesafeyle genetik eğilim arasındaki uyum/uyumsuzluğu bir ipucu olarak değerlendir, tek başına karar gerekçesi yapma.
V2 — Galop/Kondisyon: Split derecesi, ırka göre ayrı baraj — İngiliz 400m 26-28/24-26/≤23 · 600m 38-41/36-38/≤35 · 800m 50-54/46-50/≤46 · 1000m 1:03-1:07/1:01-1:03/≤1:01; Arap 400m 28-31/25-28/≤25 · 600m 42-46/39-42/≤39 · 800m 56-61/52-56/≤52 · 1000m 1:10-1:15/1:06-1:10/≤1:06. İç pist: normal dereceden ~1sn HIZLI değerlendirilir. İdman Jokeyi Uyumu: yarıştıracak jokey, atın idmanlarından HERHANGİ BİRİNİ yaptırmışsa (yalnız son idman değil) KESİNLİKLE olumlu — bu eşleşmenin YOKLUĞU asla negatif sayılmaz (elit jokeyler Anadolu hipodromlarındaki galoplara nadiren katılır, bu normaldir).
V3 — Takı: Mevcut/eklenen/çıkarılan. Referans: Gözlük(KG/KGR/G-odaklanma), Kapalı Gözlük(KGP/SKG-aşırı huysuzluk), Yanaklık/Siperlik(Y/SY/SKG-hafif alternatif), Kulaklık(K/KUL-ses izolasyonu), Kulak Tıkacı(KT/KTI-güçlü ses izolasyonu), Dil Bağlanması(DB-KRİTİK, nefes borusu açıklığı), Burunluk/Dil Basarı(B/BB-baş açısı/nefes), Çapraz Bağlama(ÇB/ÇK-ağız/çene kontrolü), Gem(G/HG-yönetim kolaylığı). Yön fark etmez (ekleme=çıkarma=olumlu). İlk kez takılan=sürpriz potansiyeli, çıkarılan=rahatlama sinyali. KG+DB kombinasyonu özellikle güçlü.
V4 — Jokey/Antrenör/Şartlar: genel yıllık kazanma yüzdesi, yarış şartları. Kaba yön verici: %20+ kazanma yüzdesi güçlü, %10-20 orta, %10 altı zayıf sayılabilir — ama TEK BAŞINA belirleyici değil, atın kendi profiliyle birlikte oku. "Son yarışını aynı jokeyle koştu" (KOD-GARANTİSİ etiketiyle gelir) süreklilik AYRI bir olumlu sinyaldir, jokeyin genel yüzdesinden bağımsız — ikisi ayrı ayrı değerlendirilir, biri diğerini geçersiz kılmaz.
V5 — H2H: sahadaki diğer atlarla geçmiş karşılaşma, yalnız benzer şartlarda (kilo/zemin/mesafe) anlamlı, şartlar değiştiyse güven düşer.
V6 — Detaylı İstatistik Özeti: TJK kariyer kırılımı (zaman/hipodrom/jokey/pist/mesafe).
V7 — Aynı Pist/Mesafe Geçmişi: hipodrom farklı olabilir.
V8 — Bu Mesafe+Pistte Bu Yıl Kazandı Mı: hipodrom şartını karşılamaması OLUMSUZ sayılmaz (başka hipodromda yarışmış/kazanmış olması da olumlu); aynı hipodrom+pist+mesafenin TAMAMINI karşılıyorsa DAHA GÜÇLÜ sinyal. O yarış(lar)da taşınan kilo önemli — kazanamamışsa kilo yükünden olabilir, bugün daha hafifse büyük artı.
V9 — Son800/Accurace: atın koştuğu HER mesafe bandı ayrı, örneklem eşiği yok (n=1 dahil, düşük güven etiketiyle dışlanmadan).
V10 — Accurace Yarış Stili: Kaçak At / Ön Grup Arkası / Bekleme Grubu / En Geri Takip.
V11 — Son Düzlük Uzunluğu: atın V10 stiliyle birlikte okunur — uzun düzlükte Bekleme/En Geri avantajlı, kısa düzlükte Kaçak/Ön Grup avantajlı.
V12 — Bu Koşu Tipinde Kazananlar: pist+mesafe tarihsel kazanan stil dağılımı, atın stiliyle karşılaştırılır.
V13 — Kilo/Sıklet: bugünkü kilo, değişim, avantaj (≥1kg hafiflik), saha sıklet dağılımı (makas).
V14 — Sınıf: önceki→bugün, SKK, düşüş/yükseliş. Şartlı seviyesinden KV/Grup'a sıçrama dezavantaj sayılmaz ama olumlu olarak da şişirilmez (nötr başlangıç noktası).
V15 — Zaman/Dinlenme: KGS, Uzun ara (30+gün) — UZUN ARA DİĞER OLUMLU ÖZELLİKLERİ GÖLGELEMEZ, bazı atlar dinçlik yarışı yapmayı sever.
V16 — Eküri Ortakları: somut stil kanıtı olmadan spekülatif taktik senaryo YAZILMAZ, iki atın da V10 stili kurguyu desteklemiyorsa etki NÖTR (0) kabul edilir.
V17 — Start Geçmişi: tekrarlayan (2+) geç çıkış gerçek olumsuz sinyal, temiz sicil olumlu, tek kayıt nötr.
V18 — Kulvar/Dıştan Start: start pozisyonu, DS atın kendi tercihi olduğu için asla olumsuz sayılmaz.
V19 — Form Dizisi + Kilo Bağlamı: form serisi HANGİ KİLODA alındığıyla birlikte okunur — kilo geçmişe göre ağırlaşıyorsa bu artış daha önce kanıtlanmış bir aralıkta mı yoksa yeni bir üst sınır mı kontrol edilir.
V20 — HP İvmesi: geçmiş→şimdi. Sürekli yükselen HP (örn. 24→32→38) en güçlü sinyallerden biridir.
V21 — AGF Trend: gün içi para akışı. Düşük AGF asla tek başına olumsuz kanıt değildir. Gün içinde AGF'si GERÇEK/anlamlı şekilde YÜKSELEN (gürültü şüphesi işaretli olmayan) bir at, piyasanın kendi parasıyla doğruladığı bir sinyal OLABİLİR — 2026-08-08 Ankara gününde 6/6 koşuda doğrulanmıştı, ama 2026-08-10 Osmangazi kritiğinde (ESTOCADE +8.56 puan, en çok yükselen, yine de 4. bitirdi — top-3'e giremedi) net bir destekleyici çift bulunamadan tek başına yeterli olmadığı görüldü. STATÜ: ADAY — trend TEK BAŞINA asla otomatik "destek" sayılmasın; yalnız BAŞKA en az bir V-kodu (V1 pedigri, V3 takı — eklenen/çıkarılan fark etmez, bir değişiklik atı bambaşka bir çehreye dönüştürebilir, V4 aynı jokey, V13 kilo, V5 H2H, V19 form) AYNI YÖNDE (yükselişi destekliyorsa olumlu, düşüşü açıklıyorsa nötr/olumsuz değil) doğruluyorsa gerçek bir destek/risk gerekçesi say — bkz. X7 çapraz-okuma etiketi.
V22 — Pist Durumu: atın geçmiş yarışlarındaki pist durumu bugünküyle karşılaştırılır, bazı atlar yalnız belirli koşullarda (çamurlu kum, ağır çim) performans gösterir.

## GENEL İLKE — DİNAMİK KANIT (SABİT YÜZDE/TAVAN YOK)
Hiçbir V-koduna sabit yüzde/tavan uygulanmaz. Bir veri kalemi o koşunun kaderini değiştirecek olağanüstü bir kanıt taşıyorsa, ağırlığı toplam değerlendirmede baskın hale gelebilir.

## MUHAKEME MATRİSİ — ÇAPRAZ SORGULANACAK ÇİFTLER (olasılıksal dil, KESİNLİK YOK)
[V2+V9] İdman keskinliği yarışın kapanış gücüyle örtüşüyor mu — ikisi de güçlüyse gerçek destekleyici çift.
[V10+V11] Atın stili hipodromun düzlük uzunluğuna uyuyor mu.
[V10+V12] Atın stili bu pist/mesafede tarihsel kazanan stille örtüşüyor mu. ÖNEMLİ (gerçek bulgu, Elazığ 8.Koşu 2026-08-03 — OLGUNADAM 2. geldi ama V12 uyumsuzluğu yüzünden 9. sıraya çekilmişti, FISILTIKAYA 3. geldi ama aynı sebeple son sıraya çekilmişti): V12, SAHANIN GENEL/tarihsel eğilimidir — atın KENDİ geniş örneklemli (n≥5) V9 (Son800) veya V10 (Accurace tempo) sinyali güçlüyse, yalnız V12 uyumsuzluğu YÜZÜNDEN bu atı aşağı çekme. Popülasyon istatistiği (V12), güçlü bireysel kanıtı (V9/V10, n≥5) BASTIRAMAZ — yalnız iki at birbirine yakın/eşit güçteyse aralarında ayırt edici bir ek unsur olarak kullanılabilir. AĞIRLIK NETLİĞİ (gerçek bulgu, İSPANOZ, İstanbul 3.Koşu 2026-08-05 — bireysel n=15 GÜÇLÜ sinyal + popülasyonda 2. sırada (%28) olmasına rağmen "nötr-hafif destek" gibi yumuşatılmış etiketle değerlendirilip 6. sıraya düşmüştü, oysa kazandı): bireysel örneklem n≥10 VE popülasyonda ilk 2 sırada ise bu TAM "destek" sayılır — "hafif/nötr/kısmi destek" gibi yumuşatılmış bir etiket KULLANILMAZ. Yumuşatma yalnız bireysel örneklem n<5 İSE veya popülasyonda alt sıralardaysa haklıdır. BÜYÜK ORANLI DEĞER SİNYALİ (gerçek bulgu, ARNAVUT KIZ, İstanbul 8.Koşu 2026-08-09 — Ganyan 17,85, sistemde 2. sırada/Güçlü Aday, kazandı): bu at yalnız V1 (aygırın sahadaki en iyi kazanma yüzdesi, n=90 gerçek örneklem) + V10+V12 (ÖnGrupArkası popülasyonda en yüksek kategori %37) taşıyordu, TEK bir ciddi risk bayrağı yoktu (yalnız 1,9kg hafif ağırlık notu). Bu ikili gerçek-örneklemli destek + temiz (az riskli) profil kombinasyonu, atın Ganyan oranı yüksek/piyasa favorisi olmasa BİLE üst sıralara konması için yeterlidir — "oranı yüksek, kimse oynamıyor" gibi piyasa varsayımları bu güçlü teknik kanıtı asla geçersiz kılmaz, sitenin temel amacı tam olarak budur (piyasanın göremediğini görmek).
[V10+V18] İç kulvar+kaçak stili kolay öne çıkar; dış kulvar+kaçak stili ilk 400m'de enerji maliyeti yaratabilir (KESİN değil, ihtimal).
[V13+V10] Ağır kilo Kaçak atta erken enerji tükenmesine, Bekleme/Sprinter atta son düzlük ivmelenmesinin gecikmesine yol açabilir.
[V13+V22] Islak/çamur zeminde taşınan kilo normalden daha fazla yıpranma yaratabilir.
[V10+V22] Islak/çamur zemin + Kaçak/Önde Giden stil → belirgin bir avantaj taşıyabilir (sabit % yok).
[V1+V22] Tecrübe azken (ilk startlarda tipik), pedigrinin o zemin tipindeki tarihsel başarısı daha baskın bir referans olabilir.
[V14+V20] Sınıf düşüşü gerçek avantaj mı yoksa HP zaten düşüyorken mi geldi — HP ivmesi SERT DÜŞÜYORSA (negatif ivme) taktiksel değil fiziksel bir gerilemeye işaret edebilir (kesin değil). "HP DÜŞMÜYOR" İLE "HP SABİT (ivme=0)" AYNI ŞEY DEĞİL — sabit/nötr HP asla şüphe gerekçesi sayılmaz, yalnız GERÇEKTEN NEGATİF ivme şüphe sebebidir (PRENSES MEHLİKA vakası: KV-6→SKK3, 3 kademelik düşüş, HP 58→58 ivme=0 iken "HP yükselmiyor" diye risk sayılmıştı — YANLIŞ, sabit HP + büyük düşüş OLUMLU bir kombinasyondur, 5. bitirdi).
[V19+V20+V6] Görünen bitiriş gerilemesi/iyileşmesi, HP ivmesi ve rakip kalitesiyle çapraz kontrol edilir — kötü görünen bir derece çok daha yüksek bir sınıfta alınmışsa "gizli form" olabilir.
[V15+V2] Uzun aradan dönüşte idman zincirinin (galop) yeterliliği kontrol edilir.
[V15+V3] Uzun ara+takı+jokey+kilo aynı anda değişiyorsa BÜTÜN olarak (tek tek değil) yüksek belirsizlik olarak okunur.
[V21+genel muhakeme] Düşük AGF + yükselen trend + güçlü teknik görüş = piyasanın henüz göremediği bir değer sinyali olabilir, ASLA tek başına ceza gerekçesi değildir düşük AGF.
[V5+V13/V22] Geçmiş H2H bugün hâlâ geçerli mi, şartlar (kilo/zemin) değiştiyse güven düşer.
[V16+V10] Eküri ortağının stili somut kanıtla destekleniyorsa tempo/pozisyon ihtimali değerlendirilir (spekülasyon yasak).

## ÇAPRAZ-OKUMA ETİKETLERİ (X1-X7 — yeni V numarası DEĞİL, var olan V'lerin birlikte okunma talimatı, ek veri çekimi yok)
[X1] V13+V22: Kilo değişimi, zemin durumuyla (ıslak/nemli) birlikte okunur — ıslak zeminde kilo etkisi büyür.
[X2] V4+V8: "Aynı jokey" sinyali, o hipodrom/mesafe/pistte "kazandı mı" bilgisiyle birlikte okunduğunda güçlü bir sadakat sinyaline dönüşür; ayrı ayrı zayıftır.
[X3] V4+V6: Jokey/Antrenör değerlendirmesinde genel yüzde yerine, V6'daki bu-at+bu-jokey/bu-antrenör somut geçmişi (varsa) önceliklendirilir.
[X4] V6 iç uyarı: Mesafe-Çim ve Mesafe-Kum ayrı tablolardır, karıştırılmaz — pist tipine özeldir.
[X5] V7+V8: "En İyi Derecesi" ile "Detaylı Karşılaştırma" aynı bilginin iki görünümüdür; çelişirlerse sinyal üretme, veri hatası şüphesiyle not düş.
[X6] V15+V6: KGS (dinlenme süresi), aylık form trendiyle birlikte okunur — bu at benzer aralıklardan sonra geçmişte nasıl sonuç almış.
[X7 — ADAY, henüz kod-garantili değil] V21+V6: AGF hareketi, yıllık kazanç/plase oranıyla örtüşüyor mu kontrol edilir; örtüşmüyorsa uyumsuzluk sinyali sayılır, otomatik destek sayılmaz. V21 kendisi aday statüsünde olduğu için bu çapraz da adaydır.

## AĞIRLIKLI RİSK SİNYALLERİ (zorunlu belirtme, zorunlu SONUÇ değil)
Koşuda 3+ at V10=Kaçak At ise, bu durumu HER kaçak atın analizinde belirt (atlanamaz) — Bekleme/Sprinter atlar lehine GÜÇLÜ BİR EĞİLİM oluşur, ama KESİN değildir: jokey taktiği veya bir kaçak atın istisnai V2+V9 kombinasyonu bu eğilimi geçersiz kılabilir. "Matematiksel olarak imkansız" gibi kesinlik ifadeleri YASAK — yalnız "yüksek risk/orta risk/düşük risk" gibi dereceli dil kullan.
Eküri Yasası (V16): İki atın da bireysel V10 stilleri somut bir taktik kurguyu desteklemiyorsa, spekülatif senaryo YAZMA — etkiyi NÖTR (0) kabul et.
TEK RİSK GÜÇLÜ SİNYALİ SİLMEZ (gerçek bulgu, Elazığ 8.Koşu 2026-08-03): geniş örneklemli (n≥5) güçlü bir V9 (Son800) veya V10 (Accurace tempo) sinyali, TEK bir risk etiketi (ör. tekrarlayan geç çıkış, V12 stil uyumsuzluğu, kilo artışı) yüzünden "teknikSira"da son sıralara çekilmemeli — o gün OLGUNADAM (%71 Accurace, n=7) ve FISILTIKAYA (Son800 n=10, iyi) tam bu hatayla son sıralara düşürülmüştü, ikisi de gerçekte üst 3'te bitirdi. Güçlü/geniş-örneklemli pozitif kanıt ile tekil bir risk DENGELENMELİ, risk kanıtı otomatik ELEMEMELİ.`;

function takiEfektif(r: Faz1Runner): { eklenen: string; cikarilan: string } {
  return {
    eklenen: r.sonYarisVeriKaynagiGuvenilir ? r.sonYarisTakiEklenen.join(",") : (r.equipmentAdded ?? ""),
    cikarilan: r.sonYarisVeriKaynagiGuvenilir ? r.sonYarisTakiCikarilan.join(",") : (r.equipmentRemoved ?? ""),
  };
}

/** Bir atın V-kodu satırlarını, YALNIZ o kategoride izinli kodlar arasından ve veri
 * gerçekten varsa üretir. Veri yoksa satır hiç yazılmaz (madde 17 "açıkta veri
 * kalmasın" ilkesinin tersi değil — burada "veri yok" zaten yapısal, uydurulmaz). */
/**
 * v6.66 — kullanıcı bulgusu 2026-08-06: sıralama çağrısına WOLF SEYFO dersi için TAM
 * `atSatirlariUret` çıktısı (V1-V22'nin tamamı, kategoriye göre) ekleniyordu — büyük
 * sahalarda (15 at) bu, sıralama çağrısını 37K+ giriş/10K+ çıkış tokenına şişirip
 * gerçek bir zaman aşımına yol açtı ("para kaybettirdi"). Sıralama çağrısının GERÇEKTEN
 * ihtiyacı olan tek şey "kelimeyle sayı çelişiyor mu" diye bakabileceği birkaç objektif
 * sayı (kilo, HP, sınıf, AGF) — tüm V1-V22 dökümü değil. Bu kompakt özet, o dosyayı
 * V13/V14/V20 garantili enjeksiyonlarıyla AYNI kaynak alanları kullanır.
 */
export function hamVeriOzetiUret(r: Faz1Runner): string {
  const parcalar: string[] = [`kilo:${r.weight ?? "?"}kg`];
  if (!r.ilkStart && r.hpOnceki != null) parcalar.push(`HP:${r.hpOnceki}→${r.hpBugun}(ivme:${r.hpIvmesi ?? "?"})`);
  if (r.sinifOnceki != null) parcalar.push(`sınıf:${r.sinifOnceki}(SKK${r.sinifSkkOnceki})→bugünSKK${r.sinifSkkBugun}`);
  if (r.agf != null) parcalar.push(`AGF:%${r.agf}`);
  return parcalar.join(", ");
}

export function atSatirlariUret(r: Faz1Runner, izinliKodlar: string[]): string {
  const izin = new Set(izinliKodlar);
  const satirlar = [`#${r.no} ${r.ad}`];

  if (izin.has("V1") && (r.sireStatOzet || r.damStatOzet || r.damSireStatOzet)) {
    satirlar.push(`V1 Pedigri: Aygır:${r.sireStatOzet ?? "veri yok"} | Kısrak:${r.damStatOzet ?? "veri yok"} | Damsire:${r.damSireStatOzet ?? "veri yok"}`);
  }
  if (izin.has("V1") && r.sireDosageOzet) {
    satirlar.push(`V1 Dozaj (aygırın genetik hız/mesafe yapısı, TEORİK — kazanma yüzdesinden bağımsız): ${r.sireDosageOzet}`);
  }
  if (izin.has("V2")) {
    satirlar.push(`V2 Galop: ${r.galopOzet} | Kondisyon zinciri:${r.kondisyonZinciriVar ? "VAR" : "yok"} | Keskin:${r.keskinGalopZinciri ? "EVET" : "hayır"}`);
  }
  if (izin.has("V3")) {
    const { eklenen, cikarilan } = takiEfektif(r);
    satirlar.push(`V3 Takı: mevcut:${r.equipment ?? "—"} eklenen:${eklenen || "—"} çıkarılan:${cikarilan || "—"}`);
  }
  if (izin.has("V4")) {
    satirlar.push(`V4 Jokey/Antrenör: ${r.jockey ?? "?"}(%${r.jockeyWinPct ?? "?"}) / ${r.trainer ?? "?"}(%${r.trainerWinPct ?? "?"})${r.apprentice ? " [ÇIRAK]" : ""}${r.jockeyChanged ? ` [JOKEY DEĞİŞTİ, önceki:${r.previousJockey ?? "?"}]` : ""}`);
  }
  if (izin.has("V5") && r.h2hOzet) satirlar.push(`V5 H2H: ${r.h2hOzet}`);
  if (izin.has("V6") && r.detayliIstatistikOzet) satirlar.push(`V6 Detaylı İstatistik: ${r.detayliIstatistikOzet}`);
  if (izin.has("V7") && r.aynıPistMesafeOzet) satirlar.push(`V7 Aynı Pist/Mesafe Geçmişi: ${r.aynıPistMesafeOzet}`);
  if (izin.has("V8")) {
    satirlar.push(`V8 Bu Hipodrom+Mesafe+Pistte Bu Yıl: ${r.hipodromMesafedeKazandi}${r.hipodromMesafedeEnIyiDerece ? ` (en iyi: ${r.hipodromMesafedeEnIyiDerece})` : ""}`);
  }
  if (izin.has("V9")) {
    satirlar.push(`V9 Son800: KESİN n=${r.son800BenzerKosuN} medyan=${r.son800Medyan ?? "—"} | TÜM kayıtlar: ${r.son800TumOzet ?? "yok"}`);
  }
  if (izin.has("V10")) {
    satirlar.push(`V10 Yarış Stili: ${r.raceStyleEtiket ?? "?"} (tempo örneklem n=${r.tempoVeriN ?? "?"})${r.accuraceEgilim ? ` | Accurace: ${r.accuraceEgilim.stil} %${r.accuraceEgilim.percent}(n=${r.accuraceEgilim.n})` : ""}`);
  }
  // V11/V12 koşu düzeyinde (kosuBaslikUret içinde), at satırına eklenmez.
  if (izin.has("V13")) {
    const kiloDegisimEfektif = r.sonYarisVeriKaynagiGuvenilir ? r.sonYarisKiloDegisimi : r.weightChange;
    satirlar.push(`V13 Kilo/Sıklet: ${r.weight ?? "?"}kg (önceki fark: ${kiloDegisimEfektif != null ? (kiloDegisimEfektif >= 0 ? "+" : "") + kiloDegisimEfektif : "?"}kg)${r.kiloAvantaji ? " [sahadaki ortalamadan hafif]" : ""}`);
  }
  if (izin.has("V14")) {
    satirlar.push(`V14 Sınıf: ${r.sinifOnceki ?? "?"}(SKK ${r.sinifSkkOnceki ?? "?"}) → bugün (SKK ${r.sinifSkkBugun ?? "?"}) düşüş=${r.sinifDususu}`);
  }
  if (izin.has("V15")) {
    satirlar.push(`V15 Zaman/Dinlenme: ${r.gunAralik != null ? `${r.gunAralik} gün` : "bilinmiyor"}${r.gunAralik != null && r.gunAralik >= 30 ? " [UZUN ARA]" : ""}`);
  }
  if (izin.has("V16") && r.ekuriMateleri.length > 0) satirlar.push(`V16 Eküri: ${r.ekuriMateleri.join(", ")}`);
  if (izin.has("V17") && r.startGecmisiOzet) satirlar.push(`V17 ${r.startGecmisiOzet}`);
  if (izin.has("V18")) {
    satirlar.push(`V18 Kulvar: ${r.startNo ?? "?"}${r.kulvarBolge ? ` (${r.kulvarBolge})` : ""}${r.disaridanStart ? " [DS]" : ""}`);
  }
  if (izin.has("V19")) {
    satirlar.push(`V19 Form: ${r.recentForm ?? "—"} (geriliyor=${r.bitirisGeriliyor} iyileşiyor=${r.bitirisIyilesiyor})`);
  }
  if (izin.has("V20")) {
    satirlar.push(`V20 HP: önceki:${r.ilkStart ? "İLK START" : r.hpOnceki} → bugün:${r.hpBugun} (ivme:${r.hpIvmesi ?? "?"})`);
  }
  if (izin.has("V21")) {
    satirlar.push(`V21 AGF: %${r.agf ?? "?"} sıra:${r.agfSirasi ?? "?"}${r.agfTrendOzet ? ` | trend: ${r.agfTrendOzet}` : ""}`);
  }
  if (izin.has("V22") && r.zeminGecmisiOzet) satirlar.push(`V22 Pist Durumu Geçmişi: ${r.zeminGecmisiOzet}`);

  return satirlar.join("\n");
}

/**
 * v6.44 — FAZ3 (Kanıt Ağırlıklı Katman puanlama). Eski üretim Faz3'ünün (oto-analiz-
 * faz3/route.ts) Kural Denetim Protokolü (a-t) ve GÖREVİN 2-10 maddeleri, Faz2
 * varyantından BAĞIMSIZ genel kalite kurallarıdır (AGF asimetrisi, redundans, ilk-start
 * istisnası, ★ Hedef, Kilit Gerekçe zorunlulukları vb.) — bunlar burada AYNEN korundu.
 * TEK gerçek fark madde 1 (PUANLAMA): eski sistemde hangi veri paketinin hangi katmana
 * (23-30/17-22/13-16/9-12/5-8) gireceğini KOŞU TİPİ KARTI (§VII.1-10) SABİT belirliyordu
 * — yeni sistemde bu atama SABİT DEĞİL, o koşudaki GERÇEK kanıt gücüne göre Claude'un
 * kendi kararı (aynı katman aralığı farklı atlarda/farklı koşularda farklı kanıt türünü
 * taşıyabilir). Bu, DARKROK/Çokomel Kız/ELİTE TOUCH derslerinin (mekanik/sabit kural bir
 * kategoriyi baştan bastırdı) doğrudan devamıdır.
 */
export function buildFaz3InstructionsV2(): string {
  return `Sen ROTAGANYAN yeni nesil (V1-V22 + A-E Muhakeme Matrisi) at yarışı analistisin. FAZ 3 — PUANLAMA ve NİHAİ SIRALAMA aşamasındasın (motorun "son kontrol"ü — bu senin işin, en önemli iş). Az önce sana verilen KOŞU/ATLAR verisini ve FAZ 2 MUHAKEMENİ (tempo senaryosu, doğrulanan/riskli çiftler, sınıf-form kontrolü, ön karar) kullan.

## GÖREVİN
1. KANIT AĞIRLIKLI KATMAN PUANLAMASI (dinamik atama, sabit tavan yok): Sabit 5 katman ARALIĞI var — Katman 1: 23-30, Katman 2: 17-22, Katman 3: 13-16, Katman 4: 9-12, Katman 5: 5-8 puan (ardışık, çakışmaz, her puan tam olarak bir katmana aittir). AMA hangi kanıtın/doğrulanan çiftin hangi katmana gireceği SABİT DEĞİL — bu SENİN bu koşudaki gerçek kanıt gücüne göre kararın: bir atın Faz 2 muhakemesinde en güçlü doğrulanan çift/kanıt neyse (tempo uyumu, sınıf/form, pedigri, galop, AGF trend, ne olursa) o Katman 1'e girer; ikinci en güçlü Katman 2'ye, vb. Aynı koşudaki farklı atlarda, hatta farklı koşularda, farklı kanıt türleri Katman 1'i doldurabilir — bu normaldir, hatta beklenir; bir kanıt türünün "genelde önemli" olması onu otomatik olarak Katman 1'e yazdırmaz. 10+ atlı sahada tempo/stil/pozisyon paketini otomatik Katman 1-2'ye yükselt. Her at için TEK bir "puan" (0-100) hesapla: HAM TOPLAM (katman 1-5 toplamı) × ÇAPRAZ DOĞRULAMA KATSAYISI (muhakemende belirttiğin doğrulanan/riskli çiftler birbirini güçlü destekliyorsa ×1.05-1.10, nötr/bağımsızsa ×1.00, hafif çelişiyorsa ×0.90-0.95, doğrudan çelişiyorsa ×0.70-0.80; birden fazla çift varsa çarpma, EN GÜÇLÜ çelişki/destek esas alınır; küçük örneklem/veri eksikliği/farklı bağlam bu kapsama GİRMEZ — yalnız notu etkiler, puanı İKİNCİ KEZ düşürme/yükseltme). Çarpım 100'ü aşarsa "score"u 100'de sabitle (min(100, ...)) — 100'ün üstü bir değer üretme.
2. KURAL DENETİM PROTOKOLÜ (SON KONTROL — motorun en önemli adımı burası): az önce yazdığın puanları geri kontrol et — bir atı düşüren şey somut/gerçek bir çelişki mi (madde 1'e göre katsayı hakkı var), yoksa yalnız örneklem küçüklüğü/veri eksikliği/farklı bağlam mı (bu yalnız notu etkilemeli, puanı İKİNCİ KEZ düşürmemeli)? Özellikle şu noktaları özenle kontrol et:
   a) AGF ASİMETRİSİ + TREND: bir at yalnızca DÜŞÜK AGF'si yüzünden geride mi bırakılmış? Düşük AGF asla tek başına bir atı geriye çekme gerekçesi değildir. ÖZELLİKLE ARA: düşük AGF + YÜKSELEN AGF Trend + teknik görüş güçlü olan bir at var mı? Bu, ROTAGANYAN'ın piyasanın henüz göremediğini görme mottosuna tam uyan bir senaryodur — böyle bir at varsa yalnız "cezalandırma" değil, ÖNCELİKLİ olarak yukarı taşı.
   b) SON800+GALOP KOMBİNASYONU: yeterli örneklemli güçlü Son800 (n≥3, medyan≤-0.5s) İLE keskin/iyi galop zinciri birlikte olan bir at, bu güçlü destekleyici çift göz ardı edilerek geride mi bırakılmış? Varsa yukarı taşı. AYRICA (gerçek bulgu, Elazığ 8.Koşu 2026-08-03): geniş örneklemli (n≥5) güçlü bir Son800/Accurace tempo sinyali, YALNIZ bu pist/mesafenin genel tarihsel stil istatistiği (V12) uyuşmuyor diye ya da TEK bir risk etiketi (ör. tekrarlayan geç çıkış) var diye son sıralara çekilmiş mi kontrol et — o gün OLGUNADAM (%71 Accurace, n=7) V12 uyumsuzluğu yüzünden 9.'ya, FISILTIKAYA (Son800 n=10, iyi) tekrarlayan geç çıkış yüzünden son sıraya çekilmişti, ikisi de gerçekte üst 3'te bitirdi. Güçlü, geniş örneklemli bireysel bir sinyal TEK bir karşıt faktörle tamamen SİLİNMEMELİ — ikisi dengelenmeli.
   c) HP TEK BAŞINA ÜSTÜNLÜK DEĞİLDİR: yalnız yüksek ham HP'ye dayanarak, formu zayıf/gerilemiş ya da tempo-stili bugüne uymayan bir at otomatik olarak en üste mi konmuş? Değilse düzelt.
   d) OLUMLU KOMBİNASYONLAR (dördü de yalnız OLUMLU yönde işler, hiçbiri tek başına bir atı cezalandırma gerekçesi değildir): (i) yağışlı/ıslak hava + Kaçak At stili → olumlu; (ii) kalabalık sahada (10+ at) kaçak stiller dezavantajlı, az atlı sahada (≤6 at) sprinter/kapanışa güvenen atlar avantajlı → olumlu; (iii) tecrübesiz/giriş seviyeli koşularda (Kategori 1a/1b) TAKISIZ taylar takılı olanlara göre → KESİNLİKLE olumlu; (iv) 30+ gün ([UZUN ARA] etiketli) aradan dönen atta galop/kondisyon vasat olsa bile jokeyi güçlüyse → olumlu. Bu dört durumdan biri sahada varken göz ardı edilmiş bir at olup olmadığını kontrol et, varsa yukarı taşı.
   e) AYGIR/KISRAK/DAMSIRE AYRI DEĞERLENDİRME: "pedigri zayıf" diye tek bir hükme indirgenip, aslında Aygır veya Damsire istatistiğinin kendi eşiğini geçen olumlu bir sinyali Kısrak tarafının zayıflığı yüzünden gölgelenmiş bir at var mı? Varsa "details"/gerekçede ayrı ayrı belirt, puanı buna göre düzelt.
   f) YARIŞ STİLİ HARİTASI TEK BAŞINA ELEME GEREKÇESİ DEĞİLDİR: "sahadaki kaçak sayısı"ndan doğan eğilim YALNIZCA bir olasılık tahmini — bir at bu eğilime ZIT stildeyken güçlü form/tempo geçmişi/pedigri sinyali OLDUĞU HALDE yalnızca bu haritaya dayanarak mı geride bırakılmış? Öyleyse yeniden değerlendir, gerekirse yukarı taşı.
   g) MUHAKEME MATRİSİ GÖZDEN KAÇIRMA KONTROLÜ: Faz2'nin A-E matrisindeki çiftlerin yalnız en sık rastlanan birkaçına odaklanmış olabilirsin — büyük saha veya sıkışık bütçede geri kalanlar atlanmış olabilir. İlk 3-4 attaki güçlü/zayıf sinyalleri, veri varsa bu çiftler açısından bir kez daha süz — gözden kaçan gerçek bir destekleyici/çelişen çift varsa düzelt.
   h) H2H AÇIKTA KALMASIN: ilk 6'daki her at için H2H (V5) satırında veri var mı kontrol et — varsa bu senin puanına gerçekten yansımış mı? Yansımamışsa ve gerçekten anlamlıysa düzelt; anlamsızsa bile bunun bilinçli bir değerlendirme olduğundan emin ol, sessizce atlanmasın.
   i) "DEĞİŞİM PROFİLİ" BÜTÜN OLARAK OKUNSUN: KGS+Takı+Kilo Değişimi+Aynı Jokey dört ayrı puan kalemi değil, TEK bir "bugün geçen seferden ne değişti" sorusudur — bir atta aynı anda BİRDEN FAZLA değişim varsa (takı + kilo + jokey + uzun ara gibi), bunlar tek tek değil BÜTÜN olarak yüksek belirsizlik taşıyan bir "büyük değişim" durumu sayılır, gerekçede bu bütünlük belirtilsin.
   j) KANIT SAYISI/ÇEŞİTLİLİĞİ: iki at benzer sırada/puanda görünüyorsa, hangisinin arkasında DAHA FAZLA bağımsız kategoriden gerçek destek (AGF/piyasa desteği, form/sınıf bağlamı, jokey/ekip, pedigri, tempo, takı değişikliği gibi) olduğuna bak — tek güçlü kanıtı olan bir at, üç-dört bağımsız kanıtı olan bir attan yalnızca o tek kanıt güçlü diye öne geçmemeli. Ayrıca Kategori 1a/1b (tecrübesiz) VEYA Aynı Pist/Mesafe geçmişi hiç olmayan (ilk defa bu mesafe/pist) bir at için Pedigri+Galop sinyallerinin gerçekten öne çıkarılıp çıkarılmadığını kontrol et.
   k) REDUNDANS KONTROLÜ: madde j'de saydığın "bağımsız kategori" sayısını hesaplarken aynı ham veriden türeyen paketleri (Tempo/Stil, HP, Sınıf, Koşul-uyumu, Kondisyon/galop) TEK kategori say — bir atın muhakemesinde bu paketlerden biri birkaç satır kaplıyor diye onu birkaç ayrı bağımsız kanıtmış gibi puanlama.
   l) KOŞUL TAŞINABİLİRLİĞİ: geçmiş güçlü bir performans bugünkü pist+mesafe+zemin+hipodroma GERÇEKTEN taşınabilir mi kontrol et — farklı hipodromdaki bir Aynı Pist/Mesafe kaydı veya farklı mesafedeki bir Son800 kaydı ham haliyle bugünküyle birebir eşdeğer sayılmamalı, benzerlik derecesine göre ağırlıklandır.
   m) VERİ GÜVENİ–PUAN UYUMU: küçük örneklemli (n<3, tek kayıt, ilk start) bir sinyal tek başına yüksek puan/üst sıra üretmiş mi kontrol et — küçük örneklem CEZALANDIRILMAZ ama tek başına da BÜYÜK bir puan sıçraması için yeterli SAYILMAMALI, diğer kategorilerden destek olmadan aşırı yükseltme yapma.
   n) İLK START İSTİSNASI: ilk start yapan bir atta HP ivmesi, Tempo/Accurace eğilimi, H2H, Son800 gibi yapısal olarak VAR OLAMAYACAK alanların boş olması bir eksiklik/ceza olarak işlenmiş mi kontrol et — bu atlar için puanlama Pedigri+Galop ağırlıklı yapılmalı, eksik kategoriler nötr sayılmalı.
   o) TAKI NÖTR KONTROLÜ: bugün takı değişikliği YOKSA (ne ekleme ne çıkarma), bu nötr bir durumdur — buna rağmen bir bonus veya ceza puanı verilmiş mi kontrol et, verilmişse kaldır.
   p) TAKI DEĞİŞİKLİĞİ KONTROLÜ: bugün takı eklenmiş/çıkarılmışsa, bu olumlu sinyal gerçekten puana/sıraya yansımış mı kontrol et.
   q) AGF ÇİFT SAYIM KONTROLÜ: AGF, madde 1'deki puanlamada (piyasa desteği kalemi olarak) VE madde a'daki (AGF asimetrisi/motto) denetiminde aynı atın lehine/aleyhine İKİ AYRI KEZ kullanılmamalı.
   r) SINIF GEÇİŞİ ÇAPRAZ KONTROLÜ: bir sınıf düşüşü/yükselişi yalnız SKK farkına bakılarak mı puanlanmış, yoksa HP ivmesi ve bugünkü rakip kalitesiyle doğrulanmış mı kontrol et — doğrulanmamışsa puan etkisini hafiflet.
   s) AT SAYISI VE TRAFİK: 10+ atlı sahada tempo/stil önceliği uygulandı mı; 15+ atlı çok kalabalık sahalarda AYRICA kulvar bölgesi ve viraj trafiği riski dikkate alındı mı kontrol et.
   t) PUAN TAVANI/TABANI (ÖNEMLİ): bir at için bir veya daha fazla katmanda veri eksikse (örn. ilk start, HP resmi yok), o katmanı 0 puan gibi işleyip HAM TOPLAM'ı düşürme — mevcut katmanlar üzerinden orantılı biçimde değerlendir. Eksik veri hiçbir zaman doğrudan puan kaybı olarak yansımamalı.
   Gerekirse puanı/sırayı düzelt.
3. Bu puanları ve tüm ATLAR verisini birlikte değerlendirerek NİHAİ SIRALAMAYI SEN belirle — mekanik puan sırasını kopyalamak ZORUNDA değilsin, ama puan sırası ile nihai sıralama çelişemez: bir atı puanından farklı konuma taşıyorsan "score" alanını bu yeni konumu yansıtacak şekilde güncelle (rank1'in score'u rank2'ninkinden düşük OLAMAZ) ve nedenini "details"e kısaca yaz.
4. Kalabalık sahada (10+ at) tempo/stil/pozisyon önceliğini sıralamana açıkça yansıt.
5. TÜM saha (sahadaki at sayısı ne olursa olsun) için "picks" dizisine rank 1'den başlayarak gir — HİÇBİR at dışarıda bırakılamaz, hiçbiri ham puanla geçiştirilemez, HER birine gerçek score/details ver.
6. Her pick için "pedigreeRating"/"isTarget"/"details" üret (uydurma bilgi yasak — yalnız KOŞU/ATLAR verisinde verilen ham veriyle sınırlı kal). details: kısa iç etiketler (örn. "AGF1", "Galop K1", "Sınıf düşüşü") — admin rozeti, kullanıcıya gitmez.
6b. ★ HEDEF (isTarget) KURALI: isTarget=true işaretlediğin bir at yalnız pasif bir rozet almaz — sıralamada İLK 3'ÜN HEMEN ALTINA (4. sıra civarına) getirilir ve "score"u 3. sıradaki atınkine YAKIN/EŞİT verilir (rank1-3'ün score'undan düşük olmalı, madde 3'teki tutarlılık kuralına uy). Bunu yalnız gerçekten güçlü bir sürpriz/değer sinyali olduğuna inandığın at(lar) için kullan, gelişigüzel dağıtma (en fazla 1-2 at). SADECE YUKARI TAŞI (gerçek bulgu, 2026-08-03): bu kural bir atı yalnız kendi ön teknik sırasından DAHA YUKARI çekmek içindir — eğer at zaten teknikSira'da 4'ten üst sıradaysa (ör. 2.), isTarget rozeti onu 4.'e DÜŞÜRMEMELİ, mevcut yüksek konumunu KORUMALI. isTarget, bir tavan/sınırlama değil yalnız bir taban garantisidir.
7. Kendi sıraladığın picks listesinin İLK 6'sı için "gerekceler" dizisine bir "note" yaz — EN FAZLA 2 CÜMLE, sade dil, iç terim (puan/katsayı/katman) GEÇMEZ, doğrudan kullanıcıya (public "Kilit Gerekçe") gidiyor. AYRICA: AGF LİDERİ (ATLAR verisinde "sıra:1" olan at) kendi top-6'nın dışına düşüyorsa, onun için de MUTLAKA bir not üret — neden piyasanın en çok para yatırdığı at bu kadar geride kaldığını 1-2 cümleyle açıkça belirt. Bu istisnasız zorunlu. AYNI zorunluluk "sıra:2" olan at için de geçerlidir.
8. "confidence" (DUSUK/ORTA/YUKSEK — ÖNEMLİ, gerçekten dikkatli seç): sıralamanın netliğine (1.-2. arası fark, çelişkili sinyal sayısı) göre. Bu alan YALNIZ bilgi amaçlı değil — kod, YUKSEK olmadıkça banko VERMEZ. bankoNote'unda ("ancak", "riski var" gibi) bir çekince yazacaksan confidence'ı YUKSEK seçme, ORTA'da bırak.
9. "bankoNote": banko kararının KENDİSİNİ kod ayrıca mekanik olarak hesaplayacak (puan≥80+fark≥5+piyasa riski yok+confidence=YUKSEK) — sen yalnız 1.-2. arası farkı ve genel netliği 1-2 cümleyle sade dilde yorumla.
10. "notes": genel koşu değerlendirmesi, sade özet. "tempo": tempo beklentisi (sade dil).`;
}

export function buildFaz3ReminderV2(sahaBuyuklugu: number, faz2Atlar: { no: number; ad: string; teknikSira: number; karar: string; muhakeme: string }[]): string {
  return `## FAZ 2 MUHAKEMEN (senin az önce ürettiğin, kanıta dayalı analiz — şimdi bunu SAYISALLAŞTIR)
${faz2Atlar.map((a) => `#${a.no} ${a.ad} (ön teknik sıra: ${a.teknikSira}, ön karar: ${a.karar}): ${a.muhakeme}`).join("\n")}

Şimdi yukarıdaki GÖREVİN talimatlarını (madde 1-10, Kural Denetim Protokolü a-t), yukarıdaki KOŞU/ATLAR verisine ve FAZ 2 MUHAKEMENE uygula. Saha büyüklüğü: ${sahaBuyuklugu} at — TÜM saha puanlanır, hiçbiri atlanamaz (madde 5).

Yanıtı YALNIZCA geçerli JSON olarak ver, başka metin ekleme:
{
  "picks": [
    { "rank": 1, "no": 0, "name": "...", "score": 0, "pedigreeRating": "BILINMIYOR", "isTarget": false, "details": [] }
  ],
  "gerekceler": [ { "no": 0, "note": "en fazla 2 cümlelik gerekçe" } ],
  "confidence": "ORTA",
  "bankoNote": "",
  "notes": "Genel koşu değerlendirmesi",
  "tempo": "Tempo beklentisi (sade dil)"
}
pedigreeRating değerleri: COK_YUKSEK, YUKSEK, GUCLU, ORTA, DUSUK, ZAYIF, SORU, BILINMIYOR`;
}

/**
 * v6.45 — kullanıcı talebi 2026-08-03: "otomatik analize tıkladığımda faz1'in neleri
 * çektiğini ve faz2'nin neleri muhakeme ettiğini tikli olarak görmek istiyorum.
 * Muhakeme edilmediği halde edilmiş gibi göstermemeli." atSatirlariUret'teki HER V-kodu
 * satırının hangi koşulda yazıldığını burada TEK NOKTADAN (aynı mantık) tekrar
 * kullanılabilir hale getiriyor — hem "bu at için gerçekten veri var mıydı" (Faz1
 * denetimi) hem "Faz2'nin gösterdiği kanıt çifti gerçek veriye mi dayanıyor, yoksa
 * veri yokken var gibi mi gösterilmiş" (Faz2 dürüstlük denetimi) için.
 */
export function veriVarMi(r: Faz1Runner, kod: string, faz1: Faz1Sonuc): boolean {
  switch (kod) {
    case "V1": return !!(r.sireStatOzet || r.damStatOzet || r.damSireStatOzet || r.sireDosageOzet);
    case "V2": return r.galopOzet !== "İdman kaydı yok";
    case "V3": { const { eklenen, cikarilan } = takiEfektif(r); return !!(r.equipment || eklenen || cikarilan); }
    case "V4": return r.jockeyWinPct != null || r.trainerWinPct != null;
    case "V5": return r.h2hOzet != null;
    case "V6": return r.detayliIstatistikOzet != null;
    case "V7": return r.aynıPistMesafeOzet != null;
    case "V8": return r.hipodromMesafedeKazandi !== "KOSMADI";
    case "V9": return r.son800BenzerKosuN > 0 || r.son800TumOzet != null;
    case "V10": return r.raceStyleEtiket != null;
    case "V11": return faz1.race.sonDuzlukUzunlugu != null;
    case "V12": return faz1.race.pistMesafeStilOzeti != null;
    case "V13": return r.weight != null;
    case "V14": return r.sinifOnceki != null;
    case "V15": return r.gunAralik != null;
    case "V16": return r.ekuriMateleri.length > 0;
    case "V17": return r.startGecmisiOzet != null;
    case "V18": return r.startNo != null;
    case "V19": return r.recentForm != null;
    case "V20": return !r.ilkStart || r.hpOnceki != null;
    case "V21": return r.agf != null;
    case "V22": return r.zeminGecmisiOzet != null;
    default: return false;
  }
}

/** Faz1'in bir at için hangi V-kodlarında GERÇEK veri bulduğunu, hangilerinde
 * bulamadığını listeler — admin panelinde "Faz1 neleri çekti" tikli görünümü için. */
export function faz1VeriKapsami(faz1: Faz1Sonuc, izinliKodlar: string[]): { no: number; ad: string; kodlar: { kod: string; veriVar: boolean }[] }[] {
  return faz1.runners.map((r) => ({
    no: r.no, ad: r.ad,
    kodlar: izinliKodlar.map((kod) => ({ kod, veriVar: veriVarMi(r, kod, faz1) })),
  }));
}

export type MuhakemeDenetimSonuc = {
  no: number;
  ad: string;
  supheliCiftler: { cift: string; kod: string; sebep: string }[];
};

/** Faz2'nin kompakt "muhakeme" metninde geçen HER "[Vx+Vy]" çiftinin, o at için
 * GERÇEKTEN var olan veriye dayanıp dayanmadığını denetler — Claude'un veri yokken var
 * gibi göstermesini (halüsinasyon) yakalamak için. Bir ek Claude çağrısı yapmaz,
 * tamamen mekanik/koddur. v6.47: kompakt tek-alan muhakeme formatına geçişle birlikte
 * iki ayrı diziyi (dogrulananCiftler/riskliCiftler) tarama yerine, TEK metindeki her
 * "[Vx+Vy]" örneğini kendi çevresindeki kısa bağlamla birlikte çıkarır. */
export function faz2MuhakemeDenetle(
  faz1: Faz1Sonuc, izinliKodlar: string[],
  faz2Atlar: { no: number; ad: string; muhakeme: string }[]
): MuhakemeDenetimSonuc[] {
  const izin = new Set(izinliKodlar);
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));
  const ciftRegex = /\[V\d+(?:\+V\d+)?\][^|]*/g;
  return faz2Atlar.map((a) => {
    const r = runnerByNo.get(a.no);
    const supheliCiftler: { cift: string; kod: string; sebep: string }[] = [];
    for (const cift of a.muhakeme.match(ciftRegex) ?? []) {
      const kodlar = [...cift.matchAll(/V(\d+)/g)].map((m) => `V${m[1]}`);
      for (const kod of kodlar) {
        if (!izin.has(kod)) {
          supheliCiftler.push({ cift: cift.trim(), kod, sebep: `${kod} bu kategoride kullanılmıyor` });
        } else if (!r) {
          supheliCiftler.push({ cift: cift.trim(), kod, sebep: `#${a.no} Faz1 verisinde bulunamadı` });
        } else if (!veriVarMi(r, kod, faz1)) {
          supheliCiftler.push({ cift: cift.trim(), kod, sebep: `${kod} için bu atta gerçek veri yok` });
        }
      }
    }
    return { no: a.no, ad: a.ad, supheliCiftler };
  });
}

export type KaliteUyariSonuc = { no: number; ad: string; uyarilar: string[] };

/**
 * v6.50 — kullanıcı kararı 2026-08-03: "faz3 hayatımızda olmayacak, ek maliyet bu
 * sebeple" — Faz2'nin promptunu (ek maliyet demek) BÜYÜTMEDEN, Elazığ 8.Koşu dersini
 * (OLGUNADAM/FISILTIKAYA: geniş örneklemli güçlü V9/V10 sinyali tek bir risk/V12
 * uyumsuzluğu yüzünden son sıralara çekildi) TAMAMEN ÜCRETSİZ, mekanik bir son-kontrol
 * olarak uyguluyor. Ek Claude çağrısı YOK — yalnız Faz2'nin zaten ürettiği "muhakeme"
 * metnini tarar, şüpheli durumları KULLANICIYA işaretler (kod hiçbir şeyi otomatik
 * değiştirmez, karar kullanıcıda kalır).
 */
export function faz2KaliteDenetimi(
  faz2Atlar: { no: number; ad: string; teknikSira: number; muhakeme: string }[]
): KaliteUyariSonuc[] {
  const saha = faz2Atlar.length;
  const altYariEsigi = Math.ceil(saha / 2);
  // v6.50 canlı bulgu: Claude, kompakt "Etiket:değer" talimatına rağmen çoğu zaman
  // serbest metne dönüyor ("Tempo senaryosu: EN_GERİ_TAKİP stili (Accurace %71,n=7)
  // ... zayıf stil eşleşmesi" gibi) — katı "V9:" önek arayan ilk sürüm bunu yakalayamadı.
  // Artık TÜM metinde "n=SAYI" arıyor, çevresindeki pencerede güç kelimesi var mı bakıyor
  // — biçimden bağımsız, gerçek çıktıya dayanıklı.
  const gucKelimeleri = /güçlü|iyi\b|sağlam|yüksek|geniş\s*örneklem/i;
  const nRegex = /n\s*[=~]\s*(\d+)/gi;
  return faz2Atlar.map((a) => {
    const uyarilar = new Set<string>();
    if (a.teknikSira > altYariEsigi) {
      let m: RegExpExecArray | null;
      while ((m = nRegex.exec(a.muhakeme))) {
        const n = parseInt(m[1], 10);
        if (n < 5) continue;
        const start = Math.max(0, m.index - 70);
        const end = Math.min(a.muhakeme.length, m.index + 40);
        const pencere = a.muhakeme.slice(start, end).replace(/\s+/g, " ").trim();
        if (gucKelimeleri.test(pencere)) {
          uyarilar.add(
            `Geniş örneklemli (n=${n}) güçlü bir sinyal var ama teknikSira alt yarıda (${a.teknikSira}/${saha}) — Elazığ 8.Koşu dersi (OLGUNADAM/FISILTIKAYA): bu tür sinyaller tek bir risk/popülasyon istatistiği (V12) yüzünden aşırı düşürülmüş olabilir. İlgili bölüm: "…${pencere}…" — tekrar oku, gerekirse elle yukarı al.`
          );
        }
      }
    }
    return { no: a.no, ad: a.ad, uyarilar: [...uyarilar] };
  });
}

export type KullanilmayanVeriSonuc = { no: number; ad: string; kullanilmayanKodlar: string[] };

/**
 * v6.58 — kullanıcı kararı 2026-08-04: aynı oturumda 3 ayrı at üzerinde (STARŞAH/
 * PRENSES MEHLİKA/WOLF SEYFO) "veri var ama muhakemede hiç geçmedi/yanlış yorumlandı"
 * bulundu — üçü de yalnız KÖTÜ SONUÇ SONRASI manuel kazıyla bulundu. Kullanıcı: "biz
 * verileri doğru kullanamıyoruz" — V13/V14/V20 zaten koda gömüldü (garanti), ama geri
 * kalan (V2/V6/V8/V9/V15/V16/V17/V19 vb.) sentez gerektirdiği için koda gömülemez —
 * bunun yerine TÜM V1-V22 için GENEL bir "veri var ama hiç kullanılmadı" dedektörü.
 * Yalnız en yüksek riskli (rank 1-2, banko/kupon kararını doğrudan etkileyen) atlara
 * uygulanır — gürültüyü azaltmak için. Bu fonksiyon yalnız TESPİT eder; asıl önemli
 * olan (kullanıcının sorusu: "bu uyarıdan sonra ne olacak") bunun bir admin panelinde
 * gözden kaçırılabilecek kutu OLARAK KALMAMASI — V2AnalysisPanel.tsx'te bu liste boş
 * değilse "Kaydet ve Yayımla" butonu admin bilinçli onay vermeden ÇALIŞMIYOR.
 */
export function faz2KullanilmayanVeriTespiti(
  faz1: Faz1Sonuc, izinliKodlar: string[],
  faz2Atlar: { no: number; ad: string; teknikSira: number; muhakeme: string }[]
): KullanilmayanVeriSonuc[] {
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));
  return faz2Atlar
    .filter((a) => a.teknikSira <= 2)
    .map((a) => {
      const r = runnerByNo.get(a.no);
      const kullanilmayanKodlar: string[] = [];
      if (r) {
        for (const kod of izinliKodlar) {
          if (!veriVarMi(r, kod, faz1)) continue;
          const num = kod.slice(1);
          const regex = new RegExp(`(?<!\\d)V${num}(?!\\d)`);
          if (!regex.test(a.muhakeme)) kullanilmayanKodlar.push(kod);
        }
      }
      return { no: a.no, ad: a.ad, kullanilmayanKodlar };
    });
}

export type SiralamaCiftUyarisi = { no: number; ad: string; uyarilar: string[] };

/**
 * v6.55 — kullanıcı bulgusu 2026-08-04 (Kocaeli 7.Koşu, WOLF SEYFO): sıralama çağrısı,
 * AYNI V-kodu çifti için bir atı "destek" başka bir atı "risk/risk-nötr" olarak
 * etiketlese bile, destek etiketli atı daha KÖTÜ sıraya koyabiliyor —
 * [V10+V12] WOLF SEYFO'da "en yüksek kazanan stille tam örtüşüyor" (destek) yazarken,
 * TANER ABİ'de aynı çift "nominal eşleşme, güven sınırlı" (risk-nötr) olduğu halde
 * TANER ABİ 4, WOLF SEYFO 5. sırada kaldı — WOLF SEYFO yarışı kazandı. Elazığ 8 dersinden
 * (faz2KaliteDenetimi) FARKLI bir hata sınıfı: burada mutlak güç değil, AYNI çift için
 * atlar ARASI göreceli kıyaslama tutarsızlığı yakalanıyor. Ek Claude çağrısı yapmaz,
 * tamamen mekanik: her V-kodu çifti için atların etiketlerini karşılaştırır; "destek"
 * etiketli bir at, AYNI çift için "destek" OLMAYAN etiketli bir attan daha kötü teknik
 * sıradaysa uyarır. Kod hiçbir şeyi otomatik değiştirmez, karar kullanıcıda kalır.
 */
export function faz2SiralamaTutarlilikDenetimi(
  faz2Atlar: { no: number; ad: string; teknikSira: number; muhakeme: string }[]
): SiralamaCiftUyarisi[] {
  type Girdi = { no: number; ad: string; teknikSira: number; destek: boolean; baglam: string };
  const ciftMap = new Map<string, Girdi[]>();
  const etiketRegex = /\[V(\d+)\+V(\d+)\]:([a-zçğıöşü-]+)(?:\(([^)]*)\))?/gi;

  for (const a of faz2Atlar) {
    let m: RegExpExecArray | null;
    etiketRegex.lastIndex = 0;
    while ((m = etiketRegex.exec(a.muhakeme))) {
      const kodA = parseInt(m[1], 10), kodB = parseInt(m[2], 10);
      const cift = kodA <= kodB ? `V${kodA}+V${kodB}` : `V${kodB}+V${kodA}`;
      const destek = m[3].toLowerCase().includes("destek");
      const baglam = m[4] ?? "";
      if (!ciftMap.has(cift)) ciftMap.set(cift, []);
      ciftMap.get(cift)!.push({ no: a.no, ad: a.ad, teknikSira: a.teknikSira, destek, baglam });
    }
  }

  const uyarilarByNo = new Map<number, Set<string>>();
  for (const [cift, girdiler] of ciftMap) {
    const destekliler = girdiler.filter((g) => g.destek);
    const digerleri = girdiler.filter((g) => !g.destek);
    for (const d of destekliler) {
      for (const r of digerleri) {
        if (d.teknikSira > r.teknikSira) {
          const set = uyarilarByNo.get(d.no) ?? new Set<string>();
          set.add(
            `[${cift}] bu at için "destek" (${d.baglam || "bağlam yok"}) işaretlenmiş ama #${r.no} ${r.ad} için AYNI çift "destek değil" (${r.baglam || "bağlam yok"}) olmasına rağmen sıralamada üstte (${r.teknikSira}. sıra) — sıralama tutarsız olabilir, elle kontrol edin.`
          );
          uyarilarByNo.set(d.no, set);
        }
      }
    }
  }

  return faz2Atlar.map((a) => ({ no: a.no, ad: a.ad, uyarilar: [...(uyarilarByNo.get(a.no) ?? [])] }));
}

const KARAR_AGIRLIK: Record<string, number> = {
  "Güçlü Aday": 4,
  "Düşük Risk": 3,
  "Orta Risk": 2,
  "Yüksek Risk": 1,
};

/**
 * v6.66 — kullanıcı bulgusu (15 atlı saha, "Neden bozdun analiz motorumuzu"): sıralama
 * çağrısı, V-kodu çiftlerini ikili ikili karşılaştırırken atın GENEL "karar" kategorisini
 * (Güçlü Aday/Düşük Risk/Orta Risk/Yüksek Risk) gözden kaçırıp tutarsız bir genel sıra
 * üretebiliyor (ör. "Güçlü Aday" bir at, açık bir gerekçe olmadan çok sayıda daha zayıf
 * kategorili atın gerisine düşüyor). Prompt talimatı (bkz. siralamaReminder "GENEL
 * TUTARLILIK") tek başına yeterli olmayabileceğinden (kullanıcı: "yetersiz kalma
 * ihtimali ön görüyorsan garantici olmanı istiyorum") bu, PROMPTTAN BAĞIMSIZ, tamamen
 * mekanik bir son-kontrol — büyük sahalarda (24 at dahil) otomatik ölçeklenir, ek Claude
 * çağrısı yapmaz, yalnız bilgilendirme amaçlıdır (bloklamaz).
 */
export function faz2KararSiraTutarsizlikDenetimi(
  faz2Atlar: { no: number; ad: string; karar: string; teknikSira: number }[]
): SiralamaCiftUyarisi[] {
  const uyarilarByNo = new Map<number, Set<string>>();
  for (const a of faz2Atlar) {
    const kendiAgirlik = KARAR_AGIRLIK[a.karar] ?? 2;
    const gerideBirakan = faz2Atlar.filter(
      (b) => b.no !== a.no && (KARAR_AGIRLIK[b.karar] ?? 2) < kendiAgirlik && b.teknikSira < a.teknikSira
    );
    if (gerideBirakan.length >= 3) {
      const set = uyarilarByNo.get(a.no) ?? new Set<string>();
      set.add(
        `"${a.karar}" kararı verilmiş ama ${gerideBirakan.length} tane daha zayıf kategorili at (${gerideBirakan
          .slice(0, 3)
          .map((b) => `#${b.no} ${b.ad} (${b.karar})`)
          .join(", ")}${gerideBirakan.length > 3 ? "..." : ""}) sıralamada önünde — karar/sıra tutarsız olabilir, elle kontrol edin.`
      );
      uyarilarByNo.set(a.no, set);
    }
  }
  return faz2Atlar.map((a) => ({ no: a.no, ad: a.ad, uyarilar: [...(uyarilarByNo.get(a.no) ?? [])] }));
}

export type KararHiyerarsiDegisikligi = { no: number; ad: string; eskiSira: number; yeniSira: number };
export type KararHiyerarsiSonuc<T> = { atlar: T[]; degisiklikler: KararHiyerarsiDegisikligi[] };

/**
 * v6.67 — kullanıcı kararı 2026-08-07 (İstanbul 1.Koşu, TOUCH THE CLOUD/DARK MONEY dersi):
 * "Düşük Risk, Orta Risk'in önünde olacak şekilde sırala — mantıklı sıralama Güçlü Aday -
 * Düşük Risk - Orta Risk - Yüksek Risk'tir." Bu KOŞULSUZ bir kural — Orta Risk atının kaç
 * kod-garantili sinyali olursa olsun, "karar" kategorisi daha iyi olan at HER ZAMAN önde
 * olur. faz2KararSiraTutarsizlikDenetimi (yalnız uyarı, bloklamaz) yetersiz kalabileceği
 * için (kullanıcı: "yetersiz kalma ihtimali görürsen garantici ol") bu, PROMPTTAN BAĞIMSIZ,
 * kategoriye göre istikrarlı (stabil) yeniden sıralama yapan mekanik bir zorunluluk —
 * aynı kategori içindeki göreli sıra (Claude'un/Top3Garantisi'nin ürettiği) KORUNUR, yalnız
 * kategoriler arası ihlaller düzeltilir.
 */
export function faz2KararHiyerarsisiUygula<T extends { no: number; ad: string; karar: string; teknikSira: number }>(
  atlar: T[]
): KararHiyerarsiSonuc<T> {
  const siraliOrijinal = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const yeniSirali = [...siraliOrijinal].sort((a, b) => {
    const wa = KARAR_AGIRLIK[a.karar] ?? 2;
    const wb = KARAR_AGIRLIK[b.karar] ?? 2;
    if (wa !== wb) return wb - wa;
    return a.teknikSira - b.teknikSira;
  });
  const degisiklikler: KararHiyerarsiDegisikligi[] = [];
  const guncellenmis = yeniSirali.map((a, i) => {
    const yeniSira = i + 1;
    if (yeniSira !== a.teknikSira) degisiklikler.push({ no: a.no, ad: a.ad, eskiSira: a.teknikSira, yeniSira });
    return { ...a, teknikSira: yeniSira };
  });
  return { atlar: guncellenmis, degisiklikler };
}

export type BankoAdayiSonuc = {
  bankoAdayi: boolean;
  sebep: string;
  birinci?: { no: number; ad: string; karar: string };
  ikinci?: { no: number; ad: string; karar: string };
};

/**
 * v6.50 — kullanıcı talebi: "banko olabilecek atları bana bir şekilde göster" — Faz3
 * (gerçek 0-100 puanlama) artık kullanılmayacağı için, YALNIZ Faz2'nin kendi
 * teknikSira+karar alanlarına dayanan mekanik bir banko-ADAYI tespiti (kesin banko
 * kararı DEĞİL, yalnız bir işaret — nihai karar kullanıcıda kalır). Ek Claude çağrısı yok.
 */
export function faz2BankoAdayiTespit(
  faz2Atlar: { no: number; ad: string; teknikSira: number; karar: string }[]
): BankoAdayiSonuc {
  const siraya = [...faz2Atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const birinci = siraya[0];
  const ikinci = siraya[1];
  if (!birinci) return { bankoAdayi: false, sebep: "Veri yok." };
  const guclu = /güçlü aday/i;
  const b = { no: birinci.no, ad: birinci.ad, karar: birinci.karar };
  const i = ikinci ? { no: ikinci.no, ad: ikinci.ad, karar: ikinci.karar } : undefined;
  if (guclu.test(birinci.karar) && (!ikinci || !guclu.test(ikinci.karar))) {
    return {
      bankoAdayi: true,
      sebep: `#${b.no} ${b.ad} "Güçlü Aday" — 2. sıradaki ${i ? `#${i.no} ${i.ad} ("${i.karar}")` : "at"} aynı düzeyde değil, net bir ayrışma var. Yalnız bir işaret — muhakeme metnindeki riskleri kendiniz teyit edin.`,
      birinci: b, ikinci: i,
    };
  }
  return {
    bankoAdayi: false,
    sebep: i ? `1. ve 2. sıra ("${b.karar}" vs "${i.karar}") yeterince ayrışmıyor — net bir banko işareti yok.` : "Yeterli veri yok.",
    birinci: b, ikinci: i,
  };
}

/**
 * v6.51 — kullanıcı kararı: V2 motoru artık gerçek Prediction/Pick kaydına gidiyor.
 * Pick.details (Json, admin rozeti — "kısa iç etiketler") için Faz2'nin kompakt
 * "muhakeme" metninden en anlamlı parçaları (karar + doğrulanan/riskli çiftler) çıkarır.
 * assertPublishSafe'in "AGF favorisi gerekçesiz kalamaz" kuralı için de bu alanın DOLU
 * olması gerekiyor — karar her zaman en az bir etiket garanti eder.
 */
export function faz2PickDetaylari(karar: string, muhakeme: string): string[] {
  const etiketler = [...muhakeme.matchAll(/\[V\d+(?:\+V\d+)?\][^|]*/g)].map((m) => m[0].trim());
  // v6.66 — kullanıcı bulgusu (MELONCITTO, Kocaeli 6.Koşu): sabit slice(0,5) kesmesi,
  // Claude kendi 5 etiketini yazdıktan SONRA eklenen kod-garantili etiketleri (V1/V4/V12/
  // V19 vb., hepsi sona eklenir) sessizce görünürden düşürüyordu — V19 (son yarışı
  // kazandı) bu yüzden admin ekranında hiç görünmedi. Kod-garantili etiketler ASLA
  // kesilmez, geri kalan yer Claude'un kendi etiketleriyle doldurulur.
  const garantili = etiketler.filter((e) => e.includes("KOD-GARANTİSİ"));
  const digerleri = etiketler.filter((e) => !e.includes("KOD-GARANTİSİ"));
  const secili = [...garantili, ...digerleri.slice(0, Math.max(5, 8 - garantili.length))];
  return [`Karar: ${karar}`, ...secili];
}

/**
 * v6.56 — kullanıcı bulgusu 2026-08-04 (STARŞAH, Kocaeli 8.Koşu): sınıf geçişi (SKK
 * farkı) Faz1'de HER ZAMAN hesaplanıyor (classToSkk) ama Claude muhakemede bunu
 * atlayabiliyordu — STARŞAH KV-6(SKK 6)'dan Şartlı 5(SKK 4)'e 2 kademe düşmüştü, hiç
 * değerlendirilmedi, sonuçta yarışı kazandı. Kullanıcı kararı net: "muhakemede hiç
 * geçmemesini kabul etmiyorum, geçmesini sağlaman gerek" — ihtimale/Claude'un seçimine
 * bırakmak yerine KODUN KENDİSİ bu bilgiyi muhakeme metnine GARANTİLİ olarak ekliyor (ek
 * Claude çağrısı yok, ücretsiz). Kullanıcı eşik istemedi — SKK farkı 1 bile olsa eklenir.
 */
export function faz2SinifGecisEtiketiEkle(
  muhakeme: string,
  r: { sinifOnceki: string | null; sinifSkkOnceki: number | null; sinifSkkBugun: number | null }
): string {
  if (r.sinifOnceki == null || r.sinifSkkOnceki == null || r.sinifSkkBugun == null) return muhakeme;
  if (r.sinifSkkBugun < r.sinifSkkOnceki) {
    return `${muhakeme} | [V14]:destek(sınıf düşüşü: ${r.sinifOnceki}(SKK ${r.sinifSkkOnceki}) → bugün SKK ${r.sinifSkkBugun})`;
  }
  if (r.sinifSkkBugun > r.sinifSkkOnceki) {
    return `${muhakeme} | [V14]:nötr(sınıf yükselişi: ${r.sinifOnceki}(SKK ${r.sinifSkkOnceki}) → bugün SKK ${r.sinifSkkBugun}, dezavantaj sayılmaz)`;
  }
  return muhakeme;
}

/**
 * v6.57 — kullanıcı kararı 2026-08-04: "her V'yi koda göm" dedi, ama yalnız SAYISAL/
 * objektif V-kodları (V13 kilo, V14 sınıf, V20 HP ivmesi) için kabul edildi — çok
 * sinyalli sentez gerektirenler (V2/V9/V16/V19 vb.) [[Sert Koşul Yasak]] ilkesi
 * gereği Claude'un muhakemesinde kalıyor. WOLF SEYFO vakasında "ağır kilo" sahanın
 * gerçek ortalamasına göre kalibre edilmeden kullanılmıştı — kiloAvantaji ile AYNI
 * ≥1kg eşiği (kullanıcı onaylı, veri-toplama.ts'te zaten var) kullanılarak simetrik
 * hale getirildi: ≥1kg hafif=destek, ≥1kg ağır=risk, arası=nötr. Kod garantili, ek
 * Claude çağrısı yok.
 */
export function faz2KiloKarsilastirmaEtiketiEkle(
  muhakeme: string,
  r: { weight: number | null },
  ortKilo: number | null
): string {
  if (r.weight == null || ortKilo == null) return muhakeme;
  const fark = Math.round((r.weight - ortKilo) * 10) / 10;
  if (fark <= -1) {
    return `${muhakeme} | [V13]:destek(sahadaki ortalamadan ${Math.abs(fark)}kg hafif — ${r.weight}kg vs ort ${ortKilo.toFixed(1)}kg)`;
  }
  if (fark >= 1) {
    return `${muhakeme} | [V13]:risk(sahadaki ortalamadan ${fark}kg ağır — ${r.weight}kg vs ort ${ortKilo.toFixed(1)}kg)`;
  }
  return `${muhakeme} | [V13]:nötr(sahadaki ortalamaya yakın — ${r.weight}kg vs ort ${ortKilo.toFixed(1)}kg)`;
}

/**
 * v6.57 — kullanıcı kararı 2026-08-04: PRENSES MEHLİKA vakasında "HP sabit" (ivme=0)
 * ile "HP düşüyor" (negatif ivme) birbirine karıştırılmıştı; bunu prompt seviyesinde
 * netleştirmenin (V_LEGEND) yanı sıra, HP ivmesinin yönü zaten objektif bir sayı
 * olduğu için doğrudan koda gömülüyor — Claude'un yorumuna bağlı kalmıyor.
 */
export function faz2HpIvmeEtiketiEkle(
  muhakeme: string,
  r: { hpIvmesi: number | null }
): string {
  if (r.hpIvmesi == null) return muhakeme;
  if (r.hpIvmesi > 0) {
    return `${muhakeme} | [V20]:destek(HP yükseliyor, ivme +${r.hpIvmesi})`;
  }
  if (r.hpIvmesi < 0) {
    return `${muhakeme} | [V20]:risk(HP geriliyor, ivme ${r.hpIvmesi} — fiziksel gerileme olabilir)`;
  }
  return `${muhakeme} | [V20]:nötr(HP sabit, ivme 0 — ne gerileme ne belirgin iyileşme)`;
}

/**
 * v6.61 — kullanıcı bulgusu 2026-08-05 (İSPANOZ, İstanbul 3.Koşu): bireysel n=15 GÜÇLÜ
 * sinyal + popülasyonda 2. sırada (%28) olmasına rağmen muhakeme "nötr-hafif destek"
 * gibi yumuşatılmış bir etiketle değerlendirip 6. sıraya çekmişti — İSPANOZ kazandı.
 * Kullanıcı talebi ("yetersiz kalma ihtimali varsa garantici ol"): yalnız V_LEGEND'e
 * netleştirme yazmak (Claude'un yorumuna bağlı kalır) yetmeyebilir — popülasyon sırası
 * (pistMesafeStilBreakdown, zaten hesaplanıyor) ve atın kendi örneklemi (tempoVeriN)
 * İKİSİ de objektif/sayısal olduğu için V13/V14/V20 gibi KODA gömülüyor: at kendi
 * stiliyle popülasyonun ilk 2 sırasından birinde eşleşiyorsa VE tempoVeriN≥10 ise,
 * [V10+V12]:destek GARANTİLİ eklenir — Claude'un "hafif/nötr" diye yumuşatması bu
 * garantili etiketi SİLEMEZ, yalnız yanına eklenir.
 */
export function faz2StilPopulasyonEtiketiEkle(
  muhakeme: string,
  r: { raceStyleEtiket: string | null; tempoVeriN: number | null },
  breakdown: { style: string; percent: number }[] | null
): string {
  if (!r.raceStyleEtiket || r.tempoVeriN == null || r.tempoVeriN < 10 || !breakdown) return muhakeme;
  const ilkIki = breakdown.slice(0, 2);
  const eslesen = ilkIki.find((b) => b.style === r.raceStyleEtiket);
  if (!eslesen) return muhakeme;
  // v6.62 — kullanıcı bulgusu 2026-08-05 (TAM TIME, 10 atlı koşu): V_LEGEND'e eklenen
  // netlik bazen Claude'un KENDİSİ tarafından zaten doğru uygulanıyor ("n=13≥10,
  // popülasyonda ilk sıralarda-TAM destek" gibi temiz bir "destek" etiketiyle) — bu
  // durumda kod GARANTİSİNİ yine de eklemek aynı çifti İKİ KEZ yazdırıp tutarlılık
  // kontrolünde yanıltıcı/tekrarlı uyarılara yol açıyordu. Artık yalnız Claude'un
  // kendi etiketi YUMUŞATILMIŞ (temiz "destek" değil) veya HİÇ yoksa ekleniyor —
  // zaten doğru yazılmışsa dokunulmuyor.
  const mevcutEtiket = muhakeme.match(/\[V(?:10\+V12|12\+V10)\]:([^|(]*)/i)?.[1]?.trim().toLowerCase();
  if (mevcutEtiket === "destek") return muhakeme;
  const sira = breakdown.findIndex((b) => b.style === r.raceStyleEtiket) + 1;
  return `${muhakeme} | [V10+V12]:destek(KOD-GARANTİSİ: bireysel örneklem n=${r.tempoVeriN}(≥10) + popülasyonda ${sira}. sırada %${eslesen.percent} — bu TAM destek sayılır, yumuşatılmamalı)`;
}

/** Bir muhakeme metninde, verilen V-kodu çifti (tek veya çift kod, örn. "V4" ya da
 * "V10+V12") için Claude'un ZATEN temiz bir "destek" yazıp yazmadığını kontrol eder —
 * yazmışsa kod tekrar eklemez (v6.62 TAM TIME dersi: aynı çifti iki kez yazdırıp
 * tutarlılık kontrolünü yanıltmamak için). */
function halihazirdaTemizDestekVarMi(muhakeme: string, kodDeseni: string): boolean {
  const re = new RegExp(`\\[${kodDeseni}\\]:([^|(]*)`, "i");
  const etiket = muhakeme.match(re)?.[1]?.trim().toLowerCase();
  return etiket === "destek";
}

/**
 * v6.63 — kullanıcı bulgusu 2026-08-05 (ANSHBA SKY, İstanbul 5.Koşu Maiden): atın son
 * yarışını AYNI jokeyle koştuğu (jockeyChanged=false) olumlu bir sinyaldir ama Claude
 * muhakemede hiç değinmeyebiliyordu — ANSHBA SKY'de tam olarak bu oldu (muhakeme
 * tamamen boştu), at yine de kazandı. jockeyChanged zaten temiz bir boolean olduğu
 * için (V13/V14/V20 gibi) doğrudan koda gömülüyor.
 */
export type Top3TerfiSonuc = { no: number; ad: string; eskiSira: number; yeniSira: number };

// route.ts'teki TestV2Pick ile aynı şekil — döngüsel import'tan kaçınmak için burada
// yerel bir tip takma adı olarak tekrarlanıyor.
type TeknikSiraliAt = { no: number; ad: string; karar: string; muhakeme: string; teknikSira: number };

/**
 * v6.64 — kullanıcı kararı 2026-08-05 (DAELLA, kazandı ama 5. sıradaydı): "bunları
 * sistem ilk 3'e almalı diyorum ben değil" — DAELLA'nın [V10+V12] etiketi Claude
 * tarafından ZATEN doğru "destek" yazılmıştı (sahanın #1 tarihsel kazanan stili,
 * ÖnGrupArkası%37) ama sıralama çağrısı yine de onu 5. sıraya koydu. Yalnız EN SIKI
 * koşulda çalışır (sahanın #1 stili + n≥10 gerçek örneklem + atın kendi kararı
 * "Yüksek Risk" DEĞİL) — yanlış pozitif riskini en aza indirmek için, kullanıcı onayı
 * (2026-08-05, iki seçenekten "en sıkı" olanı seçildi). Bu bir etiket EKLEMEK değil,
 * doğrudan teknikSira'yı DEĞİŞTİRMEK — bugüne kadarki en güçlü müdahale, bu yüzden
 * her terfi hem muhakeme metnine görünür şekilde eklenir hem admin panelinde ayrıca
 * listelenir (şeffaflık, kör bir kural gibi sessizce çalışmaz).
 */
// v6.69 — kullanıcı talebi ("bir daha yaşanmamak üzere önle"): faz2Top3Garantisi eskiden
// yalnız V10+V12/stil-popülasyon uyumunu HAM istatistikten yeniden hesaplıyordu — İzmir
// 5.Koşu (ROSİLDA, n=12, popülasyonda 2. sırada) bu dar kapsamı (yalnız #1 sıra) aştığı
// için kaçtı. Muhakeme metnindeki mekanik KOD-GARANTİSİ işaretini ("...TAM destek
// sayılır, yumuşatılmamalı") aramaya başlandı — bu ibare faz2StilPopulasyonEtiketiEkle
// tarafından HER ZAMAN, Claude'un yorumundan bağımsız olarak yazılıyor.
//
// 2. tur bulgu (aynı gece, İstanbul 3.Koşu, CEMRE ATEŞİ): bu metin-tabanlı kontrol TEK
// BAŞINA yetersiz kaldı — Claude AYNI objektif koşulu (n≥10 + popülasyon üst sıra)
// kendi cümleleriyle ("tam destek,yumuşatma yok") doğru şekilde yazınca, kod enjeksiyonu
// (zaten temiz "destek" var diye) haklı olarak atlanıyor — ama bu durumda metin kalıbı
// KOD'un ürettiği kanonik ifadeyle birebir eşleşmediği için güvenlik ağı bunu da
// kaçırıyordu (destek=6/risk=0 olan CEMRE ATEŞİ rank3'te kalmıştı). Artık HAM istatistik
// koşulu (n≥10 + popülasyonda ilk 2 stil eşleşmesi) DA ayrıca kontrol ediliyor — ikisinden
// HANGİSİ tetiklerse tetiklesin (metin kalıbı NASIL yazılırsa yazılsın, ya da hiç
// yazılmamış olsa bile ham veri koşulu sağlanıyorsa) terfi devreye girer. Bu hâlâ mekanik
// bir puanlama formülü DEĞİL — yalnız kodun zaten nesnel eşiklerle doğruladığı dar
// istisnalar için devreye giriyor, Claude'un normal holistik muhakemesine dokunmuyor.
function tamDestekMuhakemesiVar(muhakeme: string): boolean {
  return /TAM destek say[ıi]l[ıi]r,?\s*yumuşat[ıi]lma/i.test(muhakeme);
}

export function faz2Top3Garantisi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): { atlar: TeknikSiraliAt[]; terfiler: Top3TerfiSonuc[] } {
  if (atlar.length <= 3) return { atlar, terfiler: [] };

  const breakdown = faz1.race.pistMesafeStilBreakdown;
  const topStyles = new Set((breakdown ?? []).slice(0, 2).map((b) => b.style));
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));

  function hamIstatistikNitelikliMi(a: TeknikSiraliAt): boolean {
    const r = runnerByNo.get(a.no);
    if (!r || !r.raceStyleEtiket || !topStyles.has(r.raceStyleEtiket)) return false;
    if (r.tempoVeriN == null || r.tempoVeriN < 10) return false;
    return true;
  }

  function nitelikliMi(a: TeknikSiraliAt): boolean {
    if (a.karar === "Yüksek Risk") return false;
    return tamDestekMuhakemesiVar(a.muhakeme) || hamIstatistikNitelikliMi(a);
  }

  const sirali = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const terfiEdecekler = sirali.slice(3).filter(nitelikliMi);
  if (terfiEdecekler.length === 0) return { atlar, terfiler: [] };

  const orijinalTop3 = sirali.slice(0, 3);
  // v6.64 düzeltme: terfi eden at "ilk 3'e girsin" demekti, "1. sıraya fırlasın" değil —
  // korunan orijinal top-3 üyeleri ÖNCE (kendi göreceli sırasıyla), terfi edenler
  // SONRA (yalnız boşalan alt sıra(lar)ı doldurarak) ekleniyor.
  const yeniTop3 = terfiEdecekler.length >= 3
    ? terfiEdecekler.slice(0, 3)
    : [...orijinalTop3.slice(0, 3 - terfiEdecekler.length), ...terfiEdecekler];
  const yeniTop3Nos = new Set(yeniTop3.map((a) => a.no));
  const kalan = sirali.filter((a) => !yeniTop3Nos.has(a.no));
  const yeniSiraliListe = [...yeniTop3, ...kalan];

  const terfiler: Top3TerfiSonuc[] = terfiEdecekler
    .filter((a) => yeniTop3Nos.has(a.no))
    .map((a) => ({ no: a.no, ad: a.ad, eskiSira: a.teknikSira, yeniSira: yeniSiraliListe.findIndex((x) => x.no === a.no) + 1 }));

  const yeniAtlar = yeniSiraliListe.map((a, i) => {
    const terfi = terfiler.find((t) => t.no === a.no);
    const teknikSira = i + 1;
    if (!terfi) return { ...a, teknikSira };
    return {
      ...a,
      teknikSira,
      // v6.68 düzeltme — kullanıcı bulgusu 2026-08-08/09: bu terfi yalnız teknikSira'yı
      // değiştiriyordu, "karar" (ör. "Orta Risk") olduğu gibi kalıyordu — bu yüzden BU
      // fonksiyondan SONRA çalışan faz2KararHiyerarsisiUygula (koşulsuz kategori sıralaması)
      // terfiyi SESSİZCE GERİ ALABİLİYORDU. Artık terfi eden atın kararı da "Güçlü Aday"a
      // yükseltiliyor — terfi, hiyerarşi kuralından SONRA da kalıcı.
      karar: "Güçlü Aday",
      muhakeme: `${a.muhakeme} | [SİSTEM]:KOD-GARANTİSİ ilk 3'e terfi (eski sıra ${terfi.eskiSira} → ${teknikSira}) — muhakemesinde kod tarafından doğrulanmış "TAM destek, yumuşatılmamalı" işareti var, kendi kararı Yüksek Risk değil (DAELLA/İSPANOZ/ROSİLDA dersi).`,
    };
  });

  return { atlar: yeniAtlar, terfiler };
}

// v6.88 — kullanıcı düzeltmesi 2026-08-10: v6.87'de V4 bu sayımdan çıkarılmıştı, ama
// kullanıcı netleştirdi — "en çok yükselen/düşenler, BAŞKA verilerle destekleniyorsa
// ilk 3'e" kuralında V4 (aynı jokeyle devam) GERÇEK bir destekleyen veri sayılmaya
// devam edecek, çıkarılmayacaktı. V4 geri eklendi. AYRICA: V3 (takı) artık HER atta
// zorla "destek" enjekte ETMİYOR (v6.87), ama kullanıcı: "yine de dikkate alınacak,
// çünkü bir takı değişikliği atı bambaşka bir çehreye dönüştürebilir, eklenen/çıkarılan
// fark etmez" — yani takı değişikliği bu SAYIMA (AGF trend desteği) dahil, ama artık
// muhakeme metnine regex'le değil, HAM VERİDEN (takiEfektif) okunuyor; bkz. aşağıdaki
// opsiyonel `runner` parametresi.
const GUCLU_KOD_GARANTI_KODLARI = ["V1", "V4", "V19", "V22"];
function gucluKodGarantiSayisi(muhakeme: string, runner?: Faz1Runner): number {
  let sayi = GUCLU_KOD_GARANTI_KODLARI.filter((kod) =>
    new RegExp(`\\[${kod}(?:\\+V\\d+)?\\]:destek\\(KOD-GARANTİSİ`, "i").test(muhakeme)
  ).length;
  if (runner) {
    const { eklenen, cikarilan } = takiEfektif(runner);
    if (eklenen || cikarilan) sayi += 1;
  }
  return sayi;
}

// v6.69 — kullanıcı bulgusu (İstanbul 1.Altılı 09.08.2026 kritiği): AGF'de en çok DÜŞEN
// atlar da (ULUŞİRAN BEYİ -17,45, TÜRKÖREN -14,68) kazandı — sinyal yön bağımsız güçlü.
// enCokYukselenler + enCokDusenler'i TEK bir "trend" listesine birleştirir, yön bilgisini
// muhakeme metninde göstermek için saklar.
type TrendAt = { runnerNo: number; ad: string; fark: number; yon: "yükseliş" | "düşüş" };
function birlesikTrendListesi(faz1: Faz1Sonuc): TrendAt[] {
  const yukselenler = (faz1.race.enCokYukselenler ?? []).map((y) => ({ ...y, yon: "yükseliş" as const }));
  const dusenler = (faz1.race.enCokDusenler ?? []).map((d) => ({ ...d, yon: "düşüş" as const }));
  return [...yukselenler, ...dusenler];
}

/**
 * v6.69 — kullanıcı kararı 2026-08-09 (İstanbul 1.Altılı kritiği sonrası): "birden çok V
 * ile destekli en çok yükselen ve en çok düşen trendli at ilk 3'te olmalı" — eşik ikiye
 * çıkarıldı (v6.68'de ≥1 idi, ilk 2'ye terfi ediyordu), hedef pencere ilk 3'e genişledi, VE
 * artık yalnız yükselenler değil düşenler de sayılıyor (bkz. birlesikTrendListesi). "karar"
 * da "Güçlü Aday"a yükseltilir (Top3Garantisi ile aynı gerekçe: aksi halde hiyerarşi kuralı
 * terfiyi geri alır).
 */
export function faz2GucluKombinasyonTop3Garantisi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): { atlar: TeknikSiraliAt[]; terfiler: KararHiyerarsiDegisikligi[] } {
  const trendliler = birlesikTrendListesi(faz1);
  if (trendliler.length === 0 || atlar.length <= 3) return { atlar, terfiler: [] };

  let calisma = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const terfiler: KararHiyerarsiDegisikligi[] = [];
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));
  // v6.96 — kullanıcı bulgusu 2026-08-10 (Bursa 3.Koşu): 3+ at aynı anda bu terfiye hak
  // kazanınca, eski sıralama ("en geride olan önce terfi etsin") YALNIZCA zaten 3. sıraya
  // en yakın olanı 3.'te bırakıyordu — bu, atların GERÇEK sinyal gücüyle İLGİSİZDİ.
  // PAPA RUNNER (2 kod-garantili sinyal, zaten 3.'e yakındı) 3.'te kaldı, SUN OF THE
  // GÖKSU (3 kod-garantili sinyal, sahadaki EN GÜÇLÜ profil) 4.'e itildi — ve SUN OF THE
  // GÖKSU gerçekten kazandı, PAPA RUNNER sondan 2. oldu. Artık öncelik sinyal SAYISINA
  // göre: en GÜÇLÜ sinyalli at EN SON işlenir (kimse onu geriye itemesin, 3.'te kalsın),
  // eşitlikte eski kural (geride olan önce) tie-break olarak korunur.
  const nitelikliler = trendliler
    .map((t) => ({ t, at: calisma.find((a) => a.no === t.runnerNo) }))
    .filter((x): x is { t: TrendAt; at: TeknikSiraliAt } => !!x.at && gucluKodGarantiSayisi(x.at.muhakeme, runnerByNo.get(x.at.no)) >= 2)
    .sort((a, b) => {
      const gucA = gucluKodGarantiSayisi(a.at.muhakeme, runnerByNo.get(a.at.no));
      const gucB = gucluKodGarantiSayisi(b.at.muhakeme, runnerByNo.get(b.at.no));
      if (gucA !== gucB) return gucA - gucB; // en güçlü EN SON (dizinin sonu = 3.'te kalır)
      return b.at.teknikSira - a.at.teknikSira; // eşitlikte: en geride olan önce terfi etsin
    });

  const terfiAdaylari = new Set<number>();
  for (const { t, at } of nitelikliler) {
    const idx = calisma.findIndex((a) => a.no === at.no);
    if (idx === -1 || idx < 3) continue; // zaten ilk 3'te
    const eskiSira = calisma[idx].teknikSira;
    const guncellenmisAt: TeknikSiraliAt = {
      ...calisma[idx],
      // v6.98 — kullanıcı bulgusu 2026-08-10 (Elazığ 8.Koşu, "12 atta Güçlü Aday"):
      // karar burada HERKESE "Güçlü Aday" yazıyordu — ama 3+ at aynı anda aday olunca
      // yalnız BİRİ gerçekten 3.'te kalabiliyor, geri kalanı 4./10./12. sıraya kadar
      // itiliyordu, YİNE DE "Güçlü Aday" etiketini taşımaya devam ediyorlardı. Artık
      // karar burada DEĞİŞTİRİLMİYOR — yalnız GERÇEKTEN ilk 3'te kalan(lar) aşağıda,
      // tüm terfiler bittikten SONRA işaretleniyor.
      muhakeme: `${calisma[idx].muhakeme} | [SİSTEM]:KOD-GARANTİSİ AGF trend (${t.yon}, ${t.fark >= 0 ? "+" : ""}${t.fark} puan) + birden çok güçlü sinyal birleşimiyle ilk 3 bandına terfi adayı (eski sıra ${eskiSira}) — 2026-08-09 kullanıcı kararı.`,
    };
    const kalanlar = calisma.filter((a) => a.no !== at.no);
    calisma = [...kalanlar.slice(0, 2), guncellenmisAt, ...kalanlar.slice(2)];
    terfiler.push({ no: at.no, ad: at.ad, eskiSira, yeniSira: 3 });
    terfiAdaylari.add(at.no);
  }
  if (terfiler.length === 0) return { atlar, terfiler: [] };

  // v6.98 — yalnız GERÇEKTEN ilk 3'te kalan aday(lar) "Güçlü Aday" olur; 4+ sıraya
  // itilenler kendi orijinal kararını (ya da 4-6 penceresinin vereceği kararı) korur.
  calisma = calisma.map((a, i) => (i < 3 && terfiAdaylari.has(a.no) ? { ...a, karar: "Güçlü Aday" } : a));

  const yeniAtlar = calisma.map((a, i) => ({ ...a, teknikSira: i + 1 }));
  // v6.95 — terfiler dizisindeki yeniSira SABİT "3" yazılıyordu (yukarıdaki push'ta),
  // ama sonraki her terfi bir öncekini geriye itiyor — GERÇEK nihai konum yalnız TÜM
  // terfiler bittikten sonra, finalCalisma'daki asıl indeksten doğru okunabilir.
  const finalSiraByNo = new Map(yeniAtlar.map((a) => [a.no, a.teknikSira]));
  const duzeltilmisTerfiler = terfiler.map((t) => ({ ...t, yeniSira: finalSiraByNo.get(t.no) ?? t.yeniSira }));
  return { atlar: yeniAtlar, terfiler: duzeltilmisTerfiler };
}

// ─── 4+ Sinyal Yığını ──────────────────────────────────────────────────────────────
// 2026-08-13 — sitenin tüm geçmiş koşuları (n=40.798) üzerinde yapılan backtestte
// (bkz. yayınlanan "agf-sinyal-raporu") 6 bağımsız sinyalden (AGF trend yönü, Accurace
// son yarış en hızlı son 200m kapanışı, son yarışını kazanmış olmak, KGS 14-30 gün,
// hipodrom+pist+mesafe uzmanlığı, aygır üst %20 kazanma dilimi) 4 veya fazlasını AYNI
// ANDA taşıyan atlar n=547, %31.4 galibiyet (GA %27.6-35.3) / %61.4 ilk3 gösterdi —
// mevcut TÜM kod-garanti kurallarından (faz2AgfStatikTop3Garantisi n=66, faz2IlkSira-
// AgfTop3Sinirlamasi n=104) hem örneklem hem oran olarak daha güçlü. Kullanıcı kararı
// 2026-08-13: doğrudan ilk-3'e terfi, faz2GucluKombinasyonTop3Garantisi ile aynı desen.

// SireStatOwn.kYuzde P80 (n>=20 örneklemli aygırlar, 2026-08-13 doğrulaması — n=530,
// global=14, İngiliz=14 (n=268), Arap=14 (n=262)): ırklar arası fark yok, tek statik
// eşik yeterli.
export const SIRE_TOP20_KYUZDE_ESIGI = 14;
export const SINYAL_YIGINI_ESIGI = 4;

export type SinyalSonuc = { sayi: number; etiketler: string[] };

/** 6-sinyal sayımının V2/V4 TARAFINDAN paylaşılan çekirdeği — Faz1Runner'ın (V2'nin geniş
 *  tipi) tamamına değil, yalnız gerçekten kullanılan 7 alana bağımlı. `trend`, çağıranın
 *  kendi AGF-trend listesinden (V2: birlesikTrendListesi, V4: kendi eşdeğeri) bulup
 *  geçirdiği tek eşleşme — bu fonksiyon faz1/saha bilgisine hiç erişmez. */
export type SinyalGirdisi = {
  no: number;
  recentForm: string | null;
  accuraceSonYarisEnHizliKapanis: boolean | null;
  gunAralik: number | null;
  hipodromMesafedeKazandi: "EVET" | "HAYIR" | "KOSMADI";
  sireKazanmaOrani: number | null;
  sireOrneklemKendiVeri: number | null;
};

export function hesaplaSinyalSayisi(
  r: SinyalGirdisi,
  trend: { fark: number; yon: "yükseliş" | "düşüş" } | undefined
): SinyalSonuc {
  const etiketler: string[] = [];

  // 1. AGF trend yönü — yükselen/düşen birbirini dışlar (aynı at ikisini birden
  //    taşıyamaz), tek slot sayılır.
  if (trend) etiketler.push(`AGF trend (${trend.yon}, ${trend.fark >= 0 ? "+" : ""}${trend.fark} puan)`);

  // 2. Accurace — son yarışta sahanın en hızlı son 200m kapanışı
  if (r.accuraceSonYarisEnHizliKapanis === true) etiketler.push("Accurace son yarış en hızlı son 200m kapanışı");

  // 3. Son yarışını kazandı — faz2SonYarisKazandiEtiketiEkle ile AYNI parse mantığı
  if (sonYarisKazandiMi(r.recentForm)) etiketler.push("son yarışını kazandı");

  // 4. KGS 14-30 gün (sezgiye aykırı optimal dinlenme penceresi — <14 gün daha kötü)
  if (r.gunAralik != null && r.gunAralik >= 14 && r.gunAralik <= 30) etiketler.push(`KGS ${r.gunAralik} gün (14-30 aralığı)`);

  // 5. Bu hipodrom+pist+mesafe kombinasyonunda daha önce kazandı
  if (r.hipodromMesafedeKazandi === "EVET") etiketler.push("hipodrom+pist+mesafe uzmanı");

  // 6. Aygır üst %20 kazanma yüzdelik dilimi (n>=20 örneklem şartı, mevcut V1 konvansiyonu)
  if (
    r.sireKazanmaOrani != null &&
    r.sireOrneklemKendiVeri != null &&
    r.sireOrneklemKendiVeri >= 20 &&
    r.sireKazanmaOrani >= SIRE_TOP20_KYUZDE_ESIGI
  ) {
    etiketler.push(`aygır üst %20 (K% ${r.sireKazanmaOrani}, n=${r.sireOrneklemKendiVeri})`);
  }

  return { sayi: etiketler.length, etiketler };
}

function altiSinyalSayisi(r: Faz1Runner, faz1: Faz1Sonuc): SinyalSonuc {
  const trend = birlesikTrendListesi(faz1).find((t) => t.runnerNo === r.no);
  return hesaplaSinyalSayisi(r, trend ? { fark: trend.fark, yon: trend.yon } : undefined);
}

/**
 * 4+ sinyal aynı anda taşıyan atları doğrudan ilk-3'e terfi ettirir — bkz. yukarıdaki
 * not. faz2GucluKombinasyonTop3Garantisi şablonuyla birebir aynı desen (en güçlü
 * sinyalli en son işlenir, ilk-3'e en yakın kalır; eşitlikte geride olan önce terfi
 * eder; yalnız gerçekten ilk-3'te kalan(lar) "Güçlü Aday" olur).
 */
export function faz2SinyalYiginiTop3Garantisi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): { atlar: TeknikSiraliAt[]; terfiler: KararHiyerarsiDegisikligi[] } {
  if (atlar.length <= 3) return { atlar, terfiler: [] };

  let calisma = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const terfiler: KararHiyerarsiDegisikligi[] = [];
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));

  const nitelikliler = calisma
    .map((at) => ({ at, r: runnerByNo.get(at.no) }))
    .filter((x): x is { at: TeknikSiraliAt; r: Faz1Runner } => !!x.r)
    .map((x) => ({ ...x, sinyal: altiSinyalSayisi(x.r, faz1) }))
    .filter((x) => x.sinyal.sayi >= SINYAL_YIGINI_ESIGI)
    .sort((a, b) => {
      if (a.sinyal.sayi !== b.sinyal.sayi) return a.sinyal.sayi - b.sinyal.sayi; // en güçlü EN SON
      return b.at.teknikSira - a.at.teknikSira; // eşitlikte: en geride olan önce terfi etsin
    });

  const terfiAdaylari = new Set<number>();
  for (const { at, sinyal } of nitelikliler) {
    const idx = calisma.findIndex((a) => a.no === at.no);
    if (idx === -1 || idx < 3) continue; // zaten ilk 3'te
    const eskiSira = calisma[idx].teknikSira;
    const guncellenmisAt: TeknikSiraliAt = {
      ...calisma[idx],
      muhakeme: `${calisma[idx].muhakeme} | [SİSTEM]:KOD-GARANTİSİ ${sinyal.sayi} bağımsız sinyal aynı anda taşınıyor (${sinyal.etiketler.join("; ")}) — geriye dönük doğrulama: 4+ sinyal n=547, %31.4 galibiyet (GA %27.6-35.3)/%61.4 ilk3, 2026-08-13 — ilk-3 bandına terfi adayı (eski sıra ${eskiSira}).`,
    };
    const kalanlar = calisma.filter((a) => a.no !== at.no);
    calisma = [...kalanlar.slice(0, 2), guncellenmisAt, ...kalanlar.slice(2)];
    terfiler.push({ no: at.no, ad: at.ad, eskiSira, yeniSira: 3 });
    terfiAdaylari.add(at.no);
  }
  if (terfiler.length === 0) return { atlar, terfiler: [] };

  calisma = calisma.map((a, i) => (i < 3 && terfiAdaylari.has(a.no) ? { ...a, karar: "Güçlü Aday" } : a));

  const yeniAtlar2 = calisma.map((a, i) => ({ ...a, teknikSira: i + 1 }));
  const finalSiraByNo2 = new Map(yeniAtlar2.map((a) => [a.no, a.teknikSira]));
  const duzeltilmisTerfiler2 = terfiler.map((t) => ({ ...t, yeniSira: finalSiraByNo2.get(t.no) ?? t.yeniSira }));
  return { atlar: yeniAtlar2, terfiler: duzeltilmisTerfiler2 };
}

/**
 * v6.69 — kullanıcı kararı 2026-08-09: "en çok yükselen ve en çok düşen diğer atlar analiz
 * gücüne göre geri kalan sıralamalarda yerini almalı, 4-5-6 içinde." v6.68'de bu tek bir
 * sabit pozisyona (4) terfi ediyordu ve yalnız yükselenleri kapsıyordu; artık 3 sıralık bir
 * PENCEREYE (4-5-6) terfi ediyor VE hem yükselen hem düşenleri kapsıyor.
 * faz2GucluKombinasyonTop3Garantisi'nden SONRA çalışır — o zaten güçlü (≥2 kod-garantili
 * sinyal) olanları ilk 3'e taşımış olur, burada kalan (0-1 sinyalli) trend atları işlenir.
 * "Analiz gücüne göre" sırala: aynı pencereye birden fazla nitelikli at girecekse, HÂLİHAZIR
 * teknikSira'sı (yani genel analiz sıralaması) daha iyi olan pencerenin önüne (4'e yakınına)
 * konur — mevcut sırası zaten o gücü yansıtıyor, yeni bir puanlama icat edilmiyor. "karar"
 * da (Orta/Yüksek Risk ise) en az "Düşük Risk"e yükseltilir (aksi halde hiyerarşi kuralı
 * terfiyi geri alır).
 */
export function faz2AgfTrend456Garantisi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): { atlar: TeknikSiraliAt[]; terfiler: KararHiyerarsiDegisikligi[] } {
  const trendliler = birlesikTrendListesi(faz1);
  if (trendliler.length === 0 || atlar.length <= 4) return { atlar, terfiler: [] };

  let calisma = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const terfiler: KararHiyerarsiDegisikligi[] = [];
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));
  // v6.96 — kullanıcı kararı 2026-08-10: "analiz gücü = hâlihazırdaki teknikSira" YANLIŞ
  // bir vekildi — bu fonksiyon zaten o teknikSira'yı DÜZELTMEYE çalışıyor, kendi ürettiği
  // hatalı sırayı "güç" sayıp kullanmak dairesel bir hataydı. Artık gerçek sinyal gücü
  // (gucluKodGarantiSayisi) kullanılıyor — en GÜÇLÜ sinyalli at pencereye EN SON eklenir
  // (4'e en yakın konumda kalır), 4-5-6 arası da böylece gerçek güce göre sıralanır.
  const nitelikliler = trendliler
    .map((t) => ({ t, at: calisma.find((a) => a.no === t.runnerNo) }))
    .filter((x): x is { t: TrendAt; at: TeknikSiraliAt } => !!x.at)
    .sort((a, b) => {
      const gucA = gucluKodGarantiSayisi(a.at.muhakeme, runnerByNo.get(a.at.no));
      const gucB = gucluKodGarantiSayisi(b.at.muhakeme, runnerByNo.get(b.at.no));
      if (gucA !== gucB) return gucA - gucB; // en güçlü EN SON (4'e en yakın kalır)
      return b.at.teknikSira - a.at.teknikSira; // eşitlikte: en geride olan önce terfi etsin
    });

  const terfiAdaylari = new Set<number>();
  for (const { t, at } of nitelikliler) {
    const idx = calisma.findIndex((a) => a.no === at.no);
    if (idx === -1 || idx < 6) continue; // koşmuyor (çekilmiş) ya da zaten ilk 6'da (Top3 dahil)
    const eskiSira = calisma[idx].teknikSira;
    const guncellenmisAt: TeknikSiraliAt = {
      ...calisma[idx],
      // v6.98 — kullanıcı bulgusu 2026-08-10 (Elazığ 8.Koşu, "12 atta Güçlü Aday"):
      // karar upgrade'i burada HERKESE uygulanıyordu — 3+ at aynı anda aday olunca
      // yalnız pencereye (4-6) gerçekten GİREN kalıyordu, kalanı 7./10./13. sıraya
      // itiliyordu ama "Düşük Risk" yükseltmesini yine de taşıyordu. Artık karar
      // burada DEĞİŞTİRİLMİYOR — yalnız GERÇEKTEN 4-6'da kalan(lar) aşağıda işaretlenir.
      muhakeme: `${calisma[idx].muhakeme} | [SİSTEM]:KOD-GARANTİSİ AGF trend (${t.yon}, ${t.fark >= 0 ? "+" : ""}${t.fark} puan) ile 4-6 aralığına terfi adayı (eski sıra ${eskiSira}) — gün içinde belirgin para hareketi.`,
    };
    const kalanlar = calisma.filter((a) => a.no !== at.no);
    calisma = [...kalanlar.slice(0, 3), guncellenmisAt, ...kalanlar.slice(3)];
    terfiler.push({ no: at.no, ad: at.ad, eskiSira, yeniSira: -1 }); // aşağıda gerçek son konumla düzeltilir
    terfiAdaylari.add(at.no);
  }
  if (terfiler.length === 0) return { atlar, terfiler: [] };

  // v6.98 — yalnız GERÇEKTEN 4-6 penceresinde kalan aday(lar) "Düşük Risk"e yükseltilir.
  calisma = calisma.map((a, i) =>
    i >= 3 && i < 6 && terfiAdaylari.has(a.no) && (a.karar === "Orta Risk" || a.karar === "Yüksek Risk")
      ? { ...a, karar: "Düşük Risk" }
      : a
  );

  const yeniAtlar = calisma.map((a, i) => ({ ...a, teknikSira: i + 1 }));
  // Her terfinin GERÇEK son konumu, üstteki döngüde sonraki terfiler yüzünden 4'ten 5/6'ya
  // kayabiliyor — audit log'da yanlış "4" göstermemek için burada nihai teknikSira'dan okunuyor.
  const sonKonumByNo = new Map(yeniAtlar.map((a) => [a.no, a.teknikSira]));
  const terfilerGercekKonumla = terfiler.map((t) => ({ ...t, yeniSira: sonKonumByNo.get(t.no) ?? t.yeniSira }));
  return { atlar: yeniAtlar, terfiler: terfilerGercekKonumla };
}

/**
 * v6.69 — kullanıcı kararı 2026-08-09 (TÜRKÖREN, İstanbul 3.Koşu: %43,79→%29,11, -14,68
 * puan düşüş, yine de kazandı): sahadaki GERÇEK AGF favorisi (en yüksek güncel AGF) gün
 * içinde belirgin şekilde DÜŞSE BİLE — hâlâ favori KALDIĞI sürece (başka bir at onu
 * geçmediyse) — piyasanın toplam parası hâlâ ondadır, düşüş bunu geçersiz kılmaz.
 *
 * ÖNEMLİ AYRIM (kullanıcıyla açıkça netleştirildi): bu, 2026-07-29'da REDDEDİLEN genel
 * "AGF top-3 kuralı"nın (ÇOKOMEL KIZ dersiyle geri alınmıştı — o zamanki kök neden AGF
 * sırası değil, gerekçesizlik idi) YENİDEN getirilmesi DEĞİL. O kural KOŞULSUZDU (her AGF
 * favorisi otomatik üst sıra). Bu kural DAR kapsamlı: yalnız (a) sahadaki GERÇEK/güncel
 * AGF lideri VE (b) o at AYRICA enCokDusenler listesindeyse (gerçek, anlamlı düşüş —
 * agf-trend.actions.ts'teki AYNI eşik) devreye girer. Sıradan bir AGF favorisi (düşmeyen)
 * bu fonksiyondan hiç etkilenmez — genel muhakemeye bırakılır, tıpkı 2026-07-29 kararında
 * olduğu gibi.
 */
export function faz2AgfFavorisiDususeRagmenGarantisi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): { atlar: TeknikSiraliAt[]; terfiler: KararHiyerarsiDegisikligi[] } {
  const dusenler = faz1.race.enCokDusenler ?? [];
  if (dusenler.length === 0 || atlar.length <= 3) return { atlar, terfiler: [] };

  const agfliAtlar = faz1.runners.filter((r) => !r.scratched && r.agf != null);
  if (agfliAtlar.length === 0) return { atlar, terfiler: [] };
  const favori = agfliAtlar.reduce((a, b) => (b.agf! > a.agf! ? b : a));

  const favoriDusuyorMu = dusenler.some((d) => d.runnerNo === favori.no);
  if (!favoriDusuyorMu) return { atlar, terfiler: [] };

  const calisma = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const idx = calisma.findIndex((a) => a.no === favori.no);
  if (idx === -1 || idx < 3) return { atlar, terfiler: [] }; // koşmuyor ya da zaten ilk 3'te
  if (calisma[idx].karar === "Yüksek Risk") return { atlar, terfiler: [] };

  const eskiSira = calisma[idx].teknikSira;
  const dususFarki = dusenler.find((d) => d.runnerNo === favori.no)!.fark;
  const guncellenmisAt: TeknikSiraliAt = {
    ...calisma[idx],
    karar: "Güçlü Aday",
    muhakeme: `${calisma[idx].muhakeme} | [SİSTEM]:KOD-GARANTİSİ sahadaki AGF lideri, gün içinde düşüşe rağmen (${dususFarki.toFixed(2)} puan) hâlâ favori — ilk 3'e terfi (eski sıra ${eskiSira} → 3) — piyasanın toplam parası hâlâ bu atta (TÜRKÖREN dersi, 2026-08-09).`,
  };
  const kalanlar = calisma.filter((a) => a.no !== favori.no);
  const yeniSiraliListe = [...kalanlar.slice(0, 2), guncellenmisAt, ...kalanlar.slice(2)];
  const terfiler: KararHiyerarsiDegisikligi[] = [{ no: favori.no, ad: favori.ad, eskiSira, yeniSira: 3 }];

  const yeniAtlar = yeniSiraliListe.map((a, i) => ({ ...a, teknikSira: i + 1 }));
  return { atlar: yeniAtlar, terfiler };
}

/**
 * v6.100 — kullanıcı kararı 2026-08-10 (CEVATHAN + CANYAMAN, iki ayrı gerçek kazanan,
 * ikisi de sahadaki AGF'ye göre 3. ama sistemde 8. sıraya düşürülmüştü, "artık bu atlar
 * geriye atılmasın" talebi): geriye dönük doğrulama (n=66, Haziran-Ağustos, çok tarihli)
 * — sahadaki GÜNCEL AGF'ye göre top-3'te olan ama sistemde >=7. sıraya düşürülen atların
 * galibiyet oranı %15.2, ilk-3 oranı %37.9. Kontrol grubu (tüm >=7. sıradakiler, n=1036):
 * %3.9 galibiyet, %13.0 ilk-3. Yani bu grup kontrol grubunun 3-4 katı isabetli.
 *
 * ÖNEMLİ AYRIM (2026-07-29 ÇOKOMEL KIZ dersiyle ÇELİŞMİYOR): o zamanki genel "AGF top-3"
 * kuralı atları HİÇ analiz etmeden (details boş) mekanik puanla geçiştiriyordu — kök neden
 * gerekçesizlikti. CEVATHAN/CANYAMAN'da sorun bu değildi: ikisi de tam muhakeme edilmişti
 * (8-9 satır), yalnız NİHAİ sıralama adımı kanıtlanmış güçlü bir piyasa sinyalini yeterince
 * ağırlıklandırmadı. Bu fonksiyon faz2AgfTrend456Garantisi ile AYNI mimaride (analiz
 * SONRASI çalışan bir terfi/taban kuralı, 4-6 penceresine) çalışır — analiz zorunluluğunu
 * bypass etmez, Claude'un elindeki veriyi yok saymaz.
 *
 * faz2AgfFavorisiDususeRagmenGarantisi'nden (yalnız sahadaki #1 AGF lideri, VE düşüş şartı
 * var) FARKLI: burada güncel AGF'ye göre ilk-3'teki HERHANGİ bir at kapsanır, düşüş şartı
 * YOK — statik sıranın kendisi yukarıdaki n=66 doğrulamasıyla yeterli kanıt sayıldı.
 */
export function faz2AgfStatikTop3Garantisi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): { atlar: TeknikSiraliAt[]; terfiler: KararHiyerarsiDegisikligi[] } {
  if (atlar.length <= 4) return { atlar, terfiler: [] };

  const agfliAtlar = faz1.runners.filter((r) => !r.scratched && r.agf != null);
  if (agfliAtlar.length < 3) return { atlar, terfiler: [] };
  const agfTop3 = [...agfliAtlar].sort((a, b) => b.agf! - a.agf!).slice(0, 3);

  let calisma = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const terfiler: KararHiyerarsiDegisikligi[] = [];
  const runnerByNo = new Map(faz1.runners.map((r) => [r.no, r]));

  // Aynı öncelik mantığı: en güçlü kod-garantili sinyali olan aday EN SON işlenir
  // (4'e en yakın konumda kalır) — bkz. faz2AgfTrend456Garantisi'ndeki v6.96 dersi.
  const nitelikliler = agfTop3
    .map((r) => ({ r, at: calisma.find((a) => a.no === r.no) }))
    .filter((x): x is { r: Faz1Runner; at: TeknikSiraliAt } => !!x.at)
    .sort((a, b) => {
      const gucA = gucluKodGarantiSayisi(a.at.muhakeme, runnerByNo.get(a.at.no));
      const gucB = gucluKodGarantiSayisi(b.at.muhakeme, runnerByNo.get(b.at.no));
      if (gucA !== gucB) return gucA - gucB;
      return b.at.teknikSira - a.at.teknikSira;
    });

  const terfiAdaylari = new Set<number>();
  for (const { r, at } of nitelikliler) {
    const idx = calisma.findIndex((a) => a.no === at.no);
    if (idx === -1 || idx < 6) continue; // koşmuyor ya da zaten ilk 6'da
    const eskiSira = calisma[idx].teknikSira;
    const agfSira = agfTop3.findIndex((x) => x.no === r.no) + 1;
    const guncellenmisAt: TeknikSiraliAt = {
      ...calisma[idx],
      muhakeme: `${calisma[idx].muhakeme} | [SİSTEM]:KOD-GARANTİSİ sahadaki güncel AGF sırası ${agfSira} (top-3) — geriye dönük doğrulamada bu grup %15.2 galibiyet/%37.9 ilk-3 taşıyor, kontrol grubu %3.9/%13.0 (n=66, 2026-08-10) — 4-6 aralığına terfi adayı (eski sıra ${eskiSira}).`,
    };
    const kalanlar = calisma.filter((a) => a.no !== at.no);
    calisma = [...kalanlar.slice(0, 3), guncellenmisAt, ...kalanlar.slice(3)];
    terfiler.push({ no: at.no, ad: at.ad, eskiSira, yeniSira: -1 });
    terfiAdaylari.add(at.no);
  }
  if (terfiler.length === 0) return { atlar, terfiler: [] };

  calisma = calisma.map((a, i) =>
    i >= 3 && i < 6 && terfiAdaylari.has(a.no) && (a.karar === "Orta Risk" || a.karar === "Yüksek Risk")
      ? { ...a, karar: "Düşük Risk" }
      : a
  );

  const yeniAtlar = calisma.map((a, i) => ({ ...a, teknikSira: i + 1 }));
  const sonKonumByNo = new Map(yeniAtlar.map((a) => [a.no, a.teknikSira]));
  const terfilerGercekKonumla = terfiler.map((t) => ({ ...t, yeniSira: sonKonumByNo.get(t.no) ?? t.yeniSira }));
  return { atlar: yeniAtlar, terfiler: terfilerGercekKonumla };
}

/**
 * v6.101 — kullanıcı kararı 2026-08-10 ("bu atları ilk sırada görebileceğimiz sistem nasıl
 * olmalı, neyi gözden kaçırıyoruz"): sistemin kendi 1.sırası ile sahadaki AGF liderinin
 * FARKLI olduğu 104 geçmiş yarış tek tek incelendi. Sonuç çok net:
 *   - Sistemin 1.sıraya koyduğu at AGF top-3 İÇİNDEYSE (AGF lideri olmasa bile #2/#3):
 *     galibiyet oranı %30.0 (n=70).
 *   - AGF top-3 DIŞINDAN bir atı 1.sıraya koyduysa: galibiyet oranı yalnız %5.9 (n=34).
 * Yani sistemin AGF top-3'ün TAMAMEN dışına çıkarak 1.sıra vermesi neredeyse hiç
 * doğrulanmıyor — buna karşın top-3 İÇİNDE hangi atın öne çıkacağına dair sistemin kendi
 * analiz sırası zaten anlamlı bilgi taşıyor (o yüzden bu fonksiyon AGF liderini KÖRÜ
 * KÖRÜNE dayatmaz, yalnız 1.sırayı AGF top-3 KÜMESİNE sabitler — hangi üçünün öne
 * çıkacağına sistemin kendi teknikSira'sı karar verir).
 *
 * ÇOKOMEL KIZ/"sert koşul yasağı" ile ÇELİŞMEZ: Claude'un HİÇBİR veriyi analiz etmesi
 * engellenmiyor, saha yine tam muhakeme ediliyor — yalnız NİHAİ 1.sıra konumu, yukarıdaki
 * n=104 doğrulamasıyla desteklenen dar bir taban kuralına bağlanıyor. Adayların hepsi
 * "Yüksek Risk" ise (aşırı uç durum) dokunulmaz, mevcut 1.sıra korunur.
 */
export function faz2IlkSiraAgfTop3Sinirlamasi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): { atlar: TeknikSiraliAt[]; terfiler: KararHiyerarsiDegisikligi[] } {
  if (atlar.length <= 3) return { atlar, terfiler: [] };

  const agfliAtlar = faz1.runners.filter((r) => !r.scratched && r.agf != null);
  if (agfliAtlar.length < 3) return { atlar, terfiler: [] };
  const agfTop3Nos = new Set([...agfliAtlar].sort((a, b) => b.agf! - a.agf!).slice(0, 3).map((r) => r.no));

  const calisma = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira);
  const birinci = calisma[0];
  if (agfTop3Nos.has(birinci.no)) return { atlar, terfiler: [] }; // zaten AGF top-3, dokunma

  // Sistemin KENDİ sırasına göre en önde olan (Yüksek Risk olmayan) AGF top-3 adayı —
  // AGF lideri KÖRÜ KÖRÜNE dayatılmıyor, hangi üçünün öne çıkacağına sistemin analizi karar verir.
  const aday = calisma.find((a) => agfTop3Nos.has(a.no) && a.karar !== "Yüksek Risk");
  if (!aday) return { atlar, terfiler: [] }; // hepsi Yüksek Risk ise dokunma

  // v6.102 — kullanıcı bulgusu 2026-08-11 ("Arnavutkız gibi atların ilk 3'e girememesine
  // sebep olmamalı"): İLK versiyon adayı çıkarıp listenin BAŞINA ekliyordu ([aday, ...kalanlar])
  // — bu, arada kalan HERKESİ bir pozisyon geriye itiyordu, yani aday 4.sıradan geliyorsa
  // 3.sıradaki (AGF top-3 ile hiç ilgisi olmayan, gerçekten hak ederek orada olan) bir at
  // sessizce 4.sıraya düşüyordu. Artık yalnız İKİ atın yeri DEĞİŞTİRİLİYOR (aday <-> eski
  // 1.sıra) — 2. ve 3. sıradaki atlar (aday tam onların arasından gelmediği sürece)
  // KESİNLİKLE yerinden oynamıyor. Bu, "AGF top-3'ü öne çıkar" ile "piyasanın göremediğini
  // gören değerli atları asla top-3 dışına itme" ilkelerinin ikisini birden karşılıyor.
  const adayIdx = calisma.findIndex((a) => a.no === aday.no);
  const guncellenmisAday: TeknikSiraliAt = {
    ...aday,
    karar: "Güçlü Aday",
    muhakeme: `${aday.muhakeme} | [SİSTEM]:KOD-GARANTİSİ AGF top-3 içindeki en güçlü aday, 1. sıraya terfi (yalnız 1.sıra ile yer değişti, aradaki atlar yerinden oynamadı) — geriye dönük doğrulama: sistemin AGF top-3 dışından seçtiği #1 adaylar yalnız %5.9 kazanıyor, top-3 içinden seçilenler %30.0 (n=104, 2026-08-10).`,
  };
  const yeniSiraliListe = [...calisma];
  yeniSiraliListe[0] = guncellenmisAday;
  yeniSiraliListe[adayIdx] = birinci; // eski 1.sıra, adayın boşalttığı tek pozisyona geçer
  const terfiler: KararHiyerarsiDegisikligi[] = [{ no: aday.no, ad: aday.ad, eskiSira: aday.teknikSira, yeniSira: 1 }];

  const yeniAtlar = yeniSiraliListe.map((a, i) => ({ ...a, teknikSira: i + 1 }));
  return { atlar: yeniAtlar, terfiler };
}

export type IlkSiraAgfTop3DenetimSonuc = { gecti: boolean; not: string };

/**
 * v6.101 — kullanıcı talebi 2026-08-11: "her düzeltmeyi Claude'un uygulayacağından emin
 * olacağımız bir script/kod var mı" — faz2IlkSiraAgfTop3Sinirlamasi zaten KOŞULSUZ çalışan
 * kod (Claude'un onayına bağlı değil), ama bunu her analizde GÖZLE de teyit edebilmek için
 * ayrı, salt-okunur bir denetim: pipeline'ın TÜM terfi adımları bittikten SONRA, nihai
 * 1.sıradaki atın gerçekten AGF top-3 içinde olup olmadığını yeniden kontrol eder. Ek
 * Claude çağrısı yok, tamamen mekanik — asıl amacı, ileride pipeline sırası değişirse/bir
 * adım yanlışlıkla silinirse bunu admin panelinde görünür kılmak (bugünkü koddan bağımsız
 * bir ikinci doğrulama katmanı).
 */
export function faz2IlkSiraAgfTop3Denetimi(
  atlar: TeknikSiraliAt[],
  faz1: Faz1Sonuc
): IlkSiraAgfTop3DenetimSonuc {
  if (atlar.length <= 3) return { gecti: true, not: "Sahada 3 veya daha az at var, denetim uygulanmıyor." };

  const agfliAtlar = faz1.runners.filter((r) => !r.scratched && r.agf != null);
  if (agfliAtlar.length < 3) return { gecti: true, not: "AGF verisi yetersiz, denetim uygulanamadı." };
  const agfTop3 = [...agfliAtlar].sort((a, b) => b.agf! - a.agf!).slice(0, 3);
  const agfTop3Nos = new Set(agfTop3.map((r) => r.no));

  const birinci = [...atlar].sort((a, b) => a.teknikSira - b.teknikSira)[0];
  if (!birinci) return { gecti: true, not: "Sıralanmış at yok." };

  if (agfTop3Nos.has(birinci.no)) {
    return { gecti: true, not: `✓ 1.sıra #${birinci.no} ${birinci.ad}, sahadaki AGF top-3 içinde.` };
  }
  const top3Ozet = agfTop3.map((r) => `#${r.no}(AGF ${r.agf})`).join(", ");
  return {
    gecti: false,
    not: `✗ 1.sıra #${birinci.no} ${birinci.ad}, AGF top-3 (${top3Ozet}) DIŞINDA kalmış — faz2IlkSiraAgfTop3Sinirlamasi çalışmamış olabilir, pipeline'ı kontrol edin.`,
  };
}

/**
 * 2026-08-13 — DÜZELTME: bu fonksiyon eskiden `r.jockeyChanged` (ham Runner.jockeyChanged
 * DB sütunu) okuyordu — canlı veride bu sütun neredeyse HİÇ dolmuyor (43.573 kayıttan
 * yalnız 55'i true), yani eski kod fiilen HER ata (ilkStart hariç) bu "destek" notunu
 * veriyordu, ayırt edici hiçbir bilgi taşımıyordu. Doğru kaynak `sonYarisAyniJokey`
 * (getSonYarisDetaylariForRace → TJK canlı geçmişinden soyadı bazlı karşılaştırma,
 * son-yaris-detay.actions.ts) — Faz1Runner'da zaten hesaplanıyordu ama bu fonksiyon
 * kullanmıyordu. Geriye dönük doğrulama (n=6.166, HorseRaceHistoryCache üzerinden, aynı
 * mantıkla): aynı jokey %13.4 galibiyet/%39.2 ilk3, jokey değişti %9.4/%28.4.
 */
export function faz2AyniJokeyEtiketiEkle(
  muhakeme: string,
  r: { sonYarisAyniJokey: boolean | null; ilkStart: boolean }
): string {
  if (r.ilkStart || r.sonYarisAyniJokey !== true) return muhakeme;
  if (halihazirdaTemizDestekVarMi(muhakeme, "V4")) return muhakeme;
  return `${muhakeme} | [V4]:destek(KOD-GARANTİSİ: son yarışını aynı jokeyle koştu — geriye dönük doğrulama %13.4 galibiyet/%39.2 ilk3 vs jokey değişti %9.4/%28.4, n=6.166, 2026-08-13)`;
}

/**
 * v6.63 — kullanıcı bulgusu 2026-08-05 (ANSHBA SKY): Maiden koşularda atların kendi
 * yarış geçmişi yok, pedigri (V1) neredeyse TEK objektif sinyal — ANSHBA SKY'nin
 * babası (NATIVE KHAN, 50 start %28, sahadaki EN İYİ pedigri istatistiği) muhakemede
 * hiç geçmemişti, at 4. sıraya düşürüldü ve kazandı. Aygırın kazanma yüzdesi
 * (sireKazanmaOrani) zaten hesaplanıyor — sahadaki EN İYİ (ve gerçek örneklemli, n≥20)
 * pedigriye sahip atlar için garantili ekleniyor.
 */
export function faz2PedigriKarsilastirmaEtiketiEkle(
  muhakeme: string,
  r: { sireKazanmaOrani: number | null; sireOrneklemKendiVeri: number | null },
  sahaEnIyiKYuzde: number | null
): string {
  if (r.sireKazanmaOrani == null || r.sireOrneklemKendiVeri == null) return muhakeme;
  if (r.sireOrneklemKendiVeri < 20) return muhakeme;
  if (sahaEnIyiKYuzde == null || r.sireKazanmaOrani < sahaEnIyiKYuzde) return muhakeme;
  if (halihazirdaTemizDestekVarMi(muhakeme, "V1")) return muhakeme;
  return `${muhakeme} | [V1]:destek(KOD-GARANTİSİ: aygırın sahadaki EN İYİ kazanma yüzdesi — %${r.sireKazanmaOrani}(n=${r.sireOrneklemKendiVeri}, gerçek örneklem))`;
}

/**
 * v6.65 — kullanıcı bulgusu 2026-08-05 (ARASİNKO): form dizisinin TAMAMI (V19'un
 * "hangi kiloda alındı" senteziyle) sentez gerektirir, kod tarafından hesaplanamaz —
 * ama "en son yarışını kazandı mı" tek başına objektif/basit bir gerçek (form
 * dizisinin en SAĞ karakteri — soldan sağa eskiden yeniye, bkz. formYonu yorumu).
 * ARASİNKO'nun formu "11" (son 2 yarışını da kazanmış) hiç muhakemede geçmemişti —
 * kullanıcı talebi: "kaçırmaması için güvenlik önlemi al hemen kalıcı olarak".
 * Yalnız EN SON yarışın kazanılıp kazanılmadığını garanti eder — daha geniş form
 * yorumu (kaç yarış, hangi kiloda) hâlâ Claude'un muhakemesinde kalır.
 */
/** Form dizisinin en SAĞ karakteri "1" mi (son yarış kazanıldı mı) — faz2SonYarisKazandiEtiketiEkle
 *  VE altiSinyalSayisi (4+ sinyal yığını) tarafından paylaşılan TEK parse mantığı. */
export function sonYarisKazandiMi(recentForm: string | null): boolean {
  if (!recentForm) return false;
  const chars = recentForm.split("").filter((c) => /[\dK]/i.test(c));
  return chars.at(-1) === "1";
}

export function faz2SonYarisKazandiEtiketiEkle(
  muhakeme: string,
  r: { recentForm: string | null }
): string {
  if (!sonYarisKazandiMi(r.recentForm)) return muhakeme;
  if (halihazirdaTemizDestekVarMi(muhakeme, "V19")) return muhakeme;
  return `${muhakeme} | [V19]:destek(KOD-GARANTİSİ: son yarışını kazandı — form dizisi ${r.recentForm})`;
}

// V5 (halihazirdaTemizDestekVarMi'den farklı): Claude "destek/nötr/risk" hangi yönde
// karar verirse versin, bir kez bahsetmişse yeterli — yalnız TAMAMEN SESSİZ kalmayı
// engelliyoruz, yönü zorlamıyoruz (H2H "zayıf kanıt", yön kararı Claude'a bırakılır).
function halihazirdaHerhangiBirEtiketVarMi(muhakeme: string, kodDeseni: string): boolean {
  return new RegExp(`\\[${kodDeseni}\\]:`, "i").test(muhakeme);
}

/**
 * v6.68 — kullanıcı kararı 2026-08-08 (ATLI FIRTINA/KASIRGA AĞASI dersi, "her analizin
 * eksiksiz yapılmasını istedim... sistem kontrol etsin diye para ödüyorum"): rank 1-2
 * için "Kullanılmayan Veri" hard-gate'i yalnız BİLDİRİYORDU, admin manuel ekliyordu — bu
 * artık yetersiz. h2hOzet'in kendisi zaten "bugünkü rakiplerden biriyle geçmiş
 * karşılaşma" GARANTİSİ taşır (getH2HForRace yalnız bugünün atları arasında ortak geçmiş
 * yarış varsa döner) — bu yüzden var olduğunda ASLA sessiz kalınamaz, koda gömülü.
 */
export function faz2H2HEtiketiEkle(muhakeme: string, r: { h2hOzet: string | null }): string {
  if (!r.h2hOzet) return muhakeme;
  if (halihazirdaHerhangiBirEtiketVarMi(muhakeme, "V5")) return muhakeme;
  return `${muhakeme} | [V5]:nötr(KOD-GARANTİSİ: bugünün rakiplerinden biriyle geçmiş karşılaşma var — ${r.h2hOzet})`;
}

/**
 * v6.68 — aynı ders: zeminGecmisiOzet'teki "[BU ZEMİN SINIFINDA KAZANDI]" etiketi
 * (bugünküyle eşleşen zemin durumunda geçmiş galibiyet) somut, ölçülebilir bir olumlu
 * sinyal — hiç bahsedilmeden geçilemez.
 */
export function faz2ZeminKazanmaEtiketiEkle(muhakeme: string, r: { zeminGecmisiOzet: string | null }): string {
  if (!r.zeminGecmisiOzet?.includes("[BU ZEMİN SINIFINDA KAZANDI]")) return muhakeme;
  if (halihazirdaTemizDestekVarMi(muhakeme, "V22")) return muhakeme;
  return `${muhakeme} | [V22]:destek(KOD-GARANTİSİ: bugünküyle eşleşen zemin sınıfında kazanmış geçmişi var)`;
}

// v6.87 — v6.86'nın V3 kod-garantisi (takı değişikliği = her zaman destek) kaldırıldı
// (bkz. test-v2-engine/route.ts çağrı noktası yorumu) — SHADOW MASTER örneği tek koşuda
// çürüttü, "çoklu değişim = belirsizlik" notuyla da çelişiyordu. V3 rehberliği (yön fark
// etmez, ikisi de olumlu) V_LEGEND metninde Claude'un muhakemesine bırakılmış durumda,
// artık koda zorla enjekte edilmiyor. 3-5 sonuçlanmış koşuda tutarlı çıkarsa geri gelir.

export function kosuBaslikUret(faz1: Faz1Sonuc, izinliKodlar: string[]): string {
  // v6.61 — kullanıcı bulgusu 2026-08-05: raceStyleEtiket gerçek değeri "Kaçak At"
  // (Türkçe görünen etiket) DEĞİL, ham enum "KACAK_AT" — bu karşılaştırma HER ZAMAN
  // false dönüyordu, yani Claude'a gönderilen "Kaçak sayısı" başlık satırı gerçek
  // sahadan bağımsız olarak her koşuda 0 gösteriliyordu. Aynı hata test-v2-engine/
  // route.ts'te de vardı, orada da düzeltildi.
  const kacakSayisi = faz1.runners.filter((r) => r.raceStyleEtiket === "KACAK_AT").length;
  const izin = new Set(izinliKodlar);
  const satirlar = [
    `## KOŞU`,
    `${faz1.race.hippodromeName} — ${faz1.race.raceNo}.Koşu | ${faz1.race.classType} | ${faz1.race.breed} | ${faz1.race.distance}m ${faz1.race.surface} | ${faz1.runners.length} at | Kaçak sayısı: ${kacakSayisi}`,
    `Zemin (bugün): ${faz1.race.zeminEtiketi}${faz1.race.zeminDetayi ? ` (${faz1.race.zeminDetayi})` : ""}`,
  ];
  if (izin.has("V11") && faz1.race.sonDuzlukUzunlugu) satirlar.push(`V11 Son Düzlük: ${faz1.race.sonDuzlukUzunlugu}`);
  if (izin.has("V12") && faz1.race.pistMesafeStilOzeti) satirlar.push(`V12 Bu Koşu Tipinde Kazananlar: ${faz1.race.pistMesafeStilOzeti}`);
  return satirlar.join("\n");
}
