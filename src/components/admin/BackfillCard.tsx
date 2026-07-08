"use client";

import { useState, useEffect } from "react";
import { Loader2, RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
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
  synced: number;
  failed: number;
  done: boolean;
};

export default function BackfillCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<ProgressUpdate | null>(null);

  useEffect(() => {
    fetchPreview();
  }, []);

  async function fetchPreview() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/backfill-results");
      if (res.ok) setPreview(await res.json());
    } finally {
      setLoading(false);
    }
  }

  async function runBackfill() {
    setRunning(true);
    setProgress(null);
    try {
      const res = await fetch("/api/admin/backfill-results", {
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
            try {
              setProgress(JSON.parse(line) as ProgressUpdate);
            } catch { /* ignore partial lines */ }
          }
        }
      }

      await fetchPreview();
    } finally {
      setRunning(false);
    }
  }

  const missing = preview?.daysWithMissingResults ?? 0;
  const pct = progress && progress.total > 0
    ? Math.round((progress.current / progress.total) * 100)
    : 0;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Sonuç Backfill (2026)</h3>
          <p className="text-xs text-muted-foreground">
            TJK&apos;dan eksik yarış sonuçlarını tamamla
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchPreview} disabled={loading || running}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {loading && !preview && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Kontrol ediliyor…
        </div>
      )}

      {preview && !running && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Eksik gün</span>
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
      {running && progress && (
        <div className="space-y-2">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">
              {progress.date} işleniyor…
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
            <span className="text-green-500">{progress.synced} tamam{progress.failed > 0 && `, ${progress.failed} hata`}</span>
          </div>
        </div>
      )}

      {running && !progress && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Başlatılıyor…
        </div>
      )}

      {/* Tamamlandı mesajı */}
      {!running && progress?.done && (
        <div className={cn(
          "rounded-lg px-3 py-2 text-xs space-y-1",
          progress.failed === 0
            ? "bg-green-500/10 border border-green-500/20"
            : "bg-orange-500/10 border border-orange-500/20"
        )}>
          <div className="flex items-center gap-1.5 font-semibold">
            {progress.failed === 0
              ? <CheckCircle className="h-3.5 w-3.5 text-green-500" />
              : <AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
            {progress.synced}/{progress.total} gün senkronize edildi
            {progress.failed > 0 && `, ${progress.failed} hatalı`}
          </div>
        </div>
      )}

      <Button
        onClick={runBackfill}
        disabled={running || missing === 0}
        size="sm"
        className="w-full"
        variant={missing === 0 ? "outline" : "default"}
      >
        {running ? (
          <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Çalışıyor… ({progress ? `${progress.current}/${progress.total}` : "…"})</>
        ) : missing === 0 ? (
          <><CheckCircle className="mr-2 h-3.5 w-3.5 text-green-500" /> Tüm sonuçlar tam</>
        ) : (
          <><RefreshCw className="mr-2 h-3.5 w-3.5" /> {missing} Günü Doldur</>
        )}
      </Button>
    </div>
  );
}
