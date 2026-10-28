# D23 AGF Trend — time-safe candidate evaluation (RESEARCH ONLY)

## What is implemented
- **New candidate signals:** `MARKET_AGF_TREND` (last minus first AGF, percentage points) and
  `MARKET_AGF_ACTIVITY` (absolute change >= 1.0 percentage point).
- **Pure calculator:** `src/lib/rotaganyan-analiz-motoru/agf-trend-pit.ts`.
- **Unit tests:** `src/lib/rotaganyan-analiz-motoru/agf-trend-pit.test.ts`.
- **Read-only extractor + evaluation:** `arac-ran-d23-agf-trend-pit-deneyi.mts`.
- **No modification** to `getAgfTrendForRace()`, D23 115 frozen weights, production V5.46.1, Prediction/Pick, coupons, or live website.

## Source-of-truth and timing
- **Never** use mutable `Runner.agf` for historical trend or the current production `getAgfTrendForRace()`.
- Use only timestamped `AgfSnapshot` records with `capturedAt < scheduledRaceStart - 15 minutes`.
- `RaceDay.date` and `Race.time` are parsed as local Europe/Istanbul time (UTC+03:00 for this 2026 sample).
- Use the first and last eligible distinct-timestamp snapshot **on race day**. Fewer than two means `observed=false`, `rawValue=null`.
- An absent/invalid race time never guesses a cutoff; its AGF values are missing.
- This filter **cannot prove** the snapshots were never backfilled. An immutable capture source is a separate requirement before release.

## Evaluation
- Exact frozen source file: SHA256 `311d2bdea8fded3ae08b0c4edb02dab5e5f3469d1b1ad5befaaa78c25437d50f`.
- 115 races / 1126 runners, split **86 train (before Aug 21) / 29 dev**. Held-out Oct 60 and earlier DEV62 are never used to fit or select a model.
- Four variants on the **same training and dev races**:
  1. D23 only (23).
  2. D23 + trend (24).
  3. D23 + activity (24).
  4. D23 + both (25).
- Refit *every candidate, including the 23-signal reference*, on the same 86 training races. Do **not** falsely compare a refit 24-signal model against the 115-race frozen D23 evaluated on its own training data.
- Same `computeFeatureStats` / `fitModel` / `scoreRace` implementation; training-only mu/sigma; lambda=90, LR=.25, iterations=2500. Verify that the refit 23-signal model reproduces the previously reported 8/29 Top1, 17/29 Top3 reference; a mismatch blocks conclusions.
- Measure paired Top1, Top3, Top6, logloss, Brier, ECE, winner rescue/loss, unchanged-field-rank comparison, model coefficient shifts and per-horse probability shifts.
- Report **data coverage**, winner coverage (not just race-with-any-trend), observed vs missing, stratified initial AGF (<5%, 5–15%, >=15%) x up/down/flat win rates, and Pearson initial-AGF/trend correlation.
- Coverage below 60% of starters **or** 60% of winners on either train or dev prevents interpreting the experiment as sufficiently covered; outputs are still exploratory.
- No ROI claims: frozen file has no usable pre-race odds or six-leg dividend series.
- The baseline journal's 23-signal point-in-time validity remains unproven. **None of these models are approved to deploy.**

## Execution (Windows PowerShell, on a separate worktree)
Do **not** change the branch in a worktree while the 60-race process is running there.

```powershell
cd C:\tmp\ran-integration
git fetch origin
git worktree add C:\tmp\ran-d23-agf-research origin/feature/ran-d23-115-integration-20261028
cd C:\tmp\ran-d23-agf-research
# Set up dependencies and environment privately on this new research worktree.
npm ci
node node_modules\vitest\vitest.mjs run src/lib/rotaganyan-analiz-motoru/agf-trend-pit.test.ts
node node_modules\tsx\dist\cli.mjs .\arac-ran-d23-agf-trend-pit-deneyi.mts "C:\tmp\ran-d23-kaynak-fix-20261028-085335.journal-frozen-115-20261028-115008.ndjson" "C:\tmp\ran-d23-agf-trend-pit"
```

Use your local existing `.env` securely; do not echo connection strings or upload secrets. The source **only reads** database tables, while writing `C:\tmp\ran-d23-agf-trend-pit.pit-agf.json` and `C:\tmp\ran-d23-agf-trend-pit.comparison.json` locally. A rerun reuses the frozen sidecar, avoiding unnecessary database scans.

## Promotion rule
Only after point-in-time provenance, enough market-history coverage, paired independent holdout, calibrated performance, equal-budget ROI, and atomic Prediction/Pick/coupon publication all pass may this feature be considered for inclusion in the live engine. A statistically meaningful descriptive win-rate gap by itself does **not** justify promotion.
