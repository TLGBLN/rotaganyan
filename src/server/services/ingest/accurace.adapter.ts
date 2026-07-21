/**
 * Accurace.net — GPS/sektörel zamanlama sağlayıcısı. TJK'nın resmi sitesi yalnız
 * bitiş derecesi/ganyan veriyor; ara mesafe (100m'lik her checkpoint) geçiş süresi
 * ve o andaki sıra HİÇBİR TJK sayfasında yok — yalnız Accurace'de var.
 *
 * URL: https://accurace.net/network/{YYYY-MM-DD}/{ŞEHİR-BÜYÜK-HARF-ASCII}/{koşuNo}
 * Sayfa Nuxt 3 SSR — veri <script id="__NUXT_DATA__"> içinde devalue-benzeri bir
 * "referansla dizi" formatında geliyor (her değer data[] içindeki bir index'e işaret
 * ediyor, Vue'nun ShallowReactive/Reactive sarmalayıcılarıyla). resolveNuxtPayload
 * bunu normal iç içe JSON'a çözer.
 *
 * "official" alanı TJK'nın resmi (Accurace'in KENDİ ölçümü DEĞİL) bitiş dereceleridir —
 * sayfanın kendi uyarısı: "Accurace tarafından ölçülmüş resmi olmayan derecelerdir".
 */

import { request } from "undici";

const HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36",
  "Accept-Language": "tr-TR,tr;q=0.9,en;q=0.8",
  Referer: "https://accurace.net/",
};

export type AccuraceCheckpoint = { checkpoint: number; time: string; time_format: string; place: number };
export type AccuraceHorse = {
  horse_name: string;
  horse_number: number;
  place: number;
  time: string; // "HH:MM.SSS" — finish, crossing_time_total_format
  checkpoint: AccuraceCheckpoint[];
};
export type AccuraceRaceMeta = {
  city: string;
  date: string; // "DD.MM.YYYY"
  length: number;
  ground: string;
  time: string;
  hippodrome: string;
  finish: string;
};
export type AccuraceRaceData = {
  isActive: boolean;
  race: AccuraceRaceMeta;
  horse: AccuraceHorse[];
  official: string[]; // TJK resmi bitiş dereceleri, sırayla (1.den sonuncuya)
};

// Vue'nun reaktivite sarmalayıcıları — tek bir iç referansı sarar, açılırken atlanır.
const WRAP_TAGS = new Set(["Reactive", "ShallowReactive", "Ref", "ShallowRef", "EmptyRef", "EmptyShallowRef"]);

/** Nuxt'ın __NUXT_DATA__ "referansla dizi" formatını normal iç içe nesneye çözer. */
function resolveNuxtPayload(data: unknown[]): unknown {
  const cache = new Map<number, unknown>();
  function resolve(i: unknown): unknown {
    if (typeof i !== "number") return i;
    if (cache.has(i)) return cache.get(i);
    const v = data[i];
    if (v === null || typeof v !== "object") return v;
    if (Array.isArray(v)) {
      if (v.length === 2 && typeof v[0] === "string" && WRAP_TAGS.has(v[0])) {
        return resolve(v[1]);
      }
      const arr: unknown[] = [];
      cache.set(i, arr);
      for (const idx of v) arr.push(resolve(idx));
      return arr;
    }
    const obj: Record<string, unknown> = {};
    cache.set(i, obj);
    for (const [k, idx] of Object.entries(v as Record<string, unknown>)) obj[k] = resolve(idx);
    return obj;
  }
  return resolve(1);
}

function extractNuxtData(html: string): unknown[] | null {
  const m = html.match(
    /<script type="application\/json" data-nuxt-data="nuxt-app" data-ssr="true" id="__NUXT_DATA__"[^>]*>([\s\S]*?)<\/script>/
  );
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

// TJK hipodrom isimlerini Accurace'in URL'deki büyük-harf-ASCII şehir koduna çevirir
// (İ→I, ı→I, ş→S, vb. — tjk-info.adapter.ts'teki toSlug ile aynı katlama, büyük harf).
export function toAccuraceCitySlug(hippodromeName: string): string {
  return hippodromeName
    .replace(/Ğ/g, "G")
    .replace(/ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/ş/g, "S")
    .replace(/İ/g, "I")
    .replace(/ı/g, "I")
    .replace(/Ö/g, "O")
    .replace(/ö/g, "O")
    .replace(/Ç/g, "C")
    .replace(/ç/g, "C")
    .toUpperCase()
    .replace(/\s*\d+\.\s*YIL\s*HİPODROMU?/i, "")
    .replace(/\s*HİPODROMU?/i, "")
    .trim();
}

/** Accurace'in "MM:SS.mmm" (örn. "02:26.723") kümülatif zaman biçimini ms'ye çevirir. */
export function parseAccuraceTimeToMs(t: string): number | null {
  const m = t.match(/^(\d+):(\d{2})\.(\d+)$/);
  if (!m) return null;
  const [, mm, ss, ms] = m;
  return (parseInt(mm, 10) * 60 + parseInt(ss, 10)) * 1000 + parseInt(ms.padEnd(3, "0").slice(0, 3), 10);
}

async function fetchHtml(url: string): Promise<string> {
  const { statusCode, body } = await request(url, {
    headers: HEADERS,
    headersTimeout: 15_000,
    bodyTimeout: 15_000,
  });
  if (statusCode !== 200) throw new Error(`HTTP ${statusCode}: ${url}`);
  return body.text();
}

/**
 * Bir koşunun tam sektörel zamanlama verisini çeker. Yarış henüz koşulmadıysa veya
 * Accurace bu koşuyu (henüz) işlememişse `null` döner — hata değildir, normaldir.
 */
export async function fetchAccuraceRace(
  dateStr: string,
  citySlug: string,
  raceNo: number
): Promise<AccuraceRaceData | null> {
  const url = `https://accurace.net/network/${dateStr}/${citySlug}/${raceNo}`;
  const html = await fetchHtml(url);
  const payload = extractNuxtData(html);
  if (!payload) return null;

  const root = resolveNuxtPayload(payload) as {
    data?: { result?: { success?: boolean; data?: { is_active?: boolean; official?: string[]; table?: { race?: AccuraceRaceMeta; horse?: AccuraceHorse[] } } } };
  };
  const result = root?.data?.result;
  if (!result?.success || !result.data?.table) return null;

  const { table, official, is_active } = result.data;
  if (!table.race || !table.horse || table.horse.length === 0) return null;

  return {
    isActive: is_active ?? false,
    race: table.race,
    horse: table.horse,
    official: official ?? [],
  };
}
