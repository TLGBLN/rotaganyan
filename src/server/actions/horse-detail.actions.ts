"use server";

import { db } from "@/lib/db";
import { zeminDetayiBul, zeminDetayiSatirdanCikar, zeminKatsayisi } from "@/lib/methodology/mekanik-puanlama";
import { fetchTjkAtKosuBilgileri, type TjkAtKosuRow } from "@/server/services/ingest/tjk-at-performans.adapter";
import { fetchYurtDisiAtKosuBilgileri } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";

export type HorseHistoryEntry = {
  raceId: string;
  date: string;
  hippodrome: string;
  raceNo: number;
  distance: number;
  surface: string;
  zeminEtiketi: string | null;
  classType: string | null;
  equipment: string | null;
  jockey: string | null;
  weight: number | null;
  hp: number | null;
  agf: number | null;
  bestTime: string | null;
  scratched: boolean;
  finishPos: number | null;
};

function finishPosition(actualOrder: unknown, runnerNo: number): number | null {
  if (!Array.isArray(actualOrder)) return null;
  const idx = actualOrder.findIndex((v) => Number(v) === runnerNo);
  return idx === -1 ? null : idx + 1;
}

function toDdMmYyyy(date: Date): string {
  const d = date.getUTCDate().toString().padStart(2, "0");
  const m = (date.getUTCMonth() + 1).toString().padStart(2, "0");
  return `${d}.${m}.${date.getUTCFullYear()}`;
}

function yurtDisiDmyToIso(dmy: string): string {
  const [d, m, y] = dmy.split(".");
  return new Date(`${y}-${m.padStart(2, "0")}-${d.padStart(2, "0")}T00:00:00.000Z`).toISOString();
}

function yurtDisiSurfaceKodu(raw: string): string {
  const c = raw.trim().charAt(0).toUpperCase();
  if (c === "Ç") return "CIM";
  if (c === "S") return "SENTETIK";
  return "KUM";
}

function trSayi(raw: string): number | null {
  const n = parseFloat(raw.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

/**
 * 2026-09-29 kullanıcı bulgusu ("hani hiçbir veri yok") — yurt dışı atlar (tjkAtId hiç
 * yok, yalnız yurtDisiAtId) yukarıdaki TR akışına HİÇ girmiyordu: bizim DB'mizde henüz
 * yalnız BUGÜNKÜ tek satır birikmiş oluyordu (özellik yeni), TJK zenginleştirmesi de
 * tjkAtId'ye bağımlı olduğu için atlanıyordu. Bunun yerine doğrudan yurt dışı geçmiş
 * yarış önbelleğinden (21+ satır, tjk-at-yurtdisi.adapter.ts) besleniyor — TR akışına
 * HİÇ dokunmaz, yalnız aşağıdaki erken-dönüş dalıyla çağrılır.
 */
async function getYurtDisiHorseHistory(yurtDisiAtId: number): Promise<HorseHistoryEntry[]> {
  let rows: Awaited<ReturnType<typeof fetchYurtDisiAtKosuBilgileri>> = [];
  try {
    rows = await fetchYurtDisiAtKosuBilgileri(yurtDisiAtId);
  } catch {
    rows = [];
  }
  return rows.slice(0, 15).map((row, idx) => {
    const finishMatch = row.finish.match(/^(\d+)\/(\d+)$/);
    const finishPos = finishMatch && finishMatch[1] !== "0" ? parseInt(finishMatch[1], 10) : null;
    const raceNoMatch = row.raceNoName.match(/^(\d+)/);
    return {
      raceId: `yd-${yurtDisiAtId}-${row.date}-${idx}`,
      date: yurtDisiDmyToIso(row.date),
      hippodrome: row.city,
      raceNo: raceNoMatch ? parseInt(raceNoMatch[1], 10) : 0,
      distance: row.distance,
      surface: yurtDisiSurfaceKodu(row.surface),
      zeminEtiketi: null,
      classType: row.classType || null,
      equipment: null,
      jockey: row.jockey || null,
      weight: trSayi(row.weight),
      hp: row.hp ? parseInt(row.hp, 10) || null : null,
      agf: null,
      bestTime: row.time || null,
      scratched: false,
      finishPos,
    };
  });
}

/** Bir atın (isme göre) geçmiş yarışlarını, en yeniden eskiye, en fazla 15 kayıt döner. */
export async function getHorseHistory(name: string): Promise<HorseHistoryEntry[]> {
  const runners = await db.runner.findMany({
    // "Karma" hipodromu, küçük şehirlerin koşularını TJK'nın ayrıca yayınladığı ortak bir
    // yayın — fiziksel olarak gerçek şehirdeki koşuyla aynı yarış (bkz. prediction.actions.ts
    // karma-mirror mantığı). Geçmişte mükerrer satır olarak görünmesin diye elenir.
    where: { name, race: { raceDay: { hippodrome: { slug: { not: "karma" } } } } },
    orderBy: { race: { raceDay: { date: "desc" } } },
    take: 15,
    select: {
      no: true,
      jockey: true,
      weight: true,
      hp: true,
      agf: true,
      bestTime: true,
      scratched: true,
      tjkAtId: true,
      yurtDisiAtId: true,
      equipment: true,
      race: {
        select: {
          id: true,
          raceNo: true,
          distance: true,
          surface: true,
          classType: true,
          raceDay: {
            select: {
              date: true,
              surfaceConditions: true,
              hippodrome: { select: { name: true } },
            },
          },
          result: { select: { actualOrder: true } },
        },
      },
    },
  });

  // TR akışına HİÇ girmeyen erken dönüş — bkz. getYurtDisiHorseHistory üstündeki not.
  const yurtDisiAtId = runners.find((r) => r.tjkAtId == null && r.yurtDisiAtId != null)?.yurtDisiAtId;
  if (yurtDisiAtId != null) return getYurtDisiHorseHistory(yurtDisiAtId);

  // Kendi DB'mizdeki RaceDay.surfaceConditions yalnız 2026-07-15'ten beri ve seyrek —
  // TJK'nın kendi at profili (AtKosuBilgileri) her geçmiş koşu için "Ç:Normal 3.3" gibi
  // ham bir zemin metnini zaten veriyor (ComparisonPanel/H2H'de kullandığımız aynı kaynak).
  // Burada da tarih+koşu no eşleştirmesiyle kullanılır — kapsam çok daha geniş.
  const tjkAtId = runners.find((r) => r.tjkAtId != null)?.tjkAtId;
  let tjkRows: TjkAtKosuRow[] = [];
  if (tjkAtId != null) {
    try {
      tjkRows = await fetchTjkAtKosuBilgileri(tjkAtId);
    } catch {
      tjkRows = [];
    }
  }
  const tjkByKey = new Map<string, TjkAtKosuRow>();
  for (const row of tjkRows) tjkByKey.set(`${row.date}|${row.raceNo}`, row);

  return runners.map((r) => {
    const tjkRow = tjkByKey.get(`${toDdMmYyyy(r.race.raceDay.date)}|${r.race.raceNo}`);

    let zeminEtiketi: string | null = null;
    if (tjkRow) {
      const detay = zeminDetayiSatirdanCikar(tjkRow.surface);
      const zemin = detay ? zeminKatsayisi(detay) : null;
      zeminEtiketi = zemin && zemin.katsayi !== 1.0 ? zemin.etiket : null;
    } else {
      const surfaceConditions = r.race.raceDay.surfaceConditions as { label: string; detail: string }[] | null;
      const detay = zeminDetayiBul(surfaceConditions, r.race.surface);
      const zemin = detay ? zeminKatsayisi(detay) : null;
      zeminEtiketi = zemin && zemin.katsayi !== 1.0 ? zemin.etiket : null;
    }

    return {
      raceId: r.race.id,
      date: r.race.raceDay.date.toISOString(),
      hippodrome: r.race.raceDay.hippodrome.name,
      raceNo: r.race.raceNo,
      distance: r.race.distance,
      surface: r.race.surface,
      zeminEtiketi,
      classType: tjkRow?.classType || r.race.classType || null,
      equipment: tjkRow?.equipment || r.equipment || null,
      jockey: r.jockey,
      weight: r.weight,
      hp: r.hp,
      agf: r.agf,
      bestTime: r.bestTime,
      scratched: r.scratched,
      finishPos: r.race.result ? finishPosition(r.race.result.actualOrder, r.no) : null,
    };
  });
}