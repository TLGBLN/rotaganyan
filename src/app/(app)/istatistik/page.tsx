import StatTile from "@/components/stats/StatTile";
import { getStats, getRaceStyleWinStats, type RaceStyleWinBreakdown } from "@/lib/stats";
import { cn } from "@/lib/utils";

export const revalidate = 300;

const STYLE_COLOR: Record<string, string> = {
  KACAK: "text-[#e74c3c]",
  ON_GRUP: "text-[#e67e22]",
  BEKLEME: "text-[#2980b9]",
  EN_GERI: "text-[#8e44ad]",
};

function RaceStyleTable({ rowLabel, rows }: { rowLabel: string; rows: RaceStyleWinBreakdown[] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz yeterli veri yok.</p>;
  }
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b bg-muted/40">
            <th className="px-3 py-2 text-left font-medium text-muted-foreground">{rowLabel}</th>
            <th className="px-3 py-2 text-right font-medium text-muted-foreground">Koşu</th>
            {rows[0].byStyle.map((s) => (
              <th key={s.style} className={cn("px-3 py-2 text-right font-medium", STYLE_COLOR[s.style])}>
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.bucket} className={cn("border-b last:border-0", i % 2 === 1 && "race-row-even")}>
              <td className="px-3 py-2 font-medium">{row.label}</td>
              <td className="px-3 py-2 text-right font-mono text-muted-foreground">{row.total}</td>
              {row.byStyle.map((s) => (
                <td key={s.style} className="px-3 py-2 text-right">
                  <span className={cn("font-semibold", STYLE_COLOR[s.style])}>%{s.rate}</span>
                  <span className="ml-1 text-xs text-muted-foreground">({s.wins})</span>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function IstatistikPage() {
  const [stats, raceStyleStats] = await Promise.all([getStats(), getRaceStyleWinStats()]);

  return (
    <main className="mx-auto max-w-4xl space-y-8 px-4 py-8">
      <h1 className="text-xl font-bold">Performans İstatistikleri</h1>

      {/* Overview */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Toplam Analiz" value={stats.totalAnalyses} highlight="brand" />
        <StatTile label="Sonuçlanan" value={stats.totalResults} />
        <StatTile
          label="Birinci Tutma"
          value={`%${stats.overallHitTop1Rate}`}
          highlight={stats.overallHitTop1Rate >= 50 ? "hit" : "miss"}
        />
        <StatTile
          label="Kuponda Bulma"
          value={`%${stats.overallHitInCouponRate}`}
          highlight={stats.overallHitInCouponRate >= 60 ? "hit" : "miss"}
        />
      </section>

      {/* Banko */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Banko Performansı
        </h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <StatTile label="Banko Sayısı" value={stats.recentBanko.total} />
          <StatTile label="Tutulan Banko" value={stats.recentBanko.hit} highlight="hit" />
          <StatTile
            label="Banko İsabet"
            value={`%${stats.recentBanko.rate}`}
            highlight={stats.recentBanko.rate >= 60 ? "hit" : "miss"}
          />
        </div>
      </section>

      {/* By class */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Koşu Türüne Göre
        </h2>

        {stats.byClass.length === 0 ? (
          <p className="text-sm text-muted-foreground">Henüz yeterli veri yok.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium text-muted-foreground">Tür</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Analiz</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">1. Tutma</th>
                  <th className="px-3 py-2 text-right font-medium text-muted-foreground">Kuponda</th>
                </tr>
              </thead>
              <tbody>
                {stats.byClass.map((row, i) => (
                  <tr
                    key={row.classType}
                    className={cn(
                      "border-b last:border-0",
                      i % 2 === 1 && "race-row-even"
                    )}
                  >
                    <td className="px-3 py-2 font-medium">{row.classType}</td>
                    <td className="px-3 py-2 text-right font-mono">{row.total}</td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
                          "font-semibold",
                          row.hitTop1Rate >= 50 ? "text-hit" : "text-miss"
                        )}
                      >
                        %{row.hitTop1Rate}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.hitTop1}/{row.total})
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span
                        className={cn(
                          "font-semibold",
                          row.hitInCouponRate >= 60 ? "text-hit" : "text-miss"
                        )}
                      >
                        %{row.hitInCouponRate}
                      </span>
                      <span className="ml-1 text-xs text-muted-foreground">
                        ({row.hitInCoupon}/{row.total})
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Yarış stiline göre kazanma dağılımı */}
      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Mesafeye Göre Kazanan Yarış Stili
        </h2>
        <RaceStyleTable rowLabel="Mesafe" rows={raceStyleStats.byDistance} />
      </section>

      <section>
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          At Sayısına Göre Kazanan Yarış Stili
        </h2>
        <RaceStyleTable rowLabel="Kadro" rows={raceStyleStats.byFieldSize} />
        <p className="mt-2 text-[11px] text-muted-foreground">
          * Yarış stili verisi ganyandefteri.com kaynaklıdır; yalnızca stil verisi bulunan galibiyetler sayılır.
        </p>
      </section>

      <p className="text-[11px] text-muted-foreground">
        * İstatistikler yalnızca sonucu girilen analizleri kapsar. Geçmiş performans gelecek
        sonuçların garantisi değildir.
      </p>
    </main>
  );
}
