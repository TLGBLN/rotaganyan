"use client";

import { useState } from "react";
import { CheckCircle, XCircle, Loader2, Upload } from "lucide-react";

interface ImportResult {
  id: string | number;
  label: string;
  ok: boolean;
  predictionId?: string;
  error?: string;
}

export default function AnalysisImporter() {
  const [text, setText] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [results, setResults] = useState<ImportResult[]>([]);
  const [summary, setSummary] = useState<{ ok: number; fail: number } | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  async function runImport() {
    setParseError(null);

    let parsed: unknown;
    try {
      parsed = JSON.parse(text.trim());
    } catch {
      setParseError("Geçersiz JSON. Düzeltip tekrar dene.");
      return;
    }

    setStatus("loading");
    setResults([]);
    setSummary(null);

    const res = await fetch("/api/admin/import-analyses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed),
    });

    const data = await res.json();

    if (!res.ok) {
      setStatus("error");
      setParseError(data.error ?? "Sunucu hatası");
      return;
    }

    setStatus("done");
    setResults(data.results ?? []);
    setSummary({ ok: data.ok, fail: data.fail });
  }

  const okCount = results.filter((r) => r.ok).length;
  const failCount = results.filter((r) => !r.ok).length;

  return (
    <div className="space-y-4">
      {/* Textarea */}
      <textarea
        value={text}
        onChange={(e) => { setText(e.target.value); setStatus("idle"); setParseError(null); }}
        placeholder={'[\n  {\n    "id": 103,\n    "tarih": "2026-06-18",\n    "hipo": "Ankara",\n    ...\n  }\n]'}
        rows={14}
        className="w-full rounded-lg border border-white/10 bg-white/[0.03] px-3 py-2.5 font-mono text-xs leading-relaxed text-foreground placeholder:text-white/20 focus:border-brand/40 focus:outline-none resize-y"
      />

      {parseError && (
        <p className="flex items-center gap-2 text-xs text-miss">
          <XCircle className="h-3.5 w-3.5 shrink-0" />
          {parseError}
        </p>
      )}

      <button
        onClick={runImport}
        disabled={status === "loading" || !text.trim()}
        className="flex items-center gap-2 rounded-lg bg-brand px-5 py-2.5 text-sm font-semibold text-black hover:bg-brand/90 disabled:opacity-50"
      >
        {status === "loading" ? (
          <><Loader2 className="h-4 w-4 animate-spin" />İmport ediliyor…</>
        ) : (
          <><Upload className="h-4 w-4" />Siteye Yükle</>
        )}
      </button>

      {/* Summary */}
      {summary && (
        <div className="flex items-center gap-4 text-sm">
          <span className="flex items-center gap-1.5 font-semibold text-hit">
            <CheckCircle className="h-4 w-4" />
            {summary.ok} başarılı
          </span>
          {summary.fail > 0 && (
            <span className="flex items-center gap-1.5 font-semibold text-miss">
              <XCircle className="h-4 w-4" />
              {summary.fail} hatalı
            </span>
          )}
        </div>
      )}

      {/* Per-item results */}
      {results.length > 0 && (
        <div className="rounded-lg border border-white/10 overflow-hidden">
          <div className="border-b border-white/10 bg-white/5 px-3 py-2 text-xs font-semibold text-muted-foreground">
            {okCount} / {results.length} analiz yüklendi
          </div>
          <div className="divide-y divide-white/5 max-h-96 overflow-y-auto">
            {results.map((r, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                {r.ok ? (
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-hit" />
                ) : (
                  <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-miss" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-medium">{r.label}</p>
                  {r.ok && r.predictionId && (
                    <a
                      href={`/admin/analizler/${r.predictionId}`}
                      className="text-[10px] text-brand hover:underline"
                    >
                      Analizi gör →
                    </a>
                  )}
                  {!r.ok && (
                    <p className="mt-0.5 text-[10px] text-miss">{r.error}</p>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
