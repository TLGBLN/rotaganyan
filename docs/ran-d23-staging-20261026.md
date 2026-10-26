# Rotaganyan Analiz Motoru — D23 staged candidate (NOT LIVE)

This branch stages the **uploaded** D20+3 (23 features / 46 coefficients) model without replacing either V5.46.1 production scoring or the existing 36-feature RAN research model.

## Immutable research artifact
- File: `src/lib/rotaganyan-analiz-motoru/artifacts/ran-d23-staging-candidate.json`
- Source ZIP: `ran-d23-release-input-20261026-235149.zip`
- Model fingerprint: `7c69fbf03899bc67d0fa5060ecf876f0e893ee99add6ee492af89dc8f9d3baa3`
- 178 physically distinct TRAIN races, 1755 starts; no independent holdout in this artifact.
- Reused 109-fold validation: Top1 30, Top3 60, Top6 87, logLoss 2.0839666066701152.
- No AGF used for scoring.

## Development-only endpoint
`POST /api/admin/test-ran-d23` with JSON `{"raceId":"..."}` can compute a *non-persistent* model preview on development builds, using 20 existing canonical live signals and the uploaded exact `pace-scenario.ts` extension for 3 signals. It uses the model's exact 23-code order and verifies artifact fingerprints. It does not create Prediction, Pick, coupons or DB writes, and does not publish model outputs.

The route rejects **all** requests with 404 when `NODE_ENV=production`; it additionally requires an authenticated `EDITOR` session for development use. It is not intended as a public API.

## Mandatory production blockers (not yet resolved)
1. `SURFACE_FORM`: 358 of 1755 PIT observations differ from today's source recomputation. Retraining against the current source has not been independently PIT-verified.
2. Field-size N incomplete for many pre-2026 race histories. No numeric imputation is accepted without official evidence.
3. Immutable point-in-time snapshots are not proven for the 2026 training source.
4. Validate all 23 features end-to-end on the *same* races (training and live feature output). Uploaded artifact verifies coefficient integrity, **not** live feature parity.
5. Independently test an untouched holdout (not the previously inspected DEV62 / Oct60 or repeatedly reused 109).
6. Wire analysis, ranking, and coupon publication to one timestamped/signed snapshot, make atomic, verify rollback & prod database schema.
7. Production main branch and research branch diverged substantially. Integrate by reviewed/cherry-picked changes, not an unsafe wholesale merge.
8. Do not label the 36-feature research artifact or current V5.46.1 live engine as D23.

Promotion gates must be enforced independently; the research route's existence is not deployment approval.

## Explicit prohibited changes in this staging PR
No production routes swapped, no Vercel promotion, no V5.46.1 shutdown, no database mutation, no AGF, no DEV62/OCT60 evaluation, no silent fallback, no promise of unverified win probabilities.
