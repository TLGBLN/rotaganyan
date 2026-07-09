import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

type JokeyJson = {
  meta: {
    year: number;
    breed: string;
    city: string;
    track: string;
    title?: string;
  };
  jockeys: Array<{
    jockey: string;
    starts: number;
    first: number;
    second: number;
    third: number;
    fourth: number;
    fifth: number;
    tableCount: number;
    winRate: number;
    tableRate: number;
    prizeTl: number;
    performanceScore?: number;
    confidenceLabel?: string;
  }>;
};

const CITY_SLUG: Record<string, string> = {
  "ankara": "ankara",
  "istanbul": "istanbul",
  "İstanbul": "istanbul",
  "bursa": "bursa",
  "izmir": "izmir",
  "İzmir": "izmir",
  "adana": "adana",
  "elazig": "elazig",
  "elaziğ": "elazig",
  "Elazığ": "elazig",
  "kocaeli": "kocaeli",
  "sanliurfa": "sanliurfa",
  "Şanlıurfa": "sanliurfa",
  "konya": "konya",
  "diyarbakir": "diyarbakir",
  "Diyarbakır": "diyarbakir",
  "sakarya": "sakarya",
  "balikesir": "balikesir",
  "Balıkesir": "balikesir",
};

function toSlug(city: string): string {
  const lower = city.toLowerCase()
    .replace(/i̇/g, "i").replace(/ı/g, "i")
    .replace(/ğ/g, "g").replace(/ü/g, "u")
    .replace(/ş/g, "s").replace(/ö/g, "o")
    .replace(/ç/g, "c").replace(/â/g, "a")
    .replace(/\s+/g, "-");
  return CITY_SLUG[city] ?? CITY_SLUG[lower] ?? lower;
}

function toBreed(breed: string): string {
  return breed.toLowerCase().includes("arap") ? "ARAP" : "INGILIZ";
}

function toSurface(track: string): string {
  const t = track.toLowerCase();
  if (t.includes("çim") || t.includes("cim")) return "CIM";
  if (t.includes("sentet")) return "SENTETIK";
  return "KUM";
}

// Türkçe karakter normalize + büyük harf
function normName(s: string): string {
  return s.toUpperCase()
    .replace(/İ/g, "I").replace(/Ğ/g, "G").replace(/Ü/g, "U")
    .replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C")
    .replace(/\s+/g, " ").trim();
}

// Son token (soyad): "V.ABİŞ" → "ABIS", "VEDAT ABİŞ" → "ABIS"
function surname(normN: string): string {
  return normN.split(/[\s.]+/).filter(Boolean).at(-1) ?? normN;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !hasRole(session.user.role as Role, "EDITOR")) {
    return NextResponse.json({ error: "Yetkisiz" }, { status: 401 });
  }

  let body: JokeyJson;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON" }, { status: 400 });
  }

  const { meta, jockeys } = body;
  if (!meta?.city || !Array.isArray(jockeys)) {
    return NextResponse.json({ error: "Eksik alan: meta.city veya jockeys" }, { status: 400 });
  }

  const hippoSlug = toSlug(meta.city);
  const breed = meta.breed ? toBreed(meta.breed) : null;
  const surface = meta.track ? toSurface(meta.track) : null;
  const year = meta.year ?? new Date().getFullYear();

  // Yarış programlarından bu hipodrom/pist/ırk için bilinen jokey isimlerini çek
  const since = new Date(`${year}-01-01T00:00:00Z`);
  const knownRunners = await db.runner.findMany({
    where: {
      jockey: { not: null },
      race: {
        ...(surface ? { surface: surface as "CIM" | "KUM" | "SENTETIK" } : {}),
        ...(breed ? { breed: breed as "INGILIZ" | "ARAP" } : {}),
        raceDay: {
          date: { gte: since },
          hippodrome: { slug: hippoSlug },
        },
      },
    },
    select: { jockey: true },
    distinct: ["jockey"],
  });

  // normalize → canonical, soyad → canonical (iki seviyeli eşleştirme)
  const canonicalMap = new Map<string, string>();   // tam norm → canonical
  const surnameMap = new Map<string, string>();     // soyad → canonical
  for (const r of knownRunners) {
    if (!r.jockey) continue;
    const n = normName(r.jockey);
    canonicalMap.set(n, r.jockey);
    const sur = surname(n);
    if (!surnameMap.has(sur)) surnameMap.set(sur, r.jockey);
  }

  function resolveCanonical(jsonName: string): string | undefined {
    const n = normName(jsonName);
    return canonicalMap.get(n) ?? surnameMap.get(surname(n));
  }

  let upserted = 0;
  const unmatched: string[] = [];

  for (const j of jockeys) {
    const canonical = resolveCanonical(j.jockey);
    const jockeyName = canonical ?? j.jockey;
    if (!canonical) unmatched.push(j.jockey);

    await db.jockeyStatSync.upsert({
      where: {
        jockey_hippoSlug_year_breed_surface: {
          jockey: jockeyName,
          hippoSlug,
          year,
          breed: breed ?? "",
          surface: surface ?? "",
        },
      },
      update: {
        rides: j.starts,
        wins: j.first,
        place2: j.second,
        place3: j.third,
        place4: j.fourth,
        place5: j.fifth,
        tableCount: j.tableCount,
        winRate: j.winRate,
        tableRate: j.tableRate,
        prizeTl: Math.round(j.prizeTl),
        performanceScore: j.performanceScore ?? null,
        confidenceLabel: j.confidenceLabel ?? null,
      },
      create: {
        jockey: jockeyName,
        hippoSlug,
        year,
        breed: breed ?? "",
        surface: surface ?? "",
        rides: j.starts,
        wins: j.first,
        place2: j.second,
        place3: j.third,
        place4: j.fourth,
        place5: j.fifth,
        tableCount: j.tableCount,
        winRate: j.winRate,
        tableRate: j.tableRate,
        prizeTl: Math.round(j.prizeTl),
        performanceScore: j.performanceScore ?? null,
        confidenceLabel: j.confidenceLabel ?? null,
      },
    });
    upserted++;
  }

  return NextResponse.json({
    ok: true,
    upserted,
    matched: upserted - unmatched.length,
    unmatched: unmatched.length,
    unmatchedNames: unmatched.slice(0, 20),
    hippoSlug,
    breed,
    surface,
    year,
    title: meta.title ?? `${year} ${meta.city}`,
  });
}
