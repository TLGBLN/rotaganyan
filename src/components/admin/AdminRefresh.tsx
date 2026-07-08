"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

const INTERVAL_MS = 3 * 60 * 1000;

export default function AdminRefresh() {
  const router = useRouter();
  const [lastUpdate, setLastUpdate] = useState(() => {
    const d = new Date();
    return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  });
  const [spinning, setSpinning] = useState(false);

  useEffect(() => {
    const id = setInterval(() => {
      setSpinning(true);
      setTimeout(() => setSpinning(false), 1000);
      router.refresh();
      const d = new Date();
      setLastUpdate(`${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`);
    }, INTERVAL_MS);
    return () => clearInterval(id);
  }, [router]);

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground select-none">
      <RefreshCw
        className={`h-3 w-3 transition-transform ${spinning ? "animate-spin" : ""}`}
      />
      <span className="tabular-nums">{lastUpdate}</span>
    </span>
  );
}
