import { cn } from "@/lib/utils";
import type { AnalystBreakdown } from "@/server/services/admin.service";

function rateColor(rate: number): string {
  if (rate >= 50) return "bg-hit";
  if (rate >= 30) return "bg-brand";
  return "bg-miss";
}

export default function PerformanceBreakdown({
  title,
  rows,
  limit,
}: {
  title: string;
  rows: AnalystBreakdown[];
  limit?: number;
}) {
  const visible = limit ? rows.slice(0, limit) : rows;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
      ) : (
        <div className="space-y-2.5">
          {visible.map((row) => (
            <div key={row.label}>
              <div className="mb-1 flex items-center justify-between text-xs">
                <span className="font-medium">{row.label}</span>
                <span className="text-muted-foreground">
                  {row.hits}/{row.total} · <span className="font-semibold text-foreground">%{row.rate.toFixed(0)}</span>
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className={cn("h-full rounded-full", rateColor(row.rate))}
                  style={{ width: `${Math.max(row.rate, row.total > 0 ? 2 : 0)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
