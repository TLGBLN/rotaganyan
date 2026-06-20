import { request } from "undici";
import * as cheerio from "cheerio";

const TJK_INDEX = "https://www.tjk.org/TR/YarisSever/YarisSever/Index";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
  Referer: "https://www.tjk.org/",
};

export async function fetchTjkTicker(): Promise<string[]> {
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
