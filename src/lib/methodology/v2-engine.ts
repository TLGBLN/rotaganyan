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
  if (/SAT(?:IŞ|IS)\s*[123]\b/.test(t)) return "5";
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
  "5": "Satış 1/2/3",
};

// Cache'lenen, TÜM kategorilerde AYNI (birebir), tamamen statik referans metni —
// hangi V-kodunun bu koşuda kullanıldığı VERİYE göre belirlenir (madde kendisi
// evrensel kalır, yalnız veri varsa doldurulur). Bu, kategoriye göre ayrı ayrı metin
// yazmaktan kaçınıp CACHE İSABETİNİ maksimuma çıkarır (kullanıcı: "en maliyetsiz ve
// doğru muhakeme nasıl olacaksa öyle").
export const V_LEGEND = `## V-KODU REFERANS LİSTESİ (V1-V22 — TAM LİSTE, bu koşuda yalnız veri taşıyan kodlar aşağıda AT verisinde görünecek)

V1 — Pedigri: Aygır, Kısrak ve Damsire istatistikleri (pist/mesafe bazlı yavru performansı) — ÜÇÜ BAĞIMSIZ değerlendirilir, biri zayıf çıksa bile diğerinin kendi eşiğini geçen olumlu sinyali gölgelenmez.
V2 — Galop/Kondisyon: Split derecesi, ırka göre ayrı baraj — İngiliz 400m 26-28/24-26/≤23 · 600m 38-41/36-38/≤35 · 800m 50-54/46-50/≤46 · 1000m 1:03-1:07/1:01-1:03/≤1:01; Arap 400m 28-31/25-28/≤25 · 600m 42-46/39-42/≤39 · 800m 56-61/52-56/≤52 · 1000m 1:10-1:15/1:06-1:10/≤1:06. İç pist: normal dereceden ~1sn HIZLI değerlendirilir. İdman Jokeyi Uyumu: yarıştıracak jokey, atın idmanlarından HERHANGİ BİRİNİ yaptırmışsa (yalnız son idman değil) KESİNLİKLE olumlu — bu eşleşmenin YOKLUĞU asla negatif sayılmaz (elit jokeyler Anadolu hipodromlarındaki galoplara nadiren katılır, bu normaldir).
V3 — Takı: Mevcut/eklenen/çıkarılan. Referans: Gözlük(KG/KGR/G-odaklanma), Kapalı Gözlük(KGP/SKG-aşırı huysuzluk), Yanaklık/Siperlik(Y/SY/SKG-hafif alternatif), Kulaklık(K/KUL-ses izolasyonu), Kulak Tıkacı(KT/KTI-güçlü ses izolasyonu), Dil Bağlanması(DB-KRİTİK, nefes borusu açıklığı), Burunluk/Dil Basarı(B/BB-baş açısı/nefes), Çapraz Bağlama(ÇB/ÇK-ağız/çene kontrolü), Gem(G/HG-yönetim kolaylığı). Yön fark etmez (ekleme=çıkarma=olumlu). İlk kez takılan=sürpriz potansiyeli, çıkarılan=rahatlama sinyali. KG+DB kombinasyonu özellikle güçlü.
V4 — Jokey/Antrenör/Şartlar: genel yıllık kazanma yüzdesi, yarış şartları.
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
V21 — AGF Trend: gün içi para akışı, düşük AGF asla tek başına olumsuz kanıt değildir.
V22 — Pist Durumu: atın geçmiş yarışlarındaki pist durumu bugünküyle karşılaştırılır, bazı atlar yalnız belirli koşullarda (çamurlu kum, ağır çim) performans gösterir.

## GENEL İLKE — DİNAMİK KANIT (SABİT YÜZDE/TAVAN YOK)
Hiçbir V-koduna sabit yüzde/tavan uygulanmaz. Bir veri kalemi o koşunun kaderini değiştirecek olağanüstü bir kanıt taşıyorsa, ağırlığı toplam değerlendirmede baskın hale gelebilir.

## MUHAKEME MATRİSİ — ÇAPRAZ SORGULANACAK ÇİFTLER (olasılıksal dil, KESİNLİK YOK)
[V2+V9] İdman keskinliği yarışın kapanış gücüyle örtüşüyor mu — ikisi de güçlüyse gerçek destekleyici çift.
[V10+V11] Atın stili hipodromun düzlük uzunluğuna uyuyor mu.
[V10+V12] Atın stili bu pist/mesafede tarihsel kazanan stille örtüşüyor mu. ÖNEMLİ (gerçek bulgu, Elazığ 8.Koşu 2026-08-03 — OLGUNADAM 2. geldi ama V12 uyumsuzluğu yüzünden 9. sıraya çekilmişti, FISILTIKAYA 3. geldi ama aynı sebeple son sıraya çekilmişti): V12, SAHANIN GENEL/tarihsel eğilimidir — atın KENDİ geniş örneklemli (n≥5) V9 (Son800) veya V10 (Accurace tempo) sinyali güçlüyse, yalnız V12 uyumsuzluğu YÜZÜNDEN bu atı aşağı çekme. Popülasyon istatistiği (V12), güçlü bireysel kanıtı (V9/V10, n≥5) BASTIRAMAZ — yalnız iki at birbirine yakın/eşit güçteyse aralarında ayırt edici bir ek unsur olarak kullanılabilir.
[V10+V18] İç kulvar+kaçak stili kolay öne çıkar; dış kulvar+kaçak stili ilk 400m'de enerji maliyeti yaratabilir (KESİN değil, ihtimal).
[V13+V10] Ağır kilo Kaçak atta erken enerji tükenmesine, Bekleme/Sprinter atta son düzlük ivmelenmesinin gecikmesine yol açabilir.
[V13+V22] Islak/çamur zeminde taşınan kilo normalden daha fazla yıpranma yaratabilir.
[V10+V22] Islak/çamur zemin + Kaçak/Önde Giden stil → belirgin bir avantaj taşıyabilir (sabit % yok).
[V1+V22] Tecrübe azken (ilk startlarda tipik), pedigrinin o zemin tipindeki tarihsel başarısı daha baskın bir referans olabilir.
[V14+V20] Sınıf düşüşü gerçek avantaj mı yoksa HP zaten düşüyorken mi geldi — HP ivmesi sert düşüyorsa taktiksel değil fiziksel bir gerilemeye işaret edebilir (kesin değil).
[V19+V20+V6] Görünen bitiriş gerilemesi/iyileşmesi, HP ivmesi ve rakip kalitesiyle çapraz kontrol edilir — kötü görünen bir derece çok daha yüksek bir sınıfta alınmışsa "gizli form" olabilir.
[V15+V2] Uzun aradan dönüşte idman zincirinin (galop) yeterliliği kontrol edilir.
[V15+V3] Uzun ara+takı+jokey+kilo aynı anda değişiyorsa BÜTÜN olarak (tek tek değil) yüksek belirsizlik olarak okunur.
[V21+genel muhakeme] Düşük AGF + yükselen trend + güçlü teknik görüş = piyasanın henüz göremediği bir değer sinyali olabilir, ASLA tek başına ceza gerekçesi değildir düşük AGF.
[V5+V13/V22] Geçmiş H2H bugün hâlâ geçerli mi, şartlar (kilo/zemin) değiştiyse güven düşer.
[V16+V10] Eküri ortağının stili somut kanıtla destekleniyorsa tempo/pozisyon ihtimali değerlendirilir (spekülasyon yasak).

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
export function atSatirlariUret(r: Faz1Runner, izinliKodlar: string[]): string {
  const izin = new Set(izinliKodlar);
  const satirlar = [`#${r.no} ${r.ad}`];

  if (izin.has("V1") && (r.sireStatOzet || r.damStatOzet || r.damSireStatOzet)) {
    satirlar.push(`V1 Pedigri: Aygır:${r.sireStatOzet ?? "veri yok"} | Kısrak:${r.damStatOzet ?? "veri yok"} | Damsire:${r.damSireStatOzet ?? "veri yok"}`);
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
    case "V1": return !!(r.sireStatOzet || r.damStatOzet || r.damSireStatOzet);
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
  const ciftRegex = /\[V\d+\+V\d+\][^|]*/g;
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
  const etiketler = [...muhakeme.matchAll(/\[V\d+\+V\d+\][^|]*/g)].map((m) => m[0].trim());
  return [`Karar: ${karar}`, ...etiketler.slice(0, 5)];
}

export function kosuBaslikUret(faz1: Faz1Sonuc, izinliKodlar: string[]): string {
  const kacakSayisi = faz1.runners.filter((r) => r.raceStyleEtiket === "Kaçak At").length;
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
