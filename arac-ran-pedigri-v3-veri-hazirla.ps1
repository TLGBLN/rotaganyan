# ROTAGANYAN — V3 pedigree sources for basket optimization, NOT model fitting.
# Reads existing DB only for SIRE / DAM / DAMSIRE PIT source; 33 other features reused.
# Frozen original 300 train/dev and canonical model remain unchanged.
$ErrorActionPreference="Stop"
Set-StrictMode -Version Latest
$source="C:\tmp\ran-pit-20261025-train-dev.json"
$out="C:\tmp\ran-pit-20261025-pedigri-v3-300.json"
if(-not(Test-Path -LiteralPath $source -PathType Leaf)){
  throw "RAN_BASKET_ORIGINAL_300_MISSING"
}
$originalVersion="RAN_PEDIGREE_3LINE_FOAL_WEIGHTED_V3_20261025"
if(-not(Test-Path -LiteralPath $out -PathType Leaf)){
  $nodeEnvArgs=@()
  $specific=[Environment]::GetEnvironmentVariable("RAN_ENV_FILE","Process")
  if($specific){
    if(-not(Test-Path -LiteralPath $specific -PathType Leaf)){throw "RAN_BASKET_RAN_ENV_FILE_NOT_FOUND"}
    $nodeEnvArgs+=("--env-file=$((Resolve-Path -LiteralPath $specific).Path)")
  }else{
    foreach($f in @(".env",".env.local")){
      if(Test-Path -LiteralPath $f -PathType Leaf){$nodeEnvArgs+=("--env-file=$f")}
    }
  }
  if($nodeEnvArgs.Count -eq 0 -and -not $env:DATABASE_URL){
    throw "RAN_BASKET_DATABASE_CONFIG_MISSING (requires read-only existing source)"
  }
  & node @nodeEnvArgs .\arac-ran-db-onkontrol.cjs
  if($LASTEXITCODE -ne 0){throw "RAN_BASKET_READ_ONLY_DB_PREFLIGHT_FAILED"}
  Write-Host "[RAN_BASKET] PIT V3 SIRE/DAM/DAMSIRE source reads only; original 33 signals frozen."
  $originalQuiet=[Environment]::GetEnvironmentVariable("RAN_PIT_QUIET_DB_LOG","Process")
  try{
    [Environment]::SetEnvironmentVariable("RAN_PIT_QUIET_DB_LOG","1","Process")
    & node @nodeEnvArgs node_modules/tsx/dist/cli.mjs .\arac-ran-pedigri-v3-hizli-yenile.mts
    if($LASTEXITCODE -ne 0){throw "RAN_BASKET_V3_SOURCE_FAIL (checkpoint preserved)"}
  }finally{
    [Environment]::SetEnvironmentVariable("RAN_PIT_QUIET_DB_LOG",$originalQuiet,"Process")
  }
}else{
  Write-Host "[RAN_BASKET] Complete V3 data found; skip DB reads, verify hashes."
}
$manifestPath="$out.manifest.json"
if(-not(Test-Path -LiteralPath $manifestPath -PathType Leaf)){
  throw "RAN_BASKET_V3_MANIFEST_MISSING"
}
$m=Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
$sourceSHA=(Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash.ToLowerInvariant()
$outSHA=(Get-FileHash -LiteralPath $out -Algorithm SHA256).Hash.ToLowerInvariant()
if($m.version -ne $originalVersion -or $m.races -ne 300 -or
   $m.trainingRaces -ne 238 -or $m.developmentRaces -ne 62 -or
   $m.everyHorseHasThreeLineages -ne $true -or
   $m.sourceSha -ne $sourceSHA -or $m.outputSha -ne $outSHA){
  throw "RAN_BASKET_V3_SHA_AND_LINEAGE_INTEGRITY_FAIL"
}
Write-Host "[RAN_BASKET] PASS V3 source 300/300, SIRE/DAM/DAMSIRE per horse, no model changed."
Write-Host "[RAN_BASKET] dataset=$out"
