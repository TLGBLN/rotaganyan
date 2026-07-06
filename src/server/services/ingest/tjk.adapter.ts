/**
 * TJK (Türkiye Jokey Kulübü) adapter
 *
 * Scrapes TJK.org server-rendered HTML.
 * TJK does not expose a public API; all data is in standard HTML.
 *
 * Verified working URLs (2026-06):
 *   City discovery: /TR/YarisSever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=DD/MM/YYYY
 *     -> lists same-day city tabs as <a data-sehir-id="N">CityName</a>
 *   Full city program (race + runner tables, no separate "bülten" fetch needed):
 *     /TR/YarisSever/Info/Sehir/GunlukYarisProgrami?SehirId=N&QueryParameter_Tarih=DD/MM/YYYY&SehirAdi=...&Era=today
 *     -> each race is a `div.race-details` (h3.race-no, h3.race-config) followed by a `table.tablesorter`
 *
 * Note: the previously assumed `/Query/Page/GunlukYarisProgrami` and `/Query/Page/IdmanSonuclari`
 * (gallop results) endpoints both 404 — TJK appears to have retired them. Gallop ingestion is a
 * no-op until a working replacement endpoint is found.
 */

import { request } from "undici";
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { DataProvider } from "./base";
import type { IngestRaceDay, IngestRace, IngestRunner } from "./types";
import type { Breed, Surface } from "@prisma/client";

const BASE = "https://www.tjk.org";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://www.tjk.org/",
};

// Only ingest Turkish hippodromes — the day's tab list also includes foreign
// simulcast fixtures (Chantilly, Gulfstream Park, San Isidro, …) that don't fit our schema.
const TURKISH_CITY_SLUGS: Record<string, string> = {
  "İSTANBUL": "istanbul",
  ISTANBUL: "istanbul",
  ANKARA: "ankara",
  BURSA: "bursa",
  "İZMİR": "izmir",
  IZMIR: "izmir",
  ADANA: "adana",
  "ELAZIĞ": "elazig",
  ELAZIG: "elazig",
  KONYA: "konya",
  "DİYARBAKIR": "diyarbakir",
  DIYARBAKIR: "diyarbakir",
  SAKARYA: "sakarya",
  "BALIKESİR": "balikesir",
  BALIKESIR: "balikesir",
  "ŞANLIURFA": "sanliurfa",
  SANLIURFA: "sanliurfa",
  KARMA: "karma",
};

function parseBreed(text: string): Breed {
  return text.toUpperCase().includes("ARAP") ? "ARAP" : "INGILIZ";
}

function parseSurface(text: string): Surface {
  const t = text.toLowerCase();
  if (t.includes("çim") || t.includes("cim")) return "CIM";
  if (t.includes("sentet")) return "SENTETIK";
  return "KUM";
}

function toDmy(date: Date): string {
  const d = String(date.getUTCDate()).padStart(2, "0");
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const y = date.getUTCFullYear();
  return `${d}/${m}/${y}`;
}

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

/** Cleans cell text: collapses internal whitespace/newlines from tooltip spans etc. */
function cleanCell(raw: string): string {
  return raw.replace(/\s+/g, " ").trim();
}

const TR_MAP: Record<string, string> = {
  İ: "I", I: "I", ı: "i", Ğ: "G", ğ: "g", Ü: "U", ü: "u",
  Ş: "S", ş: "s", Ö: "O", ö: "o", Ç: "C", ç: "c",
};

/** Uppercases Turkish text into a plain-ASCII-letter form so column-header matching
 * doesn't trip over dotted/dotless İ-I quirks in JS's locale-naive toUpperCase(). */
function normTr(s: string): string {
  return s.replace(/[İIığĞüÜşŞöÖçÇ]/g, (c) => TR_MAP[c] ?? c).toUpperCase();
}

/** "1. Koşu 17.45 (İstanbul 8. Koşu)" -> { raceNo: 1, time: "17:45", sourceRace: "İstanbul 8. Koşu" } */
function parseRaceNoTime(text: string): { raceNo: number; time?: string; sourceRace?: string } | null {
  const clean = cleanCell(text);
  const m = clean.match(/(\d+)\.\s*Ko[şs]u\s*(\d{1,2})[.:](\d{2})/i);
  if (!m) return null;
  const sourceMatch = clean.match(/\(([^)]+\d+\.\s*Ko[şs]u[^)]*)\)/i);
  return {
    raceNo: parseInt(m[1], 10),
    time: `${m[2].padStart(2, "0")}:${m[3]}`,
    sourceRace: sourceMatch ? sourceMatch[1].trim() : undefined,
  };
}

/** "Handikap 15 /H1 , 3 ve Yukarı İngilizler, 2100 Sentetik" -> race config fields */
function parseRaceConfig(text: string): {
  classType: string;
  breed: Breed;
  surface: Surface;
  distance: number;
} {
  const clean = cleanCell(text);
  const classType = clean.split(",")[0]?.trim() || "—";
  const distanceMatch = clean.match(/\b(\d{3,4})\b/);
  const distance = distanceMatch ? parseInt(distanceMatch[1], 10) : 1200;
  return {
    classType,
    breed: parseBreed(clean),
    surface: parseSurface(clean),
    distance,
  };
}

/** "AIR VICE MARSHAL (USA)-MELODY MAKER / VICTORY GALLOP (CAN)" -> sire/dam/damSire */
function parsePedigree(raw: string): { sire?: string; dam?: string; damSire?: string } {
  const clean = cleanCell(raw);
  if (!clean) return {};
  const [sireDam, damSire] = clean.split("/").map((s) => s.trim());
  const dashIdx = sireDam?.indexOf("-") ?? -1;
  if (dashIdx === -1) return { damSire: damSire || undefined };
  return {
    sire: sireDam.slice(0, dashIdx).trim() || undefined,
    dam: sireDam.slice(dashIdx + 1).trim() || undefined,
    damSire: damSire || undefined,
  };
}

function parseEkuriGroups($: cheerio.CheerioAPI, context: cheerio.Cheerio<AnyNode>): Map<number, number> {
  const groups: number[][] = [];
  const clone = context.clone();
  clone.find("table").remove();
  const text = clone.text().replace(/\s+/g, " ");
  if (/ek[uü]ri/i.test(text)) {
    const matches = [...text.matchAll(/\[([^\]]+)\]/g)];
    for (const m of matches) {
      const nos = [...m[1].matchAll(/\((\d+)\)/g)].map((x) => parseInt(x[1], 10));
      if (nos.length >= 2) groups.push(nos);
    }
  }
  const map = new Map<number, number>();
  groups.forEach((g, idx) => g.forEach((no) => map.set(no, idx + 1)));
  return map;
}

function parseRunnersTable(
  $: cheerio.CheerioAPI,
  table: cheerio.Cheerio<AnyNode>,
  ekuriMap: Map<number, number> = new Map()
): IngestRunner[] {
  const headerEls = table.find("tr").first().find("th, td").toArray();
  const headers = headerEls.map((el) => cleanCell($(el).text()));

  const col = (matcher: (h: string) => boolean) =>
    headers.findIndex((h) => matcher(normTr(h)));

  const iNo      = col((h) => h === "N");
  const iName    = col((h) => h.includes("AT ISMI") || h.includes("AT ISM"));
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

  if (iNo === -1 || iName === -1) return [];

  const runners: IngestRunner[] = [];
  table.find("tr").each((_, row) => {
    const cellEls = $(row).find("td").toArray();
    const cells   = cellEls.map((c) => $(c).text());
    if (cells.length < 3) return;

    const no = parseInt(cleanCell(cells[iNo] ?? ""), 10);
    const firstSegment = (raw: string) => cleanCell((raw ?? "").trim().split(/\s{2,}|\n/)[0] ?? "");

    // Scratched detection
    const nameCellText = cells[iName] ?? "";
    const scratched = /ko[şs]maz/i.test(nameCellText);
    const name = firstSegment(nameCellText)
      .replace(/\s*\(ko[şs]maz\)\s*/gi, "")
      .toUpperCase();
    if (isNaN(no) || !name) return;

    const age = iAge !== -1 ? cleanCell(cells[iAge] ?? "") || undefined : undefined;
    const pedigree = iOrigin !== -1 ? parsePedigree(cells[iOrigin] ?? "") : {};
    const weight = iWeight !== -1 ? parseFloat(cleanCell(cells[iWeight] ?? "").replace(",", ".")) : undefined;
    const jockey = iJockey !== -1 ? firstSegment(cells[iJockey] ?? "") || undefined : undefined;
    const owner  = iOwner !== -1 ? cleanCell(cells[iOwner] ?? "").split(/\s{2,}|\n/)[0]?.trim() || undefined : undefined;
    const trainer = iTrainer !== -1 ? cleanCell(cells[iTrainer] ?? "") || undefined : undefined;
    const startNo = iStart !== -1 ? parseInt(cleanCell(cells[iStart] ?? ""), 10) : undefined;

    const hpRaw = iHp !== -1 ? cleanCell(cells[iHp] ?? "").replace(/[^\d]/g, "") : "";
    const hp = hpRaw !== "" ? parseInt(hpRaw, 10) : undefined;

    // Son 6 Yarış — TJK uses <font color> for surface: #996633=Kum, #009900=Çim, #d39b1e=Sentetik
    let recentForm: string | undefined;
    let recentFormSurfaces: string | undefined;
    if (iSon6 !== -1 && cellEls[iSon6]) {
      const son6El = $(cellEls[iSon6]);
      const items: { pos: string; surface: string }[] = [];
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

    // En İyi Derece — zaman #aciklamaFancyDrc span'dan, tarih href'ten
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

    // Extract % value to avoid matching "1" from "1. 6'LI GANYAN" prefix in title
    let agf: number | undefined;
    if (iAgf !== -1 && cellEls[iAgf]) {
      const agfEl = $(cellEls[iAgf]).find("a").first();
      const agfTitle = agfEl.attr("title") ?? "";
      const agfText = agfEl.text().trim();
      const agfSrc = agfTitle || agfText;
      const agfMatch = agfSrc.match(/%\s*([\d]+[.,]?\d*)/);
      agf = agfMatch ? parseFloat(agfMatch[1].replace(",", ".")) || undefined : undefined;
    }

    const ekuriGroup = ekuriMap.get(no) ?? undefined;

    runners.push({
      no,
      name,
      age,
      ...pedigree,
      weight: weight != null && !isNaN(weight) ? weight : undefined,
      jockey,
      owner,
      trainer,
      startNo: startNo != null && !isNaN(startNo) ? startNo : undefined,
      hp,
      recentForm,
      recentFormSurfaces,
      bestTime,
      agf: agf != null && !isNaN(agf) ? agf : undefined,
      scratched,
      ekuriGroup,
    });
  });
  return runners;
}

/** Discovers same-day city tabs: [{ sehirId, name }]. Filtered to Turkish hippodromes by caller. */
async function fetchCityTabs(dmy: string): Promise<{ sehirId: string; name: string }[]> {
  const url = `${BASE}/TR/YarisSever/Info/Page/GunlukYarisProgrami?QueryParameter_Tarih=${encodeURIComponent(dmy)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const tabs: { sehirId: string; name: string }[] = [];
  $("a[data-sehir-id]").each((_, el) => {
    const sehirId = $(el).attr("data-sehir-id");
    const name = cleanCell($(el).text()).replace(/\(.*\)\s*$/, "").trim();
    if (sehirId && name) tabs.push({ sehirId, name });
  });
  return tabs;
}

async function fetchCityProgram(
  sehirId: string,
  cityName: string,
  dmy: string
): Promise<IngestRace[]> {
  const url =
    `${BASE}/TR/YarisSever/Info/Sehir/GunlukYarisProgrami` +
    `?SehirId=${sehirId}&QueryParameter_Tarih=${encodeURIComponent(dmy)}` +
    `&SehirAdi=${encodeURIComponent(cityName)}&Era=today`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const races: IngestRace[] = [];
  $("div.race-details").each((_, detailsEl) => {
    const details = $(detailsEl);
    const noTimeText = details.find("h3.race-no").first().text();
    const noTime = parseRaceNoTime(noTimeText);
    if (!noTime) return;

    const config = parseRaceConfig(details.find("h3.race-config").first().text());

    // The runner table lives in the sibling div#kosubilgisi-{raceId}.
    const raceId = details.parent().attr("id") ?? "";
    const kosuDiv = $(`#kosubilgisi-${raceId}`);
    const table = kosuDiv.find("table.tablesorter").first();
    const ekuriMap = table.length ? parseEkuriGroups($, kosuDiv) : new Map<number, number>();
    const runners = table.length ? parseRunnersTable($, table, ekuriMap) : [];

    races.push({
      raceNo: noTime.raceNo,
      time: noTime.time,
      classType: config.classType,
      breed: config.breed,
      surface: config.surface,
      distance: config.distance,
      conditions: noTime.sourceRace,
      runners,
      gallops: [],
    });
  });
  return races;
}

export class TjkAdapter implements DataProvider {
  readonly name = "TJK";

  async fetchRaceDays(date?: Date): Promise<IngestRaceDay[]> {
    const target = date ?? new Date();
    const dmy = toDmy(target);

    const tabs = await fetchCityTabs(dmy);
    // normTr kullan: JS'in toUpperCase() "i"→"I" yapar ama "İ"→"İ" yapar,
    // dolayısıyla "İzmir".toUpperCase() = "İZMIR" (noktalı+normal I karışık).
    // normTr ise tüm Türkçe harfleri ASCII'ye normalize eder → "IZMIR" doğru eşleşir.
    const turkishTabs = tabs.filter((t) => TURKISH_CITY_SLUGS[normTr(t.name)]);
    if (turkishTabs.length === 0) return [];

    const raceDays: IngestRaceDay[] = [];
    for (const tab of turkishTabs) {
      try {
        const races = await fetchCityProgram(tab.sehirId, tab.name, dmy);
        if (races.length === 0) continue;
        raceDays.push({
          date: target,
          hippodromeSlug: TURKISH_CITY_SLUGS[normTr(tab.name)],
          hippodromeName: tab.name,
          races,
        });
      } catch {
        // One city failing shouldn't block the others.
        continue;
      }
    }
    return raceDays;
  }
}
