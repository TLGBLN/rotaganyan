/**
 * YD Veri Bankası — kimlik çözümleme (entity resolution) V1.1. TR kodundan TAMAMEN AYRI.
 *
 * Kullanıcı kararı (2026-09-30, Entity Resolution V1.1 + Unresolved Quarantine):
 * "pedigree katmanına yanlış ForeignEquine.id bağlarsak... sonradan temizlemesi çok
 * pahalı bir hata olur... emin olunmayan hiçbir şeyi otomatik merge etme; unresolved
 * kayıtları ayrı kuyruğa yaz." Bu dosya BÜYÜK bir fuzzy-matching/NLP motoru DEĞİL —
 * amaç %100 otomatik isim çözümü değil, YANLIŞ BİRLEŞTİRME YAPMAMAK ve HİÇBİR KAYDI
 * SESSİZCE KAYBETMEMEK.
 *
 * Sıra (her varlık tipi için): (1) kaynak KİMLİĞİNE (yurtDisiAtId gibi stabil bir sayı —
 * isimden ÇOK daha güvenilir) göre alias var mı; (2) yoksa ham isme göre alias; (3) yoksa
 * normalizedName'e göre master tabloda ara — bulunursa VE ek bağlam (ülke/doğum yılı)
 * ÇELİŞİYORSA otomatik birleştirme YAPMA, unresolved'a yaz ve YENİ kayıt aç; (4) hiç
 * bulunamazsa yeni kayıt aç; (5) her durumda alias(lar) yaz.
 */

import type { Prisma } from "@prisma/client";
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

/** "Hiçbir kaydı sessizce kaybetmeyelim" — çelişki/kimliksizlik durumunda GÖRÜNÜR kalır. */
export async function unresolvedYaz(input: {
  entityType: string;
  source: string;
  sourceName: string;
  normalizedName: string;
  context?: Record<string, unknown>;
  candidateEntityIds?: string[];
  confidence?: number;
}) {
  await db.yurtDisiUnresolvedEntity
    .create({
      data: {
        entityType: input.entityType,
        source: input.source,
        sourceName: input.sourceName,
        normalizedName: input.normalizedName,
        context: input.context as Prisma.InputJsonValue | undefined,
        candidateEntityIds: input.candidateEntityIds as Prisma.InputJsonValue | undefined,
        confidence: input.confidence,
      },
    })
    .catch(() => {});
}

export async function resolveOrCreateTrack(rawName: string, country: string): Promise<string> {
  const existing = await aliasIleBul("TRACK", TJK_SOURCE, rawName);
  if (existing) {
    // 2026-09-30 bulgusu — HorseRun ETL'in "BILINMIYOR" ile oluşturduğu eski kayıtları
    // gerçek ülke bilgisi geldiğinde sessizce zenginleştir (var olan DOĞRU bir değeri
    // asla üzerine yazma).
    if (country !== "BILINMIYOR") {
      const eski = await db.yurtDisiTrack.findUnique({ where: { id: existing }, select: { country: true } });
      if (eski?.country === "BILINMIYOR") {
        await db.yurtDisiTrack.update({ where: { id: existing }, data: { country } }).catch(() => {});
      }
    }
    return existing;
  }

  const normalizedName = normalizeName(rawName);
  let track = await db.yurtDisiTrack.findUnique({ where: { normalizedName } });
  if (!track) {
    track = await db.yurtDisiTrack.create({ data: { canonicalName: rawName, normalizedName, country } });
  } else if (track.country === "BILINMIYOR" && country !== "BILINMIYOR") {
    await db.yurtDisiTrack.update({ where: { id: track.id }, data: { country } }).catch(() => {});
  }
  await aliasYaz("TRACK", track.id, TJK_SOURCE, rawName, normalizedName);
  return track.id;
}

export type EquineResolutionOpts = {
  yurtDisiAtId?: number;
  countryOfBirth?: string | null;
  approxBirthYear?: number | null;
  sexCode?: string | null;
  context?: Record<string, unknown>; // unresolved kaydına eklenecek iz (raceId/hipodrom/tarih vb.)
};

function atIdAliasAdi(atId: number): string {
  return `yurtDisiAtId:${atId}`;
}

export async function resolveOrCreateEquine(rawName: string, opts: EquineResolutionOpts = {}): Promise<string> {
  // 1. En güvenilir yol: TJK'nın kendi stabil sayısal kimliği (isimden çok daha güçlü —
  //    at ismi yazım hatası/tire farkı taşıyabilir, atId taşımaz).
  if (opts.yurtDisiAtId != null) {
    const idAlias = await aliasIleBul("HORSE", TJK_SOURCE, atIdAliasAdi(opts.yurtDisiAtId));
    if (idAlias) {
      await aliasYaz("HORSE", idAlias, TJK_SOURCE, rawName, normalizeHorseName(rawName)); // isim de aliaslansın (hızlı yol için)
      return idAlias;
    }
  }

  // 2. Ham isme göre alias (aynı isim daha önce çözülmüş olabilir — atId'siz bir çağrıdan).
  const nameAlias = await aliasIleBul("HORSE", TJK_SOURCE, rawName);
  if (nameAlias) {
    if (opts.yurtDisiAtId != null) await aliasYaz("HORSE", nameAlias, TJK_SOURCE, atIdAliasAdi(opts.yurtDisiAtId), normalizeHorseName(rawName), String(opts.yurtDisiAtId));
    return nameAlias;
  }

  // 3. normalizedName'e göre master tabloda ara — bulunursa ek bağlamla ÇAPRAZ KONTROL et.
  const normalizedName = normalizeHorseName(rawName);
  const { ulkeKodu } = atAdiUlkeAyristir(rawName);
  const countryOfBirth = opts.countryOfBirth ?? ulkeKodu ?? null;
  const existing = await db.yurtDisiEquine.findUnique({ where: { normalizedName } });

  let equineId: string;
  if (existing) {
    // Kullanıcının notu: "aynı isimli iki farklı at olabileceği için sadece isimle merge
    // etme" — ülke bilgisi HER İKİ tarafta da doluysa VE ÇELİŞİYORSA otomatik birleştirme
    // YAPILMAZ, unresolved'a yazılıp AYRI bir kayıt açılır (silent yanlış merge > görünür
    // duplicate; ikincisi sonradan düzeltilebilir, birincisi düzeltilmesi pahalı bir hata).
    const celisiyor = existing.countryOfBirth != null && countryOfBirth != null && existing.countryOfBirth !== countryOfBirth;
    if (celisiyor) {
      await unresolvedYaz({
        entityType: "HORSE",
        source: TJK_SOURCE,
        sourceName: rawName,
        normalizedName,
        context: { ...opts.context, existingCountryOfBirth: existing.countryOfBirth, newCountryOfBirth: countryOfBirth },
        candidateEntityIds: [existing.id],
        confidence: 0.3,
      });
      const created = await db.yurtDisiEquine.create({
        data: { canonicalName: rawName, normalizedName: `${normalizedName}#${opts.yurtDisiAtId ?? Date.now()}`, countryOfBirth, birthYear: opts.approxBirthYear ?? null, sex: opts.sexCode ?? null, sourceIds: opts.yurtDisiAtId != null ? { tjkYurtDisiAtId: opts.yurtDisiAtId } : undefined },
      });
      equineId = created.id;
    } else {
      equineId = existing.id;
      // Eksik alanları (ülke/doğum yılı/cinsiyet/sourceIds) sessizce ZENGİNLEŞTİR — var
      // olan dolu bir değeri ASLA üzerine yazma.
      const guncelleme: Record<string, unknown> = {};
      if (existing.countryOfBirth == null && countryOfBirth != null) guncelleme.countryOfBirth = countryOfBirth;
      if (existing.birthYear == null && opts.approxBirthYear != null) guncelleme.birthYear = opts.approxBirthYear;
      if (existing.sex == null && opts.sexCode != null) guncelleme.sex = opts.sexCode;
      if (opts.yurtDisiAtId != null) {
        const mevcutSourceIds = (existing.sourceIds as Record<string, unknown> | null) ?? {};
        if (mevcutSourceIds.tjkYurtDisiAtId == null) guncelleme.sourceIds = { ...mevcutSourceIds, tjkYurtDisiAtId: opts.yurtDisiAtId };
      }
      if (Object.keys(guncelleme).length > 0) {
        await db.yurtDisiEquine.update({ where: { id: existing.id }, data: guncelleme }).catch(() => {});
      }
    }
  } else {
    const created = await db.yurtDisiEquine.create({
      data: {
        canonicalName: rawName,
        normalizedName,
        countryOfBirth,
        birthYear: opts.approxBirthYear ?? null,
        sex: opts.sexCode ?? null,
        sourceIds: opts.yurtDisiAtId != null ? { tjkYurtDisiAtId: opts.yurtDisiAtId } : undefined,
      },
    });
    equineId = created.id;
  }

  await aliasYaz("HORSE", equineId, TJK_SOURCE, rawName, normalizedName, opts.yurtDisiAtId != null ? String(opts.yurtDisiAtId) : undefined);
  if (opts.yurtDisiAtId != null) await aliasYaz("HORSE", equineId, TJK_SOURCE, atIdAliasAdi(opts.yurtDisiAtId), normalizedName, String(opts.yurtDisiAtId));
  return equineId;
}

// Jokey/antrenör/sahip: kullanıcının notu — "sadece string similarity kullanma... emin
// değilse PENDING_ALIAS." V1.1 kapsamında BUNLAR İÇİN fuzzy/kısaltma eşleştirmesi HİÇ
// YOK (büyük bir NLP projesine çevirmeme kararı) — yalnız TAM normalize-isim eşleşmesi.
// "C Appleby"/"Charlie Appleby" gibi farklı yazımlar şu an AYRI kayıt olarak kalır; bu
// bilinçli bir sınırlama, sessiz/riskli bir birleştirmeden daha güvenli kabul edildi.

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
