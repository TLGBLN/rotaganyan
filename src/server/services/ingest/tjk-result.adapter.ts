/**
 * TJK Info/Sehir sonuç scraper — bir hipodromun bir günkü tüm koşularının
 * gelen sıralamasını (SONUCNO) ve at no'larını ayrıştırır.
 * URL format: /TR/YarisSever/Info/Sehir/GunlukYarisSonuclari?SehirId=N&QueryParameter_Tarih=DD/MM/YYYY
 */

import { request } from "undici";
import * as cheerio from "cheerio";
import type { CityInfo } from "./tjk-info.adapter";

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

export type ResultRow = { rank: number; no: number; name: string; ganyan?: number; jockey?: string; time?: string; fark?: string };
export type CityRaceResult = { raceNo: number; rows: ResultRow[] };

export async function fetchCityResults(
  city: CityInfo,
  tjkDate: string
): Promise<CityRaceResult[] | null> {
  const url =
    `${BASE}/TR/YarisSever/Info/Sehir/GunlukYarisSonuclari` +
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
  const headers = $("div.race-details");
  const tables = $("table.tablesorter");
  if (headers.length === 0 || tables.length === 0) return null;

  const races: CityRaceResult[] = [];

  headers.each((i, headerEl) => {
    const headerText = $("h3.race-no", headerEl).first().text().replace(/\s+/g, " ").trim();
    const noMatch = headerText.match(/(\d+)\.\s*Ko[sş]u/i);
    if (!noMatch) return;
    const raceNo = parseInt(noMatch[1], 10);

    const table = tables.eq(i);
    const rows: ResultRow[] = [];

    table.find("tbody tr").each((_, row) => {
      const rankText = $(".gunluk-GunlukYarisSonuclari-SONUCNO", row).first().text().trim();
      const rank = parseInt(rankText, 10);
      // rank 0 = diskalifiye/hükmen mağlup at, TJK tabloda en sona ekliyor ama "0" yazıyor —
      // gerçek bir bitiş sırası değil, dahil edilirse sort sırasında 1. sıranın önüne geçip
      // yanlış atın ganyanı kazanan ganyanı olarak kaydedilir.
      if (isNaN(rank) || rank <= 0) return;

      const cell = $(".gunluk-GunlukYarisSonuclari-AtAdi3", row).first();
      const link = cell.find("a").first();
      const target = link.length ? link : cell;
      const clone = target.clone();
      clone.find("span, sup, img").remove();
      const raw = clone.text().replace(/\s+/g, " ").trim();

      const numMatch = raw.match(/\((\d+)\)\s*$/);
      if (!numMatch) return;
      const no = parseInt(numMatch[1], 10);
      const name = raw.slice(0, numMatch.index).trim();

      const gnyText = $(".gunluk-GunlukYarisSonuclari-Gny", row).first().text().trim();
      const ganyan = gnyText ? parseFloat(gnyText.replace(",", ".")) : undefined;

      const jockeyRaw = $(".gunluk-GunlukYarisSonuclari-JokeAdi", row).first().text().trim();
      const jockey = jockeyRaw || undefined;

      const time = $(".gunluk-GunlukYarisSonuclari-Derece", row).first().text().trim() || undefined;
      const fark = $(".gunluk-GunlukYarisSonuclari-Fark", row).first().text().trim() || undefined;

      rows.push({ rank, no, name, ganyan: isNaN(ganyan as number) ? undefined : ganyan, jockey, time, fark });
    });

    if (rows.length > 0) {
      rows.sort((a, b) => a.rank - b.rank);
      races.push({ raceNo, rows });
    }
  });

  return races.length > 0 ? races : null;
}
