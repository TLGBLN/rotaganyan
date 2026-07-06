"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";

export default function ForceIngestButton({ date, action }: {
  date: string;
  action: (date: string) => Promise<{ runners: number }>;
}) {
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [msg, setMsg] = useState("");

  async function run() {
    setState("loading");
    setMsg("");
    try {
      const res = await action(date);
      setMsg(`${res.runners} at güncellendi`);
      setState("done");
    } catch (e) {
      setMsg(String(e));
      setState("error");
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Button
        size="sm"
        variant="outline"
        onClick={run}
        disabled={state === "loading"}
        className="gap-1.5"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${state === "loading" ? "animate-spin" : ""}`} />
        {state === "loading" ? "Yenileniyor…" : "Programı Yenile"}
      </Button>
      {msg && (
        <span className={`text-xs ${state === "error" ? "text-red-500" : "text-[#27ae60]"}`}>
          {msg}
        </span>
      )}
    </div>
  );
}
