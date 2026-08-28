/**
 * 2026-08-24 kullanıcı talebi: /admin dashboard'daki "Analiz Motoru Versiyon Karşılaştırması"
 * bölümü kaldırılıp yerine bu geldi — "sinyalleri burda takip edicez başarılarını". ENGINE_
 * VERSIONS ile AYNI desen: elle bakımı yapılan, koşu ekibinin (biz) her yeni eğitimde
 * güncellediği bir referans kütüğü — canlı sorgu değil, model her yeniden eğitildiğinde
 * (arac-model-egit-segment.mjs çıktısından) buradaki katsayı/GA/anlamlılık elle senkronize
 * edilmeli. GERÇEK (yayınlanmış tahminlerdeki fiili kazanma oranı) tarafı ayrı bir mekanizma:
 * v5-sinyal-performans.service.ts — bu ikisi kasıtlı ayrı tutuluyor (biri modelin kendi
 * iddiası/katsayısı, diğeri sahadaki gerçek sonuç).
 *
 * 2026-08-27 kullanıcı denetimi ("her sinyale bak, önce iyi dediğin kötü çıkıyor"):
 * B=50 bootstrap sınırda sinyallerde (nokta ~0.1-0.2) run-to-run kararsız sonuç
 * üretebiliyordu (aynı veriyle bazen anlamlı, bazen sıfırı içeriyor). Kalıcı eğitim
 * araçlarının (arac-model-egit-segment.mjs/arac-model-egit.mjs) varsayılan bootstrap'ı
 * B=500'e çıkarıldı — bu dosyadaki durum alanları o denetimin sonucunu yansıtıyor.
 * Not: B=500'de bile bazı sinyaller (accurace/idmJokey, düşük-şart) tam kararlı değil —
 * bunun sebebi bootstrap sayısı değil örneklem büyüklüğü (n=254); daha fazla bootstrap
 * var olan veriden daha fazla bilgi çıkaramaz, yalnız o veriden GA'yı daha hassas tahmin
 * eder. Bu sinyaller veri arttıkça yeniden değerlendirilmeli.
 */

export type SinyalAnlamlilik = "anlamli" | "sinirda" | "anlamsiz" | "override" | "veri-yok";

export type CanliSinyal = {
  ad: string;
  kod: string;
  dusukSart: { katsayi: number; durum: SinyalAnlamlilik; not?: string };
  diger: { katsayi: number; durum: SinyalAnlamlilik; not?: string };
  aciklama: string;
};

export const CANLI_SINYALLER: CanliSinyal[] = [
  { ad: "AGF Sırası", kod: "agfSirasi", dusukSart: { katsayi: -0.431, durum: "anlamli" }, diger: { katsayi: -0.427, durum: "anlamli" }, aciklama: "Her iki segmentte de en güvenilir sinyallerden biri — piyasa favoriliği." },
  { ad: "AGF Payı", kod: "agfPayi", dusukSart: { katsayi: 0.227, durum: "anlamli" }, diger: { katsayi: 0.257, durum: "anlamli" }, aciklama: "agfSirasi'ndan bağımsız: sıralamadan çok kalabalıktan ne kadar öne çıktığı." },
  { ad: "Hız Derecesi", kod: "hizDerecesi", dusukSart: { katsayi: 0.563, durum: "anlamli" }, diger: { katsayi: 0.266, durum: "anlamli", not: "Handikap'ta elle 0'a sabitlendi (V5.10)" }, aciklama: "Son 365 gün, popülasyon ortalamasına göre göreli hız. Handikap kategorisinde katkısı istatistiksel olarak sıfır bulunduğu için override edildi." },
  { ad: "Antrenör Oranı", kod: "antrenorOrani", dusukSart: { katsayi: 0.357, durum: "anlamli" }, diger: { katsayi: 0.247, durum: "anlamli" }, aciklama: "Düşük-şartta belirgin daha ağır basıyor." },
  { ad: "Accurace", kod: "accurace", dusukSart: { katsayi: 0.137, durum: "sinirda", not: "2026-08-27 B=500 denetimi: GA sıfıra çok yakın (~-0.006/+0.27), çalıştırmalar arası kararsız — n=254 örneklem sınırı, daha fazla bootstrap değil daha fazla veri gerektiriyor" }, diger: { katsayi: 0.006, durum: "anlamsiz" }, aciklama: "Son yarışta sahanın en hızlı son 200m kapanışı." },
  { ad: "İdman Jokeyi Uyumu", kod: "idmJokey", dusukSart: { katsayi: 0.172, durum: "sinirda", not: "2026-08-27 B=500 denetimi: aynı kararsızlık (GA sıfıra çok yakın, çalıştırmalar arası değişiyor) — n=254 örneklem sınırı" }, diger: { katsayi: 0.094, durum: "anlamsiz" }, aciklama: "Yarıştıracak jokey, atın idmanlarından birini yaptırmış mı." },
  { ad: "Jokey Oranı", kod: "jokeyOrani", dusukSart: { katsayi: 0.221, durum: "anlamli" }, diger: { katsayi: 0.116, durum: "anlamli" }, aciklama: "Jokeyin genel kazanma yüzdesi." },
  { ad: "Rakipsiz Kaçak At", kod: "kacakYalniz", dusukSart: { katsayi: 0.145, durum: "anlamli", not: "2026-08-27 B=500 ile doğrulandı (GA=[0.004,0.267], bootstrap örneklerinin %98.2'si pozitif) — B=150'de bir ara sıfırı içeriyordu, saf örnekleme gürültüsüydü" }, diger: { katsayi: 0.057, durum: "sinirda" }, aciklama: "Accurace tabanlı erken-tempo profili — 2026-08-26'dan itibaren yalnız SAHADA TEK kaçak-at olma durumunda sayılıyor (rakipli kaçak olmanın avantajı yok, derinlemesine backtest'te saha büyüklüğü sabit tutularak doğrulandı)." },
  { ad: "AGF Düşüşü Var Mı", kod: "agfDususVarMi", dusukSart: { katsayi: 0.129, durum: "anlamli" }, diger: { katsayi: 0.051, durum: "anlamsiz" }, aciklama: "Eşik-üstü (≥1.0 puan) AGF düşüşü — para akışı sinyali." },
  { ad: "Kilo-Ayarlı H2H", kod: "h2hKiloDegisimi", dusukSart: { katsayi: 0.076, durum: "sinirda", not: "2026-08-27 akşam retrain (1042 yarış, agfPayi2 eklenirken): GA=[-0.125,0.285], hâlâ sıfırı içeriyor" }, diger: { katsayi: 0.073, durum: "anlamli", not: "2026-08-27 akşam retrain (1042 yarış): artık GA=[0.011,0.166], sıfırı DIŞLIYOR — veri arttıkça 'sınırda'dan 'anlamlı'ya yükseldi" }, aciklama: "Bugünkü rakiplere göre kilo pozisyonunun geçmiş karşılaşmaya göre değişimi." },
  { ad: "AGF Payı² (kare terimi)", kod: "agfPayi2", dusukSart: { katsayi: -0.214, durum: "sinirda", not: "2026-08-27 B=500: GA=[-0.490,0.018], sıfıra çok yakın" }, diger: { katsayi: -0.207, durum: "anlamli", not: "2026-08-27 B=500: GA=[-0.377,-0.041]. Piyasa kalibrasyon kontrolü: %40+ AGF payılı güçlü favoriler gerçek kazanma oranından -4.1 puan geride (piyasa fazla seviyor), AGF sırası 4-5 orta sıradaki atlar +2.1/+2.5 puan önde (piyasa hafife alıyor) — doğrusal olmayan kalıp. Kare terim eklenince top3 %64.8→%65.3, logloss iyileşti." }, aciklama: "AGF payının doğrusal-olmayan (kare) terimi — formEgimi²/kgs² ile aynı desen, güçlü favorilerin piyasada fazla değerli görülmesini düzeltir." },
  { ad: "H2H Net Skor", kod: "h2hNetSkor", dusukSart: { katsayi: 0, durum: "override", not: "Ham değer ters yönlüydü, elle sıfırlandı" }, diger: { katsayi: 0.115, durum: "anlamli" }, aciklama: "Baş-başa geçmiş karşılaşmalarda net galibiyet farkı." },
  { ad: "Kısa Galop Aralığı Var Mı", kod: "kgsVarMi", dusukSart: { katsayi: -0.033, durum: "anlamsiz" }, diger: { katsayi: 0.145, durum: "anlamli" }, aciklama: "14-30 gün aralığı — yalnız diğer segmentte anlamlı." },
  { ad: "AGF Yükselişi Var Mı", kod: "agfYukselisVarMi", dusukSart: { katsayi: 0.119, durum: "anlamsiz" }, diger: { katsayi: 0.08, durum: "anlamsiz" }, aciklama: "agfDususVarMi ile simetrik eşik sinyali." },
  { ad: "Aygır Kazanma Oranı", kod: "sireOrani", dusukSart: { katsayi: 0.065, durum: "anlamsiz" }, diger: { katsayi: 0.027, durum: "anlamsiz" }, aciklama: "Pedigri sinyali — düşük-şartta nokta tahmini büyük ama kanıtlanamıyor." },
  { ad: "Form Eğimi²", kod: "formEgimi2", dusukSart: { katsayi: 0.088, durum: "anlamsiz" }, diger: { katsayi: -0.047, durum: "anlamsiz" }, aciklama: "Form eğiminin doğrusal-olmayan (kare) terimi." },
  { ad: "KGS²", kod: "kgs2", dusukSart: { katsayi: -0.018, durum: "anlamsiz" }, diger: { katsayi: 0.082, durum: "anlamsiz" }, aciklama: "Gün aralığının kare terimi." },
  { ad: "Kısa Galop Aralığı", kod: "kgs", dusukSart: { katsayi: 0.059, durum: "anlamsiz" }, diger: { katsayi: -0.12, durum: "anlamsiz" }, aciklama: "Ham gün-aralığı değeri." },
  { ad: "Uzun Ara Galop Katkısı", kod: "uzunAraGalopKatkisi", dusukSart: { katsayi: -0.068, durum: "anlamsiz" }, diger: { katsayi: 0.019, durum: "anlamsiz" }, aciklama: "Uzun süre koşmayan ama düzenli idman yapan atlar için katkı." },
  { ad: "Galop", kod: "galop", dusukSart: { katsayi: -0.079, durum: "anlamsiz" }, diger: { katsayi: 0.047, durum: "anlamsiz" }, aciklama: "Keskin galop zinciri — düşük-şartta yön TERS, ikisi de anlamsız." },
  { ad: "Form Eğimi", kod: "formEgimi", dusukSart: { katsayi: -0.096, durum: "anlamsiz" }, diger: { katsayi: 0.018, durum: "anlamsiz" }, aciklama: "Son starların bitiş sırası eğimi." },
  { ad: "Pist Uzmanı", kod: "pistUzmani", dusukSart: { katsayi: 0, durum: "veri-yok" }, diger: { katsayi: 0.012, durum: "anlamsiz" }, aciklama: "Bugünkü pist+mesafede geçmiş galibiyet." },
  // 2026-08-28 — KURAL İSTİSNASI: bu sinyal B=500 testinde İKİ KEZ (2026-08-23 ve
  // 2026-08-28) anlamsız çıktı ama kullanıcı, sonucu bilerek (AskUserQuestion ile teyit
  // edilerek) modele eklenmesini istedi. "Önce backtest, iyi çıkmazsa ekleme" standart
  // kuralının açık bir istisnası — diğer tüm satırlardan farklı olarak.
  { ad: "Zemin Toleransı (İSTİSNA — anlamsız test sonucuna rağmen eklendi)", kod: "zeminToleransi", dusukSart: { katsayi: -0.002, durum: "anlamsiz", not: "2026-08-28 B=500/n=1059: GA=[-0.114,0.207]. Kullanıcı kararıyla yine de eklendi." }, diger: { katsayi: 0.001, durum: "anlamsiz", not: "2026-08-28 B=500/n=1059: GA=[-0.077,0.105]. Kullanıcı kararıyla yine de eklendi." }, aciklama: "Atın Normal-dışı (ıslak/ağır/yumuşak) pistteki geçmiş göreli performansı (TjkDereceKaydi arşivi). At-bazlı gerçek/tekrarlanabilir bir özellik (split-half r=0.467) ama V5'in tahmin doğruluğuna ölçülebilir katkısı yok." },
];

export type SiralamaKurali = {
  ad: string;
  etiket: string;
  aciklama: string;
  backtestOzet: string;
};

// 2026-08-27: aynı gün İKİ YÖNDE değişti. Sabah "sıralamalar yüzdelere göre olacak" dendi,
// üçü kaldırıldı (V5.20). Sonra kullanıcı kendi testleriyle (versiyon karşılaştırması,
// sinyal harmonisi B=500) üçünü de tek tek geri getirtti (V5.21→V5.23). AMA Kocaeli
// 2.Koşu SOMUT ÖRNEĞİNDE (TEYZEOĞLU %11.1 ile 1.sırada, MAŞİDE %23.5 ile 3.sırada)
// kullanıcı KESİN karar verdi: "sıralama yüzdeye göre olur, 1.sıradaki ata %24
// vermelisin." v5-engine.ts'te tek bir anahtar eklendi (GOSTERIM_SIRASI_DUZELTMELERI_AKTIF
// = false) — üçü de KOD OLARAK duruyor (silinmedi, backtest kanıtları geçerli) ama hiçbiri
// ÇAĞRILMIYOR. Gösterim sırası artık kesin olarak yalnız ham olasılığa göre (V5.24).
export const SIRALAMA_KURALLARI: SiralamaKurali[] = [
  {
    ad: "AGF Trend Terfisi",
    etiket: "GERİ ALINDI (2026-08-27, V5.24, kesin karar)",
    aciklama: "En çok yükselen/düşen AGF trendini taşıyan + yeterli sinyal sayısına (≥4) sahip atlar, ham sıralamada geride kalsa bile ilk-3'e/ilk-6'ya terfi ediyordu. Aynı gün 3 kez el değiştirdi (kaldırıldı→geri geldi→kesin kaldırıldı) — Kocaeli 2.Koşu örneği kullanıcının kesin kararını netleştirdi: sıralama artık İSTİSNASIZ yüzdeye göre.",
    backtestOzet: "n=663 → %21.6 galibiyet / %53.8 top3 (geçerliliğini koruyor, uygulanmıyor)",
  },
  {
    ad: "AGF Favorisi İlk-3 Garantisi",
    etiket: "GERİ ALINDI (2026-08-27, V5.24, kesin karar)",
    aciklama: "AGF sırası=1 olan at, ham olasılık sıralamasında top3 dışında kalsa bile KOŞULSUZ 3.sıraya alınıyordu. Kocaeli 2.Koşu örneğiyle kullanıcı kesin karar verdi: sıralama İSTİSNASIZ yüzdeye göre.",
    backtestOzet: "n=428 → net +5 yarış (top3 %60.0→%61.2). Güncel B=500 doğrulama da yapılmıştı (top3 net GA=[0,7]) — geçerliliğini koruyor, uygulanmıyor.",
  },
  {
    ad: "Derin AGF-Longshot Düzeltmesi",
    etiket: "GERİ ALINDI (2026-08-27, V5.24, kesin karar)",
    aciklama: "Sistemin ham #1'i AGF sırası≥4 (piyasanın neredeyse hiç güvenmediği bir at) olduğunda, modelin kendi AGF≤3 içindeki en iyi adayıyla yer değiştiriyordu. Bu KURAL, Kocaeli 2.Koşu'da MAŞİDE'yi (ham #1, %23.5) TEYZEOĞLU (%11.1) ile yer değiştirmişti — kullanıcı bunu somut örnekte görüp KESİN reddetti: sıralama İSTİSNASIZ yüzdeye göre.",
    backtestOzet: "Orijinal: n=448 → net +20 yarış. Güncel/tazelenmiş veriyle (1042 yarış) tekrar test edildiğinde bu net etki artık istatistiksel olarak kanıtlanamıyordu (GA=[-3,11], sıfırı içeriyor) — geçerliliğini koruyor sayılmıyor, uygulanmıyor.",
  },
];

export type AdaySinyalDurum = "acik" | "reddedildi" | "beklemede";

export type AdaySinyal = {
  ad: string;
  durum: AdaySinyalDurum;
  etiket: string;
  aciklama: string;
  metrik?: string;
};

export const ADAY_SINYALLER: AdaySinyal[] = [
  {
    ad: "Sınıf Düşüşü (İkramiye Bazlı)",
    durum: "acik",
    etiket: "Açık · veri birikiyor",
    aciklama: "Bugünkü ikramiye, önceki yarışın ≤%70'iyse \"sınıf düşüşü\" say. Standalone fark gerçek ve VIF temiz (confounding yok) — ama mevcut 21 sinyalle birlikte bootstrap testte anlamsız kaldı. Handikap-dahil geçişlerde ikramiye tek başına geçersiz olduğu için tanım düzeltmesi de tamamlanmadı.",
    metrik: "nokta +0.011 · %95 GA=[-0.105,0.079] · n=418 pozitif vaka",
  },
  {
    ad: "Galop Trendi",
    durum: "reddedildi",
    etiket: "Sızıntı bulundu · çıkarıldı",
    aciklama: "Son idman ile bir önceki aynı-mesafe idman arasındaki süre farkı. V5.11'de eklendi, hesaplama script'inde tarih filtresi unutulmuştu — sıfırdan farklı satırların %74.7'si yarış-sonrası idman verisi kullanıyordu. Temiz veriyle katsayı tamamen çöktü.",
    metrik: "+0.280 → +0.008 (temiz veri) — V5.12'de komple kaldırıldı",
  },
  {
    ad: "Ham HP Değeri",
    durum: "reddedildi",
    etiket: "Confounded · reddedildi",
    aciklama: "Tek başına çok güçlü ama diğer 20 sinyalle birlikte anlamsızlaştı — agfSirasi/agfPayi/antrenorOrani/jokeyOrani zaten aynı bilgiyi dolaylı yakalıyor.",
    metrik: "Düşük-şart GA=[-0.083,0.391] · Diğer GA=[-0.028,0.267]",
  },
  {
    ad: "HP Sırası, At-Jokey İkili Oranı, Dışarıdan Start, Ön Grup Arkası",
    durum: "reddedildi",
    etiket: "Confounded · reddedildi",
    aciklama: "Hepsi tek başına anlamlı, 21-sinyal modelle birlikte anlamsızlaştı — aynı confounding deseni.",
  },
  {
    ad: "DP / DI / CD Dosage Sistemi",
    durum: "reddedildi",
    etiket: "Veri kalitesi · iptal",
    aciklama: "LLM kaynaklı sabit aygır-dosage referans listelerinde çürütücü kanıt bulundu (aynı at farklı listede farklı değer). Kaynak güvenilmez.",
  },
  {
    ad: "Kariyer Start Sayısı",
    durum: "reddedildi",
    etiket: "Anlamlı ama zararlı · reddedildi",
    aciklama: "İzole B=500 testte istatistiksel olarak anlamlı çıktı (GA sıfırı dışlıyor) ama modele eklenince top3 doğruluğunu düşürdü — anlamlılık tek başına yeterli standart değil, top1/top3 iyileşmesi de şart.",
    metrik: "Diğer segment: nokta=-0.2336 · GA=[-0.4005,-0.0946] ✓ anlamlı · top3 %66.5→%65.4",
  },
  {
    ad: "Jokey-Antrenör İkili Sinerjisi",
    durum: "reddedildi",
    etiket: "Anlamsız · reddedildi",
    aciklama: "Leak-free (kronolojik, shrink-ayarlı) yeniden inşa edilip izole B=500 ile iki segmentte de test edildi — GA ikisinde de sıfırı içeriyor.",
    metrik: "Düşük-şart nokta=-0.0704 GA=[-0.2446,0.0566] · Diğer nokta=+0.0259 GA=[-0.0621,0.1016]",
  },
  {
    ad: "Dam-Line Pedigri Oranı",
    durum: "reddedildi",
    etiket: "Anlamsız (leak-free sonrası) · reddedildi",
    aciklama: "İlk test veri sızıntılıydı (+1.74 katsayı, imkansız büyüklükte). Leak-free düzeltme + izole B=500 sonrası iki segmentte de anlamsız.",
    metrik: "Düşük-şart nokta=-0.0071 GA=[-0.2262,0.1644] · Diğer nokta=-0.0900 GA=[-0.1899,0.0187]",
  },
  {
    ad: "Takı Değişikliği (Eklendi / Çıkarıldı)",
    durum: "reddedildi",
    etiket: "Anlamsız · reddedildi",
    aciklama: "Toplu testte anlamsız çıkmıştı, batch-artifact riski elenmesi için izole B=500 ile tekrar test edildi — dört kombinasyonda (2 yön × 2 segment) da GA sıfırı içeriyor.",
    metrik: "takiEklendiMi diğer: nokta=-0.0392 GA=[-0.1661,0.0576] · takiCikarildiMi diğer: nokta=+0.0610 GA=[-0.1546,0.2555]",
  },
  {
    ad: "Kilo Değişimi",
    durum: "reddedildi",
    etiket: "Anlamsız · reddedildi",
    aciklama: "İlk açıklama (\"formEgimi'nin başka görünümü\") yanlış çıktı (korelasyon ~0.02) ama sonuç aynı — izole B=500 ile iki segmentte de anlamsız.",
    metrik: "Düşük-şart nokta=+0.0252 GA=[-0.1896,0.2189] · Diğer nokta=-0.0703 GA=[-0.1838,0.0424]",
  },
  {
    ad: "Genel Pist Tercihi (Hipodrom-Bağımsız Yüzey Kazanma Oranı)",
    durum: "reddedildi",
    etiket: "Anlamsız · reddedildi",
    aciklama: "GREEN GULET vakası tetikleyici oldu (5 galibiyetin 5'i Kum'da). Mevcut pistUzmani dar (yalnız aynı hipodrom+pist+mesafe+bu yıl) — atın TÜM hipodromlar genelinde o yüzeydeki kazanma oranı (leak-free, shrink-ayarlı) test edildi. Asıl hipotez (kazanma ORANI) iki segmentte de tamamen anlamsız. Yalnız ham deneyim sayısı (kaç kez o yüzeyde koştuğu) diğer segmentte anlamlı ama top1/top3'te SIFIR etki — kariyerStartSayisi ile örtüşen aynı etki.",
    metrik: "Kazanma oranı: Düşük-şart GA=[-0.249,0.206] · Diğer GA=[-0.098,0.138]",
  },
  {
    ad: "AGF Sırası 4-5 Göstergesi / %40+ Payı Göstergesi",
    durum: "reddedildi",
    etiket: "Anlamlı ama zararlı · reddedildi",
    aciklama: "agfPayi²'nin (kabul edildi, bkz. CANLI_SINYALLER) alternatifi olarak test edilen iki kategorik kodlama. AGF sırası 4-5 göstergesi diğer segmentte anlamlı çıktı ama top1/top3'ü KÖTÜLEŞTİRDİ (kariyerStartSayisi deseni) — reddedildi. %40+ payı göstergesi ikisi de anlamsız çıktı.",
    metrik: "AGF sırası 4-5, diğer: nokta=+0.153 GA=[0.074,0.244] anlamlı ama top1 %30.1→%28.5, top3 %64.8→%63.2 (kötü)",
  },
  {
    ad: "Handikap 3. Segment (İzole Model)",
    durum: "reddedildi",
    etiket: "Test edildi (n=307) · reddedildi",
    aciklama: "hpIvmesi/kiloDegisimi gibi Handikap'a özgü sinyalleri kendi izole segmentine ayırma fikri — kullanıcı onaylamıştı, 2026-08-28'de yeterli veri (307 Handikap koşusu) birikince gerçek karşılaştırma yapıldı. Handikap-only TAM bağımsız 23-özellik retrain, mevcut havuzlanmış+cerrahi-düzeltme yaklaşımından DAHA KÖTÜ çıktı — n=230 eğitim hâlâ 23 serbest parametre için yetersiz (overfit riski).",
    metrik: "Aynı 77 test koşusu: Handikap-only top1=%20.8/top3=%51.9/logloss=2.0707 vs Canlı top1=%20.8/top3=%57.1/logloss=2.0452",
  },
  {
    ad: "Zemin Ağırlığı Sinyali (RaceDay.surfaceConditions — GÜNCEL gün verisi)",
    durum: "beklemede",
    etiket: "Veri yetersiz",
    aciklama: "RaceDay.surfaceConditions (yalnız güncel/ingest edilen günler) gerçekten değişiyor ama n=3 gün — kış yağmurlarında veri birikince tekrar test edilecek. KARIŞTIRILMASIN: apayrı bir kaynağa (TjkDereceKaydi arşivi) dayanan 'Zemin Toleransı' sinyali (kod: zeminToleransi) zaten CANLI SİNYALLER'de — o test edildi, anlamsız çıktı, kullanıcı kararıyla yine de eklendi.",
  },
  {
    ad: "Yurt Dışı Yarış Genişletmesi",
    durum: "beklemede",
    etiket: "Karar verilmedi",
    aciklama: "TJK'nın yabancı hipodromları Türk formatında yayınlıyor — AGF/HP/Sıklet/tam geçmiş dolu, ücretli kaynağa gerek yok. İş planı hazır, başlanmadı.",
  },
];
