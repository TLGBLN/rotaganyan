import { db } from "@/lib/db";
import { format, startOfDay, endOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { turkeyDateString } from "@/lib/tz";
import AnalizYeniClient, { type KosuSecimGunu } from "./AnalizYeniClient";

export const dynamic = "force-dynamic";

// 2026-08-14 — kullanıcı talebi: "Veri Gir — Koşu Seç" listesi ile analiz paneli tek
// sayfada birleştirildi (bkz. AnalizYeniClient.tsx) — bu sayfa artık yalnız günün koşu
// listesini sunucu tarafında çekip istemci bileşenine devrediyor, hiçbir dallanma
// (kosu seçilmiş/seçilmemiş) burada yapılmıyor.
type PageProps = { searchParams: Promise<{ kosu?: string; tarih?: string }> };

export default async function YeniAnalizPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const today = turkeyDateString();
  const tomorrow = turkeyDateString(1);
  const selectedDate = params.tarih ?? today;
  const date = new Date(selectedDate + "T00:00:00.000Z");

  const raceDays = await db.raceDay.findMany({
    where: { date: { gte: startOfDay(date), lte: endOfDay(date) } },
    include: {
      hippodrome: true,
      races: {
        include: { prediction: { select: { id: true } } },
        orderBy: { raceNo: "asc" },
      },
    },
    orderBy: { date: "asc" },
  });

  const gunler: KosuSecimGunu[] = raceDays
    .map((rd) => ({
      id: rd.id,
      gunEtiketi: `${rd.hippodrome.name} — ${format(rd.date, "d MMMM yyyy (EEEE)", { locale: tr })}`,
      races: rd.races
        .filter((r) => !r.conditions)
        .map((r) => ({ id: r.id, raceNo: r.raceNo, hasAnaliz: !!r.prediction })),
    }))
    .filter((gun) => gun.races.length > 0);

  return (
    <AnalizYeniClient
      gunler={gunler}
      selectedDate={selectedDate}
      today={today}
      tomorrow={tomorrow}
      initialRaceId={params.kosu}
    />
  );
}
