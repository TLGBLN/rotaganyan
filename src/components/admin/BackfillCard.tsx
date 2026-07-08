"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw, CheckCircle, AlertCircle, DatabaseZap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Preview = {
  daysWithMissingResults: number;
  totalRacesWithoutResult: number;
  days: { date: string; races: number }[];
};

type ProgressUpdate = {
  current: number;
  total: number;
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
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState<"results" | "program" | null>(null);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);

  useEffect(() => { fetchPreview(); }, []);

  async function fetchPreview() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backfill-results");
      if (res.ok) setPreview(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function runResults() {
    setRunning("results");
    setProgress(null);
    try {
      await streamPost("/api/admin/backfill-results", setProgress);
      await fetchPreview();
    } finally {
      setRunning(null);
    }
  }

  async function runProgram() {
    setRunning("program");
    setProgress(null);
    try {
      await streamPost("/api/admin/backfill-program", setProgress);
      await fetchPreview();
    } finally {
      setRunning(null);
    }
  }

  const missing = preview?.daysWithMissingResults ?? 0;
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
        <Button variant="ghost" size="icon" onClick={fetchPreview} disabled={loading || isRunning}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {loading && !preview && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Kontrol ediliyor…
        </div>
      )}

      {preview && !isRunning && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sonuçsuz gün</span>
            <span className={cn("font-semibold", missing > 0 ? "text-orange-500" : "text-green-500")}>
              {missing}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sonuçsuz yarış</span>
            <span className="font-semibold">{preview.totalRacesWithoutResult}</span>
          </div>
        </div>
      )}

      {/* Canlı ilerleme */}
      {isRunning && (
        <div className="space-y-2">
          {progress ? (
            <>
              <div className="flex justify-between text-xs">
                <span className="text-muted-foreground">
                  {running === "program" ? "📥 " : "🔄 "}{progress.date} işleniyor…
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
                <span>{progress.current} / {progress.total} gün</span>
                <span className="text-green-500">
                  {running === "program"
                    ? `${progress.withRaces ?? 0} yarışlı, ${progress.empty ?? 0} boş`
                    : `${progress.synced ?? 0} tamam`}
                  {progress.failed > 0 && `, ${progress.failed} hata`}
                </span>
              </div>
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
            {progress.current}/{progress.total} gün tamamlandı
            {progress.failed > 0 && `, ${progress.failed} hatalı`}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        {/* Tam program backfill */}
        <Button
          onClick={runProgram}
          disabled={isRunning}
          size="sm"
          className="flex-1"
          variant="outline"
        >
          {running === "program" ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {progress ? `${progress.current}/${progress.total}` : "…"}</>
          ) : (
            <><DatabaseZap className="mr-1.5 h-3.5 w-3.5" /> Program + Sonuç</>
          )}
        </Button>

        {/* Sadece sonuç sync */}
        <Button
          onClick={runResults}
          disabled={isRunning || missing === 0}
          size="sm"
          className="flex-1"
          variant={missing === 0 ? "outline" : "default"}
        >
          {running === "results" ? (
            <><Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> {progress ? `${progress.current}/${progress.total}` : "…"}</>
          ) : missing === 0 ? (
            <><CheckCircle className="mr-1.5 h-3.5 w-3.5 text-green-500" /> Sonuçlar Tam</>
          ) : (
            <><RefreshCw className="mr-1.5 h-3.5 w-3.5" /> {missing} Sonuç Doldur</>
          )}
        </Button>
      </div>
    </div>
  );
}
