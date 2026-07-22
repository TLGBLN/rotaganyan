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
import { fetchApprenticeRemainingRaces, normalizeJockeyName } from "@/server/services/ingest/tjk-apprentice.adapter";
import {
  hpKalitesiYildizi, sinifGecisBonusu, galopSiniflandirmasi, tempoGuvenSeviyesi,
  kacakHaritasi, zeminKatsayisi, zeminDetayiBul, type GalopZinciriSonuc, type TempoGuven,
} from "@/lib/methodology/mekanik-puanlama";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, type PaceCheckpoint, type CokYarisEgilim } from "@/lib/methodology/pace-analizi";
import { toAccuraceCitySlug } from "@/server/services/ingest/accurace.adapter";

const COMBINING_MARKS_RE = /[̀-ͯ]/g;
// Yabancı doğumlu atlarda Runner.name "(USA)"/"(IRE)" gibi ülke koduyla biter, Accurace bunu yazmıyor.
const TRAILING_COUNTRY_CODE_RE = /\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i;
function normalizeHorseName(s: string): string {
  return s.replace(TRAILING_COUNTRY_CODE_RE, "").toLocaleUpperCase("tr-TR").normalize("NFD").replace(COMBINING_MARKS_RE, "").replace(/[^A-ZİĞÜŞÖÇ0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

// ── SKK Sınıf Piramidi (Ansiklopedi Bölüm III) — metin tabanlı en iyi eşleştirme ──
function classToSkk(classType: string | null | undefined): number | null {
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
  pedigreeNote: string | null;
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
  equipment: string | null;
  equipmentAdded: string | null;
  equipmentRemoved: string | null;
  recentForm: string | null;
  bestTime: string | null;
  apprentice: boolean;
  // Çırak jokey ise TJK'nın "kalan kilo indirimi hakkı" sayısı — sitenin program
  // sayfasında "Ap. (N kaldı)" olarak gösteriliyor, HP/kilo değerlendirmesinde bağlam sağlar.
  apprenticeRemaining: number | null;
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

  // Kilo, jokey/antrenör, takı — otomatik
  kiloAvantaji: boolean;
  hpAlanIciUst: boolean;
  jockeyWinPct: number | null;
  trainerWinPct: number | null;
  sinifJokeyAntrenor: boolean;
  takiDegisikligiVar: boolean;
  exactVeyaPedigri: boolean;

  // Son 800 — Gölge Mod girdileri
  son800BenzerKosuN: number;
  son800Medyan: number | null;

  // Sitenin kendi "Aynı Pist/Mesafe/Hipodrom" ve "H2H" panellerinden (methodolojide
  // XI. Bölüm — ZAYIF KANIT, tek başına sırayı belirlemez ama göz ardı edilmemeli).
  aynıPistMesafeOzet: string | null;
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
  };
  runners: Faz1Runner[];
  veriDoluluk: { alan: string; oran: number }[];
};

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

  const hippodromeName = race.raceDay.hippodrome.name.trim();
  const jockeyNames = [...new Set(race.runners.map((r) => r.jockey).filter((j): j is string => !!j))];
  const trainerNames = [...new Set(race.runners.map((r) => r.trainer).filter((t): t is string => !!t))];

  const { getJockeyStats, getTrainerStats } = await import("@/server/services/race.service");
  const [jockeyStats, trainerStats, atPerformansRows, h2hEncounters, apprenticeRemainingMap, accuraceKayitlari] = await Promise.all([
    getJockeyStats(jockeyNames).catch(() => ({} as Awaited<ReturnType<typeof getJockeyStats>>)),
    getTrainerStats(trainerNames).catch(() => ({} as Awaited<ReturnType<typeof getTrainerStats>>)),
    getAtPerformansForRace(raceId).catch(() => []),
    getH2HForRace(raceId).catch(() => []),
    fetchApprenticeRemainingRaces().catch(() => ({}) as Record<string, number>),
    db.accuraceHorseSplit.findMany({
      where: { horseName: { in: race.runners.map((r) => r.name) } },
      select: { horseName: true, checkpoints: true, accuraceRace: { select: { length: true } } },
    }).catch(() => []),
  ]);
  const atPerformansMap = new Map(atPerformansRows.map((r) => [r.horseName, r.records]));

  // Accurace GPS/sektörel geçmişinden atın KALICI tempo/pozisyon eğilimini üret —
  // yalnız n≥3 yarış varsa (bkz. pace-analizi.ts, tek yarıştan kalıcı stil çıkarılmaz).
  const accuraceEgilimMap = new Map<string, CokYarisEgilim | null>();
  for (const r of race.runners) {
    const norm = normalizeHorseName(r.name);
    const kayitlar = accuraceKayitlari.filter((k) => normalizeHorseName(k.horseName) === norm);
    const sonuclar = kayitlar
      .map((k) => analizEtTekYaris(k.checkpoints as unknown as PaceCheckpoint[], k.accuraceRace.length ?? 0))
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
      const rakipOzet = rakipler.map((r) => `${r.horseName}(${r.finishPos || "?"}.)`).join(", ");
      kayitlar.push(`${enc.date} ${enc.hippodrome}: kendisi ${kendisi.finishPos || "?"}. — ${rakipOzet}`);
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
  const son800AccuraceKayitlari = race.runners.length
    ? await db.accuraceHorseSplit.findMany({
        where: { horseName: { in: race.runners.map((r) => r.name) } },
        select: {
          horseName: true,
          accuraceRaceId: true,
          checkpoints: true,
          accuraceRace: { select: { date: true, citySlug: true, ground: true, length: true } },
        },
      })
    : [];
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

  const surfacePrefixToday = race.surface === "CIM" ? "C" : race.surface === "SENTETIK" ? "S" : "K";
  const todayCitySlug = toAccuraceCitySlug(hippodromeName);
  const son800ByRunnerName = new Map<string, { n: number; medyan: number | null }>();
  for (const r of race.runners) {
    const kayitlar = son800AccuraceKayitlari.filter(
      (k) =>
        k.horseName === r.name &&
        k.accuraceRace.date.getUTCFullYear().toString() === race.raceDay.date.getUTCFullYear().toString() &&
        k.accuraceRace.citySlug === todayCitySlug &&
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
          const gecmis = await fetchTjkAtKosuBilgileri(r.tjkAtId);
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

      const jockeyStat = r.jockey ? jockeyStats[r.jockey] : undefined;
      const trainerStat = r.trainer ? trainerStats[r.trainer] : undefined;
      const jockeyWinPct = jockeyStat && jockeyStat.overall.rides > 0
        ? Math.round((jockeyStat.overall.wins / jockeyStat.overall.rides) * 100) : null;
      const trainerWinPct = trainerStat && trainerStat.rides > 0
        ? Math.round((trainerStat.wins / trainerStat.rides) * 100) : null;

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
      const takiDegisikligiVar = !!(r.equipmentAdded || r.equipmentRemoved);
      const exactVeyaPedigri = !!(r.sire || r.dam) || son800BenzerKosuN > 0;
      const sinifJokeyAntrenor = sinifDususu || (jockeyWinPct ?? 0) >= 15 || (trainerWinPct ?? 0) >= 15;

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
            .map((row) => `${row.date} ${row.finishPos || "?"}. (HP ${row.hp || "?"})`)
            .join(" | ")
        : null;

      const apprenticeRemaining = r.apprentice && r.jockey
        ? apprenticeRemainingMap[normalizeJockeyName(r.jockey)] ?? null
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
      const tempoVeriNHesap = (r.raceStyle as { veri?: number } | null)?.veri ?? null;
      const tempoGuvenHesap = tempoGuvenSeviyesi(tempoVeriNHesap);

      return {
        id: r.id, no: r.no, ad: r.name, scratched: r.scratched,
        weight: r.weight, weightChange: r.weightChange, disaridanStart: r.disaridanStart,
        jockey: r.jockey, jockeyChanged: r.jockeyChanged, previousJockey: r.previousJockey,
        trainer: r.trainer, owner: r.owner,
        ekuriMateleri: ekuriMateMap.get(r.id) ?? [],
        sire: r.sire, dam: r.dam, damSire: r.damSire, pedigreeNote: r.pedigreeNote,
        adminNote: r.adminNote,
        hpBugun: hpBugunEfektif, hpBugunResmiYok, hpOncekiResmiYok, hpOncekiFetchBasarisiz,
        agf: r.agf, agfSirasi: agfSiraMap.get(r.id) ?? null,
        equipment: r.equipment, equipmentAdded: r.equipmentAdded, equipmentRemoved: r.equipmentRemoved,
        recentForm: r.recentForm, bestTime: r.bestTime,
        apprentice: r.apprentice, apprenticeRemaining,
        raceStyleEtiket: (r.raceStyle as { style?: string } | null)?.style ?? null,
        tempoVeriN: tempoVeriNHesap,
        kacak: (r.raceStyle as { style?: string } | null)?.style === "KACAK",
        galopOzet,
        ilkStart, hpOnceki: hpOncekiEfektif,
        hpIvmesi: hpIvmesiHesap,
        sinifOnceki, sinifSkkOnceki, sinifSkkBugun: bugunSkk, sinifDususu,
        bitirisGeriliyor: yonHesap.geriliyor, bitirisIyilesiyor: yonHesap.iyilesiyor,
        sonSonucZayif: sonSonucZayifMi(r.recentForm),
        kondisyonZinciriVar, keskinGalopZinciri,
        kiloAvantaji, hpAlanIciUst: hpAlanIciUstHesap,
        jockeyWinPct, trainerWinPct, sinifJokeyAntrenor,
        takiDegisikligiVar, exactVeyaPedigri,
        son800BenzerKosuN, son800Medyan,
        aynıPistMesafeOzet, h2hOzet: h2hOzetFor(r.name),
        hpKalitesiYildizi: hpKalitesi, sinifGecisBonusuPuan: sinifBonusu,
        galopSiniflandirma: galopSinif, tempoGuven: tempoGuvenHesap,
        accuraceEgilim: accuraceEgilimMap.get(r.id) ?? null,
      };
    })
  );

  // Sahadaki toplam kaçak sayısı (§VIII Kaçak Sayısı Haritası) — bu sayı zaten
  // faz4/gecit-motoru.ts'te ayrıca hesaplanıyordu ama Faz 2'ye hiç ulaşmıyordu;
  // Faz 2 tempo puanlarken her satırdaki "kaçak" bayrağını kendi kendine sayıp
  // tahmin etmek zorunda kalıyordu.
  const sahadakiKacakSayisi = runners.filter((r) => r.kacak).length;
  const kacakHarita = kacakHaritasi(sahadakiKacakSayisi);

  const n = runners.length || 1;
  const veriDoluluk = [
    { alan: "hpBugun", oran: runners.filter((r) => r.hpBugun != null).length / n },
    { alan: "hpOnceki", oran: runners.filter((r) => r.hpOnceki != null || r.ilkStart).length / n },
    { alan: "tempoVeriN", oran: runners.filter((r) => r.tempoVeriN != null).length / n },
    { alan: "agfSirasi", oran: runners.filter((r) => r.agfSirasi != null).length / n },
    { alan: "formYonu", oran: runners.filter((r) => r.bitirisGeriliyor != null || r.bitirisIyilesiyor != null).length / n },
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
    },
    runners,
    veriDoluluk,
  };
}
