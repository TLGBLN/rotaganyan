# RAN pedigree candidate v2 — triple-lineage PIT recollect ONLY, then fresh offline model.
# No production DB writes; immutable original 300-file & model remain unchanged.
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
$original="C:\tmp\ran-pit-20261025-train-dev.json"
$revised="C:\tmp\ran-pit-20261025-pedigri-v2-300.json"
$model="C:\tmp\ran-pit-20261025-pedigri-v2-candidate-model.json"
if(-not(Test-Path -LiteralPath $original -PathType Leaf)){
  throw "RAN_PED_V2_ORIGINAL_PIT_MISSING: 300-race source unavailable"
}
if(Test-Path -LiteralPath $model -PathType Leaf){
  throw "RAN_PED_V2_MODEL_ALREADY_EXISTS: will not overwrite diagnostic model"
}
$names=@("RAN_PED_V2_IN","RAN_PED_V2_OUT","RAN_IN","RAN_MODEL_OUT",
  "RAN_SPLIT_DATE","RAN_LAMBDA","RAN_LR","RAN_ITER","RAN_MODEL_VERSION","DATABASE_URL")
$backup=@{}
foreach($n in $names){$backup[$n]=[Environment]::GetEnvironmentVariable($n,"Process")}
try {
  Write-Host "[RAN_PED_V2] Initial 300 historical races reused. Only lineage source values refreshed."
  if(-not(Test-Path -LiteralPath $revised -PathType Leaf)){
    $dbArgs=@()
    $explicit=[Environment]::GetEnvironmentVariable("RAN_ENV_FILE","Process")
    if($explicit){
      if(-not(Test-Path -LiteralPath $explicit -PathType Leaf)){
        throw "RAN_PED_V2_ENV_FILE_NOT_FOUND"
      }
      $dbArgs+=("--env-file=$((Resolve-Path -LiteralPath $explicit).Path)")
    }else{
      foreach($f in @(".env",".env.local")){
        if(Test-Path -LiteralPath $f -PathType Leaf){$dbArgs+=("--env-file=$f")}
      }
    }
    & node @dbArgs ./arac-ran-db-onkontrol.cjs
    if($LASTEXITCODE -ne 0){throw "RAN_PED_V2_DB_READ_PREFLIGHT_FAILED"}
    [Environment]::SetEnvironmentVariable("RAN_PED_V2_IN",$original,"Process")
    [Environment]::SetEnvironmentVariable("RAN_PED_V2_OUT",$revised,"Process")
    & node @dbArgs node_modules/tsx/dist/cli.mjs ./arac-ran-pedigri-v2-hizli-yenile.mts
    if($LASTEXITCODE -ne 0){throw "RAN_PED_V2_THREE_LINEAGE_COLLECTION_FAILED: checkpoint preserved"}
  } else {
    Write-Host "[RAN_PED_V2] Existing v2 candidate data found. Skipping all database reads."
  }
  if(-not(Test-Path -LiteralPath "$revised.manifest.json" -PathType Leaf)){
    throw "RAN_PED_V2_MANIFEST_REQUIRED"
  }
  $manifest=Get-Content -LiteralPath "$revised.manifest.json" -Raw -Encoding UTF8 | ConvertFrom-Json
  if($manifest.version -ne "RAN_PEDIGREE_3LINE_FOAL_ADJUST_V2_20261025" -or
     $manifest.races -ne 300 -or
     $manifest.everyHorseHasThreeLineages -ne $true -or
     $manifest.originalCanonicalModelUnmodified -ne $true){
    throw "RAN_PED_V2_CANDIDATE_MANIFEST_FAIL"
  }
  # Prevent silently training from a revised/corrupted original snapshot.
  $sourceSha=(Get-FileHash -LiteralPath $original -Algorithm SHA256).Hash.ToLowerInvariant()
  $revisedSha=(Get-FileHash -LiteralPath $revised -Algorithm SHA256).Hash.ToLowerInvariant()
  if($sourceSha -ne $manifest.sourceSha -or $revisedSha -ne $manifest.outputSha){
    throw "RAN_PED_V2_SOURCE_OR_OUTPUT_SHA_MISMATCH: no model training"
  }
  [Environment]::SetEnvironmentVariable("RAN_IN",$revised,"Process")
  [Environment]::SetEnvironmentVariable("RAN_MODEL_OUT",$model,"Process")
  [Environment]::SetEnvironmentVariable("RAN_SPLIT_DATE","2026-08-26","Process")
  [Environment]::SetEnvironmentVariable("RAN_LAMBDA","90","Process")
  [Environment]::SetEnvironmentVariable("RAN_LR","0.25","Process")
  [Environment]::SetEnvironmentVariable("RAN_ITER","2500","Process")
  [Environment]::SetEnvironmentVariable("RAN_MODEL_VERSION",$manifest.version,"Process")
  # Enforce literal zero DB dependency during fitting.
  [Environment]::SetEnvironmentVariable("DATABASE_URL",$null,"Process")
  Write-Host "[RAN_PED_V2] Training SEPARATE, versioned v2 betas (238 train, 62 diagnostic dev). DB DISABLED."
  & node node_modules/tsx/dist/cli.mjs ./arac-ran-egit-ve-degerlendir.mts
  if($LASTEXITCODE -ne 0){throw "RAN_PED_V2_TRAINING_FAILED"}
  if(-not(Test-Path -LiteralPath $model -PathType Leaf)){
    throw "RAN_PED_V2_MODEL_NOT_CREATED"
  }
  $m=Get-Content -LiteralPath $model -Raw -Encoding UTF8 | ConvertFrom-Json
  if($m.engineVersion -ne $manifest.version -or $m.nTrainRaces -ne 238 -or
     $m.nHoldoutRaces -ne 62 -or $m.publicationGate -ne "BLOCKED"){
    throw "RAN_PED_V2_VERSIONED_MODEL_GUARD_FAILED"
  }
  Write-Host "[RAN_PED_V2] PASS: versioned research model saved: $model"
  Write-Host ("[RAN_PED_V2] Top1={0:N2}% Top3={1:N2}% LL={2:N5}  (previously inspected DEV - DIAGNOSTIC ONLY)" -f
    (100*$m.holdoutMetrics.top1),(100*$m.holdoutMetrics.top3),$m.holdoutMetrics.logLoss)
  Write-Host "[RAN_PED_V2] Publication BLOCKED. Original RAN 36 artifact untouched."
} finally {
  foreach($n in $names){[Environment]::SetEnvironmentVariable($n,$backup[$n],"Process")}
}
