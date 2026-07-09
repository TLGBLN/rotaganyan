"use client";

import { useState, useRef } from "react";
import { Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ImportResult = {
  ok: boolean;
  upserted: number;
  hippoSlug: string;
  breed: string | null;
  surface: string | null;
  year: number;
  title: string;
  error?: string;
};

export default function JokeyStatImport({ onImported }: { onImported?: () => void }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setLoading(true);
    setResult(null);
    setError(null);
    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const res = await fetch("/api/admin/import-jokey-stats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(json),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sunucu hatası");
      setResult(data);
      onImported?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold">JSON İçe Aktar</h3>
        <p className="text-xs text-muted-foreground">Hipodromx jokey istatistik dosyasını yükle</p>
      </div>

      <div
        onDrop={onDrop}
        onDragOver={(e) => e.preventDefault()}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-6 cursor-pointer transition-colors",
          "hover:border-brand/60 hover:bg-muted/30",
          loading && "pointer-events-none opacity-60"
        )}
      >
        {loading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : (
          <Upload className="h-6 w-6 text-muted-foreground" />
        )}
        <p className="text-xs text-muted-foreground">
          {loading ? "Yükleniyor…" : "JSON dosyasını sürükle veya tıkla"}
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
        />
      </div>

      {result && (
        <div className="rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2 text-xs space-y-0.5">
          <div className="flex items-center gap-1.5 font-semibold text-green-500">
            <CheckCircle className="h-3.5 w-3.5" /> {result.title}
          </div>
          <p className="text-muted-foreground">{result.upserted} jokey içe aktarıldı</p>
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-xs">
          <div className="flex items-center gap-1.5 font-semibold text-red-500">
            <AlertCircle className="h-3.5 w-3.5" /> Hata: {error}
          </div>
        </div>
      )}
    </div>
  );
}
