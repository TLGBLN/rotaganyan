import { Badge } from "@/components/ui/badge";
import TargetBadge from "./TargetBadge";
import { cn } from "@/lib/utils";
import type { PedigreeRating } from "@prisma/client";

const PED_LABEL: Record<PedigreeRating, string> = {
  ZAYIF: "Zayıf",
  DUSUK: "Düşük",
  ORTA: "Orta",
  GUCLU: "Güçlü",
  YUKSEK: "Yüksek",
  COK_YUKSEK: "Çok Yüksek",
  SORU: "?",
  BILINMIYOR: "—",
};

const PED_COLOR: Record<PedigreeRating, string> = {
  ZAYIF: "text-miss",
  DUSUK: "text-miss",
  ORTA: "text-muted-foreground",
  GUCLU: "text-hit",
  YUKSEK: "text-hit",
  COK_YUKSEK: "text-brand",
  SORU: "text-muted-foreground",
  BILINMIYOR: "text-muted-foreground",
};

type Props = {
  rank: number;
  runnerLabel: string;
  score?: number | null;
  details: string[];
  pedigreeRating: PedigreeRating;
  isTarget: boolean;
  pedigreeUrl?: string | null;
};

export default function PickRow({
  rank,
  runnerLabel,
  score,
  details,
  pedigreeRating,
  isTarget,
  pedigreeUrl,
}: Props) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-lg border p-3 transition-colors",
        rank === 1 && "border-brand/40 bg-brand/5",
        rank === 2 && "border-muted",
        rank >= 3 && "border-transparent bg-muted/30"
      )}
    >
      {/* Rank badge */}
      <div
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          rank === 1 && "bg-brand text-brand-foreground",
          rank === 2 && "bg-muted-foreground/20 text-foreground",
          rank >= 3 && "bg-muted text-muted-foreground"
        )}
      >
        {rank}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{runnerLabel}</span>
          {isTarget && <TargetBadge />}
          {score != null && (
            <Badge variant="outline" className="text-xs">
              {score} puan
            </Badge>
          )}
          {pedigreeRating !== "BILINMIYOR" && (
            <span className={cn("text-xs", PED_COLOR[pedigreeRating])}>
              Ped: {PED_LABEL[pedigreeRating]}
            </span>
          )}
          {pedigreeUrl && (
            <a
              href={pedigreeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-brand underline-offset-2 hover:underline"
            >
              Pedigri →
            </a>
          )}
        </div>

        {details.length > 0 && (
          <ul className="mt-1.5 space-y-0.5">
            {(details as string[]).map((d, i) => (
              <li key={i} className="text-xs text-muted-foreground before:mr-1 before:content-['·']">
                {d}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
