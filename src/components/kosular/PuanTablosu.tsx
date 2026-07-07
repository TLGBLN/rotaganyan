import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { cn } from "@/lib/utils";
import type { ProgramRaceDay } from "@/server/services/race.service";

type Props = {
  raceDay: ProgramRaceDay;
  isLoggedIn: boolean;
  currentDate: string;
};

type Race = { raceNo: number };
function chunkIntoAltili<T extends Race>(
  allRaces: T[],
  analyzedRaces: T[]
): { label: string; races: T[] }[] {
  if (allRaces.length <= 6) {
    return analyzedRaces.length > 0 ? [{ label: "1.Altılı", races: analyzedRaces }] : [];
  }
  const g1Nos = new Set(allRaces.slice(0, 6).map((r) => r.raceNo));
  const g2Nos = new Set(allRaces.slice(allRaces.length - 6).map((r) => r.raceNo));
  const g1 = analyzedRaces.filter((r) => g1Nos.has(r.raceNo));
  const g2 = analyzedRaces.filter((r) => g2Nos.has(r.raceNo));
  const result: { label: string; races: T[] }[] = [];
  if (g1.length > 0) result.push({ label: "1.Altılı", races: g1 });
  if (g2.length > 0) result.push({ label: "2.Altılı", races: g2 });
  return result;
}

function finishPos(actualOrder: unknown, runnerNo: number | null | undefined): number | null {
  if (!Array.isArray(actualOrder) || runnerNo == null) return null;
  const idx = (actualOrder as string[]).findIndex((s) => parseInt(s, 10) === runnerNo);
  return idx >= 0 ? idx + 1 : null;
}

function rankColor(rank: number): string {
  if (rank <= 3) return "text-hit";
  if (rank <= 6) return "text-brand";
  return "text-muted-foreground";
}

function rankWeight(rank: number): string {
  if (rank === 1) return "font-bold";
  if (rank <= 3) return "font-semibold";
  if (rank <= 6) return "font-medium";
  return "";
}

export default function PuanTablosu({ raceDay, isLoggedIn, currentDate }: Props) {
  const analyzedRaces = raceDay.races.filter(
    (r) => r.prediction?.published && (r.prediction.picks?.length ?? 0) > 0
  );

  if (analyzedRaces.length === 0) return null;

  const hipName = raceDay.hippodrome.name;
  const racePath = `/kosular?tarih=${currentDate}&hippodrom=${raceDay.hippodrome.slug}`;

  if (!isLoggedIn) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed py-8 text-center text-sm text-muted-foreground">
        <Lock className="h-5 w-5" />
        <p className="font-medium">{hipName} puan tablosunu görmek için giriş yapmalısınız.</p>
        <div className="flex gap-2">
          <Button asChild size="sm">
            <Link href={`/giris?callbackUrl=${encodeURIComponent(racePath)}`}>Giriş Yap</Link>
          </Button>
          <Button asChild size="sm" variant="outline">
            <Link href={`/kayit?callbackUrl=${encodeURIComponent(racePath)}`}>Kayıt Ol</Link>
          </Button>
        </div>
      </div>
    );
  }

  const groups = chunkIntoAltili(raceDay.races, analyzedRaces);

  return (
    <div className="space-y-6">
      {groups.map(({ label: altiliLabel, races: group }, gi) => {
        const maxRows = Math.max(...group.map((r) => r.prediction!.picks.length));

        return (
          <div key={gi} className="rounded-xl border">
            {/* Başlık */}
            <div className="border-b bg-muted/30 px-4 py-2.5">
              <span className="text-sm font-semibold">
                {hipName} — {altiliLabel} Rotaganyan Puan Tablosu
              </span>
            </div>

            {/* ── MOBİL: her koşu ayrı kart, alt alta ── */}
            <div className="sm:hidden divide-y">
              {group.map((race) => (
                <div key={race.id}>
                  <div className="bg-muted/20 px-3 py-2 text-xs font-bold">
                    {race.raceNo}. Koşu{race.time ? ` · ${race.time}` : ""}
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/10">
                        <th className="w-6 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground">#</th>
                        <th className="px-2 py-1 text-left text-[10px] font-medium text-muted-foreground">No · Ad</th>
                        <th className="w-12 px-2 py-1 text-center text-[10px] font-medium text-muted-foreground">Puan</th>
                      </tr>
                    </thead>
                    <tbody>
                      {race.prediction!.picks.map((pick, rowIdx) => {
                        const isBanko = race.prediction!.isBanko && pick?.rank === 1;
                        const isTarget = pick?.isTarget;
                        const isWinner =
                          race.result?.winnerNo != null &&
                          pick?.runner?.no === race.result.winnerNo;
                        const rowBg = isBanko
                          ? "bg-brand"
                          : isWinner
                          ? "bg-[#C98F02]/20"
                          : isTarget
                          ? "bg-hit/15"
                          : "";
                        const textColor = isBanko
                          ? "text-white"
                          : isWinner
                          ? "text-[#F5C518]"
                          : rankColor(pick.rank);
                        const weight = rankWeight(pick.rank);

                        return (
                          <tr key={rowIdx} className={cn("border-b last:border-0", rowBg)}>
                            <td className="px-2 py-1.5 text-center tabular-nums text-muted-foreground">
                              {rowIdx + 1}
                            </td>
                            <td className={cn("px-2 py-1.5", textColor, weight)}>
                              <span className="font-mono mr-1 tabular-nums">
                                {pick.runner?.no ?? "—"}
                              </span>
                              <span className={cn(pick.runner?.scratched && "line-through opacity-50")}>
                                {(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel?.replace(/^\d+\s+/, "") ?? pick.runnerLabel ?? "—"}
                              </span>
                              {pick.runner?.scratched && (
                                <span className="ml-1 text-[10px] font-semibold text-red-400">Koşmaz</span>
                              )}
                              {(() => {
                                const pos = finishPos(race.result?.actualOrder, pick.runner?.no);
                                return pos != null ? (
                                  <span className={cn("ml-1 text-[10px] font-semibold", pos === 1 ? "text-[#F5C518]" : "text-muted-foreground")}>
                                    ({pos}.)
                                  </span>
                                ) : null;
                              })()}
                            </td>
                            <td className={cn("px-2 py-1.5 text-center font-mono tabular-nums", textColor, weight)}>
                              {pick.score ?? "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* ── MASAÜSTÜ: tüm koşular yan yana tablo ── */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-[10px]">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th
                      rowSpan={2}
                      className="w-8 border-r px-2 text-center text-[10px] font-medium text-muted-foreground align-middle"
                    >
                      #
                    </th>
                    {group.map((race, ri) => (
                      <th
                        key={race.id}
                        colSpan={3}
                        className={cn(
                          "border-r px-3 py-2 text-center last:border-r-0",
                          ri % 2 === 1 && "bg-muted/10"
                        )}
                      >
                        <div className="whitespace-nowrap text-[11px] font-bold">
                          {race.raceNo}. Koşu
                        </div>
                        <div className="whitespace-nowrap text-[10px] font-normal text-muted-foreground">
                          {race.time ?? "—"}
                        </div>
                      </th>
                    ))}
                  </tr>

                  <tr className="border-b bg-muted/10">
                    {group.map((race, ri) => (
                      <>
                        <th
                          key={`${race.id}-ni`}
                          colSpan={2}
                          className={cn(
                            "px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground",
                            ri % 2 === 1 && "bg-muted/10"
                          )}
                        >
                          No · İsim
                        </th>
                        <th
                          key={`${race.id}-puan`}
                          className={cn(
                            "w-10 border-r px-2 py-1.5 text-center text-[10px] font-medium text-muted-foreground last:border-r-0",
                            ri % 2 === 1 && "bg-muted/10"
                          )}
                        >
                          Puan
                        </th>
                      </>
                    ))}
                  </tr>
                </thead>

                <tbody>
                  {Array.from({ length: maxRows }).map((_, rowIdx) => (
                    <tr key={rowIdx} className="border-b last:border-0">
                      <td className="border-r px-2 py-1.5 text-center text-[10px] tabular-nums text-muted-foreground">
                        {rowIdx + 1}
                      </td>

                      {group.map((race, ri) => {
                        const pick = race.prediction!.picks[rowIdx];
                        const isBanko = race.prediction!.isBanko && pick?.rank === 1;
                        const isTarget = pick?.isTarget;
                        const isWinner =
                          race.result?.winnerNo != null &&
                          pick?.runner?.no === race.result.winnerNo;
                        const colBg = ri % 2 === 1 ? "bg-muted/5" : "";

                        if (!pick) {
                          return (
                            <>
                              <td key={`${race.id}-${rowIdx}-a`} colSpan={2} className={cn("px-2 py-1.5", colBg)} />
                              <td key={`${race.id}-${rowIdx}-b`} className={cn("border-r px-2 py-1.5 last:border-r-0", colBg)} />
                            </>
                          );
                        }

                        const rowBg = isBanko ? "bg-brand" : isWinner ? "bg-[#C98F02]/20" : isTarget ? "bg-hit/15" : colBg;
                        const textColor = isBanko ? "text-white" : isWinner ? "text-[#F5C518]" : rankColor(pick.rank);
                        const weight = rankWeight(pick.rank);

                        return (
                          <>
                            <td
                              key={`${race.id}-${rowIdx}-ni`}
                              colSpan={2}
                              className={cn("px-2 py-1.5", rowBg, textColor)}
                            >
                              <div className="flex items-center gap-1 whitespace-nowrap">
                                <span className={cn("shrink-0 font-mono tabular-nums", weight)}>
                                  {pick.runner?.no ?? "—"}
                                </span>
                                <span className={cn(weight, pick.runner?.scratched && "line-through opacity-50")}>
                                  {(pick.runner?.name && !/^\d+$/.test(pick.runner.name) ? pick.runner.name : null) ?? pick.runnerLabel?.replace(/^\d+\s+/, "") ?? pick.runnerLabel ?? "—"}
                                </span>
                                {pick.runner?.scratched && (
                                  <span className="text-[10px] font-semibold text-red-400">Koşmaz</span>
                                )}
                                {(() => {
                                  const pos = finishPos(race.result?.actualOrder, pick.runner?.no);
                                  return pos != null ? (
                                    <span className={cn("text-[10px] font-semibold", pos === 1 ? "text-[#F5C518]" : "text-muted-foreground")}>
                                      ({pos}.)
                                    </span>
                                  ) : null;
                                })()}
                              </div>
                            </td>

                            <td
                              key={`${race.id}-${rowIdx}-puan`}
                              className={cn(
                                "border-r px-2 py-1.5 text-center font-mono tabular-nums last:border-r-0",
                                rowBg,
                                textColor,
                                weight
                              )}
                            >
                              {pick.score ?? "—"}
                            </td>
                          </>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}
    </div>
  );
}
