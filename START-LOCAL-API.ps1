# Start DIETER Local Studio (Python) on http://127.0.0.1:8890
# Easiest: double-click OPEN-DIETER-LOCAL.bat in this same folder.
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Studio = Join-Path $Here 'dieter-local-studio'
if (-not (Test-Path $Studio)) {
  Write-Host "ERROR: Folder not found: $Studio" -ForegroundColor Red
  Read-Host "Press Enter to close"
  exit 1
}
Set-Location $Studio
Write-Host ">>> $Studio" -ForegroundColor Cyan
try {
  & .\run-local-studio.ps1
} catch {
  Write-Host $_ -ForegroundColor Red
  Read-Host "Press Enter to close"
}
