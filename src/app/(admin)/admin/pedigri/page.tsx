import { Check, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import RacePedigreeTable from "@/components/admin/RacePedigreeTable";
import DateNavigator from "@/components/kosular/DateNavigator";
import { getRaceDaysForPedigreeEntry } from "@/server/services/admin.service";
import { turkeyDateString } from "@/lib/tz";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ tarih?: string }> };

export default async function PedigriPage({ searchParams }: PageProps) {
  const { tarih } = await searchParams;
  const currentDate = tarih ?? turkeyDateString();

  const raceDays = await getRaceDaysForPedigreeEntry(currentDate);

  return (
    <div className="space-y-8">
      <div>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold">At Pedigrileri &amp; Eksik Veri</h1>
            <p className="text-xs text-muted-foreground">
              O günün koşan atlarına baba (sire), anne (dam), anne babası (damsire) ve pedigri notu
              girin. TJK programında zaten varsa otomatik dolu gelir, siz üzerine yazabilirsiniz.
              Kaydettiğiniz bilgi kullanıcılara &quot;Pedigriler&quot; panelinde gösterilir. Ayrıca her
              atın yanındaki &quot;Genel Not&quot; alanına pedigri dışında herhangi bir eksik veriyi
              (sakatlık haberi, antrenman gözlemi, pist notu vb.) girebilirsiniz — otomatik analiz
              motoru bu notu okur ve değerlendirmesine dahil eder.
            </p>
          </div>
          <DateNavigator currentDate={currentDate} basePath="/admin/pedigri" />
        </div>

        {raceDays.length === 0 && (
          <div className="mt-4 rounded-lg border border-dashed py-10 text-center text-sm text-muted-foreground">
            Bu tarih için koşu programı bulunamadı.
          </div>
        )}

        <div className="mt-4 space-y-4">
          {raceDays.map((rd) => (
            <details key={rd.id} className="group rounded-lg border">
              <summary className="flex cursor-pointer list-none items-center justify-between border-b bg-muted/30 px-4 py-2 [&::-webkit-details-marker]:hidden">
                <h2 className="text-sm font-semibold">{rd.hippodrome.name}</h2>
                <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-90" />
              </summary>
              <div className="divide-y">
                {rd.races.map((race) => {
                  // sire/dam/damSire TJK'dan otomatik gelir (neredeyse her atta zaten dolu) —
                  // burada admin'in GERÇEKTEN girdiği iş, yalnız pedigreeNote (pedigri yorumu).
                  const pedigriDolu = race.runners.filter((r) => r.pedigreeNote).length;
                  const tamamlandi = race.runners.length > 0 && pedigriDolu === race.runners.length;
                  return (
                    <details key={race.id} className="group/race">
                      <summary className="flex cursor-pointer list-none items-center justify-between bg-muted/10 px-4 py-1.5 text-xs font-medium [&::-webkit-details-marker]:hidden">
                        <span className="flex items-center gap-2">
                          {race.raceNo}. Koşu <span className="font-normal text-muted-foreground">({race.runners.length} at)</span>
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                              tamamlandi ? "bg-hit/15 text-hit" : pedigriDolu > 0 ? "bg-muted text-muted-foreground" : "bg-miss/10 text-miss"
                            )}
                          >
                            {tamamlandi && <Check className="h-3 w-3" />}
                            {pedigriDolu}/{race.runners.length} pedigri
                          </span>
                        </span>
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open/race:rotate-90" />
                      </summary>
                      <RacePedigreeTable runners={race.runners} />
                    </details>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </div>
    </div>
  );
}
