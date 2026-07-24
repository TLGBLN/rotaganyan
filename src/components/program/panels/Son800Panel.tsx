"use client";

import { useState, useEffect } from "react";
import { getSon800ForRace, type Son800RunnerData } from "@/server/actions/son800.actions";
import { fmtSaniye, checkpointCols, STIL_LABEL, STIL_RENK } from "@/lib/methodology/pace-format";
import { cn } from "@/lib/utils";

export default function Son800Panel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<Son800RunnerData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getSon800ForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, retryKey]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Accurace — Tüm Kayıtlar</span>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p className="mb-2">Accurace verisi alınamadı.</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            Tekrar Dene
          </button>
        </div>
      ) : (
        <div className="divide-y">
          {(data ?? []).map((d) => (
            <div key={d.runnerNo} className="px-3 py-2">
              <div className="text-xs font-semibold mb-1">
                <span className="font-mono mr-1.5">{d.runnerNo}</span>
                {d.horseName}
              </div>
              {d.records.length === 0 ? (
                <div className="text-[11px] text-muted-foreground ml-5">Accurace kaydı yok</div>
              ) : (
                <div className="space-y-2">
                  {d.records.map((rec, i) => {
                    const cols = checkpointCols(rec.length);
                    return (
                      <div key={i} className="rounded-md border border-border/40 overflow-hidden">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 bg-muted/20 px-1.5 py-1 text-[11px]">
                          <span className="tabular-nums">{rec.date}</span>
                          <span>{rec.hippodrome}</span>
                          <span>{rec.ground}</span>
                          <span className="tabular-nums">{rec.length}m</span>
                          <span className="text-muted-foreground tabular-nums">{rec.place}. sıra</span>
                          <span className="ml-auto font-mono font-semibold text-sky-500 tabular-nums">Son 800: {rec.son800Sure}</span>
                          {rec.stil && (
                            <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-semibold", STIL_RENK[rec.stil])}>
                              {STIL_LABEL[rec.stil]}
                            </span>
                          )}
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-[11px]">
                            <thead>
                              <tr className="text-muted-foreground">
                                {cols.map((c) => (
                                  <th key={c} className="px-1.5 py-0.5 text-center font-medium tabular-nums">{c}m</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              <tr className="border-t border-border/30">
                                {cols.map((c) => {
                                  const cp = rec.checkpoints.find((x) => x.checkpoint === c);
                                  return (
                                    <td key={c} className="px-1.5 py-1 text-center tabular-nums">
                                      {cp ? (
                                        <>
                                          {fmtSaniye(cp.timeReal)}
                                          <span className="ml-1 text-muted-foreground">[{cp.place}]</span>
                                        </>
                                      ) : "—"}
                                    </td>
                                  );
                                })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
