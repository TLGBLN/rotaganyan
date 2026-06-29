import { db } from "@/lib/db";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { getRaceForAnalysis, getAnalystStats, getClassTypeAdvice } from "@/server/services/admin.service";
import MarkdownRaceInput from "@/components/admin/MarkdownRaceInput";
import BultenUpload from "@/components/admin/BultenUpload";
import ClassTypeAdviceCard from "@/components/admin/ClassTypeAdviceCard";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ kosu?: string; mod?: string }> };

export default async function YeniAnalizPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Race picker — kosu seçilmemiş
  if (!params.kosu) {
    const raceDays = await db.raceDay.findMany({
      include: {
        hippodrome: true,
        races: {
          include: { prediction: { select: { id: true } } },
          orderBy: { raceNo: "asc" },
        },
      },
      orderBy: { date: "desc" },
      take: 10,
    });

    return (
      <div className="space-y-4">
        <h1 className="text-lg font-bold">Veri Gir — Koşu Seç</h1>
        <p className="text-xs text-muted-foreground">
          Markdown veya ekran görüntüsü ile veri gireceğin koşuyu seç.
        </p>
        <div className="space-y-4">
          {raceDays.map((rd) => (
            <div key={rd.id}>
              <p className="mb-2 text-sm font-semibold text-muted-foreground">
                {rd.hippodrome.name} — {format(rd.date, "d MMMM yyyy (EEEE)", { locale: tr })}
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {rd.races.map((race) => (
                  <Link
                    key={race.id}
                    href={`/admin/analizler/yeni?kosu=${race.id}`}
                    className={`rounded-lg border px-3 py-2 text-center text-sm transition-colors hover:bg-muted ${
                      race.prediction ? "border-brand/30 bg-brand/5" : ""
                    }`}
                  >
                    <span className="font-semibold">{race.raceNo}. Koşu</span>
                    {race.prediction && (
                      <div className="mt-0.5 text-[10px] text-brand">✓ Analiz var</div>
                    )}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const race = await getRaceForAnalysis(params.kosu);
  if (!race) return <p className="text-sm text-muted-foreground">Koşu bulunamadı.</p>;

  const raceName = `${race.raceDay.hippodrome.name} — ${race.raceNo}. Koşu`;
  const mod = params.mod ?? "md"; // default: markdown
  const analystStats = await getAnalystStats();
  const advice = getClassTypeAdvice(analystStats, race.classType);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <Link
            href="/admin/analizler/yeni"
            className="mb-2 flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-3.5 w-3.5" /> Koşu Seç
          </Link>
          <h1 className="text-lg font-bold">{raceName}</h1>
          <p className="text-xs text-muted-foreground">
            {format(race.raceDay.date, "d MMMM yyyy", { locale: tr })} · {race.classType} ·{" "}
            {race.distance}m · {race.runners.length} at
          </p>
        </div>
        {race.prediction && (
          <Link
            href={`/admin/analizler/${race.prediction.id}`}
            className="shrink-0 rounded-lg border border-brand/30 px-3 py-1.5 text-xs font-semibold text-brand hover:bg-brand/10"
          >
            Analizi Gör →
          </Link>
        )}
      </div>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <Link
          href={`?kosu=${race.id}&mod=md`}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            mod === "md"
              ? "bg-brand text-black"
              : "border border-white/10 text-muted-foreground hover:bg-white/5"
          }`}
        >
          Markdown Giriş
        </Link>
        <Link
          href={`?kosu=${race.id}&mod=screenshot`}
          className={`rounded-lg px-4 py-2 text-xs font-semibold transition-colors ${
            mod === "screenshot"
              ? "bg-brand text-black"
              : "border border-white/10 text-muted-foreground hover:bg-white/5"
          }`}
        >
          Ekran Görüntüsü
        </Link>
      </div>

      {/* Markdown input — serbest format: basit at tablosu veya tam ROTAGANYAN raporu, otomatik algılanır */}
      {mod === "md" && (
        <MarkdownRaceInput
          raceId={race.id}
          raceLabel={`${race.raceNo}. Koşu — ${race.runners.length} at`}
          defaultOpen
        />
      )}

      {/* Screenshot upload */}
      {mod === "screenshot" && (
        <BultenUpload raceId={race.id} raceName={raceName} />
      )}
    </div>
  );
}
