"use client";

import { useState } from "react";
import { RefreshCw, Trash2, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function JokeySyncButton() {
  const [syncLoading, setSyncLoading] = useState(false);
  const [clearLoading, setClearLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSync() {
    setSyncLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sync-jokey-stats", { method: "POST" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata");
      setMsg({ text: `${data.count} kombinasyon güncellendi`, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setSyncLoading(false);
    }
  }

  async function handleClear() {
    if (!confirm("2026 jokey istatistiklerinin tamamı silinecek. Emin misiniz?")) return;
    setClearLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/clear-jokey-stats", { method: "DELETE" });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata");
      setMsg({ text: `${data.deleted} satır silindi — JSON import ile yeniden ekleyebilirsiniz`, ok: true });
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), ok: false });
    } finally {
      setClearLoading(false);
    }
  }

  const busy = syncLoading || clearLoading;

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <button
          onClick={handleSync}
          disabled={busy}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            busy ? "opacity-60 pointer-events-none text-muted-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
          )}
        >
          <RefreshCw className={cn("h-3.5 w-3.5", syncLoading && "animate-spin")} />
          {syncLoading ? "Güncelleniyor…" : "Sonuçlardan Güncelle"}
        </button>
        <button
          onClick={handleClear}
          disabled={busy}
          className={cn(
            "flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors",
            busy ? "opacity-60 pointer-events-none text-muted-foreground" : "hover:bg-red-50 border-red-200 text-red-500 hover:text-red-600 dark:hover:bg-red-950/30"
          )}
        >
          <Trash2 className={cn("h-3.5 w-3.5", clearLoading && "animate-spin")} />
          {clearLoading ? "Siliniyor…" : "Tümünü Sil"}
        </button>
      </div>
      {msg && (
        <div className={cn("flex items-center gap-1.5 text-xs", msg.ok ? "text-green-600" : "text-red-500")}>
          {msg.ok ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
