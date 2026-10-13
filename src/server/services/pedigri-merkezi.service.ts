import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { breedToIrk, surfaceToPist } from "@/lib/sire-stat-match";

export type PedigriMerkeziBreed = "INGILIZ" | "ARAP";
export type PedigriMerkeziType = "ALL" | "SIRE" | "DAM" | "DAMSIRE";
export type PedigriMerkeziSurface = "ALL" | "CIM" | "KUM" | "SENTETIK";
export type PedigriMerkeziDistance = "ALL" | "800-1400" | "1500-2000" | "2100-3200";

export type PedigriMerkeziFilters = {
  breed: PedigriMerkeziBreed;
  q: string;
  sourceType: PedigriMerkeziType;
  surface: PedigriMerkeziSurface;
  distanceBand: PedigriMerkeziDistance;
};

export type ExternalPedigriRow = {
  sourceType: "SIRE" | "DAM" | "DAMSIRE";
  entityName: string;
  damSireName: string | null;
  surface: "CIM" | "KUM" | "SENTETIK";
  distanceBand: string;
  starts: number;
  wins: number;
  winRatePct: number;
  seconds: number;
  thirds: number;
  fourths: number;
  fifths: number;
  earningsTRY: string;
  aei: number | null;
  horseCount: number | null;
  capturedAt: string;
};

export type OwnPedigriRow = {
  sourceType: "SIRE" | "DAM" | "DAMSIRE";
  entityName: string;
  relatedName: string | null;
  surface: string;
  distanceBand: string;
  starts: number;
  wins: number;
  winRatePct: number;
  seconds: number;
  thirds: number;
  fourths: number;
  fifths: number;
  offspringCount: number;
  winningOffspringCount: number;
};

export type PedigriMerkeziData = {
  externalAvailable: boolean;
  externalError: string | null;
  externalCounts: { sire: number; dam: number; damSire: number; total: number };
  ownCounts: { sire: number; dam: number; damSire: number; total: number };
  externalRows: ExternalPedigriRow[];
  ownRows: OwnPedigriRow[];
};

type CountRow = { sourceType: string; n: bigint };

function clampLimit(limit: number): number {
  return Math.max(20, Math.min(250, Math.trunc(limit)));
}

export async function getPedigriMerkeziData(
  filters: PedigriMerkeziFilters,
  limit = 120
): Promise<PedigriMerkeziData> {
  const safeLimit = clampLimit(limit);
  const q = filters.q.trim();
  const qLike = `%${q}%`;
  const ownIrk = breedToIrk(filters.breed);
  const ownPist = filters.surface === "ALL" ? "ALL" : surfaceToPist(filters.surface);

  let externalAvailable = true;
  let externalError: string | null = null;
  let externalRows: ExternalPedigriRow[] = [];
  let externalCounts = { sire: 0, dam: 0, damSire: 0, total: 0 };

  try {
    const countRows = await db.$queryRaw<CountRow[]>(
      Prisma.sql`
        SELECT "sourceType", COUNT(*)::bigint AS n
        FROM "ExternalPedigreeStat"
        WHERE "year" = 2026
          AND "breed" = ${filters.breed}
        GROUP BY "sourceType"
      `
    );

    const countMap = new Map(countRows.map((r) => [r.sourceType, Number(r.n)]));
    const sire = countMap.get("SIRE") ?? 0;
    const dam = countMap.get("DAM") ?? 0;
    const damSire = countMap.get("DAMSIRE") ?? 0;
    externalCounts = { sire, dam, damSire, total: sire + dam + damSire };

    externalRows = await db.$queryRaw<ExternalPedigriRow[]>(
      Prisma.sql`
        SELECT
          "sourceType"::text AS "sourceType",
          "entityName"::text AS "entityName",
          NULLIF("damSireName", '')::text AS "damSireName",
          "surface"::text AS "surface",
          "distanceBand"::text AS "distanceBand",
          COALESCE("starts", 0)::int AS "starts",
          COALESCE("wins", 0)::int AS "wins",
          COALESCE("winRatePct", 0)::double precision AS "winRatePct",
          COALESCE("seconds", 0)::int AS "seconds",
          COALESCE("thirds", 0)::int AS "thirds",
          COALESCE("fourths", 0)::int AS "fourths",
          COALESCE("fifths", 0)::int AS "fifths",
          COALESCE("earningsTRY", 0)::text AS "earningsTRY",
          CASE WHEN "aei" IS NULL THEN NULL ELSE "aei"::double precision END AS "aei",
          CASE WHEN "horseCount" IS NULL THEN NULL ELSE "horseCount"::int END AS "horseCount",
          "capturedAt"::text AS "capturedAt"
        FROM "ExternalPedigreeStat"
        WHERE "year" = 2026
          AND "breed" = ${filters.breed}
          AND (${filters.sourceType} = 'ALL' OR "sourceType" = ${filters.sourceType})
          AND (${filters.surface} = 'ALL' OR "surface" = ${filters.surface})
          AND (${filters.distanceBand} = 'ALL' OR "distanceBand" = ${filters.distanceBand})
          AND "entityNormalizedName" <> ''
          AND (
            ${q} = ''
            OR "entityName" ILIKE ${qLike}
            OR COALESCE("damSireName", '') ILIKE ${qLike}
          )
        ORDER BY "starts" DESC, "wins" DESC, "entityName" ASC
        LIMIT ${safeLimit}
      `
    );
  } catch (error) {
    externalAvailable = false;
    externalError = error instanceof Error ? error.message : String(error);
  }

  const ownCountRows = await db.$queryRaw<
    { sire: bigint; dam: bigint; damSire: bigint }[]
  >(
    Prisma.sql`
      SELECT
        (SELECT COUNT(*)::bigint FROM "SireStatOwn" WHERE "irk" = ${ownIrk}) AS "sire",
        (SELECT COUNT(*)::bigint FROM "DamStatOwn" WHERE "irk" = ${ownIrk}) AS "dam",
        (SELECT COUNT(*)::bigint FROM "DamSireStatOwn" WHERE "irk" = ${ownIrk}) AS "damSire"
    `
  );

  const ownCount = ownCountRows[0] ?? { sire: 0n, dam: 0n, damSire: 0n };
  const ownCounts = {
    sire: Number(ownCount.sire),
    dam: Number(ownCount.dam),
    damSire: Number(ownCount.damSire),
    total: Number(ownCount.sire + ownCount.dam + ownCount.damSire),
  };

  const ownRows = await db.$queryRaw<OwnPedigriRow[]>(
    Prisma.sql`
      WITH own AS (
        SELECT
          'SIRE'::text AS "sourceType",
          "sireName"::text AS "entityName",
          NULL::text AS "relatedName",
          "pist"::text AS "surface",
          "mesafe"::text AS "distanceBand",
          "start"::int AS "starts",
          "birinci"::int AS "wins",
          "kYuzde"::double precision AS "winRatePct",
          "ikinci"::int AS "seconds",
          "ucuncu"::int AS "thirds",
          "dorduncu"::int AS "fourths",
          "besinci"::int AS "fifths",
          0::int AS "offspringCount",
          0::int AS "winningOffspringCount"
        FROM "SireStatOwn"
        WHERE "irk" = ${ownIrk}

        UNION ALL

        SELECT
          'DAM'::text AS "sourceType",
          "damName"::text AS "entityName",
          "damSireName"::text AS "relatedName",
          "pist"::text AS "surface",
          "mesafe"::text AS "distanceBand",
          "start"::int AS "starts",
          "birinci"::int AS "wins",
          "kYuzde"::double precision AS "winRatePct",
          "ikinci"::int AS "seconds",
          "ucuncu"::int AS "thirds",
          "dorduncu"::int AS "fourths",
          "besinci"::int AS "fifths",
          "yavruSayisi"::int AS "offspringCount",
          "kazananYavruSayisi"::int AS "winningOffspringCount"
        FROM "DamStatOwn"
        WHERE "irk" = ${ownIrk}

        UNION ALL

        SELECT
          'DAMSIRE'::text AS "sourceType",
          "damSireName"::text AS "entityName",
          NULL::text AS "relatedName",
          "pist"::text AS "surface",
          "mesafe"::text AS "distanceBand",
          "start"::int AS "starts",
          "birinci"::int AS "wins",
          "kYuzde"::double precision AS "winRatePct",
          "ikinci"::int AS "seconds",
          "ucuncu"::int AS "thirds",
          "dorduncu"::int AS "fourths",
          "besinci"::int AS "fifths",
          "torunSayisi"::int AS "offspringCount",
          "kazananTorunSayisi"::int AS "winningOffspringCount"
        FROM "DamSireStatOwn"
        WHERE "irk" = ${ownIrk}
      )
      SELECT *
      FROM own
      WHERE (${filters.sourceType} = 'ALL' OR "sourceType" = ${filters.sourceType})
        AND (${ownPist} = 'ALL' OR "surface" = ${ownPist})
        AND (${filters.distanceBand} = 'ALL' OR "distanceBand" = ${filters.distanceBand})
        AND (${q} = '' OR "entityName" ILIKE ${qLike} OR COALESCE("relatedName", '') ILIKE ${qLike})
      ORDER BY "starts" DESC, "wins" DESC, "entityName" ASC
      LIMIT ${safeLimit}
    `
  );

  return {
    externalAvailable,
    externalError,
    externalCounts,
    ownCounts,
    externalRows,
    ownRows,
  };
}
