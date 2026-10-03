"use server";

import { db } from "@/lib/db";
import { fetchPedigreeTree } from "@/server/services/ingest/tjk-pedigri.adapter";
import type { PedigreeTree } from "@/lib/pedigree-tree-types";

/** Bir atın (isme göre) 3 kuşaklık soy ağacını döner — kalıcı önbellekten, yoksa TJK'dan anlık çekip önbelleğe yazar. */
export async function getHorsePedigreeTree(name: string): Promise<PedigreeTree | null> {
  const runner = await db.runner.findFirst({
    where: { name, tjkAtId: { not: null } },
    select: { tjkAtId: true },
    orderBy: { race: { raceDay: { date: "desc" } } },
  });
  const tjkAtId = runner?.tjkAtId;
  if (tjkAtId == null) return null;

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
