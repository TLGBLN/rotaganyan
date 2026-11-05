/** Read-only, AGF-free expected wins per mount: p=1/N. */
export type JockeyMount = { fieldSize: number; position: number | null };
export type JockeyOE30Result = {
  rawValue: number | null;
  observed: boolean;
  sampleCount: number;
  wins: number;
  expectedWinsNaive: number;
  missingReason: string | null;
};
export const JOCKEY_OE30_SHRINK_K = 8; // Same provisional k as original JOKEY_01.
/** (Wins - sum(1/N)) / (n+8), n = resolved starts in preceding 30 days. */
export function aggregateJockeyOE30(mounts: readonly JockeyMount[]): JockeyOE30Result {
  const valid = mounts.filter(m => Number.isSafeInteger(m.fieldSize) && m.fieldSize >= 2 &&
    m.position !== null && Number.isSafeInteger(m.position) && m.position >= 1 && m.position <= m.fieldSize);
  const n = valid.length;
  const wins = valid.filter(m => m.position === 1).length;
  const expectedWinsNaive = valid.reduce((s, m) => s + 1 / m.fieldSize, 0);
  return {
    rawValue: n ? (wins - expectedWinsNaive) / (n + JOCKEY_OE30_SHRINK_K) : null,
    observed: n > 0,
    sampleCount: n,
    wins,
    expectedWinsNaive,
    missingReason: n > 0 ? null : "NO_RESOLVED_PRE_RACE_30D_MOUNTS",
  };
}
