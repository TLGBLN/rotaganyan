"use server";

import { db } from "@/lib/db";
import { fetchPedigreeTree } from "@/server/services/ingest/tjk-pedigri.adapter";
import { fetchYurtDisiAtProfil } from "@/server/services/ingest/tjk-at-yurtdisi.adapter";
import type { PedigreeTree } from "@/lib/pedigree-tree-types";

/**
 * 2026-09-29 kullanıcı bulgusu ("hani hiçbir veri yok") — yurt dışı atlar TJK'da TR'deki
 * gibi 3 kuşaklık bir soy ağacı sayfası VERMİYOR, yalnız 1 kuşak (Baba, Anne/Anne'nin
 * Babası) bilgisi var (bkz. tjk-at-yurtdisi.adapter.ts profil bloğu). Sahte/tahmini 2. ve
 * 3. kuşak UYDURULMAZ — SoyAgaciTree zaten null dalları "—" ile nötr gösteriyor, bu yüzden
 * yalnız gerçekten bildiğimiz 1. kuşağı dolduran KISMİ bir ağaç dönmek dürüst ve yeterli.
 */
async function getYurtDisiPedigreeTree(yurtDisiAtId: number): Promise<PedigreeTree | null> {
  const profile = await fetchYurtDisiAtProfil(yurtDisiAtId).catch(() => null);
  if (!profile) return null;
  const [dam, damSire] = (profile.anneVeDede || "").split("/").map((s) => s.trim());
  return {
    sire: profile.baba ? { name: profile.baba, year: null, note: null } : null,
    dam: dam ? { name: dam, year: null, note: null } : null,
    sireSire: null, sireDam: null,
    damSire: damSire ? { name: damSire, year: null, note: null } : null,
    damDam: null,
    sireSireSire: null, sireSireDam: null, sireDamSire: null, sireDamDam: null,
    damSireSire: null, damSireDam: null, damDamSire: null, damDamDam: null,
  };
}

/** Bir atın (isme göre) 3 kuşaklık soy ağacını döner — kalıcı önbellekten, yoksa TJK'dan anlık çekip önbelleğe yazar. */
export async function getHorsePedigreeTree(name: string): Promise<PedigreeTree | null> {
  const runner = await db.runner.findFirst({
    where: { name, tjkAtId: { not: null } },
    select: { tjkAtId: true },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });
  const tjkAtId = runner?.tjkAtId;
  if (tjkAtId == null) {
    // TR akışına HİÇ girmeyen erken dönüş — yukarıdaki sorgu tjkAtId'ye göre zaten hiçbir
    // yurt dışı atı bulamaz (tjkAtId hep null), bu yüzden AYRI bir sorgu gerekiyor.
    const yurtDisiRunner = await db.runner.findFirst({
      where: { name, yurtDisiAtId: { not: null } },
      select: { yurtDisiAtId: true },
      orderBy: { race: { raceDay: { date: "desc" } } },
    });
    if (yurtDisiRunner?.yurtDisiAtId != null) return getYurtDisiPedigreeTree(yurtDisiRunner.yurtDisiAtId);
    return null;
  }

  const cached = await db.horsePedigree.findUnique({ where: { tjkAtId } });
  if (cached) return cached.treeJson as PedigreeTree;

  const tree = await fetchPedigreeTree(tjkAtId).catch(() => null);
  if (tree) {
    await db.horsePedigree
      .upsert({ where: { tjkAtId }, create: { tjkAtId, treeJson: tree }, update: { treeJson: tree } })
      .catch(() => {});
  }
  return tree;
}
