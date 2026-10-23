// DAV TARIHSEL KURTARMA — ESKI vs YENI (kurtarilmis) karsilastirma. Donmus production
// katsayisi/mu/sigma AYNI kalir (yeniden egitim YOK) — yalniz ham veri (artik cok daha
// genis gercek kapsamla) degisti. TRAIN/HOLDOUT/EK ayri gosterilir; EK'te kurtarma
// UYGULANMADI (DB rebuild yapilmadi), bu acikca belirtilir.
import fs from "node:fs";
import { scoreRace, explainRunner } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

async function main() {
  const oldCache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const newCache = JSON.parse(fs.readFileSync("C:/tmp/gen-dav-recovered-150-cache.json", "utf8")) as Record<string, CacheRace>;
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const model = loadTrainedV1Model();

  function evalCache(cache: Record<string, CacheRace>, ids: string[], label: string) {
    let ll = 0, top1 = 0, top3 = 0, n = 0;
    for (const id of ids) {
      const race = cache[id]; if (!race || race.winnerNo == null) continue;
      const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
      const scored = scoreRace(vectors, model);
      const winIdx = scored.findIndex((s) => s.no === race.winnerNo);
      if (winIdx < 0) continue;
      const ranked = [...scored].sort((a, b) => b.probability - a.probability);
      ll += logLoss(scored[winIdx].probability); n++;
      if (ranked[0].no === race.winnerNo) top1++;
      if (ranked.slice(0, 3).some((r) => r.no === race.winnerNo)) top3++;
    }
    console.log(`${label}: n=${n} Top1=%${(top1/n*100).toFixed(1)} Top3=%${(top3/n*100).toFixed(1)} LogLoss=${(ll/n).toFixed(4)}`);
  }

  console.log("=== ESKI (kurtarma-oncesi ham veri) ===");
  evalCache(oldCache, lock.trainRaceIds, "TRAIN(120)");
  evalCache(oldCache, lock.holdoutRaceIds, "HOLDOUT(30)");

  console.log("\n=== YENI (DAV tarihsel kurtarma uygulanmis) ===");
  evalCache(newCache, lock.trainRaceIds, "TRAIN(120)");
  evalCache(newCache, lock.holdoutRaceIds, "HOLDOUT(30)");

  console.log("\n(EK=108 icin kurtarma UYGULANMADI — DB rebuild bu turda yapilmadi, mevcut deger ESKI kalir, karsilastirma dahil edilmedi)");

  // DAV_TAKI_EKLENDI=1 olan kurtarilmis vakalarda, donmus katsayiyla uretilen skor katkisi
  // hala asiri mi? (ESKI ile AYNI mu/sigma/beta kullaniliyor, yalniz artik cok daha fazla
  // GERCEK EKLENDI=1 ornegi var)
  console.log("\n=== Kurtarilan EDILDI=1 orneklerinde DAV skor katkisi (donmus katsayiyla) ===");
  let ornekSayisi = 0, toplamKatki = 0, minKatki = Infinity, maxKatki = -Infinity;
  for (const id of [...lock.trainRaceIds, ...lock.holdoutRaceIds]) {
    const race = newCache[id]; if (!race) continue;
    for (const r of race.runners) {
      const s = r.vectors.find((x) => x.code === "DAV_TAKI_EKLENDI");
      if (s?.observed && s.rawValue === 1) {
        const fv: RunnerFeatureVector = { raceId: id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
        const { rows } = explainRunner(fv, model);
        const row = rows.find((x) => x.code === "DAV_TAKI_EKLENDI")!;
        const katki = row.scoreContribution + row.missingIndicatorContribution;
        ornekSayisi++; toplamKatki += katki; minKatki = Math.min(minKatki, katki); maxKatki = Math.max(maxKatki, katki);
      }
    }
  }
  console.log(`n=${ornekSayisi}, ortalama katki=${(toplamKatki/ornekSayisi).toFixed(3)}, min=${minKatki.toFixed(3)}, max=${maxKatki.toFixed(3)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
