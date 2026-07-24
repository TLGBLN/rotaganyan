"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Search, X } from "lucide-react";

export default function AccuraceHorseSearch({ initialQuery }: { initialQuery: string }) {
  const router = useRouter();
  const [value, setValue] = useState(initialQuery);

  function submit() {
    const trimmed = value.trim();
    router.push(trimmed ? `/admin/accurace?at=${encodeURIComponent(trimmed)}` : "/admin/accurace");
  }

  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-muted-foreground" />
      <input
        type="text"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter") submit(); }}
        placeholder="At adı ara…"
        className="w-40 rounded-md border bg-background py-1.5 pl-7 pr-6 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
      />
      {value && (
        <button
          type="button"
          onClick={() => { setValue(""); router.push("/admin/accurace"); }}
          className="absolute right-1.5 text-muted-foreground hover:text-foreground"
          aria-label="Aramayı temizle"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      )}
      <button
        type="button"
        onClick={submit}
        className="ml-1.5 rounded-md border px-2.5 py-1.5 text-xs font-semibold hover:bg-muted"
      >
        Ara
      </button>
    </div>
  );
}
