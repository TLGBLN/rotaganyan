"use client";

import { useEffect, useState } from "react";
import { getOrComputeYdPrediction, type YdPredictionResult } from "@/server/actions/yd-prediction.actions";

/**
 * Analiz Motoru YD V1.0 — yurt dışı koşular için. TR'nin AnalysisPanel'inden (bu dosyanın
 * yanındaki diğer panellerden) TAMAMEN AYRI bileşen — kullanıcı kararı 2026-09-30.
 *
 * ÖNEMLİ: bu bir "kazanma olasılığı" DEĞİL, sıralama amaçlı bir skordur (bkz.
 * yd-engine.ts başındaki KALİBRASYON notu — henüz backtest edilmemiş, sonuç verisi
 * biriktikçe ağırlıklar güncellenecek).
 */

function sinyalRengi(puan: number): string {
  if (puan >= 65) return "text-[#27ae60]";
  if (puan >= 45) return "text-muted-foreground";
  return "text-[#e74c3c]";
}

function skorRengi(rank: number): string {
  if (rank === 1) return "bg-[#f5c518]/15 border-l-4 border-l-[#f5c518]";
  if (rank <= 3) return "border-l-4 border-l-[#2980b9]/40";
  return "border-l-4 border-l-transparent";
}

export default function YdAnalysisPanel({ raceId }: { raceId: string }) {
  const [data, setData] = useState<YdPredictionResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    getOrComputeYdPrediction(raceId)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [raceId]);

  if (loading) {
    return <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">Analiz Motoru YD V1.0 hesaplanıyor…</div>;
  }
  if (error || !data || data.picks.length === 0) {
    return <div className="border-t px-4 py-8 text-center text-sm text-muted-foreground">Bu koşu için yeterli veri bulunamadı.</div>;
  }

  return (
    <div className="border-t">
      <div className="bg-muted/30 px-4 py-2 text-[11px] text-muted-foreground">
        <span className="font-semibold text-foreground">Analiz Motoru YD V1.0</span> — deneysel, henüz kalibre
        edilmemiş sıralama skoru (kazanma olasılığı değildir). Piyasa/Form/Pist Uygunluğu/İkramiye
        Trendi/Tazelik sinyallerinin ağırlıklı bileşkesidir.
      </div>
      <div className="divide-y divide-border/60">
        {data.picks.map((p) => {
          const acik = expanded === p.runnerId;
          return (
            <div key={p.runnerId} className={skorRengi(p.rank)}>
              <button
                onClick={() => setExpanded(acik ? null : p.runnerId)}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left hover:bg-muted/20"
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-sm bg-black/10 text-xs font-bold">
                  {p.rank}
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-bold">
                  {p.no}
                </span>
                <span className="min-w-0 flex-1 truncate text-sm font-semibold">{p.name}</span>
                <span className="shrink-0 font-mono text-sm font-bold tabular-nums">{p.toplamPuan.toFixed(1)}</span>
              </button>
              {acik && (
                <div className="grid grid-cols-1 gap-1.5 px-4 pb-3 pl-14 text-[11px] sm:grid-cols-2">
                  {(
                    [
                      ["Piyasa", p.sinyaller.piyasa],
                      ["Form", p.sinyaller.form],
                      ["Pist Uygunluğu", p.sinyaller.pistUygunluk],
                      ["İkramiye Trendi", p.sinyaller.ikramiyeTrend],
                      ["Tazelik", p.sinyaller.tazelik],
                    ] as const
                  ).map(([label, s]) => (
                    <div key={label} className="flex items-baseline justify-between gap-2 rounded border px-2 py-1">
                      <span className="text-muted-foreground">{label}</span>
                      <span className={`font-mono font-semibold ${sinyalRengi(s.puan)}`}>{s.puan.toFixed(0)}</span>
                    </div>
                  ))}
                  <div className="col-span-full mt-1 space-y-0.5 text-muted-foreground">
                    {(
                      [p.sinyaller.piyasa, p.sinyaller.form, p.sinyaller.pistUygunluk, p.sinyaller.ikramiyeTrend, p.sinyaller.tazelik]
                    ).map((s, i) => (
                      <div key={i}>· {s.aciklama}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
