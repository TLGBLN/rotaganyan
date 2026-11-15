// SALT-OKUMA YOKLAMA — hangi Sort dizeleri çalışıyor, sayfa kaç satır veriyor, ilk hata/kısa sayfa nerede (HTTP kodu + satır)?
import { request } from "undici";
import * as cheerio from "cheerio";
const BASE = "https://www.tjk.org/TR/YarisSever/Query";
const H = { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/124.0", "Accept-Language": "tr-TR,tr;q=0.9", Referer: "https://www.tjk.org/" };
const get = async (u: string) => { const r = await request(u, { headers: H }); const t = await r.body.text(); return { code: r.statusCode, t }; };
const CFG = {
  AygirIstatistikleri: { qs: "QueryParameter_YIL=2026&QueryParameter_IrkId=-1&QueryParameter_GrupId=-1&QueryParameter_PistId=-1&QueryParameter_AygirAdi=", id: "BabaId", sorts: ["derece1 DESC,derece1yuzde DESC", "KosuAdet DESC", "AygirAdi ASC", "AygirAdi", "ToplamKazanc DESC", "derece1 DESC"] },
  KisrakIstatistikleri: { qs: "QueryParameter_YIL=2026&QueryParameter_IrkId=-1&QueryParameter_KisrakAdi=", id: "AnneId", sorts: ["derece1 DESC,derece1yuzde DESC", "KosuAdet DESC", "KisrakAdi ASC", "KAZANC DESC"] },
} as const;
async function main() {
  for (const [sayfa, c] of Object.entries(CFG)) {
    for (const sort of c.sorts) {
      const ids = new Set<string>(); let last = ""; let sp = 0;
      for (let p = 0; p < 120; p++) {
        const { code, t } = await get(`${BASE}/DataRows/${sayfa}?${c.qs}&PageNumber=${p}&Sort=${encodeURIComponent(sort)}`);
        if (code !== 200) { last = `HTTP ${code} @p${p}`; break; }
        const $ = cheerio.load(`<table>${t}</table>`); let n = 0;
        $("tr td[class*='-" + (sayfa === "AygirIstatistikleri" ? "AygirAdi" : "KisrakAdi") + "'] a").each((_, a) => { const m = ($(a).attr("href") ?? "").match(new RegExp(c.id + "=(\\d+)")); ids.add(m ? m[1] : "ad:" + $(a).text()); n++; });
        sp++; if (n < 50) { last = `kısa sayfa ${n} @p${p}`; break; }
        await new Promise((r) => setTimeout(r, 100));
      }
      console.log(`${sayfa} | sort="${sort}" | sayfa ${sp} | benzersiz id ${ids.size} | son: ${last}`);
    }
  }
}
main();
