/**
 * ENGINE_VERSIONS'ın saf veri kısmı — v6.103'te analiz-versiyon-karsilastirma.service.ts
 * içindeydi, 2026-08-27'de buraya taşındı: bu dosyanın db (Prisma) importu YOK, bu yüzden
 * hem server hem CLIENT bileşenlerinden güvenle import edilebiliyor (örn. V5AnalysisPanel'in
 * 'Analiz Et'e basmadan ÖNCE de motor sürümünü göstermesi için). analiz-versiyon-
 * karsilastirma.service.ts bu diziyi re-export eder, mevcut importlar DEĞİŞMEDİ.
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
    bitis: new Date("2026-08-24T17:19:18+03:00"), // 3c06e17 — galopTrendFarki sızıntı nedeniyle geri alındı
    aciklama: "İKİ yeni sinyal eklendi (20→22 özellik), İKİSİ DE h2hNetSkor'un ilk kabul barını (\"top1 VE top3 birlikte iyileşti\") KARŞILAMADI — yalnız \"yön tutarlılığı\" (4/4: her iki sinyal her iki segmentte de pozitif) gerekçesiyle kullanıcı kararıyla eklendi, dürüstçe kaydediliyor. (1) h2hKiloDegisimi — SANCAR EFESİ vakası (Bursa K1, 24 Ağu, kazandı): H2H rakiplere karşı bugünkü kilo pozisyonunun geçmiş karşılaşmaya göre değişimi (getH2HForRace'in zaten döndürdüğü H2HResult.weight — ek TJK isteği yok). Düşük-şart nokta=+0.089 GA=[-0.162,0.279], diğer nokta=+0.061 GA=[-0.022,0.164] — İKİSİ DE sıfırı kapsıyor. (2) galopTrendFarki — kullanıcının paylaştığı \"Galop Değişimi\" ekranından: son idman ile bir önceki AYNI mesafedeki (400m) idman arasındaki süre farkı (Gallop.splits, ek istek yok). Düşük-şart nokta=+0.280 GA=[-0.007,0.637] (neredeyse anlamlı), diğer nokta=+0.003 (pratikte sıfır).",
    neyiAnalizEdiyor: [
      "V5.10 ile aynı segment-bazlı mimari + Handikap-hizDerecesi/düşük-şart-h2hNetSkor override'ları KORUNDU — 22 özellik: V5.10'un 20'si + h2hKiloDegisimi + galopTrendFarki",
    ],
    caprazlamalar: [
      "933 yarış, tam retrain + B=200 bootstrap: backtest top1/top3 metrikleri İKİ sinyal için de düz/karışık kaldı (net bir kazanç YOK) — yalnız katsayı işaretinin 4/4 pozitif çıkması kabul gerekçesi. SANCAR EFESİ canlı testte h2hKiloDegisimi=+27.5kg hesaplandı, gerekçe metninde göründü — ama küçük katsayı yüzünden sıralamayı tek başına değiştirmedi (hâlâ 4. sırada), beklenen davranış.",
    ],
  },
  {
    versiyon: "V5.12",
    baslangic: new Date("2026-08-24T17:19:18+03:00"), // 3c06e17 — galopTrendFarki sızıntı nedeniyle geri alındı
    bitis: new Date("2026-08-24T19:50:31+03:00"), // 8b7da14 — AGF favorisi ilk-3 garantisi eklendi
    aciklama: "KRİTİK DÜZELTME: galopTrendFarki'yi hesaplayan (silinen) arac-galop-trend-ekle.mjs script'inde tarih filtresi UNUTULMUŞTU — yarış tarihinden SONRAKİ idman kayıtları da \"son idman\" sayılabiliyordu (ölçüldü: sıfırdan farklı satırların %74.7'si sızıntılıydı — örnek: İzgioğlu'nun 11 Ağustos yarışı için 20-22 Ağustos'ta yapılmış idmanlar \"geçmiş\" sayılmıştı). Temiz (leak-free, g.date<race.raceDay.date) veriyle yeniden test edilince katsayı tamamen çöktü (düşük-şart +0.280→+0.008, diğer +0.003→-0.005) — V5.11'i gerekçeleyen \"4/4 yön tutarlılığı\" bulgusu BAŞTAN SONA sızıntı kaynaklıymış. galopTrendFarki KOMPLE ÇIKARILDI (22→21 özellik). h2hKiloDegisimi ETKİLENMEDİ (o script'te tarih filtresi baştan doğruydu) — kaldı. Ayrıca aynı oturumda model-veri.json 933→980 yarışa güncellendi (21-24 Ağustos arası 47 yeni sonuçlanmış yarış hiç işlenmemişti, kullanıcı \"neden hâlâ 933\" diye fark etti) — h2hKiloDegisimi taze veriyle diğer segmentte artık ANLAMLI çıktı (nokta=0.0688 GA=[0.0066,0.1503], sıfırı kapsamıyor).",
    neyiAnalizEdiyor: [
      "21 özellik: V5.10'un 20'si + h2hKiloDegisimi — segment-bazlı iki model, 980 yarışlık güncel veriyle eğitildi, Handikap-hizDerecesi/düşük-şart-h2hNetSkor override'ları KORUNDU",
    ],
    caprazlamalar: [
      "Düşük-şart (250 yarış, test n=63): top1=%36.5/top3=%74.6/logloss=1.8210. Diğer (730 yarış, test n=183): top1=%29.5/top3=%64.5/logloss=1.8291, h2hKiloDegisimi B=50 bootstrap nokta=0.0688 GA=[0.0066,0.1503] ✓ anlamlı.",
    ],
  },
  {
    versiyon: "V5.13",
    baslangic: new Date("2026-08-24T19:50:31+03:00"), // 8b7da14 — AGF favorisi ilk-3 garantisi eklendi
    bitis: new Date("2026-08-24T22:18:10+03:00"), // 067bfd9 — TJK sonuç parse bugu düzeltmesi + retrain
    aciklama: "AGF sırası=1 (favori) olan at artık KOŞULSUZ ilk-3'e alınıyor. Kullanıcı bulgusu: Bursa K10'da Kaşmir Tay (AGF-1, %18.8 pay) modelin ham olasılık sıralamasında 4.sıraya düşmüştü ve kazandı — agfTrendTerfisiUygula bunu korumadı çünkü o mekanizma olasılığa göre YARIŞIYOR (AGF-1'in olasılığı zaten düşükse yine dışarıda kalıyordu). İlk backtest (512 yarış) Karma'yı (kaynak yarışların aynası) yanlışlıkla çift saymıştı — DÜZELTİLMİŞ backtest (Karma hariç, n=428): mevcut top3 isabeti %60.0 (257/428) → AGF-1 zorla eklenince %61.2 (262/428). 50 yarışta AGF-1 zaten top3'te değildi: 10'unda yeni galibiyet yakalandı, 5'inde yerini aldığımız #3 zaten kazanandı — net +5. NOT: bu, V2'nin eski 'AGF-top3' hard-rule'unun (Çokomel Kız vakasıyla çürütülüp kaldırılmıştı, bkz. proje hafızası) bir tekrarı DEĞİL — o, Claude'un serbest muhakemesini önceden kısıtlıyordu; bu, V5'in tamamen mekanik/istatistiksel sıralamasında yalnız GÖSTERİM sırasını etkileyen, gerçek backtestle desteklenen ayrı bir kural.",
    neyiAnalizEdiyor: [
      "V5.12 ile aynı 21 özellik/segment-bazlı mimari, skor/olasılık hesaplaması DEĞİŞMEDİ — yalnız gösterim sıralamasına AGF-favori-ilk3-garantisi post-processing adımı eklendi",
    ],
    caprazlamalar: [
      "428 yarış (Karma hariç, düzeltilmiş): mevcut top3 isabeti %60.0 (257/428) → AGF-1 zorla eklenince %61.2 (262/428) — net +5.",
    ],
  },
  {
    versiyon: "V5.14",
    baslangic: new Date("2026-08-24T22:18:10+03:00"), // 067bfd9 — TJK sonuç parse bugu düzeltmesi + retrain
    bitis: new Date("2026-08-26T19:43:22+03:00"), // 26f042c — derin AGF-longshot #1 düzeltmesi
    aciklama: "KRİTİK VERİ BÜTÜNLÜĞÜ DÜZELTMESİ: yurt dışı doğumlu atların (TJK gösterimi \"AD(NO) (ÜLKE)\", örn. \"SKY TURK(14) (USA)\") kazandığı yarışlarda gerçek kazanan sessizce yanlış kaydediliyordu. Kök neden — tjk-result.adapter.ts'teki at-numarası regex'i yalnız string SONUNDA \"(sayı)\" arıyordu; ülke kodu sonda olduğunda numara hiç yakalanamıyor, o satır (genelde kazanan, rank=1) tamamen ATLANIYOR, kalan en düşük rank'li at yanlışlıkla \"kazanan\" sayılıyordu. Kullanıcı bulgusu: Elazığ K8 (24 Ağustos) — sistem NIGHT KING(4) kazanan gösteriyordu, gerçek kazanan SKY TURK(14) idi. Regex düzeltildi (numaradan sonra opsiyonel \" (ÜLKE)\" ekini de kabul ediyor). Kapsam taraması: benzer isim deseni taşıyan 55 sonuçlanmış yarışın 14'ünde (%25) aynı hata bulundu — hepsi düzeltildi (Result.winnerNo/winnerNos/actualOrder/farklar/hitTop1/hitInCoupon yeniden hesaplandı, Karma mirror'ları senkronize edildi). Yalnız 1'i (27 Temmuz Elazığ K5) V5 eğitim penceresindeydi (2026-07-01+) — model-veri.json o yarış için yenilendi, segment modelleri yeniden eğitildi.",
    neyiAnalizEdiyor: [
      "V5.13 ile aynı 21 özellik/segment-bazlı mimari/kurallar — skorlama mantığı DEĞİŞMEDİ, yalnız eğitim verisindeki 1 hatalı gözlem düzeltilip yeniden eğitildi (991 yarış, önceki 980'den +11 yeni + 1 düzeltme)",
    ],
    caprazlamalar: [
      "Düşük-şart (254 yarış, test n=64): top1=%34.4/top3=%71.9/logloss=1.8748. Diğer (737 yarış, test n=185): top1=%29.2/top3=%64.3/logloss=1.8387. Katsayılar öncekiyle istatistiksel olarak tutarlı (tek gözlem düzeltmesi, büyük sapma yok) — accurace/idmJokey/jokeyOrani/kacakAtMi/agfDususVarMi düşük-şartta örneklem büyüyünce anlamlı hale geldi.",
    ],
  },
  {
    versiyon: "V5.15",
    baslangic: new Date("2026-08-26T19:43:22+03:00"), // 26f042c — derin AGF-longshot #1 düzeltmesi
    bitis: new Date("2026-08-26T19:58:21+03:00"), // efc4d1e — Maiden/Satış hibrit harmanlama
    aciklama: "Kullanıcı bulgusu: dashboard'daki Sistem vs AGF Favorisi kartı sistemin 1. seçiminin AGF favorisinden -4.2 puan geride kaldığını gösterdi (n=448). Kök neden: sorun Handikap'a özel değil (en küçük fark orada, -1.5) — sistem AGF favorisinden farklı bir at seçtiğinde, o atın AGF sırasına göre keskin ayrışıyor. Split-half doğrulandı (2 bağımsız dönemde de aynı desen): AGF sırası 2./3. seçilince hâlâ makul (%20-38 / %15-25, gerçek değer bulma — dokunulmadı), ama AGF sırası 4.+ seçilince pratik olarak hiç tutmuyor (%0-3, n=60 toplam, split-half'te her iki yarıda da aynı). AGF favorisine kör kör dönmek çözüm değil (o da yalnız %35 kurtarıyor, kalan %65'i BAŞKA bir at kazanıyor) — bunun yerine sistem #1'i derin bir longshot (AGF sırası>=4) olmak üzereyse, modelin KENDİ sıralı listesindeki AGF sırası<=3 en üst adayına inilir (derinLongshotDuzelt). 2./3. sıradaki değer-bulma yeteneğine dokunulmadı.",
    neyiAnalizEdiyor: [
      "V5.14 ile aynı 21 özellik/segment-bazlı mimari, skor/olasılık hesaplaması DEĞİŞMEDİ — yalnız gösterim sıralamasına derin-AGF-longshot post-processing adımı eklendi (agfFavoriIlk3Garantisi'nden SONRA çalışır)",
    ],
    caprazlamalar: [
      "448 yarış (yayınlanan gerçek Pick sırası üzerinden geriye dönük simülasyon): mevcut sistem top1 isabeti %28.6 (128/448) → kural uygulanınca %33.0 (148/448) — net +20, AGF favorisinin kendi oranını (%32.8) hafifçe geçiyor. Somut örneklerle (BROARTS, AZİMLİ vb.) doğrulandı — bazı gerçek derin-favori galibiyetleri (ör. ŞEKER ASLAN, AGF 4.) feda ediliyor ama çok daha fazla kötü seçim düzeltiliyor.",
    ],
  },
  {
    versiyon: "V5.16",
    baslangic: new Date("2026-08-26T19:58:21+03:00"), // efc4d1e — Maiden/Satış hibrit harmanlama
    bitis: new Date("2026-08-26T21:13:59+03:00"), // 7693f77 — Handikap aşırı-güven düzeltmesi
    aciklama: "Kullanıcı talebi: \"Maiden/Satış\" gibi karma koşu tipleri, kategoriTespit'in MAIDEN'ı önce yakalayan regex'i yüzünden SADECE düşük-şart (Maiden) modeliyle puanlanıyordu — Satış'a özgü hiçbir katkı yoktu (ayrı bir Satış modeli hiç var olmadı, kategoriTespit tek kategori kodu döndürüyor). Artık düşük-şart VE diğer ağırlık setlerinin standardize+skor sonucu eşit ağırlıkla ortalanıyor (harmanliSkorla, agirlikSetleriSec). Tek-set durumlarda (n=434/448, hibrit olmayan TÜM yarışlar) matematiksel olarak SIFIR değişiklik — yalnız n=14 hibrit yarış (\"Maiden/Satış\"+\"Maiden/Satış/DHÖW\") etkileniyor. DÜRÜST NOT: bu harmanlamayı kendi başına doğrulayacak yeterli veri yok (n=14, TIER_GUVEN_ESIGI'nin çok altında) — iki tarafın da (düşük-şart n=254, diğer n=737) ayrı ayrı test edilmiş modelini eşit ağırlıkla ortalamak yapısal/temkinli bir tercih, istatistiksel olarak KANITLANMIŞ bir iyileştirme değil.",
    neyiAnalizEdiyor: [
      "V5.15 ile aynı 21 özellik/segment-bazlı mimari, iki ayrı eğitilmiş ağırlık seti DEĞİŞMEDİ — yalnız \"Maiden/Satış\" hibrit koşularda ikisinin skoru harmanlanıyor, diğer tüm koşu tiplerinde davranış birebir aynı",
    ],
    caprazlamalar: [
      "n=14 (yalnız hibrit tip) — ayrı bir istatistiksel doğrulama YAPILAMADI, örneklem yetersiz. Gerçek bir hibrit yarış (İstanbul, 26 Ağustos, Maiden/Satış/DHÖW) üzerinde uçtan uca sanity-check yapıldı: sistem #1 seçimi gerçek kazananla eşleşti (anekdot, istatistiksel kanıt değil).",
    ],
  },
  {
    versiyon: "V5.17",
    baslangic: new Date("2026-08-26T21:13:59+03:00"), // 7693f77 — Handikap aşırı-güven düzeltmesi
    bitis: new Date("2026-08-26T23:10:00+03:00"), // 8e311c3 — kacakYalniz (rakipsiz kaçak)
    aciklama: "Kullanıcı bulgusu/ısrarı: skor>=%35 bandında Handikap Koşular'da model ciddi aşırı-güvenli çıktı (tahmin ort. %44.4, gerçek %15.0, -29.4 puan; split-half iki yarıda da tutarlı: -30.6/-28.2). Aynı bantta Şartlı Koşular'da kalibrasyon neredeyse mükemmelken (-0.4 puan) bu Handikap'a özgü bir sorun. Yeni bir sıcaklık katsayısı UYDURULMADI (n=15-20 çok küçük, kendi başına güvenle tespit edilemez) — zaten V5.1'de doğrulanmış ASIRI_GUVEN_SICAKLIGI (1.5) katsayısı, yalnız Handikap'a özel daha düşük bir liderlik eşiğinde (0.35, genel eşik 0.70) tetikleniyor. Backtest (51 Handikap yarışı, gerçek pipeline'dan yeniden inşa edilen ham skor): \"Güçlü Aday\" (>=%30) grubu n=22→13'e düştü, kalibrasyon -12.4'ten +3.7 puana geldi (n=13, gürültü sınırında ama makul). Genel Handikap top1 isabeti DEĞİŞMEDİ (%21.6, 11/51) — sıcaklık ölçeklendirmesi sıralamayı korur, yalnız gösterilen yüzdeyi/karar etiketini (Güçlü Aday/Düşük Risk/...) düzeltir, hangi atın seçildiğini DEĞİŞTİRMEZ.",
    neyiAnalizEdiyor: [
      "V5.16 ile aynı mimari/skorlama — yalnız Handikap kategorisinde (kategoriTespit==='2') softmax'ın aşırı-güven düzeltmesi tetikleme eşiği %70'ten %35'e indirildi, katsayı (1.5) aynı kaldı",
    ],
    caprazlamalar: [
      "51 Handikap yarışı (V5 dönemi, gerçek pipeline'dan yeniden inşa): Güçlü Aday grubu (n=22, eski eşik) tahmin %39.7/gerçek %27.3 (-12.4) → (n=13, yeni eşik) tahmin %34.8/gerçek %38.5 (+3.7). Genel top1 isabeti %21.6 (11/51), değişmedi.",
    ],
  },
  {
    versiyon: "V5.18",
    baslangic: new Date("2026-08-26T23:10:00+03:00"), // 8e311c3 — kacakYalniz (rakipsiz kaçak)
    bitis: new Date("2026-08-27T09:09:29+03:00"), // 710a285 — h2hNetSkor override kalıcı hâle getirildi
    aciklama: "Kullanıcı hipotezi (\"kaçaklar birbirini yorar, geriden gelen avantajlanır\") ayrıca test edildi ve REDDEDİLDİ (BEKLEME_GRUBU/EN_GERİ_TAKİP/ON_GRUP_ARKASI'nın hiçbirinde kaçak sayısı arttıkça galibiyet artmadı, tam tersi — split-half'te de tutarlı). Ama kacakAtMi (tek parça \"kaçak at mı\") sinyalinin İÇİNDE gerçek bir ayrım bulundu: sahada RAKİPSİZ tek kaçak olmak gerçek avantaj taşıyor, RAKİPLİ kaçak olmak taşımıyor. Derinlemesine doğrulama (kullanıcının \"yüzeysel test ettin\" eleştirisi sonrası): saha büyüklüğü SABİT tutularak kontrol edildi (etki her saha diliminde ayrı ayrı +5.8 ila +9.5 puan, AGF/saha-büyüklüğü confound değil — korelasyon yalnız 0.148-0.154); deneyimsiz atlarda (0-2 önceki yarış) etki DAHA GÜÇLÜ çıktı (split-half +13.8/+12.8 puan) — \"stili oturmamış at, veri güvenilmez\" endişesi doğrulanmadı.",
    neyiAnalizEdiyor: [
      "V5.17 ile aynı 21 özellik/segment-bazlı mimari — yalnız kacakAtMi özelliği kacakYalniz ile DEĞİŞTİRİLDİ (aynı pozisyon, aynı özellik sayısı), diğer 20 özellik/kural DEĞİŞMEDİ",
    ],
    caprazlamalar: [
      "Tam model entegrasyonu (991 yarış, 21 özellik, bootstrap B=50): düşük-şart kacakYalniz nokta=+0.145 GA=[0.031,0.266] ANLAMLI. Diğer nokta=+0.057 GA=[-0.009,0.113] sınırda. Top1 değişmedi (düşük-şart %34.4, diğer %29.2), diğer segmentte top3 %64.3→%66.5 iyileşti.",
    ],
  },
  {
    versiyon: "V5.19",
    baslangic: new Date("2026-08-27T09:09:29+03:00"), // 710a285 — h2hNetSkor override kalıcı hâle getirildi
    bitis: new Date("2026-08-27T17:35:11+03:00"), // d8fa2a9 — gösterim sırası düzeltmeleri kaldırıldı
    aciklama: "Kullanıcı denetimi (\"muhakemeler doğru mu yapılıyor\") sırasında bulundu: h2hNetSkor'un düşük-şart'taki \"elle sıfırlandı\" düzeltmesi (V5.7, ham katsayı ters yönlüydü + GA sıfırı kapsıyordu) yalnız v5-weights-dusuksart.json dosyasına ELLE yazılmıştı, koda gömülü değildi. 2026-08-26'da kacakYalniz için model yeniden eğitilince (arac-model-egit-segment.mjs, sıfırdan gradient descent) bu düzeltme SESSİZCE KAYBOLMUŞTU (h2hNetSkor=-0.141 çıkmıştı, GA hâlâ sıfırı kapsıyor — aynı güvenilmezlik). HIZ_DERECESI_IDX/WEIGHTS_DIGER_HANDIKAP ile AYNI desende artık KODA gömülü (WEIGHTS_DUSUK_SART override) — bir daha retrain'de kaybolmaz. Ayrıca: HIZ (Handikap'ta) ve H2H (düşük-şart'ta) muhakeme satırlarının gösterilip gösterilmeyeceği artık HAM özellik değerine değil GERÇEK katkıya (r.katkilar) bakıyor — katsayısı sıfırlanmış bir sinyal için yanıltıcı bir satır artık gösterilmiyor.",
    neyiAnalizEdiyor: [
      "V5.18 ile aynı 21 özellik/segment-bazlı mimari/skorlama — yalnız h2hNetSkor'un düşük-şart override'ı koda taşındı (skor DEĞİŞMEDİ, zaten olması gereken hâle döndü) ve muhakeme metni gösterim mantığı düzeltildi (skor/karar ETKİLENMEDİ, yalnız gerekçe metni)",
    ],
    caprazlamalar: [
      "Kod denetimi: düşük-şart Maiden yarışında INFERNO BLAZE (ham h2hNetSkor=4) katkısının gerçekten 0 olduğu ve muhakeme metninde H2H satırının artık gösterilmediği doğrulandı.",
    ],
  },
  {
    versiyon: "V5.20",
    baslangic: new Date("2026-08-27T17:35:11+03:00"), // d8fa2a9 — gösterim sırası düzeltmeleri kaldırıldı
    bitis: new Date("2026-08-27T19:04:08+03:00"), // 6d6e478 — AGF Trend Terfisi geri getirildi
    aciklama: "Kullanıcı kararı (Kocaeli 2.Koşu vakası — MAŞİDE %24 ile 3.sıraya, %12'lik KARAKÖPRÜ ATEŞİ 1.sıraya düşmüştü, kullanıcı \"yüzdelere göre sıralama olacak, eskisi gibi, sistemimizi bozamazsın\" dedi): üç gösterim-sırası düzeltmesi (AGF Trend Terfisi, AGF Favorisi İlk-3 Garantisi [V5.13], Derin AGF-Longshot Düzeltmesi [V5.15]) KOMPLE KALDIRILDI. Skorlama/olasılık hesaplaması (harmanliSkorla, softmax, ağırlık setleri) HİÇ DEĞİŞMEDİ — yalnız teknikSira artık doğrudan olasılığa göre azalan sırada, hiçbir gösterim müdahalesi yok. Üç kuralın ÜÇÜ de kaldırılmadan önce gerçek backtest kanıtına dayanıyordu (aşağıya bakınız) — kaldırılma sebebi istatistiksel bir çürütme DEĞİL, kullanıcının açık tercihi. Ama aynı gün, bir başka örnek (ABANOZ/AGF Trend paneli) üzerinden kullanıcı netleştirdi: AGF Trend Terfisi'ni HİÇ kaldırmamı istememişti (\"en çok ağırlık vermeni istediğim sinyaldi\") — bu kural V5.21'de geri getirildi, yalnız 1.5 saat canlı kaldı.",
    neyiAnalizEdiyor: [
      "V5.19 ile AYNI 21 özellik/segment-bazlı model/skorlama — yalnız gösterim sırası artık ham olasılığa eşit, hiçbir terfi/garanti/düzeltme uygulanmıyor",
    ],
    caprazlamalar: [
      "Geri alınan kuralların önceki (geçerliliğini koruyan, ama bu pencerede UYGULANMAYAN) backtest bulguları: AGF Trend Terfisi n=663 → %21.6/%53.8; AGF Favorisi İlk-3 Garantisi n=428 → top3 %60.0→%61.2 (net +5); Derin AGF-Longshot Düzeltmesi n=448 → top1 %28.6→%33.0 (net +20).",
    ],
  },
  {
    versiyon: "V5.21",
    baslangic: new Date("2026-08-27T19:04:08+03:00"), // 6d6e478 — AGF Trend Terfisi geri getirildi
    bitis: new Date("2026-08-27T19:22:33+03:00"), // 8f058db — AGF Favorisi İlk-3 Garantisi de geri getirildi
    aciklama: "V5.20'nin geri alınmasının KISMİ düzeltmesi: kullanıcı yalnız AGF Trend Terfisi'nin (agfTrendTerfisiUygula + terfiPenceresiV5, AGFTERFI muhakeme satırı) geri getirilmesini istedi — bu kural birebir V5.19'daki hâliyle (backtest/eşikler DEĞİŞMEDEN) yeniden eklendi. AGF Favorisi İlk-3 Garantisi ve Derin AGF-Longshot Düzeltmesi KALDIRILMIŞ olarak kalıyor — kullanıcı bu ikisinin geri gelmesini istemedi. Ayrıca netleştirildi: AGF Trend SİNYALİ (agfYukselisVarMi/agfDususVarMi, skora katkı yapan özellikler) ve AGFTREND bilgi satırı zaten hiç dokunulmamıştı — V5.20'de kaldırılan yalnız gösterim-sırası PROMOSYONUYDU, sinyalin kendisi değil.",
    neyiAnalizEdiyor: [
      "V5.19 ile AYNI 21 özellik/segment-bazlı model/skorlama VE aynı AGF Trend Terfisi gösterim kuralı — yalnız AGF Favorisi Garantisi/Derin Longshot Düzeltmesi hâlâ uygulanmıyor",
    ],
    caprazlamalar: [
      "AGF Trend Terfisi'nin backtest'i DEĞİŞMEDİ: n=663 → %21.6 galibiyet/%53.8 top3, kontrol grubu %10.2/%30.7.",
    ],
  },
  {
    versiyon: "V5.22",
    baslangic: new Date("2026-08-27T19:22:33+03:00"), // 8f058db — AGF Favorisi İlk-3 Garantisi de geri getirildi
    bitis: new Date("2026-08-27T20:10:26+03:00"), // 1ccc8c8 — Derin AGF-Longshot Düzeltmesi de geri getirildi

    aciklama: "Kullanıcı, gerçek yayınlanmış tahmin geçmişini (getVersiyonKarsilastirmasi) inceleyip V5.14'ün (AGF Trend Terfisi + AGF Favorisi İlk-3 Garantisi ikisi de aktifken) en yüksek canlı başarı oranını gösterdiğini fark etti (n=32, top1 %46.9/top3 %81.3) ve \"V5.14'e dön\" dedi. Kapsam netleştirildi: yalnız AGF Favorisi İlk-3 Garantisi kuralı geri getirildi (V5.14'ün SONRASINDA bulunan hizDerecesi tarih bugu, galopTrendFarki sızıntısı, yurt dışı kazanan bugu gibi düzeltmeler ve büyümüş eğitim verisi KORUNDU, geri alınmadı). Kullanıcı talebiyle B=500 bootstrap-CI ile GÜNCEL/çok daha büyük veride (249 test yarışı, 3 segment havuzlanmış) yeniden doğrulandı.",
    neyiAnalizEdiyor: [
      "V5.19 ile AYNI 21 özellik/segment-bazlı model/skorlama, AGF Trend Terfisi VE AGF Favorisi İlk-3 Garantisi ikisi de aktif — yalnız Derin AGF-Longshot Düzeltmesi hâlâ kaldırılmış durumda",
    ],
    caprazlamalar: [
      "B=500 bootstrap doğrulama (2026-08-27, güncel veri, 249 test yarışı, 3 segment kendi override'ıyla eğitilip havuzlandı): HAM top3 %67.5 (168/249) → KURALLI top3 %68.7 (171/249), net +3/249, GA=[0,7] — bootstrap örneklerinin %100'ü ≥0, hiç negatif çıkmadı. Orijinal (2026-08-24) backtest ile aynı yönde, güncel veride de doğrulandı.",
    ],
  },
  {
    versiyon: "V5.23",
    baslangic: new Date("2026-08-27T20:10:26+03:00"), // 1ccc8c8 — Derin AGF-Longshot Düzeltmesi de geri getirildi
    bitis: new Date("2026-08-27T20:44:57+03:00"), // 53e1eab — üç kural da kesin olarak devre dışı bırakıldı

    aciklama: "Kullanıcı talebi: \"tüm V5'ler içinde bizi en yüksek kazanma oranlarına götürecek sinyal harmonisi ne olurdu — B=500 testlerini ve tüm sonuçlanmış koşular üzerinden testini yap.\" 3 gösterim kuralının (AGF Trend Terfisi, AGF Favorisi İlk-3 Garantisi, Derin AGF-Longshot Düzeltmesi) 8 açık/kapalı kombinasyonu, walk-forward (5-dilim genişleyen pencere) test edildi. Derin AGF-Longshot Düzeltmesi geri eklendi — üçü de artık aktif. DÜZELTME (aynı gün, kullanıcının \"794 mü, 1000 üzerine çıkmış olmalı\" uyarısı üzerine): İLK test model-veri.json'un ESKİ (bir önceki günden kalma, o günün yarışlarını içermeyen) hâliyle yapılmıştı — kullanıcı gerçek sayının 1000'i geçmiş olması gerektiğini fark etti, haklı çıktı (canlı DB: 1390 sonuçlanmış yarış, veri dosyasındaki 991'e karşı). Veri tazelenip (1042 yarış/834 out-of-fold) test TEKRARLANDI — sonuç aşağıda düzeltildi.",
    neyiAnalizEdiyor: [
      "V5.19 ile AYNI 21 özellik/segment-bazlı model/skorlama, üç gösterim kuralının (Trend Terfisi, Favori Garantisi, Longshot Düzeltmesi) ÜÇÜ de aktif — V5.14/V5.15 dönemiyle aynı kural seti, ama çok daha büyük/güncel eğitim verisiyle",
    ],
    caprazlamalar: [
      "İLK test (794 out-of-fold, ESKİ/eksik veri): en iyi top1=%31.6/top3=%65.5, Longshot eklemenin net etkisi top1 GA=[2,19] (anlamlı görünüyordu). DÜZELTİLMİŞ test (834 out-of-fold, 1042 güncel yarış): en iyi top1=%31.2/top3=%64.1 (aynı en iyi kombinasyon, ama Longshot'un V5.22'ye EK katkısı artık top1 GA=[-3,11] — sıfırı içeriyor, istatistiksel olarak KANITLANAMADI. Yine de: V5.23 vs hiç-kural-yok top3 GA=[1,15] (anlamlı, paket genel işe yarıyor), ve hiçbir kombinasyonda top3'e anlamlı ZARAR görülmedi — nokta tahmini hâlâ en iyisi olduğu için canlıda kaldı, ama 'Longshot kesin +19 kazandırıyor' iddiası GERİ ÇEKİLDİ. AGF Trend Terfisi açık/kapalı HER İKİ testte de bit-bir-bire aynı sonucu verdi — bu simülasyonun yeniden inşa ettiği sinyalSayisi yaklaşıklığının (aygır örneklem-eşiği tam kurulamadı) muhtemelen eşiği (≥4) gereğinden az geçirmesinden kaynaklanıyor, güvenilmez bir ölçüm sayıldı; kuralın kendi n=663 backtest'i GEÇERLİLİĞİNİ KORUYOR.",
    ],
  },
  {
    versiyon: "V5.24",
    baslangic: new Date("2026-08-27T20:44:57+03:00"), // 53e1eab — üç kural da kesin olarak devre dışı bırakıldı
    bitis: null,
    aciklama: "Kullanıcının Kocaeli 2.Koşu SOMUT örneğiyle KESİN kararı: TEYZEOĞLU (%11.1) 1.sırada, MAŞİDE (%23.5) 3.sırada duruyordu (AGF Favorisi Garantisi + Derin Longshot Düzeltmesi birlikte tetiklenmişti). Kullanıcı: \"sıralama yüzdeye göre olur, 1.sıradaki ata %24 vermelisin.\" Bugün üç kural (Trend Terfisi/Favori Garantisi/Longshot Düzeltmesi) üç kez el değiştirmişti (V5.20'de kaldırıldı → V5.21-23'te tek tek geri geldi) — bu KESİN karardan sonra üçü de tekrar devre dışı bırakıldı, ama bu kez fonksiyonlar SİLİNMEDİ: v5-engine.ts'te tek bir `GOSTERIM_SIRASI_DUZELTMELERI_AKTIF=false` anahtarı eklendi, gelecekte tekrar gerekirse tek satırla açılabilir. Skorlama/olasılık hesaplaması hiç değişmedi, yalnız teknikSira artık İSTİSNASIZ ham olasılığa göre.",
    neyiAnalizEdiyor: [
      "V5.19 ile AYNI 21 özellik/segment-bazlı model/skorlama — yalnız gösterim sırası artık istisnasız ham olasılığa eşit, üç gösterim kuralı da (kod olarak duruyor ama) uygulanmıyor",
    ],
    caprazlamalar: [
      "Doğrulama: Kocaeli 2.Koşu canlı yeniden çalıştırıldı, sonuç artık tam monoton azalan olasılık sırası (%14.1→%13.4→%13.0→%12.2→%11.6→%7.3→%5.6→%4.7) — önceki (V5.23) TEYZEOĞLU %11.1 1.sırada/MAŞİDE %23.5 3.sırada anomalisi düzeldi.",
    ],
  },
  {
    versiyon: "V5.25",
    baslangic: new Date("2026-08-27T22:25:30+03:00"), // e5b5385 — agfPayi2 (22. özellik) eklendi
    bitis: null,
    aciklama: "Kullanıcı talebi (\"piyasayı araştır, başka ne bulabiliriz\"): AGF payı kalibrasyon kontrolü yapıldı — %40+ payılı güçlü favoriler gerçek kazanma oranından -4.1 puan geride (piyasa fazla seviyor), AGF sırası 4-5 orta sıradaki atlar +2.1/+2.5 puan önde (piyasa hafife alıyor). Doğrusal olmayan bir kalıp — agfPayi'nin karesi (formEgimi2/kgs2 ile AYNI desen) eklendi. 22. özellik. Model 1042 yarışlık güncel veriyle (o günün yarışları dahil) yeniden eğitildi; Handikap hizDerecesi=0/düşük-şart h2hNetSkor=0 override'ları (koda gömülü) retrain sonrası canlı doğrulandı, etkilenmedi.",
    neyiAnalizEdiyor: [
      "V5.24 ile AYNI segment-bazlı mimari/gösterim (sıralama hâlâ yalnız olasılığa göre) — 21 özellik 22'ye çıktı (agfPayi2 eklendi), model 1042 yarışlık güncel veriyle yeniden eğitildi",
    ],
    caprazlamalar: [
      "B=500 izole test (2026-08-27): agfPayi2 'diğer' segmentte anlamlı (nokta=-0.207, GA=[-0.366,-0.053]), top3 %64.8→%65.3, logloss 1.8409→1.8392. Düşük-şartta sınırda (GA=[-0.490,0.018]). Tam model retrain'de aynı katsayılar doğrulandı (nokta=-0.2071/-0.2139). Reddedilen alternatifler: AGF sırası 4-5 göstergesi (anlamlı ama top1/top3 kötüleşti), %40+ payı göstergesi (anlamsız). Ayrıca bu retrain'de h2hKiloDegisimi 'diğer' segmentte 'sınırda'dan 'anlamlı'ya yükseldi (GA=[0.011,0.166], daha fazla veriyle).",
    ],
  },
  {
    versiyon: "V5.26",
    baslangic: new Date("2026-08-28T20:01:24+03:00"), // 01dd2df — zeminToleransi (23. özellik) eklendi
    bitis: null,
    aciklama: "KURAL İSTİSNASI: kullanıcı, İstanbul'un bugünkü Normal-dışı zemin durumunu (\"Çim: Yumuşak 3,6\") görünce zemin/pist konusunun analizde göz önüne alınıp alınmadığını sordu. İlk kontrol yalnız RaceDay.surfaceConditions'a bakıp yanlışlıkla \"n=3, yetersiz\" dedi — kullanıcı /admin/derece-istatistikleri sayfasını göstererek çok daha zengin bir arşivin (TjkDereceKaydi) zaten var olduğunu ve bunu kullanan hazır bir fonksiyonun (zemin-toleransi.actions.ts, 2026-08-23'te yazılmış ama hiç canlıya bağlanmamış) olduğunu gösterdi. Sinyal GÜNCEL/büyümüş veriyle (B=500, n=1059 koşu) yeniden test edildi — İKİ SEGMENTTE DE anlamsız çıktı (düşük-şart GA=[-0.114,0.207], diğer GA=[-0.077,0.105]). Bu sonuç kullanıcıya açıkça bildirildi ve AskUserQuestion ile \"yine de eklensin mi\" diye soruldu — kullanıcı test sonucunu bilerek \"evet, yine de ekle\" dedi. Bu, oturumun standart \"önce backtest, iyi çıkmazsa ekleme\" kuralının BİLİNÇLİ bir istisnasıdır.",
    neyiAnalizEdiyor: [
      "V5.25 ile AYNI segment-bazlı mimari/gösterim — 22 özellik 23'e çıktı (zeminToleransi eklendi), model 1059 yarışlık (>=2026-07-01) güncel veriyle yeniden eğitildi",
    ],
    caprazlamalar: [
      "B=500/n=1059 test sonucu: düşük-şart nokta=-0.0020 GA=[-0.1136,0.2071] (sıfırı içeriyor), diğer nokta=0.0009 GA=[-0.0769,0.1051] (sıfırı içeriyor) — istatistiksel olarak anlamsız. Split-half güvenilirlik testi (2026-08-23, r=0.467, n=286) sinyalin at-bazlı GERÇEK/tekrarlanabilir olduğunu doğruluyor, ama bu V5'in mevcut 22 özelliğine ek bir tahmin gücü sağlamıyor. Handikap hizDerecesi=0/düşük-şart h2hNetSkor=0 override'ları (isim-bazlı idx() lookup) retrain sonrası 3 gerçek yarışta (bugünkü İstanbul Handikap, geçmiş bir Handikap, geçmiş bir Maiden) canlı doğrulandı, etkilenmedi.",
    ],
  },
  {
    versiyon: "V5.27",
    baslangic: new Date("2026-08-28T22:28:55+03:00"), // 552cdbe — katkısız 11 sinyal silindi (23->12 özellik)
    bitis: new Date("2026-08-30T00:00:23+03:00"), // B katmanı (sireOrani/düşük-şart) eklendi
    aciklama: "Kullanıcı talebi (\"23 sinyali en verimli nasıl kullanırız, katkısı olmayanları sil\"): B=500'de İKİ segmentte de %95 GA'sı sıfırı içeren 11 özellik (accurace, formEgimi, formEgimi2, kgs, kgs2, pistUzmani, sireOrani, galop, uzunAraGalopKatkisi, agfYukselisVarMi, agfDususVarMi) toFeatureVector'dan çıkarıldı. Gerekçe: projenin bir sinyali EKLEMEK için kullandığı baraj hep 'kendi katkısı B=500'de kanıtlandı mı' idi (agfPayi2, h2hKiloDegisimi hep böyle eklendi) — aynı barajı çıkarmaya da simetrik uygulamak tutarlıydı. Karar öncesi üç aşamalı doğrulama yapıldı (kullanıcının 'emin misin/detaylıca analiz ettin mi' itirazları üzerine): (1) tek %75/25 bölünme, (2) 4-parçalı walk-forward, (3) B=500 bootstrap FARK testi (aynı resample'la hem tam hem budanmış model eğitilip kıyaslandı) — hem top1/top3 hem logloss için ayrı ayrı.",
    neyiAnalizEdiyor: [
      "V5.26 ile AYNI segment-bazlı mimari/gösterim — 23 özellik 12'ye indi (11 kanıtlanmamış sinyal çıkarıldı), model aynı 1059 yarışlık pencerede yeniden eğitildi",
    ],
    caprazlamalar: [
      "B=500 bootstrap FARK testi (Budanmış-Tam, aynı resample): top1 farkı düşük-şart ortalama+2.74pp GA=[-2.90,8.70] (sıfırı içeriyor), diğer ortalama+0.15pp GA=[-3.06,3.57] (sıfırı içeriyor) — top1/top3'te fark KANITLANAMADI ama yön tutarlı pozitif (zarar yok). logloss farkı düşük-şart ortalama-0.0598 GA=[-0.1389,-0.0067] SIFIRI DIŞLIYOR (✓ anlamlı iyileşme), diğer ortalama-0.0235 GA=[-0.0853,0.0057] (sıfıra çok yakın, kanıtlanamadı ama yön aynı). Handikap hizDerecesi=0/düşük-şart h2hNetSkor=0 override'ları (isim-bazlı idx() lookup, 12 özelliğe küçülen dizide adları hâlâ var) retrain sonrası 2 gerçek yarışta canlı doğrulandı, etkilenmedi. Ham 11 alan veri toplama pipeline'ında hâlâ toplanıyor, silinmedi.",
    ],
  },
  {
    versiyon: "V5.28",
    baslangic: new Date("2026-08-30T00:00:23+03:00"),
    bitis: new Date("2026-08-30T12:40:59+03:00"),
    aciklama: "Kullanıcı talebi (\"en baştan sinyal araştır\"): dün silinen 11 sinyal V5 penceresinde (249-253 koşu) B=500 MODEL-FARKI testiyle tek tek yeniden denendi. 7'si (accurace, formEgimi+formEgimi2, kgs+kgs2, pistUzmani, galop, agfYukselisVarMi+agfDususVarMi) yine katkısız çıktı — VIF kontrolü (hepsi 1.0-1.2) bunun 'A katmanı tarafından zaten yakalanmış olma' değil, küçük örneklemde güç yetersizliği olduğunu gösterdi. sireOrani ilk testte güçlü çıktı (top3 +6.9pp, GA sıfırı dışlıyor, hem in-sample hem gerçek train/test'te) ama KALICI araçla (n=1060, segment bazlı, gerçek train/test) yeniden test edilince HEM düşük-şart HEM diğer'de anlamsız çıktı (düşük-şart nokta=0.0477 GA=[-0.1352,0.2045]) — küçük örneklemin yanıltıcı olduğu bir örnek daha. Kullanıcı KARARIYLA (zeminToleransi emsaliyle, AskUserQuestion ile teyit edildi) sireOrani yine de düşük-şart'a özel bir 'B katmanı' olarak eklendi — AMA A'nın 12-özellikli regresyonuna 13. terim olarak DEĞİL: softmax'a girmeden önce skora ayrı, bağımsız kalibre edilmiş bir terim olarak (bkz. v5-engine.ts bKatmaniUygula). Bu, V6 vizyonundaki 'A/B/C katmanlama' mimarisinin ilk somut uygulaması.",
    neyiAnalizEdiyor: [
      "A katmanı (mevcut 12 özellik, kendi regresyonu) HİÇ değişmedi — yalnız düşük-şart koşularda skora softmax öncesi küçük bir B katmanı terimi (sireOrani, katsayı=0.0477, düşük-şart popülasyon ortalama=11.6305/sapma=3.6563 ile standardize) ekleniyor. Diğer/Handikap koşularında oran=0, skor/olasılık BİREBİR V5.27 ile aynı.",
    ],
    caprazlamalar: [
      "8 aday V5 penceresinde (n=249-253) B=500 model-farkı testiyle tek tek denendi — tam sonuçlar sinyal-kutugu.service.ts'in arşiv yorumunda. sireOrani'nin düşük-şart katsayısı (0.0477) kalıcı aracın (arac-model-egit-segment.mjs, n=1060, gerçek %75/25 train/test) GERÇEK nokta tahmininden alındı — kanıtsız ama keyfi değil. B katmanı uygulanmadığı (diğer/Handikap) koşularda bKatmaniUygulandiMi=false doğrulandı (gerçek race verisiyle), P(TOP2)/P(TOP3)/piyasa-körü skor birim testleri (v5-engine.test.ts) B katmanından bağımsız geçmeye devam ediyor.",
    ],
  },
  {
    versiyon: "V5.29",
    baslangic: new Date("2026-08-30T12:40:59+03:00"),
    // 2026-08-31 düzeltmesi (Opus'un V5.30-sonrası denetimi): bu alan önceden yanlışlıkla
    // V5.30'un COMMIT edilme anından ÖNCE (17:05:32) kesilmişti — gerçek kod deploy'u
    // 20:07:17'de oldu (commit 6e0eca4). Aradaki ~3 saatte (17:05-20:07) yayınlanan
    // koşular fiilen HÂLÂ V5.29 ile üretilmişti ama /admin/performans onları yanlışlıkla
    // V5.30'a yazıyordu — bu, o yanlış atfı düzeltir.
    bitis: new Date("2026-08-30T20:07:17+03:00"),
    aciklama: "Kullanıcı, 2026-08-27'de (V5.24, Kocaeli 2.Koşu örneğiyle) tek bir ortak anahtarla (GOSTERIM_SIRASI_DUZELTMELERI_AKTIF=false) kapatılan üç gösterim-sırası kuralını (AGF Trend Terfisi/AGF Favorisi İlk-3 Garantisi/Derin AGF-Longshot Düzeltmesi) tek tek yeniden değerlendirdi. Ortak anahtar ÜÇE bölündü (bkz. v5-engine.ts): AGF Trend Terfisi GERİ AÇILDI — bu kural KOŞULSUZ değil, terfi eden adayın olasılığı diğer adaylarla YARIŞIR (terfiPenceresiV5), bu yüzden Kocaeli'deki 'modelin kendi yüzdesini koşulsuz ezme' sorununu taşımıyor; kendi backtest kanıtı (n=663, %21.6 galibiyet/%53.8 top3) hiç sorgulanmamıştı. Diğer ikisi KAPALI KALDI: AGF Favorisi İlk-3 Garantisi tam olarak Kocaeli'deki davranışın kendisi (AGF favorisini modelin yüzdesine bakmadan koşulsuz 3.sıraya zorluyor) — kanıtı (n=428) hâlâ geçerli sayılıyor ama prensip gerekçesiyle kapalı; Derin AGF-Longshot Düzeltmesi hem aynı prensip hem de artık istatistiksel kanıtı da yok (güncel/tazelenmiş veride net etki GA=[-3,11], sıfırı içeriyor).",
    neyiAnalizEdiyor: [
      "Skor/olasılık HİÇ değişmedi — yalnız GÖSTERİM sırası/kararı etkileniyor (agfTrendTerfisiUygula, faz2V5Sirala içinde softmax SONRASI çalışıyor). A/B katmanları (V5.27/V5.28) bu değişiklikten bağımsız, hiç dokunulmadı.",
    ],
    caprazlamalar: [
      "Yeni bir backtest çalıştırılmadı — üçünün de 2026-08-27'deki kanıtları (n=663/428/448) zaten geçerli kabul ediliyordu, kapatma kararı o zaman da istatistiksel değil PRENSİP kararıydı (Kocaeli 2.Koşu). Bugünkü değişiklik yalnız üç kuralı ayrı ayrı değerlendirip aynı prensip testinden (koşulsuz mu, olasılıkla yarışıyor mu) geçenin geri açılması — Derin AGF-Longshot'ın istatistiksel kanıtının artık geçersiz olduğu bilgisi 2026-08-27'nin kendi notundan (1042 yarışlık güncel retest) alındı, bugün yeniden ölçülmedi.",
    ],
  },
  {
    versiyon: "V5.30",
    baslangic: new Date("2026-08-30T20:07:17+03:00"), // 6e0eca4 — bkz. V5.29'un bitis notu
    bitis: new Date("2026-08-31T00:45:23+03:00"),
    aciklama: "Kullanıcı talebiyle (\"sinyalleri opus değerlendirsin... v5 ile kullanılan ve sonuçlanan tüm koşularda\") Opus'a (Agent tool, model:\"opus\") CANLI_SINYALLER + ADAY_SINYALLER'in tamamı, V5 döneminde (16-30 Ağustos, n=248 sonuçlanmış karma-olmayan koşu) GERÇEK yayınlanmış+sonuçlanmış Prediction verisiyle (kod-bazlı + featureSnapshot z-skoru, iki bağımsız ölçüt) denetlettirildi. İki bulgu bu sürümde düzeltildi: (1) h2hKiloDegisimi eğitimde her iki segmentte pozitif (diğer +0.0727, düşük-şart +0.0665) ama canlı iki ölçütte de TERS çıktı (kod-lift -0.6pp→budama sonrası -3.4pp; featureSnapshot z=-0.521, GA=[-0.888,-0.150] sıfırı dışlıyor) — H2H/düşük-şart (V5.6b) ve Handikap/hizDerecesi (V5.10) ile AYNI cerrahi desenle TÜM segmentlerde 0'a sabitlendi (kanıt pooled, tek segmente özgü değildi). (2) sireOrani'nin B katmanı gerekçe/ölçüm bloğunun 2026-08-28'deki 11-sinyal budamasından beri ÖLÜ KOD olduğu bulundu (OZELLIK_GRUPLARI'ndan SIRE grubu kaldırılınca `gruplar.find(g=>g.kod===\"SIRE\")` hep undefined dönüyordu) — skora katkı gerçekleşmeye devam etti ama ne gerekçe metninde ne featureSnapshot'ta hiç görünmüyordu. Gerçek katkı artık ayrı alanlarda (bSireKatkisi/bZeminMesafeKatkisi) hesaplanıp hem gerekçe satırına hem featureSnapshot.bKatmani'ye taşınıyor — B katmanı sinyalleri artık ölçülebilir. jokeyOrani'nin 'anlamsız' notu da güncel canlı veriyle çelişiyor bulundu (kod-lift +3.9→+6.0pp, 4 koşu tipinde de pozitif, z=+0.651) — katsayı DEĞİŞTİRİLMEDİ (zaten sıfırlanmamıştı), yalnız sinyal-kutugu.service.ts'teki not güncellendi.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: h2hKiloDegisimi'nin katkısı artık TÜM kategorilerde (düşük-şart/diğer/Handikap) her zaman 0 — gerçek race verisiyle doğrulandı (scratch script, 4 kategori). Diğer 11 A-katmanı katsayısına dokunulmadı. B katmanı (sireOrani/zeminMesafeDeneyim) skor etkisi HİÇ değişmedi — yalnız artık ölçülebilir/görünür.",
    ],
    caprazlamalar: [
      "Yeni bir bootstrap/model-farkı testi çalıştırılmadı — bu bir 'yeni sinyal ekleme' değil, mevcut canlı bir katsayının GERÇEK sonuçlanmış V5 koşularında ters çıktığı bulgusuna dayalı cerrahi düzeltme (H2H/düşük-şart ve Handikap/hizDerecesi ile AYNI eşik: ham/gerçek katsayı ters yönlü + GA sıfırı dışlıyor veya dışlamaya çok yakın). Doğrulama: tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti, scratch script ile 4 farklı kategoride (1a/2/3/bilinmiyor) h2hKiloDegisimi katkısının gerçekten 0 olduğu VE SIRE gerekçe satırının artık (eşik≥0.03'te) gerçekten göründüğü canlı race verisiyle doğrulandı.",
      "SONRADAN EK (2026-08-31, Opus tekrar denetimi): h2hKiloDegisimi'nin o günkü kanıtı (n=19 featureSnapshot) n=24'e çıkınca REPLİKE OLMADI (z=-0.521→-0.123, GA artık sıfırı kapsıyor) ve üretim-sadık testte sıfırlamanın top1/logloss'a etkisi pratikte sıfır çıktı — yani sıfırlama zararsız ama gerekçe kanıtı ilk düşünülenden zayıf. Katsayı yine de sıfırlı bırakıldı (geri almanın da kanıtı yok), izlemede — bkz. sinyal-kutugu.service.ts'in güncellenmiş notu.",
    ],
  },
  {
    versiyon: "V5.31",
    baslangic: new Date("2026-08-31T00:45:23+03:00"),
    bitis: new Date("2026-08-31T14:16:02+03:00"),
    aciklama: "Kullanıcı talebiyle (\"6 atı verirken v5 motorunun titiz analizi gerek, sinyaller sağlıklı mı, opus test yapsın\") Opus'a V5.30 düzeltmelerinin doğrulanması + tüm 12 A-katmanı sinyalinin güncel V5 verisiyle (n=253) tazelenmiş bir sağlık taraması yaptırıldı. idmJokey Handikap'ta DÖRT bağımsız ölçütte de ters/anlamsız çıktı: canlı model-düzeltilmiş bakiye -5.93pp (GA=[-10.34,-1.60], sıfırı dışlıyor, n=107); üretim-sadık katsayı canlı %75 fit'te 0.1033'ten tüm veride 0.0266'ya (artık anlamsız) kaymış — 12 sinyalin en büyük kayması; görülmemiş son %25'te (n=76) sıfırlarsa top1 +3.95pp/top3 +2.63pp/logloss -0.0306, hepsi anlamlı iyileşme. Düşük-şart'ta katsayı sağlam pozitif (GA=[0.102,0.372]) — KORUNDU. HIZ_DERECESI_IDX/V5.10 ile BİREBİR aynı cerrahi desen: yalnız Handikap'ta idmJokey sıfırlandı. Ayrıca gerekçe metnindeki IDMJOK bloğu (eski kod ham r.idmJokey'e bakıyordu) HIZ ile aynı düzeltmeyle gerçek katkıya (r.katkilar) bağlandı — Handikap'ta artık hiç görünmüyor. Bununla birlikte: Sınıf Düşüşü (İkramiye) adayı n=553 ile yeniden test edilip REDDEDİLDİ (CV'de top1/top3/logloss üçü de anlamlı kötüleşiyor), h2hKiloDegisimi/V5.30'un notu düzeltildi (bkz. V5.30 kaydı), V5.29/V5.30 arasındaki yanlış zaman damgası (17:05→20:07) düzeltildi.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: idmJokey'in katkısı artık Handikap'ta her zaman 0 (WEIGHTS_DIGER_HANDIKAP, hizDerecesi'nin yanına ikinci sıfırlama olarak eklendi) — gerçek race verisiyle doğrulandı (54/54 Handikap atında katki=0, IDMJOK satırı hiç görünmüyor). Düşük-şart ve diğer 10 A-katmanı katsayısına dokunulmadı.",
    ],
    caprazlamalar: [
      "Yeni bir bootstrap/model-farkı testi çalıştırılmadı — H2H/düşük-şart, Handikap/hizDerecesi (V5.10) ve h2hKiloDegisimi (V5.30) ile AYNI cerrahi düzeltme standardı: ham/gerçek katsayı ters yönlü + üretim-sadık OOS testte GA sıfırı dışlıyor. Doğrulama: tsc --noEmit temiz, npm run build temiz, gerçek race verisiyle 40 Handikap koşusunda idmJokey=true olan 54 atın 54'ünde de katki=0 ve gerekçe satırı gösterilmediği doğrulandı.",
    ],
  },
  {
    versiyon: "V5.32",
    baslangic: new Date("2026-08-31T14:16:02+03:00"),
    bitis: new Date("2026-08-31T21:07:59+03:00"),
    aciklama: "Kullanıcı talebiyle (\"sistemimde kusur istemiyorum\") kacakYalniz sinyalinin eğitim-verisi SIZINTISI düzeltildi. Kök neden: `accurace-sync.service.ts`'teki `Runner.raceStyle` alanı tarih filtresi OLMADAN, atın TÜM (geçmiş+GELECEK) Accurace kayıtlarından hesaplanıp atın adına ait TÜM Runner satırlarına yazılıyordu — eğitim script'i (`arac-model-veri-olustur.mts`) bu alanı doğrudan okuyordu, canlı serving ise ayrı ve sızıntısız bir yöntem (`accuraceEgilimMap`, veri-toplama.ts) kullanıyordu; klasik train/serve uyumsuzluğu. İKİ BAĞIMSIZ Opus denetimi (aynı gün, birbirinden habersiz iki ayrı görev) aynı kök nedeni buldu. Sızıntısız yeniden hesaplanınca: düşük-şart eski 'anlamlı +0.1361' → bağımsız B=500'de -0.0934 GA=[-0.384,0.047] (P(>0)=%9, TERS yönlü); diğer eski 'anlamlı +0.0822' → +0.0101 (P(>0)=%64, null). Her iki segmentteki eski 'anlamlı' statü TAMAMEN sızıntı ürünüymüş. h2hKiloDegisimi (V5.30) ile AYNI cerrahi desen: tam retrain DENENDİ ama aynı turda ilgisiz bir hızDerecesi veri-tazeleme kayması karıştığı (önbellek tam silinince hızDerecesi'nin KENDİ ayrı, önceden var olan bir train/serve uyumsuzluğu — yalnız %8.2 örtüşme — su yüzüne çıktı, henüz çözülmedi) ve adil (aynı test seti) karşılaştırmada net bir kazanç göstermediği için retrain'in TAMAMI REDDEDİLDİ — yalnız kacakYalniz TEK katsayısı koda gömülü olarak TÜM segmentlerde sıfırlandı, diğer 11 katsayıya dokunulmadı. Gerekçe metnindeki KACAK bloğu da (eski kod ham r.kacakYalniz'a bakıyordu) HIZ/IDMJOK ile aynı düzeltmeyle gerçek katkıya (r.katkilar) bağlandı. `arac-model-veri-olustur.mts`'teki sızıntı düzeltmesi (stilEgilimMap) KALICI ARAÇTA kaldı — ileride yeniden değerlendirilebilir, ama BUGÜN üretilen ağırlık dosyaları CANLIYA ALINMADI.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: kacakYalniz'in katkısı artık TÜM kategorilerde her zaman 0 — gerçek race verisiyle doğrulandı (12 koşuda kacakYalniz=true olan 3 atın 3'ünde de katki=0, KACAK gerekçe satırı hiç görünmüyor). Diğer 11 A-katmanı katsayısına dokunulmadı — bu turdaki tam retrain denemesi TAMAMEN reddedildi.",
    ],
    caprazlamalar: [
      "Tam retrain denendi (1104 koşu, önbellek sıfırdan üretildi) ama REDDEDİLDİ: (1) 'diğer' segmentteki görünen iyileşme (top1 %30.6→%34.3) farklı test setlerini karşılaştırmaktan kaynaklanan bir YANILSAMA çıktı — aynı test setinde canlı zaten %34.8 yapıyor; (2) hızDerecesi'ndeki büyük kayma (düşük-şart 0.49→0.21) kacakYalniz'la ilgisiz, önbellek tazelemesinden kaynaklandı VE hızDerecesi'nin eğitim/canlı hesaplamaları arasında ÖNCEDEN VAR olan ağır bir uyumsuzluk (yalnız %8.2 örtüşme) bulundu — bu ayrı, çözülmemiş bir sorun; (3) h2hKiloDegisimi yeni üretilen veride 0/38072 satırda hiç yok — script'te ayrı bir eksiklik, şimdilik zararsız (zaten kod-seviyesinde sıfır) ama düzeltilmeli. Bu üç ilgisiz bulgu netleşene kadar yalnız kanıtlanan TEK bulgu (kacakYalniz sızıntısı) cerrahi olarak düzeltildi. Doğrulama: tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti.",
    ],
  },
  {
    versiyon: "V5.33",
    baslangic: new Date("2026-08-31T21:07:59+03:00"),
    bitis: new Date("2026-09-01T08:58:10+03:00"),
    aciklama: "Kullanıcı talebiyle (\"uyumsuzlukları çöz\") hızDerecesi'nin V5.32'de su yüzüne çıkan train/serve uyumsuzluğu çözüldü. Kök neden: eğitim (arac-model-veri-olustur.mts) atın son 3 (365 gün içi) koşusunun HER BİRİNİ KENDİ kovasına (irk|pist|mesafe) ve KENDİ tarihine göre (sızıntısız) popülasyon ortalamasıyla kıyaslıyordu; canlı sunum (hiz-derecesi.actions.ts) ise yalnız BUGÜNKÜ kovayla eşleşen geçmiş koşuları sayıp hepsini BUGÜNKÜ popülasyon ortalamasına vuruyordu — Opus'un ölçümü: canlı atların %43.8'i sıfır dönerken eğitimde yalnız %8.2'si sıfırdı, ortalama mutlak fark ~2.86 puan (~0.8 SD). Ayrıca eğitimin popülasyon indeksi HER 'start' (Runner satırı) için atın TÜM geçmişini tekrar tekrar ekliyordu — çok start yapan atların geçmiş koşuları popülasyonu orantısız ağırlıklandırıyordu (ayrı, bağımsız bir hata, aynı işte fark edildi). Yeni paylaşılan çekirdek (hiz-derecesi-hesapla.ts) her iki tarafça da çağrılıyor; popülasyon indeksi artık her at TAM OLARAK BİR KEZ işleniyor. Katsayı DEĞİŞMEDİ (retrain yapılmadı) — yalnız canlı girdi artık katsayının fit edildiği dağılımla eşleşiyor.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: hızDerecesi'nin canlı hesaplanan değeri artık eğitimle aynı mantığı kullanıyor — gerçek sonuçlanmış 200 koşuda (2004 at) sıfır oranı %43.8'den %5.2'ye düştü. Katsayının kendisi (WEIGHTS_DUSUK_SART/WEIGHTS_DIGER/WEIGHTS_DIGER_HANDIKAP'taki HIZ_DERECESI_IDX) DEĞİŞMEDİ.",
    ],
    caprazlamalar: [
      "Gerçek 60 sonuçlanmış koşuda (596 at) kazanan-vs-diğer Cohen's d karşılaştırması: ESKİ (bugünkü-kova-yalnız) mantık d=0.369, YENİ (eğitimle birleşik) mantık d=0.578 — düzeltme yalnız teorik tutarlılık değil, gerçek kazanan/kaybeden ayrımını da somut biçimde güçlendirdi. Doğrulama: tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti, gerçek 200 sonuçlanmış koşuda (2004 at) crash yok, değer dağılımı makul (medyan -0.29, p10/p90 -6.81/+2.82).",
    ],
  },
  {
    versiyon: "V5.34",
    baslangic: new Date("2026-09-01T08:58:10+03:00"),
    bitis: new Date("2026-09-01T13:36:00+03:00"),
    aciklama: "Kullanıcı kararıyla ('skora dahil olsun puana eklensin') 13. özellik olarak 'Yakınsama' eklendi — MEGAFAUNA vakasından (model 8./%4 verdi, at kazandı) doğan hipotez: pistUzmani + sahada ilk-2 pedigri (sireOrani) + at-jokey ikilisinde geçmiş galibiyet + AGF eşik-üstü yükseliş + sınıf düşüşünün (bugünkü 1.ikramiye, son 3 startın ortalamasının <%80'i) EN AZ 2'sinin AYNI ATTA hizalanması. Beşi de tek tek VE birlikte B=500 bootstrap ile test edildi, hiçbiri istatistiksel olarak anlamlı çıkmadı (bkz. sinyal-kutugu.service.ts) — zeminToleransi/sireOrani ile AYNI türden BİLİNÇLİ istisna. İki yeni bileşen (sınıf düşüşü, at-jokey ikilisi) hem eğitim (arac-model-veri-olustur.mts) hem canlı sunum (v5-engine.ts gatherFaz1V5) TEK bir paylaşılan fonksiyondan (yakinsama-gecmis.ts) hesaplanıyor — hızDerecesi'nin (V5.33) train/serve dersi bir daha yaşanmasın diye. Bu süreçte MEGAFAUNA üzerinden GERÇEK bir veri boşluğu bulundu: geçmiş Runner kayıtlarının bir kısmında tjkAtId boş, tjkAtId'ye göre eşleşme gerçek galibiyetleri kaçırıyordu — İSME göre eşleşmeye geçildi (Karma mükerrer kaydı da hariç tutuluyor). model-veri.json tam yenilendi (3923 koşu, 38264 satır), 13 özellikle yeniden eğitildi.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: yakinsama2Plus artık 13. özellik olarak TÜM skorlara katkı veriyor (diğer +0.042, düşük-şart -0.028 — ikisi de küçük ve GA sıfırı içeriyor). Diğer 12 katsayı, model-veri.json'un tam yenilenmesi nedeniyle hafifçe kaydı (doğal yeniden-örnekleme varyansı) ama yön/anlamlılık durumları değişmedi.",
    ],
    caprazlamalar: [
      "Adil kıyas (aynı test seti, mevcut canlı 12-özellik vs yeni 13-özellik): diğer segmentte top1/top3/logloss farkı ihmal edilebilir (-0.4pp/-0.3pp, logloss hafif iyi), düşük-şart'ta hafif iyi (+1.2pp/+1.6pp) — zeminToleransi gibi ölçülebilir bir zarar yok. Doğrulama: tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti.",
    ],
  },
  {
    versiyon: "V5.35",
    baslangic: new Date("2026-09-01T13:36:00+03:00"),
    bitis: new Date("2026-09-01T19:00:00+03:00"),
    aciklama: "Kullanıcı kararıyla ('B katmanına destekleyici sinyal olarak eklensin') 14. özellik olarak 'Son İdman Sprint' eklendi — ESENYIL vakasından (model 9./%4.9 verdi, at kazandı) doğan hipotez: son idmanın TÜRÜ (TJK Gallop.track) Sprint/Sürat mi. Önce basit (regresyonsuz) karşılaştırma yapıldı: n=9148 (leak-free, karma hariç), Sprint grubu top1 %9.5 vs diğer %11.1 — YÖN TERSİYDİ (nokta -1.5pp, GA sıfırı kapsıyor); yarışa yakınlık (≤3 gün) kırılımı da yönü değiştirmedi. Kullanıcı yine de eklenmesini istedi — zeminToleransi/yakınsama ile AYNI türden BİLİNÇLİ istisna, GERÇEK fit edilen katsayı kullanıldı (elle pozitif yapılmadı). Ortak 14-özellik regresyonda (diğer 13 değişkeni kontrol ederek) katsayı iki segmentte de sıfıra çok yakın çıktı (düşük-şart +0.008, diğer -0.019) — basit karşılaştırmadaki negatif yön büyük ölçüde confounding'den kaynaklanıyormuş. Gallop sorgusuna `track` alanı eklendi (hem arac-model-veri-olustur.mts hem v5-engine.ts), Sprint/Sürat eşleşmesi galop-helpers.ts'teki tek bir paylaşılan fonksiyondan (isSprintIdman) hem eğitim hem canlı sunumda kullanılıyor. model-veri.json tam yenilendi (3923 koşu, 38264 satır), 14 özellikle yeniden eğitildi.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: sonIdmanSprint artık 14. özellik olarak TÜM skorlara katkı veriyor (düşük-şart +0.008, diğer -0.019 — ikisi de ihmal edilebilir küçüklükte ve GA sıfırı içeriyor). Diğer 13 katsayı, model-veri.json'un tam yenilenmesi nedeniyle hafifçe kaydı (doğal yeniden-örnekleme varyansı) ama yön/anlamlılık durumları değişmedi.",
    ],
    caprazlamalar: [
      "Adil kıyas (aynı test seti, aynı model-veri.json, 13-özellik vs 14-özellik): top1/top3 BİREBİR AYNI (düşük-şart %37.8/%64.9, diğer %32.2/%67.3), logloss farkı gürültü seviyesinde (düşük-şart +0.0003, diğer -0.0009) — ölçülebilir bir zarar yok. Doğrulama: tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti.",
    ],
  },
  {
    versiyon: "V5.36",
    baslangic: new Date("2026-09-01T19:00:00+03:00"),
    bitis: new Date("2026-09-01T20:30:00+03:00"), // Yarış Gidişatı (17. özellik) eklendi
    aciklama: "Kullanıcı kararıyla ('adam takı çıkarmayı sinyal olarak görmüş, DB/KG/K gibi takılar önemli — model bunu görecek') 15. ve 16. özellik olarak 'Takı Eklendi'/'Takı Çıkarıldı' eklendi — KIZIM BİNDAL vakasından (model 5./%9.4 verdi, at kazandı) doğdu: bir yorumcu KG+GKR çıkarılmasını galibiyet gerekçesi olarak kullanmıştı, model bu bilgiyi (Son Yarış Detayları paneli) ZATEN GÖSTERİYORDU ama hiç skorlamıyordu. İki alan (takiEklendiMi/takiCikarildiMi) arac-model-veri-olustur.mts'te ZATEN hesaplanıyordu (SonYarisDetay'dan, leak-free) — model-veri.json'da hazırdı, YENİDEN ÜRETİM GEREKMEDİ. v5-engine.ts zaten getSonYarisDetaylariForRace'i çağırıyordu (kgs/pistUzmani için) — yalnız eklenenTaki/cikarilanTaki alanlarından 2 türetilmiş 0/1 alan eklendi. GERÇEK fit edilen katsayı kullanıldı, elle yön verilmedi: B=500 bootstrap her iki segmentte de sıfıra yakın/anlamsız çıktı (takiEklendiMi: düşük-şart -0.052/diğer -0.018; takiCikarildiMi: düşük-şart -0.030/diğer +0.061). takiCikarildiMi'nin diğer segmentteki yönü (+0.061) KIZIM BİNDAL'ın işaret ettiği yönle tutarlı ama istatistiksel olarak kanıtlanamadı.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: takiEklendiMi/takiCikarildiMi artık 15-16. özellikler olarak TÜM skorlara katkı veriyor (dördü de küçük ve GA sıfırı içeriyor). Diğer 14 katsayı aynı model-veri.json üzerinden yeniden fit edildiği için hafifçe kaydı (doğal varyans) ama yön/anlamlılık durumları değişmedi.",
    ],
    caprazlamalar: [
      "Adil kıyas (aynı test seti, aynı model-veri.json, 14-özellik vs 16-özellik): düşük-şart'ta top1 aynı (%37.8), top3 belirgin İYİLEŞTİ (+2.7pp: %64.9→%67.6), logloss gürültü seviyesinde kötüleşti (+0.0007). Diğer segmentte top1 hafif iyi (+0.5pp), top3 hafif kötü (-0.5pp), logloss gürültü seviyesinde (+0.0005) — net bir zarar kanıtlanmadı. Doğrulama: tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti, arac-tam-at-inceleme.mts'in özet kıyas tablosu (16 sütun) gerçek bir koşuda (Ankara K5, KIZIM BİNDAL) doğrulandı.",
    ],
  },
  {
    versiyon: "V5.37",
    baslangic: new Date("2026-09-01T20:30:00+03:00"),
    bitis: new Date("2026-09-02T22:01:31+03:00"),
    aciklama: "Kullanıcı tasarımıyla ('yarış-geneli tempo tahmini ve ardından at-bazlı tempo uygunluğu') 17. özellik olarak 'Yarış Gidişatı' eklendi. Pipeline: her atın Accurace geçmişinden (n≥3, sızıntısız) 4 koşu-stilinin (Kaçak At/Ön Grup/Bekleme Grubu/En Geri Takip) TAM olasılık dağılımı + saha-içi göreli erken hız gücü çıkarılır (hesaplaCokYarisEgilimi, artık dagilim+erkenHizGucu de döndürüyor) → sahanın 4 tempo değişkeni (liderlik talebi, en güçlü kaçak baskısı, liderler arası denge, arkadan gelme yoğunluğu) hesaplanır → yumuşak-eşikli kural tabanlı 6 senaryo olasılığı (Rahat Liderlik/Yavaş Tempo/Dengeli/Mücadeleli/Çok Yüksek/Dağılma Riski) üretilir → sabit bir uyum matrisiyle (kullanıcı tasarımı, ilk versiyon) atın stil dağılımı × senaryo olasılığı çarpılıp beklenen değer alınır → dar bir mesafe katsayısıyla (1200m 1.15 / 1800m 1.0 / 2400m+ 0.85) ölçeklenir. GERÇEK Kocaeli K1 yarışıyla (01.09.2026, Female Warrior tüm yarışa liderlik edip son bölümde Kardaha'ya yakalanması) uçtan uca doğrulanırken, saha ORTALAMASINA bakan bir tasarım hatası bulundu (tek gerçek kaçak adayı 7 sıfır-kaçaklı atla sulanıp senaryo yanlış çıkıyordu) — düzeltme: gate artık sahadaki EN GÜÇLÜ tek kaçak adayına bakıyor. Runner.raceStyle (accurace-sync.service.ts) artık dagilim+erkenHizGucu de yazıyor — kacakYalniz'in kaynağıyla AYNI, sızıntısız. B=500 bootstrap testi (arac-model-veri-olustur.mts'e backfill edilen 38264 satır, 2026-07-01+ kapsam, 1122 koşu): diğer segmentte GA sıfırı dışlıyor (anlamlı, nokta=0.098) ama İKİ ayrı bootstrap koşusunda alt sınır sıfıra çok yakın gidip geldi (0.0025 / -0.0020) — run-to-run gürültüye duyarlı, sınırda bir sonuç; düşük-şart'ta GA sıfırı içeriyor (anlamsız, nokta=0.139) ama AYNI YÖNDE. zeminToleransi/yakınsama/sonIdmanSprint/takı ile AYNI türden BİLİNÇLİ istisna — kullanıcı, sınırda/gürültülü sonucu bilerek eklenmesini istedi.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞTİ: yarisGidisatiSkoru artık 17. özellik olarak TÜM skorlara katkı veriyor (düşük-şart +0.139 anlamsız, diğer +0.098 sınırda-anlamlı). Diğer 16 katsayı, model-veri.json'un yarisGidisatiSkoru sütunuyla genişletilip yeniden fit edilmesi nedeniyle hafifçe kaydı (doğal varyans) ama yön/anlamlılık durumları değişmedi.",
    ],
    caprazlamalar: [
      "Adil kıyas (aynı test seti, aynı model-veri.json+yarisGidisatiSkoru sütunu, 16-özellik vs 17-özellik): düşük-şart top1/top3 DEĞİŞMEDİ (%37.8/%67.6), logloss gürültü seviyesinde iyi (1.8332→1.8170). Diğer segmentte top1 +1.0pp (%32.7→%33.7), top3 -0.9pp (%66.8→%65.9) — birbirini büyük ölçüde götürüyor, logloss gürültü seviyesinde (1.8081→1.8065). Net bir zarar kanıtlanmadı. Kapsama: satırların %74.7'sinde (2026-07-01+ kapsamda) gerçek dagilim/erkenHizGucu verisi var, geri kalanı dürüstçe 0/nötr. Doğrulama: tsc --noEmit temiz, arac-tam-at-inceleme.mts'in özet kıyas tablosu (17 sütun, Gidşt dahil) Kocaeli K1'de doğrulandı.",
    ],
  },
  {
    versiyon: "V5.38",
    baslangic: new Date("2026-09-02T22:01:31+03:00"),
    bitis: new Date("2026-09-02T22:52:00+03:00"),
    aciklama: "İki değişiklik — İKİSİ DE skor/olasılığa DOKUNMUYOR, yalnız GÖSTERİM sırası/karar etiketi katmanında. (1) GERÇEK BİR BUG DÜZELTİLDİ: agfTrendTerfisiUygula (terfiPenceresiV5 üzerinden) 2026-08-16'dan beri 'aday havuzunu olasılığa göre sırala, en güçlü N tanesi kazansın' ilkesiyle çalışıyordu — ama girdi (sirali) faz2V5Sirala'da ZATEN ham olasılığa göre azalan sırada geliyor, bu yüzden pencere dışındaki HİÇBİR aday hiçbir doğal sakini olasılıkça geçemiyordu (matematiksel olarak imkânsız: adayın tanım gereği daha düşük olasılığı var, yoksa zaten pencerede olurdu). Sonuç: kullanıcının 'en çok ağırlık vermeni istediğim sinyal' dediği mekanizma SESSİZCE hiçbir zaman hiçbir atı terfi ettirmiyordu (terfiEdenNolar hep boş küme). Sentetik repro ile doğrulandı (düzeltme öncesi agfTerfi hep null). Düzeltme: agfFavoriIlk3Garantisi ile AYNI ilke — pencere dışındaki en güçlü aday, pencerenin son (en zayıf) sakinini KOŞULSUZ yerinden ederek girer (yalnız o TEK sakin değişir, 1./2. sıradaki güçlü sakinler asla elenmez — 2026-08-16'nın KING ZELAY düzeltmesinin amacı korunuyor). (2) YENİ: Saf Model Değer Terfisi (safModelDegerTerfisiUygula) — THEATER OF WAR vakası (Saf Model/marketBlindProb1 atı 4.sıraya/%10.2 koyuyordu, AGF payı %5.0'a gömüp nihai skoru 8.sıraya düşürmüştü, at günün en iyi performanslarından birini verdi). Kullanıcı kararı: 'olumlu sinyaller varken agf piyasaya göre at aşağılara çekilmemeli en azından 6. at dışına atılmamalı.' İlk sürüm: marketBlindProb1*100-agfPayi>=5pp VE sinyalSayisi>=SINYAL_ESIGI. **BU KOŞUL YANLIŞ ÇIKTI, bkz. V5.39.**",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞMEDİ — regresyon katsayıları/toFeatureVector'a hiçbir dokunuş yok. Yalnız faz2V5Sirala'nın SONUNDAKİ gösterim/karar katmanı etkilendi: teknikSira (görünen sıra) ve karar (Orta/Yüksek Risk → Düşük Risk) — hem agfTrendTerfisi artık GERÇEKTEN tetiklendiğinde hem de yeni degerTerfisi=true olduğunda.",
    ],
    caprazlamalar: [
      "Kullanıcı KARARIYLA (zeminToleransi/yakınsama/yarisGidisatiSkoru ile AYNI türden bilinçli istisna, backtest İSTENMEDİ) doğrudan canlıya alındı — geçmiş sonuçlanmış koşularda toplu backtest YAPILMADI. Doğrulama yalnız sentetik: (a) terfiPenceresiV5 düzeltmesi öncesi/sonrası aynı senaryo (6 sinyal+AGF yükselişi taşıyan, doğal 7. sıradaki bir at) — düzeltme öncesi agfTerfi=null/teknikSira=7 sabit kaldı, düzeltme sonrası doğru şekilde ilk-3'e taşındı, 1./2. sıradaki güçlü atlar dokunulmadı. (b) safModelDegerTerfisiUygula, THEATER OF WAR'ı taklit eden sentetik bir sahada doğal 8. sıradaki adayı 6. sıraya taşıdı — AMA bu sentetik test, gerçek İstanbul K4'te (BAY UMUT, aynı gün) YANLIŞ ÇIKAN bir tasarımı (sinyalSayisi kapısı) doğrulamamıştı, bkz. V5.39.",
    ],
  },
  {
    versiyon: "V5.39",
    baslangic: new Date("2026-09-02T22:52:00+03:00"),
    bitis: null,
    aciklama: "V5.38'in Saf Model Değer Terfisi kapısı düzeltildi — kullanıcı GERÇEK bir vakayla (İstanbul K4, BAY UMUT: fark=+5.1pp ama terfi etmedi) sorguladı. Kök neden: ikinci koşul (sinyalSayisi>=SINYAL_ESIGI) agfTrendTerfisi'nden ödünç alınmıştı — ama bu, V4/V2 döneminden kalma DAR bir 8-maddelik kontrol listesi (Accurace son-yarış-en-hızlı-kapanış/KGS-14-30/hipodrom-mesafe kazanma/aygır-üst-%20/keskin-galop/idman-jokeyi-uyumu/AGF-trend/son-yarış-kazandı) ve BAY UMUT'un marketBlindProb1'ini GERÇEKTE yükselten sinyallerle (hizDerecesi=+1.24, h2hNetSkor=+1, antrenorOrani=%13.8 — hepsi V5'in ASIL 12+ çekirdek sinyali) HİÇ ÖRTÜŞMÜYOR. BAY UMUT'un sinyalSayisi'si 0 çıktı, yanlış kapıdan reddedildi. Yeni koşul: marketBlindProb1'in KENDİ hesap yöntemiyle (AGF_KATKI_INDEKSLERI hariç, katkilar dizisinin AGF-dışı toplamı) modelin AGF'siz görüşü GERÇEKTEN net pozitif mi — ayrı/uyumsuz bir sinyal sayacı icat etmek yerine, marketBlindProb1'i zaten üreten aynı hesaplamayı yeniden kullanıyor.",
    neyiAnalizEdiyor: [
      "Skor/olasılık YİNE DEĞİŞMEDİ — yalnız degerTerfisi'nin tetiklenme KOŞULU değişti.",
    ],
    caprazlamalar: [
      "Gerçek İstanbul K4 (12 at, 2026-09-02) ve K6 (8 at) verisiyle çapraz doğrulandı: K4'te BAY UMUT (toplam AGF-dışı katkı +0.27, fark +5.1pp) artık DOĞRU şekilde 8.'den 6.'ya terfi ediyor, DEMİRHAN TAYI (doğal 6.) 7.'ye geriliyor — 1-5. sıradaki daha güçlü atlar dokunulmuyor. Aynı K4'te ŞİMŞEKKIRAN (+0.30, fark +6.3pp) da nitelik kazanıyor ama BAY UMUT'tan düşük ham olasılığı (%5.9 vs %6.6) yüzünden tek terfi slotunu kazanamıyor — beklenen davranış. DİLAN KIZ (K4, toplam -0.14 ama fark yine de +5.9pp) ve ANGEL OF DEFNE (K6, temel sinyalleri negatif) DOĞRU şekilde dışlanıyor — ikisinin büyük farkı yalnız AGF'nin ekstra kötümserliğinden geliyor, modelin kendi (AGF'siz) görüşü onlar için de zaten olumsuz. K9'da da (SUBİKE terfi etti, AFRAŞAH benzer farkla ama düşük olasılıkla etmedi) aynı desen doğrulandı. NOT (dürüstçe kayda geçirildi): K6'yı arka arkaya birden çok kez yeniden çalıştırırken BİR seferinde (eşzamanlı script yükü altında, h2h/hizDerecesi/agf-trend server action'larında geçici DB bağlantı hatası fırlatıldığında) fark değerleri farklı çıktı — hatasız her çalıştırmada rakamlar birebir aynı ve kararlıydı; bu muhtemelen bu oturumun kendi eşzamanlı test yükünden kaynaklanan geçici bir bağlantı-havuzu sıkışması, gerçek kullanıcı trafiğinde beklenmez ama izlenmesi gereken bir gözlem. tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti.",
    ],
  },
  {
    versiyon: "V5.40",
    baslangic: new Date("2026-09-02T23:40:00+03:00"),
    bitis: null,
    aciklama: "EKÜRİ DÜZELTMESİ — kullanıcı bulgusu (İstanbul K6): THEATER OF WAR 7.sırada görünüyordu, ama 1. ve 4. sıradaki JAEHAERA+DAELLA GERÇEK eküri (ekuriGroup=1, aynı sahip). agfSirasi'nin eküri ortaklarını AYNI piyasa sırasına koyma mantığı (gatherFaz1V5, 2026-08-30) yalnız AGF payı hesabına uygulanmıştı — terfi pencerelerinin (ilk-3/ilk-6) SINIRINA hiç uygulanmamıştı, bir eküri çifti pencere içinde bilfiil İKİ ayrı 'slot' tüketiyordu. Yeni efektifPencereSiniri fonksiyonu, terfiPenceresiV5'in ARTIK kullandığı sınırı (hem AGF Trend Terfisi hem Saf Model Değer Terfisi için) eküri çiftini TEK slot sayarak hesaplıyor. Ayrıca faz2V5Sirala'nın SONUNDA yeni bir alan (ekuriIlk6Efektif) eklendi: bir at, eküri-farkında hesapla GERÇEKTE ilk-6 içindeyse (ham teknikSira'dan BAĞIMSIZ olarak), karar Orta/Yüksek Risk'ten Düşük Risk'e çekiliyor — THEATER OF WAR artık bu sayede Düşük Risk kararı alıyor, tıpkı gerçekten ilk-6'daymış gibi.",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞMEDİ. teknikSira (ham 1..N sıra) da DEĞİŞMEDİ — yalnız (a) terfi pencerelerinin CANDIDACY sınırı ve (b) karar (Orta/Yüksek Risk → Düşük Risk) etkilendi.",
    ],
    caprazlamalar: [
      "Gerçek İstanbul K6 ile doğrulandı: efektifPencereSiniri(sirali, 6) artık 7 dönüyor (JAEHAERA+DAELLA tek slot sayıldığı için sınır bir pozisyon dışarı kayıyor) — THEATER OF WAR (ham 7.) ekuriIlk6Efektif=true, karar=Düşük Risk; yalnız ANGEL OF DEFNE (ham 8.) hâlâ dışarıda (ekuriIlk6Efektif=false). arac-terfi-denetimi.mts ile son 20 gerçek koşuda (--son 20) toplu doğrulama: iki mekanizma de (AGF Trend Terfisi, Saf Model Değer Terfisi) çok sayıda koşuda tutarlı tetikleniyor, yakın-ıskaların neredeyse tamamı gerekçeyle açıklanabiliyor (ya 'başka aday kazandı' ya 'temel sinyaller net negatif, doğru dışlanmış'), yalnız BİR tanesi (Elazığ K4, LADY İSİS, nonAgfKatki=-0.01) sınırda — pratik olarak sıfıra eşit, endişe verici değil. tsc --noEmit temiz, npm run build temiz, v5-engine.test.ts 7/7 geçti.",
    ],
  },
  {
    versiyon: "V5.41",
    baslangic: new Date("2026-09-03T10:45:00+03:00"),
    bitis: null,
    aciklama: "Saf Model Değer Terfisi'ne İLK-3 kademesi eklendi — kullanıcı bulgusu (İzmir K5, 2026-09-03, KINDBERO): at kazandı ama 4.sırada kaldı. Saf Model (AGF'siz) onu 2.sırada (%16.4) görüyordu — hızDerecesi +4.0 (güçlü), h2hNetSkor +4, son 8 startta 2 galibiyet, bugünden önceki son starttı da galibiyetti. AGF onu yalnız 5.sıraya koymuştu (fark=+8.2pp). 4.sıra zaten ilk-6 içi olduğu için V5.39/40'ın ilk-6 tabanı hiç devreye girmedi — kullanıcı ilk-3 için de aynı ilkeyi istedi. AYNI (koşulsuz splice) mekanizma, agfTrendTerfisi'nin ilk3→ilk6 İKİ KADEMELİ desenIYLE birebir aynı yapıda uygulandı: önce daha SIKI bir eşikle (SAF_MODEL_DEGER_ESIGI_ILK3=8pp, KINDBERO'nun kendi rakamıyla uyumlu — ilk-3 daha büyük bir iddia, yanlış-pozitif riski daha yüksek) ilk-3 denenir, sonra (ilk-3'ü kazanamayan adaylar dahil) mevcut 5pp eşiğiyle ilk-6 denenir. degerTerfisi alanı boolean'dan \"ilk3\"|\"ilk6\"|null'a genişletildi (agfTerfi ile AYNI şekil).",
    neyiAnalizEdiyor: [
      "Skor/olasılık DEĞİŞMEDİ. teknikSira DEĞİŞMEDİ — yalnız degerTerfisi'nin alabileceği değerler (artık \"ilk3\"|\"ilk6\"|null) ve buna bağlı karar (agfTerfi===\"ilk3\" ile AYNI, \"Güçlü Aday\"a çekiliyor) etkilendi.",
    ],
    caprazlamalar: [
      "Gerçek İzmir K5 ile doğrulandı: KINDBERO artık 4.'ten 3.'e terfi ediyor (degerTerfisi=\"ilk3\"). Aynı koşuda ARDAPAŞA da nitelik kazanıyor (fark=+11.4pp, KINDBERO'dan bile büyük) ama KINDBERO'nun daha yüksek ham olasılığı (%9.4 vs doğal 6.sıra) yüzünden tek terfi slotunu kazanamıyor — beklenen davranış (terfiPenceresiV5 en güçlü ham olasılıklı adayı seçiyor, fark büyüklüğüne göre değil). arac-terfi-denetimi.mts ile İzmir K5 + önceki 4 doğrulanmış koşuda (İstanbul K1/K4/K6/K9) toplu regresyon kontrolü: hiçbir mevcut terfi/karar bozulmadı, yeni ilk-3 yakın-ıskaları hep mantıklı gerekçeyle açıklanabiliyor. tsc --noEmit temiz, v5-engine.test.ts 7/7 geçti.",
    ],
  },
];
