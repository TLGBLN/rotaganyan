"use server";

import { db } from "@/lib/db";
import { breedToIrk, surfaceToPist, mesafeBucket, formatDamSireStatOzet, normalizeSireName, havuzAnahtari, eslestirDamStatOzetleri } from "@/lib/sire-stat-match";

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
 * v6.77 — kullanıcı kararı 2026-08-10: hipodromx.com'a ait DamStat modeli/elle yapıştırma
 * akışı (saveDamStatBulk/listDamStats/DamStatFiltre) analiz akışına zaten hiç girmiyordu,
 * kalıntı olarak koddan ve veritabanından tamamen kaldırıldı — bu dosyada yalnız kendi
 * verimize dayanan fonksiyonlar kaldı.
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
