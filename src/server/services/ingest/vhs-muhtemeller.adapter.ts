/**
 * TJK'nın canlı "Muhtemeller" (probable ganyan oranları) veri akışı — vhs.ebayi.org'un
 * kendi istemcisi de aynı kaynağı ~30 saniyede bir yokluyor. Tarayıcıdan doğrudan erişim
 * CORS'la sadece vhs.ebayi.org origin'ine açık olduğu için sunucu tarafında proxy'liyoruz.
 */

import { request } from "undici";

const CDN = "https://vhs-medya-cdn.ebayi.org/muhtemeller/s";
const ORIGIN = "https://vhs-medya.ebayi.org/muhtemeller/s";

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const { statusCode, body } = await request(url, {
      headers: { "User-Agent": "Mozilla/5.0", Referer: "https://vhs.ebayi.org/" },
    });
    if (statusCode !== 200) return null;
    return (await body.json()) as T;
  } catch {
    return null;
  }
}

/** TJK hipodrom adını vhs.ebayi.org'un kullandığı KEY formatına çevirir (Türkçe karakter→ASCII, 10 karaktere kırpılır). */
export function toMuhtemellerKey(name: string): string {
  const ascii = name
    .replace(/Ğ/g, "G").replace(/ğ/g, "g")
    .replace(/Ü/g, "U").replace(/ü/g, "u")
    .replace(/Ş/g, "S").replace(/ş/g, "s")
    .replace(/İ/g, "I").replace(/ı/g, "i")
    .replace(/Ö/g, "O").replace(/ö/g, "o")
    .replace(/Ç/g, "C").replace(/ç/g, "c")
    .toUpperCase()
    .replace(/[^A-Z]/g, "");
  return ascii.slice(0, 10);
}

type ChecksumResponse = {
  success: boolean;
  day: string;
  sonuclar: string;
  checksum: string;
  date: string;
  runs: Record<string, [string, string]>;
};

export type MuhtemelOdds = { no: string; ganyan: string | null; running: boolean };
export type RaceMuhtemeller = {
  raceNo: number;
  pist: string | null;
  saat: string | null;
  durum: string | null;
  timestamp: number | null;
  odds: MuhtemelOdds[];
} | null;

function toTjkPathDate(dateStr: string): string {
  const [y, m, d] = dateStr.split("-");
  return `${y}/${m}/${d}`;
}

export type RunnerSnapshot = {
  hippodromeName: string;
  hippodromeSlug: string;
  raceNo: number;
  no: number;
  name: string;
  ganyan: string | null;
  running: boolean;
};

type HippodromeInput = { name: string; slug: string; races: { raceNo: number; runners: { no: number; name: string }[] }[] };

/** Günün tüm koşularını tek checksum çekişiyle, paralel olarak alır. Hipodrom+koşu+at bazında flat liste döner. */
export async function fetchAllDayMuhtemeller(dateStr: string, hippodromes: HippodromeInput[]): Promise<RunnerSnapshot[]> {
  const path = toTjkPathDate(dateStr);
  const checksum = await fetchJson<ChecksumResponse>(`${ORIGIN}/${path}/checksum.json`);
  if (!checksum?.runs) return [];

  type RaceJob = { hippodromeName: string; hippodromeSlug: string; raceNo: number; key: string; pair: [string, string]; runners: { no: number; name: string }[] };
  const jobs: RaceJob[] = [];

  for (const h of hippodromes) {
    const key = toMuhtemellerKey(h.name);
    for (const race of h.races) {
      const pair = checksum.runs[`${key}-${race.raceNo}`];
      if (!pair) continue;
      jobs.push({ hippodromeName: h.name, hippodromeSlug: h.slug, raceNo: race.raceNo, key, pair, runners: race.runners });
    }
  }

  const results = await Promise.all(
    jobs.map(async (job) => {
      for (const hash of job.pair) {
        const url = `${CDN}/${path}/${job.key}-${job.raceNo}-${hash}.json`;
        const json = await fetchJson<{ success: boolean; data?: { muhtemeller?: { bahisler?: { B: string; isGanyan?: boolean; muhtemeller: { S1: string; G?: string; K?: boolean }[] }[] } } }>(url);
        const m = json?.data?.muhtemeller;
        if (!m) continue;
        const ganyan = m.bahisler?.find((b) => b.isGanyan || b.B === "GANYAN");
        if (!ganyan) continue;
        return ganyan.muhtemeller
          .map((o) => {
            const runner = job.runners.find((r) => String(r.no) === o.S1);
            return {
              hippodromeName: job.hippodromeName,
              hippodromeSlug: job.hippodromeSlug,
              raceNo: job.raceNo,
              no: Number(o.S1),
              name: runner?.name ?? `#${o.S1}`,
              ganyan: o.K ? null : (o.G ?? null),
              running: !o.K,
            } satisfies RunnerSnapshot;
          })
          .filter((s) => s.running && s.ganyan !== null);
      }
      return [] as RunnerSnapshot[];
    })
  );

  return results.flat();
}

/** Bir hipodrom+koşu için TJK'nın canlı ganyan muhtemel oranlarını çeker — değişmediyse de aynı veriyi tazeler. */
export async function fetchRaceMuhtemeller(
  dateStr: string,
  hippodromeName: string,
  raceNo: number
): Promise<RaceMuhtemeller> {
  const path = toTjkPathDate(dateStr);
  const checksum = await fetchJson<ChecksumResponse>(`${ORIGIN}/${path}/checksum.json`);
  if (!checksum?.runs) return null;

  const key = toMuhtemellerKey(hippodromeName);
  const pair = checksum.runs[`${key}-${raceNo}`];
  if (!pair) return null;

  for (const hash of pair) {
    const url = `${CDN}/${path}/${key}-${raceNo}-${hash}.json`;
    const json = await fetchJson<{
      success: boolean;
      data?: {
        muhtemeller?: {
          NO: string;
          PIST?: string;
          SAAT?: string;
          DURUM?: string;
          timestamp?: number;
          bahisler?: { B: string; isGanyan?: boolean; muhtemeller: { S1: string; G?: string; K?: boolean }[] }[];
        };
      };
    }>(url);

    const m = json?.data?.muhtemeller;
    if (!m) continue;

    const ganyan = m.bahisler?.find((b) => b.isGanyan || b.B === "GANYAN");
    if (!ganyan) continue;

    return {
      raceNo,
      pist: m.PIST ?? null,
      saat: m.SAAT ?? null,
      durum: m.DURUM ?? null,
      timestamp: m.timestamp ?? null,
      odds: ganyan.muhtemeller.map((o) => ({ no: o.S1, ganyan: o.K ? null : o.G ?? null, running: !o.K })),
    };
  }

  return null;
}
