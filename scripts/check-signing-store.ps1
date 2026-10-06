$ErrorActionPreference = 'Stop'
$thumbprint = $env:RKSCREEN_SIGN_THUMBPRINT
if (-not $thumbprint) { exit 0 }
if ($thumbprint -notmatch '^[a-fA-F0-9]{40}$') { throw 'Invalid code signing certificate thumbprint' }
$certificates = @(Get-ChildItem Cert:\CurrentUser\My,Cert:\LocalMachine\My | Where-Object { $_.Thumbprint -eq $thumbprint })
$now = Get-Date
$usable = @($certificates | Where-Object {
    $_.HasPrivateKey -and $_.NotBefore -le $now -and $_.NotAfter -gt $now -and
    (@($_.EnhancedKeyUsageList | ForEach-Object { $_.ObjectId.Value }) -contains '1.3.6.1.5.5.7.3.3')
})
if ($usable.Count -eq 0) {
    throw 'Code signing identity is not available. Activate the certificate and connect its hardware/cloud provider before building. Existing EXEs were not changed.'
}
Write-Host 'Code signing identity is available. Build-time signing and final signature verification are still required.'
