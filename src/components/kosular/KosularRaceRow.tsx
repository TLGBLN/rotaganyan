"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import InlineAnalysisPanel from "./InlineAnalysisPanel";
import RaceCountdown from "./RaceCountdown";
import type { ProgramRaceDay } from "@/server/services/race.service";
import type { Confidence } from "@prisma/client";

type Race = ProgramRaceDay["races"][number];

type Props = {
  race: Race;
  currentDate: string;
  surfaceLabel: string;
  surfaceClassName: string;
  breedLabel: string;
  confidenceColor: Record<Confidence, string>;
  isEven: boolean;
  isLoggedIn: boolean;
  racePath?: string;
  followedHorseNames?: Set<string>;
};

export default function KosularRaceRow({
  race,
  currentDate,
  surfaceLabel,
  surfaceClassName,
  breedLabel,
  confidenceColor,
  isEven,
  isLoggedIn,
  racePath,
  followedHorseNames,
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const pred = race.prediction;
  const result = race.result;
  const hasAnalysis = !!pred?.published;

  return (
    <>
      <div
        className={cn(
          "flex items-center justify-between gap-3 border-b px-3 py-3 last:border-0 transition-colors hover:bg-muted/30",
          isEven && "race-row-even"
        )}
      >
        {/* Sol: koşu bilgisi */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="shrink-0 font-semibold text-sm">{race.raceNo}. Koşu</span>
            <span className="text-xs text-muted-foreground shrink-0">
              {race.time ?? "—"}
              {race.time && <RaceCountdown date={currentDate} time={race.time} />}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-muted-foreground">
            <span>{race.classType}</span>
            <span className="hidden sm:inline">· {breedLabel}</span>
            <span className={cn("hidden sm:inline font-medium", surfaceClassName)}>
              · {surfaceLabel}
            </span>
            <span className="hidden sm:inline">· {race.distance}m</span>
          </div>
        </div>

        {/* Sağ: analiz badge */}
        <div className="shrink-0">
          {hasAnalysis ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="flex items-center gap-1.5"
            >
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-hit opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-hit" />
              </span>
              <Badge
                variant="outline"
                className={cn(
                  "text-xs",
                  pred!.isBanko
                    ? confidenceColor[pred!.confidence]
                    : "border-[#007123] text-[#007123]"
                )}
              >
                {pred!.isBanko ? "★ Banko" : "Analiz Var"}
              </Badge>
              <ChevronDown
                className={cn(
                  "h-3.5 w-3.5 text-muted-foreground transition-transform",
                  expanded && "rotate-180"
                )}
              />
            </button>
          ) : (
            <Badge variant="outline" className="text-xs border-miss text-miss">
              Henüz Analiz Yok
            </Badge>
          )}
        </div>
      </div>

      {expanded && hasAnalysis && (
        <div className="border-b bg-muted/20 p-3 last:border-0">
          <InlineAnalysisPanel
            picks={pred!.picks}
            winnerNo={result?.winnerNo}
            isLoggedIn={isLoggedIn}
            racePath={racePath}
            followedHorseNames={followedHorseNames}
          />
        </div>
      )}
    </>
  );
}
