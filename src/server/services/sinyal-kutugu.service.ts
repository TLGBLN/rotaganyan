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

// 2026-09-01 kullanıcı kararı — kavramsal yeniden gruplama (kod/matematik DEĞİŞMEDİ,
// yalnız raporlama/etiketleme): "A Katmanı" = istatistiksel olarak kanıtlanmış (veya en
// azından karışık/gerçek katsayıya dayanan) 12 çekirdek sinyal; "B Katmanı" = tek başına
// anlamsız çıkan ama MEGAFAUNA/ESENYIL/KIZIM BİNDAL türü vakalarda fark yaratabileceği
// düşünülen, kullanıcı kararıyla eklenen 7 sinyal (zeminToleransi, yakinsama2Plus,
// sonIdmanSprint, takiEklendiMi, takiCikarildiMi, sireOrani, zeminMesafeDeneyim).
// Yarış Gidişatı (yarisGidisatiSkoru) B olarak eklenmişti (sınırda/run-to-run değişken
// sonuç) — kullanıcı kararıyla (2026-09-01, aynı gün) A'ya taşındı; istatistiksel kanıt
// durumu (durum/not alanları) DEĞİŞMEDİ, yalnız kategorizasyon güncellendi.
// ÖNEMLİ NÜANS: B Katmanı kendi içinde MEKANİZMA olarak homojen DEĞİL — zeminToleransi/
// yakinsama2Plus/sonIdmanSprint/takiEklendiMi/takiCikarildiMi hâlâ A'nın 17'lik ORTAK
// regresyonunda (yarisGidisatiSkoru ile birlikte) fit ediliyor (yalnız kanıt gücü zayıf
// olduğu için B etiketleniyor); sireOrani/zeminMesafeDeneyim ise GERÇEKTEN ayrı bir
// mekanizma (softmax'a girmeden önce skora eklenen, bkz. v5-engine.ts bKatmaniUygula).
// Bu ayrımı gizlememek için her B-katmanı girdisinde belirtiliyor.
export type SinyalKatmani = "A" | "B";

export type CanliSinyal = {
  ad: string;
  kod: string;
  katman: SinyalKatmani;
  dusukSart: { katsayi: number; durum: SinyalAnlamlilik; not?: string };
  diger: { katsayi: number; durum: SinyalAnlamlilik; not?: string };
  aciklama: string;
};

// 2026-08-28 kullanıcı kararı ("faydası yoksa sil"): B=500'de İKİ segmentte de %95 GA'sı
// sıfırı içeren 11 sinyal (accurace, formEgimi, formEgimi2, kgs, kgs2, pistUzmani,
// sireOrani, galop, uzunAraGalopKatkisi, agfYukselisVarMi, agfDususVarMi) LİSTEDEN VE
// toFeatureVector'DAN ÇIKARILDI. Ek doğrulama (bootstrap FARK testi, B=500): logloss farkı
// düşük-şart'ta ANLAMLI iyileşme (-0.0598, GA=[-0.1389,-0.0067] sıfırı DIŞLIYOR), diğer'de
// yön aynı ama kanıtlanamadı (-0.0235, GA=[-0.0853,0.0057]). Kalan 12 özelliğin katsayıları
// aşağıda GÜNCEL (budanmış model, deployed weight dosyası) rakamlarla.
export const CANLI_SINYALLER: CanliSinyal[] = [
  { ad: "AGF Sırası", kod: "agfSirasi", katman: "A", dusukSart: { katsayi: -0.359, durum: "anlamli" }, diger: { katsayi: -0.389, durum: "anlamli" }, aciklama: "Her iki segmentte de en güvenilir sinyallerden biri — piyasa favoriliği." },
  { ad: "AGF Payı", kod: "agfPayi", katman: "A", dusukSart: { katsayi: 0.566, durum: "anlamli" }, diger: { katsayi: 0.527, durum: "anlamli" }, aciklama: "agfSirasi'ndan bağımsız: sıralamadan çok kalabalıktan ne kadar öne çıktığı. VIF BULGUSU (2026-08-31): agfPayi/agfPayi² arasında CİDDİ çoklu-doğrusal-bağlantı (VIF=12.12/7.94, diğer 10 sinyal VIF~1, r=0.90) — bireysel katsayı tahminleri güvenilmez. İKİ ayrı düzeltme denendi (agfTrend ile DEĞİŞTİRME ve EKLEME, bkz. ADAY_SİNYALLER), ikisi de gerçek performansı iyileştirmedi/kötüleştirdi — VIF kabul edildi, dokunulmadı (yüksek VIF burada tahmin gücünü değil yalnız katsayı yorumunu etkiliyor)." },
  { ad: "Hız Derecesi", kod: "hizDerecesi", katman: "A", dusukSart: { katsayi: 0.492, durum: "anlamli" }, diger: { katsayi: 0.238, durum: "anlamli", not: "Handikap'ta elle 0'a sabitlendi (V5.10)" }, aciklama: "Son 365 gün, popülasyon ortalamasına göre göreli hız. Handikap kategorisinde katkısı istatistiksel olarak sıfır bulunduğu için override edildi. DÜZELTME (V5.33, 2026-08-31): canlı sunum ve eğitim, V5.32'nin retrain incelemesi sırasında fark edilen bir train/serve uyumsuzluğu taşıyordu (canlı yalnız BUGÜNKÜ kova/popülasyona bakıyordu, eğitim atın son 3 koşusunun HER BİRİNİ KENDİ kovasına/tarihine göre kıyaslıyordu — canlıda %43.8 sıfır dönerken eğitimde %8.2). Artık ikisi de aynı paylaşılan çekirdeği (hiz-derecesi-hesapla.ts) kullanıyor, katsayı değişmedi. Gerçek 60 sonuçlanmış koşuda kazanan/diğer Cohen's d ESKİ mantıkta 0.369, YENİ mantıkta 0.578 — düzeltme win-discrimination'ı somut biçimde güçlendirdi." },
  { ad: "Antrenör Oranı", kod: "antrenorOrani", katman: "A", dusukSart: { katsayi: 0.313, durum: "anlamli" }, diger: { katsayi: 0.235, durum: "anlamli" }, aciklama: "Düşük-şartta belirgin daha ağır basıyor." },
  { ad: "İdman Jokeyi Uyumu", kod: "idmJokey", katman: "A", dusukSart: { katsayi: 0.199, durum: "anlamli" }, diger: { katsayi: 0.103, durum: "anlamli", not: "Handikap'ta elle 0'a sabitlendi (V5.31, 2026-08-31) — Opus denetimi: canlı model-düzeltilmiş bakiye -5.93pp (GA=[-10.34,-1.60], sıfırı dışlıyor, n=107), üretim-sadık katsayı canlı %75 fit'te 0.1033'ten tüm veride 0.0266'ya (GA sıfırı kapsıyor) kaymış — 12 sinyalin en büyük kayması. Görülmemiş son %25'te sıfırlarsa top1 +3.95pp/top3 +2.63pp/logloss -0.0306, hepsi anlamlı iyileşme. Düşük-şart'ta katsayı sağlam pozitif (GA=[0.102,0.372]), KORUNDU — hizDerecesi/Handikap (V5.10) ile AYNI cerrahi desen." }, aciklama: "Yarıştıracak jokey, atın idmanlarından birini yaptırmış mı. Diğer 11 özellik silindikten sonra iki segmentte de netleşti." },
  { ad: "Jokey Oranı", kod: "jokeyOrani", katman: "A", dusukSart: { katsayi: 0.182, durum: "anlamli" }, diger: { katsayi: 0.089, durum: "anlamsiz", not: "2026-08-28 zamansal kayma bulundu: Ocak-Mayıs nokta=0.162 GA=[0.110,0.225] anlamlı, Haziran-Ağustos nokta=0.114 GA=[0.044,0.186] hâlâ anlamlı — VIF artmadı (kollinearlik hipotezi doğrulanmadı), gerçek sebep belirsiz. Sıfırlanmadı, izlemede. GÜNCELLEME (2026-08-30, Opus denetimi): V5 döneminde sonuçlanmış TÜM koşularda (n=248) canlı isabet iki bağımsız ölçütte de bu 'anlamsız' etiketiyle ÇELİŞİYOR — kod-bazlı lift +3.9pp (budama sonrası +6.0pp), 4 koşu tipinin (Maiden/Şartlı/Handikap/diğer) HEPSİNDE pozitif, featureSnapshot z-farkı +0.651. Katsayı sıfırlanmadan bırakılması doğru karar çıktı, 'anlamsız' notu artık güncel canlı veriyle desteklenmiyor." }, aciklama: "Jokeyin genel kazanma yüzdesi." },
  { ad: "Rakipsiz Kaçak At", kod: "kacakYalniz", katman: "A", dusukSart: { katsayi: 0, durum: "override", not: "2026-08-31 (V5.32) TÜM segmentlerde 0'a sabitlendi — eski 'anlamlı +0.136/+0.082' katsayıları TAMAMEN eğitim-verisi sızıntısı ürünüymüş: `Runner.raceStyle` tarih filtresi olmadan hesaplanıp atın TÜM (geçmiş+gelecek) Runner satırlarına yazılıyordu. İKİ bağımsız Opus denetimi (aynı gün, birbirinden habersiz) aynı kök nedeni buldu. Sızıntısız yeniden hesaplanınca: düşük-şart -0.0934 GA=[-0.384,0.047] (P(>0)=%9, TERS yönlü), diğer +0.0101 (P(>0)=%64, null) — ikisi de gerçek değil. H2H/düşük-şart ve h2hKiloDegisimi (V5.30) ile AYNI cerrahi desen." }, diger: { katsayi: 0, durum: "override", not: "Aynı düzeltme, bkz. dusukSart notu." }, aciklama: "Accurace tabanlı erken-tempo profili — yalnız SAHADA TEK kaçak-at olma durumunda sayılıyor." },
  { ad: "Kilo-Ayarlı H2H", kod: "h2hKiloDegisimi", katman: "A", dusukSart: { katsayi: 0, durum: "override", not: "2026-08-30 (V5.30) TÜM segmentlerde 0'a sabitlendi — o gün n=248'de canlı GA sıfırı dışlıyordu (z=-0.521, GA=[-0.888,-0.150]). GÜNCELLEME (2026-08-31, Opus tekrar denetimi): n 24'e çıkınca bu REPLİKE OLMADI (z=-0.123, GA=[-0.332,+0.038], sıfırı kapsıyor) — model-düzeltilmiş bakiye ise +1.84pp (POZİTİF), eğitim katsayısı diğer'de GA=[0.0020,0.1348] anlamlı pozitif. Üretim-sadık testte sıfırlamanın etkisi pratikte sıfır (top1 Δ=0.00pp, logloss Δ=+0.0021, anlamsız) — yani sıfırlama ZARARSIZ ama dünkü gerekçe abartılıydı. Şimdilik sıfırlı bırakıldı (geri almanın da kanıtı yok), izlemede." }, diger: { katsayi: 0, durum: "override", not: "Aynı düzeltme+güncelleme, bkz. dusukSart notu." }, aciklama: "Bugünkü rakiplere göre kilo pozisyonunun geçmiş karşılaşmaya göre değişimi." },
  { ad: "AGF Payı² (kare terimi)", kod: "agfPayi2", katman: "A", dusukSart: { katsayi: -0.205, durum: "anlamsiz" }, diger: { katsayi: -0.201, durum: "anlamli" }, aciklama: "AGF payının doğrusal-olmayan (kare) terimi — güçlü favorilerin piyasada fazla değerli görülmesini düzeltir. VIF notu: bkz. agfPayi girdisi." },
  { ad: "H2H Net Skor", kod: "h2hNetSkor", katman: "A", dusukSart: { katsayi: 0, durum: "override", not: "Ham değer ters yönlüydü, elle sıfırlandı" }, diger: { katsayi: 0.099, durum: "anlamli" }, aciklama: "Baş-başa geçmiş karşılaşmalarda net galibiyet farkı." },
  { ad: "Kısa Galop Aralığı Var Mı", kod: "kgsVarMi", katman: "A", dusukSart: { katsayi: 0.035, durum: "anlamsiz" }, diger: { katsayi: 0.14, durum: "anlamli" }, aciklama: "14-30 gün aralığı — yalnız diğer segmentte anlamlı." },
  // 2026-08-28 — KURAL İSTİSNASI: bu sinyal B=500 testinde İKİ KEZ (2026-08-23 ve
  // 2026-08-28) anlamsız çıktı ama kullanıcı, sonucu bilerek (AskUserQuestion ile teyit
  // edilerek) modele eklenmesini istedi. "Önce backtest, iyi çıkmazsa ekleme" standart
  // kuralının açık bir istisnası — diğer tüm satırlardan farklı olarak. 11 sinyal silinirken
  // özellikle KORUNMASI istendi.
  { ad: "Zemin Toleransı (İSTİSNA — anlamsız test sonucuna rağmen eklendi)", kod: "zeminToleransi", katman: "B", dusukSart: { katsayi: 0.008, durum: "anlamsiz" }, diger: { katsayi: 0.0002, durum: "anlamsiz" }, aciklama: "Atın Normal-dışı (ıslak/ağır/yumuşak) pistteki geçmiş göreli performansı (TjkDereceKaydi arşivi). At-bazlı gerçek/tekrarlanabilir bir özellik (split-half r=0.467) ama V5'in tahmin doğruluğuna ölçülebilir katkısı yok." },
  // 2026-08-30 — B KATMANI (bkz. plan: A/B/C Sinyal Katmanlama Mimarisi). zeminToleransi
  // ile AYNI türden bir istisna (AskUserQuestion ile teyit edildi) AMA farklı MEKANİZMA:
  // mevcut 12-özellikli (A katmanı) doğrusal regresyona 13. terim olarak yeniden fit
  // EDİLMEDİ (bu, aynı gece 7/8 adayda "küçük örneklemde güç kaybı" sorununa yol açmıştı)
  // — softmax'a girmeden ÖNCE skora ayrı, bağımsız kalibre edilmiş bir terim olarak
  // eklendi (bkz. v5-engine.ts bKatmaniUygula). Yalnız düşük-şart'ta aktif, diğer/
  // Handikap'ta katsayısı fiilen 0 (skor birebir A katmanıyla aynı kalır).
  {
    ad: "Sire Oranı (B KATMANI — düşük-şart istisnası, kanıtsız ama kullanıcı kararıyla aktif)",
    kod: "sireOrani",
    katman: "B",
    dusukSart: { katsayi: 0.0477, durum: "anlamsiz", not: "Kalıcı araçla (n=1060, gerçek train/test) GA=[-0.1352,0.2045] — sıfırı içeriyor. Katsayı yine de bu gerçek eğitimden alındı, keyfi değil. BUG DÜZELTMESİ (2026-08-30, V5.30, Opus denetimi): 2026-08-28'deki 11-sinyal budamasında OZELLIK_GRUPLARI'ndan SIRE grubu kaldırılınca muhakemeUretV5'teki gösterim bloğu ölü koda döndü — skora katkı gerçekleşmeye devam etti ama ne gerekçe metninde ne featureSnapshot'ta hiç görünmüyordu, canlı etkisi tamamen ölçülemez durumdaydı. Düzeltildi: gerçek katkı artık r.bSireKatkisi'nde saklanıyor, hem gerekçe satırında hem featureSnapshot.bKatmani'de görünüyor." },
    diger: { katsayi: 0, durum: "veri-yok", not: "B katmanı diğer/Handikap'ta hiç uygulanmıyor, oran=0." },
    aciklama: "Aygırın kazanma oranı (shrink edilmiş). 5 farklı yöntemle (tek-değişkenli, VIF, model-farkı) test edildi, hiçbirinde A katmanına (12 özellik) kanıtlanmış bir katkı bulunamadı — yine de kullanıcı at yetiştiriciliğinin gerçek bir faktör olduğuna inanıyor, düşük-şart'a özel küçük bir B katmanı itmesi olarak eklendi.",
  },
  // 2026-08-30 — kullanıcı KARARI: normalde bu oturumun "önce n≥250-300 gölge-koşu +
  // B=500 kanıtı, sonra canlı" kuralı geçerliyken, kullanıcı bu adayın gölge-testi HİÇ
  // TAMAMLANMADAN (0 sonuçlanmış gölge-koşu) DERHAL B katmanına eklenmesini istedi —
  // sireOrani/zeminToleransi'den FARKLI olarak, o ikisi en azından KENDİ backtest'lerinden
  // (anlamsız da çıksa) geçmişti; bu, hiç istatistiksel değerlendirmeden eklenen İLK
  // istisna. v6-zemin-mesafe-deneyimi challenger'ı (v6-challenger-registry.ts) PARALEL
  // olarak gölge-veri biriktirmeye devam ediyor — ileride yeterli örneklem birikirse
  // gerçek bir B=500 karşılaştırması yine yapılabilir.
  {
    ad: "Zemin+Mesafe Deneyimi (B KATMANI — TÜM kategoriler, hiç test edilmeden kullanıcı kararıyla aktif)",
    kod: "zeminMesafeDeneyim",
    katman: "B",
    dusukSart: { katsayi: 0.02, durum: "anlamsiz", not: "HİÇ test edilmedi — gölge-test (v6-zemin-mesafe-deneyimi) 0 sonuçlanmış koşuyla, kullanıcı isteğiyle derhal canlıya alındı. Katsayı keyfi bir başlangıç varsayımı." },
    diger: { katsayi: 0.02, durum: "anlamsiz", not: "sireOrani'den FARKLI: TÜM kategorilerde AYNI katsayıyla uygulanıyor (düşük-şart'a özgü değil)." },
    aciklama: "Atın bugünkü tam (pist, zemin koşulu, mesafe) kombinasyonunda kanıtlanmış deneyimi — popülasyona göre göreli pace %, TjkDereceKaydi'den (zeminToleransi ile AYNI kilo-düzeltmeli formül, yalnız bugünün tam koşuluna filtrelenmiş, 3 kademeli: tam mesafe eşleşmesi/yalnız pist+zemin eşleşmesi/hiç eşleşme yok). Hiçbir istatistiksel doğrulama yapılmadan eklendi.",
  },
  // 2026-09-01 — MEGAFAUNA vakasından doğan "Yakınsama" hipotezi ADAY_SİNYALLER'de
  // REDDEDİLDİ olarak belgelenmişti (B=500'de anlamsız) AMA kullanıcı, zeminToleransi/
  // sireOrani ile AYNI türden BİLİNÇLİ istisna olarak eklenmesini istedi. Adil kıyas
  // (aynı test seti): "diğer" top1/top3/logloss farkı ihmal edilebilir, düşük-şart'ta
  // hafif iyi — zeminToleransi gibi zararsız. Katsayı gerçek retrain'den (13. özellik,
  // model-veri.json tam yenilendi, 2 yeni bileşen — sınıf düşüşü + at-jokey ikilisi —
  // yakinsama-gecmis.ts ile hem eğitim hem canlı sunum AYNI fonksiyondan, hızDerecesi
  // train/serve dersinden ders alınarak).
  {
    ad: "Yakınsama (İSTİSNA — anlamsız test sonucuna rağmen kullanıcı kararıyla eklendi)",
    kod: "yakinsama2Plus",
    katman: "B",
    dusukSart: { katsayi: -0.028, durum: "anlamsiz", not: "B=500: GA=[-0.1535,0.0756], sıfırı içeriyor. Diğer bileşenlerle (12 özellik) birlikte, YENİDEN yapılan tam retrain'den (model-veri.json tam yenilendi, düzeltilmiş sınıf-düşüşü/at-jokey tanımlarıyla)." },
    diger: { katsayi: 0.042, durum: "anlamsiz", not: "B=500: GA=[-0.0405,0.1197], sıfırı içeriyor." },
    aciklama: "pistUzmani + sahada ilk-2 pedigri (sireOrani) + at-jokey ikilisinde geçmiş galibiyet + AGF eşik-üstü (≥1.0 puan) yükseliş + sınıf düşüşünün (bugünkü 1.ikramiye, son 3 startın ortalamasının <%80'i) EN AZ 2'sinin AYNI ATTA hizalanması. Beşi de TEK TEK ve BİRLİKTE B=500 bootstrap ile test edildi, hiçbiri istatistiksel olarak anlamlı çıkmadı — kullanıcı MEGAFAUNA vakasını (model 8./%4 verdi, at kazandı; pistUzmanı+at-jokey ikilisi+AGF yükselişi hizalanmıştı) gerekçe göstererek yine de eklenmesini istedi.",
  },
  // 2026-09-01 — ESENYIL vakası (model 9./%4.9 verdi, at kazandı; kullanıcı son idmanının
  // "Sprint" etiketli olduğunu, pedigrisinin mesafeye uygun olduğunu ve at-jokey ikilisinin
  // geçmişte %50 galibiyetli olduğunu belirtti). Önce basit (regresyonsuz) karşılaştırma
  // yapıldı: n=9148 (leak-free, karma hariç), son idmanı Sprint/Sürat olanlar top1 %9.5 vs
  // diğerleri %11.1 — YÖN TERSİYDİ (nokta -1.5pp, GA sıfırı kapsıyor). Kullanıcı yine de
  // B-katmanı kural istisnası olarak eklenmesini istedi — 14. özellik olarak ORTAK
  // regresyona katıldı (yakinsama2Plus ile AYNI mekanizma). Diğer değişkenleri kontrol
  // eden TAM regresyonda katsayı ikisi de sıfıra çok yakın çıktı (basit karşılaştırmadaki
  // negatif yön, confounding'den kaynaklanıyormuş). Adil önce/sonra kıyası (aynı test seti,
  // 13 vs 14 özellik): top1/top3 BİREBİR AYNI, logloss farkı gürültü seviyesinde
  // (düşük-şart +0.0003, diğer -0.0009) — zeminToleransi gibi ölçülebilir zarar yok.
  {
    ad: "Son İdman Sprint (İSTİSNA — basit kıyas yönü ters çıktı, tam regresyonda sıfıra yakın, kullanıcı kararıyla eklendi)",
    kod: "sonIdmanSprint",
    katman: "B",
    dusukSart: { katsayi: 0.008, durum: "anlamsiz", not: "B=500: GA=[-0.1620,0.1465], sıfırı içeriyor." },
    diger: { katsayi: -0.019, durum: "anlamsiz", not: "B=500: GA=[-0.1063,0.0651], sıfırı içeriyor." },
    aciklama: "Son idmanın TÜRÜ (TJK Gallop.track) Sprint/Sürat mi. Basit karşılaştırma (regresyonsuz, n=9148) YÖNÜ DOĞRULAMADI (Sprint grubu top1 %9.5, diğer %11.1) — kullanıcı ESENYIL vakasını gerekçe göstererek yine de eklenmesini istedi. Ortak regresyonda (13 kontrol değişkeniyle birlikte) katsayı iki segmentte de sıfıra çok yakın (+0.008 / -0.019), istatistiksel olarak anlamsız.",
  },
  // 2026-09-01 — KIZIM BİNDAL vakası: kullanıcı, bir yorumcunun takı çıkarma/ekleme
  // bilgisini (KG+GKR çıkarılmış) gerçek galibiyeti öngörmede kullandığını gösterdi.
  // Model bu bilgiyi ZATEN görüntülüyordu (Son Yarış Detayları) ama HİÇ skorlanmıyordu.
  // Kullanıcı kararıyla 15-16. özellik olarak eklendi — B=500 bootstrap her iki segmentte
  // de sıfıra yakın/anlamsız çıktı, GERÇEK fit edilen katsayı kullanıldı (elle yön verilmedi).
  {
    ad: "Takı Eklendi (İSTİSNA — anlamsız, kullanıcı kararıyla eklendi)",
    kod: "takiEklendiMi",
    katman: "B",
    dusukSart: { katsayi: -0.052, durum: "anlamsiz", not: "B=500: GA=[-0.2630,0.1260], sıfırı içeriyor." },
    diger: { katsayi: -0.018, durum: "anlamsiz", not: "B=500: GA=[-0.1367,0.0781], sıfırı içeriyor." },
    aciklama: "Son yarışına göre takı eklenmiş mi (SonYarisDetay.eklenenTaki). n=913/38264 (%2.4) — küçük örneklem, GA geniş. Her iki segmentte de hafif negatif ama anlamsız.",
  },
  {
    ad: "Takı Çıkarıldı (İSTİSNA — anlamsız, kullanıcı kararıyla eklendi)",
    kod: "takiCikarildiMi",
    katman: "B",
    dusukSart: { katsayi: -0.030, durum: "anlamsiz", not: "B=500: GA=[-0.3117,0.2511], sıfırı içeriyor." },
    diger: { katsayi: 0.061, durum: "anlamsiz", not: "B=500: GA=[-0.1401,0.2486], sıfırı içeriyor." },
    aciklama: "Son yarışına göre takı çıkarılmış mı (SonYarisDetay.cikarilanTaki) — KIZIM BİNDAL'ın (KG+GKR çıkarılmış, kazandı) gerekçe gösterildiği sinyal. n=3174/38264 (%8.3). Diğer segmentte yön KIZIM BİNDAL'ın işaret ettiği yönde (+0.061) ama anlamsız; düşük-şart'ta ters (-0.030), o da anlamsız.",
  },
  // 2026-09-01 — Yarış Gidişatı (kullanıcı tasarımı): saha-geneli tempo senaryosu
  // (Rahat Liderlik/Yavaş Tempo/Dengeli/Mücadeleli/Çok Yüksek/Dağılma Riski, Accurace
  // geçmişinden kural-tabanlı olasılık dağılımı) × atın kendi stil dağılımının uyum-
  // matrisiyle ağırlıklı beklenen değeri × mesafe katsayısı (bkz. pace-analizi.ts
  // hesaplaYarisGidisati). Kocaeli K1 gerçek yarışıyla (Female Warrior lider gidip
  // Kardaha'ya yakalanması) doğrulanan bir hata (saha-ortalaması yerine EN GÜÇLÜ tek
  // kaçak adayına bakmak gerektiği) düzeltildikten sonra test edildi. B=500 bootstrap:
  // diğer segmentte GA sıfırı DIŞLIYOR (anlamlı), düşük-şart'ta sıfırı içeriyor — ama
  // İKİ ayrı bootstrap koşusunda diğer segmentin alt sınırı sıfıra çok yakın gidip geldi
  // (0.0025 / -0.0020) — run-to-run gürültüye duyarlı, sınırda bir anlamlılık. Kullanıcı
  // kararıyla (2026-09-01) katman A'ya alındı — istatistiksel kanıt DURUMU (durum/not
  // alanları) DEĞİŞMEDİ, yalnız kategorizasyon güncellendi.
  {
    ad: "Yarış Gidişatı",
    kod: "yarisGidisatiSkoru",
    katman: "A",
    dusukSart: { katsayi: 0.139, durum: "anlamsiz", not: "B=500: GA=[-0.0307,0.3090], sıfırı içeriyor." },
    diger: { katsayi: 0.098, durum: "sinirda", not: "B=500: GA=[0.0025,0.2004] (bu koşuda sıfırı DIŞLIYOR, anlamlı) — ama önceki bir B=500 koşusunda GA=[-0.0020,0.1909] (sıfırı içeriyor) çıkmıştı. Sınırda katsayılarda B=500'ün bile tam kararlı olmadığının kanıtı." },
    aciklama: "Sahadaki her atın (Accurace geçmişinden, sızıntısız) stil dağılımı + erken hız gücünden saha-geneli beklenen tempo senaryosu (6 sınıf, olasılık dağılımı) çıkarılır, sonra bu atın kendi stiline uygunluğu bir uyum matrisiyle skorlanır. Kapsama %74.7 (n<3 Accurace geçmişi olan atlarda 0/nötr). Diğer segmentte pozitif ve sınırda-anlamlı, düşük-şart'ta pozitif ama anlamsız.",
  },
];

// 2026-08-28 — SİLİNEN 11 sinyal (arşiv amaçlı, artık toFeatureVector'da/A katmanında
// değil): accurace, formEgimi, formEgimi2, kgs (ham), kgs2, pistUzmani, galop,
// uzunAraGalopKatkisi, agfYukselisVarMi, agfDususVarMi. Hepsi B=500'de İKİ segmentte de
// GA sıfırı içeriyordu. Ham alanlar Faz1RunnerV5/arac-model-veri-olustur.mts'de hâlâ
// toplanıyor (maliyetsiz), yalnız skorlamadan çıkarıldı — ileride farklı formülasyonla
// yeniden test edilebilir. (sireOrani bu listeden 2026-08-30'da B katmanı istisnası
// olarak çıkarıldı — yukarıdaki CANLI_SINYALLER girdisine bakınız.)
//
// 2026-08-29/30 — Bu 11 sinyal, "en baştan sinyal araştır" talebiyle V5 penceresinde
// (249-253 koşu) B=500 MODEL-FARKI testiyle TEKRAR denendi: 7'si (accurace, formEgimi+2,
// kgs+2, pistUzmani, galop, agfYukselisVarMi+agfDususVarMi) yine katkısız çıktı — ama VIF
// kontrolüyle bunun "A katmanı tarafından zaten yakalanmış olma" değil, küçük örneklemde
// (n≈251) güç yetersizliği olduğu netleşti (hepsi VIF 1.0-1.2, neredeyse tam bağımsız).
// uzunAraGalopKatkisi küçük ama gerçek bir logloss-only etki gösterdi (henüz B katmanına
// eklenmedi, izlemede). sireOrani ilk testte güçlü çıktı (top3 +6.9pp, GA sıfırı dışlıyor)
// ama kalıcı araçla (n=1060, gerçek train/test) yeniden test edilince ANLAMSIZ çıktı —
// küçük örneklemin (V5 penceresi) yanıltıcı olduğu bir örnek daha.

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
// vermelisin." (V5.24) — üçü de tek bir ortak anahtarla (GOSTERIM_SIRASI_DUZELTMELERI_AKTIF
// = false) kapatılmıştı.
//
// 2026-08-30 — kullanıcı üçünü TEK TEK yeniden değerlendirdi, ortak anahtar ÜÇE bölündü
// (AGF_TREND_TERFISI_AKTIF/AGF_FAVORI_ILK3_GARANTISI_AKTIF/DERIN_LONGSHOT_DUZELTMESI_AKTIF,
// bkz. v5-engine.ts): AGF Trend Terfisi GERİ AÇILDI (Kocaeli-tipi çakışmaya yol açmaz —
// koşulsuz değil, adayın olasılığı diğerleriyle yarışır), diğer ikisi KAPALI KALDI (biri
// tam olarak Kocaeli'deki koşulsuz-favori-zorlama davranışının kendisi, diğerinin artık
// istatistiksel kanıtı da yok).
export const SIRALAMA_KURALLARI: SiralamaKurali[] = [
  {
    ad: "AGF Trend Terfisi",
    etiket: "GERİ AÇILDI (2026-08-30, V5.28+) — BUG DÜZELTİLDİ (2026-09-02, V5.38)",
    aciklama: "En çok yükselen/düşen AGF trendini taşıyan + yeterli sinyal sayısına (≥4) sahip atlar, ham sıralamada geride kalsa bile ilk-3'e/ilk-6'ya terfi eder. 2026-08-27'de diğer ikisiyle birlikte kapatılmıştı (Kocaeli 2.Koşu örneği), 2026-08-30'da geri açıldı. GERÇEK BİR BUG (2026-09-02'de bulundu, arac-tam-at-inceleme.mts ile THEATER OF WAR incelemesi sırasında): eski uygulama 'adayın olasılığı diğerleriyle yarışır' ilkesiyle çalışıyordu (terfiPenceresiV5), ama girdi ZATEN olasılığa göre sıralı geldiği için pencere dışındaki hiçbir aday hiçbir doğal sakini matematiksel olarak geçemiyordu — bu kural 2026-08-30'dan 2026-09-02'ye kadar SESSİZCE HİÇ ÇALIŞMAMIŞ, terfiEdenNolar HER ZAMAN boş dönmüş (sentetik testle doğrulandı: düzeltme öncesi/sonrası aynı senaryoda agfTerfi hep null'dan gerçek terfiye geçti). Düzeltme: agfFavoriIlk3Garantisi ile aynı ilke — en güçlü aday, pencerenin en zayıf sakinini KOŞULSUZ yerinden alır (yalnız o tek sakin değişir, güçlü sakinler asla elenmez).",
    backtestOzet: "n=663 → %21.6 galibiyet / %53.8 top3 — bu rakam V4'ün ORİJİNAL (çalışan) mekanizmasından. V5 portundaki 2026-08-30→2026-09-02 arası GERÇEKTE UYGULANMIYORDU (yukarıya bak). 2026-09-02'den itibaren düzeltilmiş haliyle GEÇERLİ ve UYGULANIYOR — güncel veriyle toplu backtest henüz YAPILMADI (yalnız sentetik doğrulama).",
  },
  {
    ad: "Saf Model Değer Terfisi",
    etiket: "YENİ (2026-09-02, V5.38)",
    aciklama: "Saf Model (marketBlindProb1, AGF'siz) ile AGF payı arasındaki fark ≥5pp VE yeterli sinyal sayısı (≥4) varsa, at ham sıralamada geride kalsa bile ilk-6'ya KOŞULSUZ terfi eder (agfFavoriIlk3Garantisi/düzeltilmiş agfTrendTerfisi ile aynı splice ilkesi). THEATER OF WAR vakasından doğdu (İstanbul, Saf Model 4.sıra/%10.2 derken AGF payı %5.0'a gömüp nihai skoru 8.sıraya düşürmüştü, at günün en iyi performanslarından birini verdi). Kullanıcı kararı: 'olumlu sinyaller varken agf piyasaya göre at aşağılara çekilmemeli en azından 6. at dışına atılmamalı.'",
    backtestOzet: "Kullanıcı kararıyla backtest İSTENMEDEN doğrudan canlıya alındı (zeminToleransi/yakınsama/yarisGidisatiSkoru ile aynı türden bilinçli istisna). Yalnız sentetik doğrulama: THEATER OF WAR'ı taklit eden senaryoda (fark=5.3pp, sinyalSayisi=4) doğal 8. sıradaki aday 6. sıraya taşındı, 1-5. sıradaki güçlü sakinler dokunulmadı.",
  },
  {
    ad: "AGF Favorisi İlk-3 Garantisi",
    etiket: "KAPALI (2026-08-27, V5.24, kesin karar — 2026-08-30'da yeniden değerlendirilip KORUNDU)",
    aciklama: "AGF sırası=1 olan at, ham olasılık sıralamasında top3 dışında kalsa bile KOŞULSUZ 3.sıraya alınıyordu. Kocaeli 2.Koşu örneğiyle kullanıcı kesin karar verdi: sıralama İSTİSNASIZ yüzdeye göre. 2026-08-30'da AGF Trend Terfisi'yle birlikte yeniden gündeme geldi ama BİLEREK kapalı bırakıldı — bu, Kocaeli'deki (AGF favorisini modelin yüzdesine bakmadan koşulsuz zorlama) davranışın ta kendisi.",
    backtestOzet: "n=428 → net +5 yarış (top3 %60.0→%61.2). Kanıt hâlâ geçerli sayılıyor, ama prensip gerekçesiyle uygulanmıyor.",
  },
  {
    ad: "Derin AGF-Longshot Düzeltmesi",
    etiket: "KAPALI (2026-08-27, V5.24, kesin karar — 2026-08-30'da istatistiksel kanıt da geçersiz bulundu)",
    aciklama: "Sistemin ham #1'i AGF sırası≥4 (piyasanın neredeyse hiç güvenmediği bir at) olduğunda, modelin kendi AGF≤3 içindeki en iyi adayıyla yer değiştiriyordu. Bu KURAL, Kocaeli 2.Koşu'da MAŞİDE'yi (ham #1, %23.5) TEYZEOĞLU (%11.1) ile yer değiştirmişti — kullanıcı bunu somut örnekte görüp KESİN reddetti.",
    backtestOzet: "Orijinal: n=448 → net +20 yarış. Güncel/tazelenmiş veriyle (1042 yarış) tekrar test edildiğinde net etki artık istatistiksel olarak kanıtlanamıyor (GA=[-3,11], sıfırı içeriyor) — hem prensip hem artık kanıt da yok, uygulanmıyor.",
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
    durum: "reddedildi",
    etiket: "Yeniden test edildi (n=553) · reddedildi",
    aciklama: "Bugünkü ikramiye, önceki yarışın ≤%70'iyse \"sınıf düşüşü\" say. Standalone fark gerçek ve VIF temiz (1.006, confounding yok) — 2026-08-31'de Opus'un n=553 pozitif vakayla (test zamanı n=418'di) yeniden çalıştırdığı testte 13. terim olarak eklenince katkı sıfıra çakılı (nokta +0.0087) VE 5-kat CV'de top1/top3/logloss'un ÜÇÜ DE anlamlı şekilde KÖTÜLEŞTİ (GA'ları sıfırı dışlıyor) — modeli gerçekten bozuyor, yalnız 'katkısız' değil.",
    metrik: "nokta +0.0087 · GA=[-0.097,0.100] · n=553 pozitif vaka (diğer segment) · CV top1/top3/logloss üçü de anlamlı kötü",
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
  {
    ad: "AGF Trend (agfYukselisVarMi/agfDususVarMi) — agfPayi/agfPayi²'nin YERİNE",
    durum: "reddedildi",
    etiket: "Adil kıyas · reddedildi",
    aciklama: "2026-08-31 kullanıcı talebi: agfPayi/agfPayi²'nin VIF sorunu (bkz. CANLI_SİNYALLER) yüzünden V5.27'de silinen agfYukselisVarMi/agfDususVarMi (agfFark eşik≥1.0 puan) geri getirilip payı/²'nin YERİNE kondu. Aynı test setinde adil kıyas: 'diğer' segmentte top1 %35.0→%32.5 (-2.5pp), top3 %67.3→%66.6, logloss kötüleşti — agfPayi sürekli/dereceli piyasa bilgisi taşıyor, agfTrend yalnız ikili eşik, DEĞİŞTİRMEK bilgi kaybı.",
    metrik: "Diğer segment (n=719 test): top1 -2.5pp, top3 -0.7pp, logloss +0.022 (üçü de kötü)",
  },
  {
    ad: "AGF Trend (agfYukselisVarMi/agfDususVarMi) — agfPayi/agfPayi²'nin ÜSTÜNE EKLEME",
    durum: "reddedildi",
    etiket: "B=500 bootstrap · reddedildi",
    aciklama: "Değiştirme işe yaramayınca kullanıcı kararıyla EKLEME denendi (12→14 özellik, agfPayi/² korunarak). Sonuç: agfPayi/² zaten modeldeyken agfTrend'in kendi katkısı istatistiksel anlamlılığını kaybediyor (GA sıfırı içeriyor) — AGF trend ve AGF payı büyük ölçüde AYNI piyasa bilgisini taşıyor, biri diğerinin üstüne gerçek ek bilgi eklemiyor. Aynı test setinde top1/top3/logloss farkı ihmal edilebilir (ne zarar ne kazanç).",
    metrik: "Diğer: agfYukselisVarMi nokta=0.0965 GA=[-0.0125,0.2098] ⚠ · agfDususVarMi nokta=0.0505 GA=[-0.0464,0.1486] ⚠ (ikisi de sıfırı içeriyor)",
  },
  {
    ad: "Büyük Saha (10+ At) İçin Ayrı Segment",
    durum: "reddedildi",
    etiket: "Adil kıyas + B=500 · reddedildi",
    aciklama: "Kullanıcı gözlemi: 12+ atlık sahalarda hem model hem AGF sırası top-6'da gerçek kazananı %16.8 oranında kaçırıyor (küçük sahada %0.6). Düşük-şart/diğer ayrımıyla AYNI mimaride üçüncü bir segment (10+ at, kendi retrain'i + jokeyOrani/onGrupArkasiMi adayları) denendi. Bootstrap'ta jokeyOrani (nokta=0.041, GA sıfırı içeriyor) ve onGrupArkasiMi (nokta=0.025, GA sıfırı içeriyor) İKİSİ DE anlamsız çıktı — ayrıca AYNI test yarışlarında mevcut TEK 'diğer' modeli, 3-segment adayından top1'de 3.9pp DAHA İYİ (816 koşuluk havuzu ikiye bölmek her parçayı daha az veriyle/daha gürültülü eğitiyor).",
    metrik: "Pooled (n=204 test): mevcut top1=%34.3 vs 3-segment top1=%30.4 (-3.9pp)",
  },
  {
    ad: "Yakınsama (Çoklu Zayıf Sinyalin Aynı Atta Hizalanması)",
    durum: "reddedildi",
    etiket: "B=500 bootstrap (5 bileşen) · istatistiksel olarak reddedildi AMA sonradan kullanıcı kararıyla CANLI'ya eklendi",
    aciklama: "MEGAFAUNA vakası (model 8./%4, gerçek kazanan) üzerinden kullanıcı hipotezi: pist uzmanlığı+sınıf düşüşü(ikramiye bazlı)+at-jokey ikilisi+AGF trend+pedigri gibi TEK TEK zayıf/anlamsız sinyaller AYNI ATTA hizalandığında gerçek ek bilgi taşıyabilir. Basit tek-geçişlik tabloda umut verici göründü (top6-dışı atlarda yakınsama≥2: %5.00 kazanma vs %2.43 baseline, ~2x) ama 13. özellik olarak tam koşullu-logit + B=500 bootstrap'a sokulunca İKİ segmentte de anlamsız çıktı — tekil çarpıcı vakalar (MEGAFAUNA) genele YANSITILAMIYOR, yakınsama grubundaki 1544 attan çoğu kazanmadı. NOT (2026-09-01): istatistiksel sonuç DEĞİŞMEDİ ama kullanıcı zeminToleransi/sireOrani ile AYNI türden bilinçli bir istisna olarak eklenmesini istedi — düzeltilmiş (isme göre, tjkAtId boşluğu giderilmiş) tanımlarla YENİDEN eğitildi, gerçek katsayılar CANLI_SİNYALLER'de.",
    metrik: "İlk test (tjkAtId'ye göre, kısmen eksik): Diğer nokta=0.0337 GA=[-0.0555,0.1146] ⚠ · Düşük-şart nokta=0.0428 GA=[-0.0996,0.1622] ⚠. Düzeltilmiş/canlı: Diğer nokta=0.0417 GA=[-0.0405,0.1197] ⚠ · Düşük-şart nokta=-0.0280 GA=[-0.1535,0.0756] ⚠ (n=10506 at, 1544'ü 2+ hizalanma)",
  },
];

// 2026-09-01 — Yukarıdaki "Yakınsama" testinin BİLEŞENLERİ (pist uzmanlığı, sınıf
// durumu/ikramiye trendi, at-jokey ikilisi, AGF trend, pedigri kYuzde), skora hiç
// katılmadan, /program sayfasının "Son Yarış Detayları" panelinde (SonYarisDetayPanel.tsx,
// hizli-ozet.actions.ts) GÖSTERİM AMAÇLI tutuldu — kullanıcı MEGAFAUNA gibi vakaları
// ELLE tararken hız kazansın diye. Bu satır istatistiksel bir "kabul" değil, yalnız
// nerede kullanıldığının referansı.
