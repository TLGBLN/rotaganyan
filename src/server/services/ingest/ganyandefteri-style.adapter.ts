/**
 * ganyandefteri.com — atların "yarış stili" (kaçak/öncü/bekleme/en geri) verisi.
 * TJK'da bu veriyi yayınlayan bir sayfa yok; ganyandefteri kendi geçmiş yarış
 * sonuçlarından bu sınıflandırmayı hesaplayıp public (girişsiz) bir endpoint'te
 * sunuyor. Günlük program: /daily/programy/{YYYY-MM-DD} · Stil dağılımı (dört
 * kategorinin tam yüzdeleri, sitenin "Yarış Stili" modalıyla birebir aynı):
 * /daily/getRaceStyleStats?race_id={id}&filter=all
 *
 * NOT: Daha önce kullanılan /daily/hesapla-yaris-stili-performans endpoint'i
 * yalnızca son 3 yarışa dayalı kaba bir "kategori" döndürüyordu ve sitenin
 * kendi gösterdiği (tüm geçmişe dayalı) yüzdelerle uyuşmuyordu — bu yüzden
 * gerçek modal endpoint'ine geçildi.
 */

import { request } from "undici";
import * as cheerio from "cheerio";

const BASE = "https://ganyandefteri.com";
const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
};

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, { headers: HEADERS, headersTimeout: 10_000, bodyTimeout: 10_000 });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

async function fetchJson<T>(url: string): Promise<T> {
  const { statusCode, body } = await request(url, { headers: HEADERS, headersTimeout: 10_000, bodyTimeout: 10_000 });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.json() as Promise<T>;
}

export type GdRaceRef = {
  hippodromeSlug: string;
  raceNo: number;
  time: string;
  distance: number;
  raceId: string;
};

// Bizim DB'deki Hippodrome.slug değerleri şehir adının kendisidir (ör. "ankara", "kocaeli").
// ganyandefteri ise "Ankara 75. Yıl Hipodromu", "Kocaeli Kartepe Hipodromu" gibi tam tesis
// adları kullanır — bu yüzden basit transliterasyon yeterli değil, bilinen şehir isimlerinden
// biriyle başlayıp başlamadığına bakılır.
const KNOWN_CITY_SLUGS = [
  "istanbul", "ankara", "izmir", "bursa", "adana", "sanliurfa", "kocaeli", "elazig", "diyarbakir", "antalya",
];

function trToAscii(s: string): string {
  return s
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .toLowerCase();
}

/** "Ankara 75. Yıl Hipodromu" → "ankara" gibi bizim hipodrom slug'larımıza çevirir. Karma için null döner (atlanır). */
function toOurHippoSlug(gdName: string): string | null {
  const name = gdName.replace(/\s*Hipodromu\s*$/i, "").trim();
  if (/^karma$/i.test(name)) return null;
  if (/veliefendi/i.test(name) || /^istanbul/i.test(name)) return "istanbul";

  const ascii = trToAscii(name).replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const known = KNOWN_CITY_SLUGS.find((slug) => ascii === slug || ascii.startsWith(`${slug}-`));
  return known ?? ascii;
}

/** Verilen tarih için ganyandefteri'nin günlük programındaki tüm koşuları (hipodrom+koşu no → race_id) çözer. */
export async function fetchGanyandefteriProgramy(dateStr: string): Promise<GdRaceRef[]> {
  const html = await fetchHtml(`${BASE}/daily/programy/${dateStr}`);
  const $ = cheerio.load(html);

  const hipoNameById = new Map<string, string>();
  $(".hipodrom-tabs a[data-hipodrom-name]").each((_, el) => {
    const href = $(el).attr("href") ?? "";
    const id = href.replace(/^#/, "");
    const name = $(el).attr("data-hipodrom-name") ?? "";
    if (id && name) hipoNameById.set(id, name);
  });

  const races: GdRaceRef[] = [];
  $(".tab-content > .tab-pane[id]").each((_, hipoPane) => {
    const hipoId = $(hipoPane).attr("id") ?? "";
    const gdName = hipoNameById.get(hipoId) ?? hipoId;
    const hippodromeSlug = toOurHippoSlug(gdName);
    if (!hippodromeSlug) return;

    $(hipoPane)
      .find('.tab-pane[id^="race_"]')
      .each((_, racePane) => {
        const raceId = ($(racePane).attr("id") ?? "").replace("race_", "");
        const infoText = $(racePane).find(".race-info").first().text().replace(/\s+/g, " ").trim();
        const noMatch = infoText.match(/(\d+)\.\s*Ko[şs]u/i);
        const timeMatch = infoText.match(/(\d{1,2}:\d{2})/);
        const distMatch = infoText.match(/(\d+)\s*m\b/);
        if (raceId && noMatch) {
          races.push({
            hippodromeSlug,
            raceNo: parseInt(noMatch[1], 10),
            time: timeMatch?.[1] ?? "",
            distance: distMatch ? parseInt(distMatch[1], 10) : 0,
            raceId,
          });
        }
      });
  });

  return races;
}

// API'nin ham yanıt şekli — sitenin "Yarış Stili" modalıyla aynı dört kategori
type GdStyleRowRaw = {
  at_id: string;
  at_name: string;
  horse_number: string;
  veri: number;
  kacak: number;
  kacak_yuzde: number;
  bekleme: number;
  bekleme_yuzde: number;
  on_grup_bekleme: number;
  on_grup_bekleme_yuzde: number;
  en_arka_bekleme: number;
  en_arka_bekleme_yuzde: number;
};

export type GdStyleRow = {
  horseName: string;
  horseNumber: string;
  veri: number;
  style: string | null; // "KACAK" | "BEKLEME" | "ON_GRUP" | "EN_GERI" | null (veri yoksa)
  percent: number;
};

type GdStyleResponse = { success: boolean; atlar?: GdStyleRowRaw[]; message?: string };

/** Bir koşudaki tüm atların yarış stili dağılımını (tüm geçmişe dayalı dört kategori yüzdesi) döner. */
export async function fetchGanyandefteriRaceStyle(raceId: string): Promise<GdStyleRow[]> {
  const data = await fetchJson<GdStyleResponse>(`${BASE}/daily/getRaceStyleStats?race_id=${raceId}&filter=all`);
  if (!data.success || !data.atlar) return [];
  return data.atlar.map((r) => {
    if (!r.veri || r.veri <= 0) {
      return { horseName: r.at_name, horseNumber: r.horse_number, veri: 0, style: null, percent: 0 };
    }
    const candidates: [string, number][] = [
      ["KACAK", r.kacak_yuzde],
      ["BEKLEME", r.bekleme_yuzde],
      ["ON_GRUP", r.on_grup_bekleme_yuzde],
      ["EN_GERI", r.en_arka_bekleme_yuzde],
    ];
    const [style, percent] = candidates.reduce((best, cur) => (cur[1] > best[1] ? cur : best));
    return { horseName: r.at_name, horseNumber: r.horse_number, veri: r.veri, style, percent };
  });
}

function normHorseName(name: string): string {
  return name.replace(/\([A-Z]{2,3}\)/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}

/**
 * Verilen tarih için tüm koşulardaki atların yarış stilini ganyandefteri'den çekip
 * Runner.raceStyle alanına yazar. Kendi koşu programımızla hipodrom+koşu no üzerinden,
 * at isimleriyle eşleştirilir.
 */
export async function syncRaceStylesForDate(dateStr: string): Promise<{
  races: number;
  updated: number;
  errors: string[];
}> {
  const { db } = await import("@/lib/db");

  let gdRaces: GdRaceRef[];
  try {
    gdRaces = await fetchGanyandefteriProgramy(dateStr);
  } catch (err) {
    return { races: 0, updated: 0, errors: [String(err)] };
  }
  if (gdRaces.length === 0) return { races: 0, updated: 0, errors: [] };

  let updated = 0;
  const errors: string[] = [];

  for (const gdRace of gdRaces) {
    const race = await db.race.findFirst({
      where: {
        raceNo: gdRace.raceNo,
        conditions: null,
        raceDay: { date: new Date(`${dateStr}T00:00:00.000Z`), hippodrome: { slug: gdRace.hippodromeSlug } },
      },
      include: { runners: { select: { id: true, name: true } } },
    });
    if (!race) continue;

    let styleRows: GdStyleRow[];
    try {
      styleRows = await fetchGanyandefteriRaceStyle(gdRace.raceId);
    } catch (err) {
      errors.push(`${gdRace.hippodromeSlug} R${gdRace.raceNo}: ${String(err)}`);
      continue;
    }

    const nameToRunnerId = new Map(race.runners.map((r) => [normHorseName(r.name), r.id]));
    for (const row of styleRows) {
      if (!row.style || row.veri <= 0) continue; // yeterli geçmiş veri yok

      const runnerId = nameToRunnerId.get(normHorseName(row.horseName));
      if (!runnerId) continue;

      try {
        await db.runner.update({
          where: { id: runnerId },
          data: {
            raceStyle: {
              style: row.style,
              percent: row.percent,
              veri: row.veri,
              source: "ganyandefteri",
              updatedAt: new Date().toISOString(),
            },
          },
        });
        updated++;
      } catch (err) {
        errors.push(`${row.horseName}: ${String(err)}`);
      }
    }

    await new Promise((r) => setTimeout(r, 200));
  }

  return { races: gdRaces.length, updated, errors };
}