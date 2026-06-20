"use client";

import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function SireTierDeleteButton({ id }: { id: string }) {
  const router = useRouter();

  async function remove() {
    await fetch("/api/admin/sire-tier", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    router.refresh();
  }

  return (
    <button onClick={remove} className="text-muted-foreground hover:text-miss" title="Sil">
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
