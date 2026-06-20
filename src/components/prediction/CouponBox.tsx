import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Confidence } from "@prisma/client";

const CONFIDENCE_LABEL: Record<Confidence, string> = {
  DUSUK: "Düşük Güven",
  ORTA: "Orta Güven",
  YUKSEK: "Yüksek Güven",
};

const CONFIDENCE_COLOR: Record<Confidence, string> = {
  DUSUK: "border-miss text-miss",
  ORTA: "border-muted-foreground text-muted-foreground",
  YUKSEK: "border-hit text-hit",
};

type Props = {
  narrow?: string | null;
  normal?: string | null;
  wide?: string | null;
  isBanko: boolean;
  bankoNote?: string | null;
  confidence: Confidence;
};

export default function CouponBox({ narrow, normal, wide, isBanko, bankoNote, confidence }: Props) {
  return (
    <Card className="border-brand/20">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold">Kupon Önerisi</CardTitle>
          <Badge variant="outline" className={cn("text-xs", CONFIDENCE_COLOR[confidence])}>
            {CONFIDENCE_LABEL[confidence]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pb-3">
        {/* Banko */}
        {isBanko ? (
          <div className="rounded-md bg-brand/10 px-3 py-2">
            <span className="text-xs font-semibold text-brand uppercase tracking-wide">★ Banko</span>
          </div>
        ) : bankoNote ? (
          <p className="text-xs text-muted-foreground">{bankoNote}</p>
        ) : null}

        {/* Kupon alternatifleri */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Dar", value: narrow },
            { label: "Normal", value: normal },
            { label: "Geniş", value: wide },
          ].map(({ label, value }) =>
            value ? (
              <div key={label} className="rounded-md border bg-muted/30 p-2 text-center">
                <p className="text-[10px] font-medium uppercase text-muted-foreground">{label}</p>
                <p className="mt-0.5 font-mono text-sm font-semibold">{value}</p>
              </div>
            ) : null
          )}
        </div>
      </CardContent>
    </Card>
  );
}
