import {
  getDashboardStats,
  getAnalystStats,
  getRecentPredictions,
  getPendingPredictions,
  getArchiveStats,
} from "@/server/services/admin.service";
import { getRaceStyleWinStats, raceStyleBreakdownToRows } from "@/lib/stats";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import InsightsPanel from "@/components/admin/InsightsPanel";
import NarrativeSummary from "@/components/admin/NarrativeSummary";
import DailyTrendChart from "@/components/admin/DailyTrendChart";
import RecentFeed from "@/components/admin/RecentFeed";
import PendingList from "@/components/admin/PendingList";
import AdminRefresh from "@/components/admin/AdminRefresh";
import ClaudeBudgetWidget from "@/components/admin/ClaudeBudgetWidget";
import ArchiveStatsWidget from "@/components/admin/ArchiveStatsWidget";
import { getClaudeBudget } from "@/server/actions/claude-budget.actions";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [stats, analyst, recentPredictions, pendingPredictions, raceStyleStats, claudeBudget, archiveStats] = await Promise.all([
    getDashboardStats(),
    getAnalystStats(),
    getRecentPredictions(16),
    getPendingPredictions(),
    getRaceStyleWinStats(),
    getClaudeBudget(),
    getArchiveStats(),
  ]);

  const hasData = analyst.overall.total > 0;
  const banko = analyst.byConfidence.find((b) => b.label === "★ Banko");
  const last10 = analyst.recentTrend.slice(-10);
  const last10Hits = last10.filter(Boolean).length;
  const couponTier = analyst.overallCouponTier;

  const trendStats = {
    overall: analyst.overall,
    coupon: couponTier.total >= 1
      ? { hits: couponTier.ekonomik, total: couponTier.total, rate: (couponTier.ekonomik / couponTier.total) * 100 }
      : undefined,
    banko: banko && banko.total >= 1 ? { rate: banko.rate, hits: banko.hits, total: banko.total } : undefined,
    last10: { rate: last10.length > 0 ? (last10Hits / last10.length) * 100 : 0, hits: last10Hits },
    last10Count: last10.length,
    pending: stats.pendingResults,
  };

  return (
    <div className="space-y-5">
      {/* ── Başlık ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-bold">Dashboard</h1>
          <AdminRefresh />
        </div>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            {analyst.overall.total} sonuçlanmış · {stats.totalPredictions} toplam tahmin
          </span>
        )}
      </div>

      {/* ── Arşiv Kapsamı ──────────────────────────────────────────── */}
      <ArchiveStatsWidget {...archiveStats} />

      {/* ── Yorumsal Özet ──────────────────────────────────────────── */}
      <NarrativeSummary analyst={analyst} pendingResults={stats.pendingResults} />

      {/* ── Trend + Bekleyen ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DailyTrendChart
            cumulativeTrend={analyst.cumulativeTrend}
            overallRate={analyst.overall.rate}
            stats={trendStats}
          />
        </div>
        <div className="space-y-4">
          <PendingList pending={pendingPredictions} />
          <ClaudeBudgetWidget status={claudeBudget} />
        </div>
      </div>

      {/* ── Son Tahminler Akışı ────────────────────────────────────── */}
      <RecentFeed predictions={recentPredictions} />

      {/* ── Kritik Tespitler ───────────────────────────────────────── */}
      <InsightsPanel analyst={analyst} pendingResults={stats.pendingResults} />

      {/* ── Performans Tabloları ───────────────────────────────────── */}
      {hasData && (
        <section>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            Performans Analizi
          </h2>

          <div className="space-y-4">
            <CouponTierChart
              rows={[analyst.overallCouponTier]}
              title="Genel: Kazanan Hangi Kupon Kademesinde Geldi"
            />

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <PerformanceBreakdown
                title="Güven Seviyesine Göre"
                rows={analyst.byConfidence}
              />
              <PerformanceBreakdown
                title="Pist Tipine Göre"
                rows={analyst.bySurface}
              />
              <PerformanceBreakdown
                title="Mesafeye Göre"
                rows={analyst.byDistance}
              />
              <PerformanceBreakdown
                title="Hipodroma Göre"
                rows={analyst.byHippodrome}
                limit={8}
              />
            </div>

            <CouponTierChart rows={analyst.couponTierByClassType} />

            <div className="grid gap-4 sm:grid-cols-2">
              <PerformanceBreakdown
                title="Kazanan Yarış Stili — Mesafeye Göre"
                rows={raceStyleBreakdownToRows(raceStyleStats.byDistance)}
              />
              <PerformanceBreakdown
                title="Kazanan Yarış Stili — At Sayısına Göre"
                rows={raceStyleBreakdownToRows(raceStyleStats.byFieldSize)}
              />
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
