/**
 * YD Veri Bankası — kimlik çözümleme (entity resolution). TR kodundan TAMAMEN AYRI.
 *
 * Her fonksiyon AYNI desibi izler: (1) bu kaynak+isim için zaten bir YurtDisiEntityAlias
 * var mı bak, varsa doğrudan o entityId'yi dön; (2) yoksa normalizedName'e göre MASTER
 * tabloda doğrudan bir eşleşme ara (aynı kaynaktan ilk kez farklı yazımla gelmiş olabilir);
 * (3) o da yoksa YENİ bir master kayıt oluştur; (4) her durumda (yeni veya eşleşen) bir
 * EntityAlias satırı yaz ki BİR SONRAKİ aynı ham isim doğrudan (1)'den dönsün (ucuz).
 */

import { db } from "@/lib/db";
import { normalizeName, normalizeHorseName, atAdiUlkeAyristir } from "./normalize";

const TJK_SOURCE = "TJK";

async function aliasIleBul(entityType: string, source: string, sourceName: string): Promise<string | null> {
  const alias = await db.yurtDisiEntityAlias.findUnique({
    where: { source_sourceName_entityType: { source, sourceName, entityType } },
  });
  return alias?.entityId ?? null;
}

async function aliasYaz(entityType: string, entityId: string, source: string, sourceName: string, normalizedName: string, sourceId?: string) {
  await db.yurtDisiEntityAlias
    .upsert({
      where: { source_sourceName_entityType: { source, sourceName, entityType } },
      create: { entityType, entityId, source, sourceName, normalizedName, sourceId },
      update: { entityId },
    })
    .catch(() => {}); // yarış koşullu iki eşzamanlı çağrıda ikincisi sessizce atlanır, ilkinki geçerli kalır
}

export async function resolveOrCreateTrack(rawName: string, country: string): Promise<string> {
  const existing = await aliasIleBul("TRACK", TJK_SOURCE, rawName);
  if (existing) return existing;

  const normalizedName = normalizeName(rawName);
  let track = await db.yurtDisiTrack.findUnique({ where: { normalizedName } });
  if (!track) {
    track = await db.yurtDisiTrack.create({ data: { canonicalName: rawName, normalizedName, country } });
  }
  await aliasYaz("TRACK", track.id, TJK_SOURCE, rawName, normalizedName);
  return track.id;
}

export async function resolveOrCreateEquine(
  rawName: string,
  opts: { yurtDisiAtId?: number; countryOfBirth?: string | null } = {}
): Promise<string> {
  const existing = await aliasIleBul("HORSE", TJK_SOURCE, rawName);
  if (existing) return existing;

  const normalizedName = normalizeHorseName(rawName);
  const { ulkeKodu } = atAdiUlkeAyristir(rawName);
  let equine = await db.yurtDisiEquine.findUnique({ where: { normalizedName } });
  if (!equine) {
    equine = await db.yurtDisiEquine.create({
      data: {
        canonicalName: rawName,
        normalizedName,
        countryOfBirth: opts.countryOfBirth ?? ulkeKodu,
        sourceIds: opts.yurtDisiAtId != null ? { tjkYurtDisiAtId: opts.yurtDisiAtId } : undefined,
      },
    });
  } else if (opts.yurtDisiAtId != null) {
    const mevcut = (equine.sourceIds as Record<string, unknown> | null) ?? {};
    if (mevcut.tjkYurtDisiAtId == null) {
      await db.yurtDisiEquine.update({
        where: { id: equine.id },
        data: { sourceIds: { ...mevcut, tjkYurtDisiAtId: opts.yurtDisiAtId } },
      });
    }
  }
  await aliasYaz("HORSE", equine.id, TJK_SOURCE, rawName, normalizedName, opts.yurtDisiAtId != null ? String(opts.yurtDisiAtId) : undefined);
  return equine.id;
}

export async function resolveOrCreateJockey(rawName: string, country?: string): Promise<string | null> {
  if (!rawName?.trim()) return null;
  const existing = await aliasIleBul("JOCKEY", TJK_SOURCE, rawName);
  if (existing) return existing;

  const normalizedName = normalizeName(rawName);
  let jockey = await db.yurtDisiJockey.findUnique({ where: { normalizedName } });
  if (!jockey) {
    jockey = await db.yurtDisiJockey.create({ data: { canonicalName: rawName, normalizedName, country } });
  }
  await aliasYaz("JOCKEY", jockey.id, TJK_SOURCE, rawName, normalizedName);
  return jockey.id;
}

export async function resolveOrCreateTrainer(rawName: string, country?: string): Promise<string | null> {
  if (!rawName?.trim()) return null;
  const existing = await aliasIleBul("TRAINER", TJK_SOURCE, rawName);
  if (existing) return existing;

  const normalizedName = normalizeName(rawName);
  let trainer = await db.yurtDisiTrainer.findUnique({ where: { normalizedName } });
  if (!trainer) {
    trainer = await db.yurtDisiTrainer.create({ data: { canonicalName: rawName, normalizedName, country } });
  }
  await aliasYaz("TRAINER", trainer.id, TJK_SOURCE, rawName, normalizedName);
  return trainer.id;
}

export async function resolveOrCreateOwner(rawName: string): Promise<string | null> {
  if (!rawName?.trim()) return null;
  const existing = await aliasIleBul("OWNER", TJK_SOURCE, rawName);
  if (existing) return existing;

  const normalizedName = normalizeName(rawName);
  let owner = await db.yurtDisiOwner.findUnique({ where: { normalizedName } });
  if (!owner) {
    owner = await db.yurtDisiOwner.create({ data: { canonicalName: rawName, normalizedName } });
  }
  await aliasYaz("OWNER", owner.id, TJK_SOURCE, rawName, normalizedName);
  return owner.id;
}
