// READ-ONLY. AYNI 30 holdout yarisinda AGF'nin (piyasanin) implied-probability LogLoss'u -
// Model A/B icin asil anlamli rakip kiyaslamasi (saf rastgele taban degil). Eküri kontrolu
// (diag-motor-v1-agf-logloss-check.mts) AGF'nin bireysel (kopyalanmamis) oldugunu dogruladi -
// cift sayim riski yok, agf_i / sum(agf_j) guvenle "P(bu at kazanir)" olarak kullanilabilir.
import fs from "node:fs";
import { db } from "./src/lib/db";
import { hesaplaAgfSirasi } from "./src/lib/methodology/agf-sirasi";

const LOCK_PATH = "src/lib/motor-v1/artifacts/ab-split-locked.json";

function logLoss(probs: (number | null)[]) {
  const p = probs.filter((x): x is number => x != null && x > 0);
  return p.length ? -p.reduce((s, x) => s + Math.log(x), 0) / p.length : null;
}

async function main() {
  const lock = JSON.parse(fs.readFileSync(LOCK_PATH, "utf8")) as { holdoutRaceIds: string[] };
  const winP: (number | null)[] = [];
  let top1 = 0, top3 = 0, nEval = 0, racesWithoutWinnerAgf = 0;

  for (const raceId of lock.holdoutRaceIds) {
    const race = await db.race.findUnique({
      where: { id: raceId },
      select: {
        time: true, raceDay: { select: { date: true } },
        result: { select: { actualOrder: true, winnerNos: true } },
        runners: { where: { scratched: false }, select: { id: true, no: true, ekuriGroup: true } },
      },
    });
    if (!race || !race.result) continue;
    const winnerNo = (race.result.winnerNos && race.result.winnerNos.length > 0)
      ? race.result.winnerNos[0]
      : (Array.isArray(race.result.actualOrder) && race.result.actualOrder.length > 0 ? parseInt(String(race.result.actualOrder[0]), 10) : null);
    if (winnerNo == null) continue;

    const m = race.time?.trim().match(/^(\d{1,2})[:.](\d{2})/);
    const cutoff = m ? new Date(`${race.raceDay.date.toISOString().slice(0, 10)}T${m[1].padStart(2, "0")}:${m[2]}:00+03:00`) : race.raceDay.date;
    const snaps = await db.agfSnapshot.findMany({ where: { runnerId: { in: race.runners.map((r) => r.id) }, capturedAt: { lt: cutoff } }, select: { runnerId: true, agf: true, capturedAt: true } });
    const byRunnerAll = new Map<string, { agf: number; capturedAt: Date }[]>();
    for (const s of snaps) { const a = byRunnerAll.get(s.runnerId) ?? []; a.push(s); byRunnerAll.set(s.runnerId, a); }
    const lastByRunner = new Map<string, number>();
    for (const [rid, arr] of byRunnerAll) { arr.sort((a, b) => a.capturedAt.getTime() - b.capturedAt.getTime()); lastByRunner.set(rid, arr[arr.length - 1].agf); }

    const withAgf = race.runners.map((r) => ({ no: r.no, agf: lastByRunner.get(r.id) ?? null })).filter((r) => r.agf != null) as { no: number; agf: number }[];
    const total = withAgf.reduce((s, r) => s + r.agf, 0);
    if (total <= 0 || withAgf.length === 0) continue;
    const probs = withAgf.map((r) => ({ no: r.no, probability: r.agf / total }));

    nEval++;
    const winnerEntry = probs.find((p) => p.no === winnerNo);
    if (!winnerEntry) { racesWithoutWinnerAgf++; winP.push(null); continue; }
    winP.push(winnerEntry.probability);
    const sorted = [...probs].sort((a, b) => b.probability - a.probability);
    if (sorted[0]?.no === winnerNo) top1++;
    if (sorted.slice(0, 3).some((p) => p.no === winnerNo)) top3++;
  }

  console.log(`Degerlendirilen yaris: ${nEval}/${lock.holdoutRaceIds.length} (AGF verisi olan)`);
  console.log(`Kazanan icin AGF verisi EKSIK olan yaris: ${racesWithoutWinnerAgf}`);
  console.log(`AGF (piyasa) implied-probability: top1=${(top1 / nEval * 100).toFixed(1)}% top3=${(top3 / nEval * 100).toFixed(1)}% logLoss=${logLoss(winP)?.toFixed(4)}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("HATA:", e); process.exit(1); });
