"use client";

import V5AnalysisPanel from "./V5AnalysisPanel";
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
    // 2026-09-21 — Race Context Invalidation Faz 1 (admin-only, bkz. plan). status
    // her zaman var (Prisma default "ACTIVE"); staleAt/staleReason yalnız STALE'de dolu.
    status?: string;
    staleAt?: Date | string | null;
    staleReason?: string | null;
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
  onSaved?: () => void;
};

export default function SmartAnalysisEditor({ raceId, runners, existingPrediction, onSaved }: Props) {
  return (
    <div className="space-y-6">
      <V5AnalysisPanel raceId={raceId} runners={runners} existingPrediction={existingPrediction} onSaved={onSaved} />
    </div>
  );
}
