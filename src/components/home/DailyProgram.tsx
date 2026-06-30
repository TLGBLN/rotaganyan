import type { DailyHippodrome } from "@/lib/tjk-daily";
import type { Confidence } from "@prisma/client";

const SURFACE_COLOR: Record<string, string> = {
  Çim: "text-hit border-hit/30 bg-hit/5",
  Kum: "text-[#996633] border-[#996633]/30 bg-[#996633]/5",
  Sentetik: "text-target border-target/30 bg-target/5",
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  DUSUK: "text-miss border-miss/30",
  ORTA: "text-muted-foreground border-border",
  YUKSEK: "text-hit border-hit/30",
};

export type DailyAnalysisInfo = {
  published: boolean;
  confidence: Confidence;
  isBanko: boolean;
};

/** Builds the lookup key used to match a TJK-sourced race against a DB analysis entry. */
export function dailyAnalysisKey(hippodromeName: string, raceNo: number): string {
  return `${hippodromeName.trim().toUpperCase()}-${raceNo}`;
}

export default function DailyProgram({
  hippodromes,
  dateStr,
  analysisLookup,
}: {
  hippodromes: DailyHippodrome[];
  dateStr: string;
  analysisLookup?: Map<string, DailyAnalysisInfo>;
}) {
  if (hippodromes.length === 0) {
    return (
      <section className="border-t px-4 py-10">
        <div className="mx-auto max-w-7xl">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">Günlük Program</h2>
            <span className="text-xs text-muted-foreground">{dateStr}</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Bugün için program bulunamadı veya TJK verisi alınamadı.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
            <h2 className="text-lg font-semibold">Günlük Yarış Programı</h2>
          </div>
          <span className="text-xs text-muted-foreground">{dateStr}</span>
        </div>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {hippodromes.map((hipo) => (
            <div key={hipo.code} className="rounded-lg border bg-card">
              {/* Hipodrom başlığı */}
              <div className="flex items-center justify-between border-b px-4 py-3">
                <span className="font-semibold">{hipo.name}</span>
                <span className="text-xs text-muted-foreground">
                  {hipo.races.length} koşu
                </span>
              </div>

              {/* Koşu listesi */}
              <div className="divide-y">
                {hipo.races.map((race) => {
                  const analysis = analysisLookup?.get(dailyAnalysisKey(hipo.name, race.raceNo));
                  return (
                    <div
                      key={race.raceNo}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="w-5 shrink-0 text-center text-xs font-bold text-muted-foreground">
                        {race.raceNo}
                      </span>
                      <span className="w-12 shrink-0 text-xs text-muted-foreground">
                        {race.time}
                      </span>
                      <span className="flex-1 truncate text-foreground">
                        {race.classType}
                      </span>
                      <span className="shrink-0 text-xs text-muted-foreground">
                        {race.distance > 0 ? `${race.distance}m` : ""}
                      </span>
                      <span
                        className={`shrink-0 rounded-full border px-1.5 py-0.5 text-xs ${
                          SURFACE_COLOR[race.surface] ?? "text-muted-foreground border-border"
                        }`}
                      >
                        {race.surface}
                      </span>
                      {analysis?.published ? (
                        <span
                          className={`flex shrink-0 items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs ${CONFIDENCE_COLOR[analysis.confidence]}`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-hit animate-pulse" />
                          {analysis.isBanko ? "★ Banko" : "Analiz Var"}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <p className="mt-4 text-xs text-muted-foreground text-right">
          Kaynak: TJK · Her saat güncellenir
        </p>
      </div>
    </section>
  );
}
