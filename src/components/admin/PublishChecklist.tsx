"use client";

import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { publishPrediction } from "@/server/actions/prediction.actions";
import { useTransition } from "react";
import { CheckCircle2, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CHECKLIST_6 } from "@/lib/methodology/topics";

const CHECKLIST = CHECKLIST_6;

export default function PublishChecklist({ predictionId }: { predictionId: string }) {
  const [checked, setChecked] = useState<boolean[]>(CHECKLIST.map(() => false));
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const allChecked = checked.every(Boolean);

  function toggle(i: number) {
    setChecked((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  function handlePublish() {
    startTransition(async () => {
      await publishPrediction(predictionId);
      toast.success("Analiz yayımlandı!");
      router.push("/admin/analizler");
    });
  }

  return (
    <div className="rounded-lg border p-4 space-y-3">
      <h3 className="text-sm font-semibold">Yayın Öncesi Kontrol</h3>
      <div className="space-y-2">
        {CHECKLIST.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Checkbox
              id={`check-${i}`}
              checked={checked[i]}
              onCheckedChange={() => toggle(i)}
            />
            <Label
              htmlFor={`check-${i}`}
              className="text-sm cursor-pointer"
            >
              {item}
            </Label>
          </div>
        ))}
      </div>

      <Button
        onClick={handlePublish}
        disabled={!allChecked || pending}
        className="w-full"
        size="sm"
      >
        {!allChecked ? (
          <>
            <Lock className="mr-2 h-3.5 w-3.5" />
            {checked.filter(Boolean).length} / {CHECKLIST.length} tamamlandı
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
