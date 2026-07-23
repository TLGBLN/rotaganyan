"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { publishPrediction, getPublishChecklistAuto, type ChecklistCheck } from "@/server/actions/prediction.actions";
import { useTransition } from "react";
import { CheckCircle2, XCircle, Info, Lock, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const STATUS_ICON = {
  PASS: <CheckCircle2 className="h-4 w-4 shrink-0 text-hit" />,
  FAIL: <XCircle className="h-4 w-4 shrink-0 text-miss" />,
  INFO: <Info className="h-4 w-4 shrink-0 text-muted-foreground" />,
};

export default function PublishChecklist({
  predictionId, pickCount, saveVersion = 0,
}: { predictionId: string; pickCount: number; saveVersion?: number }) {
  const [checks, setChecks] = useState<ChecklistCheck[] | "loading">("loading");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  // saveVersion: mevcut bir tahmin (aynı predictionId) tekrar tekrar kaydedildiğinde
  // (Kaydet'e her basışta id DEĞİŞMEZ, upsert aynı satırı günceller) — bu sayaç
  // olmadan kontroller bir daha ASLA yeniden çekilmezdi, ilk yüklemedeki (belki
  // kaydetmeden önceki) bayat durumda kalırdı.
  useEffect(() => {
    setChecks("loading");
    getPublishChecklistAuto(predictionId).then(setChecks);
  }, [predictionId, saveVersion]);

  const hasPicks = pickCount > 0;
  const hasFail = checks !== "loading" && checks.some((c) => c.status === "FAIL");
  const canPublish = hasPicks && checks !== "loading" && !hasFail;

  function handlePublish() {
    startTransition(async () => {
      try {
        await publishPrediction(predictionId);
        toast.success("Analiz yayımlandı!");
        router.push("/admin/analizler");
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Yayınlama başarısız.");
      }
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-semibold">Yayın Öncesi Kontrol</h3>
      <p className="text-[11px] text-muted-foreground">
        Kayıtlı veriden otomatik hesaplanır — elle işaretlemeniz gerekmez, tek işiniz aşağıdaki kontroller geçtiğinde Yayımla&apos;ya basmak.
      </p>

      {!hasPicks && (
        <div className="rounded-md border border-miss/30 bg-miss/10 px-3 py-2 text-xs font-medium text-miss">
          Bu analizde hiç at seçimi (pick) yok — önce soldaki formu doldurup <strong>Kaydet</strong>&apos;e basmadan yayınlanamaz.
        </div>
      )}

      {checks === "loading" ? (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> Kontroller hesaplanıyor…
        </div>
      ) : (
        <div className="space-y-2">
          {checks.map((c) => (
            <div key={c.label} className="flex items-start gap-2">
              {STATUS_ICON[c.status]}
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", c.status === "FAIL" && "text-miss")}>{c.label}</p>
                <p className="text-[11px] text-muted-foreground">{c.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      <Button
        onClick={handlePublish}
        disabled={!canPublish || pending}
        className="w-full"
        size="sm"
      >
        {!hasPicks ? (
          <>
            <Lock className="mr-2 h-3.5 w-3.5" />
            At seçimi yok
          </>
        ) : hasFail ? (
          <>
            <Lock className="mr-2 h-3.5 w-3.5" />
            Kontrolleri geç
          </>
        ) : (
          <>
            <CheckCircle2 className="mr-2 h-3.5 w-3.5" />
            {pending ? "Yayımlanıyor…" : "Yayımla"}
          </>
        )}
      </Button>
    </div>
  );
}
