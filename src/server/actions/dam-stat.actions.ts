"use server";

import { db } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { parseDamStatBulk } from "@/lib/dam-stat-parser";
import { breedToIrk, surfaceToPist, mesafeBucket, formatDamSireStatOzet, normalizeSireName, havuzAnahtari, eslestirDamStatOzetleri } from "@/lib/sire-stat-match";

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
  ornekKendiVeri: number | null; // own.start — rotaganyan'ın kendi verisindeki start sayısı
};

/**
 * Bir koşudaki tüm atların anne+anne babası için, o koşunun ırk/pist/mesafe kombinasyonuna
 * karşılık gelen kısrak istatistiği özetini (varsa) döner — girdilerle AYNI SIRADA.
 * v6.32: yalnızca DamStatOwn (kendi verimiz) — hipodromx.com kaynaklı DamStat analiz
 * akışından çıkarıldı (kullanıcı kararı 2026-08-01, bkz. sire-stat-match.ts başlık notu).
 */
type DamStatOwnRow = Awaited<ReturnType<typeof db.damStatOwn.findMany>>[number];

export async function getDamStatOzetleriForRace(
  dams: { dam: string | null; damSire: string | null }[],
  breed: string,
  surface: string,
  distance: number
): Promise<DamStatOzetSonuc[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const ownPool = await db.damStatOwn.findMany({ where: { irk, pist, mesafe } });
  return eslestirDamStatOzetleri(ownPool, dams, mesafe, pist);
}

// v6.76 — bkz. sire-stat.actions.ts getSireStatPoolsForCombos yorumu, aynı gerekçe/desen.
export async function getDamStatPoolsForCombos(
  combos: { irk: string; pist: string; mesafe: string }[]
): Promise<Map<string, DamStatOwnRow[]>> {
  const benzersizler = [...new Map(combos.map((c) => [havuzAnahtari(c.irk, c.pist, c.mesafe), c])).values()];
  const havuz = new Map<string, DamStatOwnRow[]>();
  if (benzersizler.length === 0) return havuz;
  const tumSatirlar = await db.damStatOwn.findMany({
    where: { OR: benzersizler.map((c) => ({ irk: c.irk, pist: c.pist, mesafe: c.mesafe })) },
  });
  for (const c of benzersizler) havuz.set(havuzAnahtari(c.irk, c.pist, c.mesafe), []);
  for (const row of tumSatirlar) {
    const key = havuzAnahtari(row.irk, row.pist, row.mesafe);
    havuz.get(key)?.push(row);
  }
  return havuz;
}

export type DamSireStatOzetSonuc = { ozet: string | null; ornekKendiVeri: number | null };

/**
 * Damsire'nin (kısrağın babası) TEK BAŞINA — hangi kısraktan gelirse gelsin TÜM
 * yavrularından — kendi verimizdeki toplu performansı (bkz. formatDamSireStatOzet).
 * hipodromx bu kırılımı hiç vermediği için tamamen DamSireStatOwn'a (own-data motoru,
 * pedigri-own-stat.service.ts) dayanır.
 */
export async function getDamSireOwnStatForRace(
  damSireNames: (string | null)[],
  breed: string,
  surface: string,
  distance: number
): Promise<DamSireStatOzetSonuc[]> {
  const irk = breedToIrk(breed);
  const pist = surfaceToPist(surface);
  const mesafe = mesafeBucket(distance);
  const pool = await db.damSireStatOwn.findMany({ where: { irk, pist, mesafe } });
  return damSireNames.map((name) => {
    const match = name ? pool.find((o) => normalizeSireName(o.damSireName) === normalizeSireName(name)) ?? null : null;
    if (!match) return { ozet: null, ornekKendiVeri: null };
    return { ozet: formatDamSireStatOzet(match, mesafe, pist), ornekKendiVeri: match.start };
  });
}
