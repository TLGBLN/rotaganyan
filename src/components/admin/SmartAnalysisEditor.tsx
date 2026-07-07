"use client";

import { useState } from "react";
import AIAnalysisPanel, { type AIAnalysisResult } from "./AIAnalysisPanel";
import PredictionForm from "./PredictionForm";
import type { PedigreeRating, Prisma } from "@prisma/client";

type Runner = Prisma.RunnerGetPayload<{ include: { gallops: true } }>;
type AIRunner = { id: string; no: number; name: string };

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
  const [aiResult, setAiResult] = useState<AIAnalysisResult | null>(null);
  const [aiRunners, setAiRunners] = useState<AIRunner[]>([]);

  function handleAIApply(result: AIAnalysisResult, runnersFromAI: AIRunner[]) {
    setAiResult(result);
    setAiRunners(runnersFromAI);
  }

  return (
    <div className="space-y-6">
      <AIAnalysisPanel raceId={raceId} onApply={handleAIApply} />
      <PredictionForm
        raceId={raceId}
        runners={runners}
        existingPrediction={existingPrediction}
        aiResult={aiResult}
        aiRunners={aiRunners}
      />
    </div>
  );
}
