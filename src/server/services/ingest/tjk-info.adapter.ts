/**
 * TJK Info/Sehir scraper — uses SehirId-based URLs, returns full runner details.
 * URL format: /TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=7&QueryParameter_Tarih=DD/MM/YYYY
 */

import { request } from "undici";
import * as cheerio from "cheerio";
import type { IngestRaceDay, IngestRace, IngestRunner } from "./types";
import type { Breed, Surface } from "@prisma/client";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

// Keywords that indicate a foreign venue
const FOREIGN_KW = [
  "ABD", "Arjantin", "Krallık", "Afrika", "Fransa", "Almanya", "İtalya",
  "Japonya", "Avustralya", "Kanada", "BAE", "Bahreyn", "İrlanda",
  "Singapur", "Birleşik", "Belçika", "Hong", "Guney", "Güney",
  "Kuzey", "Ukrayna", "Rusya", "Çin", "Polonya", "İsveç", "Park ABD",
  "Park UK", "Racecourse", "Downs", "Şili", "Hollanda", "İspanya",
  "Meksika", "Brezilya", "Uruguay", "Peru", "Katar", "Umman",
  "Suudi", "Mısır", "Çekya", "Macaristan", "Norveç", "Danimarka",
  "Avusturya", "Yunanistan", "İsviçre", "Hindistan",
];

function isTurkish(sehirAdi: string): boolean {
  return !FOREIGN_KW.some((kw) => sehirAdi.includes(kw));
}

export function toSlug(name: string): string {
  return name
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");
}

function parseSurface(text: string): Surface {
  const t = text.toLowerCase();
  if (t.includes("çim") || t.includes("cim") || t.includes("grass")) return "CIM";
  if (t.includes("sentet")) return "SENTETIK";
  return "KUM";
}

function parseBreed(text: string): Breed {
  return text.toUpperCase().includes("ARAP") ? "ARAP" : "INGILIZ";
}

// Convert "DD/MM/YYYY" ↔ Date
function parseDate(ddmmyyyy: string): Date {
  const [d, m, y] = ddmmyyyy.split("/");
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00Z`);
}

export function toTjkDate(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

// ── 1. Discover Turkish city tabs for a given date ──────────────────────────

export type CityInfo = { sehirId: number; sehirAdi: string };

export async function discoverTurkishCities(tjkDate: string): Promise<CityInfo[]> {
  const url = `${BASE}/TR/YarisSever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=${encodeURIComponent(tjkDate)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const cities: CityInfo[] = [];
  const seen = new Set<number>();

  $("ul.gunluk-tabs li a[data-sehir-id]").each((_, el) => {
    const sehirId = parseInt($(el).attr("data-sehir-id") ?? "0", 10);
    if (!sehirId || seen.has(sehirId)) return;

    const href = $(el).attr("href") ?? "";
    const m = href.match(/SehirAdi=([^&]+)/);
    const sehirAdi = m
      ? decodeURIComponent(m[1].replace(/\+/g, " "))
      : $(el).text().replace(/\(.*?\)/, "").trim();

    if (isTurkish(sehirAdi)) {
      seen.add(sehirId);
      cities.push({ sehirId, sehirAdi: sehirAdi.trim() });
    }
  });

  return cities;
}

// ── 2. Fetch & parse one city's race program ────────────────────────────────

export async function fetchCityProgram(
  city: CityInfo,
  tjkDate: string
): Promise<IngestRaceDay | null> {
  const url =
    `${BASE}/TR/YarisSever/Info/Sehir/GunlukYarisProgrami` +
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

  // Build raceId → {raceNo, time} from race tabs
  const raceMeta = new Map<string, { raceNo: number; time: string }>();
  $("ul.races-tabs li h3.race-no a[id^='anc']").each((_, el) => {
    const ancId = $(el).attr("id") ?? "";
    const raceId = ancId.replace("anc", "");
    const text = $(el).text().trim().replace(/\s+/g, " ");
    const noMatch = text.match(/(\d+)\.\s*Ko[sş]u/i);
    const timeRaw = text.match(/(\d{1,2}[.:]\d{2})/);
    const parsedTime = timeRaw ? timeRaw[1].replace(".", ":") : "";
    if (noMatch && raceId) {
      raceMeta.set(raceId, {
        raceNo: parseInt(noMatch[1], 10),
        time: parsedTime,
      });
    }
  });

  if (raceMeta.size === 0) return null;

  // Parse each race pane
  const races: IngestRace[] = [];

  $("div.races-panes > div[id]").each((_, raceDiv) => {
    const raceId = $(raceDiv).attr("id") ?? "";
    const meta = raceMeta.get(raceId);
    if (!meta) return;

    // Class type from aciklamaFancy link text (abbreviated race code)
    const classEl = $(".race-config .aciklamaFancy", raceDiv).first();
    const classType = classEl.text().trim() || "—";

    // Full config text for distance + surface + breed
    const configText = $(".race-config", raceDiv).text().replace(/\s+/g, " ").trim();
    const distMatch = configText.match(/\b(\d{3,5})\b/);
    const distance = distMatch ? parseInt(distMatch[1], 10) : 1200;
    const surface = parseSurface(configText);
    const breed = parseBreed(configText);

    // ── Runner table and eküri are inside sibling div#kosubilgisi-{raceId} ──────
    const kosuDiv = $(`#kosubilgisi-${raceId}`);

    // Eküri gruplarını kosuDiv içinde ara
    const ekuriGroups: number[][] = [];
    kosuDiv.find("*").each((_, el) => {
      if ($(el).find("table, tbody").length > 0) return;
      const text = $(el).text();
      if (!/ekür/i.test(text)) return;
      const matches = [...text.matchAll(/\[([^\]]+)\]/g)];
      for (const m of matches) {
        const nos = [...m[1].matchAll(/\((\d+)\)/g)].map((x) => parseInt(x[1], 10));
        if (nos.length > 0) ekuriGroups.push(nos);
      }
    });
    const ekuriMap = new Map<number, number>();
    ekuriGroups.forEach((group, idx) => group.forEach((no) => ekuriMap.set(no, idx + 1)));

    const table = kosuDiv.find("table.tablesorter, table").first();
    const runners: IngestRunner[] = [];

    if (table.length) {
      const headerEls = table.find("tr").first().find("th, td").toArray();
      const headers = headerEls.map((el) => {
        const t = $(el).text().trim().replace(/\s+/g, " ").toUpperCase();
        // Turkish normalization
        return t.replace(/İ/g, "I").replace(/Ğ/g, "G").replace(/Ü/g, "U")
                .replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C");
      });

      const col = (matcher: (h: string) => boolean) => headers.findIndex(matcher);

      const iNo      = col((h) => h === "N");
      const iName    = col((h) => h.includes("AT ISM") || h.includes("AT ADI"));
      const iAge     = col((h) => h === "YAS" || h === "Y" || h.startsWith("YAS"));
      const iOrigin  = col((h) => h.includes("ORIJIN") || h.includes("BABA"));
      const iWeight  = col((h) => h.includes("SIKLET") || h === "KILO");
      const iJockey  = col((h) => h === "JOKEY" || h === "JOCKEY");
      const iOwner   = col((h) => h === "SAHIP" || h.startsWith("SAHIP"));
      const iTrainer = col((h) => h.includes("ANTRENOR"));
      const iStart   = col((h) => h === "ST" || h === "START");
      const iHp      = col((h) => h === "HP");
      const iSon6    = col((h) => (h.includes("SON") && h.includes("6")) || h === "SON 6 Y.");
      const iBest    = col((h) => h.includes("EN IYI") || h.includes("E.I.D") || h.includes("ENIYI"));
      const iAgf     = col((h) => h === "AGF");

      if (iNo !== -1 && iName !== -1) {
        table.find("tbody tr").each((_, row) => {
          const cellEls = $(row).find("td").toArray();
          const cells   = cellEls.map((c) => $(c).text().trim().replace(/\s+/g, " "));
          if (cells.length < 3) return;

          const no = parseInt(cells[iNo] ?? "", 10);
          if (isNaN(no) || no < 1) return;

          const nameCellText = cells[iName] ?? "";
          const scratched = /ko[şs]maz/i.test(nameCellText);

          // At ismi: anchor'dan al, span/sup temizle
          let name = "";
          if (iName !== -1 && cellEls[iName]) {
            const nameEl = $(cellEls[iName]).find("a").first();
            if (nameEl.length) {
              const clone = nameEl.clone();
              clone.find("span, sup").remove();
              name = clone.text().trim();
            }
          }
          if (!name) name = nameCellText.split(/\s{2,}|\n/)[0] ?? "";
          name = name.replace(/\s*\(ko[şs]maz\)\s*/gi, "").trim().toUpperCase();
          if (!name) return;

          const age = iAge !== -1 ? (cells[iAge] ?? "") || undefined : undefined;

          // Pedigree
          let sire: string | undefined, dam: string | undefined, damSire: string | undefined;
          if (iOrigin !== -1 && cellEls[iOrigin]) {
            const links = $(cellEls[iOrigin]).find("a").toArray().map((a) => $(a).text().trim());
            sire = links[0] || undefined;
            dam  = links[1] || undefined;
            damSire = links[2] || undefined;
            if (!sire) {
              const raw = cells[iOrigin] ?? "";
              const [sireDam, ds] = raw.split("/").map((s) => s.trim());
              const dashIdx = (sireDam ?? "").indexOf("-");
              if (dashIdx !== -1) {
                sire = sireDam.slice(0, dashIdx).trim() || undefined;
                dam  = sireDam.slice(dashIdx + 1).trim() || undefined;
              }
              damSire = ds || undefined;
            }
          }

          const weightRaw = (cells[iWeight] ?? "").replace(",", ".");
          const weight = parseFloat(weightRaw) || undefined;

          const jockeyCell = iJockey !== -1 && cellEls[iJockey] ? $(cellEls[iJockey]).find("a").first() : null;
          const jockey = jockeyCell
            ? (jockeyCell.attr("title") || jockeyCell.text()).trim() || undefined
            : undefined;

          const ownerCell = iOwner !== -1 && cellEls[iOwner] ? $(cellEls[iOwner]).find("a").first() : null;
          const owner = ownerCell
            ? (ownerCell.attr("title") || ownerCell.text()).trim() || undefined
            : (cells[iOwner] ?? "") || undefined;

          const trainerCell = iTrainer !== -1 && cellEls[iTrainer] ? $(cellEls[iTrainer]).find("a").first() : null;
          const trainer = trainerCell ? trainerCell.text().trim() || undefined : (cells[iTrainer] ?? "") || undefined;

          const startNo = parseInt(cells[iStart] ?? "", 10) || undefined;

          const hpRaw = (cells[iHp] ?? "").replace(/[^\d]/g, "");
          const hp = hpRaw !== "" ? parseInt(hpRaw, 10) : undefined;

          let recentForm: string | undefined;
          let recentFormSurfaces: string | undefined;
          if (iSon6 !== -1 && cellEls[iSon6]) {
            const son6El = $(cellEls[iSon6]);
            const items: { pos: string; surface: string }[] = [];
            // TJK uses <font color=#996633> (Kum), #009900 (Çim), #d39b1e (Sentetik)
            son6El.find("font").each((_, el) => {
              const color = ($(el).attr("color") ?? "").replace(/^#/, "").toLowerCase();
              const posEl = $(el).find("b").first();
              const pos = (posEl.length ? posEl.text() : $(el).text()).trim().toUpperCase();
              if (!pos || pos.length > 1) return;
              const surface =
                color === "996633" ? "K" :
                color === "009900" ? "C" :
                color === "d39b1e" ? "S" : "";
              items.push({ pos, surface });
            });
            if (items.length > 0) {
              recentForm = items.map((x) => x.pos).join("");
              recentFormSurfaces = items.map((x) => x.surface || " ").join("");
            } else {
              recentForm = [...son6El.text().replace(/\s/g, "")].filter((c) => /[\dK]/i.test(c)).join("") || undefined;
            }
          }

          let bestTime: string | undefined;
          if (iBest !== -1 && cellEls[iBest]) {
            const dereceEl = $(cellEls[iBest]);
            const timeSpan = dereceEl.find("#aciklamaFancyDrc").first();
            const timeText = (timeSpan.find("font").text().trim() || timeSpan.text().trim()).replace(/\s+/g, " ");
            if (timeText && /\d/.test(timeText)) {
              const href = dereceEl.find("a.tooltiptextt").attr("href") ?? "";
              const dateM = href.match(/QueryParameter_Tarih=([^#&]+)/i);
              const dateStr = dateM ? decodeURIComponent(dateM[1]) : "";
              bestTime = dateStr ? `${timeText} - ${dateStr}` : timeText;
            }
          }

          let agf: number | undefined;
          if (iAgf !== -1 && cellEls[iAgf]) {
            const agfEl = $(cellEls[iAgf]).find("a").first();
            const agfRaw = (agfEl.attr("title") || agfEl.text() || (cells[iAgf] ?? "")).trim();
            const agfMatch = agfRaw.match(/([\d]+[.,]?[\d]*)/);
            agf = agfMatch ? parseFloat(agfMatch[1].replace(",", ".")) || undefined : undefined;
          }

          const ekuriGroup = ekuriMap.get(no) ?? undefined;

          runners.push({ no, name, age, startNo, weight, jockey, owner, trainer, sire, dam, damSire, agf, recentForm, recentFormSurfaces, hp, bestTime, scratched, ekuriGroup });
        });
      }
    }

    if (runners.length > 0) {
      races.push({
        raceNo: meta.raceNo,
        time: meta.time || undefined,
        classType,
        breed,
        surface,
        distance,
        runners,
        gallops: [],
      });
    }
  });

  if (races.length === 0) return null;

  const date = parseDate(tjkDate);
  const slug = toSlug(city.sehirAdi);

  return {
    date,
    hippodromeSlug: slug,
    hippodromeName: city.sehirAdi,
    races,
  };
}

// ── 3. Full ingest for a date ───────────────────────────────────────────────

export type IngestCityResult = {
  sehirId: number;
  sehirAdi: string;
  ok: boolean;
  races: number;
  runners: number;
  error?: string;
};

export async function ingestDate(
  tjkDate: string
): Promise<{ date: string; cities: IngestCityResult[] }> {
  const { persistRaceDays } = await import("./base");

  const cities = await discoverTurkishCities(tjkDate);
  const results: IngestCityResult[] = [];

  for (const city of cities) {
    try {
      const raceDay = await fetchCityProgram(city, tjkDate);
      if (!raceDay) {
        results.push({ ...city, ok: false, races: 0, runners: 0, error: "No data" });
        continue;
      }

      await persistRaceDays([raceDay]);

      const runners = raceDay.races.reduce((sum, r) => sum + r.runners.length, 0);
      results.push({ ...city, ok: true, races: raceDay.races.length, runners });
    } catch (err) {
      results.push({ ...city, ok: false, races: 0, runners: 0, error: String(err) });
    }

    // Polite delay between cities
    await new Promise((r) => setTimeout(r, 400));
  }

  return { date: tjkDate, cities: results };
}
