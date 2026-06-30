import type { AltiliCityResult } from "@/server/services/ingest/tjk-altili.adapter";

type Props = { results: AltiliCityResult[] };

export default function AltiliGanyanResults({ results }: Props) {
  if (results.length === 0) return null;

  return (
    <section className="border-t px-4 py-14">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
          <h2 className="text-lg font-semibold">Altılı Ganyan Sonuçları</h2>
        </div>

        <div className="space-y-10">
          {results.map((city) => (
            <div key={city.sehirId}>
              <h3 className="mb-4 text-base font-semibold text-muted-foreground">{city.sehirAdi}</h3>
              <div className="grid gap-6 lg:grid-cols-2">
                {city.groups.map((group, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="px-2 py-2 sm:px-4 sm:py-3 text-left font-medium text-muted-foreground whitespace-nowrap">
                              {group.title}
                            </th>
                            <th className="px-2 py-2 sm:px-4 sm:py-3 text-left font-medium text-muted-foreground whitespace-nowrap">At İsmi</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Derece</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium text-muted-foreground whitespace-nowrap">Ganyan</th>
                            <th className="px-2 py-2 sm:px-4 sm:py-3 text-right font-medium text-muted-foreground whitespace-nowrap">AGF</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.rank} className="border-b last:border-0">
                              <td className="px-2 py-2 sm:px-4 sm:py-2.5 font-semibold whitespace-nowrap">{row.rank}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-2.5 max-w-[100px] truncate">{row.at || "—"}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-2.5 text-right font-mono whitespace-nowrap">{row.derece || "—"}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-2.5 text-right font-mono text-brand whitespace-nowrap">{row.ganyan || "—"}</td>
                              <td className="px-2 py-2 sm:px-4 sm:py-2.5 text-right font-mono whitespace-nowrap">{row.agf || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {(group.payout || group.ikramiye) && (
                      <div className="border-t bg-muted/20 px-4 py-2 text-xs">
                        {group.payout && <p className="text-muted-foreground">{group.payout}</p>}
                        {group.ikramiye && <p className="font-semibold text-hit">{group.ikramiye}</p>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
