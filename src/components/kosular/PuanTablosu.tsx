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

const MAX_LEGS = 6;

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

  // Group into sets of MAX_LEGS
  const groups: typeof analyzedRaces[] = [];
  for (let i = 0; i < analyzedRaces.length; i += MAX_LEGS) {
    groups.push(analyzedRaces.slice(i, i + MAX_LEGS));
  }

  return (
    <div className="space-y-6">
      {groups.map((group, gi) => {
        const maxRows = Math.max(...group.map((r) => r.prediction!.picks.length));
        const groupLabel = groups.length > 1 ? ` ${gi + 1}.` : "";

        return (
          <div key={gi} className="overflow-x-auto rounded-xl border">
            {/* Table title */}
            <div className="border-b bg-muted/30 px-4 py-2.5">
              <span className="text-sm font-semibold">
                {hipName} —{groupLabel} {group.length}&apos;lı Puan Tablosu
              </span>
            </div>

            <table className="w-full text-xs">
              <thead>
                {/* Row 1: AYAK headers */}
                <tr className="border-b bg-muted/20">
                  {/* Sıra column */}
                  <th
                    rowSpan={2}
                    className="w-7 border-r px-2 py-2 text-center text-[10px] font-medium text-muted-foreground align-middle"
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
                      <div className="text-[11px] font-bold">
                        {ri + 1 + gi * MAX_LEGS}. AYAK
                      </div>
                      <div className="text-[10px] font-normal text-muted-foreground">
                        {race.raceNo}. Koşu · {race.time ?? "—"}
                      </div>
                    </th>
                  ))}
                </tr>

                {/* Row 2: sub-headers (No, İsim, Puan) per ayak */}
                <tr className="border-b bg-muted/10">
                  {group.map((race, ri) => (
                    <>
                      <th
                        key={`${race.id}-no`}
                        className={cn(
                          "w-10 px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground",
                          ri % 2 === 1 && "bg-muted/10"
                        )}
                      >
                        No
                      </th>
                      <th
                        key={`${race.id}-isim`}
                        className={cn(
                          "px-1 py-1.5 text-left text-[10px] font-medium text-muted-foreground",
                          ri % 2 === 1 && "bg-muted/10"
                        )}
                      >
                        İsim
                      </th>
                      <th
                        key={`${race.id}-puan`}
                        className={cn(
                          "w-10 border-r px-1 py-1.5 text-center text-[10px] font-medium text-muted-foreground last:border-r-0",
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
                    {/* Sıra */}
                    <td className="border-r px-2 py-1.5 text-center text-[10px] font-semibold text-muted-foreground">
                      {rowIdx + 1}
                    </td>

                    {group.map((race, ri) => {
                      const pick = race.prediction!.picks[rowIdx];
                      const isBanko = race.prediction!.isBanko && pick?.rank === 1;
                      const isTarget = pick?.isTarget;

                      const rowBg = isBanko
                        ? "bg-brand text-white"
                        : isTarget
                        ? "bg-hit/15"
                        : ri % 2 === 1
                        ? "bg-muted/5"
                        : "";

                      const peerBg = ri % 2 === 1 && !isBanko && !isTarget ? "bg-muted/5" : "";

                      const scoreColor =
                        isBanko || isTarget
                          ? ""
                          : pick?.rank === 1
                          ? "text-hit font-bold"
                          : pick?.rank === 2
                          ? "text-hit/70 font-semibold"
                          : pick?.rank === 3
                          ? "text-brand font-medium"
                          : "text-muted-foreground";

                      if (!pick) {
                        return (
                          <>
                            <td key={`${race.id}-${rowIdx}-no`} className={cn("px-1 py-1.5", peerBg)} />
                            <td key={`${race.id}-${rowIdx}-isim`} className={cn("px-1 py-1.5", peerBg)} />
                            <td key={`${race.id}-${rowIdx}-puan`} className={cn("border-r px-1 py-1.5 last:border-r-0", peerBg)} />
                          </>
                        );
                      }

                      return (
                        <>
                          {/* At No + Forma */}
                          <td
                            key={`${race.id}-${rowIdx}-no`}
                            className={cn("whitespace-nowrap px-2 py-1.5", rowBg)}
                          >
                            <div className="flex items-center gap-1.5">
                              {pick.runner?.formaUrl ? (
                                <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm bg-white p-0.5 ring-1 ring-border/50">
                                  {/* eslint-disable-next-line @next/next/no-img-element */}
                                  <img
                                    src={pick.runner.formaUrl}
                                    alt=""
                                    className="h-full w-full object-contain"
                                  />
                                </span>
                              ) : (
                                <span className="inline-flex h-5 w-5 shrink-0 rounded-sm bg-muted/40" />
                              )}
                              <span className="font-mono font-bold">{pick.runner?.no ?? "—"}</span>
                            </div>
                          </td>

                          {/* İsim */}
                          <td
                            key={`${race.id}-${rowIdx}-isim`}
                            className={cn("px-1 py-1.5 font-medium", rowBg)}
                          >
                            <span className="block max-w-[100px] truncate">
                              {pick.runner?.name ?? pick.runnerLabel ?? "—"}
                            </span>
                          </td>

                          {/* Puan */}
                          <td
                            key={`${race.id}-${rowIdx}-puan`}
                            className={cn(
                              "border-r px-1 py-1.5 text-center font-mono last:border-r-0",
                              rowBg,
                              scoreColor
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
        );
      })}
    </div>
  );
}
