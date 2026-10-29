param(
  [string]$SourceJournal = "",
  [string]$Output = "C:\tmp\ran-d23-v2-recapture.json"
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

if (-not $SourceJournal) {
  $candidates = @(
    "C:\tmp\ran-d23-kaynak-fix-20261028-085335.journal-frozen-115-20261028-115008.ndjson",
    "C:\tmp\ran-d23-p0-corrected-115.journal.ndjson",
    "C:\tmp\ran-d20-tempo-entegrasyon-20261026-230152-91726c-train-physical-23.json"
  )
  $SourceJournal = $candidates | Where-Object { Test-Path -LiteralPath $_ -PathType Leaf } | Select-Object -First 1
}
if (-not $SourceJournal -or -not (Test-Path -LiteralPath $SourceJournal -PathType Leaf)) {
  throw "No frozen cohort found. Re-run with -SourceJournal <path to frozen JSON/NDJSON cohort of any size>."
}
if (-not $env:DATABASE_URL) {
  foreach ($candidate in @(
    (Join-Path $PSScriptRoot ".env"),
    (Join-Path $PSScriptRoot ".env.local"),
    "C:\tmp\ran-d23-p1p3\.env",
    "C:\tmp\ran-d23-p1p3\.env.local"
  )) {
    if (Test-Path -LiteralPath $candidate -PathType Leaf) {
      $env:DOTENV_CONFIG_PATH = $candidate
      break
    }
  }
}
if (-not $env:DATABASE_URL -and -not $env:DOTENV_CONFIG_PATH) {
  throw "DATABASE_URL not in process or an existing local .env file. No secrets should be pasted into chat."
}
$env:RAN_D23_V2_COHORT = (Resolve-Path -LiteralPath $SourceJournal).Path
$env:RAN_D23_V2_OUT = $Output
$env:RAN_D23_V2_CHECKPOINT = "$Output.checkpoint.json"
Write-Host "[D23_V2] cohort=$env:RAN_D23_V2_COHORT"
Write-Host "[D23_V2] output=$Output"
Write-Host "[D23_V2] readonly-db=true version=D23_FORMULAS_V2"
node .\node_modules\tsx\dist\cli.mjs .\arac-ran-d23-v2-recapture.mts
if ($LASTEXITCODE -ne 0) { throw "D23_V2_RECAPTURE_FAILED_$LASTEXITCODE" }
Write-Host "[D23_V2] COMPLETE; PIT_NOT_VERIFIED; PRODUCTION_BLOCKED"
