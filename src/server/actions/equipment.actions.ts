"use server";

import { db } from "@/lib/db";
import { fetchTjkAtKosuBilgileri, type TjkAtKosuRow } from "@/server/services/ingest/tjk-at-performans.adapter";

// Doğrulanmış TJK takı kodları (canlı sayfalardan gözlemlenmiştir). Bilinmeyen bir kod
// gelirse ham kod olduğu gibi gösterilir, uydurma bir açıklama üretilmez.
const EQUIPMENT_LABELS: Record<string, string> = {
  K: "Kulaklık",
  KG: "Kapalı Gözlük",
  DB: "Dil Bağı",
  SK: "Starta Kulaklıkla",
  GKR: "Göz Koruyucu",
};

function labelFor(code: string): string {
  return EQUIPMENT_LABELS[code] ?? code;
}

function toCodes(raw: string | null): string[] {
  return (raw ?? "").split(",").map((s) => s.trim()).filter(Boolean);
}

function parseTjkDate(d: string): number {
  const [dd, mm, yyyy] = d.split(".").map(Number);
  return new Date(yyyy, mm - 1, dd).getTime();
}

function mostRecent(rows: TjkAtKosuRow[]): TjkAtKosuRow | undefined {
  return [...rows].sort((a, b) => parseTjkDate(b.date) - parseTjkDate(a.date))[0];
}

export type EquipmentItem = { code: string; label: string };

export type EquipmentChangeData = {
  runnerNo: number;
  horseName: string;
  current: EquipmentItem[];
  added: EquipmentItem[];
  removed: EquipmentItem[];
  lastRaceDate: string | null;
  hasTjkId: boolean;
};

/**
 * Bugünün programındaki takı bilgisini (zaten scrape ediliyor), her atın TJK'daki en
 * güncel geçmiş koşusunun takı bilgisiyle karşılaştırıp yeni eklenen/çıkarılan takıları
 * bulur. Sadece takısı olan VEYA bir değişiklik gösteren atlar döndürülür.
 */
export async function getEquipmentChangesForRace(raceId: string): Promise<EquipmentChangeData[]> {
  const race = await db.race.findUnique({
    where: { id: raceId },
    select: { runners: { select: { no: true, name: true, equipment: true, tjkAtId: true } } },
  });
  if (!race) return [];

  const results = await Promise.all(
    race.runners.map(async (r): Promise<EquipmentChangeData> => {
      const currentCodes = toCodes(r.equipment);
      const current = currentCodes.map((code) => ({ code, label: labelFor(code) }));

      if (!r.tjkAtId) {
        return { runnerNo: r.no, horseName: r.name, current, added: [], removed: [], lastRaceDate: null, hasTjkId: false };
      }

      try {
        const history = await fetchTjkAtKosuBilgileri(r.tjkAtId);
        const last = mostRecent(history);
        if (!last) {
          return { runnerNo: r.no, horseName: r.name, current, added: [], removed: [], lastRaceDate: null, hasTjkId: true };
        }
        const pastCodes = toCodes(last.equipment);
        const added = currentCodes.filter((c) => !pastCodes.includes(c)).map((code) => ({ code, label: labelFor(code) }));
        const removed = pastCodes.filter((c) => !currentCodes.includes(c)).map((code) => ({ code, label: labelFor(code) }));
        return { runnerNo: r.no, horseName: r.name, current, added, removed, lastRaceDate: last.date, hasTjkId: true };
      } catch {
        return { runnerNo: r.no, horseName: r.name, current, added: [], removed: [], lastRaceDate: null, hasTjkId: true };
      }
    })
  );

  return results.filter((r) => r.current.length > 0 || r.added.length > 0 || r.removed.length > 0);
}
