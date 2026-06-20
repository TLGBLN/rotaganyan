"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";

export default function DeleteRaceDayButton({
  raceDayId,
  label,
}: {
  raceDayId: string;
  label: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  async function remove() {
    if (!confirm(`"${label}" gününe ait TÜM koşular, analizler ve sonuçlar kalıcı olarak silinecek. Onaylıyor musunuz?`)) {
      return;
    }
    setPending(true);
    await fetch("/api/admin/race-day", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ raceDayId }),
    });
    router.refresh();
  }

  return (
    <button
      onClick={remove}
      disabled={pending}
      className="text-muted-foreground hover:text-miss disabled:opacity-50"
      title="Bu günü tüm koşularıyla sil"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
