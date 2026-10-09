// KALICI ARAÇ (V5 model verisi) — 2026-08-15, SİLİNMİYOR.
// V4'ün boolean sinyallerinin ham/sürekli hallerini + gerçek AGF farkını (yalnız top-5
// değil, TÜM atlar) + jokey/antrenör/aygır için shrinkage'a hazır ham sayıları toplar.
// Koşullu logit (Plackett-Luce) eğitimi için raceId'ye göre GRUPLANMIŞ satırlar üretir.
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-model-veri-olustur.mts
import { db } from "./src/lib/db";
import { getSonYarisDetaylariForRace } from "./src/server/actions/son-yaris-detay.actions";
import { fetchAccuraceGecmisKayitlari, hesaplaAccuraceSonYarisEnHizliKapanisMap, normalizeHorseName } from "./src/lib/methodology/veri-toplama";
import {
  analizEtTekYaris,
  hesaplaCokYarisEgilimi,
  hesaplaYuzdelikSelfVsSiblings,
  hesaplaYarisGidisati,
  type PaceCheckpoint,
  type AtTempoProfili,
} from "./src/lib/methodology/pace-analizi";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";
import { galopQuality, isSameJockey, isSprintIdman } from "./src/components/program/panels/galop-helpers";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "./src/lib/sire-stat-match";
import { finishPos } from "./src/lib/race-result";
import { parseTjkDate } from "./src/lib/tjk-date";
import { getJockeyStats, getTrainerStats } from "./src/server/services/race.service";
import { zeminKatsayisi, zeminDetayiBul, zeminDetayiSatirdanCikar } from "./src/lib/methodology/mekanik-puanlama";
import { hesaplaZeminToleransiMap } from "./src/server/actions/zemin-toleransi.actions";
import { hesaplaTempoTasimaGucuMap } from "./src/server/actions/tempo-tasima-gucu.actions";
import { hesaplaZeminMesafeDeneyimiMap } from "./src/server/actions/zemin-mesafe-deneyimi.actions";
import { hizPaceIndexKur, hizDerecesiHesaplaOrtak, type HizGecmisSatir } from "./src/lib/methodology/hiz-derecesi-hesapla";
import { yakinsamaGecmisHesapla } from "./src/lib/methodology/yakinsama-gecmis";
import { hesaplaAgfSirasi } from "./src/lib/methodology/agf-sirasi";
import { writeFileSync, existsSync, readFileSync } from "fs";

const GERCEK_OLMAYAN_HIPODROM_SLUGLARI = ["karma", "perak-malezya"];
export const CACHE_PATH = "C:\\Users\\tlgbi\\AppData\\Local\\Temp\\claude\\c--Users-tlgbi-OneDrive-Belgeler-Rota\\76598f4f-31f1-4414-a3f6-fbab0aab98d4\\scratchpad\\model-veri.json";

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error("TIMEOUT")), ms))]);
}

// (en yakın yarış - 3 yarış önceki) / 2 — pozitif=kötüleşiyor, negatif=iyileşiyor
function formEgimi(recentForm: string | null): number | null {
  if (!recentForm) return null;
  const chars = recentForm.split("").filter((c) => /[\dK]/i.test(c));
  const nums = chars.map((c) => (c.toUpperCase() === "K" ? 12 : parseInt(c, 10)));
  if (nums.length < 2) return null;
  const enYakin = nums[nums.length - 1];
  const referans = nums[Math.max(0, nums.length - 4)];
  return (enYakin - referans) / 2;
}

function shrink(wins: number, rides: number, populasyonOrt: number, k = 20): number {
  return (wins + k * populasyonOrt) / (rides + k);
}

function parseKiloSayi(w: string | undefined | null): number | null {
  if (!w) return null;
  const n = parseFloat(w.replace(",", "."));
  return isNaN(n) ? null : n;
}
// "1.16.30" (dk.sn.yüzde) veya "58.78" (sn.yüzde) → toplam saniye. Hız derecesi için.
function sureyiSaniyeyeCevir(t: string | undefined | null): number | null {
  if (!t) return null;
  const parcalar = t.split(".");
  if (parcalar.length === 3) {
    const dk = parseInt(parcalar[0], 10), sn = parseInt(parcalar[1], 10), yuzde = parseInt(parcalar[2], 10);
    if (isNaN(dk) || isNaN(sn) || isNaN(yuzde)) return null;
    return dk * 60 + sn + yuzde / 100;
  }
  if (parcalar.length === 2) {
    const sn = parseInt(parcalar[0], 10), yuzde = parseInt(parcalar[1], 10);
    if (isNaN(sn) || isNaN(yuzde)) return null;
    return sn + yuzde / 100;
  }
  return null;
}
function surfaceFromRaw(raw: string | undefined | null): string | null {
  if (!raw) return null;
  if (raw.startsWith("Ç")) return "CIM";
  if (raw.startsWith("K")) return "KUM";
  if (raw.startsWith("S")) return "SENTETIK";
  return null;
}
// "15.07.2026" (TjkAtKosuRow.date formatı) → Date. Geçmiş koşu filtrelemesinde KRİTİK:
// bu olmadan HorseRaceHistoryCache'in GÜNCEL (bugüne kadar tüm) hâli kullanılıp, o anda
// henüz olmamış gelecekteki koşular da "geçmiş" sayılıyordu — veri sızıntısı (bkz.
// kiloFarkiEnIyiKosuya/atJokeyIkiliOrani üstündeki 2026-08-20 notu).
function parseGecmisTarih(s: string | undefined | null): Date | null {
  return s ? parseTjkDate(s) : null;
}

export type ModelRow = {
  raceId: string;
  runnerId: string;
  no: number;
  win: 0 | 1;
  top3: 0 | 1;
  top3Observed?: boolean;
  // ham/sürekli girdiler:
  agfFark: number; // gerçek son-ilk AGF farkı, TÜM saha (yalnız top-5 değil), veri yoksa 0
  agfSirasi: number; // 1..N, veri yoksa saha ortası
  accurace: 0 | 1;
  formEgimi: number; // veri yoksa 0
  kgs: number; // gün, veri yoksa -1 (modelde ayrı bir "veri yok" göstergesiyle ele alınabilir)
  kgsVarMi: 0 | 1;
  pistUzmani: 0 | 1;
  // 2026-09-01 — Yakınsama'nın (kural istisnası, bkz. v5-engine.ts) İKİ YENİ bileşeni;
  // diğer üçü (pistUzmani/sireOrani/agfFark) zaten yukarıda/aşağıda var. yakinsama-gecmis.ts
  // ile (İSME göre, Karma hariç, sızıntısız) hesaplanır — canlı sunumla AYNI fonksiyon.
  sinifDususu: 0 | 1;
  ajiGalibiyetVarMi: 0 | 1;
  // 2026-09-01 kullanıcı talebi (ESENYIL vakası) — son idman türü Sprint/Sürat mi (Gallop.
  // track). Backtest yönü doğrulamadı (bkz. v5-engine.ts notu), yine de B-katmanı kural
  // istisnası olarak eklendi.
  sonIdmanSprint: 0 | 1;
  // Sinyal sözleşmesi: raw değer + gözlem bayrağı + eksik nedeni (eksik = 0 katkı, gerçek 0 ile karıştırılmaz)
  sinyalDurum?: Record<string, { observed: boolean; reason: string | null }>;
  sireOrani: number; // küçültülmüş (shrinkage), 0-100
  galop: 0 | 1;
  idmJokey: 0 | 1;
  galopSayisi: number; // son yarıştan bu yana toplam idman sayısı (sınırsız)
  uzunAraGalopKatkisi: number; // yalnız KGS>30 (uzun ara) olan atlarda galopSayisi, diğerlerinde 0
  jokeyOrani: number; // küçültülmüş
  antrenorOrani: number; // küçültülmüş
  kategori: string;
  breed: string;
  distance: number;
  surface: string;
  // 2026-08-16 kullanıcı geri bildirimi — "sürekli sürekli neden çekiyorsun, bir tam
  // liste çekip tüm testleri o listeden yapman işini kısaltır": getSonYarisDetaylariForRace
  // ZATEN her koşuda çağrılıyordu (yukarıda), ayniJokey/eklenenTaki/cikarilanTaki alanları
  // hesaplanıp ATILIYORDU. Artık kaydediliyor — YENİ TJK isteği GEREKTİRMİYOR, ileride bu
  // sinyallerle ilgili bir hipotez test edilmek istenirse ayrı backfill'e gerek kalmaz.
  ayniJokeySurekliligi: 0 | 1; // önceki YARIŞTA (idman değil) aynı jokey mi bindi
  takiEklendiMi: 0 | 1;
  takiCikarildiMi: 0 | 1;
  // 2026-08-16 — kacakAtMi ANLAMLI çıktı (bkz. arac-model-egit.mjs), Runner.raceStyle'dan
  // (Accurace tabanlı) TEK sorguda alınıyor, ekstra TJK isteği gerektirmiyor.
  kacakAtMi: 0 | 1;
  // 2026-08-26 — kacakAtMi'nin İÇİNDEKİ gerçek ayrım: sahada TEK kaçak-at bu mu (rakipsiz,
  // rahat kaçış — gerçek avantaj), yoksa birden fazla kaçak-attan biri mi (rekabetli tempo —
  // avantaj yok, bkz. arac-model-egit-segment.mjs üstündeki not). Sızıntı riski yok.
  kacakYalniz: 0 | 1;
  // 2026-08-17 — ham win-rate testinde anlamlıydı ama arac-model-egit.mjs'de diğer 18
  // özellikle BİRLİKTE test edilince anlamsız çıktı (confounding, bkz. o dosyadaki not) —
  // modele DAHİL EDİLMEDİ. Alan yine de toplanıyor (ekstra TJK isteği gerektirmiyor),
  // ileride farklı bir formülasyonla yeniden test edilmek istenirse hazır olsun diye.
  onGrupArkasiMi: 0 | 1;
  // 2026-08-17 — ham win-rate testinde anlamlıydı (%14.8 vs %10.1, GA [1.9,7.6]) ama
  // arac-model-egit.mjs'de diğer 18 özellikle BİRLİKTE test edilince anlamsız çıktı
  // (confounding, bkz. o dosyadaki not) — modele DAHİL EDİLMEDİ. Alan yine de toplanıyor.
  disaridanStart: 0 | 1;
  // 2026-08-17 — ham win-rate testinde çok güçlü anlamlıydı (korelasyon -0.164, GA
  // [-0.174,-0.154]) ama diğer 18 özellikle BİRLİKTE test edilince anlamsız çıktı
  // (confounding — AGF sırası + aygır/jokey/antrenör oranlarıyla örtüşüyor, bkz.
  // arac-model-egit.mjs'deki not) — modele DAHİL EDİLMEDİ. Alan yine de toplanıyor.
  hpSirasi: number;
  // 2026-08-19 — ham AGF payı (yüzde). arac-model-egit.mjs'de MODELE DAHİL (bkz. o
  // dosyadaki not) — agfFavorisiMi'nin yerini aldı.
  agfPayi: number;
  // Sahadaki 2.'ye göre dominans farkı (yalnız favori için sıfırdan farklı) — test
  // edildi, resmi eğitimde SINIRDA çıktı ve EL LEON vakasında dominant favoriyi
  // cezalandırdığı görülünce MODELDEN ÇIKARILDI (bkz. arac-model-egit.mjs'deki not).
  // Alan yine de toplanıyor, gelecekte farklı formülasyonla tekrar test edilebilir.
  agfFarkiIkinciye: number;
  // 2026-08-20 kullanıcı bulgusu: "galop"/"uzunAraGalopKatkisi" modelde neredeyse hiç
  // katkı vermiyordu (bootstrap GA sıfırı içeriyor) — sebep araştırıldı, iki aday bulundu
  // VE TEST EDİLDİ, İKİSİ DE REDDEDİLDİ:
  // (1) atların %47.8'inin hiç galop kaydı yoktu — meğer TJK'da varmış, yalnız sync-galop
  // cron'u yalnız bugün/yarın için çalıştığından geçmiş hiç taranmamış. Tam geriye dönük
  // tarama yapılıp kapsam %86'ya çıkarıldı (galopVerisiVarMi bu düzeltmeyi yansıtıyor).
  galopVerisiVarMi: 0 | 1;
  // (2) TJK'nın kendi "Şekil" alanı (ÇR/R rahat...Ç/HÇ çalışarak) hiç kullanılmıyordu —
  // "galop" (yalnız dereceye bakan) YERİNE, dereceyi HEM iyi/çok-iyi HEM rahat/çok-rahat
  // şekilde tamamlamış olmayı işaretleyen bu daha zengin versiyon denendi.
  // SONUÇ (2026-08-20, veri tamamen düzeltildikten SONRA resmi eğitimle test edildi):
  // ikisi de anlamsız çıktı — galopVerisiVarMi nokta=-0.0196 GA=[-0.1034,0.0944],
  // galopRahatVeIyi nokta=+0.0572 GA=[-0.0588,0.1595]. Aynı büyümüş veri setinde ADİL
  // kıyaslama (eski "galop" ile yeniden eğitim): eski top1=%35.4/top3=%71.6/logloss=1.7699
  // vs yeni top1=%34.1/top3=%71.2/logloss=1.7710 — üç metrikte de hafif kötü. Veri
  // eksikliği gerçekti ve düzeltildi ama düzeltilmiş veriyle bile "rahat/çalışarak" ayrımı
  // gerçek bir sinyal taşımıyor. MODELE DAHİL EDİLMEDİ — canlı model hâlâ eski "galop".
  galopRahatVeIyi: 0 | 1;
  // 2026-08-20 kullanıcı kontrol listesi — 3 yeni aday, HorseRaceHistoryCache/mevcut
  // jockeyStats'tan (ek TJK isteği gerektirmeden) toplanıyor:
  // (1) Bugünkü kilo, atın AYNI pistte en iyi derecesini (en düşük finishPos) aldığı
  // koşudaki kiloya göre kaç kg fark ediyor — pozitif=bugün daha ağır.
  kiloFarkiEnIyiKosuya: number;
  // (2) Bu at-jokey ikilisinin KENDİ geçmişi (jokeyOrani'nin genel jokey oranından farklı,
  // yalnız bu ikilinin birlikte kaç kez koşup kaçını kazandığı) — küçültülmüş (shrinkage).
  atJokeyIkiliOrani: number;
  // (3) Jokey değişmişse (jockeyChanged), yeni jokeyin genel oranı ESKİ jokeyin oranından
  // ne kadar YÜKSEK/DÜŞÜK — yön taşıyan bir "niyet" sinyali (üst jokeye geçiş vs alt
  // jokeye düşüş). Değişmemişse 0.
  //
  // SONUÇ (2026-08-20, resmi eğitim+B=200 bootstrap+backtest, üçü BİRDEN mevcut canlı
  // 18 özelliğe eklenerek test edildi): İLK denemede atJokeyIkiliOrani nokta=+1.13 —
  // diğer TÜM katsayıların (0.01-0.6 aralığı) 10-20 katı, eğitim top1 %43→%64'e fırladı
  // (aşırı öğrenme işareti). Kök neden bulundu: HorseRaceHistoryCache satırları TARİHE
  // göre filtrelenmemişti — bu koşudan SONRAKİ (bugüne kadarki TÜM) koşular da "geçmiş"
  // sayılıp sonucu sızdırıyordu (veri sızıntısı). Düzeltilip (yalnız kesinlikle önceki
  // tarihli kayıtlar) YENİDEN test edildi: atJokeyIkiliOrani normal boyuta döndü
  // (-0.0371, GA=[-0.1341,0.0497], anlamsız), kiloFarkiEnIyiKosuya da anlamsız
  // (-0.0362, GA=[-0.1367,0.0671]). Backtest: eski top1=%35.4/top3=%71.6/logloss=1.7699
  // vs yeni top1=%34.5/top3=%70.7/logloss=1.7753 — üç metrikte de hafif kötü.
  // jokeyDegisimYonu yalnız 54/9465 atta (%0.57) tetikleniyor — bootstrap'ta HER
  // örneklemde tam 0.0000 çıktı (GA=[0,0,0,0]), ama bu örneklem o kadar az ki güvenilir
  // bir "hayır" bile sayılamaz, yalnız "şu an test edilemeyecek kadar seyrek" demek
  // doğru. ÜÇÜ DE MODELE DAHİL EDİLMEDİ — canlı model değişmedi.
  jokeyDegisimYonu: number;
  // 2026-09-11 kullanıcı talebi ("eski ret gerekçesi artık geçersiz ama yeni bir kabul
  // gerekçesi de yok, kullanılmıyorsa kaldır") — kariyerStartSayisi alanı (2026-08-21'de
  // eklenmişti, sireOrani × "az deneyimli" etkileşimini test etmek için) KALDIRILDI. Son
  // Opus denetimi: üç segmentte de yön aynı (negatif) ve ikisinde anlamlı, logloss'ta da
  // gerçek iyileşme vardı — ama top1 kazancı hiçbir segmentte kanıtlanamadı, projenin
  // "Top1 Önceliği" kuralı barajı geçmiyor. Not: bu, "veriyi biriktir, ileride yeniden test
  // et" alışkanlığının (bkz. onGrupArkasiMi/disaridanStart gibi komşu alanlar) bilinçli bir
  // istisnası — kullanıcı kararıyla.
  // 2026-08-21 — H2H (baş-başa geçmiş karşılaşma) net skoru: bugünkü sahadaki rakiplerle
  // ortak geçmiş yarışlarda kaç kez önde bitirdi eksi kaç kez geride bitirdi. B=200
  // bootstrap'ta sınırda (GA=[-0.0105,0.1603]) ama backtest'te top1/top3 İKİSİ BİRDEN
  // iyileşti (logloss ihmal edilebilir kötüleşme) — kullanıcı kararıyla KABUL EDİLDİ.
  h2hNetSkor: number;
  // 2026-09-11 — Kilo-ayarlı H2H (v5-engine.ts'teki AYNI isimli canlı özellik/hesap ile
  // birebir): bugünkü rakiplere göre kilo pozisyonunun, geçmiş karşılaşmalardaki kilo
  // pozisyonuna göre NASIL DEĞİŞTİĞİ. Canlıda V5.30'dan beri BİLEREK sıfır ağırlıklı
  // (gerçek V5 sonuçlarında pooled kanıt replike olmadı) — bu alan yalnız artık GERÇEK
  // (daha önce sabit-sıfırdı) veri taşısın diye eklendi, canlı ağırlığı DEĞİŞTİRMİYOR.
  h2hKiloDegisimi: number;
  // 2026-08-21 (V5.4) — Hız derecesi: son 365 gündeki en yeni 3 koşunun popülasyon
  // (irk|pist|mesafe) ortalama tempo'suna göre göreli hızı (%). B=200 bootstrap'ta HER
  // İKİ segmentte de güçlü anlamlı (düşük-şart +0.58 — modelin en büyük katsayısı,
  // diğer +0.26), VIF=1.02-1.10 (hiçbir sinyalle çakışmıyor) — KABUL EDİLDİ.
  hizDerecesi: number;
  // 2026-08-22 kullanıcı bulgusu (ekran görüntüsü — "bugünkü şartlarda geçmiş kazananlar"
  // tablosu, HP bandına göre kazanma oranı gösteriyordu): hpSirasi (HP'ye göre SIRA) daha
  // önce test edilip reddedilmişti (bkz. yukarıdaki not, agfSirasi+sire/jokey/antrenor
  // oranıyla confounded çıkmıştı). Bu kez HAM HP DEĞERİ (sıra değil) deneniyor — saha
  // büyüklüğünden arındırılmış (lift=gözlenen/beklenen) ham analizde 0-15 HP bandı
  // beklenenin %24'ü, 48+ bandı %114'ü kadar kazanıyordu (n=32905), agfSirasi ile
  // korelasyon r=-0.314 (orta düzey, piyasa tam fiyatlamıyor). hpSirasi'nden FARKLI bir
  // encoding olduğu için ayrı test ediliyor. Veri yoksa (yapısal muaf: maiden/şartlı1/19/27)
  // 0 — "dusuksart" segmentinde ayırt edici olmayacağı ama zarar da vermeyeceği beklentisiyle.
  hpPuani: number;
  // 2026-08-28 kullanıcı talebi ("çime bak, artık çekilsin") — RaceDay.surfaceConditions
  // zaten ingest'te toplanıyordu ama Faz1/modele hiç aktarılmıyordu (bkz. mekanik-
  // puanlama.ts §VII, eski V1-V22 matrisinde "Göreli kilo/zemin" bileşeni için vardı,
  // V5'e hiç taşınmadı). GERÇEK bir backtest istendi ama denendi: 605 RaceDay'in
  // TAMAMI tarandı, "Çim" alanı yalnız 51 günde dolu ve bunların 48'i BİREBİR AYNI sabit
  // değer ("Normal 3,3") — yani şu ana kadar yalnız 3 GERÇEK farklı olay var (2× "Çok Ağır"
  // Temmuz, 1× "Yumuşak" bugün). n=3 ile istatistiksel bir sonuç çıkarmak (B=500 bootstrap
  // gerektiren diğer tüm sinyallerle tutarsız şekilde) yanlış-güven riski taşır — bu yüzden
  // MODELE (toFeatureVector) HENÜZ EKLENMEDİ. Yalnız ham değer (zeminKatsayisi() — mevcut,
  // canlıda kullanılmayan §VII fonksiyonu, 1.0/1.15/1.3) artık her koşu için kaydediliyor
  // ki kış yağmurlarında/ileride "Normal-dışı" gün sayısı yeterli örnekleme ulaşınca GERÇEK
  // bir B=500 testi yapılabilsin — geriye dönük backfill'e gerek kalmadan.
  zeminKatsayisi: number;
  // 2026-08-28 — Zemin Toleransı (bkz. Faz1RunnerV5.zeminToleransi, v5-engine.ts, aynı
  // isimli notun tamamı). B=500 testinde anlamsız çıktı ama kullanıcı kararıyla 23.
  // özellik olarak eklendi (kural istisnası).
  zeminToleransi: number;
  // 2026-09-01 — Yarış Gidişatı (bkz. pace-analizi.ts hesaplaYarisGidisati, kullanıcı
  // tasarımı): saha-geneli tempo senaryosu olasılıkları × atın kendi stil dağılımının
  // uyum matrisiyle ağırlıklı beklenen değeri × mesafe katsayısı. stilEgilimMap İLE AYNI
  // sızıntısız (accKayitlar, race.raceDay.date'ten KESİNLİKLE ÖNCEKİ) kaynaktan — yalnız
  // artık dagilim (4 stilin TAMAMI) + erkenHizGucu (saha-içi göreli, siblings'ten) da
  // hesaplanıyor. HENÜZ toFeatureVector'a eklenmedi — arac-model-egit-segment.mjs'de
  // B=500 bootstrap ile test edilecek, "yenilik önce backtest" kuralı gereği.
  yarisGidisatiSkoru: number;
  // 2026-09-11 kullanıcı tasarımı — "Tempo Taşıma Gücü": atın GEÇMİŞ Accurace
  // yarışlarındaki son 800m'de o yarışın en iyisine göre kalış farkının (saniye,
  // sızıntısız — tempo-tasima-gucu.actions.ts) ortalaması, işareti çevrilmiş (yüksek=iyi).
  // Bu oturumda GERÇEK backtest yapıldı (n=1424): kazanma oranı %18.8→%10.7→%6.2→%4.2
  // temiz ayrışıyor, yarisGidisatiSkoru ile korelasyon r=0.002 (bağımsız). AGF ile orta
  // düzey korele (r=-0.277) ama yarisGidisatiSkoru'nun HER diliminde ayrışma sürüyor —
  // bkz. proje hafızası: project_accurace_tempo_yarisgidisati.md. arac-model-egit-
  // segment.mjs'de B=500 bootstrap ile segment bazlı test edilecek, "yenilik önce
  // backtest" kuralı gereği HENÜZ toFeatureVector'a eklenmedi.
  tempoTasimaGucu: number;
  // 2026-09-12 (V5.46 denetimi) — Zemin+Mesafe Deneyimi (bkz. zemin-mesafe-deneyimi.actions.ts,
  // v5-engine.ts'teki bKatmaniUygula) CANLI skora zaten ekleniyordu (softmax'tan önce, ayrı
  // mekanizma — toFeatureVector'a GİRMİYOR) ama bu alan burada HİÇ hesaplanmıyordu (39877/
  // 39877 satırda sabit 0) — yani gerçek para etkileyen bir sinyal hiç test edilememişti.
  // Düzeltildi, leak-free (v5-engine.ts'teki AYNI hesaplaZeminMesafeDeneyimiMap). GERÇEK
  // backtest (B=500 bootstrap FARK testi, mevcut production ağırlıklarıyla AÇIK/KAPALI
  // kıyası): "diğer"de top3 anlamlı iyileşme (+0.53pp, GA=[0.11,1.05]), düşük-şart'ta
  // sınırda pozitif (+0.59pp, GA=[0.00,1.76]), top1'de HİÇBİR SEGMENTTE kayıp yok (0.00pp)
  // — sinyal GERÇEKTEN doğrulandı, KORUNDU, kodda değişiklik gerekmedi.
  zeminMesafeDeneyim: number;
};

async function main() {
  const races = await db.race.findMany({
    where: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } } },
    select: {
      id: true, classType: true, breed: true, distance: true, surface: true, ikramiyeDetay: true,
      raceDay: { select: { date: true, surfaceConditions: true } },
      result: { select: { actualOrder: true, winnerNo: true, winnerNos: true } },
      runners: {
        where: { scratched: false },
        // 2026-08-31 — raceStyle artık BURADAN çekilmiyor (sızıntılıydı, bkz. aşağıdaki
        // stilEgilimMap notu) — kaldırıldı, yerine ham Accurace checkpoint verisinden
        // sızıntısız yeniden hesaplanıyor.
        select: { id: true, no: true, name: true, jockey: true, trainer: true, sire: true, agf: true, recentForm: true, disaridanStart: true, hp: true, tjkAtId: true, previousJockey: true, jockeyChanged: true, weight: true, ekuriGroup: true },
      },
    },
    orderBy: { raceDay: { date: "asc" } },
  });
  console.log(`Toplam koşu (Karma hariç): ${races.length}`);

  const rows: ModelRow[] = existsSync(CACHE_PATH) ? JSON.parse(readFileSync(CACHE_PATH, "utf-8")) : [];
  const islenmisRaceIdleri = new Set(rows.map((r) => r.raceId));
  console.log(`Önbellekte hâlihazırda ${rows.length} at satırı (${islenmisRaceIdleri.size} koşu) var.`);
  const yeniRaces = races.filter((r) => !islenmisRaceIdleri.has(r.id));
  console.log(`Yeni işlenecek koşu: ${yeniRaces.length}`);
  if (yeniRaces.length === 0) { console.log("Güncel."); await db.$disconnect(); return; }

  // Jokey/antrenör popülasyon ortalaması (shrinkage priоru için) — tüm sync tablosundan
  const jockeyPopOrt = 0.10; // TJK genel jokey kazanma oranı kabaca %8-12 bandında; kesin değeri aşağıda hesaplanacak
  const trainerPopOrt = 0.10;

  // 2026-08-21 kullanıcı bulgusu (literatür araştırması + MR TT vakası): sireOrani
  // ÖNCEDEN her zaman GÜNCEL (bugüne kadarki) toplu tablodan (SireStatOwn —
  // syncOwnPedigreeStats cron'u GÜNLÜK, TARİH FİLTRESİ OLMADAN tüm geçmişi yeniden
  // hesaplıyor) okunuyordu. CANLI tahmin için doğru (bugünün koşusu bugüne kadarki
  // kariyeri bilmeli) ama EĞİTİM için gerçek bir sızıntı — Temmuz'daki bir koşu, Ağustos'taki
  // sonuçları da "biliyordu" (bkz. atJokeyIkiliOrani'nde bulunan AYNI sınıf hata, yukarıki
  // not). Şimdi kendi Runner/Result verimizden, YALNIZ o koşudan KESİNLİKLE ÖNCEKİ
  // tarihli kayıtlarla — TEK seferlik büyük bir geçmiş yükleyip (irk|pist|mesafe|isim)
  // anahtarıyla indeksliyoruz, per-koşu filtre O(grup büyüklüğü) kalıyor.
  //
  // jokeyOrani/antrenorOrani için AYNI düzeltme İLK denemede yapılmış, ama SONUÇLARI
  // KARIŞIK çıkmıştı: bunlar TJK'nın yıllarca birikmiş resmi (JockeyStatSync/
  // TrainerStatSync) kaynağından geliyordu — kendi verimize (yalnız ~7 haftalık) çevirmek
  // hem sızıntıyı düzeltiyor HEM örneklemi çok küçültüyordu, ikisi ayrıştırılamadı. Kullanıcı
  // kararı (2026-08-21): yalnız sireOrani düzeltilsin (temiz, tek-etkenli test için),
  // jokeyOrani/antrenorOrani TJK'nın güvenilir uzun-vadeli kaynağına GERİ alındı (aşağıda).
  console.log("Tarihe-duyarlı aygır geçmişi yükleniyor...");
  const tumGecmisRunnerlar = await db.runner.findMany({
    where: { scratched: false, sire: { not: null }, race: { result: { isNot: null } } },
    select: {
      sire: true, no: true,
      race: {
        select: {
          breed: true, surface: true, distance: true,
          raceDay: { select: { date: true } },
          result: { select: { actualOrder: true, winnerNos: true } },
        },
      },
    },
  });
  console.log(`Geçmiş havuzu: ${tumGecmisRunnerlar.length} at satırı`);

  type GecmisNokta = { tarih: Date; pos: number | null };
  const sireIndex = new Map<string, GecmisNokta[]>();
  for (const r of tumGecmisRunnerlar) {
    if (!r.race.result || !r.sire) continue;
    const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
    const tarih = r.race.raceDay.date;
    const key = `${breedToIrk(r.race.breed)}|${surfaceToPist(r.race.surface)}|${mesafeBucket(r.race.distance)}|${normalizeSireName(r.sire)}`;
    const arr = sireIndex.get(key) ?? [];
    arr.push({ tarih, pos });
    sireIndex.set(key, arr);
  }

  /** Verilen indeks anahtarında, YALNIZ cutoffTarih'ten KESİNLİKLE ÖNCEKİ kayıtlarla
   *  start/galibiyet sayısı — sızıntısız. */
  function tarihliOranHesapla(index: Map<string, GecmisNokta[]>, key: string, cutoffTarih: Date): { start: number; wins: number } {
    const arr = index.get(key);
    if (!arr) return { start: 0, wins: 0 };
    let start = 0, wins = 0;
    for (const g of arr) {
      if (g.tarih.getTime() >= cutoffTarih.getTime()) continue;
      start++;
      if (g.pos === 1) wins++;
    }
    return { start, wins };
  }

  // 2026-08-21 (V5.4) — hizDerecesi: TJK "At Koşu Bilgileri"ndeki "süre" alanı AT-BAZLI
  // (kendi bitiriş süresi, "1.16.30"). Popülasyon (irk|pist|mesafe kovası) ortalama
  // tempo'suna göre göreli hız — B=200 bootstrap'ta HER İKİ segmentte de güçlü anlamlı
  // (düşük-şart +0.58 — modelin en büyük katsayısı, diğer +0.26), VIF=1.02-1.10 (çakışma
  // yok). Yalnız son 365 GÜN içindeki koşular "güncel form" sayılır (bkz. kullanıcı
  // bulgusu: uzun aradan dönen bir atın yıllar önceki "en iyi dönemi" güncelmiş gibi
  // kullanılmasın). sireIndex ile AYNI desen: tek seferlik büyük yükleme + indeksleme.
  console.log("Hız derecesi için pace indeksi yükleniyor...");
  // 2026-08-31 düzeltmesi: eskiden burada HER "start" (Runner satırı) için atın TÜM
  // geçmişi tekrar tekrar popülasyona ekleniyordu (çok start yapan atlar orantısız
  // ağırlıklandırılıyordu) — artık `distinct` ile her at TAM OLARAK BİR KEZ işleniyor,
  // hesaplama çekirdeği de canlı sunumla (hiz-derecesi.actions.ts) paylaşılan
  // hiz-derecesi-hesapla.ts'e taşındı (train/serve uyumsuzluğu kökten çözüldü).
  const paceAtIrkKayitlari = await db.runner.findMany({
    where: { scratched: false, tjkAtId: { not: null } },
    select: { tjkAtId: true, race: { select: { breed: true } } },
    distinct: ["tjkAtId"],
  });
  const paceIrkByTjkAtId = new Map(paceAtIrkKayitlari.map((r) => [r.tjkAtId!, breedToIrk(r.race.breed)]));
  const paceTjkAtIdler = [...paceIrkByTjkAtId.keys()];
  const paceGecmisKayitlari: { tjkAtId: number; rowsJson: unknown }[] = [];
  const PACE_CH = 500;
  for (let i = 0; i < paceTjkAtIdler.length; i += PACE_CH) {
    const dilim = paceTjkAtIdler.slice(i, i + PACE_CH);
    const rows = await db.horseRaceHistoryCache.findMany({ where: { tjkAtId: { in: dilim } }, select: { tjkAtId: true, rowsJson: true } });
    paceGecmisKayitlari.push(...rows);
  }
  const paceGecmisByTjkAtId = new Map(paceGecmisKayitlari.map((g) => [g.tjkAtId, g.rowsJson as HizGecmisSatir[]]));
  const paceIndex = hizPaceIndexKur(paceGecmisByTjkAtId, paceIrkByTjkAtId);
  console.log(`Pace indeksi: ${paceIndex.size} kova (${paceTjkAtIdler.length} at)`);

  function hizDerecesiHesapla(tjkAtId: number | null, raceBreed: string, cutoff: Date): { v: number; obs: boolean; reason: string | null } {
    if (tjkAtId == null) return { v: 0, obs: false, reason: "NO_TJK_ID" };
    const gecmis = paceGecmisByTjkAtId.get(tjkAtId) ?? [];
    if (gecmis.length === 0) return { v: 0, obs: false, reason: "NO_PRIOR_RUN" };
    return { v: hizDerecesiHesaplaOrtak(gecmis, breedToIrk(raceBreed), cutoff, paceIndex), obs: true, reason: null };
  }

  let processed = 0, failed = 0, timedOut = 0;
  const CONCURRENCY = 3;
  const startTime = Date.now();

  for (let i = 0; i < yeniRaces.length; i += CONCURRENCY) {
    const batch = yeniRaces.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (race) => {
        try {
          await withTimeout((async () => {
            const kategori = kategoriTespit(race.classType);
            const runners = race.runners;

            // Conditional-logit için en az iki alternatif gerekir.
            if (runners.length < 2) {
              console.warn(
                `[RACE-SKIP] raceId=${race.id} sebep=RUNNER_LT_2 runners=${runners.length}`
              );
              return;
            }

            const runnerNoSet = new Set(runners.map((rr) => rr.no));

            // Result.actualOrder tarihsel kayıtlarda farklı formatlarda olabilir:
            // [3,1,2]
            // ["3","1","2"]
            // ["5 AT ADI"]
            // ["5 AT ADI","3 DIGER AT"]
            const rawOrder = Array.isArray(race.result?.actualOrder)
              ? (race.result.actualOrder as unknown[])
              : [];

            const orderNos = [...new Set(
              rawOrder
                .map((x) => {
                  if (typeof x === "number" && Number.isFinite(x)) return x;

                  const m = String(x ?? "")
                    .trim()
                    .match(/^(\d+)/);

                  return m ? Number(m[1]) : null;
                })
                .filter((x): x is number => x != null)
            )].filter((no) => runnerNoSet.has(no));

            // Dead-heat mevcut tek-kazanan conditional-logit eğitim
            // hedefiyle uyumlu değil; yanlış negatif üretmemek için dışla.
            const dbWinnerNos = (race.result?.winnerNos ?? [])
              .filter((no) => Number.isFinite(no));

            if (dbWinnerNos.length > 1) {
              console.warn(
                `[RACE-SKIP] raceId=${race.id} sebep=DEAD_HEAT winnerNos=${JSON.stringify(dbWinnerNos)}`
              );
              return;
            }

            // Öncelik:
            // 1) winnerNo
            // 2) winnerNos[0]
            // 3) normalize edilmiş actualOrder[0]
            const winnerNo =
              race.result?.winnerNo ??
              dbWinnerNos[0] ??
              orderNos[0] ??
              null;

            if (winnerNo == null) {
              console.warn(
                `[RACE-SKIP] raceId=${race.id} sebep=NO_WINNER actualOrder=${JSON.stringify(rawOrder)}`
              );
              return;
            }

            if (!runnerNoSet.has(winnerNo)) {
              console.warn(
                `[RACE-SKIP] raceId=${race.id} sebep=WINNER_NOT_IN_FIELD winnerNo=${winnerNo}`
              );
              return;
            }

            const tjkAtIdler = runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);

            const [sonYarisDetaylari, jockeyStats, trainerStats, accKayitlar, agfSnaps, gecmisKayitlari, zeminToleransiMap, tempoTasimaGucuMap, yakinsamaGecmis] = await Promise.all([
              getSonYarisDetaylariForRace(race.id).catch(() => []),
              getJockeyStats([
                ...new Set([
                  ...runners.map((r) => r.jockey).filter((x): x is string => !!x),
                  ...runners.map((r) => r.previousJockey).filter((x): x is string => !!x),
                ]),
              ]).catch(() => ({})),
              getTrainerStats([...new Set(runners.map((r) => r.trainer).filter((x): x is string => !!x))]).catch(() => ({})),
              fetchAccuraceGecmisKayitlari(runners.map((r) => r.name), race.raceDay.date),
              db.agfSnapshot.findMany({
                where: { runnerId: { in: runners.map((r) => r.id) } },
                orderBy: { capturedAt: "asc" },
                select: { runnerId: true, agf: true },
              }),
              // 2026-08-20 kullanıcı talebi — "kilo-derece ilişkisi" ve "at-jokey ikili
              // oranı" için: TJK'nın "At Koşu Bilgileri" tam geçmişi (weight/finishPos/
              // jockey/surface per geçmiş koşu), tjkAtId'ye göre önbellekten.
              tjkAtIdler.length > 0
                ? db.horseRaceHistoryCache.findMany({
                    where: { tjkAtId: { in: tjkAtIdler } },
                    select: { tjkAtId: true, rowsJson: true },
                  })
                : Promise.resolve([]),
              // 2026-08-28 — Zemin Toleransı (bkz. ModelRow.zeminKatsayisi üstündeki not,
              // ve Faz1RunnerV5.zeminToleransi, v5-engine.ts). Aynı hesaplaZeminToleransiMap
              // (TjkDereceKaydi, leak-free) fonksiyonu reuse ediliyor.
              hesaplaZeminToleransiMap(runners.map((r) => r.name), race.raceDay.date).catch(() => new Map<string, number>()),
              // 2026-09-11 — Tempo Taşıma Gücü (bkz. ModelRow.tempoTasimaGucu notu,
              // tempo-tasima-gucu.actions.ts). Aynı sızıntısız desen: atAdi eşleştirme,
              // race.raceDay.date'ten KESİNLİKLE ÖNCEKİ Accurace geçmişi.
              hesaplaTempoTasimaGucuMap(runners.map((r) => r.name), race.raceDay.date).catch(() => new Map<string, number>()),
              // 2026-09-01 — Yakınsama (kural istisnası, bkz. v5-engine.ts'teki Faz1RunnerV5.
              // yakinsama2Plus notu): sınıf düşüşü + at-jokey ikilisi bileşenleri, CANLI
              // sunumla (v5-engine.ts) AYNI paylaşılan fonksiyondan — train/serve uyumsuzluğu
              // (hızDerecesi dersi) bir daha yaşanmasın diye.
              yakinsamaGecmisHesapla(
                db,
                runners.map((r) => ({ no: r.no, name: r.name, jockey: r.jockey })),
                race.raceDay.date,
                (race.ikramiyeDetay as { ikramiye?: number[] } | null)?.ikramiye?.[0] ?? null
              ).catch(() => new Map<number, { sinifDususu: boolean; ajiGalibiyetVarMi: boolean }>()),
            ]);
            const gecmisByTjkAtId = new Map(gecmisKayitlari.map((g) => [g.tjkAtId, g.rowsJson as unknown as { finishPos: string; weight: string; jockey: string; surface: string; date: string; raceNo: string; city: string }[]]));

            // H2H (baş-başa geçmiş karşılaşma) — 2026-08-21 kullanıcı talebi: V1-V22'de
            // vardı, V5'in yeniden inşasında hiç dahil edilmemişti. getH2HForRace ile AYNI
            // mantık (tarih+şehir+koşu_no anahtarıyla ortak geçmiş yarış eşleştirme) ama
            // zaten toplu çekilmiş gecmisByTjkAtId'den — ekstra sorgu YOK, verimli.
            const raceNameToNo = new Map(runners.map((r) => [r.name, r.no]));
            // 2026-10-07 — v5-engine.ts'teki H2H zemin-önceliği (2026-08-30) BURAYA parity
            // için taşındı: bugünün zeminiyle eşleşen karşılaşmalar varsa YALNIZ onlar
            // kullanılır, yoksa TÜM karşılaşmalara dönülür. Sentetik için null="Normal" (1.0)
            // — v5-engine.ts'teki AYNI 2026-09-13 düzeltmesi.
            const bugunZeminDetayH2H = zeminDetayiBul(race.raceDay.surfaceConditions as { label: string; detail: string }[] | null, race.surface);
            const bugunZeminKatsayiH2H = bugunZeminDetayH2H
              ? zeminKatsayisi(bugunZeminDetayH2H).katsayi
              : race.surface === "SENTETIK" ? 1.0 : null;
            const h2hByAnahtar = new Map<string, { horseName: string; pos: number; weight: string | null }[]>();
            const h2hZeminByAnahtar = new Map<string, number | null>();
            for (const r of runners) {
              if (r.tjkAtId == null) continue;
              const gecmisTumu = gecmisByTjkAtId.get(r.tjkAtId) ?? [];
              for (const g of gecmisTumu) {
                const t = parseGecmisTarih(g.date);
                if (t == null || !(t < race.raceDay.date)) continue;
                if (!g.raceNo || !g.city) continue;
                const pos = parseInt(g.finishPos, 10);
                if (isNaN(pos)) continue;
                const anahtar = `${g.date}|${g.city}|${g.raceNo}`;
                const arr = h2hByAnahtar.get(anahtar) ?? [];
                if (!arr.some((e) => e.horseName === r.name)) arr.push({ horseName: r.name, pos, weight: g.weight ?? null });
                h2hByAnahtar.set(anahtar, arr);
                if (!h2hZeminByAnahtar.has(anahtar)) h2hZeminByAnahtar.set(anahtar, zeminKatsayisi(zeminDetayiSatirdanCikar(g.surface)).katsayi);
              }
            }
            const h2hZeminEslesenAnahtarlar = bugunZeminKatsayiH2H != null
              ? new Set([...h2hZeminByAnahtar.entries()].filter(([, k]) => k === bugunZeminKatsayiH2H).map(([a]) => a))
              : new Set<string>();
            function h2hNetSkorHesapla(kendiAd: string): { v: number; obs: boolean; reason: string | null } {
              const anahtarlar = h2hZeminEslesenAnahtarlar.size > 0 ? h2hZeminEslesenAnahtarlar : new Set(h2hByAnahtar.keys());
              let skor = 0, karsilastirma = 0;
              for (const anahtar of anahtarlar) {
                const arr = h2hByAnahtar.get(anahtar);
                if (!arr || arr.length < 2) continue;
                const beni = arr.find((e) => e.horseName === kendiAd);
                if (!beni) continue;
                for (const other of arr) {
                  if (other.horseName === kendiAd) continue;
                  if (!raceNameToNo.has(other.horseName)) continue;
                  karsilastirma++;
                  skor += beni.pos < other.pos ? 1 : beni.pos > other.pos ? -1 : 0;
                }
              }
              // Ortak yarış yoksa eksik (raw=null); ortak yarış var ve denge 0 ise gerçek 0 (observed=true)
              return karsilastirma > 0 ? { v: skor, obs: true, reason: null } : { v: 0, obs: false, reason: "NO_H2H_PAIR" };
            }

            // 2026-09-11 kullanıcı talebi ("h2hKiloDegisimi tamamen ölü, düzelt") — Opus
            // B=500 denetimi bu alanın arac-model-veri-olustur.mts'te HİÇ hesaplanmadığını
            // (0/12311 satır) buldu: v5-engine.ts'in CANLI hesabı (h2hKiloDegisimiHesapla,
            // bkz. o dosyadaki aynı isimli fonksiyon) zaten çalışıyor ve doğru, yalnız
            // EĞİTİM verisi hep sabit sıfırdı. Canlı ağırlık zaten V5.30'dan beri BİLEREK
            // sıfırlanmış durumda (o zamanki pooled kanıt gerçek V5 sonuçlarında replike
            // olmadı) — bu düzeltme O ağırlığı DEĞİŞTİRMİYOR, yalnız gelecekte bu sinyal
            // yeniden test edilmek istendiğinde artık GERÇEK (sabit-sıfır değil) veri
            // kullanılabilsin diye. h2hByAnahtar zaten ağırlık (weight) taşıyor (yukarıya
            // bakınız) — v5-engine.ts'teki AYNI mantık (bugünkü kilo farkı - geçmiş kilo
            // farkı, rakip bazında toplanır) burada da uygulanıyor.
            const bugunKiloByNo = new Map(runners.map((r) => [r.no, r.weight]));
            function h2hKiloDegisimiHesapla(kendiAd: string, kendiBugunKilo: number | null): number {
              if (kendiBugunKilo == null) return 0;
              let toplam = 0;
              for (const arr of h2hByAnahtar.values()) {
                const beni = arr.find((e) => e.horseName === kendiAd);
                if (!beni) continue;
                const kendiOKilo = parseKiloSayi(beni.weight);
                if (kendiOKilo == null) continue;
                for (const other of arr) {
                  if (other.horseName === kendiAd) continue;
                  const otherNo = raceNameToNo.get(other.horseName);
                  if (otherNo == null) continue;
                  const otherOKilo = parseKiloSayi(other.weight);
                  if (otherOKilo == null) continue;
                  const otherBugunKilo = bugunKiloByNo.get(otherNo);
                  if (otherBugunKilo == null) continue;
                  const todayAdvantage = otherBugunKilo - kendiBugunKilo;
                  const histAdvantage = otherOKilo - kendiOKilo;
                  toplam += todayAdvantage - histAdvantage;
                }
              }
              return toplam;
            }

            // galop verisi
            const gallops = await db.gallop.findMany({
              where: { runnerId: { in: runners.map((r) => r.id) } },
              orderBy: { date: "desc" },
              select: { runnerId: true, date: true, jockey: true, splits: true, form: true, track: true },
            });
            const gallopsByRunner = new Map<string, typeof gallops>();
            for (const g of gallops) {
              const arr = gallopsByRunner.get(g.runnerId) ?? [];
              arr.push(g);
              gallopsByRunner.set(g.runnerId, arr);
            }

            const ilkAgfByRunner = new Map<string, number>();
            for (const s of agfSnaps) {
              if (!ilkAgfByRunner.has(s.runnerId)) ilkAgfByRunner.set(s.runnerId, s.agf);
            }

            const sonYarisByNo = new Map(sonYarisDetaylari.map((d) => [d.runnerNo, d]));
            const accuraceMap = hesaplaAccuraceSonYarisEnHizliKapanisMap(
              runners.map((r) => r.name), accKayitlar.son800AccuraceKayitlari, accKayitlar.son800Siblings
            );
            // 2026-10-07 — paylasilan hesap (bkz. agf-sirasi.ts) — train/live parity icin TEK kaynak.
            // ONCEKI (basit, ekuri-farkinda OLMAYAN) siralama V5.46.1 parity denetiminde yakalandi:
            // canli v5-engine.ts 2026-08-30da ekuri-toplu sess rank bug-fixini almisti, bu dosya almamisti.
            const agfSiraMap = hesaplaAgfSirasi(runners.map((r) => ({ id: r.id, agf: r.agf, ekuriGroup: r.ekuriGroup })));
            // birinciAgf/ikinciAgf İÇİN (agfSirasi'nden AYRI amaç): bireysel AGF'ye göre ham sıralama.
            const agfSirali = [...runners].filter((r) => r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
            // 2026-08-19 kullanıcı bulgusu (BODUBEY/EL LEON) — agfSirasi yalnız SIRAYI
            // yakalıyor, AGF payının BÜYÜKLÜĞÜNÜ değil (LEJUR %47 ile EL LEON %22 aynı
            // "favori" etiketini alıyordu). Ham pay + sahadaki 2.'ye göre dominans farkı.
            const birinciAgf = agfSirali[0]?.agf ?? null;
            const ikinciAgf = agfSirali[1]?.agf ?? null;
            // 2026-08-17 kullanıcı talebi — hiç kullanılmayan HP (resmi handikap puanı)
            // alanı test ediliyor. agfSirasi ile AYNI desen: sahadaki HP'ye göre sıra
            // (yüksek HP = 1.sıra), veri yoksa saha ortası.
            const hpSirali = [...runners].filter((r) => r.hp != null).sort((a, b) => (b.hp ?? 0) - (a.hp ?? 0));
            const hpSiraMap = new Map(hpSirali.map((r, i2) => [r.id, i2 + 1]));

            // 2026-08-31 BUG DÜZELTMESİ (Opus denetimi): Runner.raceStyle DB alanı tarih
            // filtresi OLMADAN (atın TÜM Accurace kayıtlarından, bu yarışın kendisi ve
            // SONRASI dahil) hesaplanıyor — eğitim verisine sızıntı taşıyordu (canlı
            // serving ayrı, sızıntısız bir hesap kullanıyordu, klasik train/serve
            // uyumsuzluğu). Düzeltme: veri-toplama.ts'teki accuraceEgilimMap İLE AYNI
            // desen — accKayitlar (YUKARIDA zaten fetchAccuraceGecmisKayitlari ile
            // race.raceDay.date'ten KESİNLİKLE ÖNCEKİ kayıtlarla sızıntısız çekilmişti,
            // bkz. o fonksiyonun `accuraceRace.date < raceDate` filtresi) BURADA yeniden
            // kullanılarak her at için stil eğilimi sıfırdan, sızıntısız hesaplanıyor.
            const siblingSayisiMap = new Map<string, number>();
            for (const s of accKayitlar.son800Siblings) {
              siblingSayisiMap.set(s.accuraceRaceId, (siblingSayisiMap.get(s.accuraceRaceId) ?? 0) + 1);
            }
            // Yarış Gidişatı (2026-09-01) — erkenHizGucu SAHA-İÇİ göreli olmak zorunda (bkz.
            // pace-analizi.ts yorumu), o yüzden her geçmiş accuraceRaceId için TÜM siblings'in
            // ilkYariOrtHiz'ini önceden hesaplıyoruz — son800Siblings isimsiz döndüğü için
            // (fetchAccuraceGecmisKayitlari, leak-free sorgu) self'i değer eşitliğiyle aramak
            // yerine hesaplaYuzdelikSelfVsSiblings ile analitik sıra hesaplanıyor (bkz. o
            // fonksiyonun dosya başı notu).
            const ilkYariHizByRaceId = new Map<string, number[]>();
            for (const s of accKayitlar.son800Siblings) {
              const sonuc = analizEtTekYaris(
                s.checkpoints as unknown as PaceCheckpoint[],
                s.accuraceRace.length ?? 0,
                siblingSayisiMap.get(s.accuraceRaceId) ?? 0
              );
              if (!sonuc) continue;
              const arr = ilkYariHizByRaceId.get(s.accuraceRaceId) ?? [];
              arr.push(sonuc.ilkYariOrtHiz);
              ilkYariHizByRaceId.set(s.accuraceRaceId, arr);
            }
            const stilEgilimMap = new Map<string, ReturnType<typeof hesaplaCokYarisEgilimi>>();
            for (const rr of runners) {
              const norm = normalizeHorseName(rr.name);
              const kayitlar = accKayitlar.son800AccuraceKayitlari.filter((k) => normalizeHorseName(k.horseName) === norm);
              const sonuclar: NonNullable<ReturnType<typeof analizEtTekYaris>>[] = [];
              const yuzdelikler: (number | null)[] = [];
              for (const k of kayitlar) {
                const sonuc = analizEtTekYaris(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0, siblingSayisiMap.get(k.accuraceRaceId) ?? 0);
                if (!sonuc) continue;
                sonuclar.push(sonuc);
                const saha = ilkYariHizByRaceId.get(k.accuraceRaceId);
                yuzdelikler.push(saha ? hesaplaYuzdelikSelfVsSiblings(sonuc.ilkYariOrtHiz, saha) : null);
              }
              stilEgilimMap.set(rr.id, hesaplaCokYarisEgilimi(sonuclar, yuzdelikler));
            }
            // Saha-geneli Yarış Gidişatı — sızıntısız stilEgilimMap'ten TEK pipeline çağrısı,
            // runners ile AYNI SIRADA profil listesi. Kacak sayımı/yakınsama gibi bu koşunun
            // KENDİ kompozisyonuna bakıyor (sızıntı riski yok — bugünün sahası zaten bilinen
            // bir şey, bkz. aşağıdaki kacakSayisiSahada notu).
            const tempoProfilleri: (AtTempoProfili | null)[] = runners.map((rr) => {
              const egilim = stilEgilimMap.get(rr.id);
              return egilim ? { dagilim: egilim.dagilim, erkenHizGucu: egilim.erkenHizGucu, n: egilim.n } : null;
            });
            // 2026-09-11 (V5.45) — tempoTasimaGucuMap artık AYRI özellik değil, buradan
            // yarisGidisatiSkoru'nun İÇİNE (zorluk-ağırlıklı) giriyor — bkz. v5-engine.ts'teki
            // AYNI değişiklik ve pace-analizi.ts'teki tempoZorlukAgirligi notu.
            const tempoTasimaListesi = runners.map((rr) => tempoTasimaGucuMap.get(rr.name) ?? null);
            const gidisatSonucu = hesaplaYarisGidisati(tempoProfilleri, race.distance, tempoTasimaListesi);
            const gidisatByRunnerId = new Map(runners.map((rr, i) => [rr.id, gidisatSonucu.atSonuclari[i]]));

            // 2026-08-26 kullanıcı bulgusu: kacakAtMi tek parça sinyali aslında iki farklı
            // şeyi karıştırıyordu — RAKİPSİZ kaçak olmak (uzun süre yalnız önde, rahat kaçış)
            // gerçek bir avantaj, RAKİPLİ kaçak olmak (birden fazla at öne geçmeye çalışıyor,
            // tempo yükseliyor) değil. Derinlemesine backtest (saha büyüklüğü sabit tutularak
            // kontrol edilmiş, deneyimsiz atlarda bile split-half tutarlı +12-14 puan fark)
            // düşük-şart segmentinde anlamlı (nokta=+0.145, GA=[0.031,0.266]) bulundu —
            // AMA bu backtest de sızıntılı raceStyle alanıyla yapılmıştı, yeniden eğitimle
            // birlikte doğruluğu yeniden sınanacak. Sızıntı riski (kompozisyon açısından)
            // yok — bugünkü sahanın kompozisyonu zaten önceden bilinen bir şey; sızıntı
            // yalnız HER ATIN KENDİ geçmiş eğilimi hesaplanırken vardı, o da yukarıda
            // düzeltildi.
            const kacakSayisiSahada = runners.filter(
              (rr) => stilEgilimMap.get(rr.id)?.stil === "KACAK_AT"
            ).length;

            const zeminDetayi = zeminDetayiBul(
              race.raceDay.surfaceConditions as { label: string; detail: string }[] | null,
              race.surface
            );
            const zeminKatsayisiDeger = zeminKatsayisi(zeminDetayi).katsayi;
            // 2026-09-12 — Zemin+Mesafe Deneyimi (bkz. ModelRow.zeminMesafeDeneyim üstündeki
            // not): v5-engine.ts'teki AYNI nullable hesap (zeminDetayi bilinmiyorsa null,
            // zeminKatsayisiDeger'in varsayılan-1.0 davranışından FARKLI — fonksiyon zemin
            // bilinmediğinde nötr sonuç döner).
            const bugunZeminKatsayiNullable = zeminDetayi ? zeminKatsayisi(zeminDetayi).katsayi : null;
            const zeminMesafeDeneyimMap = await hesaplaZeminMesafeDeneyimiMap(
              runners.map((rr) => rr.name),
              race.raceDay.date,
              surfaceToPist(race.surface),
              bugunZeminKatsayiNullable,
              race.distance
            ).catch(() => new Map<string, { deger: number }>());

            for (const r of runners) {
              const win: 0 | 1 = r.no === winnerNo ? 1 : 0;

              // Top3 ancak resmi sıra ilk 3'ü gerçekten kapsıyorsa gözlemlenmiştir.
              const top3Observed =
                orderNos.length >= Math.min(3, runners.length);

              const top3: 0 | 1 =
                top3Observed && orderNos.slice(0, 3).includes(r.no)
                  ? 1
                  : 0;
              const sonYaris = sonYarisByNo.get(r.no);
              const jockeyStat = r.jockey ? (jockeyStats as any)[r.jockey] : undefined;
              const trainerStat = r.trainer ? (trainerStats as any)[r.trainer] : undefined;

              const ilkAgf = ilkAgfByRunner.get(r.id);
              const agfFark = ilkAgf != null && r.agf != null ? r.agf - ilkAgf : 0;

              // (1) Kilo farkı — atın AYNI pistteki en iyi (en düşük finishPos) geçmiş
              // koşusundaki kiloya göre bugün kaç kg fark ediyor. YALNIZ bu koşudan
              // KESİNLİKLE ÖNCEKİ tarihli kayıtlar — aksi hâlde gelecekteki koşular
              // "geçmiş" sayılıp sonucu sızdırır (bkz. yukarıdaki parseGecmisTarih notu).
              const gecmisTumu = r.tjkAtId != null ? (gecmisByTjkAtId.get(r.tjkAtId) ?? []) : [];
              const gecmis = gecmisTumu.filter((g) => {
                const t = parseGecmisTarih(g.date);
                return t != null && t < race.raceDay.date;
              });
              const ayniPistGecmis = gecmis.filter((g) => surfaceFromRaw(g.surface) === race.surface && parseKiloSayi(g.weight) != null && /^\d+$/.test(g.finishPos ?? ""));
              let enIyiKosu: (typeof ayniPistGecmis)[number] | null = null;
              for (const g of ayniPistGecmis) {
                if (!enIyiKosu || parseInt(g.finishPos, 10) < parseInt(enIyiKosu.finishPos, 10)) enIyiKosu = g;
              }
              const enIyiKilo = enIyiKosu ? parseKiloSayi(enIyiKosu.weight) : null;
              const kiloFarkiEnIyiKosuya = r.weight != null && enIyiKilo != null ? r.weight - enIyiKilo : 0;

              // (2) At-jokey ikili oranı — bu ikilinin KENDİ geçmişi (küçültülmüş).
              const buJokeyleGecmis = gecmis.filter((g) => isSameJockey(g.jockey, r.jockey));
              const buJokeyRides = buJokeyleGecmis.length;
              const buJokeyWins = buJokeyleGecmis.filter((g) => g.finishPos === "1").length;
              const atJokeyIkiliOrani = shrink(buJokeyWins, buJokeyRides, jockeyPopOrt) * 100;

              // (3) Jokey değişim yönü — yeni jokeyin oranı eski jokeyin oranından ne
              // kadar yüksek/düşük (yön taşıyan "niyet" sinyali). TJK'nın resmi jokey
              // istatistiğini kullanır (2026-08-21 kararı — bkz. yukarıdaki not).
              let jokeyDegisimYonu = 0;
              if (r.jockeyChanged && r.previousJockey) {
                const prevStat = (jockeyStats as any)[r.previousJockey];
                const curRate = jockeyStat && jockeyStat.overall.rides > 0 ? shrink(jockeyStat.overall.wins, jockeyStat.overall.rides, jockeyPopOrt) : jockeyPopOrt;
                const prevRate = prevStat && prevStat.overall.rides > 0 ? shrink(prevStat.overall.wins, prevStat.overall.rides, jockeyPopOrt) : jockeyPopOrt;
                jokeyDegisimYonu = (curRate - prevRate) * 100;
              }

              const myGallops = (gallopsByRunner.get(r.id) ?? []).filter((g) => g.date < race.raceDay.date);
              const sonGalop = myGallops[0];
              let keskinGalop = 0;
              let galopVerisiVarMi: 0 | 1 = 0;
              let galopRahatVeIyi: 0 | 1 = 0;
              if (sonGalop) {
                const s = (sonGalop.splits as Record<string, string | null>) ?? {};
                galopVerisiVarMi = s["400"] != null ? 1 : 0;
                const q = galopQuality("400", s["400"] ?? null, race.breed, s["ic_dis"] === "İç");
                keskinGalop = q === "cok_iyi" || q === "iyi" ? 1 : 0;
                const KOLAY_SEKILLER = new Set(["R", "Rahat", "ÇR", "Çok Rahat", "HR"]);
                galopRahatVeIyi = keskinGalop === 1 && sonGalop.form != null && KOLAY_SEKILLER.has(sonGalop.form) ? 1 : 0;
              }
              const idmJokey = myGallops.some((g) => isSameJockey(g.jockey, r.jockey)) ? 1 : 0;
              const sonIdmanSprint: 0 | 1 = sonGalop ? (isSprintIdman(sonGalop.track) ? 1 : 0) : 0;
              const sonIdmanSprintObs = sonGalop != null;
              const h2hRes = h2hNetSkorHesapla(r.name);
              const hizRes = hizDerecesiHesapla(r.tjkAtId, race.breed, race.raceDay.date);

              // Tarihe-duyarlı (sızıntısız) sireOrani — bkz. yukarıdaki 2026-08-21 notu.
              // Veri yoksa (özellikle erken Temmuz'da, kendi takip altyapımız henüz
              // birikmemişken) eskisiyle AYNI nötr-altı değere düşer — bu artık DÜRÜST bir
              // "henüz veri yok" durumu, sızıntıyla suni şekilde doldurulmuyor.
              const sireKey = `${breedToIrk(race.breed)}|${surfaceToPist(race.surface)}|${mesafeBucket(race.distance)}|${r.sire ? normalizeSireName(r.sire) : ""}`;
              const sireTarihli = tarihliOranHesapla(sireIndex, sireKey, race.raceDay.date);
              const sireOran = sireTarihli.start > 0
                ? shrink(sireTarihli.wins, sireTarihli.start, 0.14) * 100
                : 14 * 0.5;

              // jokeyOrani/antrenorOrani — TJK'nın resmi (uzun-vadeli, güvenilir) kaynağına
              // GERİ alındı (2026-08-21 kararı, bkz. yukarıdaki not).
              const jokeyOran = jockeyStat && jockeyStat.overall.rides > 0
                ? shrink(jockeyStat.overall.wins, jockeyStat.overall.rides, jockeyPopOrt) * 100
                : jockeyPopOrt * 100;
              const antrenorOran = trainerStat && trainerStat.rides > 0
                ? shrink(trainerStat.wins, trainerStat.rides, trainerPopOrt) * 100
                : trainerPopOrt * 100;

              rows.push({
                raceId: race.id, runnerId: r.id, no: r.no,
                win, top3, top3Observed,
                agfFark,
                agfSirasi: agfSiraMap.get(r.id) ?? Math.ceil(runners.length / 2),
                accurace: accuraceMap.get(r.name) === true ? 1 : 0,
                formEgimi: formEgimi(r.recentForm) ?? 0,
                kgs: sonYaris?.gunFarki ?? -1,
                kgsVarMi: sonYaris?.gunFarki != null ? 1 : 0,
                pistUzmani: sonYaris?.kazandi === "EVET" ? 1 : 0,
                sireOrani: sireOran,
                galop: keskinGalop as 0 | 1,
                idmJokey: idmJokey as 0 | 1,
                galopSayisi: myGallops.length,
                uzunAraGalopKatkisi: (sonYaris?.gunFarki != null && sonYaris.gunFarki > 30) ? myGallops.length : 0,
                jokeyOrani: jokeyOran,
                antrenorOrani: antrenorOran,
                sinifDususu: yakinsamaGecmis.get(r.no)?.sinifDususu ? 1 : 0,
                ajiGalibiyetVarMi: yakinsamaGecmis.get(r.no)?.ajiGalibiyetVarMi ? 1 : 0,
                sonIdmanSprint,
                kategori, breed: race.breed, distance: race.distance, surface: race.surface,
                ayniJokeySurekliligi: sonYaris?.ayniJokey === true ? 1 : 0,
                takiEklendiMi: (sonYaris?.eklenenTaki?.length ?? 0) > 0 ? 1 : 0,
                sinyalDurum: {
                  sonIdmanSprint: { observed: sonIdmanSprintObs, reason: sonIdmanSprintObs ? null : "NO_GALOP" },
                  takiDegisikligi: { observed: sonYaris != null, reason: sonYaris != null ? null : "NO_PRIOR_RUN" },
                  h2hNetSkor: { observed: h2hRes.obs, reason: h2hRes.reason },
                  hizDerecesi: { observed: hizRes.obs, reason: hizRes.reason },
                },
                takiCikarildiMi: (sonYaris?.cikarilanTaki?.length ?? 0) > 0 ? 1 : 0,
                kacakAtMi: stilEgilimMap.get(r.id)?.stil === "KACAK_AT" ? 1 : 0,
                kacakYalniz: stilEgilimMap.get(r.id)?.stil === "KACAK_AT" && kacakSayisiSahada === 1 ? 1 : 0,
                onGrupArkasiMi: stilEgilimMap.get(r.id)?.stil === "ON_GRUP_ARKASI" ? 1 : 0,
                disaridanStart: r.disaridanStart ? 1 : 0,
                hpSirasi: hpSiraMap.get(r.id) ?? Math.ceil(runners.length / 2),
                agfPayi: r.agf ?? 0,
                agfFarkiIkinciye:
                  r.agf != null && birinciAgf != null && r.agf === birinciAgf && ikinciAgf != null
                    ? birinciAgf - ikinciAgf
                    : 0,
                galopVerisiVarMi,
                galopRahatVeIyi,
                kiloFarkiEnIyiKosuya,
                atJokeyIkiliOrani,
                jokeyDegisimYonu,
                h2hNetSkor: h2hRes.v,
                h2hKiloDegisimi: h2hKiloDegisimiHesapla(r.name, r.weight),
                hizDerecesi: hizRes.v,
                hpPuani: r.hp ?? 0,
                zeminKatsayisi: zeminKatsayisiDeger,
                zeminToleransi: zeminToleransiMap.get(r.name) ?? 0,
                yarisGidisatiSkoru: gidisatByRunnerId.get(r.id)?.finalSkor ?? 0,
                tempoTasimaGucu: tempoTasimaGucuMap.get(r.name) ?? 0,
                zeminMesafeDeneyim: zeminMesafeDeneyimMap.get(r.name)?.deger ?? 0,
              });
            }
          })(), 120_000);
        } catch (e) {
          failed++;
          if (e instanceof Error && e.message === "TIMEOUT") timedOut++;
        } finally {
          processed++;
        }
      })
    );
    if (processed % 200 < CONCURRENCY) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(0);
      console.log(`... ${processed}/${yeniRaces.length} işlendi (${elapsed}s, ${failed} hata [${timedOut} timeout], ${rows.length} at satırı)`);
      writeFileSync(CACHE_PATH, JSON.stringify(rows));
    }
  }

  console.log(`\nBİTTİ. İşlenen: ${processed}, hata: ${failed} (${timedOut} timeout), toplam satır: ${rows.length}, süre: ${((Date.now() - startTime) / 1000).toFixed(0)}s`);
  writeFileSync(CACHE_PATH, JSON.stringify(rows));
  console.log(`Önbellek yazıldı: ${CACHE_PATH}`);
  await db.$disconnect();
}

main();





