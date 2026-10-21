// READ-ONLY. ab-split-locked.json'daki 150 yarisin (120 train + 30 holdout) TAM ozellik
// vektorlerini (saf 20 sinyal + 4 iliskisel sinyal) BIR KEZ hesaplayip diske yazar -
// "ayni pahali DB sorgularini tekrarlama" kurali. Yeniden baslatilabilir: zaten
// onbellekte olan raceId'ler ATLANIR.
import { db } from "./src/lib/db";
import fs from "node:fs";
import { buildFeatureVectorsForRace } from "./src/lib/motor-v1/engine/feature-vector";
import type { TempoContext } from "./src/lib/motor-v1/features/tempo";
import { computeGenPedigriForRace } from "./src/lib/motor-v1/features/gen-pedigri";
import { computeIdman01, groupKey, splitsToT200Points } from "./src/lib/motor-v1/features/idman-galop";
import { computeJokeyTrend30 } from "./src/lib/motor-v1/features/int-jokey-trend";
import { computeFormGalopDinlenmeInteraction } from "./src/lib/motor-v1/features/int-form-galop-dinlenme";
import { computeJokeyFormTempoInteraction } from "./src/lib/motor-v1/features/int-jokey-form-tempo";
import { computeKulvar01, computeTempoStilKulvarInteraction } from "./src/lib/motor-v1/features/int-tempo-stil-kulvar";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";
import type { AccuraceRun } from "./src/lib/accurace/types";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";
const CACHE_PATH = "src/lib/motor-v1/artifacts/ab-feature-cache.json";
const ACCURACE_SNAPSHOT_PATH = "src/lib/motor-v1/artifacts/accurace-archive-snapshot.json";
const GALLOP_SNAPSHOT_PATH = "src/lib/motor-v1/artifacts/gallop-archive-snapshot.json";

// 2026-10-19 kullanici karari: DB'ye TEKRAR ağır tam-arşiv sorgusu atmak YERİNE,
// diag-motor-v1-build-reference-caches.mts'in diske yazdığı anlık görüntüden yüklenir.
// tempo.ts/idman-galop.ts'in KENDİSİ DEĞİŞTİRİLMEDİ - yalnız bu araştırma script'i artık
// onların DB-sorgulayan girdisini diskten besliyor (aynı hesaplama mantığı, aynı sonuç).
function loadTempoContextFromDisk(): TempoContext {
  const snap = JSON.parse(fs.readFileSync(ACCURACE_SNAPSHOT_PATH, "utf8")) as { builtAt: string; runs: (Omit<AccuraceRun, "date"> & { date: string })[] };
  const byTjk = new Map<number, AccuraceRun[]>();
  for (const r of snap.runs) {
    const run: AccuraceRun = { ...r, date: new Date(r.date) };
    const arr = byTjk.get(run.tjk);
    if (arr) arr.push(run); else byTjk.set(run.tjk, [run]);
  }
  console.log(`  [disk] TempoContext: ${snap.runs.length} kayit (onbellek tarihi: ${snap.builtAt})`);
  return { byTjk };
}

type GalopPaceIndex = Map<string, { tarih: Date; t200: number }[]>;
function loadGalopPaceIndexFromDisk(): GalopPaceIndex {
  const snap = JSON.parse(fs.readFileSync(GALLOP_SNAPSHOT_PATH, "utf8")) as { builtAt: string; rows: { date: string; splits: unknown }[] };
  const index: GalopPaceIndex = new Map();
  for (const r of snap.rows) {
    const splits = r.splits as Record<string, string | null> | null;
    if (!splits) continue;
    const key = groupKey(splits.pist ?? null, splits.ic_dis ?? null);
    const points = splitsToT200Points(splits);
    if (points.length === 0) continue;
    const t200 = points.reduce((a, b) => a + b, 0) / points.length;
    const arr = index.get(key) ?? [];
    arr.push({ tarih: new Date(r.date), t200 });
    index.set(key, arr);
  }
  console.log(`  [disk] GalopPaceIndex: ${snap.rows.length} satir (onbellek tarihi: ${snap.builtAt})`);
  return index;
}

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 4): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      console.log(`  [retry ${i + 1}/${tries}] ${label}: ${(e as Error).message}`);
      await sleep(3000 * (i + 1));
    }
  }
  throw lastErr;
}

export type CachedRace = {
  raceId: string;
  date: string;
  winnerNo: number | null;
  runners: { no: number; name: string; vectors: SignalEntry[] }[]; // saf 20 + 4 iliskisel, TEK listede, code ile ayirt edilir
};

async function processRace(raceId: string, tempoCtx: TempoContext, galopPaceIndex: GalopPaceIndex): Promise<CachedRace | null> {
  const race = await withRetry(() => db.race.findUnique({
    where: { id: raceId },
    select: {
      breed: true, surface: true, distance: true,
      raceDay: { select: { date: true } },
      result: { select: { actualOrder: true, winnerNos: true } },
      runners: { where: { scratched: false }, select: { no: true, name: true, sire: true, dam: true, damSire: true, tjkAtId: true, jockey: true, startNo: true, gallops: { select: { date: true, splits: true } } } },
    },
  }), `race.findUnique(${raceId})`);
  if (!race || race.runners.length === 0) return null;
  const cutoff = race.raceDay.date;
  const winnerNo = race.result?.winnerNos?.[0] ?? (Array.isArray(race.result?.actualOrder) ? Number(race.result!.actualOrder[0]) : null);

  const vectors = await withRetry(() => buildFeatureVectorsForRace(raceId, tempoCtx), `buildFeatureVectorsForRace(${raceId})`);
  const vByNo = new Map(vectors.map((v) => [v.no, v]));

  const pmzHam = new Map(race.runners.map((r) => {
    const v = vByNo.get(r.no);
    const pmz = v?.signals.find((s) => s.code === "PMZ_01");
    return [r.no, pmz?.observed ? pmz.rawValue : null] as const;
  }));
  const genResults = await withRetry(() => computeGenPedigriForRace(race.runners.map((r) => ({ no: r.no, sire: r.sire, dam: r.dam, damSire: r.damSire })), race.breed, race.surface, race.distance, cutoff, pmzHam), `gen(${raceId})`);
  const genByNo = new Map(genResults.map((g) => [g.no, g.signals]));

  const out: CachedRace["runners"] = [];
  for (const r of race.runners) {
    const v = vByNo.get(r.no);
    const sig = (code: string) => v?.signals.find((s) => s.code === code);
    const form01 = sig("FORM_01"), form02 = sig("FORM_02"), form03 = sig("FORM_03"), tempo01 = sig("TEMPO_01");

    const gen = genByNo.get(r.no) ?? [];
    const genInt = gen.find((g) => g.code === "GEN_SIRE_PMZ_01")!;

    const trend = await withRetry(() => computeJokeyTrend30(r.jockey, cutoff), `jokeyTrend(${r.jockey})`);
    const jft = computeJokeyFormTempoInteraction(trend.value, trend.observed, form02?.rawValue ?? null, !!form02?.observed, tempo01?.rawValue ?? null, !!tempo01?.observed);

    const idman = computeIdman01(r.gallops, cutoff, galopPaceIndex);
    const fgd = computeFormGalopDinlenmeInteraction(form01?.rawValue ?? null, !!form01?.observed, idman.value, idman.observed, form03?.rawValue ?? null);

    const kulvar = computeKulvar01(r.startNo, race.runners.length);
    const tsk = computeTempoStilKulvarInteraction(kulvar, tempo01?.rawValue ?? null, !!tempo01?.observed);

    const allSignals: SignalEntry[] = [...(v?.signals ?? []), genInt, jft, fgd, tsk];
    out.push({ no: r.no, name: r.name, vectors: allSignals });
  }

  return { raceId, date: cutoff.toISOString(), winnerNo, runners: out };
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  // 2026-10-19: HOLDOUT ONCE islenir - ilk denemede baglanti ~3.5 saat sonra bozulup train
  // bitmisken holdout'un buyuk kismi eksik kaldi (8/30). Holdout degerlendirmenin KALBI,
  // once o doldurulur.
  const allIds = [...lock.holdoutRaceIds.map((id) => ({ id, split: "holdout" as const })), ...lock.trainRaceIds.map((id) => ({ id, split: "train" as const }))];

  let cache: Record<string, CachedRace> = {};
  if (fs.existsSync(CACHE_PATH)) {
    cache = JSON.parse(fs.readFileSync(CACHE_PATH, "utf8"));
    console.log(`Onbellekte zaten var: ${Object.keys(cache).length} yaris`);
  }

  const tempoCtx = loadTempoContextFromDisk();
  const galopPaceIndex = loadGalopPaceIndexFromDisk();

  let processed = 0;
  for (const { id } of allIds) {
    if (cache[id]) continue;
    try {
      const result = await processRace(id, tempoCtx, galopPaceIndex);
      if (result) cache[id] = result;
      processed++;
      fs.writeFileSync(CACHE_PATH, JSON.stringify(cache, null, 0));
      console.log(`islenen: ${processed} yeni (toplam onbellek: ${Object.keys(cache).length}/${allIds.length})`);
    } catch (e) {
      console.log(`[ATLANDI] ${id}: ${(e as Error).message}`);
    }
  }
  console.log(`\nTAMAMLANDI. Onbellekte: ${Object.keys(cache).length}/${allIds.length} yaris.`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
