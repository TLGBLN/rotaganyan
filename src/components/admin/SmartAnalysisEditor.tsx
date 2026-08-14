"use client";

import V4AnalysisPanel from "./V4AnalysisPanel";
import Faz1VeriDurumu from "./Faz1VeriDurumu";
import PredictionForm from "./PredictionForm";
import type { PedigreeRating, Prisma } from "@prisma/client";

type Runner = Prisma.RunnerGetPayload<{ include: { gallops: true } }>;

type Props = {
  raceId: string;
  runners: Runner[];
  existingPrediction?: {
    id: string;
    confidence: "DUSUK" | "ORTA" | "YUKSEK";
    notes: string;
    tempo?: string | null;
    couponNarrow?: string | null;
    couponNormal?: string | null;
    couponWide?: string | null;
    isBanko: boolean;
    bankoNote?: string | null;
    picks: Array<{
      rank: number;
      runnerId?: string | null;
      runnerLabel: string;
      score?: number | null;
      isTarget: boolean;
      pedigreeRating: PedigreeRating;
      details: unknown;
    }>;
  };
};

export default function SmartAnalysisEditor({ raceId, runners, existingPrediction }: Props) {
  return (
    <div className="space-y-6">
      <Faz1VeriDurumu raceId={raceId} />
      <V4AnalysisPanel raceId={raceId} />
      <PredictionForm
        raceId={raceId}
        runners={runners}
        existingPrediction={existingPrediction}
      />
    </div>
  );
}
