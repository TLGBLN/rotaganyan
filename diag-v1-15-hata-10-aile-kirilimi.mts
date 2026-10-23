// ROTAGANYAN V1.0 — EN BUYUK 15 LOGLOSS HATASI, 10 AILE KIRILIMI (SALT-OKUNUR).
// Kullanici talimati (2026-10-22): kazanan ile modelin yanlis favorisini, 10 ailenin
// skor katkisiyla YAN YANA karsilastir. Iliskisel (8 etkilesim) kodlar MUKERRER
// SAYILMADAN (esit-bolustur kurali ile) dagitilir — her kodun TAM katkisi (scoreContribution+
// missingIndicatorContribution), ait oldugu N bilesen aileye 1/N olarak bolunur; boylece
// 10 aile katkisinin toplami HER ZAMAN toplam skora esittir (double-count YOK).
// Hicbir model egitimi/katsayi/production kodu degismez.
import fs from "node:fs";
import { explainRunner } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

// --- AYNI dogrulanmis aile eslemesi (diag-v1-faz3-aile-dogru-ablasyon.mts ile BIREBIR) ---
const FAMILY_TO_STANDARD: Record<string, string> = {
  GEN_PEDIGRI: "GEN", HIZ: "YET", SINIF: "YET", FORM: "FRM",
  PIST_MESAFE_ZEMIN: "PMZ", TMP: "TMP", TEMPO_STYLE: "TMP",
  JOKEY: "JOK", JOK: "JOK", ANT: "ANT", KILO: "KIL", DAV: "DAV", RAK: "RAK",
};
const CODE_FAMILY_OVERRIDE: Record<string, string> = { KULVAR_01_HAM: "TMP" };
const INTERACTION_COMPONENTS: Record<string, string[]> = {
  GEN_PMZ_YET_01: ["GEN", "PMZ", "YET"],
  YET_PMZ_01: ["YET", "PMZ"],
  FRM_GEN_01: ["FRM", "GEN"],
  ANT_FRM_01: ["ANT", "FRM"],
  TMP_DAV_01: ["TMP", "DAV"],
  YET_PMZ_RAK_01: ["YET", "PMZ", "RAK"],
  KIL_PMZ_YET_01: ["KIL", "PMZ", "YET"],
  RAK_YET_TMP_01: ["RAK", "YET", "TMP"],
};
const FAMILIES = ["GEN", "YET", "FRM", "PMZ", "TMP", "JOK", "ANT", "KIL", "DAV", "RAK"];
function resolveBaseFamily(code: string, rawFamily: string): string | null {
  if (code in CODE_FAMILY_OVERRIDE) return CODE_FAMILY_OVERRIDE[code];
  return FAMILY_TO_STANDARD[rawFamily] ?? null;
}
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);

  type Row = { raceId: string; date: string; winnerNo: number; winnerName: string; winnerProb: number; ll: number; favNo: number; favName: string; favProb: number };
  const rows: Row[] = [];
  for (const raceId of Object.keys(cache)) {
    const race = cache[raceId];
    if (race.winnerNo == null || race.runners.length < 2) continue;
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const explains = vectors.map((v) => explainRunner(v, model));
    const probs = softmax(explains.map((e) => e.totalScore));
    const winIdx = vectors.findIndex((v) => v.no === race.winnerNo);
    if (winIdx < 0) continue;
    const ranked = vectors.map((v, i) => ({ no: v.no, name: v.name, p: probs[i] })).sort((a, b) => b.p - a.p);
    const fav = ranked[0];
    rows.push({ raceId, date: race.date, winnerNo: race.winnerNo, winnerName: vectors[winIdx].name, winnerProb: probs[winIdx], ll: logLoss(probs[winIdx]), favNo: fav.no, favName: fav.name, favProb: fav.p });
  }
  const worst15 = [...rows].sort((a, b) => b.ll - a.ll).slice(0, 15);

  console.log(`=== EN BUYUK 15 LOGLOSS HATASI — 10 AILE KIRILIMI ===`);
  console.log(`(Fark = Favori katkisi - Kazanan katkisi; pozitif = bu aile favoriyi kazanana gore ONE itmis)\n`);

  type FamContrib = Record<string, number>;
  function familyContribs(fv: RunnerFeatureVector): { contribs: FamContrib; total: number; missingCriticalFamilies: string[] } {
    const { rows: er, totalScore } = explainRunner(fv, model);
    const contribs: FamContrib = {}; for (const f of FAMILIES) contribs[f] = 0;
    const missingCriticalFamilies: string[] = [];
    const familyAnyObserved: Record<string, boolean> = {}; for (const f of FAMILIES) familyAnyObserved[f] = false;
    for (const r of er) {
      if (!trainedCodes.has(r.code)) continue;
      const contrib = r.scoreContribution + r.missingIndicatorContribution;
      const base = resolveBaseFamily(r.code, r.family ?? "");
      if (base) {
        contribs[base] += contrib;
        if (r.observed) familyAnyObserved[base] = true;
      } else {
        const comps = INTERACTION_COMPONENTS[r.code];
        if (comps) { const share = contrib / comps.length; for (const c of comps) contribs[c] += share; if (r.observed) for (const c of comps) familyAnyObserved[c] = true; }
      }
    }
    for (const f of FAMILIES) if (!familyAnyObserved[f]) missingCriticalFamilies.push(f);
    return { contribs, total: totalScore, missingCriticalFamilies };
  }

  const allDetailRows: Record<string, unknown>[] = [];
  for (const r of worst15) {
    const race = cache[r.raceId];
    const vectors: RunnerFeatureVector[] = race.runners.map((rr) => ({ raceId: race.raceId, no: rr.no, name: rr.name, tjkAtId: null, jockey: null, signals: rr.vectors }));
    const winnerFv = vectors.find((v) => v.no === r.winnerNo)!;
    const favFv = vectors.find((v) => v.no === r.favNo)!;
    const winnerF = familyContribs(winnerFv);
    const favF = familyContribs(favFv);

    const farklar: Record<string, number> = {};
    let sumFark = 0;
    for (const f of FAMILIES) { farklar[f] = favF.contribs[f] - winnerF.contribs[f]; sumFark += farklar[f]; }
    const toplamSkorFarki = favF.total - winnerF.total;
    const tutarlilikHatasi = Math.abs(sumFark - toplamSkorFarki);

    // Sicaklik/temperature testi (siralama DEGISMEZ, yalniz kesinlik): T=3, T=5
    const allScores = vectors.map((v) => explainRunner(v, model).totalScore);
    const winIdx2 = vectors.findIndex((v) => v.no === r.winnerNo);
    const pT = (T: number) => softmax(allScores.map((s) => s / T))[winIdx2];
    const pT1 = r.winnerProb, pT3 = pT(3), pT5 = pT(5);

    // Hangi aile(ler) farkin cogunu acikliyor?
    const sortedFamByAbsFark = [...FAMILIES].sort((a, b) => Math.abs(farklar[b]) - Math.abs(farklar[a]));
    const top2Share = (Math.abs(farklar[sortedFamByAbsFark[0]]) + Math.abs(farklar[sortedFamByAbsFark[1]])) / Math.max(1e-9, Math.abs(toplamSkorFarki));

    let siniflandirma: string;
    if (winnerF.missingCriticalFamilies.length > 0) {
      siniflandirma = `A (ham veri hatasi: kazananda ${winnerF.missingCriticalFamilies.join(",")} tamamen gozlemsiz)`;
    } else if (top2Share > 0.6 && Math.abs(toplamSkorFarki) > 1.0) {
      siniflandirma = `B (${sortedFamByAbsFark[0]}+${sortedFamByAbsFark[1]} toplam farkin %${(top2Share*100).toFixed(0)}'ini acikliyor, kazanani geriye itmis)`;
    } else if (Math.abs(toplamSkorFarki) < 1.5 && pT5 < 0.10) {
      siniflandirma = `C (toplam skor farki ILIMLI=${toplamSkorFarki.toFixed(2)} ama T=5'te bile olasilik hala %${(pT5*100).toFixed(1)} — olasilik asiri keskinlesmis)`;
    } else {
      siniflandirma = `D (mevcut verilerle tek nedene indirilemiyor — skor farki=${toplamSkorFarki.toFixed(2)}, dagitik)`;
    }

    console.log(`\n--- ${r.date.slice(0,10)} ${r.raceId.slice(0,8)} | Kazanan: ${r.winnerName}(#${r.winnerNo}) | Favori(yanlis): ${r.favName}(#${r.favNo}) ---`);
    console.log(`  Kazanan olasiligi: %${(r.winnerProb*100).toFixed(2)}   Favori olasiligi: %${(r.favProb*100).toFixed(2)}`);
    console.log(`  Sicaklik testi (siralama SABIT): T=1(gercek)=%${(pT1*100).toFixed(2)}  T=3=%${(pT3*100).toFixed(2)}  T=5=%${(pT5*100).toFixed(2)}`);
    const famLine = FAMILIES.map((f) => `${f}=${farklar[f].toFixed(3)}`).join(" ");
    console.log(`  Aile Farklari (favori-kazanan): ${famLine}`);
    console.log(`  Toplam Skor Farki: ${toplamSkorFarki.toFixed(3)}  (10 aile toplami: ${sumFark.toFixed(3)}, tutarlilik-hatasi: ${tutarlilikHatasi.toExponential(2)})`);
    console.log(`  SINIFLANDIRMA: ${siniflandirma}`);

    allDetailRows.push({ raceId: r.raceId, date: r.date, winner: r.winnerName, favorite: r.favName, winnerProb: r.winnerProb, favProb: r.favProb, farklar, toplamSkorFarki, pT1, pT3, pT5, siniflandirma });
  }

  fs.writeFileSync("C:/tmp/v1-15-hata-10-aile-detay.json", JSON.stringify(allDetailRows, null, 2));
  console.log(`\n\nDetay dosyasi: C:/tmp/v1-15-hata-10-aile-detay.json`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
