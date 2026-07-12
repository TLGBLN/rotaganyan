/**
 * Liderform galop scraper — fetches workout (idman/galop) data from liderform.com.tr
 * and upserts Gallop records for today's runners.
 *
 * URL pattern: https://liderform.com.tr/program/galop/{YYYY-MM-DD}/{city}/{raceNo}
 * Turkish city slugs: ankara, karma, izmir, dbakir, bursa, adana, elazig, kocaeli, antalya
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://liderform.com.tr";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
  Referer: "https://liderform.com.tr/",
};

// liderform city slugs that map to Turkish hippodromes (skip foreign)
const FOREIGN_SLUGS = new Set([
  "selangor", "turffontei", "newmarket", "gulfstream", "saratoga",
  "indianapol", "aqueduct", "santaanita", "parislongchamp", "hanshin",
  "flemington", "sha", "meydan", "cork", "curragh", "fairyhouse",
  "leopardsto", "navan", "naas", "chelmsford", "ascot", "kempton",
  "wolverhampt", "lingfield", "yarmouth", "goodwood", "chester",
  "epsom", "haydock", "leicester", "nottingham", "catterick",
  "doncaster", "thirsk", "pontefract", "carlisle", "ripon", "bath",
  "chepstow", "windsor", "brighton", "southwell", "musselburgh",
  "ayr", "perth", "hamilton", "beverley", "redcar",
]);

async function fetchHtml(url: string): Promise<string | null> {
  try {
    const { statusCode, body } = await request(url, { headers: HEADERS });
    if (statusCode !== 200) return null;
    return body.text();
  } catch {
    return null;
  }
}

export type GalopRow = {
  splits: Record<string, string | null>; // "1600","1400","1200","1000","800","600","400"
  pist: string;
  icDis: string;
  caba: string;
  jockey: string;
  kg: string;
  date: Date;
  sehir: string;
};

export type HorseGalop = {
  horseName: string; // raw horse name from liderform (uppercase, may have country code)
  rows: GalopRow[];
};

export type RaceGalopPage = {
  citySlug: string;
  raceNo: number;
  horses: HorseGalop[];
};

/** Extract horse name from its stats link: <a href="/istatistik/at/{id}">AT ADI</a> */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseHorseName(linkEl: any): string {
  return linkEl.text().trim().toUpperCase();
}

/** Normalize horse name for matching: strip country codes "(GER)", "(USA)", etc. */
function normHorseName(name: string): string {
  return name
    .replace(/\([A-Z]{2,3}\)/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseSplitRow($: cheerio.CheerioAPI, row: any): GalopRow | null {
  const cells = $(row).find("td");
  if (cells.length < 14) return null;

  const splitKeys = ["1600", "1400", "1200", "1000", "800", "600", "400"];
  const splits: Record<string, string | null> = {};
  splitKeys.forEach((key, i) => {
    const val = cells.eq(i).text().trim();
    splits[key] = val || null;
  });

  const dateStr = cells.eq(12).text().trim(); // DD/MM/YYYY
  if (!dateStr) return null;
  const [d, mo, y] = dateStr.split("/");
  if (!d || !mo || !y) return null;
  const date = new Date(`${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);

  return {
    splits,
    pist: cells.eq(7).text().trim(),
    icDis: cells.eq(8).text().trim(),
    caba: cells.eq(9).text().trim(),
    jockey: cells.eq(10).text().trim(),
    kg: cells.eq(11).text().trim(),
    date,
    sehir: cells.eq(13).text().trim(),
  };
}

/** Parse all horse galop blocks from a single race galop page. */
function parseGalopPage(html: string): HorseGalop[] {
  const $ = cheerio.load(html);
  const horses: HorseGalop[] = [];

  // Horse name links: each horse has exactly one <a href="/istatistik/at/{id}">
  // These appear in the same order as the tbody galop tables.
  const horseLinks = $('a[href*="/istatistik/at/"]').toArray();
  const tbodies = $("tbody").toArray();

  const count = Math.min(horseLinks.length, tbodies.length);
  for (let i = 0; i < count; i++) {
    const horseName = parseHorseName($(horseLinks[i]));
    if (!horseName) continue;

    const rows: GalopRow[] = [];
    $(tbodies[i])
      .find("tr")
      .each((_, row) => {
        const gr = parseSplitRow($, row);
        if (gr) rows.push(gr);
      });

    horses.push({ horseName, rows });
  }

  return horses;
}

/** Fetch all Turkish race galop pages for a given YYYY-MM-DD date string. */
export async function fetchGalopForDate(dateStr: string): Promise<RaceGalopPage[]> {
  const datePageHtml = await fetchHtml(`${BASE}/program/galop/${dateStr}`);
  if (!datePageHtml) return [];

  const $ = cheerio.load(datePageHtml);

  // Collect unique city+raceNo combos for Turkish cities
  const raceSet = new Set<string>();
  const raceList: Array<{ citySlug: string; raceNo: number }> = [];

  $('a[href*="/program/galop/"]').each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const m = href.match(/\/program\/galop\/[^/]+\/([^/]+)\/(\d+)$/);
    if (!m) return;
    const citySlug = m[1];
    const raceNo = parseInt(m[2], 10);
    if (FOREIGN_SLUGS.has(citySlug)) return;
    const key = `${citySlug}/${raceNo}`;
    if (raceSet.has(key)) return;
    raceSet.add(key);
    raceList.push({ citySlug, raceNo });
  });

  const results: RaceGalopPage[] = [];
  for (const { citySlug, raceNo } of raceList) {
    const url = `${BASE}/program/galop/${dateStr}/${citySlug}/${raceNo}`;
    const html = await fetchHtml(url);
    if (!html) continue;
    const horses = parseGalopPage(html);
    if (horses.length > 0) {
      results.push({ citySlug, raceNo, horses });
    }
  }

  return results;
}

/** Upsert galop rows into the database, matching horse names to today's runners. */
export async function syncGalopForDate(dateStr: string): Promise<{
  pages: number;
  horses: number;
  rows: number;
  skipped: number;
  errors: string[];
}> {
  const { db } = await import("@/lib/db");

  // Liderform URL date = workout date, not race date.
  // Horses trained on dateStr may race 1–2 days later (or same day).
  // Load runners from [dateStr - 1 day, dateStr + 3 days] to cover all cases.
  const windowStart = new Date(`${dateStr}T00:00:00Z`);
  windowStart.setUTCDate(windowStart.getUTCDate() - 1);
  const windowEnd = new Date(`${dateStr}T00:00:00Z`);
  windowEnd.setUTCDate(windowEnd.getUTCDate() + 3);

  const todayRunners = await db.runner.findMany({
    where: {
      race: {
        raceDay: {
          date: { gte: windowStart, lte: windowEnd },
        },
      },
    },
    select: { id: true, name: true },
  });

  const nameToRunnerId = new Map<string, string>();
  for (const r of todayRunners) {
    nameToRunnerId.set(normHorseName(r.name), r.id);
  }

  const pages = await fetchGalopForDate(dateStr);

  let totalHorses = 0;
  let totalRows = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const page of pages) {
    for (const horse of page.horses) {
      const runnerId = nameToRunnerId.get(normHorseName(horse.horseName));
      if (!runnerId) {
        skipped++;
        continue;
      }
      totalHorses++;

      for (const row of horse.rows) {
        try {
          const exists = await db.gallop.findFirst({
            where: { runnerId, date: row.date },
          });
          if (exists) continue;

          const splitsWithMeta = {
            ...row.splits,
            kg: row.kg,
            sehir: row.sehir,
            ic_dis: row.icDis,
          };

          await db.gallop.create({
            data: {
              runnerId,
              date: row.date,
              track: row.pist || undefined,
              form: row.caba || undefined,
              jockey: row.jockey || undefined,
              splits: splitsWithMeta,
            },
          });
          totalRows++;
        } catch (err) {
          errors.push(`${horse.horseName} ${row.date.toISOString()}: ${String(err)}`);
        }
      }
    }
  }

  return {
    pages: pages.length,
    horses: totalHorses,
    rows: totalRows,
    skipped,
    errors,
  };
}
