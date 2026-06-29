import { cn } from "@/lib/utils";
import type { CouponTierBreakdown } from "@/server/services/admin.service";

const SEGMENTS: { key: "ekonomik" | "normal" | "genis" | "kacti"; label: string; barClass: string; dotClass: string }[] = [
  { key: "ekonomik", label: "Ekonomik (1-3)", barClass: "bg-hit", dotClass: "bg-hit" },
  { key: "normal", label: "Normal (4-6)", barClass: "bg-brand", dotClass: "bg-brand" },
  { key: "genis", label: "Geniş (7+)", barClass: "bg-muted-foreground/50", dotClass: "bg-muted-foreground/50" },
  { key: "kacti", label: "Kaçtı", barClass: "bg-miss", dotClass: "bg-miss" },
];

export default function CouponTierChart({
  rows,
  limit,
  title = "Koşu Tipine Göre Kazanan Hangi Kupon Kademesinde Geldi",
}: {
  rows: CouponTierBreakdown[];
  limit?: number;
  title?: string;
}) {
  const visible = limit ? rows.slice(0, limit) : rows;

  // Servis tarafında zaten gruba göre kümelenmiş geliyor — art arda aynı grubu paylaşan
  // satırları tek bir başlık altında toplar (Handikap → Handikap 14, Handikap 15, ...).
  const sections: { group?: string; rows: CouponTierBreakdown[] }[] = [];
  for (const row of visible) {
    const last = sections[sections.length - 1];
    if (last && last.group === row.group) last.rows.push(row);
    else sections.push({ group: row.group, rows: [row] });
  }

  function Row({ row }: { row: CouponTierBreakdown }) {
    return (
      <div>
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium">{row.label}</span>
          <span className="text-muted-foreground">{row.total} koşu</span>
        </div>
        <div className="flex h-2.5 w-full overflow-hidden rounded-full bg-muted">
          {SEGMENTS.map((s) => {
            const count = row[s.key];
            if (count === 0) return null;
            return (
              <div
                key={s.key}
                className={s.barClass}
                style={{ width: `${(count / row.total) * 100}%` }}
                title={`${s.label}: ${count}`}
              />
            );
          })}
        </div>
        <div className="mt-1 flex items-center gap-3 text-[10px] text-muted-foreground">
          {SEGMENTS.map((s) => {
            const count = row[s.key];
            if (count === 0) return null;
            return (
              <span key={s.key} className="flex items-center gap-1">
                <span className={`inline-block h-1.5 w-1.5 rounded-full ${s.dotClass}`} />
                %{Math.round((count / row.total) * 100)} ({count})
              </span>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          {SEGMENTS.map((s) => (
            <span key={s.key} className="flex items-center gap-1">
              <span className={`inline-block h-2 w-2 rounded-full ${s.dotClass}`} />
              {s.label}
            </span>
          ))}
        </div>
      </div>

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
