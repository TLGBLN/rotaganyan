"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { resetClaudeBudget } from "@/server/actions/claude-budget.actions";
import type { BudgetStatus } from "@/lib/claude-cost";

export default function ClaudeBudgetWidget({ status }: { status: BudgetStatus | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(status == null);
  const [amount, setAmount] = useState("20");
  const [saving, setSaving] = useState(false);

  async function submit() {
    const n = parseFloat(amount.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) {
      toast.error("Geçerli bir tutar gir");
      return;
    }
    setSaving(true);
    try {
      await resetClaudeBudget(n, "Admin panelden güncellendi");
      toast.success("Bakiye güncellendi");
      setOpen(false);
      router.refresh();
    } catch {
      toast.error("Güncellenemedi, tekrar dene");
    } finally {
      setSaving(false);
    }
  }

  const pct = status ? Math.max(0, Math.min(100, (status.remainingUsd / status.startingUsd) * 100)) : 0;
  const low = status != null && pct < 20;

  return (
    <div className="flex flex-col rounded-lg border p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Claude API Bakiyesi (tahmini)
        </h3>
        <button onClick={() => setOpen((v) => !v)} className="text-[11px] text-brand hover:underline">
          {status ? "Yeni kredi yükledim" : "Bakiye gir"}
        </button>
      </div>

      {status ? (
        <div className="space-y-2">
          <div className="flex items-baseline justify-between">
            <span className={cn("text-2xl font-bold tabular-nums", low ? "text-miss" : "text-foreground")}>
              ${status.remainingUsd.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">/ ${status.startingUsd.toFixed(2)}</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn("h-full rounded-full", low ? "bg-miss" : "bg-brand")}
              style={{ width: `${pct}%` }}
            />
          </div>
          <p className="text-[11px] text-muted-foreground">
            {format(new Date(status.resetAt), "d MMMM yyyy", { locale: tr })} tarihinden bu yana{" "}
            {status.callCount} çağrı · ${status.spentUsd.toFixed(2)} harcandı
          </p>
          <p className="text-[10px] text-muted-foreground/70">
            Anthropic gerçek bakiyeyi API ile vermiyor — bu, token kullanımından hesaplanan tahmindir.
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Henüz bakiye girilmedi.</p>
      )}

      {open && (
        <div className="mt-3 flex items-center gap-2 border-t pt-3">
          <input
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="20"
            className="w-24 rounded-md border bg-transparent px-2 py-1.5 text-sm"
          />
          <span className="text-xs text-muted-foreground">$ yeni başlangıç bakiyesi</span>
          <button
            onClick={submit}
            disabled={saving}
            className="ml-auto rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
          >
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </button>
        </div>
      )}
    </div>
  );
}
