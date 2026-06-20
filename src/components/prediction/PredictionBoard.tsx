import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, XCircle } from "lucide-react";
import PickRow from "./PickRow";
import CouponBox from "./CouponBox";
import { formatDate } from "@/lib/utils";
import type { RaceDetail } from "@/server/services/race.service";

type Props = {
  prediction: NonNullable<RaceDetail["prediction"]>;
  result?: RaceDetail["result"];
};

export default function PredictionBoard({ prediction, result }: Props) {
  return (
    <section className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">ROTAGANYAN Analizi</h2>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {prediction.author?.name && <span>{prediction.author.name}</span>}
          {prediction.publishedAt && (
            <span>{formatDate(prediction.publishedAt, "d MMM HH:mm")}</span>
          )}
        </div>
      </div>

      {/* Result badge */}
      {result && (
        <div
          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
            result.hitTop1 ? "border-hit/30 bg-hit/10 text-hit" : "border-miss/30 bg-miss/10 text-miss"
          }`}
        >
          {result.hitTop1 ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <XCircle className="h-4 w-4 shrink-0" />
          )}
          <span className="font-medium">
            {result.hitTop1 ? "Birinci at tuttu" : "Birinci at tutmadı"}
            {result.hitInCoupon && " · Kazanan kuponda vardı"}
          </span>
          {result.winnerNo && (
            <Badge variant="outline" className="ml-auto text-xs">
              Kazanan: #{result.winnerNo}
            </Badge>
          )}
        </div>
      )}

      {/* Picks */}
      <div className="space-y-2">
        {prediction.picks.map((pick) => (
          <PickRow
            key={pick.id}
            rank={pick.rank}
            runnerLabel={pick.runnerLabel}
            score={pick.score}
            details={Array.isArray(pick.details) ? (pick.details as string[]) : []}
            pedigreeRating={pick.pedigreeRating}
            isTarget={pick.isTarget}
            pedigreeUrl={pick.runner?.pedigreeUrl}
          />
        ))}
      </div>

      {/* Notes */}
      {prediction.notes && (
        <Card className="border-muted">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Analiz Notu
            </CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-sm leading-relaxed">{prediction.notes}</p>
            {prediction.tempo && (
              <p className="mt-2 text-xs text-muted-foreground">
                <span className="font-medium">Tempo:</span> {prediction.tempo}
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Coupon */}
      <CouponBox
        narrow={prediction.couponNarrow}
        normal={prediction.couponNormal}
        wide={prediction.couponWide}
        isBanko={prediction.isBanko}
        bankoNote={prediction.bankoNote}
        confidence={prediction.confidence}
      />
    </section>
  );
}
