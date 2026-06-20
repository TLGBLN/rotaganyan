import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { getRaceDetail } from "@/server/services/race.service";
import PredictionBoard from "@/components/prediction/PredictionBoard";
import RaceCard from "@/components/race/RaceCard";
import { Separator } from "@/components/ui/separator";
import { auth, hasRole } from "@/lib/auth";

type PageProps = {
  params: Promise<{ tarih: string; hipodrom: string; kosuNo: string }>;
};

export default async function RaceDetailPage({ params }: PageProps) {
  const { tarih, hipodrom, kosuNo } = await params;
  const raceNo = parseInt(kosuNo, 10);

  if (isNaN(raceNo)) notFound();

  const [race, session] = await Promise.all([
    getRaceDetail(tarih, hipodrom, raceNo),
    auth(),
  ]);
  if (!race) notFound();

  const canAnalyze = hasRole(session?.user?.role ?? "USER", "EDITOR");

  const dateLabel = format(race.raceDay.date, "d MMMM yyyy (EEEE)", { locale: tr });

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
        <Link href="/kosular" className="flex items-center gap-0.5 hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" />
          Koşu Programı
        </Link>
        <span>/</span>
        <span>{race.raceDay.hippodrome.name}</span>
        <span>/</span>
        <span>{dateLabel}</span>
        <span>/</span>
        <span className="font-medium text-foreground">{raceNo}. Koşu</span>
      </nav>

      {/* Page title */}
      <div>
        <h1 className="text-lg font-bold">
          {race.raceDay.hippodrome.name} — {raceNo}. Koşu
        </h1>
        <p className="text-sm text-muted-foreground">{dateLabel}</p>
      </div>

      {/* Prediction — only if published */}
      {race.prediction?.published && (
        <>
          <PredictionBoard
            prediction={race.prediction}
            result={race.result ?? undefined}
          />
          <Separator />
        </>
      )}

      {/* Race card */}
      <RaceCard race={race} showAnalysis={canAnalyze} />
    </main>
  );
}
