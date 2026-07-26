"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseDamStatBulk } from "@/lib/dam-stat-parser";
import { breedToIrk, surfaceToPist, mesafeBucket, findDamStat, formatDamStatOzet, normalizeSireName } from "@/lib/sire-stat-match";

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

export type DamStatOzetSonuc = {
  ozet: string | null;
  // minOrneklem kararları için ham örneklem büyüklüğü (bkz. sire-stat.actions.ts SireStatOzetSonuc).
  ornekHipodromx: number | null; // s.start — hipodromx başlık istatistiğinin dayandığı start sayısı
  ornekKendiVeri: number | null; // own.start — rotaganyan'ın kendi verisindeki start sayısı
};

/**
 * Bir koşudaki tüm atların anne+anne babası için, o koşunun ırk/pist/mesafe kombinasyonuna
 * karşılık gelen kısrak istatistiği özetini (varsa) döner — girdilerle AYNI SIRADA.
 */
export async function getDamStatOzetleriForRace(
  dams: { dam: string | null; damSire: string | null }[],
  breed: string,
  surface: string,
  distance: number
): Promise<DamStatOzetSonuc[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const [pool, ownPool] = await Promise.all([
    db.damStat.findMany({ where: { irk, filtrePist: pist, filtreMesafe: mesafe } }),
    db.damStatOwn.findMany({ where: { irk, pist, mesafe } }),
  ]);
  return dams.map(({ dam, damSire }) => {
    const match = findDamStat(dam, damSire, pool);
    const ownCandidates = dam
      ? ownPool.filter((o) => normalizeSireName(o.damName) === normalizeSireName(dam))
      : [];
    const ownMatch =
      ownCandidates.length === 0
        ? null
        : ownCandidates.length === 1
          ? ownCandidates[0]
          : (damSire && ownCandidates.find((o) => normalizeSireName(o.damSireName) === normalizeSireName(damSire))) || ownCandidates[0];
    const ornekHipodromx = match?.start ?? null;
    const ornekKendiVeri = ownMatch?.start ?? null;
    if (match) return { ozet: formatDamStatOzet(match, mesafe, pist, ownMatch), ornekHipodromx, ornekKendiVeri };
    // hipodromx eşleşmesi yok ama kendi verimizde varsa, yalnız kendi veriyle özet göster.
    if (!ownMatch || ownMatch.start < 3) return { ozet: null, ornekHipodromx, ornekKendiVeri };
    const tayOrani = ownMatch.yavruSayisi > 0 ? Math.round((ownMatch.kazananYavruSayisi / ownMatch.yavruSayisi) * 100) : null;
    const tayStr = tayOrani != null ? ` · Kazanan tay oranı %${tayOrani} (${ownMatch.kazananYavruSayisi}/${ownMatch.yavruSayisi} yavru)` : "";
    const ozet = `${dam} / ${ownMatch.damSireName} (${pist} ${mesafe}): Kendi verimiz: ${ownMatch.start} start, K% ${ownMatch.kYuzde} (${ownMatch.birinci}/${ownMatch.start})${tayStr}`;
    return { ozet, ornekHipodromx, ornekKendiVeri };
  });
}
