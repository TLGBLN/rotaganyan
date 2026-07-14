import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getAdminPredictionById, getAnalystStats, getClassTypeAdvice } from "@/server/services/admin.service";
import SmartAnalysisEditor from "@/components/admin/SmartAnalysisEditor";
import PublishChecklist from "@/components/admin/PublishChecklist";
import MarkdownRaceInput from "@/components/admin/MarkdownRaceInput";
import DeletePredictionButton from "@/components/admin/DeletePredictionButton";
import ClassTypeAdviceCard from "@/components/admin/ClassTypeAdviceCard";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function EditAnalizPage({ params }: PageProps) {
  const { id } = await params;
  const pred = await getAdminPredictionById(id);
  if (!pred) notFound();

  const race = pred.race;
  const analystStats = await getAnalystStats(race.raceDay.date.toISOString().slice(0, 10));
  const advice = getClassTypeAdvice(analystStats, race.classType);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold">
            {race.raceDay.hippodrome.name} — {race.raceNo}. Koşu
          </h1>
          <p className="text-sm text-muted-foreground">
            {format(race.raceDay.date, "d MMMM yyyy", { locale: tr })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant={pred.published ? "default" : "secondary"}>
            {pred.published ? "Yayında" : "Taslak"}
          </Badge>
          <DeletePredictionButton predictionId={pred.id} />
        </div>
      </div>

      <MarkdownRaceInput
        raceId={race.id}
        raceLabel={`Markdown İle Yeniden Gir — ${race.raceNo}. Koşu · ${race.runners.length} at`}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <SmartAnalysisEditor
          raceId={race.id}
          runners={race.runners}
          existingPrediction={pred}
        />

        <aside className="space-y-4">
          <ClassTypeAdviceCard advice={advice} classType={race.classType} />
          {!pred.published && <PublishChecklist predictionId={pred.id} />}
          {pred.published && (
            <div className="rounded-lg border border-hit/30 bg-hit/10 p-3 text-sm text-hit">
              ✓ Bu analiz yayında
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
