import { readFileSync } from "fs";
import { db } from "./src/lib/db";
const IDX = "C:/Users/tlgbi/v546-audit-restore/rpe-artifacts/eb5b889902de57dc/result.json";
const art = new Map<string, any>((JSON.parse(readFileSync(IDX, "utf8")).rows as any[]).filter((x) => x.winnerRankRaw != null).map((x) => [x.raceId, x]));
const ids = [...art.keys()];
function parseNo(e: unknown): number | null { if (typeof e === "number") return e; if (typeof e === "string") { const m = e.match(/^\s*(\d+)/); return m ? parseInt(m[1], 10) : null; } return null; }
const sumK = (fs: any) => (fs.tumSinyaller as any[]).reduce((a, x) => a + Number(x.katki ?? 0), 0);
const sire = (fs: any) => Number(fs.bKatmani?.sireKatkisi ?? 0);
const zm = (fs: any) => Number(fs.bKatmani?.zeminMesafeKatkisi ?? 0);
const agfRank = (fs: any) => Number((fs.tumSinyaller as any[]).find((x) => x.kod === "agfSirasi")?.hamDeger ?? NaN);
const ver = (fs: any) => String(fs.motorEtiketi ?? "?").split(" — ")[0];
const hasB = (fs: any) => fs.bKatmani != null;
type R = { day: string; sA: number[]; sB: number[]; w: number; agfW: number; ver: string; tieAtWinner: number; rawWinnerRank: number; nz: number };
const races: R[] = [];
const tieNotes: any[] = [];
const bStats: Record<string, { n: number; sireNZ: number; zmNZ: number; hasBKatmani: number; sireMean: number; zmMean: number }> = {};
async function main() {
  for (let i = 0; i < ids.length; i += 200) {
    const chunk = ids.slice(i, i + 200);
    const preds = await db.prediction.findMany({ where: { raceId: { in: chunk } }, select: { raceId: true, createdAt: true, picks: { select: { runnerId: true, featureSnapshot: true } } } });
    const res = await db.result.findMany({ where: { raceId: { in: chunk } }, select: { raceId: true, actualOrder: true } });
    const resBy = new Map(res.map((r) => [r.raceId, r]));
    const runners = await db.runner.findMany({ where: { raceId: { in: chunk } }, select: { id: true, raceId: true, no: true } });
    for (const p of preds) {
      if (!p.picks.length || p.picks.some((k) => k.featureSnapshot == null)) continue;
      const r = resBy.get(p.raceId); if (!r) continue;
      const wNo = parseNo((r.actualOrder as any[])?.[0]);
      const wRun = runners.find((x) => x.raceId === p.raceId && x.no === wNo);
      const wIdx = p.picks.findIndex((k) => k.runnerId === wRun?.id);
      if (wIdx < 0) continue;
      const fss = p.picks.map((k) => k.featureSnapshot as any);
      const sA = fss.map((f) => sumK(f) + sire(f) + zm(f));
      const sB = fss.map((f) => sumK(f));
      const v = ver(fss[wIdx]);
      const ties = sA.filter((s) => Math.abs(s - sA[wIdx]) < 1e-4).length - 1;
      const raw = 1 + sA.filter((s, j) => j !== wIdx && s > sA[wIdx]).length;
      const artRaw = art.get(p.raceId).winnerRankRaw;
      if (raw !== artRaw) tieNotes.push({ raceId: p.raceId, ver: v, snap: raw, art: artRaw, tiesAtWinnerScore: ties, minGapToNeighbor: Math.min(...sA.map((s, j) => (j === wIdx ? Infinity : Math.abs(s - sA[wIdx])))).toFixed(5) });
      const bs = (bStats[v] ??= { n: 0, sireNZ: 0, zmNZ: 0, hasBKatmani: 0, sireMean: 0, zmMean: 0 });
      for (const f of fss) { bs.n++; if (sire(f) !== 0) bs.sireNZ++; if (zm(f) !== 0) bs.zmNZ++; if (hasB(f)) bs.hasBKatmani++; bs.sireMean += sire(f); bs.zmMean += zm(f); }
      races.push({ day: String(p.createdAt).slice(0, 10), sA, sB, w: wIdx, agfW: agfRank(fss[wIdx]), ver: v, tieAtWinner: ties, rawWinnerRank: raw, nz: fss.length });
    }
  }
  for (const k of Object.keys(bStats)) { const b = bStats[k]; b.sireMean = +(b.sireMean / b.n).toFixed(4); b.zmMean = +(b.zmMean / b.n).toFixed(4); }
  // B2 frozen: A=snapshot raw, B=A - sire - zm (== sumK). ranking & softmax on unscaled S.
  const ll = (s: number[], w: number) => { const m = Math.max(...s); const lse = m + Math.log(s.reduce((a, x) => a + Math.exp(x - m), 0)); return -(s[w] - lse); };
  const rk = (s: number[], w: number) => 1 + s.filter((x, j) => j !== w && x > s[w]).length;
  const per = races.map((r) => ({ dLL: ll(r.sB, r.w) - ll(r.sA, r.w), h3: (rk(r.sB, r.w) <= 3 ? 1 : 0) - (rk(r.sA, r.w) <= 3 ? 1 : 0), h6: (rk(r.sB, r.w) <= 6 ? 1 : 0) - (rk(r.sA, r.w) <= 6 ? 1 : 0), mr: rk(r.sB, r.w) - rk(r.sA, r.w), ag: r.agfW > 6 }));
  const mean = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  let seed = 20261004; const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const B = 500; const boots: number[][] = [];
  for (let b = 0; b < B; b++) { const idx = races.map(() => Math.floor(rnd() * races.length)); boots.push(idx.map((j) => 0).length ? [mean(idx.map((j) => per[j].dLL))] as any : []); }
  const bl = boots.map((x) => x[0]).sort((a, b) => a - b);
  const hw = per.filter((x) => x.ag);
  const hwIdx = races.map((r, j) => (r.agfW > 6 ? j : -1)).filter((j) => j >= 0);
  const out = {
    tieAnalysis: { mismatches: tieNotes.length, rows: tieNotes },
    bSemanticsByVersion: bStats,
    B2_frozen: { n: races.length, B: B,
      dLogLoss: +mean(per.map((x) => x.dLL)).toFixed(5), CI95_B200: [+bl[Math.floor(0.025 * B)].toFixed(5), +bl[Math.floor(0.975 * B)].toFixed(5)],
      dHit3_pp: +(100 * mean(per.map((x) => x.h3))).toFixed(2), dHit6_pp: +(100 * mean(per.map((x) => x.h6))).toFixed(2),
      dMeanWinnerRank: +mean(per.map((x) => x.mr)).toFixed(4),
      hiddenWinner_n: hwIdx.length, hiddenWinner_dHit3_pp: +(100 * mean(hwIdx.map((j) => per[j].h3))).toFixed(2), hiddenWinner_dHit6_pp: +(100 * mean(hwIdx.map((j) => per[j].h6))).toFixed(2) },
  };
  console.log(JSON.stringify(out, null, 1));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
