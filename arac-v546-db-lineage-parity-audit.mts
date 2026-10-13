// SALT-OKUNUR lineage/parity audit — stored artifact vs DB (tahmin anında kaydedilen Pick skorları).
// DB yazılmaz. Çıktı: kısa özet + decision.
import { readFileSync } from "fs";
import { db } from "./src/lib/db";

const IDX = "C:/Users/tlgbi/v546-audit-restore/rpe-artifacts/eb5b889902de57dc/result.json";
type ArtRow = { raceId: string; date: string; winnerRankRaw: number | null; winnerRankPublished: number | null };
const art = new Map<string, ArtRow>(
  (JSON.parse(readFileSync(IDX, "utf8")).rows as ArtRow[])
    .filter((x) => x.winnerRankRaw != null && x.winnerRankPublished != null)
    .map((x) => [x.raceId, x]),
);
const raceIds = [...art.keys()];

function parseNo(e: unknown): number | null {
  if (typeof e === "number") return e;
  if (typeof e === "string") { const m = e.match(/^\s*(\d+)/); return m ? parseInt(m[1], 10) : null; }
  return null;
}

async function main() {
  const reasons: Record<string, number> = {};
  const add = (k: string) => (reasons[k] = (reasons[k] ?? 0) + 1);
  let n = 0, cmpRaw = 0, okRaw = 0, okPub = 0, cmpPub = 0, tieCount = 0, universeMismatch = 0, scratchMismatch = 0;
  const monthCount: Record<string, number> = {};
  let exactAll = 0, scoreOnly = 0;

  for (let i = 0; i < raceIds.length; i += 200) {
    const chunk = raceIds.slice(i, i + 200);
    const preds = await db.prediction.findMany({
      where: { raceId: { in: chunk } },
      select: { raceId: true, createdAt: true, picks: { select: { rank: true, runnerId: true, score: true, scoreExact: true, featureSnapshot: true } } },
    });
    const predByRace = new Map(preds.map((p) => [p.raceId, p]));
    const results = await db.result.findMany({ where: { raceId: { in: chunk } }, select: { raceId: true, actualOrder: true } });
    const resByRace = new Map(results.map((r) => [r.raceId, r]));
    const runners = await db.runner.findMany({ where: { raceId: { in: chunk } }, select: { id: true, raceId: true, no: true, scratched: true } });
    const runnersByRace = new Map<string, typeof runners>();
    for (const r of runners) { const a = runnersByRace.get(r.raceId) ?? []; a.push(r); runnersByRace.set(r.raceId, a); }

    for (const rid of chunk) {
      const a = art.get(rid)!;
      n++;
      const p = predByRace.get(rid);
      if (!p) { add("no_prediction_row"); continue; }
      const m = p.createdAt.toISOString().slice(0, 7);
      monthCount[m] = (monthCount[m] ?? 0) + 1;
      if (p.picks.length === 0) { add("no_picks"); continue; }
      const res = resByRace.get(rid);
      if (!res) { add("no_result"); continue; }
      const winNo = parseNo((res.actualOrder as unknown[])?.[0]);
      const rr = runnersByRace.get(rid) ?? [];
      const winner = rr.find((r) => r.no === winNo);
      if (!winner) { add("winner_runner_not_found"); continue; }
      const winPick = p.picks.find((k) => k.runnerId === winner.id);
      if (!winPick) { add("winner_not_in_picks"); continue; }
      const active = rr.filter((r) => !r.scratched).length;
      if (p.picks.length !== active) universeMismatch++;
      if (p.picks.some((k) => k.runnerId && rr.find((r) => r.id === k.runnerId)?.scratched)) scratchMismatch++;

      const allExact = p.picks.every((k) => k.scoreExact != null);
      const allScore = p.picks.every((k) => k.score != null);
      if (allExact) exactAll++; else if (allScore) scoreOnly++;
      const key = (k: { scoreExact: number | null; score: number | null }) => (allExact ? (k.scoreExact as number) : (k.score as number));
      if (!allExact && !allScore) { add("no_score_fields"); continue; }
      const wKey = key(winPick);
      const better = p.picks.filter((k) => key(k) > wKey).length;
      const ties = p.picks.filter((k) => key(k) === wKey).length;
      if (ties > 1) tieCount++;
      const dbRaw = 1 + better; // min-rank tie
      cmpRaw++;
      if (dbRaw === a.winnerRankRaw) okRaw++;
      cmpPub++;
      if (winPick.rank === a.winnerRankPublished) okPub++;
      if (!allExact) add("raw_from_int_score_no_scoreExact");
    }
  }

  const pct = (x: number, d: number) => (d ? ((100 * x) / d).toFixed(2) : "NA");
  const decision =
    cmpRaw === 0 ? "UNRESOLVED" :
    Number(pct(okRaw, cmpRaw)) >= 99 ? "TRUST_ARTIFACT_AND_DB" :
    "UNRESOLVED";
  console.log(JSON.stringify({
    n_artifact_races: n,
    compared_raw: cmpRaw,
    artifact_vs_db_raw_pct: pct(okRaw, cmpRaw),
    published_rank_agreement_pct: pct(okPub, cmpPub),
    raw_source_exactScore_races: exactAll,
    raw_source_intScore_only_races: scoreOnly,
    tie_races_in_winner_key: tieCount,
    runner_universe_mismatch_count: universeMismatch,
    scratched_in_picks_count: scratchMismatch,
    missing_reason_counts: reasons,
    prediction_month_distribution: monthCount,
    engineVersion: "NOT_STORED (Prediction/Pick şemasında alan yok)",
    recomputed_vs_db_raw_pct: "NOT_RUN (34ffab2 worktree gerekir)",
    decision,
  }, null, 2));
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
