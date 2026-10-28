param(
  [string]$Journal = "C:\tmp\ran-d23-kaynak-fix-20261028-085335.journal-frozen-115-20261028-115008.ndjson",
  [string]$OutputPrefix = "C:\tmp\ran-d23-agf-trend-pit"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
if (!(Test-Path -LiteralPath $Journal)) { throw "FROZEN_115_JOURNAL_NOT_FOUND=$Journal" }
if (!(Test-Path -LiteralPath ".\node_modules\tsx\dist\cli.mjs")) {
  throw "NODE_MODULES_MISSING: Install dependencies in this separate research worktree (npm ci)."
}
if (-not $env:DATABASE_URL -and -not (Test-Path -LiteralPath ".\.env")) {
  throw "DATABASE_URL_NOT_CONFIGURED: Put an existing local .env in this research worktree; never paste secrets."
}
"AGF_TREND_PIT=RESEARCH_ONLY_NO_DB_WRITE_NO_DEPLOY"
"FROZEN_SOURCE=$Journal"
"OUTPUT_PREFIX=$OutputPrefix"
& node ".\node_modules\tsx\dist\cli.mjs" ".\arac-ran-d23-agf-trend-pit-deneyi.mts" "$Journal" "$OutputPrefix"
if ($LASTEXITCODE -ne 0) { throw "AGF_TREND_PIT_FAILED_EXIT=$LASTEXITCODE" }
"AGF_TREND_PIT_COMPLETED"
"REPORT=$OutputPrefix.comparison.json"
