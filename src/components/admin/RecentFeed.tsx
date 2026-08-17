import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { RecentPrediction } from "@/server/services/admin.service";

function ResultBadge({ hitTop1 }: { hitTop1: boolean | null }) {
  if (hitTop1 === null)
    return <span className="text-[10px] font-medium text-muted-foreground">⟳ Bekliyor</span>;
  if (hitTop1)
    return <span className="text-[10px] font-semibold text-hit">✓ İsabet</span>;
  return <span className="text-[10px] font-semibold text-miss">✕ Tutmadı</span>;
}

export default function RecentFeed({ predictions }: { predictions: RecentPrediction[] }) {
  if (predictions.length === 0) return null;

  return (
    <div className="rounded-lg border p-4">
      <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Son Tahminler
      </h3>
      <div className="flex gap-2.5 overflow-x-auto pb-1">
        {predictions.map((p) => {
          const borderColor =
            p.hitTop1 === null
              ? "border-l-muted-foreground/30"
              : p.hitTop1
              ? "border-l-hit"
              : "border-l-miss";
          const horseName = p.topPickLabel.replace(/^\d+\s+/, "").trim() || p.topPickLabel;

          return (
            <Link
              key={p.id}
              href={`/admin/analizler/${p.id}`}
              className={cn(
                "flex min-w-[148px] max-w-[160px] shrink-0 flex-col gap-1 rounded-md border border-l-[3px] p-3 transition-colors hover:bg-muted/30",
                borderColor
              )}
            >
              <div className="flex items-center justify-between gap-1 text-[10px] text-muted-foreground">
                <span className="truncate">
                  {format(new Date(p.date), "d MMM", { locale: tr })} · {p.hippodrome} K{p.raceNo}
                </span>
                {p.isBanko && <span className="shrink-0 font-bold text-brand">★</span>}
              </div>

              <div className="mt-0.5 truncate text-xs font-semibold leading-snug" title={horseName}>
                {horseName}
              </div>

              <div className="mt-auto pt-1.5">
                <ResultBadge hitTop1={p.hitTop1} />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
