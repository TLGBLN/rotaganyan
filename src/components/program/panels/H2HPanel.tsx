"use client";

import { useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { getH2HForRace, type H2HEncounter } from "@/server/actions/h2h.actions";

export default function H2HPanel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<H2HEncounter[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getH2HForRace(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId]);

  return (
    <div className="border-t">
      <div className="px-4 py-2.5 bg-[#6b3b3b] border-b flex items-center">
        <span className="text-sm font-bold tracking-wide text-white">H2H — Geçmiş Karşılaşmalar</span>
      </div>
      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">TJK geçmişinden ortak yarışlar aranıyor…</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">Veri alınamadı.</div>
      ) : !data || data.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          Bu koşudaki atların TJK geçmişinde birlikte koştuğu bir yarış bulunamadı.
        </div>
      ) : (
        <div className="max-h-[480px] overflow-y-auto divide-y">
          {data.map((enc) => (
            <div key={enc.key} className="px-3 py-2.5">
              <div className="text-[11px] text-muted-foreground mb-1.5">
                {enc.hippodrome} · {enc.raceNo}. Koşu · {enc.date}
              </div>
              <div className="space-y-1">
                {enc.results.map((r, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className={cn(
                        "inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold shrink-0",
                        r.finishPos === "1" ? "bg-[#27ae60] text-white" : "bg-muted text-muted-foreground"
                      )}
                    >
                      {r.finishPos || "—"}
                    </span>
                    <span className="font-medium shrink-0">{r.horseName}</span>
                    <span className="text-[10px] text-muted-foreground truncate">
                      {r.time && <>{r.time} · </>}
                      {r.weight && <>{r.weight}kg · </>}
                      {r.jockey && <>{r.jockey}</>}
                      {r.equipment && <> · {r.equipment}</>}
                      {r.hp && <> · HP {r.hp}</>}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
