import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = { className?: string; style?: CSSProperties; showIcon?: boolean; iconClassName?: string };

export default function Wordmark({ className, style, showIcon = true, iconClassName }: Props) {
  return (
    <span className="inline-flex items-center gap-1.5" style={style}>
      {showIcon && (
        <Image
          src="/horse-icon-gold.png"
          alt=""
          width={28}
          height={28}
          className={cn("h-[1.4em] w-[1.4em] shrink-0 object-contain", iconClassName)}
          priority
        />
      )}
      <span
        className={cn(
          "inline-flex items-center text-sm font-black leading-none tracking-tight",
          className
        )}
      >
        <span className="text-white">ROTA</span>
        <span className="text-brand">GANYAN</span>
      </span>
    </span>
  );
}
