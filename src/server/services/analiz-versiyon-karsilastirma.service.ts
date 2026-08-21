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
    bitis: null,
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
