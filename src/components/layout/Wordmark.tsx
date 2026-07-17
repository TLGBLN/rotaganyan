import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

export default function Wordmark({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <span
      className={cn(
        "inline-flex items-center text-sm font-black leading-none tracking-tight",
        className
      )}
      style={style}
    >
      <span className="text-white">ROTA</span>
      <span className="text-brand">GANYAN</span>
    </span>
  );
}
