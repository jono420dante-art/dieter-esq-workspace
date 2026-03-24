Param(
  [int]$ApiPort = 8787,
  [int]$UiPort = 5173,
  [int]$TrpcPort = 8790
)

$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Backend = Join-Path $Root "dieter-backend"
$Ui = Join-Path $Root "dieter-prototype"
$Trpc = Join-Path $Backend "dieter-trpc"

Write-Host "Starting DIETER backend on :$ApiPort"
Set-Location $Backend

if (!(Test-Path ".venv")) {
  python -m venv .venv
}

& ".\.venv\Scripts\Activate.ps1"
pip install -r requirements.txt | Out-Null

try {
  Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/health" | Out-Null
  Write-Host "Backend already running."
} catch {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$Backend`"; .\.venv\Scripts\Activate.ps1; uvicorn app.main:app --port $ApiPort"
  Start-Sleep -Seconds 2
}

Write-Host "Starting DIETER UI server on :$UiPort"
Set-Location $Ui

try {
  $code = (Invoke-WebRequest "http://127.0.0.1:$UiPort/index.html" -UseBasicParsing -TimeoutSec 2).StatusCode
  if ($code -eq 200) {
    Write-Host "UI server already running."
  } else {
    throw "Unexpected status $code"
  }
} catch {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$Ui`"; python -m http.server $UiPort"
  Start-Sleep -Seconds 1
}
Start-Sleep -Seconds 1

$Url = "http://127.0.0.1:$UiPort/index.html#/studio"
Write-Host "Open: $Url"
Start-Process $Url

Write-Host "Starting DIETER tRPC on :$TrpcPort"
try {
  $code = (Invoke-WebRequest "http://127.0.0.1:$TrpcPort/health" -UseBasicParsing -TimeoutSec 2).StatusCode
  if ($code -eq 200) {
    Write-Host "tRPC already running."
  } else {
    throw "Unexpected status $code"
  }
} catch {
  Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd `"$Trpc`"; npm run dev"
  Start-Sleep -Seconds 2
}

Write-Host ""
Write-Host "To install as an app (PWA):"
Write-Host "- Open in Chrome/Edge"
Write-Host "- Click Install in the address bar"

