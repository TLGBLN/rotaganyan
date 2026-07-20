"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, RefreshCw } from "lucide-react";
import { updateRunnerAdminNote } from "@/server/actions/race.actions";
import type { RunnerVeriDurumu } from "@/app/api/admin/faz1-durum/route";

const COMBINING_MARKS_RE = new RegExp("[̀-ͯ]", "g");
const TURKISH_UPPER_I_RE = new RegExp("İ", "g");

function normalizeName(s: string): string {
  return s
    .toLocaleUpperCase("tr-TR")
    .replace(TURKISH_UPPER_I_RE, "I")
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** "1. At Adı: eksik veri metni" — satır başına bir at. */
function parseBulkNotes(text: string): { name: string; note: string }[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const m = line.match(/^\d+\.\s*([^:]+):\s*(.+)$/);
      if (!m) return null;
      return { name: m[1].trim(), note: m[2].trim() };
    })
    .filter((e): e is { name: string; note: string } => e != null && e.name.length > 0);
}

export default function Faz1VeriDurumu({ raceId }: { raceId: string }) {
  const [loading, setLoading] = useState(false);
  const [runners, setRunners] = useState<RunnerVeriDurumu[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ ok: number; fail: number; unmatched: string[] } | null>(null);

  async function loadDurum() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/faz1-durum", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ raceId }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Hata");
      setRunners(data.runners);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Veri durumu alınamadı");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDurum();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [raceId]);

  async function submitBulk() {
    if (!runners) return;
    const entries = parseBulkNotes(bulkText);
    if (entries.length === 0) return;
    setSaving(true);
    setSaveResult(null);
    const unmatched: string[] = [];
    const matched: { id: string; note: string }[] = [];
    for (const entry of entries) {
      const target = runners.find((r) => normalizeName(r.ad) === normalizeName(entry.name));
      if (!target) { unmatched.push(entry.name); continue; }
      matched.push({ id: target.id, note: entry.note });
    }
    const results = await Promise.allSettled(matched.map((m) => updateRunnerAdminNote(m.id, m.note)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    setSaveResult({ ok, fail: results.length - ok, unmatched });
    setSaving(false);
    if (ok > 0) {
      setBulkText("");
      await loadDurum();
    }
  }

  const eksigiOlanlar = runners?.filter((r) => r.eksikler.length > 0) ?? [];

  return (
    <div className="rounded-xl border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Faz 1 — Veri Durumu</h3>
        <button
          onClick={loadDurum}
          disabled={loading}
          className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
          Yenile
        </button>
      </div>

      {error && <p className="text-xs text-miss">{error}</p>}

      {loading && !runners && <p className="text-xs text-muted-foreground">Kontrol ediliyor…</p>}

      {runners && (
        <>
          {eksigiOlanlar.length === 0 ? (
            <p className="text-xs text-hit">Otomatik olarak çekilebilen tüm veriler tam — eksik yok.</p>
          ) : (
            <div className="space-y-1.5">
              {eksigiOlanlar.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="font-semibold">#{r.no} {r.ad}</span>
                  {r.eksikler.map((e) => (
                    <span key={e} className="rounded bg-miss/10 px-1.5 py-0.5 text-[10px] text-miss">{e}</span>
                  ))}
                  {r.bilgiler.map((b) => (
                    <span key={b} className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">{b}</span>
                  ))}
                  {r.adminNotu && (
                    <span className="rounded bg-hit/10 px-1.5 py-0.5 text-[10px] text-hit">Not girildi: {r.adminNotu}</span>
                  )}
                </div>
              ))}
            </div>
          )}

          <div className="border-t pt-3">
            <button
              onClick={() => setOpen((v) => !v)}
              className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
            >
              Eksik Veriyi Elle Gir {open ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
            {open && (
              <div className="mt-2 space-y-2">
                <p className="text-[11px] text-muted-foreground">
                  Yukarıda eksik görünen (ya da başka herhangi bir) at için satır satır yaz — format:{" "}
                  <code className="rounded bg-muted px-1">1. At Adı: eksik bilgi (pedigri, galop, ne varsa)</code>.
                  Kaydettiğinde Faz 1&apos;e eklenir, &quot;Otomatik Analiz Oluştur&quot;a bastığında Faz 2 bu bilgiyle birlikte çalışır.
                </p>
                <textarea
                  value={bulkText}
                  onChange={(e) => setBulkText(e.target.value)}
                  placeholder={"1. AT ADI: babası X aygırı, çim pistte iyi sonuç veren bir soy\n2. DİĞER AT: son idmanında hafif topallama gözlendi"}
                  rows={4}
                  className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs font-mono"
                />
                <button
                  onClick={submitBulk}
                  disabled={saving || !bulkText.trim()}
                  className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  {saving ? "Kaydediliyor…" : "Kaydet ve Faz 1'e Ekle"}
                </button>
                {saveResult && (
                  <div className="text-[11px]">
                    <p className={saveResult.ok > 0 ? "text-hit" : "text-muted-foreground"}>
                      {saveResult.ok} at güncellendi.
                    </p>
                    {saveResult.unmatched.length > 0 && (
                      <p className="text-miss">
                        Eşleşmeyen at(lar) — isim bu koşudaki isimle birebir uyuşmuyor: {saveResult.unmatched.join(", ")}
                      </p>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
