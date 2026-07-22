"use client";

import { TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import type { ProgramRunner } from "@/server/services/race.service";
import { galopSplits, galopDate, isSameJockey, galopQuality, galopTimeClass } from "./galop-helpers";

export default function GalopPanel({ runners, breed }: { runners: ProgramRunner[]; breed: string }) {
  const withGallops = runners.filter((r) => r.gallops.length > 0);
  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Son Hazırlıklar</span>
      </div>
      {withGallops.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Galop verisi yok.</div>
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
                            title={`İdman jokeyi (${g.jockey}) koşuda da binecek`}
                            className="inline-flex items-center justify-center rounded-full bg-amber-400 p-0.5"
                          >
                            <TriangleAlert className="h-3 w-3 fill-amber-400 stroke-black" strokeWidth={2.5} />
                          </span>
                        )}
                        <span className="font-mono">
                          {prepDist && prepTime && (
                            <span className={galopTimeClass(prepQ)}>{prepDist}·{prepTime}</span>
                          )}
                          {prepDist && finish && <span className="text-muted-foreground mx-0.5">/</span>}
                          {finish && (
                            <span className={cn("text-amber-500 dark:text-amber-400", galopTimeClass(finQ))}>{`400·${finish}`}</span>
                          )}
                          {(prepDist || finish) && final200 && <span className="text-muted-foreground mx-0.5">/</span>}
                          {final200 && (
                            <span className="text-sky-500 dark:text-sky-400">{`200·${final200}`}</span>
                          )}
                        </span>
                      </div>
                      <div className="text-[9px] text-muted-foreground">
                        {galopDate(g)}
                        {g.track && <span className="ml-1 opacity-70">{g.track}</span>}
                        {g.form && <span className="ml-1 opacity-70">· {g.form}</span>}
                        {isInner && <span className="ml-1 text-blue-400 opacity-80">İÇ</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
