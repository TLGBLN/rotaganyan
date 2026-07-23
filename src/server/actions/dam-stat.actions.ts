"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseDamStatBulk } from "@/lib/dam-stat-parser";
import { breedToIrk, surfaceToPist, mesafeBucket, findDamStat, formatDamStatOzet } from "@/lib/sire-stat-match";

export type DamStatFiltre = {
  irk: string;
  filtreYil: string;
  filtreCins: string;
  filtreSehir: string;
  filtreMesafe: string;
  filtrePist: string;
  filtreGrupListed: string;
  filtreYasGrubu: string;
};

export async function saveDamStatBulk(text: string, filtre: DamStatFiltre): Promise<{ kaydedilen: number; hatali: string[] }> {
  await requireRole("EDITOR");

  const { parsed, hatali } = parseDamStatBulk(text);
  if (parsed.length === 0) return { kaydedilen: 0, hatali };

  // Bkz. sire-stat.actions.ts saveSireStatBulk — $transaction büyük yapıştırmalarda
  // 5000ms sınırına takılıyordu, CONCURRENCY'li Promise.all kullanılıyor.
  const CONCURRENCY = 20;
  for (let i = 0; i < parsed.length; i += CONCURRENCY) {
    const chunk = parsed.slice(i, i + CONCURRENCY);
    await Promise.all(
      chunk.map((p) =>
        db.damStat.upsert({
          where: {
            damStatFiltre: {
              damName: p.damName,
              damSireName: p.damSireName,
              irk: filtre.irk,
              filtreYil: filtre.filtreYil,
              filtreCins: filtre.filtreCins,
              filtreSehir: filtre.filtreSehir,
              filtreMesafe: filtre.filtreMesafe,
              filtrePist: filtre.filtrePist,
              filtreGrupListed: filtre.filtreGrupListed,
              filtreYasGrubu: filtre.filtreYasGrubu,
            },
          },
          create: { ...p, ...filtre },
          update: { ...p },
        })
      )
    );
  }

  return { kaydedilen: parsed.length, hatali };
}

export async function getDamStatCount(): Promise<number> {
  return db.damStat.count();
}

export type DamStatRow = Awaited<ReturnType<typeof listDamStats>>[number];

export async function listDamStats(limit = 100) {
  return db.damStat.findMany({ orderBy: { updatedAt: "desc" }, take: limit });
}

/**
 * Bir koşudaki tüm atların anne+anne babası için, o koşunun ırk/pist/mesafe kombinasyonuna
 * karşılık gelen kısrak istatistiği özetini (varsa) döner — girdilerle AYNI SIRADA.
 */
export async function getDamStatOzetleriForRace(
  dams: { dam: string | null; damSire: string | null }[],
  breed: string,
  surface: string,
  distance: number
): Promise<(string | null)[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const pool = await db.damStat.findMany({ where: { irk, filtrePist: pist, filtreMesafe: mesafe } });
  return dams.map(({ dam, damSire }) => {
    const match = findDamStat(dam, damSire, pool);
    return match ? formatDamStatOzet(match, mesafe, pist) : null;
  });
}
