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
  adminNote: string | null;
};

type FormState = { sire: string; dam: string; damSire: string; pedigreeNote: string; adminNote: string };
type ParsedEntry = { name: string; sire: string; dam: string; damSire: string; note: string };
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
  const alternation = sorted.map((r) => escapeRegExp(r.raw)).join("|");
  const lineStartRe = new RegExp(`(?:^|\\n)[ \\t]*(?:\\d+\\s*[-.]?\\s*)?(${alternation})\\b`, "gi");
  const colonRe = new RegExp(`(${alternation})[ \\t]*:`, "gi");

  const hits = new Map<number, string>(); // metin içindeki başlangıç indeksi -> atın ORİJİNAL adı
  // lineStartRe: blok sınırı satırın başından (numara varsa dahil) itibaren sayılır —
  // aksi halde bir sonraki atın numarası, önceki atın notunun sonuna sızardı.
  for (const m of text.matchAll(lineStartRe)) {
    const matchedRaw = m[1];
    const found = sorted.find((r) => r.raw.toLocaleUpperCase("tr-TR") === matchedRaw.toLocaleUpperCase("tr-TR"));
    if (!found) continue;
    const idx = (m.index ?? 0) + (m[0].startsWith("\n") ? 1 : 0);
    if (!hits.has(idx)) hits.set(idx, found.raw);
  }
  // colonRe: metnin ORTASINDA (satır başı olmadan) yakalanan "AD:" durumu — sınır
  // doğrudan ismin kendisinden başlar.
  for (const m of text.matchAll(colonRe)) {
    const matchedRaw = m[1];
    const found = sorted.find((r) => r.raw.toLocaleUpperCase("tr-TR") === matchedRaw.toLocaleUpperCase("tr-TR"));
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
 * pedigri yorumu, TJK'da olmayan her şey) at başına ayrıştırır. Numaralı ("1. AT ADI: metin")
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
    const nameRe = new RegExp(`^${escapeRegExp(name)}\\s*:?\\s*`, "i");
    const note = afterNum.replace(nameRe, "").trim();
    if (note) entries.push({ name, note });
  }
  return entries;
}

/** İlk "(" ile ona denk gelen (iç içe parantezleri — "(IRE)", "(USA)" gibi ülke kodlarını —
 *  doğru sayarak bulunan) kapanış ")"sını ayırır. Basit `[^)]+` regex'i iç içe parantezde
 *  ("AUTHORIZED (IRE)" gibi) yanlış yerde durur; bu yüzden derinlik sayarak elle taranır. */
function matchBalancedParen(s: string): { pre: string; inner: string; afterIdx: number } | null {
  const openIdx = s.indexOf("(");
  if (openIdx < 0) return null;
  let depth = 0;
  for (let i = openIdx; i < s.length; i++) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") {
      depth--;
      if (depth === 0) {
        return { pre: s.slice(0, openIdx).trim(), inner: s.slice(openIdx + 1, i).trim(), afterIdx: i + 1 };
      }
    }
  }
  return null;
}

function splitPedigreeParen(inner: string): { sire: string; dam: string; damSire: string } {
  const slashParts = inner.split("/").map((s) => s.trim());
  const sirePart = slashParts[0] ?? "";
  const damSire = slashParts[1] ?? "";
  const dashIdx = sirePart.indexOf("-");
  const sire = dashIdx >= 0 ? sirePart.slice(0, dashIdx).trim() : sirePart.trim();
  const dam = dashIdx >= 0 ? sirePart.slice(dashIdx + 1).trim() : "";
  return { sire, dam, damSire };
}

/**
 * Dört format da kabul edilir, blok bazında otomatik seçilir — bloklar bu koşudaki
 * GERÇEK at isimlerine göre ayrılır, numara ZORUNLU değildir:
 *  (A) Eski yapılandırılmış format — sade isim satırı, ardından "Babası (...): / Anne Hattı (...):" etiketleri.
 *  (B) Kompakt tek satır: "11 - AT ADI (Baba - Anne / Anne Babası): açıklama".
 *  (C) Başlık + serbest metin: "1 - AT ADI (Baba - Anne / Anne Babası)" satırından sonra kolon YOK,
 *      devamındaki paragraflar ("Baba (...): ...", "Kısrak Babası (...): ...", "Değerlendirme: ..." gibi
 *      herhangi bir başlıkla) olduğu gibi not olarak saklanır — kullanıcının kendi serbest yazım tarzı.
 *  (D) Tamamen serbest paragraf — hiç parantez/etiket yok, isim satırından sonraki HER ŞEY nota düşer
 *      (ör. "6 ŞAFAK BEY\n2000 metre onun için biçilmiş kaftan...").
 * (B) ve (C) baba/anne isimlerinde "AUTHORIZED (IRE)" gibi iç içe parantez olsa da doğru ayrıştırır.
 */
function parseBulkPedigree(text: string, runnerNames: string[]): ParsedEntry[] {
  const normNames = runnerNames.map((n) => ({ raw: n, norm: normalizeName(n) }));
  const entries: ParsedEntry[] = [];

  for (const { name, block } of splitByRunnerName(text, normNames)) {
    // block TAM OLARAK atın kendi adıyla başlar (numara varsa önce o) — sırayla numara,
    // sonra ismin kendisi, sonra varsa ":" soyulur; geri kalan gerçek içeriktir. Bu, hem
    // "AT ADI: metin" (aynı satırda) hem "AT ADI\nmetin" (ayrı satırda) hem de
    // "AT ADI (Baba - Anne): metin" biçimlerini TEK bir yerden doğru ele alır.
    const afterNum = stripLeadingNumber(block);
    const nameRe = new RegExp(`^${escapeRegExp(name)}\\s*:?\\s*`, "i");
    const content = afterNum.replace(nameRe, "");

    const firstLineEnd = content.indexOf("\n");
    const firstLine = firstLineEnd >= 0 ? content.slice(0, firstLineEnd) : content;
    const restOfBlock = firstLineEnd >= 0 ? content.slice(firstLineEnd + 1) : "";

    // (B)/(C) İsimden hemen sonra "(Baba - Anne / Anne Babası)" var mı?
    const headerParen = matchBalancedParen(firstLine);
    if (headerParen && headerParen.pre.length === 0) {
      const { sire, dam, damSire } = splitPedigreeParen(headerParen.inner);
      const afterParenOnFirstLine = firstLine.slice(headerParen.afterIdx);
      const colonMatch = afterParenOnFirstLine.match(/^\s*:\s*([\s\S]*)$/);
      const note = colonMatch
        ? [colonMatch[1].trim(), restOfBlock.trim()].filter(Boolean).join("\n")
        : [afterParenOnFirstLine.trim(), restOfBlock.trim()].filter(Boolean).join("\n");
      entries.push({ name, sire, dam, damSire, note });
      continue;
    }

    // (A) Parantez yok — devamı yapılandırılmış "Babası/Anne Hattı" etiketleriyle mi geliyor?
    const sireMatch = content.match(/Babas[ıİi]\s*\(([^)]+)\)\s*:\s*([\s\S]*?)(?=\s*Anne\s*Hatt[ıİi]\s*\(|$)/i);
    const damMatch = content.match(/Anne\s*Hatt[ıİi]\s*\(([^)]+)\)\s*:\s*([\s\S]*)$/i);

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

    // (D) Ne "Babası"/"Anne Hattı" etiketi ne de isimden sonra parantez varsa, veriyi
    // sessizce kaybetmemek için TÜM içeriği olduğu gibi nota düş (sire/dam boş kalır).
    const note = [sireNote, damNote].filter(Boolean).join(" ") || content.trim();
    entries.push({ name, sire, dam, damSire, note });
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
          pedigreeNote: r.pedigreeNote ?? "",
          adminNote: r.adminNote ?? "",
        },
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

  // Ayrıştırma + kaydetme TEK adımda — önceden "Ayrıştır ve Doldur" yalnız formu
  // dolduruyordu, ayrıca "Tümünü Kaydet"e basılması gerekiyordu; bu ikinci adım
  // gözden kaçtığı için (kullanıcı verisini girip kaydetmeden çıktığı) defalarca
  // "girdim ama yansımadı" sorununa yol açtı — artık ayrı bir adım yok.
  async function applyBulk() {
    const entries = parseBulkPedigree(bulkText, runners.map((r) => r.name));
    const misses: string[] = [];
    const matched: { id: string; form: FormState }[] = [];
    for (const entry of entries) {
      const target = runners.find((r) => normalizeName(r.name) === normalizeName(entry.name));
      if (!target) {
        misses.push(entry.name);
        continue;
      }
      matched.push({
        id: target.id,
        form: { ...forms[target.id], sire: entry.sire, dam: entry.dam, damSire: entry.damSire, pedigreeNote: entry.note },
      });
    }
    setForms((prev) => {
      const next = { ...prev };
      for (const m of matched) next[m.id] = m.form;
      return next;
    });
    setUnmatched(misses);
    setMatchedCount(matched.length);
    if (matched.length === 0) return;
    setBulkSaving(true);
    await Promise.all(matched.map((m) => updateRunnerPedigree(m.id, m.form)));
    setBulkSaving(false);
    setSavedIds((prev) => {
      const next = new Set(prev);
      for (const m of matched) next.add(m.id);
      return next;
    });
  }

  async function saveAll() {
    setBulkSaving(true);
    await Promise.all(runners.map((r) => updateRunnerPedigree(r.id, forms[r.id])));
    setBulkSaving(false);
    setSavedIds(new Set(runners.map((r) => r.id)));
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
      <div className="flex items-center justify-end px-3 py-1.5 border-b bg-muted/10">
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
            &quot;1. At Adı (Baba - Anne / Anne Babası): açıklama&quot; ya da tamamen serbest paragraf
            (&quot;AT ADI&quot; satırından sonra istediğin kadar metin) — numara şart değil, atlar
            isme göre bu koşudaki atlarla otomatik eşleştirilir ve doğrudan kaydedilir.
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
              disabled={!bulkText.trim() || bulkSaving}
              className="flex items-center gap-1.5 rounded-md bg-brand px-3 py-1.5 text-xs font-semibold text-brand-foreground hover:bg-brand/90 disabled:opacity-50"
            >
              {bulkSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              Ayrıştır ve Kaydet
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
            <p className="text-[11px] text-hit">{matchedCount} at eşleşti ve kaydedildi.</p>
          )}
          {unmatched.length > 0 && (
            <p className="text-[11px] text-miss">
              Eşleşmeyen at(lar) — isim bu koşudaki isimle birebir uyuşmuyor: {unmatched.join(", ")}
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between border-b px-3 py-1.5 bg-muted/10">
        <span className="text-[11px] text-muted-foreground">Genel Eksik Veri Notu</span>
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
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Pedigri Notu</th>
            <th className="px-2 py-1.5 text-left font-medium text-muted-foreground">Genel Not</th>
            <th className="px-2 py-1.5"></th>
          </tr>
        </thead>
        <tbody>
          {runners.length === 0 ? (
            <tr>
              <td colSpan={8} className="px-3 py-3 text-center text-muted-foreground">
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
                      {(form.sire.trim() || form.dam.trim() || form.damSire.trim() || form.pedigreeNote.trim()) && (
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
                      placeholder="Pedigri notu (opsiyonel)"
                      className="w-full min-w-[140px] rounded-md border bg-transparent px-2 py-1 text-xs"
                    />
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
