"use client";

import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle, AlertCircle, ChevronDown, ChevronUp } from "lucide-react";
import { syncTodayResults } from "@/server/actions/race.actions";
import { cn } from "@/lib/utils";

export default function SyncTodayButton() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");
  const [debug, setDebug] = useState<string[]>([]);
  const [showDebug, setShowDebug] = useState(false);

  function handleSync() {
    setStatus("idle");
    setDebug([]);
    startTransition(async () => {
      const result = await syncTodayResults();
      setDebug(result.debug ?? []);
      if (result.synced > 0) {
        setStatus("ok");
        setMsg(`${result.synced} yarış kaydedildi`);
      } else if (result.failed > 0) {
        setStatus("err");
        setMsg(result.errors[0] ?? "Hata");
      } else {
        setStatus("err");
        setMsg("Yarış kaydedilemedi — detayı aç");
      }
      setShowDebug(true);
    });
  }

  return (
    <div className="mt-2 pt-2 border-t space-y-1.5">
      <div className="flex items-center gap-2">
        <button
          onClick={handleSync}
          disabled={pending}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-[11px] font-semibold transition-colors",
            "bg-brand/10 text-brand hover:bg-brand/20 disabled:opacity-50"
          )}
        >
          <RefreshCw className={cn("h-3 w-3", pending && "animate-spin")} />
          {pending ? "Çekiliyor…" : "Bugünü Senkronize Et"}
        </button>
        {status === "ok" && (
          <span className="flex items-center gap-1 text-[11px] text-hit">
            <CheckCircle className="h-3 w-3" /> {msg}
          </span>
        )}
        {status === "err" && (
          <span className="flex items-center gap-1 text-[11px] text-miss">
            <AlertCircle className="h-3 w-3" /> {msg}
          </span>
        )}
        {debug.length > 0 && (
          <button
            onClick={() => setShowDebug(v => !v)}
            className="ml-auto flex items-center gap-0.5 text-[10px] text-muted-foreground hover:text-foreground"
          >
            {showDebug ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            Detay
          </button>
        )}
      </div>
      {showDebug && debug.length > 0 && (
        <div className="rounded bg-muted/40 px-2 py-1.5 space-y-0.5">
          {debug.map((line, i) => (
            <div key={i} className="text-[10px] font-mono text-muted-foreground leading-relaxed">{line}</div>
          ))}
        </div>
      )}
    </div>
  );
}
