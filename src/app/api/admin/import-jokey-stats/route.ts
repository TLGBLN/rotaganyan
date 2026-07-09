import { NextRequest, NextResponse } from "next/server";
import { auth, hasRole } from "@/lib/auth";
import { db } from "@/lib/db";
import type { Role } from "@prisma/client";

// JSON formatı: { meta: { year, breed, city, track }, jockeys: [...] }
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

  let upserted = 0;
  for (const j of jockeys) {
    await db.jockeyStatSync.upsert({
      where: {
        jockey_hippoSlug_year_breed_surface: {
          jockey: j.jockey,
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
        jockey: j.jockey,
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
    hippoSlug,
    breed,
    surface,
    year,
    title: meta.title ?? `${year} ${meta.city}`,
  });
}
