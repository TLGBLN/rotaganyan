"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { getSon800ForRace, type Son800RunnerData } from "@/server/actions/son800.actions";
import AccuraceSectionalTable from "./AccuraceSectionalTable";

export default function Son800Panel({ raceId }: { raceId: string }) {
  const t = useTranslations("programToolbar");
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
        <span className="text-sm font-bold tracking-wide text-white">{t("accuraceTitle")}</span>
      </div>

      {loading ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">{t("yukleniyor")}</div>
      ) : error ? (
        <div className="px-4 py-8 text-center text-sm text-muted-foreground">
          <p className="mb-2">{t("veriAlinamadi")}</p>
          <button
            onClick={() => setRetryKey((k) => k + 1)}
            className="rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted"
          >
            {t("tekrarDene")}
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
                <div className="text-[11px] text-muted-foreground ml-5">{t("accuraceKaydiYok")}</div>
              ) : (
                <div className="space-y-2">
                  {d.records.map((rec, i) => (
                    <div key={i}>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 px-0.5 pb-0.5 text-[11px] text-muted-foreground">
                        <span className="tabular-nums">{rec.date}</span>
                        <span>{rec.hippodrome}</span>
                        <span>{rec.ground}</span>
                        <span className="tabular-nums">{rec.length}m</span>
                        <span className="tabular-nums">{t("siraSuffix", { place: rec.place })}</span>
                      </div>
                      <AccuraceSectionalTable
                        length={rec.length}
                        checkpoints={rec.checkpoints}
                        stil={rec.stil}
                        son800Sure={rec.son800Sure}
                        fark={rec.fark}
                        t={t}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
