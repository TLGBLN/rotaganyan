"use client";

import { useState, useEffect } from "react";
import { getAtPerformansForRace, type AtPerformansRunnerData } from "@/server/actions/at-performans.actions";

export default function ComparisonPanel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<AtPerformansRunnerData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getAtPerformansForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#2c5f5f] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">
          Detaylı At Karşılaştırma — Aynı Pist / Mesafe / Hipodrom (2026)
        </span>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{"TJK'dan çekiliyor…"}</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Veri alınamadı.</div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto divide-y">
          {(data ?? []).map((d) => (
            <div key={d.runnerNo} className="px-3 py-2">
              <div className="text-xs font-semibold mb-1">
                <span className="font-mono mr-1.5">{d.runnerNo}</span>
                {d.horseName}
              </div>
              {!d.hasTjkId ? (
                <div className="text-[11px] text-muted-foreground ml-5">TJK kimliği henüz eşleşmedi</div>
              ) : d.records.length === 0 ? (
                <div className="text-[11px] text-muted-foreground ml-5">Bu pist/mesafe/hipodromda 2026&apos;da koşmadı</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="px-1.5 py-0.5 text-left font-medium">Tarih</th>
                        <th className="px-1.5 py-0.5 text-center font-medium">Sıra</th>
                        <th className="px-1.5 py-0.5 text-center font-medium">Derece</th>
                        <th className="px-1.5 py-0.5 text-center font-medium">Kilo</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Jokey</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Koşu Cinsi</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.records.map((rec, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-1.5 py-1 tabular-nums">{rec.date}</td>
                          <td className={`px-1.5 py-1 text-center font-semibold tabular-nums ${rec.finishPos === "1" ? "text-hit" : ""}`}>
                            {rec.finishPos || "—"}
                          </td>
                          <td className="px-1.5 py-1 text-center font-mono tabular-nums">{rec.time || "—"}</td>
                          <td className="px-1.5 py-1 text-center tabular-nums">{rec.weight || "—"}</td>
                          <td className="px-1.5 py-1">{rec.jockey || "—"}</td>
                          <td className="px-1.5 py-1">{rec.classType || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
