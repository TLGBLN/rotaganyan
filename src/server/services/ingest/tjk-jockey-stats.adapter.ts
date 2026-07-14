/**
 * TJK resmi Jokey İstatistikleri sayfası — tek doğru kaynak (source of truth).
 * URL: https://www.tjk.org/TR/YarisSever/Query/Page/JokeyIstatistikleri
 * Kendi veritabanımızdaki program/sonuç eksiklerinden bağımsız, TJK'nın
 * yayınladığı gerçek biniş/galibiyet sayılarını doğrudan çeker.
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

export type TjkJockeyRow = {
  jockey: string;
  races: number;
  wins: number;
  place2: number;
  place3: number;
  place4: number;
  place5: number;
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

function num(text: string): number {
  return parseInt(text.replace(/\./g, "").trim(), 10) || 0;
}

function parseRows(html: string): TjkJockeyRow[] {
  // Sayfa 2+ yanıtları çıplak <tbody><tr>... döner (tablosuz); cheerio bunu
  // <table> olmadan doğru ayrıştıramıyor, satırları sessizce kaybediyor.
  const $ = cheerio.load(`<table>${html}</table>`);
  const rows: TjkJockeyRow[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const jockey = $tr.find("td.sorgu-JokeyIstatistikleri-JokeyAdi a").text().trim();
    if (!jockey) return;
    const cell = (cls: string) => $tr.find(`td.sorgu-JokeyIstatistikleri-${cls}`).text().trim();
    rows.push({
      jockey,
      races: num(cell("KosuAdet")),
      wins: num(cell("derece1")),
      place2: num(cell("derece2")),
      place3: num(cell("derece3")),
      place4: num(cell("derece4")),
      place5: num(cell("derece5")),
    });
  });
  return rows;
}

/** TJK'nın resmi jokey istatistikleri tablosunu tüm sayfaları gezerek çeker (SehirId=-1 → tüm şehirler toplamı). */
export async function fetchTjkJockeyStats(year: number): Promise<TjkJockeyRow[]> {
  const qs = `QueryParameter_YIL=${year}&QueryParameter_SehirId=-1&QueryParameter_APRANTIADI=-1&QueryParameter_JokeyAdi=`;
  const sort = "Sort=" + encodeURIComponent("derece1 DESC,derece1yuzde DESC");

  const first = await fetchHtml(`${BASE}/TR/YarisSever/Query/Data/JokeyIstatistikleri?${qs}`);
  const all = parseRows(first);

  for (let page = 2; page <= 100; page++) {
    let html: string;
    try {
      html = await fetchHtml(
        `${BASE}/TR/YarisSever/Query/DataRows/JokeyIstatistikleri?${qs}&PageNumber=${page}&${sort}`
      );
    } catch {
      break; // TJK son sayfadan sonra 404 döner — bu normal bitiş koşulu
    }
    const rows = parseRows(html);
    all.push(...rows);
    if (rows.length < 50) break; // yarım sayfa = son sayfa
    await new Promise((r) => setTimeout(r, 200));
  }

  return all;
}