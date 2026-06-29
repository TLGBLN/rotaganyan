import { cn } from "@/lib/utils";
import type { ClassTypeAdvice } from "@/server/services/admin.service";

const LEVEL_LABEL: Record<ClassTypeAdvice["level"], string> = {
  warn: "⚠ Dikkat",
  good: "✓ Güçlü Geçmiş",
  info: "ℹ Bilgi",
  none: "Geçmiş Veri",
};

export default function ClassTypeAdviceCard({
  advice,
  classType,
}: {
  advice: ClassTypeAdvice;
  classType: string;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-xs",
        advice.level === "warn" && "border-miss/30 bg-miss/10 text-miss",
        advice.level === "info" && "border-brand/30 bg-brand/10 text-brand",
        advice.level === "good" && "border-hit/30 bg-hit/10 text-hit",
        advice.level === "none" && "border-dashed text-muted-foreground"
      )}
    >
      <p className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide">
        <span>{LEVEL_LABEL[advice.level]}</span>
        <span className="font-normal text-muted-foreground">{classType}</span>
      </p>
      <p className="leading-snug">{advice.text}</p>
    </div>
  );
}
