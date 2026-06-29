import { getDashboardStats, getAnalystStats } from "@/server/services/admin.service";
import StatTile from "@/components/stats/StatTile";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import { cn } from "@/lib/utils";

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
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StatTile
                label="Genel İsabet Oranı"
                value={`%${analyst.overall.rate.toFixed(0)}`}
                sub={`${analyst.overall.hits}/${analyst.overall.total} tuttu`}
                highlight={analyst.overall.rate >= 40 ? "hit" : analyst.overall.rate >= 20 ? "brand" : "miss"}
              />
              <div className="col-span-2 rounded-lg border bg-card p-4 sm:col-span-3">
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Son {analyst.recentTrend.length} Tahmin
                </p>
                <div className="flex flex-wrap gap-1">
                  {analyst.recentTrend.map((hit, i) => (
                    <span
                      key={i}
                      className={cn(
                        "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold",
                        hit ? "bg-hit/20 text-hit" : "bg-miss/20 text-miss"
                      )}
                    >
                      {hit ? "✓" : "✗"}
                    </span>
                  ))}
                </div>
              </div>
            </div>

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
