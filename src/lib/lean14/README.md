# LEAN14 — 3 signal read-only capture port (research only)

This branch adds raw capture support for **exactly three of the 14 LEAN14 model inputs**:
`JOCKEY_OE30`, `SURFACE_FORM`, and `RIVAL_GAP`.

- Main entry: `src/lib/lean14/gather-v461-raw-sinyaller.ts` exports `gatherV461RawSinyaller(raceId)`.
- No production score, coupon, Prediction, or Pick changes. No calls to `scoreV461`, `gatherFaz1V5`, or live AGF sync.
- Only adds new files under `src/lib/lean14/`. The LEAN14 model uses 14 signals; the helper modules copied here do **not** add more model features.
- `JOCKEY_OE30`: previous 30 days, naively expected wins = sum(1/N), observed wins minus expected, then per-mount shrinkage k=8. No market AGF. Excludes target race date.
- `SURFACE_FORM`: observed, surface-matched prior finish ratio; last five valid records, time decay; **120-day half-life is provisional**.
- `RIVAL_GAP`: own observed `HIZ_01 + SINIF_01` minus strongest different valid horse in the same field. Uses V2 speed observation gate and conflicting-breed identity exclusion.
- Feature statuses distinguish `null / observed=false` from an actual numeric zero.

**PIT warning:** Reads currently mutable historical database data, so a retroactively generated record is **not independently verified as a real pre-race snapshot**. The returned status explicitly says `CURRENT_DB_PIT_NOT_PROVEN`. Do not use results for release claims without frozen source/PIT parity audit.

**Validation on this branch:** Pure JOCKEY_OE30 math was exercised in a local Node/TypeScript smoke test. Full `npx tsc --noEmit`, DB-backed tests, all-three formula parity, and pre-race source audit have NOT been run; treat these as required release gates.

Local Windows PowerShell, on this branch:
```powershell
npm ci
npx tsc --noEmit --pretty false
npx tsx --test src/lib/lean14/lean14-three-signal-audit.test.ts
git diff master --name-status
```

No direct integration into the V5.46.1 ranking pipeline, no production rollout.
