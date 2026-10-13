// REPRODUCIBILITY COMPARISON — RESMİ KAPANIŞ (2026-10-11 kullanıcı talebi).
//
// SALT KARŞILAŞTIRMA — generator'ı TEKRAR ÇALIŞTIRMAZ, hiçbir mevcut dosyayı değiştirmez,
// DB'ye dokunmaz, production write YOK, OOS/Beta/RESCUE tetiklemez. PowerShell'den
// `npx tsx` ile çalıştırılır. SİLİNMEZ — scripts/v5461-audit/ altında kalıcı kalır.
//
// Girdi: challenger-features-v2.json (ORIGINAL) vs challenger-features-v2-repro.json
// (REPRO) — ikisi de scratchpad/master-pit/ altında, zaten var, salt-okunur açılır.
//
// Çıktı: scratchpad/master-pit/reproducibility-report.json
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const MP = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/master-pit";
const ORIGINAL_PATH = `${MP}/challenger-features-v2.json`;
const REPRO_PATH = `${MP}/challenger-features-v2-repro.json`;
const REPORT_PATH = `${MP}/reproducibility-report.json`;
const GENERATOR_SCRIPT_PATH = "C:/Users/tlgbi/OneDrive/Belgeler/Rota/rotaganyan/scripts/v5461-audit/challenger-build-v2.mts";
const COMPARATOR_SCRIPT_PATH = "C:/Users/tlgbi/OneDrive/Belgeler/Rota/rotaganyan/scripts/v5461-audit/repro-compare.mts";

const sha256 = (buf: Buffer) => createHash("sha256").update(buf).digest("hex");

type Chal = { raw: number | null; observed: boolean; reliability: number };
type FeatureRow = { raceId: string; runnerId: string; win: boolean; challengers: Record<string, Chal> };

console.error("1) Byte-level karşılaştırma...");
const originalBuf = readFileSync(ORIGINAL_PATH);
const reproBuf = readFileSync(REPRO_PATH);
const originalSha = sha256(originalBuf);
const reproSha = sha256(reproBuf);
const bufferEqual = originalBuf.equals(reproBuf);
console.error(`   original: ${originalBuf.length} bayt, sha256=${originalSha}`);
console.error(`   repro:    ${reproBuf.length} bayt, sha256=${reproSha}`);
console.error(`   bufferEqual=${bufferEqual}`);

console.error("2) JSON ayrıştırılıyor...");
const originalRows: FeatureRow[] = JSON.parse(originalBuf.toString("utf8"));
const reproRows: FeatureRow[] = JSON.parse(reproBuf.toString("utf8"));

console.error("3) Semantic (hücre-bazlı) karşılaştırma...");
const key = (r: FeatureRow) => `${r.raceId}|${r.runnerId}`;

// Satır sırası — pozisyonel (index-by-index) eşitlik.
let rowOrderIdentical = originalRows.length === reproRows.length;
if (rowOrderIdentical) {
  for (let i = 0; i < originalRows.length; i++) {
    if (key(originalRows[i]) !== key(reproRows[i])) { rowOrderIdentical = false; break; }
  }
}

// Anahtar kümeleri + içerideki tekrar (duplicate) sayımı.
function buildIndex(rows: FeatureRow[]): { map: Map<string, FeatureRow>; duplicateCount: number } {
  const map = new Map<string, FeatureRow>();
  let duplicateCount = 0;
  for (const r of rows) {
    const k = key(r);
    if (map.has(k)) duplicateCount++;
    else map.set(k, r);
  }
  return { map, duplicateCount };
}
const originalIdx = buildIndex(originalRows);
const reproIdx = buildIndex(reproRows);

// missingRowsOriginal: REPRO'da olup ORIGINAL'de OLMAYAN anahtarlar (original'den eksik).
// missingRowsRepro: ORIGINAL'de olup REPRO'da OLMAYAN anahtarlar (repro'dan eksik).
// extraRowsRepro: REPRO dosyasının KENDİ İÇİNDE tekrar eden (duplicate) satır sayısı —
// set-farkından AYRI bir veri-bütünlüğü kontrolü (bkz. dosya başı not, isimlendirme burada
// yorumlandı çünkü istekte üçünün tam tanımı verilmemişti).
let missingRowsOriginal = 0;
for (const k of reproIdx.map.keys()) if (!originalIdx.map.has(k)) missingRowsOriginal++;
let missingRowsRepro = 0;
for (const k of originalIdx.map.keys()) if (!reproIdx.map.has(k)) missingRowsRepro++;
const extraRowsRepro = reproIdx.duplicateCount;

// Feature/series isim kümesi — TÜM satırlar üzerinden birleşik (global) küme.
function unionFeatureNames(rows: FeatureRow[]): Set<string> {
  const s = new Set<string>();
  for (const r of rows) for (const name of Object.keys(r.challengers)) s.add(name);
  return s;
}
const originalNames = unionFeatureNames(originalRows);
const reproNames = unionFeatureNames(reproRows);
const nameSymmetricDiff = new Set<string>();
for (const n of originalNames) if (!reproNames.has(n)) nameSymmetricDiff.add(n);
for (const n of reproNames) if (!originalNames.has(n)) nameSymmetricDiff.add(n);
const featureNameMismatchCount = nameSymmetricDiff.size;

// Hücre-bazlı (raw/observed/reliability) kesin eşitlik — byte-identical dosyalarda
// tolerance GEREKSİZ, exact equality kullanılıyor (kullanıcı talebi madde 4).
let semanticMismatchRows = 0;
let semanticMismatchCells = 0;
let rawMismatchCount = 0;
let observedMismatchCount = 0;
let reliabilityMismatchCount = 0;
const commonFeatureNames = [...originalNames].filter((n) => reproNames.has(n));

for (const [k, origRow] of originalIdx.map) {
  const reproRow = reproIdx.map.get(k);
  if (!reproRow) continue; // zaten missingRowsRepro'da sayıldı
  let rowHasMismatch = false;
  for (const name of commonFeatureNames) {
    const a = origRow.challengers[name];
    const b = reproRow.challengers[name];
    const aRaw = a?.raw ?? null, bRaw = b?.raw ?? null;
    const aObs = a?.observed ?? false, bObs = b?.observed ?? false;
    const aRel = a?.reliability ?? 0, bRel = b?.reliability ?? 0;
    const rawDiff = !(aRaw === bRaw || (aRaw != null && bRaw != null && Number.isNaN(aRaw) && Number.isNaN(bRaw)));
    const obsDiff = aObs !== bObs;
    const relDiff = aRel !== bRel;
    if (rawDiff || obsDiff || relDiff) {
      semanticMismatchCells++;
      rowHasMismatch = true;
      if (rawDiff) rawMismatchCount++;
      if (obsDiff) observedMismatchCount++;
      if (relDiff) reliabilityMismatchCount++;
    }
  }
  if (rowHasMismatch) semanticMismatchRows++;
}

const raceCountOf = (rows: FeatureRow[]) => new Set(rows.map((r) => r.raceId)).size;

const PASS =
  originalSha === reproSha &&
  bufferEqual &&
  semanticMismatchRows === 0 &&
  semanticMismatchCells === 0 &&
  missingRowsOriginal === 0 &&
  missingRowsRepro === 0 &&
  featureNameMismatchCount === 0;

console.error(`4) PASS şartları: SEMANTIC_REPRODUCIBILITY=${PASS ? "PASS" : "FAIL"}`);

const report = {
  generatedAt: new Date().toISOString(),
  files: {
    original: { path: ORIGINAL_PATH, bytes: originalBuf.length, sha256: originalSha },
    repro: { path: REPRO_PATH, bytes: reproBuf.length, sha256: reproSha },
  },
  scripts: {
    generatorScript: { path: GENERATOR_SCRIPT_PATH, sha256: sha256(readFileSync(GENERATOR_SCRIPT_PATH)) },
    comparatorScript: { path: COMPARATOR_SCRIPT_PATH, sha256: sha256(readFileSync(COMPARATOR_SCRIPT_PATH)) },
  },
  rowRaceCounts: {
    originalRowCount: originalRows.length,
    reproRowCount: reproRows.length,
    originalRaceCount: raceCountOf(originalRows),
    reproRaceCount: raceCountOf(reproRows),
  },
  rowOrderIdentical,
  mismatchCounters: {
    semanticMismatchRows,
    semanticMismatchCells,
    missingRowsOriginal,
    missingRowsRepro,
    extraRowsRepro,
    featureNameMismatchCount,
    rawMismatchCount,
    observedMismatchCount,
    reliabilityMismatchCount,
  },
  definitionsNote:
    "missingRowsOriginal = repro'da olup original'de OLMAYAN anahtar sayısı (original'e göre eksik); " +
    "missingRowsRepro = original'de olup repro'da OLMAYAN anahtar sayısı (repro'ya göre eksik); " +
    "extraRowsRepro = repro dosyasının KENDİ İÇİNDE (raceId+runnerId) tekrar eden satır sayısı " +
    "(set-farkından ayrı, veri-bütünlüğü kontrolü) — istekte üçünün tam tanımı verilmemişti, " +
    "bu yorum burada açıkça belgeleniyor.",
  BYTE_IDENTICAL: bufferEqual && originalSha === reproSha,
  SEMANTIC_REPRODUCIBILITY: PASS ? "PASS" : "FAIL",
  productionChanged: false,
  betaFit: false,
  oosRun: false,
  rescueRun: false,
};

writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
console.error(`5) Rapor yazıldı: ${REPORT_PATH}`);
console.log(JSON.stringify(report, null, 2));
