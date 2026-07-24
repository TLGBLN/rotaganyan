import { notFound } from "next/navigation";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { db } from "@/lib/db";
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
  const analystStats = await getAnalystStats(race.id);
  const advice = getClassTypeAdvice(analystStats, race.classType);
  // AIAnalysisPanel'in "Metodoloji (vX.X)" etiketi eskiden hardcoded "v4.2" idi — metodoloji
  // bu oturumda tek başına v4.13'ten v5.0'a kadar birçok kez güncellendi, etiket hep geride
  // kaldı. Artık gerçek güncel versiyonu DB'den okuyup gösteriyor, bir daha yanlış çıkamaz.
  const methodologyVersion = (await db.methodologyVersion.findFirst({ where: { isCurrent: true }, select: { version: true } }))?.version ?? null;

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
          methodologyVersion={methodologyVersion}
        />

        <aside className="space-y-4">
          <ClassTypeAdviceCard advice={advice} classType={race.classType} />
          {!pred.published && <PublishChecklist predictionId={pred.id} pickCount={pred.picks.length} />}
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
