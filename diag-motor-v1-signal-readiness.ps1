$ErrorActionPreference = "Stop"
Set-Location (Split-Path -Parent $MyInvocation.MyCommand.Path)

$report = New-Object 'System.Collections.Generic.List[string]'
$vectors = New-Object 'System.Collections.Generic.List[object]'

function Emit([string]$line) {
    [void]$script:report.Add($line)
    Write-Host $line
}

function Walk($item) {
    if ($null -eq $item) { return }

    if ($item -is [array]) {
        foreach ($x in $item) { Walk $x }
        return
    }

    if ($item -isnot [pscustomobject]) { return }

    $names = @($item.PSObject.Properties.Name)

    if ($names -contains "signals") {
        if ($item.signals -is [array] -and
            $item.signals.Count -ge 10) {
            [void]$script:vectors.Add($item)
            return
        }
    }

    foreach ($property in $item.PSObject.Properties) {
        Walk $property.Value
    }
}

function Read-Signal($vector, [string]$code) {
    foreach ($s in $vector.signals) {
        if ($s.code -ne $code) { continue }
        if ($s.observed -ne $true) { return $null }
        if ($null -eq $s.rawValue) { return $null }

        try {
            $v = [Convert]::ToDouble(
                $s.rawValue,
                [Globalization.CultureInfo]::InvariantCulture
            )

            if ([double]::IsNaN($v) -or
                [double]::IsInfinity($v)) {
                return $null
            }

            return $v
        } catch {
            return $null
        }
    }

    return $null
}

$codes = @(
    "FORM_01", "FORM_02", "FORM_03",
    "HIZ_01", "SINIF_01",
    "PMZ_01", "PMZ_02",
    "FORM_x_ZEMIN",
    "TEMPO_01", "TEMPO_02", "TEMPO_03", "TEMPO_04",
    "JOKEY_01", "JOKEY_02", "JOKEY_03", "JOKEY_04",
    "KILO_01", "KILO_02", "KILO_03", "KILO_04"
)

Emit "=== ROTAGANYAN V1 SINYAL HAZIRLIK RAPORU ==="
Emit "Tarih: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
Emit "Beklenen sinyal sayisi: $($codes.Count)"

$cache = "src/lib/motor-v1/artifacts/j02-oos-21x6-snapshot.json"

if (Test-Path $cache) {
    Emit ""
    Emit "=== 27 YARISLIK ONBELLEK ==="

    $data = Get-Content $cache -Raw -Encoding UTF8 |
        ConvertFrom-Json

    Walk $data

    $n = $vectors.Count
    Emit "Bulunan sinyal vektoru: $n"

    if ($n -gt 0) {
        Emit ""
        Emit "=== SINYAL KAPSAMA ==="

        foreach ($code in $codes) {
            $values = New-Object 'System.Collections.Generic.List[double]'

            foreach ($v in $vectors) {
                $x = Read-Signal $v $code
                if ($null -ne $x) {
                    [void]$values.Add([double]$x)
                }
            }

            $observed = $values.Count
            $rate = [math]::Round(100.0 * $observed / $n, 1)
            $unique = @($values | Sort-Object -Unique).Count

            $flag = "OK"

            if ($observed -lt 10) {
                $flag = "KRITIK_ORNEKLEM"
            } elseif ($rate -lt 50) {
                $flag = "DUSUK_KAPSAMA"
            } elseif ($rate -lt 70) {
                $flag = "KISMI_KAPSAMA"
            }

            $range = ""
            if ($observed -gt 0) {
                $m = $values | Measure-Object -Minimum -Maximum
                $range = "min=$($m.Minimum) max=$($m.Maximum)"
            }

            Emit (("{0,-15} {1,4}/{2,-4} %{3,-5} " +
                "unique={4,-4} {5} {6}") -f `
                $code, $observed, $n, $rate,
                $unique, $flag, $range)
        }

        Emit ""
        Emit "=== SINYAL CAKISMA TARAMASI ==="

        $pairs = @(
            @("KILO_01", "KILO_03"),
            @("FORM_01", "FORM_03"),
            @("JOKEY_01", "JOKEY_02"),
            @("TEMPO_01", "TEMPO_03"),
            @("PMZ_01", "FORM_x_ZEMIN")
        )

        foreach ($pair in $pairs) {
            $count = 0
            $sx = 0.0; $sy = 0.0
            $sxx = 0.0; $syy = 0.0; $sxy = 0.0

            foreach ($v in $vectors) {
                $x = Read-Signal $v $pair[0]
                $y = Read-Signal $v $pair[1]

                if ($null -eq $x -or $null -eq $y) {
                    continue
                }

                $count++
                $sx += $x
                $sy += $y
                $sxx += $x * $x
                $syy += $y * $y
                $sxy += $x * $y
            }

            $label = "$($pair[0]) x $($pair[1])"

            if ($count -lt 20) {
                Emit "$label : yetersiz ortak gozlem ($count)"
                continue
            }

            $dx = $count * $sxx - $sx * $sx
            $dy = $count * $syy - $sy * $sy
            $denom = [math]::Sqrt(
                [math]::Max(0.0, [double]($dx * $dy))
            )

            if ($denom -eq 0) {
                Emit "$label : korelasyon hesaplanamadi"
                continue
            }

            $r = ($count * $sxy - $sx * $sy) / $denom

            Emit "$label : r=$([math]::Round($r,3)) n=$count"
        }
    } else {
        Emit "UYARI: Onbellek formati taninamadi."
    }
} else {
    Emit "UYARI: 27 yarislik snapshot bulunamadi."
}

Emit ""
Emit "=== PILOT MODEL BUTUNLUGU ==="

$model = "src/lib/motor-v1/artifacts/model-v1-pilot.json"

if (Test-Path $model) {
    $hash = (Get-FileHash $model -Algorithm SHA256).Hash

    $expectedHash = (
        "D9FD3985B94DB69EDADA367E4B15FD57498F1659211F942C5E29A1E8F7114EAB"
    )

    Emit "SHA256: $hash"
    Emit "Eski kabul edilen pilot ile ayni: $($hash -eq $expectedHash)"
} else {
    Emit "UYARI: Pilot model bulunamadi."
}

Emit ""
Emit "=== PIST_DURUM_01 ==="

$parser = "src/lib/motor-v1/features/pist-durum-01.ts"
$test = "src/lib/motor-v1/features/pist-durum-01.test.ts"
$training = "src/lib/motor-v1/engine/training.ts"
$featureVector = "src/lib/motor-v1/engine/feature-vector.ts"

Emit "Parser dosyasi: $(Test-Path $parser)"
Emit "Test dosyasi: $(Test-Path $test)"

foreach ($file in @($training, $featureVector)) {
    $connected = $false

    if (Test-Path $file) {
        $connected = [bool](
            Select-String -Path $file `
                -Pattern "PIST_DURUM_01" -Quiet
        )
    }

    Emit "$file : sinyal kodu referansi=$connected"
}

Emit "NOT: Kod referansi tek basina calisan entegrasyonu kanitlamaz."

Emit ""
Emit "=== AYLIK VERI HAZIRLAMA ==="

$log = Join-Path $env:TEMP "v1-monthly-probe.log"

if (Test-Path $log) {
    $progress = @(
        Select-String -Path $log -Pattern '^V1_PROBE_RACE'
    )

    $done = [bool](
        Select-String -Path $log -Pattern '^V1_PROBE_PASS' -Quiet
    )

    Emit "Tamamlanan aylik ornek: $($progress.Count)"
    Emit "Islem basariyla tamamlandi: $done"

    foreach ($line in ($progress | Select-Object -Last 3)) {
        Emit $line.Line
    }
} else {
    Emit "Aylik probe logu bulunamadi."
}

Emit ""
Emit "=== DEGERLENDIRME NOTLARI ==="
Emit "Kapsama basarili tahmin anlamina gelmez."
Emit "Korelasyon sinyalin gereksiz oldugunu tek basina kanitlamaz."
Emit "PIST sinyali icin yaris oncesi veri zamani dogrulanmali."
Emit "JOKEY_03, PMZ_01, KILO_03 ve JOKEY_02 ayri incelenmeli."
Emit "Genis OOS ve ablasyon testleri henuz bu raporun parcasi degil."

$reportDir = "src/lib/motor-v1/artifacts"
$out = Join-Path $reportDir "signal-readiness-report.txt"

$report | Set-Content $out -Encoding UTF8

Emit ""
Emit "RAPOR: $out"
Emit "V1_SIGNAL_READINESS_PASS"