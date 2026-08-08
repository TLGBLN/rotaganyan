"use client";

import { CheckCircle2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/utils";
import type { ProgramRunner } from "@/server/services/race.service";
import { galopSplits, galopDate, isSameJockey, galopQuality, galopTimeClass, trainingTypeClass } from "./galop-helpers";

export default function GalopPanel({ runners, breed }: { runners: ProgramRunner[]; breed: string }) {
  const t = useTranslations("programToolbar");
  const withGallops = runners.filter((r) => r.gallops.length > 0);
  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">{t("sonHazirliklar")}</span>
      </div>
      {withGallops.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("galopVerisiYok")}</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-x-4">
          {withGallops.map((r) => (
            <div key={r.id} className="px-3 py-2 border-b">
              <div className="text-[11px] font-semibold mb-1 truncate">
                <span className="font-mono mr-1">{r.no}</span>
                {r.name}
              </div>
              <div className="space-y-1">
                {r.gallops.slice(0, 3).map((g, i) => {
                  const { prepDist, prepTime, finish, final200 } = galopSplits(g);
                  if (!prepDist && !finish && !final200) return null;
                  const isInner = (g.splits["ic_dis"] ?? "").includes("İÇ") || (g.splits["ic_dis"] ?? "").toUpperCase().includes("IC");
                  const prepQ = galopQuality(prepDist ?? "", prepTime, breed, isInner);
                  const finQ = galopQuality("400", finish, breed, isInner);
                  const sameJockey = isSameJockey(g.jockey, r.jockey);
                  return (
                    <div key={i} className="text-[10px] leading-snug">
                      <div className="flex items-baseline gap-1 flex-wrap">
                        {sameJockey && (
                          <span
                            title={t("idmanJokeyiTitle", { jockey: g.jockey ?? "" })}
                            className="inline-flex items-center justify-center rounded-full bg-hit/15 p-0.5"
                          >
                            <CheckCircle2 className="h-3 w-3 text-hit" strokeWidth={2.5} />
                          </span>
                        )}
                        <span className="font-mono">
                          {prepDist && prepTime && (
                            <span className={galopTimeClass(prepQ)}>{prepDist}·{prepTime}</span>
                          )}
                          {prepDist && finish && <span className="text-muted-foreground mx-0.5">/</span>}
                          {finish && (
                            <span className={galopTimeClass(finQ)}>{`400·${finish}`}</span>
                          )}
                          {(prepDist || finish) && final200 && <span className="text-muted-foreground mx-0.5">/</span>}
                          {final200 && <span>{`200·${final200}`}</span>}
                        </span>
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-[9px] text-muted-foreground">
                        <span>{galopDate(g)}</span>
                        {g.track && (
                          <span className={cn("rounded px-1 py-0.5 font-medium leading-none", trainingTypeClass(g.track))}>
                            {g.track}
                          </span>
                        )}
                        {g.form && <span className="opacity-70">· {g.form}</span>}
                        {g.jockey && <span className="font-semibold text-foreground">· {g.jockey}</span>}
                        {isInner && <span className="text-blue-400 opacity-80">{t("icKulvarKisa")}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
      <div className="px-4 py-1.5 text-[10px] text-muted-foreground border-t">
        {t("sonHazirliklarNot")}
      </div>
    </div>
  );
}
