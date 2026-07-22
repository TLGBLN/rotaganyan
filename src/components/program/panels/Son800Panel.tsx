"use client";

import { useState, useEffect } from "react";
import { getSon800ForRace, type Son800RunnerData } from "@/server/actions/son800.actions";

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
        <span className="text-sm font-bold tracking-wide text-white">Son 800 (Accurace)</span>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Yükleniyor…</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p className="mb-2">Son 800 verisi alınamadı.</p>
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
                <div className="overflow-x-auto">
                  <table className="w-full text-[11px]">
                    <thead>
                      <tr className="text-muted-foreground">
                        <th className="px-1.5 py-0.5 text-left font-medium">Tarih</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Hipodrom</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Pist</th>
                        <th className="px-1.5 py-0.5 text-left font-medium">Mesafe</th>
                        <th className="px-1.5 py-0.5 text-center font-medium">Bitiş</th>
                        <th className="px-1.5 py-0.5 text-center font-medium text-sky-500">Son 800</th>
                      </tr>
                    </thead>
                    <tbody>
                      {d.records.map((rec, i) => (
                        <tr key={i} className="border-t border-border/30">
                          <td className="px-1.5 py-1 tabular-nums">{rec.date}</td>
                          <td className="px-1.5 py-1">{rec.hippodrome}</td>
                          <td className="px-1.5 py-1">{rec.ground}</td>
                          <td className="px-1.5 py-1 tabular-nums">{rec.length}</td>
                          <td className="px-1.5 py-1 text-center tabular-nums text-muted-foreground">{rec.place}.</td>
                          <td className="px-1.5 py-1 text-center font-mono font-semibold text-sky-500 tabular-nums">{rec.son800Sure}</td>
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
