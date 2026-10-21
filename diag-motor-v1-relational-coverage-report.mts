// READ-ONLY, ORNEKLEM-TABANLI kapsam raporu (kullanici talimati: "gereksiz tekrarli agir DB
// taramalari baslatma"). 452-yarislik TAM kohortu buildFeatureVectorsForRace ile YENIDEN
// hesaplamak (saf motorun TUM 20 sinyalini her yaris icin cikarmak) pahali/agir olurdu — bu
// yuzden Temmuz-Agustos 2026'dan, aylara ve hipodromlara DENGELI dagilan bir ORNEKLEM (60
// yaris) uzerinde calisilir. Sonuc bir TAHMIN'dir, tam sayim DEGIL — raporda acikca boyle
// belirtilir. PIST_DURUM gerektiren 2 iliski (zaten gecmiste hic gozlemli olamayacagi
// kanitlandigi icin) bu taramaya DAHIL EDILMEDI - o ikisi icin kapsam deterministik olarak
// sifirdir (bkz. onceki rapor).
import { db } from "./src/lib/db";
import fs from "node:fs";
import { buildFeatureVectorsForRace } from "./src/lib/motor-v1/engine/feature-vector";
import { loadTempoContext } from "./src/lib/motor-v1/features/tempo";
import { computeGenPedigriForRace } from "./src/lib/motor-v1/features/gen-pedigri";
import { loadGalopPaceIndex, computeIdman01 } from "./src/lib/motor-v1/features/idman-galop";
import { computeJokeyTrend30 } from "./src/lib/motor-v1/features/int-jokey-trend";
import { computeFormGalopDinlenmeInteraction } from "./src/lib/motor-v1/features/int-form-galop-dinlenme";
import { computeJokeyFormTempoInteraction } from "./src/lib/motor-v1/features/int-jokey-form-tempo";
import { computeKulvar01, computeTempoStilKulvarInteraction } from "./src/lib/motor-v1/features/int-tempo-stil-kulvar";

const KOHORT_PATH = "C:/Users/tlgbi/AppData/Local/Temp/claude/c--Users-tlgbi-OneDrive-Belgeler-Rota/76598f4f-31f1-4414-a3f6-fbab0aab98d4/scratchpad/asama1-kohort-sonuc.json";
const CACHE_PATH = "src/lib/motor-v1/artifacts/relational-coverage-cache.json";
const ORNEKLEM_BOYUTU = 24; // 2026-10-19: 60'tan kucultuldu - Supabase baglanti havuzu ~17dk/10-yaris'ta koptu

function sleep(ms: number) { return new Promise((r) => setTimeout(r, ms)); }
async function withRetry<T>(fn: () => Promise<T>, label: string, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try { return await fn(); } catch (e) {
      lastErr = e;
      console.log(`  [retry ${i + 1}/${tries}] ${label}: ${(e as Error).message}`);
      await sleep(2000 * (i + 1));
    }
  }
  throw lastErr;
}

type Counters = { nRunners: number; genSireObs: number; genDamObs: number; genDamSireObs: number; genInteractionObs: number; jokeyFormTempoObs: number; formGalopDinlenmeObs: number; idmanObs: number; jokeyTrendObs: number; kulvarObs: number; tempoStilKulvarObs: number };

function emptyCounters(): Counters {
  return { nRunners: 0, genSireObs: 0, genDamObs: 0, genDamSireObs: 0, genInteractionObs: 0, jokeyFormTempoObs: 0, formGalopDinlenmeObs: 0, idmanObs: 0, jokeyTrendObs: 0, kulvarObs: 0, tempoStilKulvarObs: 0 };
}

async function main() {
  const kohort = JSON.parse(fs.readFileSync(KOHORT_PATH, "utf8")) as { finalRaceIds: string[] };
  const allIds: string[] = kohort.finalRaceIds;

  // Aylara/hipodromlara dengeli dagilan bir ornek secimi icin once hafif metadata cek.
  const meta = await db.race.findMany({
    where: { id: { in: allIds } },
    select: { id: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } } },
  });
  const byMonthHippo = new Map<string, string[]>();
  for (const r of meta) {
    const key = `${r.raceDay.date.toISOString().slice(0, 7)}|${r.raceDay.hippodrome.name}`;
    const arr = byMonthHippo.get(key) ?? [];
    arr.push(r.id);
    byMonthHippo.set(key, arr);
  }
  const groups = [...byMonthHippo.values()];
  const sample: string[] = [];
  let gi = 0;
  while (sample.length < ORNEKLEM_BOYUTU && groups.some((g) => g.length > 0)) {
    const g = groups[gi % groups.length];
    if (g.length > 0) sample.push(g.shift()!);
    gi++;
  }
  console.log(`Ornek: ${sample.length} yaris (${groups.length} ay/hipodrom grubundan dengeli secildi), toplam kohort: ${allIds.length}`);

  const tempoCtx = await loadTempoContext();
  const galopPaceIndex = await loadGalopPaceIndex();
  const counters = emptyCounters();
  let nRacesProcessed = 0;

  for (const raceId of sample) {
   try {
    const race = await withRetry(() => db.race.findUnique({
      where: { id: raceId },
      select: {
        breed: true, surface: true, distance: true,
        raceDay: { select: { date: true } },
        runners: { where: { scratched: false }, select: { no: true, name: true, sire: true, dam: true, damSire: true, tjkAtId: true, jockey: true, startNo: true, gallops: { select: { date: true, splits: true } } } },
      },
    }), `race.findUnique(${raceId})`);
    if (!race || race.runners.length === 0) continue;
    nRacesProcessed++;
    const cutoff = race.raceDay.date;

    const vectors = await withRetry(() => buildFeatureVectorsForRace(raceId, tempoCtx), `buildFeatureVectorsForRace(${raceId})`);
    const vByNo = new Map(vectors.map((v) => [v.no, v]));

    const pmzHam = new Map(race.runners.map((r) => {
      const v = vByNo.get(r.no);
      const pmz = v?.signals.find((s) => s.code === "PMZ_01");
      return [r.no, pmz?.observed ? pmz.rawValue : null] as const;
    }));
    const genResults = await computeGenPedigriForRace(race.runners.map((r) => ({ no: r.no, sire: r.sire, dam: r.dam, damSire: r.damSire })), race.breed, race.surface, race.distance, cutoff, pmzHam);
    const genByNo = new Map(genResults.map((g) => [g.no, g.signals]));

    for (const r of race.runners) {
      counters.nRunners++;
      const v = vByNo.get(r.no);
      const sig = (code: string) => v?.signals.find((s) => s.code === code);
      const form01 = sig("FORM_01"), form02 = sig("FORM_02"), form03 = sig("FORM_03"), tempo01 = sig("TEMPO_01");

      const gen = genByNo.get(r.no) ?? [];
      const genSire = gen.find((g) => g.code === "GEN_SIRE_01");
      const genDam = gen.find((g) => g.code === "GEN_DAM_01");
      const genDamSire = gen.find((g) => g.code === "GEN_DAMSIRE_01");
      const genInt = gen.find((g) => g.code === "GEN_SIRE_PMZ_01");
      if (genSire?.observed) counters.genSireObs++;
      if (genDam?.observed) counters.genDamObs++;
      if (genDamSire?.observed) counters.genDamSireObs++;
      if (genInt?.observed) counters.genInteractionObs++;

      const trend = await withRetry(() => computeJokeyTrend30(r.jockey, cutoff), `jokeyTrend(${r.jockey})`);
      if (trend.observed) counters.jokeyTrendObs++;
      // NOT: feature-vector.ts TEMPO_01.rawValue olarak yalniz leadTendency (vec[0]) tasir,
      // frontGroupTendency (vec[0]+vec[1]) degil — bu ornekte leadTendency kullanilir.
      const jft = computeJokeyFormTempoInteraction(trend.value, trend.observed, form02?.rawValue ?? null, !!form02?.observed, tempo01?.rawValue ?? null, !!tempo01?.observed);
      if (jft.observed) counters.jokeyFormTempoObs++;

      const idman = computeIdman01(r.gallops, cutoff, galopPaceIndex);
      if (idman.observed) counters.idmanObs++;
      const fgd = computeFormGalopDinlenmeInteraction(form01?.rawValue ?? null, !!form01?.observed, idman.value, idman.observed, form03?.rawValue ?? null);
      if (fgd.observed) counters.formGalopDinlenmeObs++;

      const kulvar = computeKulvar01(r.startNo, race.runners.length);
      if (kulvar.observed) counters.kulvarObs++;
      const tsk = computeTempoStilKulvarInteraction(kulvar, tempo01?.rawValue ?? null, !!tempo01?.observed);
      if (tsk.observed) counters.tempoStilKulvarObs++;
    }
    fs.writeFileSync(CACHE_PATH, JSON.stringify({ sampleSize: sample.length, kohortSize: allIds.length, nRacesProcessed, counters }, null, 2));
    console.log(`  islenen: ${nRacesProcessed}/${sample.length} (ara-kayit yazildi)`);
   } catch (e) {
     console.log(`  [ATLANDI] ${raceId}: ${(e as Error).message}`);
   }
  }

  console.log(`\n=== ILISKISEL SINYAL KAPSAM RAPORU (ORNEKLEM n=${nRacesProcessed} yaris / ${counters.nRunners} at, TAM 452 DEGIL) ===`);
  const pct = (x: number) => `%${(100 * x / counters.nRunners).toFixed(1)}`;
  console.log(`GEN_SIRE_01 gozlemli:          ${counters.genSireObs}/${counters.nRunners} (${pct(counters.genSireObs)})`);
  console.log(`GEN_DAM_01 gozlemli:           ${counters.genDamObs}/${counters.nRunners} (${pct(counters.genDamObs)})`);
  console.log(`GEN_DAMSIRE_01 gozlemli:       ${counters.genDamSireObs}/${counters.nRunners} (${pct(counters.genDamSireObs)})`);
  console.log(`GEN_SIRE_PMZ_01 (ILISKI 4):    ${counters.genInteractionObs}/${counters.nRunners} (${pct(counters.genInteractionObs)})`);
  console.log(`JOKEY_TREND30 gozlemli:        ${counters.jokeyTrendObs}/${counters.nRunners} (${pct(counters.jokeyTrendObs)})`);
  console.log(`INT_JOKEY_FORM_TEMPO (ILISKI 3, TEMPO_01 harici): ${counters.jokeyFormTempoObs}/${counters.nRunners} (${pct(counters.jokeyFormTempoObs)})`);
  console.log(`IDMAN_01 gozlemli:             ${counters.idmanObs}/${counters.nRunners} (${pct(counters.idmanObs)})`);
  console.log(`INT_FORM_GALOP_DINLENME (ILISKI 2): ${counters.formGalopDinlenmeObs}/${counters.nRunners} (${pct(counters.formGalopDinlenmeObs)})`);
  console.log(`KULVAR_01_HAM gozlemli:        ${counters.kulvarObs}/${counters.nRunners} (${pct(counters.kulvarObs)})`);
  console.log(`INT_TEMPO_STIL_KULVAR (ILISKI 5): ${counters.tempoStilKulvarObs}/${counters.nRunners} (${pct(counters.tempoStilKulvarObs)})`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
