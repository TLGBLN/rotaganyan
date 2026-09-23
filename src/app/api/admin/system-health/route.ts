import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { auth, hasRole } from "@/lib/auth";
import type { Role } from "@prisma/client";
import type { HealthStatus, SystemModuleHealth } from "@/lib/system-anatomy/types";

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
async function cronHealth(): Promise<ModuleResult> {
  try {
    const state = await db.hotCacheWatchdogState.findUnique({ where: { id: "singleton" } });

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

    return {
      id: "cron",
      title: "CRON / SYNC",
      status,
      description: "HOT Cache Watchdog cron akışı (diğer cronlar henüz bağlı değil)",
      metrics: [{ label: "Son HOT watchdog çalışması", value: `${ageHours.toFixed(1)} saat önce` }],
      checks: [{ id: "hot-watchdog", label: "HOT Cache Watchdog ≤2s içinde çalıştı", ok: ageHours <= 2.5, detail: state.lastRunAt.toISOString() }],
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

export async function GET() {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  const results = await Promise.allSettled([databaseHealth(), cacheHealth(), challengerHealth(), predictionHealth(), cronHealth()]);

  const modules: ModuleResult[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") modules.push(result.value);
  }

  // Henüz gerçek sensörü olmayan modüller — bkz. unmeasuredModule notu.
  modules.push(unmeasuredModule("data-source", "VERİ TOPLAMA", "TJK / program / yarış verileri"));
  modules.push(unmeasuredModule("program", "PROGRAM", "Günlük yarış programı"));
  modules.push(unmeasuredModule("agf", "AGF / PİYASA", "AGF ve piyasa verileri"));
  modules.push(unmeasuredModule("results", "SONUÇLAR", "Yarış sonuçları"));
  modules.push(unmeasuredModule("coupon", "KUPON ÜRETİMİ", "Kupon oluşturma"));
  modules.push(unmeasuredModule("calibration", "KALİBRASYON", "Probability calibration"));
  modules.push(unmeasuredModule("site", "SITE / API", "Web ve API"));
  modules.push(unmeasuredModule("model-health", "MODEL SAĞLIĞI", "Model monitoring"));

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
