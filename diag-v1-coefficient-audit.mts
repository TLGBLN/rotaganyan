// SALT-OKUNUR DENETİM — yeni eğitim/katsayı değişikliği YOK. Kullanıcı talimatı (2026-10-21):
// "Son eğitilmiş 38 özellikli artefakttaki bütün katsayıları, kaç yarışta gözlemlendiklerini
// ve oluşturdukları en büyük negatif/pozitif katkıları tek tabloda inceleyelim. Özellikle
// |z| >= 3 olan sinyallerin sıralamaları ne kadar değiştirdiğini ölçelim."
import fs from "node:fs";
import { scoreRace } from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector } from "./src/lib/motor-v1/engine/feature-vector";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";

type CacheSignal = { code: string; family: string; rawValue: number | null; observed: boolean };
type CacheRunner = { no: number; name: string; vectors: CacheSignal[] };
type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: CacheRunner[] };

const Z_ESIK = 3;

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-150-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const model = loadTrainedV1Model();
  const codes = [...model.stats.keys()];

  const trainRaces = lock.trainRaceIds.map((id) => cache[id]).filter((r): r is CacheRace => !!r);
  console.log(`Train seti: ${trainRaces.length}/${lock.trainRaceIds.length} yaris onbellekte bulundu.`);

  // --- 1) Kod bazinda: nObserved, |z|>=3 olan durumlar, en buyuk |z| ---
  type ZOlay = { raceId: string; raceLabel: string; no: number; name: string; rawValue: number; z: number; katki: number };
  const kodRapor = new Map<string, { nObserved: number; zOlaylari: ZOlay[]; maxAbsZ: number; betaZ: number }>();
  for (const code of codes) {
    const stat = model.stats.get(code)!;
    const betaIdx = model.names.indexOf(`${code}_z` as never);
    kodRapor.set(code, { nObserved: 0, zOlaylari: [], maxAbsZ: 0, betaZ: model.beta[betaIdx] });
  }

  for (const race of trainRaces) {
    for (const runner of race.runners) {
      for (const sig of runner.vectors) {
        const rec = kodRapor.get(sig.code);
        if (!rec || !sig.observed || sig.rawValue == null) continue;
        const stat = model.stats.get(sig.code)!;
        const z = (sig.rawValue - stat.mu) / (stat.sigma || 1);
        rec.nObserved++;
        if (Math.abs(z) > rec.maxAbsZ) rec.maxAbsZ = Math.abs(z);
        if (Math.abs(z) >= Z_ESIK) {
          rec.zOlaylari.push({ raceId: race.raceId, raceLabel: race.date.slice(0, 10), no: runner.no, name: runner.name, rawValue: sig.rawValue, z, katki: rec.betaZ * z });
        }
      }
    }
  }

  console.log(`\n=== KOD BAZINDA RAPOR (38 kod, train=${trainRaces.length} yaris) ===`);
  console.log(`kod`.padEnd(22), `beta_z`.padStart(9), `nObs`.padStart(6), `maxAbsZ`.padStart(9), `|z|>=${Z_ESIK} sayisi`.padStart(14));
  const siraliKodlar = [...kodRapor.entries()].sort((a, b) => b[1].maxAbsZ - a[1].maxAbsZ);
  for (const [code, rec] of siraliKodlar) {
    console.log(
      code.padEnd(22),
      rec.betaZ.toFixed(4).padStart(9),
      String(rec.nObserved).padStart(6),
      rec.maxAbsZ.toFixed(2).padStart(9),
      String(rec.zOlaylari.length).padStart(14)
    );
  }

  // --- 2) |z|>=3 olan HER olay icin: o atin sirasi, sinyal cikarilinca sirasi NE KADAR degisiyor ---
  console.log(`\n=== |z|>=${Z_ESIK} OLAYLARIN SIRALAMA ETKISI (sinyal CIKARILIRSA, SADECE O SINYAL, model YENIDEN EGITILMEDEN) ===`);
  type SiraEtki = { code: string; raceLabel: string; no: number; name: string; z: number; katki: number; oncekiSira: number; sonrakiSira: number; siraDegisimi: number; fieldSize: number };
  const siraEtkiler: SiraEtki[] = [];

  for (const [code, rec] of kodRapor) {
    for (const olay of rec.zOlaylari) {
      const race = cache[olay.raceId];
      const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({
        raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null,
        signals: r.vectors.filter((v) => model.stats.has(v.code)),
      }));
      const scored = scoreRace(vectors, model);
      const ranked = [...scored].sort((a, b) => b.probability - a.probability);
      const oncekiSira = ranked.findIndex((s) => s.no === olay.no) + 1;

      // Bu BIR atin BU BIR sinyalini (yalnizca bu runner'in bu kodunu) "gozlemsiz" yaparak yeniden skorla.
      const vectors2: RunnerFeatureVector[] = vectors.map((v) =>
        v.no === olay.no ? { ...v, signals: v.signals.filter((s) => s.code !== code) } : v
      );
      const scored2 = scoreRace(vectors2, model);
      const ranked2 = [...scored2].sort((a, b) => b.probability - a.probability);
      const sonrakiSira = ranked2.findIndex((s) => s.no === olay.no) + 1;

      siraEtkiler.push({
        code, raceLabel: olay.raceLabel, no: olay.no, name: olay.name, z: olay.z, katki: olay.katki,
        oncekiSira, sonrakiSira, siraDegisimi: oncekiSira - sonrakiSira, fieldSize: race.runners.length,
      });
    }
  }

  siraEtkiler.sort((a, b) => Math.abs(b.siraDegisimi) - Math.abs(a.siraDegisimi));
  for (const e of siraEtkiler) {
    console.log(
      `${e.code.padEnd(20)} ${e.raceLabel} #${e.no} ${e.name.padEnd(16)} z=${e.z.toFixed(2).padStart(7)} katki=${e.katki.toFixed(3).padStart(8)} ` +
      `sira ${e.oncekiSira}/${e.fieldSize} -> ${e.sonrakiSira}/${e.fieldSize} (fark=${e.siraDegisimi >= 0 ? "+" : ""}${e.siraDegisimi})`
    );
  }

  console.log(`\nToplam |z|>=${Z_ESIK} olay sayisi: ${siraEtkiler.length}`);
  console.log(`Sira degisimi 0 olan olay sayisi: ${siraEtkiler.filter((e) => e.siraDegisimi === 0).length}`);
  console.log(`Sira degisimi >=2 basamak olan olay sayisi: ${siraEtkiler.filter((e) => Math.abs(e.siraDegisimi) >= 2).length}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
