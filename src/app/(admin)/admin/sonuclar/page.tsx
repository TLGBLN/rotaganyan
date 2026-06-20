import { getRacesNeedingResult } from "@/server/services/admin.service";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import ResultForm from "./ResultForm";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

export default async function SonuclarPage() {
  const races = await getRacesNeedingResult();

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-bold">Sonuç Girişi</h1>
      <p className="text-sm text-muted-foreground">
        Yayımlanmış analizlerin sonuçlarını girin. {races.length} koşu bekliyor.
      </p>

      {races.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-sm text-muted-foreground">
          Sonuç girilecek koşu yok.
        </div>
      ) : (
        <div className="space-y-4">
          {races.map((race) => (
            <div key={race.id} className="rounded-lg border p-4">
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-semibold">
                    {race.raceDay.hippodrome.name} — {race.raceNo}. Koşu
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(race.raceDay.date, "d MMMM yyyy (EEEE)", { locale: tr })}
                    {" · "}{race.classType}
                  </p>
                </div>
                {race.prediction?.isBanko && (
                  <Badge variant="outline" className="text-brand">
                    ★ Banko
                  </Badge>
                )}
              </div>
              <ResultForm raceId={race.id} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
