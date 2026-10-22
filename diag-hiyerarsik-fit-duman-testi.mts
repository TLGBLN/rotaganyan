// DUMAN TESTI (DB YOK) — yeni fitConditionalLogitHierarchical mekanizmasinin dogru
// calistigini, mevcut (HENUZ GEN/DAV duzeltmesiz) 120 TRAIN yarisiyla hizlica dogrular.
// Bu NIHAI model DEGIL — yalniz altyapi testi. GEN/DAV duzeltmesi ayri, DB gerektiren
// bir adimda uygulanacak.
import fs from "node:fs";
import { computeFeatureStats, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { fitConditionalLogitHierarchical, KOSUL_KATEGORILERI, kosulKategorisiCoz, isIkiliKod, turetZCap, zKirp, type KosulKategorisi } from "./src/lib/motor-v1/engine/hierarchical-fit";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";
import type { TrainingRunner } from "./src/lib/v5461/conditional-logit";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { db } from "./src/lib/db";

// Hangi kodlar hangi ailenin DOGRUDAN (iliskisel OLMAYAN) uyesi — interaction kodlari
// (INTERACTION_COMPONENTS'teki 8 kod) buraya DAHIL EDILMEZ, cift-sayimi onler.
const FAMILY_DIRECT_CODES: Record<string, string[]> = {
  GEN: ["GEN_SIRE_01", "GEN_DAM_01", "GEN_DAMSIRE_01", "GEN_SIRE_PMZ_01"],
  YET: ["HIZ_01", "SINIF_01"],
  FRM: ["FORM_01", "FORM_02", "FORM_03"],
  PMZ: ["PMZ_01", "PMZ_02", "FORM_x_ZEMIN"],
  TMP: ["TEMPO_01", "TEMPO_02", "TEMPO_03", "TEMPO_04", "KULVAR_01_HAM"],
  JOK: ["JOKEY_01", "JOKEY_02", "JOKEY_04", "JOKEY_TREND30"],
  ANT: ["ANT_TREND30"],
  KIL: ["KILO_01", "KILO_02", "KILO_03", "KILO_04"],
  DAV: ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"],
  RAK: ["RAK_H2H_01", "RAK_GAP_01"],
};
const FAMILIES = Object.keys(FAMILY_DIRECT_CODES);

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] }>;
  const currentModel = loadTrainedV1Model();
  const codes = [...currentModel.stats.keys()]; // 38 kod, sabit sira

  const metas = await db.race.findMany({
    where: { id: { in: lock.trainRaceIds } },
    select: { id: true, classType: true },
  });
  const kosulById = new Map(metas.map((m) => [m.id, kosulKategorisiCoz(m.classType)]));

  const trainRaces = lock.trainRaceIds.map((id) => cache[id]).filter((r): r is NonNullable<typeof r> => !!r);
  console.log(`TRAIN: ${trainRaces.length}/${lock.trainRaceIds.length}`);

  // mu/sigma — AYNI mevcut yontemle (TRAIN'den)
  const vectorsAll: RunnerFeatureVector[] = trainRaces.flatMap((race) =>
    race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }))
  );
  const stats = computeFeatureStats(vectorsAll, codes as never);

  // DAV DUZELTMESI: ikili kodlar icin veriden turetilmis Z_CAP (bkz. hierarchical-fit.ts).
  const rawByCode = new Map<string, number[]>();
  for (const code of codes) rawByCode.set(code, []);
  for (const fv of vectorsAll) {
    for (const code of codes) {
      const s = fv.signals.find((x) => x.code === code);
      if (s?.observed && s.rawValue != null) rawByCode.get(code)!.push(s.rawValue);
    }
  }
  const zCap = turetZCap(rawByCode);
  const ikiliKodlar = new Set(codes.filter((c) => isIkiliKod(rawByCode.get(c) ?? [])));
  console.log(`\nZ_CAP (30 saf temel koddan turetildi, iliski kodlari haric): ${zCap}`);
  console.log(`Ikili tespit edilen kodlar: ${[...ikiliKodlar].join(", ") || "(yok)"}`);

  function zOf(code: string, rawValue: number): number {
    const st = stats.get(code as never)!;
    const zHam = (rawValue - st.mu) / (st.sigma || 1);
    return zKirp(zHam, code, ikiliKodlar.has(code), zCap);
  }

  // DAV z-kirpma oncesi/sonrasi gosterim (DAV_TAKI_EKLENDI/CIKARILDI)
  for (const code of ["DAV_TAKI_EKLENDI", "DAV_TAKI_CIKARILDI"]) {
    const raws = rawByCode.get(code) ?? [];
    if (raws.length === 0) continue;
    const st = stats.get(code as never)!;
    const maxRaw = Math.max(...raws);
    const zHam = (maxRaw - st.mu) / (st.sigma || 1);
    const zSonra = zKirp(zHam, code, ikiliKodlar.has(code), zCap);
    console.log(`  ${code}: n=${raws.length}, mu=${st.mu.toFixed(5)}, sigma=${st.sigma.toFixed(5)}, z(ham)=${zHam.toFixed(2)} -> z(kirpilmis)=${zSonra.toFixed(2)}`);
  }

  // Ozellik vektoru insasi: 38 temel z-skor + (10 aile x 5 kosul) etkilesim sutunu
  const interactionNames: string[] = [];
  for (const fam of FAMILIES) for (const kosul of KOSUL_KATEGORILERI) interactionNames.push(`${fam}__${kosul}`);
  const featureCount = codes.length + interactionNames.length;
  console.log(`Ozellik sayisi: ${featureCount} (${codes.length} temel + ${interactionNames.length} etkilesim)`);

  function buildFeatures(fv: RunnerFeatureVector, kosul: KosulKategorisi): number[] {
    const vec: number[] = [];
    for (const code of codes) {
      const s = fv.signals.find((x) => x.code === code);
      const observed = !!s?.observed && s.rawValue != null;
      vec.push(observed ? zOf(code, s!.rawValue!) : 0);
    }
    for (const fam of FAMILIES) {
      for (const k of KOSUL_KATEGORILERI) {
        if (k !== kosul) { vec.push(0); continue; }
        // HAM (agirliksiz) aile-temel-z toplami (Z_CAP kirpmasi ile)
        let toplam = 0;
        for (const code of FAMILY_DIRECT_CODES[fam]) {
          const s = fv.signals.find((x) => x.code === code);
          if (!s || !s.observed || s.rawValue == null) continue;
          toplam += zOf(code, s.rawValue);
        }
        vec.push(toplam);
      }
    }
    return vec;
  }

  const races: TrainingRunner[][] = [];
  for (const race of trainRaces) {
    if (race.winnerNo == null || race.runners.length < 2) continue;
    const kosul = kosulById.get(race.raceId) ?? "DİĞER";
    const runners: TrainingRunner[] = race.runners.map((r) => {
      const fv: RunnerFeatureVector = { raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
      return { raceId: race.raceId, runnerId: String(r.no), winner: r.no === race.winnerNo, features: buildFeatures(fv, kosul) };
    });
    if (runners.some((r) => r.winner)) races.push(runners);
  }
  console.log(`Fit edilecek yaris: ${races.length}`);

  const lambdaTemel = 1, lambdaEtkilesim = 8; // baslangic degerleri — CV ile ayarlanacak
  const lambdaVector = codes.map(() => lambdaTemel).concat(interactionNames.map(() => lambdaEtkilesim));
  const priorVector = Array(featureCount).fill(0);

  console.log("\nFit basliyor (duman testi, GEN/DAV HENUZ duzeltilmedi)...");
  const t0 = Date.now();
  const beta = fitConditionalLogitHierarchical(races, featureCount, { lambdaVector, priorVector, learningRate: 0.05, iterations: 300 });
  console.log(`Fit bitti (${((Date.now() - t0) / 1000).toFixed(1)}s). NaN var mi: ${beta.some((b) => !Number.isFinite(b))}`);

  console.log("\n=== Etkilesim katsayilari (eta, aile x kosul) ===");
  for (let i = 0; i < FAMILIES.length; i++) {
    const fam = FAMILIES[i];
    const row = KOSUL_KATEGORILERI.map((k, j) => beta[codes.length + i * KOSUL_KATEGORILERI.length + j].toFixed(3).padStart(9));
    console.log(fam.padEnd(5), row.join(" "));
  }
  console.log("Kosul sirasi:", KOSUL_KATEGORILERI.join(" "));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
