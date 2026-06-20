/**
 * TJK Info/Sehir scraper — uses SehirId-based URLs, returns full runner details.
 * URL format: /TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=7&QueryParameter_Tarih=DD/MM/YYYY
 */

import { request } from "undici";
import * as cheerio from "cheerio";
import type { IngestRaceDay, IngestRace, IngestRunner } from "./types";
import type { Breed, Surface } from "@prisma/client";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

// Keywords that indicate a foreign venue
const FOREIGN_KW = [
  "ABD", "Arjantin", "Krallık", "Afrika", "Fransa", "Almanya", "İtalya",
  "Japonya", "Avustralya", "Kanada", "BAE", "Bahreyn", "İrlanda",
  "Singapur", "Birleşik", "Belçika", "Hong", "Guney", "Güney",
  "Kuzey", "Ukrayna", "Rusya", "Çin", "Polonya", "İsveç", "Park ABD",
  "Park UK", "Racecourse", "Downs",
];

function isTurkish(sehirAdi: string): boolean {
  return !FOREIGN_KW.some((kw) => sehirAdi.includes(kw));
}

export function toSlug(name: string): string {
  return name
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseSurface(text: string): Surface {
  const t = text.toLowerCase();
  if (t.includes("çim") || t.includes("cim") || t.includes("grass")) return "CIM";
  if (t.includes("sentet")) return "SENTETIK";
  return "KUM";
}

function parseBreed(text: string): Breed {
  return text.toUpperCase().includes("ARAP") ? "ARAP" : "INGILIZ";
}

// Convert "DD/MM/YYYY" ↔ Date
function parseDate(ddmmyyyy: string): Date {
  const [d, m, y] = ddmmyyyy.split("/");
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);
}

export function toTjkDate(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

// ── 1. Discover Turkish city tabs for a given date ──────────────────────────

export type CityInfo = { sehirId: number; sehirAdi: string };

export async function discoverTurkishCities(tjkDate: string): Promise<CityInfo[]> {
  const url = `${BASE}/TR/YarisSever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=${encodeURIComponent(tjkDate)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const cities: CityInfo[] = [];
  const seen = new Set<number>();

  $("ul.gunluk-tabs li a[data-sehir-id]").each((_, el) => {
    const sehirId = parseInt($(el).attr("data-sehir-id") ?? "0", 10);
    if (!sehirId || seen.has(sehirId)) return;

    const href = $(el).attr("href") ?? "";
    const m = href.match(/SehirAdi=([^&]+)/);
    const sehirAdi = m
      ? decodeURIComponent(m[1].replace(/\+/g, " "))
      : $(el).text().replace(/\(.*?\)/, "").trim();

    if (isTurkish(sehirAdi)) {
      seen.add(sehirId);
      cities.push({ sehirId, sehirAdi: sehirAdi.trim() });
    }
  });

  return cities;
}

// ── 2. Fetch & parse one city's race program ────────────────────────────────

export async function fetchCityProgram(
  city: CityInfo,
  tjkDate: string
): Promise<IngestRaceDay | null> {
  const url =
    `${BASE}/TR/YarisSever/Info/Sehir/GunlukYarisProgrami` +
    `?SehirId=${city.sehirId}` +
    `&QueryParameter_Tarih=${encodeURIComponent(tjkDate)}` +
    `&SehirAdi=${encodeURIComponent(city.sehirAdi)}` +
    `&Era=today`;

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch {
    return null;
  }

  const $ = cheerio.load(html);

  // Build raceId → {raceNo, time} from race tabs
  const raceMeta = new Map<string, { raceNo: number; time: string }>();
  $("ul.races-tabs li h3.race-no a[id^='anc']").each((_, el) => {
    const ancId = $(el).attr("id") ?? "";
    const raceId = ancId.replace("anc", "");
    const text = $(el).text().trim().replace(/\s+/g, " ");
    const noMatch = text.match(/(\d+)\.\s*Ko[sş]u/i);
    const timeRaw = text.match(/(\d{1,2}[.:]\d{2})/);
    const parsedTime = timeRaw ? timeRaw[1].replace(".", ":") : "";
    if (noMatch && raceId) {
      raceMeta.set(raceId, {
        raceNo: parseInt(noMatch[1], 10),
        time: parsedTime,
      });
    }
  });

  if (raceMeta.size === 0) return null;

  // Parse each race pane
  const races: IngestRace[] = [];

  $("div.races-panes > div[id]").each((_, raceDiv) => {
    const raceId = $(raceDiv).attr("id") ?? "";
    const meta = raceMeta.get(raceId);
    if (!meta) return;

    // Class type from aciklamaFancy link text (abbreviated race code)
    const classEl = $(".race-config .aciklamaFancy", raceDiv).first();
    const classType = classEl.text().trim() || "—";

    // Full config text for distance + surface + breed
    const configText = $(".race-config", raceDiv).text().replace(/\s+/g, " ").trim();
    const distMatch = configText.match(/\b(\d{3,5})\b/);
    const distance = distMatch ? parseInt(distMatch[1], 10) : 1200;
    const surface = parseSurface(configText);
    const breed = parseBreed(configText);

    // Parse runner rows
    const runners: IngestRunner[] = [];

    $("tbody tr", raceDiv).each((_, row) => {
      const noText = $(".gunluk-GunlukYarisProgrami-SiraId", row).text().trim();
      const no = parseInt(noText, 10);
      if (isNaN(no) || no < 1 || no > 30) return;

      // Horse name — clone & remove span (finishing position) before reading text
      const atEl = $(".gunluk-GunlukYarisProgrami-AtAdi a", row).first();
      const atClone = atEl.clone();
      atClone.find("span, sup").remove();
      const name = atClone.text().trim().toUpperCase();
      if (!name) return;

      // Weight
      const kiloRaw = $(".gunluk-GunlukYarisProgrami-Kilo", row).text().trim();
      const weight = parseFloat(kiloRaw.replace(",", ".")) || undefined;

      // Jockey (prefer title attr which has full name)
      const jokeyEl = $(".gunluk-GunlukYarisProgrami-JokeAdi a", row).first();
      const jockey = (jokeyEl.attr("title") || jokeyEl.text()).trim() || undefined;

      // Trainer
      const trainerEl = $(".gunluk-GunlukYarisProgrami-AntronorAdi a", row).first();
      const trainer = trainerEl.text().trim() || undefined;

      // Sire / Dam / DamSire from Baba td — three anchor tags
      const babaLinks = $(".gunluk-GunlukYarisProgrami-Baba a", row).toArray();
      const sire = babaLinks[0] ? $(babaLinks[0]).text().trim() || undefined : undefined;
      const dam = babaLinks[1] ? $(babaLinks[1]).text().trim() || undefined : undefined;
      const damSire = babaLinks[2] ? $(babaLinks[2]).text().trim() || undefined : undefined;

      // AGF — title attr has the precise value, e.g. title="%17,09(2)"
      const agfEl = $(".gunluk-GunlukYarisProgrami-AGFORAN a", row).first();
      const agfRaw = (agfEl.attr("title") || agfEl.text()).trim();
      const agfMatch = agfRaw.match(/([\d]+[.,]?[\d]*)/);
      const agf = agfMatch ? parseFloat(agfMatch[1].replace(",", ".")) || undefined : undefined;

      runners.push({ no, name, weight, jockey, trainer, sire, dam, damSire, agf });
    });

    if (runners.length > 0) {
      races.push({
        raceNo: meta.raceNo,
        time: meta.time || undefined,
        classType,
        breed,
        surface,
        distance,
        runners,
        gallops: [],
      });
    }
  });

  if (races.length === 0) return null;

  const date = parseDate(tjkDate);
  const slug = toSlug(city.sehirAdi);

  return {
    date,
    hippodromeSlug: slug,
    hippodromeName: city.sehirAdi,
    races,
  };
}

// ── 3. Full ingest for a date ───────────────────────────────────────────────

export type IngestCityResult = {
  sehirId: number;
  sehirAdi: string;
  ok: boolean;
  races: number;
  runners: number;
  error?: string;
};

export async function ingestDate(
  tjkDate: string
): Promise<{ date: string; cities: IngestCityResult[] }> {
  const { persistRaceDays } = await import("./base");

  const cities = await discoverTurkishCities(tjkDate);
  const results: IngestCityResult[] = [];

  for (const city of cities) {
    try {
      const raceDay = await fetchCityProgram(city, tjkDate);
      if (!raceDay) {
        results.push({ ...city, ok: false, races: 0, runners: 0, error: "No data" });
        continue;
      }

      await persistRaceDays([raceDay]);

      const runners = raceDay.races.reduce((sum, r) => sum + r.runners.length, 0);
      results.push({ ...city, ok: true, races: raceDay.races.length, runners });
    } catch (err) {
      results.push({ ...city, ok: false, races: 0, runners: 0, error: String(err) });
    }

    // Polite delay between cities
    await new Promise((r) => setTimeout(r, 400));
  }

  return { date: tjkDate, cities: results };
}
