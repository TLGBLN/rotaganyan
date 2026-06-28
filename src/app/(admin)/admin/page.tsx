import { getDashboardStats, getAnalystStats } from "@/server/services/admin.service";
import StatTile from "@/components/stats/StatTile";
import PerformanceBreakdown from "@/components/admin/PerformanceBreakdown";
import CouponTierChart from "@/components/admin/CouponTierChart";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

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
              <PerformanceBreakdown title="Koşu Sınıfına Göre" rows={analyst.byClassType} limit={6} />
              <PerformanceBreakdown title="Hipodroma Göre" rows={analyst.byHippodrome} limit={6} />
            </div>

            <CouponTierChart rows={analyst.couponTierByClassType} limit={8} />
          </div>
        )}
      </section>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Son Sonuçlar
          </h2>
          <Link href="/admin/sonuclar" className="text-xs text-brand hover:underline">
            Tümü →
          </Link>
        </div>

        {stats.recentResults.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz sonuç girilmemiş.</p>
        ) : (
          <div className="rounded-lg border">
            <table className="w-full text-sm">
              <tbody>
                {stats.recentResults.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-3 py-2">
                      {r.race.raceDay.hippodrome.name} — {r.race.raceNo}. Koşu
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {format(r.race.raceDay.date, "d MMM", { locale: tr })}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Badge
                        variant="outline"
                        className={r.hitTop1 || r.hitInCoupon ? "border-hit text-hit" : "border-miss text-miss"}
                      >
                        {r.hitTop1 ? "Tuttu" : r.hitInCoupon ? "Tuttu (İlk 3)" : "Tutmadı"}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/admin/analizler/yeni"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          + Manuel Analiz
        </Link>
        <Link
          href="/admin/sonuclar"
          className="rounded-lg border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Sonuç Gir
        </Link>
      </div>
    </div>
  );
}
