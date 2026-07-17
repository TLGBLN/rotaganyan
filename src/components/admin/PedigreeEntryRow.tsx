"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import { updateRunnerPedigree } from "@/server/actions/race.actions";

type Props = {
  runnerId: string;
  no: number;
  name: string;
  sire: string | null;
  dam: string | null;
  damSire: string | null;
  pedigreeNote: string | null;
};

export default function PedigreeEntryRow({ runnerId, no, name, sire, dam, damSire, pedigreeNote }: Props) {
  const [form, setForm] = useState({
    sire: sire ?? "",
    dam: dam ?? "",
    damSire: damSire ?? "",
    pedigreeNote: pedigreeNote ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await updateRunnerPedigree(runnerId, form);
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function set<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setSaved(false);
  }

  return (
    <tr className="border-b last:border-0 align-top">
      <td className="px-3 py-2 text-muted-foreground">{no}</td>
      <td className="px-3 py-2 font-semibold whitespace-nowrap">{name}</td>
      <td className="px-2 py-2">
        <input
          value={form.sire}
          onChange={(e) => set("sire", e.target.value)}
          placeholder="Baba (sire)"
          className="w-full min-w-[110px] rounded-md border bg-transparent px-2 py-1 text-xs"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={form.dam}
          onChange={(e) => set("dam", e.target.value)}
          placeholder="Anne (dam)"
          className="w-full min-w-[110px] rounded-md border bg-transparent px-2 py-1 text-xs"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={form.damSire}
          onChange={(e) => set("damSire", e.target.value)}
          placeholder="Anne babası (damsire)"
          className="w-full min-w-[110px] rounded-md border bg-transparent px-2 py-1 text-xs"
        />
      </td>
      <td className="px-2 py-2">
        <input
          value={form.pedigreeNote}
          onChange={(e) => set("pedigreeNote", e.target.value)}
          placeholder="Not (opsiyonel)"
          className="w-full min-w-[140px] rounded-md border bg-transparent px-2 py-1 text-xs"
        />
      </td>
      <td className="px-2 py-2 text-right">
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-7 w-16 items-center justify-center rounded-md bg-brand text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : saved ? <Check className="h-3.5 w-3.5" /> : "Kaydet"}
        </button>
      </td>
    </tr>
  );
}
