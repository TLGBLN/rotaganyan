// ROTAGANYAN V1.0 — YET AİLESİ (HIZ_01, SINIF_01) KÖK NEDEN İNCELEMESİ (SALT-OKUNUR).
// Kullanici talimati (2026-10-22): "HIZ_01'i degistirmiyoruz. Once hatanin nerede oldugunu
// tespit ediyoruz." Hicbir model egitimi/katsayi degisikligi YOK, yalniz MEVCUT (donmus)
// production modelin gercek ciktilarini (scoreRace/explainRunner) inceler.
import fs from "node:fs";
import { scoreRace, explainRunner, type TrainingRace } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import type { RunnerFeatureVector, SignalEntry } from "./src/lib/motor-v1/engine/feature-vector";

type CacheRace = { raceId: string; date: string; winnerNo: number | null; runners: { no: number; name: string; vectors: SignalEntry[] }[] };

function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

async function main() {
  const cache = JSON.parse(fs.readFileSync("C:/tmp/existing-600-full-feature-cache.json", "utf8")) as Record<string, CacheRace>;
  const model = loadTrainedV1Model();

  type RaceRow = {
    raceId: string; date: string; n: number;
    winnerNo: number; winnerName: string; winnerProb: number; ll: number;
    favNo: number; favName: string; favProb: number; favIsWinner: boolean;
    winnerYet: { hiz01: number | null; hiz01Obs: boolean; sinif01: number | null; sinif01Obs: boolean; contrib: number };
    favYet: { hiz01: number | null; hiz01Obs: boolean; sinif01: number | null; sinif01Obs: boolean; contrib: number };
  };
  const rows: RaceRow[] = [];

  for (const raceId of Object.keys(cache)) {
    const race = cache[raceId];
    if (race.winnerNo == null || race.runners.length < 2) continue;
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const scored = scoreRace(vectors, model);
    const winIdx = scored.findIndex((s) => s.no === race.winnerNo);
    if (winIdx < 0) continue;
    const ranked = [...scored].sort((a, b) => b.probability - a.probability);
    const fav = ranked[0];

    const yetOf = (no: number) => {
      const fv = vectors.find((v) => v.no === no)!;
      const { rows: er } = explainRunner(fv, model);
      const hiz = er.find((r) => r.code === "HIZ_01");
      const sinif = er.find((r) => r.code === "SINIF_01");
      const contrib = (hiz ? hiz.scoreContribution + hiz.missingIndicatorContribution : 0) + (sinif ? sinif.scoreContribution + sinif.missingIndicatorContribution : 0);
      return { hiz01: hiz?.rawValue ?? null, hiz01Obs: !!hiz?.observed, sinif01: sinif?.rawValue ?? null, sinif01Obs: !!sinif?.observed, contrib };
    };

    rows.push({
      raceId, date: race.date, n: race.runners.length,
      winnerNo: race.winnerNo, winnerName: race.runners.find((r) => r.no === race.winnerNo)?.name ?? "?",
      winnerProb: scored[winIdx].probability, ll: logLoss(scored[winIdx].probability),
      favNo: fav.no, favName: fav.name, favProb: fav.probability, favIsWinner: fav.no === race.winnerNo,
      winnerYet: yetOf(race.winnerNo), favYet: yetOf(fav.no),
    });
  }
  console.log(`Islenen yaris: ${rows.length}`);

  // ====== SORU 1: HAM VERİ ÖRNEKLERİ (rastgele 5 yarıştan HIZ_01/SINIF_01 gözlemlenebilirlik) ======
  const obsHiz = rows.filter((r) => r.winnerYet.hiz01Obs).length;
  const obsSinif = rows.filter((r) => r.winnerYet.sinif01Obs).length;
  console.log(`\n=== SORU 1: HAM VERİ KAPSAMI ===`);
  console.log(`Kazananlarda HIZ_01 gözlemli: ${obsHiz}/${rows.length} (%${(100*obsHiz/rows.length).toFixed(1)})`);
  console.log(`Kazananlarda SINIF_01 gözlemli: ${obsSinif}/${rows.length} (%${(100*obsSinif/rows.length).toFixed(1)})`);

  // ====== SORU 2: SİNYAL KATKISI — kazananlar vs yanlış favoriler ======
  const wrongFavRows = rows.filter((r) => !r.favIsWinner);
  const correctFavRows = rows.filter((r) => r.favIsWinner);
  const avgContribAllWinners = rows.reduce((a, r) => a + r.winnerYet.contrib, 0) / rows.length;
  const avgContribWrongFav = wrongFavRows.reduce((a, r) => a + r.favYet.contrib, 0) / wrongFavRows.length;
  const avgContribCorrectFav = correctFavRows.reduce((a, r) => a + r.favYet.contrib, 0) / correctFavRows.length;
  const avgContribWinnerInWrongFavRace = wrongFavRows.reduce((a, r) => a + r.winnerYet.contrib, 0) / wrongFavRows.length;
  console.log(`\n=== SORU 2: SİNYAL KATKISI (YET = HIZ_01+SINIF_01 skor katkısı) ===`);
  console.log(`TÜM kazananların ortalama YET katkısı: ${avgContribAllWinners.toFixed(3)}`);
  console.log(`Yanlış-favori yarışlarında (n=${wrongFavRows.length}) FAVORİNİN (kaybeden) ort. YET katkısı: ${avgContribWrongFav.toFixed(3)}`);
  console.log(`Yanlış-favori yarışlarında GERÇEK KAZANANIN ort. YET katkısı: ${avgContribWinnerInWrongFavRace.toFixed(3)}`);
  console.log(`Doğru-favori yarışlarında (n=${correctFavRows.length}) FAVORİNİN (=kazanan) ort. YET katkısı: ${avgContribCorrectFav.toFixed(3)}`);
  console.log(`Yanlış-favori oranı: ${wrongFavRows.length}/${rows.length} (%${(100*wrongFavRows.length/rows.length).toFixed(1)})`);

  // ====== SORU 3: OLASILIK ÖLÇEKLENDİRMESİ — YET'siz skor ile kalibrasyon farkı ======
  // (kullanıcının onayladığı güvenli yöntem: GERÇEK, zaten hesaplanmış katkıyı toplam
  // skordan arimetik olarak ÇIKAR, yeniden softmax uygula — vektör yeniden inşa ETME)
  let llWithYet = 0, llWithoutYet = 0, nCalib = 0;
  for (const raceId of Object.keys(cache)) {
    const race = cache[raceId];
    if (race.winnerNo == null || race.runners.length < 2) continue;
    const vectors: RunnerFeatureVector[] = race.runners.map((r) => ({ raceId: race.raceId, no: r.no, name: r.name, tjkAtId: null, jockey: null, signals: r.vectors }));
    const winIdxCheck = vectors.findIndex((v) => v.no === race.winnerNo);
    if (winIdxCheck < 0) continue;
    const explains = vectors.map((v) => explainRunner(v, model));
    const scoresWith = explains.map((e) => e.totalScore);
    const scoresWithout = explains.map((e) => {
      const hiz = e.rows.find((r) => r.code === "HIZ_01");
      const sinif = e.rows.find((r) => r.code === "SINIF_01");
      const yetTotal = (hiz ? hiz.scoreContribution + hiz.missingIndicatorContribution : 0) + (sinif ? sinif.scoreContribution + sinif.missingIndicatorContribution : 0);
      return e.totalScore - yetTotal;
    });
    const softmax = (s: number[]) => { const m = Math.max(...s); const ex = s.map((x) => Math.exp(x - m)); const sum = ex.reduce((a,b)=>a+b,0); return ex.map((x) => x/sum); };
    const pWith = softmax(scoresWith), pWithout = softmax(scoresWithout);
    llWithYet += logLoss(pWith[winIdxCheck]);
    llWithoutYet += logLoss(pWithout[winIdxCheck]);
    nCalib++;
  }
  console.log(`\n=== SORU 3: YET-SİZ ABLASYON (gerçek katkı arimetik çıkarma, n=${nCalib}) ===`);
  console.log(`LogLoss (YET DAHİL, mevcut model): ${(llWithYet/nCalib).toFixed(4)}`);
  console.log(`LogLoss (YET ÇIKARILMIŞ, aynı diğer katkılar): ${(llWithoutYet/nCalib).toFixed(4)}`);
  console.log(`Fark: ${((llWithoutYet-llWithYet)/nCalib).toFixed(4)} (negatifse YET'in varlığı FAYDALI, pozitifse ZARARLI)`);

  // ====== EN BÜYÜK 15 LOGLOSS HATASI — TABLO ======
  const worst = [...rows].sort((a, b) => b.ll - a.ll).slice(0, 15);
  console.log(`\n=== EN BÜYÜK 15 LOGLOSS HATASI ===`);
  console.log(`Yarış | Kazanan | YET Ham Veri (HIZ01/SINIF01) | YET Skor Katkısı | Tahmin Olasılığı | Favori (model) | Hatanın Olası Kaynağı`);
  for (const r of worst) {
    const hizStr = r.winnerYet.hiz01Obs ? r.winnerYet.hiz01!.toFixed(1) : "GÖZLEMSİZ";
    const sinifStr = r.winnerYet.sinif01Obs ? r.winnerYet.sinif01!.toFixed(1) : "GÖZLEMSİZ";
    let tani = "";
    if (!r.winnerYet.hiz01Obs && !r.winnerYet.sinif01Obs) tani = "HAM VERİ: kazananın YET'i tamamen gözlemsiz (ilk start/kısa geçmiş)";
    else if (r.winnerYet.contrib < -0.3 && r.favYet.contrib > 0.3) tani = "SİNYAL KATKISI: YET, kazanana güçlü NEGATİF, (yanlış) favoriye güçlü POZİTİF katkı veriyor";
    else if (Math.abs(r.winnerYet.contrib) < 0.15 && r.winnerProb < 0.15) tani = "OLASILIK ÖLÇEKLENDİRME: YET katkısı ÖLÇÜLÜ ama model genel olasılığı çok düşük atamış (başka aile/ölçek sorunu)";
    else tani = "BELİRSİZ — tek aileyle açıklanamıyor, çoklu katkı karışımı";
    console.log(`${r.date} ${r.raceId.slice(0,8)} | ${r.winnerName}(#${r.winnerNo}) | HIZ=${hizStr} SINIF=${sinifStr} | ${r.winnerYet.contrib.toFixed(3)} | %${(r.winnerProb*100).toFixed(1)} | ${r.favName}(#${r.favNo},%${(r.favProb*100).toFixed(1)}) | ${tani}`);
  }

  fs.writeFileSync("C:/tmp/v1-yet-kok-neden-rows.json", JSON.stringify(rows, null, 0));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
