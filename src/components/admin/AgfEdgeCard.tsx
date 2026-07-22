import { cn } from "@/lib/utils";
import type { AgfEdgeStats } from "@/server/services/admin.service";

/** Rakip analiz sitelerindeki "ganyan bazlı tahminlere göre +N puan" iddiasının bizdeki karşılığı — kendi verimizden ölçülen, uydurma olmayan bir fark. */
export default function AgfEdgeCard({ stats }: { stats: AgfEdgeStats }) {
  if (stats.total < 5) return null;

  const edgeLabel = stats.edge >= 0 ? `+${stats.edge.toFixed(1)}` : stats.edge.toFixed(1);
  const edgeGood = stats.edge > 0;
  const hasDisagreeSample = stats.disagreeTotal >= 5;
  const disagreeBeatsAgree = hasDisagreeSample && stats.agreeTotal >= 5 && stats.disagreeRate > stats.agreeRate;

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Sistem vs AGF Favorisi
        </h3>
        <span className="text-[11px] text-muted-foreground">{stats.total} koşu · AGF verisi olan</span>
      </div>

      <div className="flex items-baseline gap-2">
        <span className={cn("text-2xl font-bold tabular-nums", edgeGood ? "text-hit" : "text-miss")}>
          {edgeLabel} puan
        </span>
        <span className="text-xs text-muted-foreground">
          sistemin 1. seçimi, AGF favorisinden {edgeGood ? "daha isabetli" : "daha isabetsiz"}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="text-lg font-bold tabular-nums">%{stats.systemRate.toFixed(0)}</div>
          <div className="text-[10px] text-muted-foreground">Sistem isabeti ({stats.systemHits}/{stats.total})</div>
        </div>
        <div className="rounded-md border bg-muted/20 px-3 py-2">
          <div className="text-lg font-bold tabular-nums">%{stats.agfFavoriteRate.toFixed(0)}</div>
          <div className="text-[10px] text-muted-foreground">AGF favorisi isabeti ({stats.agfFavoriteHits}/{stats.total})</div>
        </div>
      </div>

      {(stats.agreeTotal >= 3 || stats.disagreeTotal >= 3) && (
        <div className="border-t pt-3 space-y-1.5">
          <p className="text-[10px] text-muted-foreground">
            Metodoloji ③ AGF adımının gerçek karşılığı — sistem AGF favorisiyle aynı fikirde mi, farklı mı:
          </p>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <div className="text-sm font-semibold tabular-nums">
                %{stats.agreeRate.toFixed(0)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                AGF ile aynı fikirde ({stats.agreeHits}/{stats.agreeTotal})
              </div>
            </div>
            <div className="rounded-md border bg-muted/20 px-3 py-2">
              <div className={cn("text-sm font-semibold tabular-nums", disagreeBeatsAgree && "text-hit")}>
                %{stats.disagreeRate.toFixed(0)}
              </div>
              <div className="text-[10px] text-muted-foreground">
                AGF&apos;den farklı ({stats.disagreeHits}/{stats.disagreeTotal})
              </div>
            </div>
          </div>
          {hasDisagreeSample && stats.agreeTotal >= 5 && (
            <p className="text-[10px] text-muted-foreground/80">
              {disagreeBeatsAgree
                ? "AGF'ye karşı çıkılan seçimler daha isabetli — AGF ayrışma kuralı veriyle destekleniyor."
                : "AGF favorisine karşı çıkmak henüz getiri sağlamıyor — ayrışma kararlarını gözden geçir."}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
