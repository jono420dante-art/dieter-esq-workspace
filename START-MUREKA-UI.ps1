# Start DIETER mureka-clone (Vite) — open http://localhost:5173
# Run in a SECOND PowerShell window after START-LOCAL-API.ps1
$ErrorActionPreference = 'Stop'
$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$Ui = Join-Path $Here 'mureka-clone'
if (-not (Test-Path $Ui)) {
  Write-Host "ERROR: Folder not found: $Ui" -ForegroundColor Red
  exit 1
}
Set-Location $Ui
if (-not (Test-Path '.\package.json')) {
  Write-Host "ERROR: package.json missing in mureka-clone" -ForegroundColor Red
  exit 1
}
Write-Host ">>> $Ui" -ForegroundColor Cyan
Write-Host "npm install (first time only)..." -ForegroundColor DarkGray
if (-not (Test-Path '.\node_modules')) { npm install }
npm run dev
