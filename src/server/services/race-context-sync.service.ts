// Race Context Invalidation Faz 1 (2026-09-21) — dar-kapsamlı fresh TJK sync. YENİ bir
// scraper YOK: discoverTurkishCities/fetchCityProgram/persistRaceDays'in AYNI, zaten
// çalışan üçlüsü — yalnız TÜM Türkiye günü yerine tek bir (hipodrom, tarih) çifti için
// çağrılıyor (agf-sync.ts'teki syncAgfForRace'in AYNI deseni, AGF-only yerine tüm kritik
// context alanlarını tazeleyecek şekilde).
import { db } from "@/lib/db";
import { discoverTurkishCities, fetchCityProgram, toSlug, toTjkDate, type CityInfo } from "./ingest/tjk-info.adapter";
import type { IngestRaceDay } from "./ingest/types";

export type SyncOutcome = { ok: true } | { ok: false; warning: string };

/** Fresh cevabın YAPISAL bütünlüğü — eski DB ile at SAYISI karşılaştırması YAPILMAZ
 * (bir atın koşmaz kalması/yeni at eklenmesi gerçek bir context farkıdır, "kısmi payload"
 * değil — bkz. plan PİVOT-3 madde 4). Yalnız cevabın kendi içinde tutarlı/parse edilebilir
 * olduğuna bakılır. */
function isStructurallyValid(program: IngestRaceDay, targetRaceNo?: number): boolean {
  if (!program || !Array.isArray(program.races) || program.races.length === 0) return false;
  for (const r of program.races) {
    if (r.raceNo == null || !r.classType || !r.surface || !r.distance) return false;
    if (!Array.isArray(r.runners) || r.runners.length === 0) return false;
    for (const run of r.runners) {
      if (run.no == null || !run.name) return false;
    }
  }
  if (targetRaceNo != null && !program.races.some((r) => r.raceNo === targetRaceNo)) return false;
  return true;
}

const cityCache = new Map<string, Promise<CityInfo[]>>();
function discoverCitiesCached(tjkDate: string): Promise<CityInfo[]> {
  const cached = cityCache.get(tjkDate);
  if (cached) return cached;
  const p = discoverTurkishCities(tjkDate);
  cityCache.set(tjkDate, p);
  return p;
}

/** Bir (hipodrom, tjkDate) çifti için dar-kapsamlı fresh sync. Aynı çift için tek bir
 * cron/istek turunda birden çok kez çağrılabilir (dedupe çağıran tarafta yapılmalı —
 * bkz. race-context-watch route'u); burada yalnız `discoverTurkishCities` sonucu
 * cache'lenir (aynı tjkDate için tekrarlanan TJK isteğini önlemek amacıyla). */
export async function syncCityProgramNarrow(
  hippodromeSlug: string,
  tjkDate: string,
  targetRaceNo?: number
): Promise<SyncOutcome> {
  let cities: CityInfo[];
  try {
    cities = await discoverCitiesCached(tjkDate);
  } catch (e) {
    return { ok: false, warning: `discoverTurkishCities hata: ${e instanceof Error ? e.message : String(e)}` };
  }
  const city = cities.find((c) => toSlug(c.sehirAdi) === hippodromeSlug);
  if (!city) return { ok: false, warning: `TJK program listesinde hipodrom bulunamadı: ${hippodromeSlug}` };

  let program: IngestRaceDay | null;
  try {
    program = await fetchCityProgram(city, tjkDate);
  } catch (e) {
    return { ok: false, warning: `fetchCityProgram hata: ${e instanceof Error ? e.message : String(e)}` };
  }
  if (!program || !isStructurallyValid(program, targetRaceNo)) {
    return { ok: false, warning: "TJK cevabı yapısal olarak eksik/geçersiz (SYNC_WARNING)" };
  }

  const { persistRaceDays } = await import("./ingest/base");
  await persistRaceDays([program]);
  return { ok: true };
}

/** Tek bir koşu için — raceId'den hipodrom/tarihi çözüp syncCityProgramNarrow'u çağırır.
 * `V5AnalysisPanel`'in "Analiz Et"/"Yeniden Analizi Aç" akışı VE `race-context-watch`
 * cron'u bunu paylaşır (plan Düzeltme #1: her ikisi de DB okumadan ÖNCE fresh sync yapar). */
export async function syncRaceProgramContext(raceId: string): Promise<SyncOutcome> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { raceNo: true, raceDay: { select: { date: true, hippodrome: { select: { slug: true } } } } },
  });
  if (!race) return { ok: false, warning: "Koşu bulunamadı" };
  const d = new Date(race.raceDay.date);
  d.setUTCHours(0, 0, 0, 0);
  const tjkDate = toTjkDate(d);
  return syncCityProgramNarrow(race.raceDay.hippodrome.slug, tjkDate, race.raceNo);
}
