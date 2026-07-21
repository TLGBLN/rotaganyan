"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export default function AccuraceSyncButton({ date }: { date: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  async function handleSync() {
    setLoading(true);
    setMsg(null);
    try {
      const res = await fetch("/api/admin/sync-accurace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata");
      setMsg({
        text: `${data.kaydedilen}/${data.kosular} koşu kaydedildi (${data.atlanan} henüz veri yok)${data.errors.length ? ` — ${data.errors.length} hata` : ""}`,
        ok: true,
      });
      router.refresh();
    } catch (e) {
      setMsg({ text: e instanceof Error ? e.message : String(e), ok: false });
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
          loading ? "opacity-60 pointer-events-none text-muted-foreground" : "hover:bg-muted text-muted-foreground hover:text-foreground"
        )}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        {loading ? "Çekiliyor…" : `${date} için Accurace'ten Çek`}
      </button>
      {msg && (
        <div className={cn("flex items-center gap-1.5 text-xs", msg.ok ? "text-green-600" : "text-red-500")}>
          {msg.ok ? <CheckCircle className="h-3.5 w-3.5 shrink-0" /> : <AlertCircle className="h-3.5 w-3.5 shrink-0" />}
          {msg.text}
        </div>
      )}
    </div>
  );
}
