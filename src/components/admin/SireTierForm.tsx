"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const TIERS = ["COK_YUKSEK", "YUKSEK", "GUCLU", "ORTA", "DUSUK", "ZAYIF"] as const;
const TIER_LABEL: Record<string, string> = {
  COK_YUKSEK: "Çok Yüksek (Tier-1)",
  YUKSEK: "Yüksek",
  GUCLU: "Güçlü (Tier-2)",
  ORTA: "Orta (Tier-3)",
  DUSUK: "Düşük",
  ZAYIF: "Zayıf",
};

export default function SireTierForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [tier, setTier] = useState<string>("ORTA");
  const [surface, setSurface] = useState("");
  const [breed, setBreed] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (!name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/sire-tier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, tier, surface, breed, note }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
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

  return (
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
  );
}
