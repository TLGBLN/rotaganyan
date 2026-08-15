"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";

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
        include: { gallops: { orderBy: { date: "desc" }, take: 3 } },
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
