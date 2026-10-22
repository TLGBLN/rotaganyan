// GEN SOY-KİRLENMESİ SOMUT ÖLÇÜMÜ (kullanıcı talimatı, 2026-10-22, "kod değiştirme, yalnız
// somut etkiyi raporla"). gen-pedigri.ts/v5461-sire.actions.ts'e DOKUNULMAZ — burada AYNI
// sorgu deseni, yalnız atın KENDİ tjkAtId'si HARİÇ TUTULARAK (karşılaştırma amaçlı) yeniden
// kurulur. 138 BAĞIMSIZ yarışın TÜMÜNDE, GEN_SIRE_01/DAM/DAMSIRE için mevcut (kirlenmeye
// açık) değer ile öz-hariç değer karşılaştırılır.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { breedToIrk, surfaceToPist, mesafeBucket, normalizeSireName } from "./src/lib/sire-stat-match";
import { finishPos } from "./src/lib/race-result";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { explainRunner, scoreRace } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import type { SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] }>;
  const model = loadTrainedV1Model();
  const trainSet = new Set(lock.trainRaceIds), holdoutSet = new Set(lock.holdoutRaceIds);
  const bagimsizIds = Object.keys(cache).filter((id) => !trainSet.has(id));

  // Her yarış icin runner meta (sire/dam/damSire/tjkAtId) TEK sorguda
  const races = await db.race.findMany({
    where: { id: { in: bagimsizIds } },
    select: {
      id: true, breed: true, surface: true, distance: true,
      raceDay: { select: { date: true } },
      runners: { where: { scratched: false }, select: { no: true, sire: true, dam: true, damSire: true, tjkAtId: true } },
    },
  });

  // TUM gecmis Runner/Race/Result satirlarini TEK seferde cek (sire/dam/damSire hepsi icin ortak havuz)
  console.log("Tüm geçmiş pedigri satırları çekiliyor (tek sorgu)...");
  const allRows = await db.runner.findMany({
    where: { scratched: false, race: { result: { isNot: null } } },
    select: {
      sire: true, dam: true, damSire: true, no: true, tjkAtId: true,
      race: { select: { breed: true, surface: true, distance: true, raceDay: { select: { date: true } }, result: { select: { actualOrder: true, winnerNos: true } } } },
    },
  });
  console.log(`Toplam geçmiş satır: ${allRows.length}`);

  type Sayim = { start: number; wins: number; kendiDahil: number; kendiWins: number };
  function hesapla(field: "sire" | "dam" | "damSire", name: string, irk: string, pist: string, mesafe: string, cutoffMs: number, kendiTjkAtId: number | null): Sayim {
    const hedefIsim = normalizeSireName(name);
    const s: Sayim = { start: 0, wins: 0, kendiDahil: 0, kendiWins: 0 };
    for (const r of allRows) {
      const rawName = field === "sire" ? r.sire : field === "dam" ? r.dam : r.damSire;
      if (!rawName || !r.race.result) continue;
      if (r.race.raceDay.date.getTime() >= cutoffMs) continue;
      if (breedToIrk(r.race.breed) !== irk) continue;
      if (surfaceToPist(r.race.surface) !== pist) continue;
      if (mesafeBucket(r.race.distance) !== mesafe) continue;
      if (normalizeSireName(rawName) !== hedefIsim) continue;
      const pos = finishPos(r.race.result.actualOrder, r.no, r.race.result.winnerNos);
      const isWin = pos === 1;
      s.start++;
      if (isWin) s.wins++;
      if (kendiTjkAtId != null && r.tjkAtId === kendiTjkAtId) {
        s.kendiDahil++;
        if (isWin) s.kendiWins++;
      }
    }
    return s;
  }

  let toplamAt = 0, kirlenmisAt = 0;
  let gen01Degisen = 0, genDamDegisen = 0, genDamSireDegisen = 0;
  const etkiRaporu: { raceId: string; no: number; kod: string; kendiStartSayisi: number; toplamStart: number; kYuzdeOnce: number | null; kYuzdeSonra: number | null }[] = [];
  const rankEtkisi: { raceId: string; no: number; winnerNo: number | null; oncekiSira: number; sonrakiSira: number }[] = [];

  for (const race of races) {
    const c = cache[race.id];
    if (!c) continue;
    const cutoffMs = race.raceDay.date.getTime();
    const irk = breedToIrk(race.breed), pist = surfaceToPist(race.surface), mesafe = mesafeBucket(race.distance);

    // Her at icin DUZELTILMIS (kendi haric) GEN degerlerini hesapla, mevcut (gercek) degerle karsilastir
    const duzeltilmisVectors = c.runners.map((r) => {
      const meta = race.runners.find((rr) => rr.no === r.no);
      toplamAt++;
      const yeniSignals = r.vectors.map((sig): SignalEntry => {
        if (!meta) return sig;
        let field: "sire" | "dam" | "damSire" | null = null;
        let name: string | null = null;
        if (sig.code === "GEN_SIRE_01") { field = "sire"; name = meta.sire; }
        else if (sig.code === "GEN_DAM_01") { field = "dam"; name = meta.dam; }
        else if (sig.code === "GEN_DAMSIRE_01") { field = "damSire"; name = meta.damSire; }
        if (!field || !name) return sig;

        const s = hesapla(field, name, irk, pist, mesafe, cutoffMs, meta.tjkAtId);
        if (s.kendiDahil > 0) {
          kirlenmisAt++;
          const duzeltilmisStart = s.start - s.kendiDahil;
          const duzeltilmisWins = s.wins - s.kendiWins;
          const kYuzdeOnce = sig.rawValue;
          const kYuzdeSonra = duzeltilmisStart > 0 ? (duzeltilmisWins / duzeltilmisStart) * 100 : null;
          etkiRaporu.push({ raceId: race.id, no: r.no, kod: sig.code, kendiStartSayisi: s.kendiDahil, toplamStart: s.start, kYuzdeOnce, kYuzdeSonra });
          if (sig.code === "GEN_SIRE_01") gen01Degisen++;
          if (sig.code === "GEN_DAM_01") genDamDegisen++;
          if (sig.code === "GEN_DAMSIRE_01") genDamSireDegisen++;
          if (kYuzdeSonra == null) return { ...sig, rawValue: null, observed: false, missingReason: "öz-hariç düzeltmeden sonra örneklem kalmadı" };
          return { ...sig, rawValue: kYuzdeSonra };
        }
        return sig;
      });
      return { raceId: race.id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: yeniSignals };
    });

    // Bu yarista HERHANGI bir at etkilenmisse, siralamaya etkisini olc
    const etkilenenVarMi = duzeltilmisVectors.some((v, i) => v.signals.some((s, j) => s.rawValue !== c.runners[i].vectors[j]?.rawValue));
    if (etkilenenVarMi && c.winnerNo != null) {
      const gercekVectors = c.runners.map((r) => ({ raceId: race.id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
      const gercekScored = [...scoreRace(gercekVectors, model)].sort((a, b) => b.probability - a.probability);
      const duzeltilmisScored = [...scoreRace(duzeltilmisVectors, model)].sort((a, b) => b.probability - a.probability);
      const oncekiSira = gercekScored.findIndex((s) => s.no === c.winnerNo) + 1;
      const sonrakiSira = duzeltilmisScored.findIndex((s) => s.no === c.winnerNo) + 1;
      if (oncekiSira !== sonrakiSira) {
        rankEtkisi.push({ raceId: race.id, no: c.winnerNo, winnerNo: c.winnerNo, oncekiSira, sonrakiSira });
      }
    }
  }

  console.log(`\n=== GEN SOY-KİRLENMESİ ÖLÇÜMÜ (138 BAĞIMSIZ yarış) ===`);
  console.log(`Toplam değerlendirilen at-gözlemi: ${toplamAt}`);
  console.log(`Kendi geçmiş starttı kirlenmiş gözlem sayısı (GEN_SIRE_01+GEN_DAM_01+GEN_DAMSIRE_01 toplam): ${kirlenmisAt}`);
  console.log(`  GEN_SIRE_01 etkilenen: ${gen01Degisen}`);
  console.log(`  GEN_DAM_01 etkilenen: ${genDamDegisen}`);
  console.log(`  GEN_DAMSIRE_01 etkilenen: ${genDamSireDegisen}`);
  console.log(`Etkilenen benzersiz yarış sayısı: ${new Set(etkiRaporu.map(e=>e.raceId)).size}/138`);
  console.log(`Kazananın sırasını DEĞİŞTİREN yarış sayısı: ${rankEtkisi.length}`);
  rankEtkisi.forEach((r) => console.log(`  ${r.raceId} kazanan#${r.winnerNo}: ${r.oncekiSira} -> ${r.sonrakiSira}`));

  console.log(`\n=== En büyük 15 öz-kirlenme etkisi (kYuzdeOnce vs kYuzdeSonra farkı) ===`);
  etkiRaporu
    .filter((e) => e.kYuzdeOnce != null && e.kYuzdeSonra != null)
    .sort((a, b) => Math.abs((b.kYuzdeOnce! - b.kYuzdeSonra!)) - Math.abs((a.kYuzdeOnce! - a.kYuzdeSonra!)))
    .slice(0, 15)
    .forEach((e) => console.log(`  ${e.raceId} #${e.no} ${e.kod}: kendi start=${e.kendiStartSayisi}/${e.toplamStart} | önce=${e.kYuzdeOnce!.toFixed(1)}% sonra=${e.kYuzdeSonra!.toFixed(1)}%`));

  fs.writeFileSync("C:/tmp/gen-kirlenme-detay.json", JSON.stringify(etkiRaporu, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
