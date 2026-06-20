"use client";

import { useState, useTransition } from "react";
import { enterResult } from "@/server/actions/result.actions";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2, Download } from "lucide-react";

export default function ResultForm({ raceId }: { raceId: string }) {
  const [winnerNo, setWinnerNo] = useState("");
  const [actualOrder, setActualOrder] = useState("");
  const [cikan, setCikan] = useState("");
  const [hitTop1, setHitTop1] = useState(false);
  const [hitInCoupon, setHitInCoupon] = useState(false);
  const [errorTag, setErrorTag] = useState("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();
  const [fetching, setFetching] = useState(false);
  const [fetchedRows, setFetchedRows] = useState<{ rank: number; no: number; name: string }[] | null>(null);

  async function handleFetchFromTjk() {
    setFetching(true);
    try {
      const res = await fetch("/api/admin/fetch-result", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "Sonuç çekilemedi");
        return;
      }
      setWinnerNo(String(data.winnerNo));
      setActualOrder(data.actualOrder.join(", "));
      setHitTop1(data.hitTop1);
      setFetchedRows(data.rows);
      toast.success("TJK'dan sonuç çekildi, kontrol edip kaydedin");
    } catch {
      toast.error("TJK'dan sonuç çekilirken hata oluştu");
    } finally {
      setFetching(false);
    }
  }

  function handleSubmit() {
    if (!winnerNo) return toast.error("Kazanan at numarası gerekli");

    startTransition(async () => {
      await enterResult({
        raceId,
        winnerNo: parseInt(winnerNo, 10),
        actualOrder: actualOrder
          .split(/[,\s-]+/)
          .filter(Boolean)
          .map((n) => parseInt(n, 10)),
        cikan: cikan || undefined,
        hitTop1,
        hitInCoupon,
        errorTag: errorTag || undefined,
      });
      setSaved(true);
      toast.success("Sonuç kaydedildi");
    });
  }

  if (saved) {
    return <p className="text-sm text-hit font-medium">✓ Sonuç kaydedildi</p>;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Button size="sm" variant="outline" onClick={handleFetchFromTjk} disabled={fetching}>
          {fetching ? (
            <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" />
          ) : (
            <Download className="mr-2 h-3.5 w-3.5" />
          )}
          TJK&apos;dan Çek
        </Button>
        {fetchedRows && (
          <p className="text-xs text-muted-foreground">
            {fetchedRows
              .slice(0, 3)
              .map((r) => `${r.rank}. ${r.no} ${r.name}`)
              .join(" · ")}
          </p>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <div className="space-y-1">
        <Label className="text-xs">Kazanan At No</Label>
        <Input
          className="h-8 text-sm"
          type="number"
          placeholder="1"
          value={winnerNo}
          onChange={(e) => setWinnerNo(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Gelen Sıra (virgülle)</Label>
        <Input
          className="h-8 text-sm font-mono"
          placeholder="3, 7, 1, 5"
          value={actualOrder}
          onChange={(e) => setActualOrder(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Çıkan (varsa)</Label>
        <Input
          className="h-8 text-sm"
          placeholder="At adı veya no"
          value={cikan}
          onChange={(e) => setCikan(e.target.value)}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-xs">Hata Etiketi</Label>
        <Input
          className="h-8 text-sm"
          placeholder="GALOP_YANLIŞ vs."
          value={errorTag}
          onChange={(e) => setErrorTag(e.target.value)}
        />
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={hitTop1} onCheckedChange={setHitTop1} id={`hit1-${raceId}`} />
        <Label htmlFor={`hit1-${raceId}`} className="text-sm">1. At Tuttu</Label>
      </div>

      <div className="flex items-center gap-2">
        <Switch checked={hitInCoupon} onCheckedChange={setHitInCoupon} id={`hitc-${raceId}`} />
        <Label htmlFor={`hitc-${raceId}`} className="text-sm">Kuponda Tuttu</Label>
      </div>

      <div className="col-span-2 flex justify-end">
        <Button size="sm" onClick={handleSubmit} disabled={pending}>
          {pending ? <Loader2 className="mr-2 h-3.5 w-3.5 animate-spin" /> : null}
          Kaydet
        </Button>
      </div>
      </div>
    </div>
  );
}
