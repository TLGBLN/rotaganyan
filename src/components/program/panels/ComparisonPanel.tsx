"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getAtPerformansForRace, type AtPerformansRunnerData } from "@/server/actions/at-performans.actions";

export default function ComparisonPanel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<AtPerformansRunnerData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAtPerformansForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, retryKey]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">
          Detaylı At Karşılaştırma — Aynı Pist / Mesafe / Hipodrom (2026)
        </span>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{"TJK'dan çekiliyor…"}</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p className="mb-2">Veri alınamadı.</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        // Atlar yan yana sütun olarak dizilir — böylece aynı satır hizasında karşılaştırma yapılabilir, alt alta uzun listede kaybolmaz.
        <div className="max-h-[480px] overflow-auto">
          <div className="flex divide-x min-w-max">
            {(data ?? []).map((d) => (
              <div key={d.runnerNo} className="w-[220px] shrink-0 px-3 py-2">
                <div className="text-xs font-semibold mb-1.5 sticky top-0 bg-background">
                  <span className="font-mono mr-1.5">{d.runnerNo}</span>
                  {d.horseName}
                </div>
                {!d.hasTjkId ? (
                  <div className="text-[11px] text-muted-foreground">TJK kimliği henüz eşleşmedi</div>
                ) : d.records.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground">Bu pist/mesafe/hipodromda 2026&apos;da koşmadı</div>
                ) : (
                  <div className="space-y-1.5">
                    {d.records.map((rec, i) => (
                      <div key={i} className="rounded border border-border/50 px-1.5 py-1 text-[11px]">
                        <div className="flex items-center justify-between">
                          <span className="tabular-nums text-muted-foreground">{rec.date}</span>
                          <span className={cn("font-semibold tabular-nums", rec.finishPos === "1" && "text-hit")}>
                            {rec.finishPos ? `${rec.finishPos}.` : "—"}
                          </span>
                        </div>
                        <div className="mt-0.5 flex items-center justify-between font-mono tabular-nums text-muted-foreground">
                          <span>{rec.time || "—"}</span>
                          <span>{rec.weight ? `${rec.weight}kg` : "—"}</span>
                        </div>
                        <div className="mt-0.5 truncate">{rec.jockey || "—"}</div>
                        <div className="truncate text-muted-foreground">{rec.classType || "—"}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
