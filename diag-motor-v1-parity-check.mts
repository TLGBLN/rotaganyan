// READ-ONLY. "21 birim testi yeterli degil" (kullanici talebi 2026-10-18) - bu script
// training.ts DEGISIKLIGINDEN ONCEKI (training.pre-refactor-snapshot.ts, training.ts'in
// SIGNAL_CODES-parametrize edilmeden ONCEKI BIREBIR kopyasi) ve SONRAKI (training.ts,
// guncel) hesaplamalarini AYNI, GERCEK (sentetik degil) ozellik vektorleri + AYNI
// katsayilar (fitModel ayni opts'la, deterministik gradyan inisi) + AYNI yarislar uzerinde
// karsilastirir. Beklenen fark: SIFIR (stats, beta, probability, explainRunner satirlari
// dahil, kayan-nokta yuvarlama HARICI tam esitlik).
import { buildFeatureVectorsForRace } from "./src/lib/motor-v1/engine/feature-vector";
import * as OLD from "./src/lib/motor-v1/engine/training.pre-refactor-snapshot";
import * as NEW from "./src/lib/motor-v1/engine/training";
import { db } from "./src/lib/db";

const FIT_OPTS = { lambda: 0.5, learningRate: 0.08, iterations: 60 };

function deepAlmostEqual(a: unknown, b: unknown, path = "$"): string[] {
  const diffs: string[] = [];
  if (typeof a === "number" && typeof b === "number") {
    if (Number.isNaN(a) && Number.isNaN(b)) return diffs;
    if (Math.abs(a - b) > 1e-12) diffs.push(`${path}: ${a} !== ${b} (fark=${a - b})`);
    return diffs;
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) { diffs.push(`${path}: length ${a.length} !== ${b.length}`); return diffs; }
    for (let i = 0; i < a.length; i++) diffs.push(...deepAlmostEqual(a[i], b[i], `${path}[${i}]`));
    return diffs;
  }
  if (a && b && typeof a === "object" && typeof b === "object") {
    const ak = Object.keys(a as object), bk = Object.keys(b as object);
    for (const k of new Set([...ak, ...bk])) diffs.push(...deepAlmostEqual((a as any)[k], (b as any)[k], `${path}.${k}`));
    return diffs;
  }
  if (a !== b) diffs.push(`${path}: ${JSON.stringify(a)} !== ${JSON.stringify(b)}`);
  return diffs;
}

async function main() {
  // 5 gercek, farkli hipodrom/tarihli, sonuclanmis yaris sec.
  const races = await db.race.findMany({
    where: { result: { isNot: null }, runners: { some: { scratched: false } } },
    select: { id: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
    orderBy: { raceDay: { date: "desc" } },
    take: 400,
  });
  const seenHippo = new Set<string>();
  const picked: { id: string; label: string }[] = [];
  for (const r of races) {
    const h = r.raceDay.hippodrome.name;
    if (seenHippo.has(h)) continue;
    seenHippo.add(h);
    picked.push({ id: r.id, label: `${r.raceDay.date.toISOString().slice(0, 10)} ${h}` });
    if (picked.length >= 5) break;
  }
  console.log("Parite testi icin secilen", picked.length, "gercek yaris:", picked.map((p) => p.label));

  let totalDiffs = 0;
  const trainingSetOld: OLD.TrainingRace[] = [];
  const trainingSetNew: NEW.TrainingRace[] = [];

  for (const p of picked) {
    const vectors = await buildFeatureVectorsForRace(p.id); // TEK CAGRI - hem OLD hem NEW AYNI vektorleri kullanir
    const result = await db.result.findUnique({ where: { raceId: p.id }, select: { actualOrder: true, winnerNos: true } });
    const winnerNo = result?.winnerNos?.[0] ?? (Array.isArray(result?.actualOrder) ? Number(result!.actualOrder[0]) : null);
    trainingSetOld.push({ raceId: p.id, date: new Date(), vectors, winnerNo: winnerNo ?? null });
    trainingSetNew.push({ raceId: p.id, date: new Date(), vectors, winnerNo: winnerNo ?? null });

    // --- Faz 1: computeFeatureStats tek yaris icin (ayni vektorler) ---
    const statsOld = OLD.computeFeatureStats(vectors);
    const statsNew = NEW.computeFeatureStats(vectors);
    const statsDiff = deepAlmostEqual(Object.fromEntries(statsOld), Object.fromEntries(statsNew), `${p.label}.stats`);
    totalDiffs += statsDiff.length;
    if (statsDiff.length) console.log("STATS FARK:", statsDiff);

    // --- Faz 2: toModelVector (ilk runner icin) ---
    if (vectors.length > 0) {
      const tvOld = OLD.toModelVector(vectors[0], statsOld);
      const tvNew = NEW.toModelVector(vectors[0], statsNew);
      const tvDiff = deepAlmostEqual(tvOld, tvNew, `${p.label}.toModelVector`);
      totalDiffs += tvDiff.length;
      if (tvDiff.length) console.log("TOMODELVECTOR FARK:", tvDiff);
    }
  }

  // --- Faz 3: fitModel COK-YARISLIK (AYNI egitim kumesi, AYNI opts, deterministik) ---
  const statsAllOld = OLD.computeFeatureStats(trainingSetOld.flatMap((t) => t.vectors));
  const statsAllNew = NEW.computeFeatureStats(trainingSetNew.flatMap((t) => t.vectors));
  const modelOld = OLD.fitModel(trainingSetOld, statsAllOld, FIT_OPTS);
  const modelNew = NEW.fitModel(trainingSetNew, statsAllNew, FIT_OPTS);
  const betaDiff = deepAlmostEqual(modelOld.beta, modelNew.beta, "fitModel.beta");
  totalDiffs += betaDiff.length;
  if (betaDiff.length) console.log("BETA FARK:", betaDiff);
  console.log("nRacesUsed OLD/NEW:", modelOld.nRacesUsed, modelNew.nRacesUsed, "| nRacesSkipped:", modelOld.nRacesSkipped, modelNew.nRacesSkipped);

  // --- Faz 4: scoreRace + explainRunner (ilk yarisin vektorleriyle) ---
  const firstVectors = trainingSetOld[0].vectors;
  const scoredOld = OLD.scoreRace(firstVectors, modelOld);
  const scoredNew = NEW.scoreRace(firstVectors, modelNew);
  const scoreDiff = deepAlmostEqual(scoredOld, scoredNew, "scoreRace");
  totalDiffs += scoreDiff.length;
  if (scoreDiff.length) console.log("SCORE FARK:", scoreDiff);

  if (firstVectors.length > 0) {
    const explOld = OLD.explainRunner(firstVectors[0], modelOld);
    const explNew = NEW.explainRunner(firstVectors[0], modelNew);
    const explDiff = deepAlmostEqual(explOld, explNew, "explainRunner");
    totalDiffs += explDiff.length;
    if (explDiff.length) console.log("EXPLAIN FARK:", explDiff);
  }

  console.log(`\n=== PARITE SONUCU: ${totalDiffs === 0 ? "SIFIR FARK (tam parite dogrulandi)" : totalDiffs + " FARK BULUNDU"} ===`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
