import { request } from "undici";
import * as cheerio from "cheerio";
import { unstable_cache } from "next/cache";

export type DailyRace = {
  raceNo: number;
  time: string;
  distance: number;
  surface: string;
  breed: string;
  classType: string;
  runnerCount?: number;
};

export type DailyHippodrome = {
  name: string;
  code: string;
  races: DailyRace[];
};

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9",
  Referer: "https://www.tjk.org/",
};

const HIPO: Record<string, string> = {
  ANK: "Ankara", IST: "İstanbul", IZM: "İzmir", ADA: "Adana",
  BUR: "Bursa",  ELA: "Elazığ",  KON: "Konya",  DYB: "Diyarbakır",
  SAK: "Sakarya", BAL: "Balıkesir", SAN: "Şanlıurfa",
};

async function fetchDailyProgramUncached(dateStr: string): Promise<DailyHippodrome[]> {
  const url = `${BASE}/TR/YarisSever/Query/Page/GunlukYarisProgrami?QueryParameter_Tarih=${dateStr}`;

  try {
    const { statusCode, body } = await request(url, { headers: HEADERS });
    if (statusCode !== 200) return [];
    const html = await body.text();
    const $ = cheerio.load(html);

    const byHipo = new Map<string, DailyRace[]>();
    const hipoOrder: string[] = [];

    // TJK program sayfasındaki tabloları parse et
    $("table").each((_, table) => {
      // Tablo başlığından hipodrom kodunu bul
      const caption = $(table).find("caption, th").first().text().trim().toUpperCase();
      let hipoCode = "";
      for (const code of Object.keys(HIPO)) {
        if (caption.includes(code)) { hipoCode = code; break; }
      }

      $(table).find("tbody tr").each((_, row) => {
        const cells = $(row).find("td").toArray().map(c => $(c).text().trim());
        if (cells.length < 4) return;

        // İlk hücre hipo kodu olabilir
        const first = cells[0].toUpperCase();
        let offset = 0;
        for (const code of Object.keys(HIPO)) {
          if (first === code || first.startsWith(code)) {
            hipoCode = code;
            offset = 1;
            break;
          }
        }

        if (!hipoCode) return;

        const raceNo = parseInt(cells[offset], 10);
        if (isNaN(raceNo) || raceNo < 1 || raceNo > 20) return;

        const time = cells[offset + 1] ?? "";
        const distance = parseInt(cells[offset + 2], 10) || 0;
        const surfaceRaw = cells[offset + 3] ?? "";
        const breedRaw = cells[offset + 4] ?? "";
        const classType = cells[offset + 5] ?? "—";

        const race: DailyRace = {
          raceNo,
          time: time.match(/\d{2}:\d{2}/) ? time.match(/\d{2}:\d{2}/)![0] : time,
          distance,
          surface: surfaceRaw.toLowerCase().includes("çim") || surfaceRaw.toLowerCase().includes("cim")
            ? "Çim"
            : surfaceRaw.toLowerCase().includes("sentet")
            ? "Sentetik"
            : "Kum",
          breed: breedRaw.toUpperCase().includes("ARAP") ? "Arap" : "İngiliz",
          classType,
        };

        if (!byHipo.has(hipoCode)) {
          byHipo.set(hipoCode, []);
          hipoOrder.push(hipoCode);
        }
        byHipo.get(hipoCode)!.push(race);
      });
    });

    return hipoOrder.map(code => ({
      code,
      name: HIPO[code] ?? code,
      races: byHipo.get(code)!,
    })).filter(h => h.races.length > 0);
  } catch {
    return [];
  }
}

const fetchDailyProgramCached = unstable_cache(fetchDailyProgramUncached, ["tjk-daily-program"], {
  revalidate: 300,
});

/** Belirli bir günün TJK koşu programı — DB'de henüz veri yokken canlı fallback olarak kullanılır, 5 dakika cache'lenir. */
export async function fetchDailyProgram(date?: Date): Promise<DailyHippodrome[]> {
  const dateStr = (date ?? new Date()).toISOString().slice(0, 10);
  return fetchDailyProgramCached(dateStr);
}
