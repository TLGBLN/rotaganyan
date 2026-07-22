/**
 * Accurace.net'ten (GPS/sektörel zamanlama sağlayıcısı) bir günün koşularının 100m'lik
 * checkpoint verisini çekip AccuraceRace/AccuraceHorseSplit tablolarına kaydeder.
 * Bu veri yalnız yarış BİTTİKTEN sonra Accurace tarafından işlenip yayınlanıyor —
 * result-sync.ts ile aynı mantıkla "henüz yok" normal bir durumdur, hata değildir.
 */

import { db } from "@/lib/db";
import { fetchAccuraceRace, toAccuraceCitySlug, parseAccuraceTimeToMs } from "./ingest/accurace.adapter";
import { analizEtTekYaris, hesaplaCokYarisEgilimi, type PaceCheckpoint } from "@/lib/methodology/pace-analizi";

const TURKISH_UPPER_I_RE = /I/g;
const COMBINING_MARKS_RE = /[̀-ͯ]/g;

// Yabancı doğumlu atlar bizim Runner.name'de "AD (USA)"/"(IRE)"/"(GB)" gibi ülke
// koduyla kayıtlı — Accurace bu soneki hiç yazmıyor ("AD" olarak veriyor). Eşleştirmeden
// önce bu soneği atmak gerekiyor, yoksa (gerçek bir eşleşme mümkünken) sistematik olarak
// eşleşme kaçırılıyor (141 eşleşmeyenin büyük kısmı bu yüzdendi).
const TRAILING_COUNTRY_CODE_RE = /\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i;

function normalizeName(s: string): string {
  return s
    .replace(TRAILING_COUNTRY_CODE_RE, "")
    .toLocaleUpperCase("tr-TR")
    .replace(TURKISH_UPPER_I_RE, "I")
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export type AccuraceSyncSonuc = { kosular: number; kaydedilen: number; atlanan: number; errors: string[] };

/**
 * Verilen at isimleri için Accurace geçmişinden KALICI eğilimi (n>=3) yeniden hesaplar
 * ve o isme sahip TÜM Runner satırlarına yazar (Runner.raceStyle) — /program sayfasındaki
 * rozet bu alandan besleniyor. syncAccuraceForDate her gün çağırdığı için rozet güncel
 * kalır; scripts/_migrate_race_style.ts'nin yaptığı tek seferlik toplu işin küçük,
 * artımlı (yalnız o gün etkilenen atlar için) eşdeğeridir.
 */
async function updateRaceStyleForHorseNames(horseNames: string[]): Promise<void> {
  const uniq = [...new Set(horseNames)];
  if (uniq.length === 0) return;

  const splits = await db.accuraceHorseSplit.findMany({
    where: { horseName: { in: uniq } },
    select: { horseName: true, checkpoints: true, accuraceRace: { select: { length: true } } },
  });

  const byName = new Map<string, { checkpoints: PaceCheckpoint[]; length: number }[]>();
  for (const s of splits) {
    const norm = normalizeName(s.horseName);
    const list = byName.get(norm) ?? [];
    list.push({ checkpoints: s.checkpoints as unknown as PaceCheckpoint[], length: s.accuraceRace.length ?? 0 });
    byName.set(norm, list);
  }

  const runners = await db.runner.findMany({ where: { name: { in: uniq } }, select: { id: true, name: true } });
  const runnerIdsByNorm = new Map<string, string[]>();
  for (const r of runners) {
    const norm = normalizeName(r.name);
    const list = runnerIdsByNorm.get(norm) ?? [];
    list.push(r.id);
    runnerIdsByNorm.set(norm, list);
  }

  for (const [norm, kayitlar] of byName) {
    const ids = runnerIdsByNorm.get(norm);
    if (!ids || ids.length === 0) continue;
    const sonuclar = kayitlar
      .map((k) => analizEtTekYaris(k.checkpoints, k.length))
      .filter((s): s is NonNullable<typeof s> => s != null);
    const egilim = hesaplaCokYarisEgilimi(sonuclar);
    if (!egilim) continue;
    const value = { style: egilim.stil, percent: egilim.percent, veri: egilim.n, source: "accurace", updatedAt: new Date().toISOString() };
    await db.runner.updateMany({ where: { id: { in: ids } }, data: { raceStyle: value } });
  }
}

/**
 * matchRunners=false: at ismi eşleştirmesi (runnerId) YAPILMAZ, yalnız ham veri toplanır.
 * Toplu geriye dönük doldurmada (backfill) kullanılır — kullanıcı talimatı: "at isimleri
 * ile eşleştirme en son, tüm veriler toplandıktan sonra" yapılsın. Eşleştirme daha sonra
 * matchAccuraceRunners() ile ayrı bir geçişte tamamlanır.
 */
export async function syncAccuraceForDate(dateStr: string, matchRunners = true): Promise<AccuraceSyncSonuc> {
  const date = new Date(`${dateStr}T00:00:00.000Z`);

  const races = await db.race.findMany({
    where: { raceDay: { date }, accuraceRace: null },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: { select: { id: true, name: true } },
    },
  });

  let kaydedilen = 0;
  let atlanan = 0;
  const errors: string[] = [];
  const islenenAtlar: string[] = [];

  for (const race of races) {
    const hippodromeName = race.raceDay.hippodrome.name;
    // Karma/uluslararası hipodromlarda gerçek bir şehir kodu yok — Accurace zaten
    // Türkiye koşularını kapsıyor, bunlar için deneme bile faydasız, sessizce atla.
    if (hippodromeName === "Karma" || hippodromeName === "Perak Malezya") {
      atlanan++;
      continue;
    }
    const citySlug = toAccuraceCitySlug(hippodromeName);

    try {
      const data = await fetchAccuraceRace(dateStr, citySlug, race.raceNo);
      if (!data) {
        atlanan++;
        continue;
      }

      const accuraceRace = await db.accuraceRace.upsert({
        where: { date_citySlug_raceNo: { date, citySlug, raceNo: race.raceNo } },
        create: {
          raceId: race.id,
          date,
          citySlug,
          raceNo: race.raceNo,
          hippodrome: data.race.hippodrome,
          length: data.race.length,
          ground: data.race.ground,
          officialTimes: data.official,
          raw: data,
        },
        update: {
          raceId: race.id,
          hippodrome: data.race.hippodrome,
          length: data.race.length,
          ground: data.race.ground,
          officialTimes: data.official,
          raw: data,
          fetchedAt: new Date(),
        },
      });

      for (const h of data.horse) {
        const checkpoints = h.checkpoint
          .map((c) => ({ checkpoint: c.checkpoint, timeReal: parseAccuraceTimeToMs(c.time), place: c.place }))
          .filter((c): c is { checkpoint: number; timeReal: number; place: number } => c.timeReal != null);
        const finishTimeReal = parseAccuraceTimeToMs(h.time) ?? checkpoints[checkpoints.length - 1]?.timeReal ?? 0;
        const runner = matchRunners ? race.runners.find((r) => normalizeName(r.name) === normalizeName(h.horse_name)) : undefined;

        await db.accuraceHorseSplit.upsert({
          where: { accuraceRaceId_horseNumber: { accuraceRaceId: accuraceRace.id, horseNumber: h.horse_number } },
          create: {
            accuraceRaceId: accuraceRace.id,
            runnerId: runner?.id,
            horseName: h.horse_name,
            horseNumber: h.horse_number,
            place: h.place,
            finishTimeReal,
            checkpoints,
          },
          update: {
            runnerId: runner?.id,
            place: h.place,
            finishTimeReal,
            checkpoints,
          },
        });
        islenenAtlar.push(h.horse_name);
      }

      kaydedilen++;
    } catch (err) {
      errors.push(`${hippodromeName} ${race.raceNo}. Koşu: ${String(err)}`);
    }

    // Accurace'e nazik davran — art arda çok hızlı istek atmayalım.
    await new Promise((r) => setTimeout(r, 400));
  }

  if (matchRunners && islenenAtlar.length > 0) {
    await updateRaceStyleForHorseNames(islenenAtlar).catch((e) => errors.push(`raceStyle güncelleme: ${String(e)}`));
  }

  return { kosular: races.length, kaydedilen, atlanan, errors };
}

/**
 * Geriye dönük toplamada (matchRunners=false ile) boş bırakılan runnerId'leri
 * doldurur — her AccuraceHorseSplit'i kendi AccuraceRace.raceId'sindeki (varsa)
 * Runner listesiyle isimden eşleştirir. raceId eşleşmesi yoksa (Accurace verisi
 * olan tarihte bizim Race kaydımız yoksa) o satır atlanır, hata sayılmaz.
 */
export async function matchAccuraceRunners(): Promise<{ toplam: number; eslesen: number }> {
  const eslesmemis = await db.accuraceHorseSplit.findMany({
    where: { runnerId: null },
    select: { id: true, horseName: true, accuraceRace: { select: { raceId: true } } },
  });

  const raceIds = [...new Set(eslesmemis.map((s) => s.accuraceRace.raceId).filter((id): id is string => !!id))];
  const runnersByRace = await db.runner.findMany({
    where: { raceId: { in: raceIds } },
    select: { id: true, name: true, raceId: true },
  });
  const runnersByRaceMap = new Map<string, { id: string; name: string }[]>();
  for (const r of runnersByRace) {
    const list = runnersByRaceMap.get(r.raceId) ?? [];
    list.push({ id: r.id, name: r.name });
    runnersByRaceMap.set(r.raceId, list);
  }

  let eslesen = 0;
  for (const s of eslesmemis) {
    const raceId = s.accuraceRace.raceId;
    if (!raceId) continue;
    const adaylar = runnersByRaceMap.get(raceId) ?? [];
    const eslesme = adaylar.find((r) => normalizeName(r.name) === normalizeName(s.horseName));
    if (!eslesme) continue;
    await db.accuraceHorseSplit.update({ where: { id: s.id }, data: { runnerId: eslesme.id } });
    eslesen++;
  }

  return { toplam: eslesmemis.length, eslesen };
}
