"use client";

import { useState, useTransition } from "react";
import { Trash2 } from "lucide-react";
import { clearJockeyStats } from "@/server/actions/race.actions";

export default function JokeyClearButton() {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  function handleClick() {
    if (!confirm("Tüm jokey istatistikleri silinecek. Emin misin?")) return;
    start(async () => {
      await clearJockeyStats();
      setDone(true);
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs font-medium text-red-500 hover:bg-red-500/10 transition-colors disabled:opacity-50 w-full justify-center"
    >
      <Trash2 className="h-3.5 w-3.5" />
      {pending ? "Siliniyor…" : done ? "Silindi ✓" : "Tüm Veriyi Sıfırla"}
    </button>
  );
}
