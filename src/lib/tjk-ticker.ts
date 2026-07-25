import { request } from "undici";
import * as cheerio from "cheerio";

const TJK_INDEX = "https://www.tjk.org/TR/YarisSever/YarisSever/Index";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
  Referer: "https://www.tjk.org/",
};

async function fetchTjkTickerUncached(): Promise<string[]> {
  try {
    const { statusCode, body } = await request(TJK_INDEX, { headers: HEADERS });
    if (statusCode !== 200) return [];
    const html = await body.text();
    const $ = cheerio.load(html);

    const items: string[] = [];

    // Ana duyuru bandı
    $(".marquee_news").each((_, el) => {
      const text = $(el).text().trim();
      if (text) items.push(text);
    });

    // Haber başlıkları
    $("span.news-title").each((_, el) => {
      const text = $(el).text().trim();
      if (text && !items.includes(text)) items.push(text);
    });

    return items.filter(Boolean).slice(0, 10);
  } catch {
    return [];
  }
}

// next/cache'in unstable_cache()'i yerine process-içi TTL cache — bkz. tjk-at-performans.
// adapter.ts'teki aynı düzeltmenin notu ("use server" zincirinde sessizce yutulan hata).
let cached: { data: string[]; expiresAt: number } | null = null;
const CACHE_TTL_MS = 120_000;

/** TJK ana sayfa duyuru/haber bandı — her sayfa yüklemesinde canlı çekmemek için 2 dakika cache'lenir. */
export async function fetchTjkTicker(): Promise<string[]> {
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  const data = await fetchTjkTickerUncached();
  cached = { data, expiresAt: Date.now() + CACHE_TTL_MS };
  return data;
}
