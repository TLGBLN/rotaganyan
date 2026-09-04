"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { startOfDay, endOfDay } from "date-fns";
import type { KosuSecimGunu } from "@/app/(admin)/admin/analizler/yeni/types";

/**
 * 2026-09-03 kullanıcı bulgusu ("tarihlere tıkladığımda çok yavaş değişiyor sayfa") —
 * DatePickerNav eskiden router.push ile TAM sayfa navigasyonu tetikliyordu (page.tsx'in
 * force-dynamic Server Component'i baştan çalışıyor, ~700-1100ms). Koşu seçimi ZATEN bu
 * yavaş yoldan kaçınıyordu (bkz. getKosuAnalizVerisi'nin üstündeki not) — tarih değişimi
 * de AYNI desene taşındı: sayfa hiç yeniden yüklenmeden, yalnız bu hafif server action
 * çağrılıp gunler state'i güncelleniyor.
 */
export async function getKosuSecimGunuVerisi(tarih: string): Promise<KosuSecimGunu[]> {
  await requireRole("EDITOR");

  const date = new Date(tarih + "T00:00:00.000Z");
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

  return raceDays
    .map((rd) => ({
      id: rd.id,
      gunEtiketi: `${rd.hippodrome.name} — ${format(rd.date, "d MMMM yyyy (EEEE)", { locale: tr })}`,
      races: rd.races
        .filter((r) => !r.conditions)
        .map((r) => ({ id: r.id, raceNo: r.raceNo, hasAnaliz: !!r.prediction })),
    }))
    .filter((gun) => gun.races.length > 0);
}

/**
 * 2026-08-14 — kullanıcı talebi: "Veri Gir — Koşu Seç" listesi ile analiz paneli AYRI
 * sayfalardaydı (koşuya tıklayınca tam sayfa değişiyordu, geri dönüp başka bir koşu
 * seçmek gerekiyordu). Artık liste + analiz TEK sayfada birlikte — bu server action,
 * o sayfadaki İSTEMCİ tarafı bileşenin (AnalizYeniClient.tsx) bir koşuya tıklandığında
 * sayfa hiç değişmeden çağırdığı tek veri kaynağı.
 */
export async function getKosuAnalizVerisi(raceId: string) {
  await requireRole("EDITOR");

  const race = await db.race.findUnique({
    where: { id: raceId },
    include: {
      raceDay: { include: { hippodrome: true } },
      runners: {
        orderBy: { no: "asc" },
        // 2026-08-15 kullanıcı talebi: 3'e kırpma kaldırıldı — DB zaten yalnız son
        // yarıştan sonrakileri tutuyor (tjk-idman-stats.adapter.ts), admin panelinde
        // analiz yaparken hiçbir idman/idman jokeyi eşleşmesi gözden kaçmasın.
        include: { gallops: { orderBy: { date: "desc" } } },
      },
      prediction: {
        select: {
          id: true,
          confidence: true,
          notes: true,
          tempo: true,
          couponNarrow: true,
          couponNormal: true,
          couponWide: true,
          isBanko: true,
          bankoNote: true,
          picks: {
            orderBy: { rank: "asc" },
            select: { rank: true, runnerId: true, runnerLabel: true, score: true, isTarget: true, pedigreeRating: true, details: true },
          },
        },
      },
    },
  });
  return race;
}
