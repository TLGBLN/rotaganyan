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

// 2026-09-23 kullanıcı kodu — HOT tier tanımı syncHorseStatsCache (tjk-at-profil.adapter.ts)
// ile AYNI pencere (önümüzdeki 48 saatte koşacak, sonuçlanmamış).
async function cacheHealth(): Promise<ModuleResult> {
  try {
    const now = new Date();
    const hotEnd = new Date(now.getTime() + 48 * 60 * 60 * 1000);

    const hotRunners = await db.runner.findMany({
      where: {
        scratched: false,
        tjkAtId: { not: null },
        race: { result: null, raceDay: { date: { gte: now, lte: hotEnd } } },
      },
      select: { tjkAtId: true },
      distinct: ["tjkAtId"],
    });

    const hotIds = hotRunners.map((x) => x.tjkAtId).filter((x): x is number => x != null);
    const staleCutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const freshCount = hotIds.length === 0 ? 0 : await db.horseRaceHistoryCache.count({
      where: { tjkAtId: { in: hotIds }, updatedAt: { gte: staleCutoff } },
    });

    const total = hotIds.length;
    const freshRate = total === 0 ? 100 : (freshCount / total) * 100;
    const stale = total - freshCount;

    let status: Status = "healthy";
    if (freshRate < 95) status = "critical";
    else if (freshRate < 99) status = "warning";

    return {
      id: "horse-cache",
      title: "AT PROFİL CACHE",
      status,
      description: "HOT yarış atlarının cache sağlığı",
      metrics: [
        { label: "HOT At", value: total },
        { label: "HOT Fresh", value: freshCount },
        { label: "HOT Stale", value: stale },
        { label: "HOT Fresh Rate", value: freshRate.toFixed(1), unit: "%" },
      ],
      checks: [
        { id: "fresh-rate", label: "HOT freshness ≥ %99", ok: total === 0 ? null : freshRate >= 99, detail: `%${freshRate.toFixed(1)}` },
        { id: "stale", label: "HOT stale >24h", ok: total === 0 ? null : stale === 0, detail: `${stale} at` },
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

  const results = await Promise.allSettled([databaseHealth(), cacheHealth(), challengerHealth(), predictionHealth()]);

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
  modules.push(unmeasuredModule("cron", "CRON / SYNC", "Zamanlanmış görevler"));
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
