# RAN v1.0 — ONLY fit diagnostic model from existing 300 PIT-recomputed races.
# ZERO database reads, no PostgreSQL, no re-collection, no prod/model artifact writes.
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest

$dataset="C:\tmp\ran-pit-20261025-train-dev.json"
$model="C:\tmp\ran-pit-20261025-trained-model.json"
if(-not(Test-Path -LiteralPath $dataset -PathType Leaf)){
  throw "RAN_PIT_DATASET_MISSING: 300-race refreshed JSON was not found. No data will be collected."
}
if(Test-Path -LiteralPath $model){
  throw "RAN_PIT_MODEL_EXISTS: Will not overwrite existing diagnostic output: $model"
}
# PowerShell 5.1 wraps ConvertFrom-Json arrays as ONE pipeline object.
# Validate all 300 rows with Node JSON.parse; never use @(...).Count here.
& node ./arac-ran-pit-dataset-check.cjs $dataset
if($LASTEXITCODE -ne 0){throw "RAN_PIT_DATASET_PREFLIGHT_FAILED: no training started"}
$names=@("RAN_IN","RAN_MODEL_OUT","RAN_SPLIT_DATE","RAN_LAMBDA","RAN_LR","RAN_ITER","DATABASE_URL")
$original=@{}
foreach($name in $names){$original[$name]=[Environment]::GetEnvironmentVariable($name,"Process")}
try{
  [Environment]::SetEnvironmentVariable("RAN_IN",$dataset,"Process")
  [Environment]::SetEnvironmentVariable("RAN_MODEL_OUT",$model,"Process")
  [Environment]::SetEnvironmentVariable("RAN_SPLIT_DATE","2026-08-26","Process")
  [Environment]::SetEnvironmentVariable("RAN_LAMBDA","90","Process")
  [Environment]::SetEnvironmentVariable("RAN_LR","0.25","Process")
  [Environment]::SetEnvironmentVariable("RAN_ITER","2500","Process")
  # Make the independence test real: train with DATABASE_URL absent.
  [Environment]::SetEnvironmentVariable("DATABASE_URL",$null,"Process")
  Write-Host "[RAN_PIT_TRAIN_ONLY] Input=300/300; train=238 dev=62; DATABASE_URL absent by design"
  Write-Host "[RAN_PIT_TRAIN_ONLY] No PostgreSQL / no Accurace re-download / no production writes"
  & node node_modules/tsx/dist/cli.mjs ./arac-ran-egit-ve-degerlendir.mts
  if($LASTEXITCODE -ne 0){throw "RAN_PIT_TRAIN_ONLY_FAIL"}
  if(-not(Test-Path -LiteralPath $model -PathType Leaf)){throw "RAN_PIT_MODEL_OUTPUT_MISSING"}
  $result=Get-Content -LiteralPath $model -Raw -Encoding UTF8 | ConvertFrom-Json
  if($result.nTrainRaces -ne 238 -or $result.nHoldoutRaces -ne 62){
    throw "RAN_PIT_MODEL_OUTPUT_SPLIT_MISMATCH"
  }
  Write-Host "[RAN_PIT_TRAIN_ONLY] PASS. PIT diagnostic model saved: $model"
  Write-Host "[RAN_PIT_TRAIN_ONLY] Top1=$([math]::Round(100*$result.holdoutMetrics.top1,2))% Top3=$([math]::Round(100*$result.holdoutMetrics.top3,2))% LogLoss=$([math]::Round($result.holdoutMetrics.logLoss,5))"
  Write-Host "[RAN_PIT_TRAIN_ONLY] Old artifacts and live motor unchanged. Publication=BLOCKED"
} finally {
  foreach($name in $names){[Environment]::SetEnvironmentVariable($name,$original[$name],"Process")}
}
