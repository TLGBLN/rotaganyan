import type { Surface, Breed, Confidence, PedigreeRating } from "@prisma/client";

export interface ReportRunner {
  no: number;
  name: string;
  weight?: number;
  jockey?: string;
  agf?: number;
  sire?: string;
  damSire?: string;
  pedigreeNote?: string;
  equipmentAdded?: string;
  equipmentRemoved?: string;
  weightChange?: number;
  sameJockey?: boolean;
}

export interface ReportGallop {
  runnerNo: number;
  date: Date | null;
  track?: string;
  form?: string;
  splits: Record<string, string>;
}

export interface ReportPick {
  rank: number;
  no: number;
  name: string;
  score: number | null;
  pedigreeRating: PedigreeRating;
  details: string[];
  /** Raporda ayrıca "TJK No" sütunu varsa — kupon metnindeki TJK numaralarını Aktif No'ya çevirmek için. */
  tjkNo?: number;
}

export interface ParsedReport {
  date: Date | null;
  hippodrome: string | null;
  raceNo: number | null;
  raceTime: string | null;
  confidence: Confidence;
  classType: string | null;
  breed: Breed | null;
  distance: number | null;
  surface: Surface | null;
  runners: ReportRunner[];
  picks: ReportPick[];
  gallops: ReportGallop[];
  tempo: string | null;
  couponNarrow: string | null;
  couponNormal: string | null;
  couponWide: string | null;
  isBanko: boolean;
  bankoNote: string | null;
  notes: string | null;
}

const TR_MAP: Record<string, string> = {
  İ: "I", I: "I", ı: "i", Ğ: "G", ğ: "g", Ü: "U", ü: "u",
  Ş: "S", ş: "s", Ö: "O", ö: "o", Ç: "C", ç: "c",
};

function normTr(s: string): string {
  return s
    .replace(/[İIığĞüÜşŞöÖçÇ]/g, (c) => TR_MAP[c] ?? c)
    .toUpperCase()
    .trim();
}

function stripMd(s: string): string {
  return s.replace(/\*\*/g, "").replace(/[`_]/g, "").trim();
}

/** "8 TEYAR" -> { no: 8, name: "TEYAR" } */
function parseNoName(raw: string): { no: number; name: string } | null {
  const m = stripMd(raw).match(/^(\d+)\s+(.+)$/);
  if (!m) return null;
  return { no: parseInt(m[1], 10), name: m[2].trim() };
}

function mapSurface(v: string): Surface | null {
  const n = normTr(v);
  if (n.includes("KUM")) return "KUM";
  if (n.includes("CIM")) return "CIM";
  if (n.includes("SENTETIK")) return "SENTETIK";
  return null;
}

function mapBreed(v: string): Breed | null {
  const n = normTr(v);
  if (n.includes("ARAP")) return "ARAP";
  if (n.includes("INGILIZ")) return "INGILIZ";
  return null;
}

function mapConfidence(v: string): Confidence {
  const n = normTr(v);
  if (n.includes("YUKSEK")) return "YUKSEK";
  if (n.includes("DUSUK")) return "DUSUK";
  return "ORTA";
}

/** "52/60" -> 52, "/60" (unfilled placeholder) -> null, "**84/100**" (pre-stripped) -> 84 */
function parseFractionNumerator(raw: string | undefined): number | null {
  if (!raw) return null;
  const m = raw.trim().match(/^(\d+(?:[.,]\d+)?)/);
  if (!m) return null;
  const n = parseFloat(m[1].replace(",", "."));
  return isNaN(n) ? null : n;
}

function countStars(raw: string): number {
  return (raw.match(/⭐/g) ?? []).length;
}

/** A Katmanı/B Katmanı/C Katmanı şablonundaki yıldız sayısını PedigreeRating'e çevirir. */
function mapStarPedigree(stars: number): PedigreeRating {
  if (stars >= 5) return "COK_YUKSEK";
  if (stars === 4) return "YUKSEK";
  if (stars === 3) return "GUCLU";
  if (stars === 2) return "ORTA";
  if (stars === 1) return "DUSUK";
  return "BILINMIYOR";
}

function mapPedigree(v: string): PedigreeRating {
  const n = normTr(v);
  // v1.6 template shorthand: Tier-1 ÇOK GÜÇLÜ / Tier-2 GÜÇLÜ / Tier-3 ORTA / Zayıf
  if (n.includes("TIER-1") || n.includes("TIER1")) return "COK_YUKSEK";
  if (n.includes("TIER-2") || n.includes("TIER2")) return "GUCLU";
  if (n.includes("TIER-3") || n.includes("TIER3")) return "ORTA";
  if (n.includes("COK")) return "COK_YUKSEK";
  if (n.includes("GUCLU")) return "GUCLU";
  if (n.includes("YUKSEK")) return "YUKSEK";
  if (n.includes("ORTA")) return "ORTA";
  if (n.includes("ZAYIF")) return "ZAYIF";
  if (n.includes("DUSUK")) return "DUSUK";
  return "BILINMIYOR";
}

/** Extracts the markdown body between a heading matching `headingNorm` and the next heading line. */
function extractSection(text: string, headingNorm: string): string {
  const lines = text.split("\n");
  let start = -1;
  let end = lines.length;
  let level = 0;
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^(#{1,4})\s+(.+)$/);
    if (m) {
      if (start === -1 && normTr(m[2]).includes(headingNorm)) {
        start = i + 1;
        level = m[1].length;
        continue;
      }
      // Only headings at the same or shallower level end the section —
      // deeper subheadings (e.g. "### per-horse" inside a "##" section) don't.
      if (start !== -1 && i > start && m[1].length <= level) {
        end = i;
        break;
      }
    }
  }
  if (start === -1) return "";
  return lines.slice(start, end).join("\n");
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((c) => /^:?-+:?$/.test(c.trim()));
}

/** Generic markdown table parser: returns header cells + data rows (cells trimmed, bold stripped). */
function parseTable(block: string): { headers: string[]; rows: string[][] } {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.startsWith("|") && l.endsWith("|"));

  const allRows = lines.map((l) =>
    l
      .slice(1, -1)
      .split("|")
      .map((c) => stripMd(c))
  );

  if (allRows.length === 0) return { headers: [], rows: [] };

  const headers = allRows[0];
  const rows = allRows.slice(1).filter((r) => !isSeparatorRow(r));
  return { headers, rows };
}

function colIndex(headers: string[], matcher: (normHeader: string) => boolean): number {
  return headers.findIndex((h) => matcher(normTr(h)));
}

/** "18.06.2026" -> Date, tolerant of surrounding whitespace/placeholder text. */
function parseDotDate(raw: string | undefined): Date | null {
  if (!raw) return null;
  const m = raw.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (!m) return null;
  return new Date(parseInt(m[3], 10), parseInt(m[2], 10) - 1, parseInt(m[1], 10));
}

/** Builds a normalized-name -> runner-no lookup for matching rows across sections. */
function buildNameIndex(runners: ReportRunner[]): Map<string, number> {
  const index = new Map<string, number>();
  for (const r of runners) index.set(normTr(r.name), r.no);
  return index;
}

function resolveRunnerNo(rawCell: string, nameIndex: Map<string, number>): number | null {
  const stripped = stripMd(rawCell);
  const byNoName = parseNoName(stripped);
  if (byNoName) return byNoName.no;
  const direct = nameIndex.get(normTr(stripped));
  if (direct != null) return direct;
  return null;
}

/** "📋 KOŞU KİMLİĞİ" — Alan | Değer two-column table used by the v1.6 report template. */
function parseIdentityTable(block: string): Record<string, string> {
  const { rows } = parseTable(block);
  const map: Record<string, string> = {};
  for (const row of rows) {
    if (row.length >= 2 && row[0]) map[normTr(row[0])] = row[1]?.trim() ?? "";
  }
  return map;
}

function parsePedigreeTable(block: string, nameIndex: Map<string, number>): Map<number, { sire?: string; damSire?: string; pedigreeNote?: string }> {
  const { headers, rows } = parseTable(block);
  const result = new Map<number, { sire?: string; damSire?: string; pedigreeNote?: string }>();
  if (!headers.length) return result;

  const iAt = colIndex(headers, (h) => h === "AT");
  const iBaba = colIndex(headers, (h) => h.includes("BABA"));
  const iDamsire = colIndex(headers, (h) => h.includes("DAMSIRE"));
  const iTier = colIndex(headers, (h) => h.includes("TIER"));
  const iYorum = colIndex(headers, (h) => h.includes("YORUM"));
  if (iAt === -1) return result;

  for (const row of rows) {
    const no = resolveRunnerNo(row[iAt] ?? "", nameIndex);
    if (no == null) continue;
    const sire = iBaba !== -1 ? row[iBaba]?.trim() : undefined;
    const damSire = iDamsire !== -1 ? row[iDamsire]?.trim() : undefined;
    const tier = iTier !== -1 ? row[iTier]?.trim() : "";
    const yorum = iYorum !== -1 ? row[iYorum]?.trim() : "";
    const pedigreeNote = [tier, yorum].filter(Boolean).join(" — ") || undefined;
    result.set(no, { sire: sire || undefined, damSire: damSire || undefined, pedigreeNote });
  }
  return result;
}

function parseEquipmentTable(block: string, nameIndex: Map<string, number>): Map<number, { equipmentAdded?: string; equipmentRemoved?: string; weightChange?: number; sameJockey?: boolean }> {
  const { headers, rows } = parseTable(block);
  const result = new Map<number, { equipmentAdded?: string; equipmentRemoved?: string; weightChange?: number; sameJockey?: boolean }>();
  if (!headers.length) return result;

  const iNo = colIndex(headers, (h) => h === "NO");
  const iAt = colIndex(headers, (h) => h === "AT");
  const iEklenen = colIndex(headers, (h) => h.includes("EKLENEN"));
  const iCikarilan = colIndex(headers, (h) => h.includes("CIKARILAN"));
  const iKilo = colIndex(headers, (h) => h.includes("KILO"));
  const iJokey = colIndex(headers, (h) => h.includes("JOKEY"));

  for (const row of rows) {
    const no = iNo !== -1
      ? parseInt(row[iNo]?.replace(/\D/g, "") ?? "", 10)
      : resolveRunnerNo(row[iAt] ?? "", nameIndex);
    if (no == null || isNaN(no)) continue;

    const equipmentAdded = iEklenen !== -1 ? row[iEklenen]?.trim() : undefined;
    const equipmentRemoved = iCikarilan !== -1 ? row[iCikarilan]?.trim() : undefined;
    const weightChangeRaw = iKilo !== -1 ? row[iKilo]?.replace(",", ".") : undefined;
    const weightChange = weightChangeRaw ? parseFloat(weightChangeRaw) : undefined;
    const sameJockey = iJokey !== -1 ? /^(✓|EVET|X)$/i.test(row[iJokey]?.trim() ?? "") : undefined;

    result.set(no, {
      equipmentAdded: equipmentAdded || undefined,
      equipmentRemoved: equipmentRemoved || undefined,
      // Gerçekçi kilo değişimi ±10kg'ı aşmaz — bunu aşan değerler sütun kaymasına işaret eder.
      weightChange: weightChange != null && !isNaN(weightChange) && Math.abs(weightChange) <= 10 ? weightChange : undefined,
      sameJockey,
    });
  }
  return result;
}

function parseGallopTable(block: string, nameIndex: Map<string, number>): ReportGallop[] {
  const { headers, rows } = parseTable(block);
  if (!headers.length) return [];

  const iAt = colIndex(headers, (h) => h === "AT");
  const iTarih = colIndex(headers, (h) => h.includes("TARIH"));
  const iPist = colIndex(headers, (h) => h === "PIST");
  const iDurum = colIndex(headers, (h) => h.includes("DURUM"));
  if (iAt === -1) return [];

  const splitCols = headers
    .map((h, i) => ({ i, key: stripMd(h) }))
    .filter(({ key }) => /^\d+M$/i.test(key.trim()));

  const gallops: ReportGallop[] = [];
  for (const row of rows) {
    const no = resolveRunnerNo(row[iAt] ?? "", nameIndex);
    if (no == null) continue;

    const splits: Record<string, string> = {};
    for (const { i, key } of splitCols) {
      const v = row[i]?.trim();
      if (v) splits[key] = v;
    }
    if (Object.keys(splits).length === 0) continue;

    gallops.push({
      runnerNo: no,
      date: iTarih !== -1 ? parseDotDate(row[iTarih]) : null,
      track: iPist !== -1 ? row[iPist]?.trim() || undefined : undefined,
      form: iDurum !== -1 ? row[iDurum]?.trim() || undefined : undefined,
      splits,
    });
  }
  return gallops;
}

/**
 * Pulls the analyst's own per-horse reasoning out of each "### 🥇 #1 — At · N PUAN"
 * block in NİHAİ PUANLAMA: both the "Gerekçe: ..." line (why) and "Karar: ..." line
 * (final call) — these are free-text comments the analyst writes per race, since the
 * deciding factors differ from one race to another and can't be reduced to fixed criteria.
 */
function parseNarrativeDecisions(section: string, nameIndex: Map<string, number>): Map<number, string[]> {
  const decisions = new Map<number, string[]>();
  const chunks = section.split(/^###\s+/m).slice(1);

  for (const chunk of chunks) {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);
    if (lines.length < 2) continue;

    // Body line 2 starts with the horse no, e.g. "8 · Baba × Damsire · 57 kg · ..."
    const bodyMatch = lines[1].match(/^\[?(\d+)\]?\s*·/);
    const no = bodyMatch
      ? parseInt(bodyMatch[1], 10)
      : resolveRunnerNo(lines[0].split("—")[1]?.split("·")[0] ?? "", nameIndex);
    if (no == null || isNaN(no)) continue;

    const notes: string[] = [];
    const gerekceLine = lines.find((l) => /^Gerek[çc]e\s*:/i.test(l));
    if (gerekceLine) notes.push(gerekceLine.replace(/^Gerek[çc]e\s*:\s*/i, "").trim());
    const kararLine = lines.find((l) => /^Karar\s*:/i.test(l));
    if (kararLine) notes.push(kararLine.replace(/^Karar\s*:\s*/i, "").trim());
    if (notes.length) decisions.set(no, notes);
  }
  return decisions;
}

/** Appends raw sub-section text under a heading, skipping empty/placeholder-only sections. */
function appendNarrativeSection(parts: string[], text: string, heading: string, label: string) {
  const body = extractSection(text, heading).trim();
  if (body) parts.push(`### ${label}\n${body}`);
}

function parseRunnersTable(block: string): ReportRunner[] {
  const { headers, rows } = parseTable(block);
  if (!headers.length) return [];

  const iNo = colIndex(headers, (h) => h === "NO");
  const iName = colIndex(headers, (h) => h.includes("AT ISMI") || h === "AT");
  const iWeight = colIndex(headers, (h) => h.includes("SIKLET"));
  const iJockey = colIndex(headers, (h) => h.includes("JOKEY"));
  const iAgf = colIndex(headers, (h) => h.includes("AGF"));

  if (iNo === -1 || iName === -1) return [];

  const runners: ReportRunner[] = [];
  for (const row of rows) {
    const no = parseInt(row[iNo]?.replace(/\D/g, "") ?? "", 10);
    const name = row[iName]?.trim();
    if (isNaN(no) || !name) continue;

    const runner: ReportRunner = { no, name };
    if (iWeight !== -1) {
      const w = parseFloat(row[iWeight]?.replace(",", "."));
      if (!isNaN(w)) runner.weight = w;
    }
    if (iJockey !== -1 && row[iJockey]) runner.jockey = row[iJockey].trim();
    if (iAgf !== -1) {
      const a = row[iAgf]?.match(/(\d+(?:[.,]\d+)?)/);
      if (a) runner.agf = parseFloat(a[1].replace(",", "."));
    }
    runners.push(runner);
  }
  return runners;
}

function parseRankingTable(block: string): ReportPick[] {
  const { headers, rows } = parseTable(block);
  if (!headers.length) return [];

  const iRank = colIndex(headers, (h) => h.includes("SIRA"));
  // Bazı raporlarda "Aktif No" (bu koşudaki program/start no'su — bizim Runner.no
  // alanımızla eşleşen değer) ile "TJK No" (TJK'nın kalıcı/genel at kimliği, bizim
  // veritabanımızdaki no ile EŞLEŞMEZ) ayrı sütunlar olarak gelir. Eşleştirme için
  // her zaman Aktif/program No kullanılır, TJK No sadece görüntüleme amaçlıdır.
  const iAktifNo = colIndex(headers, (h) => h.includes("AKTIF") && h.includes("NO"));
  const iPlainNo = colIndex(headers, (h) => h === "NO");
  const iNo = iAktifNo !== -1 ? iAktifNo : iPlainNo;
  const iTjkNo = colIndex(headers, (h) => h.includes("TJK") && h.includes("NO"));
  const iAt = colIndex(headers, (h) => h === "AT");
  // v1.6.1: A/B/C Katmanı + Toplam (100 üzerinden, katman ağırlıklı) — eski tek "Puan" sütununa da uyumlu.
  const iKatmanA = colIndex(headers, (h) => h.includes("A KATMANI"));
  const iKatmanB = colIndex(headers, (h) => h.includes("B KATMANI"));
  const iKatmanC = colIndex(headers, (h) => h.includes("C KATMANI"));
  // Basitleştirilmiş şablon: tek "A" sütunu ve birleşik "B+C" sütunu
  const iSimpleA  = iKatmanA === -1 ? colIndex(headers, (h) => h === "A") : -1;
  const iBplusC   = colIndex(headers, (h) => h.replace(/\s+/g, "") === "B+C");
  const iToplam = colIndex(headers, (h) => h.includes("TOPLAM"));
  const iScore = colIndex(headers, (h) => h.includes("PUAN"));
  const iPed = colIndex(headers, (h) => h.includes("PEDIGRI"));
  const iVeriGuven = colIndex(headers, (h) => h.includes("VERI") && h.includes("GUVEN"));
  const iNote = colIndex(headers, (h) => h.includes("GEREK"));

  if (iAt === -1) return [];

  const picks: ReportPick[] = [];
  rows.forEach((row, idx) => {
    let no: number | null;
    let name: string;
    if (iNo !== -1) {
      no = parseInt(row[iNo]?.replace(/\D/g, "") ?? "", 10);
      name = (row[iAt] ?? "").trim();
    } else {
      const parsed = parseNoName(row[iAt] ?? "");
      if (!parsed) return;
      no = parsed.no;
      name = parsed.name;
    }
    if (no == null || isNaN(no) || !name) return;

    const rank = iRank !== -1 ? parseInt(row[iRank]?.replace(/\D/g, "") ?? "", 10) || idx + 1 : idx + 1;

    const layerNotes: string[] = [];
    if (iKatmanA !== -1 && parseFractionNumerator(row[iKatmanA]) != null) layerNotes.push(`A: ${row[iKatmanA].trim()}`);
    if (iKatmanB !== -1 && parseFractionNumerator(row[iKatmanB]) != null) layerNotes.push(`B: ${row[iKatmanB].trim()}`);
    if (iKatmanC !== -1 && parseFractionNumerator(row[iKatmanC]) != null) layerNotes.push(`C: ${row[iKatmanC].trim()}`);
    // Basitleştirilmiş şablon sütunları
    if (iSimpleA !== -1) { const v = (row[iSimpleA] ?? "").trim(); if (v && v !== "—" && !/^X+$/i.test(v)) layerNotes.push(`A: ${v}`); }
    if (iBplusC  !== -1) { const v = (row[iBplusC]  ?? "").trim(); if (v && v !== "—" && !/^Y+$/i.test(v)) layerNotes.push(`B+C: ${v}`); }
    if (iVeriGuven !== -1) { const v = (row[iVeriGuven] ?? "").trim(); if (v && v !== "—") layerNotes.push(`VG: ${v}`); }

    const toplaRaw = row[iToplam] ?? "";
    const toplam = iToplam !== -1
      ? parseFractionNumerator(toplaRaw) ?? (parseInt(toplaRaw.replace(/[^\d]/g, ""), 10) || null)
      : null;
    const legacyScore = iScore !== -1 ? parseInt(row[iScore]?.replace(/\D/g, "") ?? "", 10) : NaN;
    const score = toplam != null ? Math.round(toplam) : (isNaN(legacyScore) ? null : legacyScore);

    const pedRaw = iPed !== -1 ? row[iPed] ?? "" : "";
    const stars = countStars(pedRaw);
    const pedigreeRating = stars > 0 ? mapStarPedigree(stars) : iPed !== -1 ? mapPedigree(pedRaw) : "BILINMIYOR";

    const note = iNote !== -1 ? row[iNote]?.trim() : "";
    const tjkNoRaw = iTjkNo !== -1 ? parseInt(row[iTjkNo]?.replace(/\D/g, "") ?? "", 10) : NaN;
    picks.push({
      rank,
      no,
      ...(!isNaN(tjkNoRaw) ? { tjkNo: tjkNoRaw } : {}),
      name,
      score,
      pedigreeRating,
      details: [...layerNotes, ...(note ? [note] : [])],
    });
  });
  return picks.sort((a, b) => a.rank - b.rank);
}

/** Enriches picks with the richer bullet-table reasoning from "## NİHAİ PUANLAMA". */
function parseDetailedScoring(section: string): Map<number, string[]> {
  const detailsByNo = new Map<number, string[]>();
  const chunks = section.split(/^###\s+/m).slice(1);

  for (const chunk of chunks) {
    const lines = chunk.split("\n");
    const headingMatch = stripMd(lines[0]).match(/^\d+\.\s*(\d+)\s+/);
    if (!headingMatch) continue;
    const no = parseInt(headingMatch[1], 10);

    const tableLines = lines.filter((l) => l.trim().startsWith("|") && l.trim().endsWith("|"));
    const rows = tableLines
      .map((l) =>
        l
          .trim()
          .slice(1, -1)
          .split("|")
          .map((c) => stripMd(c))
      )
      .filter((cells) => !isSeparatorRow(cells) && cells[0] !== "#");

    const details = rows.map((cells) => cells[cells.length - 1]).filter(Boolean);
    if (details.length) detailsByNo.set(no, details);
  }
  return detailsByNo;
}

function parseCouponTable(block: string): {
  narrow: string | null;
  normal: string | null;
  wide: string | null;
  isBanko: boolean;
  bankoNote: string | null;
} {
  const { rows } = parseTable(block);
  let narrow: string | null = null;
  let normal: string | null = null;
  let wide: string | null = null;
  let isBanko = false;
  let bankoNote: string | null = null;

  for (const row of rows) {
    if (row.length < 2) continue;
    const label = normTr(row[0]);
    const value = row[1]?.trim();
    if (label.includes("DAR")) narrow = value || null;
    else if (label.includes("NORMAL")) normal = value || null;
    else if (label.includes("GENIS")) wide = value || null;
    else if (label.includes("BANKO")) {
      if (value && !normTr(value).includes("YOK")) {
        isBanko = true;
        bankoNote = value;
      }
    }
  }
  return { narrow, normal, wide, isBanko, bankoNote };
}

export function parseFullReport(markdown: string): ParsedReport {
  const text = markdown.replace(/\r\n/g, "\n");

  // Header metadata: **Tarih:** 18.06.2026 · **Hipodrom:** Ankara · **Koşu:** 1. Koşu 14.30
  const labeled: Record<string, string> = {};
  const labelRe = /\*\*([^*]+?):\*\*\s*([^\n·]+?)(?=\s*(?:·|\n|$))/g;
  let lm: RegExpExecArray | null;
  while ((lm = labelRe.exec(text))) {
    const key = normTr(lm[1]);
    if (!(key in labeled)) labeled[key] = lm[2].trim();
  }

  // v1.6 template header: "## 📋 KOŞU KİMLİĞİ" Alan | Değer table — merged in as a fallback
  // so both the legacy inline-label format and the new table format work.
  const identity = parseIdentityTable(extractSection(text, "KOSU KIMLIGI"));
  if (identity["TARIH"] && !labeled["TARIH"]) labeled["TARIH"] = identity["TARIH"];
  if (identity["HIPODROM"] && !labeled["HIPODROM"]) labeled["HIPODROM"] = identity["HIPODROM"];
  if (identity["KOSU NO / SAAT"] && !labeled["KOSU"]) labeled["KOSU"] = identity["KOSU NO / SAAT"];
  if (identity["GUVEN SEVIYESI"] && !labeled["GUVEN"]) labeled["GUVEN"] = identity["GUVEN SEVIYESI"];

  const date = parseDotDate(labeled["TARIH"]);
  const hippodrome = labeled["HIPODROM"] ?? null;

  let raceNo: number | null = null;
  let raceTime: string | null = null;
  const kosuStr = labeled["KOSU"];
  if (kosuStr) {
    const m = kosuStr.match(/(\d+)\.\s*Ko[şs]u\s*[·:.\s-]*(\d{1,2}[.:]\d{2})?/i);
    if (m) {
      raceNo = parseInt(m[1], 10);
      if (m[2]) raceTime = m[2].replace(".", ":");
    }
  }

  const confidence = mapConfidence(labeled["GUVEN"] ?? "");

  // KOŞU BİLGİSİ (legacy) / KOŞU KİMLİĞİ (v1.6) table — both feed the same field set
  const infoSection = extractSection(text, "KOSU BILGISI");
  const { rows: infoRows } = parseTable(infoSection);
  const infoMap: Record<string, string> = { ...identity };
  for (const row of infoRows) {
    if (row.length >= 2) infoMap[normTr(row[0])] = row[1].trim();
  }
  const classType = infoMap["SINIF"] ?? null;
  const breed = infoMap["CINS"] ? mapBreed(infoMap["CINS"]) : null;
  const distance = infoMap["MESAFE"] ? parseInt(infoMap["MESAFE"].replace(/\D/g, ""), 10) || null : null;
  const surface = infoMap["PIST"] ? mapSurface(infoMap["PIST"]) : null;

  // GENEL PROGRAM table
  const runners = parseRunnersTable(extractSection(text, "GENEL PROGRAM"));
  const nameIndex = buildNameIndex(runners);

  // Enrich runners with PEDİGRİ ANALİZİ / TAKI DEĞİŞİKLİĞİ tables (v1.6 template sections)
  const pedigreeByNo = parsePedigreeTable(extractSection(text, "PEDIGRI ANALIZI"), nameIndex);
  const equipmentByNo = parseEquipmentTable(extractSection(text, "TAKI DEGISIKLIGI"), nameIndex);
  for (const r of runners) {
    const ped = pedigreeByNo.get(r.no);
    if (ped) Object.assign(r, ped);
    const eq = equipmentByNo.get(r.no);
    if (eq) Object.assign(r, eq);
  }

  // İDMAN / GALOP table -> Gallop records
  const gallops = parseGallopTable(extractSection(text, "IDMAN / GALOP") || extractSection(text, "GALOP"), nameIndex);

  // NİHAİ SIRALAMA / NİHAİ SIRALAMA ÖZET table (+ richer NİHAİ PUANLAMA detail enrichment)
  // Başlık satırı olmadan sadece tablonun kendisi yapıştırılmış olabilir — bu durumda
  // extractSection boş döner, tüm metni tarayarak tabloyu yine de bulmaya çalış.
  const picks = parseRankingTable(extractSection(text, "NIHAI SIRALAMA") || text);
  const puanlamaSection = extractSection(text, "NIHAI PUANLAMA");
  const detailsByNo = parseDetailedScoring(puanlamaSection);
  const decisionsByNo = parseNarrativeDecisions(puanlamaSection, nameIndex);
  for (const pick of picks) {
    const rich = detailsByNo.get(pick.no);
    if (rich?.length) pick.details = rich;
    const decision = decisionsByNo.get(pick.no);
    if (decision?.length) pick.details = [...pick.details, ...decision];
    // Summary table's "Pedigri" cell is often a bare "Tier-N" shorthand; fall
    // back to the fuller PEDİGRİ ANALİZİ row (e.g. "Tier-1 ÇOK GÜÇLÜ — ...") when unresolved.
    if (pick.pedigreeRating === "BILINMIYOR") {
      const note = pedigreeByNo.get(pick.no)?.pedigreeNote;
      if (note) pick.pedigreeRating = mapPedigree(note);
    }
  }

  // Tempo: legacy "**Tempo:** ..." inline label, anywhere in the document
  const tempoMatch = text.match(/\*\*Tempo:\*\*\s*([^\n]+)/i);
  const tempo = tempoMatch ? tempoMatch[1].trim() : null;

  // Kupon table — bazı raporlarda kupon numaraları "TJK No" ile yazılır ama bizim
  // Runner.no alanımız "Aktif No"; NİHAİ SIRALAMA'dan çıkardığımız eşlemeyle çeviriyoruz.
  const tjkToAktif = new Map<number, number>();
  for (const p of picks) if (p.tjkNo != null) tjkToAktif.set(p.tjkNo, p.no);

  function translateCouponNumbers(value: string | null): string | null {
    if (!value || tjkToAktif.size === 0) return value;
    return value.replace(/\d+/g, (m) => String(tjkToAktif.get(parseInt(m, 10)) ?? m));
  }

  const couponSection = extractSection(text, "KUPON");
  const rawCoupon = parseCouponTable(couponSection);
  const coupon = {
    ...rawCoupon,
    narrow: translateCouponNumbers(rawCoupon.narrow),
    normal: translateCouponNumbers(rawCoupon.normal),
    wide: translateCouponNumbers(rawCoupon.wide),
  };

  // "Banko neden yok: ..." line, plus the v1.6 template's narrative sections —
  // none of these have a dedicated DB column, so they're folded into notes for
  // full transparency without requiring a schema change.
  const bankoReasonMatch = text.match(/Banko neden yok[^:]*:\*?\*?\s*([^\n]+)/i);
  const noteParts: string[] = [];
  if (bankoReasonMatch) noteParts.push(bankoReasonMatch[1].trim());
  appendNarrativeSection(noteParts, text, "EXACT PIST + MESAFE SICILI", "Exact Pist + Mesafe Sicili");
  appendNarrativeSection(noteParts, text, "GORELI KILO", "Göreli Kilo");
  appendNarrativeSection(noteParts, text, "TEMPO ANALIZI", "Tempo Analizi");
  appendNarrativeSection(noteParts, text, "JOKEY FORMU", "Jokey Formu");
  appendNarrativeSection(noteParts, text, "METODOLOJI KONTROL LISTESI", "v1.6 Kontrol Listesi");
  appendNarrativeSection(noteParts, text, "CEKIRDEK DISI ATLAR", "Çekirdek Dışı Atlar");
  const notes = noteParts.length ? noteParts.join("\n\n") : null;

  return {
    date,
    hippodrome,
    raceNo,
    raceTime,
    confidence,
    classType,
    breed,
    distance,
    surface,
    runners,
    picks,
    gallops,
    tempo,
    couponNarrow: coupon.narrow,
    couponNormal: coupon.normal,
    couponWide: coupon.wide,
    isBanko: coupon.isBanko,
    bankoNote: coupon.bankoNote,
    notes,
  };
}

/** Heuristic: does this markdown look like a full ROTAGANYAN report (vs. a simple runner table)? */
export function isFullReport(markdown: string): boolean {
  const n = normTr(markdown);
  return (
    n.includes("NIHAI SIRALAMA") ||
    n.includes("ROTAGANYAN ANALIZ RAPORU") ||
    n.includes("KOSU KIMLIGI") ||
    n.includes("METODOLOJI KONTROL LISTESI") ||
    // Başlık/bölüm satırı olmadan sadece v1.8 sıralama tablosu yapıştırılmış olabilir —
    // bu tablonun kendine özgü kolon başlıkları da tam rapor olarak tanınmalı.
    (n.includes("A KATMANI") && n.includes("KILIT GEREKCE")) ||
    // Basitleştirilmiş "Nihai Sıralama Şablonu" (Sıra | No | At | A | B+C | Toplam | Veri Güven | Kilit Gerekçe)
    (n.includes("VERI GUVEN") && n.includes("KILIT GEREKCE"))
  );
}
