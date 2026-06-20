import { Badge } from "@/components/ui/badge";
import { Target } from "lucide-react";

export default function TargetBadge({ className }: { className?: string }) {
  return (
    <Badge
      className={`bg-target text-target-foreground gap-1 border-0 ${className ?? ""}`}
    >
      <Target className="h-3 w-3" />
      Hedef
    </Badge>
  );
}
