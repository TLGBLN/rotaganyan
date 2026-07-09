"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Loader2, RefreshCw, CheckCircle, AlertCircle, DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ResultPreview = {
  daysWithMissingResults: number;
  totalRacesWithoutResult: number;
};

type ProgramPreview = {
  totalDays: number;
  missingDays: number;
  batchSize: number;
};

type ProgressUpdate = {
  current: number;
  total: number;
  remaining?: number;
  date: string;
  synced?: number;
  failed: number;
  withRaces?: number;
  empty?: number;
  done: boolean;
};

async function streamPost(url: string, onUpdate: (u: ProgressUpdate) => void): Promise<void> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.body) return;
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    for (const line of lines) {
      if (line.trim()) {
        try { onUpdate(JSON.parse(line)); } catch { /* ignore */ }
      }
    }
  }
}

export default function BackfillCard() {
  const [resultPreview, setResultPreview] = useState<ResultPreview | null>(null);
  const [programPreview, setProgramPreview] = useState<ProgramPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<"results" | "program" | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);
  const [autoActive, setAutoActive] = useState(false);

  // ref ile stop sinyali — state güncellenmesini beklemeden loop içinde kontrol edilebilir
  const stopRef = useRef(false);

  const fetchPreviews = useCallback(async (): Promise<{ missingDays: number }> => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/admin/backfill-results"),
        fetch("/api/admin/backfill-program"),
      ]);
      let missing = 0;
      if (r1.ok) setResultPreview(await r1.json());
      if (r2.ok) {
        const d: ProgramPreview = await r2.json();
        setProgramPreview(d);
        missing = d.missingDays;
      }
      return { missingDays: missing };
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPreviews(); }, [fetchPreviews]);

  async function runResults() {
    setRunning("results");
    setProgress(null);
    try {
      await streamPost("/api/admin/backfill-results", setProgress);
    } finally {
      setRunning(null);
      fetchPreviews();
    }
  }

  async function startAutoProgram() {
    stopRef.current = false;
    setAutoActive(true);
    setRunning("program");

    // Kalan gün yokken veya durdurulana kadar döngü
    let remaining = programPreview?.missingDays ?? 1;
    while (remaining > 0 && !stopRef.current) {
      setProgress(null);
      await streamPost("/api/admin/backfill-program", (u) => {
        setProgress(u);
        if (u.remaining !== undefined) remaining = u.remaining;
      });
      // Batch bitti, preview güncelle
      const result = await fetchPreviews();
      remaining = result.missingDays;
    }

    setRunning(null);
    setAutoActive(false);
  }

  function stopAutoProgram() {
    stopRef.current = true;
    setAutoActive(false);
  }

  const missingResults = resultPreview?.daysWithMissingResults ?? 0;
  const missingProgram = programPreview?.missingDays ?? 0;
  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;
  const isRunning = running !== null;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Veri Backfill (2026)</h3>
          <p className="text-xs text-muted-foreground">
            TJK&apos;dan eksik program ve sonuçları tamamla
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => fetchPreviews()} disabled={loading || isRunning}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {/* Özet */}
      {(resultPreview || programPreview) && !isRunning && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Program eksik gün</span>
            <span className={cn("font-semibold", missingProgram > 0 ? "text-orange-500" : "text-green-500")}>
              {missingProgram} / {programPreview?.totalDays ?? "—"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sonuçsuz yarış</span>
            <span className={cn("font-semibold", missingResults > 0 ? "text-orange-500" : "text-green-500")}>
              {resultPreview?.totalRacesWithoutResult ?? "—"}
            </span>
          </div>
          {missingProgram > 0 && programPreview && (
            <p className="text-[10px] text-muted-foreground pt-0.5">
              ~{Math.ceil(missingProgram / programPreview.batchSize)} batch · otomatik çalışır
            </p>
          )}
        </div>
      )}

      {/* Canlı ilerleme */}
      {isRunning && (
        <div className="space-y-2">
          {progress ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">{progress.date}</span>
                <span className="font-semibold tabular-nums">{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{progress.current}/{progress.total} (batch)</span>
                {progress.remaining !== undefined && (
                  <span className={progress.remaining > 0 ? "text-orange-400" : "text-green-500"}>
                    {progress.remaining > 0 ? `${progress.remaining} gün kaldı` : "Son batch!"}
                  </span>
                )}
              </div>
              {running === "program" && (
                <div className="flex gap-3 text-[11px]">
                  <span className="text-green-500">{progress.withRaces ?? 0} yarışlı</span>
                  <span className="text-muted-foreground">{progress.empty ?? 0} boş</span>
                  {progress.failed > 0 && <span className="text-orange-500">{progress.failed} hata</span>}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" /> Başlatılıyor…
            </div>
          )}
        </div>
      )}

      {/* Tamamlandı */}
      {!isRunning && !autoActive && progress?.done && missingProgram === 0 && (
        <div className="rounded-lg px-3 py-2 text-xs bg-green-500/10 border border-green-500/20">
          <div className="flex items-center gap-1.5 font-semibold text-green-500">
            <CheckCircle className="h-3.5 w-3.5" /> Tüm program verisi tamamlandı
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {autoActive ? (
          <Button onClick={stopAutoProgram} size="sm" className="flex-1" variant="destructive">
            <AlertCircle className="mr-1.5 h-3.5 w-3.5" /> Durdur
          </Button>
        ) : (
          <Button
            onClick={startAutoProgram}
            disabled={isRunning || missingProgram === 0}
            size="sm"
            className="flex-1"
            variant={missingProgram === 0 ? "outline" : "default"}
          >
            {missingProgram === 0 ? (
              <><CheckCircle className="mr-1.5 h-3.5 w-3.5 text-green-500" /> Program Tam</>
            ) : (
              <><DatabaseZap className="mr-1.5 h-3.5 w-3.5" /> Tümünü Çek ({missingProgram} gün)</>
            )}
          </Button>
        )}

        <Button
          onClick={runResults}
          disabled={isRunning || missingResults === 0}
          size="sm"
          className="flex-1"
          variant="outline"
        >
          {running === "results" ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : missingResults === 0 ? (
            <><CheckCircle className="mr-1.5 h-3.5 w-3.5 text-green-500" /> Sonuç Tam</>
          ) : (
            <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Sonuç Doldur</>
          )}
        </Button>
      </div>
    </div>
  );
}
