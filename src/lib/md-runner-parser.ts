export interface ParsedRunner {
  no: number;
  name: string;
  jockey?: string;
  weight?: number;
  weightChange?: number;
  agf?: number;
  sameJockey?: boolean;
  equipmentAdded?: string | null;
  equipmentRemoved?: string | null;
}

/**
 * Parses markdown / pipe-separated / tab-separated race data.
 *
 * Supported column order (flexible, auto-detected):
 *   No | At | Jokey | Kilo | ΔKilo | AGF% | Notlar
 *
 * "Notlar" field accepts:
 *   - "sarı", "üçgen", "▲", "▲"  → sameJockey = true
 *   - "sipiyere", "bone", "körük" etc. → equipmentAdded
 *   - "-sipiyere", "sipiyere çıkarıldı" → equipmentRemoved
 *   - Multiple: "sipiyere | sarı üçgen"
 */
export function parseMdRunners(raw: string): ParsedRunner[] {
  const runners: ParsedRunner[] = [];

  const lines = raw
    .trim()
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  for (const line of lines) {
    // Skip markdown separator rows (|---|) and empty lines
    if (/^[\|\s\-:]+$/.test(line)) continue;

    // Detect delimiter
    let cols: string[];
    if (line.includes("|")) {
      cols = line.split("|").map((c) => c.trim()).filter((c) => c !== "");
    } else if (line.includes("\t")) {
      cols = line.split("\t").map((c) => c.trim());
    } else {
      // Space-separated: first token must be a number
      const m = line.match(/^(\d{1,2})\s+(.+)/);
      if (!m) continue;
      cols = [m[1], ...m[2].split(/\s{2,}/)];
    }

    if (cols.length < 2) continue;

    // First column: race number
    const no = parseInt(cols[0].replace(/\D/g, ""), 10);
    if (isNaN(no) || no < 1 || no > 30) continue;

    const runner: ParsedRunner = { no, name: normalizeHorseName(cols[1]) };

    // Remaining columns positionally
    if (cols[2] !== undefined) runner.jockey = cols[2] || undefined;

    if (cols[3] !== undefined) {
      const w = parseFloat(cols[3].replace(",", "."));
      if (!isNaN(w)) runner.weight = w;
    }

    if (cols[4] !== undefined) {
      const d = parseFloat(cols[4].replace(",", "."));
      if (!isNaN(d)) runner.weightChange = d;
    }

    if (cols[5] !== undefined) {
      const a = parseFloat(cols[5].replace(",", ".").replace("%", ""));
      if (!isNaN(a) && a > 0) runner.agf = a;
    }

    // Notes column(s) — join remaining cols
    if (cols.length > 6) {
      const notes = cols.slice(6).join(" | ");
      applyNotes(runner, notes);
    }

    runners.push(runner);
  }

  return runners;
}

function normalizeHorseName(raw: string): string {
  return raw.replace(/[*_`]/g, "").trim().toUpperCase();
}

function applyNotes(r: ParsedRunner, notes: string) {
  const lower = notes.toLowerCase();

  if (
    lower.includes("sarı") ||
    lower.includes("üçgen") ||
    lower.includes("▲") ||
    lower.includes("▲")
  ) {
    r.sameJockey = true;
  }

  // Equipment removed markers
  const removedMatch =
    notes.match(/[-–]([a-zA-ZğüşıöçĞÜŞİÖÇ ]+)\s*(çıkarıldı|çıktı|kaldırıldı)?/i) ??
    notes.match(/([a-zA-ZğüşıöçĞÜŞİÖÇ ]+)\s+çıkarıldı/i);
  if (removedMatch) {
    const candidate = removedMatch[1].trim();
    if (candidate && candidate !== "-") r.equipmentRemoved = candidate;
  }

  // Equipment added: anything remaining after removing special markers
  const cleaned = notes
    .replace(/sarı\s*üçgen?/gi, "")
    .replace(/[▲▲]/g, "")
    .replace(/çıkarıldı|çıktı|kaldırıldı/gi, "")
    .replace(/-+/g, " ")
    .trim();

  if (cleaned && cleaned !== "" && cleaned.toLowerCase() !== "yok") {
    // If it's clearly an equipment name (not a punctuation residue)
    if (/[a-zA-ZğüşıöçĞÜŞİÖÇ]{3,}/.test(cleaned)) {
      r.equipmentAdded = cleaned;
    }
  }
}
