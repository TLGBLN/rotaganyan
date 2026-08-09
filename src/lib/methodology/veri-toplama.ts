/**
 * ROTAGANYAN — FAZ 1 OTOMATİK VERİ TOPLAMA
 * veri-toplama.ts
 *
 * Metodolojinin FAZ 1'i (ham veri çıkarma) burada TAMAMEN OTOMATİK yapılır —
 * admin hiçbir alanı elle girmek ZORUNDA değildir. Girdiler sitenin kendi TJK
 * verisinden (Runner tablosu + AtKosuBilgileri geçmişi + Son800 istatistikleri +
 * jokey/antrenör senkronizasyonu) türetilir. Bazı alanlar (takı "uygunluğu",
 * galop zincirinin "keskinliği" gibi tamamen öznel değerlendirmeler) yerine,
 * ölçülebilir bir yaklaşıklık kullanılır — bu yaklaşıklıklar aşağıda açıkça
 * belirtilmiştir. Admin isterse /admin/pedigri üzerinden (tek tek ya da toplu
 * yapıştırarak) pedigri metni girebilir — bu veri girildiyse Faz 1 otomatik
 * olarak okur ve Faz 2 skorlamasına dahil eder.
 */

import { db } from "@/lib/db";
import { fetchTjkAtKosuBilgileri } from "@/server/services/ingest/tjk-at-performans.adapter";
import { galopQuality, isSameJockey } from "@/components/program/panels/galop-helpers";
import { getAtPerformansForRace } from "@/server/actions/at-performans.actions";
import { getH2HForRace } from "@/server/actions/h2h.actions";
import { getSireStatOzetleriForRace } from "@/server/actions/sire-stat.actions";
import { getDamStatOzetleriForRace, getDamSireOwnStatForRace } from "@/server/actions/dam-stat.actions";
import {
  hpKalitesiYildizi, sinifGecisBonusu, galopSiniflandirmasi, tempoGuvenSeviyesi,
  kacakHaritasi, zeminKatsayisi, zeminDetayiBul, zeminDetayiSatirdanCikar, type GalopZinciriSonuc, type TempoGuven,
} from "@/lib/methodology/mekanik-puanlama";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, type PaceCheckpoint, type CokYarisEgilim } from "@/lib/methodology/pace-analizi";
import { kulvarBolgesi } from "@/lib/hipodrom-mesafe-koordinat";
import { HIPODROM_OZELLIKLERI } from "@/lib/hipodrom-ozellikleri";
import { formatHorseDetailStatOzet, type HorseDetailStatSection } from "@/lib/methodology/horse-detail-stat-match";
import { getSonYarisDetaylariForRace } from "@/server/actions/son-yaris-detay.actions";
import { getAgfTrendForRace } from "@/server/actions/agf-trend.actions";
import { getGecmisBaglamForRace } from "@/server/actions/gecmis-baglam.actions";
import { getGecCikisOzetleriForRace, type GecCikisOzet } from "@/server/actions/gec-cikis.actions";
import { getPistMesafeStilIstatistigi } from "@/server/actions/pist-mesafe-stil.actions";
import { tjkTarihOncesiMi } from "@/lib/tjk-date";

/** Faz1 promptu için tek satırlık özet metin — gecCikisSayisi=0 olan atlar için de üretir (temiz sicil bir sinyaldir). */
function formatGecCikisOzet(ozet: GecCikisOzet | undefined): string | null {
  if (!ozet) return null;
  if (ozet.gecCikisSayisi === 0) {
    return `Start Geçmişi: son ${ozet.toplamStart} sonuçlu startında hiç geç çıkış kaydı yok (TJK resmi tespiti).`;
  }
  const oran = Math.round((ozet.gecCikisSayisi / ozet.toplamStart) * 100);
  return `Start Geçmişi: son ${ozet.toplamStart} sonuçlu startından ${ozet.gecCikisSayisi}'inde TJK tarafından "Geç Çıkış" olarak işaretlenmiş (%${oran})${ozet.sonFark ? `, en son ${ozet.sonFark} geriden` : ""}.`;
}

const COMBINING_MARKS_RE = /[̀-ͯ]/g;
// Yabancı doğumlu atlarda Runner.name "(USA)"/"(IRE)" gibi ülke koduyla biter, Accurace bunu yazmıyor.
const TRAILING_COUNTRY_CODE_RE = /\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i;
function normalizeHorseName(s: string): string {
  return s.replace(TRAILING_COUNTRY_CODE_RE, "").toLocaleUpperCase("tr-TR").normalize("NFD").replace(COMBINING_MARKS_RE, "").replace(/[^A-ZİĞÜŞÖÇ0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// AccuraceHorseSplit.horseName, Accurace'in KENDİ ham formatı — yabancı doğumlu atlarda
// "(IRE)"/"(USA)" gibi ülke kodu soneki hiç YAZMIYOR (bkz. accurace-sync.service.ts'teki
// aynı tespit), Runner.name ise TJK formatıyla bu soneki İÇERİYOR. Prisma'nın `where.in`
// eşleşmesi TAM METİN karşılaştırması yaptığı için, sorguya yalnız Runner.name'i vermek bu
// atların Accurace kayıtlarını SQL seviyesinde sessizce dışarıda bırakıyordu — aşağıdaki
// normalizeHorseName filtresi hiç çalışma fırsatı bile bulamıyordu (satır zaten gelmemişti).
// Çözüm: sorguya hem ham hem ülke-kodu-çıkarılmış halini birlikte vermek.
function accuraceQueryNames(names: string[]): string[] {
  const out = new Set<string>();
  for (const n of names) {
    out.add(n);
    const stripped = n.replace(TRAILING_COUNTRY_CODE_RE, "").trim();
    if (stripped) out.add(stripped);
  }
  return [...out];
}

// ── SKK Sınıf Piramidi (Ansiklopedi Bölüm III) — metin tabanlı en iyi eşleştirme ──
// export: jokey-own-stat.service.ts da AYNI sınıflandırmayı kullanıyor (jokeyin
// pist+mesafe+SKK kademesi bazında kazanma oranı için) — tek kaynak, kopya mantık yok.
export function classToSkk(classType: string | null | undefined): number | null {
  if (!classType) return null;
  const t = classType.toUpperCase();
  if (/\bG\s*1\b/.test(t)) return 10;
  if (/\bG\s*2\b/.test(t)) return 9;
  if (/G3[\s-]?H/.test(t)) return 7;
  if (/\bG\s*3\b/.test(t)) return 8;
  if (/KV[\s-]?18|KV[\s-]?9\b|KV[\s-]?8\b/.test(t)) return 7;
  if (/KV[\s-]?7\b|KV[\s-]?6\b/.test(t)) return 6;
  const hMatch = t.match(/HAND[İI]KAP\s*(\d+)/);
  if (hMatch) {
    const n = parseInt(hMatch[1], 10);
    if (n >= 17 && n <= 24) return 5;
    if (n >= 13 && n <= 16) return 4;
  }
  const sMatch = t.match(/[ŞS]ARTLI\s*(\d+)/);
  if (sMatch) {
    const n = parseInt(sMatch[1], 10);
    if (n === 5) return 4;
    if (n === 2 || n === 3 || n === 4) return 3;
    if (n === 19) return 2;
    if (n === 1 || n === 27) return 1;
  }
  if (/MAIDEN/.test(t)) return 2;
  // Satış 1-4, Ansiklopedi'nin SKK piramidinde resmen yok (TJK bunu ayrı bir kategori
  // olarak tanımlıyor) — ama Sınıf Geçiş Bonusu hiç hesaplanamamasındansa, kullanıcının
  // onayladığı yaklaşık eşleştirme kullanılıyor: Satış N ≈ Şartlı N (1-4) kademesi.
  const satisMatch = t.match(/SAT(?:IŞ|IS)\s*(\d)/);
  if (satisMatch) {
    const n = parseInt(satisMatch[1], 10);
    if (n >= 1 && n <= 4) return n;
  }
  return null;
}

/** Form dizisi ("352K13" gibi, soldan sağa eskiden yeniye) → kaba yön tahmini.
 *  Son yarım ile önceki yarımın ortalama bitiriş sırasını karşılaştırır; K (kaçtı/DNF) kötü sonuç sayılır.
 *  Bu, metodolojinin "form dizisini oku" adımının otomatik bir yaklaşıklığıdır — nüanslı okuma yerine geçmez. */
function formYonu(recentForm: string | null): { geriliyor: boolean; iyilesiyor: boolean } | null {
  if (!recentForm) return null;
  const chars = recentForm.split("").filter((c) => /[\dK]/i.test(c));
  const nums = chars.map((c) => (c.toUpperCase() === "K" ? 12 : parseInt(c, 10))).slice(-4);
  if (nums.length < 2) return null;
  const mid = Math.ceil(nums.length / 2);
  const eski = nums.slice(0, mid);
  const yeni = nums.slice(mid);
  if (yeni.length === 0) return null;
  const ortEski = eski.reduce((a, b) => a + b, 0) / eski.length;
  const ortYeni = yeni.reduce((a, b) => a + b, 0) / yeni.length;
  const fark = ortYeni - ortEski;
  return { geriliyor: fark >= 1, iyilesiyor: fark <= -1 };
}

function sonSonucZayifMi(recentForm: string | null): boolean {
  if (!recentForm) return false;
  const chars = recentForm.split("").filter((c) => /[\dK]/i.test(c));
  const last = chars.at(-1);
  if (!last) return false;
  if (last.toUpperCase() === "K") return true;
  return parseInt(last, 10) >= 5;
}

function medyan(xs: number[]): number | null {
  if (xs.length === 0) return null;
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export type Faz1Runner = {
  id: string;
  no: number;
  ad: string;
  scratched: boolean;
  // Ham veri (Runner tablosundan doğrudan)
  weight: number | null;
  weightChange: number | null;
  // TJK'nın "St" sütununun yanında turuncu "DS" işareti — at kendi tercihiyle dıştan
  // başlayacak anlamına gelir. Olumlu bir etken olabilir, göz ardı edilmemeli.
  disaridanStart: boolean;
  // Kulvar/start no — hipodrom geometrisiyle birlikte (§III.2/§IV.1) YALNIZ destekleyici
  // bir unsur olarak okunmalı, ana veriyi (HP/sınıf/tempo/form) asla gölgeleyemez (§XX.25).
  startNo: number | null;
  // Bugünkü mesafe/pist kombinasyonunun start noktası pistin virajında mı düz yolunda mı
  // (bkz. hipodrom-mesafe-koordinat.ts kulvarBolgesi) — tüm atlar için AYNI (koşu seviyesi
  // bir bağlam), kulvar numarasıyla birlikte okunur.
  kulvarBolge: "viraj" | "düz yol" | null;
  // TJK'nın resmi at profilinden (AtKosuBilgileri) doğrulanmış: bu hipodrom+mesafe+pist
  // kombinasyonunda KOŞUNUN KENDİ YILI içinde daha önce kazandı mı, en iyi derecesi ne
  // (kullanıcı talebi 2026-07-26: tüm yıllar değil, bu yıl) — "Son Yarış Detayları"
  // panelindeki kaynakla AYNI, site DB alanlarına güvenmiyor.
  hipodromMesafedeKazandi: "EVET" | "HAYIR" | "KOSMADI";
  hipodromMesafedeEnIyiDerece: string | null;
  jockey: string | null;
  jockeyChanged: boolean;
  previousJockey: string | null;
  trainer: string | null;
  owner: string | null;
  // Sitenin program sayfasında 🐴 ile gösterdiği "aynı eküri" grubu — aynı sahiplik
  // altında bu koşuda birden fazla at varsa, aralarında "temposunu bozan/yardımcı at"
  // etkisi olabilir (methodolojide örnek verilen "ekürisinin varlığından rehavete
  // kapılma" senaryosunun somut kanıtı budur).
  ekuriMateleri: string[];
  sire: string | null;
  dam: string | null;
  damSire: string | null;
  // Kendi Runner/Result verimizden (SireStatOwn) bu koşunun ırk/pist/mesafe kombinasyonuna
  // göre OTOMATİK eşleştirilen aygır istatistiği — v6.32: hipodromx.com kaynaklı SireStat
  // analiz akışından çıkarıldı (kullanıcı kararı 2026-08-01, own-data pist×mesafe kırılımı
  // AEI'den daha değerli görüldü), yalnızca own-data kaldı.
  sireStatOzet: string | null;
  // Aygır/kısrak istatistiğinin dayandığı ham örneklem sayısı — eskiden yalnız sireStatOzet/
  // damStatOzet metnine gömülüydü ("Start 27" gibi), ayrı sayısal alan yoktu (kullanıcı
  // talebiyle eklendi, §XII.1 minOrneklem kararlarının güvenilir uygulanabilmesi için).
  // null = eşleşme yok (o kaynaktan hiç veri yok, "0 örneklem" ile karıştırılmasın).
  sireOrneklemKendiVeri: number | null;
  // v6.63 — kullanıcı bulgusu 2026-08-05 (ANSHBA SKY, İstanbul 5.Koşu Maiden): aygırın
  // kazanma yüzdesi (kYuzde) zaten hesaplanıyordu ama yalnız sireStatOzet METNİNE
  // gömülüydü, ayrı sayısal alan yoktu — sahadaki EN İYİ pedigriyi koda gömebilmek için
  // (Maiden koşularda atların kendi geçmişi yok, pedigri neredeyse TEK objektif sinyal).
  sireKazanmaOrani: number | null;
  // Aynısı anne + anne babası (kısrak) tarafı için (DamStatOwn).
  damStatOzet: string | null;
  damOrneklemKendiVeri: number | null;
  // Damsire'nin (kısrağın babası) TEK BAŞINA — hangi kısraktan gelirse gelsin TÜM
  // yavrularından — kendi verimizdeki toplu performansı (kullanıcı doktrini 2026-07-26:
  // aygır+kısrak yanında ÜÇÜNCÜ ayrı bir istatistik, damsire'nin fiziksel/mizaç etkisi
  // dam kaydına gömülmeden ayrıca görünür olmalı). hipodromx bu kırılımı hiç vermediği
  // için tamamen own-data (DamSireStatOwn) kaynaklıdır, "base" satırı yok.
  damSireStatOzet: string | null;
  damSireOrneklemKendiVeri: number | null;
  // Dozaj (DP/DI/CD) — bkz. sire-dosage.actions.ts, aygırın genetik hız/mesafe yapısına
  // dayanan, kazanma yüzdesinden bağımsız dördüncü pedigri sinyali. di>=2.5 hız ağırlıklı,
  // di<=1.0 dayanıklılık ağırlıklı.
  sireDosageOzet: string | null;
  sireDosageDi: number | null;
  // Admin'in /admin/pedigri sayfasındaki "Genel Not"a elle girdiği, pedigri dışı herhangi
  // bir eksik veri (sakatlık, antrenman gözlemi, pist notu vb.) — otomatik toplanamayan
  // her şey için genel amaçlı manuel giriş alanı.
  adminNote: string | null;
  hpBugun: number | null;
  // TJK bu at için resmi HP yayınlamamışsa (genelde Şartlı 1 / Maiden ya da atın henüz
  // handikap puanı atanmamışsa) hpBugun/hpOnceki 0 varsayılır — bu bir veri toplama
  // eksikliği değil, yapısal bir durumdur. Bu bayraklar Faz 2 promptunda ve veri
  // yeterliliği kontrolünde "gerçekten eksik" ile "resmen yok" ayrımını korumak içindir.
  hpBugunResmiYok: boolean;
  hpOncekiResmiYok: boolean;
  // hpOncekiResmiYok'tan AYRI: TJK "At Koşu Bilgileri" isteği gerçekten başarısız oldu
  // (network/parse hatası) — at daha önce koşmuş olabilir ama önceki HP'si bu seferlik
  // ELDE EDİLEMEDİ. Bununla "resmi yok" (TJK gerçekten hiç HP atamamış, yapısal) KARIŞTIRILMAMALI —
  // biri gerçek bir hata (araştır/tekrar dene), diğeri normal bir durum.
  hpOncekiFetchBasarisiz: boolean;
  agf: number | null;
  agfSirasi: number | null;
  // AGF'nin gün içindeki hareketi (agf-sync'in günde birkaç kez aldığı ölçümlerden) —
  // "para akışı" trendi, kullanıcı talebi 2026-07-27. En az 2 ölçüm gerekir, aksi halde null.
  agfTrendOzet: string | null;
  // agfTrendOzet'in altındaki HAM puan farkı (örn. +9.2) — Faz3'ün kural kontrolü
  // (kuralKontrolleriUret) "motto senaryosu"nu (düşük AGF + yükselen trend + güçlü teknik)
  // KOD tarafında da doğrulayabilsin diye ayrı bir sayısal alan (v6.16, kullanıcı talebi:
  // "kontrolde bakılanlar arasında yerini aldı mı, görmezden gelinmesin").
  agfTrendFark: number | null;
  equipment: string | null;
  equipmentAdded: string | null;
  equipmentRemoved: string | null;
  // TJK'nın resmi at profilinden (AtKosuBilgileri) doğrulanmış Takı/Kilo/Jokey değişimi —
  // "Son Yarış Detayları" panelinin KULLANDIĞI aynı kaynak, site DB alanlarından (yukarıdaki
  // weightChange/equipmentAdded/equipmentRemoved) daha güvenilir kabul edilir (kullanıcı
  // talimatı). sonYarisVeriKaynagiGuvenilir=false ise (tjkAtId yok/TJK fetch başarısız)
  // yukarıdaki alanlara geri düşülür — kanıt yokluğu olumsuz kanıt değildir (§II.1).
  sonYarisVeriKaynagiGuvenilir: boolean;
  sonYarisTakiEklenen: string[];
  sonYarisTakiCikarilan: string[];
  sonYarisKiloDegisimi: number | null;
  sonYarisAyniJokey: boolean | null;
  // Son startından bugüne geçen gün — uzun aradan (30+ gün) dönen bir atta galop vb.
  // unsurlar vasat olsa bile üstündeki jokey iyiyse kazanabilir (kullanıcı talimatı,
  // olumlu değerlendirilir). null = bilinmiyor (ilk start veya TJK verisi yok).
  gunAralik: number | null;
  recentForm: string | null;
  bestTime: string | null;
  apprentice: boolean;
  raceStyleEtiket: string | null;
  tempoVeriN: number | null;
  kacak: boolean;
  galopOzet: string; // Claude'a gösterilecek okunabilir galop zinciri özeti

  // TJK "At Koşu Bilgileri" geçmişinden türetilen
  ilkStart: boolean;
  hpOnceki: number | null;
  hpIvmesi: number | null;
  sinifOnceki: string | null;
  sinifSkkOnceki: number | null;
  sinifSkkBugun: number | null;
  sinifDususu: boolean;

  // Otomatik türetilmiş form/kondisyon sinyalleri
  bitirisGeriliyor: boolean | null;
  bitirisIyilesiyor: boolean | null;
  sonSonucZayif: boolean;
  kondisyonZinciriVar: boolean;
  keskinGalopZinciri: boolean;

  // Kilo, jokey/antrenör, takı — otomatik. kiloAvantaji: bu atın kilosu sahadaki
  // ortalamadan en az 1kg hafif mi — önceden hesaplanıyordu ama Faz2/Faz3 promptuna
  // hiç gönderilmiyordu (kullanıcı denetiminde bulundu, 2026-07-26).
  kiloAvantaji: boolean;
  hpAlanIciUst: boolean;
  // TJK Detaylı İstatistikler (HorseStatsCache: Zaman/Hipodrom/Jokey/Pist/Mesafe kırılımı) —
  // bugünkü hipodrom/pist/mesafe/jokey bağlamına uyan satırların özeti (kullanıcı talebi
  // 2026-07-30: "analiz motorunu yeniden oluşturuyoruz" sadeleştirmesinin bir parçası —
  // jokey pist/mesafe/SKK, jokey+antrenör kombinasyonu, at-jokey geçmişi kaldırılıp yerine
  // bu tek, TJK'nın kendi tam kariyer verisinden gelen özet kondu). Jokey/Antrenör genel
  // win%, Zemin Geçmişi ve Sınıf-bağlamlı Form aynı gün içinde kullanıcı talebiyle geri
  // eklendi (v6.26 — bkz. jockeyWinPct/trainerWinPct/zeminGecmisiOzet/sinifBaglamliForm).
  detayliIstatistikOzet: string | null;
  // Jokey/Antrenör GENEL yıllık kazanma yüzdesi (JockeyStatSync/TrainerStatSync tabanlı,
  // sync-jokey-stats/sync-trainer-stats cron'larından, 22:00) — v6.26, kullanıcı talebi
  // 2026-07-30: "bunlar da çekilecek Faz1'e" (ekran görüntüsündeki Jokey/Sahip-Antrenör
  // tablosu). Kırılımsız, en zayıf jokey sinyali olduğu için v6.25'te kaldırılmıştı, bugün
  // aynı oturumda geri istendi.
  jockeyWinPct: number | null;
  trainerWinPct: number | null;
  // Zemin Geçmişi (v6.26, kullanıcı talebi 2026-07-30: "anlık zemin ile koştukları zeminler
  // arasındaki bağ") — bugünküyle AYNI zemin sınıfında (ıslak/ağır/normal vb.) atın TÜM
  // geçmiş start'ları, hipodrom/mesafe/yıl sınırı olmadan (bkz. gecmis-baglam.actions.ts).
  zeminGecmisiOzet: string | null;
  zeminGecmisiToplamKayit: number;
  // Sınıf-bağlamlı Form (v6.26, kullanıcı talebi 2026-07-30: "hangi yarıştan hangi yarışa
  // çıktığını, daha zor rakiplerle/sınıfla koşunca kaçıncı olmuş") — son 5 start'ın bitiriş
  // sırası, HER birinin sınıfıyla (classType) birlikte, çıplak "618..." dizisinden farklı
  // olarak zorluk bağlamını taşır.
  sinifBaglamliForm: string | null;
  // Start Geçmişi / "Geç Çıkış" (v6.30, kullanıcı talebi 2026-08-01: "Start Sorunu olan
  // atları tespit edebilir miyiz") — TJK'nın kendi resmi tespiti, geçmiş sonuçlu starlarda
  // kaç kez "Geç Çıkış" olarak işaretlendiği (bkz. gec-cikis.actions.ts). Örneklem <3 ise null.
  startGecmisiOzet: string | null;

  // Son 800 — Gölge Mod girdileri (yalnız TAM UYGUN — pist zorunlu + mesafe ±200m —
  // kayıtlardan hesaplanır, gecit-motoru.ts'nin kalibre eşiklerini besler, değişmedi).
  son800BenzerKosuN: number;
  son800Medyan: number | null;
  // v4.1: kullanıcı talebiyle eklendi — atın TÜM YILLARDAKİ TÜM Son800 kayıtları
  // (pist/mesafe uygunluğuna bakılmaksızın), her satırda uygunluk etiketiyle. Faz 2
  // Claude'a gidiyor — yukarıdaki kesin sayıyı DEĞİŞTİRMEZ, ek bağlam/serbest
  // değerlendirme için. null = bu atın hiç Accurace kaydı yok. 2026-07-26: yıl kısıtı
  // kaldırıldı, "Accurace — Tüm Kayıtlar" panelinin (son800.actions.ts) davranışıyla
  // tutarlı hale getirildi (bkz. aşağıdaki hesaplama).
  son800TumOzet: string | null;
  // son800TumOzet metne en fazla 4 kayıt yazar (maliyet nedeniyle) — bu, gerçek toplam
  // kayıt sayısı (kullanıcı talebiyle eklendi, minOrneklem kararı için gerekli).
  son800TumToplamKayit: number;

  // Sitenin kendi "Aynı Pist/Mesafe" (v6.10'dan itibaren hipodrom şartı YOK, bkz.
  // at-performans.actions.ts) ve "H2H" panellerinden (methodolojide XI. Bölüm — ZAYIF
  // KANIT, tek başına sırayı belirlemez ama göz ardı edilmemeli).
  aynıPistMesafeOzet: string | null;
  // aynıPistMesafeOzet metne en fazla 3 kayıt yazar — bu, gerçek toplam kayıt sayısı
  // (kullanıcı talebiyle eklendi — önceden bu sayı kod içinde hesaplanıp hiç
  // gönderilmeden atılıyordu, Claude "3 kayıt mı yoksa 8'den seçilmiş 3 mü" ayırt edemiyordu).
  aynıPistMesafeToplamKayit: number;
  h2hOzet: string | null;

  // ── Mekanik ön-hesaplama (mekanik-puanlama.ts) — Ansiklopedi §III/§V/§VI/§VIII'in
  // tamamen tablo/aritmetik-tabanlı kısımları, Claude'a HAZIR sonuç olarak verilir,
  // Faz 2'nin bunları yeniden hesaplaması istenmez.
  hpKalitesiYildizi: 2 | 3 | 4 | 5 | null;
  sinifGecisBonusuPuan: number | null;
  galopSiniflandirma: GalopZinciriSonuc;
  tempoGuven: TempoGuven | null;

  // Accurace (GPS/sektörel zamanlama) geçmişinden türetilmiş, birden fazla yarışın
  // birleştirilmesiyle üretilen KALICI tempo/pozisyon eğilimi — n<3 ise null (tek
  // yarıştan kalıcı stil çıkarılmaz, bkz. §I.4 Veri Çifti Doktrini). Bu alan bugünkü
  // yarışın verisi DEĞİL, atın GEÇMİŞ yarışlarındaki tekrarlanan davranışıdır.
  accuraceEgilim: CokYarisEgilim | null;
};

export type Faz1Sonuc = {
  race: {
    id: string;
    hippodromeName: string;
    raceNo: number;
    date: string;
    classType: string;
    breed: string;
    surface: string;
    distance: number;
    // ── Mekanik ön-hesaplama (race seviyesi) ──
    zeminDetayi: string | null;
    zeminKatsayisi: number;
    zeminEtiketi: string;
    sahadakiKacakSayisi: number;
    kacakTempoEtiketi: string;
    kacakAvantajliStil: string;
    // Aynı hipodrom+pist+mesafe(±200m)'deki geçmiş yarışların kazananlarının tarihsel
    // stil dağılımı (n<3 ise null) — bugünkü atlarla ilgili değil, yalnız bu pist/mesafe
    // kombinasyonunun tarihsel eğilimi.
    pistMesafeStilOzeti: string | null;
    // En çok kazanan tek stil + yüzdesi — kacakAvantajliStil ile AYNI desende, Faz2
    // prompt'unda "bu stildeki atlar sıralamada gereksiz yere çok aşağıda kalmamalı"
    // yönlendirmesi için ayrıca (metinden parse etmeye gerek kalmadan) tutuluyor.
    pistMesafeStilEnCokKazanan: string | null;
    pistMesafeStilEnCokKazananYuzde: number | null;
    // v6.61 — kullanıcı bulgusu 2026-08-05 (İSPANOZ, İstanbul 3.Koşu): yalnız EN ÇOK
    // kazanan stili (yukarıdaki iki alan) değil, TÜM sıralamayı (rank) koda gömebilmek
    // için — bir atın stili popülasyonda 2. sırada olsa bile n≥10 bireysel örneklemle
    // TAM "destek" sayılmalı, bunun için 2. sıradaki stili de bilmek gerekiyor.
    pistMesafeStilBreakdown: { style: string; percent: number }[] | null;
    // v6.68 — kullanıcı bulgusu 2026-08-08/09: gün içinde AGF'si belirgin şekilde YÜKSELEN
    // (gerçek para akışı, "AGF Trend" panelindeki AYNI anlamlı-eşik/gürültü filtresiyle
    // — bkz. agf-trend.actions.ts ANLAMLI_PUAN_ESIGI) atların, kontrol edilen 6 koşunun
    // 6'sında da kazandığı gözlemlendi — kullanıcı kararı: bu at ilk 4'e KOŞULSUZ girsin.
    enCokYukselenler: { runnerNo: number; ad: string; fark: number }[];
    // v6.69 — kullanıcı bulgusu (İstanbul 1.Altılı 09.08.2026 kritiği): kazananların çoğu
    // AGF'de YÜKSELEN değil DÜŞEN taraftaydı (ör. ULUŞİRAN BEYİ -17,45, TÜRKÖREN -14,68) —
    // yani "gün içinde belirgin para hareketi" sinyali yön bağımsız güçlü, yalnız yükseliş
    // değil. enCokYukselenler ile AYNI kaynak/eşik (agf-trend.actions.ts), yalnız ters yön.
    enCokDusenler: { runnerNo: number; ad: string; fark: number }[];
    // Sıklet Dağılımı / makas genişliği (v6.38, kullanıcı denetimi): sahadaki en hafif ve
    // en ağır kilo arasındaki fark — bir atın mutlak kilosu tek başına yeterli bağlam
    // değildir (60kg, taban 50kg'sa ezici bir yük, taban 58kg'sa önemsiz bir fark).
    kiloEnHafif: number | null;
    kiloEnAgir: number | null;
    kiloMakasi: number | null;
    // Son düzlük uzunluğu (v6.39) — kullanıcı tarafından sağlandı, TJK resmi ölçümü DEĞİL,
    // yaklaşık bir aralık (bkz. hipodrom-ozellikleri.ts). null = henüz sağlanmadı/teyit bekliyor.
    sonDuzlukUzunlugu: string | null;
    // TJK ham metni — koşu şartları/yaş-kilo skalası/pist rekoru. Doğrudan at bazlı bir
    // sinyal değil, yalnız bağlam; boşsa gösterilmez.
    conditions: string | null;
    ageWeight: string | null;
    trackRecord: string | null;
    // Yağışlı/ıslak hava, kaçak stilli atlara olumlu bir kombinasyon oluşturabilir
    // (kullanıcı talimatı) — Claude kendi muhakemesiyle ham metinden değerlendirir,
    // sabit bir "yağmurlu" anahtar kelime listesi TUTULMAZ (§XXI sabit sayı yok ilkesi).
    weather: string | null;
  };
  runners: Faz1Runner[];
  veriDoluluk: { alan: string; oran: number }[];
  // Kullanıcının tek tek sorup doğruladığı 8 veri kategorisi için, HER analizde otomatik
  // görünen checklist — "bakıldı mı" + bakılmadıysa GERÇEK sebebi (admin panelinde Faz1
  // sonrası gösterilir, kullanıcı talebi 2026-07-26: "bunları listele... bakılmayanlara
  // ise neden bakılmadığını sebebi ile açıklanacak").
  veriKapsamKontrolu: VeriKapsamKontrol[];
};

export type VeriKapsamKontrol = { kategori: string; bakildi: boolean; detay: string };

/** Bir koşunun tüm Faz 1 verisini TAMAMEN OTOMATİK toplar — admin girdisi gerektirmez. */
export async function gatherFaz1(raceId: string): Promise<Faz1Sonuc | null> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: {
        where: { scratched: false },
        orderBy: { no: "asc" },
        include: { gallops: { orderBy: { date: "desc" }, take: 5 } },
      },
    },
  });
  if (!race || race.runners.length === 0) return null;

  // v6.68 — kullanıcı denetimi 2026-08-09: "Karma" (küçük hipodromların TJK'nın ortak
  // yayınladığı birleşik programı) koşularının classType'ı TJK'nın kendi sayfasında hiç
  // yer almıyor, ingest bunu hep "—" ile dolduruyordu (519 koşu etkilendi, bugünküler
  // dahil) — kategoriTespit bu yüzden "bilinmiyor" dönüp analizi tamamen engelliyordu.
  // syncKarmaMirrors'ın (prediction.actions.ts) TERS yönünü kullanıyoruz: Karma
  // koşusunun "conditions" alanı zaten gerçek kaynağı ("İstanbul 8. Koşu" gibi) taşıyor —
  // bu isim+numaradan GERÇEK koşuyu bulup classType'ını ödünç alıyoruz. Yalnız OKUMA
  // anında (ingest/cron'a dokunmadan) — eşleşme bulunamazsa sessizce "—" kalır, regresyon
  // yok.
  if (race.classType === "—" && race.conditions) {
    const kaynakEslesme = race.conditions.match(/^(.+?)\s+(\d+)\.\s*Ko[şs]u$/i);
    if (kaynakEslesme) {
      const [, kaynakHipodrom, kaynakNoStr] = kaynakEslesme;
      const kaynakRace = await db.race.findFirst({
        where: {
          raceNo: parseInt(kaynakNoStr, 10),
          raceDay: { date: race.raceDay.date, hippodrome: { name: kaynakHipodrom.trim() } },
        },
        select: { classType: true },
      });
      if (kaynakRace && kaynakRace.classType !== "—") {
        race.classType = kaynakRace.classType;
      }
    }
  }

  // 2026-07-27 canlı bulgu (Bursa 9./Karma 2.Koşu — aynı fiziksel yarış iki program altında
  // mirror'lanmış): AccuraceHorseSplit sorguları yalnız horseName'e göre filtreleniyordu,
  // koşu kendi post saatinden SONRA (sonucu Accurace'e işlendikten sonra) analiz edilirse
  // atın KENDİ AZ ÖNCE KOŞTUĞU yarışın verisi "geçmiş eğilim" gibi geri besleniyordu — Claude
  // bunu gerçek bir geçmiş galibiyet sanıp gerekçeye yazdı, halbuki tahmin edilen yarışın
  // kendi sonucuydu. v6.59 (kullanıcı bulgusu 2026-08-04 — "koşulmuş bir koşu üzerinde test
  // yaparsak sonuçtan etkilenmeden sıralama yapabilir mi"): eski kod yalnız AYNI günü
  // dışlıyordu, hedef yarıştan SONRAKİ günlerdeki kayıtlar (backtest sırasında at o tarihten
  // sonra tekrar koşmuşsa) hâlâ sızabiliyordu — artık her karşılaştırma doğrudan Date
  // nesneleriyle KESİN "öncesi mi" (race.raceDay.date < ...) yapılıyor, yalnız eşitlik değil.

  const hippodromeName = race.raceDay.hippodrome.name.trim();

  // v6.24 sadeleştirme (kullanıcı talimatı 2026-07-30: "analiz motorunu yeniden
  // oluşturuyoruz, sade ve hızlı ve en doğru muhakeme yapılacak şekilde") — Faz1 önce
  // sabit 9 kategoriye daraltıldı; AYNI GÜN İÇİNDE kullanıcı 2 kategoriyi (Jokey/Antrenör
  // genel win%, Zemin Geçmişi+Sınıf-bağlamlı Form) geri istedi (v6.26) — jokey pist/
  // mesafe/SKK, jokey+antrenör kombinasyonu ve at-jokey geçmişi KALDIRILMIŞ olarak kalıyor.
  const jockeyNames = [...new Set(race.runners.map((r) => r.jockey).filter((j): j is string => !!j))];
  const trainerNames = [...new Set(race.runners.map((r) => r.trainer).filter((t): t is string => !!t))];
  // Dinamik import: race.service.ts başka methodology dosyalarını da import ediyor,
  // döngüsel bağımlılığı önlemek için (orijinal v6.24-öncesi koddaki aynı desen).
  const { getJockeyStats, getTrainerStats } = await import("@/server/services/race.service");

  const [atPerformansRows, h2hEncounters, accuraceKayitlari, sireStatOzetleri, damStatOzetleri, sonYarisDetaylari, damSireStatOzetleri, agfTrendSonuc, horseStatsCacheRows, gecmisBaglamSonuc, jockeyStats, trainerStats, gecCikisMap, sireDosageOzetleri] = await Promise.all([
    getAtPerformansForRace(raceId).catch(() => []),
    getH2HForRace(raceId).catch(() => []),
    db.accuraceHorseSplit.findMany({
      where: { horseName: { in: accuraceQueryNames(race.runners.map((r) => r.name)) } },
      select: { horseName: true, checkpoints: true, accuraceRace: { select: { date: true, length: true, _count: { select: { splits: true } } } } },
    }).catch(() => []),
    getSireStatOzetleriForRace(race.runners.map((r) => r.sire), race.breed, race.surface, race.distance).catch(
      () => race.runners.map(() => ({ ozet: null, ornekKendiVeri: null, kYuzde: null }))
    ),
    getDamStatOzetleriForRace(race.runners.map((r) => ({ dam: r.dam, damSire: r.damSire })), race.breed, race.surface, race.distance).catch(
      () => race.runners.map(() => ({ ozet: null, ornekKendiVeri: null }))
    ),
    getSonYarisDetaylariForRace(raceId).catch(() => []),
    getDamSireOwnStatForRace(race.runners.map((r) => r.damSire), race.breed, race.surface, race.distance).catch(
      () => race.runners.map(() => ({ ozet: null, ornekKendiVeri: null }))
    ),
    getAgfTrendForRace(raceId).catch(() => ({ atlar: [], enCokDusenler: [], enCokYukselenler: [] })),
    // TJK Detaylı İstatistikler (Zaman/Hipodrom/Jokey/Pist/Mesafe kırılımı) — kalıcı
    // HorseStatsCache'ten, TJK'ya canlı gitmez (kullanıcı talebi 2026-07-30: bugüne kadar
    // yalnız at profili modalinde kullanılan bu veri artık Faz1'e de aktarılıyor).
    db.horseStatsCache.findMany({
      where: { tjkAtId: { in: race.runners.map((r) => r.tjkAtId).filter((id): id is number => id != null) } },
      select: { tjkAtId: true, detailedStatsJson: true },
    }).catch(() => []),
    // Zemin Geçmişi + Sınıf-bağlamlı Form (v6.26, kullanıcı talebi 2026-07-30) — ikisi de
    // aynı TJK geçmiş çağrısından (fetchTjkAtKosuBilgileri, kendi TTL cache'i) türer.
    getGecmisBaglamForRace(raceId).catch(() => ({ zemin: [], sinifBaglamliForm: [] })),
    getJockeyStats(jockeyNames).catch(() => ({} as Awaited<ReturnType<typeof getJockeyStats>>)),
    getTrainerStats(trainerNames).catch(() => ({} as Awaited<ReturnType<typeof getTrainerStats>>)),
    // Start Geçmişi / "Geç Çıkış" — TJK'nın kendi resmi start-kalitesi tespiti (kullanıcı
    // talebi 2026-08-01: "Start Sorunu olan atları tespit edebilir miyiz"). bkz.
    // gec-cikis.actions.ts, Result.gecCikanlar (tjk-result.adapter.ts + result-sync.ts).
    getGecCikisOzetleriForRace(race.runners.map((r) => r.name), race.raceDay.date).catch(() => new Map()),
    // Dozaj (DP/DI/CD) — v6.67 kullanıcı kararı 2026-08-08: kaynak/kapsam netleşene kadar
    // RAFA KALDIRILDI, canlı analize karışmasın diye bilerek sabit null döndürülüyor.
    // Altyapı (SireDosageStat, sire-dosage.actions.ts) DURUYOR — yalnız burada devre dışı.
    Promise.resolve(race.runners.map(() => ({ ozet: null, di: null, cd: null }))),
  ]);
  const horseStatsCacheMap = new Map(horseStatsCacheRows.map((h) => [h.tjkAtId, h.detailedStatsJson as unknown as HorseDetailStatSection[]]));
  const zeminGecmisiMap = new Map(gecmisBaglamSonuc.zemin.map((z) => [z.no, z]));
  const sinifBaglamliFormMap = new Map(gecmisBaglamSonuc.sinifBaglamliForm.map((s) => [s.no, s]));
  const agfTrendMap = new Map(agfTrendSonuc.atlar.map((a) => [a.runnerNo, a]));
  const atPerformansMap = new Map(atPerformansRows.map((r) => [r.horseName, r.records]));
  const sireStatMap = new Map(race.runners.map((r, i) => [r.id, sireStatOzetleri[i] ?? { ozet: null, ornekKendiVeri: null, kYuzde: null }]));
  const sireDosageMap = new Map(race.runners.map((r, i) => [r.id, sireDosageOzetleri[i] ?? { ozet: null, di: null, cd: null }]));
  const damStatMap = new Map(race.runners.map((r, i) => [r.id, damStatOzetleri[i] ?? { ozet: null, ornekKendiVeri: null }]));
  const damSireStatMap = new Map(race.runners.map((r, i) => [r.id, damSireStatOzetleri[i] ?? { ozet: null, ornekKendiVeri: null }]));
  const sonYarisDetayByNo = new Map(sonYarisDetaylari.map((d) => [d.runnerNo, d]));
  const kulvarBolgeBugun = kulvarBolgesi(race.raceDay.hippodrome.slug, race.surface, race.distance);
  // Son düzlük uzunluğu (v6.39, kullanıcı denetimi) — kullanıcı tarafından sağlandı,
  // TJK resmi bir ölçüm DEĞİL (bkz. hipodrom-ozellikleri.ts'teki uyarı notu).
  const sonDuzlukUzunlugu = HIPODROM_OZELLIKLERI[race.raceDay.hippodrome.slug]?.sonDuzlukUzunlugu ?? null;

  // Accurace GPS/sektörel geçmişinden atın KALICI tempo/pozisyon eğilimini üret —
  // yalnız n≥3 yarış varsa (bkz. pace-analizi.ts, tek yarıştan kalıcı stil çıkarılmaz).
  const accuraceEgilimMap = new Map<string, CokYarisEgilim | null>();
  for (const r of race.runners) {
    const norm = normalizeHorseName(r.name);
    const kayitlar = accuraceKayitlari.filter(
      (k) => normalizeHorseName(k.horseName) === norm && k.accuraceRace.date < race.raceDay.date
    );
    const sonuclar = kayitlar
      .map((k) => analizEtTekYaris(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0, k.accuraceRace._count.splits))
      .filter((s): s is NonNullable<typeof s> => s != null);
    accuraceEgilimMap.set(r.id, hesaplaCokYarisEgilimi(sonuclar));
  }

  // Aynı eküriden (sahiplik) bu koşuda koşan diğer atların isim listesi, her at için.
  const ekuriMateMap = new Map<string, string[]>();
  for (const r of race.runners) {
    if (r.ekuriGroup == null) continue;
    const mates = race.runners
      .filter((o) => o.id !== r.id && o.ekuriGroup === r.ekuriGroup)
      .map((o) => o.name);
    if (mates.length > 0) ekuriMateMap.set(r.id, mates);
  }

  // Her at için: bu koşudaki DİĞER atlarla geçmişte birlikte koştuğu yarışlardan
  // (H2H) kısa bir özet. Methodolojide "zayıf kanıt" — tek başına sırayı belirlemez.
  function h2hOzetFor(horseName: string): string | null {
    const kayitlar: string[] = [];
    for (const enc of h2hEncounters) {
      const kendisi = enc.results.find((r) => r.horseName === horseName);
      if (!kendisi) continue;
      const rakipler = enc.results.filter((r) => r.horseName !== horseName);
      if (rakipler.length === 0) continue;
      // 2026-07-26, kullanıcı talebiyle: Aynı Pist/Mesafe satırıyla aynı gerekçeyle
      // kilo/derece/takı/sınıf eklendi (ganyan BİLEREK dışarıda bırakıldı, bkz.
      // aynıPistMesafeOzet'teki aynı karar). Rakip listesi kompakt tutuluyor (yalnız kilo),
      // aksi halde çok karşılaşmalı atlarda metin çok şişerdi.
      const rakipOzet = rakipler.map((r) => `${r.horseName}(${r.finishPos || "?"}. kilo:${r.weight || "?"})`).join(", ");
      const sinifEk = kendisi.classType || kendisi.group ? ` (sınıf:${kendisi.classType || "—"}${kendisi.group ? ` grup:${kendisi.group}` : ""})` : "";
      kayitlar.push(`${enc.date} ${enc.hippodrome}: kendisi ${kendisi.finishPos || "?"}. derece:${kendisi.time || "?"} kilo:${kendisi.weight || "?"} takı:${kendisi.equipment || "—"}${sinifEk} — ${rakipOzet}`);
    }
    return kayitlar.length > 0 ? kayitlar.slice(0, 3).join(" | ") : null;
  }

  // AGF sırası — bugünkü sahada AGF yüzdesine göre (yüksekten düşüğe)
  const agfSirali = [...race.runners]
    .filter((r) => r.agf != null)
    .sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
  const agfSiraMap = new Map(agfSirali.map((r, i) => [r.id, i + 1]));

  // HP alan-içi sıra — bugünkü sahada en yüksek HP'ye göre
  const hpSirali = [...race.runners].filter((r) => r.hp != null).sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0));
  const hpUstSinir = Math.max(1, Math.ceil(hpSirali.length * 0.4));
  const hpUstSet = new Set(hpSirali.slice(0, hpUstSinir).map((r) => r.id));

  const agirlıklar = race.runners.map((r) => r.weight).filter((w): w is number => w != null);
  const ortKilo = agirlıklar.length > 0 ? agirlıklar.reduce((a, b) => a + b, 0) / agirlıklar.length : null;
  // Sıklet Dağılımı / makas genişliği (v6.38) — agirlıklar zaten tüm sahanın kilolarını
  // topladığı için min/max/fark hesabı ek bir sorgu gerektirmiyor.
  const kiloEnHafif = agirlıklar.length > 0 ? Math.min(...agirlıklar) : null;
  const kiloEnAgir = agirlıklar.length > 0 ? Math.max(...agirlıklar) : null;
  const kiloMakasi = kiloEnHafif != null && kiloEnAgir != null ? kiloEnAgir - kiloEnHafif : null;

  const bugunSkk = classToSkk(race.classType);

  // Zemin durumu — bu veri (RaceDay.surfaceConditions) ingest'te zaten toplanıyordu
  // ama Faz 1'e hiç aktarılmıyordu, yalnız public program sayfasında gösteriliyordu.
  // §VII "Zemin Katsayıları" bugünkü pistin durumuna göre göreli kilo etkisini ±%15/±%30
  // artırır — matristeki "Göreli kilo/zemin" bileşeninin ikinci yarısı budur.
  const surfaceConditions = (race.raceDay.surfaceConditions as { label: string; detail: string }[] | null) ?? null;
  const zeminDetayi = zeminDetayiBul(surfaceConditions, race.surface);
  const zemin = zeminKatsayisi(zeminDetayi);

  // ── Son 800 Gölge Mod — artık Accurace'ten (TJK'nın tekil son800/ilk800 sayısı yerine).
  // Atın kendi geçmişindeki (yıl/şehir/pist/mesafe±200m benzer) yarışlarda son 800m sektör
  // süresini, O YARIŞTAKİ EN İYİ (field'in en hızlı) son 800m'siyle kıyaslıyoruz. Fark
  // (saniye): 0=o yarışın en iyi kapanışını yakaladı, pozitif=daha yavaş kapandı — eski TJK
  // formülüyle yön/birim uyumlu, gecit-motoru.ts'teki -0.5/+0.7 eşikleri değişmeden geçerli.
  const son800AccuraceKayitlariHam = race.runners.length
    ? await db.accuraceHorseSplit.findMany({
        where: { horseName: { in: accuraceQueryNames(race.runners.map((r) => r.name)) } },
        select: {
          horseName: true,
          accuraceRaceId: true,
          checkpoints: true,
          place: true,
          accuraceRace: { select: { date: true, citySlug: true, ground: true, length: true } },
        },
      })
    : [];
  // Hedef yarışın tarihi VE sonrası hariç tutuluyor (bkz. gatherFaz1 başındaki v6.59 notu) —
  // aksi halde bir at bu yarışı (veya sonraki bir yarışını) kendi kendine "geçmiş kanıt"
  // olarak gösterebiliyordu.
  const son800AccuraceKayitlari = son800AccuraceKayitlariHam.filter(
    (k) => k.accuraceRace.date < race.raceDay.date
  );
  const son800RaceIds = [...new Set(son800AccuraceKayitlari.map((k) => k.accuraceRaceId))];
  const son800Siblings = son800RaceIds.length
    ? await db.accuraceHorseSplit.findMany({
        where: { accuraceRaceId: { in: son800RaceIds } },
        select: { accuraceRaceId: true, checkpoints: true, accuraceRace: { select: { length: true } } },
      })
    : [];

  function last800SureSaniye(checkpoints: PaceCheckpoint[], length: number): number | null {
    if (length < 800) return null;
    const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
    const finish = sorted[sorted.length - 1];
    if (!finish) return null;
    const nokta = [...sorted].reverse().find((c) => c.checkpoint <= length - 800);
    if (!nokta) return null;
    return (finish.timeReal - nokta.timeReal) / 1000;
  }

  const fieldBestSon800ByRaceId = new Map<string, number>();
  for (const s of son800Siblings) {
    const sure = last800SureSaniye(s.checkpoints as unknown as PaceCheckpoint[], s.accuraceRace.length ?? 0);
    if (sure == null) continue;
    const mevcut = fieldBestSon800ByRaceId.get(s.accuraceRaceId);
    if (mevcut == null || sure < mevcut) fieldBestSon800ByRaceId.set(s.accuraceRaceId, sure);
  }

  // Accurace'in kendi ham "ground" alanı Çim için Türkçe "Ç" (cedilla) harfini kullanıyor,
  // düz Latin "C" DEĞİL (canlı veriyle doğrulandı: AccuraceRace.ground="Ç") — bu satır
  // eskiden "C" bekliyordu, bu yüzden ÇİM koşularında (ki bunlar sahadaki çoğunluk) bu
  // filtre asla eşleşmiyordu: her at için "benzer koşu yok" çıkıyordu, veri gerçekten
  // var olsa bile (bkz. son800.actions.ts'teki public panel — o normalizeHorseName ile
  // ayrı bir eşleşme yaptığı için bu sorunu hiç yaşamıyordu, sorun yalnız buradaydı).
  const surfacePrefixToday = race.surface === "CIM" ? "Ç" : race.surface === "SENTETIK" ? "S" : "K";
  const son800ByRunnerName = new Map<string, { n: number; medyan: number | null }>();
  for (const r of race.runners) {
    // v4.13: eskiden hipodrom da BİREBİR aynı olmak zorundaydı (bu hipodromda hiç
    // koşmamış atlar için n hep 0 çıkıyor, sinyal boşa gidiyordu). Kullanıcı talebiyle
    // hipodrom şartı kaldırıldı — yalnız pist türü (ground) ve mesafe (±200m) aranıyor.
    // Farklı hipodromların pist yapısı/banket farkı olsa da, aynı pist türü+mesafedeki
    // kapanış hızı kıyaslaması tek hipodroma sıkışmaktan daha değerli bir sinyal veriyor.
    // 2026-07-26: yıl şartı kaldırıldı (kullanıcı talebi) — "Accurace — Tüm Kayıtlar"
    // panelinin (son800.actions.ts) kendisi hiçbir zaman yıl filtresi uygulamıyordu, bu
    // yalnız Faz1'in KESİN eşleşme aramasında vardı ve panelde görünen, gerçekte uygun
    // bir geçmiş-yıl kaydını "eşleşme yok" gibi göstererek zayıf ikincil değerlendirmeye
    // düşürüyordu — artık ikisi tutarlı, atın TÜM yıllardaki pist+mesafe uygun kayıtları aranıyor.
    const kayitlar = son800AccuraceKayitlari.filter(
      (k) =>
        normalizeHorseName(k.horseName) === normalizeHorseName(r.name) &&
        k.accuraceRace.ground === surfacePrefixToday &&
        Math.abs((k.accuraceRace.length ?? 0) - race.distance) <= 200
    );
    const farklar = kayitlar
      .map((k) => {
        const kendiSuresi = last800SureSaniye(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0);
        const fieldEnIyi = fieldBestSon800ByRaceId.get(k.accuraceRaceId);
        return kendiSuresi != null && fieldEnIyi != null ? kendiSuresi - fieldEnIyi : null;
      })
      .filter((f): f is number => f != null);
    son800ByRunnerName.set(r.name, { n: farklar.length, medyan: medyan(farklar) });
  }

  // v4.1: kullanıcı talebiyle — yukarıdaki KESİN sayı (pist zorunlu + mesafe ±200m)
  // değişmiyor, ama Claude'a atın TÜM Son800 kayıtlarını (pist/mesafe uygunluğu ne
  // olursa olsun) uygunluk etiketiyle birlikte gösteriyoruz — sadece "yok" denip
  // atlanan (ama gerçekte var olan, sadece bugünkü koşula tam uymayan) kayıtlar da
  // serbest değerlendirmeye (Faz 2 A-katmanı) girebilsin.
  // 2026-07-26: "AYNI YIL" şartı kaldırıldı (kullanıcı talebi, yukarıdaki KESİN eşleşme
  // filtresiyle aynı gerekçe) — "Accurace — Tüm Kayıtlar" panelinin adı zaten bunu
  // vaat ediyordu, yıl kısıtı olmadan TÜM geçmiş kayıtlar aranıyor.
  const GROUND_LABEL: Record<string, string> = { K: "Kum", Ç: "Çim", S: "Sentetik" };
  const son800TumOzetByRunnerName = new Map<string, string | null>();
  const son800TumToplamByRunnerName = new Map<string, number>();
  for (const r of race.runners) {
    // 2026-07-25: maliyet azaltma — kullanıcı talebiyle 8'den 4'e düşürüldü. Bu bölüm
    // metodolojinin kendisince zaten İKİNCİL/zayıf kanıt sayılıyor (yukarıdaki KESİN
    // n/medyan özetinin YANINA, YERİNE değil) — TAM UYGUN kayıtlar (KESİN özetle aynı
    // güvenilirlikte) en-güncelden ÖNCE öncelenir, geri kalan slot en güncel PİST/MESAFE
    // FARKLI kayıtlarla doldurulur; böylece kısaltma en değerli satırları kaybettirmez.
    const tumKayitlari = son800AccuraceKayitlari.filter(
      (k) => normalizeHorseName(k.horseName) === normalizeHorseName(r.name)
    );
    const tamUygun = tumKayitlari
      .filter((k) => k.accuraceRace.ground === surfacePrefixToday && Math.abs((k.accuraceRace.length ?? 0) - race.distance) <= 200)
      .sort((a, b) => b.accuraceRace.date.getTime() - a.accuraceRace.date.getTime());
    const digerleri = tumKayitlari
      .filter((k) => !(k.accuraceRace.ground === surfacePrefixToday && Math.abs((k.accuraceRace.length ?? 0) - race.distance) <= 200))
      .sort((a, b) => b.accuraceRace.date.getTime() - a.accuraceRace.date.getTime());
    const kayitlarTumu = [...tamUygun, ...digerleri].slice(0, 4);
    son800TumToplamByRunnerName.set(r.name, tumKayitlari.length);

    if (kayitlarTumu.length === 0) { son800TumOzetByRunnerName.set(r.name, null); continue; }

    const satirlar = kayitlarTumu.map((k) => {
      const sure = last800SureSaniye(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0);
      const pistUygun = k.accuraceRace.ground === surfacePrefixToday;
      const mesafeFarki = Math.abs((k.accuraceRace.length ?? 0) - race.distance);
      const mesafeUygun = mesafeFarki <= 200;
      const etiket =
        pistUygun && mesafeUygun
          ? "TAM UYGUN"
          : pistUygun
            ? `MESAFE UZAK (${mesafeFarki}m fark)`
            : mesafeUygun
              ? "PİST FARKLI"
              : `PİST+MESAFE FARKLI (${mesafeFarki}m)`;
      const tarih = k.accuraceRace.date.toISOString().slice(0, 10).split("-").reverse().join(".");
      const pistAdi = GROUND_LABEL[k.accuraceRace.ground ?? ""] ?? (k.accuraceRace.ground ?? "?");
      return `${tarih} ${pistAdi} ${k.accuraceRace.length ?? "?"}m ${k.place}. son800=${sure != null ? sure.toFixed(2) + "s" : "?"} [${etiket}]`;
    });
    son800TumOzetByRunnerName.set(r.name, satirlar.join(" | "));
  }

  const runners: Faz1Runner[] = await Promise.all(
    race.runners.map(async (r): Promise<Faz1Runner> => {
      let ilkStart = true;
      let hpOnceki: number | null = null;
      let sinifOnceki: string | null = null;
      let hpOncekiFetchBasarisiz = false;
      let son800BenzerKosuN = 0;
      let son800Medyan: number | null = null;

      if (r.tjkAtId) {
        try {
          // v6.59 — kullanıcı bulgusu 2026-08-04: bu çekim ÖNCEDEN hiç tarih filtresi
          // uygulamıyordu — bir yarış GEÇMİŞTE test/backtest edilirken (at hedef yarıştan
          // SONRA da koşmuşsa) "en son yarış" olarak yanlışlıkla hedef yarışın KENDİSİ veya
          // ondan SONRAKİ bir yarış seçilebiliyordu; sinifOnceki/hpOnceki (V14/V20'nin
          // kaynağı) bu sızıntıdan doğrudan etkilenirdi. Artık yalnız hedef tarihten KESİN
          // önceki kayıtlar "geçmiş" sayılıyor.
          const gecmisTumu = await fetchTjkAtKosuBilgileri(r.tjkAtId);
          const gecmis = gecmisTumu.filter((row) => tjkTarihOncesiMi(row.date, race.raceDay.date));
          if (gecmis.length > 0) {
            ilkStart = false;
            // TJK tablosu en yakın tarihli satırı en üstte döner
            const enSon = gecmis[0];
            hpOnceki = enSon.hp ? parseInt(enSon.hp, 10) || null : null;
            sinifOnceki = enSon.classType || null;
          }
        } catch {
          // TJK'ya ulaşılamadı — gerçekten ilk start mı bilinmiyor. ilkStart=true varsaymak
          // (yanlışsa) hpOnceki eksikliğini "gerçek kör nokta" gibi gösterip veri toplama
          // hatasını gizler; bu yüzden false bırakılır — gecit-motoru bunu doğru şekilde
          // "veri toplama hatası" (araştırılması gereken eksik) olarak işaretler.
          //
          // ÖNEMLİ: hpOnceki burada BİLEREK null bırakılıyor (0'a düşürülmüyor) — aşağıda
          // hpOncekiEfektif hesabı bu durumu "resmi yok" (yapısal, 0 varsayılan) ile
          // KARIŞTIRMAMASI için hpOncekiFetchBasarisiz ayrı tutuluyor. Daha önce ikisi
          // aynı koddan geçtiği için gerçek bir TJK erişim hatası, atın ham bugünkü HP'sini
          // "HP ivmesi" sanan sahte bir sayıya dönüşüyordu — bu da HP_PATLAMA gibi gerçek
          // paralı bir geçidi (≥+10 ivme → zorunlu ekonomik kupon) yanlışlıkla tetikleyebiliyordu.
          ilkStart = false;
          hpOncekiFetchBasarisiz = true;
        }
      }

      const son800Sonuc = son800ByRunnerName.get(r.name);
      if (son800Sonuc) {
        son800BenzerKosuN = son800Sonuc.n;
        son800Medyan = son800Sonuc.medyan;
      }

      const yon = formYonu(r.recentForm);
      const sinifSkkOnceki = classToSkk(sinifOnceki);
      const sinifDususu = bugunSkk != null && sinifSkkOnceki != null ? bugunSkk < sinifSkkOnceki : false;

      const kondisyonZinciriVar = r.gallops.some((g) => {
        const s = (g.splits as Record<string, string | null> | null) ?? {};
        return !!(s["800"] || s["1000"] || s["1200"]);
      });
      const enSonGalop = r.gallops[0];
      let keskinGalopZinciri = false;
      if (enSonGalop) {
        const s = (enSonGalop.splits as Record<string, string | null> | null) ?? {};
        const finish = s["400"] ?? null;
        // §VI "İç pist: ~1sn daha yavaş değerlendir" — bkz. mekanik-puanlama.ts galopSiniflandirmasi yorumu.
        const q = galopQuality("400", finish, race.breed, s["ic_dis"] === "İç");
        keskinGalopZinciri = q === "cok_iyi" || q === "iyi";
      }

      const kiloAvantaji = r.weight != null && ortKilo != null ? r.weight <= ortKilo - 1 : false;

      // Jokey/Antrenör GENEL yıllık win% (v6.26, kullanıcı talebi 2026-07-30).
      const jockeyStat = r.jockey ? jockeyStats[r.jockey] : undefined;
      const trainerStat = r.trainer ? trainerStats[r.trainer] : undefined;
      const jockeyWinPct = jockeyStat && jockeyStat.overall.rides > 0
        ? Math.round((jockeyStat.overall.wins / jockeyStat.overall.rides) * 100) : null;
      const trainerWinPct = trainerStat && trainerStat.rides > 0
        ? Math.round((trainerStat.wins / trainerStat.rides) * 100) : null;

      const galopOzet = r.gallops.length === 0
        ? "İdman kaydı yok"
        : r.gallops.slice(0, 3).map((g) => {
            const s = (g.splits as Record<string, string | null> | null) ?? {};
            const parcalar = ["1200", "1000", "800", "600", "400", "200"]
              .filter((d) => s[d])
              .map((d) => `${d}m:${s[d]}`);
            // Sitenin galop panelindeki "!" işaretiyle aynı sinyal: idmanı yapan jokey
            // bugünkü yarışta da binecek jokeyle aynıysa, bu olumlu bir işaret ve
            // Faz 2/4'e mutlaka yansımalı — göz ardı edilmemesi gerekiyor.
            const jokeyAyni = isSameJockey(g.jockey, r.jockey) ? " [AYNI JOKEY İLE İDMAN YAPTI]" : "";
            return `${new Date(g.date).toISOString().slice(0, 10)} ${g.form ?? ""} ${parcalar.join(" ")}${jokeyAyni}`.trim();
          }).join(" | ");

      // TJK bazı atlar için (özellikle Şartlı 1 / Maiden ya da HP'si henüz atanmamış atlar)
      // hiç HP yayınlamaz — bu bir veri toplama eksikliği değil, yapısal bir durumdur.
      // hpOnceki'de aynı durum "gerçek ilk start" (ilkStart) ile karıştırılmamalı: at daha
      // önce koşmuş ama o koşularda da resmi HP hiç almamış olabilir.
      const hpBugunResmiYok = r.hp == null;
      const hpBugunEfektif = r.hp ?? 0;
      // "Resmi yok" (yapısal, 0 varsayılan) YALNIZ fetch gerçekten başarılıyken ve TJK'nın
      // kendisi HP boş bırakmışsa geçerli — fetch başarısız olduysa bu bir "resmi yok" değil,
      // "bilinmiyor" (hpOncekiFetchBasarisiz aşağıda ayrıca taşınıyor).
      const hpOncekiResmiYok = !ilkStart && hpOnceki == null && !hpOncekiFetchBasarisiz;
      const hpOncekiEfektif = ilkStart || hpOncekiFetchBasarisiz ? null : hpOnceki ?? 0;

      const aynıPistMesafeKayitlari = atPerformansMap.get(r.name) ?? [];
      const aynıPistMesafeOzet = aynıPistMesafeKayitlari.length > 0
        ? aynıPistMesafeKayitlari
            .slice(0, 3)
            .map((row) => {
              // TJK'nın ham "surface" metni ("Ç:Normal 3.3" gibi) zaten zemin DURUMUNU
              // (yalnız pist türünü değil) taşıyor — daha önce hiç kullanılmıyordu. Ayıklanamazsa
              // (nadiren, format farklıysa) sessizce etiket eklenmez — "Normal" UYDURULMAZ.
              const zeminDetay = zeminDetayiSatirdanCikar(row.surface);
              const zeminEk = zeminDetay ? ` [Zemin: ${zeminKatsayisi(zeminDetay).etiket}]` : "";
              // 2026-07-26, kullanıcı talebiyle eklendi: bu kayıtlar TJK'dan zaten 17 alanla
              // çekiliyordu (bkz. TjkAtKosuRow) ama yalnız tarih/sıra/HP metne yazılıyordu —
              // Faz2 promptunun kendi 6. maddesi ("KİLO-GEÇMİŞ ÇAPRAZ KONTROLÜ") burada kilo
              // olduğunu varsayıyordu, aslında hiç yoktu. Ganyan BİLEREK dışarıda bırakıldı
              // (kullanıcının Result.ganyan için verdiği "hiçbiri bağlanmasın" kararıyla tutarlı).
              // v6.10: hipodrom artık KESİN eşleşme şartı değil (yalnız pist+mesafe) — bu
              // yüzden hangi hipodromda koşulduğu artık metne yazılıyor, aksi halde farklı
              // bir hipodromdaki sonucu bugünküyle aynı sanma riski olurdu.
              return `${row.date} ${row.city} ${row.finishPos || "?"}. derece:${row.time || "?"} kilo:${row.weight || "?"} takı:${row.equipment || "—"} jokey:${row.jockey || "?"} grup:${row.group || "—"} (HP ${row.hp || "?"})${zeminEk}`;
            })
            .join(" | ")
        : null;

      // ── Mekanik ön-hesaplama ──
      // hpOncekiEfektif fetch başarısız olduğunda null olur (yukarıda) — bu durumda "ivme"
      // hesaplamak (ham HP'yi ivme sanmak) yerine ivme de null kalmalı, gecit-motoru.ts'nin
      // veriToplamaHatasi kontrolü (`iv==null && !ilkStart`) bunu doğru yakalasın.
      const hpIvmesiHesap = !ilkStart && hpOncekiEfektif != null ? hpBugunEfektif - hpOncekiEfektif : null;
      const hpAlanIciUstHesap = hpUstSet.has(r.id);
      const yonHesap = { geriliyor: yon?.geriliyor ?? null, iyilesiyor: yon?.iyilesiyor ?? null };
      const hpKalitesi = hpKalitesiYildizi({
        hpIvmesi: hpIvmesiHesap, hpAlanIciUst: hpAlanIciUstHesap,
        bitirisIyilesiyor: yonHesap.iyilesiyor, bitirisGeriliyor: yonHesap.geriliyor,
      });
      const sinifBonusu = sinifGecisBonusu(sinifSkkOnceki, bugunSkk);
      const galopSinif = galopSiniflandirmasi(
        r.gallops.map((g) => ({ splits: g.splits as Record<string, string | null> | null })),
        race.breed
      );
      // Runner.raceStyle DB alanı yalnız o at KENDİ Accurace verisi geldiğinde yazılıyor —
      // yeni girilen (henüz koşulmamış) bir at için bu alan neredeyse hep null'du (bkz.
      // ingest/base.ts'teki kalıcı düzeltme notu). accuraceEgilimMap yukarıda ZATEN aynı
      // atın geçmiş Accurace kayıtlarından TAZE hesaplanmıştı (n≥3) — o yüzden DB'deki
      // (potansiyel olarak eski/boş) alan yerine bunu kullanmak hem daha güvenilir hem
      // ekstra sorgu gerektirmiyor.
      const accuraceEgilimHesap = accuraceEgilimMap.get(r.id) ?? null;
      const tempoVeriNHesap = accuraceEgilimHesap?.n ?? null;
      const tempoGuvenHesap = tempoGuvenSeviyesi(tempoVeriNHesap);

      // AGF Trend — kullanıcı talebi 2026-07-27, "para akışı" sinyali. En az 2 ölçüm
      // (agf-sync günde birkaç kez çalışır) birikmemişse anlamlı bir trend sayılmaz, null.
      // v6.17, kullanıcı talimatı 2026-07-27: ASIL sinyal MUTLAK puan farkı — küçük bir
      // başlangıç yüzdesinden (%1-2 gibi) gelen ufak bir hareket bile devasa GÖRELİ yüzde
      // sıçraması yaratır ama gerçek para akışını göstermez. Metin puanı ÖNE koyar, yüzdeyi
      // yalnız bağlam olarak sona ekler, gürültü şüphesi varsa açıkça uyarır.
      const agfTrendHesap = agfTrendMap.get(r.no);
      const agfTrendOzetHesap =
        agfTrendHesap && agfTrendHesap.kayitSayisi >= 2 && agfTrendHesap.ilkAgf != null && agfTrendHesap.sonAgf != null
          ? `${agfTrendHesap.fark! >= 0 ? "+" : ""}${agfTrendHesap.fark} puan (%${agfTrendHesap.ilkAgf} → %${agfTrendHesap.sonAgf}, göreli ${agfTrendHesap.yuzdeDegisim! >= 0 ? "+" : ""}%${agfTrendHesap.yuzdeDegisim})${agfTrendHesap.gurultuSuphesi ? " [KÜÇÜK PAYDADAN GÜRÜLTÜ ŞÜPHESİ — göreli yüzde çarpıcı görünse de mutlak hareket küçük; kesin hüküm değil, diğer verilerle birlikte sen değerlendir]" : ""}`
          : null;

      return {
        id: r.id, no: r.no, ad: r.name, scratched: r.scratched,
        weight: r.weight, weightChange: r.weightChange, disaridanStart: r.disaridanStart, startNo: r.startNo,
        kulvarBolge: kulvarBolgeBugun,
        hipodromMesafedeKazandi: sonYarisDetayByNo.get(r.no)?.kazandi ?? "KOSMADI",
        hipodromMesafedeEnIyiDerece: sonYarisDetayByNo.get(r.no)?.enIyiDerecesi ?? null,
        jockey: r.jockey, jockeyChanged: r.jockeyChanged, previousJockey: r.previousJockey,
        trainer: r.trainer, owner: r.owner,
        ekuriMateleri: ekuriMateMap.get(r.id) ?? [],
        sire: r.sire, dam: r.dam, damSire: r.damSire,
        sireStatOzet: sireStatMap.get(r.id)?.ozet ?? null,
        sireOrneklemKendiVeri: sireStatMap.get(r.id)?.ornekKendiVeri ?? null,
        sireKazanmaOrani: sireStatMap.get(r.id)?.kYuzde ?? null,
        damStatOzet: damStatMap.get(r.id)?.ozet ?? null,
        damOrneklemKendiVeri: damStatMap.get(r.id)?.ornekKendiVeri ?? null,
        damSireStatOzet: damSireStatMap.get(r.id)?.ozet ?? null,
        damSireOrneklemKendiVeri: damSireStatMap.get(r.id)?.ornekKendiVeri ?? null,
        sireDosageOzet: sireDosageMap.get(r.id)?.ozet ?? null,
        sireDosageDi: sireDosageMap.get(r.id)?.di ?? null,
        adminNote: r.adminNote,
        sonYarisVeriKaynagiGuvenilir: sonYarisDetayByNo.get(r.no)?.hasTjkId ?? false,
        sonYarisTakiEklenen: sonYarisDetayByNo.get(r.no)?.eklenenTaki.map((t) => t.label) ?? [],
        sonYarisTakiCikarilan: sonYarisDetayByNo.get(r.no)?.cikarilanTaki.map((t) => t.label) ?? [],
        sonYarisKiloDegisimi: sonYarisDetayByNo.get(r.no)?.kiloDegisimi ?? null,
        sonYarisAyniJokey: sonYarisDetayByNo.get(r.no)?.ayniJokey ?? null,
        gunAralik: sonYarisDetayByNo.get(r.no)?.gunFarki ?? null,
        hpBugun: hpBugunEfektif, hpBugunResmiYok, hpOncekiResmiYok, hpOncekiFetchBasarisiz,
        agf: r.agf, agfSirasi: agfSiraMap.get(r.id) ?? null, agfTrendOzet: agfTrendOzetHesap,
        agfTrendFark: agfTrendOzetHesap != null ? agfTrendHesap!.fark : null,
        equipment: r.equipment, equipmentAdded: r.equipmentAdded, equipmentRemoved: r.equipmentRemoved,
        recentForm: r.recentForm, bestTime: r.bestTime,
        apprentice: r.apprentice,
        raceStyleEtiket: accuraceEgilimHesap?.stil ?? null,
        tempoVeriN: tempoVeriNHesap,
        kacak: accuraceEgilimHesap?.stil === "KACAK_AT",
        galopOzet,
        ilkStart, hpOnceki: hpOncekiEfektif,
        hpIvmesi: hpIvmesiHesap,
        sinifOnceki, sinifSkkOnceki, sinifSkkBugun: bugunSkk, sinifDususu,
        bitirisGeriliyor: yonHesap.geriliyor, bitirisIyilesiyor: yonHesap.iyilesiyor,
        sonSonucZayif: sonSonucZayifMi(r.recentForm),
        kondisyonZinciriVar, keskinGalopZinciri,
        kiloAvantaji, hpAlanIciUst: hpAlanIciUstHesap,
        son800BenzerKosuN, son800Medyan,
        son800TumOzet: son800TumOzetByRunnerName.get(r.name) ?? null,
        son800TumToplamKayit: son800TumToplamByRunnerName.get(r.name) ?? 0,
        aynıPistMesafeOzet, aynıPistMesafeToplamKayit: aynıPistMesafeKayitlari.length, h2hOzet: h2hOzetFor(r.name),
        hpKalitesiYildizi: hpKalitesi, sinifGecisBonusuPuan: sinifBonusu,
        galopSiniflandirma: galopSinif, tempoGuven: tempoGuvenHesap,
        accuraceEgilim: accuraceEgilimMap.get(r.id) ?? null,
        detayliIstatistikOzet: r.tjkAtId != null
          ? formatHorseDetailStatOzet(horseStatsCacheMap.get(r.tjkAtId) ?? [], {
              hippodromeName, surface: race.surface, distance: race.distance, jockeyName: r.jockey,
            })
          : null,
        jockeyWinPct, trainerWinPct,
        zeminGecmisiOzet: zeminGecmisiMap.get(r.no)?.ozet ?? null,
        zeminGecmisiToplamKayit: zeminGecmisiMap.get(r.no)?.toplamKayit ?? 0,
        sinifBaglamliForm: sinifBaglamliFormMap.get(r.no)?.ozet ?? null,
        startGecmisiOzet: formatGecCikisOzet(gecCikisMap.get(r.name)),
      };
    })
  );

  // Sahadaki toplam kaçak sayısı (§VIII Kaçak Sayısı Haritası) — bu sayı zaten
  // faz4/gecit-motoru.ts'te ayrıca hesaplanıyordu ama Faz 2'ye hiç ulaşmıyordu;
  // Faz 2 tempo puanlarken her satırdaki "kaçak" bayrağını kendi kendine sayıp
  // tahmin etmek zorunda kalıyordu.
  const sahadakiKacakSayisi = runners.filter((r) => r.kacak).length;
  const kacakHarita = kacakHaritasi(sahadakiKacakSayisi);

  // v6.34 — kullanıcı talebi (2026-08-02): "PistMesafeInfoButton" (program sayfasındaki
  // "Bu Koşu Tipinde Kazananlar" kartı) yalnız insan editörün tıklayınca gördüğü bir
  // bilgiydi, Faz1'e/Claude'a hiç ulaşmıyordu — sahadakiKacakSayisi'nde daha önce
  // yaşanan AYNI sınıf eksiklik (yukarıdaki yorum). Aynı hipodrom+pist+mesafe(±200m)'deki
  // geçmiş yarışların kazananlarının tarihsel stil dağılımı artık Faz2/Faz3'e de gidiyor.
  // v6.34 düzeltme (kullanıcı geri bildirimi): yalnız ham veriyi yan yana koymak
  // yetersizdi — Claude'un bunu gerçekten kullanması için kacakAvantajliStil'deki AYNI
  // desende açık bir yönlendirme cümlesi (en çok kazanan stil ayrıca tutulup Faz2
  // prompt'unda "bu atlar sıralamada gereksiz yere çok aşağıda kalmamalı" şeklinde
  // belirtiliyor — GARANTİ/otomatik puan DEĞİL, yalnız yönlendirici bir eğilim).
  const pistMesafeStil = await getPistMesafeStilIstatistigi(hippodromeName, race.surface, race.distance).catch(() => null);
  const PIST_MESAFE_STIL_LABEL: Record<string, string> = {
    KACAK_AT: "Kaçak At", ON_GRUP_ARKASI: "Ön Grup Arkası", BEKLEME_GRUBU: "Bekleme Grubu", EN_GERI_TAKIP: "En Geri Takip",
  };
  const pistMesafeStilOzeti = pistMesafeStil
    ? `${pistMesafeStil.breakdown.map((b) => `${PIST_MESAFE_STIL_LABEL[b.style]} %${b.percent} (${b.count})`).join(", ")} — n=${pistMesafeStil.n} geçmiş yarış`
    : null;
  const pistMesafeStilEnCokKazanan = pistMesafeStil ? PIST_MESAFE_STIL_LABEL[pistMesafeStil.topStyle] : null;
  const pistMesafeStilEnCokKazananYuzde = pistMesafeStil ? pistMesafeStil.topPercent : null;

  const n = runners.length || 1;
  const veriDoluluk = [
    { alan: "hpBugun", oran: runners.filter((r) => r.hpBugun != null).length / n },
    { alan: "hpOnceki", oran: runners.filter((r) => r.hpOnceki != null || r.ilkStart).length / n },
    { alan: "tempoVeriN", oran: runners.filter((r) => r.tempoVeriN != null).length / n },
    { alan: "agfSirasi", oran: runners.filter((r) => r.agfSirasi != null).length / n },
    { alan: "formYonu", oran: runners.filter((r) => r.bitirisGeriliyor != null || r.bitirisIyilesiyor != null).length / n },
  ];

  const accuraceSayisi = runners.filter((r) => r.accuraceEgilim != null || r.tempoVeriN != null).length;
  const galopSayisi = runners.filter((r) => r.galopOzet !== "İdman kaydı yok").length;
  const pedigriSayisi = runners.filter((r) => r.sireStatOzet != null || r.damStatOzet != null || r.damSireStatOzet != null).length;
  const h2hSayisi = runners.filter((r) => r.h2hOzet != null).length;
  const aynıPistMesafeSayisi = runners.filter((r) => r.aynıPistMesafeOzet != null).length;
  const sonYarisSayisi = runners.filter((r) => r.sonYarisVeriKaynagiGuvenilir).length;
  // v6.14 — kullanıcı bulgusu 2026-07-27: "Aynı Jokey" bilgisi (Son Yarış Detayları
  // panelinin bir sütunu) Faz2 prompt'unda sonYarisVeriKaynagiGuvenilir=false olan atlarda
  // sessizce satırdan düşüyordu (Çilli Cafer örneği) — düzeltildi (artık "bilinmiyor" olarak
  // gösteriliyor, hiç düşmüyor), checklist bu kapsamı da ayrı görünür kılıyor.
  const ayniJokeyBilinenSayisi = runners.filter((r) => r.sonYarisAyniJokey != null).length;
  // v6.15 — kullanıcı talebi 2026-07-27: "Para Akışı (AGF) trendi analize nasıl eklenir".
  const agfTrendSayisi = runners.filter((r) => r.agfTrendOzet != null).length;
  // v6.10-v6.13'te eklenen sinyaller — checklist'e bugüne kadar hiç eklenmemişti (kullanıcı
  // tespiti 2026-07-28: "veri kapsamı bu kadar mıydı, bir sürü şey yazdık").
  const araGecislerSayisi = runners.filter((r) => r.accuraceEgilim != null).length;
  const detayliIstatistikSayisi = runners.filter((r) => r.detayliIstatistikOzet != null).length;
  // v6.26 — kullanıcı talebi 2026-07-30: bugün geri eklenen 2 kategori.
  const jokeyAntrenorWinPctSayisi = runners.filter((r) => r.jockeyWinPct != null || r.trainerWinPct != null).length;
  const zeminGecmisiSayisi = runners.filter((r) => r.zeminGecmisiOzet != null).length;
  const sinifBaglamliFormSayisi = runners.filter((r) => r.sinifBaglamliForm != null).length;
  const startGecmisiSayisi = runners.filter((r) => r.startGecmisiOzet != null).length;

  const veriKapsamKontrolu: VeriKapsamKontrol[] = [
    {
      kategori: "Accurace — Tüm Kayıtlar (tempo ve yarış stilleri)",
      bakildi: accuraceSayisi > 0,
      detay: accuraceSayisi > 0
        ? `${accuraceSayisi}/${n} atta Accurace GPS/sektörel tempo eğilimi (n≥3 yarış) veya bugünkü yarış verisi bulundu.`
        : "Sahadaki hiçbir at için Accurace GPS/sektörel kaydı bulunamadı — ya bu koşuların GPS verisi hiç toplanmamış ya da hiçbir at 3+ yarışlık kalıcı eğilim eşiğini karşılamıyor.",
    },
    {
      kategori: "Ara Geçişler (EP-MP-LP erken/orta/geç sıra, son 400m düşüş, hız farkı)",
      bakildi: araGecislerSayisi > 0,
      detay: araGecislerSayisi > 0
        ? `${araGecislerSayisi}/${n} atın çok yarışlık Accurace geçmişinden ortalama erken/orta/geç sıra, son 400m düşüş oranı ve ilk-son yarı hız farkı hesaplandı, ham eğilim olarak Claude'a aktarıldı.`
        : "Sahadaki hiçbir at için 3+ yarışlık kalıcı Accurace eğilimi oluşmadığından ara geçiş detayı hesaplanamadı.",
    },
    {
      kategori: "Son Hazırlıklar (Galoplar ve aynı jokey ile mi çalışmış)",
      bakildi: galopSayisi > 0,
      detay: galopSayisi > 0
        ? `${galopSayisi}/${n} atın son yarışından sonraki idman/galop kaydı çekildi.`
        : "Sahadaki hiçbir at için son yarışından sonra TJK idman/galop kaydı bulunamadı.",
    },
    {
      kategori: "Pedigriler (anne, baba ve anne babası — üçü ayrı ayrı)",
      bakildi: pedigriSayisi > 0,
      detay: pedigriSayisi > 0
        ? `${pedigriSayisi}/${n} atın aygır, kısrak ve/veya damsire (kısrak babası) istatistiği (hipodromx veya kendi verimiz) eşleşti.`
        : "Sahadaki hiçbir at için aygır/kısrak/damsire istatistiği eşleşmedi — bu ırk+pist+mesafe kombinasyonunda hipodromx'te de kendi verimizde de kayıt yok.",
    },
    {
      kategori: "H2H — Geçmiş Karşılaşmalar",
      bakildi: h2hSayisi > 0,
      detay: h2hSayisi > 0
        ? `${h2hSayisi}/${n} at, sahadaki diğer atlarla en az bir ortak geçmiş yarışta karşılaşmış.`
        : "Sahadaki atlar arasında hiç ortak geçmiş yarış (aynı koşuda birlikte start) bulunamadı.",
    },
    {
      kategori: "Detaylı At Karşılaştırma — Aynı Pist/Mesafe (bu yıl, hipodrom farklı olabilir)",
      bakildi: aynıPistMesafeSayisi > 0,
      detay: aynıPistMesafeSayisi > 0
        ? `${aynıPistMesafeSayisi}/${n} atın bu mesafe+pist kombinasyonunda (herhangi bir hipodromda) bu yıl geçmiş kaydı var.`
        : "Sahadaki hiçbir at bu mesafe+pist kombinasyonunda bu yıl koşmamış (TJK resmi profilinden doğrulandı).",
    },
    {
      kategori: "Hipodrom Özellikleri (kulvar ve viraj konumu)",
      bakildi: kulvarBolgeBugun != null,
      detay: kulvarBolgeBugun != null
        ? `Start noktası "${kulvarBolgeBugun}" olarak haritalandı, kulvar numaralarıyla birlikte değerlendirildi.`
        : "Bu hipodrom+pist+mesafe kombinasyonu için start/viraj koordinat haritası tanımlı değil.",
    },
    {
      kategori: "Son Yarış Detayları (KGS, kilo, takı, aynı jokey, kazandı mı/derece)",
      bakildi: sonYarisSayisi > 0,
      detay: sonYarisSayisi > 0
        ? `${sonYarisSayisi}/${n} at için TJK resmi at profilinden (tjkAtId) güvenilir son yarış detayı çekildi — bunların ${ayniJokeyBilinenSayisi}/${sonYarisSayisi}'inde "aynı jokey mi" bilgisi de bilinen (geri kalanı "bilinmiyor" olarak Claude'a aktarıldı, hiçbiri satırdan düşürülmedi).`
        : "Sahadaki hiçbir at TJK at profil ID'siyle (tjkAtId) eşleşmediği veya TJK sorgusu başarısız olduğu için son yarış detayı çekilemedi.",
    },
    {
      kategori: "Detaylı İstatistikler (TJK — Zaman/Hipodrom/Jokey/Pist/Mesafe kırılımı)",
      bakildi: detayliIstatistikSayisi > 0,
      detay: detayliIstatistikSayisi > 0
        ? `${detayliIstatistikSayisi}/${n} at için bugünkü hipodrom/pist/mesafe/jokey bağlamına uyan TJK kariyer istatistiği (HorseStatsCache) bulundu.`
        : "Sahadaki hiçbir at için bugünkü bağlama uyan bir detaylı istatistik satırı bulunamadı.",
    },
    {
      kategori: "AGF Trend (gün içi para akışı — yükselen/düşen)",
      bakildi: agfTrendSayisi > 0,
      detay: agfTrendSayisi > 0
        ? `${agfTrendSayisi}/${n} atın AGF'sinde gün içinde en az 2 ölçüm birikti, ilk-son ölçüm arasındaki hareket Claude'a aktarıldı.`
        : "Sahadaki hiçbir atta henüz 2. bir AGF ölçümü birikmedi (agf-sync ilk ölçümünü aldıktan sonra en az bir kez daha çalışması gerekiyor) — trend hesaplanamadı.",
    },
    {
      kategori: "Jokey/Antrenör Genel Kazanma Yüzdesi (yıllık)",
      bakildi: jokeyAntrenorWinPctSayisi > 0,
      detay: jokeyAntrenorWinPctSayisi > 0
        ? `${jokeyAntrenorWinPctSayisi}/${n} atın jokeyi ve/veya antrenörü için TJK'nın yıllık senkronize win%'i (sync-jokey-stats/sync-trainer-stats) bulundu.`
        : "Sahadaki hiçbir at için jokey/antrenör senkronize istatistiği eşleşmedi.",
    },
    {
      kategori: "Zemin Geçmişi (bugünküyle aynı zemin sınıfında geçmiş start'lar)",
      bakildi: zeminGecmisiSayisi > 0,
      detay: zeminGecmisiSayisi > 0
        ? `${zeminGecmisiSayisi}/${n} atın bugünküyle (${zemin.etiket}) aynı zemin sınıfında en az 1 geçmiş start'ı bulundu.`
        : `Sahadaki hiçbir atın bugünküyle (${zemin.etiket}) aynı zemin sınıfında geçmiş kaydı yok — bu zemin durumu nadir görüldüğü için beklenen bir durum olabilir.`,
    },
    {
      kategori: "Sınıf-bağlamlı Form (son starlar, sıra+sınıf birlikte)",
      bakildi: sinifBaglamliFormSayisi > 0,
      detay: sinifBaglamliFormSayisi > 0
        ? `${sinifBaglamliFormSayisi}/${n} at için son 5 start'ın bitiriş sırası, o günkü sınıfla birlikte çıkarıldı.`
        : "Sahadaki hiçbir at için sınıf-bağlamlı form geçmişi çıkarılamadı.",
    },
    {
      kategori: "Start Geçmişi (TJK resmi \"Geç Çıkış\" tespiti)",
      bakildi: startGecmisiSayisi > 0,
      detay: startGecmisiSayisi > 0
        ? `${startGecmisiSayisi}/${n} atın en az 3 sonuçlu starttan oluşan geçmişinde, TJK'nın "Geç Çıkış" olarak işaretlediği start sayısı bulundu.`
        : "Sahadaki hiçbir at için yeterli örneklemli (3+) sonuçlu start geçmişi bulunamadı.",
    },
    {
      kategori: "Saha Büyüklüğü (kaçak/sprinter yorumu)",
      bakildi: true,
      detay: `${runners.length} at start alıyor, sahadaki kaçak sayısı ${sahadakiKacakSayisi} — ${kacakHarita.etiket}.`,
    },
    {
      // v6.34 eklendi ama bu checklist'e unutulmuştu (kullanıcı ekran görüntüsüyle buldu,
      // 2026-08-02) — diğer tüm Faz1 kategorileri gibi burada da görünür olmalı.
      kategori: "Bu Koşu Tipinde Kazananlar (aynı pist+mesafe ±200m'deki tarihsel stil dağılımı)",
      bakildi: pistMesafeStil != null,
      detay: pistMesafeStil != null
        ? `Aynı hipodrom+pist+mesafe(±200m)'deki ${pistMesafeStil.n} geçmiş yarışın kazananları tarandı — en çok kazanan stil: ${pistMesafeStilEnCokKazanan} (%${pistMesafeStilEnCokKazananYuzde}).`
        : "Bu pist+mesafe kombinasyonunda (±200m) yeterli örneklemli (3+) geçmiş yarış bulunamadı.",
    },
    {
      kategori: "Sıklet Dağılımı (sahadaki en hafif-en ağır kilo makası)",
      bakildi: kiloMakasi != null,
      detay: kiloMakasi != null
        ? `Saha kilo aralığı ${kiloEnHafif}-${kiloEnAgir}kg (makas ${kiloMakasi}kg).`
        : "Sahadaki hiçbir atın kilosu bulunamadığı için makas hesaplanamadı.",
    },
    {
      kategori: "Son Düzlük Uzunluğu (hipodroma özgü, yaklaşık — TJK resmi ölçümü değil)",
      bakildi: sonDuzlukUzunlugu != null,
      detay: sonDuzlukUzunlugu != null
        ? `${hippodromeName}: ${sonDuzlukUzunlugu}.`
        : `${hippodromeName} için son düzlük uzunluğu verisi henüz sağlanmadı/teyit edilmedi.`,
    },
  ];

  return {
    race: {
      id: race.id,
      hippodromeName,
      raceNo: race.raceNo,
      date: race.raceDay.date.toISOString().slice(0, 10),
      classType: race.classType,
      breed: race.breed,
      surface: race.surface,
      distance: race.distance,
      zeminDetayi, zeminKatsayisi: zemin.katsayi, zeminEtiketi: zemin.etiket,
      sahadakiKacakSayisi, kacakTempoEtiketi: kacakHarita.etiket, kacakAvantajliStil: kacakHarita.avantajli,
      pistMesafeStilOzeti, pistMesafeStilEnCokKazanan, pistMesafeStilEnCokKazananYuzde,
      pistMesafeStilBreakdown: pistMesafeStil ? pistMesafeStil.breakdown.map((b) => ({ style: b.style, percent: b.percent })) : null,
      enCokYukselenler: agfTrendSonuc.enCokYukselenler.map((a) => ({ runnerNo: a.runnerNo, ad: a.horseName, fark: a.fark ?? 0 })),
      enCokDusenler: agfTrendSonuc.enCokDusenler.map((a) => ({ runnerNo: a.runnerNo, ad: a.horseName, fark: a.fark ?? 0 })),
      kiloEnHafif, kiloEnAgir, kiloMakasi, sonDuzlukUzunlugu,
      conditions: race.conditions, ageWeight: race.ageWeight, trackRecord: race.trackRecord,
      weather: race.raceDay.weather,
    },
    runners,
    veriDoluluk,
    veriKapsamKontrolu,
  };
}
