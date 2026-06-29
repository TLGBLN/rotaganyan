/**
 * TJK Altılı Ganyan sonuç scraper — anasayfadaki "1. 6'lı / 2. 6'lı" sonuç
 * widget'ının aynısını kendi tasarımımızla göstermek için kullanılır.
 * URL format: /TR/YarisSever/YarisSever/AltiliSonuc?SehirId=N (her zaman güncel gün)
 */

import { request } from "undici";
import * as cheerio from "cheerio";
import { unstable_cache } from "next/cache";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

export type AltiliRow = { rank: number; at: string; derece: string; ganyan: string; agf: string };
export type AltiliGroup = { title: string; payout: string; ikramiye: string | null; rows: AltiliRow[] };
export type AltiliCityResult = { sehirId: number; sehirAdi: string; groups: AltiliGroup[] };

function cleanText(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

/** tfoot içinde "... dir." sonrası gelen "Yarış Sonuçları | Yarış Programı | ..." gibi menü metnini ayıklar. */
function extractPayoutSentence(raw: string): string {
  const match = raw.match(/.*?dir\./);
  return match ? match[0].trim() : raw;
}

/** İkramiye cümlesi ("6'lı Ganyan X TL vermiştir.") — sadece resmi ikramiye hesaplanmış (sonuçlanmış) yarışlarda gelir, aksi halde null. */
function extractIkramiyeSentence(raw: string): string | null {
  const match = raw.match(/6'lı Ganyan[^.]*vermiştir\./);
  return match ? match[0].trim() : null;
}

export async function fetchAltiliSonuc(sehirId: number, sehirAdi: string): Promise<AltiliCityResult | null> {
  const url = `${BASE}/TR/YarisSever/YarisSever/AltiliSonuc?SehirId=${sehirId}`;

  let html: string;
  try {
    html = await fetchHtml(url);
  } catch {
    return null;
  }

  const $ = cheerio.load(html);
  const groups: AltiliGroup[] = [];

  $("table.run-results").each((_, tableEl) => {
    const table = $(tableEl);
    // Skip the outer wrapper table — it contains two nested `table.run-results`
    // (one per "X. 6'lı" group); only the leaf tables hold real rows.
    if (table.find("table.run-results").length > 0) return;

    const title = cleanText(table.find("thead th").first().text());
    if (!title.includes("6'l")) return;

    const tfootText = cleanText(table.find("tfoot tr").first().text());
    const payout = extractPayoutSentence(tfootText);
    const ikramiye = extractIkramiyeSentence(tfootText);

    const rows: AltiliRow[] = [];
    table.find("tbody.sixer tr").each((_, rowEl) => {
      const cells = $(rowEl).find("td").toArray().map((c) => cleanText($(c).text()));
      if (cells.length < 5) return;
      const rank = parseInt(cells[0], 10);
      if (isNaN(rank)) return;
      rows.push({ rank, at: cells[1], derece: cells[2], ganyan: cells[3], agf: cells[4] });
    });

    if (rows.length > 0) groups.push({ title, payout, ikramiye, rows });
  });

  return groups.length > 0 ? { sehirId, sehirAdi, groups } : null;
}

async function fetchTodaysAltiliResultsUncached(tjkDate: string): Promise<AltiliCityResult[]> {
  const { discoverTurkishCities } = await import("./tjk-info.adapter");
  const cities = await discoverTurkishCities(tjkDate);

  const results: AltiliCityResult[] = [];
  for (const city of cities) {
    const result = await fetchAltiliSonuc(city.sehirId, city.sehirAdi);
    if (result) results.push(result);
    await new Promise((r) => setTimeout(r, 300)); // polite delay between cities
  }
  return results;
}

// "-v2" eki: ikramiye alanı eklenince eski (ikramiyesiz) cache girdisini geçersiz kılmak için
// kasıtlı olarak yeni bir anahtar kullanıldı — aksi halde 1 saatlik TTL dolana kadar eski veri sunulurdu.
const cachedFetchTodaysAltiliResults = unstable_cache(
  fetchTodaysAltiliResultsUncached,
  ["todays-altili-results-v2"],
  { revalidate: 3600 }
);

/** Fetches today's Altılı Ganyan results for every active Turkish hippodrome — TJK gününe göre cache'lenir, gün değişince otomatik yenilenir. */
export async function fetchTodaysAltiliResults(): Promise<AltiliCityResult[]> {
  const { toTjkDate } = await import("./tjk-info.adapter");
  return cachedFetchTodaysAltiliResults(toTjkDate(new Date()));
}
