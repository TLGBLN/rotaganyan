// ROTAGANYAN V1.0 — YET IYILESTIRMESI: gunluk pist varyanti deneyi. HIZ_01'in mevcut
// hesaplamasina (hiz-derecesi-hesapla.ts, DEGISTIRILMEDI) PARALEL, izole bir "varyantli"
// HIZ_01 hesaplanir ve TRAIN-ici kronolojik CV ile mevcut HIZ_01 ile KARSILASTIRILIR.
// Veri yetersizse (CV kotu cikarsa) sonuc UYDURULMAZ, mevcut HIZ_01 korunur.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { fitConditionalLogit, dot, type TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { tumOnbellegiGetir } from "./src/server/actions/hiz-derecesi.actions";
import { hizSureyiSaniyeyeCevir, hizSurfaceFromRaw, hizPopulasyonOrtPace, HIZ_GUNCEL_FORM_PENCERESI_GUN } from "./src/lib/methodology/hiz-derecesi-hesapla";
import { surfaceToPist, mesafeBucket, breedToIrk } from "./src/lib/sire-stat-match";
import { parseTjkDate } from "./src/lib/motor-v1/features/history-source";
import { gunlukVaryantIndexKur, gunlukVaryantAra } from "./src/lib/motor-v1/features/gunluk-pist-varyanti";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }
const DAV_CODES = ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"];
const GEN_CODES = ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"];
const TMP_DROP = ["TEMPO_01", "TEMPO_03"];

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const fixedCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-recovered-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const currentModel = loadTrainedV1Model();
  const allCodes = [...currentModel.stats.keys()].filter((c) => !TMP_DROP.includes(c));

  console.log("Gunluk varyant indeksi kuruluyor (tum HorseRaceHistoryCache'ten, BIR KEZ)...");
  const { gecmis, irk, paceIndex } = await tumOnbellegiGetir();
  const varyantIndex = gunlukVaryantIndexKur(gecmis as any, irk, paceIndex);
  console.log(`Varyant indeksi: ${varyantIndex.size} (sehir|gun|kova) anahtari (min ${5} orneklemli).`);
  const varyantDegerleri = [...varyantIndex.values()];
  const ortVaryant = varyantDegerleri.reduce((a,b)=>a+b,0)/varyantDegerleri.length;
  const stdVaryant = Math.sqrt(varyantDegerleri.reduce((a,b)=>a+(b-ortVaryant)**2,0)/varyantDegerleri.length);
  console.log(`Varyant dagilimi: ortalama=${ortVaryant.toFixed(3)} std=${stdVaryant.toFixed(3)} min=${Math.min(...varyantDegerleri).toFixed(2)} max=${Math.max(...varyantDegerleri).toFixed(2)}`);

  // Her TRAIN+HOLDOUT kosucusu icin: VARYANTLI HIZ_01'i yeniden hesapla (hizDerecesiHesaplaOrtak
  // ile AYNI mantik, yalniz her satirin residual'indan o gunun varyanti CIKARILIR).
  async function varyantliHiz01(raceId: string): Promise<Map<number, number | null>> {
    const race = await db.race.findUnique({
      where: { id: raceId },
      select: { breed: true, raceDay: { select: { date: true, hippodrome: { select: { name: true } } } }, runners: { where: { scratched: false }, select: { no: true, tjkAtId: true } } },
    });
    const out = new Map<number, number | null>();
    if (!race) return out;
    const irkBugun = breedToIrk(race.breed);
    const cutoff = race.raceDay.date;
    const pencereBaslangic = new Date(cutoff.getTime() - HIZ_GUNCEL_FORM_PENCERESI_GUN * 86_400_000);
    for (const r of race.runners) {
      if (r.tjkAtId == null) { out.set(r.no, null); continue; }
      const rows = (gecmis.get(r.tjkAtId) ?? []) as any[];
      const uygun = rows
        .map((g) => ({ ...g, tarih: parseTjkDate(g.date), saniye: hizSureyiSaniyeyeCevir(g.time) }))
        .filter((g) => g.tarih != null && g.tarih.getTime() < cutoff.getTime() && g.tarih.getTime() >= pencereBaslangic.getTime() && g.saniye != null && g.saniye > 0 && !!g.distance)
        .sort((a, b) => b.tarih.getTime() - a.tarih.getTime())
        .slice(0, 3);
      let toplamFark = 0, sayi = 0;
      for (const g of uygun) {
        const pist = hizSurfaceFromRaw(g.surface);
        if (!pist) continue;
        const kovaKey = `${irkBugun}|${surfaceToPist(pist)}|${mesafeBucket(g.distance)}`;
        const popOrt = hizPopulasyonOrtPace(paceIndex, kovaKey, g.tarih);
        if (popOrt == null) continue;
        const kendiPace = g.distance / g.saniye;
        const hamResidual = (100 * (kendiPace - popOrt)) / popOrt;
        const gunVaryanti = gunlukVaryantAra(varyantIndex, g.city, g.tarih, irkBugun, surfaceToPist(pist), mesafeBucket(g.distance)) ?? 0;
        toplamFark += (hamResidual - gunVaryanti); // GUN VARYANTI CIKARILDI
        sayi++;
      }
      out.set(r.no, sayi > 0 ? toplamFark / sayi : null);
    }
    return out;
  }

  console.log("\nTRAIN+HOLDOUT icin varyantli HIZ_01 hesaplaniyor (150 yaris, canli DB)...");
  const varyantliHiz01ByRace: Record<string, Map<number, number | null>> = {};
  for (const id of [...lock.trainRaceIds, ...lock.holdoutRaceIds]) {
    varyantliHiz01ByRace[id] = await varyantliHiz01(id);
  }
  console.log("Tamamlandi.");

  function merged(id: string, useVaryant: boolean): CacheRace | null {
    const o = oldCache[id], f = fixedCache[id];
    if (!o || !f) return null;
    return {
      raceId: id, date: o.date, winnerNo: o.winnerNo,
      runners: o.runners.map((rr) => {
        const fNew = f.runners.find((x) => x.no === rr.no);
        const signals = rr.vectors.map((s) => {
          if ([...DAV_CODES, ...GEN_CODES].includes(s.code)) return fNew?.vectors.find((x) => x.code === s.code) ?? s;
          if (s.code === "HIZ_01" && useVaryant) {
            const v = varyantliHiz01ByRace[id]?.get(rr.no);
            return { ...s, rawValue: v ?? null, observed: v != null };
          }
          return s;
        });
        return { no: rr.no, name: rr.name, vectors: signals };
      }),
    };
  }
  const trainE = lock.trainRaceIds.map((id) => merged(id, false)).filter((r): r is CacheRace => !!r);
  const trainYET = lock.trainRaceIds.map((id) => merged(id, true)).filter((r): r is CacheRace => !!r);
  const holdoutE = lock.holdoutRaceIds.map((id) => merged(id, false)).filter((r): r is CacheRace => !!r);
  const holdoutYET = lock.holdoutRaceIds.map((id) => merged(id, true)).filter((r): r is CacheRace => !!r);

  // Degisim orani
  let degisenRunner = 0, toplamRunner = 0;
  for (let i = 0; i < trainE.length; i++) for (let j = 0; j < trainE[i].runners.length; j++) {
    toplamRunner++;
    const a = trainE[i].runners[j].vectors.find((s)=>s.code==="HIZ_01");
    const b = trainYET[i].runners[j].vectors.find((s)=>s.code==="HIZ_01");
    if (a?.rawValue !== b?.rawValue) degisenRunner++;
  }
  console.log(`\nHIZ_01 degisen kosucu (TRAIN): ${degisenRunner}/${toplamRunner} (%${(100*degisenRunner/toplamRunner).toFixed(1)})`);

  type StatsEntry = { mu: number; sigma: number };
  function computeStats(races: CacheRace[], codes: string[]): Map<string, StatsEntry> {
    const stats = new Map<string, StatsEntry>();
    for (const code of codes) {
      const values: number[] = [];
      for (const race of races) for (const r of race.runners) {
        const s = r.vectors.find((x) => x.code === code);
        if (s?.observed && s.rawValue != null && Number.isFinite(s.rawValue)) values.push(s.rawValue);
      }
      if (values.length < 2) { stats.set(code, { mu: 0, sigma: 1 }); continue; }
      const mu = values.reduce((a, b) => a + b, 0) / values.length;
      const variance = values.reduce((a, b) => a + (b - mu) ** 2, 0) / values.length;
      stats.set(code, { mu, sigma: Math.sqrt(variance) || 1 });
    }
    return stats;
  }
  function buildVector(fv: RunnerFeatureVector, stats: Map<string, StatsEntry>, codes: string[]): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const st = stats.get(code)!;
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null && Number.isFinite(s.rawValue);
      const z = observed ? (s!.rawValue! - st.mu) / (st.sigma || 1) : 0;
      vec.push(z); vec.push(observed ? 0 : 1);
    }
    return vec;
  }
  function toTR(races: CacheRace[], stats: Map<string, StatsEntry>, codes: string[]): TrainingRunner[][] {
    const out: TrainingRunner[][] = [];
    for (const race of races) {
      if (race.winnerNo == null || race.runners.length < 2) continue;
      const runners: TrainingRunner[] = race.runners.map((r) => {
        const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildVector(fv, stats, codes) };
      });
      if (runners.some((r) => r.winner)) out.push(runners);
    }
    return out;
  }
  function evalSet(races: TrainingRunner[][], beta: number[]) {
    let ll = 0, top1 = 0, n = 0;
    for (const race of races) {
      const scores = race.map((r) => dot(r.features, beta));
      const p = softmax(scores);
      const winIdx = race.findIndex((r) => r.winner);
      const ranked = [...p.keys()].sort((a, b) => p[b] - p[a]);
      ll += logLoss(p[winIdx]); if (ranked[0] === winIdx) top1++; n++;
    }
    return { ll: ll / n, top1: top1 / n, n };
  }

  // TRAIN-ici kronolojik CV: E (mevcut HIZ_01) vs YET-deneysel (varyantli HIZ_01)
  const trainESorted = [...trainE].sort((a, b) => a.date.localeCompare(b.date));
  const cvValSize = Math.round(trainESorted.length * 0.2);
  const cvFitIds = new Set(trainESorted.slice(0, trainESorted.length - cvValSize).map((r) => r.raceId));

  console.log(`\n=== TRAIN-ici kronolojik CV: HIZ_01 gunluk-varyant ===`);
  for (const [label, races] of [["BASELINE (mevcut HIZ_01)", trainE], ["YET-deneysel (varyantli HIZ_01)", trainYET]] as const) {
    const cvFit = races.filter((r) => cvFitIds.has(r.raceId));
    const cvVal = races.filter((r) => !cvFitIds.has(r.raceId));
    const stats = computeStats(cvFit, allCodes);
    const beta = fitConditionalLogit(toTR(cvFit, stats, allCodes), allCodes.length * 2, { lambda: currentModel.opts.lambda, learningRate: currentModel.opts.learningRate, iterations: currentModel.opts.iterations });
    const val = evalSet(toTR(cvVal, stats, allCodes), beta);
    console.log(`  ${label}: val LogLoss=${val.ll.toFixed(4)} Top1=%${(val.top1*100).toFixed(1)} (n=${val.n})`);
  }

  fs.writeFileSync("C:/tmp/v1-yet-varyant-ara-sonuc.json", JSON.stringify({ varyantIndexSize: varyantIndex.size, degisenRunner, toplamRunner }, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
