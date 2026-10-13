import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";

export type ExternalPedigreeSourceType =
  | "SIRE"
  | "DAM"
  | "DAMSIRE";

export type ExternalPedigreeStatView = {
  sourceType: ExternalPedigreeSourceType;

  entityName: string;
  entityNormalizedName: string;

  damSireName: string | null;
  damSireNormalizedName: string | null;

  horseCount: number | null;

  kkNumerator: number | null;
  kkDenominator: number | null;
  kkRatePct: number | null;
  kkSemantic: string | null;

  starts: number;
  wins: number;
  winRatePct: number;

  seconds: number;
  thirds: number;
  fourths: number;
  fifths: number;

  earningsTRY: number;
  aei: number | null;

  capturedAt: string;
};

export type ExternalPedigreeRaceMatch = {
  datasetYear: number;

  breed: "INGILIZ" | "ARAP";
  surface: "CIM" | "KUM" | "SENTETIK";

  distanceBand:
    | "800-1400"
    | "1500-2000"
    | "2100-3200";

  sire: ExternalPedigreeStatView | null;
  dam: ExternalPedigreeStatView | null;
  damSire: ExternalPedigreeStatView | null;

  matchCount: number;
};

type DbRow = {
  sourceType: string;

  entityName: string;
  entityNormalizedName: string;

  damSireName: string | null;
  damSireNormalizedName: string | null;

  horseCount: number | null;

  kkNumerator: number | null;
  kkDenominator: number | null;
  kkRatePct: number | null;
  kkSemantic: string | null;

  starts: number;
  wins: number;
  winRatePct: number;

  seconds: number;
  thirds: number;
  fourths: number;
  fifths: number;

  earningsTRY: bigint;
  aei: number | null;

  capturedAt: string;
};

export type ExternalPedigreeRunnerInput = {
  sire: string | null;
  dam: string | null;
  damSire: string | null;
};

export function normalizeExternalPedigreeName(
  value: string | null | undefined
): string {
  if (!value) return "";

  let s = value
    .trim()
    .replace(/\s*\([A-Za-z]{2,4}\)\s*$/, "");

  s = s
    .replaceAll("Ç", "C")
    .replaceAll("Ğ", "G")
    .replaceAll("İ", "I")
    .replaceAll("Ö", "O")
    .replaceAll("Ş", "S")
    .replaceAll("Ü", "U")
    .replaceAll("ç", "C")
    .replaceAll("ğ", "G")
    .replaceAll("ı", "I")
    .replaceAll("i", "I")
    .replaceAll("ö", "O")
    .replaceAll("ş", "S")
    .replaceAll("ü", "U")
    .toUpperCase();

  return s
    .replace(/[^A-Z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function raceBreed(
  breed: string
): "INGILIZ" | "ARAP" | null {
  const b =
    normalizeExternalPedigreeName(breed);

  if (b.includes("ARAP")) {
    return "ARAP";
  }

  if (
    b.includes("INGILIZ") ||
    b === "ING"
  ) {
    return "INGILIZ";
  }

  return null;
}

function raceSurface(
  surface: string
): "CIM" | "KUM" | "SENTETIK" | null {
  const s =
    normalizeExternalPedigreeName(surface);

  if (
    s === "CIM" ||
    s.includes("TURF")
  ) {
    return "CIM";
  }

  if (
    s === "KUM" ||
    s.includes("DIRT")
  ) {
    return "KUM";
  }

  if (
    s === "SENTETIK" ||
    s.includes("SYNTH")
  ) {
    return "SENTETIK";
  }

  return null;
}

function distanceBand(
  distance: number
):
  | "800-1400"
  | "1500-2000"
  | "2100-3200"
  | null {

  if (
    distance >= 800 &&
    distance <= 1400
  ) {
    return "800-1400";
  }

  if (
    distance >= 1500 &&
    distance <= 2000
  ) {
    return "1500-2000";
  }

  if (
    distance >= 2100 &&
    distance <= 3200
  ) {
    return "2100-3200";
  }

  return null;
}

function toView(
  row: DbRow
): ExternalPedigreeStatView {
  return {
    sourceType:
      row.sourceType as ExternalPedigreeSourceType,

    entityName:
      row.entityName,

    entityNormalizedName:
      row.entityNormalizedName,

    damSireName:
      row.damSireName,

    damSireNormalizedName:
      row.damSireNormalizedName,

    horseCount:
      row.horseCount,

    kkNumerator:
      row.kkNumerator,

    kkDenominator:
      row.kkDenominator,

    kkRatePct:
      row.kkRatePct,

    kkSemantic:
      row.kkSemantic,

    starts:
      row.starts,

    wins:
      row.wins,

    winRatePct:
      row.winRatePct,

    seconds:
      row.seconds,

    thirds:
      row.thirds,

    fourths:
      row.fourths,

    fifths:
      row.fifths,

    earningsTRY:
      Number(row.earningsTRY),

    aei:
      row.aei,

    capturedAt:
      row.capturedAt,
  };
}

function newest(
  a: DbRow,
  b: DbRow
): number {
  return b.capturedAt.localeCompare(
    a.capturedAt
  );
}

function findSingle(
  rows: DbRow[],
  type: "SIRE" | "DAMSIRE",
  name: string
): ExternalPedigreeStatView | null {

  if (!name) return null;

  const matches = rows
    .filter(
      (r) =>
        r.sourceType === type &&
        r.entityNormalizedName === name
    )
    .sort(newest);

  return matches.length
    ? toView(matches[0])
    : null;
}

function findDam(
  rows: DbRow[],
  damName: string,
  damSireName: string
): ExternalPedigreeStatView | null {

  if (!damName) return null;

  const matches = rows
    .filter(
      (r) =>
        r.sourceType === "DAM" &&
        r.entityNormalizedName === damName
    )
    .sort(newest);

  if (!matches.length) {
    return null;
  }

  if (damSireName) {

    const exact = matches.filter(
      (r) =>
        r.damSireNormalizedName ===
        damSireName
    );

    if (exact.length) {
      return toView(exact[0]);
    }
  }

  // Aynı anne ismi birden fazla soy hattında varsa
  // tahmin yürütmeyiz.
  if (matches.length !== 1) {
    return null;
  }

  return toView(matches[0]);
}

/**
 * External pedigree yalnız veri sağlar.
 * Bu fonksiyon score / probability / rank üretmez.
 *
 * ARAP snapshotları aynı tabloya breed=ARAP ile
 * geldiği anda bu kod değişmeden onları da kullanır.
 */
export async function getExternalPedigreeForRace(
  runners: ExternalPedigreeRunnerInput[],
  breedRaw: string,
  surfaceRaw: string,
  distance: number,
  datasetYear = 2026
): Promise<(ExternalPedigreeRaceMatch | null)[]> {

  const breed = raceBreed(breedRaw);
  const surface = raceSurface(surfaceRaw);
  const band = distanceBand(distance);

  if (
    !breed ||
    !surface ||
    !band
  ) {
    return runners.map(() => null);
  }

  const names =
    runners.map((r) => ({
      sire:
        normalizeExternalPedigreeName(
          r.sire
        ),

      dam:
        normalizeExternalPedigreeName(
          r.dam
        ),

      damSire:
        normalizeExternalPedigreeName(
          r.damSire
        ),
    }));

  const allNames = [
    ...new Set(
      names
        .flatMap(
          (r) => [
            r.sire,
            r.dam,
            r.damSire,
          ]
        )
        .filter(
          (x) => x.length > 0
        )
    ),
  ];

  if (!allNames.length) {
    return runners.map(() => null);
  }

  const rows =
    await db.$queryRaw<DbRow[]>(
      Prisma.sql`
        SELECT
          "sourceType",
          "entityName",
          "entityNormalizedName",
          "damSireName",
          "damSireNormalizedName",
          "horseCount",
          "kkNumerator",
          "kkDenominator",
          "kkRatePct",
          "kkSemantic",
          "starts",
          "wins",
          "winRatePct",
          "seconds",
          "thirds",
          "fourths",
          "fifths",
          "earningsTRY",
          "aei",
          "capturedAt"
        FROM "ExternalPedigreeStat"
        WHERE
          "dataClass" = 'EXTERNAL_MANUAL'
          AND "year" = ${datasetYear}
          AND "breed" = ${breed}
          AND "surface" = ${surface}
          AND "distanceBand" = ${band}
          AND "entityNormalizedName" IN (
            ${Prisma.join(allNames)}
          )
      `
    );

  return names.map((r) => {

    const sire = findSingle(
      rows,
      "SIRE",
      r.sire
    );

    const dam = findDam(
      rows,
      r.dam,
      r.damSire
    );

    const damSire = findSingle(
      rows,
      "DAMSIRE",
      r.damSire
    );

    return {
      datasetYear,
      breed,
      surface,
      distanceBand: band,

      sire,
      dam,
      damSire,

      matchCount:
        [sire, dam, damSire]
          .filter(Boolean)
          .length,
    };
  });
}