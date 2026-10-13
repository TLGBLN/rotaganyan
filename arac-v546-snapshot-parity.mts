import { readFileSync } from "fs";
import { db } from "./src/lib/db";
const IDX = "C:/Users/tlgbi/v546-audit-restore/rpe-artifacts/eb5b889902de57dc/result.json";
const art = new Map<string, any>((JSON.parse(readFileSync(IDX, "utf8")).rows as any[]).filter((x) => x.winnerRankRaw != null).map((x) => [x.raceId, x]));
const ids = [...art.keys()];
function parseNo(e: unknown): number | null { if (typeof e === "number") return e; if (typeof e === "string") { const m = e.match(/^\s*(\d+)/); return m ? parseInt(m[1], 10) : null; } return null; }
function snapScore(fs: any): number {
  const s = (fs.tumSinyaller as any[]).reduce((a, x) => a + Number(x.katki ?? 0), 0);
  const b = fs.bKatmani ?? {};
  return s + Number(b.sireKatkisi ?? 0) + Number(b.zeminMesafeKatkisi ?? 0);
}
async function main() {
  const agg: Record<string, [number, number]> = {};
  let tot = 0, ok = 0, miss = 0; const mism: any[] = [];
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const preds = await db.prediction.findMany({ where: { raceId: { in: chunk } }, select: { raceId: true, picks: { select: { runnerId: true, featureSnapshot: true } } } });
    const res = await db.result.findMany({ where: { raceId: { in: chunk } }, select: { raceId: true, actualOrder: true } });
    const resBy = new Map(res.map((r) => [r.raceId, r]));
    const runners = await db.runner.findMany({ where: { raceId: { in: chunk } }, select: { id: true, raceId: true, no: true } });
    for (const p of preds) {
      if (!p.picks.length || p.picks.some((k) => k.featureSnapshot == null)) { miss++; continue; }
      const r = resBy.get(p.raceId); if (!r) { miss++; continue; }
      const wNo = parseNo((r.actualOrder as any[])?.[0]);
      const wRun = runners.find((x) => x.raceId === p.raceId && x.no === wNo);
      const wPick = p.picks.find((k) => k.runnerId === wRun?.id);
      if (!wPick) { miss++; continue; }
      const sc = p.picks.map((k) => snapScore(k.featureSnapshot as any));
      const wS = snapScore(wPick.featureSnapshot as any);
      const rank = 1 + sc.filter((s) => s > wS).length;
      const motor = String((wPick.featureSnapshot as any).motorEtiketi ?? "?").slice(0, 60);
      const key = motor.split(" — ")[0];
      agg[key] ??= [0, 0]; agg[key][1]++;
      tot++;
      if (rank === art.get(p.raceId).winnerRankRaw) { ok++; agg[key][0]++; }
      else mism.push({ raceId: p.raceId, motor: key, snap: rank, art: art.get(p.raceId).winnerRankRaw, n: p.picks.length });
    }
  }
  console.log(JSON.stringify({ comparable: tot, match: ok, matchPct: (100 * ok / tot).toFixed(2), skipped: miss, byMotor: agg, mismatchSample: mism.slice(0, 6) }, null, 1));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
