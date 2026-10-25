# ROTAGANYAN v1.0 — ONE-SHOT ISOLATED POSTGRES ROUNDTRIP.
# Creates a NEW disposable Docker PostgreSQL, uses only 127.0.0.1, removes it in finally.
# Never reads application DATABASE_URL/DIRECT_URL, never runs prisma db push/migrate
# against the app, never writes Prediction/Pick/HomeKupon.
$ErrorActionPreference = "Stop"
Set-StrictMode -Version Latest

$container = "ran-shadow-$PID-$([guid]::NewGuid().ToString('N').Substring(0,8))"
$password = [guid]::NewGuid().ToString("N")
$started = $false
$vars = @("DATABASE_URL", "DIRECT_URL", "RAN_TEST_DATABASE_URL", "RAN_TEST_LOCAL_DB_ACK", "RAN_SHADOW_SNAPSHOT_WRITES", "NODE_ENV")
$original = @{}
foreach ($name in $vars) {
  $original[$name] = [Environment]::GetEnvironmentVariable($name, "Process")
}
try {
  if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    throw "RAN_LOCAL_POSTGRES_MISSING: Docker CLI bulunamadi. Docker Desktop kurulu ve calisir olmali. Production veya bulut DB kullanilmadi."
  }
  & docker info --format '{{.ServerVersion}}' 1>$null 2>$null
  if ($LASTEXITCODE -ne 0) {
    $desktop = Join-Path $env:ProgramFiles "Docker\Docker\Docker Desktop.exe"
    if (Test-Path $desktop) {
      Write-Host "[RAN_DOCKER] Docker Desktop baslatiliyor..."
      Start-Process -FilePath $desktop | Out-Null
      $ready = $false
      for ($i = 0; $i -lt 75; $i++) {
        Start-Sleep -Seconds 2
        & docker info --format '{{.ServerVersion}}' 1>$null 2>$null
        if ($LASTEXITCODE -eq 0) { $ready = $true; break }
      }
      if (-not $ready) { throw "RAN_DOCKER_ENGINE_UNAVAILABLE: Docker Desktop Engine baslamadi." }
    } else {
      throw "RAN_DOCKER_ENGINE_UNAVAILABLE: Docker Engine calismiyor; Docker Desktop'i baslatin."
    }
  }
  Write-Host "[RAN] Son kod kontrolleri..."
  & npx tsc --noEmit -p tsconfig.json
  if ($LASTEXITCODE -ne 0) { throw "RAN_TYPESCRIPT_FAIL" }

  $tests = @(
    "src/lib/rotaganyan-analiz-motoru/isolated-db-guard.test.ts",
    "src/server/services/ran-snapshot-bundle.service.test.ts",
    "src/lib/rotaganyan-analiz-motoru/ran-snapshot-bundle.test.ts"
  )
  & npx vitest run $tests
  if ($LASTEXITCODE -ne 0) { throw "RAN_TESTS_FAIL" }

  Write-Host "[RAN_DOCKER] Izole, gecici PostgreSQL olusturuluyor..."
  $dockerArgs = @(
    "run","--detach","--rm","--name",$container,
    "--env","POSTGRES_USER=ran_shadow",
    "--env","POSTGRES_PASSWORD=$password",
    "--env","POSTGRES_DB=ran_shadow_test",
    "--publish","127.0.0.1::5432",
    "--health-cmd","pg_isready -U ran_shadow -d ran_shadow_test",
    "--health-interval","1s","--health-timeout","2s","--health-retries","60",
    "postgres:16-alpine"
  )
  $id = & docker @dockerArgs
  if ($LASTEXITCODE -ne 0 -or -not $id) { throw "RAN_DOCKER_POSTGRES_START_FAILED" }
  $started = $true

  $healthy = $false
  for ($i = 0; $i -lt 90; $i++) {
    $status = & docker inspect --format '{{.State.Health.Status}}' $container
    if ($LASTEXITCODE -ne 0) { throw "RAN_DOCKER_POSTGRES_CONTAINER_EXITED" }
    if ($status.Trim() -eq "healthy") { $healthy = $true; break }
    if ($status.Trim() -eq "unhealthy") { throw "RAN_DOCKER_POSTGRES_UNHEALTHY" }
    Start-Sleep -Seconds 1
  }
  if (-not $healthy) { throw "RAN_DOCKER_POSTGRES_NOT_READY" }

  $portMappings = @(& docker port $container "5432/tcp")
  if ($LASTEXITCODE -ne 0) { throw "RAN_DOCKER_PORT_LOOKUP_FAILED" }
  $port = $null
  foreach ($line in $portMappings) {
    if ($line -match '^127\.0\.0\.1:(\d+)$') { $port = $Matches[1]; break }
  }
  if (-not $port) { throw "RAN_DOCKER_LOOPBACK_PORT_NOT_FOUND: " + ($portMappings -join ",") }

  $url = "postgresql://ran_shadow:$password@127.0.0.1:$port/ran_shadow_test"
  [Environment]::SetEnvironmentVariable("DATABASE_URL", $url, "Process")
  [Environment]::SetEnvironmentVariable("DIRECT_URL", $null, "Process")
  [Environment]::SetEnvironmentVariable("RAN_TEST_DATABASE_URL", $url, "Process")
  [Environment]::SetEnvironmentVariable("RAN_TEST_LOCAL_DB_ACK", "ran_shadow_test", "Process")
  [Environment]::SetEnvironmentVariable("RAN_SHADOW_SNAPSHOT_WRITES", "isolated-test-only", "Process")
  [Environment]::SetEnvironmentVariable("NODE_ENV", "test", "Process")

  Write-Host "[RAN_PG] ephemeral PostgreSQL: db=ran_shadow_test host=127.0.0.1 port=$port"
  & node node_modules/tsx/dist/cli.mjs ./arac-ran-izole-postgres-kayit-testi.mts
  if ($LASTEXITCODE -ne 0) { throw "RAN_REAL_POSTGRES_ROUNDTRIP_FAILED" }
  Write-Host "[RAN_PG] SUCCESS: snapshot kayit/okuma, 6 ayak ve kupon parity PASS."
} finally {
  if ($started) {
    Write-Host "[RAN_DOCKER] Gecici PostgreSQL kapatiliyor ve siliniyor..."
    & docker rm --force $container 1>$null 2>$null
  }
  foreach ($name in $vars) {
    [Environment]::SetEnvironmentVariable($name, $original[$name], "Process")
  }
}
