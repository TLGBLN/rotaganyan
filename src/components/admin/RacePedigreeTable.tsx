"use client";

import { useState } from "react";
import { Check, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { updateRunnerPedigree } from "@/server/actions/race.actions";

type Runner = {
  id: string;
  no: number;
  name: string;
  sire: string | null;
  dam: string | null;
  damSire: string | null;
  pedigreeNote: string | null;
};

type FormState = { sire: string; dam: string; damSire: string; pedigreeNote: string };
type ParsedEntry = { name: string; sire: string; dam: string; damSire: string; note: string };

const COMBINING_MARKS_RE = new RegExp("[̀-ͯ]", "g");
const TURKISH_UPPER_I_RE = new RegExp("İ", "g"); // İ

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

/**
 * "1. AT ADI / Babası (Sire): açıklama... / Anne Hattı (Dam / DamSire): açıklama..."
 * biçimindeki toplu pedigri metnini at başına ayrıştırır.
 */
function parseBulkPedigree(text: string): ParsedEntry[] {
  const blocks = text.split(/\n(?=\s*\d+\.\s)/).map((b) => b.trim()).filter(Boolean);
  const entries: ParsedEntry[] = [];

  for (const block of blocks) {
    const headerMatch = block.match(/^\d+\.\s*(.+)/);
    if (!headerMatch) continue;
    const name = headerMatch[1].trim();
    const rest = block.slice(headerMatch[0].length);

    const sireMatch = rest.match(/Babas[ıİi]\s*\(([^)]+)\)\s*:\s*([\s\S]*?)(?=\s*Anne\s*Hatt[ıİi]\s*\(|$)/i);
    const damMatch = rest.match(/Anne\s*Hatt[ıİi]\s*\(([^)]+)\)\s*:\s*([\s\S]*)$/i);

    const sire = sireMatch ? sireMatch[1].trim() : "";
    const sireNote = sireMatch ? sireMatch[2].trim() : "";

    let dam = "";
    let damSire = "";
    if (damMatch) {
      const parts = damMatch[1].split("/").map((s) => s.trim());
      dam = parts[0] ?? "";
      damSire = parts[1] ?? "";
    }
    const damNote = damMatch ? damMatch[2].trim() : "";

    const note = [sireNote, damNote].filter(Boolean).join(" ");
    if (name) entries.push({ name, sire, dam, damSire, note });
  }

  return entries;
}

export default function RacePedigreeTable({ raceNo, runners }: { raceNo: number; runners: Runner[] }) {
  const [forms, setForms] = useState<Record<string, FormState>>(() =>
    Object.fromEntries(
      runners.map((r) => [
        r.id,
        { sire: r.sire ?? "", dam: r.dam ?? "", damSire: r.damSire ?? "", pedigreeNote: r.pedigreeNote ?? "" },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [unmatched, setUnmatched] = useState<string[]>([]);
  const [matchedCount, setMatchedCount] = useState<number | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  function setField(id: string, key: keyof FormState, value: string) {
    setForms((prev) => ({ ...prev, [id]: { ...prev[id], [key]: value } }));
    setSavedIds((prev) => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }

  async function saveOne(id: string) {
    setSavingId(id);
    await updateRunnerPedigree(id, forms[id]);
    setSavingId(null);
    setSavedIds((prev) => new Set(prev).add(id));
  }

  function applyBulk() {
    const entries = parseBulkPedigree(bulkText);
    const misses: string[] = [];
    let hits = 0;
    setForms((prev) => {
      const next = { ...prev };
      for (const entry of entries) {
        const target = runners.find((r) => normalizeName(r.name) === normalizeName(entry.name));
        if (!target) {
          misses.push(entry.name);
          continue;
        }
        hits++;
        next[target.id] = { sire: entry.sire, dam: entry.dam, damSire: entry.damSire, pedigreeNote: entry.note };
      }
      return next;
    });
    setUnmatched(misses);
    setMatchedCount(hits);
  }

  async function saveAll() {
    setBulkSaving(true);
    await Promise.all(runners.map((r) => updateRunnerPedigree(r.id, forms[r.id])));
    setBulkSaving(false);
    setSavedIds(new Set(runners.map((r) => r.id)));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between px-3 py-1.5 border-b bg-muted/10">
        <span className="text-[11px] font-medium text-muted-foreground">{raceNo}. Koşu</span>
        <button
          onClick={() => setBulkOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          Toplu Yapıştır {bulkOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {bulkOpen && (
        <div className="border-b bg-muted/10 px-3 py-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            &quot;1. At Adı / Babası (Aygır): açıklama / Anne Hattı (Anne / Anne Babası): açıklama&quot; biçimindeki
            metni buraya yapıştırın — atlar isme göre bu koşudaki atlarla otomatik eşleştirilir.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            placeholder="1. AT ADI&#10;Babası (Aygır Adı): ...&#10;&#10;Anne Hattı (Anne / Anne Babası): ..."
            rows={6}
            className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs font-mono"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={applyBulk}
              disabled={!bulkText.trim()}
              className="rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              Ayrıştır ve Doldur
            </button>
            <button
              onClick={saveAll}
              disabled={bulkSaving}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              {bulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Tümünü Kaydet
            </button>
          </div>
          {matchedCount != null && (
            <p className="text-[11px] text-hit">{matchedCount} at eşleşti ve dolduruldu.</p>
          )}
          {unmatched.length > 0 && (
            <p className="text-[11px] text-miss">
              Eşleşmeyen at(lar) — isim bu koşudaki isimle birebir uyuşmuyor: {unmatched.join(", ")}
            </p>
          )}
        </div>
      )}

      <table className="w-full text-xs">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">No</th>
            <th className="px-3 py-1.5 text-left font-medium text-muted-foreground">At</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Baba</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Anne</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Anne Babası</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Not</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {runners.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-3 py-3 text-center text-muted-foreground">
                At kaydı yok.
              </td>
            </tr>
          ) : (
            runners.map((r) => {
              const form = forms[r.id];
              return (
                <tr key={r.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2 text-muted-foreground">{r.no}</td>
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">{r.name}</td>
                  <td className="px-2 py-2">
                    <input
                      value={form.sire}
                      onChange={(e) => setField(r.id, "sire", e.target.value)}
                      placeholder="Baba (sire)"
                      className="w-full min-w-[110px] rounded-md border bg-transparent px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={form.dam}
                      onChange={(e) => setField(r.id, "dam", e.target.value)}
                      placeholder="Anne (dam)"
                      className="w-full min-w-[110px] rounded-md border bg-transparent px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={form.damSire}
                      onChange={(e) => setField(r.id, "damSire", e.target.value)}
                      placeholder="Anne babası (damsire)"
                      className="w-full min-w-[110px] rounded-md border bg-transparent px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={form.pedigreeNote}
                      onChange={(e) => setField(r.id, "pedigreeNote", e.target.value)}
                      placeholder="Not (opsiyonel)"
                      className="w-full min-w-[140px] rounded-md border bg-transparent px-2 py-1 text-xs"
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <button
                      onClick={() => saveOne(r.id)}
                      disabled={savingId === r.id}
                      className="inline-flex h-7 w-16 items-center justify-center rounded-md bg-brand text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-60"
                    >
                      {savingId === r.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : savedIds.has(r.id) ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        "Kaydet"
                      )}
                    </button>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
