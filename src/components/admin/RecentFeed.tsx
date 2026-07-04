import Link from "next/link";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import type { RecentPrediction } from "@/server/services/admin.service";

const SURFACE: Record<string, string> = { CIM: "Çim", KUM: "Kum", SENTETIK: "Snt" };

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
          const bgColor =
            p.hitTop1 === null
              ? ""
              : p.hitTop1
              ? "bg-hit/[0.03]"
              : "bg-miss/[0.03]";
          const classShort = p.classType.split("/")[0].trim();
          const horseName = p.topPickLabel.replace(/^\d+\s+/, "").trim() || p.topPickLabel;

          return (
            <Link
              key={p.id}
              href={`/admin/analizler/${p.id}`}
              className={cn(
                "flex min-w-[152px] max-w-[165px] shrink-0 flex-col gap-1.5 rounded-md border border-l-[3px] p-3 transition-colors hover:bg-muted/30",
                borderColor,
                bgColor
              )}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="truncate text-[10px] text-muted-foreground">
                  {format(new Date(p.date), "d MMM", { locale: tr })}
                </span>
                {p.isBanko && (
                  <span className="shrink-0 text-[9px] font-bold text-brand">★ BANKO</span>
                )}
              </div>

              <div className="text-[10px] leading-tight text-muted-foreground">
                <span className="font-medium text-foreground">{p.hippodrome}</span>
                {" · "}{p.raceNo}. Koşu
              </div>

              <div className="text-[10px] text-muted-foreground">
                {classShort} · {p.distance}m · {SURFACE[p.surface] ?? p.surface}
              </div>

              <div className="mt-0.5 truncate text-xs font-semibold leading-snug" title={horseName}>
                {horseName}
              </div>

              <div className="mt-auto border-t pt-1.5">
                <ResultBadge hitTop1={p.hitTop1} />
                {p.actualFirst && !p.hitTop1 && p.hitTop1 !== null && (
                  <span className="ml-1.5 text-[10px] text-muted-foreground">
                    → {String(p.actualFirst).replace(/^\d+\s+/, "")}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
