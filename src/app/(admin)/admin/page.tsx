import {
  getDashboardStats,
  getAnalystStats,
  getRecentPredictions,
  getPendingPredictions,
} from "@/server/services/admin.service";
import StatTile from "@/components/stats/StatTile";
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
  const last10Rate =
    last10.length > 0 ? (last10.filter(Boolean).length / last10.length) * 100 : 0;

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

      {/* ── KPI Kartları ───────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile
          label="Toplam Analiz"
          value={stats.totalPredictions}
          highlight="brand"
        />
        <StatTile
          label="Genel İsabet"
          value={hasData ? `%${analyst.overall.rate.toFixed(0)}` : "—"}
          sub={hasData ? `${analyst.overall.hits}/${analyst.overall.total} koşu` : undefined}
          highlight={
            analyst.overall.rate >= 40
              ? "hit"
              : analyst.overall.rate >= 20
              ? "brand"
              : "miss"
          }
        />
        <StatTile
          label="Banko İsabeti"
          value={banko && banko.total >= 1 ? `%${banko.rate.toFixed(0)}` : "—"}
          sub={banko && banko.total >= 1 ? `${banko.hits}/${banko.total} banko` : undefined}
          highlight={
            !banko || banko.total < 1
              ? "neutral"
              : banko.rate >= 50
              ? "hit"
              : banko.rate >= 30
              ? "brand"
              : "miss"
          }
        />
        <StatTile
          label={`Son ${last10.length} Form`}
          value={last10.length >= 3 ? `%${last10Rate.toFixed(0)}` : "—"}
          sub={last10.length >= 3 ? `${last10.filter(Boolean).length} isabet` : undefined}
          highlight={
            last10.length < 3
              ? "neutral"
              : last10Rate >= 40
              ? "hit"
              : last10Rate >= 20
              ? "brand"
              : "miss"
          }
        />
        <StatTile
          label="Bekleyen"
          value={stats.pendingResults}
          highlight={
            stats.pendingResults > 5
              ? "miss"
              : stats.pendingResults > 0
              ? "brand"
              : "neutral"
          }
        />
      </div>

      {/* ── Trend + Bekleyen ───────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <DailyTrendChart
            dailyTrend={analyst.dailyTrend}
            overallRate={analyst.overall.rate}
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
                title="Koşu Sınıfına Göre"
                rows={analyst.byClassType}
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
