"use client";

import { useState, useEffect } from "react";
import { getEquipmentChangesForRace, type EquipmentChangeData } from "@/server/actions/equipment.actions";

export default function EquipmentPanel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<EquipmentChangeData[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getEquipmentChangesForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId, retryKey]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#c0392b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">Takılar</span>
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">TJK geçmişiyle karşılaştırılıyor…</div>
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
      ) : !data || data.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Takı bilgisi yok.</div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto grid grid-cols-1 sm:grid-cols-2">
          {data.map((r, idx) => (
            <div key={r.runnerNo} className={`px-3 py-2.5 border-b ${idx % 2 === 0 ? "sm:border-r" : ""}`}>
              <div className="text-xs font-semibold mb-1">
                <span className="font-mono mr-1.5">{r.runnerNo}</span>
                {r.horseName}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 text-[11px] leading-snug">
                {r.current.length === 0 && r.added.length === 0 && r.removed.length === 0 ? (
                  <span className="text-muted-foreground">Takı yok</span>
                ) : (
                  <>
                    {r.current
                      .filter((c) => !r.added.some((a) => a.code === c.code))
                      .map((c) => (
                        <span key={c.code} className="rounded-full border px-1.5 py-0.5 text-foreground">
                          {c.label}
                        </span>
                      ))}
                    {r.added.map((c) => (
                      <span key={`+${c.code}`} className="rounded-full bg-hit/15 px-1.5 py-0.5 font-semibold text-hit">
                        +{c.label}
                      </span>
                    ))}
                    {r.removed.map((c) => (
                      <span key={`-${c.code}`} className="rounded-full bg-[#c0392b]/15 px-1.5 py-0.5 font-semibold text-[#c0392b]">
                        -{c.label}
                      </span>
                    ))}
                  </>
                )}
              </div>
              {r.lastRaceDate && (r.added.length > 0 || r.removed.length > 0) && (
                <div className="mt-1 text-[10px] text-muted-foreground">
                  Önceki koşuya ({r.lastRaceDate}) göre değişiklik
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
