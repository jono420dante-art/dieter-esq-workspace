param([switch]$ApiOnly, [switch]$UiOnly)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "  DIETER PRO - Full Stack Studio" -ForegroundColor Magenta
Write-Host "  ===============================" -ForegroundColor DarkMagenta
Write-Host ""

if (-not $UiOnly) {
    Write-Host "  Starting API server on http://localhost:3001 ..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory "$PSScriptRoot\api"
}

if (-not $ApiOnly) {
    Start-Sleep -Seconds 2
    Write-Host "  Starting UI dev server on http://localhost:5173 ..." -ForegroundColor Cyan
    Start-Process -NoNewWindow -FilePath "npm" -ArgumentList "run","dev" -WorkingDirectory "$PSScriptRoot\ui"
}

Write-Host ""
Write-Host "  Studio is starting up!" -ForegroundColor Green
Write-Host "  API:  http://localhost:3001/api/health" -ForegroundColor DarkGray
Write-Host "  UI:   http://localhost:5173" -ForegroundColor DarkGray
Write-Host ""
Write-Host "  Press Ctrl+C to stop." -ForegroundColor DarkGray
Write-Host ""

while ($true) { Start-Sleep -Seconds 60 }
