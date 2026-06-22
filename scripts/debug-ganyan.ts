import { request } from "undici";
import * as cheerio from "cheerio";
import { discoverTurkishCities, toTjkDate } from "../src/server/services/ingest/tjk-info.adapter";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

async function main() {
  const tjkDate = toTjkDate(new Date());
  const cities = await discoverTurkishCities(tjkDate);
  console.log("Cities today:", cities.map((c) => c.sehirAdi));

  for (const city of cities) {
    const url =
      `https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisSonuclari` +
      `?SehirId=${city.sehirId}&QueryParameter_Tarih=${encodeURIComponent(tjkDate)}` +
      `&SehirAdi=${encodeURIComponent(city.sehirAdi)}&Era=today`;
    console.log("\n===", city.sehirAdi, url);
    const { statusCode, body } = await request(url, { headers: HEADERS });
    if (statusCode !== 200) { console.log("HTTP", statusCode); continue; }
    const html = await body.text();
    const $ = cheerio.load(html);
    const headers = $("div.race-details");
    const tables = $("table.tablesorter");
    console.log("headers.length =", headers.length, " tables.length =", tables.length);
    headers.each((i, headerEl) => {
      const headerText = $("h3.race-no", headerEl).first().text().replace(/\s+/g, " ").trim();
      console.log(`  header[${i}] = "${headerText}"`);
    });
    tables.each((i, tableEl) => {
      const rowCount = $(tableEl).find("tbody tr").length;
      const cls = $(tableEl).attr("class");
      console.log(`  table[${i}] class="${cls}" rows=${rowCount}`);
    });
  }
}

main().catch(console.error);
