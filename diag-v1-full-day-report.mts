// GERİYE DÖNÜK İNCELEME (kullanıcı talimatı, 2026-10-21): "Yarış sonuçları bilindiği için bu
// çalışmayı geriye dönük inceleme olarak raporla; kör OOS başarı istatistiğine ekleme."
// Mevcut V1.0 ve deneysel (kırpılmış) artefaktlar DEĞİŞTİRİLMEZ, yeniden eğitim YAPILMAZ.
// Bursa (6) + İstanbul (10) = 16 yarış, hepsi bugün (2026-10-21) sonuçlanmış.
import fs from "node:fs";
import { computeUnifiedFamiliesForRace } from "./src/lib/motor-v1/engine/unified-family-engine";
import { buildScorableVector } from "./src/lib/motor-v1/engine/predict-v1";
import { scoreRace, explainRunner, type FittedModel } from "./src/lib/motor-v1/engine/training";
import { loadTrainedV1Model } from "./src/lib/motor-v1/engine/load-trained-model";
import { db } from "./src/lib/db";

const RACES: { hip: string; no: number; id: string }[] = [
  { hip: "Bursa", no: 1, id: "cmvg7su87000308jpe65z4rod" },
  { hip: "Bursa", no: 2, id: "cmvg7sx5h000n08jp758qhqlp" },
  { hip: "Bursa", no: 3, id: "cmvg7t0bd001708jpc6izctlv" },
  { hip: "Bursa", no: 4, id: "cmvg7t2wu001o08jprukqesuf" },
  { hip: "Bursa", no: 5, id: "cmvg7t5sn002708jpq7fsg52k" },
  { hip: "Bursa", no: 6, id: "cmvg7t7it002j08jpslswccio" },
  { hip: "İstanbul", no: 1, id: "cmvg7thkn004008jp0owphx4m" },
  { hip: "İstanbul", no: 2, id: "cmvg7tl0i004n08jpyhjut4q3" },
  { hip: "İstanbul", no: 3, id: "cmvg7to6b005208jp0k9w3l7b" },
  { hip: "İstanbul", no: 4, id: "cmvg7tqgv005f08jpju1csgvx" },
  { hip: "İstanbul", no: 5, id: "cmvg7ttm8006008jp1ksekl1s" },
  { hip: "İstanbul", no: 6, id: "cmvg7txcb006p08jpdl7zajak" },
  { hip: "İstanbul", no: 7, id: "cmvg7u1xi007l08jp3alpi27f" },
  { hip: "İstanbul", no: 8, id: "cmvg7u531008608jp1vytvu35" },
  { hip: "İstanbul", no: 9, id: "cmvg7u7di008l08jpzfnhiigy" },
  { hip: "İstanbul", no: 10, id: "cmvg7uais009608jplkzy6icc" },
];

async function withRetry<T>(fn: () => Promise<T>, attempts = 4, delayMs = 3000): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); } catch (e) { lastErr = e; if (i < attempts - 1) await new Promise((r) => setTimeout(r, delayMs)); }
  }
  throw lastErr;
}
function logLoss(p: number): number { return -Math.log(Math.max(p, 1e-9)); }

type RaceReport = {
  hip: string; no: number; fieldSize: number; winnerNo: number | null; winnerName: string | null;
  currTop: { no: number; name: string; p: number } | null; expTop: { no: number; name: string; p: number } | null;
  currWinnerRank: number | null; currWinnerP: number | null;
  expWinnerRank: number | null; expWinnerP: number | null;
  topSignalDeltas: { code: string; family: string | null; currContrib: number; expContrib: number; delta: number }[];
};

async function main() {
  const currentModel = loadTrainedV1Model();
  const exp = JSON.parse(fs.readFileSync("src/lib/motor-v1/artifacts/experimental-winsorized-v1.json", "utf8"));
  const clipBounds = new Map<string, { p1: number; p99: number }>();
  for (const c of exp.clippedCodes) clipBounds.set(c.code, { p1: c.p1, p99: c.p99 });
  const expModel: FittedModel = {
    beta: exp.beta, names: exp.names,
    stats: new Map(Object.entries(exp.muSigma).map(([k, v]) => [k, v as { mu: number; sigma: number; nObserved: number }])),
    nRacesUsed: exp.nTrainRaces, nRacesSkipped: exp.nRacesSkipped, opts: exp.fitOpts,
  };

  const reports: RaceReport[] = [];
  const basarisiz: string[] = [];

  for (const race of RACES) {
    try {
      const result = await withRetry(() => db.result.findUnique({ where: { raceId: race.id }, select: { winnerNos: true } }));
      const winnerNo = result?.winnerNos?.[0] ?? null;

      const unified = await withRetry(() => computeUnifiedFamiliesForRace(race.id, currentModel));
      if (unified.length === 0) { console.log(`\n=== ${race.hip} K${race.no}: saha bos ===`); continue; }
      const vectorsRaw = unified.map((r) => buildScorableVector(race.id, r));
      const vectorsClipped = vectorsRaw.map((v) => ({
        ...v,
        signals: v.signals.map((s) => {
          if (!s.observed || s.rawValue == null) return s;
          const b = clipBounds.get(s.code);
          if (!b) return s;
          const clipped = Math.min(Math.max(s.rawValue, b.p1), b.p99);
          return clipped === s.rawValue ? s : { ...s, rawValue: clipped };
        }),
      }));

      const currRanked = [...scoreRace(vectorsRaw, currentModel)].sort((a, b) => b.probability - a.probability);
      const expRanked = [...scoreRace(vectorsClipped, expModel)].sort((a, b) => b.probability - a.probability);

      const winnerName = unified.find((u) => u.no === winnerNo)?.name ?? null;
      const currWinnerIdx = winnerNo != null ? currRanked.findIndex((r) => r.no === winnerNo) : -1;
      const expWinnerIdx = winnerNo != null ? expRanked.findIndex((r) => r.no === winnerNo) : -1;

      let topSignalDeltas: RaceReport["topSignalDeltas"] = [];
      if (winnerNo != null) {
        const vRaw = vectorsRaw.find((v) => v.no === winnerNo);
        const vClip = vectorsClipped.find((v) => v.no === winnerNo);
        if (vRaw && vClip) {
          const currRows = explainRunner(vRaw, currentModel).rows;
          const expRows = explainRunner(vClip, expModel).rows;
          const byCode = new Map<string, { family: string | null; currContrib: number; expContrib: number }>();
          for (const r of currRows) byCode.set(r.code, { family: r.family, currContrib: r.scoreContribution + r.missingIndicatorContribution, expContrib: 0 });
          for (const r of expRows) {
            const e = byCode.get(r.code);
            if (e) e.expContrib = r.scoreContribution + r.missingIndicatorContribution;
            else byCode.set(r.code, { family: r.family, currContrib: 0, expContrib: r.scoreContribution + r.missingIndicatorContribution });
          }
          topSignalDeltas = [...byCode.entries()]
            .map(([code, v]) => ({ code, family: v.family, currContrib: v.currContrib, expContrib: v.expContrib, delta: v.expContrib - v.currContrib }))
            .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 5);
        }
      }

      const rep: RaceReport = {
        hip: race.hip, no: race.no, fieldSize: currRanked.length, winnerNo, winnerName,
        currTop: currRanked[0] ? { no: currRanked[0].no, name: currRanked[0].name, p: currRanked[0].probability } : null,
        expTop: expRanked[0] ? { no: expRanked[0].no, name: expRanked[0].name, p: expRanked[0].probability } : null,
        currWinnerRank: currWinnerIdx >= 0 ? currWinnerIdx + 1 : null,
        currWinnerP: currWinnerIdx >= 0 ? currRanked[currWinnerIdx].probability : null,
        expWinnerRank: expWinnerIdx >= 0 ? expWinnerIdx + 1 : null,
        expWinnerP: expWinnerIdx >= 0 ? expRanked[expWinnerIdx].probability : null,
        topSignalDeltas,
      };
      reports.push(rep);

      console.log(`\n=== ${rep.hip} K${rep.no} (saha=${rep.fieldSize}) — KAZANAN: #${rep.winnerNo} ${rep.winnerName} ===`);
      console.log(`  ÜRETİM:   favori #${rep.currTop?.no} ${rep.currTop?.name} (%${((rep.currTop?.p ?? 0) * 100).toFixed(1)}) | kazananın sırası=${rep.currWinnerRank}/${rep.fieldSize} (P=${((rep.currWinnerP ?? 0) * 100).toFixed(1)}%)`);
      console.log(`  DENEYSEL: favori #${rep.expTop?.no} ${rep.expTop?.name} (%${((rep.expTop?.p ?? 0) * 100).toFixed(1)}) | kazananın sırası=${rep.expWinnerRank}/${rep.fieldSize} (P=${((rep.expWinnerP ?? 0) * 100).toFixed(1)}%)`);
      console.log(`  Sıra değişimi (kazanan): ${(rep.currWinnerRank ?? 0) - (rep.expWinnerRank ?? 0) >= 0 ? "+" : ""}${(rep.currWinnerRank ?? 0) - (rep.expWinnerRank ?? 0)}`);
      console.log(`  Kazanan için en büyük sinyal-katkı farkları (deneysel-üretim):`);
      rep.topSignalDeltas.forEach((d) => console.log(`    ${d.code.padEnd(20)} fam=${(d.family ?? "?").padEnd(13)} üretim=${d.currContrib.toFixed(3).padStart(7)} deneysel=${d.expContrib.toFixed(3).padStart(7)} fark=${d.delta >= 0 ? "+" : ""}${d.delta.toFixed(3)}`));
    } catch (e) {
      console.log(`\n=== ${race.hip} K${race.no}: KALICI HATA — ${e instanceof Error ? e.message : e} ===`);
      basarisiz.push(`${race.hip} K${race.no}`);
    }
  }

  function aggregate(label: string, subset: RaceReport[]) {
    const n = subset.filter((r) => r.winnerNo != null).length;
    const currTop1 = subset.filter((r) => r.currWinnerRank === 1).length;
    const expTop1 = subset.filter((r) => r.expWinnerRank === 1).length;
    const currTop3 = subset.filter((r) => r.currWinnerRank != null && r.currWinnerRank <= 3).length;
    const expTop3 = subset.filter((r) => r.expWinnerRank != null && r.expWinnerRank <= 3).length;
    const currTop6 = subset.filter((r) => r.currWinnerRank != null && r.currWinnerRank <= 6).length;
    const expTop6 = subset.filter((r) => r.expWinnerRank != null && r.expWinnerRank <= 6).length;
    const currLL = subset.reduce((a, r) => a + (r.currWinnerP != null ? logLoss(r.currWinnerP) : 0), 0) / n;
    const expLL = subset.reduce((a, r) => a + (r.expWinnerP != null ? logLoss(r.expWinnerP) : 0), 0) / n;
    const currAvgRank = subset.reduce((a, r) => a + (r.currWinnerRank ?? 0), 0) / n;
    const expAvgRank = subset.reduce((a, r) => a + (r.expWinnerRank ?? 0), 0) / n;
    const improved = subset.filter((r) => r.currWinnerRank != null && r.expWinnerRank != null && r.expWinnerRank < r.currWinnerRank).length;
    const worsened = subset.filter((r) => r.currWinnerRank != null && r.expWinnerRank != null && r.expWinnerRank > r.currWinnerRank).length;
    const unchanged = subset.filter((r) => r.currWinnerRank != null && r.expWinnerRank != null && r.expWinnerRank === r.currWinnerRank).length;

    console.log(`\n\n=== ${label} ÖZETİ (n=${n}) ===`);
    console.log(`Top-1 isabet:  ÜRETİM=${currTop1}/${n} (%${((currTop1/n)*100).toFixed(1)})   DENEYSEL=${expTop1}/${n} (%${((expTop1/n)*100).toFixed(1)})`);
    console.log(`Top-3 isabet:  ÜRETİM=${currTop3}/${n} (%${((currTop3/n)*100).toFixed(1)})   DENEYSEL=${expTop3}/${n} (%${((expTop3/n)*100).toFixed(1)})`);
    console.log(`Top-6 isabet:  ÜRETİM=${currTop6}/${n} (%${((currTop6/n)*100).toFixed(1)})   DENEYSEL=${expTop6}/${n} (%${((expTop6/n)*100).toFixed(1)})`);
    console.log(`LogLoss:       ÜRETİM=${currLL.toFixed(4)}   DENEYSEL=${expLL.toFixed(4)}`);
    console.log(`Ort. kazanan sırası: ÜRETİM=${currAvgRank.toFixed(2)}   DENEYSEL=${expAvgRank.toFixed(2)}`);
    console.log(`İyileşen=${improved}  Kötüleşen=${worsened}  Değişmeyen=${unchanged}`);
  }

  aggregate("İSTANBUL (10 yarış)", reports.filter((r) => r.hip === "İstanbul"));
  aggregate("BURSA (6 yarış)", reports.filter((r) => r.hip === "Bursa"));
  aggregate("BURSA + İSTANBUL BİRLEŞİK (16 yarış)", reports);

  if (basarisiz.length > 0) console.log(`\nAtlanan yarışlar: ${basarisiz.join(", ")}`);

  fs.writeFileSync("C:/tmp/full-day-report-raw.json", JSON.stringify(reports, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
