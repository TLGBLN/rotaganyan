import { db } from "@/lib/db";
import { startOfDay } from "date-fns";
import type { Surface, Breed, Confidence, PedigreeRating } from "@prisma/client";

// ─── JSON input type ───────────────────────────────────────────────────────────

export interface AnalysisItem {
  id?: number;
  tarih: string;          // "2026-06-14"
  hipo: string;           // "Istanbul"
  yaris: string;          // "Handikap 16/DHÖW/H2 4Y Araplar 1400m Kum (1.Koşu 14.30)"
  sinif: string;          // "Handikap" | "Sartli-1" | "KV" | "Grup"
  pist: string;           // "Kum" | "Cim" | "Sentetik"
  mes: string;            // "1400"
  pd?: string;
  yg?: string;            // "4Y Arap" | "3+ İng."
  kacak?: string;
  t1: string;             // "8 TEYAR"
  t2?: string;
  t3?: string;
  t4?: string;
  t5?: string;
  t6?: string;
  guven?: string;         // "Orta" | "Yuksek" | "Dusuk"
  notlar?: string;
  sonuc?: string;         // "Kazandi" | "Kismen" | ""
  gercek?: string;        // "8 MARİSCAL"
  g2?: string;
  g3?: string;
  g4?: string;
  g5?: string;
  hata?: string;          // "Evet" | ""
  hatanot?: string;
  mscores?: Record<string, { puan?: number; detay?: string[] }>;
  ped?: Record<string, string>;
  cikan?: string;
}

export interface ImportResult {
  id: number | string;
  label: string;
  ok: boolean;
  predictionId?: string;
  error?: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/ı/g, "i").replace(/İ/g, "i")
    .replace(/ğ/g, "g").replace(/Ğ/g, "g")
    .replace(/ü/g, "u").replace(/Ü/g, "u")
    .replace(/ş/g, "s").replace(/Ş/g, "s")
    .replace(/ö/g, "o").replace(/Ö/g, "o")
    .replace(/ç/g, "c").replace(/Ç/g, "c")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseSurface(pist: string): Surface {
  const m: Record<string, Surface> = { Kum: "KUM", Cim: "CIM", Sentetik: "SENTETIK" };
  return m[pist] ?? "CIM";
}

function parseBreed(yg: string = "", yaris: string = ""): Breed {
  const text = `${yg} ${yaris}`.toLowerCase();
  if (text.includes("arap")) return "ARAP";
  return "INGILIZ";
}

function parseClassType(sinif: string, yaris: string): string {
  if (sinif === "Sartli-1") return "Şartlı 1";
  if (sinif === "Sartli-2") return "Şartlı 2";
  if (sinif === "Sartli-3") return "Şartlı 3";
  if (sinif === "Sartli-4") return "Şartlı 4";
  if (sinif === "Sartli-5") return "Şartlı 5";
  if (sinif === "Grup") {
    const m = yaris.match(/\bG(\d)\b/);
    return m ? `G${m[1]}` : "Grup";
  }
  return sinif; // "Handikap", "KV", etc.
}

function extractRaceNo(yaris: string): number {
  const m = yaris.match(/\((\d+)[.\s]?Ko[şs]u/i);
  return m ? parseInt(m[1]) : 1;
}

function extractRaceTime(yaris: string): string | null {
  const m = yaris.match(/(\d{1,2}[.:]\d{2})\)/);
  return m ? m[1].replace(".", ":") : null;
}

function parseConfidence(guven: string = ""): Confidence {
  if (guven === "Yuksek") return "YUKSEK";
  if (guven === "Dusuk") return "DUSUK";
  return "ORTA";
}

function parsePedRating(v: string = ""): PedigreeRating {
  const m: Record<string, PedigreeRating> = {
    CokYuksek: "COK_YUKSEK",
    Yuksek: "YUKSEK",
    Guclu: "GUCLU",
    Orta: "ORTA",
    Dusuk: "DUSUK",
    Zayif: "ZAYIF",
  };
  return m[v] ?? "BILINMIYOR";
}

function extractCoupons(notlar: string = "") {
  const narrow = notlar.match(/(?:^|\n)Dar:\s*([^\n]+)/im)?.[1]?.trim() ?? null;
  const normal = notlar.match(/(?:^|\n)Normal:\s*([^\n]+)/im)?.[1]?.trim() ?? null;
  const wide = notlar.match(/(?:^|\n)Geni[şs]:\s*([^\n]+)/im)?.[1]?.trim() ?? null;
  return { narrow, normal, wide };
}

function extractBanko(notlar: string = "") {
  const line = notlar.match(/(?:^|\n)BANKO:\s*([^\n]+)/im)?.[1]?.trim() ?? "";
  if (!line || line.toUpperCase().includes("YOK")) return { isBanko: false, note: null };
  return { isBanko: true, note: line };
}

function parsePickLabel(raw: string): { no: number; name: string } | null {
  if (!raw) return null;
  const m = raw.match(/^(\d+)\s+(.+)$/);
  if (!m) return null;
  return { no: parseInt(m[1]), name: m[2].trim() };
}

// ─── main importer ────────────────────────────────────────────────────────────

export async function importAnalyses(
  items: AnalysisItem[],
  adminUserId: string
): Promise<ImportResult[]> {
  const results: ImportResult[] = [];

  for (const item of items) {
    const label = `${item.tarih} ${item.hipo} ${item.yaris.slice(0, 40)}`;
    try {
      const predictionId = await importSingle(item, adminUserId);
      results.push({ id: item.id ?? label, label, ok: true, predictionId });
    } catch (err) {
      results.push({ id: item.id ?? label, label, ok: false, error: String(err) });
    }
  }

  return results;
}

async function importSingle(item: AnalysisItem, adminUserId: string): Promise<string> {
  const date = startOfDay(new Date(item.tarih));

  // 1. Hippodrome
  const hipoName = item.hipo.trim();
  const hippodrome = await db.hippodrome.upsert({
    where: { name: hipoName },
    create: { name: hipoName, slug: slugify(hipoName) },
    update: {},
  });

  // 2. RaceDay
  const raceDay = await db.raceDay.upsert({
    where: { date_hippodromeId: { date, hippodromeId: hippodrome.id } },
    create: { date, hippodromeId: hippodrome.id },
    update: {},
  });

  // 3. Race
  const raceNo = extractRaceNo(item.yaris);
  const surface = parseSurface(item.pist);
  const breed = parseBreed(item.yg, item.yaris);
  const distance = parseInt(item.mes) || 1400;
  const classType = parseClassType(item.sinif, item.yaris);
  const time = extractRaceTime(item.yaris);

  const race = await db.race.upsert({
    where: { raceDayId_raceNo: { raceDayId: raceDay.id, raceNo } },
    create: { raceDayId: raceDay.id, raceNo, classType, breed, surface, distance, time },
    update: { classType, breed, surface, distance, time },
  });

  // 4. Picks data
  const pickFields = ["t1", "t2", "t3", "t4", "t5", "t6"] as const;
  const parsedPicks = pickFields
    .map((f, i) => {
      const raw = item[f];
      if (!raw) return null;
      const parsed = parsePickLabel(raw);
      if (!parsed) return null;
      const scoreKey = `t${i + 1}`;
      const scoreData = item.mscores?.[scoreKey];
      const pedValue = item.ped?.[scoreKey] ?? "";
      return {
        rank: i + 1,
        no: parsed.no,
        name: parsed.name,
        runnerLabel: raw.trim(),
        score: scoreData?.puan ?? null,
        details: { detay: scoreData?.detay ?? [] } as object,
        pedigreeRating: parsePedRating(pedValue),
      };
    })
    .filter(Boolean) as NonNullable<ReturnType<typeof parsePickLabel> & {
      rank: number; no: number; name: string; runnerLabel: string;
      score: number | null; details: object; pedigreeRating: PedigreeRating;
    }>[];

  // 5. Ensure runners exist (upsert by no)
  const runnerIds: Record<number, string> = {};
  for (const pick of parsedPicks) {
    const runner = await db.runner.upsert({
      where: { raceId_no: { raceId: race.id, no: pick.no } },
      create: { raceId: race.id, no: pick.no, name: pick.name },
      update: {},
    });
    runnerIds[pick.no] = runner.id;
  }

  // 6. Coupons + banko
  const { narrow, normal, wide } = extractCoupons(item.notlar);
  const { isBanko, note: bankoNote } = extractBanko(item.notlar);

  // 7. Prediction upsert
  const prediction = await db.prediction.upsert({
    where: { raceId: race.id },
    create: {
      raceId: race.id,
      authorId: adminUserId,
      confidence: parseConfidence(item.guven),
      notes: item.notlar ?? "",
      tempo: item.kacak || null,
      couponNarrow: narrow,
      couponNormal: normal,
      couponWide: wide,
      isBanko,
      bankoNote,
      published: true,
      publishedAt: date,
    },
    update: {
      confidence: parseConfidence(item.guven),
      notes: item.notlar ?? "",
      tempo: item.kacak || null,
      couponNarrow: narrow,
      couponNormal: normal,
      couponWide: wide,
      isBanko,
      bankoNote,
      published: true,
      publishedAt: date,
    },
  });

  // 8. Picks (delete + recreate to keep clean)
  await db.pick.deleteMany({ where: { predictionId: prediction.id } });
  for (const pick of parsedPicks) {
    await db.pick.create({
      data: {
        predictionId: prediction.id,
        rank: pick.rank,
        runnerId: runnerIds[pick.no] ?? null,
        runnerLabel: pick.runnerLabel,
        score: pick.score,
        details: pick.details,
        pedigreeRating: pick.pedigreeRating,
      },
    });
  }

  // 9. Result (if outcome is known)
  if (item.sonuc && item.gercek) {
    const winnerNoMatch = item.gercek.match(/^(\d+)/);
    const winnerNo = winnerNoMatch ? parseInt(winnerNoMatch[1]) : null;
    const hitTop1 = item.sonuc === "Kazandi";
    const hitInCoupon = item.sonuc === "Kazandi" || item.sonuc === "Kismen";
    const actualOrder = [item.gercek, item.g2, item.g3, item.g4, item.g5]
      .filter((x): x is string => Boolean(x));

    await db.result.upsert({
      where: { raceId: race.id },
      create: {
        raceId: race.id,
        actualOrder,
        winnerNo,
        hitTop1,
        hitInCoupon,
        errorTag: item.hata === "Evet" ? "HATA" : null,
        errorNote: item.hatanot || null,
        cikan: item.cikan || null,
      },
      update: {
        actualOrder,
        winnerNo,
        hitTop1,
        hitInCoupon,
        errorTag: item.hata === "Evet" ? "HATA" : null,
        errorNote: item.hatanot || null,
        cikan: item.cikan || null,
      },
    });
  }

  return prediction.id;
}
