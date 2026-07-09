"use client";

import { useState } from "react";
import { PlusCircle, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = {
  hippoSlug: string;
  surface: string;
  breed: string;
  year: number;
  onSaved?: () => void;
};

const EMPTY = { jockey: "", rides: "", wins: "", place2: "0", place3: "0", place4: "0", place5: "0", performanceScore: "", prizeTl: "" };

export default function JokeyEntryForm({ hippoSlug, surface, breed, year }: Props) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [loading, setLoading] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function set(k: keyof typeof EMPTY, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  const rides = parseInt(form.rides) || 0;
  const wins = parseInt(form.wins) || 0;
  const p2 = parseInt(form.place2) || 0;
  const p3 = parseInt(form.place3) || 0;
  const p4 = parseInt(form.place4) || 0;
  const p5 = parseInt(form.place5) || 0;
  const tableCount = wins + p2 + p3 + p4 + p5;
  const winPct = rides > 0 ? Math.round(wins / rides * 100) : 0;
  const tabPct = rides > 0 ? Math.round(tableCount / rides * 100) : 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.jockey.trim() || rides === 0) return;
    setLoading(true); setOk(false); setError(null);
    try {
      const res = await fetch("/api/admin/jokey-stat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jockey: form.jockey.trim().toUpperCase(),
          hippoSlug, surface, breed, year,
          rides, wins, place2: p2, place3: p3, place4: p4, place5: p5,
          performanceScore: form.performanceScore ? parseFloat(form.performanceScore) : null,
          prizeTl: form.prizeTl ? parseInt(form.prizeTl) : 0,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Hata");
      setOk(true);
      setForm(EMPTY);
      setTimeout(() => { setOk(false); setOpen(false); }, 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  const surfaceLabel = surface === "CIM" ? "Çim" : surface === "KUM" ? "Kum" : "Sentetik";
  const breedLabel = breed === "INGILIZ" ? "İngiliz" : "Arap";

  return (
    <div className="rounded-lg border overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors text-left"
      >
        <PlusCircle className="h-3.5 w-3.5 shrink-0" />
        Manuel jokey ekle / güncelle
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {hippoSlug} · {surfaceLabel} · {breedLabel}
        </span>
      </button>

      {open && (
        <form onSubmit={handleSubmit} className="border-t p-3 space-y-3 bg-muted/20">
          {/* Jokey adı */}
          <div className="space-y-1">
            <label className="text-[11px] font-medium text-muted-foreground">Jokey adı</label>
            <input
              value={form.jockey}
              onChange={(e) => set("jockey", e.target.value)}
              placeholder="ENES BOZDAĞ"
              className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand"
              required
            />
          </div>

          {/* Biniş + Galibiyet */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Biniş (Start)</label>
              <input type="number" min="0" value={form.rides} onChange={(e) => set("rides", e.target.value)}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand" required />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">1. (Galibiyet)</label>
              <input type="number" min="0" value={form.wins} onChange={(e) => set("wins", e.target.value)}
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand" required />
            </div>
          </div>

          {/* Dereceler */}
          <div className="grid grid-cols-4 gap-2">
            {(["place2", "place3", "place4", "place5"] as const).map((k, i) => (
              <div key={k} className="space-y-1">
                <label className="text-[11px] font-medium text-muted-foreground">{i + 2}.</label>
                <input type="number" min="0" value={form[k]} onChange={(e) => set(k, e.target.value)}
                  className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand" />
              </div>
            ))}
          </div>

          {/* İkramiye + Puan */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">İkramiye (TL)</label>
              <input type="number" min="0" value={form.prizeTl} onChange={(e) => set("prizeTl", e.target.value)}
                placeholder="876000"
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-medium text-muted-foreground">Performans puanı</label>
              <input type="number" step="0.1" value={form.performanceScore} onChange={(e) => set("performanceScore", e.target.value)}
                placeholder="opsiyonel"
                className="w-full rounded-md border bg-background px-2.5 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-brand" />
            </div>
          </div>

          {/* Önizleme */}
          {rides > 0 && (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground">
              Hesaplanan: <span className="font-semibold text-foreground">K%{winPct}</span> · <span className="font-semibold text-foreground">Tb%{tabPct}</span> · {tableCount} ilk5
            </div>
          )}

          {/* Butonlar */}
          <div className="flex items-center gap-2">
            <button
              type="submit"
              disabled={loading || !form.jockey.trim() || rides === 0}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-colors",
                loading || !form.jockey.trim() || rides === 0
                  ? "bg-muted text-muted-foreground pointer-events-none"
                  : "bg-brand text-brand-foreground hover:bg-brand/90"
              )}
            >
              {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Kaydet
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">
              İptal
            </button>
          </div>

          {ok && (
            <div className="flex items-center gap-1.5 text-xs text-green-600">
              <CheckCircle className="h-3.5 w-3.5" /> Kaydedildi
            </div>
          )}
          {error && (
            <div className="flex items-center gap-1.5 text-xs text-red-500">
              <AlertCircle className="h-3.5 w-3.5" /> {error}
            </div>
          )}
        </form>
      )}
    </div>
  );
}
