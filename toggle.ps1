# Flip the "enabled" flag in ~/.dsh/windows-notify.json (master switch for toasts).
# NOTE: keep this file pure ASCII -- Windows PowerShell 5.1 decodes a .ps1 without a
# UTF-8 BOM as ANSI, and non-ASCII comments can corrupt the parse.
$ErrorActionPreference = 'Stop'

$path = Join-Path $env:USERPROFILE '.dsh\windows-notify.json'
$state = [ordered]@{ enabled = $true; sound = $true }
if (Test-Path $path) {
  try {
    $loaded = Get-Content -Raw -Encoding UTF8 $path | ConvertFrom-Json
    foreach ($p in $loaded.PSObject.Properties) { $state[$p.Name] = $p.Value }
  } catch {}
}
$state.enabled = -not [bool]$state.enabled

# Write UTF-8 WITHOUT a BOM: Node's JSON.parse throws on a BOM, which would silently
# disable the switch. PS 5.1's "Set-Content -Encoding UTF8" always adds one.
$json = $state | ConvertTo-Json
[System.IO.File]::WriteAllText($path, $json, (New-Object System.Text.UTF8Encoding($false)))

if ($state.enabled) { Write-Host 'Notify: ON  (enabled = true)' -ForegroundColor Green }
else { Write-Host 'Notify: OFF (enabled = false)' -ForegroundColor Yellow }
