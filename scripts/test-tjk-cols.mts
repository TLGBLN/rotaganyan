import { request } from "undici";
import * as cheerio from "cheerio";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

const today = "09/07/2026";
const { statusCode, body } = await request(
  `https://www.tjk.org/TR/YarisSever/Info/Sehir/GunlukYarisSonuclari?SehirId=5&QueryParameter_Tarih=${encodeURIComponent(today)}&SehirAdi=Ankara&Era=today`,
  { headers: HEADERS }
);
const html = await body.text();
const $ = cheerio.load(html);

// GunlukYarisSonuclari ile başlayan tüm class'lar
const classes = new Set<string>();
$("[class]").each((_, el) => {
  const cls = $(el).attr("class") ?? "";
  cls.split(" ").filter((c) => c.startsWith("gunluk-")).forEach((c) => classes.add(c));
});
console.log("=== gunluk- classes ===");
[...classes].sort().forEach((c) => console.log(c));

// İlk yarışın ilk satırı
console.log("\n=== İlk tablo ilk satır ===");
$("table.tablesorter").first().find("tbody tr").first().find("td").each((i, td) => {
  console.log(`  td[${i}] class="${$(td).attr("class")}" → "${$(td).text().trim().slice(0, 80)}"`);
});
