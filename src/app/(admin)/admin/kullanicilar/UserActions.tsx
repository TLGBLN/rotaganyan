"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { Plan } from "@prisma/client";
import { Trash2, Crown, Ban } from "lucide-react";

type Props = {
  userId: string;
  currentPlan: Plan;
  isSelf: boolean;
};

export default function UserActions({ userId, currentPlan, isSelf }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function togglePlan() {
    const newPlan: Plan = currentPlan === "PREMIUM" ? "FREE" : "PREMIUM";
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ plan: newPlan }),
        });
        if (!res.ok) throw new Error();
        toast.success(newPlan === "PREMIUM" ? "Premium'a yükseltildi" : "Üyelik FREE'ye indirildi");
        router.refresh();
      } catch {
        toast.error("Plan güncellenemedi");
      }
    });
  }

  function deleteUser() {
    if (!confirm("Bu kullanıcıyı silmek istediğine emin misin? Bu işlem geri alınamaz.")) return;
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${userId}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        toast.success("Kullanıcı silindi");
        router.refresh();
      } catch {
        toast.error("Kullanıcı silinemedi");
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={togglePlan}
        disabled={pending || isSelf}
        title={currentPlan === "PREMIUM" ? "Üyeliği iptal et (FREE'ye indir)" : "Premium yap"}
        className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand disabled:cursor-not-allowed disabled:opacity-40"
      >
        {currentPlan === "PREMIUM" ? (
          <Ban className="h-3.5 w-3.5" />
        ) : (
          <Crown className="h-3.5 w-3.5" />
        )}
      </button>
      <button
        onClick={deleteUser}
        disabled={pending || isSelf}
        title="Kullanıcıyı sil"
        className="flex h-7 w-7 items-center justify-center rounded border border-border text-muted-foreground transition-colors hover:border-miss/40 hover:text-miss disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
