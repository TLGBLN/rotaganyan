/**
 * TJK resmi Son 800 İstatistikleri sayfası.
 * URL: https://www.tjk.org/TR/YarisSever/Query/Page/Son800Ist
 * Bir atın geçmiş yarışlarındaki son 800m derecesini (kapanış hızı) verir —
 * At ismiyle sorgulanır, ayrı bir "koşu tarihi" filtresi yoktur.
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

export type TjkSon800Row = {
  horseName: string;
  year: string;
  city: string;
  surface: string; // Pist
  surfaceCondition: string; // Pist Durumu
  distance: string; // Mesafe
  weight: string; // Kilo
  breed: string; // Irk
  son800: string; // Son 800 derecesi
  ilk800: string; // "Son 800'e İlk Giren" derecesi
  raceClass: string; // Koşu Cinsi
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, {
    headers: HEADERS,
    headersTimeout: 10_000,
    bodyTimeout: 10_000,
  });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

function parseRows(html: string): TjkSon800Row[] {
  // Sayfa 2+ yanıtları çıplak <tbody><tr>... döner (tablosuz); cheerio bunu
  // <table> olmadan doğru ayrıştıramıyor, satırları sessizce kaybediyor.
  const $ = cheerio.load(`<table>${html}</table>`);
  const rows: TjkSon800Row[] = [];
  $("tr").each((_, tr) => {
    const $tr = $(tr);
    const cell = (cls: string) => $tr.find(`td.sorgu-Son800Ist-${cls}`).text().trim();

    const horseName = cell("AtAdi");
    if (!horseName) return;
    rows.push({
      horseName,
      year: cell("Yil"),
      city: cell("SehirAdi"),
      surface: cell("PistAdi"),
      surfaceCondition: cell("PistDurumu"),
      distance: cell("Mesafe"),
      weight: cell("Kilo"),
      breed: cell("IrkAdi"),
      son800: cell("Son800"),
      ilk800: cell("Ilk800"),
      raceClass: cell("CinsAdi"),
    });
  });
  return rows;
}

async function fetchTjkSon800ByHorseNameUncached(horseName: string): Promise<TjkSon800Row[]> {
  const qs = `QueryParameter_AtAdi=${encodeURIComponent(horseName)}`;
  const html = await fetchHtml(`${BASE}/TR/YarisSever/Query/Data/Son800Ist?${qs}`);
  return parseRows(html);
}

// At geçmişi günde en fazla birkaç kez değişir — 3 saatlik cache Son800 panelinin
// gereksiz TJK isteği yapmasını önler (tjk-at-performans.adapter'daki desenle tutarlı).
const cachedFetch = unstable_cache(
  fetchTjkSon800ByHorseNameUncached,
  ["tjk-son800-by-horse-name"],
  { revalidate: 10_800 }
);

/** Bir atın TJK'daki tüm Son 800 kayıtlarını çeker (en fazla ~50, sayfalama yapılmaz — tek at için yeterli). */
export async function fetchTjkSon800ByHorseName(horseName: string): Promise<TjkSon800Row[]> {
  return cachedFetch(horseName);
}