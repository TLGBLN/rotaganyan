// Sistem Anatomisi — sade Türkçe açıklamalar. Teknik terim kullanmadan: "ne işe yarar", "bozulursa ne olur".
// Not: hiçbir katmanın bozulması V5.46'nın eldeki veriyle analiz üretmesini ENGELLEMEZ (sağlık sistemi doktordur, kontak anahtarı değil).

export type LayerExplanation = {
  /** Sade ad */
  ad: string;
  /** Ne işe yarar? */
  ne: string;
  /** Bozulursa / çalışmazsa ne olur? */
  olmazsa: string;
};

export const LAYER_EXPLANATIONS: Record<string, LayerExplanation> = {
  "data-source": {
    ad: "Veri toplama",
    ne: "TJK'dan yarış programını, atları ve sonuçları çeken ilk halka. Hangi bilginin ne kadar dolu olduğu aşağıdaki \"Veri Tamlığı\" tablosunda görünür.",
    olmazsa: "Sisteme yeni yarış ve at bilgisi girmez. Altındaki her şey (program, tahmin, kupon) eldeki eski veriyle çalışmaya devam eder ama zamanla bayatlar.",
  },
  program: {
    ad: "Program",
    ne: "Bugünün ve yarının koşularını, atları, jokeyleri ve pist bilgisini tutar. Sitedeki Program sayfası ve tahminler buna dayanır.",
    olmazsa: "Ziyaretçi eski ya da eksik program görür; tahmin üretilecek yeni yarış bulunamaz.",
  },
  agf: {
    ad: "AGF / Piyasa",
    ne: "Bahisçilerin her ata verdiği oran (AGF): yani piyasanın fikri. Tahmin motoru bunu bir ipucu olarak kullanır.",
    olmazsa: "Motor piyasanın fikrini göremez. Tahmin yine üretilir ama bu ipucu eksik kaldığı için doğruluk biraz düşebilir.",
  },
  "horse-cache": {
    ad: "At profil önbelleği",
    ne: "Her atın geçmiş yarışlarını ve istatistiklerini önceden hazır tutar; böylece tahmin anında TJK'yı beklemeyiz. Yarışı yaklaşan atlar önce yenilenir.",
    olmazsa: "Tahmin, atın eski bilgisiyle yapılır; bazı ipuçları eksik ya da bayat hesaplanır. Analiz durmaz ama kalitesi düşebilir.",
  },
  engine: {
    ad: "Tahmin motoru",
    ne: "Her koşu için atların kazanma ihtimalini hesaplayan V5.46 modeli. Sistemin kalbi.",
    olmazsa: "Yeni tahmin üretilemez; sitede son üretilen tahminler kalır.",
  },
  results: {
    ad: "Sonuçlar",
    ne: "Biten yarışların gerçek sonuçlarını alır. Tahminlerin tutup tutmadığını ölçmek için şart.",
    olmazsa: "Tahminlerin isabeti ölçülemez, kuponlar \"tuttu / tutmadı\" diye işaretlenemez.",
  },
  calibration: {
    ad: "Kalibrasyon",
    ne: "Motorun verdiği yüzdeleri gerçeğe yaklaştırır (aşırı iddialı çıkan yüzdeleri törpüler) ve ne zaman müdahale ettiğini kaydeder.",
    olmazsa: "Yüzdeler gerektiğinden iddialı görünebilir. Atların sıralaması değişmez; yalnızca \"%80 güven\" gibi rakamlara fazla güvenmeyin.",
  },
  challenger: {
    ad: "Gölge test (Challenger)",
    ne: "Yeni model fikirlerini canlıya almadan, arka planda gerçek yarışlarda deneyerek ölçer.",
    olmazsa: "Yeni fikirler test edilemez. Canlı tahminler etkilenmez.",
  },
  coupon: {
    ad: "Kupon üretimi",
    ne: "Tahminlerden Altılı ve 7'li kupon önerilerini hazırlar.",
    olmazsa: "Anasayfadaki kupon önerileri eski kalır ya da görünmez. Tahmin sayfaları etkilenmez.",
  },
  site: {
    ad: "Site / API",
    ne: "rotaganyan.com'un ziyaretçiye açık olup olmadığını, hızını ve doğru sürümün yayında olup olmadığını kontrol eder.",
    olmazsa: "Ziyaretçiler siteye giremez, yavaş açılır ya da eski sürümü görür.",
  },
  cron: {
    ad: "Zamanlanmış işler",
    ne: "Program çekme, sonuç alma, önbellek yenileme gibi otomatik işleri zamanında çalıştıran sistemin \"saati\".",
    olmazsa: "Otomatik güncellemeler durur; veriler yavaş yavaş eskir.",
  },
  database: {
    ad: "Veritabanı",
    ne: "Bütün verinin durduğu ana depo.",
    olmazsa: "Hiçbir bilgi okunamaz ya da yazılamaz; sistem fiilen durur.",
  },
  "forward-coverage": {
    ad: "Tahmin anı veri yeterliliği",
    ne: "Tahmin yapıldığı ANDA atlar hakkında ne kadar bilgi olduğunu kaydeder. Geçmiş kayıtlar bilerek değiştirilmez.",
    olmazsa: "Motor eksik bilgiyle tahmin yaptığında bunu fark etmeyiz; tahminler yine üretilir.",
  },
  "model-health": {
    ad: "Model sağlığı",
    ne: "Motor gerçekten iyi mi? Son 100 ve 300 yarışta isabet ve hata payını ölçer. Sadece izler, müdahale etmez.",
    olmazsa: "Motor kötüleşse bile geç fark ederiz. Tahminler durmaz.",
  },
};

export type RepairClassName = "AUTO" | "RETRY" | "OBSERVE_ONLY" | "MANUAL";

/** "Sistem bunu kendi düzeltecek mi?" sorusunun sade cevabı */
export const REPAIR_PLAIN: Record<RepairClassName, { etiket: string; aciklama: string }> = {
  AUTO: { etiket: "Kendi kendine düzelir", aciklama: "Otomatik yenileme çalışıyor; sorun varsa sistem kendisi gideriyor." },
  RETRY: { etiket: "Kendini tekrar dener", aciklama: "Bir sonraki otomatik turda yeniden dener; genelde birkaç dakikada toparlanır." },
  OBSERVE_ONLY: { etiket: "Yalnızca izlenir", aciklama: "Bilerek müdahale edilmez (geçmiş kayıt değiştirilmez). Süre dolunca ya da yeni veriyle kendiliğinden kapanır." },
  MANUAL: { etiket: "Elle müdahale gerekir", aciklama: "Sistem yalnızca haber verir; yanlış otomatik düzeltme riskli olduğu için kendisi dokunmaz." },
};

export const STATUS_PLAIN: Record<"healthy" | "warning" | "critical" | "unknown", string> = {
  healthy: "Sorun yok.",
  warning: "Küçük bir aksaklık var ya da başka bir katmandaki sorundan etkileniyor. Sistem çalışıyor.",
  critical: "Bu katmanın kendisinde gerçek bir sorun var.",
  unknown: "Henüz ölçülemedi.",
};
