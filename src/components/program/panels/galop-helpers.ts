import type { ProgramGallop } from "@/server/services/race.service";

// Galop — en derin mesafe + 400m ve 200m finiş
const GALOP_PREP_DISTS = ["1600", "1400", "1200", "1000", "800", "600"] as const;
export function galopSplits(g: ProgramGallop): { prepDist: string | null; prepTime: string | null; finish: string | null; final200: string | null } {
  const prepDist = GALOP_PREP_DISTS.find((d) => g.splits[d]) ?? null;
  return {
    prepDist,
    prepTime: prepDist ? (g.splits[prepDist] ?? null) : null,
    finish: g.splits["400"] ?? null,
    final200: g.splits["200"] ?? null,
  };
}

export function galopDate(g: ProgramGallop): string {
  const d = new Date(g.date);
  return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

// İdman (galop) jokeyi, koşuda binecek jokeyle aynı kişi mi? — soyada göre karşılaştırma
// (galop kaydı "D.SAV" gibi kısaltılmış, koşu kaydı "DENİZ SAV" gibi tam olabilir)
function normTr(s: string): string {
  return s.toUpperCase()
    .replace(/İ/g, "I").replace(/Ğ/g, "G").replace(/Ü/g, "U")
    .replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/\s+/g, " ").trim();
}
function jockeySurname(name: string): string {
  return normTr(name).split(/[\s.]+/).filter(Boolean).at(-1) ?? normTr(name);
}
export function isSameJockey(galopJockey: string | null, raceJockey: string | null): boolean {
  if (!galopJockey || !raceJockey) return false;
  return jockeySurname(galopJockey) === jockeySurname(raceJockey);
}

// Galop kalite renklendirmesi
const GALOP_BENCHMARKS: Record<string, Record<string, { iyi: number; cokIyi: number }>> = {
  INGILIZ: {
    "400": { cokIyi: 23, iyi: 26 },
    "600": { cokIyi: 35, iyi: 38 },
    "800": { cokIyi: 46, iyi: 50 },
    "1000": { cokIyi: 61, iyi: 63 },
  },
  ARAP: {
    "400": { cokIyi: 25, iyi: 28 },
    "600": { cokIyi: 39, iyi: 42 },
    "800": { cokIyi: 52, iyi: 56 },
    "1000": { cokIyi: 66, iyi: 70 },
  },
};

// TJK zaman formatı "dk.sn.yüzdeSn" (örn. "0.25.40" = 0dk 25.40sn) — 3. segment
// yüzde saniye (centisecond), decisecond DEĞİL; bkz. veri-toplama.ts parseSaniye
// yorumu (481 gerçek galop kaydıyla doğrulandı).
function parseGalopSec(t: string | null): number | null {
  if (!t) return null;
  const p = t.split(".");
  if (p.length === 2) return parseFloat(t) || null;
  if (p.length === 3) {
    const [m, s, d] = p;
    return (parseInt(m!) || 0) * 60 + parseFloat(`${s}.${d}`);
  }
  return null;
}

type GalopQuality = "iyi" | "cok_iyi";
export function galopQuality(dist: string, timeStr: string | null, breed: string, isInner: boolean): GalopQuality | null {
  const secs = parseGalopSec(timeStr);
  if (secs === null) return null;
  const adjusted = isInner ? secs - 1.0 : secs;
  const b = GALOP_BENCHMARKS[breed === "ARAP" ? "ARAP" : "INGILIZ"]?.[dist];
  if (!b) return null;
  if (adjusted <= b.cokIyi) return "cok_iyi";
  if (adjusted <= b.iyi) return "iyi";
  return null;
}

export function galopTimeClass(q: GalopQuality | null): string {
  if (q === "cok_iyi") return "text-green-400 font-bold";
  if (q === "iyi") return "text-emerald-500 dark:text-emerald-400";
  return "";
}
