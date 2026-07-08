"use client";

import { useState, useEffect, useCallback } from "react";
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

async function streamPost(url: string, onUpdate: (u: ProgressUpdate) => void) {
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
  const [autoLoop, setAutoLoop] = useState(false);

  const fetchPreviews = useCallback(async () => {
    setLoading(true);
    try {
      const [r1, r2] = await Promise.all([
        fetch("/api/admin/backfill-results"),
        fetch("/api/admin/backfill-program"),
      ]);
      if (r1.ok) setResultPreview(await r1.json());
      if (r2.ok) setProgramPreview(await r2.json());
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
      await fetchPreviews();
    } finally {
      setRunning(null);
    }
  }

  async function runProgramBatch() {
    setRunning("program");
    setProgress(null);
    try {
      await streamPost("/api/admin/backfill-program", setProgress);
      await fetchPreviews();
    } finally {
      setRunning(null);
    }
  }

  // Otomatik döngü: bir batch bitti, hâlâ kalan var, devam et
  useEffect(() => {
    if (!autoLoop) return;
    if (running !== null) return;
    if ((programPreview?.missingDays ?? 0) > 0) {
      runProgramBatch();
    } else {
      setAutoLoop(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoLoop, running, programPreview?.missingDays]);

  function startAutoLoop() {
    setAutoLoop(true);
  }

  function stopAutoLoop() {
    setAutoLoop(false);
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
        <Button variant="ghost" size="icon" onClick={fetchPreviews} disabled={loading || isRunning}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {loading && !resultPreview && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Kontrol ediliyor…
        </div>
      )}

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
              Her tıkta {programPreview.batchSize} gün işlenir · {Math.ceil(missingProgram / programPreview.batchSize)} tıklama kaldı
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
                <span className="text-muted-foreground truncate max-w-[160px]">
                  {progress.date}
                </span>
                <span className="font-semibold tabular-nums">{pct}%</span>
              </div>
              <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-brand transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex justify-between text-[11px] text-muted-foreground tabular-nums">
                <span>{progress.current}/{progress.total} (bu batch)</span>
                {progress.remaining !== undefined && (
                  <span>{progress.remaining} gün kaldı</span>
                )}
              </div>
              {running === "program" && (
                <div className="flex gap-3 text-[11px] text-muted-foreground">
                  <span className="text-green-500">{progress.withRaces ?? 0} yarışlı</span>
                  <span>{progress.empty ?? 0} boş</span>
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
      {!isRunning && progress?.done && (
        <div className={cn(
          "rounded-lg px-3 py-2 text-xs",
          progress.failed === 0
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-orange-500/10 border border-orange-500/20"
        )}>
          <div className="flex items-center gap-1.5 font-semibold">
            {progress.failed === 0
              ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              : <AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
            Batch tamamlandı · {progress.remaining ?? 0} gün kaldı
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {/* Program backfill — otomatik döngü ile */}
        {autoLoop ? (
          <Button onClick={stopAutoLoop} size="sm" className="flex-1" variant="destructive">
            <AlertCircle className="mr-1.5 h-3.5 w-3.5" />
            {isRunning ? `Durduruluyor… (${progress?.current ?? 0}/${progress?.total ?? 0})` : "Durdur"}
          </Button>
        ) : (
          <Button
            onClick={startAutoLoop}
            disabled={isRunning || missingProgram === 0}
            size="sm"
            className="flex-1"
            variant={missingProgram === 0 ? "outline" : "default"}
          >
            {missingProgram === 0 ? (
              <><CheckCircle className="mr-1.5 h-3.5 w-3.5 text-green-500" /> Program Tam</>
            ) : (
              <><DatabaseZap className="mr-1.5 h-3.5 w-3.5" /> Otomatik Çek ({missingProgram} gün)</>
            )}
          </Button>
        )}

        {/* Sadece sonuç sync */}
        <Button
          onClick={runResults}
          disabled={isRunning || missingResults === 0}
          size="sm"
          className="flex-1"
          variant="outline"
        >
          {running === "results" ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /></>
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
