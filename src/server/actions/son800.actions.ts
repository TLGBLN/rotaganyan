"use server";

import { db } from "@/lib/db";
import type { PaceCheckpoint } from "@/lib/methodology/pace-analizi";

const COMBINING_MARKS_RE = /[̀-ͯ]/g;
const TRAILING_COUNTRY_CODE_RE = /\s*\([A-ZİĞÜŞÖÇ]{2,4}\)\s*$/i;
function normalizeHorseName(s: string): string {
  return s
    .replace(TRAILING_COUNTRY_CODE_RE, "")
    .toLocaleUpperCase("tr-TR")
    .normalize("NFD")
    .replace(COMBINING_MARKS_RE, "")
    .replace(/[^A-ZİĞÜŞÖÇ0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function last800SureSaniye(checkpoints: PaceCheckpoint[], length: number): number | null {
  if (length < 800) return null;
  const sorted = [...checkpoints].sort((a, b) => a.checkpoint - b.checkpoint);
  const finish = sorted[sorted.length - 1];
  if (!finish) return null;
  const nokta = [...sorted].reverse().find((c) => c.checkpoint <= length - 800);
  if (!nokta) return null;
  return (finish.timeReal - nokta.timeReal) / 1000;
}

const GROUND_LABEL: Record<string, string> = { K: "Kum", C: "Çim", S: "Sentetik" };

export type AccuraceSon800Record = {
  date: string;
  hippodrome: string;
  ground: string;
  length: number;
  place: number;
  son800Sure: string;
};
export type Son800RunnerData = { runnerNo: number; horseName: string; records: AccuraceSon800Record[] };

/**
 * Bir koşudaki tüm atların Accurace (GPS/sektörel zamanlama) geçmişinden son 800m
 * performansını döner — eskiden TJK Son800 sayfasından tek bir sayı çekiliyordu, artık
 * atın kendi checkpoint verisinden gerçek son 800m süresi hesaplanıyor (en fazla son 3 yarış).
 */
export async function getSon800ForRace(raceId: string): Promise<Son800RunnerData[]> {
  const runners = await db.runner.findMany({ where: { raceId }, orderBy: { no: "asc" }, select: { no: true, name: true } });
  if (runners.length === 0) return [];

  const splits = await db.accuraceHorseSplit.findMany({
    where: { horseName: { in: runners.map((r) => r.name) } },
    select: {
      horseName: true,
      place: true,
      checkpoints: true,
      accuraceRace: { select: { date: true, hippodrome: true, citySlug: true, ground: true, length: true } },
    },
    orderBy: { accuraceRace: { date: "desc" } },
  });

  return runners.map((r): Son800RunnerData => {
    const norm = normalizeHorseName(r.name);
    const kayitlar = splits.filter((s) => normalizeHorseName(s.horseName) === norm).slice(0, 3);
    const records: AccuraceSon800Record[] = kayitlar
      .map((k) => {
        const length = k.accuraceRace.length ?? 0;
        const sure = last800SureSaniye(k.checkpoints as unknown as PaceCheckpoint[], length);
        if (sure == null) return null;
        return {
          date: k.accuraceRace.date.toISOString().slice(0, 10).split("-").reverse().join("."),
          hippodrome: k.accuraceRace.hippodrome ?? k.accuraceRace.citySlug,
          ground: GROUND_LABEL[k.accuraceRace.ground ?? ""] ?? (k.accuraceRace.ground ?? "—"),
          length,
          place: k.place,
          son800Sure: `${sure.toFixed(2)}''`,
        };
      })
      .filter((r): r is AccuraceSon800Record => r != null);
    return { runnerNo: r.no, horseName: r.name, records };
  });
}
