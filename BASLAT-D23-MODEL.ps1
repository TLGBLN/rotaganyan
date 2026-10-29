param(
  [string]$Recapture = "C:\tmp\ran-d23-v2-recapture.json",
  [string]$Market = "C:\tmp\ran-d23-market-frozen.json",
  [Parameter(Mandatory = $true)]
  [string]$DevFrom,
  [string]$Output = "C:\tmp\ran-d23-market-research-model.json"
)
$ErrorActionPreference="Stop"
Set-Location $PSScriptRoot
if (-not (Test-Path -LiteralPath $Recapture -PathType Leaf)) {
  throw "D23_FORMULA_V2_RECAPTURE_MISSING: $Recapture"
}
if (-not (Test-Path -LiteralPath $Market -PathType Leaf)) {
  throw "PRE_RACE_AGF_SNAPSHOTS_MISSING: $Market. Mutable Runner.agf cannot substitute for these records."
}
if ($DevFrom -notmatch '^\d{4}-\d{2}-\d{2}$') {
  throw "DevFrom must be a frozen YYYY-MM-DD split, not chosen after seeing test results."
}
$env:RAN_D23_V2_IN=(Resolve-Path -LiteralPath $Recapture).Path
$env:RAN_D23_MARKET_IN=(Resolve-Path -LiteralPath $Market).Path
$env:RAN_D23_MARKET_DEV_FROM=$DevFrom
$env:RAN_D23_MARKET_OUT=$Output

npx tsc --noEmit --pretty false
if ($LASTEXITCODE -ne 0) {throw "D23_MARKET_TYPECHECK_FAILED"}

npx vitest run .\src\lib\rotaganyan-analiz-motoru\d23-market-model.test.ts .\src\lib\motor-v1\engine\training-d23-equipment.test.ts .\src\lib\rotaganyan-analiz-motoru\pace-scenario-gate.test.ts
if ($LASTEXITCODE -ne 0) {throw "D23_MARKET_UNIT_TEST_FAILED"}

node .\node_modules\tsx\dist\cli.mjs .\arac-ran-d23-market-train.mts
if ($LASTEXITCODE -ne 0) {throw "D23_MARKET_TRAIN_FAILED"}

Write-Host "[D23 MARKET] FIT_DONE; RESEARCH_ONLY; NOT_IN_PRODUCTION"
