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
}: Props) {
  const [expanded, setExpanded] = useState(false);
  const pred = race.prediction;
  const result = race.result;
  const hasAnalysis = !!pred?.published;

  return (
    <>
      <tr
        className={cn(
          "border-b last:border-0 transition-colors hover:bg-muted/30",
          isEven && "race-row-even"
        )}
      >
        <td className="px-2 sm:px-3 py-2 font-semibold">
          <div>{race.raceNo}. Koşu</div>
          <div className="text-[10px] font-normal text-muted-foreground sm:hidden">{race.classType}</div>
        </td>
        <td className="px-2 sm:px-3 py-2 text-muted-foreground">
          {race.time ?? "—"}
          {race.time && <RaceCountdown date={currentDate} time={race.time} />}
        </td>
        <td className="hidden sm:table-cell px-3 py-2">
          <Badge variant="secondary" className="text-xs">{race.classType}</Badge>
        </td>
        <td className="hidden px-3 py-2 text-xs text-muted-foreground sm:table-cell">{breedLabel}</td>
        <td className={cn("hidden px-3 py-2 text-xs font-medium sm:table-cell", surfaceClassName)}>{surfaceLabel}</td>
        <td className="hidden px-3 py-2 pr-10 text-right font-mono text-xs sm:table-cell">{race.distance}m</td>
        <td className="px-2 sm:px-3 py-2">
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
                  pred!.isBanko ? confidenceColor[pred!.confidence] : "border-[#007123] text-[#007123]"
                )}
              >
                {pred!.isBanko ? "★ Banko" : "Analiz Var"}
              </Badge>
              <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", expanded && "rotate-180")} />
            </button>
          ) : (
            <Badge variant="outline" className="text-xs border-miss text-miss">
              Henüz Analiz Yok
            </Badge>
          )}
        </td>
      </tr>
      {expanded && hasAnalysis && (
        <tr className="border-b last:border-0">
          <td colSpan={7} className="bg-muted/20 p-3">
            <InlineAnalysisPanel picks={pred!.picks} winnerNo={result?.winnerNo} isLoggedIn={isLoggedIn} />
          </td>
        </tr>
      )}
    </>
  );
}
