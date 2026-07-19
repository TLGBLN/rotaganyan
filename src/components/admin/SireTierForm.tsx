"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

const TIERS = ["COK_YUKSEK", "YUKSEK", "GUCLU", "ORTA", "DUSUK", "ZAYIF"] as const;
const TIER_LABEL: Record<string, string> = {
  COK_YUKSEK: "Çok Yüksek (Tier-1)",
  YUKSEK: "Yüksek",
  GUCLU: "Güçlü (Tier-2)",
  ORTA: "Orta (Tier-3)",
  DUSUK: "Düşük",
  ZAYIF: "Zayıf",
};
// Toplu yapıştırmada Türkçe etiketle de eşleşsin diye (örn. "Çok Yüksek" → COK_YUKSEK)
const TIER_BY_LABEL: Record<string, string> = Object.fromEntries(
  TIERS.map((t) => [normalizeTierKey(TIER_LABEL[t].replace(/\s*\(Tier-\d\)\s*$/, "")), t])
);
function normalizeTierKey(s: string): string {
  return s
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I").replace(/Ü/g, "U").replace(/Ş/g, "S").replace(/Ğ/g, "G").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/\s+/g, "");
}
function resolveTier(raw: string): string {
  const key = normalizeTierKey(raw.trim());
  if ((TIERS as readonly string[]).includes(key)) return key;
  return TIER_BY_LABEL[key] ?? "ORTA";
}

type BulkRow = { name: string; tier: string; surface: string; breed: string; note: string };

/** "Aygır Adı; Tier; Pist(opsiyonel); Irk(opsiyonel); Not(opsiyonel)" — satır başına bir aygır. */
function parseBulkSireTiers(text: string): BulkRow[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.split(";").map((p) => p.trim());
      const [name, tierRaw, surfaceRaw, breedRaw, ...noteParts] = parts;
      const surface = (surfaceRaw ?? "").toUpperCase();
      const breed = (breedRaw ?? "").toUpperCase();
      return {
        name: name ?? "",
        tier: tierRaw ? resolveTier(tierRaw) : "ORTA",
        surface: ["KUM", "CIM", "SENTETIK"].includes(surface) ? surface : "",
        breed: ["ARAP", "INGILIZ"].includes(breed) ? breed : "",
        note: noteParts.join("; ").trim(),
      };
    })
    .filter((r) => r.name);
}

export default function SireTierForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tier, setTier] = useState<string>("ORTA");
  const [surface, setSurface] = useState("");
  const [breed, setBreed] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkResult, setBulkResult] = useState<{ ok: number; fail: number } | null>(null);

  async function submitOne(row: { name: string; tier: string; surface: string; breed: string; note: string }) {
    const res = await fetch("/api/admin/sire-tier", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(row),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
  }

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await submitOne({ name, tier, surface, breed, note });
      setName("");
      setNote("");
      setSurface("");
      setBreed("");
      router.refresh();
    } catch {
      toast.error("Kaydedilemedi, tekrar deneyin.");
    } finally {
      setSaving(false);
    }
  }

  async function submitBulk() {
    const rows = parseBulkSireTiers(bulkText);
    if (rows.length === 0) return;
    setBulkSaving(true);
    setBulkResult(null);
    const results = await Promise.allSettled(rows.map((r) => submitOne(r)));
    const ok = results.filter((r) => r.status === "fulfilled").length;
    setBulkResult({ ok, fail: results.length - ok });
    setBulkSaving(false);
    if (ok > 0) {
      setBulkText("");
      router.refresh();
    }
  }

  return (
    <div className="space-y-2">
      <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-5">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Aygır adı (sire/damsire)"
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm sm:col-span-2"
        />
        <select
          value={tier}
          onChange={(e) => setTier(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
        >
          {TIERS.map((t) => (
            <option key={t} value={t}>{TIER_LABEL[t]}</option>
          ))}
        </select>
        <select
          value={surface}
          onChange={(e) => setSurface(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">Pist (opsiyonel)</option>
          <option value="KUM">Kum</option>
          <option value="CIM">Çim</option>
          <option value="SENTETIK">Sentetik</option>
        </select>
        <select
          value={breed}
          onChange={(e) => setBreed(e.target.value)}
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm"
        >
          <option value="">Irk (opsiyonel)</option>
          <option value="ARAP">Arap</option>
          <option value="INGILIZ">İngiliz</option>
        </select>
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Not (opsiyonel)"
          className="rounded-md border bg-transparent px-2 py-1.5 text-sm sm:col-span-4"
        />
        <button
          onClick={submit}
          disabled={saving || !name.trim()}
          className="rounded-md bg-brand px-3 py-1.5 text-sm font-semibold text-black hover:bg-brand/90 disabled:opacity-50"
        >
          {saving ? "Kaydediliyor…" : "Ekle / Güncelle"}
        </button>
      </div>

      <div className="rounded-lg border p-3">
        <button
          onClick={() => setBulkOpen((v) => !v)}
          className="flex items-center gap-1 text-xs font-semibold text-brand hover:underline"
        >
          Toplu Yapıştır {bulkOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
        {bulkOpen && (
          <div className="mt-2 space-y-2">
            <p className="text-[11px] text-muted-foreground">
              Her satıra bir aygır: <code className="rounded bg-muted px-1">Aygır Adı; Tier; Pist; Irk; Not</code> —
              Pist/Irk/Not opsiyonel boş bırakılabilir. Tier hem &quot;Çok Yüksek&quot; hem &quot;COK_YUKSEK&quot; kabul eder.
            </p>
            <textarea
              value={bulkText}
              onChange={(e) => setBulkText(e.target.value)}
              placeholder={"TURBO; Çok Yüksek; Çim; Arap; 1000-1400m'de güçlü\nKAIZBERT; Yüksek\nAFRİKAANDER; Güçlü; Sentetik"}
              rows={5}
              className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs font-mono"
            />
            <button
              onClick={submitBulk}
              disabled={bulkSaving || !bulkText.trim()}
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {bulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {bulkSaving ? "Kaydediliyor…" : "Tümünü Kaydet"}
            </button>
            {bulkResult && (
              <p className={`text-[11px] ${bulkResult.fail > 0 ? "text-miss" : "text-hit"}`}>
                {bulkResult.ok} aygır kaydedildi{bulkResult.fail > 0 ? `, ${bulkResult.fail} satır başarısız` : ""}.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
