import { db } from "@/lib/db";

/**
 * v6.103 — kullanıcı kararı 2026-08-11: "bunu sistematik olarak dashboarda da ekle, analiz
 * motoru versiyonu başlık ve altında nelerin analiz edildiği hangi çaprazlamaların
 * kullanıldığı bölüm bölüm oluştur karşılaştırma yapalım, başarı oranını da belirterek."
 *
 * Versiyon sınırları UYDURULMADI — bu dosyadaki her tarih/saat, git log'daki gerçek commit
 * zaman damgasından alındı (v2-engine.ts'e dokunan commit'ler; `git log --format="%ai"
 * <hash>`). "Neyi analiz ediyor" / "çaprazlamalar" alanları o dönemde gerçekten canlı olan
 * kod-garanti fonksiyonlarını özetler, tahmini/genel bir açıklama değildir.
 *
 * Başarı oranı hesaplaması `analiz-performans.service.ts` ile AYNI kaynağı kullanır
 * (Result.hitTop1/hitInCoupon, yalnız published:true) — yalnız pencere TARİHE göre değil
 * VERSİYON aralığına göre bölünür. Ek Claude çağrısı yok.
 */

export type EngineVersionTanimi = {
  versiyon: string;
  baslangic: Date;
  bitis: Date | null; // null = hâlâ güncel
  aciklama: string;
  neyiAnalizEdiyor: string[];
  caprazlamalar: string[];
};

export const ENGINE_VERSIONS: EngineVersionTanimi[] = [
  {
    versiyon: "V2",
    baslangic: new Date("2026-08-04T06:33:39+03:00"), // 2f903ac — V2 motoru gerçek admin akışına bağlandı
    bitis: new Date("2026-08-09T22:35:09+03:00"),
    aciklama: "V1-V22 kod-garanti sistemi ilk kez gerçek admin akışına bağlandı (Faz3 yok, manuel sıralama).",
    neyiAnalizEdiyor: [
      "V1-V22: pedigri, idman/split, takı, kilo, sınıf geçişi (SKK), form dizisi, H2H, AGF, stil-popülasyon uyumu, zemin-kazanma geçmişi",
      "A-E ek kategoriler (kalite denetimi, kaçırma uyarıları)",
    ],
    caprazlamalar: [
      "V10+V12 (stil-popülasyon uyumu)",
      "V21+V4 / V21+V19 / V21+V6 (AGF hareketi + destekleyici sinyal)",
      "V13+V10 (kilo değişimi + stil)",
      "Kod-garanti mekanik enjeksiyon: V1, V4, V5, V14, V19, V20, V22",
    ],
  },
  {
    versiyon: "V2.1",
    baslangic: new Date("2026-08-09T22:35:09+03:00"), // 30f3169 — motor sürümü V2.1 etiketlendi
    bitis: new Date("2026-08-10T17:03:34+03:00"),
    aciklama: "Karar hiyerarşisi koşulsuz zorunlu kılındı; AGF trend + AGF favorisi düşüş garantileri eklendi. (Bu aralık içinde kısa ömürlü V2.2 yapılandırılmış-muhakeme denemesi de vardı, mimari nedenle geri alındı — bkz. memory, sonuç istatistiklerini etkilemez.)",
    neyiAnalizEdiyor: ["V1-V22 (V2 ile aynı kapsam)"],
    caprazlamalar: [
      "Karar hiyerarşisi: Güçlü Aday > Düşük Risk > Orta Risk > Yüksek Risk (koşulsuz)",
      "AGF trend (yükselen/düşen) + güçlü sinyal (V1/V19/V22) → ilk 2'ye koşulsuz terfi",
      "AGF trend (tek başına) → ilk 4'e terfi",
      "Sahadaki GERÇEK AGF lideri, düşüşe rağmen hâlâ favoriyse → ilk-3 garantisi (TÜRKÖREN dersi)",
    ],
  },
  {
    versiyon: "V3",
    baslangic: new Date("2026-08-10T17:03:34+03:00"), // 75f8669 — motor V2.1'den V3'e adlandırıldı
    bitis: new Date("2026-08-10T23:31:26+03:00"),
    aciklama: "X1-X7 çapraz-okuma etiketleri eklendi; V3 (takı) ve V4 (aynı jokey) AGF-trend güçlü-sinyal setine dahil edildi; V21 (AGF) iddiası yumuşatıldı.",
    neyiAnalizEdiyor: ["V1-V22 + X1-X7 çapraz-okuma etiketleri"],
    caprazlamalar: [
      "AGF-trend güçlü-sinyal seti: V1, V3 (takı), V4 (aynı jokey), V19, V22",
      "X1-X7 çapraz-okuma (birden fazla V-kodunun birlikte doğrulama/çelişki taraması)",
      "V2.1'in tüm terfi/hiyerarşi kuralları korunur",
    ],
  },
  {
    versiyon: "V3.1",
    baslangic: new Date("2026-08-10T23:31:26+03:00"), // 689e0fb — AGF statik top-3 terfi garantisi
    bitis: new Date("2026-08-14T16:25:28+03:00"),
    aciklama: "AGF statik (güncel) sıraya dayalı iki yeni kod-garanti kuralı eklendi — CEVATHAN/CANYAMAN vakalarının (AGF top-3 ama sistemde 8.sıra) geriye dönük analiziyle doğrulandı.",
    neyiAnalizEdiyor: ["V1-V22 + X1-X7 (V3 ile aynı kapsam)"],
    caprazlamalar: [
      "AGF statik top-3 (güncel AGF'ye göre) + sistemde >=7.sıra → 4-6 penceresine terfi (n=66 doğrulama: %15.2 galibiyet/%37.9 ilk-3, kontrol grubu %3.9/%13.0)",
      "1.sıra AGF top-3 kümesine sabitlenir — yalnız aday ile eski 1.sıra yer değiştirir, aradaki atlar (değer atları) yerinden oynamaz (n=104 doğrulama: top-3 içi %30.0 vs top-3 dışı %5.9 galibiyet)",
      "AGF trend + ≥2 güçlü V-kodu → ilk-3 kuralı ayrıca test edildi, eşik değiştirilmedi (veri desteklemedi)",
    ],
  },
  {
    versiyon: "V4",
    baslangic: new Date("2026-08-14T16:25:28+03:00"), // d424b44 — V4 motoru canlı admin akışına bağlandı
    bitis: new Date("2026-08-16T00:11:08+03:00"), // 54cb73c — V5 motoru canlıya alındı
    aciklama: "V1-V22'nin geniş, Claude'un serbest muhakeme ettiği sistemi tamamen kaldırıldı. Faz1 yalnız 6 bağımsız, geriye dönük doğrulanmış sinyali (AGF trend yönü, Accurace en hızlı son 200m kapanışı, son yarış galibiyeti, KGS 14-30 gün, hipodrom+pist+mesafe uzmanlığı, aygır üst-%20) + jokey istatistiğini toplar. Faz2 Claude çağrısı yapmaz, sinyaller okunarak tamamen mekanik sıralanır — maliyet sıfıra iner.",
    neyiAnalizEdiyor: [
      "6 doğrulanmış sinyal: AGF trend yönü, Accurace en hızlı son 200m kapanışı, son yarış galibiyeti, KGS 14-30 gün, hipodrom+pist+mesafe uzmanlığı, aygır üst %20 K%",
      "Jokey/antrenör genel win% + aynı-jokey sürekliliği (destek, sayaca dahil değil)",
    ],
    caprazlamalar: [
      "Birincil sıralama: aynı anda taşınan sinyal sayısı (azalan)",
      "4+ sinyal → doğrudan ilk-3 bandı (n=575, %29.7 galibiyet, GA %26.1-33.6 / %60.3 ilk3, 2026-08-13/14 backtest)",
      "İlk-3 içinde: AGF trend + Accurace ikisi birden olan atlar öncelikli, tie-break güncel AGF sırası",
    ],
  },
  {
    versiyon: "V5",
    baslangic: new Date("2026-08-16T00:11:08+03:00"), // 54cb73c — V5 motoru canlıya alındı
    bitis: new Date("2026-08-19T21:15:34+03:00"), // 01f154a — agfPayi eklenip V5.1'e geçildi
    aciklama: "V4'ün mekanik sinyal-sayım/eşik sistemi tamamen kaldırıldı. Koşullu logit (Plackett-Luce / yarış-gruplu softmax) modeli 18 sürekli/ikili özelliği TEK skorda birleştirip atları doğrudan kıyaslar (eşiklerle kutulamaz). 830 koşuluk kronolojik train/test + bootstrap güven aralığıyla doğrulandı, V4 ile aynı test kümesinde canlı A/B kıyaslandı. Claude çağrısı yok, maliyet sıfır. (2026-08-17: kacakAtMi + dususAmaIyiPozisyon eklenip 16→18 özelliğe çıkarıldı, aşağıdaki rakamlar bu son eğitimden.)",
    neyiAnalizEdiyor: [
      "18 özellik: AGF sırası+favorisi+eşik-bazlı yükseliş, Accurace, form eğimi, KGS, pist uzmanlığı, aygır/jokey/antrenör kazanma oranı (shrinkage), keskin galop, idman jokeyi uyumu, uzun-ara galop sayısı, kaçak at (tempo/koşu stili), düşüşe rağmen iyi AGF pozisyonu (para akışı sinyali)",
      "V4'ün AGF-trend terfi mekanizması (trend+4sinyal→ilk-3, trend tek başına→ilk-6) aynen taşındı, skor/olasılığı değiştirmez",
    ],
    caprazlamalar: [
      "Test (n=208, hiç görülmemiş): top1 %35.6 (GA %29.3-42.3), top3 %66.8 (GA %60.1-73.6) — V4'ün top1 %24.2/top3 %55.1'ini net geçiyor, GA'lar V4 rakamlarını içermiyor. Eğitim (n=622): top1 %40.2, top3 %75.1",
      "Anlamlı (bootstrap GA sıfırı dışlıyor): agfSirasi, sireOrani, jokeyOrani, antrenorOrani, agfFavorisiMi (+0.08), agfYukselisVarMi (+0.18), kacakAtMi (+0.09), dususAmaIyiPozisyon (+0.13); aynı jokey sürekliliği/takı değişikliği/sınıf geçişi×uzun-ara/düşüş×temel-güç — hepsi anlamsız çıktı, modele DAHİL EDİLMEDİ",
      "Banko Adayı eşiği ham olasılığa göre %40 (V4'ün karar-metni eşleşmesinden farklı, kendi backtest'i: n=296/826, %53.7 isabet)",
    ],
  },
  {
    versiyon: "V5.1",
    baslangic: new Date("2026-08-19T21:15:34+03:00"), // 01f154a — agfPayi eklendi, agfFavorisiMi çıkarıldı
    bitis: new Date("2026-08-21T21:18:57+03:00"), // 846293b — sireOrani eğitim-zamanı sızıntısı düzeltildi, V5.2
    aciklama: "BODUBEY (İstanbul K5) ve EL LEON (Elazığ K3) — ikisi de AGF favorisi ama zayıf aygır profiliyle sistemde çok düşük sıraya düşmüştü, ikisi de kazandı. Kapsamlı kalibrasyon denetiminde zayıf-aygırlı-favori grubunda model +5.1 puan hafife alıyordu; üç düzeltme denemesi (aygır×AGF etkileşimi, kare terimler, L2 gevşetme) başarısız oldu. Kök neden: agfFavorisiMi yalnız SIRAYI yakalıyordu, AGF payının BÜYÜKLÜĞÜNÜ değil. Ham AGF payı ayrı özellik eklenince (+0.25, anlamlı) kalibrasyon farkı +1.2 puana düştü. Aynı gün ikinci bir aday ('agfFarkiIkinciye', 2.'ye dominans farkı) da denendi, resmi eğitimde SINIRDA çıktı ve EL LEON'u (rakibinden 4.27 puan önde olmasına rağmen) CEZALANDIRDIĞI görülünce çıkarıldı — yalnız agfPayi kaldı. Ayrıca %80+ tahmin diliminde bulunan aşırı-güvene (n=78, tahmin %88.1 vs gerçek %67.9) koşullu sıcaklık ölçeklendirmesi eklendi — top1/top3'ü değiştirmeden yalnız uç mutlak olasılığı yumuşatır. Aynı gün ayrıca SHINNY vakası: 'dususAmaIyiPozisyon' (agfFark<=-1.0 VE agfSirasi<=4) yalnız ilk-4'teki düşüşleri sayıyordu, ilk-4 dışındaki anlamlı düşüşler hiç yakalanmıyordu — pozisyon şartı kaldırılıp 'agfDususVarMi' (agfYukselisVarMi ile simetrik) oldu, top3 %68.3→%70.2 ve log-loss 1.7695→1.7617 iyileşti.",
    neyiAnalizEdiyor: [
      "18 özellik: V5'in 18'i minus agfFavorisiMi (yalnız SIRA), artı agfPayi (ham AGF yüzdesi) — sayı aynı kaldı, biri çıktı biri girdi",
      "Softmax'a koşullu sıcaklık ölçeklendirmesi (yalnız lider zaten %70+ ise T=1.5) — sıralama korunur, yalnız aşırı-uç olasılık yumuşar",
      "agfDususVarMi (eski adıyla dususAmaIyiPozisyon) artık pozisyon şartsız — ilk-4 dışındaki anlamlı düşüşler de sayılır",
    ],
    caprazlamalar: [
      "Test (n=208, hiç görülmemiş): top1 %38.0 (GA %31.7-44.2), top3 %70.2 (GA %63.9-76.4), log-loss 1.7617 — V5'in top1 %35.6/top3 %66.8/logloss 1.7828'ini geçiyor. Eğitim (n=622): top1 %41.3, top3 %75.9",
      "Anlamlı: agfSirasi, sireOrani, antrenorOrani, agfPayi (+0.26) — agfYukselisVarMi/agfDususVarMi resmi B=50'de sınırda ama üç metrik (top1/top3/logloss) BİRDEN aynı/iyileşti ve yön ham AGF Trend istatistiğiyle (düşenler %13.8 vs saha %10.3) tutarlı",
      "Zayıf-aygırlı-AGF-favorisi kalibrasyon farkı: V5'te +5.1 puan → V5.1'de +1.2 puan (n=1165/274)",
    ],
  },
  {
    versiyon: "V5.2",
    baslangic: new Date("2026-08-21T21:18:57+03:00"), // 846293b — sireOrani eğitim-zamanı sızıntısı düzeltildi
    bitis: new Date("2026-08-21T21:43:19+03:00"), // a04309d — segment-bazlı iki-model mimarisi, V5.3
    aciklama: "sireOrani (aygır kazanma oranı), eğitim verisinde her zaman GÜNCEL (SireStatOwn — günlük tam yeniden hesap, tarih filtresi yok) tablodan okunuyordu. Canlı tahmin için doğruydu (bugüne kadarki en güncel bilgiyi kullanmak istenen davranış) ama geçmiş eğitim satırları için gerçek bir sızıntıydı — Temmuz'daki bir koşunun sireOrani'si Ağustos sonuçlarını da içerebiliyordu. MR TT vakası (İstanbul K3, gerçek kazananın modelde 6.sıraya düşmesi) sonrası yapılan literatür araştırması sireOrani'nin akademik/sektör normlarına göre atipik derecede baskın olduğunu işaret edince kök nedene inildi. Düzeltme: kendi Runner/Result verimizden, yalnız o koşudan KESİNLİKLE önceki tarihli kayıtlarla (irk|pist|mesafe|aygır adı anahtarıyla tek seferlik indekslenip) hesaplanıyor. jokeyOrani/antrenorOrani (TJK'nın uzun-vadeli resmi kaynağı) İZOLE test için değiştirilmedi — kendi verimize çevirmek hem sızıntıyı düzeltiyor hem örneklemi ~7 haftaya küçültüyordu, ikisi ayrıştırılamadığı için kullanıcı kararıyla yalnız sireOrani düzeltildi.",
    neyiAnalizEdiyor: [
      "V5.1 ile aynı 18 özellik, aynı isim/sıra — yalnız sireOrani'nin EĞİTİM verisi tarihe-duyarlı hale geldi (canlı tahmin hesaplaması değişmedi)",
    ],
    caprazlamalar: [
      "Test (n=234, hiç görülmemiş): top1 %30.8 (GA %24.8-37.6), top3 %66.7 (GA %60.7-73.1), log-loss 1.8298 — V4 temel çizgisini (top1 %24.2/top3 %55.1) hâlâ GA dışında geçiyor",
      "sireOrani katsayısı +0.608'den +0.043'e düştü, artık ANLAMSIZ (GA sıfırı içeriyor) — literatür beklentisiyle (pedigri, form kanıtı biriktikçe zayıflayan bir önsel) uyumlu",
      "V5.1'in %35.4/%71.6 rakamları da AYNI sızıntıdan şişmişti (test dönemi koşuları için de sireOrani 'bugüne kadarki' veriden hesaplanıyordu) — doğrudan karşılaştırılabilir değil, V5.2'nin %30.8/%66.7'si daha dürüst bir referans noktası",
      "Anlamlı kalan: agfSirasi, idmJokey, jokeyOrani, antrenorOrani, agfYukselisVarMi, kacakAtMi, agfPayi",
    ],
  },
  {
    versiyon: "V5.3",
    baslangic: new Date("2026-08-21T21:43:19+03:00"), // a04309d — segment-bazlı iki-model mimarisi canlıya alındı
    bitis: new Date("2026-08-21T23:17:46+03:00"), // 8b620d0 — H2H sinyali eklendi, V5.4
    aciklama: "Kullanıcı kararı: sireOrani şartlı1/19/27+maiden koşularında, AGF trend (agfYukselisVarMi/agfDususVarMi) diğer koşularda ağırlıklı olmalı — literatür (TwinSpires pedigri-handikapçılık rehberi: pedigri, atın kendi kanıtlanmış formu yokken bir önsel görevi görür) bu yönü destekliyor. İki ayrı test çalıştırıldı: (1) ortak modelde sireOrani/agfYukselisVarMi/agfDususVarMi'yi segment×sinyal etkileşim terimine bölmek, (2) hiçbir paylaşımlı regularizasyon olmadan iki TAMAMEN AYRI model eğitmek (seyreltmesiz, en güçlü test). İkisi de YÖNÜ doğruladı — düşük-şart segmentte sireOrani'nin nokta tahmini diğer segmentten yaklaşık iki kat yüksek (+0.064 vs +0.035, ayrı-model testinde) — ama HİÇBİR testte istatistiksel anlamlılığa ulaşmadı (n=240 düşük-şart koşusu, %95 GA'lar geniş ve çakışıyor). Kullanıcı bu belirsizliğe rağmen segment-bazlı mimarinin canlıya alınmasına karar verdi.",
    neyiAnalizEdiyor: [
      "V5.2 ile aynı canlı Faz1 veri toplama (gatherFaz1V5) HİÇ DEĞİŞMEDİ — yalnız Faz2'nin skorlama ağırlıkları, koşunun kategorisine (kategoriTespit: 1a=Şartlı1/27, 1b=Maiden/Şartlı19, diğerleri=diger) göre iki tam ayrı eğitilmiş model arasında seçiliyor",
      "v5-weights-dusuksart.json: yalnız şartlı1/19/27+maiden koşularında (n=240) eğitildi — test (n=60): top1 %33.3, top3 %70.0, log-loss 1.8848",
      "v5-weights-diger.json: geri kalan tüm koşularda (n=693) eğitildi — test (n=174): top1 %29.9, top3 %64.4, log-loss 1.8298",
    ],
    caprazlamalar: [
      "sireOrani: düşük-şart modelinde nokta=+0.064 (GA=[-0.151,0.224], anlamsız), diğer modelde nokta=+0.035 (GA=[-0.074,0.130], anlamsız) — yön tutarlı, anlamlılık yok",
      "agfYukselisVarMi/agfDususVarMi: her iki segmentte de anlamsız çıktı, beklenen (diğer segmentte daha güçlü) yön DOĞRULANMADI",
      "Düşük-şart modeli yalnız 180 koşuyla eğitildi — overfitting riski normalden yüksek, örneklem büyüdükçe (birkaç ay sonra) yeniden değerlendirilmeli",
    ],
  },
  {
    versiyon: "V5.4",
    baslangic: new Date("2026-08-21T23:17:46+03:00"), // 8b620d0 — H2H sinyali eklendi
    bitis: new Date("2026-08-22T00:12:10+03:00"), // d402ef2 — hizDerecesi sinyali eklendi, V5.5
    aciklama: "H2H (baş-başa geçmiş karşılaşma) sinyali eklendi, 18→19 özellik. V1-V22'de vardı, V5'in yeniden inşasında hiç dahil edilmemişti — kullanıcı talebiyle araştırıldı. h2hNetSkor = bugünkü sahadaki rakiplerle ortak geçmiş yarışlarda net galibiyet farkı (getH2HForRace, leak-free — yalnız o koşudan ÖNCEKİ TJK kayıtları, ekstra sorgu olmadan zaten toplu çekilen HorseRaceHistoryCache'ten). Segment-bazlı iki-model mimarisinin (V5.3) her iki ağırlık dosyasına da veriden fit edilerek eklendi (manuel override DEĞİL).",
    neyiAnalizEdiyor: [
      "V5.3 ile aynı segment-bazlı mimari (düşük-şart/diğer iki ayrı model) + canlı Faz1 veri toplama — yalnız h2hNetSkor 19. özellik olarak eklendi",
    ],
    caprazlamalar: [
      "h2hNetSkor: diğer segmentte (n=174 test) ANLAMLI (+0.103, GA=[0.027,0.207]); düşük-şart segmentte (n=60 test) küçük-örneklem gürültüsüyle anlamsız/ters yönlü (-0.108, GA=[-0.278,0.065])",
      "Backtest: düşük-şart top1 %33.3→%35.0 (top3 %70.0 aynı, logloss 1.8848→1.8782), diğer top1 %29.9→%31.0 (top3 %67.8 aynı) — ikisi birden iyileşti, hiçbir metrik kötüleşmedi",
    ],
  },
  {
    versiyon: "V5.5",
    baslangic: new Date("2026-08-22T00:12:10+03:00"), // d402ef2 — hizDerecesi sinyali eklendi
    bitis: new Date("2026-08-23T21:41:17+03:00"), // 2a5ee5a — H2H komple çıkarıldı, V5.6
    aciklama: "hizDerecesi (hız/tempo derecesi) eklendi, 19→20 özellik. Literatür (Beyer-tipi hız derecelendirmesi profesyonel modellerde genelde en güçlü tekil sinyal — bizde bu role en yakın adaylar accurace/formEgimi ikisi de anlamsızdı) ışığında araştırıldı. TJK 'At Koşu Bilgileri'ndeki 'süre' alanı AT-BAZLI (gerçek bitiriş süresi, '1.16.30' formatı) — popülasyon (irk|pist|mesafe kovası) ortalama tempo'suna göre, yalnız son 365 GÜN içindeki en yeni 3 koşunun göreli hızı (uzun aradan dönen bir atın yıllar önceki 'en iyi dönemi' güncelmiş gibi kullanılmasın diye). Aynı gün ayrıca accurace'nin 'anlamsız' görünmesinin nedeni araştırıldı: gerçek bir ham sinyal (kazananlarda %15.7 vs genel %8.8, ~1.78x) ama agfSirasi/agfPayi ile güçlü korelasyonlu (-0.19/+0.21) — piyasa zaten fark ediyor, confounding (VIF'te YÜKSEK değil, yalnız marjinal katkısı küçük).",
    neyiAnalizEdiyor: [
      "V5.4 ile aynı segment-bazlı mimari + canlı Faz1 veri toplama — yalnız hizDerecesi 20. özellik olarak eklendi",
      "Yeni src/server/actions/hiz-derecesi.actions.ts: HorseRaceHistoryCache küçük olduğu için (~4000 at) ayrı önbellek tablosu/cron gerekmedi, canlı hesaplanıyor (6 saatli TTL'li modül-içi önbellek — ilk istek ~10-15sn, sonrakiler <1-2sn)",
    ],
    caprazlamalar: [
      "hizDerecesi: HER İKİ segmentte de güçlü ANLAMLI — düşük-şart nokta=+0.5815 (GA=[0.3026,0.9828], modelin en büyük tek katsayısı, agfSirasi'nden bile büyük), diğer nokta=+0.2562 (GA=[0.0886,0.4008])",
      "Tam VIF taraması (18 sinyal, tüm 36439 satır): en yükseği bile (kgsVarMi VIF=2.48) düşük kategoride — hiçbir sinyal bir diğerini gölgelemiyor",
      "Backtest: düşük-şart top1 %35.0/top3 %70.0/logloss 1.8727 (n=60), diğer top1 %31.0/top3 %67.2/logloss 1.8257 (n=174)",
    ],
  },
  {
    versiyon: "V5.6",
    baslangic: new Date("2026-08-23T21:41:17+03:00"), // 2a5ee5a — H2H komple çıkarıldı
    bitis: new Date("2026-08-23T23:05:58+03:00"), // e6f5bda — 19→15 sinyale sadeleştirildi, V5.7
    aciklama: "H2H (h2hNetSkor) sinyali komple çıkarıldı, 20→19 özellik. İzmir 2.Koşu'da GOLDEN CITY'nin (AGF favorisi, bugünkü rakiplerle geçmişte +5 net ÖNDE bitirmiş) H2H için 'risk' etiketi aldığı fark edildi — kontrol: düşük-şart segmentinin canlı ağırlığında h2hNetSkor katsayısı NEGATİF (-0.1524) çıkmıştı, sezgiye tam ters. H2H eklendiğinde zaten 'sınırda' (GA sıfırı içeriyordu) olarak not edilmişti — düşük-şart'ın küçük örneklemi (o zamanki n=180) bu zayıf sinyali yanlış yönde sabitlemiş. 'Diğer' segmentte katsayı doğru yönde (+0.0994, anlamlı) olsa da, kullanıcı kararıyla tutarlılık için HER İKİ segmentten de kaldırıldı.",
    neyiAnalizEdiyor: [
      "V5.5 ile aynı segment-bazlı mimari + canlı Faz1 veri toplama — yalnız h2hNetSkor çıkarıldı",
    ],
    caprazlamalar: [
      "Güncel veriyle doğrulama: düşük-şart h2hNetSkor B=50 GA=[-0.3145,0.0676] hâlâ sıfırı içeriyor (asla sağlam anlamlı olmamış)",
      "Backtest: h2hNetSkor çıkarılınca düşük-şart top1 aynı (%35.0), top3 İYİLEŞTİ (%70.0→%75.0); diğer top1/top3 kayıpsız — net kazanç",
    ],
  },
  {
    versiyon: "V5.7",
    baslangic: new Date("2026-08-23T23:05:58+03:00"), // e6f5bda — 19→15 sinyale sadeleştirildi
    bitis: new Date("2026-08-23T23:38:10+03:00"), // 24319ed — antrenorOrani L2 küçültme, V5.8
    aciklama: "kgs (ham gün sayısı+karesi), pistUzmani, uzunAraGalopKatkisi çıkarıldı, 19→15 özellik. Kullanıcı talebiyle 19 sinyalin her biri tek tek çıkarılıp (leave-one-out ablasyon) tam yeniden eğitildi — bu üçü HER İKİ segmentte de hem bootstrap güven aralığında anlamsız hem ablasyonda çıkarılınca top1/top3'ü neredeyse hiç değiştirmiyordu (kgsVarMi kaldı — diğer segmentte gerçekten anlamlıydı, ham kgs/kgs2 sürekli değerleri gereksizdi). pistUzmani/uzunAraGalopKatkisi alanları Faz1RunnerV5'ten tamamen kaldırıldı.",
    neyiAnalizEdiyor: [
      "V5.6 ile aynı segment-bazlı mimari + canlı Faz1 veri toplama — 15 özellik: agfSirasi, accurace, formEgimi(+karesi), kgsVarMi, sireOrani, galop, idmJokey, jokeyOrani, antrenorOrani, agfYukselisVarMi, kacakAtMi, agfDususVarMi, agfPayi, hizDerecesi",
    ],
    caprazlamalar: [
      "Backtest: düşük-şart top1 aynı (%35.0), top3 -1.7p (%75.0→%73.3); diğer top1/top3 -0.6p — ikisi de gürültü seviyesinde küçük, gerçek doğruluk değişmeden karmaşıklık azaldı",
      "Bonus: agfYukselisVarMi 'diğer' segmentte artık anlamlı (multicollinearity azaldı, GA=[0.0036,0.2037])",
    ],
  },
  {
    versiyon: "V5.8",
    baslangic: new Date("2026-08-23T23:38:10+03:00"), // 24319ed — antrenorOrani L2 küçültme
    bitis: new Date("2026-08-23T23:57:07+03:00"), // e9a21af — antrenorOrani komple kaldırıldı, V5.9
    aciklama: "antrenorOrani'ye ASİMETRİK L2 cezası eklendi (kod DEĞİL, yalnız eğitim script'inde ANTRENOR_L2_EXTRA=0.09) — kullanıcı, MAKE A FIRE/SANAE/ERKOÇUM/RÜZGAR VEYSEL/SOMEBODY LOVES YOU vakalarında antrenorOrani'nin tekrar tekrar en büyük tekil negatif katkı olduğunu gözlemleyip komple çıkarmayı önerdi. Test: komple çıkarmak düşük-şartta top1/top3'ü 5 puan birden düşürdü (gerçek değerli sinyal, çıkarılamaz) — bunun yerine katsayıyı EKSTRA L2 cezasıyla (diğer 14 katsayı serbestçe yeniden ayarlanarak) küçültmek denendi. x5/x10'a kadar top1/top3'te SIFIR kayıpla logloss iyileşti, x20+'de top1/top3 düşmeye başladı — x10 (toplam L2=0.10) güvenli sınır olarak KABUL EDİLDİ.",
    neyiAnalizEdiyor: [
      "V5.7 ile aynı 15 özellik/segment mimarisi — yalnız antrenorOrani'nin eğitimdeki L2 cezası artırıldı, katsayısı küçüldü (düşük-şart 0.3485→0.2868, diğer 0.2537→0.2080), hâlâ HER İKİ segmentte anlamlı",
    ],
    caprazlamalar: [
      "Backtest: düşük-şart top1/top3 aynı (%35.0/%73.3), logloss 1.8797→1.8716; diğer top1/top3 aynı (%31.6/%67.2), logloss 1.8283→1.8241 — ikisi de kayıpsız iyileşme",
      "x20 denemesinde bile MAKE A FIRE/SANAE/ERKOÇUM/BARİ sıralamaları HİÇ değişmedi — antrenorOrani bu atları asıl aşağıda tutan sinyal değildi (agfSirasi/agfPayi/jokeyOrani daha baskındı)",
    ],
  },
  {
    versiyon: "V5.9",
    baslangic: new Date("2026-08-23T23:57:07+03:00"), // e9a21af — antrenorOrani komple kaldırıldı
    bitis: new Date("2026-08-24T00:58:16+03:00"), // fbce87b — V5.6 durumuna geri dönüldü
    aciklama: "antrenorOrani KOMPLE ÇIKARILDI, 15→14 özellik. x10 ve x20 L2 küçültmesi bile MAKE A FIRE/SANAE/ERKOÇUM/BARİ vakalarını hareket ettirmeyince, kullanıcı bu maliyeti (düşük-şart top1/top3 -5 puan, diğer segmentte karışık: top1 +1.7p top3 -1.7p) açıkça görüp yine de komple kaldırılmasını istedi. getTrainerStats/TRAINER_POP_ORT/ANTSTAT gerekçe satırı tamamen kaldırıldı — antrenör istatistiği artık hiçbir şekilde toplanmıyor/kullanılmıyor. NOT: bu versiyondan sonra aynı gün içinde AGF trend'i (agfYukselisVarMi+agfDususVarMi) tek sinyalde birleştirip manuel olarak en baskın katsayı yapma denemesi de yapıldı (BARİ vakasını çözmek için) — bu da işe yaramayınca (aynı eşiği paylaşan 7 attan biri olduğu, kendi hareketinde bile en büyük olmadığı görülünce) kullanıcı kararıyla V5.6'ya geri dönüldü, bu ara denemeler kalıcı bir versiyon numarası almadı.",
    neyiAnalizEdiyor: [
      "V5.8 ile aynı segment-bazlı mimari + canlı Faz1 veri toplama — 14 özellik: agfSirasi, accurace, formEgimi(+karesi), kgsVarMi, sireOrani, galop, idmJokey, jokeyOrani, agfYukselisVarMi, kacakAtMi, agfDususVarMi, agfPayi, hizDerecesi",
    ],
    caprazlamalar: [
      "Backtest: düşük-şart top1 %35.0→%30.0 (-5p), top3 %73.3→%68.3 (-5p); diğer top1 %31.6→%33.3 (+1.7p), top3 %67.2→%65.5 (-1.7p) — kullanıcı kararıyla kabul edilen bilinçli bir maliyet",
    ],
  },
  {
    versiyon: "V5.6",
    baslangic: new Date("2026-08-24T00:58:16+03:00"), // fbce87b — V5.6 durumuna (19 sinyal, H2H'sız) geri dönüldü
    bitis: new Date("2026-08-24T10:01:58+03:00"), // 74e382e — H2H segment-özel geri getirildi
    aciklama: "Kullanıcı kararıyla V5.7/V5.8/V5.9 ve aynı gün içindeki AGF-trend manuel override denemeleri (hepsi antrenorOrani veya AGF trend ile ilgili) geri alındı, tamamen veriden fit edilmiş, hiçbir manuel override İÇERMEYEN son doğrulanmış durağan hale (V5.6) dönüldü. git checkout 2a5ee5a ile v5-engine.ts + iki ağırlık dosyası + arac-model-egit-segment.mjs birebir o commit'teki hâline döndürüldü — bu yüzden versiyon adı da aynı ('V5.6' tekrar).",
    neyiAnalizEdiyor: [
      "19 özellik: agfSirasi, accurace, formEgimi(+karesi), kgs(+karesi), kgsVarMi, pistUzmani, sireOrani, galop, idmJokey, jokeyOrani, antrenorOrani, uzunAraGalopKatkisi, agfYukselisVarMi, kacakAtMi, agfDususVarMi, agfPayi, hizDerecesi — segment-bazlı iki ayrı model (düşük-şart/diğer)",
    ],
    caprazlamalar: [
      "Aynı bu commit setinin ilk yayınında (2a5ee5a) ölçülen sayılar geçerli: düşük-şart top1 %35.0/top3 %75.0/logloss 1.8716; diğer top1 %31.6/top3 %67.2/logloss 1.8241",
    ],
  },
  {
    versiyon: "V5.6b",
    baslangic: new Date("2026-08-24T10:01:58+03:00"), // 74e382e — H2H segment-özel geri getirildi
    bitis: new Date("2026-08-24T12:58:22+03:00"), // ce43452 — Handikap'ta hizDerecesi sıfırlandı
    aciklama: "Kullanıcı önerisi (\"H2H'ı düşük segmentte kullanma diğer segmentte kullanıyosun\"): H2H 20. özellik olarak geri getirildi (20 sinyal), AMA katsayısı YALNIZ düşük-şart ağırlık dosyasında elle sıfırlandı (v5-weights-dusuksart.json: h2hNetSkor=0) — diğer segmentte doğal fit (+0.0994) korundu. Aynı tam-retrain sonrası tek-katsayı-manuel-override deseni, ilk kez BURADA kuruldu (Handikap-hizDerecesi düzeltmesi bu deseni tekrar kullandı).",
    neyiAnalizEdiyor: [
      "20 özellik: V5.6'nın 19'u + h2hNetSkor — segment-bazlı iki model, düşük-şartta h2hNetSkor katkısı elle 0'a sabitlendi",
    ],
    caprazlamalar: [
      "MAKE A FIRE vakası: H2H'sız 3. sıradaydı, H2H eklenince (düzeltmesiz) 7.sıraya düşmüştü — segment-özel sıfırlamayla 5.sıraya geldi (kalan fark, aynı gün içindeki tekrarlı retrain'lerin doğal katsayı driftinden)",
    ],
  },
  {
    versiyon: "V5.10",
    baslangic: new Date("2026-08-24T12:58:22+03:00"), // ce43452 — Handikap'ta hizDerecesi sıfırlandı
    bitis: new Date("2026-08-24T16:15:06+03:00"), // cda5872 — h2hKiloDegisimi + galopTrendFarki eklendi
    aciklama: "Kullanıcı bulgusu: \"sinyaller bu sebeple önemli, çalışan sinyale sahip atların puanları artması gerekmez mi?\" — Handikap (kategoriTespit===\"2\") kendi verisiyle (267 koşu) ayrı eğitildiğinde hizDerecesi'nin katkısı istatistiksel sıfır çıktı (nokta=-0.0177, %95 GA=[-0.2220,0.1782]), pooled diğer-modelin +0.2562'si (3. en güçlü katsayı) bu kategoride yanlış yönlendiriyordu. V5.6b'deki H2H/düşük-şart deseniyle AYNI cerrahi yöntem: yalnız hizDerecesi Handikap'ta sıfırlandı (WEIGHTS_DIGER_HANDIKAP), diğer 19 katsayı/means/stds dokunulmadı.",
    neyiAnalizEdiyor: [
      "V5.6b ile aynı 20 özellik/segment mimarisi — yalnız Handikap (kategori 2) yarışlarında hizDerecesi katkısı 0'a sabitlendi, diğer tüm kategorilerde (Şartlı2-5/Grup-KV/Satış) değişiklik yok",
    ],
    caprazlamalar: [
      "Aynı 67 Handikap test yarışında: pooled model top1=%26.9/top3=%62.7 → hizDerecesi=0 top1=%26.9 (değişmedi)/top3=%67.2 (+4.5p), logloss 1.9917→1.9810 — tam kategori-özel retrain'den (top1=%28.4/top3=%64.2, n=267 overfit riskli) bile daha iyi",
    ],
  },
  {
    versiyon: "V5.11",
    baslangic: new Date("2026-08-24T16:15:06+03:00"), // cda5872 — h2hKiloDegisimi + galopTrendFarki eklendi
    bitis: null,
    aciklama: "İKİ yeni sinyal eklendi (20→22 özellik), İKİSİ DE h2hNetSkor'un ilk kabul barını (\"top1 VE top3 birlikte iyileşti\") KARŞILAMADI — yalnız \"yön tutarlılığı\" (4/4: her iki sinyal her iki segmentte de pozitif) gerekçesiyle kullanıcı kararıyla eklendi, dürüstçe kaydediliyor. (1) h2hKiloDegisimi — SANCAR EFESİ vakası (Bursa K1, 24 Ağu, kazandı): H2H rakiplere karşı bugünkü kilo pozisyonunun geçmiş karşılaşmaya göre değişimi (getH2HForRace'in zaten döndürdüğü H2HResult.weight — ek TJK isteği yok). Düşük-şart nokta=+0.089 GA=[-0.162,0.279], diğer nokta=+0.061 GA=[-0.022,0.164] — İKİSİ DE sıfırı kapsıyor. (2) galopTrendFarki — kullanıcının paylaştığı \"Galop Değişimi\" ekranından: son idman ile bir önceki AYNI mesafedeki (400m) idman arasındaki süre farkı (Gallop.splits, ek istek yok). Düşük-şart nokta=+0.280 GA=[-0.007,0.637] (neredeyse anlamlı), diğer nokta=+0.003 (pratikte sıfır).",
    neyiAnalizEdiyor: [
      "V5.10 ile aynı segment-bazlı mimari + Handikap-hizDerecesi/düşük-şart-h2hNetSkor override'ları KORUNDU — 22 özellik: V5.10'un 20'si + h2hKiloDegisimi + galopTrendFarki",
    ],
    caprazlamalar: [
      "933 yarış, tam retrain + B=200 bootstrap: backtest top1/top3 metrikleri İKİ sinyal için de düz/karışık kaldı (net bir kazanç YOK) — yalnız katsayı işaretinin 4/4 pozitif çıkması kabul gerekçesi. SANCAR EFESİ canlı testte h2hKiloDegisimi=+27.5kg hesaplandı, gerekçe metninde göründü — ama küçük katsayı yüzünden sıralamayı tek başına değiştirmedi (hâlâ 4. sırada), beklenen davranış.",
    ],
  },
];

export type EngineVersionSonuc = EngineVersionTanimi & {
  n: number;
  hitTop1Orani: number;
  hitInCouponOrani: number;
};

export async function getVersiyonKarsilastirmasi(): Promise<EngineVersionSonuc[]> {
  const sonuclar: EngineVersionSonuc[] = [];
  for (const v of ENGINE_VERSIONS) {
    const rows = await db.result.findMany({
      where: {
        race: {
          prediction: {
            published: true,
            createdAt: { gte: v.baslangic, ...(v.bitis ? { lt: v.bitis } : {}) },
          },
        },
      },
      select: { hitTop1: true, hitInCoupon: true },
    });
    const n = rows.length;
    const hitTop1 = rows.filter((r) => r.hitTop1).length;
    const hitInCoupon = rows.filter((r) => r.hitInCoupon).length;
    sonuclar.push({
      ...v,
      n,
      hitTop1Orani: n > 0 ? Math.round((1000 * hitTop1) / n) / 10 : 0,
      hitInCouponOrani: n > 0 ? Math.round((1000 * hitInCoupon) / n) / 10 : 0,
    });
  }
  return sonuclar;
}
