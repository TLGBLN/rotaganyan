"use client";

import { useRouter } from "next/navigation";
import { unpublishPrediction } from "@/server/actions/prediction.actions";
import { useTransition } from "react";

export default function UnpublishButton({ id }: { id: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(async () => {
      await unpublishPrediction(id);
      router.refresh();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-miss disabled:opacity-50"
    >
      {pending ? "…" : "Geri Al"}
    </button>
  );
}
