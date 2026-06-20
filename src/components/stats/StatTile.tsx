import { cn } from "@/lib/utils";

type Props = {
  label: string;
  value: string | number;
  sub?: string;
  highlight?: "hit" | "miss" | "brand" | "neutral";
};

const HIGHLIGHT_CLASS = {
  hit: "text-hit",
  miss: "text-miss",
  brand: "text-brand",
  neutral: "text-foreground",
};

export default function StatTile({ label, value, sub, highlight = "neutral" }: Props) {
  return (
    <div className="rounded-lg border bg-card p-4 text-center">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-3xl font-bold tabular-nums", HIGHLIGHT_CLASS[highlight])}>
        {value}
      </p>
      {sub && <p className="mt-1 text-xs text-muted-foreground">{sub}</p>}
    </div>
  );
}
