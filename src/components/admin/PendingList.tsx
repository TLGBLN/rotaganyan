import Link from "next/link";
import { cn } from "@/lib/utils";
import { differenceInCalendarDays } from "date-fns";
import type { PendingPrediction } from "@/server/services/admin.service";

function DayChip({ date }: { date: Date }) {
  const days = differenceInCalendarDays(new Date(), new Date(date));
  const style =
    days >= 7
      ? "bg-miss/10 text-miss"
      : days >= 3
      ? "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400"
      : "bg-muted/60 text-muted-foreground";

  return (
    <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold tabular-nums", style)}>
      {days === 0 ? "Bugün" : days === 1 ? "Dün" : `${days}g`}
    </span>
  );
}

export default function PendingList({ pending }: { pending: PendingPrediction[] }) {
  return (
    <div className="flex flex-col rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Bekleyen Sonuçlar
        </h3>
        {pending.length > 0 && (
          <span className="rounded-full bg-brand/10 px-2 py-0.5 text-[10px] font-bold text-brand">
            {pending.length}
          </span>
        )}
      </div>

      {pending.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          <span className="text-2xl leading-none">✓</span>
          <p className="mt-2 text-xs text-muted-foreground">Tüm sonuçlar girilmiş.</p>
        </div>
      ) : (
        <div className="flex-1 space-y-1 overflow-y-auto" style={{ maxHeight: 216 }}>
          {pending.map((p) => {
            const classShort = p.classType.split("/")[0].trim();
            const horse = p.topPickLabel.replace(/^\d+\s+/, "").trim() || p.topPickLabel;
            return (
              <Link
                key={p.predictionId}
                href={`/admin/analizler/${p.predictionId}`}
                className="flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px] transition-colors hover:bg-muted/40"
              >
                <DayChip date={p.date} />
                <div className="min-w-0 flex-1 leading-tight">
                  <span className="font-medium">{p.hippodrome}</span>
                  <span className="text-muted-foreground"> {p.raceNo}. Koşu</span>
                  <span className="block truncate text-muted-foreground">
                    {classShort} · {horse}
                  </span>
                </div>
                <span className="shrink-0 text-muted-foreground/50 text-xs">→</span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
