export type Topic = {
  key: string;
  label: string;
  title: string;
  guidance: string;
  questions: string[];
  warning?: string;
};

export const TOPICS: Topic[] = [
  {
    key: "derece",
    label: "① Derece",
    title: "Derece — İlk Adım (En Kritik)",
    guidance:
      "Bu pist+mesafede grubun EN İYİ derecesi kimde? Liste yap. En iyi derece sahibi 1. sırada mı? Değilse NEDEN? (jokey/pedigri sicili geçemez.) 'Bu derece hangi pistte?' doğrulanmadan sıralama değiştirilmez.",
    questions: [
      "Bu pist+mesafede en iyi derece kimde? Liste oluştur.",
      "En iyi derece sahibi 1. sırada mı? Değilse gerekçe var mı?",
      '"Bu derece hangi pistte/mesafede koşuldu?" doğrulandı mı?',
    ],
    warning:
      "Karain Aslanı / Çeşnigir / Metalive: 13.06'da 3 kez derece görmezden gelindi. Sükanvey: doğrulanmamış derece exact kanıtı yetemez.",
  },
  {
    key: "sicil",
    label: "② Sicil > Kilo",
    title: "Sicil > Kilo",
    guidance:
      "Exact pist+mesafe kazanmışlığı olan at 1. sırada mı? Büyük kilo düşüşü (-4/-5kg) olan ama sicilsiz at 1. sıraya YAZILMADI mı? Kilo düşüşü LİSTEYE sokar, SİCİL sıralar. Ağır kilolu kaliteli atı dibe atma (Love Sea/Oztamer dersi).",
    questions: [
      "Aynı pist+mesafede kazanmışlığı olan at var mı?",
      "Büyük kilo düşüşlü ama sicilsiz at 1. sıraya yazılmadı mı?",
      "Sınıf düşüşü yapan at var mı? (KV/Handikap'tan inen → büyük avantaj)",
      "Ağır kilolu kaliteli at yanlışlıkla dibe atılmadı mı?",
    ],
    warning:
      "20/20 Dersi: 20 art arda kaybın 20'sinde de 1. at 'büyük kilo düşüşü' seçimiydi. -4/-5kg düşüş 4-6. bant, asla 1. sıra.",
  },
  {
    key: "agf",
    label: "③ AGF",
    title: "AGF Kontrol",
    guidance:
      "AGF 1. = sistem 1. mi? → onay, banko tartışmasına açılır. Değilse BANKO YOK. AGF %40+ EZİCİ + HP 85+ → en az 2. sıra zorunlu (Şıkturbo). AGF 2-3. favorisi sistemde 4+ sırada ise çekirdeğe al.",
    questions: [
      "AGF 1. = sistem 1. mi? (Değilse banko yazma)",
      "AGF %40+ EZİCİ + HP 85+? → En az 2. sıra zorunlu",
      "AGF 2-3. favorisi sistemde 4+ sırada mı? → Çekirdeğe al",
      "AGF ilk 3 geniş kuponda korundu mu?",
    ],
    warning:
      "Sugar Storm / Can Efe / Şıkturbo dersleri: AGF ayrışması bankoyu engeller. Piyasa %40+ baskın favori gösteriyorsa bilinmeyen güç/sicil sinyali var.",
  },
  {
    key: "tempo",
    label: "④ Tempo",
    title: "Tempo Etkisi",
    guidance:
      "Kaç kaçak var? 0=avare/yavaş · 1=düşük/orta · 2-3=sert · 4+=çok sert/intihar. Sert tempoda kaçak = 0 puan (yıpranır). Bekleme + tüy siklet + güçlü galop yukarı çıkarılır. Tek kaçak + yavaş tempo → ayna senaryosu.",
    questions: [
      "Kaç kaçak var? Tempo tipi nedir?",
      "Sert tempoda kaçak stili olanlar aktif düşürüldü mü?",
      "Bekleme + tüy siklet + güçlü galop kombinasyonu yukarı çıkarıldı mı?",
      "Tek kaçak + yavaş tempo → ayna senaryosu kontrol edildi mi?",
    ],
    warning:
      "Dorukbatur dersi: Tempo analizi NOT olarak kalmaz. Sert tempo sıralamayı aktif değiştirir: kaçak stili düşer, bekleme+galop çıkar.",
  },
  {
    key: "atlar",
    label: "⑤ Tüm Atlar",
    title: "Tüm Atlar Analiz Edildi mi?",
    guidance:
      "Gruptaki HER at analiz edildi mi? 'Diğerleri' ile geçiştirilmedi mi? Sicili belirsiz atların kazanmışlığı sorgulandı mı? DS kodlu at: dış kulvar mı yoksa 1. kulvara geçiş mi? Sürpriz alarm: 52kg + kalabalık grup + iç start + yeni takı.",
    questions: [
      "Her at tek tek ele alındı mı? (Hiçbir at 'sistemde yok' geçilemez)",
      "DS kodlu at var mı? (Dış kulvar mı, 1. kulvara geçiş mi?)",
      "15+ atlı kalabalık grupta iç start + hafif kilo + yeni takı kombinasyonu var mı?",
      "Sicili belirsiz ama piyasada ilgi gören at var mı?",
    ],
    warning:
      "Golden Bee dersi: Hiç ele alınmamış atlardan sürpriz gelir. Prenses Seda: 52kg + DB yeni + start 5 → sistem 13. koymuş, kazandı (22.25).",
  },
  {
    key: "banko",
    label: "⑥ Banko",
    title: "Banko Kararı",
    guidance:
      "Handikap/Grup/Şartlı-1 → ASLA TEK, kombinasyon zorunlu (%20 banko isabeti). KV/Şartlı banko: fark ≥3 + puan ≥6. Maiden banko: fark ≥4 + puan ≥7. Fark <2 → kombinasyon zorunlu.",
    questions: [
      "Koşu tipi banko verebilir mi? (Handikap/Grup → HAYIR)",
      "AGF uyumu var mı? (Yoksa banko YAZMA)",
      "KV/Şartlı: fark ≥3 + puan ≥6 mi?",
      "Maiden: fark ≥4 + puan ≥7 mi?",
    ],
    warning:
      "İsabet: Maiden tek %83 · Şartlı %60 · Handikap %40 · Satış (N=3) → GENİŞ kombinasyon şart.",
  },
  {
    key: "galop",
    label: "Galop",
    title: "Galop Baremleri",
    guidance:
      "Şekil: ÇR (çok rahat) = en iyi · R (rahat) = hazır · HÇ (hafif çalışarak) = iskonto · Ç (çalışarak) = iskonto. İç pist galoplarına ~1sn avans ver (viraj etkisi). İngiliz 600m iyi: 0.36-0.38 · Arap 600m iyi: 0.39-0.42.",
    questions: [
      "Son galop şekli R veya ÇR mi? (Ç/HÇ = iskonto)",
      "Barem içinde mi? (İngiliz/Arap tablosu ile karşılaştır)",
      "İç pist ise ~1sn avans uygulandı mı?",
      "Eski güçlü galoplar var mı? (Son iş sönük dese bile baskın olabilir)",
    ],
  },
  {
    key: "jokey",
    label: "Jokey",
    title: "Jokey Kuralları",
    guidance:
      "Son 1 ay 0/X verisi tek başına çekirdekten çıkarmaz. Aynı jokey devam ediyor mu? → At-jokey istikrarı pozitif çıpadır. 3/3+ uyum form kırığını dengeler. Deklarasyon değişimi (A'dan B'ye) = hedef sinyali. Apranti: -3/4kg net avantaj.",
    questions: [
      "Aynı jokey devam mı ediyor? (İstikrar = artı çıpa)",
      "At-jokey uyumu kaç/kaç? (3/3+ → form kırığı önemli değil)",
      "Deklarasyon değişimi var mı? (A'dan B'ye geçiş = hedef sinyali)",
      "Sarı üçgen (idman jokeyi = yarış jokeyi) var mı?",
    ],
    warning:
      "Emirenes dersi: At-jokey 3/3, sicil/form eksikliğine rağmen sıralamayı yukarı taşır. Kalabalık grupta jokey atı bilir, trafik yönetir.",
  },
  {
    key: "taki",
    label: "Takı",
    title: "Takı Sinyalleri",
    guidance:
      "İlk kez takılan → +1/+2 pozitif sinyal. Mevcut/değişmeyen → sinyal SIFIR. Çıkarılan (DB, KG, SK) → nötr/pozitif (olgunlaşma), olumsuz DEĞİL. Takısız koşan at → sakinlik +1. Maiden/Ş1: pedigri + ilk kez KG+K veya KG+DB = +4 sinerji.",
    questions: [
      "İlk kez takılan takı var mı? (+1/+2 sinyal)",
      "Takı çıkarılmış mı? (Nötr/pozitif — olgunlaşma sinyali)",
      "KG+SK birden çıkarılıp takısız mı? (Güçlü pozitif)",
      "Maiden/Ş1: Güçlü pedigri + ilk kez KG+K veya KG+DB? (+4 sinerji)",
    ],
  },
];

export const CHECKLIST_6 = [
  "① Derece — Bu pist+mesafede EN İYİ derece kimde? Liste yap.",
  "② Sicil > Kilo — Büyük kilo düşüşü sicilsiz atı 1. sıraya taşımaz.",
  "③ AGF — AGF 1. = sistem 1.? Değilse BANKO YOK.",
  "④ Tempo — 2+ kaçak = sert tempo → kaçaklar aktif düşürüldü mü?",
  "⑤ Tüm Atlar — Her at tek tek analiz edildi mi? Hiçbir at geçilemez.",
  "⑥ Banko — Handikap/Grup → KOMBİNASYON ZORUNLU.",
];
