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

type Result = {
  ok: boolean;
  total: number;
  synced: number;
  failed: number;
  errors: string[];
};

export default function BackfillCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

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
    setResult(null);
    try {
      const res = await fetch("/api/admin/backfill-results", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      setResult(data);
      await fetchPreview();
    } finally {
      setRunning(false);
    }
  }

  const missing = preview?.daysWithMissingResults ?? 0;

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold">Sonuç Backfill (2026)</h3>
          <p className="text-xs text-muted-foreground">
            TJK&apos;dan eksik yarış sonuçlarını tamamla
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={fetchPreview} disabled={loading}>
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        </Button>
      </div>

      {loading && !preview && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" /> Kontrol ediliyor…
        </div>
      )}

      {preview && (
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-sm space-y-0.5">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Eksik gün</span>
            <span className={cn("font-semibold", missing > 0 ? "text-orange-500" : "text-hit")}>
              {missing}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Sonuçsuz yarış</span>
            <span className="font-semibold">{preview.totalRacesWithoutResult}</span>
          </div>
        </div>
      )}

      {result && (
        <div className={cn(
          "rounded-lg px-3 py-2 text-xs space-y-1",
          result.failed === 0 ? "bg-hit/10 border border-hit/20" : "bg-orange-500/10 border border-orange-500/20"
        )}>
          <div className="flex items-center gap-1.5 font-semibold">
            {result.failed === 0
              ? <CheckCircle className="h-3.5 w-3.5 text-hit" />
              : <AlertCircle className="h-3.5 w-3.5 text-orange-500" />}
            {result.synced}/{result.total} gün senkronize edildi
            {result.failed > 0 && `, ${result.failed} hatalı`}
          </div>
          {result.errors.slice(0, 3).map((e, i) => (
            <p key={i} className="text-muted-foreground truncate">{e}</p>
          ))}
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
          <><Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> Çalışıyor… ({preview?.days.length} gün)</>
        ) : missing === 0 ? (
          <><CheckCircle className="mr-2 h-3.5 w-3.5 text-hit" /> Tüm sonuçlar tam</>
        ) : (
          <><RefreshCw className="mr-2 h-3.5 w-3.5" /> {missing} Günü Doldur</>
        )}
      </Button>
    </div>
  );
}
