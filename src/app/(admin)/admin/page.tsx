import {
  getDashboardStats,
  getAnalystStats,
  getRecentPredictions,
  getPendingPredictions,
} from "@/server/services/admin.service";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import InsightsPanel from "@/components/admin/InsightsPanel";
import NarrativeSummary from "@/components/admin/NarrativeSummary";
import DailyTrendChart from "@/components/admin/DailyTrendChart";
import RecentFeed from "@/components/admin/RecentFeed";
import PendingList from "@/components/admin/PendingList";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [stats, analyst, recentPredictions, pendingPredictions] = await Promise.all([
    getDashboardStats(),
    getAnalystStats(),
    getRecentPredictions(16),
    getPendingPredictions(),
  ]);

  const hasData = analyst.overall.total > 0;
  const banko = analyst.byConfidence.find((b) => b.label === "★ Banko");
  const last10 = analyst.recentTrend.slice(-10);
  const last10Hits = last10.filter(Boolean).length;

  const trendStats = {
    overall: analyst.overall,
    banko: banko && banko.total >= 1 ? { rate: banko.rate, hits: banko.hits, total: banko.total } : undefined,
    last10: { rate: last10.length > 0 ? (last10Hits / last10.length) * 100 : 0, hits: last10Hits },
    last10Count: last10.length,
    pending: stats.pendingResults,
  };

  return (
    <div className="space-y-5">
      {/* ── Başlık ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Dashboard</h1>
        {hasData && (
          <span className="text-xs text-muted-foreground">
            {analyst.overall.total} sonuçlanmış · {stats.totalPredictions} toplam tahmin
          </span>
        )}
      </div>

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
        <PendingList pending={pendingPredictions} />
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
          </div>
        </section>
      )}
    </div>
  );
}
