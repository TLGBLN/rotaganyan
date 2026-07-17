/**
 * TJK "Jokey Olmaya Kalan Yarış Sayısı" — apranti jokeylerin jokey olmak için kaç
 * yarışının kaldığını gösteren, oturum/filtre gerektirmeyen tek sayfalık liste.
 * URL: /TR/YarisSever/Query/Page/JokeyOlmayaKalanYarisSayisi
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

function normalizeJockeyName(s: string): string {
  return s
    .toLocaleUpperCase("tr-TR")
    .replace(/İ/g, "I")
    .normalize("NFD")
    .replace(new RegExp("[̀-ͯ]", "g"), "")
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS, headersTimeout: 10_000, bodyTimeout: 10_000 });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

async function fetchApprenticeRemainingRacesUncached(): Promise<Record<string, number>> {
  const html = await fetchHtml(`${BASE}/TR/YarisSever/Query/Page/JokeyOlmayaKalanYarisSayisi`);
  const $ = cheerio.load(html);
  const map: Record<string, number> = {};

  $("table tbody tr").each((_, tr) => {
    const cells = $(tr).find("td").toArray().map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const fullName = cells[0] ?? "";
    const shortName = cells[1] ?? "";
    const remaining = parseInt(cells[3] ?? "", 10);
    if (!fullName || isNaN(remaining)) return;
    if (fullName) map[normalizeJockeyName(fullName)] = remaining;
    if (shortName) map[normalizeJockeyName(shortName)] = remaining;
  });

  return map;
}

// Liste günde birkaç kez değişir (yarış sonrası) — 3 saatlik cache yeterli, gereksiz TJK isteği yapmaz.
const cachedFetch = unstable_cache(
  fetchApprenticeRemainingRacesUncached,
  ["apprentice-remaining-races"],
  { revalidate: 10_800 }
);

/** Jokey adı (tam ad veya kısa ad, büyük/küçük harf ve Türkçe karakter farketmez) -> kalan yarış sayısı. */
export async function fetchApprenticeRemainingRaces(): Promise<Record<string, number>> {
  return cachedFetch();
}

export { normalizeJockeyName };
