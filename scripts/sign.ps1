$ErrorActionPreference = 'Stop'
# electron-builder signs the payload before packaging and then the outer EXE.
# Signing only the outer portable launcher leaves extracted code unsigned.
$packageRoot = Split-Path $PSScriptRoot -Parent
$packageConfig = Get-Content -LiteralPath (Join-Path $packageRoot 'package.json') -Raw | ConvertFrom-Json
$releasePath = Join-Path $packageRoot $packageConfig.build.directories.output
$unpackedPath = Join-Path $releasePath 'win-unpacked'
if (-not (Test-Path -LiteralPath (Join-Path $unpackedPath 'RK Screen.exe'))) { throw 'Missing packaged application' }
$outer = @(Get-ChildItem -LiteralPath $releasePath -Filter '*.exe' -File)
if ($outer.Count -eq 0) { throw 'Missing release executable' }
$inner = @(Get-ChildItem -LiteralPath $unpackedPath -Recurse -File | Where-Object { $_.Extension -in @('.exe', '.dll', '.node') })
$failures = @()
foreach ($file in @($outer) + @($inner)) {
    $signature = Get-AuthenticodeSignature -LiteralPath $file.FullName
    if ($signature.Status -ne 'Valid' -or -not $signature.TimeStamperCertificate) {
        $failures += ($file.FullName.Substring($releasePath.Length + 1) + ': ' + $signature.Status + '; timestamp=' + [bool]$signature.TimeStamperCertificate)
    }
}
if ($failures.Count -gt 0) { throw ('Public release blocked: signature/timestamp verification failed.' + [Environment]::NewLine + ($failures -join [Environment]::NewLine)) }
Write-Host ('Verified signatures and timestamps: ' + ($outer.Count + $inner.Count) + ' files. Smart App Control field testing is still required.')
