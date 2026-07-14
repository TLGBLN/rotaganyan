/**
 * TJK resmi Antrenör İstatistikleri sayfası — tek doğru kaynak (source of truth).
 * URL: https://www.tjk.org/TR/YarisSever/Query/Page/AntrenorIstatistikleri
 * tjk-jockey-stats.adapter.ts ile aynı AJAX sorgu/sayfalama mekanizması, sadece
 * sorgu adı ve alan önekleri "Antrenor" olarak değişiyor.
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

export type TjkTrainerRow = {
  trainer: string;
  races: number;
  wins: number;
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

function num(text: string): number {
  return parseInt(text.replace(/\./g, "").trim(), 10) || 0;
}

function parseRows(html: string): TjkTrainerRow[] {
  // Sayfa 2+ yanıtları çıplak <tbody><tr>... döner (tablosuz); cheerio bunu
  // <table> olmadan doğru ayrıştıramıyor, satırları sessizce kaybediyor.
  const $ = cheerio.load(`<table>${html}</table>`);
  const rows: TjkTrainerRow[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const trainer = $tr.find("td.sorgu-AntrenorIstatistikleri-AntrenorAdi a").text().trim();
    if (!trainer) return;
    const cell = (cls: string) => $tr.find(`td.sorgu-AntrenorIstatistikleri-${cls}`).text().trim();
    rows.push({
      trainer,
      races: num(cell("KosuAdet")),
      wins: num(cell("derece1")),
    });
  });
  return rows;
}

/** TJK'nın resmi antrenör istatistikleri tablosunu tüm sayfaları gezerek çeker (SehirId=-1 → tüm şehirler toplamı). */
export async function fetchTjkTrainerStats(year: number): Promise<TjkTrainerRow[]> {
  const qs = `QueryParameter_YIL=${year}&QueryParameter_SehirId=-1&QueryParameter_AntrenorAdi=`;
  const sort = "Sort=" + encodeURIComponent("derece1 DESC,derece1yuzde DESC");

  const first = await fetchHtml(`${BASE}/TR/YarisSever/Query/Data/AntrenorIstatistikleri?${qs}`);
  const all = parseRows(first);

  for (let page = 2; page <= 100; page++) {
    let html: string;
    try {
      html = await fetchHtml(
        `${BASE}/TR/YarisSever/Query/DataRows/AntrenorIstatistikleri?${qs}&PageNumber=${page}&${sort}`
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