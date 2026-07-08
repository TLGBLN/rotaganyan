"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";

export default function RefreshButton({ className }: { className?: string }) {
  const router = useRouter();
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    setSpinning(true);
    router.refresh();
    setTimeout(() => setSpinning(false), 1000);
  }

  return (
    <button
      onClick={handleClick}
      className={className}
    >
      <RefreshCw className={`h-3.5 w-3.5 ${spinning ? "animate-spin" : ""}`} />
      Yenile
    </button>
  );
}
