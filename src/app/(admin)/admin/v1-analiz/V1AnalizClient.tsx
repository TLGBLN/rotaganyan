"use client";

import { useState, Fragment } from "react";
import { getRaceOptionsForDate, type V1RaceOption } from "@/server/actions/v1-analiz.actions";

type FamilyContribution = { family: string; contribution: number };
type SignalRow = {
  code: string;
  family: string | null;
  rawValue: number | null;
  standardizedValue: number;
  learnedCoefficient: number;
  scoreContribution: number;
  observed: boolean;
};
type RunnerResult = {
  no: number;
  name: string;
  score: number;
  probability: number;
  familyContributions: FamilyContribution[];
  signalRows: SignalRow[];
};
type ApiResult = {
  raceId: string;
  modelVersion: string;
  modelCodeCount: number;
  fullyPendingFamilies: string[];
  partiallyScoredFamilies: string[];
  runners: RunnerResult[];
};

export default function V1AnalizClient({
  initialDate,
  initialRaces,
}: {
  initialDate: string;
  initialRaces: V1RaceOption[];
}) {
  const [date, setDate] = useState(initialDate);
  const [races, setRaces] = useState(initialRaces);
  const [raceId, setRaceId] = useState<string>(initialRaces[0]?.id ?? "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ApiResult | null>(null);
  const [expandedNo, setExpandedNo] = useState<number | null>(null);

  async function onDateChange(d: string) {
    setDate(d);
    setResult(null);
    const opts = await getRaceOptionsForDate(d);
    setRaces(opts);
    setRaceId(opts[0]?.id ?? "");
  }

  async function analizEt() {
    if (!raceId) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/v1-analiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? `Hata (${res.status})`);
        return;
      }
      setResult(data as ApiResult);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bilinmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3">
        <div>
          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Tarih</label>
          <input
            type="date"
            value={date}
            onChange={(e) => onDateChange(e.target.value)}
            className="mt-1 rounded-md border bg-background px-2 py-1.5 text-sm"
          />
        </div>
        <div className="min-w-[260px] flex-1">
          <label className="block text-[10px] font-semibold uppercase text-muted-foreground">Yarış</label>
          <select
            value={raceId}
            onChange={(e) => setRaceId(e.target.value)}
            className="mt-1 w-full rounded-md border bg-background px-2 py-1.5 text-sm"
          >
            {races.length === 0 && <option value="">Bu tarihte yarış yok</option>}
            {races.map((r) => (
              <option key={r.id} value={r.id}>
                {r.hippodromeName} — {r.raceNo}. Koşu{r.time ? ` (${r.time})` : ""}
              </option>
            ))}
          </select>
        </div>
        <button
          type="button"
          onClick={analizEt}
          disabled={!raceId || loading}
          className="rounded-md bg-brand px-4 py-2 text-xs font-bold text-brand-foreground disabled:opacity-50"
        >
          {loading ? "Analiz ediliyor…" : "V1.0 ile Analiz Et"}
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          <div className="rounded-lg border bg-muted/20 px-3 py-2 text-xs text-muted-foreground">
            <div>Model: <span className="font-mono text-foreground">{result.modelVersion}</span> — {result.modelCodeCount} kod gerçekten skorda</div>
            {result.fullyPendingFamilies.length > 0 && (
              <div className="mt-1 text-amber-500">
                Tamamen bekleyen (henüz katsayı öğrenilmemiş) aile: {result.fullyPendingFamilies.join(", ")}
              </div>
            )}
            {result.partiallyScoredFamilies.length > 0 && (
              <div className="mt-1 text-amber-500">
                Kısmen eğitilmiş aile: {result.partiallyScoredFamilies.join(", ")}
              </div>
            )}
          </div>

          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/40 text-xs text-muted-foreground">
                  <th className="px-3 py-2 text-left">Sıra</th>
                  <th className="px-3 py-2 text-left">No</th>
                  <th className="px-3 py-2 text-left">At</th>
                  <th className="px-3 py-2 text-right">Kazanma Olasılığı</th>
                  <th className="px-3 py-2 text-right">Skor</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {result.runners.map((r, i) => (
                  <Fragment key={r.no}>
                    <tr className={i % 2 === 0 ? "bg-background" : "bg-muted/10"}>
                      <td className="px-3 py-2 font-bold">{i + 1}.</td>
                      <td className="px-3 py-2 tabular-nums">{r.no}</td>
                      <td className="px-3 py-2 font-medium">{r.name}</td>
                      <td className="px-3 py-2 text-right font-bold tabular-nums">{(r.probability * 100).toFixed(1)}%</td>
                      <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">{r.score.toFixed(3)}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => setExpandedNo(expandedNo === r.no ? null : r.no)}
                          className="text-[11px] text-brand underline"
                        >
                          {expandedNo === r.no ? "Gizle" : "Aile katkıları"}
                        </button>
                      </td>
                    </tr>
                    {expandedNo === r.no && (
                      <tr>
                        <td colSpan={6} className="bg-muted/10 px-3 py-2">
                          <div className="flex flex-wrap gap-2">
                            {r.familyContributions
                              .filter((f) => Math.abs(f.contribution) > 1e-9)
                              .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
                              .map((f) => (
                                <span
                                  key={f.family}
                                  className={`rounded-md border px-2 py-1 text-[11px] tabular-nums ${
                                    f.contribution >= 0 ? "border-hit/40 text-hit" : "border-miss/40 text-miss"
                                  }`}
                                >
                                  {f.family}: {f.contribution >= 0 ? "+" : ""}
                                  {f.contribution.toFixed(3)}
                                </span>
                              ))}
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
