// PEDİGRİ MERKEZİ (yeni) — resmî TJK Aygır/Kısrak/Kısrak Babası istatistikleri (TjkPedigriStat), TJK kimliğiyle.
// Mesafe/pist kırılımı TJK sayfalarında yok: mevcut HipodromX anlık görüntüsündeki (ExternalPedigreeStat) bantlar, AD eşleştirmesiyle
// (aynı tür + ırk + normalize ad) TJK kimliklerine bağlanır. Ad birden çok TJK kaydına uyuyorsa (aynı adlı kısraklar) bant ATANMAZ — yanlış ata
// yapıştırmaktan iyidir; "belirsiz" olarak işaretlenir.
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { breedToIrk, surfaceToPist } from "@/lib/sire-stat-match";

export type TjkKind = "SIRE" | "DAM" | "DAMSIRE";
export type TjkBreed = "INGILIZ" | "ARAP";
export type TjkKindFilter = TjkKind | "ALL";

export type TjkSurface = "ALL" | "CIM" | "KUM" | "SENTETIK";
export type TjkDistance = "ALL" | "800-1400" | "1500-2000" | "2100-3200";
/** pist/mesafe: Rotaganyan Own tablosunu ve TJK kayıtlarına bağlı mesafe/pist bantlarını süzer (TJK'nın kendi toplamları pist/mesafe bilmez). */
export type TjkFilters = { breed: TjkBreed; q: string; kind: TjkKindFilter; year: number; surface: TjkSurface; distance: TjkDistance };

export type Bant = { surface: string; distanceBand: string; starts: number; wins: number; winRatePct: number; seconds: number; thirds: number; aei: number | null };
export type TjkSatir = {
  kind: TjkKind; tjkId: number; name: string; country: string | null;
  runnerCount: number; winnerCount: number | null; starts: number; wins: number; seconds: number; thirds: number; fourths: number; fifths: number;
  earningsTRY: number; winRatePct: number;
  bantlar: Bant[]; bantDurumu: "var" | "yok" | "belirsiz";
};
export type TjkMerkeziData = {
  filters: TjkFilters;
  sayilar: Record<TjkKind, number>; // seçili yıl + ırk için TJK'daki toplam kayıt
  yillar: number[]; // tabloda bulunan yıllar (-1 = tüm yıllar)
  sonGuncelleme: string | null;
  satirlar: TjkSatir[];
  toplamEslesen: number; // gösterilen satırlarda: mesafe bandı bulunan
};

const MAX = 150;

export async function getTjkMerkeziData(filters: TjkFilters): Promise<TjkMerkeziData> {
  const where: Prisma.TjkPedigriStatWhereInput = {
    year: filters.year, breed: filters.breed,
    ...(filters.kind === "ALL" ? {} : { kind: filters.kind }),
    ...(filters.q ? { OR: [{ name: { contains: filters.q, mode: "insensitive" } }, { normalizedName: { contains: filters.q.toLocaleUpperCase("tr"), mode: "insensitive" } }] } : {}),
  };
  const [satirlar, sayiGrup, yillarGrup, son] = await Promise.all([
    db.tjkPedigriStat.findMany({ where, orderBy: [{ starts: "desc" }, { wins: "desc" }, { name: "asc" }], take: MAX }),
    db.tjkPedigriStat.groupBy({ by: ["kind"], where: { year: filters.year, breed: filters.breed }, _count: { _all: true } }),
    db.tjkPedigriStat.groupBy({ by: ["year"], _count: { _all: true }, orderBy: { year: "desc" } }),
    db.tjkPedigriStat.aggregate({ _max: { updatedAt: true } }),
  ]);
  const sayilar: Record<TjkKind, number> = { SIRE: 0, DAM: 0, DAMSIRE: 0 };
  for (const g of sayiGrup) sayilar[g.kind as TjkKind] = g._count._all;

  // ── HipodromX mesafe/pist bantları: aynı tür + ırk + normalize ad ──
  const adlar = [...new Set(satirlar.map((s) => s.normalizedName))];
  const bantMap = new Map<string, Bant[]>(); const belirsiz = new Set<string>();
  if (adlar.length) {
    try {
      const bantRows = await db.$queryRaw<(Bant & { sourceType: string; ad: string })[]>(Prisma.sql`
        SELECT "sourceType"::text AS "sourceType", "entityNormalizedName"::text AS ad, "surface"::text AS surface, "distanceBand"::text AS "distanceBand",
               COALESCE("starts",0)::int AS starts, COALESCE("wins",0)::int AS wins, COALESCE("winRatePct",0)::double precision AS "winRatePct",
               COALESCE("seconds",0)::int AS seconds, COALESCE("thirds",0)::int AS thirds,
               CASE WHEN "aei" IS NULL THEN NULL ELSE "aei"::double precision END AS aei
        FROM "ExternalPedigreeStat"
        WHERE "year" = 2026 AND "breed" = ${filters.breed} AND "entityNormalizedName" IN (${Prisma.join(adlar)})
        ORDER BY "surface", "distanceBand"`);
      for (const b of bantRows) { const k = `${b.sourceType}|${b.ad}`; (bantMap.get(k) ?? bantMap.set(k, []).get(k)!).push({ surface: b.surface, distanceBand: b.distanceBand, starts: b.starts, wins: b.wins, winRatePct: b.winRatePct, seconds: b.seconds, thirds: b.thirds, aei: b.aei }); }
      // aynı (tür, ırk, yıl) içinde bu normalize ada birden çok TJK kaydı varsa → belirsiz
      const tekrar = await db.tjkPedigriStat.groupBy({ by: ["kind", "normalizedName"], where: { year: filters.year, breed: filters.breed, normalizedName: { in: adlar } }, _count: { _all: true } });
      for (const t of tekrar) if (t._count._all > 1) belirsiz.add(`${t.kind}|${t.normalizedName}`);
    } catch { /* HipodromX tablosu okunamazsa TJK verisi yine gösterilir */ }
  }

  let eslesen = 0;
  const out: TjkSatir[] = satirlar.map((s) => {
    const k = `${s.kind}|${s.normalizedName}`; const amb = belirsiz.has(k);
    const b = (!amb ? (bantMap.get(k) ?? []) : []).filter((x) => (filters.surface === "ALL" || x.surface === filters.surface) && (filters.distance === "ALL" || x.distanceBand === filters.distance));
    if (b.length) eslesen++;
    return {
      kind: s.kind as TjkKind, tjkId: s.tjkId, name: s.name, country: s.country,
      runnerCount: s.runnerCount, winnerCount: s.winnerCount, starts: s.starts, wins: s.wins, seconds: s.seconds, thirds: s.thirds, fourths: s.fourths, fifths: s.fifths,
      earningsTRY: s.earningsTRY, winRatePct: s.starts > 0 ? (s.wins / s.starts) * 100 : 0,
      bantlar: b, bantDurumu: amb ? "belirsiz" : b.length ? "var" : "yok",
    };
  });
  return { filters, sayilar, yillar: yillarGrup.map((y) => y.year), sonGuncelleme: son._max.updatedAt?.toISOString() ?? null, satirlar: out, toplamEslesen: eslesen };
}

// ── Rotaganyan Own (sonuçlanmış Runner + Result kayıtlarından hesaplanan; eski Pedigri Merkezi ile AYNI içerik) ──
export type OwnSatir = {
  sourceType: "SIRE" | "DAM" | "DAMSIRE"; entityName: string; relatedName: string | null; surface: string; distanceBand: string;
  starts: number; wins: number; winRatePct: number; seconds: number; thirds: number; fourths: number; fifths: number; offspringCount: number; winningOffspringCount: number;
};
export type OwnData = { counts: { sire: number; dam: number; damSire: number; total: number }; rows: OwnSatir[] };

export async function getOwnPedigri(filters: TjkFilters, limit = 120): Promise<OwnData> {
  const irk = filters.breed === "INGILIZ" ? "INGILIZ" : "ARAP";
  const pist = filters.surface === "ALL" ? "ALL" : surfaceToPist(filters.surface);
  const qLike = `%${filters.q}%`;
  const [c] = await db.$queryRaw<{ sire: bigint; dam: bigint; damSire: bigint }[]>(Prisma.sql`
    SELECT (SELECT COUNT(*)::bigint FROM "SireStatOwn" WHERE "irk" = ${breedToIrk(irk)}) AS "sire",
           (SELECT COUNT(*)::bigint FROM "DamStatOwn" WHERE "irk" = ${breedToIrk(irk)}) AS "dam",
           (SELECT COUNT(*)::bigint FROM "DamSireStatOwn" WHERE "irk" = ${breedToIrk(irk)}) AS "damSire"`);
  const sire = Number(c?.sire ?? 0), dam = Number(c?.dam ?? 0), damSire = Number(c?.damSire ?? 0);
  const ownIrk = breedToIrk(irk);
  const rows = await db.$queryRaw<OwnSatir[]>(Prisma.sql`
    WITH own AS (
      SELECT 'SIRE'::text AS "sourceType", "sireName"::text AS "entityName", NULL::text AS "relatedName", "pist"::text AS "surface", "mesafe"::text AS "distanceBand",
             "start"::int AS "starts", "birinci"::int AS "wins", "kYuzde"::double precision AS "winRatePct", "ikinci"::int AS "seconds", "ucuncu"::int AS "thirds",
             "dorduncu"::int AS "fourths", "besinci"::int AS "fifths", 0::int AS "offspringCount", 0::int AS "winningOffspringCount"
      FROM "SireStatOwn" WHERE "irk" = ${ownIrk}
      UNION ALL
      SELECT 'DAM'::text, "damName"::text, "damSireName"::text, "pist"::text, "mesafe"::text, "start"::int, "birinci"::int, "kYuzde"::double precision, "ikinci"::int, "ucuncu"::int,
             "dorduncu"::int, "besinci"::int, "yavruSayisi"::int, "kazananYavruSayisi"::int
      FROM "DamStatOwn" WHERE "irk" = ${ownIrk}
      UNION ALL
      SELECT 'DAMSIRE'::text, "damSireName"::text, NULL::text, "pist"::text, "mesafe"::text, "start"::int, "birinci"::int, "kYuzde"::double precision, "ikinci"::int, "ucuncu"::int,
             "dorduncu"::int, "besinci"::int, "torunSayisi"::int, "kazananTorunSayisi"::int
      FROM "DamSireStatOwn" WHERE "irk" = ${ownIrk}
    )
    SELECT * FROM own
    WHERE (${filters.kind} = 'ALL' OR "sourceType" = ${filters.kind})
      AND (${pist} = 'ALL' OR "surface" = ${pist})
      AND (${filters.distance} = 'ALL' OR "distanceBand" = ${filters.distance})
      AND (${filters.q} = '' OR "entityName" ILIKE ${qLike} OR COALESCE("relatedName", '') ILIKE ${qLike})
    ORDER BY "starts" DESC, "wins" DESC, "entityName" ASC
    LIMIT ${limit}`);
  return { counts: { sire, dam, damSire, total: sire + dam + damSire }, rows };
}
