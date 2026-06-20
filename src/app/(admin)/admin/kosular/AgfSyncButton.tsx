"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { toast } from "sonner";

export default function AgfSyncButton({ date }: { date: string }) {
  const [loading, setLoading] = useState(false);

  async function handleSync() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/sync-agf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata");

      const total: number = data.totalRunnersUpdated ?? 0;
      if (total > 0) {
        toast.success(`AGF güncellendi — ${total} at`);
      } else {
        toast.info("Güncellenecek AGF verisi bulunamadı (bülten henüz yayınlanmamış olabilir)");
      }
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "AGF sync başarısız");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleSync}
      disabled={loading}
      className="gap-2"
    >
      <Zap className={`h-4 w-4 ${loading ? "animate-pulse" : ""}`} />
      {loading ? "Çekiliyor…" : "AGF & Takı Güncelle"}
    </Button>
  );
}
