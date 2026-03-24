Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

Write-Host "Serving current folder on http://localhost:5173" -ForegroundColor Cyan
Write-Host "Open: http://localhost:5173/dieter-tower.html" -ForegroundColor Cyan
Write-Host ""

python -m http.server 5173

