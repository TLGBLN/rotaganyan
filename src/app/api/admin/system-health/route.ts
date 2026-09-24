import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import type { HealthStatus, SystemModuleHealth } from "@/lib/system-anatomy/types";
import { CRON_DECLARED, CRON_REGISTERED_SNAPSHOT } from "@/lib/system-anatomy/cron-registry";
import { SYSTEM_ANATOMY_NODES } from "@/lib/system-anatomy/registry";
import type { AgfSyncResult } from "@/server/services/agf-sync";
import type { IngestCityResult } from "@/server/services/ingest/tjk-info.adapter";

export const dynamic = "force-dynamic";
export const revalidate = 0;

type Status = HealthStatus;
type ModuleResult = SystemModuleHealth;

const nowIso = () => new Date().toISOString();

function ageMinutes(date?: Date | null) {
  if (!date) return null;
  return (Date.now() - date.getTime()) / 60_000;
}

async function databaseHealth(): Promise<ModuleResult> {
  try {
    const started = Date.now();
    await db.$queryRaw`SELECT 1`;
    const duration = Date.now() - started;

    return {
      id: "database",
      title: "VERİ OMURGASI",
      status: duration < 1000 ? "healthy" : "warning",
      description: "Postgres / Prisma bağlantısı",
      metrics: [{ label: "DB latency", value: duration, unit: "ms" }],
      checks: [{ id: "connection", label: "Database bağlantısı", ok: true, detail: `${duration} ms` }],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "database",
      title: "VERİ OMURGASI",
      status: "critical",
      description: "Postgres bağlantısı başarısız",
      metrics: [],
      checks: [{ id: "connection", label: "Database bağlantısı", ok: false }],
      errorMessage: error instanceof Error ? error.message : "Database error",
      lastCheckedAt: nowIso(),
    };
  }
}

// DÜZELTME (2026-09-23, kullanıcı bulgusu — panelin İLK GÜN yakaladığı P0 açık): flat
// "HOT stale>24h" tek eşiği yanıltıcıydı — 45 saat sonra koşacak bir atın 25 saatlik
// cache'i ile 45 dakika sonra koşacak atın 25 saatlik cache'i AYNI aciliyette değil.
// Artık URGENT(0-6s kalan)/NEAR(6-24s)/NEXT(24-48s) üçlü kırılımı ve HER BİRİNİN KENDİ
// SLA'sı kullanılıyor (getHotCacheHealthSnapshot — syncHorseStatsCache'in KENDİ urgency
// tanımlarını reuse ediyor, tek kaynak). Panel 15sn'de bir yenilendiği için bu fonksiyon
// SALT-OKUNUR — hiçbir TJK isteği/senkron TETİKLEMEZ.
async function cacheHealth(): Promise<ModuleResult> {
  try {
    const { getHotCacheHealthSnapshot } = await import("@/server/services/ingest/tjk-at-profil.adapter");
    const { urgency, churn } = await getHotCacheHealthSnapshot();

    const urgentStale = urgency.URGENT.stale;
    const nearNextStale = urgency.NEAR.stale + urgency.NEXT.stale;

    let status: Status = "healthy";
    if (urgentStale > 0) status = "critical";
    else if (nearNextStale > 0) status = "warning";

    const totalHot = urgency.URGENT.total + urgency.NEAR.total + urgency.NEXT.total;
    const totalStale = urgentStale + nearNextStale;

    return {
      id: "horse-cache",
      title: "AT PROFİL CACHE",
      status,
      description: "HOT yarış atlarının cache sağlığı (URGENT/NEAR/NEXT SLA)",
      metrics: [
        { label: "HOT toplam", value: totalHot },
        { label: "HOT stale", value: totalStale },
        { label: "Yeni HOT (son kontrolden beri)", value: churn.newSinceLastSync },
        { label: "URGENT (0-6s)", value: `${urgency.URGENT.total - urgency.URGENT.stale}/${urgency.URGENT.total}` },
        { label: "NEAR (6-24s)", value: `${urgency.NEAR.total - urgency.NEAR.stale}/${urgency.NEAR.total}` },
        { label: "NEXT (24-48s)", value: `${urgency.NEXT.total - urgency.NEXT.stale}/${urgency.NEXT.total}` },
      ],
      checks: [
        { id: "urgent", label: "URGENT (≤6s kalan yarış) SLA ≤6s cache yaşı", ok: urgency.URGENT.total === 0 ? null : urgentStale === 0, detail: `${urgency.URGENT.stale}/${urgency.URGENT.total} stale` },
        { id: "near", label: "NEAR (6-24s kalan) SLA ≤12s cache yaşı", ok: urgency.NEAR.total === 0 ? null : urgency.NEAR.stale === 0, detail: `${urgency.NEAR.stale}/${urgency.NEAR.total} stale` },
        { id: "next", label: "NEXT (24-48s kalan) SLA ≤24s cache yaşı", ok: urgency.NEXT.total === 0 ? null : urgency.NEXT.stale === 0, detail: `${urgency.NEXT.stale}/${urgency.NEXT.total} stale` },
        { id: "churn", label: "HOT churn (kök neden ipucu)", ok: null, detail: `${churn.newSinceLastSync} yeni HOT, son watchdog: ${churn.lastSyncAt ?? "hiç çalışmadı"}` },
      ],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "horse-cache",
      title: "AT PROFİL CACHE",
      status: "unknown",
      description: "Cache health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Cache health error",
      lastCheckedAt: nowIso(),
    };
  }
}

// 2026-09-23 — Cron sensörü (kullanıcının 2. gerçek sensör grubu olarak erken bağlanmasını
// istediği modül): HOT Cache Watchdog'un KENDİ `lastRunAt`'ı (HotCacheWatchdogState)
// zaten gerçek bir "cron çalıştı mı" sinyali — hem kendi ayrı cron rotası hem agf-sync
// piggyback'i bu alanı günceller, hangisi tetiklerse tetiklesin. 2 saatlik hedefin
// ~%25 üzerinde (2.5s) hâlâ güncellenmemişse HİÇBİR tetikleyicinin çalışmadığı anlamına
// gelir — Cache modülü kırmızıyken Cron da kırmızıysa kök neden neredeyse doğrudan
// "cron çalışmıyor", Cron yeşilken Cache kırmızıysa kök neden "cron çalışıyor ama
// yetişemiyor/başka bir şey" — ikisi BİRLİKTE teşhisi hızlandırır (kullanıcı talebi).
// 2026-09-23 (2. tur) — kullanıcı bulgusu: kod tarafı (yukarıdaki yaş kontrolü) doğru
// çalışıyor olsa bile, ASIL tetikleyici garanti kaynağı (kendi cron rotası) Vercel'e hiç
// kaydolmadıysa fiili cadence "declared" (2 saat) değil, yalnız agf-sync piggyback'inin
// (günde 4 kez) sağladığı ~6 saattir — bu da 6 saatlik URGENT SLA için sıfır güvenlik payı
// bırakır. "DECLARE → OBSERVE → COMPARE → ALARM" sırasıyla: declared (vercel.json, elle
// sabit), observed (recentRunsJson'dan GERÇEK ölçüm), registered (vercel crons ls'in en son
// ELLE doğrulanan anlık görüntüsü, cron-registry.ts) karşılaştırılır. Henüz hiçbir schedule
// DEĞİŞTİRİLMİYOR — yalnız ölçüm ve alarm.
function evaluateCronDrift(
  pathKey: string,
  observedH: number | null,
  opts: { urgentSlaHours?: number } = {}
): { status: Status; detail: string; observedLabel: string } {
  const declared = CRON_DECLARED[pathKey];
  const registered = CRON_REGISTERED_SNAPSHOT[pathKey];
  if (!declared || !registered) return { status: "unknown", detail: "Tanımsız cron", observedLabel: "-" };

  const observedLabel = observedH == null ? "yetersiz veri (<2 çalışma)" : `${observedH.toFixed(1)} saat`;

  let status: Status = "healthy";
  if (registered.status === "not_deployed") status = "warning";
  else if (registered.status === "modified") status = "warning";

  if (observedH != null) {
    if (opts.urgentSlaHours != null && observedH >= opts.urgentSlaHours) {
      status = "critical";
    } else if (observedH > declared.cadenceHours * 1.5) {
      status = "warning";
    }
  }

  const detail =
    `Declared: ${declared.humanCadence} · Observed: ${observedLabel} · Registered: ${registered.status} ` +
    `(${registered.checkedAt} elle doğrulandı) — ${registered.note}`;

  return { status, detail, observedLabel };
}

async function cronHealth(): Promise<ModuleResult> {
  try {
    const [state, agfState] = await Promise.all([
      db.hotCacheWatchdogState.findUnique({ where: { id: "singleton" } }),
      db.agfCronRunState.findUnique({ where: { id: "singleton" } }),
    ]);
    const { observedCadenceHours } = await import("@/server/services/ingest/tjk-at-profil.adapter");

    if (!state) {
      return {
        id: "cron",
        title: "CRON / SYNC",
        status: "warning",
        description: "HOT Cache Watchdog henüz hiç çalışmadı",
        metrics: [],
        checks: [{ id: "hot-watchdog", label: "HOT Cache Watchdog", ok: false, detail: "Kayıt yok" }],
        lastCheckedAt: nowIso(),
      };
    }

    const ageHours = ageMinutes(state.lastRunAt)! / 60;
    let status: Status = "healthy";
    if (ageHours > 2.5) status = "critical";
    else if (ageHours > 2) status = "warning";

    const hotObservedH = observedCadenceHours(state.recentRunsJson as string[] | null);
    const hotDrift = evaluateCronDrift("hot-cache-watchdog", hotObservedH, { urgentSlaHours: 6 });

    const agfObservedH = observedCadenceHours((agfState?.recentRunsJson as string[] | null) ?? null);
    const agfDrift = evaluateCronDrift("agf-sync", agfObservedH);

    const statusWeight: Record<Status, number> = { healthy: 0, unknown: 1, warning: 2, critical: 3 };
    if (statusWeight[hotDrift.status] > statusWeight[status]) status = hotDrift.status;
    if (statusWeight[agfDrift.status] > statusWeight[status]) status = agfDrift.status;

    return {
      id: "cron",
      title: "CRON / SYNC",
      status,
      description: "HOT Cache Watchdog cron akışı + Cron Config Drift (declared/observed/registered)",
      metrics: [
        { label: "Son HOT watchdog çalışması", value: `${ageHours.toFixed(1)} saat önce` },
        { label: "HOT watchdog — istenen cadence", value: "2 saat" },
        { label: "HOT watchdog — gözlemlenen cadence", value: hotDrift.observedLabel },
        { label: "AGF sync — gözlemlenen cadence", value: agfDrift.observedLabel },
      ],
      checks: [
        { id: "hot-watchdog", label: "HOT Cache Watchdog ≤2s içinde çalıştı", ok: ageHours <= 2.5, detail: state.lastRunAt.toISOString() },
        { id: "drift-hot-watchdog", label: "CRON CONFIG DRIFT — hot-cache-watchdog", ok: hotDrift.status === "healthy" ? true : hotDrift.status === "warning" ? null : false, detail: hotDrift.detail },
        { id: "drift-agf-sync", label: "CRON CONFIG DRIFT — agf-sync", ok: agfDrift.status === "healthy" ? true : agfDrift.status === "warning" ? null : false, detail: agfDrift.detail },
      ],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "cron",
      title: "CRON / SYNC",
      status: "unknown",
      description: "Cron health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Cron health error",
      lastCheckedAt: nowIso(),
    };
  }
}

// 2026-09-23 (2. tur) — AGF Sync sensörü. ÖNEMLİ AYRIM: AgfSyncState (raceDay bazlı) yalnız
// syncAgfForRaceInner'ın (analiz ekranı açılınca tetiklenen, TEK koşuluk) yazdığı tablo —
// /api/cron/agf-sync'in (syncAgfForDate, günde 4 kez, TÜM şehirler) kendi çalışma geçmişini
// YANSITMAZ. Bu yüzden CRON'un kendi health'i yeni AgfCronRunState singleton'ından okunuyor
// (bkz. agf-sync.ts:recordAgfCronRun) — "hedeflenen yarış" sayısı ise DB'den bağımsız olarak
// (bugünün sonuçlanmamış yarışları) ayrıca sorgulanıyor, cron'un kendi (muhtemelen eksik)
// raporuna güvenilmiyor.
async function agfSyncHealth(): Promise<ModuleResult> {
  try {
    const state = await db.agfCronRunState.findUnique({ where: { id: "singleton" } });

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const targetRaceCount = await db.race.count({
      where: { result: null, raceDay: { date: { gte: dayStart, lt: dayEnd } } },
    });

    if (!state) {
      return {
        id: "agf",
        title: "AGF / PİYASA",
        status: "warning",
        description: "AGF Sync cron'u henüz hiç çalışmadı",
        metrics: [{ label: "Bugün hedeflenen yarış (sonuçlanmamış)", value: targetRaceCount }],
        checks: [{ id: "agf-availability", label: "AGF Sync cron çalıştı", ok: false, detail: "Kayıt yok" }],
        lastCheckedAt: nowIso(),
      };
    }

    const { observedCadenceHours } = await import("@/server/services/ingest/tjk-at-profil.adapter");
    const observedH = observedCadenceHours((state.recentRunsJson as string[] | null) ?? null);
    const lastResult = state.lastResultJson as AgfSyncResult | null;
    const cities = lastResult?.cities ?? [];
    const okCities = cities.filter((c) => c.ok);
    const badCities = cities.filter((c) => !c.ok);
    const racesUpdated = cities.reduce((s, c) => s + c.racesUpdated, 0);
    const runnersUpdated = cities.reduce((s, c) => s + c.runnersUpdated, 0);
    const lastError = state.lastError ?? badCities.find((c) => c.error)?.error ?? null;

    // TJK/AGF etkinliği yalnız gün içi aktif saatlerde beklenir (declared schedule 09-18 UTC) —
    // gece boşluğunu (18→09 UTC, ~15 saat) yanlışlıkla "arıza" saymamak için gündüz/gece ayrımı.
    const hourUtc = new Date().getUTCHours();
    const activeHours = hourUtc >= 8 && hourUtc <= 20;
    const attemptAgeH = ageMinutes(state.lastAttemptAt) == null ? null : ageMinutes(state.lastAttemptAt)! / 60;
    const successAgeH = ageMinutes(state.lastSuccessAt) == null ? null : ageMinutes(state.lastSuccessAt)! / 60;

    let availabilityOk: boolean | null = null;
    let freshnessOk: boolean | null = null;
    let status: Status = "healthy";
    if (activeHours) {
      availabilityOk = attemptAgeH != null && attemptAgeH <= 8;
      freshnessOk = successAgeH != null && successAgeH <= 4;
      if (!availabilityOk) status = "critical";
      else if (!freshnessOk || badCities.length > 0) status = "warning";
    } else if (badCities.length > 0) {
      status = "warning";
    }

    return {
      id: "agf",
      title: "AGF / PİYASA",
      status,
      description: "AGF Sync cron'u (günde 4 kez, tüm şehirler) — availability/freshness/completeness/correctness",
      metrics: [
        { label: "Bugün hedeflenen yarış (sonuçlanmamış)", value: targetRaceCount },
        { label: "Son denemedeki şehir sayısı", value: cities.length },
        { label: "Başarılı şehir", value: okCities.length },
        { label: "Hatalı şehir", value: badCities.length },
        { label: "Güncellenen yarış (son çalışma)", value: racesUpdated },
        { label: "Güncellenen at/AGF (son çalışma)", value: runnersUpdated },
        { label: "Son deneme", value: state.lastAttemptAt ? `${attemptAgeH!.toFixed(1)} saat önce` : "hiç" },
        { label: "Son başarı", value: state.lastSuccessAt ? `${successAgeH!.toFixed(1)} saat önce` : "hiç" },
        { label: "Gözlemlenen cadence", value: observedH == null ? "yetersiz veri" : `${observedH.toFixed(1)} saat` },
        ...(lastError ? [{ label: "Son hata", value: lastError }] : []),
      ],
      checks: [
        { id: "agf-availability", label: "Cron aktif saatlerde çalıştı (≤8s)", ok: activeHours ? availabilityOk : null, detail: activeHours ? `${attemptAgeH?.toFixed(1) ?? "-"} saat önce` : "gece modu — beklenen boşluk" },
        { id: "agf-freshness", label: "Son başarılı sync taze (≤4s)", ok: activeHours ? freshnessOk : null, detail: activeHours ? `${successAgeH?.toFixed(1) ?? "-"} saat önce` : "gece modu — beklenen boşluk" },
        { id: "agf-completeness", label: "Tüm şehirler başarılı", ok: cities.length === 0 ? null : badCities.length === 0, detail: `${okCities.length}/${cities.length} şehir OK` },
        { id: "agf-correctness", label: "Son çalışmada hata yok", ok: lastError == null, detail: lastError ?? "hata yok" },
      ],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "agf",
      title: "AGF / PİYASA",
      status: "unknown",
      description: "AGF Sync health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "AGF sync error",
      lastCheckedAt: nowIso(),
    };
  }
}

// 2026-09-24 — Program Sync sensörü (kullanıcı spesifikasyonu). Dört eksen:
// Availability (ProgramCronRunState — cron GERÇEKTEN çalıştı mı), Freshness (son başarılı
// çalışma yaşı, cadence'e GÖRELİ eşik — sabit "6 saat" değil), Completeness (source vs
// stored race/runner sayıları — cron'un "başarılı" demesine güvenilmez, DB'de GERÇEKTEN ne
// var CANLI sorgulanır), Correctness (duplicate raceNo/runner, 0-runner yarış, eksik
// startTime, eksik tjkAtId oranı). "Kaynak" sayı yalnız TÜM şehirler ok:true ise güvenilir —
// bir şehir hata verdiyse completeness PARTIAL_OBSERVABILITY (unknown), sahte kırmızı/yeşil
// üretilmez.
async function programSyncHealth(): Promise<ModuleResult> {
  try {
    const state = await db.programCronRunState.findUnique({ where: { id: "singleton" } });

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const tomorrowStart = new Date(dayStart);
    tomorrowStart.setUTCDate(tomorrowStart.getUTCDate() + 1);
    const dayAfterTomorrow = new Date(tomorrowStart);
    dayAfterTomorrow.setUTCDate(dayAfterTomorrow.getUTCDate() + 1);

    if (!state) {
      return {
        id: "program",
        title: "PROGRAM",
        status: "warning",
        description: "Program Sync cron'u henüz hiç çalışmadı",
        metrics: [],
        checks: [{ id: "program-availability", label: "Program Sync cron çalıştı", ok: false, detail: "Kayıt yok" }],
        lastCheckedAt: nowIso(),
      };
    }

    const declared = CRON_DECLARED["ingest-program"]!;
    const attemptAgeH = ageMinutes(state.lastAttemptAt) == null ? null : ageMinutes(state.lastAttemptAt)! / 60;
    const successAgeH = ageMinutes(state.lastSuccessAt) == null ? null : ageMinutes(state.lastSuccessAt)! / 60;

    // TJK program güncellemeleri yalnız gün içi (declared: 05-17 UTC) beklenir — 17→05
    // arasındaki ~12s doğal boşluğu "arıza" saymamak için gündüz/gece ayrımı (AGF'deki
    // AYNI desen).
    const hourUtc = new Date().getUTCHours();
    const activeHours = hourUtc >= 4 && hourUtc <= 19;
    const healthyMaxH = declared.cadenceHours * 1.25;
    const warningMaxH = declared.cadenceHours * 2;

    let availabilityOk: boolean | null = null;
    let freshnessLevel: Status = "healthy";
    if (activeHours) {
      availabilityOk = attemptAgeH != null && attemptAgeH <= warningMaxH;
      if (successAgeH == null || successAgeH > warningMaxH) freshnessLevel = "critical";
      else if (successAgeH > healthyMaxH) freshnessLevel = "warning";
    }

    // Completeness — source (son BAŞARILI ingest'in raporladığı) vs stored (DB'de CANLI).
    const lastResult = state.lastResultJson as { today: { date: string; cities: IngestCityResult[] }; tomorrow: { date: string; cities: IngestCityResult[] } } | null;
    const buildCompleteness = async (
      label: "today" | "tomorrow",
      windowStart: Date,
      windowEnd: Date,
      cities: IngestCityResult[] | undefined
    ) => {
      const [storedRaces, storedRunners, storedHippodromes] = await Promise.all([
        db.race.count({ where: { raceDay: { date: { gte: windowStart, lt: windowEnd } } } }),
        db.runner.count({ where: { race: { raceDay: { date: { gte: windowStart, lt: windowEnd } } } } }),
        db.raceDay.count({ where: { date: { gte: windowStart, lt: windowEnd } } }),
      ]);
      if (!cities) return { label, observable: false as const, storedRaces, storedRunners, storedHippodromes };
      const allOk = cities.every((c) => c.ok);
      const sourceRaces = cities.reduce((s, c) => s + c.races, 0);
      const sourceRunners = cities.reduce((s, c) => s + c.runners, 0);
      const sourceHippodromes = cities.length;
      return {
        label,
        observable: allOk as boolean,
        sourceRaces,
        sourceRunners,
        sourceHippodromes,
        storedRaces,
        storedRunners,
        storedHippodromes,
        failedCities: cities.filter((c) => !c.ok).map((c) => `${c.sehirAdi}${c.error ? `: ${c.error}` : ""}`),
      };
    };

    const [todayCompleteness, tomorrowCompleteness] = await Promise.all([
      buildCompleteness("today", dayStart, tomorrowStart, lastResult?.today.cities),
      buildCompleteness("tomorrow", tomorrowStart, dayAfterTomorrow, lastResult?.tomorrow.cities),
    ]);

    // Correctness — CANLI DB doğrulaması, cron'un raporuna bağımlı DEĞİL.
    const [todayRaceRows, tomorrowRaceRows, todayRunnerCounts, tomorrowRunnerCounts, activeRunnerStats] = await Promise.all([
      db.race.findMany({ where: { raceDay: { date: { gte: dayStart, lt: tomorrowStart } } }, select: { id: true, raceDayId: true, raceNo: true, time: true } }),
      db.race.findMany({ where: { raceDay: { date: { gte: tomorrowStart, lt: dayAfterTomorrow } } }, select: { id: true, raceDayId: true, raceNo: true, time: true } }),
      db.runner.groupBy({ by: ["raceId"], where: { race: { raceDay: { date: { gte: dayStart, lt: tomorrowStart } } } }, _count: { id: true } }),
      db.runner.groupBy({ by: ["raceId"], where: { race: { raceDay: { date: { gte: tomorrowStart, lt: dayAfterTomorrow } } } }, _count: { id: true } }),
      db.runner.aggregate({
        where: { scratched: false, race: { raceDay: { date: { gte: dayStart, lt: dayAfterTomorrow } } } },
        _count: { id: true },
      }),
    ]);
    const missingTjkAtId = await db.runner.count({
      where: { scratched: false, tjkAtId: null, race: { raceDay: { date: { gte: dayStart, lt: dayAfterTomorrow } } } },
    });

    const allRaces = [...todayRaceRows, ...tomorrowRaceRows];
    const raceNoKey = (r: { raceDayId: string; raceNo: number }) => `${r.raceDayId}#${r.raceNo}`;
    const raceNoCounts = new Map<string, number>();
    for (const r of allRaces) raceNoCounts.set(raceNoKey(r), (raceNoCounts.get(raceNoKey(r)) ?? 0) + 1);
    const duplicateRaceNoCount = [...raceNoCounts.values()].filter((c) => c > 1).length;

    const runnerCountByRace = new Map<string, number>();
    for (const g of [...todayRunnerCounts, ...tomorrowRunnerCounts]) runnerCountByRace.set(g.raceId, g._count.id);
    const zeroRunnerRaces = allRaces.filter((r) => (runnerCountByRace.get(r.id) ?? 0) === 0).length;
    const missingStartTime = allRaces.filter((r) => !r.time).length;

    const activeRunnerTotal = activeRunnerStats._count.id;
    const identityMissingRate = activeRunnerTotal > 0 ? missingTjkAtId / activeRunnerTotal : 0;

    // Genel durum: freshness kritikse kritik; completeness gözlemlenebilir VE eksikse
    // (kaynak≠depo) uyarı; correctness anomalileri (duplicate/0-runner) uyarı.
    const completenessIssues =
      (todayCompleteness.observable && "sourceRaces" in todayCompleteness && todayCompleteness.sourceRaces !== todayCompleteness.storedRaces) ||
      (tomorrowCompleteness.observable && "sourceRaces" in tomorrowCompleteness && tomorrowCompleteness.sourceRaces !== tomorrowCompleteness.storedRaces);
    const correctnessIssues = duplicateRaceNoCount > 0 || zeroRunnerRaces > 0 || missingStartTime > 0 || identityMissingRate > 0.05;

    let status: Status = freshnessLevel;
    if (activeHours && availabilityOk === false) status = "critical";
    if (status !== "critical" && (completenessIssues || correctnessIssues)) status = "warning";

    const fmtCompleteness = (c: Awaited<ReturnType<typeof buildCompleteness>>) => {
      if (!c.observable || !("sourceRaces" in c)) return `${c.storedRaces} yarış (kaynak gözlemlenemedi)`;
      return `${c.storedRaces}/${c.sourceRaces} yarış · ${c.storedRunners}/${c.sourceRunners} koşucu · ${c.storedHippodromes}/${c.sourceHippodromes} hipodrom`;
    };

    return {
      id: "program",
      title: "PROGRAM",
      status,
      description: "Program Sync cron'u (bugün+yarın) — availability/freshness/completeness/correctness",
      metrics: [
        { label: "Son deneme", value: attemptAgeH == null ? "hiç" : `${attemptAgeH.toFixed(1)} saat önce` },
        { label: "Son başarı", value: successAgeH == null ? "hiç" : `${successAgeH.toFixed(1)} saat önce` },
        { label: "İstenen cadence", value: declared.humanCadence },
        { label: "Son çalışma süresi", value: state.lastDurationMs == null ? "-" : `${(state.lastDurationMs / 1000).toFixed(1)} sn` },
        { label: "Bugün", value: fmtCompleteness(todayCompleteness) },
        { label: "Yarın", value: fmtCompleteness(tomorrowCompleteness) },
        { label: "Duplicate raceNo", value: duplicateRaceNoCount },
        { label: "0-runner yarış", value: zeroRunnerRaces },
        { label: "Eksik startTime", value: missingStartTime },
        { label: "tjkAtId eksik oranı", value: `${missingTjkAtId}/${activeRunnerTotal} (%${(identityMissingRate * 100).toFixed(1)})` },
        ...(state.lastError ? [{ label: "Son hata", value: state.lastError }] : []),
      ],
      checks: [
        { id: "program-availability", label: "Cron aktif saatlerde çalıştı", ok: activeHours ? availabilityOk : null, detail: activeHours ? `${attemptAgeH?.toFixed(1) ?? "-"} saat önce` : "gece modu — beklenen boşluk" },
        { id: "program-freshness-today", label: "Bugünkü program taze", ok: activeHours ? freshnessLevel === "healthy" : null, detail: successAgeH == null ? "hiç başarılı çalışma yok" : `${successAgeH.toFixed(1)} saat önce (eşik ${healthyMaxH.toFixed(1)}/${warningMaxH.toFixed(1)}s)` },
        {
          id: "program-completeness",
          label: "Kaynak = Depo (yarış/koşucu/hipodrom)",
          ok: !todayCompleteness.observable || !tomorrowCompleteness.observable ? null : !completenessIssues,
          detail: `Bugün: ${fmtCompleteness(todayCompleteness)}${!todayCompleteness.observable ? " [PARTIAL_OBSERVABILITY]" : ""} · Yarın: ${fmtCompleteness(tomorrowCompleteness)}${!tomorrowCompleteness.observable ? " [PARTIAL_OBSERVABILITY]" : ""}`,
        },
        { id: "program-correctness", label: "Mantıksal bütünlük (duplicate/0-runner/eksik alan)", ok: !correctnessIssues, detail: `duplicate raceNo=${duplicateRaceNoCount}, 0-runner=${zeroRunnerRaces}, eksik startTime=${missingStartTime}, tjkAtId eksik=%${(identityMissingRate * 100).toFixed(1)}` },
      ],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "program",
      title: "PROGRAM",
      status: "unknown",
      description: "Program Sync health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Program sync error",
      lastCheckedAt: nowIso(),
    };
  }
}

// DÜZELTME (2026-09-23): ChallengerRun'da `createdAt` alanı YOK — gerçek alan `computedAt`
// (bkz. prisma/schema.prisma:564). Yanlış alan adı build'i kırardı.
async function challengerHealth(): Promise<ModuleResult> {
  try {
    const latest = await db.challengerRun.findFirst({ orderBy: { computedAt: "desc" } });

    if (!latest) {
      return {
        id: "challenger",
        title: "SHADOW / CHALLENGER",
        status: "warning",
        description: "Henüz ChallengerRun yok",
        metrics: [],
        checks: [{ id: "shadow", label: "Shadow veri akışı", ok: false, detail: "Kayıt bulunamadı" }],
        lastCheckedAt: nowIso(),
      };
    }

    const age = ageMinutes(latest.computedAt);
    const recent = age != null && age < 24 * 60;

    return {
      id: "challenger",
      title: "SHADOW / CHALLENGER",
      status: recent ? "healthy" : "warning",
      description: "C1 ve diğer challenger akışı",
      metrics: [{ label: "Son kayıt", value: age == null ? "-" : age < 60 ? `${age.toFixed(0)} dk` : `${(age / 60).toFixed(1)} saat` }],
      checks: [{ id: "shadow-live", label: "ChallengerRun akışı", ok: recent, detail: latest.computedAt.toISOString() }],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "challenger",
      title: "SHADOW / CHALLENGER",
      status: "unknown",
      description: "Shadow health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Shadow error",
      lastCheckedAt: nowIso(),
    };
  }
}

async function predictionHealth(): Promise<ModuleResult> {
  try {
    const latest = await db.prediction.findFirst({
      where: { published: true },
      orderBy: { createdAt: "desc" },
      select: { id: true, createdAt: true },
    });

    if (!latest) {
      return {
        id: "engine",
        title: "TAHMİN MOTORU",
        status: "critical",
        description: "Published prediction yok",
        metrics: [],
        checks: [{ id: "prediction", label: "Tahmin üretimi", ok: false }],
        lastCheckedAt: nowIso(),
      };
    }

    return {
      id: "engine",
      title: "TAHMİN MOTORU",
      status: "healthy",
      description: "V5.46 Champion",
      metrics: [
        { label: "Motor", value: "V5.46" },
        { label: "Son prediction", value: latest.createdAt.toISOString() },
      ],
      checks: [{ id: "prediction", label: "Prediction sistemi", ok: true }],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "engine",
      title: "TAHMİN MOTORU",
      status: "unknown",
      description: "Prediction health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Prediction error",
      lastCheckedAt: nowIso(),
    };
  }
}

// DÜZELTME (2026-09-23) — kullanıcının kendi ilkesiyle çelişiyordu: "sistem ölçemediği
// bir şeyi yeşil göstermiyor" dendi ama orijinal `simpleHealthy()` ölçülmeyen 9 modülü
// doğrudan "healthy" (yeşil) damgalıyordu. Artık "unknown" (gri, Bağlanmadı) — sahte
// "her şey yolunda" ekranı kurulmuyor. Bir sonraki turda gerçek sensör bağlanınca
// bu fonksiyonun çağrıları teker teker gerçek health-check'lerle değiştirilecek.
function unmeasuredModule(id: string, title: string, description: string): ModuleResult {
  return {
    id,
    title,
    status: "unknown",
    description: `${description} — henüz gerçek telemetriye bağlanmadı`,
    metrics: [],
    checks: [{ id: `${id}-base`, label: "Gerçek sensör", ok: null, detail: "Bağlanmadı" }],
    lastCheckedAt: nowIso(),
  };
}

// 2026-09-24 — Dependency Propagation temeli (kullanıcı talebi: "Program sensörüyle birlikte
// bu altyapının temelini şimdi kur"). registry.ts'teki `dependencies` grafiği üzerinde
// topolojik sırayla ilerler: her modülün NİHAİ durumu, kendi sensörünün ölçtüğü `selfStatus`
// ile bağımlılıklarının NİHAİ durumundan sızan `dependencyStatus`'un birleşimidir.
//
// Kasıtlı tasarım kararları:
// - `unknown` (henüz ölçülmeyen) bağımlılıklar PROPAGATE OLMAZ — şu an çoğu modül henüz
//   sensöre bağlı değil, "unknown" sızdırılsaydı TÜM panel gürültüyle dolardı. Yalnız
//   warning/critical sızar.
// - Bir bağımlılığın warning/critical olması bağımlıyı doğrudan critical YAPMAZ, yalnız
//   "warning/DEGRADED" statüsüne çeker — "kalp çalışıyor ama kan gelmiyorsa sorun kalpte
//   değildir" ilkesi. Yalnız modülün KENDİ sensörü critical derse nihai durum critical olur.
function propagateDependencies(modules: ModuleResult[]): ModuleResult[] {
  const byId = new Map(modules.map((m) => [m.id, m]));
  const propagationWeight: Record<Status, number> = { healthy: 0, unknown: 0, warning: 1, critical: 2 };

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, string[]>(); // dep id -> [modules that depend on it]
  for (const node of SYSTEM_ANATOMY_NODES) {
    inDegree.set(node.id, (node.dependencies ?? []).length);
    for (const dep of node.dependencies ?? []) {
      if (!dependents.has(dep)) dependents.set(dep, []);
      dependents.get(dep)!.push(node.id);
    }
  }

  const queue: string[] = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
  const order: string[] = [];
  const remaining = new Map(inDegree);
  while (queue.length > 0) {
    const id = queue.shift()!;
    order.push(id);
    for (const dependent of dependents.get(id) ?? []) {
      remaining.set(dependent, remaining.get(dependent)! - 1);
      if (remaining.get(dependent) === 0) queue.push(dependent);
    }
  }

  const nodesById = new Map(SYSTEM_ANATOMY_NODES.map((n) => [n.id, n]));
  const overallById = new Map<string, Status>();
  for (const id of order) {
    const mod = byId.get(id);
    const selfStatus: Status = mod?.status ?? "unknown";
    let dependencyStatus: Status | null = null;
    for (const dep of nodesById.get(id)?.dependencies ?? []) {
      const depOverall = overallById.get(dep) ?? "unknown";
      if (propagationWeight[depOverall] > 0 && (dependencyStatus == null || propagationWeight[depOverall] > propagationWeight[dependencyStatus])) {
        dependencyStatus = depOverall;
      }
    }

    let finalStatus: Status;
    let degradedByDependency = false;
    if (selfStatus === "critical") {
      finalStatus = "critical";
    } else if (dependencyStatus === "critical" || dependencyStatus === "warning") {
      finalStatus = "warning";
      degradedByDependency = true;
    } else {
      finalStatus = selfStatus;
    }

    overallById.set(id, finalStatus);
    if (mod) {
      mod.selfStatus = selfStatus;
      mod.dependencyStatus = dependencyStatus;
      mod.degradedByDependency = degradedByDependency;
      mod.status = finalStatus;
    }
  }

  // Registry'de tanımsız bir modül (olmamalı) — dokunma, yalnız selfStatus'u yansıt.
  for (const mod of modules) {
    if (!overallById.has(mod.id)) mod.selfStatus = mod.status;
  }

  return modules;
}

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const results = await Promise.allSettled([
    databaseHealth(),
    cacheHealth(),
    challengerHealth(),
    predictionHealth(),
    cronHealth(),
    agfSyncHealth(),
    programSyncHealth(),
  ]);

  const modules: ModuleResult[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") modules.push(result.value);
  }

  // Henüz gerçek sensörü olmayan modüller — bkz. unmeasuredModule notu.
  modules.push(unmeasuredModule("data-source", "VERİ TOPLAMA", "TJK / program / yarış verileri"));
  modules.push(unmeasuredModule("results", "SONUÇLAR", "Yarış sonuçları"));
  modules.push(unmeasuredModule("coupon", "KUPON ÜRETİMİ", "Kupon oluşturma"));
  modules.push(unmeasuredModule("calibration", "KALİBRASYON", "Probability calibration"));
  modules.push(unmeasuredModule("site", "SITE / API", "Web ve API"));
  modules.push(unmeasuredModule("model-health", "MODEL SAĞLIĞI", "Model monitoring"));

  propagateDependencies(modules);

  const statusWeight: Record<Status, number> = { healthy: 0, unknown: 1, warning: 2, critical: 3 };

  let overallStatus: Status = "healthy";
  for (const mod of modules) {
    if (statusWeight[mod.status] > statusWeight[overallStatus]) overallStatus = mod.status;
  }

  const count = (status: Status) => modules.filter((x) => x.status === status).length;

  return NextResponse.json({
    overallStatus,
    checkedAt: nowIso(),
    healthy: count("healthy"),
    warning: count("warning"),
    critical: count("critical"),
    unknown: count("unknown"),
    modules,
  });
}
