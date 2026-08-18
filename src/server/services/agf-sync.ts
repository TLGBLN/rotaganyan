/**
 * AGF sync from TJK's daily program page (same page/columns the regular
 * program ingest already fetches — the AGFORAN cell just wasn't read before).
 * Called by /api/admin/sync-agf (manual) and /api/cron/agf-sync (scheduled).
 */

import { db } from "@/lib/db";
import { discoverTurkishCities, fetchCityProgram, toSlug, toTjkDate, type CityInfo } from "./ingest/tjk-info.adapter";

export type AgfSyncCityResult = {
  name: string;
  ok: boolean;
  racesUpdated: number;
  runnersUpdated: number;
  error?: string;
};

export type AgfSyncResult = {
  date: string;
  cities: AgfSyncCityResult[];
};

/** Tek bir şehrin AGF verisini günceller — syncAgfForDate'in gün-içi döngüsü VE
 *  syncAgfForRace'in tek-koşu tazeleme çağrısı bunu paylaşır (2026-08-18, bkz. o fonksiyon). */
async function syncOneCity(city: CityInfo, tjkDate: string, d: Date): Promise<AgfSyncCityResult> {
  const slug = toSlug(city.sehirAdi);

  // TJK'dan programı önce çek (hippodrome/raceDay yoksa ingest için de kullanılır)
  const program = await fetchCityProgram(city, tjkDate);
  if (!program) {
    return { name: city.sehirAdi, ok: false, racesUpdated: 0, runnersUpdated: 0, error: "TJK program sayfası boş döndü" };
  }

  // Hippodrome veya raceDay DB'de yoksa ingest et (hippodrome upsert'i de yapar)
  let hippodrome = await db.hippodrome.findFirst({ where: { slug } });
  let raceDay = hippodrome
    ? await db.raceDay.findFirst({
        where: { date: d, hippodromeId: hippodrome.id },
        include: { races: { include: { runners: { select: { id: true, no: true } } } } },
      })
    : null;

  if (!hippodrome || !raceDay || raceDay.races.length === 0) {
    try {
      const { persistRaceDays } = await import("./ingest/base");
      await persistRaceDays([program]);
      hippodrome = await db.hippodrome.findFirst({ where: { slug } });
      if (hippodrome) {
        raceDay = await db.raceDay.findFirst({
          where: { date: d, hippodromeId: hippodrome.id },
          include: { races: { include: { runners: { select: { id: true, no: true } } } } },
        });
      }
    } catch { /* ingest başarısız olursa AGF sync de atla */ }
  }

  if (!raceDay || raceDay.races.length === 0) {
    return { name: city.sehirAdi, ok: false, racesUpdated: 0, runnersUpdated: 0, error: "No race day found in DB" };
  }

  let racesUpdated = 0;

  // Fetch latest snapshot per runner in bulk to avoid N+1 queries
  const allRunnerIds = raceDay.races.flatMap((rc) => rc.runners.map((r) => r.id));
  const latestSnapshots = await db.agfSnapshot.findMany({
    where: { runnerId: { in: allRunnerIds } },
    orderBy: { capturedAt: "desc" },
    select: { runnerId: true, agf: true },
    distinct: ["runnerId"],
  });
  const lastSnapshotMap = new Map(latestSnapshots.map((s) => [s.runnerId, s.agf]));

  // v6.69 — kullanıcı bulgusu 2026-08-09: bu döngü her atı TEK TEK, sırayla
  // (await içinde await) güncelliyordu — İstanbul gibi çok koşulu/atlı bir günde bu,
  // tüm cron'u 60sn maxDuration'ın üzerine taşıyıp Vercel'in sessizce (504) kesmesine
  // yol açtı, AGF verisi saatlerce donuk kaldı. Bir şehir içindeki TÜM at güncellemeleri
  // birbirinden bağımsız olduğu için artık paralel (Promise.all) yazılıyor.
  const updateJobs: Promise<boolean>[] = [];
  for (const race of raceDay.races) {
    const programRace = program.races.find((r) => r.raceNo === race.raceNo);
    if (!programRace) continue;

    const withAgf = programRace.runners.filter((r) => r.agf !== undefined);
    if (withAgf.length === 0) continue;

    racesUpdated++;
    for (const pr of withAgf) {
      const dbRunner = race.runners.find((r) => r.no === pr.no);
      if (!dbRunner) continue;

      const newAgf = pr.agf as number;
      // Yalnızca değer değiştiyse snapshot oluştur; böylece first≠last garantilenir.
      const prevAgf = lastSnapshotMap.get(dbRunner.id);
      const shouldSnapshot = prevAgf === undefined || Math.abs(prevAgf - newAgf) >= 0.01;

      updateJobs.push(
        (async () => {
          await db.runner.update({ where: { id: dbRunner.id }, data: { agf: newAgf } });
          if (shouldSnapshot) {
            await db.agfSnapshot.create({ data: { runnerId: dbRunner.id, agf: newAgf } });
          }
          return shouldSnapshot;
        })()
      );
    }
  }
  const snapshotResults = await Promise.all(updateJobs);
  const runnersUpdated = snapshotResults.filter(Boolean).length;

  return { name: city.sehirAdi, ok: true, racesUpdated, runnersUpdated };
}

export async function syncAgfForDate(date: Date): Promise<AgfSyncResult> {
  const d = new Date(date);
  d.setUTCHours(0, 0, 0, 0);
  const tjkDate = toTjkDate(d);

  const cities = await discoverTurkishCities(tjkDate);
  const cityResults: AgfSyncCityResult[] = [];

  for (const city of cities) {
    try {
      cityResults.push(await syncOneCity(city, tjkDate, d));
    } catch (err) {
      cityResults.push({ name: city.sehirAdi, ok: false, racesUpdated: 0, runnersUpdated: 0, error: String(err) });
    }
    await new Promise((r) => setTimeout(r, 400));
  }

  return { date: tjkDate, cities: cityResults };
}

// 2026-08-18 — aynı hipodromda art arda birçok koşu analiz edilirse (örn. 11 koşulu bir
// gün) her analiz TJK'ya yeniden gitmesin — bir hipodrom+gün için son senkronizasyon bu
// kadar YAKIN zamanda olduysa (dakika), tekrar çekmeden atlanır. AGF gerçekte bu sıklıkta
// zaten değişmiyor (TJK'nın kendi cron'u da günde birkaç kez güncelliyor).
const SOGUMA_MS = 3 * 60 * 1000;

/**
 * 2026-08-18 kullanıcı talebi: "AGF trend'i son kez güncelleyip analize başlasa" — SELLYGIRL
 * (Kocaeli K3) vakası: analiz saatinde henüz eşiği geçmemiş bir AGF hareketi, analiz
 * BİTTİKTEN SONRA gelen bir ölçümle eşiği geçmiş, sistem bunu yakalayamamıştı (kod hatası
 * değildi — o anki en güncel veriyle doğru çalışmıştı, ama "o an" post saatine yakın değildi).
 * Bu fonksiyon TEK bir koşunun hipodromu için (günün TÜM şehirlerini taramadan, hızlı) AGF'yi
 * tazeler — gatherFaz1V5 tarafından analiz başlamadan İLK ADIM olarak çağrılır. Hata
 * durumunda (TJK erişilemez vb.) sessizce yutulur — analiz, DB'deki mevcut en son veriyle
 * devam eder, bu adım hiçbir zaman analizi BLOKE ETMEZ.
 */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`syncAgfForRace: ${ms}ms zaman aşımı`)), ms)),
  ]);
}

export async function syncAgfForRace(raceId: string): Promise<void> {
  try {
    await withTimeout(syncAgfForRaceInner(raceId), 10_000);
  } catch {
    // TJK erişilemedi/zaman aşımı/başka bir hata — analiz DB'deki mevcut veriyle devam eder.
  }
}

async function syncAgfForRaceInner(raceId: string): Promise<void> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: {
      raceDayId: true,
      raceDay: { select: { date: true, hippodrome: { select: { name: true, slug: true } } } },
    },
  });
  if (!race) return;

  // Soğuma kontrolü: bu hipodrom+gün için AGF en son ne zaman yazıldı?
  const enYeniSnapshot = await db.agfSnapshot.findFirst({
    where: { runner: { race: { raceDayId: race.raceDayId } } },
    orderBy: { capturedAt: "desc" },
    select: { capturedAt: true },
  });
  if (enYeniSnapshot && Date.now() - enYeniSnapshot.capturedAt.getTime() < SOGUMA_MS) {
    return; // yakın zamanda zaten tazelendi, TJK'ya tekrar gitme
  }

  const d = new Date(race.raceDay.date);
  d.setUTCHours(0, 0, 0, 0);
  const tjkDate = toTjkDate(d);

  const cities = await discoverTurkishCities(tjkDate);
  const city = cities.find((c) => toSlug(c.sehirAdi) === race.raceDay.hippodrome.slug);
  if (!city) return;

  await syncOneCity(city, tjkDate, d);
}
