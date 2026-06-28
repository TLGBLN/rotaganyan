import type { CouponTierBreakdown } from "@/server/services/admin.service";

const SEGMENTS: { key: "ekonomik" | "normal" | "genis" | "kacti"; label: string; barClass: string; dotClass: string }[] = [
  { key: "ekonomik", label: "Ekonomik (1-3)", barClass: "bg-hit", dotClass: "bg-hit" },
  { key: "normal", label: "Normal (4-7)", barClass: "bg-brand", dotClass: "bg-brand" },
  { key: "genis", label: "Geniş (8+)", barClass: "bg-muted-foreground/50", dotClass: "bg-muted-foreground/50" },
  { key: "kacti", label: "Kaçtı", barClass: "bg-miss", dotClass: "bg-miss" },
];

export default function CouponTierChart({ rows, limit }: { rows: CouponTierBreakdown[]; limit?: number }) {
  const visible = limit ? rows.slice(0, limit) : rows;

  return (
    <div className="rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Koşu Tipine Göre Kazanan Hangi Kupon Kademesinde Geldi
        </h3>
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
        <div className="space-y-2.5">
          {visible.map((row) => (
            <div key={row.label}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
