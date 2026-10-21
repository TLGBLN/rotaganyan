"use server";
// ROTAGANYAN ANALİZ MOTORU v1.0 — basit yarış-seçici için HAFİF yarış listesi (kullanıcı
// talimatı, 2026-10-20). getProgramData() (race.service.ts) picks/runners/result dahil çok
// ağır bir sorgu — burada yalnız seçici için id/raceNo/hipodrom/saat yeterli, AYRI ve küçük
// bir sorgu kullanılır.
import { db } from "@/lib/db";
import { startOfDay, endOfDay } from "date-fns";

export type V1RaceOption = { id: string; raceNo: number; time: string | null; hippodromeName: string };

export async function getRaceOptionsForDate(dateStr: string): Promise<V1RaceOption[]> {
  const date = new Date(dateStr + "T00:00:00.000Z");
  const raceDays = await db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: { select: { name: true } },
      races: { orderBy: { raceNo: "asc" }, select: { id: true, raceNo: true, time: true } },
    },
    orderBy: { hippodrome: { name: "asc" } },
  });
  return raceDays.flatMap((rd) =>
    rd.races.map((r) => ({ id: r.id, raceNo: r.raceNo, time: r.time, hippodromeName: rd.hippodrome.name }))
  );
}
