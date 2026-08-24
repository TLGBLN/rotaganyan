/**
 * 2026-08-24 kullanıcı talebi: /admin dashboard'daki "Analiz Motoru Versiyon Karşılaştırması"
 * bölümü kaldırılıp yerine bu geldi — "sinyalleri burda takip edicez başarılarını". ENGINE_
 * VERSIONS ile AYNI desen: elle bakımı yapılan, koşu ekibinin (biz) her yeni eğitimde
 * güncellediği bir referans kütüğü — canlı sorgu değil, model her yeniden eğitildiğinde
 * (arac-model-egit-segment.mjs çıktısından) buradaki katsayı/GA/anlamlılık elle senkronize
 * edilmeli. GERÇEK (yayınlanmış tahminlerdeki fiili kazanma oranı) tarafı ayrı bir mekanizma:
 * v5-sinyal-performans.service.ts — bu ikisi kasıtlı ayrı tutuluyor (biri modelin kendi
 * iddiası/katsayısı, diğeri sahadaki gerçek sonuç).
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
  { ad: "Accurace", kod: "accurace", dusukSart: { katsayi: 0.14, durum: "anlamli" }, diger: { katsayi: 0.009, durum: "anlamsiz" }, aciklama: "Son yarışta sahanın en hızlı son 200m kapanışı — düşük-şartta örneklem büyüyünce anlamlı çıkmaya başladı." },
  { ad: "İdman Jokeyi Uyumu", kod: "idmJokey", dusukSart: { katsayi: 0.169, durum: "anlamli" }, diger: { katsayi: 0.092, durum: "sinirda" }, aciklama: "Yarıştıracak jokey, atın idmanlarından birini yaptırmış mı." },
  { ad: "Jokey Oranı", kod: "jokeyOrani", dusukSart: { katsayi: 0.221, durum: "anlamli" }, diger: { katsayi: 0.116, durum: "anlamli" }, aciklama: "Jokeyin genel kazanma yüzdesi." },
  { ad: "Kaçak At / Erken Tempo", kod: "kacakAtMi", dusukSart: { katsayi: 0.161, durum: "anlamli" }, diger: { katsayi: 0.061, durum: "anlamsiz" }, aciklama: "Accurace tabanlı erken-tempo profili." },
  { ad: "AGF Düşüşü Var Mı", kod: "agfDususVarMi", dusukSart: { katsayi: 0.129, durum: "anlamli" }, diger: { katsayi: 0.051, durum: "anlamsiz" }, aciklama: "Eşik-üstü (≥1.0 puan) AGF düşüşü — para akışı sinyali." },
  { ad: "Kilo-Ayarlı H2H", kod: "h2hKiloDegisimi", dusukSart: { katsayi: 0.085, durum: "sinirda" }, diger: { katsayi: 0.07, durum: "anlamli" }, aciklama: "Bugünkü rakiplere göre kilo pozisyonunun geçmiş karşılaşmaya göre değişimi — diğer segmentte örneklem büyüyünce anlamlı hale geldi." },
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
];

export type SiralamaKurali = {
  ad: string;
  etiket: string;
  aciklama: string;
  backtestOzet: string;
};

export const SIRALAMA_KURALLARI: SiralamaKurali[] = [
  {
    ad: "AGF Trend Terfisi",
    etiket: "İLK3 / İLK6 · olasılıkla YARIŞIR",
    aciklama: "En çok yükselen/düşen AGF trendini taşıyan + yeterli sinyal sayısına (≥4) sahip atlar, ham sıralamada geride kalsa bile ilk-3'e/ilk-6'ya terfi eder. Aday havuzu + doğal sakinler birlikte olasılığa göre yeniden sıralanır.",
    backtestOzet: "n=663 → %21.6 galibiyet / %53.8 top3",
  },
  {
    ad: "AGF Favorisi İlk-3 Garantisi",
    etiket: "V5.13 · koşulsuz",
    aciklama: "AGF sırası=1 olan at, ham olasılık sıralamasında top3 dışında kalsa bile KOŞULSUZ 3.sıraya alınır (mevcut #3'ün yerini alarak). Olasılıkla yarışmaz.",
    backtestOzet: "n=428 (Karma hariç, düzeltilmiş) → net +5 yarış (top3 %60.0→%61.2)",
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
    ad: "Handikap 3. Segment (İzole Model)",
    durum: "beklemede",
    etiket: "Onaylandı · ertelendi",
    aciklama: "hpIvmesi/kiloDegisimi gibi Handikap'a özgü sinyalleri kendi izole segmentine ayırma fikri — kullanıcı onayladı, şimdilik ertelendi.",
  },
  {
    ad: "Zemin Ağırlığı Sinyali",
    durum: "beklemede",
    etiket: "Veri yetersiz",
    aciklama: "RaceDay.surfaceConditions gerçekten değişiyor ama n=3 gün — kış yağmurlarında veri birikince tekrar test edilecek.",
  },
  {
    ad: "Yurt Dışı Yarış Genişletmesi",
    durum: "beklemede",
    etiket: "Karar verilmedi",
    aciklama: "TJK'nın yabancı hipodromları Türk formatında yayınlıyor — AGF/HP/Sıklet/tam geçmiş dolu, ücretli kaynağa gerek yok. İş planı hazır, başlanmadı.",
  },
];
