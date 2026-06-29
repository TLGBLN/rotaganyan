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

  // Servis tarafında zaten gruba göre kümelenmiş geliyor — art arda aynı grubu paylaşan
  // satırları tek bir başlık altında toplar (Handikap → Handikap 14, Handikap 15, ...).
  const sections: { group?: string; rows: AnalystBreakdown[] }[] = [];
  for (const row of visible) {
    const last = sections[sections.length - 1];
    if (last && last.group === row.group) last.rows.push(row);
    else sections.push({ group: row.group, rows: [row] });
  }

  function Row({ row }: { row: AnalystBreakdown }) {
    return (
      <div>
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
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">Henüz veri yok.</p>
      ) : (
        <div className="space-y-4">
          {sections.map((section, i) => (
            <div key={section.group ?? i}>
              {section.group && (
                <p className="mb-2 text-[11px] font-bold uppercase tracking-wide text-brand">{section.group}</p>
              )}
              <div className={cn("space-y-2.5", section.group && "border-l border-brand/20 pl-3")}>
                {section.rows.map((row) => (
                  <Row key={row.label} row={row} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
