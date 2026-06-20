/**
 * GanyanDefteri.com adapter
 *
 * Selectors/paths were determined by inspecting ganyandefteri.com in a browser.
 * Re-verify after any site redesign — scraping is inherently fragile.
 *
 * Data structure expected:
 *   /bulten  — lists hippodromes + races for today (or ?tarih=YYYY-MM-DD)
 *   /bulten/<hipodrom>/<no> — race detail with runner table
 *   /galoplar/<at-adi> — gallop page per horse
 */

import { request } from "undici";
import * as cheerio from "cheerio";
import type { DataProvider } from "./base";
import type { IngestRaceDay, IngestRace, IngestRunner, IngestGallop } from "./types";
import type { Breed, Surface } from "@prisma/client";

const BASE = "https://www.ganyandefteri.com";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
};

// ── helpers ──────────────────────────────────────────────────────────────────

function toSlug(name: string): string {
  return name
    .replace(/İ/g, "i")
    .replace(/ı/g, "i")
    .replace(/Ğ/g, "g")
    .replace(/ğ/g, "g")
    .replace(/Ş/g, "s")
    .replace(/ş/g, "s")
    .replace(/Ü/g, "u")
    .replace(/ü/g, "u")
    .replace(/Ö/g, "o")
    .replace(/ö/g, "o")
    .replace(/Ç/g, "c")
    .replace(/ç/g, "c")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseBreed(text: string): Breed {
  const t = text.toLowerCase();
  if (t.includes("arap") || t.includes("arab")) return "ARAP";
  return "INGILIZ";
}

function parseSurface(text: string): Surface {
  const t = text.toLowerCase();
  if (t.includes("çim") || t.includes("cim")) return "CIM";
  return "KUM";
}

function parseWeight(text: string): number | undefined {
  const m = text.match(/(\d{2,3}(?:[.,]\d)?)\s*kg?/i);
  if (!m) return undefined;
  return parseFloat(m[1].replace(",", "."));
}

function parseDate(dateStr: string): Date | null {
  const dmy = dateStr.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (dmy) {
    return new Date(
      `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}T00:00:00Z`
    );
  }
  const iso = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(`${iso[0]}T00:00:00Z`);
  return null;
}

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode} for ${url}`);
  return body.text();
}

// ── runner gallop fetching ────────────────────────────────────────────────────

async function fetchRunnerGallops(horseName: string): Promise<Omit<IngestGallop, "runnerNo">[]> {
  try {
    const url = `${BASE}/galoplar/${encodeURIComponent(horseName)}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);
    const gallops: Omit<IngestGallop, "runnerNo">[] = [];

    // galop-table: date | track | form | 200m | 400m | 600m | 800m | 1000m | 1200m
    $("table.galop-table tbody tr, .galop-row").each((_, el) => {
      const cells = $(el)
        .find("td")
        .toArray()
        .map((c) => $(c).text().trim());
      if (cells.length < 3) return;

      const date = parseDate(cells[0]);
      if (!date) return;

      const track = cells[1] || undefined;
      const form = cells[2] || undefined;

      const SPLIT_KEYS = ["200", "400", "600", "800", "1000", "1200", "1400", "1600"];
      const splits: Record<string, string> = {};
      cells.slice(3).forEach((val, i) => {
        if (SPLIT_KEYS[i] && val && val !== "-") splits[SPLIT_KEYS[i]] = val;
      });

      gallops.push({ date, track, form, splits });
    });

    return gallops.slice(0, 5);
  } catch {
    return [];
  }
}

// ── race detail page ──────────────────────────────────────────────────────────

async function fetchRaceDetail(
  hippodromeSlug: string,
  raceNo: number,
  dateStr: string
): Promise<{ runners: IngestRunner[]; gallops: IngestGallop[] }> {
  try {
    const url = `${BASE}/bulten/${hippodromeSlug}/${raceNo}?tarih=${dateStr}`;
    const html = await fetchHtml(url);
    const $ = cheerio.load(html);

    const runners: IngestRunner[] = [];

    // Expected columns: No | At Adı (+ pedigree) | Jokey | Antrenör | Kilo | AGF | …
    $("table.runner-table tbody tr, .at-listesi tr.at-row").each((_, el) => {
      const cells = $(el)
        .find("td")
        .toArray()
        .map((c) => $(c).text().trim());
      if (cells.length < 4) return;

      const no = parseInt(cells[0], 10);
      if (isNaN(no)) return;

      const nameFull = cells[1];
      const nameMatch = nameFull.match(/^([^(]+)/);
      const name = nameMatch ? nameMatch[1].trim() : nameFull;

      // Pedigree in parentheses: (Sire x Dam)
      const pedigreeMatch = nameFull.match(/\(([^)]+)\)/);
      let sire: string | undefined;
      let dam: string | undefined;
      if (pedigreeMatch) {
        const parts = pedigreeMatch[1].split(/\s+x\s+/i);
        sire = parts[0]?.trim();
        dam = parts[1]?.trim();
      }

      const jockey = cells[2] || undefined;
      const trainer = cells[3] || undefined;
      const weight = parseWeight(cells[4] ?? "");
      const agf = cells[5] ? parseFloat(cells[5].replace(",", ".")) || undefined : undefined;

      runners.push({ no, name, sire, dam, jockey, trainer, weight, agf });
    });

    // Fetch gallops concurrently (8 at a time)
    const gallops: IngestGallop[] = [];
    const CONCURRENCY = 8;
    for (let i = 0; i < runners.length; i += CONCURRENCY) {
      const batch = runners.slice(i, i + CONCURRENCY);
      const results = await Promise.all(
        batch.map((r) => fetchRunnerGallops(r.name).then((gs) => ({ no: r.no, gs })))
      );
      for (const { no, gs } of results) {
        for (const g of gs) gallops.push({ ...g, runnerNo: no });
      }
    }

    return { runners, gallops };
  } catch {
    return { runners: [], gallops: [] };
  }
}

// ── main listing ──────────────────────────────────────────────────────────────

async function fetchBultenPage(date: Date): Promise<IngestRaceDay[]> {
  const dateStr = date.toISOString().slice(0, 10);
  const url = `${BASE}/bulten?tarih=${dateStr}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  type HipoBlock = {
    slug: string;
    name: string;
    races: Array<{
      raceNo: number;
      time?: string;
      classType: string;
      breed: Breed;
      surface: Surface;
      distance: number;
      conditions?: string;
    }>;
  };

  const hippodromeBlocks: HipoBlock[] = [];

  $(".hipodrom-section, .bulten-hipodrom, [data-hipodrom]").each((_, el) => {
    const name = $(el).find(".hipodrom-adi, .hipodrom-name, h2, h3").first().text().trim();
    if (!name) return;

    const races: HipoBlock["races"] = [];

    $(el)
      .find("table.kos-listesi tbody tr, .kos-row")
      .each((_, row) => {
        const cells = $(row)
          .find("td")
          .toArray()
          .map((c) => $(c).text().trim());
        if (cells.length < 4) return;

        const raceNo = parseInt(cells[0], 10);
        if (isNaN(raceNo)) return;

        races.push({
          raceNo,
          time: cells[1] || undefined,
          classType: cells[2] || "—",
          breed: parseBreed(cells[5] ?? cells[2] ?? ""),
          surface: parseSurface(cells[4] ?? ""),
          distance: parseInt(cells[3], 10) || 1200,
          conditions: cells[6] || undefined,
        });
      });

    if (races.length > 0) {
      hippodromeBlocks.push({ slug: toSlug(name), name, races });
    }
  });

  // Fallback: parse hippodrome slugs from bulten links
  if (hippodromeBlocks.length === 0) {
    $("a[href*='/bulten/']").each((_, el) => {
      const href = $(el).attr("href") ?? "";
      const m = href.match(/\/bulten\/([^/?]+)/);
      if (m && !hippodromeBlocks.find((h) => h.slug === m[1])) {
        hippodromeBlocks.push({
          slug: m[1],
          name: $(el).text().trim() || m[1],
          races: [],
        });
      }
    });
  }

  // Enrich with runner + gallop data per race
  const raceDays: IngestRaceDay[] = [];

  for (const hipo of hippodromeBlocks) {
    const fullRaces: IngestRace[] = [];

    for (const r of hipo.races) {
      const { runners, gallops } = await fetchRaceDetail(hipo.slug, r.raceNo, dateStr);
      fullRaces.push({ ...r, runners, gallops });
    }

    if (fullRaces.length > 0) {
      raceDays.push({
        date,
        hippodromeSlug: hipo.slug,
        hippodromeName: hipo.name,
        races: fullRaces,
      });
    }
  }

  return raceDays;
}

// ── exported adapter ──────────────────────────────────────────────────────────

export class GanyanDefteriAdapter implements DataProvider {
  readonly name = "ganyandefteri.com";

  async fetchRaceDays(date?: Date): Promise<IngestRaceDay[]> {
    const target = date ?? new Date();
    const d = new Date(target);
    d.setUTCHours(0, 0, 0, 0);
    return fetchBultenPage(d);
  }
}
