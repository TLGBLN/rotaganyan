import { getDashboardStats } from "@/server/services/admin.service";
import StatTile from "@/components/stats/StatTile";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

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
