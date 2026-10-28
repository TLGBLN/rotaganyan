# RotaGanyan D23 — 115-race live integration preparation (NOT deployed)

## Exact frozen model
- Research training: **115 completed races**, 1,126 runner starts, 23 signals, 46 coefficients.
- Journal SHA256: `311d2bdea8fded3ae08b0c4edb02dab5e5f3469d1b1ad5befaaa78c25437d50f`.
- Model weights fingerprint: `fafebc0daf6734b193b05389a07b5192e775a7afd799373684e12e4e859e816c`.
- Committed source: `src/lib/rotaganyan-analiz-motoru/artifacts/ran-d23-staging-candidate.json`.
- The research loader validates the exact 115-race fingerprint. It deliberately does not accept the earlier 178-race model.
- The source remains historical-PIT-unverified; it is not marked as an approved production probability forecast.

## Components prepared
1. Existing `d23-feature-capture.ts` computes D23's 23 signals from one source for the research model.
2. `ran-d23-staging.ts` reads the frozen 115-race weights, computes scores and exposes `snapshotCandidate` for a private read-only preview.
3. `d23-snapshot-candidate.ts` deterministically binds probability/rank and coupon rank bands to one SHA256 checksum. It never writes to the DB.
4. `d23-snapshot-candidate.test.ts` checks deterministic signatures, no duplicate runners, summed probabilities and tamper rejection.
5. `SmartAnalysisEditor` on this isolated branch now renders `D23AnalysisPanel`: actual 23-signal D23 ranking and per-signal contributions are visible; Save/Publish is intentionally absent. Existing published predictions are unchanged.
6. Existing `/api/admin/test-ran-d23` remains **404 in production**, EDITOR-only in preview, no persistent writes.

## Release gates — must all be green before modifying the real analysis flow
- Complete and validate the frozen October 22–24 external holdout: 60 eligible race IDs, paired AGF coverage, TOP-1, TOP-3, log loss, calibration and ROI; absence of test evidence is a hard blocker.
- Prove all 23 training/live features use pre-race data and replay identically at frozen cutoffs. Do not silently replace missing historical features.
- Persist one immutable signed/hashed D23 snapshot per race, including horse IDs, ranks, calibrated probabilities, model fingerprint, source as-of, and coupon variants; implement one DB transaction for saved Prediction/Pick/coupon publication, with concurrency and rollback tests.
- Move actual production `POST /api/admin/test-v5-engine`, `src/components/admin/V5AnalysisPanel.tsx`, `upsertPrediction`/publication and coupon rebuild pathways to this ONE frozen snapshot, not to a second independent calculation.
- Disable both V5 score generation and its UI labels only **after** D23 is the real source and its atomic saves are verified. Do not rebrand V5 output as D23.
- Review staging versus current production branch divergence. Stage a production build without alias, verify end-to-end, then promote; have known rollback ready.

## This is a preparation branch
No Vercel production promotion, no merge to production, no DB migrations, no change to existing published predictions. The V5 panel remains in the production branch but is no longer mounted by SmartAnalysisEditor in this preview branch. The private preview and candidate checks alone **do not** constitute D23 live integration.
