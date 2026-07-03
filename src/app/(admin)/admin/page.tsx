import { getDashboardStats, getAnalystStats } from "@/server/services/admin.service";
import StatTile from "@/components/stats/StatTile";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import InsightsPanel from "@/components/admin/InsightsPanel";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const [stats, analyst] = await Promise.all([getDashboardStats(), getAnalystStats()]);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-bold">Dashboard</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatTile label="Toplam Analiz" value={stats.totalPredictions} highlight="brand" />
        <StatTile label="Yayında" value={stats.publishedPredictions} highlight="hit" />
        <StatTile label="Sonuç Girildi" value={stats.totalResults} />
        <StatTile
          label="Sonuç Bekleyen"
          value={stats.pendingResults}
          highlight={stats.pendingResults > 0 ? "miss" : "neutral"}
        />
        <StatTile label="Kullanıcı" value={stats.totalUsers} />
      </div>

      {analyst.overall.total > 0 && (() => {
        const banko = analyst.byConfidence.find((b) => b.label === "★ Banko");
        const last10 = analyst.recentTrend.slice(-10);
        const last10Rate = last10.length > 0 ? (last10.filter(Boolean).length / last10.length) * 100 : 0;
        return (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile
              label="Genel İsabet"
              value={`%${analyst.overall.rate.toFixed(0)}`}
              sub={`${analyst.overall.hits}/${analyst.overall.total} koşu`}
              highlight={analyst.overall.rate >= 40 ? "hit" : analyst.overall.rate >= 20 ? "brand" : "miss"}
            />
            {banko && banko.total >= 1 && (
              <StatTile
                label="Banko İsabeti"
                value={`%${banko.rate.toFixed(0)}`}
                sub={`${banko.hits}/${banko.total} banko`}
                highlight={banko.rate >= 50 ? "hit" : banko.rate >= 30 ? "brand" : "miss"}
              />
            )}
            {last10.length >= 5 && (
              <StatTile
                label={`Son ${last10.length} Form`}
                value={`%${last10Rate.toFixed(0)}`}
                sub={`${last10.filter(Boolean).length} isabet`}
                highlight={last10Rate >= 40 ? "hit" : last10Rate >= 20 ? "brand" : "miss"}
              />
            )}
            <StatTile
              label="Sonuç Bekleyen"
              value={stats.pendingResults}
              highlight={stats.pendingResults > 5 ? "miss" : stats.pendingResults > 0 ? "brand" : "neutral"}
            />
          </div>
        );
      })()}

      <InsightsPanel analyst={analyst} pendingResults={stats.pendingResults} />

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Performans Analizi
          </h2>
          <span className="text-xs text-muted-foreground">
            {analyst.overall.total} sonuçlanmış tahmin
          </span>
        </div>

        {analyst.overall.total === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz sonuçlanmış tahmin yok.</p>
        ) : (
          <div className="space-y-4">
            <CouponTierChart rows={[analyst.overallCouponTier]} title="Genel: Kazanan Hangi Kupon Kademesinde Geldi" />

            <div className="grid gap-4 sm:grid-cols-2">
              <PerformanceBreakdown title="Güven Seviyesine Göre (Kalibrasyon)" rows={analyst.byConfidence} />
              <PerformanceBreakdown title="Pist Tipine Göre" rows={analyst.bySurface} />
              <PerformanceBreakdown title="Koşu Sınıfına Göre" rows={analyst.byClassType} />
              <PerformanceBreakdown title="Hipodroma Göre" rows={analyst.byHippodrome} limit={6} />
            </div>

            <CouponTierChart rows={analyst.couponTierByClassType} />
          </div>
        )}
      </section>
    </div>
  );
}
