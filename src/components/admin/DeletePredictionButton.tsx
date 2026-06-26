"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deletePrediction } from "@/server/actions/prediction.actions";

export default function DeletePredictionButton({ predictionId }: { predictionId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    if (!confirm("Bu analizi tamamen silmek istediğine emin misin? Yayından da kalkacak ve geri alınamaz.")) return;

    startTransition(async () => {
      await deletePrediction(predictionId);
      toast.success("Analiz silindi ve yayından kaldırıldı");
      router.push("/admin/analizler");
    });
  }

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      className="rounded-md border border-miss/40 px-3 py-1.5 text-xs font-medium text-miss hover:bg-miss/10 disabled:opacity-50"
    >
      {pending ? "Siliniyor…" : "Analizi Sil"}
    </button>
  );
}
