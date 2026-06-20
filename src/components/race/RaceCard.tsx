import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { cn, surfaceLabel, breedLabel } from "@/lib/utils";
import type { RaceDetail } from "@/server/services/race.service";
import AnalysisTopics from "./AnalysisTopics";

type Props = {
  race: RaceDetail;
  showAnalysis?: boolean;
};

export default function RaceCard({ race, showAnalysis = false }: Props) {
  const { runners, raceDay } = race;

  return (
    <section>
      {/* Race meta */}
      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <Badge variant="secondary">{race.classType}</Badge>
        <Badge variant="outline">{breedLabel(race.breed)}</Badge>
        <Badge variant="outline">{surfaceLabel(race.surface)}</Badge>
        <span>{race.distance}m</span>
        {race.ageWeight && <span>· {race.ageWeight}</span>}
        {race.conditions && <span>· {race.conditions}</span>}
        {race.trackRecord && <span className="text-xs">E.İ.D.: {race.trackRecord}</span>}
      </div>

      {showAnalysis && (
        <AnalysisTopics
          runners={runners.map((r) => ({
            id: r.id,
            no: r.no,
            name: r.name,
            weight: r.weight,
            weightChange: r.weightChange,
            agf: r.agf,
            sameJockey: r.sameJockey,
            equipmentAdded: r.equipmentAdded,
            equipmentRemoved: r.equipmentRemoved,
            startNo: r.startNo,
            gallops: r.gallops.map((g) => ({
              form: g.form,
              track: g.track,
              date: g.date,
              splits: g.splits,
            })),
          }))}
          raceCtx={{
            classType: race.classType,
            distance: race.distance,
            surface: race.surface,
            breed: race.breed,
            runnerCount: runners.length,
          }}
          raceNo={race.raceNo}
          hippodrome={raceDay.hippodrome.name}
        />
      )}

      <Tabs defaultValue="runners">
        <TabsList className="h-8 text-xs">
          <TabsTrigger value="runners" className="text-xs">At / Jokey / Antrenör</TabsTrigger>
          <TabsTrigger value="gallops" className="text-xs">İdman Bilgileri</TabsTrigger>
          <TabsTrigger value="info" className="text-xs">Koşu Bilgisi</TabsTrigger>
        </TabsList>

        {/* ── At / Jokey / Antrenör ── */}
        <TabsContent value="runners" className="mt-2">
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">No</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">At</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Jokey</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Antrenör</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">KG</th>
                  <th className="px-2 py-2 text-right font-medium text-muted-foreground">AGF</th>
                  <th className="px-2 py-2 text-left font-medium text-muted-foreground">Takı</th>
                </tr>
              </thead>
              <tbody>
                {runners.map((runner, i) => (
                  <tr
                    key={runner.id}
                    className={cn(
                      "border-b last:border-0 transition-colors hover:bg-muted/30",
                      i % 2 === 1 && "race-row-even"
                    )}
                  >
                    <td className="px-2 py-2 font-mono font-semibold">{runner.no}</td>
                    <td className="px-2 py-2">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">{runner.name}</span>
                        {runner.sameJockey && (
                          <span className="rounded bg-yellow-100 px-1 text-[10px] font-semibold text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
                            İJ
                          </span>
                        )}
                      </div>
                      {runner.sire && (
                        <div className="text-[10px] text-muted-foreground">
                          {runner.sire}
                          {runner.damSire && ` × ${runner.damSire}`}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">{runner.jockey ?? "—"}</td>
                    <td className="px-2 py-2 text-muted-foreground">{runner.trainer ?? "—"}</td>
                    <td className="px-2 py-2 text-right font-mono">
                      {runner.weight ?? "—"}
                      {runner.weightChange != null && (
                        <span
                          className={cn(
                            "ml-1 text-[10px]",
                            runner.weightChange < 0 ? "text-hit" : "text-miss"
                          )}
                        >
                          ({runner.weightChange > 0 ? "+" : ""}
                          {runner.weightChange})
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-2 text-right font-mono">
                      {runner.agf != null ? `%${runner.agf.toFixed(1)}` : "—"}
                    </td>
                    <td className="px-2 py-2 text-muted-foreground">
                      <div>
                        {runner.equipment ?? "—"}
                        {runner.equipmentAdded && (
                          <span className="ml-1 text-[10px] text-hit">+{runner.equipmentAdded}</span>
                        )}
                        {runner.equipmentRemoved && (
                          <span className="ml-1 text-[10px] text-miss">-{runner.equipmentRemoved}</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        {/* ── İdman Bilgileri ── */}
        <TabsContent value="gallops" className="mt-2">
          <div className="space-y-3">
            {runners.map((runner) =>
              runner.gallops.length === 0 ? null : (
                <div key={runner.id}>
                  <p className="mb-1 text-xs font-semibold">
                    {runner.no} {runner.name}
                  </p>
                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b bg-muted/40">
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Tarih</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Pist</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Jokey</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Şekil</th>
                          <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Süre (kademe)</th>
                        </tr>
                      </thead>
                      <tbody>
                        {runner.gallops.map((g) => {
                          const splits = g.splits as Record<string, string>;
                          return (
                            <tr key={g.id} className="border-b last:border-0">
                              <td className="px-2 py-1.5">
                                {new Date(g.date).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit" })}
                              </td>
                              <td className="px-2 py-1.5">{g.track ?? "—"}</td>
                              <td className="px-2 py-1.5">{g.jockey ?? "—"}</td>
                              <td className="px-2 py-1.5 font-medium">{g.form ?? "—"}</td>
                              <td className="px-2 py-1.5 font-mono text-[10px]">
                                {Object.entries(splits)
                                  .map(([m, t]) => `${m}m: ${t}`)
                                  .join(" | ")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )
            )}
            {runners.every((r) => r.gallops.length === 0) && (
              <p className="py-4 text-center text-sm text-muted-foreground">İdman bilgisi girilmemiş.</p>
            )}
          </div>
        </TabsContent>

        {/* ── Koşu Bilgisi ── */}
        <TabsContent value="info" className="mt-2">
          <div className="rounded-lg border p-4 text-sm">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3">
              {[
                ["Tür", race.classType],
                ["Cins", breedLabel(race.breed)],
                ["Pist", surfaceLabel(race.surface)],
                ["Mesafe", `${race.distance}m`],
                ["Yaş/Kilo", race.ageWeight],
                ["E.İ.D.", race.trackRecord],
                ["Hipodrom", raceDay.hippodrome.name],
                ["Koşu No", `${race.raceNo}. Koşu`],
                ["Saat", race.time],
              ]
                .filter(([, v]) => v)
                .map(([label, value]) => (
                  <div key={label as string}>
                    <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                    <dd className="mt-0.5">{value}</dd>
                  </div>
                ))}
            </dl>
            {race.conditions && (
              <p className="mt-3 border-t pt-3 text-xs text-muted-foreground">{race.conditions}</p>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </section>
  );
}
