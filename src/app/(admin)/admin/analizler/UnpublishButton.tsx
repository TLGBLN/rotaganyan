"use client";

import { unpublishPrediction } from "@/server/actions/prediction.actions";
import { useTransition } from "react";

export default function UnpublishButton({ id }: { id: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      onClick={() => startTransition(() => unpublishPrediction(id))}
      disabled={pending}
      className="text-xs text-muted-foreground hover:text-miss disabled:opacity-50"
    >
      {pending ? "…" : "Geri Al"}
    </button>
  );
}
