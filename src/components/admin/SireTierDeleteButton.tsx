"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function SireTierDeleteButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    setPending(true);
    try {
      const res = await fetch("/api/admin/sire-tier", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      router.refresh();
    } catch {
      toast.error("Silinemedi, tekrar deneyin.");
    } finally {
      setPending(false);
    }
  }

  return (
    <button onClick={remove} disabled={pending} className="text-muted-foreground hover:text-miss disabled:opacity-50" title="Sil">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
