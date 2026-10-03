"use server";

import { db } from "@/lib/db";
import { fetchHorseProfile, fetchHorseDetailedStats } from "@/server/services/ingest/tjk-at-profil.adapter";
import type { HorseProfile, HorseDetailStatSection } from "@/server/services/ingest/tjk-at-profil.adapter";

async function resolveTjkAtId(name: string): Promise<number | null> {
  const runner = await db.runner.findFirst({
    where: { name, tjkAtId: { not: null } },
    select: { tjkAtId: true },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });
  return runner?.tjkAtId ?? null;
}

/**
 * Bir atın (isme göre) sahiplik/kazanç/özet istatistik profili VE Zaman/Hipodrom/Jokey/Pist/
 * Mesafe kırılımlı detaylı istatistikleri — kalıcı HorseStatsCache'ten (arka plandaki
 * sync-horse-stats-cache cron'u tüm atları periyodik tazeler), yalnız cache henüz o at için
 * hiç oluşmadıysa (yeni at / cron henüz sırası gelmedi) TJK'dan anlık çekip cache'e yazar —
 * kullanıcı hiçbir zaman TJK'yı beklemez, önbellek arkadan dolar (kullanıcı talebi 2026-07-30).
 */
async function getHorseStats(name: string): Promise<{ profile: HorseProfile | null; detailedStats: HorseDetailStatSection[] }> {
  const tjkAtId = await resolveTjkAtId(name);
  if (tjkAtId == null) return { profile: null, detailedStats: [] };

  const cached = await db.horseStatsCache.findUnique({ where: { tjkAtId } });
  if (cached) {
    return {
      profile: cached.profileJson as unknown as HorseProfile,
      detailedStats: cached.detailedStatsJson as unknown as HorseDetailStatSection[],
    };
  }

  const [profile, detailedStats] = await Promise.all([
    fetchHorseProfile(tjkAtId),
    fetchHorseDetailedStats(tjkAtId),
  ]);
  if (profile) {
    await db.horseStatsCache
      .upsert({
        where: { tjkAtId },
        create: { tjkAtId, profileJson: profile, detailedStatsJson: detailedStats },
        update: { profileJson: profile, detailedStatsJson: detailedStats },
      })
      .catch(() => {});
  }
  return { profile, detailedStats };
}

export async function getHorseProfileByName(name: string): Promise<HorseProfile | null> {
  return (await getHorseStats(name)).profile;
}

export async function getHorseDetailedStatsByName(name: string): Promise<HorseDetailStatSection[]> {
  return (await getHorseStats(name)).detailedStats;
}
