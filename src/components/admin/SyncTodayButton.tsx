"use client";

import { useState, useTransition } from "react";
import { RefreshCw, CheckCircle, AlertCircle } from "lucide-react";
import { syncTodayResults } from "@/server/actions/race.actions";
import { cn } from "@/lib/utils";

export default function SyncTodayButton() {
  const [pending, startTransition] = useTransition();
  const [status, setStatus] = useState<"idle" | "ok" | "err">("idle");
  const [msg, setMsg] = useState("");

  function handleSync() {
    setStatus("idle");
    startTransition(async () => {
      const result = await syncTodayResults();
      if (result.failed === 0) {
        setStatus("ok");
        setMsg("Senkronize edildi");
      } else {
        setStatus("err");
        setMsg(result.errors[0] ?? "Hata");
      }
    });
  }

  return (
    <div className="flex items-center gap-2 mt-2 pt-2 border-t">
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
        <span className="flex items-center gap-1 text-[11px] text-miss truncate max-w-[180px]" title={msg}>
          <AlertCircle className="h-3 w-3" /> {msg}
        </span>
      )}
    </div>
  );
}
