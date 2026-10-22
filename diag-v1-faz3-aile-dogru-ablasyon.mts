// FAZ 3 — DÜZELTİLMİŞ 10 AİLE ABLASYON ÇALIŞMASI (kullanıcı talimatı, 2026-10-22, "son
// çalışma, hatasız"). Önceki FAZ 2 HATASI: aile kodlarını observed=false yaparak
// toModelVector'ı YENİDEN çalıştırmak, modelin HİÇ eğitilmediği bir toplu-eksiklik
// senaryosunu (yapay eksik-veri cezası) tetikliyordu.
//
// DÜZELTME: her runner için GERÇEK (ablasyonsuz) explainRunner() BİR KEZ çalıştırılır —
// gerçek observed durumlarıyla, gerçek rawValue'larla. Aile ablasyonu, bu GERÇEK
// satırlardan ilgili ailenin (+ o aileyi içeren ilişkilerin) scoreContribution VE
// missingIndicatorContribution toplamını ARİTMETİK olarak toplam skordan ÇIKARMAKTIR —
// hiçbir vektör yeniden kurulmaz, hiçbir yeni "eksik" bayrağı oluşturulmaz, başka
// hiçbir ailenin observed durumu değişmez. Sabit-katsayılı bir çıkarma testidir,
// yeniden eğitim DEĞİLDİR.
import fs from "node:fs";
import { explainRunner, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { softmax } from "./src/lib/v5461/math";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { db } from "./src/lib/db";
import type { SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

// --- Doğrulanmış aile eşlemesi (bu turda kaynak koddan TEK TEK karşılaştırıldı) ---
const FAMILY_TO_STANDARD: Record<string, string> = {
  GEN_PEDIGRI: "GEN", HIZ: "YET", SINIF: "YET", FORM: "FRM",
  PIST_MESAFE_ZEMIN: "PMZ", TMP: "TMP", TEMPO_STYLE: "TMP",
  JOKEY: "JOK", JOK: "JOK", ANT: "ANT", KILO: "KIL", DAV: "DAV", RAK: "RAK",
};
// DOĞRULANMIŞ TUTARSIZLIK (bu turda bulundu): KULVAR_01_HAM, trainable-features.ts'in
// önbelleğinde family="INTERACTION" taşıyor (computeKulvar01'in kendi ham etiketi),
// ama CANLI unified-family-engine.ts onu AÇIKÇA entry("KULVAR_01_HAM","TMP",...) ile
// TMP'ye bağlıyor — canlı/tahmin motoru kaynak kabul edilir (kullanıcı talimatı: gerçek
// kaynak unified-family-engine.ts), bu yüzden burada TMP'ye ZORLANIR.
const CODE_FAMILY_OVERRIDE: Record<string, string> = { KULVAR_01_HAM: "TMP" };

// 8 aktif ilişki — kaynak formüllerle (trainable-features.ts satır 190-229) TEK TEK
// doğrulandı, hepsi birebir eşleşti.
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
const FAMILY_LABEL: Record<string, string> = {
  GEN: "Genetik ve Pedigri", YET: "Yetenek, Hız ve Sınıf", FRM: "Güncel Form ve Kondisyon",
  PMZ: "Pist, Mesafe ve Zemin", TMP: "Yarış Stili, Tempo ve Kulvar", JOK: "Jokey Performansı",
  ANT: "Antrenör Performansı", KIL: "Kilo ve Dayanıklılık", DAV: "Takı ve Yarış Davranışı",
  RAK: "Rakip Gücü ve Göreli Üstünlük",
};

function resolveBaseFamily(code: string, rawFamily: string): string | null {
  if (code in CODE_FAMILY_OVERRIDE) return CODE_FAMILY_OVERRIDE[code];
  return FAMILY_TO_STANDARD[rawFamily] ?? null;
}

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
// Kullanıcının bu turda istediği 4 mesafe bandı (öncekinden FARKLI — 3 değil 4 bant)
function mesafeBandi(m: number | null): string {
  if (m == null) return "BİLİNMİYOR";
  if (m <= 1400) return "≤1400";
  if (m <= 1800) return "1401-1800";
  if (m <= 2200) return "1801-2200";
  return ">2200";
}
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

type RaceRow = {
  id: string; set: "TRAIN" | "HOLDOUT" | "EK"; aile: string; altSeviye: string;
  surface: string; mesafeBand: number; mesafe: number; breed: string; saha: number; winnerNo: number | null;
};
type FamilyResult = {
  raceId: string; set: string; aile: string; altSeviye: string; surface: string; mesafeBand: string; breed: string; saha: number;
  family: string;
  dogrudanKatki: number; iliskiKatki: number; // yalnız KAZANAN icin ayrica raporlanir
  winnerRankFull: number; winnerRankAblated: number;
  top1Full: boolean; top1Ablated: boolean; top3Full: boolean; top3Ablated: boolean;
  llFull: number; llAblated: number;
};

async function main() {
  const lock = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/ab-split-locked.json", "utf8")) as { trainRaceIds: string[]; holdoutRaceIds: string[] };
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] }>;
  const model = loadTrainedV1Model();
  const trainedCodes = new Set([...model.stats.keys()]);

  const trainSet = new Set(lock.trainRaceIds);
  const holdoutSet = new Set(lock.holdoutRaceIds);
  const allIds = Object.keys(cache);
  console.log(`Önbellekte toplam ${allIds.length} yarış. TRAIN(fit'te kullanıldı)=${lock.trainRaceIds.length} HOLDOUT(A/B testinde kullanıldı, kör DEĞİL)=${lock.holdoutRaceIds.length}`);

  const metas = await db.race.findMany({
    where: { id: { in: allIds } },
    select: { id: true, classType: true, surface: true, distance: true, breed: true },
  });
  const metaById = new Map(metas.map((m) => [m.id, m]));

  const raceRows: RaceRow[] = [];
  for (const id of allIds) {
    const c = cache[id];
    const m = metaById.get(id);
    if (!m || c.winnerNo == null) continue;
    raceRows.push({
      id, set: trainSet.has(id) ? "TRAIN" : holdoutSet.has(id) ? "HOLDOUT" : "EK",
      aile: aile(m.classType), altSeviye: m.classType ?? "—", surface: m.surface,
      mesafeBand: 0, mesafe: m.distance, breed: m.breed, saha: c.runners.length, winnerNo: c.winnerNo,
    } as unknown as RaceRow);
  }
  // mesafeBand'i string olarak set et (tip hatasindan kacinmak icin ayri adim)
  for (const r of raceRows) (r as unknown as { mesafeBand: string }).mesafeBand = mesafeBandi(r.mesafe);

  console.log(`İşlenecek (kazananı bilinen) yarış: ${raceRows.length}`);
  console.log(`  TRAIN: ${raceRows.filter((r) => r.set === "TRAIN").length}  HOLDOUT: ${raceRows.filter((r) => r.set === "HOLDOUT").length}  EK: ${raceRows.filter((r) => r.set === "EK").length}`);

  const results: FamilyResult[] = [];
  // KULVAR_01_HAM override'inin GERCEKTEN her aile sonucuna katildigini dogrulamak icin sayac
  let kulvarOverrideSayisi = 0;

  for (const row of raceRows) {
    const c = cache[row.id];
    // Her runner icin GERCEK (ablasyonsuz) aciklama + toplam skor — TEK KEZ hesaplanir.
    const runnerExplains = c.runners.map((r) => {
      const fv = { raceId: row.id, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors };
      const ex = explainRunner(fv, model);
      return { no: r.no, name: r.name, rows: ex.rows, totalScore: ex.totalScore };
    });
    const fullProbs = softmax(runnerExplains.map((r) => r.totalScore));
    const fullRanked = runnerExplains.map((r, i) => ({ no: r.no, p: fullProbs[i] })).sort((a, b) => b.p - a.p);
    const fullWinnerIdx = fullRanked.findIndex((r) => r.no === row.winnerNo);
    if (fullWinnerIdx < 0) continue;
    const fieldSize = fullRanked.length;

    for (const fam of FAMILIES) {
      const adjustedScores = runnerExplains.map((r) => {
        let dogrudan = 0, iliski = 0;
        for (const row2 of r.rows) {
          if (!trainedCodes.has(row2.code)) continue;
          const base = resolveBaseFamily(row2.code, row2.family ?? "");
          const contrib = row2.scoreContribution + row2.missingIndicatorContribution;
          if (base === fam) {
            dogrudan += contrib;
            if (row2.code === "KULVAR_01_HAM") kulvarOverrideSayisi++;
          } else {
            const comps = INTERACTION_COMPONENTS[row2.code];
            if (comps && comps.includes(fam)) iliski += contrib;
          }
        }
        return { no: r.no, adjustedScore: r.totalScore - dogrudan - iliski, dogrudan, iliski };
      });
      const adjProbs = softmax(adjustedScores.map((a) => a.adjustedScore));
      const adjRanked = adjustedScores.map((a, i) => ({ no: a.no, p: adjProbs[i] })).sort((a, b) => b.p - a.p);
      const adjWinnerIdx = adjRanked.findIndex((r) => r.no === row.winnerNo);
      const winnerAdj = adjustedScores.find((a) => a.no === row.winnerNo)!;

      results.push({
        raceId: row.id, set: row.set, aile: row.aile, altSeviye: row.altSeviye, surface: row.surface,
        mesafeBand: row.mesafeBand as unknown as string, breed: row.breed, saha: fieldSize, family: fam,
        dogrudanKatki: winnerAdj.dogrudan, iliskiKatki: winnerAdj.iliski,
        winnerRankFull: fullWinnerIdx + 1, winnerRankAblated: adjWinnerIdx + 1,
        top1Full: fullWinnerIdx === 0, top1Ablated: adjWinnerIdx === 0,
        top3Full: fullWinnerIdx < 3, top3Ablated: adjWinnerIdx < 3,
        llFull: logLoss(fullRanked[fullWinnerIdx].p), llAblated: adjWinnerIdx >= 0 ? logLoss(adjRanked[adjWinnerIdx].p) : logLoss(1e-9),
      });
    }
  }

  console.log(`\nKULVAR_01_HAM override kaç kez TMP ablasyonuna dahil edildi (doğrulama): ${kulvarOverrideSayisi}`);
  fs.writeFileSync("C:/tmp/faz3-raw-results.json", JSON.stringify(results, null, 0));
  console.log(`Ham sonuç: C:/tmp/faz3-raw-results.json (${results.length} satır)`);

  // === TABLO A: Aile (kaba) x 10 Sinyal Ailesi, yalnız BAĞIMSIZ (HOLDOUT+EK) ===
  const indep = results.filter((r) => r.set !== "TRAIN");
  const yarisAileleri = [...new Set(indep.map((r) => r.aile))].sort();

  console.log(`\n=== TABLO A — Yarış tipi × 10 Aile (ΔLL, yalnız BAĞIMSIZ n gösterimli) ===`);
  const header = "Yarış tipi".padEnd(14) + "n".padStart(5) + FAMILIES.map((f) => f.padStart(9)).join("");
  console.log(header);
  for (const ya of yarisAileleri) {
    const sub = indep.filter((r) => r.aile === ya);
    const n = new Set(sub.map((r) => r.raceId)).size;
    const cells = FAMILIES.map((fam) => {
      const famSub = sub.filter((r) => r.family === fam);
      if (famSub.length < 15) return "VYET".padStart(9);
      const llFull = famSub.reduce((a, r) => a + r.llFull, 0) / famSub.length;
      const llAbl = famSub.reduce((a, r) => a + r.llAblated, 0) / famSub.length;
      return (llAbl - llFull).toFixed(3).padStart(9);
    });
    console.log(ya.padEnd(14) + String(n).padStart(5) + cells.join(""));
  }
  console.log("(VYET = VERİ YETERSİZ, n<15)");

  // === TABLO C benzeri: her aile x yarış tipi icin Top1/Top3/LL detayli ===
  console.log(`\n=== TABLO C — Açıklamalı (yalnız BAĞIMSIZ, n>=15) ===`);
  console.log("Yarış tipi".padEnd(12), "Aile".padEnd(5), "n".padStart(5), "Top1(var→yok)".padStart(16), "Top3(var→yok)".padStart(16), "ΔLL".padStart(8), "KazSıraFarkı".padStart(13));
  for (const ya of yarisAileleri) {
    for (const fam of FAMILIES) {
      const sub = indep.filter((r) => r.aile === ya && r.family === fam);
      if (sub.length < 15) continue;
      const n = sub.length;
      const t1f = sub.filter((r) => r.top1Full).length, t1a = sub.filter((r) => r.top1Ablated).length;
      const t3f = sub.filter((r) => r.top3Full).length, t3a = sub.filter((r) => r.top3Ablated).length;
      const llFull = sub.reduce((a, r) => a + r.llFull, 0) / n;
      const llAbl = sub.reduce((a, r) => a + r.llAblated, 0) / n;
      const siraFarki = sub.reduce((a, r) => a + (r.winnerRankAblated - r.winnerRankFull), 0) / n;
      console.log(
        ya.padEnd(12), fam.padEnd(5), String(n).padStart(5),
        `${t1f}→${t1a}`.padStart(16), `${t3f}→${t3a}`.padStart(16),
        (llAbl - llFull).toFixed(3).padStart(8), (siraFarki >= 0 ? "+" : "") + siraFarki.toFixed(2).padStart(12)
      );
    }
  }

  // === Genel (TRAIN vs BAGIMSIZ) karsilastirma — overfitting kontrolu ===
  console.log(`\n=== GENEL: TRAIN (iç-örneklem) vs BAĞIMSIZ karşılaştırması ===`);
  for (const fam of FAMILIES) {
    const trainSub = results.filter((r) => r.set === "TRAIN" && r.family === fam);
    const indepSub = indep.filter((r) => r.family === fam);
    const trLL = trainSub.reduce((a, r) => a + (r.llAblated - r.llFull), 0) / trainSub.length;
    const inLL = indepSub.reduce((a, r) => a + (r.llAblated - r.llFull), 0) / indepSub.length;
    console.log(`  ${FAMILY_LABEL[fam].padEnd(28)} TRAIN ΔLL=${trLL.toFixed(3).padStart(7)}  BAĞIMSIZ ΔLL=${inLL.toFixed(3).padStart(7)}  n(train)=${trainSub.length/10} n(bağımsız)=${indepSub.length/10}`);
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
