import { request } from "undici";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

async function main() {
  const url = "https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisSonuclari?SehirId=4&QueryParameter_Tarih=22%2F06%2F2026&SehirAdi=Bursa&Era=today";
  const { body } = await request(url, { headers: HEADERS });
  const html = await body.text();
  const $ = cheerio.load(html);
  const tables = $("table.tablesorter");
  const table = tables.eq(1); // race 2
  console.log("table[1] outerHTML class:", table.attr("class"));
  console.log("direct child tbody count:", table.children("tbody").length);
  console.log("all tbody tr count (descendant):", table.find("tbody tr").length);
  table.find("tbody tr").each((i, row) => {
    const rankText = $(".gunluk-GunlukYarisSonuclari-SONUCNO", row).first().text().trim();
    const atCell = $(".gunluk-GunlukYarisSonuclari-AtAdi3", row).first();
    const clone = atCell.clone();
    clone.find("span, sup, img").remove();
    const raw = clone.text().replace(/\s+/g, " ").trim();
    const gny = $(".gunluk-GunlukYarisSonuclari-Gny", row).first().text().trim();
    console.log(`row[${i}] rank="${rankText}" at="${raw}" gny="${gny}"`);
  });
}
main().catch(console.error);
