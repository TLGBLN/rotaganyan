import type { AltiliCityResult } from "@/server/services/ingest/tjk-altili.adapter";

type Props = { results: AltiliCityResult[] };

export default function AltiliGanyanResults({ results }: Props) {
  if (results.length === 0) return null;
  const cities = results.filter((c) => c.groups.some((g) => g.rows.length > 0));
  if (cities.length === 0) return null;

  return (
    <section className="border-t px-4 py-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-brand animate-pulse" />
          <h2 className="text-lg font-semibold">Altılı Ganyan Sonuçları</h2>
        </div>

        <div className="space-y-10">
          {cities.map((city) => (
            <div key={city.sehirId}>
              <h3 className="mb-4 text-base font-semibold text-muted-foreground">{city.sehirAdi}</h3>
              <div className="grid gap-6 lg:grid-cols-2">
                {city.groups.map((group, i) => (
                  <div key={i} className="overflow-hidden rounded-xl border">
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="bg-muted/60">
                            <th colSpan={5} className="px-3 py-2 text-center text-xs font-bold tracking-wide">
                              {group.title}
                            </th>
                          </tr>
                          <tr className="border-b bg-muted/30">
                            <th className="px-2 py-1.5 sm:px-3 text-center font-medium text-muted-foreground whitespace-nowrap w-10">Koşu</th>
                            <th className="px-2 py-1.5 sm:px-3 text-left font-medium text-muted-foreground whitespace-nowrap">At İsmi</th>
                            <th className="px-2 py-1.5 sm:px-3 text-right font-medium text-muted-foreground whitespace-nowrap">Derece</th>
                            <th className="px-2 py-1.5 sm:px-3 text-right font-medium text-muted-foreground whitespace-nowrap">Ganyan</th>
                            <th className="px-2 py-1.5 sm:px-3 text-right font-medium text-muted-foreground whitespace-nowrap">AGF(GR)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((row) => (
                            <tr key={row.rank} className="border-b last:border-0">
                              <td className="px-2 py-2 sm:px-3 text-center font-bold tabular-nums">{row.rank}</td>
                              <td className="px-2 py-2 sm:px-3 max-w-[120px] truncate font-medium">{row.at || <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-2 py-2 sm:px-3 text-right font-mono tabular-nums">{row.derece || <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-2 py-2 sm:px-3 text-right font-mono tabular-nums text-brand">{row.ganyan || <span className="text-muted-foreground">—</span>}</td>
                              <td className="px-2 py-2 sm:px-3 text-right font-mono tabular-nums">{row.agf || <span className="text-muted-foreground">—</span>}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="border-t bg-muted/20 px-3 py-2 text-xs">
                      {group.payout
                        ? <p className="text-muted-foreground leading-snug">{group.payout}</p>
                        : <p className="text-muted-foreground">Dağıtım bilgisi bekleniyor…</p>
                      }
                      {group.ikramiye && (
                        <p className="mt-1 font-semibold text-hit">{group.ikramiye}</p>
                      )}
                    </div>
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
