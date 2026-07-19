"use client";

import { useState } from "react";
import { Loader2, Sparkles, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PedigreeRating } from "@prisma/client";

export type AIPickResult = {
  rank: number;
  no: number;
  name: string;
  score: number;
  pedigreeRating: PedigreeRating;
  isTarget: boolean;
  details: string[];
  note: string;
};

export type AIAnalysisResult = {
  picks: AIPickResult[];
  confidence: "DUSUK" | "ORTA" | "YUKSEK";
  isBanko: boolean;
  bankoNote: string;
  notes: string;
  tempo: string;
  couponNarrow: string;
  couponNormal: string;
  couponWide: string;
};

type Runner = { id: string; no: number; name: string };

type Props = {
  raceId: string;
  onApply: (result: AIAnalysisResult, runners: Runner[]) => void;
};

const CONFIDENCE_LABEL = { DUSUK: "Düşük", ORTA: "Orta", YUKSEK: "Yüksek" };
const PEDIGREE_LABEL: Record<PedigreeRating, string> = {
  COK_YUKSEK: "Çok Yüksek", YUKSEK: "Yüksek", GUCLU: "Güçlü", ORTA: "Orta",
  DUSUK: "Düşük", ZAYIF: "Zayıf", SORU: "Soru", BILINMIYOR: "?",
};

export default function AIAnalysisPanel({ raceId, onApply }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [runners, setRunners] = useState<Runner[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [applied, setApplied] = useState(false);

  async function handleEvaluate() {
    setLoading(true);
    setError(null);
    setResult(null);
    setApplied(false);
    try {
      const res = await fetch("/api/admin/oto-analiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Hata");
      setResult(data.result);
      setRunners(data.runners ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Beklenmeyen hata");
    } finally {
      setLoading(false);
    }
  }

  function handleApply() {
    if (!result) return;
    onApply(result, runners);
    setApplied(true);
  }

  return (
    <div className="space-y-4 rounded-xl border border-brand/20 bg-brand/5 p-4">
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-brand" />
        <h3 className="text-sm font-semibold">Otomatik Analiz</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">Metodoloji (v4.1) + geçit motoru + sitenin kendi verisiyle tamamen otomatik çalışır</span>
      </div>

      <div className="flex gap-2">
        <Button
          onClick={handleEvaluate}
          disabled={loading}
          size="sm"
          className="gap-1.5"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
          {loading ? "Analiz oluşturuluyor…" : "Otomatik Analiz Oluştur"}
        </Button>
        {result && (
          <Button
            onClick={handleApply}
            size="sm"
            variant={applied ? "outline" : "default"}
            className={cn("gap-1.5", applied && "border-hit text-hit")}
          >
            {applied ? <><CheckCircle className="h-3.5 w-3.5" /> Uygulandı</> : "Forma Uygula →"}
          </Button>
        )}
      </div>

      {error && (
        <div className="whitespace-pre-wrap rounded-lg border border-miss/30 bg-miss/10 px-3 py-2 text-xs text-miss">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3">
          {/* Pick tablosu */}
          <div className="rounded-lg border overflow-hidden">
            <div className="bg-muted/30 px-3 py-2 text-xs font-semibold">Final Sıralama</div>
            <div className="divide-y">
              {result.picks.map((pick) => (
                <div key={pick.rank} className="flex items-start gap-3 px-3 py-2">
                  <span className={cn(
                    "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                    pick.rank === 1 ? "bg-brand text-black" : "bg-muted text-muted-foreground"
                  )}>
                    {pick.rank}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">#{pick.no} {pick.name}</span>
                      <span className="text-[10px] text-muted-foreground">puan:{pick.score}</span>
                      <span className="text-[10px] text-muted-foreground">{PEDIGREE_LABEL[pick.pedigreeRating]}</span>
                      {pick.isTarget && <span className="text-[10px] font-semibold text-brand">★ Hedef</span>}
                    </div>
                    {pick.details.length > 0 && (
                      <div className="mt-0.5 flex flex-wrap gap-1">
                        {pick.details.map((d) => (
                          <span key={d} className="rounded bg-muted px-1.5 py-0.5 text-[10px]">{d}</span>
                        ))}
                      </div>
                    )}
                    {pick.note && (
                      <p className="mt-1 text-[11px] text-muted-foreground">{pick.note}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Meta */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Güven</div>
              <div className="font-semibold">{CONFIDENCE_LABEL[result.confidence]}</div>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Banko</div>
              <div className={cn("font-semibold", result.isBanko ? "text-brand" : "text-muted-foreground")}>
                {result.isBanko ? "★ Evet" : "Hayır"}
              </div>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Tempo</div>
              <div>{result.tempo || "—"}</div>
            </div>
            <div className="rounded-lg border px-3 py-2">
              <div className="font-medium text-muted-foreground">Kupon</div>
              <div className="font-mono">{result.couponNarrow} / {result.couponNormal} / {result.couponWide}</div>
            </div>
          </div>

          {result.notes && (
            <div className="rounded-lg border px-3 py-2.5 text-xs text-muted-foreground">
              {result.notes}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
