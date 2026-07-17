/**
 * TJK resmi "At Koşu Bilgileri" (atın kendi profil sayfası) — tam yarış geçmişi.
 * URL: /TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?QueryParameter_AtId={id}
 * Oturum/filtre gerektirmeyen, AtId (tjk-info.adapter'ın koşu programından yakaladığı
 * Runner.tjkAtId) ile tek at için tüm geçmişi döner — pist/mesafe/hipodrom/yıl filtresi
 * bizim tarafımızda uygulanır.
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

export type TjkAtKosuRow = {
  date: string; // "15.07.2026"
  year: string; // "2026"
  city: string;
  distance: number;
  surface: string; // ham metin: "Ç:Normal 3.3" gibi
  finishPos: string;
  time: string;
  weight: string;
  equipment: string;
  jockey: string;
  raceNo: string;
  classType: string;
  trainer: string;
  owner: string;
  hp: string;
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS, headersTimeout: 10_000, bodyTimeout: 10_000 });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

/** Bir atın (TJK AtId'siyle) tüm resmi yarış geçmişini döner. */
export async function fetchTjkAtKosuBilgileri(atId: number): Promise<TjkAtKosuRow[]> {
  const html = await fetchHtml(`${BASE}/TR/YarisSever/Query/ConnectedPage/AtKosuBilgileri?1=1&QueryParameter_AtId=${atId}&Era=yesterday`);
  const $ = cheerio.load(html);
  const rows: TjkAtKosuRow[] = [];

  $("#queryTable tbody tr").each((_, tr) => {
    const $row = $(tr);
    const cellEls = $row.find("td").toArray();
    const cells = cellEls.map((td) => $(td).text().replace(/\s+/g, " ").trim());
    const date = cells[0] ?? "";
    if (!/^\d{2}\.\d{2}\.\d{4}$/.test(date)) return; // toplam/özet satırlarını atla

    // Takı — hücredeki her <a> bir kod (K, KG, DB, SK, GKR...) taşır; virgülle birleştirilir
    // (daily program ingest'indeki formatla tutarlı olsun diye).
    const equipmentCodes = cellEls[7]
      ? $(cellEls[7]).find("a").toArray().map((a) => $(a).text().trim()).filter(Boolean)
      : [];

    rows.push({
      date,
      year: date.slice(6, 10),
      city: cells[1] ?? "",
      distance: parseInt(cells[2] ?? "", 10) || 0,
      surface: cells[3] ?? "",
      finishPos: cells[4] ?? "",
      time: cells[5] ?? "",
      weight: cells[6] ?? "",
      equipment: equipmentCodes.join(","),
      jockey: cells[8] ?? "",
      raceNo: cells[12] ?? "",
      classType: cells[13] ?? "",
      trainer: cells[14] ?? "",
      owner: cells[15] ?? "",
      hp: cells[16] ?? "",
    });
  });

  return rows;
}
