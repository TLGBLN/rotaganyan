"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { upsertPrediction } from "@/server/actions/prediction.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { Confidence, PedigreeRating, Prisma } from "@prisma/client";
import type { AIAnalysisResult } from "./AIAnalysisPanel";
import { Loader2 } from "lucide-react";
import PublishChecklist from "./PublishChecklist";

type Runner = Prisma.RunnerGetPayload<{ include: { gallops: true } }>;

type PickFormData = {
  rank: number;
  runnerId: string;
  runnerLabel: string;
  score: number;
  isTarget: boolean;
  pedigreeRating: PedigreeRating;
  details: string;
};

type FormData = {
  confidence: Confidence;
  notes: string;
  tempo: string;
  couponNarrow: string;
  couponNormal: string;
  couponWide: string;
  isBanko: boolean;
  bankoNote: string;
  picks: PickFormData[];
};

type Props = {
  raceId: string;
  runners: Runner[];
  aiResult?: AIAnalysisResult | null;
  aiRunners?: { id: string; no: number; name: string }[];
  existingPrediction?: {
    id: string;
    confidence: Confidence;
    notes: string;
    tempo?: string | null;
    couponNarrow?: string | null;
    couponNormal?: string | null;
    couponWide?: string | null;
    isBanko: boolean;
    bankoNote?: string | null;
    picks: Array<{
      rank: number;
      runnerId?: string | null;
      runnerLabel: string;
      score?: number | null;
      isTarget: boolean;
      pedigreeRating: PedigreeRating;
      details: unknown;
    }>;
  };
};

const PEDIGREE_OPTIONS: PedigreeRating[] = [
  "COK_YUKSEK", "YUKSEK", "GUCLU", "ORTA", "DUSUK", "ZAYIF", "SORU", "BILINMIYOR",
];

const PEDIGREE_LABEL: Record<PedigreeRating, string> = {
  COK_YUKSEK: "Çok Yüksek",
  YUKSEK: "Yüksek",
  GUCLU: "Güçlü",
  ORTA: "Orta",
  DUSUK: "Düşük",
  ZAYIF: "Zayıf",
  SORU: "Soru İşareti",
  BILINMIYOR: "Bilinmiyor",
};

export default function PredictionForm({ raceId, runners, existingPrediction, aiResult, aiRunners }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [savedId, setSavedId] = useState(existingPrediction?.id ?? null);
  const prevAiResult = useRef<AIAnalysisResult | null | undefined>(null);

  const defaultPicks: PickFormData[] = existingPrediction?.picks.map((p) => ({
    rank: p.rank,
    runnerId: p.runnerId ?? "",
    runnerLabel: p.runnerLabel,
    score: p.score ?? 0,
    isTarget: p.isTarget,
    pedigreeRating: p.pedigreeRating,
    details: Array.isArray(p.details) ? (p.details as string[]).join(", ") : "",
  })) ?? [
    { rank: 1, runnerId: "", runnerLabel: "", score: 0, isTarget: false, pedigreeRating: "BILINMIYOR", details: "" },
    { rank: 2, runnerId: "", runnerLabel: "", score: 0, isTarget: false, pedigreeRating: "BILINMIYOR", details: "" },
    { rank: 3, runnerId: "", runnerLabel: "", score: 0, isTarget: false, pedigreeRating: "BILINMIYOR", details: "" },
  ];

  const { register, control, handleSubmit, setValue, watch, formState: { isDirty } } = useForm<FormData>({
    defaultValues: {
      confidence: existingPrediction?.confidence ?? "ORTA",
      notes: existingPrediction?.notes ?? "",
      tempo: existingPrediction?.tempo ?? "",
      couponNarrow: existingPrediction?.couponNarrow ?? "",
      couponNormal: existingPrediction?.couponNormal ?? "",
      couponWide: existingPrediction?.couponWide ?? "",
      isBanko: existingPrediction?.isBanko ?? false,
      bankoNote: existingPrediction?.bankoNote ?? "",
      picks: defaultPicks,
    },
  });

  const { fields } = useFieldArray({ control, name: "picks" });
  const isBanko = watch("isBanko");

  // AI sonucu gelince formu doldur
  useEffect(() => {
    if (!aiResult || aiResult === prevAiResult.current) return;
    prevAiResult.current = aiResult;
    const runnersMap = new Map((aiRunners ?? []).map((r) => [r.no, r]));
    const aiPicks: PickFormData[] = aiResult.picks.slice(0, 3).map((p) => {
      const runner = runnersMap.get(p.no) ?? runners.find((r) => r.no === p.no);
      return {
        rank: p.rank,
        runnerId: runner?.id ?? "",
        runnerLabel: runner ? `#${runner.no} ${runner.name}` : `#${p.no} ${p.name}`,
        score: p.score,
        isTarget: p.isTarget,
        pedigreeRating: p.pedigreeRating,
        details: p.details.join(", "),
      };
    });
    setValue("picks", aiPicks);
    setValue("confidence", aiResult.confidence);
    setValue("notes", aiResult.notes);
    setValue("tempo", aiResult.tempo);
    setValue("isBanko", aiResult.isBanko);
    setValue("bankoNote", aiResult.bankoNote);
    setValue("couponNarrow", aiResult.couponNarrow);
    setValue("couponNormal", aiResult.couponNormal);
    setValue("couponWide", aiResult.couponWide);
  }, [aiResult, aiRunners, runners, setValue]);

  async function onSubmit(data: FormData) {
    setSubmitting(true);
    try {
      const result = await upsertPrediction({
        raceId,
        confidence: data.confidence,
        notes: data.notes,
        tempo: data.tempo || undefined,
        couponNarrow: data.couponNarrow || undefined,
        couponNormal: data.couponNormal || undefined,
        couponWide: data.couponWide || undefined,
        isBanko: data.isBanko,
        bankoNote: data.bankoNote || undefined,
        picks: data.picks
          .filter((p) => p.runnerLabel.trim())
          .map((p) => ({
            rank: p.rank,
            runnerId: p.runnerId || undefined,
            runnerLabel: p.runnerLabel,
            score: p.score || undefined,
            details: p.details ? p.details.split(",").map((s) => s.trim()).filter(Boolean) : [],
            pedigreeRating: p.pedigreeRating,
            isTarget: p.isTarget,
          })),
      });
      setSavedId(result.id);
      toast.success("Analiz kaydedildi");
    } catch {
      toast.error("Kayıt hatası");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Picks */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Seçimler</h3>
          <div className="space-y-3">
            {fields.map((field, i) => (
              <div key={field.id} className="rounded-lg border p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="secondary" className="h-6 w-6 items-center justify-center p-0 text-xs font-bold">
                    {i + 1}
                  </Badge>
                  <span className="text-xs text-muted-foreground font-medium">
                    {i === 0 ? "Birinci Seçim" : i === 1 ? "İkinci Seçim" : "Üçüncü Seçim"}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                  <div className="col-span-2 sm:col-span-1">
                    <Label className="text-xs mb-1 block">At Seç</Label>
                    <select
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                      {...register(`picks.${i}.runnerId`)}
                      onChange={(e) => {
                        const runner = runners.find((r) => r.id === e.target.value);
                        if (runner) setValue(`picks.${i}.runnerLabel`, `#${runner.no} ${runner.name}`);
                        setValue(`picks.${i}.runnerId`, e.target.value);
                      }}
                    >
                      <option value="">— Seçin —</option>
                      {runners.map((r) => (
                        <option key={r.id} value={r.id}>
                          #{r.no} {r.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Pedigri</Label>
                    <select
                      className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
                      {...register(`picks.${i}.pedigreeRating`)}
                    >
                      {PEDIGREE_OPTIONS.map((o) => (
                        <option key={o} value={o}>{PEDIGREE_LABEL[o]}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <Label className="text-xs mb-1 block">Skor</Label>
                    <Input
                      type="number"
                      className="h-8 text-sm"
                      {...register(`picks.${i}.score`, { valueAsNumber: true })}
                    />
                  </div>
                </div>

                <div>
                  <Label className="text-xs mb-1 block">Detay Bayrakları (virgülle ayır)</Label>
                  <Input
                    className="h-8 text-sm"
                    placeholder="örn: AGF1, Kilo düştü, Galop K1"
                    {...register(`picks.${i}.details`)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    id={`target-${i}`}
                    checked={watch(`picks.${i}.isTarget`)}
                    onCheckedChange={(v) => setValue(`picks.${i}.isTarget`, v)}
                  />
                  <Label htmlFor={`target-${i}`} className="text-xs">
                    Target (Hedef At)
                  </Label>
                </div>
              </div>
            ))}
          </div>
        </section>

        <Separator />

        {/* Confidence + Banko */}
        <section className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Güven Seviyesi</Label>
            <select
              className="w-full rounded-md border bg-background px-2 py-2 text-sm"
              {...register("confidence")}
            >
              <option value="DUSUK">Düşük Güven</option>
              <option value="ORTA">Orta Güven</option>
              <option value="YUKSEK">Yüksek Güven</option>
            </select>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Switch
                id="isBanko"
                checked={isBanko}
                onCheckedChange={(v) => setValue("isBanko", v)}
              />
              <Label htmlFor="isBanko">★ Banko Koşu</Label>
            </div>
            {isBanko && (
              <Input
                className="h-8 text-sm"
                placeholder="Banko notu (opsiyonel)"
                {...register("bankoNote")}
              />
            )}
          </div>
        </section>

        <Separator />

        {/* Notes + Tempo */}
        <section className="space-y-3">
          <div className="space-y-1.5">
            <Label>Analiz Notu</Label>
            <Textarea
              rows={4}
              placeholder="Koşunun genel değerlendirmesi, öne çıkan faktörler…"
              {...register("notes")}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Tempo Değerlendirmesi</Label>
            <Input
              placeholder="Hızlı / Orta / Yavaş tempo bekleniyor…"
              {...register("tempo")}
            />
          </div>
        </section>

        <Separator />

        {/* Coupon */}
        <section>
          <h3 className="mb-3 text-sm font-semibold">Kupon Önerisi</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">Dar</Label>
              <Input className="h-8 text-sm font-mono" placeholder="1-3" {...register("couponNarrow")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Normal</Label>
              <Input className="h-8 text-sm font-mono" placeholder="1-3-7" {...register("couponNormal")} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Geniş</Label>
              <Input className="h-8 text-sm font-mono" placeholder="1-3-7-9" {...register("couponWide")} />
            </div>
          </div>
        </section>

        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={submitting}>
            {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
            {existingPrediction ? "Güncelle" : "Kaydet"}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push("/admin/analizler")}
          >
            İptal
          </Button>
        </div>
      </form>

      {savedId && (
        <div className="mt-4">
          <PublishChecklistSection predictionId={savedId} />
        </div>
      )}
    </div>
  );
}

function PublishChecklistSection({ predictionId }: { predictionId: string }) {
  const [show, setShow] = useState(false);

  if (!show) {
    return (
      <button
        onClick={() => setShow(true)}
        className="text-sm text-brand hover:underline"
      >
        Yayımla →
      </button>
    );
  }

  return <PublishChecklist predictionId={predictionId} />;
}
