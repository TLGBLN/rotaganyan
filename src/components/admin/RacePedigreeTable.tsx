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
  sireStatOzet?: string | null;
  damStatOzet?: string | null;
  adminNote: string | null;
};

type FormState = { sire: string; dam: string; damSire: string; adminNote: string };
type ParsedNote = { name: string; note: string };

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

/** Satır başındaki opsiyonel "N." / "N -" / "N " numara önekini soyar — numara hiç
 *  yazılmamışsa (kullanıcı doğrudan at ismiyle başlıyorsa) satırı olduğu gibi bırakır. */
function stripLeadingNumber(line: string): string {
  return line.replace(/^\d+\s*[-.]?\s*/, "");
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// JS regex'in "i" bayrağı Türkçe nokta(sız) I harflerini eş saymıyor (İ/I/ı/i dördü de
// birbirinden farklı case-fold kümesinde) — /İ/i.test("I") === false. Kaynak metin TJK'dan
// farklı bir klavye/kaynaktan kopyalanınca (örn. "GAZNELİ" yerine "GAZNELI") isim hiç
// tanınmıyor, o atın bölümü sessizce önceki atın notuna karışıyordu. Ayrıca Ş/Ğ/Ü/Ö/Ç de
// noktalama işaretsiz ASCII haliyle (S/G/U/O/C) yapıştırılabiliyor — case-fold bunu da
// yakalamaz. Her harfi olası varyantlarını kapsayan bir karakter sınıfına çeviriyoruz.
const TURKISH_FOLD_CLASSES: Record<string, string> = {
  i: "İIıi", I: "İIıi", İ: "İIıi", ı: "İIıi",
  ş: "ŞşSs", Ş: "ŞşSs",
  ğ: "ĞğGg", Ğ: "ĞğGg",
  ü: "ÜüUu", Ü: "ÜüUu",
  ö: "ÖöOo", Ö: "ÖöOo",
  ç: "ÇçCc", Ç: "ÇçCc",
};
function buildFuzzyNamePattern(name: string): string {
  return escapeRegExp(name)
    .split("")
    .map((ch) => {
      const cls = TURKISH_FOLD_CLASSES[ch];
      return cls ? `[${cls}]` : ch;
    })
    .join("");
}

/**
 * Serbest metni, bu koşudaki at isimlerini bulup her ismi bir "blok başlangıcı" sayarak
 * parçalara ayırır — TÜM metin taranır, yalnız satır başı değil. Kullanıcı birden fazla
 * atın notunu aynı paragrafa/satıra yapıştırabiliyor (ör. "...koşacak yapıda. YENERSULTAN:
 * Kalitesi tartışılmaz..." — iki at aynı satırda) — bu yüzden iki durum da yeni blok sayılır:
 *  (1) satır başında bir isim (numara opsiyonel önekiyle),
 *  (2) metnin ORTASINDA olsa bile isim hemen ardından ":" ile geliyorsa.
 * Bir atın ismi başka bir atın notu İÇİNDE (":" ile devam etmeden) geçiyorsa yeni blok
 * SAYILMAZ — yanlış bölünmeyi önler.
 */
function splitByRunnerName(text: string, runnerNames: { raw: string; norm: string }[]): { name: string; block: string }[] {
  if (runnerNames.length === 0 || !text.trim()) return [];
  // Uzun isimler önce denenir (kısa bir isim uzun bir ismin parçası olmasın diye).
  const sorted = [...runnerNames].sort((a, b) => b.raw.length - a.raw.length);
  const alternation = sorted.map((r) => buildFuzzyNamePattern(r.raw)).join("|");
  const lineStartRe = new RegExp(`(?:^|\\n)[ \\t]*(?:\\d+\\s*[-.]?\\s*)?(${alternation})\\b`, "gi");
  const colonRe = new RegExp(`(${alternation})[ \\t]*:`, "gi");

  const hits = new Map<number, string>(); // metin içindeki başlangıç indeksi -> atın ORİJİNAL adı
  // lineStartRe: blok sınırı satırın başından (numara varsa dahil) itibaren sayılır —
  // aksi halde bir sonraki atın numarası, önceki atın notunun sonuna sızardı.
  for (const m of text.matchAll(lineStartRe)) {
    const matchedRaw = m[1];
    // Regex fuzzy sınıflarla eşleşti (İ/I/ı/i, Ş/S vb. karışabilir) — kesin atı bulmak için
    // normalizeName ile karşılaştırıyoruz (basit toUpperCase eşitliği bunu YAKALAMAZ).
    const found = sorted.find((r) => normalizeName(r.raw) === normalizeName(matchedRaw));
    if (!found) continue;
    const idx = (m.index ?? 0) + (m[0].startsWith("\n") ? 1 : 0);
    if (!hits.has(idx)) hits.set(idx, found.raw);
  }
  // colonRe: metnin ORTASINDA (satır başı olmadan) yakalanan "AD:" durumu — sınır
  // doğrudan ismin kendisinden başlar.
  for (const m of text.matchAll(colonRe)) {
    const matchedRaw = m[1];
    const found = sorted.find((r) => normalizeName(r.raw) === normalizeName(matchedRaw));
    if (!found) continue;
    const idx = (m.index ?? 0) + m[0].indexOf(matchedRaw);
    if (!hits.has(idx)) hits.set(idx, found.raw);
  }

  const starts = [...hits.entries()].map(([idx, name]) => ({ idx, name })).sort((a, b) => a.idx - b.idx);
  return starts.map((s, i) => {
    const end = i + 1 < starts.length ? starts[i + 1].idx : text.length;
    return { name: s.name, block: text.slice(s.idx, end).trim() };
  });
}

/**
 * Herhangi bir eksik veriyi (sakatlık haberi, antrenman gözlemi, pist/hava notu,
 * TJK'da olmayan her şey) at başına ayrıştırır. Numaralı ("1. AT ADI: metin")
 * ya da numarasız ("AT ADI: metin" / tamamen serbest paragraf) her format kabul edilir —
 * bloklar bu koşudaki gerçek at isimlerine göre ayrılır.
 */
function parseBulkNotes(text: string, runnerNames: string[]): ParsedNote[] {
  const normNames = runnerNames.map((n) => ({ raw: n, norm: normalizeName(n) }));
  const entries: ParsedNote[] = [];
  for (const { name, block } of splitByRunnerName(text, normNames)) {
    // block TAM OLARAK atın adıyla başlar (numara varsa önce o) — numara, isim, varsa ":"
    // soyulur; geri kalan (aynı satırda veya sonraki satırlarda ne varsa) nottur.
    const afterNum = stripLeadingNumber(block);
    const nameRe = new RegExp(`^${buildFuzzyNamePattern(name)}\\s*:?\\s*`, "i");
    const note = afterNum.replace(nameRe, "").trim();
    if (note) entries.push({ name, note });
  }
  return entries;
}

export default function RacePedigreeTable({ runners }: { runners: Runner[] }) {
  const [forms, setForms] = useState<Record<string, FormState>>(() =>
    Object.fromEntries(
      runners.map((r) => [
        r.id,
        {
          sire: r.sire ?? "",
          dam: r.dam ?? "",
          damSire: r.damSire ?? "",
          adminNote: r.adminNote ?? "",
        },
      ])
    )
  );
  const [savingId, setSavingId] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

  const [noteBulkOpen, setNoteBulkOpen] = useState(false);
  const [noteBulkText, setNoteBulkText] = useState("");
  const [noteUnmatched, setNoteUnmatched] = useState<string[]>([]);
  const [noteMatchedCount, setNoteMatchedCount] = useState<number | null>(null);
  const [noteBulkSaving, setNoteBulkSaving] = useState(false);

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

  async function applyNoteBulk() {
    const entries = parseBulkNotes(noteBulkText, runners.map((r) => r.name));
    const misses: string[] = [];
    const matched: { id: string; form: FormState }[] = [];
    for (const entry of entries) {
      const target = runners.find((r) => normalizeName(r.name) === normalizeName(entry.name));
      if (!target) {
        misses.push(entry.name);
        continue;
      }
      matched.push({ id: target.id, form: { ...forms[target.id], adminNote: entry.note } });
    }
    setForms((prev) => {
      const next = { ...prev };
      for (const m of matched) next[m.id] = m.form;
      return next;
    });
    setNoteUnmatched(misses);
    setNoteMatchedCount(matched.length);
    if (matched.length === 0) return;
    setNoteBulkSaving(true);
    await Promise.all(matched.map((m) => updateRunnerPedigree(m.id, m.form)));
    setNoteBulkSaving(false);
    setSavedIds((prev) => {
      const next = new Set(prev);
      for (const m of matched) next.add(m.id);
      return next;
    });
  }

  async function saveNoteBulk() {
    setNoteBulkSaving(true);
    await Promise.all(runners.map((r) => updateRunnerPedigree(r.id, forms[r.id])));
    setNoteBulkSaving(false);
    setSavedIds(new Set(runners.map((r) => r.id)));
  }

  return (
    <div className="overflow-x-auto">
      <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/20">
        <span className="text-[11px] font-semibold text-muted-foreground">📝 Genel Eksik Veri Notu (pedigri DEĞİL)</span>
        <button
          onClick={() => setNoteBulkOpen((v) => !v)}
          className="flex items-center gap-1 text-[11px] font-semibold text-brand hover:underline"
        >
          Toplu Yapıştır {noteBulkOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
        </button>
      </div>

      {noteBulkOpen && (
        <div className="border-b bg-muted/10 px-3 py-3 space-y-2">
          <p className="text-[11px] text-muted-foreground">
            Pedigri dışında herhangi bir eksik veriyi buradan girebilirsiniz (sakatlık haberi, antrenman
            gözlemi, pist/hava notu vb.) — otomatik analiz motoru bu notu okur ve dikkate alır. &quot;At Adı: not&quot;
            ya da &quot;AT ADI&quot; satırından sonra serbest paragraf — numara şart değil, isme göre eşleşir ve kaydedilir.
          </p>
          <textarea
            value={noteBulkText}
            onChange={(e) => setNoteBulkText(e.target.value)}
            placeholder={"1. AT ADI: son antrenmanda hafif topallama gözlendi\n2. DİĞER AT: pist bugün ağır, kapanışı güçlü atlar avantajlı"}
            rows={4}
            className="w-full rounded-md border bg-transparent px-2 py-1.5 text-xs font-mono"
          />
          <div className="flex items-center gap-2">
            <button
              onClick={applyNoteBulk}
              disabled={!noteBulkText.trim() || noteBulkSaving}
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {noteBulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Ayrıştır ve Kaydet
            </button>
            <button
              onClick={saveNoteBulk}
              disabled={noteBulkSaving}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-50"
            >
              {noteBulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Tümünü Kaydet
            </button>
          </div>
          {noteMatchedCount != null && (
            <p className="text-[11px] text-hit">{noteMatchedCount} at eşleşti ve kaydedildi.</p>
          )}
          {noteUnmatched.length > 0 && (
            <p className="text-[11px] text-miss">
              Eşleşmeyen at(lar) — isim bu koşudaki isimle birebir uyuşmuyor: {noteUnmatched.join(", ")}
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
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Genel Not</th>
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
                  <td className="px-3 py-2 font-semibold whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      {r.name}
                      {(form.sire.trim() || form.dam.trim() || form.damSire.trim()) && (
                        <Check className="h-3.5 w-3.5 text-hit" aria-label="Pedigri girildi" />
                      )}
                    </span>
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={form.sire}
                      onChange={(e) => setField(r.id, "sire", e.target.value)}
                      placeholder="Baba (sire)"
                      className="w-full min-w-[110px] rounded-md border bg-transparent px-2 py-1 text-xs"
                    />
                    {r.sireStatOzet ? (
                      <p className="mt-1 text-[10px] leading-snug text-hit">🏆 Otomatik: {r.sireStatOzet}</p>
                    ) : form.sire.trim() ? (
                      <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
                        Aygır İstatistik&apos;te bu pist/mesafede eşleşme yok
                      </p>
                    ) : null}
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
                    {r.damStatOzet ? (
                      <p className="mt-1 text-[10px] leading-snug text-hit">🐎 Otomatik: {r.damStatOzet}</p>
                    ) : null}
                  </td>
                  <td className="px-2 py-2">
                    <input
                      value={form.adminNote}
                      onChange={(e) => setField(r.id, "adminNote", e.target.value)}
                      placeholder="Eksik veri / genel not (opsiyonel)"
                      className="w-full min-w-[160px] rounded-md border bg-transparent px-2 py-1 text-xs"
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
