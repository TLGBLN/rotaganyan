"use client";

import { useState } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function JokeySyncButton() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSync() {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const res = await fetch("/api/admin/sync-jokey-stats", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={handleSync}
        disabled={loading}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
          loading
            ? "opacity-60 pointer-events-none text-muted-foreground"
            : "hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        {loading ? "Senkronize ediliyor…" : "Sonuçlardan Güncelle"}
      </button>
      {result && (
        <div className="flex items-center gap-1.5 text-xs text-green-600">
          <CheckCircle className="h-3.5 w-3.5" />
          {result.count} jokey/hipodrom kombinasyonu güncellendi
        </div>
      )}
      {error && (
        <div className="flex items-center gap-1.5 text-xs text-red-500">
          <AlertCircle className="h-3.5 w-3.5" />
          {error}
        </div>
      )}
    </div>
  );
}
