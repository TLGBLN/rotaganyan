// ═══════════════════════════════════════════════════════════════════════════════════
// KALICI İLKE (2026-09-24, kullanıcı kararı — dondurulmuş mimari kural):
//
//   HEALTH STATUS ≠ ANALYSIS BLOCK
//
// Bu dosyadaki (ve tüm Sistem Anatomisi panelinin) status'u (healthy/warning/critical/
// unknown) SALT-GÖZLEMSELDİR — hiçbir sensör, hiçbir status değeri, canlı analiz/tahmin/
// kupon üretim akışını (v5-engine.ts, upsertPrediction, syncHomeKupon, vb.) DURDURMAZ,
// ENGELLEMEZ, GATE ETMEZ. Doğrulandı: bu dosyaya hiçbir live-path dosyası (server/actions,
// lib/methodology, api/ingest) import/referans VERMİYOR — panel yalnız OKUYOR, hiçbir yere
// YAZMIYOR/KARAR VERMİYOR. "Anatomy is observability-first, not gate-first."
//
// Kullanıcının önerdiği kavramsal katman (bu dosyada AYRI bir `OperationalDecision` tipi
// olarak KODLANMADI — çünkü zaten hiçbir decision-tüketen kod yok; gelecekte biri eklenirse
// bu yorum onun sözleşmesidir):
//   - "healthy"/"warning" (kullanıcının "degraded"ı)  → decision: continue
//   - "critical" (kullanıcının "alert"ı)               → decision: continue_with_warning
//     (Result Sync gecikmesi, HOT cache %92 taze gibi — GERÇEK sorun ama analiz üretimi
//     bunun girdisi DEĞİL, üretim durmamalı.)
//   - "unknown"                                        → decision: continue (bilgi eksik,
//     bu tek başına asla blocker değildir)
//   - Yalnız aşağıdaki 6 durum teorik bir "block" gerektirir — VE bunlar zaten Sistem
//     Anatomisi'nin İCAT ETTİĞİ bir mekanizma DEĞİL, live koddaki (v5-engine.ts, Prisma
//     çağrıları) MEVCUT try/catch'lerin doğal sonucudur (fonksiyon zaten throw/return
//     eder, bir "prediction" hiç üretilmez) — Sistem Anatomisi bunu yalnız GÖZLEMLER,
//     ayrıca bir gate EKLEMEZ:
//       1. Model hesaplama exception'ı / analiz tamamlanamıyor
//       2. Probability NaN/Infinity
//       3. Probability sum ciddi bozuk
//       4. Runner-pick eşleşmesi bozuk (prediction'ın kendi runner listesiyle uyuşmuyor)
//       5. Program/race identity yok (koşu DB'de bulunamıyor)
//       6. Kritik DB erişimi tamamen yok
//
// Dependency propagation da AYNI ilkeye uyar: bir bağımlılık warning/critical olduğunda
// dependent'ın kendi selfStatus'u DEĞİL yalnız `dependencyStatus`/`degradedByDependency`
// alanları değişir (bkz. propagateDependencies() aşağıda) — "Model çalışıyor ama veri
// kalitesi ideal değil" mesajı budur, "model durduruldu" DEĞİL.
//
// Aşağıdaki Chaos Test katmanı (SystemHealthTestOverride) da BU İLKEYE tabidir: yalnız
// PANELİN GÖSTERDİĞİ status'u geçici olarak zorlar, gerçek sensör hesaplamasını veya canlı
// pipeline'ı HİÇ ETKİLEMEZ — bir chaos testi aktifken bile analiz/tahmin/kupon üretimi
// tamamen normal çalışmaya devam eder.
// ═══════════════════════════════════════════════════════════════════════════════════

import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import type { HealthStatus, SystemModuleHealth, OperationalDecision } from "@/lib/system-anatomy/types";
import { CRON_DECLARED, CRON_REGISTERED_SNAPSHOT } from "@/lib/system-anatomy/cron-registry";
import { SYSTEM_ANATOMY_NODES } from "@/lib/system-anatomy/registry";
import type { AgfSyncResult } from "@/server/services/agf-sync";
import type { IngestCityResult } from "@/server/services/ingest/tjk-info.adapter";
import { pencereOzeti, type SonucSatiri } from "@/server/services/analiz-performans.service";
import { ENGINE_VERSIONS } from "@/lib/methodology/engine-versions.data";
import { evaluateChallengerRuns } from "@/server/services/challenger-evaluation.service";
import {
  softmax,
  softmaxHam,
  liderEsigiHesapla,
  ASIRI_GUVEN_LIDER_ESIGI,
  ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP,
  ASIRI_GUVEN_SICAKLIGI,
} from "@/lib/methodology/v5-engine";
import { kategoriTespit } from "@/lib/methodology/v2-engine";
import { turkeyDateString } from "@/lib/tz";
import { buildKuponOnerisi, stakeForHippodromeLabel } from "@/server/services/race.service";
import { chunkIntoAltili, sonYediKosu, YEDILI_GANYAN_SLOT } from "@/lib/methodology/kupon-auto-fill";
import { optimizerConfigFor } from "@/server/services/home-kupon-sync.service";

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

// 2026-09-24 — Result Sync sensörü (kullanıcı spesifikasyonu). "Cron HTTP 200 = HEALTHY
// değil" ilkesi burada tam uygulanıyor: Availability yalnız ResultSyncCronRunState'ten
// (cron GERÇEKTEN çalıştı mı) gelir, Completeness ise CANLI DB'den (tamamlanmış yarış vs
// Result satırı) — cron başarıyla dönse bile 12 hedeften 9'u geldiyse Completeness KIRMIZI
// olur, Availability'nin yeşil olması bunu MASKELEMEZ. "Tamamlanmış yarış" = raceStart +
// RESULT_EXPECTED_BUFFER_MS (20dk — yarış süresi + jüri incelemesi + PendingResult'ın 2
// ardışık cron turuyla doğrulanma penceresi) geçmiş yarış; bu buffer'dan ÖNCE Result
// olmaması normaldir, alarm SAYILMAZ.
const RESULT_EXPECTED_BUFFER_MS = 20 * 60_000;
const RESULT_CRITICAL_MISSING_MS = 30 * 60_000; // kullanıcının kendi örneği: 20-30 dk sonra hâlâ yoksa alarm

async function resultSyncHealth(): Promise<ModuleResult> {
  try {
    const { poolStartTime } = await import("@/lib/methodology/kupon-dependency-hash");
    const state = await db.resultSyncCronRunState.findUnique({ where: { id: "singleton" } });

    const dayStart = new Date();
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(dayStart);
    dayEnd.setUTCDate(dayEnd.getUTCDate() + 1);
    const dateIso = dayStart.toISOString().slice(0, 10);
    const now = Date.now();

    const races = await db.race.findMany({
      where: { raceDay: { date: { gte: dayStart, lt: dayEnd } } },
      select: {
        id: true,
        raceNo: true,
        time: true,
        raceDay: { select: { hippodrome: { select: { name: true } } } },
        runners: { select: { no: true, scratched: true } },
        result: { select: { id: true, winnerNo: true, winnerNos: true, actualOrder: true, enteredAt: true } },
      },
    });

    type RaceRow = (typeof races)[number];
    const raceStart = (r: RaceRow) => poolStartTime(dateIso, [r.time]);
    const isCompleted = (r: RaceRow) => {
      const start = raceStart(r);
      return start != null && now - start.getTime() >= RESULT_EXPECTED_BUFFER_MS;
    };

    const completedRaces = races.filter(isCompleted);
    const resultedRaces = completedRaces.filter((r) => r.result != null);
    const missing = completedRaces.filter((r) => r.result == null);
    const missingRaceIds = missing.map((r) => `${r.raceDay.hippodrome.name} K${r.raceNo}`);
    const oldestMissingResultAgeMin =
      missing.length === 0
        ? 0
        : Math.max(...missing.map((r) => (now - raceStart(r)!.getTime() - RESULT_EXPECTED_BUFFER_MS) / 60_000));

    // Ortalama sonuç gecikmesi — YALNIZ zaten sonuçlanmış yarışlardan (freshness, tarihsel görünüm).
    const lagsMin = races
      .filter((r) => r.result != null)
      .map((r) => {
        const start = raceStart(r);
        if (!start) return null;
        return (r.result!.enteredAt.getTime() - start.getTime()) / 60_000;
      })
      .filter((x): x is number => x != null);
    const avgLagMin = lagsMin.length === 0 ? null : lagsMin.reduce((s, x) => s + x, 0) / lagsMin.length;

    // Correctness — CANLI doğrulama, cron'un "başarılı" dediğine bağımlı DEĞİL.
    let winnerMissing = 0;
    let duplicateFinishPosition = 0;
    let invalidFinishPosition = 0;
    let scratchedButPlaced = 0;
    let runnerCountMismatch = 0;
    for (const r of races) {
      if (!r.result) continue;
      const validNos = new Set(r.runners.map((x) => x.no));
      const scratchedNos = new Set(r.runners.filter((x) => x.scratched).map((x) => x.no));
      const order = Array.isArray(r.result.actualOrder) ? (r.result.actualOrder as number[]) : [];

      if (r.result.winnerNo == null || r.result.winnerNos.length === 0) winnerMissing++;
      if (new Set(order).size !== order.length) duplicateFinishPosition++;
      if (order.some((no) => !validNos.has(no))) invalidFinishPosition++;
      if (order.some((no) => scratchedNos.has(no)) || r.result.winnerNos.some((no) => scratchedNos.has(no))) scratchedButPlaced++;
      const nonScratchedCount = r.runners.filter((x) => !x.scratched).length;
      if (Math.abs(order.length - nonScratchedCount) > 2) runnerCountMismatch++;
    }
    const correctnessIssues = winnerMissing + duplicateFinishPosition + invalidFinishPosition + scratchedButPlaced + runnerCountMismatch > 0;

    const declared = CRON_DECLARED["result-sync"]!;
    const attemptAgeMin = ageMinutes(state?.lastAttemptAt);
    const successAgeMin = ageMinutes(state?.lastSuccessAt);
    const hourUtc = new Date().getUTCHours();
    const activeHours = hourUtc >= 11 && hourUtc <= 21;
    const availabilityOk = activeHours ? attemptAgeMin != null && attemptAgeMin <= 20 : null;

    const observedH = (await import("@/server/services/ingest/tjk-at-profil.adapter")).observedCadenceHours((state?.recentRunsJson as string[] | null) ?? null);
    const drift = evaluateCronDrift("result-sync", observedH);

    let status: Status = "healthy";
    if (activeHours && availabilityOk === false) status = "critical";
    if (status !== "critical" && oldestMissingResultAgeMin > RESULT_CRITICAL_MISSING_MS / 60_000) status = "critical";
    if (status !== "critical" && (missing.length > 0 || correctnessIssues)) status = "warning";

    return {
      id: "results",
      title: "SONUÇLAR",
      status,
      description: "Result Sync cron'u (5dk'da bir) — availability/freshness/completeness/correctness",
      metrics: [
        { label: "Son deneme", value: state?.lastAttemptAt ? `${attemptAgeMin!.toFixed(0)} dk önce` : "hiç" },
        { label: "Son başarı", value: state?.lastSuccessAt ? `${successAgeMin!.toFixed(0)} dk önce` : "hiç" },
        { label: "Son çalışma süresi", value: state?.lastDurationMs == null ? "-" : `${(state.lastDurationMs / 1000).toFixed(1)} sn` },
        { label: "Gözlemlenen cadence", value: drift.observedLabel },
        { label: "Tamamlanan yarış", value: completedRaces.length },
        { label: "Sonucu gelen", value: resultedRaces.length },
        { label: "Eksik", value: missing.length },
        { label: "En eski eksik sonuç", value: missing.length === 0 ? "-" : `${oldestMissingResultAgeMin.toFixed(0)} dk` },
        ...(missingRaceIds.length > 0 ? [{ label: "Eksik yarışlar", value: missingRaceIds.join(", ") }] : []),
        { label: "Ortalama sonuç gecikmesi", value: avgLagMin == null ? "-" : `${avgLagMin.toFixed(0)} dk` },
        { label: "Kazanan eksik", value: winnerMissing },
        { label: "Duplicate sıra", value: duplicateFinishPosition },
        { label: "Geçersiz at no (sırada)", value: invalidFinishPosition },
        { label: "Çekilmiş at sırada", value: scratchedButPlaced },
        { label: "Koşucu sayısı uyuşmazlığı", value: runnerCountMismatch },
        ...(state?.lastError ? [{ label: "Son hata", value: state.lastError }] : []),
      ],
      checks: [
        { id: "result-availability", label: "Cron aktif saatlerde çalıştı (≤20dk)", ok: availabilityOk, detail: activeHours ? `${attemptAgeMin?.toFixed(0) ?? "-"} dk önce` : "gece modu — beklenen boşluk" },
        {
          id: "result-freshness",
          label: "En eski eksik sonuç kabul edilebilir aralıkta",
          ok: missing.length === 0 ? true : oldestMissingResultAgeMin <= RESULT_CRITICAL_MISSING_MS / 60_000 ? null : false,
          detail: missing.length === 0 ? "eksik yok" : `${oldestMissingResultAgeMin.toFixed(0)} dk (kritik eşik 30 dk)`,
        },
        { id: "result-completeness", label: "Tamamlanan = Sonuçlanan", ok: missing.length === 0, detail: `${resultedRaces.length}/${completedRaces.length} yarış${missingRaceIds.length > 0 ? ` — eksik: ${missingRaceIds.join(", ")}` : ""}` },
        { id: "result-correctness", label: "Sonuç verisi mantıksal olarak geçerli", ok: !correctnessIssues, detail: `kazanan eksik=${winnerMissing}, duplicate=${duplicateFinishPosition}, geçersiz no=${invalidFinishPosition}, çekilmiş-ama-sırada=${scratchedButPlaced}, sayı uyuşmazlığı=${runnerCountMismatch}` },
        { id: "drift-result-sync", label: "CRON CONFIG DRIFT — result-sync", ok: drift.status === "healthy" ? true : drift.status === "warning" ? null : false, detail: drift.detail },
      ],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "results",
      title: "SONUÇLAR",
      status: "unknown",
      description: "Result Sync health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Result sync error",
      lastCheckedAt: nowIso(),
    };
  }
}

// 2026-09-24 — Forward Coverage sensörü (kullanıcı spesifikasyonu). EN KRİTİK kural: bu
// sensör bugünkü DB'ye bakıp geçmişi YENİDEN YORUMLAMAZ — yalnız RaceCoverageTelemetry'nin
// tahmin anında (upsertPrediction'ın after() kancasından, race-coverage-telemetry.service.ts)
// ZATEN yazdığı satırları okur. Point-in-time gerçeği korunur; "bugün" yalnız hangi
// telemetry satırlarının PENCEREYE (son 24s) girdiğini seçmek için kullanılır, herhangi bir
// coverage değeri asla yeniden hesaplanmaz.
//
// DATA PIPELINE HEALTH (bu sensörün status'unu belirleyen) ile MODEL FEATURE AVAILABILITY
// (coverage'ın kendisi) AYRI tutulur: cache-taze ama genç/az-geçmişli atlar yüzünden düşük
// coverage (TRUE_LOW_HISTORY) bir altyapı arızası DEĞİLDİR ve status'u kırmızı yapmaz;
// CACHE_STALE kaynaklı düşük coverage İSE gerçek bir pipeline sorunudur. Kök neden ayrımı
// (_tmp_faz_e_v2_cache_aware.mts'teki araştırma kuralının kalıcı/canlı versiyonu) YALNIZ
// zaten saklanmış `cacheAgeHours` alanından (yazıcının kendi 72s eşiği) türetilir — DB'ye
// yeni bir alan eklenmedi, migration/backfill gerekmedi.
//
// Kullanıcının açık talimatı: istatistiksel "baseline'a göre düştü" alarmı YENİ mimaride
// biriken veri olmadan KURULMADI — ilk 20-50 Şartlı yarışta yalnız veri hattı sağlığı
// (writer çalışıyor mu / satır eksik mi / iç tutarlılık bozuk mu) alarm üretir.
const FORWARD_COVERAGE_WINDOW_MS = 24 * 3_600_000;
const FORWARD_COVERAGE_WRITER_SAMPLE = 30; // "son N tahminde çalıştı mı" örneklem büyüklüğü
const FORWARD_COVERAGE_BACKFILL_LATENCY_MIN = 60; // telemetryCreatedAt-predictionCreatedAt bundan büyükse "forward" değil, backfill/yeniden-analiz gibi say

type CoverageRunnerDetail = {
  horse: string;
  tjkAtId: number | null;
  usableAccuraceCount: number;
  cacheUpdatedAt: string | null;
  cacheAgeHours: number | null;
  sourceObserved: boolean;
  productionEligible: boolean;
};

function coverageBucket(active: number): "NONE" | "LOW" | "PARTIAL" | "FULL" {
  if (active === 0) return "NONE";
  if (active <= 2) return "LOW";
  if (active <= 5) return "PARTIAL";
  return "FULL";
}

/** Bir runner'ın sourceObserved=false ÇIKMASININ kök nedeni — YALNIZ o anda zaten yazılmış
 * cacheAgeHours/usableAccuraceCount'tan türetilir (yazıcının kendi 72s tazelik eşiğiyle
 * tutarlı) — bugünkü cache durumuna bakmaz. */
function coverageRootCause(r: CoverageRunnerDetail): "CACHE_STALE" | "TRUE_LOW_HISTORY" {
  const stale = r.cacheAgeHours == null || r.cacheAgeHours > 72;
  return stale ? "CACHE_STALE" : "TRUE_LOW_HISTORY";
}

async function forwardCoverageHealth(): Promise<ModuleResult> {
  try {
    const windowStart = new Date(Date.now() - FORWARD_COVERAGE_WINDOW_MS);

    // KRİTİK düzeltme (gerçek veriyle doğrulandı 2026-09-24): "eligible" tanımı Karma mirror
    // yarışlarını DIŞLAMALI — Karma, kaynak yarışın Prediction'ını mirror'lar (published/
    // publishedAt dahil, syncKarmaMirrors ile) ama KENDİ telemetry'si asla yazılmaz (hook
    // yalnız input.raceId — kaynak yarış — için tetiklenir), çünkü coverage zaten kaynak
    // yarış için ölçülmüştür. `race.conditions: null` = asıl (Karma olmayan) yarış, mevcut
    // result-sync.ts'teki AYNI filtre deseniyle tutarlı. Bu filtre olmadan sensör HER ZAMAN
    // yanlışlıkla "eksik telemetry" (critical) raporlar — ilk denemede canlı veriyle
    // yakalandı (6/23 Karma false-positive).
    const [recentRows, recentPredictions, writerSample] = await Promise.all([
      db.raceCoverageTelemetry.findMany({
        where: { createdAt: { gte: windowStart } },
        select: {
          raceId: true, createdAt: true, predictionCreatedAt: true, classTypeGroup: true,
          fieldSize: true, ygActiveRunnerCount: true, ygCoverageRatio: true, ygStatus: true,
          cacheFreshCount: true, cacheStaleCount: true, runnersJson: true,
        },
      }),
      db.prediction.findMany({
        where: { published: true, publishedAt: { gte: windowStart }, race: { conditions: null } },
        select: { raceId: true },
      }),
      db.prediction.findMany({
        where: { race: { conditions: null } },
        orderBy: { createdAt: "desc" },
        take: FORWARD_COVERAGE_WRITER_SAMPLE,
        select: { raceId: true },
      }),
    ]);

    // ── Availability ──────────────────────────────────────────────────────
    const eligibleRaceIds = new Set(recentPredictions.map((p) => p.raceId));
    const telemetryRaceIds = new Set(recentRows.map((r) => r.raceId));
    const missingRaceIds = [...eligibleRaceIds].filter((id) => !telemetryRaceIds.has(id));

    const sampleRaceIds = new Set(writerSample.map((p) => p.raceId));
    const sampleTelemetry = sampleRaceIds.size
      ? await db.raceCoverageTelemetry.findMany({ where: { raceId: { in: [...sampleRaceIds] } }, select: { raceId: true } })
      : [];
    const sampleCovered = new Set(sampleTelemetry.map((r) => r.raceId)).size;
    const writerUptimeRatio = sampleRaceIds.size > 0 ? sampleCovered / sampleRaceIds.size : null;

    const lastCapture = await db.raceCoverageTelemetry.findFirst({ orderBy: { createdAt: "desc" }, select: { createdAt: true } });
    const lastCaptureAgeMin = ageMinutes(lastCapture?.createdAt);

    const availabilityBroken = eligibleRaceIds.size > 0 && missingRaceIds.length > 0;

    // ── Freshness — point-in-time bütünlüğü (backfill/yeniden-analiz satırlarını ayır) ──
    const latenciesMin = recentRows.map((r) => (r.createdAt.getTime() - r.predictionCreatedAt.getTime()) / 60_000);
    const backfillLike = latenciesMin.filter((m) => m > FORWARD_COVERAGE_BACKFILL_LATENCY_MIN).length;
    const avgLatencyMin = latenciesMin.length > 0 ? latenciesMin.reduce((s, x) => s + x, 0) / latenciesMin.length : null;

    // ── Completeness + Correctness — SAKLANMIŞ satırların İÇ tutarlılığı ──
    let runnerCountMismatch = 0;
    let activeCountMismatch = 0;
    let sourceObservedRuleViolations = 0;
    let productionEligibleViolations = 0;
    let bucketViolations = 0;
    let ratioViolations = 0;

    for (const row of recentRows) {
      const runners = Array.isArray(row.runnersJson) ? (row.runnersJson as unknown as CoverageRunnerDetail[]) : [];
      if (runners.length !== row.fieldSize) runnerCountMismatch++;
      const recomputedActive = runners.filter((r) => r.sourceObserved).length;
      if (recomputedActive !== row.ygActiveRunnerCount) activeCountMismatch++;
      for (const r of runners) {
        if (r.sourceObserved !== r.usableAccuraceCount >= 3) sourceObservedRuleViolations++;
        const expectedEligible = row.classTypeGroup !== "Handikap Koşular";
        if (r.productionEligible !== expectedEligible) productionEligibleViolations++;
      }
      if (row.ygStatus !== coverageBucket(row.ygActiveRunnerCount)) bucketViolations++;
      const expectedRatio = row.fieldSize > 0 ? row.ygActiveRunnerCount / row.fieldSize : 0;
      if (Math.abs(row.ygCoverageRatio - expectedRatio) > 0.01) ratioViolations++;
    }
    const completenessIssues = runnerCountMismatch + activeCountMismatch;
    const correctnessIssues = sourceObservedRuleViolations + productionEligibleViolations + bucketViolations + ratioViolations;

    // ── Şartlı (production-eligible) kırılımı — MODEL FEATURE AVAILABILITY, status'u
    // TEK BAŞINA belirlemez (yalnız CACHE_STALE kök-nedenli düşük coverage belirler). ──
    const productionRows = recentRows.filter((r) => r.classTypeGroup !== "Handikap Koşular");
    const bucketCounts = { NONE: 0, LOW: 0, PARTIAL: 0, FULL: 0 } as Record<string, number>;
    let eligibleRunnerSum = 0;
    let observedRunnerSum = 0;
    let cacheFreshSum = 0;
    let cacheStaleSum = 0;
    let cacheStaleCausedLowCoverage = 0;
    let trueLowHistoryCount = 0;
    let cacheStaleRootCauseCount = 0;
    for (const row of productionRows) {
      bucketCounts[row.ygStatus] = (bucketCounts[row.ygStatus] ?? 0) + 1;
      eligibleRunnerSum += row.fieldSize;
      observedRunnerSum += row.ygActiveRunnerCount;
      cacheFreshSum += row.cacheFreshCount;
      cacheStaleSum += row.cacheStaleCount;
      if (row.ygStatus === "NONE" || row.ygStatus === "LOW") {
        const runners = Array.isArray(row.runnersJson) ? (row.runnersJson as unknown as CoverageRunnerDetail[]) : [];
        const notObserved = runners.filter((r) => !r.sourceObserved);
        const anyCacheStale = notObserved.some((r) => coverageRootCause(r) === "CACHE_STALE");
        if (anyCacheStale) cacheStaleCausedLowCoverage++;
        for (const r of notObserved) {
          if (coverageRootCause(r) === "CACHE_STALE") cacheStaleRootCauseCount++;
          else trueLowHistoryCount++;
        }
      }
    }
    const meanCoverageRatio = productionRows.length > 0 ? productionRows.reduce((s, r) => s + r.ygCoverageRatio, 0) / productionRows.length : null;

    // ── Genel durum — YALNIZ veri hattı sağlığı (kullanıcı talimatı: baseline/performans
    // karşılaştırması YOK, yeni mimaride veri birikene kadar). ──
    let status: Status = "healthy";
    if (availabilityBroken || completenessIssues > 0 || correctnessIssues > 0 || cacheStaleCausedLowCoverage > 0) status = "critical";
    else if (backfillLike > 0 || (writerUptimeRatio != null && writerUptimeRatio < 1)) status = "warning";

    return {
      id: "forward-coverage",
      title: "FORWARD COVERAGE",
      status,
      description: "yarisGidisatiSkoru point-in-time veri yeterliliği — RaceCoverageTelemetry'den (bugünkü DB'den DEĞİL)",
      metrics: [
        { label: "Eligible races (24s)", value: eligibleRaceIds.size },
        { label: "Telemetry races (24s)", value: telemetryRaceIds.size },
        { label: "Missing telemetry", value: missingRaceIds.length },
        { label: "Writer uptime (son 30 tahmin)", value: writerUptimeRatio == null ? "veri yok" : `%${(writerUptimeRatio * 100).toFixed(0)}` },
        { label: "Son telemetry kaydı", value: lastCaptureAgeMin == null ? "hiç" : `${lastCaptureAgeMin.toFixed(0)} dk önce` },
        { label: "Backfill-benzeri satır (>60dk gecikme)", value: `${backfillLike}/${recentRows.length}` },
        { label: "Ortalama point-in-time gecikme", value: avgLatencyMin == null ? "-" : `${avgLatencyMin.toFixed(1)} dk` },
        { label: "Şartlı — NONE", value: bucketCounts.NONE },
        { label: "Şartlı — LOW", value: bucketCounts.LOW },
        { label: "Şartlı — PARTIAL", value: bucketCounts.PARTIAL },
        { label: "Şartlı — FULL", value: bucketCounts.FULL },
        { label: "Ortalama coverage oranı (Şartlı)", value: meanCoverageRatio == null ? "-" : `%${(meanCoverageRatio * 100).toFixed(1)}` },
        { label: "Runner eligible / sourceObserved", value: `${observedRunnerSum}/${eligibleRunnerSum}` },
        { label: "Cache fresh/stale (at prediction)", value: `${cacheFreshSum}/${cacheStaleSum}` },
        { label: "Kök neden — CACHE_STALE", value: cacheStaleRootCauseCount },
        { label: "Kök neden — TRUE_LOW_HISTORY", value: trueLowHistoryCount },
      ],
      checks: [
        { id: "fc-availability", label: "Her uygun tahmin için telemetry satırı var", ok: eligibleRaceIds.size === 0 ? null : !availabilityBroken, detail: missingRaceIds.length === 0 ? "eksik yok" : `${missingRaceIds.length} yarışta telemetry eksik` },
        { id: "fc-freshness", label: "Telemetry point-in-time (backfill değil)", ok: recentRows.length === 0 ? null : backfillLike === 0, detail: `${backfillLike}/${recentRows.length} satır >${FORWARD_COVERAGE_BACKFILL_LATENCY_MIN}dk gecikmeli` },
        { id: "fc-completeness", label: "Runner sayısı ve aktif sayım tutarlı", ok: completenessIssues === 0, detail: `runner sayısı uyuşmazlığı=${runnerCountMismatch}, aktif sayım uyuşmazlığı=${activeCountMismatch}` },
        { id: "fc-correctness", label: "sourceObserved/productionEligible/bucket kuralları tutarlı", ok: correctnessIssues === 0, detail: `sourceObserved kuralı=${sourceObservedRuleViolations}, productionEligible=${productionEligibleViolations}, bucket=${bucketViolations}, ratio=${ratioViolations}` },
        {
          id: "fc-cache-driven-low-coverage",
          label: "Düşük coverage cache kaynaklı DEĞİL (altyapı sorunu yok)",
          ok: cacheStaleCausedLowCoverage === 0,
          detail: cacheStaleCausedLowCoverage === 0 ? `düşük coverage varsa bile kök neden TRUE_LOW_HISTORY (${trueLowHistoryCount} runner) — altyapı sağlıklı` : `${cacheStaleCausedLowCoverage} yarışta NONE/LOW, kök neden CACHE_STALE (altyapı sorunu)`,
        },
      ],
      lastCheckedAt: nowIso(),
    };
  } catch (error) {
    return {
      id: "forward-coverage",
      title: "FORWARD COVERAGE",
      status: "unknown",
      description: "Forward Coverage health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Forward coverage error",
      lastCheckedAt: nowIso(),
    };
  }
}

// 2026-09-24 — Site/API sensörü (kullanıcı spesifikasyonu). KRİTİK tasarım kararı: bu bir
// INTERNAL sensör — deployment'ın KENDİSİNDEN public alias'a (rotaganyan.com) gerçek bir
// HTTP çağrısı yapar (DNS/TLS/edge routing dahil gerçek round-trip; handler'ları doğrudan
// çağırmak bunu ÖLÇEMEZDİ). Platform komple down olursa bu sensör de çalışmaz — kullanıcının
// kendi notu: "İki katman daha doğru: INTERNAL + EXTERNAL PROBE, ilk turda internal yeterli."
// EXTERNAL PROBE (platform dışından) HENÜZ YOK — bu bilinen bir sınırlama, unmeasuredModule
// değil ama tam kapsamlı da değil.
//
// Bu projede ayrı bir "Prediction API" JSON endpoint'i YOK (predictions sayfalar içinde
// server-side render ediliyor) — kullanıcının önerdiği "Prediction read path" HTTP kontrolü
// yerine (var olmayan bir endpoint'i test etmek yalancı olurdu) iki gerçek şey kullanıldı:
// (1) `/tahmin-onerileri` sayfasının HTTP availability'si, (2) en son yayınlanmış
// Prediction'ın olasılık/rank bütünlüğü DOĞRUDAN DB'den (HTTP değil) doğrulanıyor.
const SITE_BASE_URL = "https://rotaganyan.com";
const SITE_LATENCY_HEALTHY_MS = 1500;
const SITE_LATENCY_WARNING_MS = 3000;
const SITE_FETCH_TIMEOUT_MS = 8000;
const SITE_PROBE_CACHE_MS = 60_000; // panel 15sn'de bir poll ediyor — production'a gereksiz senkron trafik binmesin diye 60sn'lik cache

type SiteProbe = { ok: boolean; status: number | null; latencyMs: number | null; error?: string };

async function probeSiteUrl(path: string): Promise<SiteProbe> {
  const started = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SITE_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(`${SITE_BASE_URL}${path}`, { signal: controller.signal, cache: "no-store" });
    return { ok: res.ok, status: res.status, latencyMs: Date.now() - started };
  } catch (err) {
    return { ok: false, status: null, latencyMs: Date.now() - started, error: err instanceof Error ? err.message : String(err) };
  } finally {
    clearTimeout(timeout);
  }
}

function latencyStatus(ms: number | null): Status {
  if (ms == null) return "critical";
  if (ms < SITE_LATENCY_HEALTHY_MS) return "healthy";
  if (ms < SITE_LATENCY_WARNING_MS) return "warning";
  return "critical";
}

let siteProbeCache: { data: ModuleResult; expiresAt: number } | null = null;

async function computeSiteApiHealth(): Promise<ModuleResult> {
  const [home, program, predictions, buildInfoProbe] = await Promise.all([
    probeSiteUrl("/"),
    probeSiteUrl("/program"),
    probeSiteUrl("/tahmin-onerileri"),
    probeSiteUrl("/api/build-info"),
  ]);

  const criticalProbes = [
    { label: "Homepage", probe: home },
    { label: "Program", probe: program },
    { label: "Tahmin Önerileri", probe: predictions },
  ];

  const criticalOkCount = criticalProbes.filter((p) => p.probe.ok).length;
  const availabilityStatus: Status = criticalProbes.some((p) => !p.probe.ok)
    ? "critical"
    : criticalProbes.some((p) => latencyStatus(p.probe.latencyMs) !== "healthy")
      ? "warning"
      : "healthy";

  // Freshness — expected: BU serverless instance'ın KENDİ commit'i (env'den, HTTP YOK) vs
  // live: public alias'ın GERÇEKTEN servis ettiği commit (build-info'ya HTTP ile sorulur).
  // Bu iki değer, alias'ın ESKİ bir deployment'ı servis ettiği (deploy'un alias'a
  // yansımadığı) durumu doğrudan yakalar — bu oturumda birkaç kez elle yaptığımız
  // "curl build-info, commit eşleşiyor mu" doğrulamasının otomatikleşmiş hali.
  const expectedCommit = process.env.VERCEL_GIT_COMMIT_SHA ?? "dev";
  let liveCommit: string | null = null;
  let buildInfoValid: boolean | null = null;
  if (buildInfoProbe.ok) {
    try {
      const res = await fetch(`${SITE_BASE_URL}/api/build-info`, { cache: "no-store" });
      const json = (await res.json()) as { buildId?: unknown };
      liveCommit = typeof json.buildId === "string" ? json.buildId : null;
      buildInfoValid = typeof json.buildId === "string" && json.buildId.length > 0;
    } catch {
      buildInfoValid = false;
    }
  }
  const commitKnown = expectedCommit !== "dev" && liveCommit != null;
  const commitsMatch = commitKnown && liveCommit === expectedCommit;
  const freshnessStatus: Status = !commitKnown ? "unknown" : commitsMatch ? "healthy" : "warning";

  const completenessStatus: Status =
    criticalOkCount === criticalProbes.length ? "healthy" : criticalOkCount >= criticalProbes.length - 1 ? "warning" : "critical";

  // Correctness — en son yayınlanmış Prediction'ın olasılık/rank bütünlüğü, DOĞRUDAN DB'den.
  const latestPrediction = await db.prediction.findFirst({
    where: { published: true },
    orderBy: { publishedAt: "desc" },
    select: { id: true, picks: { select: { rank: true, scoreExact: true } } },
  });
  let predictionValid: boolean | null = null;
  let predictionDetail = "yayınlanmış tahmin yok";
  if (latestPrediction) {
    const ranks = latestPrediction.picks.map((p) => p.rank);
    const duplicateRanks = new Set(ranks).size !== ranks.length;
    const withScore = latestPrediction.picks.filter((p) => p.scoreExact != null);
    const allFinite = withScore.every((p) => Number.isFinite(p.scoreExact!));
    const sum = withScore.reduce((s, p) => s + p.scoreExact!, 0);
    // scoreExact = olasilik*100 — tüm runner'lar toplamı ~100 olmalı (yuvarlama payı ±10).
    const sumOk = withScore.length === 0 ? null : sum >= 90 && sum <= 110;
    predictionValid = !duplicateRanks && allFinite && sumOk !== false;
    predictionDetail = `${latestPrediction.picks.length} pick, duplicate rank=${duplicateRanks}, olasılık toplamı=${withScore.length > 0 ? sum.toFixed(1) : "N/A"}`;
  }
  const correctnessIssues = buildInfoValid === false || predictionValid === false;
  const correctnessStatus: Status = correctnessIssues ? "warning" : "healthy";

  const statusWeight: Record<Status, number> = { healthy: 0, unknown: 1, warning: 2, critical: 3 };
  let status: Status = "healthy";
  for (const s of [availabilityStatus, freshnessStatus, completenessStatus, correctnessStatus]) {
    if (statusWeight[s] > statusWeight[status]) status = s;
  }
  if (status === "unknown") status = "healthy"; // freshness tek başına "commit bilinmiyor" TEK BAŞINA alarm sayılmaz

  return {
    id: "site",
    title: "SITE / API",
    status,
    description: "Internal sensor — deployment'ın kendisinden rotaganyan.com'a HTTP çağrısı (external probe henüz yok)",
    metrics: [
      { label: "Homepage", value: `${home.status ?? "—"} / ${home.latencyMs ?? "—"} ms` },
      { label: "Program", value: `${program.status ?? "—"} / ${program.latencyMs ?? "—"} ms` },
      { label: "Tahmin Önerileri", value: `${predictions.status ?? "—"} / ${predictions.latencyMs ?? "—"} ms` },
      { label: "Build Info", value: `${buildInfoProbe.status ?? "—"} / ${buildInfoProbe.latencyMs ?? "—"} ms` },
      { label: "Expected commit", value: expectedCommit === "dev" ? "bilinmiyor (dev)" : expectedCommit.slice(0, 7) },
      { label: "Live commit", value: liveCommit ? liveCommit.slice(0, 7) : "bilinmiyor" },
      { label: "Kritik endpoint başarı", value: `${criticalOkCount}/${criticalProbes.length}` },
      { label: "Prediction verisi (DB)", value: predictionDetail },
    ],
    checks: [
      {
        id: "site-availability",
        label: "Kritik endpointler 200 dönüyor ve hızlı",
        ok: availabilityStatus === "critical" ? false : availabilityStatus === "warning" ? null : true,
        detail: criticalProbes.map((p) => `${p.label}: ${p.probe.status ?? p.probe.error ?? "?"} (${p.probe.latencyMs ?? "-"}ms)`).join(" · "),
      },
      {
        id: "site-freshness",
        label: "Alias beklenen commit'i servis ediyor",
        ok: !commitKnown ? null : commitsMatch,
        detail: !commitKnown ? "commit karşılaştırması yapılamadı (dev ortamı veya build-info erişilemedi)" : `expected=${expectedCommit.slice(0, 7)} live=${liveCommit!.slice(0, 7)}`,
      },
      { id: "site-completeness", label: "Tüm kritik endpointler sağlıklı", ok: criticalOkCount === criticalProbes.length, detail: `${criticalOkCount}/${criticalProbes.length} kritik endpoint OK` },
      { id: "site-correctness", label: "Payload şeması geçerli (build-info + prediction)", ok: !correctnessIssues, detail: `build-info geçerli=${buildInfoValid ?? "N/A"} · ${predictionDetail}` },
    ],
    lastCheckedAt: nowIso(),
  };
}

async function siteApiHealth(): Promise<ModuleResult> {
  if (siteProbeCache && siteProbeCache.expiresAt > Date.now()) return siteProbeCache.data;
  try {
    const result = await computeSiteApiHealth();
    siteProbeCache = { data: result, expiresAt: Date.now() + SITE_PROBE_CACHE_MS };
    return result;
  } catch (error) {
    return {
      id: "site",
      title: "SITE / API",
      status: "unknown",
      description: "Site/API health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Site health error",
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

// 2026-09-24 — Model Health sensörü (kullanıcı spesifikasyonu). Model Health BAŞKA
// modüllerin ürettiği veriyi izleyen/özetleyen bir TERMİNAL gözlem organı — kendisi veri
// üretmiyor. `dependencies:["results","forward-coverage"]` (registry.ts) zaten GERÇEK veri
// bağımlılığını propagateDependencies() ile taşıyor (Results/Forward Coverage kırmızıysa
// Model Health'in KENDİ selfStatus'u yeşil kalır, overall "warning/DEGRADED" olur — "kalp
// çalışıyor ama kan gelmiyorsa sorun kalpte değil" ilkesi, bu fonksiyonda AYRICA hiçbir şey
// yapmaya gerek YOK, propagation zaten hallediyor).
//
// KRİTİK ayrım — OPERATIONAL/MATHEMATICAL HEALTH (bu fonksiyonun status'unu belirler) vs
// STATISTICAL PERFORMANCE HEALTH (yalnız BİLGİ, asla renk üretmez): kısa vadede birkaç kötü
// sonuç görüp kutuyu kırmızı yapmak KESİNLİKLE YAPILMAZ. Kırmızı yalnız gerçek matematiksel/
// operasyonel bozuklukta gelir: olasılık toplamı geçersiz, duplicate rank, sonuçlanmış
// yarışta prediction yok, runner/pick uyuşmazlığı, hiç değerlendirilebilir kohort yok.
// Recent-100 Top1 %26 çıkması KIRMIZI YAPMAZ — örneklem/segment/LL birlikte
// değerlendirilmeden performans yargısı verilmez (kullanıcı talimatı, istatistiksel
// baseline yeni mimaride HENÜZ BİRİKMEDİ).
//
// ALL-LIVE/RECENT-100/RECENT-300 pencere semantiği Model Operations v1'in gelecekteki
// tasarımıyla ŞİMDİDEN tutarlı (kullanıcı: "ileride yeniden yazmamak için"). LogLoss/top1/
// top3 formülü analiz-performans.service.ts'teki (zaten canlı /admin panelinde kullanılan)
// `pencereOzeti`'nin AYNISI — iki ayrı yerde farklı matematik BAKIMI riski yok.
//
// Maliyet: panel 15sn'de bir poll ediyor, bu sensör potansiyel yüzlerce Result+Pick satırı
// okuyor — 120sn'lik in-memory cache (siteApiHealth'teki AYNI desen) ile sınırlanıyor.
// "Panel = gözlemci, araştırma motoru değil" — bootstrap/ablation/PSI gibi ağır hesap YOK.
const MODEL_HEALTH_CACHE_MS = 120_000;
// DÜZELTME (gerçek veriyle yakalandı, deploy öncesi): ENGINE_VERSIONS'ta "V5.46" versiyon
// adı BİRDEN FAZLA kez geçiyor (V5.47'ye kısa süreliğine geçilip AYNI GÜN geri dönüldü) —
// `.find()` İLK (eski, artık `bitis` dolu) V5.46 girdisini yakalayıp ALL-LIVE kohortunu
// yanlışlıkla ~1 hafta genişletiyordu. `bitis === null` = ŞU AN aktif olan rejim, doğru sınır.
const V546_START =
  ENGINE_VERSIONS.find((v) => v.versiyon === "V5.46" && v.bitis === null)?.baslangic ?? new Date("2026-09-19T00:15:00+03:00");
const C1_CHALLENGER_KEY = "v546-c1-low-hiz-off";
const C1_GATES = [20, 50, 100, 150] as const;

/** Kullanıcının tanımladığı forward-gate bantları — YALNIZ bilgi/ilerleme etiketi, asla
 * PASS/FAIL kararı değil (karar research gate'inden, kullanıcıdan geçer). */
function c1GateLabel(resulted: number): string {
  if (resulted < 20) return "COLLECTING";
  if (resulted < 50) return "EARLY_CHECK_AVAILABLE";
  if (resulted < 100) return "FIRST_FORWARD_REVIEW";
  if (resulted < 150) return "STRONGER_REVIEW";
  return "PRODUCTION_DECISION_REVIEW";
}

function c1GateProgress(resulted: number, nextGate: number | null): string {
  return nextGate == null ? `${resulted}/150+ — tüm gate'ler geçildi` : `${resulted}/${nextGate}`;
}

function fmtPct(x: number): string {
  return `%${(x * 100).toFixed(1)}`;
}

function fmtWindow(w: ReturnType<typeof pencereOzeti> | null, label: string): string {
  if (!w || w.n === 0) return `${label}: veri yok`;
  return `${label}: n=${w.n}, Top1=${fmtPct(w.hitTop1Orani / 100)}, Top3=${fmtPct(w.hitInCouponOrani / 100)}, LL=${w.logLoss ?? "N/A"} (kapsam ${w.logLossKapsam})`;
}

let modelHealthCache: { data: ModuleResult; expiresAt: number } | null = null;

async function computeModelHealth(): Promise<ModuleResult> {
  const rows = await db.result.findMany({
    where: { race: { prediction: { published: true }, conditions: null }, enteredAt: { gte: V546_START } },
    select: {
      enteredAt: true,
      hitTop1: true,
      hitInCoupon: true,
      winnerNos: true,
      race: {
        select: {
          raceNo: true,
          raceDay: { select: { hippodrome: { select: { name: true } } } },
          prediction: { select: { picks: { select: { rank: true, scoreExact: true, runner: { select: { no: true, scratched: true } } } } } },
        },
      },
    },
    orderBy: { enteredAt: "desc" },
    take: 1000, // savunmacı üst sınır — şu an ~199 satır, aylar/yıllar sonrası için
  });

  // ── Availability ──────────────────────────────────────────────────────────
  const allLive = pencereOzeti(rows as unknown as SonucSatiri[]);
  const recent100 = rows.length > 0 ? pencereOzeti(rows.slice(0, 100) as unknown as SonucSatiri[]) : null;
  const recent300 = rows.length >= 300 ? pencereOzeti(rows.slice(0, 300) as unknown as SonucSatiri[]) : null;

  // ── Freshness — yalnız bilgi (Result Sync sensörü zaten kendi alarmını üretiyor,
  // burada TEKRAR alarm üretmiyoruz, mükerrer sinyal olmasın). ──
  const lastEvaluatedAgeMin = rows.length > 0 ? ageMinutes(rows[0]!.enteredAt) : null;
  const lastEvaluatedLabel = rows.length > 0 ? `${rows[0]!.race.raceDay.hippodrome.name} K${rows[0]!.race.raceNo}` : "-";

  // ── Completeness — sonuçlanmış ama YAYINLANMIŞ tahmini olmayan yarış var mı ──
  const missingPredictionCount = await db.race.count({
    where: {
      conditions: null,
      result: { enteredAt: { gte: V546_START } },
      OR: [{ prediction: null }, { prediction: { published: false } }],
    },
  });

  // ── Correctness — SAKLANMIŞ pick verisinin matematiksel geçerliliği ──
  let invalidProbSum = 0;
  let duplicateRank = 0;
  let nanOrNegative = 0;
  let runnerPickMismatch = 0;
  let scratchedInTop3 = 0;
  for (const r of rows) {
    const picks = r.race.prediction?.picks ?? [];
    if (picks.length === 0) {
      runnerPickMismatch++;
      continue;
    }
    if (picks.some((p) => p.runner == null)) runnerPickMismatch++;
    const ranks = picks.map((p) => p.rank);
    if (new Set(ranks).size !== ranks.length) duplicateRank++;
    const scores = picks.map((p) => p.scoreExact).filter((s): s is number => s != null);
    if (scores.some((s) => !Number.isFinite(s) || s < 0)) nanOrNegative++;
    if (scores.length === picks.length) {
      const sum = scores.reduce((a, b) => a + b, 0);
      if (sum < 90 || sum > 110) invalidProbSum++;
    }
    if (picks.some((p) => p.rank <= 3 && p.runner?.scratched)) scratchedInTop3++;
  }
  // DÜZELTME (gerçek veriyle yakalandı, deploy öncesi): "top-3'te çekilmiş at" gerçek bir
  // vaka olarak bulundu (İstanbul K6, Ankara K7) ama bu bir MATEMATİK/pipeline bozukluğu
  // DEĞİL — tahmin YAYINLANDIKTAN SONRA at çekildi (geç scratch), yayın anındaki prediction
  // o an geçerliydi. Kısa vadeli/doğal bir veri yaşam döngüsü olayını "kırmızı" yapmak tam
  // olarak kullanıcının uyardığı hata olurdu — bu yüzden yalnız BİLGİ metriği, correctness
  // toplamına girmiyor (sonuçlanmış yarışta GERÇEKTEN çekilmiş bir atın kazanan sayılması
  // zaten ayrı ve doğru yerde — Result Sync sensörünün scratchedButPlaced kontrolü).
  const correctnessIssues = invalidProbSum + duplicateRank + nanOrNegative + runnerPickMismatch;

  // ── Self status — YALNIZ operasyonel/matematiksel bozukluk, performans DEĞİL ──
  let status: Status = "healthy";
  if (allLive.n === 0) status = "critical";
  else if (missingPredictionCount > 0 || correctnessIssues > 0) status = "critical";

  // ── C1 LOW-HIZ-OFF shadow — YALNIZ bilgi, panel karar VERMEZ (research gate kullanıcıda) ──
  let c1Section: { eligible: number; resulted: number; championDiffers: number; nextGate: number | null; gateLabel: string } | null = null;
  try {
    const [c1Runs, evalRapor] = await Promise.all([
      db.challengerRun.findMany({ where: { challengerKey: C1_CHALLENGER_KEY }, select: { championSnapshot: true, challengerOutput: true } }),
      evaluateChallengerRuns(),
    ]);
    type RunOzet = { no: number; olasilik: number }[];
    const differs = c1Runs.filter((r) => {
      if (!Array.isArray(r.championSnapshot) || !Array.isArray(r.challengerOutput)) return false;
      const champ = (r.championSnapshot as unknown as RunOzet).slice().sort((a, b) => b.olasilik - a.olasilik)[0]?.no;
      const chal = (r.challengerOutput as unknown as RunOzet).slice().sort((a, b) => b.olasilik - a.olasilik)[0]?.no;
      return champ !== chal;
    }).length;
    const resulted = evalRapor[C1_CHALLENGER_KEY]?.n ?? 0;
    const nextGate = C1_GATES.find((g) => resulted < g) ?? null;
    c1Section = {
      eligible: c1Runs.length,
      resulted,
      championDiffers: differs,
      nextGate,
      gateLabel: c1GateLabel(resulted),
    };
  } catch {
    c1Section = null; // C1 bölümü opsiyonel bilgi — hatası Model Health'in genel status'unu ETKİLEMEZ
  }

  return {
    id: "model-health",
    title: "MODEL SAĞLIĞI",
    status,
    description: "Terminal gözlem organı — Operational/Mathematical Health (renk üretir) + Statistical Performance (yalnız bilgi)",
    metrics: [
      { label: "Champion", value: "V5.46" },
      { label: "ALL-LIVE", value: fmtWindow(allLive, "ALL-LIVE") },
      { label: "RECENT-100", value: fmtWindow(recent100, "RECENT-100") },
      { label: "RECENT-300", value: recent300 ? fmtWindow(recent300, "RECENT-300") : `N YETERSİZ (henüz ${allLive.n}/300)` },
      { label: "Son değerlendirilen", value: lastEvaluatedAgeMin == null ? "hiç" : `${lastEvaluatedLabel} (${lastEvaluatedAgeMin.toFixed(0)} dk önce)` },
      { label: "Prediction'sız sonuçlanmış yarış", value: missingPredictionCount },
      { label: "Invalid probability sum", value: invalidProbSum },
      { label: "Duplicate rank", value: duplicateRank },
      { label: "NaN/negatif olasılık", value: nanOrNegative },
      { label: "Runner/pick uyuşmazlığı", value: runnerPickMismatch },
      { label: "Çekilmiş at ilk-3'te (bilgi — geç scratch, alarm değil)", value: scratchedInTop3 },
      ...(c1Section
        ? [
            { label: "C1 eligible (Düşük-Şart)", value: c1Section.eligible },
            { label: "C1 sonuçlanan karşılaştırma", value: c1Section.resulted },
            { label: "C1 Champion≠Challenger", value: c1Section.championDiffers },
            { label: "C1 gate", value: `${c1GateProgress(c1Section.resulted, c1Section.nextGate)} — ${c1Section.gateLabel}` },
          ]
        : [{ label: "C1 shadow", value: "ölçülemedi" }]),
    ],
    checks: [
      { id: "mh-availability", label: "Değerlendirilebilir prediction+result kohortu var", ok: allLive.n > 0, detail: `ALL-LIVE n=${allLive.n} (V5.46 başlangıcından, ${V546_START.toISOString().slice(0, 10)})` },
      { id: "mh-freshness", label: "Son değerlendirilen yarış (bilgi — alarm Result Sync'te)", ok: null, detail: lastEvaluatedAgeMin == null ? "hiç değerlendirilmiş yarış yok" : `${lastEvaluatedLabel}, ${lastEvaluatedAgeMin.toFixed(0)} dk önce` },
      { id: "mh-completeness", label: "Sonuçlanmış her yarışın yayınlanmış tahmini var", ok: missingPredictionCount === 0, detail: `${missingPredictionCount} yarışta sonuç var ama yayınlanmış tahmin yok` },
      { id: "mh-correctness", label: "Prediction matematiği geçerli (sum/rank/NaN/runner)", ok: correctnessIssues === 0, detail: `sum=${invalidProbSum}, duplicate rank=${duplicateRank}, NaN/negatif=${nanOrNegative}, runner uyuşmazlığı=${runnerPickMismatch}` },
      { id: "mh-late-scratch-info", label: "Geç scratch (bilgi — yayın sonrası çekilme, alarm değil)", ok: null, detail: `${scratchedInTop3} yayınlanmış tahminde ilk-3 pick sonradan çekildi` },
      { id: "mh-performance-info", label: "Performans (renk üretmez — yalnız bilgi)", ok: null, detail: fmtWindow(recent100, "RECENT-100") },
      ...(c1Section
        ? [{ id: "mh-c1-shadow", label: "C1 LOW-HIZ-OFF shadow ilerlemesi (karar VERMEZ)", ok: null, detail: `${c1GateProgress(c1Section.resulted, c1Section.nextGate)} — ${c1Section.gateLabel}` }]
        : []),
    ],
    lastCheckedAt: nowIso(),
  };
}

async function modelHealthHealth(): Promise<ModuleResult> {
  if (modelHealthCache && modelHealthCache.expiresAt > Date.now()) return modelHealthCache.data;
  try {
    const result = await computeModelHealth();
    modelHealthCache = { data: result, expiresAt: Date.now() + MODEL_HEALTH_CACHE_MS };
    return result;
  } catch (error) {
    return {
      id: "model-health",
      title: "MODEL SAĞLIĞI",
      status: "unknown",
      description: "Model Health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Model health error",
      lastCheckedAt: nowIso(),
    };
  }
}

// 2026-09-24 — Calibration sensörü (kullanıcı spesifikasyonu). A: Operational/Mathematical
// Health (status'u belirler) vs B: Statistical Calibration Performance (yalnız bilgi).
// dependencies=["engine"] (registry.ts) — Calibration'ın ÇALIŞMASI Results'a bağımlı DEĞİL,
// yalnız Engine'in ürettiği ham skora; observes=["results"] yalnız "işe yarıyor mu" sorusu
// için (propagate ETMEZ).
//
// KRİTİK dürüstlük notu (bu sensörü kurarken EMPİRİK olarak doğrulandı): kullanıcı "gerçek
// production calibration fonksiyonunu kullan, threshold/T'yi kopyalama" dedi — bu tam
// uygulandı (ASIRI_GUVEN_LIDER_ESIGI/_HANDIKAP/_SICAKLIGI, softmax/softmaxHam hepsi
// v5-engine.ts'ten import edildi, BURADA hiçbir sabit tekrar yazılmadı). AMA: RAW (kalibrasyon
// öncesi) olasılık HİÇBİR YERDE saklanmıyor — yalnız kalibre edilmiş `Pick.scoreExact` DB'ye
// yazılıyor. Softmax+sıcaklık matematiksel olarak TERS ÇEVRİLEBİLİR görünüyordu (rawProbs =
// softmaxHam(T·log(calibratedProbs)) triggered ise) — ama gerçek 168 satırlık veride TEST
// edildiğinde (bu sensörü kurmadan ÖNCE) %23'ü (38/168) sınır-civarı amgibü çıktı, 0'ı
// kesin "triggered" olarak ayırt edilebildi. Güvenilmez bir tetik-kohort kırılımını GERÇEKMİŞ
// gibi sunmak tam da kullanıcının tekrar tekrar uyardığı hata olurdu — bu yüzden trigger
// cohort/rank-invariant/ΔLL kırılımı BİLEREK "N YETERSİZ (forward capture yok)" olarak
// bırakıldı. Doğru kalıcı çözüm — kullanıcının kendi önerdiği CalibrationAuditSnapshot
// (raw+calibrated'ı ANALİZ ANINDA yazan yeni bir hook, RaceCoverageTelemetry ile AYNI desen)
// — bu turda KURULMADI (v5-engine.ts'in canlı analiz yolunu değiştirmek, "Deploy Öncesi
// Detay İnceleme" gerektiren ayrı ve daha büyük bir iş) — sıradaki oturum için net bir
// sonraki adım olarak bırakıldı.
const CALIBRATION_CACHE_MS = 120_000;
let calibrationCache: { data: ModuleResult; expiresAt: number } | null = null;

async function computeCalibrationHealth(): Promise<ModuleResult> {
  // ── Operational — Config validity (GERÇEK production sabitlerini okuyor) ──
  const configIssues: string[] = [];
  if (!(ASIRI_GUVEN_LIDER_ESIGI > 0 && ASIRI_GUVEN_LIDER_ESIGI < 1)) configIssues.push("general threshold (0,1) dışında");
  if (!(ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP > 0 && ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP < 1)) configIssues.push("handikap threshold (0,1) dışında");
  if (!(ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP < ASIRI_GUVEN_LIDER_ESIGI)) configIssues.push("handikap threshold >= general threshold (beklenmeyen sıralama)");
  if (!(ASIRI_GUVEN_SICAKLIGI > 0)) configIssues.push("T <= 0");

  // ── Operational — Transform self-test (GERÇEK softmax/softmaxHam fonksiyonlarıyla,
  // sentetik bir kanarya vektörü üzerinde — DB'ye bağımlı değil, her zaman çalışabilmeli) ──
  let transformIssues: string[] = [];
  try {
    const canary = [3, 1.2, 0.6, 0.1, -0.4, -1.5];
    const raw = softmaxHam(canary);
    const calibrated = softmax(canary, 0.0); // liderEsigi=0 → HER ZAMAN tetiklenir, transform'u zorla test eder
    const sumRaw = raw.reduce((a, b) => a + b, 0);
    const sumCal = calibrated.reduce((a, b) => a + b, 0);
    if (!raw.every((x) => Number.isFinite(x) && x >= 0)) transformIssues.push("softmaxHam NaN/negatif üretti");
    if (!calibrated.every((x) => Number.isFinite(x) && x >= 0)) transformIssues.push("softmax(kalibre) NaN/negatif üretti");
    if (Math.abs(sumRaw - 1) > 1e-6) transformIssues.push(`softmaxHam toplamı 1 değil (${sumRaw})`);
    if (Math.abs(sumCal - 1) > 1e-6) transformIssues.push(`softmax toplamı 1 değil (${sumCal})`);
    // Sıcaklık ölçeklendirmesi MONOTON olmalı — sıralamayı asla değiştirmemeli (kullanıcının
    // sert invariant'ı: rawRank == calibratedRank). Kanarya vektörü zaten azalan sırada.
    const rawOrder = [...raw.keys()].sort((a, b) => raw[b]! - raw[a]!);
    const calOrder = [...calibrated.keys()].sort((a, b) => calibrated[b]! - calibrated[a]!);
    if (JSON.stringify(rawOrder) !== JSON.stringify(calOrder)) transformIssues.push("sıcaklık ölçeklendirmesi sıralamayı BOZDU (rank invariant ihlali)");
  } catch (e) {
    transformIssues = [`transform çağrısı hata verdi: ${e instanceof Error ? e.message : String(e)}`];
  }

  // ── Operational — ALL-LIVE kalibre edilmiş Pick verisinin temel geçerliliği (sum/NaN) ──
  const predictions = await db.prediction.findMany({
    where: { published: true, race: { conditions: null, result: { enteredAt: { gte: V546_START } } } },
    select: { race: { select: { classType: true } }, picks: { select: { scoreExact: true } } },
  });

  let invalidSum = 0;
  let nanOrNegative = 0;
  let generalCount = 0;
  let handikapCount = 0;
  for (const p of predictions) {
    const handikapMi = kategoriTespit(p.race.classType) === "2";
    if (handikapMi) handikapCount++;
    else generalCount++;
    const scores = p.picks.map((pk) => pk.scoreExact).filter((s): s is number => s != null);
    if (scores.length === 0) continue;
    if (scores.some((s) => !Number.isFinite(s) || s < 0)) nanOrNegative++;
    if (scores.length === p.picks.length) {
      const sum = scores.reduce((a, b) => a + b, 0);
      if (sum < 90 || sum > 110) invalidSum++;
    }
  }

  const operationalIssues = configIssues.length + transformIssues.length + invalidSum + nanOrNegative;
  const status: Status = operationalIssues > 0 ? "critical" : "healthy";

  return {
    id: "calibration",
    title: "KALİBRASYON",
    status,
    description: "A: Operational/Mathematical Health (renk üretir) — B: Statistical Performance (yalnız bilgi, forward capture bekliyor)",
    metrics: [
      { label: "General threshold (ASIRI_GUVEN_LIDER_ESIGI)", value: fmtPct(ASIRI_GUVEN_LIDER_ESIGI) },
      { label: "Handikap threshold", value: fmtPct(ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP) },
      { label: "Temperature (T)", value: ASIRI_GUVEN_SICAKLIGI.toFixed(2) },
      { label: "ALL-LIVE — General kategori", value: generalCount },
      { label: "ALL-LIVE — Handikap kategori", value: handikapCount },
      { label: "Invalid probability sum", value: invalidSum },
      { label: "NaN/negatif olasılık", value: nanOrNegative },
      { label: "NOT_TRIGGERED / GENERAL_TRIGGERED / HANDIKAP_TRIGGERED", value: "ölçülemiyor (forward capture yok)" },
      { label: "Rank invariant (rawRank=calibratedRank)", value: "ölçülemiyor (raw olasılık saklanmıyor)" },
      { label: "Statistical Performance (ΔLL, triggered cohort)", value: "N YETERSİZ — forward capture bekliyor" },
    ],
    checks: [
      { id: "cal-config", label: "Config geçerli (threshold'lar + T)", ok: configIssues.length === 0, detail: configIssues.length === 0 ? `general=${fmtPct(ASIRI_GUVEN_LIDER_ESIGI)}, handikap=${fmtPct(ASIRI_GUVEN_LIDER_ESIGI_HANDIKAP)}, T=${ASIRI_GUVEN_SICAKLIGI}` : configIssues.join("; ") },
      { id: "cal-transform", label: "Transform geçerli (softmax self-test, kanarya vektörü)", ok: transformIssues.length === 0, detail: transformIssues.length === 0 ? "sum=1, finite, rank-preserving" : transformIssues.join("; ") },
      { id: "cal-probability-integrity", label: "Kalibre edilmiş olasılıklar geçerli (sum≈1, NaN yok)", ok: invalidSum === 0 && nanOrNegative === 0, detail: `invalid sum=${invalidSum}, NaN/negatif=${nanOrNegative} (ALL-LIVE n=${predictions.length})` },
      { id: "cal-trigger-cohort", label: "Trigger cohort kırılımı (NOT/GENERAL/HANDIKAP_TRIGGERED)", ok: null, detail: "Ölçülemiyor — raw olasılık hiçbir yerde saklanmıyor, yalnız kalibre edilmiş değer DB'de var. Ters-çevirme denendi, gerçek veride %23 (38/168) sınır-belirsiz çıktı — güvenilmez, GERÇEKMİŞ gibi sunulmadı." },
      { id: "cal-rank-invariant", label: "Rank invariant (rawRank == calibratedRank)", ok: null, detail: "Ölçülemiyor — aynı sebep. Sonraki adım: CalibrationAuditSnapshot (analiz anında raw+calibrated yazan yeni hook, RaceCoverageTelemetry ile aynı desen)." },
      { id: "cal-statistical-performance", label: "Statistical Performance (ΔLL, triggered cohort)", ok: null, detail: "N YETERSİZ — forward capture altyapısı kurulmadan güvenilir hesaplanamaz." },
    ],
    lastCheckedAt: nowIso(),
  };
}

async function calibrationHealth(): Promise<ModuleResult> {
  if (calibrationCache && calibrationCache.expiresAt > Date.now()) return calibrationCache.data;
  try {
    const result = await computeCalibrationHealth();
    calibrationCache = { data: result, expiresAt: Date.now() + CALIBRATION_CACHE_MS };
    return result;
  } catch (error) {
    return {
      id: "calibration",
      title: "KALİBRASYON",
      status: "unknown",
      description: "Calibration health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Calibration health error",
      lastCheckedAt: nowIso(),
    };
  }
}

// 2026-09-24 — Kupon sensörü (kullanıcı spesifikasyonu, SON organ). Kod doğrulaması: gerçek
// stake/limit çözümlemesi optimizerConfigFor (home-kupon-sync.service.ts) ve
// stakeForHippodromeLabel (race.service.ts, GERÇEK anasayfa gösterim ücreti) — İKİSİ DE
// import edildi, sensör kendi kopyasını YAZMADI. Bu iki fonksiyon TEORİDE aynı ücreti
// vermeli (biri generator, biri display) — sensörün en değerli correctness kontrolü tam
// bunların DİVERGE ettiği anı yakalamak (Kocaeli 7'li Ganyan 1.25 vs 2 TL sınıfı bug).
//
// KRİTİK dürüstlük notu (Calibration'daki OBSERVABILITY_GAP ile AYNI desen): syncHomeKupon
// hiçbir "son deneme/hata" durumunu KALICI olarak yazmıyor (yalnız başarılı üretimde
// HomeKupon satırının kendisi delete+create edilir, updatedAt bunu yansıtır) — bu yüzden
// Availability, kendi "attempt/error" geçmişinden DEĞİL, dolaylı olarak Freshness'tan
// (stale kupon = reconciliation/generation çalışmıyor olabilir) çıkarılıyor. Bu bilinen bir
// sınırlama, gizlenmedi.
//
// Scratch lifecycle: Runner modelinde scratch ZAMAN DAMGASI yok (yalnız boolean) — ama
// syncHomeKupon'un KENDİSİ zaten yalnız `!scratched` runner'ları DP'ye veriyor (bkz.
// getRaceDayLegsForRaceNos/pruneToEligible) — yani ÜRETİM ANINDA scratch olan bir at
// legs'e HİÇBİR ZAMAN giremez (yapısal garanti). Bu nedenle şu an CANLI scratched görünen
// ama legs'te hâlâ duran bir at, YAPISAL OLARAK SCRATCH_AFTER_COUPON'dur — bir zaman
// damgasına gerek yok, generator'ın kendi invariant'ı bunu garanti ediyor. Bu yüzden
// correctness'a DEĞİL, bilgi/lifecycle'a yazılıyor (Model Health'teki "geç scratch"
// dersiyle AYNI).
const COUPON_STALE_WARNING_MIN = 10;
const COUPON_STALE_CRITICAL_MIN = 30;
const COUPON_CACHE_MS = 60_000;
let couponCache: { data: ModuleResult; expiresAt: number } | null = null;

type HomeKuponLegRow = { raceNo: number; narrow: number[]; normal: number[]; wide: number[] };

async function computeCouponHealth(): Promise<ModuleResult> {
  const today = turkeyDateString();
  const dayStart = new Date(today + "T00:00:00.000Z");

  const activePools = await db.homeKupon.findMany({ where: { date: dayStart }, orderBy: [{ hippodromeName: "asc" }, { slot: "asc" }] });

  let missingLegs = 0;
  let emptyLegs = 0;
  let wrongOrder = 0;
  let invalidRunner = 0;
  let duplicateSelection = 0;
  let costMismatch = 0;
  let staleWarning = 0;
  let staleCritical = 0;
  let lateScratchInfo = 0;
  const poolDetails: string[] = [];
  const costMismatchDetails: string[] = [];
  const staleDetails: string[] = [];

  for (const pool of activePools) {
    const baseHippodromeName = pool.hippodromeName.split(" — ")[0]!;
    const legs = Array.isArray(pool.legs) ? (pool.legs as unknown as HomeKuponLegRow[]) : [];
    const poolLabel = `${pool.hippodromeName} (slot ${pool.slot})`;

    // ── Bugünkü hipodromun GERÇEK yarış listesi — expected raceNo sırası buradan türetilir,
    // UYDURULMAZ (chunkIntoAltili/sonYediKosu GERÇEK, export edilmiş fonksiyonlar). ──
    const races = await db.race.findMany({
      where: { raceDay: { date: dayStart, hippodrome: { name: baseHippodromeName } } },
      select: { id: true, raceNo: true, runners: { select: { no: true, scratched: true } } },
      orderBy: { raceNo: "asc" },
    });

    let expectedRaceNos: number[] | null = null;
    if (pool.slot === YEDILI_GANYAN_SLOT) {
      const grp = sonYediKosu(races);
      expectedRaceNos = grp ? grp.map((r) => r.raceNo) : null;
    } else {
      const groups = chunkIntoAltili(races);
      const grp = groups[pool.slot - 1];
      expectedRaceNos = grp ? grp.map((r) => r.raceNo) : null;
    }

    // Completeness — eksik/boş ayak (expected biliniyorsa karşılaştır, bilinmiyorsa atla).
    if (expectedRaceNos) {
      const legRaceNos = new Set(legs.map((l) => l.raceNo));
      const missing = expectedRaceNos.filter((rn) => !legRaceNos.has(rn));
      if (missing.length > 0) {
        missingLegs += missing.length;
        poolDetails.push(`${poolLabel}: eksik ayak ${missing.join(",")}`);
      }
    }
    for (const leg of legs) {
      if (leg.narrow.length === 0) {
        emptyLegs++;
        poolDetails.push(`${poolLabel}: K${leg.raceNo} Ekonomik'te 0 seçim`);
      }
    }

    // Correctness — race order (legs sırası GERÇEK raceNo artan sırasıyla eşleşmeli).
    const legOrder = legs.map((l) => l.raceNo);
    const sortedOrder = [...legOrder].sort((a, b) => a - b);
    if (JSON.stringify(legOrder) !== JSON.stringify(sortedOrder)) {
      wrongOrder++;
      poolDetails.push(`${poolLabel}: ayak sırası bozuk (${legOrder.join(",")})`);
    }

    // Correctness — invalid runner / duplicate selection / late-scratch bilgi.
    const runnersByRaceNo = new Map(races.map((r) => [r.raceNo, r.runners]));
    for (const leg of legs) {
      const validRunners = runnersByRaceNo.get(leg.raceNo) ?? [];
      const validNos = new Set(validRunners.map((r) => r.no));
      const scratchedNos = new Set(validRunners.filter((r) => r.scratched).map((r) => r.no));
      for (const width of ["narrow", "normal", "wide"] as const) {
        const nos = leg[width];
        if (new Set(nos).size !== nos.length) {
          duplicateSelection++;
          poolDetails.push(`${poolLabel}: K${leg.raceNo} ${width} duplicate seçim`);
        }
        const invalid = nos.filter((no) => !validNos.has(no));
        if (invalid.length > 0) {
          invalidRunner++;
          poolDetails.push(`${poolLabel}: K${leg.raceNo} ${width} geçersiz at no ${invalid.join(",")}`);
        }
        const lateScratch = nos.filter((no) => scratchedNos.has(no));
        if (lateScratch.length > 0) lateScratchInfo += lateScratch.length;
      }
    }

    // Correctness — cost mismatch (GERÇEK generator ücreti vs GERÇEK display ücreti).
    const generatorStake = optimizerConfigFor(baseHippodromeName, pool.slot).stakePerCombination;
    const displayStake = stakeForHippodromeLabel(pool.hippodromeName);
    if (Math.abs(generatorStake - displayStake) > 1e-9) {
      costMismatch++;
      const onerisi = await buildKuponOnerisi(pool);
      const displayed = onerisi?.variants.find((v) => v.filled)?.amount ?? onerisi?.variants[0]?.amount ?? null;
      const combos = legs.reduce((acc, l) => acc * Math.max(l.narrow.length, 1), 1);
      const expected = Math.round(combos * generatorStake * 100) / 100;
      costMismatchDetails.push(`${poolLabel}: displayed=${displayed ?? "N/A"}₺ (stake=${displayStake}), expected=${expected}₺ (stake=${generatorStake})`);
    }

    // Freshness — bu havuzdaki yarışların en son GÜNCELLENEN Prediction'ı, kuponun kendi
    // updatedAt'inden daha yeni mi? (yeni tahmin var ama kupon eski = STALE COUPON).
    const raceIds = races.filter((r) => legOrder.includes(r.raceNo)).map((r) => r.id);
    if (raceIds.length > 0) {
      const latestPred = await db.prediction.findFirst({
        where: { raceId: { in: raceIds } },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      });
      if (latestPred && latestPred.updatedAt > pool.updatedAt) {
        const staleMin = (latestPred.updatedAt.getTime() - pool.updatedAt.getTime()) / 60_000;
        if (staleMin > COUPON_STALE_CRITICAL_MIN) {
          staleCritical++;
          staleDetails.push(`${poolLabel}: ${staleMin.toFixed(0)} dk bayat (kritik)`);
        } else if (staleMin > COUPON_STALE_WARNING_MIN) {
          staleWarning++;
          staleDetails.push(`${poolLabel}: ${staleMin.toFixed(0)} dk bayat`);
        }
      }
    }
  }

  const correctnessIssues = missingLegs + emptyLegs + wrongOrder + invalidRunner + duplicateSelection + costMismatch;

  let status: Status = "healthy";
  if (correctnessIssues > 0 || staleCritical > 0) status = "critical";
  else if (staleWarning > 0) status = "warning";

  return {
    id: "coupon",
    title: "KUPON ÜRETİMİ",
    status,
    description: "Doğru yarıştan/tahminden/atlardan/maliyetle üretildi mi — GERÇEK generator+display fonksiyonlarıyla çapraz doğrulanıyor",
    metrics: [
      { label: "Bugün aktif kupon", value: activePools.length },
      { label: "Eksik ayak", value: missingLegs },
      { label: "Boş ayak (Ekonomik'te 0 seçim)", value: emptyLegs },
      { label: "Ayak sırası bozuk", value: wrongOrder },
      { label: "Geçersiz at no", value: invalidRunner },
      { label: "Duplicate seçim", value: duplicateSelection },
      { label: "Cost mismatch (generator≠display stake)", value: costMismatch },
      { label: "Geç scratch (bilgi — üretim sonrası, yapısal garanti)", value: lateScratchInfo },
      { label: "Stale coupon — uyarı (10-30dk)", value: staleWarning },
      { label: "Stale coupon — kritik (>30dk)", value: staleCritical },
      ...(costMismatchDetails.length > 0 ? [{ label: "Cost mismatch detayı", value: costMismatchDetails.join(" · ") }] : []),
      ...(staleDetails.length > 0 ? [{ label: "Stale detayı", value: staleDetails.join(" · ") }] : []),
    ],
    checks: [
      { id: "coupon-availability", label: "Aktif kupon üretim geçmişi (attempt/error kaydı YOK — bilinen sınırlama)", ok: null, detail: `${activePools.length} aktif kupon — OBSERVABILITY_GAP: syncHomeKupon kalıcı attempt/error durumu yazmıyor` },
      { id: "coupon-freshness", label: "Kupon, ilgili Prediction'lardan daha yeni", ok: staleWarning + staleCritical === 0, detail: staleDetails.length > 0 ? staleDetails.join(" · ") : "tüm kuponlar güncel" },
      { id: "coupon-completeness", label: "Her ayak dolu (eksik/boş yok)", ok: missingLegs === 0 && emptyLegs === 0, detail: `eksik ayak=${missingLegs}, boş ayak=${emptyLegs}` },
      {
        id: "coupon-correctness",
        label: "Runner/sıra/duplicate/maliyet doğru",
        ok: wrongOrder === 0 && invalidRunner === 0 && duplicateSelection === 0 && costMismatch === 0,
        detail: `sıra=${wrongOrder}, geçersiz runner=${invalidRunner}, duplicate=${duplicateSelection}, cost mismatch=${costMismatch}${poolDetails.length > 0 ? " — " + poolDetails.slice(0, 5).join(" · ") : ""}`,
      },
    ],
    lastCheckedAt: nowIso(),
  };
}

async function couponHealth(): Promise<ModuleResult> {
  if (couponCache && couponCache.expiresAt > Date.now()) return couponCache.data;
  try {
    const result = await computeCouponHealth();
    couponCache = { data: result, expiresAt: Date.now() + COUPON_CACHE_MS };
    return result;
  } catch (error) {
    return {
      id: "coupon",
      title: "KUPON ÜRETİMİ",
      status: "unknown",
      description: "Kupon health ölçülemedi",
      metrics: [],
      checks: [],
      errorMessage: error instanceof Error ? error.message : "Coupon health error",
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
      // Bkz. types.ts OperationalDecision notu — bugün hiçbir sensör canlı bir "block"
      // sinyali gözlemleyemiyor (hepsi retrospektif), bu yüzden HER ZAMAN "continue".
      mod.operationalDecision = "continue";
      // Root cause — bu düğüm dependency yüzünden warning'e çekildiyse, hangi ÜST düğüm(ler)ün
      // KENDİ (self, inherited DEĞİL) sorunu bunu tetikliyor? rootCauseById zaten topolojik
      // sırayla dolduruluyor (dependency'ler ÖNCE işlendiği için her zaman hazır).
      if (degradedByDependency) {
        const causes = new Set<string>();
        for (const dep of nodesById.get(id)?.dependencies ?? []) {
          const depMod = byId.get(dep);
          if (!depMod) continue;
          if (depMod.selfStatus === "critical" || depMod.selfStatus === "warning") causes.add(dep);
          else if (depMod.rootCauseModuleIds) for (const c of depMod.rootCauseModuleIds) causes.add(c);
        }
        mod.rootCauseModuleIds = [...causes];
      } else if (selfStatus === "critical" || selfStatus === "warning") {
        mod.rootCauseModuleIds = [id]; // kendisi kaynak
      } else {
        mod.rootCauseModuleIds = [];
      }
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
    resultSyncHealth(),
    siteApiHealth(),
    forwardCoverageHealth(),
    modelHealthHealth(),
    calibrationHealth(),
    couponHealth(),
  ]);

  const modules: ModuleResult[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") modules.push(result.value);
  }

  // Henüz gerçek sensörü olmayan modüller — bkz. unmeasuredModule notu.
  modules.push(unmeasuredModule("data-source", "VERİ TOPLAMA", "TJK / program / yarış verileri"));

  // ── Chaos Test override — GERÇEK sensör sonuçları YUKARIDA zaten hesaplandı/DEĞİŞMEDİ;
  // burada yalnız GÖSTERİLEN status, propagation ÇALIŞMADAN ÖNCE zorlanır ki gerçek
  // dependency grafiği gerçek bir hatadan geliyormuş gibi test edilebilsin. Süresi dolmuş
  // satırlar her çağrıda temizlenir — unutulmuş bir test kalıcı KALAMAZ. ──
  await db.systemHealthTestOverride.deleteMany({ where: { expiresAt: { lte: new Date() } } }).catch(() => {});
  const activeChaos = await db.systemHealthTestOverride.findFirst({ where: { expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } }).catch(() => null);
  if (activeChaos) {
    const target = modules.find((m) => m.id === activeChaos.targetModuleId);
    if (target) {
      target.status = activeChaos.forcedStatus as Status;
      target.checks = [{ id: "chaos-override", label: "🧪 CHAOS TEST ACTIVE", ok: false, detail: activeChaos.reason }, ...target.checks];
    }
  }

  propagateDependencies(modules);

  // ── Observation Status (kullanıcı düzeltmesi) — "İzliyor" (observes) ilişkisi status'a/
  // propagation'a KESİNLİKLE KATILMAZ, yalnız BİLGİ. propagateDependencies() BİTTİKTEN
  // SONRA (nihai status'lar hazır) ayrı bir geçişte hesaplanır ki dependency mantığını
  // hiçbir şekilde etkilemesin. ──
  const moduleById = new Map(modules.map((m) => [m.id, m]));
  for (const node of SYSTEM_ANATOMY_NODES) {
    if (!node.observes || node.observes.length === 0) continue;
    const mod = moduleById.get(node.id);
    if (!mod) continue;
    const observed = node.observes.map((id) => moduleById.get(id)).filter((m): m is ModuleResult => !!m);
    mod.observedModules = observed.map((m) => ({ id: m.id, title: m.title, status: m.status }));
    const statuses = observed.map((m) => m.status);
    if (statuses.length === 0) mod.observationStatus = "normal";
    else if (statuses.some((s) => s === "critical" || s === "warning")) mod.observationStatus = "attention";
    else if (statuses.every((s) => s === "unknown")) mod.observationStatus = "unknown";
    else mod.observationStatus = "normal";
  }

  const statusWeight: Record<Status, number> = { healthy: 0, unknown: 1, warning: 2, critical: 3 };

  let overallStatus: Status = "healthy";
  for (const mod of modules) {
    if (statusWeight[mod.status] > statusWeight[overallStatus]) overallStatus = mod.status;
  }

  const count = (status: Status) => modules.filter((x) => x.status === status).length;

  // ── Root Cause / Downstream Impact özeti (kullanıcı düzeltmesi, alarm-yorgunluğu) —
  // "8 kutu sarı" yerine "1 kök neden → 8 etkilenen modül" tek satırda gösterilebilsin diye.
  const rootCauses = modules.filter((m) => m.selfStatus === "critical" || m.selfStatus === "warning").map((m) => m.id);
  const rootCauseSummary = rootCauses.map((moduleId) => ({
    moduleId,
    title: moduleById.get(moduleId)?.title ?? moduleId,
    downstreamCount: modules.filter((m) => m.id !== moduleId && m.rootCauseModuleIds?.includes(moduleId)).length,
  }));

  // ── "Uçuş göstergesi" (kullanıcı düzeltmesi) — "ANALYSIS AVAILABLE: YES" yanıltıcıydı,
  // sistemin GERÇEKTEN "güvenli" ölçtüğü izlenimini veriyordu. Dürüst hâli: henüz bir Safety
  // Gate YOK (safetyGateEnabled:false, sabit) — overallDecision bugün HER ZAMAN "continue"
  // (bkz. types.ts OperationalDecision notu).
  const overallDecision: OperationalDecision = "continue";
  const safetyGateEnabled = false;

  return NextResponse.json({
    overallStatus,
    checkedAt: nowIso(),
    healthy: count("healthy"),
    warning: count("warning"),
    critical: count("critical"),
    unknown: count("unknown"),
    safetyGateEnabled,
    overallDecision,
    rootCauses,
    rootCauseSummary,
    chaosTest: activeChaos
      ? { scenario: activeChaos.scenario, targetModuleId: activeChaos.targetModuleId, reason: activeChaos.reason, expiresAt: activeChaos.expiresAt.toISOString() }
      : null,
    modules,
  });
}
