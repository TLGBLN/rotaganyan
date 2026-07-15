"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { getHorseHistory, type HorseHistoryEntry } from "@/server/actions/horse-detail.actions";

function surfaceShort(s: string) {
  if (s === "CIM") return { label: "Çim", cls: "text-[#009900]" };
  if (s === "SENTETIK") return { label: "Sentetik", cls: "text-[#D39B1E]" };
  return { label: "Kum", cls: "text-[#996633]" };
}

function finishClass(pos: number | null) {
  if (pos === 1) return "text-[#27ae60]";
  if (pos != null && pos <= 3) return "text-[#2980b9]";
  return "text-muted-foreground";
}

export default function HorseDetailModal({ name, onClose }: { name: string; onClose: () => void }) {
  const [data, setData] = useState<HorseHistoryEntry[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(false);
    setData(null);
    getHorseHistory(name)
      .then((res) => { if (!cancelled) setData(res); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [name]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg border bg-background shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-sm font-bold">{name}</h2>
          <button type="button" onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto">
          {loading ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Geçmiş yükleniyor…</div>
          ) : error ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Geçmiş yarışlar alınamadı.</div>
          ) : !data || data.length === 0 ? (
            <div className="px-4 py-10 text-center text-sm text-muted-foreground">Geçmiş yarış kaydı bulunamadı.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b bg-muted/60 text-muted-foreground">
                    <th className="px-2 py-1.5 text-left">Tarih</th>
                    <th className="px-2 py-1.5 text-left">Hipodrom</th>
                    <th className="px-2 py-1.5 text-center">Mesafe</th>
                    <th className="px-2 py-1.5 text-center">Pist</th>
                    <th className="px-2 py-1.5 text-left">Jokey</th>
                    <th className="px-2 py-1.5 text-center">Kilo</th>
                    <th className="px-2 py-1.5 text-center">H.P</th>
                    <th className="px-2 py-1.5 text-center">AGF</th>
                    <th className="px-2 py-1.5 text-center">Derece</th>
                    <th className="px-2 py-1.5 text-center">Sonuç</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((h) => {
                    const surf = surfaceShort(h.surface);
                    return (
                      <tr key={h.raceId} className="border-b text-xs">
                        <td className="px-2 py-1.5 tabular-nums whitespace-nowrap">
                          {new Date(h.date).toLocaleDateString("tr-TR")}
                        </td>
                        <td className="px-2 py-1.5">{h.hippodrome} · {h.raceNo}.K</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{h.distance}m</td>
                        <td className={cn("px-2 py-1.5 text-center font-medium", surf.cls)}>{surf.label}</td>
                        <td className="px-2 py-1.5">{h.jockey ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{h.weight ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums font-mono">{h.hp ?? "—"}</td>
                        <td className="px-2 py-1.5 text-center tabular-nums">{h.agf != null ? `%${h.agf.toFixed(1)}` : "—"}</td>
                        <td className="px-2 py-1.5 text-center font-mono tabular-nums">{h.bestTime?.split(" - ")[0] ?? "—"}</td>
                        <td className={cn("px-2 py-1.5 text-center font-semibold", finishClass(h.finishPos))}>
                          {h.scratched ? <span className="text-red-400">Koşmadı</span> : h.finishPos != null ? `${h.finishPos}.` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
