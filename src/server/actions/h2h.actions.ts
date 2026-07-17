"use server";

import { db } from "@/lib/db";
import { fetchTjkAtKosuBilgileri, type TjkAtKosuRow } from "@/server/services/ingest/tjk-at-performans.adapter";

export type H2HResult = {
  horseName: string;
  finishPos: string;
  weight: string;
  jockey: string;
  equipment: string;
  time: string;
  hp: string;
};

export type H2HEncounter = {
  key: string;
  date: string; // TJK formatı: "15.07.2026"
  hippodrome: string;
  raceNo: string;
  results: H2HResult[];
};

function parseTjkDate(d: string): number {
  const [dd, mm, yyyy] = d.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd).getTime();
}

/**
 * Bu koşudaki atların TJK resmi yarış geçmişinden (AtKosuBilgileri), en az ikisinin aynı
 * tarih + hipodrom + koşu numarasında birlikte koştuğu geçmiş karşılaşmaları döner.
 * Sadece "aynı pist/mesafede koşmuş olmak" yetmez — anahtar tam olarak aynı yarışta
 * bulunmuş olmayı garanti eder.
 */
export async function getH2HForRace(raceId: string): Promise<H2HEncounter[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { runners: { select: { name: true, tjkAtId: true } } },
  });
  if (!race) return [];

  const withTjkId = race.runners.filter((r) => r.tjkAtId != null);
  if (withTjkId.length < 2) return [];

  const histories = await Promise.all(
    withTjkId.map(async (r) => {
      try {
        const rows = await fetchTjkAtKosuBilgileri(r.tjkAtId!);
        return { name: r.name, rows };
      } catch {
        return { name: r.name, rows: [] as TjkAtKosuRow[] };
      }
    })
  );

  // yarış_anahtarı = tarih + şehir + koşu_no — aynı at aynı anahtarda birden fazla
  // görünmesin diye horseName bazında da dedupe edilir.
  const byKey = new Map<string, { date: string; city: string; raceNo: string; entries: { horseName: string; row: TjkAtKosuRow }[] }>();

  for (const h of histories) {
    for (const row of h.rows) {
      if (!row.raceNo || !row.date || !row.city) continue;
      const key = `${row.date}|${row.city}|${row.raceNo}`;
      const entry = byKey.get(key) ?? { date: row.date, city: row.city, raceNo: row.raceNo, entries: [] };
      if (!entry.entries.some((e) => e.horseName === h.name)) {
        entry.entries.push({ horseName: h.name, row });
      }
      byKey.set(key, entry);
    }
  }

  const encounters: H2HEncounter[] = [];
  for (const [key, v] of byKey) {
    if (v.entries.length < 2) continue;
    encounters.push({
      key,
      date: v.date,
      hippodrome: v.city,
      raceNo: v.raceNo,
      results: v.entries
        .map((e) => ({
          horseName: e.horseName,
          finishPos: e.row.finishPos,
          weight: e.row.weight,
          jockey: e.row.jockey,
          equipment: e.row.equipment,
          time: e.row.time,
          hp: e.row.hp,
        }))
        .sort((a, b) => {
          const an = parseInt(a.finishPos, 10);
          const bn = parseInt(b.finishPos, 10);
          if (isNaN(an) && isNaN(bn)) return 0;
          if (isNaN(an)) return 1;
          if (isNaN(bn)) return -1;
          return an - bn;
        }),
    });
  }

  return encounters.sort((a, b) => parseTjkDate(b.date) - parseTjkDate(a.date)).slice(0, 15);
}
