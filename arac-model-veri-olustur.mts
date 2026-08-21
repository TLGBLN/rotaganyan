// KALICI ARAÇ (V5 model verisi) — 2026-08-15, SİLİNMİYOR.
// V4'ün boolean sinyallerinin ham/sürekli hallerini + gerçek AGF farkını (yalnız top-5
// değil, TÜM atlar) + jokey/antrenör/aygır için shrinkage'a hazır ham sayıları toplar.
// Koşullu logit (Plackett-Luce) eğitimi için raceId'ye göre GRUPLANMIŞ satırlar üretir.
// Çalıştırma: node --env-file=.env node_modules/tsx/dist/cli.mjs arac-model-veri-olustur.mts
import { db } from "./src/lib/db";
import { getSonYarisDetaylariForRace } from "./src/server/actions/son-yaris-detay.actions";
import { fetchAccuraceGecmisKayitlari, hesaplaAccuraceSonYarisEnHizliKapanisMap } from "./src/lib/methodology/veri-toplama";
import { kategoriTespit } from "./src/lib/methodology/v2-engine";
import { galopQuality, isSameJockey } from "./src/components/program/panels/galop-helpers";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "./src/lib/sire-stat-match";
import { finishPos } from "./src/lib/race-result";
import { getJockeyStats, getTrainerStats } from "./src/server/services/race.service";
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
  if (!s) return null;
  const m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`);
}

export type ModelRow = {
  raceId: string;
  runnerId: string;
  no: number;
  win: 0 | 1;
  top3: 0 | 1;
  // ham/sürekli girdiler:
  agfFark: number; // gerçek son-ilk AGF farkı, TÜM saha (yalnız top-5 değil), veri yoksa 0
  agfSirasi: number; // 1..N, veri yoksa saha ortası
  accurace: 0 | 1;
  formEgimi: number; // veri yoksa 0
  kgs: number; // gün, veri yoksa -1 (modelde ayrı bir "veri yok" göstergesiyle ele alınabilir)
  kgsVarMi: 0 | 1;
  pistUzmani: 0 | 1;
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
  // 2026-08-21 — atın GERÇEK kariyer start sayısı (HorseRaceHistoryCache, tarihe göre
  // filtrelenmiş). sireOrani × "az deneyimli" etkileşimini test etmek için — literatür
  // (TwinSpires): pedigri, atın kendi kanıtlanmış performansı YOKSA/azsa devreye girmeli.
  kariyerStartSayisi: number;
  // 2026-08-21 — H2H (baş-başa geçmiş karşılaşma) net skoru: bugünkü sahadaki rakiplerle
  // ortak geçmiş yarışlarda kaç kez önde bitirdi eksi kaç kez geride bitirdi. B=200
  // bootstrap'ta sınırda (GA=[-0.0105,0.1603]) ama backtest'te top1/top3 İKİSİ BİRDEN
  // iyileşti (logloss ihmal edilebilir kötüleşme) — kullanıcı kararıyla KABUL EDİLDİ.
  h2hNetSkor: number;
};

async function main() {
  const races = await db.race.findMany({
    where: { result: { isNot: null }, raceDay: { hippodrome: { slug: { notIn: GERCEK_OLMAYAN_HIPODROM_SLUGLARI } } } },
    select: {
      id: true, classType: true, breed: true, distance: true, surface: true,
      raceDay: { select: { date: true } },
      result: { select: { actualOrder: true } },
      runners: {
        where: { scratched: false },
        select: { id: true, no: true, name: true, jockey: true, trainer: true, sire: true, agf: true, recentForm: true, raceStyle: true, disaridanStart: true, hp: true, tjkAtId: true, previousJockey: true, jockeyChanged: true, weight: true },
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

  let processed = 0, failed = 0, timedOut = 0;
  const CONCURRENCY = 6;
  const startTime = Date.now();

  for (let i = 0; i < yeniRaces.length; i += CONCURRENCY) {
    const batch = yeniRaces.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (race) => {
        try {
          await withTimeout((async () => {
            const actualOrder = race.result?.actualOrder as number[] | undefined;
            if (!actualOrder) return;
            const kategori = kategoriTespit(race.classType);
            const runners = race.runners;
            if (runners.length === 0) return;

            const tjkAtIdler = runners.map((r) => r.tjkAtId).filter((x): x is number => x != null);

            const [sonYarisDetaylari, jockeyStats, trainerStats, accKayitlar, agfSnaps, gecmisKayitlari] = await Promise.all([
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
            ]);
            const gecmisByTjkAtId = new Map(gecmisKayitlari.map((g) => [g.tjkAtId, g.rowsJson as unknown as { finishPos: string; weight: string; jockey: string; surface: string; date: string; raceNo: string; city: string }[]]));

            // H2H (baş-başa geçmiş karşılaşma) — 2026-08-21 kullanıcı talebi: V1-V22'de
            // vardı, V5'in yeniden inşasında hiç dahil edilmemişti. getH2HForRace ile AYNI
            // mantık (tarih+şehir+koşu_no anahtarıyla ortak geçmiş yarış eşleştirme) ama
            // zaten toplu çekilmiş gecmisByTjkAtId'den — ekstra sorgu YOK, verimli.
            const raceNameToNo = new Map(runners.map((r) => [r.name, r.no]));
            const h2hByAnahtar = new Map<string, { horseName: string; pos: number }[]>();
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
                if (!arr.some((e) => e.horseName === r.name)) arr.push({ horseName: r.name, pos });
                h2hByAnahtar.set(anahtar, arr);
              }
            }
            function h2hNetSkorHesapla(kendiAd: string): number {
              let skor = 0;
              for (const arr of h2hByAnahtar.values()) {
                if (arr.length < 2) continue;
                const beni = arr.find((e) => e.horseName === kendiAd);
                if (!beni) continue;
                for (const other of arr) {
                  if (other.horseName === kendiAd) continue;
                  if (!raceNameToNo.has(other.horseName)) continue;
                  skor += beni.pos < other.pos ? 1 : beni.pos > other.pos ? -1 : 0;
                }
              }
              return skor;
            }

            // galop verisi
            const gallops = await db.gallop.findMany({
              where: { runnerId: { in: runners.map((r) => r.id) } },
              orderBy: { date: "desc" },
              select: { runnerId: true, date: true, jockey: true, splits: true, form: true },
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
            const agfSirali = [...runners].filter((r) => r.agf != null).sort((a, b) => (b.agf ?? 0) - (a.agf ?? 0));
            const agfSiraMap = new Map(agfSirali.map((r, i2) => [r.id, i2 + 1]));
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

            for (const r of runners) {
              const pos = actualOrder.indexOf(r.no) + 1;
              if (pos <= 0) continue;
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

              // Kullanıcı hipotezi 2026-08-21 (literatür: TwinSpires pedigri-handikapçılık
              // rehberi — pedigri, atın KENDİ kanıtlanmış performansı YOKSA/az startlıysa
              // bir "prior" olarak devreye girmeli): atın GERÇEK kariyer start sayısı
              // (HorseRaceHistoryCache'ten, tarihe göre zaten filtrelenmiş "gecmis" —
              // TJK'nın tam geçmişi, bizim kısa takip penceremizden daha güvenilir).
              const kariyerStartSayisi = gecmis.length;

              rows.push({
                raceId: race.id, runnerId: r.id, no: r.no,
                win: pos === 1 ? 1 : 0, top3: pos <= 3 ? 1 : 0,
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
                kategori, breed: race.breed, distance: race.distance, surface: race.surface,
                ayniJokeySurekliligi: sonYaris?.ayniJokey === true ? 1 : 0,
                takiEklendiMi: (sonYaris?.eklenenTaki?.length ?? 0) > 0 ? 1 : 0,
                takiCikarildiMi: (sonYaris?.cikarilanTaki?.length ?? 0) > 0 ? 1 : 0,
                kacakAtMi: (r.raceStyle as { style?: string } | null)?.style === "KACAK_AT" ? 1 : 0,
                onGrupArkasiMi: (r.raceStyle as { style?: string } | null)?.style === "ON_GRUP_ARKASI" ? 1 : 0,
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
                kariyerStartSayisi,
                h2hNetSkor: h2hNetSkorHesapla(r.name),
              });
            }
          })(), 25_000);
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
