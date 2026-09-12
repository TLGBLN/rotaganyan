import type { CSSProperties } from "react";
import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  style?: CSSProperties;
  showIcon?: boolean;
  iconClassName?: string;
  /** 2026-09-12 kullanıcı bulgusu: SplashScreen arka planı temadan BAĞIMSIZ hep koyu
   *  (`bg-[#0B1423]`) — "ROTA" kısmı varsayılan `text-foreground` ile açık temada koyu
   *  (neredeyse siyah) renge dönüp aynı koyu zeminde görünmez oluyordu. Bu prop yalnız
   *  o gibi sabit-koyu arka planlı yerlerde "ROTA"nın rengini geçersiz kılmak için —
   *  verilmezse davranış DEĞİŞMEZ (hâlâ text-foreground, temaya uyumlu). */
  firstPartClassName?: string;
};

export default function Wordmark({ className, style, showIcon = true, iconClassName, firstPartClassName }: Props) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-sm font-black leading-none tracking-tight",
        className
      )}
      style={style}
    >
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
      <span className="inline-flex items-center">
        <span className={cn("text-foreground", firstPartClassName)}>ROTA</span>
        <span className="text-brand">GANYAN</span>
      </span>
    </span>
  );
}
