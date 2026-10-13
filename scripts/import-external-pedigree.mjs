import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;

  const txt = fs.readFileSync(file, "utf8");

  for (const rawLine of txt.split(/\r?\n/)) {
    const line = rawLine.trim();

    if (!line || line.startsWith("#")) continue;

    const ix = line.indexOf("=");

    if (ix <= 0) continue;

    const key = line.slice(0, ix).trim();

    let value = line.slice(ix + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

loadDotEnv(path.resolve(process.cwd(), ".env"));

const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();

const DATA_ROOT =
  process.env.PEDIGREE_DATA_ROOT ||
  path.resolve(
    process.cwd(),
    "..",
    "data",
    "v547",
    "pedigree",
    "manual"
  );

const EXPECTED_TOTAL = 12905;

const EXPECTED = {
  SIRE: 1662,
  DAM: 8560,
  DAMSIRE: 2683,
};

const expectedSegmentCount = {
  SIRE: 9,
  DAM: 9,
  DAMSIRE: 9,
};

function walk(dir) {
  const result = [];

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      result.push(...walk(full));
    } else if (entry.isFile() && entry.name === "latest.json") {
      result.push(full);
    }
  }

  return result;
}

function normalizeSourceType(value) {
  return String(value || "").trim().toUpperCase();
}

function normalizeSurface(value) {
  return String(value || "")
    .trim()
    .toUpperCase()
    .replaceAll("Ç", "C")
    .replaceAll("Ğ", "G")
    .replaceAll("İ", "I")
    .replaceAll("Ö", "O")
    .replaceAll("Ş", "S")
    .replaceAll("Ü", "U");
}

function numeric(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function integer(value, fallback = 0) {
  return Math.trunc(numeric(value, fallback));
}

function nullableNumber(value) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const n = Number(value);

  return Number.isFinite(n) ? n : null;
}

function nullableInteger(value) {
  const n = nullableNumber(value);
  return n === null ? null : Math.trunc(n);
}

function nullableString(value) {
  if (value === null || value === undefined) return null;

  const s = String(value).trim();

  return s === "" ? null : s;
}

function hashKey(value) {
  return crypto
    .createHash("sha256")
    .update(value, "utf8")
    .digest("hex");
}

function canonicalBreed(sourceBreed) {
  const value = String(sourceBreed || "")
    .trim()
    .toUpperCase();

  // Bu importun kapsami audit ile dogrulanmis 2026 INGILIZ 27 segmentidir.
  if (
    value === "" ||
    value === "UNSPECIFIED" ||
    value === "INGILIZ"
  ) {
    return "INGILIZ";
  }

  throw new Error(
    `UNEXPECTED_BREED=${value}; this importer is locked to INGILIZ`
  );
}

function printSegment(segment) {
  return [
    segment.sourceType,
    segment.year,
    segment.breed,
    segment.surface,
    segment.distanceBand,
    segment.capturedAt,
  ].join("|");
}

async function main() {
  console.log("");
  console.log("============================================================");
  console.log(" ROTAGANYAN EXTERNAL PEDIGREE DB IMPORT");
  console.log("============================================================");
  console.log(`DATA_ROOT=${DATA_ROOT}`);

  if (!fs.existsSync(DATA_ROOT)) {
    throw new Error(`DATA_ROOT_NOT_FOUND=${DATA_ROOT}`);
  }

  const latestFiles = walk(DATA_ROOT).sort();

  console.log(`LATEST_JSON_FOUND=${latestFiles.length}`);

  if (latestFiles.length !== 27) {
    throw new Error(
      `LATEST_JSON_COUNT_FAIL expected=27 actual=${latestFiles.length}`
    );
  }

  const segments = [];
  const typeRows = {
    SIRE: 0,
    DAM: 0,
    DAMSIRE: 0,
  };

  const typeSegments = {
    SIRE: 0,
    DAM: 0,
    DAMSIRE: 0,
  };

  let totalRows = 0;

  for (const file of latestFiles) {
    const json = JSON.parse(fs.readFileSync(file, "utf8"));

    if (!json.metadata) {
      throw new Error(`METADATA_MISSING=${file}`);
    }

    const sourceType = normalizeSourceType(
      json.metadata.sourceType
    );

    if (!["SIRE", "DAM", "DAMSIRE"].includes(sourceType)) {
      throw new Error(
        `UNEXPECTED_SOURCE_TYPE=${sourceType} file=${file}`
      );
    }

    const year = integer(json.metadata.year);

    if (year !== 2026) {
      throw new Error(
        `YEAR_FAIL file=${file} expected=2026 actual=${year}`
      );
    }

    const sourceBreed =
      nullableString(json.metadata.breed) ||
      "UNSPECIFIED";

    const breed = canonicalBreed(sourceBreed);

    const surface = normalizeSurface(
      json.metadata.surface
    );

    if (!["CIM", "KUM", "SENTETIK"].includes(surface)) {
      throw new Error(
        `SURFACE_FAIL=${surface} file=${file}`
      );
    }

    const distanceBand = String(
      json.metadata.distanceBand || ""
    ).trim();

    if (
      ![
        "800-1400",
        "1500-2000",
        "2100-3200",
      ].includes(distanceBand)
    ) {
      throw new Error(
        `DISTANCE_FAIL=${distanceBand} file=${file}`
      );
    }

    const capturedAt = String(
      json.metadata.capturedAt || ""
    ).trim();

    if (!capturedAt) {
      throw new Error(
        `CAPTURED_AT_MISSING=${file}`
      );
    }

    const rows = Array.isArray(json.rows)
      ? json.rows
      : [];

    const declared = integer(json.rowCount);

    if (
      declared <= 0 ||
      rows.length !== declared
    ) {
      throw new Error(
        `ROW_COUNT_FAIL file=${file} declared=${declared} actual=${rows.length}`
      );
    }

    const segment = {
      file,
      schemaVersion: nullableString(
        json.schemaVersion
      ),
      source:
        nullableString(json.metadata.source) ||
        "HIPODROMX_MANUAL",
      dataClass:
        nullableString(json.metadata.dataClass) ||
        "EXTERNAL_MANUAL",
      sourceType,
      year,
      breed,
      sourceBreed,
      surface,
      distanceBand,
      capturedAt,
      rowCount: declared,
      rows,
    };

    segments.push(segment);

    typeRows[sourceType] += declared;
    typeSegments[sourceType] += 1;
    totalRows += declared;
  }

  const segmentKeys = new Set(
    segments.map((x) =>
      [
        x.sourceType,
        x.year,
        x.breed,
        x.surface,
        x.distanceBand,
      ].join("|")
    )
  );

  if (segmentKeys.size !== 27) {
    throw new Error(
      `SEGMENT_UNIQUENESS_FAIL expected=27 actual=${segmentKeys.size}`
    );
  }

  for (const type of ["SIRE", "DAM", "DAMSIRE"]) {
    console.log(
      `${type}_SEGMENTS=${typeSegments[type]}/9 ROWS=${typeRows[type]}`
    );

    if (
      typeSegments[type] !== expectedSegmentCount[type]
    ) {
      throw new Error(
        `${type}_SEGMENT_COUNT_FAIL`
      );
    }

    if (typeRows[type] !== EXPECTED[type]) {
      throw new Error(
        `${type}_ROW_COUNT_FAIL expected=${EXPECTED[type]} actual=${typeRows[type]}`
      );
    }
  }

  console.log(`TOTAL_SEGMENTS=${segments.length}/27`);
  console.log(`TOTAL_ROWS=${totalRows}`);

  if (
    segments.length !== 27 ||
    totalRows !== EXPECTED_TOTAL
  ) {
    throw new Error(
      `DATA_GATE_FAIL segments=${segments.length} rows=${totalRows}`
    );
  }

  console.log("SOURCE_DATA_GATE=PASS");

  const records = [];
  const uniqueRecordKeys = new Set();

  for (const segment of segments) {
    for (const row of segment.rows) {
      const entityName = String(
        row.entityName || ""
      ).trim();

      const entityNormalizedName = String(
        row.entityNormalizedName || ""
      ).trim();

      if (!entityName || !entityNormalizedName) {
        throw new Error(
          `BLANK_ENTITY segment=${printSegment(segment)}`
        );
      }

      const damSireName =
        nullableString(row.damSireName);

      const damSireNormalizedName =
        nullableString(
          row.damSireNormalizedName
        );

      const naturalKey = [
        segment.sourceType,
        segment.year,
        segment.breed,
        segment.surface,
        segment.distanceBand,
        segment.capturedAt,
        entityNormalizedName,
        damSireNormalizedName || "",
      ].join("|");

      const recordKey = hashKey(naturalKey);

      if (uniqueRecordKeys.has(recordKey)) {
        throw new Error(
          `DUPLICATE_RECORD_KEY natural=${naturalKey}`
        );
      }

      uniqueRecordKeys.add(recordKey);

      records.push({
        recordKey,

        source: segment.source,
        dataClass: "EXTERNAL_MANUAL",
        schemaVersion:
          segment.schemaVersion,
        sourceType:
          segment.sourceType,

        year:
          segment.year,
        breed:
          segment.breed,
        sourceBreed:
          segment.sourceBreed,
        surface:
          segment.surface,
        distanceBand:
          segment.distanceBand,
        capturedAt:
          segment.capturedAt,
        sourceFile:
          path.relative(
            DATA_ROOT,
            segment.file
          ),

        entityName,
        entityNormalizedName,

        damSireName,
        damSireNormalizedName,
        horseCount:
          nullableInteger(row.horseCount),

        kkNumerator:
          nullableInteger(row.kkNumerator),
        kkDenominator:
          nullableInteger(row.kkDenominator),
        kkRatePct:
          nullableNumber(row.kkRatePct),
        kkSemantic:
          nullableString(row.kkSemantic),

        starts:
          integer(row.starts),
        wins:
          integer(row.wins),
        winRatePct:
          numeric(row.winRatePct),
        seconds:
          integer(row.seconds),
        thirds:
          integer(row.thirds),
        fourths:
          integer(row.fourths),
        fifths:
          integer(row.fifths),

        earningsTRY:
          BigInt(
            integer(row.earningsTRY)
          ),

        aei:
          nullableNumber(row.aei),
      });
    }
  }

  if (records.length !== EXPECTED_TOTAL) {
    throw new Error(
      `NORMALIZED_TOTAL_FAIL expected=${EXPECTED_TOTAL} actual=${records.length}`
    );
  }

  console.log(
    `NORMALIZED_RECORDS=${records.length}`
  );
  console.log(
    `UNIQUE_RECORD_KEYS=${uniqueRecordKeys.size}`
  );

  if (
    uniqueRecordKeys.size !==
    EXPECTED_TOTAL
  ) {
    throw new Error(
      "RECORD_KEY_UNIQUENESS_FAIL"
    );
  }

  console.log("");
  console.log("=== DATABASE WRITE ===");

  const existingBefore =
    await prisma.externalPedigreeStat.count({
      where: {
        dataClass: "EXTERNAL_MANUAL",
        year: 2026,
        breed: "INGILIZ",
      },
    });

  console.log(
    `EXISTING_TARGET_ROWS_BEFORE=${existingBefore}`
  );

  const deleted =
    await prisma.externalPedigreeStat.deleteMany({
      where: {
        dataClass: "EXTERNAL_MANUAL",
        year: 2026,
        breed: "INGILIZ",
      },
    });

  console.log(
    `DELETED_OLD_TARGET_ROWS=${deleted.count}`
  );

  const BATCH = 500;

  let inserted = 0;

  try {
    for (
      let i = 0;
      i < records.length;
      i += BATCH
    ) {
      const batch = records.slice(
        i,
        i + BATCH
      );

      const result =
        await prisma.externalPedigreeStat.createMany({
          data: batch,
        });

      inserted += result.count;

      console.log(
        `INSERTED=${inserted}/${records.length}`
      );
    }
  } catch (error) {
    console.error(
      "IMPORT_FAILED_AFTER_DELETE=YES"
    );
    throw error;
  }

  if (inserted !== EXPECTED_TOTAL) {
    throw new Error(
      `INSERT_COUNT_FAIL expected=${EXPECTED_TOTAL} actual=${inserted}`
    );
  }

  console.log("");
  console.log("=== READBACK ===");

  const totalDb =
    await prisma.externalPedigreeStat.count({
      where: {
        dataClass: "EXTERNAL_MANUAL",
        year: 2026,
        breed: "INGILIZ",
      },
    });

  const sireDb =
    await prisma.externalPedigreeStat.count({
      where: {
        dataClass: "EXTERNAL_MANUAL",
        year: 2026,
        breed: "INGILIZ",
        sourceType: "SIRE",
      },
    });

  const damDb =
    await prisma.externalPedigreeStat.count({
      where: {
        dataClass: "EXTERNAL_MANUAL",
        year: 2026,
        breed: "INGILIZ",
        sourceType: "DAM",
      },
    });

  const damSireDb =
    await prisma.externalPedigreeStat.count({
      where: {
        dataClass: "EXTERNAL_MANUAL",
        year: 2026,
        breed: "INGILIZ",
        sourceType: "DAMSIRE",
      },
    });

  console.log(`SIRE_DB_ROWS=${sireDb}`);
  console.log(`DAM_DB_ROWS=${damDb}`);
  console.log(`DAMSIRE_DB_ROWS=${damSireDb}`);
  console.log(`TOTAL_DB_ROWS=${totalDb}`);

  if (sireDb !== EXPECTED.SIRE) {
    throw new Error(
      `SIRE_DB_READBACK_FAIL expected=${EXPECTED.SIRE} actual=${sireDb}`
    );
  }

  if (damDb !== EXPECTED.DAM) {
    throw new Error(
      `DAM_DB_READBACK_FAIL expected=${EXPECTED.DAM} actual=${damDb}`
    );
  }

  if (damSireDb !== EXPECTED.DAMSIRE) {
    throw new Error(
      `DAMSIRE_DB_READBACK_FAIL expected=${EXPECTED.DAMSIRE} actual=${damSireDb}`
    );
  }

  if (totalDb !== EXPECTED_TOTAL) {
    throw new Error(
      `TOTAL_DB_READBACK_FAIL expected=${EXPECTED_TOTAL} actual=${totalDb}`
    );
  }

  let segmentPass = 0;

  for (const segment of segments) {
    const count =
      await prisma.externalPedigreeStat.count({
        where: {
          dataClass: "EXTERNAL_MANUAL",
          sourceType:
            segment.sourceType,
          year:
            segment.year,
          breed:
            segment.breed,
          surface:
            segment.surface,
          distanceBand:
            segment.distanceBand,
          capturedAt:
            segment.capturedAt,
        },
      });

    if (count !== segment.rowCount) {
      throw new Error(
        `SEGMENT_DB_READBACK_FAIL segment=${printSegment(segment)} expected=${segment.rowCount} actual=${count}`
      );
    }

    segmentPass++;

    console.log(
      `SEGMENT_PASS=${segment.sourceType}|${segment.surface}|${segment.distanceBand} ROWS=${count}`
    );
  }

  console.log("");
  console.log(
    `SEGMENT_DB_READBACK=${segmentPass}/27`
  );

  if (segmentPass !== 27) {
    throw new Error(
      `SEGMENT_READBACK_FAIL actual=${segmentPass}`
    );
  }

  const unspecifiedSource =
    await prisma.externalPedigreeStat.count({
      where: {
        dataClass: "EXTERNAL_MANUAL",
        year: 2026,
        breed: "INGILIZ",
        sourceBreed: "UNSPECIFIED",
      },
    });

  console.log(
    `SOURCE_BREED_UNSPECIFIED_ROWS=${unspecifiedSource}`
  );
  console.log(
    "CANONICAL_BREED=INGILIZ"
  );
  console.log(
    "SOURCE_METADATA_PRESERVED=YES"
  );

  console.log("");
  console.log(
    "EXTERNAL_PEDIGREE_DB=PASS"
  );
  console.log(
    "OWN_TABLES_TOUCHED=NO"
  );
  console.log(
    "SCORING_CHANGED=NO"
  );
  console.log(
    "VERCEL_DEPLOYED=NO"
  );
}

main()
  .catch((error) => {
    console.error("");
    console.error(
      "EXTERNAL_PEDIGREE_DB=FAIL"
    );
    console.error(
      error?.stack || error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });