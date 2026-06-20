"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteRaceButton({
  raceId,
  label,
}: {
  raceId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!confirm(`"${label}" kalıcı olarak silinecek (atlar, analiz, sonuç dahil). Onaylıyor musunuz?`)) {
      return;
    }
    setPending(true);
    await fetch("/api/admin/race", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceId }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={pending}
      className="text-muted-foreground hover:text-miss disabled:opacity-50"
      title="Bu koşuyu sil"
    >
      <Trash2 className="h-3.5 w-3.5" />
    </button>
  );
}
