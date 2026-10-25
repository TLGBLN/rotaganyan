# ROTAGANYAN Analiz Motoru v1.0 — PIT-corrected training refresh.
# Same original 300 race IDs/dates; ONLY vectors recomputed, old JSON and canonical model unchanged.
# Collector reads Race/Result/Runner. No DB table updates, migration or deployment.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$base="C:\tmp"
$old=Join-Path $base "ran-egitim-verisi.json"
$prefix=Join-Path $base "ran-pit-20261025"
$checkpoint="$prefix-checkpoint.json"
$dataset="$prefix-train-dev.json"
$model="$prefix-trained-model.json"
$envNames=@("RAN_COHORT_FILE","RAN_CHECKPOINT","RAN_OUT","RAN_LIMIT","RAN_CONCURRENCY",
            "RAN_DATE_FROM","RAN_DATE_TO","RAN_DATASET_TAG",
            "RAN_IN","RAN_MODEL_OUT","RAN_SPLIT_DATE","RAN_LAMBDA","RAN_LR","RAN_ITER",
            "RAN_PIT_QUIET_DB_LOG")
$previous=@{}
foreach($name in $envNames){$previous[$name]=[Environment]::GetEnvironmentVariable($name,"Process")}
try {
  if(-not(Test-Path $old)){throw "RAN_OLD_COHORT_NOT_FOUND: $old"}
  if(Test-Path $model){throw "RAN_PIT_MODEL_EXISTS: Existing PIT model will not be overwritten: $model"}
  # Completed PIT data must NOT be recollected on a retry. Delegate to
  # independent offline trainer, no Prisma/DB/Accurace initialization.
  if(Test-Path -LiteralPath $dataset -PathType Leaf){
    Write-Host "[RAN_PIT] Refreshed 300-race dataset found. SKIPPING database collector."
    & powershell -NoProfile -ExecutionPolicy Bypass -File .\arac-ran-pit-sadece-egit.ps1
    if($LASTEXITCODE -ne 0){throw "RAN_PIT_TRAIN_ONLY_FAILED"}
    return
  }
  $reference=Get-Content $old -Raw -Encoding UTF8 | ConvertFrom-Json
  if($reference.Count -ne 300){throw "RAN_OLD_COHORT_COUNT: expected exactly 300 original train+dev race IDs, got $($reference.Count)"}
  $trainCount=@($reference | Where-Object {$_.tarih -ge "2026-08-16" -and $_.tarih -le "2026-08-25"}).Count
  $devCount=@($reference | Where-Object {$_.tarih -ge "2026-08-26" -and $_.tarih -le "2026-08-28"}).Count
  if($trainCount -ne 238 -or $devCount -ne 62){
    throw "RAN_OLD_COHORT_SPLIT_MISMATCH: train=$trainCount dev=$devCount, requires 238/62"
  }
  [Environment]::SetEnvironmentVariable("RAN_COHORT_FILE",$old,"Process")
  [Environment]::SetEnvironmentVariable("RAN_CHECKPOINT",$checkpoint,"Process")
  [Environment]::SetEnvironmentVariable("RAN_OUT",$dataset,"Process")
  [Environment]::SetEnvironmentVariable("RAN_LIMIT","0","Process")
  [Environment]::SetEnvironmentVariable("RAN_CONCURRENCY","4","Process")
  [Environment]::SetEnvironmentVariable("RAN_DATE_FROM","2026-08-16","Process")
  [Environment]::SetEnvironmentVariable("RAN_DATE_TO","2026-08-28","Process")
  [Environment]::SetEnvironmentVariable("RAN_DATASET_TAG","RAN_PIT_20261025_SIRE_SPEED","Process")
  # Offline 300-race run can execute thousands of Prisma queries. SQL text does
  # not help diagnose progress and causes enormous terminal output; errors stay.
  [Environment]::SetEnvironmentVariable("RAN_PIT_QUIET_DB_LOG","1","Process")
  Write-Host "[RAN_PIT] Checking TypeScript before any real DB reads..."
  & npx tsc --noEmit -p tsconfig.json
  if($LASTEXITCODE -ne 0){throw "RAN_PIT_TYPESCRIPT_FAIL"}
  # Node/tsx does not load .env.local automatically (unlike Next.js). Load
  # explicitly in the CHILD process so no DB secret is printed or copied to files.
  # Existing process DATABASE_URL takes priority over files.
  $dbEnvArgs=@()
  $explicitEnv=[Environment]::GetEnvironmentVariable("RAN_ENV_FILE","Process")
  if($explicitEnv){
    if(-not(Test-Path -LiteralPath $explicitEnv -PathType Leaf)){
      throw "RAN_DB_ENV_FILE_NOT_FOUND: RAN_ENV_FILE yolunda dosya bulunamadi"
    }
    $resolvedEnv=(Resolve-Path -LiteralPath $explicitEnv).Path
    $dbEnvArgs+=("--env-file=$resolvedEnv")
  } else {
    foreach($file in @(".env",".env.local")){
      if(Test-Path -LiteralPath $file -PathType Leaf){
        $dbEnvArgs+=("--env-file=$file")
      }
    }
  }
  # Fail before loading Prisma/starting a 300-race collection. Never echo URL,
  # passwords or entire env file contents.
  & node @dbEnvArgs ./arac-ran-db-onkontrol.cjs
  if($LASTEXITCODE -ne 0){throw "RAN_PIT_DATABASE_CONFIG_FAIL: veri toplama baslatilmadi"}

  Write-Host "[RAN_PIT] Recalculating exact original 238 TRAIN + 62 DEV race IDs with repaired SIRE/SPEED"
  & node @dbEnvArgs node_modules/tsx/dist/cli.mjs ./arac-ran-egitim-veri-topla.mts
  if($LASTEXITCODE -ne 0){throw "RAN_PIT_RECOLLECTION_FAILED: source checkpoint preserved"}
  if(-not(Test-Path $dataset)){throw "RAN_PIT_DATASET_MISSING"}
  [Environment]::SetEnvironmentVariable("RAN_IN",$dataset,"Process")
  [Environment]::SetEnvironmentVariable("RAN_MODEL_OUT",$model,"Process")
  [Environment]::SetEnvironmentVariable("RAN_SPLIT_DATE","2026-08-26","Process")
  [Environment]::SetEnvironmentVariable("RAN_LAMBDA","90","Process")
  [Environment]::SetEnvironmentVariable("RAN_LR","0.25","Process")
  [Environment]::SetEnvironmentVariable("RAN_ITER","2500","Process")
  Write-Host "[RAN_PIT] Fitting a diagnostic model using train=Aug16..25, dev=Aug26..28. Canonical artifact NOT changed."
  & node node_modules/tsx/dist/cli.mjs ./arac-ran-egit-ve-degerlendir.mts
  if($LASTEXITCODE -ne 0){throw "RAN_PIT_TRAINING_FAILED"}
  Write-Host "[RAN_PIT] TRAIN+DEV COLLECTION AND RETRAIN COMPLETE (DIAGNOSTIC ONLY)"
  Write-Host "[RAN_PIT] dataset=$dataset"
  Write-Host "[RAN_PIT] model=$model"
  Write-Host "[RAN_PIT] production=UNCHANGED, October acceptance=NOT_TOUCHED"
} finally {
  foreach($name in $envNames){[Environment]::SetEnvironmentVariable($name,$previous[$name],"Process")}
}
