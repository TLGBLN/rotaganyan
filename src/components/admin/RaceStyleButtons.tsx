"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

const OPTIONS = [
  { value: "KACAK", label: "Kaçak" },
  { value: "ON_GRUP", label: "Ön Grup" },
  { value: "BEKLEME", label: "Bekleme" },
  { value: "EN_GERI", label: "En Geri" },
] as const;

export default function RaceStyleButtons({
  runnerId,
  current,
}: {
  runnerId: string;
  current?: string | null;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function setStyle(style: string) {
    setPending(true);
    await fetch("/api/admin/runner-style", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runnerId, style }),
    });
    router.refresh();
    setPending(false);
  }

  return (
    <div className="flex flex-wrap gap-0.5">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={pending}
          onClick={() => setStyle(opt.value)}
          className={cn(
            "rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors disabled:opacity-40",
            current === opt.value
              ? "bg-brand text-black"
              : "border border-white/10 text-muted-foreground hover:bg-white/10"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
