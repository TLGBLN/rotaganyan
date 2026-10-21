// READ-ONLY. MODEL A (saf 20) vs MODEL B (20+4 iliskisel) karsilastirmasi.
// ab-feature-cache.json'daki 150 (120 train + 30 holdout) yaristan, HICBIR yeni DB sorgusu
// olmadan (yalniz AGF alt-grup etiketleme icin holdout'ta hafif bir AgfSnapshot sorgusu var)
// model egitimi + skorlama + metrik hesabi yapar. FIT_OPTS, training.ts'in KENDI
// DEFAULT_FIT_OPTIONS'u - sonuca bakilarak SECILMEDI.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { computeFeatureStats, fitModel, scoreRace, DEFAULT_FIT_OPTIONS, SIGNAL_CODES, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { hesaplaAgfSirasi } from "./src/lib/methodology/agf-sirasi";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const CACHE_PATH = "src/lib/motor-v1/artifacts/ab-feature-cache.json";
const OUT_PATH = "src/lib/motor-v1/artifacts/ab-compare-result.json";

const RELATIONAL_CODES = ["GEN_SIRE_PMZ_01", "INT_JOKEY_FORM_TEMPO_01", "INT_FORM_GALOP_DINLENME_01", "INT_TEMPO_STIL_KULVAR_01"] as const;
const B_CODES = [...SIGNAL_CODES, ...RELATIONAL_CODES] as const;

type CacheRaceShape = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

function toTrainingRaces(ids: string[], cache: Record<string, CacheRaceShape>): TrainingRace[] {
  const out: TrainingRace[] = [];
  for (const id of ids) {
    const r = cache[id];
    if (!r) continue;
    const vectors: RunnerFeatureVector[] = r.runners.map((rr) => ({ raceId: id, no: rr.no, name: rr.name, tjkAtId: null, jockey: null, signals: rr.vectors }));
    out.push({ raceId: id, date: new Date(r.date), vectors, winnerNo: r.winnerNo });
  }
  return out;
}

function top1Hit(scored: { no: number; probability: number }[], winnerNo: number | null): boolean {
  if (winnerNo == null || scored.length === 0) return false;
  const best = [...scored].sort((a, b) => b.probability - a.probability)[0];
  return best.no === winnerNo;
}
function top3Hit(scored: { no: number; probability: number }[], winnerNo: number | null): boolean {
  if (winnerNo == null) return false;
  const top3 = [...scored].sort((a, b) => b.probability - a.probability).slice(0, 3);
  return top3.some((s) => s.no === winnerNo);
}
function winnerProb(scored: { no: number; probability: number }[], winnerNo: number | null): number | null {
  if (winnerNo == null) return null;
  return scored.find((s) => s.no === winnerNo)?.probability ?? null;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8")) as Record<string, CacheRaceShape>;

  const trainSet = toTrainingRaces(lock.trainRaceIds, cache);
  const holdoutSet = toTrainingRaces(lock.holdoutRaceIds, cache);
  console.log(`Train: ${trainSet.length}/${lock.trainRaceIds.length} kullanilabilir. Holdout: ${holdoutSet.length}/${lock.holdoutRaceIds.length} kullanilabilir.`);

  const trainVectorsFlat = trainSet.flatMap((t) => t.vectors);

  // --- MODEL A: saf 20 (SIGNAL_CODES varsayilan) ---
  const statsA = computeFeatureStats(trainVectorsFlat); // codes verilmez -> SIGNAL_CODES
  const modelA = fitModel(trainSet, statsA, DEFAULT_FIT_OPTIONS);

  // --- MODEL B: 20+4 ---
  const statsB = computeFeatureStats(trainVectorsFlat, B_CODES);
  const modelB = fitModel(trainSet, statsB, DEFAULT_FIT_OPTIONS);

  // --- ABLASYON: A + yalniz 1 iliski (4 ayri model) ---
  const ablationModels: Record<string, ReturnType<typeof fitModel>> = {};
  for (const code of RELATIONAL_CODES) {
    const codes = [...SIGNAL_CODES, code] as const;
    const stats = computeFeatureStats(trainVectorsFlat, codes);
    ablationModels[code] = fitModel(trainSet, stats, DEFAULT_FIT_OPTIONS);
  }

  console.log(`MODEL A: nRacesUsed=${modelA.nRacesUsed}, nRacesSkipped=${modelA.nRacesSkipped}`);
  console.log(`MODEL B: nRacesUsed=${modelB.nRacesUsed}, nRacesSkipped=${modelB.nRacesSkipped}`);

  // --- Holdout skorlama ---
  type RaceEval = { raceId: string; winnerNo: number | null; aTop1: boolean; aTop3: boolean; bTop1: boolean; bTop3: boolean; aWinP: number | null; bWinP: number | null; agfTop3: boolean | null };
  const evals: RaceEval[] = [];
  for (const t of holdoutSet) {
    const scoredA = scoreRace(t.vectors, modelA);
    const scoredB = scoreRace(t.vectors, modelB);
    evals.push({
      raceId: t.raceId, winnerNo: t.winnerNo,
      aTop1: top1Hit(scoredA, t.winnerNo), aTop3: top3Hit(scoredA, t.winnerNo),
      bTop1: top1Hit(scoredB, t.winnerNo), bTop3: top3Hit(scoredB, t.winnerNo),
      aWinP: winnerProb(scoredA, t.winnerNo), bWinP: winnerProb(scoredB, t.winnerNo),
      agfTop3: null,
    });
  }

  // --- AGF alt-grup etiketleme (MODEL GIRDISI DEGIL, yalniz raporlama icin) ---
  for (const ev of evals) {
    const raceMeta = await db.race.findUnique({ where: { id: ev.raceId }, select: { time: true, raceDay: { select: { date: true } }, runners: { where: { scratched: false }, select: { id: true, no: true, ekuriGroup: true } } } });
    if (!raceMeta) continue;
    const m = raceMeta.time?.trim().match(/^(\d{1,2})[:.](\d{2})/);
    const cutoff = m ? new Date(`${raceMeta.raceDay.date.toISOString().slice(0, 10)}T${m[1].padStart(2, "0")}:${m[2]}:00+03:00`) : raceMeta.raceDay.date;
    const snaps = await db.agfSnapshot.findMany({ where: { runnerId: { in: raceMeta.runners.map((r) => r.id) }, capturedAt: { lt: cutoff } }, select: { runnerId: true, agf: true, capturedAt: true } });
    const lastByRunner = new Map<string, number>();
    for (const s of snaps) { const cur = lastByRunner.get(s.runnerId); if (cur == null) lastByRunner.set(s.runnerId, s.agf); }
    // en son snapshot'i al (capturedAt desc degil, elimizde hepsi var - basit max)
    const byRunnerAll = new Map<string, { agf: number; capturedAt: Date }[]>();
    for (const s of snaps) { const a = byRunnerAll.get(s.runnerId) ?? []; a.push(s); byRunnerAll.set(s.runnerId, a); }
    const pit = raceMeta.runners.map((r) => {
      const arr = (byRunnerAll.get(r.id) ?? []).sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime());
      return { id: r.id, no: r.no, agf: arr.length ? arr[arr.length - 1].agf : null, ekuriGroup: r.ekuriGroup };
    });
    const siraMap = hesaplaAgfSirasi(pit);
    const winnerRunner = raceMeta.runners.find((r) => r.no === ev.winnerNo);
    if (winnerRunner) {
      const sira = siraMap.get(winnerRunner.id);
      ev.agfTop3 = sira != null ? sira <= 3 : null;
    }
  }

  const n = evals.length;
  const sum = (f: (e: RaceEval) => boolean) => evals.filter(f).length;
  const logLoss = (key: "aWinP" | "bWinP") => {
    const probs = evals.map((e) => e[key]).filter((p): p is number => p != null && p > 0);
    if (probs.length === 0) return null;
    return -probs.reduce((s, p) => s + Math.log(p), 0) / probs.length;
  };

  const agfMissed = evals.filter((e) => e.agfTop3 === false);
  const summary = {
    fitOpts: DEFAULT_FIT_OPTIONS,
    trainN: trainSet.length, holdoutN: n,
    modelA: { nRacesUsed: modelA.nRacesUsed, top1: sum((e) => e.aTop1) / n, top3: sum((e) => e.aTop3) / n, logLoss: logLoss("aWinP") },
    modelB: { nRacesUsed: modelB.nRacesUsed, top1: sum((e) => e.bTop1) / n, top3: sum((e) => e.bTop3) / n, logLoss: logLoss("bWinP") },
    agfMissedCount: agfMissed.length,
    agfMissed_aTop3: agfMissed.length ? agfMissed.filter((e) => e.aTop3).length : null,
    agfMissed_bTop3: agfMissed.length ? agfMissed.filter((e) => e.bTop3).length : null,
    aFoundBMissed: evals.filter((e) => e.aTop1 && !e.bTop1).map((e) => e.raceId),
    bFoundAMissed: evals.filter((e) => !e.aTop1 && e.bTop1).map((e) => e.raceId),
    aTop3FoundBMissed: evals.filter((e) => e.aTop3 && !e.bTop3).map((e) => e.raceId),
    bTop3FoundAMissed: evals.filter((e) => !e.aTop3 && e.bTop3).map((e) => e.raceId),
    ablation: Object.fromEntries(RELATIONAL_CODES.map((code) => {
      const m = ablationModels[code];
      const codeIdx = m.names.indexOf(`${code}_z` as never);
      return [code, { beta_z: m.beta[codeIdx], nRacesUsed: m.nRacesUsed }];
    })),
    modelB_betas: Object.fromEntries(RELATIONAL_CODES.map((code) => {
      const codeIdx = modelB.names.indexOf(`${code}_z` as never);
      return [code, modelB.beta[codeIdx]];
    })),
    evals,
  };

  fs.writeFileSync(OUT_PATH, JSON.stringify(summary, null, 2));
  console.log("\n=== SONUC ===");
  console.log(JSON.stringify({ ...summary, evals: `[${evals.length} kayit, dosyada]` }, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
