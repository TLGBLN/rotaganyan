"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";

export default function RefreshButton({ className }: { className?: string }) {
  const [spinning, setSpinning] = useState(false);

  function handleClick() {
    setSpinning(true);
    window.location.reload();
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
