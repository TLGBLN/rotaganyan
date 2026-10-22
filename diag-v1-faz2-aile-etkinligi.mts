// FAZ 2 — SİNYAL AİLESİ × YARIŞ TİPİ ETKİNLİK DENETİMİ (kullanıcı talimatı, 2026-10-22).
// Salt-okunur: v1-trained-model.json/deneysel artefakt DEĞİŞMEZ, yeniden eğitim YOK.
// Yöntem: her yarışta, her 10-aile için TÜM atlardan o ailenin kodlarını (+ o aileyi
// içeren INTERACTION kodlarını) "gözlemsiz" yaparak YENİDEN skorla — aile bütünüyle
// yokmuş gibi model ne tahmin ederdi? Kazananın sırası/Top1/Top3/LogLoss farkı ölçülür.
//
// TRAIN(120)/HOLDOUT(30) kullanılan, EK(100, hiç fit'e girmedi) kullanılmayan olarak
// AYRI etiketlenir — "eğitimde kullanılan yarışları bağımsız test gibi gösterme" kuralı.
import fs from "node:fs";
import { scoreRace, type FittedModel } from "./src/lib/motor-v1/engine/training";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { db } from "./src/lib/db";

const FAMILY_TO_STANDARD: Record<string, string> = {
  GEN_PEDIGRI: "GENETIK",
  HIZ: "YETENEK", SINIF: "YETENEK",
  FORM: "FORM",
  PIST_MESAFE_ZEMIN: "PIST_MESAFE",
  TMP: "TEMPO", TEMPO_STYLE: "TEMPO",
  JOKEY: "JOKEY", JOK: "JOKEY",
  ANT: "ANTRENOR",
  KILO: "KILO",
  DAV: "TAKI_DAVRANIS",
  RAK: "RAKIP",
};
// Jenerik "INTERACTION" etiketli kodların HANGİ temel ailelerden oluştuğu (kullanıcı
// talimatı: "Aileye bağlı ilişkileri tutarlı biçimde ele al") — ablasyonda bu kodlar
// bileşen ailelerden HERHANGİ biri ablе edilince de kaldırılır.
const INTERACTION_COMPONENTS: Record<string, string[]> = {
  GEN_PMZ_YET_01: ["GENETIK", "PIST_MESAFE", "YETENEK"],
  YET_PMZ_01: ["YETENEK", "PIST_MESAFE"],
  FRM_GEN_01: ["FORM", "GENETIK"],
  ANT_FRM_01: ["ANTRENOR", "FORM"],
  TMP_DAV_01: ["TEMPO", "TAKI_DAVRANIS"],
  YET_PMZ_RAK_01: ["YETENEK", "PIST_MESAFE", "RAKIP"],
  KIL_PMZ_YET_01: ["KILO", "PIST_MESAFE", "YETENEK"],
  RAK_YET_TMP_01: ["RAKIP", "YETENEK", "TEMPO"],
};
const STANDARD_FAMILIES = ["GENETIK", "YETENEK", "FORM", "PIST_MESAFE", "TEMPO", "JOKEY", "ANTRENOR", "KILO", "TAKI_DAVRANIS", "RAKIP"];

function aile(classType: string | null): string {
  if (classType === "—" || classType == null) return "BİLİNMİYOR";
  const c = classType.toUpperCase();
  if (c.includes("KISA VADE HANDİKAP") || c.includes("KISA VADE HANDIKAP")) return "HANDİKAP";
  if (c.startsWith("HANDİKAP") || c.startsWith("HANDIKAP")) return "HANDİKAP";
  if (c.startsWith("MAIDEN")) return "MAIDEN";
  if (c.startsWith("ŞARTLI") || c.startsWith("SARTLI")) return "ŞARTLI";
  if (c.startsWith("KV-") || c.startsWith("KV ")) return "KV";
  if (c.startsWith("G ") || c.startsWith("G2") || c.startsWith("G3")) return "GRUP";
  if (c.startsWith("SATIŞ") || c.startsWith("SATIS")) return "SATIŞ";
  return "DİĞER";
}
function mesafeBandi(m: number | null): string {
  if (m == null) return "BİLİNMİYOR";
  if (m <= 1400) return "KISA";
  if (m <= 1800) return "ORTA";
  return "UZUN";
}
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

function removeFamily(vectors: RunnerFeatureVector[], standardFamily: string): RunnerFeatureVector[] {
  return vectors.map((v) => ({
    ...v,
    signals: v.signals.filter((s) => {
      const base = FAMILY_TO_STANDARD[s.family] ?? null;
      if (base === standardFamily) return false;
      const comps = INTERACTION_COMPONENTS[s.code];
      if (comps && comps.includes(standardFamily)) return false;
      return true;
    }),
  }));
}

type RaceRow = {
  id: string; set: "TRAIN" | "HOLDOUT" | "EK"; aile: string; surface: string; mesafeBand: string; breed: string; saha: number;
  winnerNo: number | null;
};
type FamilyResult = {
  raceId: string; set: string; aile: string; surface: string; mesafeBand: string; saha: number;
  family: string;
  winnerRankFull: number | null; winnerRankAblated: number | null;
  top1Full: boolean; top1Ablated: boolean;
  top3Full: boolean; top3Ablated: boolean;
  llFull: number | null; llAblated: number | null;
};

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] }>;
  const model = loadTrainedV1Model();

  const trainSet = new Set(lock.trainRaceIds);
  const holdoutSet = new Set(lock.holdoutRaceIds);
  const allIds = Object.keys(cache);
  console.log(`Önbellekte toplam ${allIds.length} yarış.`);

  // Yarış meta verisi (aile/pist/mesafe/ırk) — tek sorguda
  const metas = await db.race.findMany({
    where: { id: { in: allIds } },
    select: { id: true, classType: true, surface: true, distance: true, breed: true, runners: { where: { scratched: false }, select: { id: true } } },
  });
  const metaById = new Map(metas.map((m) => [m.id, m]));

  const raceRows: RaceRow[] = [];
  for (const id of allIds) {
    const c = cache[id];
    const m = metaById.get(id);
    if (!m) continue;
    raceRows.push({
      id, set: trainSet.has(id) ? "TRAIN" : holdoutSet.has(id) ? "HOLDOUT" : "EK",
      aile: aile(m.classType), surface: m.surface, mesafeBand: mesafeBandi(m.distance),
      breed: m.breed, saha: c.runners.length, winnerNo: c.winnerNo,
    });
  }

  console.log(`\n=== SET DAĞILIMI (eğitimde kullanılan vs bağımsız) ===`);
  for (const s of ["TRAIN", "HOLDOUT", "EK"]) console.log(`  ${s}: ${raceRows.filter((r) => r.set === s).length}`);

  const results: FamilyResult[] = [];
  let processed = 0;
  for (const row of raceRows) {
    if (row.winnerNo == null) continue;
    const c = cache[row.id];
    const vectors: RunnerFeatureVector[] = c.runners.map((r) => ({ raceId: row.id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const fullScored = [...scoreRace(vectors, model)].sort((a, b) => b.probability - a.probability);
    const fullWinnerIdx = fullScored.findIndex((s) => s.no === row.winnerNo);
    if (fullWinnerIdx < 0) continue;
    const fieldSize = fullScored.length;

    for (const fam of STANDARD_FAMILIES) {
      const ablatedVectors = removeFamily(vectors, fam);
      const ablatedScored = [...scoreRace(ablatedVectors, model)].sort((a, b) => b.probability - a.probability);
      const ablatedWinnerIdx = ablatedScored.findIndex((s) => s.no === row.winnerNo);
      results.push({
        raceId: row.id, set: row.set, aile: row.aile, surface: row.surface, mesafeBand: row.mesafeBand, saha: fieldSize,
        family: fam,
        winnerRankFull: fullWinnerIdx + 1, winnerRankAblated: ablatedWinnerIdx + 1,
        top1Full: fullWinnerIdx === 0, top1Ablated: ablatedWinnerIdx === 0,
        top3Full: fullWinnerIdx < 3, top3Ablated: ablatedWinnerIdx < 3,
        llFull: logLoss(fullScored[fullWinnerIdx].probability),
        llAblated: ablatedWinnerIdx >= 0 ? logLoss(ablatedScored[ablatedWinnerIdx].probability) : null,
      });
    }
    processed++;
    if (processed % 25 === 0) console.log(`  işlenen: ${processed}/${raceRows.length} yarış`);
  }

  fs.writeFileSync("C:/tmp/faz2-raw-results.json", JSON.stringify(results, null, 0));
  console.log(`\nİşlenen yarış: ${processed}. Ham sonuç: C:/tmp/faz2-raw-results.json`);

  // --- Özet: Aile x Set ---
  function ozet(rows: FamilyResult[], label: string) {
    console.log(`\n=== ${label} (n yarış=${new Set(rows.map(r=>r.raceId)).size}, satır=${rows.length}) ===`);
    for (const fam of STANDARD_FAMILIES) {
      const sub = rows.filter((r) => r.family === fam);
      if (sub.length === 0) continue;
      const n = sub.length;
      const top1Full = sub.filter((r) => r.top1Full).length / n;
      const top1Abl = sub.filter((r) => r.top1Ablated).length / n;
      const top3Full = sub.filter((r) => r.top3Full).length / n;
      const top3Abl = sub.filter((r) => r.top3Ablated).length / n;
      const llFull = sub.reduce((a, r) => a + (r.llFull ?? 0), 0) / n;
      const llAbl = sub.reduce((a, r) => a + (r.llAblated ?? 0), 0) / n;
      const degerlendirme = llAbl < llFull - 0.02 ? "OLASI ZARARLI (çıkarınca iyileşiyor)" : llAbl > llFull + 0.02 ? "FAYDALI (çıkarınca kötüleşiyor)" : "NÖTR/BELİRSİZ";
      console.log(`  ${fam.padEnd(14)} n=${String(n).padStart(4)} Top1:${(top1Full*100).toFixed(0)}→${(top1Abl*100).toFixed(0)}  Top3:${(top3Full*100).toFixed(0)}→${(top3Abl*100).toFixed(0)}  LogLoss:${llFull.toFixed(3)}→${llAbl.toFixed(3)} (Δ${(llAbl-llFull).toFixed(3)})  ${degerlendirme}`);
    }
  }

  ozet(results.filter((r) => r.set === "TRAIN"), "TRAIN (eğitimde kullanıldı — iç-örneklem)");
  ozet(results.filter((r) => r.set === "HOLDOUT" || r.set === "EK"), "HOLDOUT+EK (BAĞIMSIZ — hiç fit'e girmedi)");
  ozet(results, "TÜMÜ (birleşik, yalnız genel tablo için)");

  // --- Aile x Yarış ailesi (Handikap/Şartlı/Maiden/KV) çaprazı, yalnız BAĞIMSIZ (HOLDOUT+EK) ---
  console.log(`\n\n=== AİLE × YARIŞ TİPİ ÇAPRAZI (yalnız BAĞIMSIZ: HOLDOUT+EK) ===`);
  const indep = results.filter((r) => r.set !== "TRAIN");
  const yarisAileleri = ["HANDİKAP", "ŞARTLI", "MAIDEN", "KV"];
  for (const ya of yarisAileleri) {
    console.log(`\n-- ${ya} --`);
    for (const fam of STANDARD_FAMILIES) {
      const sub = indep.filter((r) => r.family === fam && r.aile === ya);
      const n = sub.length;
      if (n < 8) { console.log(`  ${fam.padEnd(14)} n=${n} VERİ YETERSİZ`); continue; }
      const top1Full = sub.filter((r) => r.top1Full).length / n;
      const top1Abl = sub.filter((r) => r.top1Ablated).length / n;
      const llFull = sub.reduce((a, r) => a + (r.llFull ?? 0), 0) / n;
      const llAbl = sub.reduce((a, r) => a + (r.llAblated ?? 0), 0) / n;
      console.log(`  ${fam.padEnd(14)} n=${String(n).padStart(3)} Top1:${(top1Full*100).toFixed(0)}→${(top1Abl*100).toFixed(0)}  LogLoss Δ=${(llAbl-llFull).toFixed(3)}`);
    }
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
