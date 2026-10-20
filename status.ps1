# Show the master switch and the plugin's recent log lines.
$ErrorActionPreference = 'SilentlyContinue'
$state = Join-Path $env:USERPROFILE '.dsh\windows-notify.json'
$log = Join-Path $env:USERPROFILE '.dsh\windows-notify.log'

Write-Host '--- master switch (~/.dsh/windows-notify.json) ---' -ForegroundColor Cyan
if (Test-Path $state) { Get-Content $state -Raw } else { Write-Host '(missing -> defaults to enabled)' }

Write-Host '--- recent log (~/.dsh/windows-notify.log) ---' -ForegroundColor Cyan
if (Test-Path $log) {
  Get-Content $log -Tail 10
  $loaded = Select-String -Path $log -Pattern 'plugin loaded' -SimpleMatch
  if (-not $loaded) {
    Write-Host ''
    Write-Host 'No "plugin loaded" line yet -> restart DSH so the plugin actually loads.' -ForegroundColor Yellow
  }
} else {
  Write-Host '(no log yet -> the plugin has never run; restart DSH)' -ForegroundColor Yellow
}
